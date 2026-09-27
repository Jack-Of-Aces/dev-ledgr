/**
 * @file route.ts
 * @description Next.js Route Handler for Supabase Auth PKCE code exchange.
 * Exchanging authorization code for user session, storing session cookies,
 * and seamlessly redirecting to the requested destination. Dev records are
 * created by the Go backend, not written to Supabase tables from here.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { envConfig } from '@/lib/config';
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME } from '@/lib/cookies';
import { authService } from '@/services/auth/authService';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const errorDescription = searchParams.get('error_description');

  // If Supabase itself returned an error in the query params, surface it
  if (errorDescription) {
    console.error('[AuthCallback] Supabase returned an error:', errorDescription);
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&reason=${encodeURIComponent(errorDescription)}`
    );
  }

  if (!code) {
    console.error('[AuthCallback] No code param received. Full URL:', request.url);
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed&reason=no_code`);
  }

  if (!envConfig.hasSupabase) {
    console.error('[AuthCallback] Supabase env vars not configured.');
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed&reason=no_supabase_config`);
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    envConfig.supabaseUrl,
    envConfig.supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — cookies are read-only; safe to ignore.
          }
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[AuthCallback] exchangeCodeForSession failed:', error?.message, error?.status);
    return NextResponse.redirect(
      `${origin}/login?error=auth_callback_failed&reason=${encodeURIComponent(error?.message || 'no_session')}`
    );
  }

  // The backend owns dev records: GET /api/auth/me creates one on first
  // sign-in and returns the authoritative role. Without a backend (sandbox),
  // fall back to the default 'user' role.
  const dev = await authService.fetchDevProfile(data.session.access_token);

  const response = NextResponse.redirect(`${origin}/dashboard`);
  const cookieOptions = {
    path: '/',
    httpOnly: false,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 60 * 60 * 24 * 7,
  };

  // Set DevLedgr session cookies (read by proxy.ts and the API http client)
  response.cookies.set(AUTH_COOKIE_NAME, data.session.access_token, cookieOptions);
  response.cookies.set(ROLE_COOKIE_NAME, dev?.role ?? 'user', cookieOptions);

  return response;
}
