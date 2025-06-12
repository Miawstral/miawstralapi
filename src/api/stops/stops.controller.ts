import { Request, Response, NextFunction } from "express";
import * as stopsService from "./stops.service";

export const getById = async (req: Request, res: Response, next: NextFunction) => { 
    try { 
        const { id } = req.params; 
        const stop = await stopsService.getStopById(id); 
        res.status(200).json(stop)
    } catch (error) { 
        if (error instanceof Error && error.message === "Stop not found"){
            return res.status(404).json({message: error.message})
        }
        next(error)
    }
};


export const getAll = async (req: Request, res: Response, next: NextFunction) => { 
    try { 
        const stops = await stopsService.getAllStops(); 
        res.status(200).json(stops); 
    } catch (error) { 
        next(error)
    }
}