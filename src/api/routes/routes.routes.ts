import { Router } from 'express';
import * as routesController from './routes.controller';

const router = Router();

/** POST /api/routes/calculate: itineraries from A to B. */
router.post('/calculate', routesController.calculate);

export default router;
