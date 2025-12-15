import { Request, Response, NextFunction, Router } from "express";
import * as routesService from './routes.service';
import { RouteRequest } from "../../interfaces/Route";

export const calculate = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const request: RouteRequest = req.body;

        if (!request.from || !request.to) {
            return res.status(400).json({
                success: false,
                message: "Both 'from' and 'to' are required."
            });
        }
        if (!request.from.lat && !request.from.stopId) {
            return res.status(400).json({
                success: false,
                message: "'from' must have either lat/lon or stopId"
            });
        }

        if (!request.to.lat && !request.to.stopId){
            return res.status(400).json({
                success: false,
                message: "'to' must have either lat/lon or stopId"
            });
        }
        
        const result = await routesService.calculateRoutes(request);
        
        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        next(error);
    }
}