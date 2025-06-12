const { getBusStops } = require('../methods/getBusStops');
const fs = require('fs');
const path = require('path');
require('colors');

/**
 * Fetches data for a bus line and saves the schedule to a JSON file
 * if the line is valid and contains stops with times.
 * @param {string} bus_id - The ID of the bus line.
 */
async function fetchAndSaveLineData(bus_id) {
    try {
        console.log(`[INFO] [${bus_id}] Attempting to fetch data...`.cyan);
        const result = await getBusStops(bus_id);

        // Do not save the file if the line is invalid (returns an error or no stops).
        if (result.error || !result.stops || result.stops.length === 0) {
            console.log(`[SKIP] [${bus_id}] Line not found or has no stops. File not created.`.yellow);
            return;
        }

        // Filter out stops that have no scheduled times.
        const stopsWithTimes = result.stops.filter(stop => stop.times && stop.times.length > 0);

        // If, after filtering, there are no stops left, do not create a file.
        if (stopsWithTimes.length === 0) {
            console.log(`[SKIP] [${bus_id}] Line found but without any schedule. File not created.`.yellow);
            return;
        }

        const horairesDir = path.join(__dirname, 'data_horaires');
        fs.mkdirSync(horairesDir, { recursive: true });
        const horairesFile = path.join(horairesDir, `${bus_id}_horaires.json`);

        const horairesJson = {
            bus_id: result.bus_id,
            lineName: result.lineName,
            direction: result.direction,
            lineId: result.lineId,
            stops: stopsWithTimes,
            notes: result.notes
        };

        fs.writeFileSync(horairesFile, JSON.stringify(horairesJson, null, 2), 'utf-8');
        console.log(`[OK] [${bus_id}] Data for line "${result.lineName}" saved.`.green);

    } catch (e) {
        console.error(`[FATAL] [${bus_id}] Critical error: ${e.message}`.red);
    }
}

/**
 * Loops through all potential bus line IDs from 1 to 300.
 */
async function fetchAllBusLines() {
    console.log('[START] Starting to fetch all bus lines (1 to 300)...'.bold);
    for (let i = 1; i <= 300; i++) {
        const bus_id = i.toString();
        await fetchAndSaveLineData(bus_id);
    }
    console.log('[DONE] All lines have been processed.'.bold);
}

// Allows the script to be run directly from the command line.
if (require.main === module) {
    fetchAllBusLines();
}