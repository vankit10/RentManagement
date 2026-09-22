import { Router, Request, Response, NextFunction } from 'express';
import * as electricityController from '../../controllers/electricity.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { CreateMeterReadingSchema, UpdateElectricityRateSchema, ElectricityQuerySchema } from '../../validators/electricity.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

// Tenant: view own electricity readings
router.get('/my', authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    electricityController.getMyReadings(req as AuthenticatedRequest, res, next));

// Owner only
router.get('/', authorize('OWNER'), validate(ElectricityQuerySchema, 'query'), electricityController.listReadings);
router.post('/', authorize('OWNER'), validate(CreateMeterReadingSchema), electricityController.addReading);
router.get('/rate', authorize('OWNER'), electricityController.getRate);
router.put('/rate', authorize('OWNER'), validate(UpdateElectricityRateSchema), electricityController.updateRate);
router.get('/:id', authorize('OWNER'), electricityController.getReading);
router.delete('/:id', authorize('OWNER'), electricityController.deleteReading);

export default router;
