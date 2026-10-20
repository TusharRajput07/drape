import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { prisma } from '../db/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import { AppError } from '../utils/app-error.js';

// Access tokens: short-lived JWTs (HS256, sub = user id), kept in client memory.
// Refresh tokens: random 256-bit values, stored as SHA-256 hashes, rotated on every refresh (02 §6).

// A token rotated less than this long ago may come back once more from a parallel refresh
// (two tabs, React dev mode running start-up twice). That isn't treated as theft.
const REUSE_GRACE_MS = 10_000;

export type RefreshToken = { token: string; expiresAt: Date };
export type Rotated = RefreshToken & { userId: string };

const hashToken = (token: string) => createHash('sha256').update(token).digest('hex');

const sessionExpired = () =>
  new AppError('SESSION_EXPIRED', 'Your session has ended. Please log in again.', 401);

export function signAccessToken(userId: string): string {
  return jwt.sign({}, env.JWT_ACCESS_SECRET, {
    algorithm: 'HS256',
    subject: userId,
    expiresIn: env.ACCESS_TOKEN_TTL as jwt.SignOptions['expiresIn'],
  });
}

// Returns the user id, or throws TOKEN_EXPIRED (client should refresh) / UNAUTHENTICATED.
export function verifyAccessToken(token: string): string {
  try {
    const payload = jwt.verify(token, env.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
    if (typeof payload === 'string' || !payload.sub) {
      throw new AppError('UNAUTHENTICATED', 'Please log in.', 401);
    }
    return payload.sub;
  } catch (err) {
    if (err instanceof jwt.TokenExpiredError) {
      throw new AppError('TOKEN_EXPIRED', 'Your session needs refreshing.', 401);
    }
    if (err instanceof jwt.JsonWebTokenError || err instanceof AppError) {
      throw new AppError('UNAUTHENTICATED', 'Please log in.', 401);
    }
    console.error(err);
    throw err;
  }
}

// Creates a refresh token row. A new login starts a new family; rotations stay in theirs.
export async function issueRefreshToken(
  db: Prisma.TransactionClient,
  userId: string,
  userAgent: string | null,
  familyId: string = randomUUID(),
): Promise<RefreshToken & { id: string }> {
  const token = randomBytes(32).toString('base64url');
  const row = await db.refreshToken.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      familyId,
      userAgent,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000),
    },
  });
  return { id: row.id, token, expiresAt: row.expiresAt };
}

// Swaps a refresh token for a new one (sliding 30-day expiry). Presenting an already-rotated
// token after the grace window means it was copied: the whole family (session) is revoked.
export async function rotateRefreshToken(
  token: string,
  userAgent: string | null,
): Promise<Rotated> {
  const now = new Date();

  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
    if (!current || current.expiresAt <= now) return { kind: 'expired' as const };

    if (current.revokedAt) {
      if (!current.replacedById) return { kind: 'expired' as const }; // logged out or already killed
      const recent = now.getTime() - current.revokedAt.getTime() < REUSE_GRACE_MS;
      const alive = await tx.refreshToken.count({
        where: { familyId: current.familyId, revokedAt: null },
      });
      if (recent && alive > 0) {
        const next = await issueRefreshToken(tx, current.userId, userAgent, current.familyId);
        return { kind: 'rotated' as const, userId: current.userId, next };
      }
      return { kind: 'reused' as const, familyId: current.familyId };
    }

    const next = await issueRefreshToken(tx, current.userId, userAgent, current.familyId);
    // Only marks the token if no parallel request rotated it in the meantime.
    await tx.refreshToken.updateMany({
      where: { id: current.id, revokedAt: null },
      data: { revokedAt: now, replacedById: next.id, lastUsedAt: now },
    });
    return { kind: 'rotated' as const, userId: current.userId, next };
  });

  if (outcome.kind === 'reused') {
    // Committed separately: throwing inside the transaction above would undo it.
    await revokeFamily(outcome.familyId, now);
    throw sessionExpired();
  }
  if (outcome.kind === 'expired') throw sessionExpired();
  return { userId: outcome.userId, token: outcome.next.token, expiresAt: outcome.next.expiresAt };
}

// Logout: ends this device's session (the token's family). Unknown tokens are ignored.
export async function revokeSession(token: string): Promise<void> {
  const current = await prisma.refreshToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (current) await revokeFamily(current.familyId, new Date());
}

async function revokeFamily(familyId: string, at: Date): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: at },
  });
}
