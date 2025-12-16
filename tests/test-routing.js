const axios = require('axios');
require('colors');

const API_URL = 'http://localhost:3000';

/**
 * Test de routing sur la ligne 87
 * De "Mouton" vers "Lycée Beaussier"
 */
async function testRouting() {
    console.log('🚀 Testing routing API...\n'.cyan.bold);

    // Coordonnées des arrêts (depuis 87_horaires.json)
    const mouton = {
        stopId: 'MISTRAL:SIMOUN',
        name: 'Mouton',
        lat: 43.08843,
        lon: 5.85291
    };

    const lyceeBaaussier = {
        stopId: 'MISTRAL:SELBEO',
        name: 'Lycée Beaussier',
        lat: 43.09914,
        lon: 5.87973
    };

    console.log(`📍 From: ${mouton.name} (${mouton.lat}, ${mouton.lon})`.blue);
    console.log(`📍 To: ${lyceeBaaussier.name} (${lyceeBaaussier.lat}, ${lyceeBaaussier.lon})\n`.blue);

    try {
        // Test 1: Avec stopId
        console.log('🧪 Test 1: Using stopId'.yellow);
        const response1 = await axios.post(`${API_URL}/api/routes/calculate`, {
            from: { stopId: mouton.stopId },
            to: { stopId: lyceeBaaussier.stopId },
            maxWalkingDistance: 500
        });

        displayResult(response1.data);

        // Test 2: Avec coordonnées GPS
        console.log('\n🧪 Test 2: Using GPS coordinates'.yellow);
        const response2 = await axios.post(`${API_URL}/api/routes/calculate`, {
            from: { lat: mouton.lat, lon: mouton.lon },
            to: { lat: lyceeBaaussier.lat, lon: lyceeBaaussier.lon },
            maxWalkingDistance: 500
        });

        displayResult(response2.data);

        console.log('\n✅ All tests passed!'.green.bold);

    } catch (error) {
        if (error.response) {
            console.error('❌ API Error:'.red, error.response.data);
        } else if (error.request) {
            console.error('❌ No response from server. Is it running?'.red);
        } else {
            console.error('❌ Error:'.red, error.message);
        }
    }
}

function displayResult(data) {
    if (!data.success) {
        console.error('❌ Request failed:'.red, data.message);
        return;
    }

    const result = data.data;
    console.log(`⏱️  Calculation time: ${result.calculationTime}ms`.gray);
    console.log(`🗺️  Found ${result.routes.length} route(s)\n`.green);

    result.routes.forEach((route, index) => {
        console.log(`${'='.repeat(60)}`.gray);
        console.log(`Route ${index + 1}:`.cyan.bold);
        console.log(`  ⏱️  Duration: ${route.duration} minutes`.green);
        console.log(`  🔄 Transfers: ${route.transfers}`.yellow);
        console.log(`  🚶 Walking: ${route.walkingDistance}m`.blue);
        console.log(`  📊 Score: ${route.score.toFixed(2)}\n`.gray);

        route.steps.forEach((step, stepIndex) => {
            if (step.type === 'walk') {
                console.log(`  ${stepIndex + 1}. 🚶 Walk`.cyan);
                console.log(`     From: ${step.from.name || `(${step.from.lat}, ${step.from.lon})`}`.gray);
                console.log(`     To: ${step.to.name || `(${step.to.lat}, ${step.to.lon})`}`.gray);
                console.log(`     Distance: ${step.distance}m (~${step.duration} min)\n`.blue);
            } else if (step.type === 'bus') {
                console.log(`  ${stepIndex + 1}. 🚌 Bus ${step.line} - ${step.lineName}`.green.bold);
                console.log(`     From: ${step.from.name}`.gray);
                console.log(`     To: ${step.to.name}`.gray);
                console.log(`     Stops: ${step.stopsCount}`.yellow);
                if (step.departureTime) {
                    console.log(`     Departure: ${step.departureTime}`.magenta);
                }
                console.log('');
            }
        });
    });
}

// Run tests
testRouting();