#!/usr/bin/env node

/**
 * Test script for the cache refresh system
 * Usage: node test-cache.js [full] [stats]
 * 
 * Arguments:
 *   full  - Force full refresh (ignore cached working lines)
 *   stats - Only show cache statistics
 */

const axios = require('axios');

const BASE_URL = 'http://localhost:3000';
const args = process.argv.slice(2);

async function testCacheSystem() {
    console.log('🧪 Testing MiawStral Smart Cache System\n');

    try {
        // Test 1: Check if server is running
        console.log('1️⃣ Testing server status...');
        const healthCheck = await axios.get(`${BASE_URL}/`);
        console.log('✅ Server is running\n');

        // Test 2: Get cache stats before refresh
        console.log('2️⃣ Getting cache stats...');
        try {
            const statsBefore = await axios.get(`${BASE_URL}/refresh/stats`);
            const stats = statsBefore.data.data;
            console.log('📊 Cache statistics:');
            console.log(`   - Cached files: ${stats.totalCachedLines}`);
            console.log(`   - Cache mode: ${stats.cacheMode}`);
            if (stats.workingLines) {
                console.log(`   - Working lines: ${stats.workingLines.count} lines`);
                console.log(`   - Last updated: ${new Date(stats.workingLines.lastUpdated).toLocaleString()}`);
                console.log(`   - Lines: [${stats.workingLines.lines.slice(0, 10).join(', ')}${stats.workingLines.lines.length > 10 ? '...' : ''}]`);
            } else {
                console.log('   - No working lines cached (will do full scan)');
            }
            console.log();
        } catch (err) {
            console.log('⚠️  No cache stats available (first run)\n');
        }

        // If only stats requested, exit
        if (args.includes('stats')) {
            console.log('📈 Cache statistics only - exiting');
            return;
        }

        // Test 3: Refresh cache (smart or full)
        const isFullRefresh = args.includes('full');
        const endpoint = isFullRefresh ? '/refresh/full' : '/refresh/refresh';
        const refreshType = isFullRefresh ? 'FULL' : 'SMART';
        
        console.log(`3️⃣ Testing ${refreshType} cache refresh...`);
        console.log('⏳ This may take several minutes depending on the number of lines...\n');
        
        const startTime = Date.now();
        const refreshResponse = await axios.post(`${BASE_URL}${endpoint}`);
        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
        
        if (refreshResponse.data.success) {
            console.log('✅ Cache refresh completed!');
            console.log(`⏱️  Duration: ${duration} seconds`);
            console.log(`🔧 Mode: ${refreshResponse.data.mode}`);
            console.log('📈 Results:');
            console.log(`   - Total lines processed: ${refreshResponse.data.data.totalLines}`);
            console.log(`   - Success: ${refreshResponse.data.data.successCount}`);
            console.log(`   - Warnings: ${refreshResponse.data.data.warningCount}`);
            console.log(`   - Errors: ${refreshResponse.data.data.errorCount}`);
            console.log(`   - Success rate: ${refreshResponse.data.data.successRate}`);
            
            if (refreshResponse.data.data.details.successLines.length > 0) {
                console.log(`\n🚌 Working lines (${refreshResponse.data.data.successLines.length}):`);
                const workingLines = refreshResponse.data.data.details.successLines.map(line => line.split(' - ')[0]);
                console.log(`   [${workingLines.join(', ')}]`);
            }
            
            if (refreshResponse.data.data.details.errorLines.length > 0) {
                console.log(`\n❌ Failed lines (${refreshResponse.data.data.details.errorLines.length}):`);
                refreshResponse.data.data.details.errorLines.slice(0, 5).forEach(line => {
                    console.log(`   • ${line}`);
                });
                if (refreshResponse.data.data.details.errorLines.length > 5) {
                    console.log(`   ... and ${refreshResponse.data.data.details.errorLines.length - 5} more`);
                }
            }
            
            console.log('\n');
        } else {
            console.log('❌ Cache refresh failed:', refreshResponse.data.message);
        }

        // Test 4: Get cache stats after refresh
        console.log('4️⃣ Getting updated cache stats...');
        const statsAfter = await axios.get(`${BASE_URL}/refresh/stats`);
        const finalStats = statsAfter.data.data;
        console.log('📊 Final cache statistics:');
        console.log(`   - Cached files: ${finalStats.totalCachedLines}`);
        console.log(`   - Cache mode: ${finalStats.cacheMode}`);
        if (finalStats.workingLines) {
            console.log(`   - Working lines for next run: ${finalStats.workingLines.count}`);
        }
        console.log('\n🎉 All tests completed!');

    } catch (error) {
        if (error.code === 'ECONNREFUSED') {
            console.log('❌ Server is not running. Please start the server first with: npm start');
        } else if (error.response) {
            console.log('❌ API Error:', error.response.data.message || error.message);
        } else {
            console.log('❌ Test failed:', error.message);
        }
    }
}

// Show usage if help requested
if (args.includes('help') || args.includes('-h')) {
    console.log('Usage: node test-cache.js [options]');
    console.log('');
    console.log('Options:');
    console.log('  stats    Show cache statistics only');
    console.log('  full     Force full refresh (ignore cached working lines)');
    console.log('  help     Show this help message');
    console.log('');
    console.log('Examples:');
    console.log('  node test-cache.js          # Smart refresh (use cached working lines)');
    console.log('  node test-cache.js full     # Force full refresh (scan 1-300)');
    console.log('  node test-cache.js stats    # Show statistics only');
    process.exit(0);
}

testCacheSystem();
