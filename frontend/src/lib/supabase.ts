/**
 * @file supabase.ts
 * @description Resilient Supabase client provider.
 * Returns a live Supabase client if NEXT_PUBLIC_SUPABASE_URL is configured,
 * or null if running in local sandbox / offline preview mode.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { envConfig } from './config';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!envConfig.hasSupabase) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createClient(envConfig.supabaseUrl, envConfig.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    });
  }

  return supabaseClient;
}

export const supabase = getSupabase();
