"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.findNearby = exports.search = exports.getAll = exports.getById = void 0;
const stopsService = __importStar(require("./stops.service"));
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const stop = await stopsService.getStopById(id);
        res.status(200).json(stop);
    }
    catch (error) {
        if (error instanceof Error && error.message === "Stop not found") {
            return res.status(404).json({ message: error.message });
        }
        next(error);
    }
};
exports.getById = getById;
const getAll = async (req, res, next) => {
    try {
        const stops = await stopsService.getAllStops();
        res.status(200).json(stops);
    }
    catch (error) {
        next(error);
    }
};
exports.getAll = getAll;
const search = async (req, res, next) => {
    try {
        const query = req.query.q;
        if (!query || typeof query !== 'string') {
            return res.status(400).json({ success: false, message: "Query parameter 'q' is required." });
        }
        const stops = await stopsService.searchStopsByName(query);
        res.status(200).json(stops);
    }
    catch (error) {
        next(error);
    }
};
exports.search = search;
const findNearby = async (req, res, next) => {
    try {
        const { lat, lon, radius } = req.query;
        if (!lat || !lon || !radius) {
            return res.status(400).json({ success: false, message: "Query parameters 'lat', 'lon', and 'radius' are required." });
        }
        const parsedLat = parseFloat(lat);
        const parsedLon = parseFloat(lon);
        const parsedRadius = parseInt(radius, 10);
        if (isNaN(parsedLat) || isNaN(parsedLon) || isNaN(parsedRadius)) {
            return res.status(400).json({ success: false, message: "Invalid parameter format." });
        }
        const stops = await stopsService.findStopsNearby(parsedLat, parsedLon, parsedRadius);
        res.status(200).json(stops);
    }
    catch (error) {
        next(error);
    }
};
exports.findNearby = findNearby;
