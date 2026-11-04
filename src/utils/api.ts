import axios from 'axios';
import { getSupabaseClient } from '../services/supabaseClient';
import { getApiSession } from './sessionState';

export const DEMO_AUTH_TOKEN_KEY = 'smartschool_auth_token';
export const DEMO_AUTH_USER_KEY = 'smartschool_auth_user';
export const buildSchoolScopedConfig = (schoolId?: string) => schoolId ? { params: { schoolId } } : undefined;

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

// Request interceptor
apiClient.interceptors.request.use(async (config) => {
  const request = config as typeof config & { __sessionGeneration?: number; __expectedSessionGeneration?: number; __authToken?: string };
  const session = getApiSession();
  if (request.__expectedSessionGeneration !== undefined && request.__expectedSessionGeneration !== session.generation) {
    throw new axios.CanceledError('Session changed before the request was sent');
  }
  request.__sessionGeneration = session.generation;
  if (session.schoolId && !config.url?.startsWith('/auth/')) {
    const explicitSchool = new URL(config.url || '', 'https://local.invalid').searchParams.has('schoolId');
    if (!explicitSchool) config.params = { schoolId: session.schoolId, ...config.params };
    if (config.data && typeof config.data === 'object' && !Array.isArray(config.data) && !(config.data instanceof FormData)) {
      config.data = { schoolId: session.schoolId, ...config.data };
    }
  }
  try {
    const demoToken = window.localStorage.getItem(DEMO_AUTH_TOKEN_KEY);
    if (demoToken) {
      config.headers.Authorization = `Bearer ${demoToken}`;
      request.__authToken = demoToken;
      return config;
    }

    const supabase = getSupabaseClient();
    if (supabase) {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
        request.__authToken = token;
      }
    }
  } catch (error) {
    console.warn('Failed to get auth token:', error);
  }

  if (getApiSession().generation !== session.generation) throw new axios.CanceledError('Session changed before the request was sent');
  return config;
}, (error) => {
  console.error('[API] Request error:', error);
  return Promise.reject(error);
});

// Response interceptor
apiClient.interceptors.response.use(
  (response) => {
    if (response.data?.ok === false) throw new axios.AxiosError(response.data.message || 'The server rejected this operation.', 'ERR_BAD_RESPONSE', response.config, response.request, response);
    return response;
  },
  async (error) => {
    if (error.code === 'ECONNABORTED') {
      console.error('[API] Request timeout');
    } else if (error.response) {
      console.error(`[API] Error ${error.response.status}:`, error.response.data);
      if (error.response.status === 401) {
        // Session expired or invalid — clear stale credentials so the login
        // page is shown on the next navigation instead of a silent empty state.
        const sent = error.config as { __sessionGeneration?: number; __authToken?: string } | undefined;
        const currentToken = window.localStorage.getItem(DEMO_AUTH_TOKEN_KEY)
          || (await getSupabaseClient()?.auth.getSession())?.data.session?.access_token;
        if (sent?.__authToken && sent.__authToken === currentToken && sent.__sessionGeneration === getApiSession().generation) {
          window.localStorage.removeItem(DEMO_AUTH_TOKEN_KEY);
          window.localStorage.removeItem(DEMO_AUTH_USER_KEY);
          window.dispatchEvent(new CustomEvent('auth:session-expired', { detail: { generation: sent.__sessionGeneration } }));
        }
      }
    } else if (error.request) {
      console.error('[API] Network error - no response received');
    } else {
      console.error('[API] Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

export default apiClient;

