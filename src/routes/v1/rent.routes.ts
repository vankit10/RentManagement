import { Router, Request, Response, NextFunction } from 'express';
import * as rentController from '../../controllers/rent.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { GenerateRentSchema, UpdateRentStatusSchema, RentQuerySchema } from '../../validators/rent.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

// Tenant: view own rent records
router.get('/my', authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    rentController.getMyRentRecords(req as AuthenticatedRequest, res, next));

// Owner only
router.get('/', authorize('OWNER'), validate(RentQuerySchema, 'query'), rentController.listRentRecords);
router.post('/generate', authorize('OWNER'), validate(GenerateRentSchema), rentController.generateRent);
router.post('/mark-overdue', authorize('OWNER'), rentController.markOverdue);
router.get('/:id', authorize('OWNER'), rentController.getRentRecord);
router.patch('/:id/status', authorize('OWNER'), validate(UpdateRentStatusSchema), rentController.updateRentStatus);

export default router;
