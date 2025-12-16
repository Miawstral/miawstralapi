import { Router, Request, Response, NextFunction } from "express";
import path from 'path';

const router = Router();

router.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'map.html'));
})
export default router;