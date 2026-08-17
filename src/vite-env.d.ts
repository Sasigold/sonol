/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Public by design. */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon (publishable) key. Public by design — RLS is what protects data. */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
