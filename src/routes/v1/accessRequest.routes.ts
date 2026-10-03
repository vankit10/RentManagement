import { Router, Request, Response, NextFunction } from 'express';
import * as accessRequestController from '../../controllers/accessRequest.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { AuthenticatedRequest } from '../../types';
import { CreateAccessRequestSchema, UpdateAccessRequestSchema } from '../../validators/accessRequest.validator';

const router = Router();
router.use(authenticate);

router.post('/', authorize('TENANT'), validate(CreateAccessRequestSchema), (req: Request, res: Response, next: NextFunction) => accessRequestController.createAccessRequest(req as AuthenticatedRequest, res, next));
router.get('/', authorize('OWNER'), (req: Request, res: Response, next: NextFunction) => accessRequestController.listAccessRequests(req as AuthenticatedRequest, res, next));
router.patch('/:id/status', authorize('OWNER'), validate(UpdateAccessRequestSchema), (req: Request, res: Response, next: NextFunction) => accessRequestController.updateAccessRequest(req as AuthenticatedRequest, res, next));

export default router;
