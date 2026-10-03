import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        include: ['tests/**/*.test.ts'],
        environment: 'node',
        env: {
            LOG_LEVEL: 'silent',
            USE_OSRM: 'false',
        },
    },
});
