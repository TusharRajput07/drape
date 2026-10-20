import dns from 'node:dns';
import http from 'node:http';
import https from 'node:https';
import net from 'node:net';
import zlib from 'node:zlib';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';
import { afterCursor, orderBy, toPage, type Page, type PageMeta } from '../utils/cursor.js';
import { normalizeUrl } from '../utils/url-normalize.js';
import type { AddWishlistInput } from '../validators/wishlist.schema.js';
import { deleteFiles, imageData, saveWithFile, uploadFromUrl } from './image.service.js';
import type { Image } from './user.service.js';

export type WishlistItem = {
  id: string;
  url: string;
  siteName: string;
  productName: string;
  image: Image | null;
};

const wishlistSelect = {
  id: true,
  url: true,
  siteName: true,
  productName: true,
  createdAt: true,
  image: { select: { url: true, width: true, height: true } },
} as const satisfies Prisma.WishlistItemSelect;

type WishlistRow = Prisma.WishlistItemGetPayload<{ select: typeof wishlistSelect }>;

const toWishlistItem = ({ createdAt: _, ...row }: WishlistRow): WishlistItem => row;

const notFound = () => new AppError('NOT_FOUND', 'Not found.', 404);

// ---------- Fetching the shop's page (02 §8.9 step 3) ----------

const FETCH_TIMEOUT_MS = 8000;
const MAX_PAGE_BYTES = 2 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-IN,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

// SSRF guard: never connect to private, loopback, link-local or other non-public addresses.
const blocked = new net.BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  // Not ::ffff:0:0/96 here: BlockList would then match every IPv4 address. isBlocked refuses
  // IPv4-mapped addresses itself.
  ['64:ff9b::', 96],
  ['100::', 64],
  ['2001:db8::', 32],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(address, prefix, 'ipv6');
}

// IPv4-mapped IPv6 (::ffff:…) is never needed to reach a public shop, so it's refused too.
function isBlocked(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return blocked.check(address, 'ipv4');
  if (family === 6) return /^::ffff:/i.test(address) || blocked.check(address, 'ipv6');
  return true;
}

// Used for every connection, so a redirect or a DNS answer can't point inside the network.
const guardedLookup = ((hostname, options, callback) => {
  dns.lookup(hostname, { family: options.family, hints: options.hints, all: true }, (err, list) => {
    if (err) return callback(err, '');
    const bad = list.length === 0 || list.some((a) => isBlocked(a.address));
    if (bad) return callback(new Error(`Blocked address for ${hostname}`), '');
    const first = list[0]!;
    if (options.all) callback(null, list);
    else callback(null, first.address, first.family);
  });
}) as net.LookupFunction;

function assertPublicHost(url: URL) {
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Not an http(s) URL: ${url.protocol}`);
  }
  const host = url.hostname.replace(/^\[|\]$/g, '');
  // IP literals skip the DNS lookup, so they are checked here.
  if (net.isIP(host) && isBlocked(host)) throw new Error(`Blocked address ${host}`);
}

function requestOnce(url: URL, signal: AbortSignal): Promise<http.IncomingMessage> {
  return new Promise((resolve, reject) => {
    const client = url.protocol === 'https:' ? https : http;
    const req = client.request(url, { headers: HEADERS, lookup: guardedLookup, signal }, resolve);
    req.on('error', reject);
    req.end();
  });
}

function decode(body: Buffer, contentType: string): string {
  const charset = contentType.match(/charset=["']?([\w-]+)/i)?.[1] ?? 'utf-8';
  try {
    return new TextDecoder(charset).decode(body);
  } catch {
    return new TextDecoder('utf-8').decode(body);
  }
}

// Reads at most MAX_PAGE_BYTES (decompressed); the tags we need are near the top.
function readBody(res: http.IncomingMessage, contentType: string): Promise<string> {
  const encoding = (res.headers['content-encoding'] ?? '').trim().toLowerCase();
  const stream =
    encoding === 'gzip' || encoding === 'x-gzip'
      ? res.pipe(zlib.createGunzip())
      : encoding === 'deflate'
        ? res.pipe(zlib.createInflate())
        : encoding === 'br'
          ? res.pipe(zlib.createBrotliDecompress())
          : res;

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let size = 0;
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      res.destroy();
      resolve(decode(Buffer.concat(chunks), contentType));
    };
    const fail = (err: Error) => {
      if (done) return;
      done = true;
      res.destroy();
      reject(err);
    };
    stream.on('data', (chunk: Buffer) => {
      const room = MAX_PAGE_BYTES - size;
      chunks.push(chunk.subarray(0, room));
      size += Math.min(chunk.length, room);
      if (size >= MAX_PAGE_BYTES) finish();
    });
    stream.on('end', finish);
    stream.on('error', fail);
    res.on('error', fail);
  });
}

type FetchedPage = { url: URL; html: string };

// Any failure (timeout, blocked host, not HTML, 4xx/5xx…) → null: the name comes from the link.
async function fetchPage(link: string): Promise<FetchedPage | null> {
  const signal = AbortSignal.timeout(FETCH_TIMEOUT_MS);
  let url = new URL(link);
  try {
    for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
      assertPublicHost(url);
      const res = await requestOnce(url, signal);
      const status = res.statusCode ?? 0;
      const location = res.headers.location;
      if (status >= 300 && status < 400 && location) {
        res.resume();
        url = new URL(location, url);
        continue;
      }
      const contentType = res.headers['content-type'] ?? '';
      if (status < 200 || status >= 300 || !/html/i.test(contentType)) {
        res.resume();
        throw new Error(`${url.host} answered ${status} ${contentType}`);
      }
      return { url, html: await readBody(res, contentType) };
    }
    throw new Error(`More than ${MAX_REDIRECTS} redirects`);
  } catch (err) {
    console.error(err);
    return null;
  }
}

// ---------- Reading the page (steps 4–5) ----------

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  reg: '®',
  trade: '™',
  copy: '©',
};

function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const clean = (text: string | undefined, max: number) =>
  text ? decodeEntities(text).replace(/\s+/g, ' ').trim().slice(0, max) : '';

// <meta property="og:title" content="…"> and friends, first one wins.
function metaTags(html: string): Map<string, string> {
  const tags = new Map<string, string>();
  for (const [tag] of html.matchAll(/<meta\b[^>]*>/gi)) {
    const attrs: Record<string, string> = {};
    for (const m of tag.matchAll(/([a-z_:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+))/gi)) {
      attrs[m[1]!.toLowerCase()] = m[2] ?? m[3] ?? m[4] ?? '';
    }
    const key = (attrs.property ?? attrs.name ?? '').toLowerCase();
    if (key && attrs.content !== undefined && !tags.has(key)) tags.set(key, attrs.content);
  }
  return tags;
}

const SHOPS: Record<string, string> = {
  myntra: 'Myntra',
  amazon: 'Amazon',
  ajio: 'AJIO',
  flipkart: 'Flipkart',
  hm: 'H&M',
  zara: 'Zara',
};

// "www.amazon.co.in" → "amazon"
function domainLabel(host: string): string {
  if (net.isIP(host.replace(/^\[|\]$/g, '')) || !host.includes('.')) return host;
  const parts = host.replace(/^(?:www\d?|m)\./, '').split('.');
  const secondLevel = ['co', 'com', 'net', 'org', 'gov', 'ac'];
  if (parts.length >= 3 && secondLevel.includes(parts.at(-2)!)) return parts.at(-3)!;
  return parts.at(-2) ?? parts[0] ?? host;
}

// "Amazon.in" → "amazonin", for comparing a title with the shop's name.
const squash = (text: string) => text.toLowerCase().replace(/[^a-z0-9]/g, '');

const capitalise = (word: string) => word.charAt(0).toUpperCase() + word.slice(1);

function siteNameFor(host: string, ogSiteName: string): string {
  if (ogSiteName) return ogSiteName.slice(0, 60);
  const label = domainLabel(host);
  return (SHOPS[label] ?? capitalise(label)).slice(0, 60);
}

// Amazon: the segment before /dp/; otherwise the longest hyphenated segment. Title-cased.
function nameFromLink(link: URL): string {
  const segments = link.pathname
    .split('/')
    .filter(Boolean)
    .map((s) => {
      try {
        return decodeURIComponent(s);
      } catch {
        return s;
      }
    });
  const dp = segments.indexOf('dp');
  const slug =
    dp > 0
      ? segments[dp - 1]
      : segments.filter((s) => s.includes('-')).sort((a, b) => b.length - a.length)[0];
  if (!slug) return '';
  return clean(
    slug
      .replace(/[-_+]+/g, ' ')
      .split(' ')
      .map(capitalise)
      .join(' '),
    200,
  );
}

// ---------- Endpoints ----------

export async function list(
  userId: string,
  query: Page,
): Promise<{ items: WishlistItem[]; meta: PageMeta }> {
  const [rows, total] = await Promise.all([
    prisma.wishlistItem.findMany({
      where: { userId, ...afterCursor(query.cursor, 'newest') },
      select: wishlistSelect,
      orderBy: orderBy('newest'),
      take: query.limit + 1,
    }),
    prisma.wishlistItem.count({ where: { userId } }),
  ]);
  const page = toPage(rows, query.limit, total, 'newest');
  return { items: page.rows.map(toWishlistItem), meta: page.meta };
}

const duplicate = () =>
  new AppError('WISHLIST_DUPLICATE', 'Already in your wishlist.', 409, [
    { field: 'url', message: 'Already in your wishlist.' },
  ]);

// 02 §8.9: normalize → duplicate check (before fetching) → fetch → names → photo → save.
export async function add(userId: string, input: AddWishlistInput): Promise<WishlistItem> {
  const pasted = new URL(input.url);
  const url = normalizeUrl(input.url);
  if (url.length > 2048) {
    throw new AppError('VALIDATION_ERROR', 'Some fields need fixing.', 400, [
      { field: 'url', message: 'That link is too long.' },
    ]);
  }
  const existing = await prisma.wishlistItem.findUnique({
    where: { userId_url: { userId, url } },
    select: { id: true },
  });
  if (existing) throw duplicate();

  const page = await fetchPage(url);
  const tags = page ? metaTags(page.html) : new Map<string, string>();
  const host = (page?.url ?? new URL(url)).hostname;

  const siteName = siteNameFor(host, clean(tags.get('og:site_name'), 60));
  const pageTitle = page
    ? clean(page.html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1], 200)
    : '';
  // A title that is only the shop's name ("Amazon.in" on a page shown to bots) names nothing.
  const bareHost = host.replace(/^(?:www\d?|m)\./, '');
  const shopOnly = new Set([siteName, domainLabel(host), bareHost].map(squash));
  const useful = (title: string) => (shopOnly.has(squash(title)) ? '' : title);
  const productName =
    useful(clean(tags.get('og:title'), 200)) ||
    useful(pageTitle) ||
    nameFromLink(pasted) ||
    `${siteName} item`.slice(0, 200);

  // Step 6: the photo is optional; Cloudinary downloads it itself.
  let imageUrl: string | null = null;
  const og = tags.get('og:image') ?? tags.get('og:image:secure_url');
  if (og && page) {
    try {
      const resolved = new URL(decodeEntities(og.trim()), page.url);
      if (resolved.protocol === 'http:' || resolved.protocol === 'https:') imageUrl = resolved.href;
    } catch {
      // Not a usable URL: no photo.
    }
  }
  const photo = imageUrl ? await uploadFromUrl(userId, imageUrl) : null;

  const save = () =>
    prisma.$transaction(async (tx) => {
      const image = photo
        ? await tx.image.create({ data: imageData(userId, 'wishlist', photo) })
        : null;
      return tx.wishlistItem.create({
        data: { userId, url, siteName, productName, imageId: image?.id ?? null },
        select: wishlistSelect,
      });
    });

  // A parallel save of the same link → WISHLIST_DUPLICATE, and the copied photo is removed.
  const row = photo ? await saveWithFile(photo, save) : await save();
  return toWishlistItem(row);
}

// The item and its photo row, then the Cloudinary file.
export async function remove(userId: string, id: string): Promise<void> {
  const current = await prisma.wishlistItem.findFirst({
    where: { id, userId },
    include: { image: true },
  });
  if (!current) throw notFound();
  await prisma.$transaction(async (tx) => {
    await tx.wishlistItem.delete({ where: { id } });
    if (current.image) await tx.image.delete({ where: { id: current.image.id } });
  });
  if (current.image) await deleteFiles([current.image.publicId]);
}
