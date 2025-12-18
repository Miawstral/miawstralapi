import { Router, Request, Response, NextFunction } from "express";
import path from 'path';
import express from 'express';

const router = Router();

// Serve static files (CSS, JS)
router.use(express.static(__dirname));

router.get('/', (req: Request, res: Response) => {
    res.sendFile(path.join(__dirname, 'index.html'));
})

export default router;