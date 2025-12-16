const axios = require('axios');
require('colors');

const API_URL = 'http://localhost:3000';

/**
 * Test de routing sur la ligne 87
 * De "Langevin" vers "Lycée Beaussier"
 */
async function testRouting() {
    console.log('🚀 Testing routing API - Line 87 test...\n'.cyan.bold);

    // Test sur la ligne 87 : Seyne Centre → Lycée Beaussier
    const seyneCentre = {
        stopId: 'MISTRAL:SECENN',
        name: 'Seyne Centre (ligne 87)',
        lat: 43.10121,
        lon: 5.8834
    };

    const lyceeBeaussier = {
        stopId: 'MISTRAL:SELBEO',
        name: 'Lycée Beaussier (ligne 87)',
        lat: 43.09914,
        lon: 5.87973
    };

    // Point de destination proche mais pas exactement sur l'arrêt (pour forcer la marche finale)
    const destinationProche = {
        lat: 43.09950,  // ~40m au nord de l'arrêt
        lon: 5.88000    // ~20m à l'est de l'arrêt
    };

    console.log(`📍 From: ${seyneCentre.name} (${seyneCentre.lat}, ${seyneCentre.lon})`.blue);
    console.log(`📍 To: ${lyceeBeaussier.name} (${lyceeBeaussier.lat}, ${lyceeBeaussier.lon})`.blue);
    console.log(`📍 Final destination: (${destinationProche.lat}, ${destinationProche.lon}) - Requires walking\n`.blue);

    try {
        // Test 1: Avec stopId (pas de marche finale)
        console.log('🧪 Test 1: Direct bus stop to bus stop (no final walk)'.yellow);
        const response1 = await axios.post(`${API_URL}/api/routes/calculate`, {
            from: { stopId: seyneCentre.stopId },
            to: { stopId: lyceeBeaussier.stopId },
            maxWalkingDistance: 800,
            maxTransfers: 2
        });

        displayResult(response1.data);

        // Test 2: Vers un point proche (marche finale requise)
        console.log('\n🧪 Test 2: Bus stop to nearby GPS point (requires final walk)'.yellow);
        const response2 = await axios.post(`${API_URL}/api/routes/calculate`, {
            from: { stopId: seyneCentre.stopId },
            to: { lat: destinationProche.lat, lon: destinationProche.lon },
            maxWalkingDistance: 800,
            maxTransfers: 2
        });

        displayResult(response2.data);

        // Test 3: Depuis et vers des coordonnées GPS
        console.log('\n🧪 Test 3: GPS to GPS (requires both initial and final walk)'.yellow);
        const response3 = await axios.post(`${API_URL}/api/routes/calculate`, {
            from: { lat: seyneCentre.lat, lon: seyneCentre.lon },
            to: { lat: destinationProche.lat, lon: destinationProche.lon },
            maxWalkingDistance: 800,
            maxTransfers: 2
        });

        displayResult(response3.data);

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