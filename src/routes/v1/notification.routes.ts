import { Router, Request, Response, NextFunction } from 'express';
import * as notificationController from '../../controllers/notification.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';
import { validate } from '../../middleware/validate.middleware';
import { CreateNotificationSchema, NotificationQuerySchema } from '../../validators/notification.validator';
import { AuthenticatedRequest } from '../../types';

const router = Router();
router.use(authenticate);

// Tenant: view and manage own notifications
router.get('/my', authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    notificationController.getMyNotifications(req as AuthenticatedRequest, res, next));

router.patch('/my/read-all', authorize('TENANT'),
  (req: Request, res: Response, next: NextFunction) =>
    notificationController.markAllRead(req as AuthenticatedRequest, res, next));

router.patch('/:id/read', authenticate,
  (req: Request, res: Response, next: NextFunction) =>
    notificationController.markRead(req as AuthenticatedRequest, res, next));

// Owner only
router.get('/', authorize('OWNER'), validate(NotificationQuerySchema, 'query'), notificationController.listNotifications);
router.post('/', authorize('OWNER'), validate(CreateNotificationSchema), notificationController.createNotification);
router.post('/broadcast', authorize('OWNER'), notificationController.broadcastNotification);

export default router;
