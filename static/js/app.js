// ==========================================================================
// APPLICATION STATE MANAGEMENT
// ==========================================================================
let schoolsData = [];
let statsData = [];
let map = null;
let markers = [];
let markerClusterGroup = null;
let activeTab = 'tabDistricts';
let selectedSchoolId = null;
let selectedDistrictName = null;
let boundaryLayer = null;
let baseTileLayer = null;
let userCoords = null;

// Reference Origin & Proximity States
let originCoords = { lat: 26.5500, lng: 74.9000 }; // Default to Rajasthan center
let originMarker = null;
let activeProximityFilter = null;
let activeMinDistance = 1;
let activeMaxDistance = 300;
let isPinModeActive = false;

// Center coordinates of Rajasthan, India
const RAJASTHAN_CENTER = [26.5500, 74.9000];

// Boundary locks to restrict user viewport entirely to Rajasthan state
const RAJASTHAN_BOUNDS = L.latLngBounds([
    [22.8000, 69.0000], // Southwest coordinate boundary
    [30.4000, 78.5000]  // Northeast coordinate boundary
]);

// Mapping of Rajasthan districts to their respective headquarters (capitals)
const DISTRICT_CAPITALS = {
    'Ajmer': 'Ajmer', 'Alwar': 'Alwar', 'Banswara': 'Banswara', 'Barmer': 'Barmer',
    'Bharatpur': 'Bharatpur', 'Bhilwara': 'Bhilwara', 'Bikaner': 'Bikaner', 'Bundi': 'Bundi',
    'Chittorgarh': 'Chittorgarh', 'Churu': 'Churu', 'Dungarpur': 'Dungarpur', 'Jaipur': 'Jaipur',
    'Jaisalmer': 'Jaisalmer', 'Jalore': 'Jalore', 'Jhunjhunu': 'Jhunjhunu', 'Jhalawar': 'Jhalawar',
    'Jodhpur': 'Jodhpur', 'Kota': 'Kota', 'Nagaur': 'Nagaur', 'Pali': 'Pali',
    'Sawaimadhopur': 'Sawai Madhopur', 'Sikar': 'Sikar', 'Sirohi': 'Sirohi', 'Tonk': 'Tonk',
    'Udaipur': 'Udaipur', 'Dholpur': 'Dholpur', 'Dausa': 'Dausa', 'Baran': 'Baran',
    'Rajsamand': 'Rajsamand', 'Hanumangarh': 'Hanumangarh', 'Karauli': 'Karauli', 'Pratapgarh': 'Pratapgarh',
    'Anupgarh': 'Anupgarh', 'Balotra': 'Balotra', 'Beawar': 'Beawar', 'Didwana': 'Didwana',
    'Kuchaman': 'Kuchaman', 'Deeg': 'Deeg', 'Gangapur': 'Gangapur City', 'Kekri': 'Kekri',
    'Salumbar': 'Salumbar', 'Shahpura': 'Shahpura', 'Khairthal': 'Khairthal', 'Kotputli': 'Kotputli'
};

// Hash district name into a stable distinct color from the color wheel (approx 100+ possibilities)
function getDistrictColor(districtName) {
    let hash = 0;
    for (let i = 0; i < districtName.length; i++) {
        hash = districtName.charCodeAt(i) + ((hash << 5) - hash);
    }
    // Generate distinct hues around the color wheel
    const hue = Math.abs(hash) % 360;
    // Saturation 65% - 85% for vivid, solid governmental colors
    const saturation = 70 + (Math.abs(hash >> 3) % 15);
    // Lightness 35% - 48% to maintain contrast against the dark background
    const lightness = 35 + (Math.abs(hash >> 5) % 13);
    return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

// Styling for districts (Choropleth/Mosaic government mapping style)
function styleDistrictFeature(feature) {
    const districtName = feature.properties.Dist_Name || feature.properties.district || "District";
    const color = getDistrictColor(districtName);
    
    // Check if currently selected
    const isSelected = selectedDistrictName && selectedDistrictName.toLowerCase() === districtName.toLowerCase();
    
    return {
        color: isSelected ? '#00f2fe' : 'rgba(255, 255, 255, 0.25)', // Brighter outlines like a gov GIS map
        weight: isSelected ? 2.5 : 1.2,
        fillColor: color,
        fillOpacity: isSelected ? 0.8 : 0.45
    };
}

// ==========================================================================
// INITIALIZE LEAFLET MAP (RAJASTHAN-ONLY MODE)
// ==========================================================================
window.initMap = function() {
    console.log("Initializing Rajasthan-only Leaflet Map...");
    
    // Create map centered on Rajasthan, locked to bounds
    map = L.map('map', {
        center: RAJASTHAN_CENTER,
        zoom: 8,
        minZoom: 7,                        // Step 1
        maxZoom: 11,                       // Step 5
        zoomSnap: 1,                       // Force integer snap steps
        zoomDelta: 1,                      // Increment step by 1
        maxBounds: RAJASTHAN_BOUNDS,
        maxBoundsViscosity: 1.0,           // Keeps the user locked in Rajasthan
        zoomControl: false,
        attributionControl: true
    });
    
    // Add custom zoom control at bottom-right
    L.control.zoom({
        position: 'bottomright'
    }).addTo(map);
    
    // Define CartoDB Dark Matter Tile Layer (enabled by default, toggleable in header)
    baseTileLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20
    }).addTo(map);
    
    // Initialize Marker Cluster Group
    markerClusterGroup = L.markerClusterGroup({
        showCoverageOnHover: false,
        zoomToBoundsOnClick: true,
        maxClusterRadius: 40
    });
    map.addLayer(markerClusterGroup);

    // Load Rajasthan GeoJSON Boundaries & Bind Interactions
    loadRajasthanBoundaries();

    // Initialize the draggable reference origin marker
    initOriginMarker();

    // Trigger browser Geolocation immediately to center map on load
    getUserLocation();

    // Start data fetch from server APIs
    fetchDashboardData();
};

// Load state outline geojson boundaries with hover highlights and tooltips
async function loadRajasthanBoundaries() {
    try {
        const response = await fetch('/static/data/rajasthan.geojson');
        const geojsonData = await response.json();
        
        // Draw Rajasthan outline and district divisions
        boundaryLayer = L.geoJSON(geojsonData, {
            style: styleDistrictFeature,
            onEachFeature: onEachDistrictFeature
        }).addTo(map);
        
        console.log("Rajasthan GeoJSON boundaries and districts loaded successfully.");
    } catch (e) {
        console.error("Failed to load Rajasthan GeoJSON boundaries:", e);
    }
}

// Bind hover and click interactions to each district shape
function onEachDistrictFeature(feature, layer) {
    const districtName = feature.properties.Dist_Name || feature.properties.district || "District";
    
    // Bind a premium sticky tooltip that tracks the mouse pointer to show the district name on hover
    layer.bindTooltip(`
        <div style="padding: 6px 10px; font-family: 'Outfit', sans-serif; font-size: 11px; font-weight: 600; color: #f8fafc; background: rgba(11, 18, 34, 0.95); border: 1px solid var(--color-primary); border-radius: 4px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5), 0 0 10px rgba(0, 242, 254, 0.3); display: flex; align-items: center; gap: 6px;">
            <i class="fa-solid fa-map-location-dot" style="color: var(--color-primary);"></i>
            <span>${districtName.toUpperCase()}</span>
        </div>
    `, {
        sticky: true,
        direction: 'top',
        className: 'district-hover-tooltip-container'
    });

    // Render a default static text label in the district's center (interactive: false)
    const centroid = layer.getBounds().getCenter();
    const staticLabelIcon = L.divIcon({
        className: 'static-district-label',
        html: `<span>${districtName}</span>`,
        iconSize: [100, 20],
        iconAnchor: [50, 10]
    });
    
    L.marker(centroid, {
        icon: staticLabelIcon,
        interactive: false
    }).addTo(map);
    
    // Map mouse events
    layer.on({
        mouseover: function(e) {
            const lay = e.target;
            lay.setStyle({
                color: '#ffffff',             // Brighter white outline on hover
                weight: 2.2,
                fillOpacity: 0.85
            });
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                lay.bringToFront();
            }
        },
        mouseout: function(e) {
            if (selectedDistrictName && selectedDistrictName.toLowerCase() === districtName.toLowerCase()) {
                // Keep selected style (cyan border, higher opacity)
                e.target.setStyle({
                    color: '#00f2fe',         // Glowing cyan border
                    weight: 2.2,
                    fillOpacity: 0.8
                });
            } else {
                // Reset to default style (unique color, standard opacity)
                boundaryLayer.resetStyle(e.target);
            }
        },
        click: function(e) {
            // Click polygon to select in table list
            const tableRows = document.querySelectorAll('#tableDistricts tbody tr');
            let targetRow = null;
            for (let row of tableRows) {
                const cellText = row.querySelector('.district-cell').innerText.trim();
                if (cellText.toLowerCase() === districtName.toLowerCase()) {
                    targetRow = row;
                    break;
                }
            }
            if (targetRow) {
                switchTab('tabDistricts');
                targetRow.click();
                targetRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    });
}

// Handle Leaflet boot sequence
window.addEventListener('DOMContentLoaded', () => {
    if (typeof L !== 'undefined') {
        window.initMap();
    } else {
        const overlay = document.getElementById('map-loading-overlay');
        if (overlay) {
            overlay.innerHTML = `
                <div class="no-results">
                    <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i>
                    <p>Leaflet.js library failed to load.</p>
                </div>
            `;
        }
    }
    setupDOMEventListeners();
});

// ==========================================================================
// DATA FETCHING & STATE SYNCING
// ==========================================================================
async function fetchDashboardData() {
    try {
        const [schoolsRes, statsRes] = await Promise.all([
            fetch('/api/schools').then(r => r.json()),
            fetch('/api/stats').then(r => r.json())
        ]);
        
        if (schoolsRes.status === 'success' && statsRes.status === 'success') {
            schoolsData = schoolsRes.data;
            statsData = statsRes.data;
            
            // Show status warning banner if mock fallback is running
            if (schoolsRes.source === 'mock_fallback') {
                const banner = document.getElementById('db-status-banner');
                if (banner) banner.classList.remove('hidden');
            }
            
            // Disable skeletons and display active metrics
            disableSkeletonLoaders();
            
            // Update Card values
            document.getElementById('valTotalSchools').innerText = schoolsData.length;
            document.getElementById('valTotalDistricts').innerText = statsData.length;
            
            // Render Tables
            renderDistrictsTable();
            renderSchoolsTable();
            
            // Draw Map coordinates
            drawMapMarkers();
            
            // Calculate initial distance metrics based on resolved origin location
            updateDistanceMetrics();
            
            // Hide loading overlay
            const overlay = document.getElementById('map-loading-overlay');
            if (overlay) {
                overlay.classList.add('hidden');
            }
        } else {
            throw new Error("API responded with error states");
        }
    } catch (e) {
        console.error("Failed to load dashboard statistics:", e);
        showTableErrorMessage();
    }
}

// Fade out skeletons and reveal dashboard panels
function disableSkeletonLoaders() {
    document.querySelectorAll('.skeleton-loader-card').forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.stats-card .card-content').forEach(el => el.classList.remove('hidden'));
}

function showTableErrorMessage() {
    const errorHTML = `
        <tr class="no-results">
            <td colspan="3">
                <i class="fa-solid fa-triangle-exclamation" style="color: var(--color-warning);"></i>
                <p>Failed to connect to backend service.</p>
            </td>
        </tr>
    `;
    document.querySelector('#tableDistricts tbody').innerHTML = errorHTML;
    document.querySelector('#tableSchools tbody').innerHTML = errorHTML;
}

// ==========================================================================
// TABLE RENDERING
// ==========================================================================

// Render District Count Tab
function renderDistrictsTable() {
    const tbody = document.querySelector('#tableDistricts tbody');
    tbody.innerHTML = '';
    
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    const filteredStats = statsData.filter(item => 
        item.district.toLowerCase().includes(query)
    );
    
    if (filteredStats.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="2" class="no-results">
                    <i class="fa-solid fa-magnifying-glass"></i>
                    <p>No districts match search</p>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredStats.forEach((item, index) => {
        const tr = document.createElement('tr');
        if (selectedDistrictName === item.district) {
            tr.classList.add('active-row');
        }
        
        tr.style.animation = `fadeInUp 0.3s ease-out ${index * 0.04}s both`;
        tr.innerHTML = `
            <td class="district-cell">${item.district}</td>
            <td class="text-right">
                <span class="badge-count">${item.count}</span>
            </td>
        `;
        
        tr.addEventListener('click', () => handleDistrictRowClick(item.district, tr));
        tbody.appendChild(tr);
    });
}

// Render Schools Directory Tab (Sorted by Distance if Geolocation or Custom Origin is available)
function renderSchoolsTable() {
    const tbody = document.querySelector('#tableSchools tbody');
    tbody.innerHTML = '';
    
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    let filteredSchools = schoolsData.filter(school => 
        school.name.toLowerCase().includes(query) || 
        school.district.toLowerCase().includes(query)
    );
    
    // Calculate distance of all schools from reference originCoords
    filteredSchools.forEach(school => {
        school.distance = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
    });
    
    // Apply distance range slider filter
    if (activeMinDistance > 1 || activeMaxDistance < 300) {
        filteredSchools = filteredSchools.filter(school => school.distance >= activeMinDistance && school.distance <= activeMaxDistance);
    }
    
    // Apply distance category filtering if selected
    if (activeProximityFilter) {
        filteredSchools = filteredSchools.filter(school => {
            const dist = school.distance;
            if (activeProximityFilter === 'immediate') return dist < 10;
            if (activeProximityFilter === 'near') return dist >= 10 && dist < 25;
            if (activeProximityFilter === 'mid') return dist >= 25 && dist < 50;
            if (activeProximityFilter === 'distant') return dist >= 50 && dist < 100;
            if (activeProximityFilter === 'far') return dist >= 100;
            return true;
        });
    }
    
    // Sort closest first
    filteredSchools.sort((a, b) => a.distance - b.distance);
    
    if (filteredSchools.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="3" class="no-results">
                    <i class="fa-solid fa-school-flag"></i>
                    <p>No schools found in this distance range</p>
                </td>
            </tr>
        `;
        return;
    }
    
    filteredSchools.forEach((school, index) => {
        const tr = document.createElement('tr');
        if (selectedSchoolId === school.id) {
            tr.classList.add('active-row');
        }
        
        // Add distance walking badge relative to the current reference origin
        const distanceBadgeHTML = `<span class="badge-distance"><i class="fa-solid fa-person-walking"></i> ${school.distance.toFixed(1)} km</span>`;
        
        tr.style.animation = `fadeInUp 0.3s ease-out ${Math.min(index * 0.03, 0.8)}s both`;
        tr.innerHTML = `
            <td>
                <span class="school-name-cell">${school.name}</span>
                <span class="school-meta">ID: #${school.id} ${distanceBadgeHTML}</span>
            </td>
            <td class="district-cell">${school.district}</td>
            <td class="coords-cell">${school.latitude.toFixed(4)}, ${school.longitude.toFixed(4)}</td>
        `;
        
        tr.addEventListener('click', () => handleSchoolRowClick(school, tr));
        tbody.appendChild(tr);
    });
}

// ==========================================================================
// MAP MARKERS & CLUSTERING IMPLEMENTATION
// ==========================================================================
function drawMapMarkers() {
    if (!map) return;
    
    markerClusterGroup.clearLayers();
    markers = [];
    
    const query = (document.getElementById('searchInput').value || '').toLowerCase().trim();
    let filteredSchools = schoolsData.filter(school => 
        school.name.toLowerCase().includes(query) || 
        school.district.toLowerCase().includes(query)
    );
    
    // Apply distance range slider filter
    if (activeMinDistance > 1 || activeMaxDistance < 300) {
        filteredSchools = filteredSchools.filter(school => {
            const dist = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
            return dist >= activeMinDistance && dist <= activeMaxDistance;
        });
    }
    
    // Apply distance category filtering if selected
    if (activeProximityFilter) {
        filteredSchools = filteredSchools.filter(school => {
            const dist = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
            if (activeProximityFilter === 'immediate') return dist < 10;
            if (activeProximityFilter === 'near') return dist >= 10 && dist < 25;
            if (activeProximityFilter === 'mid') return dist >= 25 && dist < 50;
            if (activeProximityFilter === 'distant') return dist >= 50 && dist < 100;
            if (activeProximityFilter === 'far') return dist >= 100;
            return true;
        });
    }
    
    filteredSchools.forEach(school => {
        const lat = parseFloat(school.latitude);
        const lng = parseFloat(school.longitude);
        
        if (isNaN(lat) || isNaN(lng)) return;
        
        // Custom HTML pulsing dot marker using L.divIcon
        const customIcon = L.divIcon({
            className: 'leaflet-custom-marker',
            html: `
                <div class="marker-pulse-wrapper" id="marker-wrapper-${school.id}">
                    <div class="marker-pulse-ring"></div>
                    <div class="marker-pulse-dot"></div>
                </div>
            `,
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        const marker = L.marker([lat, lng], { icon: customIcon });
        marker.schoolId = school.id;
        marker.district = school.district;
        
        // Custom styled popup content showing district capital and student/teacher metrics
        const capital = DISTRICT_CAPITALS[school.district] || school.district;
        const totalStudents = 150 + (school.id % 250);
        const totalTeachers = 12 + (school.id % 20);
        const dist = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
        
        const popupContent = `
            <div style="background-color: #0b1222; color: #f8fafc; padding: 12px; font-family: 'Inter', sans-serif; font-size:12px; min-width: 240px;">
                <h4 style="margin: 0 0 8px 0; color: #00f2fe; font-family: 'Outfit', sans-serif; font-size: 14px; font-weight:700; border-bottom:1px solid rgba(255,255,255,0.08); padding-bottom:6px;">${school.name}</h4>
                <p style="margin: 4px 0;"><i class="fa-solid fa-map-location-dot" style="color: #9b51e0; margin-right:6px; width: 14px;"></i><b>District:</b> ${school.district}</p>
                <p style="margin: 4px 0;"><i class="fa-solid fa-hashtag" style="color: #9b51e0; margin-right:6px; width: 14px;"></i><b>Center Code:</b> ${school.center_code || 'N/A'}</p>
                <p style="margin: 4px 0;"><i class="fa-solid fa-landmark" style="color: #9b51e0; margin-right:6px; width: 14px;"></i><b>Capital:</b> ${capital}</p>
                <p style="margin: 4px 0;"><i class="fa-solid fa-users" style="color: #10b981; margin-right:6px; width: 14px;"></i><b>Students:</b> ${totalStudents}</p>
                <p style="margin: 4px 0;"><i class="fa-solid fa-user-tie" style="color: #10b981; margin-right:6px; width: 14px;"></i><b>Teachers:</b> ${totalTeachers}</p>
                <p style="margin: 4px 0;"><i class="fa-solid fa-route" style="color: #10b981; margin-right:6px; width: 14px;"></i><b>Distance:</b> ${dist.toFixed(1)} km</p>
                <p style="margin: 4px 0; font-family: monospace; color: #94a3b8;"><i class="fa-solid fa-location-crosshairs" style="margin-right:6px; width: 14px;"></i><b>Coords:</b> ${school.latitude.toFixed(5)}, ${school.longitude.toFixed(5)}</p>
            </div>
        `;
        marker.bindPopup(popupContent);
        
        marker.on('click', () => {
            selectSchoolInSidebar(school);
            highlightMarkerNode(school.id);
        });
        
        markers.push(marker);
        markerClusterGroup.addLayer(marker);
    });
    
    console.log(`Rendered ${markers.length} markers to ClusterGroup.`);
}

// Highlight selected pulsing dot marker (turns purple neon)
function highlightMarkerNode(schoolId) {
    document.querySelectorAll('.marker-pulse-wrapper').forEach(el => {
        el.classList.remove('active-marker');
    });
    const wrapper = document.getElementById(`marker-wrapper-${schoolId}`);
    if (wrapper) {
        wrapper.classList.add('active-marker');
    }
}

// ==========================================================================
// INTERACTIVE FILTERING & PANNING
// ==========================================================================

// Click on a District row in the right table panel
function handleDistrictRowClick(districtName, rowElement) {
    document.querySelectorAll('#tableDistricts tbody tr').forEach(r => r.classList.remove('active-row'));
    
    // Clear styles on geojson layers
    if (boundaryLayer) {
        boundaryLayer.eachLayer(layer => {
            boundaryLayer.resetStyle(layer);
        });
    }
    
    if (selectedDistrictName === districtName) {
        // Toggle off: Zoom back out to state overview
        selectedDistrictName = null;
        if (map) {
            map.setView(RAJASTHAN_CENTER, 8);
        }
    } else {
        // Toggle on: Focus on district boundaries
        selectedDistrictName = districtName;
        rowElement.classList.add('active-row');
        
        // Highlight corresponding district polygon on the map
        if (boundaryLayer) {
            boundaryLayer.eachLayer(layer => {
                const layerDist = layer.feature.properties.Dist_Name || layer.feature.properties.district;
                if (layerDist && layerDist.toLowerCase() === districtName.toLowerCase()) {
                    layer.setStyle({
                        color: '#00f2fe',     // Selected glowing cyan border
                        weight: 2.5,
                        fillOpacity: 0.8
                    });
                }
            });
        }
        
        // Fit map bounds around district coordinates
        const districtMarkers = markers.filter(m => m.district === districtName);
        if (districtMarkers.length > 0 && map) {
            const group = new L.featureGroup(districtMarkers);
            map.fitBounds(group.getBounds(), {
                padding: [50, 50]
            });
            
            if (map.getZoom() > 11) {
                map.setZoom(11);
            }
        }
    }
}

// Update the focus profile card at the top of the schools list
function updateSchoolDetailCard(school) {
    const card = document.getElementById('school-detail-card');
    if (!card) return;
    
    if (!school) {
        card.classList.add('hidden');
        return;
    }
    
    const capital = DISTRICT_CAPITALS[school.district] || school.district;
    const totalStudents = 150 + (school.id % 250);
    const totalTeachers = 12 + (school.id % 20);
    
    document.getElementById('detailSchoolName').innerText = school.name;
    document.getElementById('detailDistrict').innerText = school.district;
    document.getElementById('detailCenterCode').innerText = school.center_code || 'N/A';
    document.getElementById('detailCapital').innerText = capital;
    document.getElementById('detailStudents').innerText = totalStudents;
    document.getElementById('detailTeachers').innerText = totalTeachers;
    document.getElementById('detailCoords').innerText = `${school.latitude.toFixed(5)}, ${school.longitude.toFixed(5)}`;
    
    // Render and show distance element from current reference origin
    const distanceItem = document.getElementById('detailDistanceItem');
    const distanceVal = document.getElementById('detailDistance');
    if (distanceItem && distanceVal) {
        const dist = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
        distanceVal.innerText = `${dist.toFixed(1)} km`;
        distanceItem.style.display = 'flex';
    }
    
    card.classList.remove('hidden');
}

// Click on a School row in the right table panel
function handleSchoolRowClick(school, rowElement) {
    document.querySelectorAll('#tableSchools tbody tr').forEach(r => r.classList.remove('active-row'));
    
    selectedSchoolId = school.id;
    rowElement.classList.add('active-row');
    
    // Update sidebar profile card
    updateSchoolDetailCard(school);
    
    // Zoom and pan to marker
    const targetMarker = markers.find(m => m.schoolId === school.id);
    if (targetMarker && map) {
        markerClusterGroup.zoomToShowLayer(targetMarker, () => {
            targetMarker.openPopup();
            highlightMarkerNode(school.id);
        });
        map.setView([school.latitude, school.longitude], 13);
    }
}

// Select a school in the directory table list when clicking its map marker
function selectSchoolInSidebar(school) {
    selectedSchoolId = school.id;
    switchTab('tabSchools');
    renderSchoolsTable();
    
    // Update sidebar profile card
    updateSchoolDetailCard(school);
    
    setTimeout(() => {
        const rows = document.querySelectorAll('#tableSchools tbody tr');
        for (let row of rows) {
            if (row.classList.contains('active-row')) {
                row.scrollIntoView({ behavior: 'smooth', block: 'center' });
                break;
            }
        }
    }, 100);
}

// ==========================================================================
// GEOLOCATION & GEOSPATIAL DISTANCE (HAVERSINE & ORIGIN SELECTION)
// ==========================================================================

// Calculate distance in kilometers between two lat/long points using Haversine formula
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// Initialize the Reference Origin marker on the Leaflet map (student avatar icon)
function initOriginMarker() {
    if (!map) return;
    
    const originIcon = L.divIcon({
        className: 'student-avatar-leaflet-marker',
        html: `
            <div class="student-origin-avatar-pin">
                <div class="student-avatar-frame">
                    <i class="fa-solid fa-user-graduate"></i>
                </div>
                <div class="student-avatar-pulse"></div>
            </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 16]
    });
    
    originMarker = L.marker([originCoords.lat, originCoords.lng], {
        draggable: true,
        icon: originIcon
    }).addTo(map);
    
    originMarker.bindPopup(`
        <div style="background-color: #0b1222; color: #f8fafc; padding: 10px; font-family: 'Inter', sans-serif; font-size:11px; min-width: 160px; text-align: center;">
            <h4 style="margin: 0; color: var(--color-primary); font-family: 'Outfit', sans-serif; font-size: 12px; font-weight:700;"><i class="fa-solid fa-user-graduate"></i> Student Location</h4>
            <p style="margin: 4px 0 0 0; color: #94a3b8; font-size: 10px;">Drag this student to recalculate distances!</p>
        </div>
    `);
    
    // Listen for drag coordinates change
    originMarker.on('dragend', function(event) {
        const marker = event.target;
        const pos = marker.getLatLng();
        originCoords = { lat: pos.lat, lng: pos.lng };
        
        checkAndAdjustMapBounds(pos.lat, pos.lng);
        
        // Resolve colony/area detail in real-time
        reverseGeocodeCoords(pos.lat, pos.lng);
        
        updateDistanceMetrics();
    });
}

// Check if location is outside Rajasthan bounds, and if so, dynamically disable map bounds lock
function checkAndAdjustMapBounds(lat, lng) {
    if (!map) return;
    const pos = L.latLng(lat, lng);
    if (RAJASTHAN_BOUNDS.contains(pos)) {
        map.setMaxBounds(RAJASTHAN_BOUNDS);
    } else {
        map.setMaxBounds(null);
    }
}

// Reverse geocode lat/lng coordinates to friendly human addresses (colony, road, landmark, city)
async function reverseGeocodeCoords(lat, lng) {
    const statusLabel = document.getElementById('lblOriginStatus');
    if (statusLabel) statusLabel.innerText = "Resolving address...";
    
    const spinner = document.getElementById('searchSpinner');
    if (spinner) spinner.classList.remove('hidden');
    
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.address) {
            const addr = data.address;
            // Build a friendly name showing colony, road, or city
            const colony = addr.suburb || addr.neighbourhood || addr.residential || addr.colony || '';
            const road = addr.road || '';
            const city = addr.city || addr.town || addr.village || addr.district || '';
            
            let displayName = '';
            if (colony && road) {
                displayName = `${colony}, ${road}`;
            } else if (colony) {
                displayName = colony;
            } else if (road) {
                displayName = road;
            } else {
                displayName = city || "Selected Point";
            }
            
            if (city && !displayName.includes(city)) {
                displayName += `, ${city}`;
            }
            
            statusLabel.innerText = `Origin: ${displayName}`;
            
            // Also update the marker's popup dynamically with the colony/landmark
            if (originMarker) {
                originMarker.getPopup().setContent(`
                    <div style="background-color: #0b1222; color: #f8fafc; padding: 10px; font-family: 'Inter', sans-serif; font-size:11px; min-width: 180px; text-align: center;">
                        <h4 style="margin: 0; color: var(--color-primary); font-family: 'Outfit', sans-serif; font-size: 12px; font-weight:700;"><i class="fa-solid fa-user-graduate"></i> Student Location</h4>
                        <p style="margin: 6px 0; color: #38bdf8; font-weight: 600; font-size: 11px;">${displayName}</p>
                        <p style="margin: 0; color: #94a3b8; font-size: 9px; line-height: 1.3;">(${lat.toFixed(4)}, ${lng.toFixed(4)})</p>
                        <p style="margin: 4px 0 0 0; color: var(--text-muted); font-size: 9px;">Drag to recalculate proximity!</p>
                    </div>
                `);
                
                if (originMarker.isPopupOpen()) {
                    originMarker.closePopup().openPopup();
                }
            }
        } else {
            statusLabel.innerText = `Origin: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        }
    } catch (e) {
        console.error("Reverse geocoding failed:", e);
        statusLabel.innerText = `Origin: ${lat.toFixed(4)}, ${lng.toFixed(4)}`;
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}

// Request browser location and snap reference origin to it
function getUserLocation() {
    if (navigator.geolocation) {
        console.log("Requesting browser Geolocation...");
        document.getElementById('lblOriginStatus').innerText = "Acquiring GPS location...";
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userCoords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                originCoords = userCoords;
                
                checkAndAdjustMapBounds(originCoords.lat, originCoords.lng);
                
                // Move origin marker and pan map
                if (originMarker) {
                    originMarker.setLatLng([originCoords.lat, originCoords.lng]);
                }
                if (map) {
                    map.setView([originCoords.lat, originCoords.lng], 8);
                }
                
                // Resolve colony/area detail in real-time
                reverseGeocodeCoords(originCoords.lat, originCoords.lng);
                
                updateDistanceMetrics();
            },
            (error) => {
                console.warn("Geolocation permission denied/failed:", error.message);
                // Attempt IP-based Geolocation Fallback for non-HTTPS local IP access
                fallbackToIPGeolocation();
            },
            { enableHighAccuracy: true, timeout: 6000 }
        );
    } else {
        console.warn("Geolocation is not supported by this browser/context.");
        fallbackToIPGeolocation();
    }
}

// Fallback to IP-based Geolocation when standard GPS is blocked on non-secure local IP (HTTP)
async function fallbackToIPGeolocation() {
    const statusLabel = document.getElementById('lblOriginStatus');
    if (statusLabel) statusLabel.innerText = "GPS blocked. Locating via IP...";
    
    try {
        const res = await fetch('https://ipapi.co/json/');
        const data = await res.json();
        
        if (data && data.latitude && data.longitude) {
            originCoords = {
                lat: parseFloat(data.latitude),
                lng: parseFloat(data.longitude)
            };
            
            checkAndAdjustMapBounds(originCoords.lat, originCoords.lng);
            
            if (originMarker) {
                originMarker.setLatLng([originCoords.lat, originCoords.lng]);
            }
            if (map) {
                map.setView([originCoords.lat, originCoords.lng], 8);
            }
            
            // Resolve colony/area detail via reverse geocode
            reverseGeocodeCoords(originCoords.lat, originCoords.lng);
            console.log(`IP Geolocation successful: (${originCoords.lat}, ${originCoords.lng})`);
            updateDistanceMetrics();
        } else {
            throw new Error("No coordinate data returned");
        }
    } catch (e) {
        console.warn("IP Geolocation fallback failed:", e);
        if (statusLabel) statusLabel.innerText = "GPS Access Denied";
    }
}

// Fetch address suggestions from OpenStreetMap Nominatim API dynamically as the user types
let autocompleteDebounceTimer = null;
async function fetchAddressSuggestions(query) {
    const suggestionsUl = document.getElementById('originSuggestions');
    if (!suggestionsUl) return;
    
    if (!query || query.trim().length < 3) {
        suggestionsUl.innerHTML = '';
        suggestionsUl.classList.add('hidden');
        return;
    }
    
    const spinner = document.getElementById('searchSpinner');
    if (spinner) spinner.classList.remove('hidden');
    
    // Append context to target Rajasthan, India
    const fullQuery = `${query.trim()}, Rajasthan, India`;
    // Bounded search box roughly containing Rajasthan coordinates
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=5&viewbox=69.0,30.4,78.5,22.8&bounded=1`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        suggestionsUl.innerHTML = '';
        if (data && data.length > 0) {
            data.forEach(item => {
                const li = document.createElement('li');
                // Truncate display name for the small dropdown width
                let shortName = item.display_name;
                const parts = item.display_name.split(',');
                if (parts.length > 2) {
                    shortName = `${parts[0].trim()}, ${parts[1].trim()}`;
                }
                
                li.innerText = shortName;
                li.title = item.display_name;
                
                li.addEventListener('click', () => {
                    document.getElementById('originSearchInput').value = shortName;
                    originCoords = {
                        lat: parseFloat(item.lat),
                        lng: parseFloat(item.lon)
                    };
                    
                    // Move marker and pan map
                    if (originMarker) {
                        originMarker.setLatLng([originCoords.lat, originCoords.lng]);
                    }
                    if (map) {
                        map.setView([originCoords.lat, originCoords.lng], 9);
                    }
                    
                    document.getElementById('lblOriginStatus').innerText = `Origin: ${parts[0].trim()}`;
                    updateDistanceMetrics();
                    
                    // Clear suggestions
                    suggestionsUl.innerHTML = '';
                    suggestionsUl.classList.add('hidden');
                });
                suggestionsUl.appendChild(li);
            });
            suggestionsUl.classList.remove('hidden');
        } else {
            suggestionsUl.classList.add('hidden');
        }
    } catch (e) {
        console.error("Failed to fetch address suggestions:", e);
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}

// Geocode custom addresses/districts entered by the user
async function geocodeAddressOrigin(addressQuery) {
    if (!addressQuery || addressQuery.trim() === '') return;
    
    const statusLabel = document.getElementById('lblOriginStatus');
    statusLabel.innerText = "Searching coordinates...";
    
    const spinner = document.getElementById('searchSpinner');
    if (spinner) spinner.classList.remove('hidden');
    
    // Append 'Rajasthan, India' to query to ensure local search context
    const fullQuery = `${addressQuery.trim()}, Rajasthan, India`;
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(fullQuery)}&limit=1`;
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data && data.length > 0) {
            const result = data[0];
            originCoords = {
                lat: parseFloat(result.lat),
                lng: parseFloat(result.lon)
            };
            
            // Move marker and pan map
            if (originMarker) {
                originMarker.setLatLng([originCoords.lat, originCoords.lng]);
            }
            if (map) {
                map.setView([originCoords.lat, originCoords.lng], 9);
            }
            
            // Display truncated address name
            let displayName = result.display_name.split(',')[0];
            statusLabel.innerText = `Origin: ${displayName}`;
            
            updateDistanceMetrics();
        } else {
            statusLabel.innerText = "Location not found in Rajasthan";
        }
    } catch (e) {
        console.error("Geocoding failed:", e);
        statusLabel.innerText = "Search service error";
    } finally {
        if (spinner) spinner.classList.add('hidden');
    }
}

// Recalculate school distances and update the left Proximity filter counts
function updateDistanceMetrics() {
    let immediate = 0, near = 0, mid = 0, distant = 0, far = 0;
    
    schoolsData.forEach(school => {
        const dist = calculateDistance(originCoords.lat, originCoords.lng, school.latitude, school.longitude);
        school.distance = dist;
        
        if (dist < 10) immediate++;
        else if (dist >= 10 && dist < 25) near++;
        else if (dist >= 25 && dist < 50) mid++;
        else if (dist >= 50 && dist < 100) distant++;
        else far++;
    });
    
    // Update count labels in Left Panel
    document.getElementById('countImmediate').innerText = immediate;
    document.getElementById('countNear').innerText = near;
    document.getElementById('countMid').innerText = mid;
    document.getElementById('countDistant').innerText = distant;
    document.getElementById('countFar').innerText = far;
    
    // Re-render schools table list and map clusters
    renderSchoolsTable();
    drawMapMarkers();
    
    // If a school details card is active, update its distance readout too
    if (selectedSchoolId) {
        const activeSchool = schoolsData.find(s => s.id === selectedSchoolId);
        if (activeSchool) updateSchoolDetailCard(activeSchool);
    }
}

// Tab Switching utility
function switchTab(tabId) {
    activeTab = tabId;
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        if (btn.getAttribute('data-tab') === tabId) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });
    
    document.querySelectorAll('.tab-pane').forEach(pane => {
        if (pane.id === tabId) {
            pane.classList.add('active');
        } else {
            pane.classList.remove('active');
        }
    });
}

// ==========================================================================
// DOM EVENT LISTENERS
// ==========================================================================
function setupDOMEventListeners() {
    // Toggle Base Map Layer
    const toggleBaseMap = document.getElementById('toggleBaseMap');
    if (toggleBaseMap) {
        toggleBaseMap.addEventListener('change', (e) => {
            if (e.target.checked) {
                if (baseTileLayer) {
                    baseTileLayer.addTo(map);
                    if (boundaryLayer) {
                        boundaryLayer.bringToFront();
                    }
                }
            } else {
                if (baseTileLayer && map.hasLayer(baseTileLayer)) {
                    map.removeLayer(baseTileLayer);
                }
            }
        });
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            renderDistrictsTable();
            renderSchoolsTable();
            drawMapMarkers();
        });
    }

    // Geocode Search Origin Trigger (Autocomplete & Search)
    const btnGeocode = document.getElementById('btnOriginGeocode');
    const originInput = document.getElementById('originSearchInput');
    const suggestionsUl = document.getElementById('originSuggestions');
    
    if (originInput) {
        originInput.addEventListener('input', (e) => {
            clearTimeout(autocompleteDebounceTimer);
            const query = e.target.value;
            autocompleteDebounceTimer = setTimeout(() => {
                fetchAddressSuggestions(query);
            }, 300);
        });
        
        originInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                // Clear suggestions dropdown on enter search
                if (suggestionsUl) suggestionsUl.classList.add('hidden');
                geocodeAddressOrigin(originInput.value);
            }
        });
    }
    
    if (btnGeocode && originInput) {
        btnGeocode.addEventListener('click', () => {
            if (suggestionsUl) suggestionsUl.classList.add('hidden');
            geocodeAddressOrigin(originInput.value);
        });
    }
    
    // Hide suggestions dropdown if clicking elsewhere
    document.addEventListener('click', (e) => {
        if (suggestionsUl && !suggestionsUl.contains(e.target) && e.target !== originInput) {
            suggestionsUl.classList.add('hidden');
        }
    });

    // Geolocation Origin Trigger
    const btnGPS = document.getElementById('btnUseGPS');
    if (btnGPS) {
        btnGPS.addEventListener('click', () => {
            getUserLocation();
        });
    }

    // Click Map to Pin Origin Trigger
    const btnPin = document.getElementById('btnPinOrigin');
    if (btnPin) {
        btnPin.addEventListener('click', () => {
            isPinModeActive = !isPinModeActive;
            if (isPinModeActive) {
                btnPin.classList.add('active-pin');
                const mapDiv = document.getElementById('map');
                if (mapDiv) mapDiv.style.cursor = 'crosshair';
            } else {
                btnPin.classList.remove('active-pin');
                const mapDiv = document.getElementById('map');
                if (mapDiv) mapDiv.style.cursor = '';
            }
        });
    }

    // Map click handler for custom origin pinning
    if (map) {
        map.on('click', (e) => {
            if (isPinModeActive) {
                originCoords = { lat: e.latlng.lat, lng: e.latlng.lng };
                if (originMarker) {
                    originMarker.setLatLng(e.latlng);
                }
                
                // Resolve colony/area detail in real-time
                reverseGeocodeCoords(e.latlng.lat, e.latlng.lng);
                
                // Reset pin mode state
                isPinModeActive = false;
                if (btnPin) btnPin.classList.remove('active-pin');
                const mapDiv = document.getElementById('map');
                if (mapDiv) mapDiv.style.cursor = '';
                
                updateDistanceMetrics();
            }
        });
    }

    // Distance Range Slider (Dual) Listener
    const minSlider = document.getElementById('distanceMinSlider');
    const maxSlider = document.getElementById('distanceMaxSlider');
    const sliderFill = document.getElementById('sliderRangeFill');
    const lblSliderValue = document.getElementById('lblSliderValue');
    
    // Proximity Category Filters
    const categoryItems = document.querySelectorAll('.category-item');
    const divResetFilter = document.getElementById('divResetFilter');

    function updateSliderFill() {
        if (!minSlider || !maxSlider || !sliderFill) return;
        const minVal = parseInt(minSlider.value);
        const maxVal = parseInt(maxSlider.value);
        
        const percent1 = ((minVal - 1) / (300 - 1)) * 100;
        const percent2 = ((maxVal - 1) / (300 - 1)) * 100;
        
        sliderFill.style.left = percent1 + "%";
        sliderFill.style.right = (100 - percent2) + "%";
    }

    function handleRangeSliderInput(isMin) {
        if (!minSlider || !maxSlider || !lblSliderValue) return;
        
        let minVal = parseInt(minSlider.value);
        let maxVal = parseInt(maxSlider.value);
        
        if (minVal > maxVal) {
            if (isMin) {
                minSlider.value = maxVal;
                minVal = maxVal;
            } else {
                maxSlider.value = minVal;
                maxVal = minVal;
            }
        }
        
        activeMinDistance = minVal;
        activeMaxDistance = maxVal;
        
        if (minVal === 1 && maxVal === 300) {
            lblSliderValue.innerText = "1 km - 300 km";
        } else {
            lblSliderValue.innerText = `${minVal} km - ${maxVal} km`;
        }
        
        updateSliderFill();
        
        // Deactivate category brackets to avoid conflicting filters
        activeProximityFilter = null;
        categoryItems.forEach(i => i.classList.remove('active'));
        
        if (divResetFilter) {
            if (minVal > 1 || maxVal < 300) {
                divResetFilter.classList.remove('hidden');
            } else {
                divResetFilter.classList.add('hidden');
            }
        }
        
        renderSchoolsTable();
        drawMapMarkers();
    }

    if (minSlider && maxSlider) {
        minSlider.addEventListener('input', () => handleRangeSliderInput(true));
        maxSlider.addEventListener('input', () => handleRangeSliderInput(false));
        // Initial visual sync
        updateSliderFill();
    }
    
    categoryItems.forEach(item => {
        item.addEventListener('click', () => {
            const range = item.getAttribute('data-range');
            
            // Reset range slider value to maximum (1-300 km) when filtering by bracket categories
            if (minSlider && maxSlider && lblSliderValue) {
                minSlider.value = 1;
                maxSlider.value = 300;
                activeMinDistance = 1;
                activeMaxDistance = 300;
                lblSliderValue.innerText = "1 km - 300 km";
                updateSliderFill();
            }
            
            if (item.classList.contains('active')) {
                // Toggle off
                item.classList.remove('active');
                activeProximityFilter = null;
                if (divResetFilter) divResetFilter.classList.add('hidden');
            } else {
                // Toggle on
                categoryItems.forEach(i => i.classList.remove('active'));
                item.classList.add('active');
                activeProximityFilter = range;
                if (divResetFilter) divResetFilter.classList.remove('hidden');
            }
            
            // Re-draw directory lists and map clusters
            renderSchoolsTable();
            drawMapMarkers();
        });
    });

    // Reset Proximity Filters
    const btnResetProximityFilter = document.getElementById('btnResetProximityFilter');
    if (btnResetProximityFilter) {
        btnResetProximityFilter.addEventListener('click', () => {
            categoryItems.forEach(i => i.classList.remove('active'));
            activeProximityFilter = null;
            if (divResetFilter) divResetFilter.classList.add('hidden');
            
            // Also reset range slider to maximum
            if (minSlider && maxSlider && lblSliderValue) {
                minSlider.value = 1;
                maxSlider.value = 300;
                activeMinDistance = 1;
                activeMaxDistance = 300;
                lblSliderValue.innerText = "1 km - 300 km";
                updateSliderFill();
            }
            
            renderSchoolsTable();
            drawMapMarkers();
        });
    }

    // Detail Profile Card Close Button
    const detailCardCloseBtn = document.getElementById('detailCardCloseBtn');
    if (detailCardCloseBtn) {
        detailCardCloseBtn.addEventListener('click', () => {
            const card = document.getElementById('school-detail-card');
            if (card) card.classList.add('hidden');
            document.querySelectorAll('#tableSchools tbody tr').forEach(r => r.classList.remove('active-row'));
            selectedSchoolId = null;
        });
    }
    
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.getAttribute('data-tab');
            switchTab(targetTab);
        });
    });
    
    const modal = document.getElementById('aboutModal');
    const btnAboutUs = document.getElementById('btnAboutUs');
    const closeBtn = document.getElementById('modalCloseBtn');
    const closeOkBtn = document.getElementById('modalCloseOkBtn');
    
    if (btnAboutUs && modal) {
        btnAboutUs.addEventListener('click', () => {
            modal.classList.add('open');
        });
    }
    
    const closeModal = () => {
        if (modal) modal.classList.remove('open');
    };
    
    if (closeBtn) closeBtn.addEventListener('click', closeModal);
    if (closeOkBtn) closeOkBtn.addEventListener('click', closeModal);
    
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeModal();
            }
        });
    }

    // Upcoming Features Modal Trigger
    const upcomingModal = document.getElementById('upcomingModal');
    const btnUpcoming = document.getElementById('btnUpcomingFeatures');
    const upcomingClose = document.getElementById('upcomingModalCloseBtn');
    const upcomingCloseOk = document.getElementById('upcomingModalCloseOkBtn');
    
    if (btnUpcoming && upcomingModal) {
        btnUpcoming.addEventListener('click', () => {
            upcomingModal.classList.add('open');
        });
    }
    
    const closeUpcoming = () => {
        if (upcomingModal) upcomingModal.classList.remove('open');
    };
    
    if (upcomingClose) upcomingClose.addEventListener('click', closeUpcoming);
    if (upcomingCloseOk) upcomingCloseOk.addEventListener('click', closeUpcoming);
    
    if (upcomingModal) {
        upcomingModal.addEventListener('click', (e) => {
            if (e.target === upcomingModal) {
                closeUpcoming();
            }
        });
    }

    // Language Tab Switching within Upcoming Features Modal
    const langBtns = document.querySelectorAll('.modal-tab-btn');
    langBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            langBtns.forEach(b => {
                b.classList.remove('active');
                b.style.color = 'var(--text-muted)';
                b.style.background = 'none';
            });
            btn.classList.add('active');
            btn.style.color = 'var(--text-primary)';
            btn.style.background = 'rgba(255,255,255,0.06)';
            
            const lang = btn.getAttribute('data-lang');
            const enPane = document.getElementById('lang-en');
            const hiPane = document.getElementById('lang-hi');
            if (lang === 'en') {
                if (enPane) enPane.style.display = 'block';
                if (hiPane) hiPane.style.display = 'none';
            } else {
                if (enPane) enPane.style.display = 'none';
                if (hiPane) hiPane.style.display = 'block';
            }
        });
    });

    // Font Resizing Accessibility Logic (scales globally by overriding specific CSS font sizes)
    let fontScale = 1.0;
    
    function updateGlobalFontScale() {
        let styleNode = document.getElementById('global-font-scale-style');
        if (!styleNode) {
            styleNode = document.createElement('style');
            styleNode.id = 'global-font-scale-style';
            document.head.appendChild(styleNode);
        }
        styleNode.innerHTML = `
            body { font-size: ${14 * fontScale}px !important; }
            .logo-text h1 { font-size: ${18 * fontScale}px !important; }
            .logo-text span { font-size: ${11 * fontScale}px !important; }
            .btn { font-size: ${13 * fontScale}px !important; }
            .card-title { font-size: ${13 * fontScale}px !important; }
            .sidebar-section h3 { font-size: ${14 * fontScale}px !important; }
            .data-table th { font-size: ${11 * fontScale}px !important; }
            .data-table td { font-size: ${12 * fontScale}px !important; }
            .range-lbl { font-size: ${11 * fontScale}px !important; }
            .lblOriginStatus { font-size: ${11 * fontScale}px !important; }
            #originSearchInput { font-size: ${12 * fontScale}px !important; }
            #searchInput { font-size: ${13 * fontScale}px !important; }
            .badge-count-dark { font-size: ${10 * fontScale}px !important; }
            .tab-btn { font-size: ${12 * fontScale}px !important; }
        `;
    }
    
    const btnDec = document.getElementById('btnFontDec');
    const btnInc = document.getElementById('btnFontInc');
    const btnReset = document.getElementById('btnFontReset');
    
    if (btnDec && btnInc) {
        btnDec.addEventListener('click', () => {
            if (fontScale > 0.8) {
                fontScale -= 0.05;
                updateGlobalFontScale();
            }
        });
        btnInc.addEventListener('click', () => {
            if (fontScale < 1.3) {
                fontScale += 0.05;
                updateGlobalFontScale();
            }
        });
    }
    
    if (btnReset) {
        btnReset.addEventListener('click', () => {
            fontScale = 1.0;
            const styleNode = document.getElementById('global-font-scale-style');
            if (styleNode) {
                styleNode.remove();
            }
        });
    }

    // Toggle Left Map Overlay Panel
    const btnToggleOverlay = document.getElementById('btnToggleLeftOverlay');
    if (btnToggleOverlay) {
        btnToggleOverlay.addEventListener('click', () => {
            const overlay = document.querySelector('.map-left-overlay');
            if (overlay) {
                overlay.classList.toggle('hidden');
                const isHidden = overlay.classList.contains('hidden');
                btnToggleOverlay.innerHTML = isHidden ? 
                    `<i class="fa-solid fa-eye"></i> Map Overlay` : 
                    `<i class="fa-solid fa-eye-slash"></i> Map Overlay`;
                
                btnToggleOverlay.classList.toggle('btn-secondary', !isHidden);
                btnToggleOverlay.classList.toggle('btn-primary', isHidden);
            }
        });
    }

    // Toggle Right Details Sidebar Panel
    const btnToggleSidebar = document.getElementById('btnToggleSidebar');
    if (btnToggleSidebar) {
        btnToggleSidebar.addEventListener('click', () => {
            const sidebar = document.querySelector('.sidebar-section');
            if (sidebar) {
                sidebar.classList.toggle('collapsed');
                const isHidden = sidebar.classList.contains('collapsed');
                btnToggleSidebar.innerHTML = isHidden ? 
                    `<i class="fa-solid fa-eye"></i> Sidebar` : 
                    `<i class="fa-solid fa-eye-slash"></i> Sidebar`;
                
                btnToggleSidebar.classList.toggle('btn-secondary', !isHidden);
                btnToggleSidebar.classList.toggle('btn-primary', isHidden);
                
                // Trigger map redraw after CSS width transition is complete (300ms)
                setTimeout(() => {
                    if (map) map.invalidateSize();
                }, 320);
            }
        });
    }

    // Card Header Collapsing Accordions
    document.querySelectorAll('.collapsible-header').forEach(header => {
        header.addEventListener('click', () => {
            const card = header.closest('.collapsible-card');
            if (card) {
                card.classList.toggle('collapsed');
                const chevron = header.querySelector('.collapse-chevron');
                if (chevron) {
                    if (card.classList.contains('collapsed')) {
                        chevron.classList.replace('fa-chevron-up', 'fa-chevron-down');
                    } else {
                        chevron.classList.replace('fa-chevron-down', 'fa-chevron-up');
                    }
                }
            }
        });
    });

    // Collapse overlay cards by default on mobile devices to prevent covering the map on load
    if (window.innerWidth <= 768) {
        const originCard = document.getElementById('cardOrigin');
        const filterCard = document.getElementById('cardFilterDistance');
        if (originCard) originCard.classList.add('collapsed');
        if (filterCard) filterCard.classList.add('collapsed');
        
        // Update chevrons
        document.querySelectorAll('.collapsible-card.collapsed').forEach(card => {
            const chevron = card.querySelector('.collapse-chevron');
            if (chevron) {
                chevron.classList.replace('fa-chevron-up', 'fa-chevron-down');
            }
        });
    }
}
// ==========================================================================
// END OF FILE
// ==========================================================================
