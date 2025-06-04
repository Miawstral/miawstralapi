const axios = require('axios');
const cheerio = require('cheerio');
require('colors');

/**
 * Get bus stops and schedule for a bus line using FlareSolverr (Cloudflare bypass)
 * @param {string} bus_id
 * @returns {Promise<Array|Object>} List of stops or detailed error object
 */
async function getBusStops(bus_id) {
    if(bus_id < 9) bus_id = `0${bus_id}` 
    const url = `https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/${bus_id}/direction/OUTWARD/MISTRAL:00${bus_id}?islid=MISTRAL%3A00${bus_id}&ismode=Bus&islsn=${bus_id}&issubnet=Reseau%20Mistral&isdir=OUTWARD&w=true&date=`;
    const apiUrl = 'http://localhost:8191/v1';
    const data = {
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000
    };
    try {
        process.stdout.write(`[Miawstral] [${bus_id}] FlareSolverr request... `.cyan);
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
        const stops = [];
        // Find each stop and its city (city is usually in the next sibling or a specific class)
        $('.is-Timesheet-StopPoint-Link').each((i, elem) => {
            const stopName = $(elem).attr('data-stoppoint-name') || $(elem).text().trim();
            const lat = $(elem).attr('data-lat');
            const lon = $(elem).attr('data-lon');
            const stopPointId = $(elem).attr('data-stoppoint-id');
            const accessible = $(elem).attr('data-accessible') === 'true';
            // Try to get city: look for next sibling with city info or parent context
            let city = null;
            const cityElem = $(elem).parent().find('.is-Timesheet-StopPoint-Locality').first();
            if (cityElem.length) city = cityElem.text().trim();
            // Fallback: sometimes city is in the next element
            if (!city) {
                const next = $(elem).next();
                if (next && next.hasClass('is-Timesheet-StopPoint-Locality')) city = next.text().trim();
            }
            // Extract times for this stop (column in timetable)
            let times = [];
            const colIndex = i + 1;
            $(`.is-Timesheet-Table tbody tr`).each((_, row) => {
                const cell = $(row).find(`td:nth-child(${colIndex})`);
                let time = cell.text().trim();
                if (time) times.push(time);
            });
            stops.push({
                name: stopName || null,
                city: city || null,
                latitude: lat || null,
                longitude: lon || null,
                stopPointId: stopPointId || null,
                accessible,
                times
            });
        });
        if (stops.length === 0) {
            const errorMsg = $('.is-Result-Error-Description').text().trim() || 'No stop found';
            console.warn(`[WARN] No stop found. Message: ${errorMsg}`.yellow);
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
        return {
            bus_id,
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
        const errorFile = path.join(errorsDir, `${bus_id}.log`);
        fs.writeFileSync(errorFile, error && error.stack ? error.stack : String(error), 'utf-8');
        console.error(`[ERROR] Scraping failed`.red, error);
        return { error: error.message || 'Scraping failed' };
    }
}

module.exports = { getBusStops };