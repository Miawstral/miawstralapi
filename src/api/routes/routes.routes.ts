import { Router } from "express";
import * as routesController from './routes.controller';

const router = Router();
/**
 * @route POST /api/routes/calculate
 * @description Calculate routes from A to B
 * @access Public
 */
router.post('/calculate', routesController.calculate);

export default router;