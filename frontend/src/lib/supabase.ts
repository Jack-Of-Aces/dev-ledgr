/**
 * @file supabase.ts
 * @description Resilient Supabase client provider.
 * Returns a live Supabase client if NEXT_PUBLIC_SUPABASE_URL is configured,
 * or null if running in local sandbox / offline preview mode.
 */

import { createBrowserClient } from '@supabase/ssr';
import { SupabaseClient } from '@supabase/supabase-js';
import { envConfig } from './config';

let supabaseClient: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (!envConfig.hasSupabase) {
    return null;
  }

  if (!supabaseClient) {
    supabaseClient = createBrowserClient(
      envConfig.supabaseUrl,
      envConfig.supabaseAnonKey
    );
  }

  return supabaseClient;
}

export const supabase = getSupabase();

