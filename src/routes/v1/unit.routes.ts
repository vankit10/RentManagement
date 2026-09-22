import { Router } from 'express';
import * as propertyController from '../../controllers/property.controller';
import { authenticate } from '../../middleware/auth.middleware';
import { authorize } from '../../middleware/authorize.middleware';

const router = Router();
router.use(authenticate, authorize('OWNER'));

router.get('/', propertyController.listUnits);
router.post('/', propertyController.createUnit);
router.get('/:id', propertyController.getUnit);
router.put('/:id', propertyController.updateUnit);

export default router;
