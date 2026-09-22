import { Router, Request, Response, NextFunction } from 'express';
import * as deviceController from '../../controllers/device.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

router.post('/token',
  (req: Request, res: Response, next: NextFunction) =>
    deviceController.registerToken(req as AuthenticatedRequest, res, next));

router.delete('/token',
  (req: Request, res: Response, next: NextFunction) =>
    deviceController.removeToken(req as AuthenticatedRequest, res, next));

export default router;
