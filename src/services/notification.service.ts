import prisma from '../lib/prisma';
import { NotFoundError } from '../lib/errors';
import { parsePagination } from '../lib/response';
import { Prisma, NotificationType } from '@prisma/client';
import { CreateNotificationInput } from '../validators/notification.validator';

const ORG_ID = process.env.DEFAULT_ORG_ID!;

// ─── List notifications ───────────────────────────────────────────────────────

export async function listNotifications(query: Record<string, unknown>) {
  const { page, limit, skip } = parsePagination(query);
  const tenantId = query.tenantId as string | undefined;
  const isRead =
    query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined;
  const type = query.type as NotificationType | undefined;

  const where: Prisma.NotificationWhereInput = {
    organizationId: ORG_ID,
    ...(tenantId && { tenantId }),
    ...(isRead !== undefined && { isRead }),
    ...(type && { type }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        tenant: { select: { id: true, name: true, phone: true } },
      },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Get notifications for a tenant (self-service) ────────────────────────────

export async function getNotificationsForTenant(
  tenantId: string,
  query: Record<string, unknown> = {},
) {
  const { page, limit, skip } = parsePagination(query);
  const isRead =
    query.isRead === 'true' ? true : query.isRead === 'false' ? false : undefined;

  const where: Prisma.NotificationWhereInput = {
    organizationId: ORG_ID,
    tenantId,
    ...(isRead !== undefined && { isRead }),
  };

  const [notifications, total] = await Promise.all([
    prisma.notification.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.notification.count({ where }),
  ]);

  return {
    notifications,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}

// ─── Create notification ──────────────────────────────────────────────────────

export async function createNotification(data: CreateNotificationInput) {
  // Validate tenant if provided
  if (data.tenantId) {
    const tenant = await prisma.tenant.findFirst({
      where: { id: data.tenantId, organizationId: ORG_ID },
    });
    if (!tenant) throw new NotFoundError('Tenant');
  }

  return prisma.notification.create({
    data: {
      organizationId: ORG_ID,
      tenantId: data.tenantId,
      title: data.title,
      message: data.message,
      type: data.type,
    },
    include: {
      tenant: { select: { id: true, name: true } },
    },
  });
}

// ─── Broadcast to all active tenants ─────────────────────────────────────────

export async function broadcastNotification(
  title: string,
  message: string,
  type: NotificationType = 'GENERAL',
) {
  const tenants = await prisma.tenant.findMany({
    where: { organizationId: ORG_ID, status: 'ACTIVE' },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: tenants.map((t) => ({
      organizationId: ORG_ID,
      tenantId: t.id,
      title,
      message,
      type,
    })),
  });

  return { sent: tenants.length };
}

// ─── Mark notification read ───────────────────────────────────────────────────

export async function markAsRead(id: string, userId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id, organizationId: ORG_ID },
    include: { tenant: { select: { userId: true } } },
  });

  if (!notification) throw new NotFoundError('Notification');

  // Tenants can only mark their own notifications
  if (
    notification.tenant &&
    notification.tenant.userId !== userId
  ) {
    throw new NotFoundError('Notification');
  }

  return prisma.notification.update({
    where: { id },
    data: { isRead: true },
  });
}

// ─── Mark all as read for a tenant ───────────────────────────────────────────

export async function markAllAsRead(tenantId: string) {
  const result = await prisma.notification.updateMany({
    where: { tenantId, organizationId: ORG_ID, isRead: false },
    data: { isRead: true },
  });
  return { updated: result.count };
}
