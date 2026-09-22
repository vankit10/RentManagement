import { Router, Request, Response, NextFunction } from 'express';
import * as paymentController from '../../controllers/payment.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { CreatePaymentSchema, PaymentQuerySchema } from '../../validators/payment.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

// Tenant: view own payments
router.get('/my', authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    paymentController.getMyPayments(req as AuthenticatedRequest, res, next));

// Owner only
router.get('/', authorize('OWNER'), validate(PaymentQuerySchema, 'query'), paymentController.listPayments);
router.post('/', authorize('OWNER'), validate(CreatePaymentSchema), paymentController.recordPayment);
router.get('/:id', authorize('OWNER'), paymentController.getPayment);

export default router;
