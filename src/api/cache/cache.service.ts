import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// Define colors for console logging
const colors = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    bold: '\x1b[1m',
    reset: '\x1b[0m'
};

// TypeScript interfaces
interface BusStop {
    name: string;
    city: string | null;
    latitude: string | null;
    longitude: string | null;
    stopPointId: string | null;
    accessible: boolean;
    times: string[];
}

interface BusData {
    bus_id: string;
    lineName: string | null;
    direction: string | null;
    lineId: string | null;
    stops: BusStop[];
    notes: string[];
    error?: string;
}

export interface CacheResult {
    totalLines: number;
    successCount: number;
    warningCount: number;
    errorCount: number;
    successLines: string[];
    warningLines: string[];
    errorLines: string[];
    summary: string;
}

export class CacheService {
    private readonly dataDir = path.join(__dirname, '../../data');
    private readonly workingLinesFile = path.join(__dirname, '../../data/working_lines.json');

    private readonly BATCH_SIZE = 5
    private readonly BATCH_DELAY = 500
    private readonly MAX_RETRIES = 3
    private readonly CACHE_TTL = 24 * 60 * 60 * 1000;

    constructor() {
        // Ensure data directory exists
        if (!fs.existsSync(this.dataDir)) {
            fs.mkdirSync(this.dataDir, { recursive: true });
        }
    }

    /**
     * Load working lines from saved file, or return null if none exists
     */
    private loadWorkingLines(): string[] | null {
        try {
            if (fs.existsSync(this.workingLinesFile)) {
                const data = fs.readFileSync(this.workingLinesFile, 'utf-8');
                const parsed = JSON.parse(data);
                this.log(`[INFO] Loaded ${parsed.workingLines.length} working lines from cache`, 'cyan');
                return parsed.workingLines;
            }
        } catch (error) {
            this.log(`[WARNING] Failed to load working lines: ${error instanceof Error ? error.message : 'Unknown error'}`, 'yellow');
        }
        return null;
    }

    /**
     * Save working lines to file for future use
     */
    private saveWorkingLines(workingLines: string[]): void {
        try {
            const data = {
                lastUpdated: new Date().toISOString(),
                workingLines: workingLines.sort((a, b) => {
                    // Sort numerically, with 'U' at the end
                    if (a === 'U') return 1;
                    if (b === 'U') return -1;
                    return parseInt(a) - parseInt(b);
                }),
                totalCount: workingLines.length
            };
            
            fs.writeFileSync(this.workingLinesFile, JSON.stringify(data, null, 2), 'utf-8');
            this.log(`[SUCCESS] Saved ${workingLines.length} working lines to ${this.workingLinesFile}`, 'green');
        } catch (error) {
            this.log(`[ERROR] Failed to save working lines: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
        }
    }

    /**
     * Get lines to test (from cache or full range)
     */
    private getLinesToTest(): string[] {
        const cachedLines = this.loadWorkingLines();
        
        if (cachedLines && cachedLines.length > 0) {
            this.log(`[INFO] Using cached working lines (${cachedLines.length} lines)`, 'blue');
            return cachedLines;
        } else {
            this.log('[INFO] No cached lines found, testing full range (1-300 + U)', 'blue');
            const allLines: string[] = [];
            for (let i = 1; i <= 300; i++) {
                allLines.push(i.toString());
            }
            allLines.push('U');
            return allLines;
        }
    }
    private log(message: string, color: keyof typeof colors = 'reset'): void {
        console.log(`${colors[color]}${message}${colors.reset}`);
    }

    private async getBusStopsWithRetry(lineId: string): Promise<BusData> {
        let lastError: Error | null = null;
        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await this.getBusStops(lineId);
            } catch (error) {
                lastError = error instanceof Error ? error : new Error('Unkown error occured.');

                if (attempt < this.MAX_RETRIES) {
                    const delay = Math.pow(2, attempt) * 1000;
                    this.log(`[RETRY] Line ${lineId} - Attempt ${attempt}/${this.MAX_RETRIES}, waiting ${delay}ms...`, 'yellow');
                    await this.delay(delay);
                }
            }
        }
        return {
            bus_id: lineId,
            lineName: null,
            direction: null,
            lineId: lineId,
            stops: [],
            notes: [],
            error: lastError?.message || 'Max retries exceeded'
        }
    }

    /**
     * Call the JavaScript getBusStops function
     */
    private async getBusStops(lineId: string): Promise<BusData> {
        try {
            const scriptPath = path.join(__dirname, '../../../javascript/methods/getBusStops.js');
            const { stdout } = await execAsync(`node "${scriptPath}" "${lineId}"`);
            
            // Parse the JSON output from the script
            const lines = stdout.trim().split('\n');
            const jsonLine = lines.find(line => line.startsWith('{'));
            
            if (!jsonLine) {
                return { bus_id: lineId, lineName: null, direction: null, lineId: null, stops: [], notes: [], error: 'No valid JSON output' };
            }
            
            return JSON.parse(jsonLine);
        } catch (error) {
            return { 
                bus_id: lineId, 
                lineName: null, 
                direction: null, 
                lineId: null, 
                stops: [], 
                notes: [], 
                error: error instanceof Error ? error.message : 'Unknown error' 
            };
        }
    }

    /**
     * Fetches all bus lines and caches them (smart mode: uses cached working lines if available)
     */
    async refreshAllLines(): Promise<CacheResult> {
        const startTime = Date.now();
        const linesToTest = this.getLinesToTest();
        const usingCache = this.loadWorkingLines() !== null;
        
        this.log(`[INFO] Starting cache refresh for ${linesToTest.length} lines ${usingCache ? '(using cached list)' : '(full scan)'}...`, 'cyan');
        
        const result: CacheResult = {
            totalLines: linesToTest.length,
            successCount: 0,
            warningCount: 0,
            errorCount: 0,
            successLines: [],
            warningLines: [],
            errorLines: [],
            summary: ''
        };

        const workingLines: string[] = [];

        for (let i = 0; i < linesToTest.length; i+= this.BATCH_SIZE) {
            const batch = linesToTest.slice(i, i + this.BATCH_SIZE);
            const batchNumber = Math.floor(i / this.BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(linesToTest.length / this.BATCH_SIZE);

            this.log(`[BATCH ${batchNumber}/${totalBatches}] — Processing lines: ${batch.join(', ')}`, 'cyan');
            const batchResults = await Promise.all(
                batch.map(lineId => this.processLine(lineId, result))
            );

            batch.forEach((lineId, idx) => {
                if (batchResults[idx]) {
                    workingLines.push(lineId);
                }
            });

            if (i + this.BATCH_SIZE < linesToTest.length) {
                this.log(`[PAUSE] Waiting ${this.BATCH_DELAY}ms before next batch...`, 'blue');
                await this.delay(this.BATCH_DELAY);
            }
        }
        this.saveWorkingLines(workingLines);
        const duration = Date.now() - startTime;
        result.summary = this.generateSummary(result, usingCache, duration);
        console.log(result.summary);
        return result
    }

    /**
     * Process a single bus line
     * @returns true if line was successfully cached, false otherwise
     */
    private async processLine(lineId: string, result: CacheResult): Promise<boolean> {
        try {
            this.log(`[INFO] Processing line ${lineId}...`, 'blue');
            
            const data = await this.getBusStopsWithRetry(lineId);
            
            if (data.error) {
                this.log(`[ERROR] Line ${lineId}: ${data.error}`, 'red');
                result.errorCount++;
                result.errorLines.push(`${lineId} - ${data.error}`);
                return false;
            }

            if (!data.stops || data.stops.length === 0) {
                this.log(`[WARNING] Line ${lineId}: No stops found`, 'yellow');
                result.warningCount++;
                result.warningLines.push(`${lineId} - No stops found`);
                return false;
            }

            // Filter stops with actual times
            const stopsWithTimes = data.stops.filter((stop: BusStop) => stop.times && stop.times.length > 0);
            
            if (stopsWithTimes.length === 0) {
                this.log(`[WARNING] Line ${lineId}: No stops with schedules`, 'yellow');
                result.warningCount++;
                result.warningLines.push(`${lineId} - No stops with schedules`);
                return false;
            }

            // Save to JSON file
            const filename = `${lineId}_horaires.json`;
            const filepath = path.join(this.dataDir, filename);
            
            const cacheData = {
                bus_id: lineId,
                lineName: data.lineName,
                direction: data.direction,
                lineId: data.lineId,
                stops: stopsWithTimes,
                notes: data.notes || [],
                cachedAt: new Date().toISOString(),
                totalStops: stopsWithTimes.length,
                totalTimes: stopsWithTimes.reduce((acc: number, stop: BusStop) => acc + stop.times.length, 0)
            };

            fs.writeFileSync(filepath, JSON.stringify(cacheData, null, 2), 'utf-8');
            
            this.log(`[SUCCESS] Line ${lineId}: ${stopsWithTimes.length} stops, ${cacheData.totalTimes} schedules → ${filename}`, 'green');
            result.successCount++;
            result.successLines.push(`${lineId} - ${stopsWithTimes.length} stops`);
            
            return true;

        } catch (error) {
            this.log(`[ERROR] Line ${lineId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'red');
            result.errorCount++;
            result.errorLines.push(`${lineId} - ${error instanceof Error ? error.message : 'Unknown error'}`);
            return false;
        }
    }

    /**
     * Generate a summary of the cache refresh operation
     */
    private generateSummary(result: CacheResult, usingCache: boolean = false, duration?:number): string {
        const mode = usingCache ? '(Using cached working lines)' : '(Full scan 1-300)';
        const durationStr = duration ? `⏱️ Duration: ${(duration / 1000).toFixed(2)}s` : '';
        const lines = [
            '\n' + '='.repeat(60),
            `${colors.bold}📊 CACHE REFRESH SUMMARY ${mode}${colors.reset}`,
            '='.repeat(60),
            `🔍 Total lines processed: ${result.totalLines}`,
            `${colors.green}✅ [SUCCESS] ${result.successCount} lines cached successfully${colors.reset}`,
            `${colors.yellow}⚠️  [WARNING] ${result.warningCount} lines with warnings${colors.reset}`,
            `${colors.red}❌ [ERROR] ${result.errorCount} lines failed${colors.reset}`,
            '',
            `📈 Success rate: ${((result.successCount / result.totalLines) * 100).toFixed(1)}%`,
            `🚀 Working lines saved for next refresh: ${result.successCount}`,
            durationStr,
            '='.repeat(60)
        ];

        if (result.warningLines.length > 0) {
            lines.push(`\n${colors.yellow}⚠️  WARNING DETAILS:${colors.reset}`);
            result.warningLines.forEach(line => lines.push(`${colors.yellow}   • ${line}${colors.reset}`));
        }

        if (result.errorLines.length > 0) {
            lines.push(`\n${colors.red}❌ ERROR DETAILS:${colors.reset}`);
            result.errorLines.forEach(line => lines.push(`${colors.red}   • ${line}${colors.reset}`));
        }

        lines.push('\n' + '='.repeat(60));
        return lines.join('\n');
    }

    /**
     * Simple delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Force a full scan (1-300 + U) regardless of cached working lines
     */
    async forceFullRefresh(): Promise<CacheResult> {
        this.log('[INFO] FORCED full refresh - ignoring cached working lines', 'cyan');
        
        // Delete cached working lines to force full scan
        if (fs.existsSync(this.workingLinesFile)) {
            fs.unlinkSync(this.workingLinesFile);
            this.log('[INFO] Deleted cached working lines file', 'yellow');
        }
        
        return this.refreshAllLines();
    }

    /**
     * Get cache statistics including working lines info
     */
    getCacheStats(): any {
        const files = fs.readdirSync(this.dataDir).filter(file => file.endsWith('_horaires.json'));
        const workingLines = this.loadWorkingLines();
        
        const stats = {
            totalCachedLines: files.length,
            files: files.sort(),
            workingLines: workingLines ? {
                count: workingLines.length,
                lines: workingLines,
                lastUpdated: this.getWorkingLinesLastUpdate()
            } : null,
            lastUpdate: new Date().toISOString(),
            cacheMode: workingLines ? 'Smart (using working lines)' : 'Full scan (1-300)'
        };

        return stats;
    }

    /**
     * Get last update time of working lines file
     */
    private getWorkingLinesLastUpdate(): string | null {
        try {
            if (fs.existsSync(this.workingLinesFile)) {
                const data = fs.readFileSync(this.workingLinesFile, 'utf-8');
                const parsed = JSON.parse(data);
                return parsed.lastUpdated || null;
            }
        } catch (error) {
            // Ignore errors
        }
        return null;
    }
}
