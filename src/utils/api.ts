import axios from 'axios';
import { getSupabaseClient } from '../services/supabaseClient';

let API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'https://xmartschool.onrender.com/api';
if (!API_BASE_URL.startsWith('http://') && !API_BASE_URL.startsWith('https://')) {
  API_BASE_URL = `https://${API_BASE_URL}`;
}
API_BASE_URL = API_BASE_URL.replace(/\/$/, '');

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

apiClient.interceptors.request.use(async (config) => {
  const supabase = getSupabaseClient();
  if (supabase) {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  console.log(`[API] ${config.method?.toUpperCase()} ${config.baseURL}${config.url}`);
  return config;
});

apiClient.interceptors.response.use(
  (response) => {
    console.log(`[API] Response OK: ${response.status}`);
    return response;
  },
  (error) => {
    console.error(`[API] Error: ${error.message}`, error);
    return Promise.reject(error);
  }
);

export default apiClient;
