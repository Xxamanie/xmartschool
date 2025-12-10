import { getSupabaseClient } from './supabaseClient';

const bucket = import.meta.env.VITE_SUPABASE_STORAGE_BUCKET || 'files';

export const firebaseStorageService = {
  upload: async (path: string, file: File): Promise<string> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(data.path);
    return urlData.publicUrl;
  },
  getUrl: async (path: string): Promise<string> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data.publicUrl;
  },
  delete: async (path: string): Promise<void> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) throw error;
  },
  listFiles: async (folderPath: string): Promise<string[]> => {
    const supabase = getSupabaseClient();
    if (!supabase) throw new Error('Supabase is not configured');
    const { data, error } = await supabase.storage.from(bucket).list(folderPath);
    if (error) throw error;
    const urls = data?.map((item) => supabase.storage.from(bucket).getPublicUrl(`${folderPath}/${item.name}`).data.publicUrl) || [];
    return urls;
  },
};
