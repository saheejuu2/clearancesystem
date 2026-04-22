import axios from 'axios';

// In dev (Vite proxy): relative path → proxied to http://localhost/clearancesystem/api
// In production (Apache): full URL built from current hostname
const API_BASE_URL = import.meta.env.DEV
  ? '/clearancesystem/api'
  : `${window.location.protocol}//${window.location.hostname}/clearancesystem/api`;

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export default api;
