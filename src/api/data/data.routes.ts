import { Router } from 'express';
import { requireAdmin } from '../auth';
import * as dataController from './data.controller';

const router = Router();

router.get('/status', dataController.status);
router.post('/refresh', requireAdmin, dataController.refresh);

export default router;
