const editor = document.getElementById('editor');
const eventLog = document.getElementById('eventLog');
const errorLog = document.getElementById('errorLog');
const placeholderInput = document.getElementById('placeholderInput');
const themeModal = document.getElementById('themeModal');
const themeTextarea = document.getElementById('themeTextarea');
const themePresetMainSelect = document.getElementById('themePresetMainSelect');

// Initialize MapLibre map with globe projection
const map = new maplibregl.Map({
  container: 'map',
  style: 'https://demotiles.maplibre.org/style.json',
  center: [29.8, -3.4],
  zoom: 2
});

// Add navigation controls
map.addControl(new maplibregl.NavigationControl(), 'top-right');

// Store pending GeoJSON if map not ready yet
let pendingGeojson = null;

// Setup map when loaded
map.on('load', () => {
  // Set globe projection for 3D Earth view
  map.setProjection({ type: 'globe' });

  // Add GeoJSON source
  map.addSource('geojson-data', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Add vertices source (for features with marker: true)
  map.addSource('vertices-data', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Polygon fill layer
  map.addLayer({
    id: 'geojson-fill',
    type: 'fill',
    source: 'geojson-data',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': ['coalesce', ['get', 'fill-color'], '#58a6ff'],
      'fill-opacity': ['coalesce', ['get', 'fill-opacity'], 0.4]
    }
  });

  // Polygon outline layer
  map.addLayer({
    id: 'geojson-outline',
    type: 'line',
    source: 'geojson-data',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'line-color': ['coalesce', ['get', 'stroke-color'], '#58a6ff'],
      'line-width': ['coalesce', ['get', 'stroke-width'], 2]
    }
  });

  // LineString layer
  map.addLayer({
    id: 'geojson-line',
    type: 'line',
    source: 'geojson-data',
    filter: ['==', '$type', 'LineString'],
    paint: {
      'line-color': ['coalesce', ['get', 'stroke-color'], '#a371f7'],
      'line-width': ['coalesce', ['get', 'stroke-width'], 3]
    }
  });

  // Point layer
  map.addLayer({
    id: 'geojson-point',
    type: 'circle',
    source: 'geojson-data',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 8,
      'circle-color': ['coalesce', ['get', 'fill-color'], '#f85149'],
      'circle-stroke-color': ['coalesce', ['get', 'stroke-color'], '#ffffff'],
      'circle-stroke-width': ['coalesce', ['get', 'stroke-width'], 2]
    }
  });

  // Label layer for features with 'label' property
  map.addLayer({
    id: 'geojson-labels',
    type: 'symbol',
    source: 'geojson-data',
    filter: ['has', 'label'],
    layout: {
      'text-field': ['get', 'label'],
      'text-size': ['coalesce', ['get', 'label-size'], 14],
      'text-anchor': 'center',
      'text-allow-overlap': false
    },
    paint: {
      'text-color': ['coalesce', ['get', 'label-color'], '#ffffff'],
      'text-halo-color': ['coalesce', ['get', 'label-halo-color'], '#000000'],
      'text-halo-width': ['coalesce', ['get', 'label-halo-width'], 1.5]
    }
  });

  // Vertices layer (for LineString/Polygon with marker: true)
  map.addLayer({
    id: 'geojson-vertices',
    type: 'circle',
    source: 'vertices-data',
    paint: {
      'circle-radius': ['coalesce', ['get', 'marker-width'], 5],
      'circle-color': ['coalesce', ['get', 'marker-color'], '#ff6b35'],
      'circle-opacity': ['coalesce', ['get', 'marker-opacity'], 0.9],
      'circle-stroke-width': 1,
      'circle-stroke-color': '#ffffff'
    }
  });

  // Add highlight source for current-features
  map.addSource('highlight-data', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Highlight layers - rendered on top with blinking animation
  // Polygon fill highlight
  map.addLayer({
    id: 'highlight-fill',
    type: 'fill',
    source: 'highlight-data',
    filter: ['==', '$type', 'Polygon'],
    paint: {
      'fill-color': ['coalesce', ['get', 'fill-color'], '#ff6b35'],
      'fill-opacity': 0.3
    }
  });

  // Polygon/LineString outline highlight (wider stroke)
  map.addLayer({
    id: 'highlight-line',
    type: 'line',
    source: 'highlight-data',
    filter: ['any', ['==', '$type', 'Polygon'], ['==', '$type', 'LineString']],
    paint: {
      'line-color': ['coalesce', ['get', 'stroke-color'], '#ff6b35'],
      'line-width': ['+', ['coalesce', ['get', 'stroke-width'], 2], 2]
    }
  });

  // Point highlight (larger circle)
  map.addLayer({
    id: 'highlight-point',
    type: 'circle',
    source: 'highlight-data',
    filter: ['==', '$type', 'Point'],
    paint: {
      'circle-radius': 12,
      'circle-color': ['coalesce', ['get', 'fill-color'], '#ff6b35'],
      'circle-stroke-color': '#ffffff',
      'circle-stroke-width': 3
    }
  });

  // Add animated icons source
  map.addSource('animated-icons-data', {
    type: 'geojson',
    data: { type: 'FeatureCollection', features: [] }
  });

  // Add animated icons layer
  map.addLayer({
    id: 'animated-icons',
    type: 'symbol',
    source: 'animated-icons-data',
    layout: {
      'icon-image': ['get', 'icon-id'],
      'icon-size': ['/', ['coalesce', ['get', 'icon-size'], 24], 24],
      'icon-rotate': ['get', 'icon-rotate'],
      'icon-rotation-alignment': 'map',
      'icon-allow-overlap': true
    }
  });

  // Apply pending GeoJSON if data was loaded before map was ready
  if (pendingGeojson) {
    updateMap(pendingGeojson);
    pendingGeojson = null;
  }
});

// =====================================================
// ANIMATED ICONS SYSTEM
// =====================================================

// Store for active animations
const activeAnimations = new Map();
let animationFrameId = null;

// Available icon SVGs (pointing UP by default)
const ICON_SVGS = {
  airplane: 'M280-80v-100l120-84v-144L80-280v-120l320-224v-176q0-33 23.5-56.5T480-880q33 0 56.5 23.5T560-800v176l320 224v120L560-408v144l120 84v100l-200-60-200 60Z'
};

// Create a colored icon and add it to the map
function getOrCreateIcon(iconName, color, size) {
  const iconId = `${iconName}-${color.replace('#', '')}`;

  if (!map.hasImage(iconId)) {
    const svgPath = ICON_SVGS[iconName];
    if (!svgPath) return null;

    // Create SVG with the specified color
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 -960 960 960"><path d="${svgPath}" fill="${color}"/></svg>`;

    // Create image from SVG
    const img = new Image(size, size);
    img.onload = () => {
      if (!map.hasImage(iconId)) {
        map.addImage(iconId, img);
      }
    };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  }

  return iconId;
}

// Calculate bearing between two points
function calculateBearing(start, end) {
  const startLat = start[1] * Math.PI / 180;
  const startLng = start[0] * Math.PI / 180;
  const endLat = end[1] * Math.PI / 180;
  const endLng = end[0] * Math.PI / 180;

  const dLng = endLng - startLng;

  const x = Math.sin(dLng) * Math.cos(endLat);
  const y = Math.cos(startLat) * Math.sin(endLat) - Math.sin(startLat) * Math.cos(endLat) * Math.cos(dLng);

  let bearing = Math.atan2(x, y) * 180 / Math.PI;
  return (bearing + 360) % 360;
}

// Calculate distance between two points (in km)
function calculateDistance(start, end) {
  const R = 6371; // Earth radius in km
  const dLat = (end[1] - start[1]) * Math.PI / 180;
  const dLng = (end[0] - start[0]) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(start[1] * Math.PI / 180) * Math.cos(end[1] * Math.PI / 180) *
            Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Interpolate position along a line at given fraction (0-1)
function interpolateAlongLine(coordinates, fraction) {
  if (coordinates.length < 2) return coordinates[0];

  // Calculate total length
  let totalLength = 0;
  const segmentLengths = [];
  for (let i = 0; i < coordinates.length - 1; i++) {
    const len = calculateDistance(coordinates[i], coordinates[i + 1]);
    segmentLengths.push(len);
    totalLength += len;
  }

  const targetDistance = fraction * totalLength;
  let accumulatedDistance = 0;

  for (let i = 0; i < segmentLengths.length; i++) {
    if (accumulatedDistance + segmentLengths[i] >= targetDistance) {
      // We're in this segment
      const segmentFraction = (targetDistance - accumulatedDistance) / segmentLengths[i];
      const start = coordinates[i];
      const end = coordinates[i + 1];

      // Great circle interpolation for accuracy on globe
      const lng = start[0] + (end[0] - start[0]) * segmentFraction;
      const lat = start[1] + (end[1] - start[1]) * segmentFraction;

      // Calculate bearing for rotation
      const bearing = calculateBearing(start, end);

      return { position: [lng, lat], bearing };
    }
    accumulatedDistance += segmentLengths[i];
  }

  // Return last point
  const lastIdx = coordinates.length - 1;
  return {
    position: coordinates[lastIdx],
    bearing: calculateBearing(coordinates[lastIdx - 1], coordinates[lastIdx])
  };
}

// Process features and extract animated icons
function extractAnimatedFeatures(geojson) {
  const animatedFeatures = [];

  if (!geojson || !geojson.features) return animatedFeatures;

  geojson.features.forEach((feature, index) => {
    const props = feature.properties || {};

    // Check if this feature has icon animation
    if (props['icon-animation'] && props.icon &&
        (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString')) {

      const coordinates = feature.geometry.type === 'LineString'
        ? feature.geometry.coordinates
        : feature.geometry.coordinates[0]; // For MultiLineString, use first line

      if (coordinates && coordinates.length >= 2) {
        animatedFeatures.push({
          id: `anim-${index}`,
          coordinates,
          icon: props.icon,
          color: props['icon-color'] || '#ffffff',
          size: props['icon-size'] || 24,
          baseRotate: props['icon-rotate'] || 0,
          loop: props['icon-animation-loop'] !== false,
          speed: props['icon-animation-speed'] || 1,
          progress: 0,
          direction: 1
        });
      }
    }
  });

  return animatedFeatures;
}

// Update animated icons
function updateAnimatedIcons() {
  if (activeAnimations.size === 0) {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
    return;
  }

  const features = [];

  activeAnimations.forEach((anim) => {
    // Update progress based on speed (speed 1 = 30 seconds for full path)
    const increment = (anim.speed / 30) * (1/60) * anim.direction; // 60fps assumed
    anim.progress += increment;

    // Handle loop or stop
    if (anim.progress >= 1) {
      if (anim.loop) {
        anim.progress = 0;
      } else {
        anim.progress = 1;
      }
    } else if (anim.progress < 0) {
      if (anim.loop) {
        anim.progress = 1;
      } else {
        anim.progress = 0;
      }
    }

    // Get position and bearing
    const { position, bearing } = interpolateAlongLine(anim.coordinates, anim.progress);

    // Get or create icon
    const iconId = getOrCreateIcon(anim.icon, anim.color, anim.size);
    if (!iconId) return;

    // Create feature for this animated icon
    // The SVG points UP (north), so bearing 0 = north = no rotation needed
    // Add baseRotate for initial orientation adjustment
    features.push({
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: position
      },
      properties: {
        'icon-id': iconId,
        'icon-size': anim.size,
        'icon-rotate': bearing + anim.baseRotate
      }
    });
  });

  // Update the source
  const source = map.getSource('animated-icons-data');
  if (source) {
    source.setData({
      type: 'FeatureCollection',
      features
    });
  }

  // Continue animation
  animationFrameId = requestAnimationFrame(updateAnimatedIcons);
}

// Start animations for features
function startAnimations(geojson) {
  // Stop existing animations
  activeAnimations.clear();
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }

  // Extract animated features
  const animatedFeatures = extractAnimatedFeatures(geojson);

  // Register animations
  animatedFeatures.forEach(anim => {
    activeAnimations.set(anim.id, anim);
  });

  // Start animation loop if we have animations
  if (activeAnimations.size > 0) {
    animationFrameId = requestAnimationFrame(updateAnimatedIcons);
  } else {
    // Clear animated icons layer if no animations
    const source = map.getSource('animated-icons-data');
    if (source) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }
}

// Extract all coordinates from a geometry
function extractCoordinates(geometry) {
  if (!geometry) return [];
  switch (geometry.type) {
    case 'Point':
      return [geometry.coordinates];
    case 'MultiPoint':
    case 'LineString':
      return geometry.coordinates;
    case 'MultiLineString':
    case 'Polygon':
      return geometry.coordinates.flat();
    case 'MultiPolygon':
      return geometry.coordinates.flat(2);
    default:
      return [];
  }
}

// Extract vertices from features that have marker: true
function extractVertices(featureCollection) {
  const vertexFeatures = [];
  if (!featureCollection || !featureCollection.features) {
    return { type: 'FeatureCollection', features: [] };
  }
  featureCollection.features.forEach(feature => {
    // Only process if marker property is true
    if (!feature.properties || feature.properties.marker !== true) {
      return;
    }
    // Skip Point geometries (they are already displayed as points)
    if (feature.geometry && feature.geometry.type === 'Point') {
      return;
    }
    const props = feature.properties;
    const markerColor = props['marker-color'] || props['stroke-color'] || '#ff6b35';
    const markerOpacity = props['marker-opacity'];
    const markerWidth = props['marker-width'];
    const coords = extractCoordinates(feature.geometry);
    coords.forEach(coord => {
      const vertexProps = { 'marker-color': markerColor };
      if (markerOpacity !== undefined) vertexProps['marker-opacity'] = markerOpacity;
      if (markerWidth !== undefined) vertexProps['marker-width'] = markerWidth;
      vertexFeatures.push({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: coord },
        properties: vertexProps
      });
    });
  });
  return { type: 'FeatureCollection', features: vertexFeatures };
}

// Highlight layer animation state
let highlightAnimationId = null;
let highlightVisible = true;

// Function to update highlight layer with current features (FeatureCollection)
function updateHighlightLayer(featureCollection) {
  if (!map.getSource('highlight-data')) return;

  // Stop any existing animation
  if (highlightAnimationId) {
    clearInterval(highlightAnimationId);
    highlightAnimationId = null;
  }

  if (featureCollection && featureCollection.features && featureCollection.features.length > 0) {
    // Set the FeatureCollection data directly
    map.getSource('highlight-data').setData(featureCollection);

    // Center map on all features bounds
    const bounds = new maplibregl.LngLatBounds();
    const addCoords = (coords) => {
      if (Array.isArray(coords[0])) {
        coords.forEach(addCoords);
      } else if (coords.length >= 2) {
        bounds.extend([coords[0], coords[1]]);
      }
    };

    featureCollection.features.forEach(feature => {
      if (feature.geometry && feature.geometry.coordinates) {
        addCoords(feature.geometry.coordinates);
      }
    });

    if (!bounds.isEmpty()) {
      const center = bounds.getCenter();
      map.flyTo({
        center: [center.lng, center.lat],
        duration: 500
      });
    }

    // Start blinking animation
    highlightVisible = true;
    highlightAnimationId = setInterval(() => {
      highlightVisible = !highlightVisible;
      const opacity = highlightVisible ? 1 : 0.3;

      // Animate line width between normal+2 and normal+4
      const firstFeature = featureCollection.features[0];
      const baseStroke = firstFeature?.properties?.['stroke-width'] || 2;
      const lineWidth = highlightVisible ? baseStroke + 4 : baseStroke + 2;

      if (map.getLayer('highlight-line')) {
        map.setPaintProperty('highlight-line', 'line-opacity', opacity);
        map.setPaintProperty('highlight-line', 'line-width', lineWidth);
      }
      if (map.getLayer('highlight-fill')) {
        map.setPaintProperty('highlight-fill', 'fill-opacity', highlightVisible ? 0.4 : 0.2);
      }
      if (map.getLayer('highlight-point')) {
        map.setPaintProperty('highlight-point', 'circle-radius', highlightVisible ? 14 : 10);
      }
    }, 500);
  } else {
    // Clear highlight
    map.getSource('highlight-data').setData({
      type: 'FeatureCollection',
      features: []
    });
  }
}

// Function to update map with GeoJSON data
function updateMap(geojson) {
  if (!map.getSource('geojson-data')) {
    // Map not ready, store for later
    pendingGeojson = geojson;
    return;
  }

  try {
    map.getSource('geojson-data').setData(geojson);

    // Extract and display vertices for features with marker: true
    const vertices = extractVertices(geojson);
    if (map.getSource('vertices-data')) {
      map.getSource('vertices-data').setData(vertices);
    }

    // Fit bounds to data if there are features
    if (geojson.features && geojson.features.length > 0) {
      const bounds = new maplibregl.LngLatBounds();
      let hasValidCoords = false;

      geojson.features.forEach(feature => {
        if (!feature.geometry) return;
        const addCoords = (coords) => {
          if (Array.isArray(coords[0])) {
            coords.forEach(addCoords);
          } else if (coords.length >= 2) {
            bounds.extend([coords[0], coords[1]]);
            hasValidCoords = true;
          }
        };
        if (feature.geometry.coordinates) {
          addCoords(feature.geometry.coordinates);
        }
      });

      if (hasValidCoords) {
        map.fitBounds(bounds, {
          padding: 50,
          maxZoom: 12,
          duration: 1000
        });
      }
    }

    // Start icon animations
    startAnimations(geojson);
  } catch (e) {
    console.warn('Failed to update map:', e);
  }
}

// Theme CSS files mapping (using CDN for GitHub Pages compatibility)
const themeCSSFiles = {
  vscode: 'https://unpkg.com/@softwarity/geojson-editor/themes/vscode.css',
  github: 'https://unpkg.com/@softwarity/geojson-editor/themes/github.css',
  monokai: 'https://unpkg.com/@softwarity/geojson-editor/themes/monokai.css',
  solarized: 'https://unpkg.com/@softwarity/geojson-editor/themes/solarized.css'
};

// Cache for loaded theme CSS content
const themeCache = {};

// Current theme style element
let currentThemeStyle = null;

// Load theme CSS file and apply it
async function loadThemeCSS(themeName) {
  // Remove current theme if any
  if (currentThemeStyle) {
    currentThemeStyle.remove();
    currentThemeStyle = null;
  }

  // Empty value means default theme (no external CSS)
  if (!themeName) {
    return '';
  }

  const cssPath = themeCSSFiles[themeName];
  if (!cssPath) return '';

  // Check cache first
  if (themeCache[themeName]) {
    applyThemeCSS(themeCache[themeName]);
    return themeCache[themeName];
  }

  // Use dynamic import with ?raw to get raw CSS content (works with Vite)
  try {
    const module = await import(/* @vite-ignore */ cssPath + '?raw');
    const cssContent = module.default;
    themeCache[themeName] = cssContent;
    applyThemeCSS(cssContent);
    return cssContent;
  } catch (error) {
    console.error(`Failed to load theme ${themeName}:`, error);
    return '';
  }
}

// Apply theme CSS to document
function applyThemeCSS(cssContent) {
  if (!cssContent) return;
  currentThemeStyle = document.createElement('style');
  currentThemeStyle.id = 'theme-override';
  currentThemeStyle.textContent = cssContent;
  document.head.appendChild(currentThemeStyle);
}
const htmlCode = document.getElementById('htmlCode');

// Update editor attributes from inputs
function updateEditor() {
  editor.setAttribute('placeholder', placeholderInput.value);

  const readonlyToggle = document.getElementById('readonlyToggle');
  if (readonlyToggle && readonlyToggle.checked) {
    editor.setAttribute('readonly', '');
  } else {
    editor.removeAttribute('readonly');
  }

  updateHTMLCode();
}

// Update HTML code display
function updateHTMLCode() {
  const placeholder = placeholderInput.value;
  const readonlyToggle = document.getElementById('readonlyToggle');
  const internalAddToggle = document.getElementById('internalAddToggle');
  const readonly = readonlyToggle ? readonlyToggle.checked : false;
  const internalAdd = internalAddToggle ? internalAddToggle.checked : false;
  const currentTheme = themePresetMainSelect.value;

  // Build component attributes
  let attrs = [];
  if (placeholder) attrs.push(`placeholder="${placeholder.replace(/"/g, '&quot;')}"`);
  if (readonly) attrs.push('readonly');
  if (internalAdd) attrs.push('internal-add-shortcut');

  // Check current color scheme from html class (Tailwind pattern)
  const isDark = document.documentElement.classList.contains('dark');

  let code = '<!DOCTYPE html>\n';
  code += `<html lang="en"${isDark ? ' class="dark"' : ''}>\n`;
  code += '<head>\n';
  code += '  <meta charset="UTF-8">\n';
  code += '  <title>GeoJSON Editor</title>\n';

  // Include theme CSS link if a theme is selected
  if (currentTheme) {
    code += `  <!-- Theme: ${currentTheme} -->\n`;
    code += `  <link rel="stylesheet" href="https://unpkg.com/@softwarity/geojson-editor/themes/${currentTheme}.css">\n`;
  }

  code += '  <style>\n';
  code += '    /*\n';
  code += '     * Color scheme toggle (Tailwind pattern)\n';
  code += '     * The editor uses CSS light-dark() and inherits color-scheme from parent.\n';
  code += '     * Toggle html.dark class to switch themes.\n';
  code += '     * For Bootstrap: [data-bs-theme="dark"] { color-scheme: dark; }\n';
  code += '     */\n';
  code += '    html.dark { color-scheme: dark; }\n';
  code += '    html:not(.dark) { color-scheme: light; }\n';
  code += '  </style>\n';
  code += '  <script type="module">\n';
  code += '    const editor = document.querySelector(\'geojson-editor\');\n\n';
  code += '    // Valid GeoJSON - emits parsed object directly\n';
  code += '    editor.addEventListener(\'change\', (e) => {\n';
  code += '      console.log(\'GeoJSON:\', e.detail);\n';
  code += '    });\n\n';
  code += '    // Invalid JSON or GeoJSON validation error\n';
  code += '    editor.addEventListener(\'error\', (e) => {\n';
  code += '      console.error(\'Error:\', e.detail.error);\n';
  code += '    });\n\n';
  code += '    // Cursor moved to different feature(s)\n';
  code += '    editor.addEventListener(\'current-features\', (e) => {\n';
  code += '      console.log(\'Current features:\', e.detail); // FeatureCollection\n';
  code += '    });\n';
  code += '  <\/script>\n';
  code += '</head>\n';
  code += '<body>\n';
  code += '  <geojson-editor';
  if (attrs.length > 0) {
    code += '\n    ' + attrs.join('\n    ');
  }
  code += '\n  ></geojson-editor>\n\n';
  code += '  <script type="module" src="https://unpkg.com/@softwarity/geojson-editor"><\/script>\n';
  code += '</body>\n';
  code += '</html>';

  // Apply HTML syntax highlighting with Prism.js
  htmlCode.innerHTML = Prism.highlight(code, Prism.languages.markup, 'markup');
}

// Listen to editor change events (valid JSON parsed object)
editor.addEventListener('change', (e) => {
  const jsonStr = JSON.stringify(e.detail, null, 2);
  // Apply Prism.js JSON highlighting
  eventLog.innerHTML = Prism.highlight(jsonStr, Prism.languages.json, 'json');
  // Clear error log on successful parse
  errorLog.textContent = 'No errors';
  errorLog.style.color = '';
  // Update map with the GeoJSON data
  updateMap(e.detail);
});

// Listen to editor error events (invalid JSON)
editor.addEventListener('error', (e) => {
  errorLog.textContent = JSON.stringify(e.detail, null, 2);
  errorLog.style.color = '#f85149';
});

// Listen to current-features events (cursor position tracking)
const currentFeatureLog = document.getElementById('currentFeatureLog');
editor.addEventListener('current-features', (e) => {
  const featureCollection = e.detail;
  if (featureCollection && featureCollection.features && featureCollection.features.length > 0) {
    const jsonStr = JSON.stringify(featureCollection, null, 2);
    currentFeatureLog.innerHTML = Prism.highlight(jsonStr, Prism.languages.json, 'json');
    // Update highlight layer on map with FeatureCollection
    updateHighlightLayer(featureCollection);
  } else {
    currentFeatureLog.textContent = '{ "type": "FeatureCollection", "features": [] }';
    // Clear highlight layer
    updateHighlightLayer(null);
  }
});

// Clear event/error logs
function clearEventLog() {
  eventLog.textContent = 'Waiting for change events...';
}

function clearErrorLog() {
  errorLog.textContent = 'No errors';
  errorLog.style.color = '';
}

// Listen to input changes
placeholderInput.addEventListener('input', updateEditor);

// Apply preset theme directly from main selector
themePresetMainSelect.addEventListener('change', async () => {
  const presetName = themePresetMainSelect.value;
  await loadThemeCSS(presetName);
  updateHTMLCode();
});

// Toggle color scheme (light/dark) using Tailwind pattern (class on html)
const colorSchemeToggle = document.getElementById('colorSchemeToggle');
// Set initial icon based on html.dark class
colorSchemeToggle.querySelector('span').textContent = document.documentElement.classList.contains('dark') ? 'dark_mode' : 'light_mode';

function toggleColorScheme() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  const iconSpan = colorSchemeToggle.querySelector('span');
  iconSpan.textContent = isDark ? 'dark_mode' : 'light_mode';
  updateHTMLCode();
}

// Open theme modal
async function openThemeModal() {
  await loadCurrentThemeCSS();
  themeModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Close theme modal
function closeThemeModal() {
  themeModal.style.display = 'none';
  document.body.style.overflow = '';
}

// Close modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && themeModal.style.display === 'flex') {
    closeThemeModal();
  }
});

// Load current theme CSS into textarea
async function loadCurrentThemeCSS() {
  const presetName = themePresetMainSelect.value;
  if (!presetName) {
    // Default theme - show the built-in CSS variables
    themeTextarea.value = `/* Default theme (IntelliJ) - built into the component */
/* To customize, create a CSS file with overrides: */

:root {
  /* Editor background and text */
  --geojson-editor-bg-color: light-dark(#fff, #2b2b2b);
  --geojson-editor-text-color: light-dark(#000, #a9b7c6);
  --geojson-editor-caret-color: light-dark(#000, #bbb);

  /* Gutter (line numbers area) */
  --geojson-editor-gutter-bg: light-dark(#f0f0f0, #313335);
  --geojson-editor-gutter-border: light-dark(#e0e0e0, #3c3f41);
  --geojson-editor-gutter-text: light-dark(#999, #606366);

  /* JSON syntax highlighting */
  --geojson-editor-json-key: light-dark(#660e7a, #9876aa);
  --geojson-editor-json-string: light-dark(#008000, #6a8759);
  --geojson-editor-json-number: light-dark(#00f, #6897bb);
  --geojson-editor-json-boolean: light-dark(#000080, #cc7832);
  --geojson-editor-json-punct: light-dark(#000, #a9b7c6);
  --geojson-editor-json-error: light-dark(#f00, #ff6b68);

  /* GeoJSON-specific */
  --geojson-editor-geojson-key: light-dark(#660e7a, #9876aa);
  --geojson-editor-geojson-type: light-dark(#008000, #6a8759);
  --geojson-editor-geojson-type-invalid: light-dark(#f00, #ff6b68);

  /* Controls (checkboxes, color swatches) */
  --geojson-editor-control-color: light-dark(#000080, #cc7832);
  --geojson-editor-control-bg: light-dark(#e8e8e8, #3c3f41);
  --geojson-editor-control-border: light-dark(#c0c0c0, #5a5a5a);

  /* Selection and errors */
  --geojson-editor-selection-color: light-dark(rgba(51, 153, 255, 0.3), rgba(51, 153, 255, 0.4));
  --geojson-editor-error-color: light-dark(#dc3545, #ff6b68);
}`;
    return;
  }

  const cssPath = themeCSSFiles[presetName];
  if (!cssPath) return;

  // Check cache first
  if (themeCache[presetName]) {
    themeTextarea.value = themeCache[presetName];
    return;
  }

  // Fetch CSS file
  try {
    const response = await fetch(cssPath);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const cssContent = await response.text();
    themeCache[presetName] = cssContent;
    themeTextarea.value = cssContent;
  } catch (error) {
    themeTextarea.value = `/* Failed to load theme: ${error.message} */`;
  }
}

// Apply theme from textarea (custom CSS)
function applyTheme() {
  try {
    const cssContent = themeTextarea.value;
    // Remove current theme
    if (currentThemeStyle) {
      currentThemeStyle.remove();
      currentThemeStyle = null;
    }
    // Apply custom CSS
    if (cssContent.trim()) {
      applyThemeCSS(cssContent);
    }
    showThemeMessage('Theme applied!', 'success');
  } catch (e) {
    showThemeMessage('Failed to apply: ' + e.message, 'error');
  }
}

// Reset to default theme
async function resetTheme() {
  themePresetMainSelect.value = '';
  if (currentThemeStyle) {
    currentThemeStyle.remove();
    currentThemeStyle = null;
  }
  await loadCurrentThemeCSS();
  updateHTMLCode();
  showThemeMessage('Theme reset to default', 'success');
}

// Copy theme CSS to clipboard
function copyTheme() {
  const cssContent = themeTextarea.value;

  navigator.clipboard.writeText(cssContent).then(() => {
    showThemeMessage('CSS copied to clipboard!', 'success');
  }).catch(() => {
    showThemeMessage('Failed to copy', 'error');
  });
}

// Show feedback message as centered toast overlay in theme modal
function showThemeMessage(message, type) {
  const modalContent = themeModal.querySelector('.modal-content');
  const existing = modalContent.querySelector('.theme-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = 'theme-toast';
  toast.style.cssText = `
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    padding: 1rem 1.5rem;
    border-radius: 8px;
    font-size: 0.95rem;
    font-weight: 500;
    background: ${type === 'success' ? 'rgba(40, 167, 69, 0.95)' : 'rgba(220, 53, 69, 0.95)'};
    color: white;
    box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    z-index: 10;
    animation: toastFadeIn 0.2s ease-out;
  `;
  toast.textContent = message;
  modalContent.style.position = 'relative';
  modalContent.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastFadeOut 0.3s ease-out forwards';
    setTimeout(() => toast.remove(), 300);
  }, 2000);
}

// ========================================
// API Modal Functions
// ========================================
const apiModal = document.getElementById('apiModal');
const apiModalTitle = document.getElementById('apiModalTitle');
const apiModalError = document.getElementById('apiModalError');
let currentApiMethod = null;

// Cache for loaded samples
const apiSampleCache = {};

// Get selected collapsed attributes for a method
function getCollapsedAttributes(method) {
  const methodName = method.charAt(0).toUpperCase() + method.slice(1);
  const form = document.getElementById(`apiForm${methodName}`);
  if (!form) return ['coordinates'];

  const checkboxes = form.querySelectorAll('.collapsed-checkboxes input[type="checkbox"]:checked');
  return Array.from(checkboxes).map(cb => cb.value);
}

// Get format label for display
function getFormatLabel(format) {
  const labels = {
    'feature-collection': 'featureCollection',
    'features': 'features',
    'feature': 'feature'
  };
  return labels[format] || format;
}

// Update API call preview
function updateApiCallPreview(method) {
  const methodName = method.charAt(0).toUpperCase() + method.slice(1);
  const formatSelect = document.getElementById(`api${methodName}Format`);
  const previewDiv = document.getElementById(`api${methodName}CallPreview`);
  const defaultHint = document.getElementById(`api${methodName}DefaultHint`);

  if (!formatSelect || !previewDiv) return;

  const format = formatSelect.value;
  const formatLabel = getFormatLabel(format);
  const collapsed = getCollapsedAttributes(method);

  // Show/hide default hint based on selection
  const isUsingDefault = collapsed.length === 0;
  if (defaultHint) {
    defaultHint.style.display = isUsingDefault ? 'inline' : 'none';
  }

  // Build code string with proper formatting
  let callStr = '';
  if (method === 'set') {
    if (isUsingDefault) {
      callStr = `editor.set(${formatLabel});`;
    } else {
      callStr = `editor.set(${formatLabel}, {\n  collapsed: ${JSON.stringify(collapsed)}\n});`;
    }
  } else if (method === 'add') {
    if (isUsingDefault) {
      callStr = `editor.add(${formatLabel});`;
    } else {
      callStr = `editor.add(${formatLabel}, {\n  collapsed: ${JSON.stringify(collapsed)}\n});`;
    }
  } else if (method === 'insertAt') {
    const index = document.getElementById('apiInsertAtIndex')?.value || '0';
    if (isUsingDefault) {
      callStr = `editor.insertAt(${formatLabel}, ${index});`;
    } else {
      callStr = `editor.insertAt(${formatLabel}, ${index}, {\n  collapsed: ${JSON.stringify(collapsed)}\n});`;
    }
  }

  // Apply Prism.js highlighting
  const highlighted = Prism.highlight(callStr, Prism.languages.javascript, 'javascript');
  previewDiv.querySelector('code').innerHTML = highlighted;
}

// Load sample file for API method
async function loadApiSample(method) {
  const formatSelect = document.getElementById(`api${method.charAt(0).toUpperCase() + method.slice(1)}Format`);
  const previewDiv = document.getElementById(`api${method.charAt(0).toUpperCase() + method.slice(1)}Preview`);
  const format = formatSelect.value;
  const filename = `./samples/${method}.${format}.geojson`;
  const cacheKey = `${method}-${format}`;

  try {
    let data;
    if (apiSampleCache[cacheKey]) {
      data = apiSampleCache[cacheKey];
    } else {
      const response = await fetch(filename);
      if (!response.ok) throw new Error(`Failed to load ${filename}`);
      data = await response.text();
      apiSampleCache[cacheKey] = data;
    }

    // Apply Prism.js highlighting
    const highlighted = Prism.highlight(data, Prism.languages.json, 'json');
    previewDiv.querySelector('code').innerHTML = highlighted;
  } catch (error) {
    console.error('Failed to load sample:', error);
    previewDiv.querySelector('code').textContent = `Error: ${error.message}`;
  }
}

// Open API modal for a specific method
function openApiModal(method) {
  currentApiMethod = method;

  // Hide all forms
  document.querySelectorAll('[id^="apiForm"]').forEach(el => el.style.display = 'none');
  apiModalError.style.display = 'none';

  // Show the relevant form
  const formId = 'apiForm' + method.charAt(0).toUpperCase() + method.slice(1);
  const form = document.getElementById(formId);
  if (form) form.style.display = 'block';

  // Update title
  const titles = {
    set: 'set(input)',
    add: 'add(input)',
    insertAt: 'insertAt(input, index)',
    removeAt: 'removeAt(index)'
  };
  apiModalTitle.textContent = titles[method] || method;

  // Load sample and update API call preview for set/add/insertAt
  if (method === 'set' || method === 'add' || method === 'insertAt') {
    loadApiSample(method);
    updateApiCallPreview(method);
  }

  apiModal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}

// Close API modal
function closeApiModal() {
  apiModal.style.display = 'none';
  document.body.style.overflow = '';
  currentApiMethod = null;
}

// Execute the current API method
function executeApiMethod() {
  apiModalError.style.display = 'none';

  try {
    switch (currentApiMethod) {
      case 'set': {
        const format = document.getElementById('apiSetFormat').value;
        const cacheKey = `set-${format}`;
        const data = apiSampleCache[cacheKey];
        if (!data) throw new Error('Sample not loaded');
        const parsed = JSON.parse(data);
        const collapsed = getCollapsedAttributes('set');
        // If nothing selected, use default (no options = ['coordinates'])
        if (collapsed.length === 0) {
          editor.set(parsed);
        } else {
          editor.set(parsed, { collapsed });
        }
        break;
      }
      case 'add': {
        const format = document.getElementById('apiAddFormat').value;
        const cacheKey = `add-${format}`;
        const data = apiSampleCache[cacheKey];
        if (!data) throw new Error('Sample not loaded');
        const parsed = JSON.parse(data);
        const collapsed = getCollapsedAttributes('add');
        // If nothing selected, use default (no options = ['coordinates'])
        if (collapsed.length === 0) {
          editor.add(parsed);
        } else {
          editor.add(parsed, { collapsed });
        }
        break;
      }
      case 'insertAt': {
        const format = document.getElementById('apiInsertAtFormat').value;
        const cacheKey = `insertAt-${format}`;
        const data = apiSampleCache[cacheKey];
        if (!data) throw new Error('Sample not loaded');
        const parsed = JSON.parse(data);
        const index = parseInt(document.getElementById('apiInsertAtIndex').value, 10);
        const collapsed = getCollapsedAttributes('insertAt');
        // If nothing selected, use default (no options = ['coordinates'])
        if (collapsed.length === 0) {
          editor.insertAt(parsed, index);
        } else {
          editor.insertAt(parsed, index, { collapsed });
        }
        break;
      }
      case 'removeAt': {
        const indexInput = document.getElementById('apiRemoveAtIndex');
        const index = parseInt(indexInput.value, 10);
        const removed = editor.removeAt(index);
        if (removed === undefined) {
          throw new Error('Index out of bounds');
        }
        break;
      }
    }
    closeApiModal();
  } catch (e) {
    apiModalError.textContent = e.message;
    apiModalError.style.display = 'block';
  }
}

// Direct API actions (no modal)
function apiRemoveAll() {
  editor.removeAll();
}

function apiEmit() {
  editor.emit();
}

// Close API modal on Escape key
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && apiModal.style.display === 'flex') {
    closeApiModal();
  }
});

// Sample GeoJSON will be loaded from external file
let sampleFeaturesArray = [];

// Load sample data (always in FeatureCollection mode - just the features array content)
async function loadSampleData() {
  try {
    const response = await fetch('./sample.geojson');
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const geojson = await response.json();
    console.log('Loaded sample.geojson with', geojson.length, 'features');
    editor.set(geojson);
  } catch (error) {
    console.error('Failed to load sample.geojson:', error);
    // Fallback to empty editor
    editor.removeAll();
  }
}

function clearEditor() {
  editor.removeAll();
}

// Toggle readonly mode
function toggleReadonly() {
  const readonlyToggle = document.getElementById('readonlyToggle');

  if (readonlyToggle.checked) {
    editor.setAttribute('readonly', '');
  } else {
    editor.removeAttribute('readonly');
  }

  updateHTMLCode();
}

// Toggle internal add shortcut (Ctrl+I)
function toggleInternalAdd() {
  const internalAddToggle = document.getElementById('internalAddToggle');

  if (internalAddToggle.checked) {
    editor.setAttribute('internal-add-shortcut', '');
  } else {
    editor.removeAttribute('internal-add-shortcut');
  }

  updateHTMLCode();
}

// Reset editor to original sample data
function resetEditor() {
  loadSampleData();
}

// Load initial sample automatically after component is ready
customElements.whenDefined('geojson-editor').then(() => {
  updateEditor();
  loadSampleData();
});

// Expose functions to global scope for onclick handlers
window.toggleColorScheme = toggleColorScheme;
window.openThemeModal = openThemeModal;
window.closeThemeModal = closeThemeModal;
window.applyTheme = applyTheme;
window.resetTheme = resetTheme;
window.copyTheme = copyTheme;
window.toggleReadonly = toggleReadonly;
window.toggleInternalAdd = toggleInternalAdd;
window.resetEditor = resetEditor;
window.clearEventLog = clearEventLog;
window.clearErrorLog = clearErrorLog;
window.openApiModal = openApiModal;
window.closeApiModal = closeApiModal;
window.executeApiMethod = executeApiMethod;
window.apiRemoveAll = apiRemoveAll;
window.apiEmit = apiEmit;
window.loadApiSample = loadApiSample;
window.updateApiCallPreview = updateApiCallPreview;
