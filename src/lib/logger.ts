import { config } from '../config';

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40, silent: 100 } as const;
type Level = Exclude<keyof typeof LEVELS, 'silent'>;

const threshold = LEVELS[(config.logLevel as keyof typeof LEVELS)] ?? LEVELS.info;

function write(level: Level, scope: string, message: string, extra?: unknown): void {
    if (LEVELS[level] < threshold) return;
    const line = `${new Date().toISOString()} ${level.toUpperCase().padEnd(5)} [${scope}] ${message}`;
    const out = level === 'error' || level === 'warn' ? console.error : console.log;
    if (extra === undefined) out(line);
    else out(line, extra);
}

export function createLogger(scope: string) {
    return {
        debug: (message: string, extra?: unknown) => write('debug', scope, message, extra),
        info: (message: string, extra?: unknown) => write('info', scope, message, extra),
        warn: (message: string, extra?: unknown) => write('warn', scope, message, extra),
        error: (message: string, extra?: unknown) => write('error', scope, message, extra),
    };
}

export type Logger = ReturnType<typeof createLogger>;
