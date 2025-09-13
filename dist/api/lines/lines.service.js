"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchLinesByName = exports.getLineById = exports.getAllLines = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const dataDir = path_1.default.join(__dirname, '../../data');
/**
 * Reads all available bus line files and returns a summary.
 */
const getAllLines = async () => {
    const files = fs_1.default.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
    const lines = [];
    for (const file of files) {
        const filePath = path_1.default.join(dataDir, file);
        const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
        const data = JSON.parse(fileContent);
        lines.push({
            bus_id: data.bus_id,
            lineName: data.lineName,
        });
    }
    return lines;
};
exports.getAllLines = getAllLines;
/**
 * Reads a specific bus line file by its ID.
 */
const getLineById = async (id) => {
    const filePath = path_1.default.join(dataDir, `${id}_horaires.json`);
    if (!fs_1.default.existsSync(filePath)) {
        throw new Error('Line not found');
    }
    const fileContent = fs_1.default.readFileSync(filePath, 'utf-8');
    return JSON.parse(fileContent);
};
exports.getLineById = getLineById;
/**
 * Searches for lines by name.
 * @param {string} query  - The Search query
 * @returns {Promise<Partial<BusLine>[]>} A list of matching line summaries.
 */
const searchLinesByName = async (query) => {
    const allLines = await (0, exports.getAllLines)();
    const lowerCaseQuery = query.toLowerCase();
    return allLines.filter(line => line.lineName?.toLowerCase().includes(lowerCaseQuery));
};
exports.searchLinesByName = searchLinesByName;
