// Initialize map centered on Toulon
const map = L.map('map', {
    zoomControl: false
}).setView([43.1242, 5.9280], 12);

// Add custom zoom control (bottom right)
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

// Map tile layers
const lightTile = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap contributors'
});

const darkTile = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '© OpenStreetMap contributors © CARTO',
    subdomains: 'abcd',
    maxZoom: 20
});

// Start with dark tile
darkTile.addTo(map);
let currentTile = 'dark';

// Dark mode toggle
const darkModeToggle = document.getElementById('darkModeToggle');
const sunIcon = document.getElementById('sunIcon');
const moonIcon = document.getElementById('moonIcon');
const htmlElement = document.documentElement;

// Check saved preference
const savedTheme = localStorage.getItem('theme') || 'dark';
if (savedTheme === 'light') {
    htmlElement.classList.remove('dark');
    map.removeLayer(darkTile);
    lightTile.addTo(map);
    currentTile = 'light';
    sunIcon.classList.remove('hidden');
    moonIcon.classList.add('hidden');
} else {
    htmlElement.classList.add('dark');
    moonIcon.classList.remove('hidden');
    sunIcon.classList.add('hidden');
}

darkModeToggle.addEventListener('click', () => {
    if (htmlElement.classList.contains('dark')) {
        // Switch to light
        htmlElement.classList.remove('dark');
        map.removeLayer(darkTile);
        lightTile.addTo(map);
        currentTile = 'light';
        localStorage.setItem('theme', 'light');
        sunIcon.classList.remove('hidden');
        moonIcon.classList.add('hidden');
    } else {
        // Switch to dark
        htmlElement.classList.add('dark');
        map.removeLayer(lightTile);
        darkTile.addTo(map);
        currentTile = 'dark';
        localStorage.setItem('theme', 'dark');
        moonIcon.classList.remove('hidden');
        sunIcon.classList.add('hidden');
    }
});

// Set default time to current time
const now = new Date();
const hours = String(now.getHours()).padStart(2, '0');
const minutes = String(now.getMinutes()).padStart(2, '0');
document.getElementById('timeInput').value = `${hours}:${minutes}`;

// State
let fromMarker = null;
let toMarker = null;
let routeLayers = [];
let currentRoutes = [];
let allStops = [];
let selectedFromStop = null;
let selectedToStop = null;
let stopsLayer = null;
let stopsVisible = false;

// Custom icons
const createIcon = (color) => L.divIcon({
    className: 'custom-marker',
    html: `
        <div style="position: relative;">
            <div style="width: 12px; height: 12px; background: ${color}; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>
            <div style="position: absolute; top: 0; left: 0; width: 12px; height: 12px; background: ${color}; border-radius: 50%; opacity: 0.3; animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;"></div>
        </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9]
});

const fromIcon = createIcon('#3b82f6');
const toIcon = createIcon('#ef4444');

// Update walking distance display
document.getElementById('maxWalking').addEventListener('input', (e) => {
    document.getElementById('walkingValue').textContent = `${e.target.value}m`;
});

// Load all stops
async function loadAllStops() {
    try {
        const response = await fetch('http://localhost:3000/api/stops');
        const data = await response.json();
        
        // The API returns an array of stops directly, not grouped by line
        allStops = data.map(stop => ({
            name: stop.name,
            lat: stop.latitude,
            lon: stop.longitude,
            stopPointId: stop.stopPointId
        }));
        
        console.log(`Loaded ${allStops.length} stops`);
        
    } catch (error) {
        console.error('Failed to load stops:', error);
    }
}

loadAllStops();

// Display stops on map
function displayStopsOnMap() {
    if (stopsLayer) {
        map.removeLayer(stopsLayer);
        stopsLayer = null;
    }
    
    const markers = allStops.map(stop => {
        const marker = L.circleMarker([stop.lat, stop.lon], {
            radius: 4,
            fillColor: '#667eea',
            color: '#fff',
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.6
        });
        
        marker.bindPopup(`
            <div class="font-medium text-sm">${stop.name}</div>
            <div class="text-xs text-gray-500 mt-1">${stop.stopPointId}</div>
        `, {
            closeButton: false,
            className: 'custom-popup'
        });
        
        return marker;
    });
    
    stopsLayer = L.layerGroup(markers);
    stopsLayer.addTo(map);
}

// Toggle stops visibility
const toggleStopsBtn = document.getElementById('toggleStopsBtn');
const toggleStopsText = document.getElementById('toggleStopsText');

toggleStopsBtn.addEventListener('click', () => {
    if (stopsVisible) {
        // Hide stops
        if (stopsLayer) {
            map.removeLayer(stopsLayer);
            stopsLayer = null;
        }
        stopsVisible = false;
        toggleStopsText.textContent = 'Afficher arrêts';
    } else {
        // Show stops
        if (allStops.length > 0) {
            displayStopsOnMap();
            stopsVisible = true;
            toggleStopsText.textContent = 'Masquer arrêts';
        }
    }
});

// Autocomplete functionality
function setupAutocomplete(inputId, suggestionsId, onSelect) {
    const input = document.getElementById(inputId);
    const suggestionsDiv = document.getElementById(suggestionsId);
    
    input.addEventListener('input', (e) => {
        const query = e.target.value.trim().toLowerCase();
        
        if (query.length < 1) {
            suggestionsDiv.classList.add('hidden');
            return;
        }
        
        const matches = allStops
            .filter(stop => stop.name.toLowerCase().includes(query))
            .sort((a, b) => {
                // Prioritize matches that start with the query
                const aStarts = a.name.toLowerCase().startsWith(query);
                const bStarts = b.name.toLowerCase().startsWith(query);
                if (aStarts && !bStarts) return -1;
                if (!aStarts && bStarts) return 1;
                return a.name.localeCompare(b.name);
            })
            .slice(0, 8);
        
        if (matches.length === 0) {
            suggestionsDiv.innerHTML = '<div class="px-4 py-3 text-sm text-gray-500">Aucun arrêt trouvé</div>';
            suggestionsDiv.classList.remove('hidden');
            return;
        }
        
        suggestionsDiv.innerHTML = matches.map((stop, index) => {
            // Encode JSON properly to avoid issues with quotes/apostrophes
            const stopData = JSON.stringify(stop).replace(/"/g, '&quot;');
            return `
                <div class="suggestion-item px-4 py-2.5 cursor-pointer border-b border-gray-100 dark:border-gray-700 last:border-b-0" data-stop="${stopData}">
                    <div class="font-medium text-gray-900 dark:text-gray-100">${highlightMatch(stop.name, query)}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400 mt-0.5">📍 ${stop.stopPointId}</div>
                </div>
            `;
        }).join('');
        
        suggestionsDiv.classList.remove('hidden');
    });
    
    // Use event delegation for better reliability
    suggestionsDiv.addEventListener('click', (e) => {
        const suggestionItem = e.target.closest('[data-stop]');
        if (suggestionItem) {
            const stopData = suggestionItem.dataset.stop;
            const stop = JSON.parse(stopData);
            input.value = stop.name;
            suggestionsDiv.classList.add('hidden');
            onSelect(stop);
        }
    });
    
    // Close suggestions when clicking outside
    document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsDiv.contains(e.target)) {
            suggestionsDiv.classList.add('hidden');
        }
    });
}

// Highlight matching text
function highlightMatch(text, query) {
    const regex = new RegExp(`(${query})`, 'gi');
    return text.replace(regex, '<span class="bg-brand-100 text-brand-700 font-semibold">$1</span>');
}

setupAutocomplete('from', 'fromSuggestions', (stop) => {
    selectedFromStop = stop;
    if (fromMarker) map.removeLayer(fromMarker);
    fromMarker = L.marker([stop.lat, stop.lon], { icon: fromIcon }).addTo(map);
    fromMarker.bindTooltip(stop.name, { permanent: false, direction: 'top' });
    map.setView([stop.lat, stop.lon], 14);
});

setupAutocomplete('to', 'toSuggestions', (stop) => {
    selectedToStop = stop;
    if (toMarker) map.removeLayer(toMarker);
    toMarker = L.marker([stop.lat, stop.lon], { icon: toIcon }).addTo(map);
    toMarker.bindTooltip(stop.name, { permanent: false, direction: 'top' });
    map.setView([stop.lat, stop.lon], 14);
});

// Map click handler - removed since we're using stop names now

// Search button handler
document.getElementById('searchBtn').addEventListener('click', async () => {
    if (!selectedFromStop || !selectedToStop) {
        showMessage('Veuillez sélectionner un arrêt de départ et d\'arrivée', 'error');
        return;
    }

    const maxWalking = parseInt(document.getElementById('maxWalking').value);
    const timeInput = document.getElementById('timeInput').value;
    const timeType = document.querySelector('input[name="timeType"]:checked').value;

    showLoading(true);

    try {
        const requestBody = {
            from: { lat: selectedFromStop.lat, lon: selectedFromStop.lon },
            to: { lat: selectedToStop.lat, lon: selectedToStop.lon },
            maxWalkingDistance: maxWalking
        };

        // Add time if specified
        if (timeInput) {
            if (timeType === 'departure') {
                requestBody.departureTime = timeInput;
            } else {
                requestBody.arrivalTime = timeInput;
            }
        }

        const response = await fetch('http://localhost:3000/api/routes/calculate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        const data = await response.json();

        if (data.success && data.data.routes.length > 0) {
            currentRoutes = data.data.routes;
            displayRoutes(data.data.routes);
            
            const message = `${data.data.routes.length} itinéraire(s) trouvé(s)`;
            showMessage(message, 'success');
        } else {
            showMessage('Aucun itinéraire trouvé. Essayez de modifier vos critères.', 'error');
            document.getElementById('routesContainer').innerHTML = '';
        }
    } catch (error) {
        showMessage('Erreur de connexion au serveur', 'error');
        console.error(error);
    } finally {
        showLoading(false);
    }
});

function displayRoutes(routes) {
    const container = document.getElementById('routesContainer');
    container.innerHTML = '';

    routes.forEach((route, index) => {
        const isRecommended = index === 0;
        const duration = Math.ceil(route.duration);
        const walking = route.walkingDistance;
        
        const card = document.createElement('div');
        card.className = `route-card bg-white dark:bg-slate-800 rounded-xl p-4 mb-3 border-2 cursor-pointer transition-all ${
            isRecommended ? 'border-brand-500' : 'border-gray-200 dark:border-slate-600'
        }`;
        
        const busSteps = route.steps.filter(s => s.type === 'bus');
        const lineNumbers = busSteps.map(s => s.line).join(', ');
        
        // Generate detailed steps HTML
        const detailsHTML = route.steps.map((step, stepIndex) => {
            if (step.type === 'walk') {
                return `
                    <div class="flex gap-3 py-3 border-b border-gray-100 dark:border-slate-700 last:border-0">
                        <div class="flex-shrink-0 w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900 flex items-center justify-center">
                            <svg class="w-5 h-5 text-purple-600 dark:text-purple-300" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                            </svg>
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-gray-100">Marche à pied</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">${step.distance}m · ${step.duration} min</div>
                        </div>
                    </div>
                `;
            } else {
                const timeInfo = step.departureTime && step.arrivalTime 
                    ? `<div class="text-xs text-gray-500 dark:text-gray-500 mt-1">🕐 ${step.departureTime} → ${step.arrivalTime}</div>`
                    : '';
                return `
                    <div class="flex gap-3 py-3 border-b border-gray-100 dark:border-slate-700 last:border-0">
                        <div class="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold" style="background-color: ${step.color}">
                            ${step.line}
                        </div>
                        <div class="flex-1">
                            <div class="font-medium text-gray-900 dark:text-gray-100">Bus ${step.line}</div>
                            <div class="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                ${step.from.name} → ${step.to.name}
                            </div>
                            <div class="text-xs text-gray-500 dark:text-gray-500 mt-1">
                                ${step.stopsCount} arrêt(s) · ${step.duration} min
                            </div>
                            ${timeInfo}
                        </div>
                    </div>
                `;
            }
        }).join('');
        
        card.innerHTML = `
            <div class="flex items-start justify-between mb-3">
                <div class="flex-1">
                    <div class="flex items-center gap-2 mb-1">
                        ${isRecommended ? '<span class="px-2 py-0.5 bg-brand-500 text-white text-xs font-semibold rounded">Recommandé</span>' : ''}
                        <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Itinéraire ${index + 1}</span>
                    </div>
                    <div class="flex items-baseline gap-2">
                        <div class="text-2xl font-bold text-gray-900 dark:text-gray-100">${duration} min</div>
                        ${(() => {
                            const firstBusStep = route.steps.find(s => s.type === 'bus');
                            const lastBusStep = [...route.steps].reverse().find(s => s.type === 'bus');
                            console.log('[ROUTE CARD] First bus step:', firstBusStep);
                            console.log('[ROUTE CARD] Departure time:', firstBusStep?.departureTime);
                            console.log('[ROUTE CARD] Arrival time:', lastBusStep?.arrivalTime);
                            if (firstBusStep && firstBusStep.departureTime) {
                                const arrival = lastBusStep && lastBusStep.arrivalTime ? lastBusStep.arrivalTime : '';
                                return `<div class="text-sm font-medium text-gray-600 dark:text-gray-400">🕐 ${firstBusStep.departureTime}${arrival ? ' → ' + arrival : ''}</div>`;
                            }
                            return '<div class="text-xs text-gray-400 dark:text-gray-500">Horaires non disponibles</div>';
                        })()}
                    </div>
                </div>
                <div class="text-right">
                    <div class="text-sm text-gray-600 dark:text-gray-300">${route.transfers === 0 ? 'Direct' : route.transfers + ' changement(s)'}</div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">${walking}m à pied</div>
                </div>
            </div>
            
            <div class="flex items-center gap-2 mb-3 overflow-x-auto pb-2">
                ${route.steps.map(step => {
                    if (step.type === 'walk') {
                        return `<div class="flex items-center gap-1 px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 rounded-lg text-xs font-medium whitespace-nowrap">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fill-rule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clip-rule="evenodd"/>
                            </svg>
                            ${step.duration} min
                        </div>`;
                    } else {
                        return `<div class="flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium whitespace-nowrap text-white" style="background-color: ${step.color}">
                            <svg class="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M8 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0zM15 16.5a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z"/>
                                <path d="M3 4a1 1 0 00-1 1v10a1 1 0 001 1h1.05a2.5 2.5 0 014.9 0H10a1 1 0 001-1V5a1 1 0 00-1-1H3zM14 7a1 1 0 00-1 1v6.05A2.5 2.5 0 0115.95 16H17a1 1 0 001-1v-5a1 1 0 00-.293-.707l-2-2A1 1 0 0015 7h-1z"/>
                            </svg>
                            ${step.line}
                        </div>`;
                    }
                }).join('<svg class="w-4 h-4 text-gray-400 dark:text-gray-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/></svg>')}
            </div>
            
            <button class="details-toggle text-brand-600 dark:text-brand-400 text-sm font-medium hover:text-brand-700 dark:hover:text-brand-300 flex items-center gap-1 w-full">
                <span>Voir les détails</span>
                <svg class="w-4 h-4 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/>
                </svg>
            </button>
            
            <div class="details-content hidden mt-3 pt-3 border-t border-gray-200 dark:border-slate-600">
                ${detailsHTML}
            </div>
        `;

        // Toggle details
        const detailsToggle = card.querySelector('.details-toggle');
        const detailsContent = card.querySelector('.details-content');
        detailsToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const arrow = detailsToggle.querySelector('svg');
            if (detailsContent.classList.contains('hidden')) {
                detailsContent.classList.remove('hidden');
                arrow.style.transform = 'rotate(180deg)';
            } else {
                detailsContent.classList.add('hidden');
                arrow.style.transform = 'rotate(0deg)';
            }
        });

        // Select route on card click
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.details-toggle')) {
                document.querySelectorAll('.route-card').forEach(c => {
                    c.classList.remove('border-brand-500', 'shadow-lg');
                    c.classList.add('border-gray-200', 'dark:border-slate-600');
                });
                card.classList.remove('border-gray-200', 'dark:border-slate-600');
                card.classList.add('border-brand-500', 'shadow-lg');
                displayRouteOnMap(route);
            }
        });

        container.appendChild(card);
    });

    // Auto-select first route
    if (routes.length > 0) {
        container.firstChild.classList.add('shadow-lg');
        displayRouteOnMap(routes[0]);
    }
}

function displayRouteOnMap(route) {
    routeLayers.forEach(layer => map.removeLayer(layer));
    routeLayers = [];

    route.steps.forEach((step) => {
        const color = step.type === 'bus' ? step.color : '#8b5cf6';
        
        let coords;
        if (step.geometry && step.geometry.length > 0) {
            coords = step.geometry;
        } else {
            coords = [[step.from.lat, step.from.lon], [step.to.lat, step.to.lon]];
        }

        const line = L.polyline(coords, {
            color: color,
            weight: step.type === 'bus' ? 5 : 4,
            opacity: 0.8,
            dashArray: step.type === 'walk' ? '10, 10' : null,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        const popupContent = step.type === 'walk' 
            ? `<div class="font-medium">🚶 Marche</div><div class="text-sm text-gray-600">${step.distance}m · ${step.duration} min</div>`
            : `<div class="font-medium">🚌 Bus ${step.line}</div><div class="text-sm text-gray-600">${step.from.name} → ${step.to.name}</div><div class="text-xs text-gray-500">${step.stopsCount} arrêt(s)</div>`;
        
        line.bindPopup(popupContent);
        routeLayers.push(line);

        if (step.type === 'bus') {
            const startMarker = L.circleMarker([step.from.lat, step.from.lon], {
                radius: 6,
                fillColor: '#fff',
                color: color,
                weight: 3,
                fillOpacity: 1
            }).addTo(map);
            
            startMarker.bindPopup(`<div class="font-medium">${step.from.name}</div><div class="text-sm text-gray-600">🚌 Bus ${step.line}</div>`);

            const endMarker = L.circleMarker([step.to.lat, step.to.lon], {
                radius: 6,
                fillColor: '#fff',
                color: color,
                weight: 3,
                fillOpacity: 1
            }).addTo(map);
            
            endMarker.bindPopup(`<div class="font-medium">${step.to.name}</div><div class="text-sm text-gray-600">🚌 Bus ${step.line}</div>`);

            routeLayers.push(startMarker, endMarker);
        }
    });

    const allCoords = route.steps.flatMap(step => 
        step.geometry || [[step.from.lat, step.from.lon], [step.to.lat, step.to.lon]]
    );
    const bounds = L.latLngBounds(allCoords);
    map.fitBounds(bounds, { padding: [50, 50] });
}

function showMessage(text, type) {
    const msgDiv = document.getElementById('message');
    
    const icons = {
        success: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clip-rule="evenodd"/></svg>',
        error: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clip-rule="evenodd"/></svg>',
        info: '<svg class="w-5 h-5" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clip-rule="evenodd"/></svg>'
    };
    
    const colors = {
        success: 'bg-green-50 text-green-800 border-green-200',
        error: 'bg-red-50 text-red-800 border-red-200',
        info: 'bg-blue-50 text-blue-800 border-blue-200'
    };
    
    msgDiv.className = `flex items-center gap-2 p-3 rounded-lg border-2 text-sm font-medium mb-4 ${colors[type]} animate-slide-up`;
    msgDiv.innerHTML = `${icons[type]} ${text}`;
    
    if (type !== 'info') {
        setTimeout(() => {
            msgDiv.className = '';
            msgDiv.innerHTML = '';
        }, 5000);
    }
}

function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.remove('hidden');
    } else {
        overlay.classList.add('hidden');
    }
}
