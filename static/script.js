var map = L.map('map').setView([32.4279, 53.6880], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
}).addTo(map);

let markers = [];
let routeLayers = [];
let labelLayers = [];
let routeData = [];
let placesCount = 1;
const MAX_PLACES = 10;

const routeColors = [
    'red', 'blue', 'green', 'purple', 'orange',
    'yellow', 'pink', 'cyan', 'magenta', 'lime'
];

console.log('Leaflet version:', L.version);
console.log('html2canvas defined:', typeof html2canvas);

function addSlider(index) {
    const placesDiv = document.getElementById('places');
    const slider = document.createElement('div');
    slider.className = 'slider';
    slider.id = `place${index}_slider`;
    slider.style.display = 'block';
    slider.innerHTML = `
        <label for="place${index}">Place ${index}:</label>
        <input type="text" id="place${index}" placeholder="Type a city">
        <div class="suggestions" id="suggestions${index}"></div>
        <div class="distance-display" id="distance${index}"></div>
    `;
    placesDiv.appendChild(slider);
    setupAutocomplete(`place${index}`, `suggestions${index}`, index < MAX_PLACES ? `place${index + 1}_slider` : null);
}

function setupAutocomplete(inputId, suggestionsId, nextSliderId) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);

    input.addEventListener('input', async () => {
        const query = input.value;
        if (query.length < 2) {
            suggestions.style.display = 'none';
            return;
        }

        const response = await fetch(`/get_cities?query=${query}`);
        const cities = await response.json();
        
        suggestions.innerHTML = '';
        cities.forEach(city => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.textContent = city;
            div.onclick = async () => {
                input.value = city;
                suggestions.style.display = 'none';
                const coords = await getCoordinates(city);
                if (coords.error) {
                    console.error(coords.error);
                    return;
                }
                addMarker(coords.lat, coords.lon);
                if (nextSliderId && placesCount < MAX_PLACES) {
                    placesCount++;
                    addSlider(placesCount);
                }
                if (markers.length >= 2) {
                    const currentIndex = parseInt(inputId.replace('place', ''));
                    if (currentIndex > 1 && !routeData[currentIndex - 2]) {
                        await calculateRouteForPair(currentIndex - 1);
                    }
                }
            };
            suggestions.appendChild(div);
        });
        suggestions.style.display = 'block';
    });

    input.addEventListener('blur', () => {
        setTimeout(() => suggestions.style.display = 'none', 200);
    });
}

async function getCoordinates(city) {
    const response = await fetch('/get_coordinates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city })
    });
    return await response.json();
}

function addMarker(lat, lon) {
    const marker = L.marker([lat, lon], {
        icon: L.divIcon({ html: '<div style="background-color:red;width:10px;height:10px;border-radius:50%;"></div>' })
    }).addTo(map);
    markers.push(marker);
    if (markers.length === 1) {
        map.setView([lat, lon], 5);
    } else {
        map.fitBounds(markers.map(m => m.getLatLng()));
    }
}

async function calculateRouteForPair(index) {
    const place1 = document.getElementById(`place${index}`).value;
    const place2 = document.getElementById(`place${index + 1}`).value;
    const distanceDiv = document.getElementById(`distance${index}`);

    if (!place1 || !place2) {
        if (distanceDiv) distanceDiv.textContent = '';
        return;
    }

    const response = await fetch('/get_route', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place1, place2 })
    });
    const data = await response.json();

    if (data.error) {
        console.error(`Route error between ${place1} and ${place2}: ${data.error}`);
        if (distanceDiv) distanceDiv.textContent = 'Route not found';
        return;
    }

    routeData[index - 1] = data;
    drawRoute(index - 1);

    if (distanceDiv) {
        distanceDiv.textContent = `${place1} to ${place2}: ${data.distance} km, ${data.duration} hrs`;
    }

    updateTotalDistance();
}

function drawRoute(index) {
    const data = routeData[index];
    if (!data) return;

    if (routeLayers[index]) map.removeLayer(routeLayers[index]);
    if (labelLayers[index]) map.removeLayer(labelLayers[index]);

    const routeLayer = L.geoJSON({
        type: "LineString",
        coordinates: data.coordinates
    }, {
        style: { 
            color: routeColors[index % routeColors.length],
            weight: 6, 
            opacity: 0.9 
        }
    }).addTo(map);
    routeLayers[index] = routeLayer;

    const midPointIndex = Math.floor(data.coordinates.length / 2);
    const midPoint = [data.coordinates[midPointIndex][1], data.coordinates[midPointIndex][0]];

    const labelLayer = L.marker(midPoint, {
        icon: L.divIcon({
            html: `<div class="route-label">${data.distance} km, ${data.duration} hrs</div>`,
            className: '',
            iconAnchor: [0, -10]
        })
    }).addTo(map);
    labelLayers[index] = labelLayer;

    if (routeLayers.length > 0) {
        const bounds = L.latLngBounds(routeLayers.filter(layer => layer).map(layer => layer.getBounds()));
        map.fitBounds(bounds);
    }
}

async function drawRoutes() {
    routeLayers.forEach(layer => layer && map.removeLayer(layer));
    labelLayers.forEach(layer => layer && map.removeLayer(layer));
    routeLayers = [];
    labelLayers = [];

    for (let i = 1; i < placesCount; i++) {
        const place1 = document.getElementById(`place${i}`).value;
        const place2 = document.getElementById(`place${i + 1}`).value;
        const distanceDiv = document.getElementById(`distance${i}`);

        if (!place1 || !place2) {
            if (distanceDiv) distanceDiv.textContent = '';
            routeData[i - 1] = null;
            continue;
        }

        const response = await fetch('/get_route', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ place1, place2 })
        });
        const data = await response.json();

        if (data.error) {
            console.error(`Route error between ${place1} and ${place2}: ${data.error}`);
            if (distanceDiv) distanceDiv.textContent = 'Route not found';
            routeData[i - 1] = null;
            continue;
        }

        routeData[i - 1] = data;
        drawRoute(i - 1);

        if (distanceDiv) {
            distanceDiv.textContent = `${place1} to ${place2}: ${data.distance} km, ${data.duration} hrs`;
        }
    }

    updateTotalDistance();
}

async function recalculateRoutes() {
    await drawRoutes();
}

function updateTotalDistance() {
    const totalDistance = routeData.reduce((sum, data) => sum + (data ? data.distance : 0), 0);
    const totalDuration = routeData.reduce((sum, data) => sum + (data ? data.duration : 0), 0);
    document.getElementById('total-distance').textContent = `Total: ${totalDistance.toFixed(2)} km, ${totalDuration.toFixed(2)} hrs`;
    return `Total: ${totalDistance.toFixed(2)} km, ${totalDuration.toFixed(2)} hrs`;
}

async function saveMap() {
    console.log('Attempting to save map...');
    if (typeof html2canvas === 'undefined') {
        console.error('html2canvas not loaded');
        alert('Error: html2canvas not loaded. Please check your internet connection.');
        return;
    }

    // Force map to redraw and stabilize
    map.invalidateSize();
    console.log('Map invalidated, waiting for render...');
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log('Map ready, capturing with html2canvas...');
    console.log('Route layers:', routeLayers);
    console.log('Marker layers:', markers);

    html2canvas(document.getElementById('map'), {
        useCORS: true,
        logging: true,
        width: map.getSize().x,
        height: map.getSize().y + 60,
        backgroundColor: null,
        onclone: (clonedDoc) => {
            console.log('Cloning document for capture...');
            const clonedMap = clonedDoc.getElementById('map');
            if (!clonedMap) {
                console.error('Cloned map element not found');
                return;
            }
            clonedMap.style.position = 'absolute';
            clonedMap.style.left = '0';
            clonedMap.style.top = '0';
            clonedMap.style.transform = 'none';

            const tilePane = clonedMap.querySelector('.leaflet-tile-pane');
            if (tilePane) tilePane.style.transform = 'none';
            else console.warn('Tile pane not found in cloned document');

            const overlayPane = clonedMap.querySelector('.leaflet-overlay-pane');
            if (overlayPane) {
                overlayPane.style.transform = 'none';
                overlayPane.style.position = 'absolute';
                overlayPane.style.left = '0';
                overlayPane.style.top = '0';
                const svg = overlayPane.querySelector('svg');
                if (svg) svg.style.transform = 'none';
                else console.warn('SVG not found in overlay pane');
            } else {
                console.error('Overlay pane not found in cloned document');
            }

            const objectsPane = clonedMap.querySelector('.leaflet-objects-pane');
            if (objectsPane) objectsPane.style.transform = 'none';
            else console.warn('Objects pane not found in cloned document');
        }
    }).then(canvas => {
        console.log('Canvas captured, adding text...');
        const ctx = canvas.getContext('2d');
        const totalText = updateTotalDistance();
        const footerText = 'Powered by Mehdi Akbarifar';

        ctx.fillStyle = 'white';
        ctx.fillRect(0, canvas.height - 60, canvas.width, 30);
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(totalText, canvas.width / 2, canvas.height - 40);

        ctx.fillStyle = 'white';
        ctx.fillRect(0, canvas.height - 30, canvas.width, 30);
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.fillText(footerText, canvas.width / 2, canvas.height - 10);

        const link = document.createElement('a');
        link.download = 'iran_roadmap.png';
        link.href = canvas.toDataURL('image/png');
        console.log('Image URL generated, triggering download...');
        link.click();
    }).catch(err => {
        console.error('Error capturing map with html2canvas:', err);
        alert('Failed to save map: ' + err.message);
    });
}

function clearAll() {
    markers.forEach(marker => map.removeLayer(marker));
    routeLayers.forEach(layer => layer && map.removeLayer(layer));
    labelLayers.forEach(layer => layer && map.removeLayer(layer));
    markers = [];
    routeLayers = [];
    labelLayers = [];
    routeData = [];
    placesCount = 1;

    const placesDiv = document.getElementById('places');
    while (placesDiv.children.length > 1) {
        placesDiv.removeChild(placesDiv.lastChild);
    }
    document.getElementById('place1').value = '';
    document.getElementById('distance1').textContent = '';
    document.getElementById('total-distance').textContent = '';
    map.setView([32.4279, 53.6880], 5);
}

async function addNewCity() {
    const city = document.getElementById('new_city').value;
    const lat = document.getElementById('lat').value;
    const lon = document.getElementById('lon').value;
    const messageDiv = document.getElementById('add_city_message');

    if (!city || !lat || !lon) {
        messageDiv.style.color = 'red';
        messageDiv.textContent = 'Please fill all fields';
        return;
    }

    const response = await fetch('/add_city', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ city, lat, lon })
    });
    const result = await response.json();

    if (response.ok) {
        messageDiv.style.color = 'green';
        messageDiv.textContent = result.message;
        document.getElementById('new_city').value = '';
        document.getElementById('lat').value = '';
        document.getElementById('lon').value = '';
    } else {
        messageDiv.style.color = 'red';
        messageDiv.textContent = result.error || 'Failed to add city';
    }
}

setupAutocomplete('place1', 'suggestions1', 'place2_slider');
