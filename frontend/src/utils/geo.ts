import * as turf from '@turf/turf';

// Get a bounding box string (minlon,minlat,maxlon,maxlat) from a geojson polygon (isochrone)
export const getBoundingBox = (polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon): string => {
  const bbox = turf.bbox(polygon);
  // overpass expects: minlat, minlon, maxlat, maxlon
  // turf returns: minX (lon), minY (lat), maxX (lon), maxY (lat)
  return `${bbox[1]},${bbox[0]},${bbox[3]},${bbox[2]}`;
};

// Filter overpass features that are within the provided polygon (isochrone)
export const filterFeaturesByPolygon = (
  features: GeoJSON.FeatureCollection,
  polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon
): GeoJSON.FeatureCollection => {
  const filteredFeatures: GeoJSON.Feature[] = [];

  features.features.forEach((feature) => {
    if (feature.geometry.type === 'Point') {
      if (turf.booleanPointInPolygon(feature.geometry.coordinates, polygon)) {
        filteredFeatures.push(feature);
      }
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'Polygon') {
      // Check if any point of the line/polygon is inside the isochrone
      // For a more precise but slower check, one could intersect. 
      // booleanIntersects or checking first point is usually enough for a fast approximation.
      try {
        if (turf.booleanIntersects(feature, polygon)) {
          filteredFeatures.push(feature);
        }
      } catch (e) {
        // Turf booleanIntersects can fail on invalid geometries, fallback to a point check
        const point = turf.point(
          feature.geometry.type === 'LineString' 
            ? feature.geometry.coordinates[0] 
            : feature.geometry.coordinates[0][0]
        );
        if (turf.booleanPointInPolygon(point, polygon)) {
          filteredFeatures.push(feature);
        }
      }
    }
  });

  return turf.featureCollection(filteredFeatures);
};

// Convert Overpass JSON format to standard GeoJSON
export const overpassToGeoJSON = (data: any): GeoJSON.FeatureCollection => {
  const features: GeoJSON.Feature[] = [];

  data.elements.forEach((element: any) => {
    const properties = element.tags || {};
    properties.type = element.type;
    properties.id = element.id;

    if (element.type === 'node' && element.lat && element.lon) {
      features.push(turf.point([element.lon, element.lat], properties));
    } else if (element.type === 'way' && element.geometry) {
      const coordinates = element.geometry.map((g: any) => [g.lon, g.lat]);
      // If first and last points are the same, it might be a polygon (e.g. landuse)
      if (
        coordinates.length > 3 && 
        coordinates[0][0] === coordinates[coordinates.length - 1][0] && 
        coordinates[0][1] === coordinates[coordinates.length - 1][1] &&
        (properties.landuse || properties.natural || properties.leisure)
      ) {
        features.push(turf.polygon([coordinates], properties));
      } else {
        features.push(turf.lineString(coordinates, properties));
      }
    }
  });

  return turf.featureCollection(features);
};
