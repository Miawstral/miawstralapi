const puppeteer = require('puppeteer');
require('colors');

/**
 * Récupère les arrêts d'une ligne de bus en contournant Cloudflare avec Puppeteer (headless).
 * @param {string} bus_id
 * @returns {Promise<Array>} Liste des arrêts
 */
async function getBusStopsPuppeteer(bus_id) {
    const url = `https://sim.112.prod.instant-system.com/fr/horaires/Reseau-Mistral/Bus/ligne/${bus_id}/direction/OUTWARD/MISTRAL:00${bus_id}?islid=MISTRAL%3A00${bus_id}&ismode=Bus&islsn=${bus_id}&issubnet=Reseau%20Mistral&isdir=OUTWARD&w=true&date=`;
    console.log(`[INFO] Lancement de Puppeteer...`.cyan);
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    console.log(`[INFO] Navigation vers l'URL: ${url}`.yellow);
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 60000 });
    console.log(`[INFO] Page chargée, extraction des arrêts...`.green);
    const stops = await page.evaluate(() => {
        const stopElements = document.querySelectorAll('.is-Timesheet-StopPoint-Link');
        return Array.from(stopElements).map(elem => ({
            name: elem.getAttribute('data-stoppoint-name'),
            latitude: elem.getAttribute('data-lat'),
            longitude: elem.getAttribute('data-lon'),
            stopPointId: elem.getAttribute('data-stoppoint-id')
        })).filter(stop => stop.name);
    });
    if (stops.length === 0) {
        console.log(`[WARN] Aucun arrêt trouvé pour la ligne ${bus_id}`.red);
    } else {
        console.log(`[SUCCESS] ${stops.length} arrêts trouvés pour la ligne ${bus_id}`.green);
    }
    await browser.close();
    return stops;
}

module.exports = { getBusStopsPuppeteer };
