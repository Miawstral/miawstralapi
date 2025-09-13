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
exports.search = exports.getById = exports.getAll = void 0;
const linesService = __importStar(require("./lines.service"));
const getAll = async (req, res, next) => {
    try {
        const lines = await linesService.getAllLines();
        res.status(200).json(lines);
    }
    catch (error) {
        next(error);
    }
};
exports.getAll = getAll;
const getById = async (req, res, next) => {
    try {
        const { id } = req.params;
        const line = await linesService.getLineById(id);
        res.status(200).json(line);
    }
    catch (error) {
        if (error instanceof Error && error.message === 'Line not found') {
            return res.status(404).json({ message: error.message });
        }
        next(error);
    }
};
exports.getById = getById;
const search = async (req, res, next) => {
    try {
        const query = req.query.q;
        console.log(query);
        if (!query || typeof query !== 'string') {
            return res.status(400).json({
                success: false,
                message: "Query parameter 'q' is required."
            });
        }
        const lines = await linesService.searchLinesByName(query);
        res.status(200).json(lines);
    }
    catch (err) {
        next(err);
    }
};
exports.search = search;
