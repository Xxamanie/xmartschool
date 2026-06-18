/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_GEMINI_API_KEY?: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_SUPABASE_STORAGE_BUCKET?: string
  readonly VITE_ENABLE_DEMO_AUTH?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
