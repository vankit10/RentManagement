import jwt from 'jsonwebtoken';
import { UserRole } from '@prisma/client';

// ─── Token payload ────────────────────────────────────────────────────────────

export interface AccessTokenPayload {
  sub: string;        // user ID
  role: UserRole;
  orgId: string;      // organization ID
  email?: string;
  phone?: string;
}

export interface RefreshTokenPayload {
  sub: string;        // user ID
  jti: string;        // refresh token DB id (for rotation)
}

// ─── Config ───────────────────────────────────────────────────────────────────

const ACCESS_SECRET = process.env.JWT_SECRET!;
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET!;
const ACCESS_EXPIRES = process.env.JWT_ACCESS_EXPIRES_IN ?? '15m';
const REFRESH_EXPIRES = process.env.JWT_REFRESH_EXPIRES_IN ?? '30d';

// ─── Generate tokens ──────────────────────────────────────────────────────────

export function generateAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, ACCESS_SECRET, {
    expiresIn: ACCESS_EXPIRES,
    issuer: 'rent-management-api',
  } as jwt.SignOptions);
}

export function generateRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, REFRESH_SECRET, {
    expiresIn: REFRESH_EXPIRES,
    issuer: 'rent-management-api',
  } as jwt.SignOptions);
}

// ─── Verify tokens ────────────────────────────────────────────────────────────

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, ACCESS_SECRET, {
    issuer: 'rent-management-api',
  }) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, REFRESH_SECRET, {
    issuer: 'rent-management-api',
  }) as RefreshTokenPayload;
}

// ─── Expiry helper ────────────────────────────────────────────────────────────

export function getRefreshTokenExpiry(): Date {
  const days = parseInt(
    (REFRESH_EXPIRES.match(/(\d+)d/)?.[1]) ?? '30',
    10,
  );
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date;
}
