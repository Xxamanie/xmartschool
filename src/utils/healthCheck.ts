import { api } from '../../services/api';

export interface HealthStatus {
  backend: 'healthy' | 'unhealthy' | 'unknown';
  supabase: 'healthy' | 'unhealthy' | 'unknown';
  frontend: 'healthy';
}

export const performHealthCheck = async (): Promise<HealthStatus> => {
  const status: HealthStatus = {
    backend: 'unknown',
    supabase: 'unknown',
    frontend: 'healthy'
  };

  // Check backend health
  try {
    const response = await api.health();
    status.backend = response.ok ? 'healthy' : 'unhealthy';
  } catch (error) {
    console.warn('Backend health check failed:', error);
    status.backend = 'unhealthy';
  }

  // Check Supabase connection
  try {
    const { getSupabaseClient } = await import('../services/supabaseClient');
    const supabase = getSupabaseClient();
    if (supabase) {
      // Try to get session to verify connection
      const { data, error } = await supabase.auth.getSession();
      status.supabase = error ? 'unhealthy' : 'healthy';
    } else {
      status.supabase = 'unhealthy';
    }
  } catch (error) {
    console.warn('Supabase health check failed:', error);
    status.supabase = 'unhealthy';
  }

  return status;
};