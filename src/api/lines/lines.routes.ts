import { Router } from 'express';
import * as linesController from './lines.controller';

const router = Router();


router.get('/', linesController.getAll);
router.get('/search', linesController.search)
router.get('/:id', linesController.getById);

export default router;