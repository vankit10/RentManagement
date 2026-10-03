import prisma from '../lib/prisma';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';
import { AccessRequestStatus } from '@prisma/client';

export async function createAccessRequest(tenantId: string, orgId: string, ownerEmail: string) {
  const owner = await prisma.user.findFirst({
    where: { email: ownerEmail, role: 'OWNER', organizationId: orgId, status: 'ACTIVE' },
  });
  if (!owner) throw new NotFoundError('Owner with that email address');

  const existing = await prisma.accessRequest.findUnique({ where: { tenantId_ownerId: { tenantId, ownerId: owner.id } } });
  if (existing?.status === 'PENDING') throw new ConflictError('You already have a pending request with this owner');
  if (existing?.status === 'ACCEPTED') throw new ConflictError('This owner has already accepted your request');

  return prisma.accessRequest.upsert({
    where: { tenantId_ownerId: { tenantId, ownerId: owner.id } },
    create: { tenantId, ownerId: owner.id },
    update: { status: 'PENDING' },
  });
}

export async function listAccessRequests(ownerId: string) {
  return prisma.accessRequest.findMany({
    where: { ownerId, status: 'PENDING' },
    orderBy: { createdAt: 'desc' },
    include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
  });
}

export async function updateAccessRequest(requestId: string, ownerId: string, status: AccessRequestStatus) {
  const request = await prisma.accessRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new NotFoundError('Access request');
  if (request.ownerId !== ownerId) throw new ForbiddenError('You cannot update this access request');
  if (request.status !== 'PENDING') throw new ConflictError('This request has already been processed');

  const updated = await prisma.accessRequest.update({
    where: { id: requestId },
    data: { status },
    include: { tenant: { select: { id: true, name: true, email: true, phone: true } } },
  });

  if (status === 'ACCEPTED') {
    await prisma.tenant.updateMany({
      where: { userId: request.tenantId },
      data: { ownerId },
    });
  }

  return updated;
}
