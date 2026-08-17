import { createClient } from '@supabase/supabase-js';

// Get credentials from environment variables if present
const envUrl = import.meta.env.VITE_SUPABASE_URL;
const envAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Or fallback to localStorage for dynamic testing from UI
const localUrl = localStorage.getItem('SUPABASE_URL');
const localAnonKey = localStorage.getItem('SUPABASE_ANON_KEY');

export const supabaseUrl = envUrl || localUrl || '';
export const supabaseAnonKey = envAnonKey || localAnonKey || '';

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;
