import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import prisma from '../lib/prisma';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  getRefreshTokenExpiry,
} from '../lib/jwt';
import {
  UnauthorizedError,
  NotFoundError,
  BadRequestError,
} from '../lib/errors';

// ─── Login ────────────────────────────────────────────────────────────────────

export async function login(email: string, password: string) {
  // Find user by email
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: { organization: true },
  });

  if (!user || !user.passwordHash) {
    throw new UnauthorizedError('Invalid email or password');
  }

  if (user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Your account has been disabled. Please contact the owner.');
  }

  // Verify password
  const isValid = await bcrypt.compare(password, user.passwordHash);
  if (!isValid) {
    throw new UnauthorizedError('Invalid email or password');
  }

  // Generate tokens
  const accessToken = generateAccessToken({
    sub: user.id,
    role: user.role,
    orgId: user.organizationId,
    email: user.email ?? undefined,
    phone: user.phone ?? undefined,
  });

  const jti = uuidv4();
  const refreshToken = generateRefreshToken({ sub: user.id, jti });

  // Store refresh token in DB
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId: user.id,
      token: refreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  // Update last login
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: new Date() },
  });

  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      organizationId: user.organizationId,
    },
  };
}

// ─── Refresh token ────────────────────────────────────────────────────────────

export async function refreshTokens(refreshToken: string) {
  // Verify JWT signature + expiry
  let payload: { sub: string; jti: string };
  try {
    payload = verifyRefreshToken(refreshToken) as { sub: string; jti: string };
  } catch {
    throw new UnauthorizedError('Invalid or expired refresh token');
  }

  // Check token exists in DB and is not expired
  const stored = await prisma.refreshToken.findUnique({
    where: { id: payload.jti },
    include: { user: true },
  });

  if (!stored || stored.token !== refreshToken) {
    throw new UnauthorizedError('Refresh token not found or already used');
  }

  if (stored.expiresAt < new Date()) {
    await prisma.refreshToken.delete({ where: { id: payload.jti } });
    throw new UnauthorizedError('Refresh token has expired. Please log in again.');
  }

  if (stored.user.status !== 'ACTIVE') {
    throw new UnauthorizedError('Account is disabled');
  }

  // Rotate: delete old token, issue new pair
  await prisma.refreshToken.delete({ where: { id: payload.jti } });

  const newAccessToken = generateAccessToken({
    sub: stored.user.id,
    role: stored.user.role,
    orgId: stored.user.organizationId,
    email: stored.user.email ?? undefined,
    phone: stored.user.phone ?? undefined,
  });

  const newJti = uuidv4();
  const newRefreshToken = generateRefreshToken({
    sub: stored.user.id,
    jti: newJti,
  });

  await prisma.refreshToken.create({
    data: {
      id: newJti,
      userId: stored.user.id,
      token: newRefreshToken,
      expiresAt: getRefreshTokenExpiry(),
    },
  });

  return { accessToken: newAccessToken, refreshToken: newRefreshToken };
}

// ─── Logout ───────────────────────────────────────────────────────────────────

export async function logout(refreshToken: string) {
  // Delete the specific refresh token (other sessions remain active)
  await prisma.refreshToken.deleteMany({ where: { token: refreshToken } });
}

// ─── Logout all (revoke all sessions) ────────────────────────────────────────

export async function logoutAll(userId: string) {
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// ─── Change password ──────────────────────────────────────────────────────────

export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new NotFoundError('User');
  if (!user.passwordHash) throw new BadRequestError('Password login not set up for this account');

  const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!isValid) throw new UnauthorizedError('Current password is incorrect');

  const hash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash: hash } });

  // Revoke all sessions so user re-logs in everywhere
  await prisma.refreshToken.deleteMany({ where: { userId } });
}

// ─── Get current user profile ─────────────────────────────────────────────────

export async function getMe(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      role: true,
      status: true,
      organizationId: true,
      lastLoginAt: true,
      createdAt: true,
    },
  });
  if (!user) throw new NotFoundError('User');
  return user;
}
