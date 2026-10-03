import { Response, NextFunction } from 'express';
import * as accessRequestService from '../services/accessRequest.service';
import { sendSuccess } from '../lib/response';
import { AuthenticatedRequest } from '../types';

export async function createAccessRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { ownerEmail } = req.body as { ownerEmail: string };
    sendSuccess(res, await accessRequestService.createAccessRequest(req.user.id, req.user.orgId, ownerEmail), 201);
  } catch (err) { next(err); }
}

export async function listAccessRequests(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try { sendSuccess(res, await accessRequestService.listAccessRequests(req.user.id)); } catch (err) { next(err); }
}

export async function updateAccessRequest(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const { status } = req.body as { status: 'ACCEPTED' | 'REJECTED' };
    sendSuccess(res, await accessRequestService.updateAccessRequest(req.params.id, req.user.id, status));
  } catch (err) { next(err); }
}
