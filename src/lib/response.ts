import { Response } from 'express';

// ─── Standard success response ────────────────────────────────────────────────

export function sendSuccess<T>(
  res: Response,
  data: T,
  statusCode = 200,
): void {
  res.status(statusCode).json({
    success: true,
    data,
  });
}

// ─── Paginated response ───────────────────────────────────────────────────────

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export function sendPaginated<T>(
  res: Response,
  data: T[],
  pagination: PaginationMeta,
): void {
  res.status(200).json({
    success: true,
    data,
    pagination,
  });
}

// ─── Error response ───────────────────────────────────────────────────────────

export function sendError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown,
): void {
  const body: Record<string, unknown> = {
    success: false,
    error: { code, message },
  };
  if (details !== undefined) {
    (body.error as Record<string, unknown>).details = details;
  }
  res.status(statusCode).json(body);
}

// ─── Pagination helper ────────────────────────────────────────────────────────

export function parsePagination(query: Record<string, unknown>): {
  page: number;
  limit: number;
  skip: number;
} {
  const page = Math.max(1, parseInt(String(query.page ?? '1'), 10));
  const limit = Math.min(100, Math.max(1, parseInt(String(query.limit ?? '20'), 10)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
