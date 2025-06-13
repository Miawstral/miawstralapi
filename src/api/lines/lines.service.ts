import fs from 'fs';
import path from 'path';
import { BusLine } from '../../interfaces/BusData';
import { getAll } from './lines.controller';


const dataDir = path.join(__dirname, '../../data');

/**
 * Reads all available bus line files and returns a summary.
 */
export const getAllLines = async (): Promise<Partial<BusLine>[]> => {
  const files = fs.readdirSync(dataDir).filter(file => file.endsWith('_horaires.json'));
  const lines: Partial<BusLine>[] = [];

  for (const file of files) {
    const filePath = path.join(dataDir, file);
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const data: BusLine = JSON.parse(fileContent);
    lines.push({
      bus_id: data.bus_id,
      lineName: data.lineName,
    });
  }
  return lines;
};

/**
 * Reads a specific bus line file by its ID.
 */
export const getLineById = async (id: string): Promise<BusLine> => {
  const filePath = path.join(dataDir, `${id}_horaires.json`);

  if (!fs.existsSync(filePath)) {
    throw new Error('Line not found');
  }

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  return JSON.parse(fileContent);
};

/**
 * Searches for lines by name. 
 * @param {string} query  - The Search query 
 * @returns {Promise<Partial<BusLine>[]>} A list of matching line summaries. 
 */

export const searchLinesByName = async (query: string): Promise<Partial<BusLine>[]> => {
  const allLines = await getAllLines(); 
  const lowerCaseQuery = query.toLowerCase(); 

  return allLines.filter(line => 
    line.lineName?.toLowerCase().includes(lowerCaseQuery)
  )
}