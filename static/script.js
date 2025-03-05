var map = L.map('map').setView([32.4279, 53.6880], 5);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
}).addTo(map);

let markers = [];
let routeLayers = [];
let labelLayers = [];
let nameLabels = [];
let routeData = [];
let placesCount = 1;
const MAX_PLACES = 10;

const routeColors = [
    'red', 'blue', 'green', 'purple', 'orange',
    'yellow', 'pink', 'cyan', 'magenta', 'lime'
];

// Custom marker icons
const redMarkerIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const greenMarkerIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

const blueMarkerIcon = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-blue.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    shadowSize: [41, 41]
});

// SVG filter for route shadows
const svgFilter = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
svgFilter.setAttribute('style', 'position: absolute; top: -9999px;');
svgFilter.innerHTML = `
<defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="2" result="blur"/>
        <feOffset in="blur" dx="2" dy="2" result="offsetBlur"/>
        <feMerge>
            <feMergeNode in="offsetBlur"/>
            <feMergeNode in="SourceGraphic"/>
        </feMerge>
    </filter>
</defs>
`;
document.body.appendChild(svgFilter);

// Translations
const translations = {
    en: {
        placeLabel: 'Place',
        typeCity: 'Type a city',
        recalculateRoutes: 'Recalculate Routes',
        saveMap: 'Save Map',
        clearAll: 'Clear All',
        toggleAddCity: 'Add a new location',
        addNewCity: 'Add New City',
        cityName: 'City Name',
        latitude: 'Latitude',
        longitude: 'Longitude',
        addCity: 'Add City',
        fillAllFields: 'Please fill all fields',
        poweredBy: 'Powered by Mehdi Akbarifar',
        to: 'to',
        km: 'km',
        hrs: 'hrs',
        routeInfo: (place1, place2, distance, duration) => `From ${place1} to ${place2}: ${distance} km, ${duration} hrs`
    },
    fa: {
        placeLabel: 'مکان',
        typeCity: 'یک شهر تایپ کنید',
        recalculateRoutes: 'محاسبه مجدد مسیرها',
        saveMap: 'ذخیره نقشه',
        clearAll: 'پاک کردن همه',
        toggleAddCity: 'افزودن مکان جدید',
        addNewCity: 'افزودن شهر جدید',
        cityName: 'نام شهر',
        latitude: 'عرض جغرافیایی',
        longitude: 'طول جغرافیایی',
        addCity: 'افزودن شهر',
        fillAllFields: 'لطفا همه فیلدها را پر کنید',
        poweredBy: 'قدرت گرفته از مهدی اکبری فر',
        to: 'به',
        km: 'کیلومتر',
        hrs: 'ساعت',
        routeInfo: (place1, place2, distance, duration) => `از ${place1} به ${place2} برابر ${distance} کیلومتر و ${duration} ساعت`
    }
};

let currentLanguage = 'en';

function setLanguage(lang) {
    currentLanguage = lang;
    document.querySelectorAll('[data-i18n]').forEach(el => {
        const key = el.getAttribute('data-i18n');
        el.textContent = translations[lang][key];
        if (lang === 'fa') {
            el.classList.add('rtl');
        } else {
            el.classList.remove('rtl');
        }
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const key = el.getAttribute('data-i18n-placeholder');
        el.placeholder = translations[lang][key];
    });
    document.getElementById('lang-toggle').textContent = lang === 'en' ? 'FA' : 'EN';
    updateSliderLabels();
    updateRouteInformation();
}

document.getElementById('lang-toggle').addEventListener('click', () => {
    const newLang = currentLanguage === 'en' ? 'fa' : 'en';
    setLanguage(newLang);
});

// Initial language setup
setLanguage('en');

function updateSliderLabels() {
    for (let i = 1; i <= placesCount; i++) {
        const label = document.querySelector(`#place${i}_slider label`);
        if (label) {
            label.textContent = `${translations[currentLanguage].placeLabel} ${i}:`;
        }
    }
}

function addSlider(index) {
    const placesDiv = document.getElementById('places');
    const slider = document.createElement('div');
    slider.className = 'slider';
    slider.id = `place${index}_slider`;
    slider.style.display = 'block';
    slider.innerHTML = `
        <label for="place${index}" data-i18n="placeLabel">${translations[currentLanguage].placeLabel} ${index}:</label>
        <input type="text" id="place${index}" placeholder="${translations[currentLanguage].typeCity}">
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
                addMarker(coords.lat, coords.lon, city, placesCount - 1);
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

function addMarker(lat, lon, cityName, index) {
    if (markers[index]) {
        map.removeLayer(markers[index]);
        map.removeLayer(nameLabels[index]);
    }

    let markerIcon;
    if (index === 0) {
        markerIcon = redMarkerIcon;
    } else if (index === placesCount - 1) {
        markerIcon = greenMarkerIcon;
    } else {
        markerIcon = blueMarkerIcon;
    }
    const marker = L.marker([lat, lon], { icon: markerIcon }).addTo(map);
    markers[index] = marker;

    const nameLabel = L.marker([lat, lon], {
        icon: L.divIcon({
            className: 'city-name-label',
            html: `<div style="font-size: 12px; text-align: center; margin-bottom: 20px;">${cityName}</div>`,
            iconAnchor: [0, -20]
        })
    }).addTo(map);
    nameLabels[index] = nameLabel;

    markers.forEach((m, i) => {
        if (i === 0) {
            m.setIcon(redMarkerIcon);
        } else if (i === placesCount - 1) {
            m.setIcon(greenMarkerIcon);
        } else {
            m.setIcon(blueMarkerIcon);
        }
    });

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
        const routeInfo = translations[currentLanguage].routeInfo(place1, place2, data.distance, data.duration);
        distanceDiv.textContent = routeInfo;
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
            opacity: 0.6,
            filter: 'url(#shadow)'
        }
    }).addTo(map);
    routeLayers[index] = routeLayer;

    const midPointIndex = Math.floor(data.coordinates.length / 2);
    const midPoint = [data.coordinates[midPointIndex][1], data.coordinates[midPointIndex][0]];
    const text = `${data.distance} ${translations[currentLanguage].km}, ${data.duration} ${translations[currentLanguage].hrs}`;
    const textWidth = text.length * 6;

    const labelLayer = L.marker(midPoint, {
        icon: L.divIcon({
            className: 'route-label',
            html: `<div style="background: rgba(255,255,255,0.9); padding: 5px; border-radius: 5px; width: ${textWidth}px; font-size: 11px;">${text}</div>`,
            iconSize: [textWidth, 20]
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
            const routeInfo = translations[currentLanguage].routeInfo(place1, place2, data.distance, data.duration);
            distanceDiv.textContent = routeInfo;
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
    const totalText = translations[currentLanguage].routeInfo('Total', '', totalDistance.toFixed(2), totalDuration.toFixed(2));
    document.getElementById('total-distance').textContent = totalText;
    return totalText;
}

async function saveMap() {
    if (typeof leafletImage === 'undefined') {
        alert('Error: leaflet-image not loaded.');
        return;
    }

    // Temporarily hide divIcon labels to avoid error
    labelLayers.forEach(label => label && label.setOpacity(0));
    nameLabels.forEach(label => label && label.setOpacity(0));

    map.invalidateSize();
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for rendering

    leafletImage(map, function(err, canvas) {
        if (err) {
            alert('Failed to save map: ' + err.message);
            return;
        }

        // Restore visibility of divIcon labels
        labelLayers.forEach(label => label && label.setOpacity(1));
        nameLabels.forEach(label => label && label.setOpacity(1));

        const ctx = canvas.getContext('2d');
        const totalText = updateTotalDistance();
        const footerText = translations[currentLanguage].poweredBy;

        ctx.fillStyle = 'white';
        ctx.fillRect(0, canvas.height - 55, canvas.width, 30); // Background for total text
        ctx.fillStyle = 'black';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(totalText, canvas.width / 2, canvas.height - 35); // 25px padding from bottom

        ctx.fillStyle = 'white';
        ctx.fillRect(0, canvas.height - 25, canvas.width, 25); // Background for footer
        ctx.fillStyle = 'black';
        ctx.font = '14px Arial';
        ctx.fillText(footerText, canvas.width / 2, canvas.height - 10);

        const link = document.createElement('a');
        link.download = 'iran_roadmap.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
    });
}

function clearAll() {
    markers.forEach(marker => marker && map.removeLayer(marker));
    routeLayers.forEach(layer => layer && map.removeLayer(layer));
    labelLayers.forEach(layer => layer && map.removeLayer(layer));
    nameLabels.forEach(label => label && map.removeLayer(label));
    markers = [];
    routeLayers = [];
    labelLayers = [];
    nameLabels = [];
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
        messageDiv.textContent = translations[currentLanguage].fillAllFields;
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

document.getElementById('toggle-add-city').addEventListener('click', () => {
    const form = document.getElementById('add-city-form');
    form.style.display = form.style.display === 'none' ? 'block' : 'none';
});

function updateRouteInformation() {
    for (let i = 1; i < placesCount; i++) {
        const place1 = document.getElementById(`place${i}`).value;
        const place2 = document.getElementById(`place${i + 1}`).value;
        const distanceDiv = document.getElementById(`distance${i}`);
        const data = routeData[i - 1];

        if (data && place1 && place2) {
            const routeInfo = translations[currentLanguage].routeInfo(place1, place2, data.distance, data.duration);
            distanceDiv.textContent = routeInfo;
            drawRoute(i - 1);
        }
    }
    updateTotalDistance();
}

setupAutocomplete('place1', 'suggestions1', 'place2_slider');
