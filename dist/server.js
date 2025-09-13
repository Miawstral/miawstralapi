"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const lines_routes_1 = __importDefault(require("./api/lines/lines.routes"));
const stops_routes_1 = __importDefault(require("./api/stops/stops.routes"));
const app = (0, express_1.default)();
const PORT = process.env.PORT || 3000;
app.use((0, cors_1.default)());
app.use(express_1.default.json());
app.use('/api/lines', lines_routes_1.default);
app.use('/api/stops', stops_routes_1.default);
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path} - ${err.message}`);
    const errorMessage = process.env.NODE_ENV === 'production' ? 'An internal server error occured' : err.message;
    res.status(500).json({
        success: false,
        message: errorMessage,
    });
});
app.listen(PORT, () => {
    console.log(`[📦] Miawstral is running on http://localhost:${PORT}`);
});
