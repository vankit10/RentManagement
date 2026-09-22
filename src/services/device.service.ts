import prisma from '../lib/prisma';

// ─── Register / update device token ──────────────────────────────────────────

export async function registerToken(
  userId: string,
  token: string,
  platform: 'IOS' | 'ANDROID',
  appVersion?: string,
) {
  // Upsert: if token exists update lastActiveAt, otherwise create
  return prisma.deviceToken.upsert({
    where: { token },
    update: {
      userId,
      platform,
      appVersion,
      lastActiveAt: new Date(),
    },
    create: {
      userId,
      token,
      platform,
      appVersion,
    },
  });
}

// ─── Remove device token ──────────────────────────────────────────────────────

export async function removeToken(token: string, userId: string) {
  await prisma.deviceToken.deleteMany({ where: { token, userId } });
}

// ─── Get all tokens for a user ────────────────────────────────────────────────

export async function getTokensForUser(userId: string) {
  return prisma.deviceToken.findMany({
    where: { userId },
    orderBy: { lastActiveAt: 'desc' },
  });
}
