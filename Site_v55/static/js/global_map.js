/**
 * Global Map - Mapa de Distribuição Global de Mamíferos Extintos
 * Versão V44 - Interface SIGNIFICATIVAMENTE melhorada
 */

class GlobalMap {
    constructor() {
        this.map = null;
        this.markerClusterGroup = null;
        this.markers = [];
        this.data = null;
    }

    async init() {
        try {
            await this.loadData();
            this.createMap();
            this.addMarkersWithClustering();
            this.updateStatistics();
            this.showMap();
        } catch (error) {
            console.error('Error initializing global map:', error);
            this.showError();
        }
    }

    async loadData() {
        const response = await fetch('/global-map-data/');
        const data = await response.json();
        
        if (!data.success) {
            throw new Error('Failed to load map data');
        }
        
        this.data = data;
    }

    createMap() {
        this.map = L.map('global-map', {
            center: [20, 0],
            zoom: 2,
            minZoom: 2,
            maxZoom: 12,
            worldCopyJump: true,
            zoomControl: true
        });

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
            maxZoom: 19
        }).addTo(this.map);
    }

    addMarkersWithClustering() {
        if (!this.data || !this.data.locations) return;

        const maxConcentration = this.data.statistics.max_concentration;

        this.markerClusterGroup = L.markerClusterGroup({
            iconCreateFunction: (cluster) => {
                const markers = cluster.getAllChildMarkers();
                let totalSpecies = 0;
                markers.forEach(m => totalSpecies += m.options.speciesCount || 1);
                
                const color = this.getHeatmapColor(totalSpecies, maxConcentration);
                const size = this.getClusterSize(totalSpecies, maxConcentration);
                
                return L.divIcon({
                    html: `<div class="custom-cluster-icon" style="background: linear-gradient(135deg, ${color} 0%, ${this.darkenColor(color, 0.2)} 100%); width: ${size}px; height: ${size}px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; font-weight: bold; font-size: ${Math.max(16, size/3)}px; border: 4px solid rgba(255,255,255,0.95); box-shadow: 0 4px 15px rgba(0,0,0,0.4); cursor: pointer; transition: transform 0.2s;"><span>${totalSpecies}</span></div>`,
                    className: 'marker-cluster-custom',
                    iconSize: L.point(size, size)
                });
            },
            showCoverageOnHover: true,
            zoomToBoundsOnClick: false,
            maxClusterRadius: 80,
            disableClusteringAtZoom: 9,
            spiderfyOnMaxZoom: true,
            animate: true,
            animateAddingMarkers: true
        });
        
        this.markerClusterGroup.on('clusterclick', (e) => {
            const markers = e.layer.getAllChildMarkers();
            const allSpecies = [];
            markers.forEach(m => {
                if (m.options.speciesData) allSpecies.push(...m.options.speciesData);
            });
            
            const uniqueSpecies = [];
            const seenIds = new Set();
            allSpecies.forEach(sp => {
                if (!seenIds.has(sp.id)) {
                    seenIds.add(sp.id);
                    uniqueSpecies.push(sp);
                }
            });
            
            L.popup({
                maxWidth: 500,
                maxHeight: 450,
                className: 'species-popup-container',
                closeButton: true
            })
            .setLatLng(e.layer.getLatLng())
            .setContent(this.createClusterPopupContent(uniqueSpecies))
            .openOn(this.map);
        });

        this.data.locations.forEach(location => {
            const marker = this.createMarker(location, maxConcentration);
            this.markerClusterGroup.addLayer(marker);
            this.markers.push(marker);
        });

        this.map.addLayer(this.markerClusterGroup);
    }

    createMarker(location, maxConcentration) {
        const { lat, lon, count, species } = location;
        const color = this.getHeatmapColor(count, maxConcentration);
        const radius = this.getMarkerRadius(count, maxConcentration);

        const circle = L.circleMarker([lat, lon], {
            radius: radius,
            fillColor: color,
            color: '#ffffff',
            weight: 3,
            opacity: 1,
            fillOpacity: 0.8,
            speciesCount: count,
            speciesData: species
        });

        circle.bindPopup(this.createPopupContent(location.location_name, species, count), {
            maxWidth: 450,
            className: 'species-popup-container'
        });

        circle.on('mouseover', function() {
            this.setStyle({ weight: 4, fillOpacity: 1, radius: this.options.radius * 1.2 });
        });

        circle.on('mouseout', function() {
            this.setStyle({ weight: 3, fillOpacity: 0.8, radius: this.options.radius / 1.2 });
        });

        return circle;
    }

    getHeatmapColor(count, maxCount) {
        const ratio = count / maxCount;
        if (ratio <= 0.15) return '#2E7D32';
        if (ratio <= 0.3) return '#66BB6A';
        if (ratio <= 0.5) return '#FDD835';
        if (ratio <= 0.7) return '#FB8C00';
        if (ratio <= 0.85) return '#E53935';
        return '#B71C1C';
    }

    darkenColor(color, amount) {
        const num = parseInt(color.replace('#', ''), 16);
        const r = Math.max(0, (num >> 16) - Math.round(255 * amount));
        const g = Math.max(0, ((num >> 8) & 0x00FF) - Math.round(255 * amount));
        const b = Math.max(0, (num & 0x0000FF) - Math.round(255 * amount));
        return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
    }

    getMarkerRadius(count, maxCount) {
        const ratio = count / maxCount;
        return 12 + (22 * ratio);
    }

    getClusterSize(count, maxCount) {
        const ratio = count / maxCount;
        return Math.round(55 + (50 * ratio));
    }

    createClusterPopupContent(species) {
        species.sort((a, b) => a.common_name.localeCompare(b.common_name));
        
        let html = `
            <div class="species-popup-enhanced">
                <div class="popup-header-enhanced">
                    <div class="popup-icon">🌍</div>
                    <div>
                        <h4>${species.length} ${species.length === 1 ? 'Espécie' : 'Espécies'} nesta Região</h4>
                        <p class="popup-subtitle">Clique em uma espécie para ver detalhes completos</p>
                    </div>
                </div>
                <div class="popup-species-list-enhanced">`;

        species.forEach((sp, i) => {
            const img = sp.image_filename ? `/static/images/${sp.image_filename}` : '/static/images/placeholder.png';
            html += `
                <div class="species-item-enhanced" onclick="window.location.href='/mammal/${sp.id}/'" title="Ver detalhes de ${this.escapeHtml(sp.common_name)}">
                    <div class="species-number-badge">${i+1}</div>
                    <img src="${img}" alt="${this.escapeHtml(sp.common_name)}" onerror="this.src='/static/images/placeholder.png'" class="species-thumbnail">
                    <div class="species-info-enhanced">
                        <div class="species-name-primary">${this.escapeHtml(sp.common_name)}</div>
                        <div class="species-name-scientific"><em>${this.escapeHtml(sp.binomial_name)}</em></div>
                        <div class="species-continent-tag">📍 ${this.escapeHtml(sp.continent)}</div>
                    </div>
                    <div class="species-arrow-icon">→</div>
                </div>`;
        });

        html += `</div></div>`;
        return html;
    }

    createPopupContent(locationName, species, count) {
        species.sort((a, b) => a.common_name.localeCompare(b.common_name));
        
        let html = `
            <div class="species-popup-enhanced">
                <div class="popup-header-enhanced">
                    <div class="popup-icon">📍</div>
                    <div>
                        <h4>${this.escapeHtml(locationName)}</h4>
                        <p class="popup-subtitle">${count} ${count === 1 ? 'espécie' : 'espécies'} registrada${count === 1 ? '' : 's'}</p>
                    </div>
                </div>
                <div class="popup-species-list-enhanced">`;

        species.forEach((sp, i) => {
            const img = sp.image_filename ? `/static/images/${sp.image_filename}` : '/static/images/placeholder.png';
            html += `
                <div class="species-item-enhanced" onclick="window.location.href='/mammal/${sp.id}/'" title="Ver detalhes de ${this.escapeHtml(sp.common_name)}">
                    <div class="species-number-badge">${i+1}</div>
                    <img src="${img}" alt="${this.escapeHtml(sp.common_name)}" onerror="this.src='/static/images/placeholder.png'" class="species-thumbnail">
                    <div class="species-info-enhanced">
                        <div class="species-name-primary">${this.escapeHtml(sp.common_name)}</div>
                        <div class="species-name-scientific"><em>${this.escapeHtml(sp.binomial_name)}</em></div>
                    </div>
                    <div class="species-arrow-icon">→</div>
                </div>`;
        });

        html += `</div></div>`;
        return html;
    }

    updateStatistics() {
        if (!this.data || !this.data.statistics) return;

        const stats = this.data.statistics;
        document.getElementById('stat-locations').textContent = stats.total_locations;
        document.getElementById('stat-species').textContent = stats.total_species;
        document.getElementById('stat-max').textContent = stats.max_concentration;
        document.getElementById('legend-max').textContent = `${stats.max_concentration}+ espécies`;
    }

    showError() {
        document.getElementById('map-loading').style.display = 'none';
        document.getElementById('map-error').style.display = 'block';
    }

    showMap() {
        document.getElementById('map-loading').style.display = 'none';
        document.getElementById('global-map-container').style.display = 'block';
        document.getElementById('map-legend-container').style.display = 'block';
        setTimeout(() => this.map.invalidateSize(), 100);
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

const style = document.createElement('style');
style.textContent = `
    .custom-cluster-icon:hover {
        transform: scale(1.1);
    }
    .species-popup-enhanced {
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    }
    .popup-header-enhanced {
        background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
        color: white;
        padding: 16px;
        border-radius: 12px 12px 0 0;
        display: flex;
        align-items: center;
        gap: 12px;
    }
    .popup-icon {
        font-size: 32px;
    }
    .popup-header-enhanced h4 {
        margin: 0 0 4px 0;
        font-size: 18px;
        font-weight: 600;
    }
    .popup-subtitle {
        margin: 0;
        font-size: 13px;
        opacity: 0.95;
    }
    .popup-species-list-enhanced {
        max-height: 350px;
        overflow-y: auto;
        padding: 8px;
    }
    .species-item-enhanced {
        padding: 12px;
        border-bottom: 1px solid #e0e0e0;
        display: flex;
        align-items: center;
        gap: 12px;
        cursor: pointer;
        transition: all 0.2s;
        border-radius: 8px;
    }
    .species-item-enhanced:hover {
        background: linear-gradient(90deg, #E3F2FD 0%, #BBDEFB 100%);
        transform: translateX(4px);
    }
    .species-number-badge {
        background: linear-gradient(135deg, #1976D2 0%, #1565C0 100%);
        color: white;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 14px;
        font-weight: bold;
        flex-shrink: 0;
    }
    .species-thumbnail {
        width: 60px;
        height: 60px;
        object-fit: cover;
        border-radius: 10px;
        border: 2px solid #e0e0e0;
        flex-shrink: 0;
    }
    .species-info-enhanced {
        flex: 1;
    }
    .species-name-primary {
        font-weight: 600;
        color: #1565C0;
        font-size: 15px;
        margin-bottom: 4px;
    }
    .species-name-scientific {
        font-size: 13px;
        color: #666;
        margin-bottom: 4px;
    }
    .species-continent-tag {
        font-size: 12px;
        color: #999;
        background: #f5f5f5;
        padding: 2px 8px;
        border-radius: 12px;
        display: inline-block;
    }
    .species-arrow-icon {
        color: #1976D2;
        font-size: 24px;
        font-weight: bold;
        flex-shrink: 0;
    }
`;
document.head.appendChild(style);

document.addEventListener('DOMContentLoaded', () => {
    const globalMap = new GlobalMap();
    globalMap.init();
});
