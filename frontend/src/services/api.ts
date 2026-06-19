import axios from 'axios';

// Since we serve frontend from backend in prod, or proxy in dev, we can use relative path or configured backend url
const API_BASE_URL = import.meta.env.VITE_API_URL || '';

export const geocode = async (query: string) => {
  const response = await axios.get(`${API_BASE_URL}/api/geocode`, {
    params: { q: query },
  });
  return response.data;
};

export const fetchIsochrones = async (location: [number, number], ranges: number[]) => {
  const response = await axios.post(`${API_BASE_URL}/api/isochrones`, {
    locations: [location],
    range: ranges, // e.g., [600, 1200, 1800]
  });
  return response.data;
};

export const fetchOverpassData = async (bbox: string) => {
  const response = await axios.post(`${API_BASE_URL}/api/overpass`, {
    bbox,
  });
  return response.data;
};
