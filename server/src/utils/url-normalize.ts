// Wishlist link cleaning (01 §3.14), so the same product saved twice is caught as a duplicate.
// Every link: lowercase host, no #fragment, no tracking parameters, the rest sorted, no
// trailing "/". Known shops get one canonical host, and Amazon links shrink to /dp/<ASIN>.

const TRACKING = new Set([
  'ref',
  'ref_',
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'gbraid',
  'wbraid',
  'msclkid',
  'yclid',
  'igshid',
  'igsh',
  'srsltid',
  'mc_cid',
  'mc_eid',
  '_ga',
  '_gl',
  'si',
  'spm',
  'scm',
]);
const TRACKING_PREFIXES = ['utm_', 'pd_rd_', 'pf_rd_'];

// Shops that serve the same pages on several hosts (www., m., bare). Keyed by registrable domain.
const CANONICAL_HOST: Record<string, string> = {
  'myntra.com': 'www.myntra.com',
  'ajio.com': 'www.ajio.com',
  'flipkart.com': 'www.flipkart.com',
  'hm.com': 'www2.hm.com',
  'zara.com': 'www.zara.com',
};

// amazon.in, amazon.com, amazon.co.uk…
const AMAZON_HOST = /^(?:(?:www|m|smile)\.)?(amazon\.(?:[a-z]{2,3}|co\.[a-z]{2}|com\.[a-z]{2}))$/;
const ASIN = /\/(?:dp|gp\/product|gp\/aw\/d)\/([A-Z0-9]{10})(?:[/?]|$)/i;

const isTracking = (key: string) =>
  TRACKING.has(key.toLowerCase()) || TRACKING_PREFIXES.some((p) => key.toLowerCase().startsWith(p));

// Throws (TypeError) for something that isn't a URL; the validator has checked http(s) already.
export function normalizeUrl(input: string): string {
  const url = new URL(input);
  url.hash = '';
  url.username = '';
  url.password = '';

  const amazon = url.hostname.match(AMAZON_HOST);
  const asin = url.pathname.match(ASIN)?.[1];
  if (amazon && asin) return `https://www.${amazon[1]}/dp/${asin.toUpperCase()}`;

  const bare = url.hostname.replace(/^(?:www\d?|m)\./, '');
  const canonical = CANONICAL_HOST[bare];
  if (canonical) url.hostname = canonical;

  const params = [...url.searchParams].filter(([key]) => !isTracking(key));
  params.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  url.search = new URLSearchParams(params).toString();

  url.pathname = url.pathname.replace(/\/+$/, '');
  const out = url.toString();
  // "https://shop.com/" → "https://shop.com"
  return url.pathname === '/' && !url.search ? out.replace(/\/$/, '') : out;
}
