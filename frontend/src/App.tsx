import React, { useState, useEffect, useCallback } from 'react';
import Map from './components/Map';
import { geocode, fetchIsochrones, fetchOverpassData } from './services/api';
import { getBoundingBox, filterFeaturesByPolygon, overpassToGeoJSON } from './utils/geo';
import { MapPin, Navigation, Car, X, ShieldAlert } from 'lucide-react';
import * as turf from '@turf/turf';

// Default to approx Laboutarié coordinates
const DEFAULT_CENTER: [number, number] = [43.7818, 2.1332];

const App: React.FC = () => {
  const [center, setCenter] = useState<[number, number]>(DEFAULT_CENTER);
  const [isochrones, setIsochrones] = useState<any>(null);
  
  // 10, 20, 30 min in seconds
  const ranges = [600, 1200, 1800];
  const [activeRange, setActiveRange] = useState<number>(1800); // Default to 30 min bounds for loading
  
  const [allFeatures, setAllFeatures] = useState<any>(null); // from overpass
  const [filteredFeatures, setFilteredFeatures] = useState<any>(null); // filtered by selected isochrone polygon
  
  const [showPrivate, setShowPrivate] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addressInput, setAddressInput] = useState("");
  
  const [favorites, setFavorites] = useState<string[]>(() => {
    const saved = localStorage.getItem('favorites');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    localStorage.setItem('favorites', JSON.stringify(favorites));
  }, [favorites]);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]);
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addressInput) return;
    setLoading(true);
    setError(null);
    try {
      const geoData = await geocode(addressInput);
      if (geoData && geoData.length > 0) {
        const loc: [number, number] = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
        setCenter(loc);
        loadInitialData(loc);
      } else {
        setError("Adresse introuvable.");
        setLoading(false);
      }
    } catch (err) {
      setError("Erreur de recherche.");
      setLoading(false);
    }
  };

  const loadInitialData = useCallback(async (startLocation: [number, number]) => {
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch Isochrones
      const isoData = await fetchIsochrones([startLocation[1], startLocation[0]], ranges);
      setIsochrones(isoData);

      // We get 3 polygons in isoData.features (assuming ORS returns them in order or with value property)
      // We take the largest one (30 min) to fetch overpass data to minimize API calls
      const maxIsochrone = isoData.features.find((f: any) => f.properties.value === 1800) || isoData.features[isoData.features.length - 1];
      
      const bbox = getBoundingBox(maxIsochrone.geometry);
      
      // 2. Fetch Overpass Data
      const overpassRaw = await fetchOverpassData(bbox);
      const geoJson = overpassToGeoJSON(overpassRaw);
      setAllFeatures(geoJson);
      
    } catch (err: any) {
      console.error(err);
      setError("Erreur lors du chargement des données. Veuillez réessayer.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const geoData = await geocode("Laboutarié, Tarn, France");
        if (geoData && geoData.length > 0) {
          const loc: [number, number] = [parseFloat(geoData[0].lat), parseFloat(geoData[0].lon)];
          setCenter(loc);
          loadInitialData(loc);
        } else {
          loadInitialData(DEFAULT_CENTER);
        }
      } catch (e) {
        // Fallback
        loadInitialData(DEFAULT_CENTER);
      }
    };
    init();
  }, [loadInitialData]);

  // Update filtered features when active range or all features change
  useEffect(() => {
    if (!allFeatures || !isochrones) return;

    // Find the polygon for the active range
    const activePolygonFeature = isochrones.features.find((f: any) => f.properties.value === activeRange);
    if (activePolygonFeature) {
      const filtered = filterFeaturesByPolygon(allFeatures, activePolygonFeature.geometry);
      setFilteredFeatures(filtered);
    }
  }, [activeRange, allFeatures, isochrones]);

  const handleLocateMe = () => {
    if ('geolocation' in navigator) {
      setLoading(true);
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const loc: [number, number] = [position.coords.latitude, position.coords.longitude];
          setCenter(loc);
          loadInitialData(loc);
        },
        (error) => {
          console.error("Geolocation error:", error);
          setError("Impossible de vous localiser.");
          setLoading(false);
        }
      );
    }
  };

  const getFeatureTypeName = (feature: any) => {
    const p = feature.properties;
    if (p.amenity === 'parking') return 'Parking';
    if (p.highway === 'path') return 'Sentier';
    if (p.highway === 'track') return 'Piste / Chemin';
    if (p.highway === 'footway') return 'Chemin piéton';
    if (p.landuse === 'forest' || p.natural === 'wood') return 'Forêt / Bois';
    if (p.landuse === 'meadow' || p.natural === 'grassland') return 'Prairie / Zone ouverte';
    return 'Chemin';
  };

  const getFeatureLength = (feature: any) => {
    if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiLineString') {
      const length = turf.length(feature, { units: 'kilometers' });
      return `${length.toFixed(2)} km`;
    }
    return null;
  };

  const getDirectionsUrl = () => {
    if (!selectedFeature) return '#';
    // Use the first coordinate
    let lat, lon;
    if (selectedFeature.geometry.type === 'Point') {
      [lon, lat] = selectedFeature.geometry.coordinates;
    } else if (selectedFeature.geometry.type === 'LineString') {
      [lon, lat] = selectedFeature.geometry.coordinates[0];
    } else if (selectedFeature.geometry.type === 'Polygon') {
      [lon, lat] = selectedFeature.geometry.coordinates[0][0];
    } else {
      return `https://www.google.com/maps/dir/?api=1&destination=${center[0]},${center[1]}`;
    }
    return `https://www.google.com/maps/dir/?api=1&origin=${center[0]},${center[1]}&destination=${lat},${lon}`;
  };

  return (
    <div className="relative w-full h-screen overflow-hidden flex flex-col md:flex-row bg-slate-50">
      {/* Map Area */}
      <div className="flex-1 h-full relative z-0">
        <Map 
          center={center}
          isochrones={isochrones}
          features={filteredFeatures}
          showPrivate={showPrivate}
          onFeatureClick={setSelectedFeature}
        />
      </div>

      {/* Control Panel / Bottom Sheet */}
      <div className="md:w-96 w-full bg-white shadow-xl z-10 flex flex-col md:h-full h-[40vh] min-h-[300px] overflow-y-auto">
        <div className="p-4 border-b border-slate-100 flex-shrink-0">
          <h1 className="text-xl font-bold text-slate-800 flex items-center gap-2">
            <MapPin className="text-emerald-500" />
            Balade Laboutarié
          </h1>
          <p className="text-sm text-slate-500 mt-1">Trouvez où marcher autour de vous</p>
        </div>

        <div className="p-4 flex-1 overflow-y-auto space-y-6">
          {/* Controls */}
          <div className="space-y-4">
            <form onSubmit={handleSearch} className="flex gap-2">
              <input 
                type="text" 
                value={addressInput} 
                onChange={(e) => setAddressInput(e.target.value)} 
                placeholder="Nouvelle adresse (ex: Laboutarié)" 
                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-sm"
              />
              <button type="submit" className="px-3 py-2 bg-slate-800 text-white rounded-lg text-sm hover:bg-slate-700 transition-colors">Chercher</button>
            </form>

            <button 
              onClick={handleLocateMe}
              className="w-full py-3 px-4 bg-emerald-50 text-emerald-700 font-medium rounded-xl flex items-center justify-center gap-2 hover:bg-emerald-100 transition-colors"
            >
              <Navigation size={18} />
              Ma Position Actuelle
            </button>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700 flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <Car size={16} /> Distance max. en voiture depuis le départ
                </div>
                <span className="text-xs text-slate-500 font-normal">Filtre les tracés par temps de route. Ex: 10 min affichera seulement les tracés à moins de 10 minutes en voiture.</span>
              </label>
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[
                  { val: 600, label: '10 min', color: 'bg-green-500' },
                  { val: 1200, label: '20 min', color: 'bg-yellow-500' },
                  { val: 1800, label: '30 min', color: 'bg-red-500' }
                ].map(r => (
                  <button
                    key={r.val}
                    onClick={() => setActiveRange(r.val)}
                    className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${activeRange === r.val ? 'bg-white shadow-sm text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    <div className="flex items-center justify-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${r.color}`}></div>
                      {r.label}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100">
              <label className="flex items-center justify-between cursor-pointer">
                <span className="text-sm font-medium text-slate-700">Afficher les accès privés</span>
                <div className="relative inline-block w-10 mr-2 align-middle select-none transition duration-200 ease-in">
                  <input type="checkbox" name="toggle" checked={showPrivate} onChange={() => setShowPrivate(!showPrivate)} className="toggle-checkbox absolute block w-5 h-5 rounded-full bg-white border-4 appearance-none cursor-pointer" style={{ top: '2px', left: showPrivate ? '22px' : '2px', transition: 'left 0.2s', borderColor: showPrivate ? '#10b981' : '#cbd5e1' }}/>
                  <div className={`toggle-label block overflow-hidden h-6 rounded-full bg-slate-200 cursor-pointer ${showPrivate ? 'bg-emerald-400' : ''}`}></div>
                </div>
              </label>
            </div>
          </div>

          {/* Loading / Error States */}
          {loading && (
            <div className="p-4 bg-blue-50 text-blue-700 rounded-xl text-center text-sm font-medium animate-pulse">
              Recherche des chemins et isochrones...
            </div>
          )}
          {error && (
            <div className="p-4 bg-red-50 text-red-700 rounded-xl text-sm font-medium flex items-start gap-2">
              <ShieldAlert size={18} className="flex-shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          {/* Legend */}
          {!loading && !error && (
            <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
              <h3 className="text-xs uppercase font-bold text-slate-800 tracking-wider">Légende des tracés</h3>
              <div className="flex flex-col gap-3 text-sm text-slate-700">
                <div className="flex items-center gap-3"><div className="w-8 h-1.5 bg-pink-500 rounded-full"></div> <span className="font-medium">Sentier (petit chemin)</span></div>
                <div className="flex items-center gap-3"><div className="w-8 h-1.5 bg-[#8b5cf6] rounded-full border-dashed border-t-2 border-white"></div> <span className="font-medium">Piste (chemin large / agricole)</span></div>
                <div className="flex items-center gap-3"><div className="w-8 h-1.5 bg-[#3b82f6] rounded-full"></div> <span className="font-medium">Route secondaire / Accès</span></div>
                <div className="flex items-center gap-3"><div className="w-6 h-6 bg-[#15803d] opacity-50 rounded border border-[#14532d]"></div> <span className="font-medium">Forêt / Bois traversable</span></div>
                <div className="flex items-center gap-3"><div className="w-6 h-6 bg-[#84cc16] opacity-50 rounded border border-[#4d7c0f]"></div> <span className="font-medium">Prairie / Zone ouverte</span></div>
              </div>
              <p className="text-xs text-slate-500 italic mt-2">💡 Astuce: Cochez le calque <b>"Itinéraires Balisés"</b> en haut à droite pour superposer les tracés officiels de randonnée (GR, PR) par dessus la carte !</p>
            </div>
          )}
        </div>
      </div>

      {/* Feature Detail Modal / Overlay */}
      {selectedFeature && (
        <div className="absolute bottom-4 left-4 right-4 md:left-auto md:w-80 bg-white rounded-2xl shadow-2xl p-5 z-20 animate-in slide-in-from-bottom-4">
          <button 
            onClick={() => setSelectedFeature(null)}
            className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
          >
            <X size={20} />
          </button>
          
          <h2 className="text-lg font-bold text-slate-800 pr-8">
            {selectedFeature.properties.name || getFeatureTypeName(selectedFeature)}
          </h2>
          
          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p><span className="font-semibold">Type:</span> {getFeatureTypeName(selectedFeature)}</p>
            {selectedFeature.properties.surface && (
              <p><span className="font-semibold">Revêtement:</span> {selectedFeature.properties.surface}</p>
            )}
            {getFeatureLength(selectedFeature) && (
              <p><span className="font-semibold">Longueur:</span> {getFeatureLength(selectedFeature)}</p>
            )}
            {(selectedFeature.properties.access === 'private' || selectedFeature.properties.access === 'no') && (
              <p className="text-red-600 font-semibold flex items-center gap-1">
                <ShieldAlert size={14} /> Accès Privé
              </p>
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <a 
              href={getDirectionsUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium text-center hover:bg-blue-700 transition-colors text-sm"
            >
              Y aller (GPS)
            </a>
            <button 
              onClick={() => toggleFavorite(selectedFeature.properties.id)}
              className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${
                favorites.includes(selectedFeature.properties.id) 
                  ? 'bg-amber-100 text-amber-700 border border-amber-200' 
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              {favorites.includes(selectedFeature.properties.id) ? '★ Favori' : '☆ Favori'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
