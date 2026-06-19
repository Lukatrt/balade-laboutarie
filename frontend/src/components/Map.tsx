import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, GeoJSON, LayersControl, useMap, ZoomControl } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapProps {
  center: [number, number];
  isochrones: any;
  features: GeoJSON.FeatureCollection | null;
  showPrivate: boolean;
  onFeatureClick: (feature: any) => void;
}

// Fix Leaflet's default icon path issues with Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// A component to automatically re-center the map when the center prop changes
const MapCenterer = ({ center }: { center: [number, number] }) => {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
};

const Map: React.FC<MapProps> = ({ center, isochrones, features, showPrivate, onFeatureClick }) => {

  // Styling for isochrones
  const isochroneStyle = (feature: any) => {
    const value = feature.properties.value; // time in seconds
    let color = '#22c55e'; // 10 min - green
    if (value > 600 && value <= 1200) color = '#eab308'; // 20 min - yellow
    if (value > 1200) color = '#ef4444'; // 30 min - red

    return {
      fillColor: color,
      weight: 1,
      opacity: 0.8,
      color: color,
      fillOpacity: 0.1,
    };
  };

  // Styling for paths and areas
  const featureStyle = (feature: any) => {
    const props = feature.properties;
    const isPrivate = props.access === 'private' || props.access === 'no';
    
    // Base style
    let style: L.PathOptions = {
      weight: 3,
      opacity: 0.8,
    };

    if (isPrivate) {
      style.color = '#9ca3af';
      style.dashArray = '5, 5';
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      // Differentiate official trails vs normal tracks
      if (props.highway === 'path' && (props.sac_scale || props.trail_visibility)) {
         // rough proxy for a more official path if it has sac_scale
         style.color = '#ec4899'; // pinkish
         style.weight = 4;
      } else if (props.highway === 'track') {
         style.color = '#8b5cf6'; // purple
         style.dashArray = '4, 4';
      } else {
         style.color = '#3b82f6'; // blue
      }
    } else if (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon') {
      // Open areas
      if (props.landuse === 'forest' || props.natural === 'wood') {
        style.color = '#15803d'; // dark green
        style.fillColor = '#15803d';
        style.fillOpacity = 0.4;
        style.weight = 1;
      } else if (props.landuse === 'meadow' || props.natural === 'grassland') {
        style.color = '#84cc16'; // light green
        style.fillColor = '#84cc16';
        style.fillOpacity = 0.4;
        style.weight = 1;
      } else {
        style.color = '#14b8a6'; // teal
        style.fillColor = '#14b8a6';
        style.fillOpacity = 0.4;
        style.weight = 1;
      }
    }

    return style;
  };

  const onEachFeature = (feature: any, layer: L.Layer) => {
    layer.on({
      click: () => onFeatureClick(feature)
    });
  };

  // Filter features based on privacy setting
  const displayFeatures = useMemo(() => {
    if (!features) return null;
    return {
      ...features,
      features: features.features.filter(f => {
        const isPrivate = f.properties?.access === 'private' || f.properties?.access === 'no';
        return showPrivate || !isPrivate;
      })
    };
  }, [features, showPrivate]);

  return (
    <MapContainer 
      center={center} 
      zoom={13} 
      className="w-full h-full z-0"
      zoomControl={false}
      preferCanvas={true} // Essential for performance with many paths
    >
      <ZoomControl position="topright" />
      <MapCenterer center={center} />
      
      <LayersControl position="topright">
        <LayersControl.BaseLayer checked name="OpenStreetMap">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
        </LayersControl.BaseLayer>
        
        <LayersControl.BaseLayer name="OpenTopoMap">
          <TileLayer
            attribution='Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            maxZoom={17}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Plan IGN V2 (Détaillé)">
          <TileLayer
            attribution='&copy; <a href="https://www.ign.fr/">IGN</a>'
            url="https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=GEOGRAPHICALGRIDSYSTEMS.PLANIGNV2&STYLE=normal&FORMAT=image/png&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.BaseLayer name="Satellite (Esri)">
          <TileLayer
            attribution='&copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EAP, and the GIS User Community'
            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
            maxZoom={19}
          />
        </LayersControl.BaseLayer>

        <LayersControl.Overlay name="Traces GPS (Heatmap OSM)">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://gps-tile.openstreetmap.org/lines/{z}/{x}/{y}.png"
            maxZoom={19}
            opacity={0.8}
          />
        </LayersControl.Overlay>
      </LayersControl>

      {/* Start Marker */}
      <GeoJSON 
        key={`start-${center.join(',')}`}
        data={{
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [center[1], center[0]] },
          properties: { name: 'Point de départ' }
        } as any}
      />

      {/* Isochrones */}
      {isochrones && (
        <GeoJSON
          key={`isochrones-${isochrones.features.length}`}
          data={isochrones}
          style={isochroneStyle}
        />
      )}

      {/* Walkable Features */}
      {displayFeatures && (
        <GeoJSON
          key={`features-${displayFeatures.features.length}-${showPrivate}`}
          data={displayFeatures}
          style={featureStyle}
          onEachFeature={onEachFeature}
          // use pointToLayer to render parking spaces as markers instead of paths
          pointToLayer={(feature, latlng) => {
            if (feature.properties.amenity === 'parking') {
              return L.circleMarker(latlng, {
                radius: 6,
                fillColor: '#3b82f6',
                color: '#fff',
                weight: 1,
                opacity: 1,
                fillOpacity: 0.8
              });
            }
            return L.marker(latlng);
          }}
        />
      )}
    </MapContainer>
  );
};

export default Map;
