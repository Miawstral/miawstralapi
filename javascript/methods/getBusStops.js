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
        // Affiche un extrait du HTML pour le debug
        console.log('\n[DEBUG] Extrait du HTML récupéré :\n' + html.slice(0, 500));
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
            // Debug log for verification
            console.log(`[DEBUG] Stop: ${stop.name}, Times found: ${stop.times.length}`);
            if (stop.name) stops.push(stop);
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
        // On filtre les arrêts qui ont au moins un horaire
        const stopsWithTimes = stops.filter(stop => stop.times.length > 0);
        // Si on exécute en CLI, on écrit ce JSON dans le nouveau dossier
        if (require.main === module) {
            const fs = require('fs');
            const path = require('path');
            const outDir = path.join(__dirname, '../data_horaires');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
            const outFile = path.join(outDir, `${bus_id}_horaires.json`);
            const horairesJson = {
                bus_id,
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

// CLI wrapper for direct execution and debug
if (require.main === module) {
    const busId = process.argv[2] || '87';
    getBusStops(busId).then(result => {
        // Print result summary
        if (result && result.stops) {
            console.log(`\n[RESULT] Bus ${busId}: ${result.stops.length} stops`);
            result.stops.forEach(stop => {
                console.log(`[STOP] ${stop.name} (${stop.city}) - ${stop.times.length} times`);
            });
        } else {
            console.log(result);
        }
    }).catch(err => {
        console.error('[ERROR]', err);
    });
}

module.exports = { getBusStops };