import { Router } from 'express';
import * as propertyController from '../../controllers/property.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';

const router = Router();
router.use(authenticate, authorize('OWNER'));

router.get('/', propertyController.listProperties);
router.post('/', propertyController.createProperty);
router.get('/:id', propertyController.getProperty);
router.put('/:id', propertyController.updateProperty);

export default router;
