import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { AppError } from '../utils/app-error.js';
import type { LoginInput, SignupInput } from '../validators/auth.schema.js';
import {
  issueRefreshToken,
  revokeSession,
  rotateRefreshToken,
  signAccessToken,
  type RefreshToken,
} from './token.service.js';
import { getMe, type Me } from './user.service.js';

const BCRYPT_COST = 12;

// Compared against when the email is unknown, so a wrong email takes as long as a wrong password.
const DUMMY_HASH = bcrypt.hashSync('drape-no-such-user', BCRYPT_COST);

export type Session = { accessToken: string; refresh: RefreshToken; user: Me };

// One transaction: user → settings → starter subcategories → refresh token (01 §7).
export async function signup(input: SignupInput, userAgent: string | null): Promise<Session> {
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_COST);

  const { userId, refresh } = await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email: input.email,
        passwordHash,
        name: input.name,
        username: input.username,
        settings: { create: {} },
      },
    });
    await tx.$executeRaw`
      INSERT INTO subcategories (user_id, category_id, name, sort_order)
      SELECT ${user.id}::uuid, category_id, name, sort_order FROM subcategory_templates`;
    const refresh = await issueRefreshToken(tx, user.id, userAgent);
    return { userId: user.id, refresh };
  });

  return { accessToken: signAccessToken(userId), refresh, user: await getMe(userId) };
}

export async function login(input: LoginInput, userAgent: string | null): Promise<Session> {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  const matches = await bcrypt.compare(input.password, user?.passwordHash ?? DUMMY_HASH);
  if (!user || !matches) {
    throw new AppError('INVALID_CREDENTIALS', 'Wrong email or password.', 401);
  }

  const refresh = await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
    return issueRefreshToken(tx, user.id, userAgent);
  });

  return { accessToken: signAccessToken(user.id), refresh, user: await getMe(user.id) };
}

export async function refresh(
  token: string,
  userAgent: string | null,
): Promise<{ accessToken: string; refresh: RefreshToken }> {
  const rotated = await rotateRefreshToken(token, userAgent);
  return {
    accessToken: signAccessToken(rotated.userId),
    refresh: { token: rotated.token, expiresAt: rotated.expiresAt },
  };
}

export async function logout(token: string | undefined): Promise<void> {
  if (token) await revokeSession(token);
}
