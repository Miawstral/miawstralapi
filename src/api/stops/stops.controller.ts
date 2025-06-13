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
export const search = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const query = req.query.q;
    if (!query || typeof query !== 'string') {
      return res.status(400).json({ success: false, message: "Query parameter 'q' is required." });
    }
    const stops = await stopsService.searchStopsByName(query);
    res.status(200).json(stops);
  } catch (error) {
    next(error);
  }
};

export const findNearby = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lat, lon, radius } = req.query;
    if (!lat || !lon || !radius) {
      return res.status(400).json({ success: false, message: "Query parameters 'lat', 'lon', and 'radius' are required." });
    }

    const parsedLat = parseFloat(lat as string);
    const parsedLon = parseFloat(lon as string);
    const parsedRadius = parseInt(radius as string, 10);

    if (isNaN(parsedLat) || isNaN(parsedLon) || isNaN(parsedRadius)) {
        return res.status(400).json({ success: false, message: "Invalid parameter format." });
    }

    const stops = await stopsService.findStopsNearby(parsedLat, parsedLon, parsedRadius);
    res.status(200).json(stops);
  } catch (error) {
    next(error);
  }
};
