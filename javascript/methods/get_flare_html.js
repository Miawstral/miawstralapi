const axios = require('axios');
require('colors');

/**
 * Get HTML of a page via FlareSolverr (Cloudflare bypass) on localhost:8191
 * @param {string} url
 * @returns {Promise<string>} HTML of the page
 */
async function getPageViaFlareSolverr(url) {
    const apiUrl = 'https://flare.1sheol.xyz/v1';
    const data = {
        cmd: 'request.get',
        url: url,
        maxTimeout: 60000
    };
    try {
        console.log(`[INFO] FlareSolverr request: ${url}`.cyan);
        const response = await axios.post(apiUrl, data, {
            headers: { 'Content-Type': 'application/json' }
        });
        if (response.data && response.data.solution && response.data.solution.response) {
            console.log('[SUCCESS] HTML retrieved via FlareSolverr'.green);
            return response.data.solution.response;
        } else {
            console.error('[ERROR] Unexpected FlareSolverr response'.red);
            return null;
        }
    } catch (error) {
        console.error('[ERROR] FlareSolverr request failed:'.red, error);
        return null;
    }
}

if (require.main === module) {
    const bus_id = process.argv[2];
    if (!bus_id) {
        console.error('Please provide a bus_id as argument.');
        process.exit(1);
    }
    const url = `https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/${bus_id}/direction/OUTWARD/MISTRAL:00${bus_id}?islid=MISTRAL%3A00${bus_id}&ismode=Bus&islsn=${bus_id}&issubnet=Reseau%20Mistral&isdir=OUTWARD&w=true&date=`;
    getPageViaFlareSolverr(url).then(html => {
        if (html) {
            const fs = require('fs');
            const path = require('path');
            const outDir = path.join(__dirname, '../Errors');
            if (!fs.existsSync(outDir)) fs.mkdirSync(outDir);
            const outFile = path.join(outDir, `${bus_id}_flare.html`);
            fs.writeFileSync(outFile, html, 'utf-8');
            console.log(`[SUCCESS] HTML saved to ${outFile}`.green);
        }
    });
}
