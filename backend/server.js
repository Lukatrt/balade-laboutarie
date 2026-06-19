import express from 'express';
import cors from 'cors';
import axios from 'axios';
import { LRUCache } from 'lru-cache';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const ORS_KEY = process.env.ORS_KEY;

// CORS configuration - allow all in dev
app.use(cors());
app.use(express.json());

// Caches
// Nominatim is strict on quotas, let's cache aggressively (1 week TTL)
const geocodeCache = new LRUCache({
  max: 500,
  ttl: 1000 * 60 * 60 * 24 * 7,
});

// ORS Isochrones cache (1 week TTL)
const isochroneCache = new LRUCache({
  max: 100,
  ttl: 1000 * 60 * 60 * 24 * 7,
});

// Overpass cache (1 week TTL)
const overpassCache = new LRUCache({
  max: 50,
  ttl: 1000 * 60 * 60 * 24 * 7,
  maxSize: 100 * 1024 * 1024, // 100MB max memory for large responses
  sizeCalculation: (value) => JSON.stringify(value).length,
});

// Helper for caching
const withCache = async (cache, key, fetcher) => {
  if (cache.has(key)) {
    console.log(`Cache hit for ${key}`);
    return cache.get(key);
  }
  console.log(`Cache miss for ${key}, fetching...`);
  const data = await fetcher();
  cache.set(key, data);
  return data;
};

// 1. Geocoding endpoint
app.get('/api/geocode', async (req, res) => {
  const { q } = req.query;
  if (!q) return res.status(400).json({ error: 'Missing q parameter' });

  try {
    const data = await withCache(geocodeCache, `geocode:${q}`, async () => {
      const response = await axios.get('https://nominatim.openstreetmap.org/search', {
        params: {
          q,
          format: 'json',
          limit: 1,
        },
        headers: {
          'User-Agent': 'BaladeLaboutarie/1.0 (laboutarie@example.com)' // required by Nominatim terms
        }
      });
      return response.data;
    });
    res.json(data);
  } catch (error) {
    console.error('Geocode error:', error.message);
    res.status(500).json({ error: 'Geocoding failed' });
  }
});

// 2. Isochrones endpoint (OpenRouteService)
app.post('/api/isochrones', async (req, res) => {
  const { locations, range } = req.body;
  if (!locations || !range) return res.status(400).json({ error: 'Missing locations or range' });

  // Make a deterministic cache key from the request body
  const cacheKey = `isochrones:${JSON.stringify(locations)}:${JSON.stringify(range)}`;

  try {
    const data = await withCache(isochroneCache, cacheKey, async () => {
      // If we don't have a key, we'll try to provide a mock response for testing if the user hasn't set one
      if (!ORS_KEY || ORS_KEY === 'YOUR_ORS_KEY_HERE') {
        throw new Error("Missing OpenRouteService API key");
      }

      const response = await axios.post('https://api.openrouteservice.org/v2/isochrones/driving-car', {
        locations,
        range,
        range_type: 'time',
        smoothing: 25,
      }, {
        headers: {
          'Authorization': ORS_KEY,
          'Content-Type': 'application/json'
        }
      });
      return response.data;
    });
    res.json(data);
  } catch (error) {
    console.error('Isochrone error:', error.response?.data || error.message);
    res.status(error.response?.status || 500).json({ error: 'Isochrone fetch failed', details: error.response?.data || error.message });
  }
});

// 3. Overpass endpoint
app.post('/api/overpass', async (req, res) => {
  const { bbox } = req.body;
  if (!bbox) return res.status(400).json({ error: 'Missing bbox parameter (minlon,minlat,maxlon,maxlat)' });
  
  const cacheKey = `overpass:${bbox}`;

  try {
    const data = await withCache(overpassCache, cacheKey, async () => {
      const query = `
        [out:json][timeout:60];
        (
          way["highway"~"^(path|footway|track|bridleway|cycleway|steps|pedestrian|living_street)$"](${bbox});
          way["landuse"~"^(forest|meadow)$"](${bbox});
          way["natural"~"^(wood|heath|grassland|scrub)$"](${bbox});
          way["leisure"~"^(park|nature_reserve|common)$"](${bbox});
          way["amenity"="parking"](${bbox});
        );
        out geom;
      `;
      
      const response = await axios.post('https://overpass-api.de/api/interpreter', query, {
        headers: {
          'Content-Type': 'text/plain',
          'User-Agent': 'BaladeLaboutarie/1.0 (laboutarie@example.com)'
        }
      });
      return response.data;
    });
    res.json(data);
  } catch (error) {
    console.error('Overpass error:', error.message);
    res.status(500).json({ error: 'Overpass fetch failed' });
  }
});

// Serve frontend in production
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

app.get('*', (req, res) => {
  res.sendFile(path.join(frontendDistPath, 'index.html'), (err) => {
    if (err) {
      res.status(500).send('Frontend not built yet. Run npm run build in frontend directory.');
    }
  });
});

app.listen(PORT, () => {
  console.log(`Backend proxy running on port ${PORT}`);
});
