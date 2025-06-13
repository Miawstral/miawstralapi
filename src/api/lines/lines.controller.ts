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

export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q; 
    console.log(query)
  
    if (!query || typeof query !== 'string') {
      return res.status(400).json({
        success : false, 
        message: "Query parameter 'q' is required."
      });
    }

    const lines = await linesService.searchLinesByName(query); 
    res.status(200).json(lines)

  }
  catch (err){
    next(err)
  }
}