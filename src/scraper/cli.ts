/**
 * Refreshes the timetables from the command line.
 *
 *   npm run scrape                 # lines already known (smart)
 *   npm run scrape -- --full       # scan every line id
 *   npm run scrape -- 1 87 U       # only these lines
 */
import { config } from '../config';
import { refreshLines } from './refresh.service';

async function main(): Promise<void> {
    const args = process.argv.slice(2);
    if (args.includes('--help') || args.includes('-h')) {
        console.log('Usage: npm run scrape -- [--full] [lineId...]');
        return;
    }
    const only = args.filter(a => !a.startsWith('--'));
    console.log(`FlareSolverr: ${config.scraper.flaresolverrUrl} — data: ${config.dataDir}`);

    const result = await refreshLines(args.includes('--full') ? 'full' : 'smart', only);
    console.log(JSON.stringify({ ...result, notFoundLines: result.notFoundLines.length }, null, 2));
    if (result.aborted || result.successLines.length === 0) process.exitCode = 1;
}

main().catch(error => {
    console.error(error);
    process.exitCode = 1;
});
