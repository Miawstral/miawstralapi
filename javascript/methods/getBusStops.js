const axios = require('axios');
const cheerio = require('cheerio');
require('colors');

/**
 * Get bus stops and schedule for a bus line using FlareSolverr (Cloudflare bypass)
 * @param {string} bus_id
 * @returns {Promise<Array|Object>} List of stops or detailed error object
 */
async function getBusStops(bus_id) {
    // Format bus_id: add leading zero only for numbers 1-9, not for 10+ or letters
    const originalBusId = bus_id;
    const numericId = parseInt(bus_id);
    
    let formattedId = bus_id;
    if (!isNaN(numericId) && numericId < 10 && numericId > 0) {
        formattedId = `000${bus_id}`;
    }
    if(numericId > 10 && numericId < 100) { 
        formattedId = `00${bus_id}`
    } 
    if (numericId > 100) {
        formattedId = `0${bus_id}`
    }
    console.log(formattedId)
    // For URLs: use formatted ID for MISTRAL codes, original for ligne path
    let url = `https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/${originalBusId}/direction/OUTWARD/MISTRAL:${formattedId}?islid=MISTRAL%3A${formattedId}&ismode=Bus&islsn=${originalBusId}&issubnet=Reseau%20Mistral&isdir=OUTWARD&w=true&date=`;
    if(bus_id.toString().toUpperCase() === "U") url = `https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/U/direction/OUTWARD/MISTRAL:U`
    const apiUrl = 'http://127.0.0.0:8191/v1';
    const data = {
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000
    };
    try {
        const response = await axios.post(apiUrl, data, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (!response.data || !response.data.solution || !response.data.solution.response) {
            console.error(`[ERROR] Unexpected FlareSolverr response`.red);
            return { error: 'Unexpected FlareSolverr response' };
        }
        const html = response.data.solution.response;
        if (html.includes('cf-error-details') || html.includes('Attention Required! | Cloudflare') || html.includes('You have been blocked')) {
            console.error(`[ERROR] Cloudflare page detected, access denied.`.red);
            return { error: 'Cloudflare page detected, access denied.' };
        }
        process.stdout.write('Parsing...\n'.blue);
        const $ = cheerio.load(html);
        // New logic: Each row is a stop, each cell in the row is a time for that stop
        const stops = [];
        $(`.is-LineDirection-Timesheet tbody tr`).each((rowIdx, row) => {
            const stopHeader = $(row).find('th.is-Timesheet-StopPoint .is-Timesheet-StopPoint-Link');
            if (stopHeader.length === 0) return; // skip rows without stop info
            const stop = {
                name: stopHeader.attr('data-stoppoint-name') || stopHeader.text().trim(),
                city: stopHeader.find('.is-Timesheet-StopPoint-City').first().text().trim() || null,
                latitude: stopHeader.attr('data-lat') || null,
                longitude: stopHeader.attr('data-lon') || null,
                stopPointId: stopHeader.attr('data-stoppoint-id') || null,
                accessible: stopHeader.find('.is-Icon-sim-accessible').length > 0,
                times: []
            };
            // Find the cell with times (should be the next td after th)
            const timeCell = $(row).find('td.is-Timesheet-Passages');
            if (timeCell.length > 0) {
                timeCell.find('li.is-Timesheet-Passage-Item').each((_, li) => {
                    const time = $(li).find('.is-Timesheet-Passage-Item-C1').text().replace(/\s+/g, ' ').trim();
                    if (time && time !== '-') stop.times.push(time);
                });
                // If no li, try direct text (for some tables)
                if (stop.times.length === 0) {
                    const time = timeCell.text().replace(/\s+/g, ' ').trim();
                    if (time && time !== '-') stop.times.push(time);
                }
            }
            if (stop.name) stops.push(stop);
        });
        if (stops.length === 0) {
            const errorMsg = $('.is-Result-Error-Description').text().trim() || 'No stop found';
            console.warn(`[WARN] No stop found.`.yellow);
            return { error: errorMsg };
        } else {
            process.stdout.write(`[OK] ${stops.length} stops found\n`.green);
        }
        const lineName = $('#is-SchedulesInput').val() || null;
        const direction = $('#is-SchedulesInput').attr('data-direction-id') || null;
        const lineId = $('#is-SchedulesInput').attr('data-line-id') || null;
        const notes = [];
        $('.is-Timesheet-Note').each((i, elem) => {
            notes.push($(elem).text().trim());
        });
        
        const stopsWithTimes = stops.filter(stop => stop.times.length > 0);
        if (require.main === module) {
            const fs = require('fs');
            const path = require('path');
            const outDir = path.join(__dirname, '../data_horaires');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
            const outFile = path.join(outDir, `${originalBusId}_horaires.json`);
            const horairesJson = {
                bus_id: originalBusId,
                lineName,
                direction,
                lineId,
                stops: stopsWithTimes,
                notes
            };
            fs.writeFileSync(outFile, JSON.stringify(horairesJson, null, 2), 'utf-8');
            console.log(`\n[INFO] Fichier créé : ${outFile}`);
        }
        return {
            bus_id: originalBusId,
            lineName,
            direction,
            lineId,
            stops,
            notes
        };
    } catch (error) {
        const fs = require('fs');
        const path = require('path');
        const errorsDir = path.join(__dirname, '../Errors');
        if (!fs.existsSync(errorsDir)) {
            fs.mkdirSync(errorsDir);
        }
        const errorFile = path.join(errorsDir, `${originalBusId}.log`);
        fs.writeFileSync(errorFile, error && error.stack ? error.stack : String(error), 'utf-8');
        console.error(`[ERROR] Scraping failed`.red, error);
        return { error: error.message || 'Scraping failed' };
    }
}


if (require.main === module) {
    const busId = process.argv[2];
    if (!busId) {
        console.error('Usage: node getBusStops.js <busId>');
        process.exit(1);
    }
    
    getBusStops(busId).then(result => {
        // Output JSON to stdout for TypeScript consumption
        console.log(JSON.stringify(result));
    }).catch(err => {
        console.error(JSON.stringify({ error: err.message || 'Unknown error' }));
        process.exit(1);
    });
}

module.exports = { getBusStops };