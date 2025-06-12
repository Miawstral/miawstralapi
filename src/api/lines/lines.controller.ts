import { Request, Response, NextFunction } from 'express';
import * as linesService from './lines.service';

export const getAll = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const lines = await linesService.getAllLines();
    res.status(200).json(lines);
  } catch (error) {
    next(error);
  }
};

export const getById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const line = await linesService.getLineById(id);
    res.status(200).json(line);
  } catch (error) {
    if (error instanceof Error && error.message === 'Line not found') {
      return res.status(404).json({ message: error.message });
    }
    next(error);
  }
};