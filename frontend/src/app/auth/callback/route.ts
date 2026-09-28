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
  const next = searchParams.get('next') || '/dashboard';

  if (code && envConfig.hasSupabase) {
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
              // The `setAll` method was called from a Server Component or route handler.
            }
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session) {
      const user = data.user;
      const meta = user.user_metadata || {};
      const username = meta.user_name || meta.preferred_username || user.email?.split('@')[0] || 'developer';
      const fullName = meta.full_name || meta.name || username;
      const avatarUrl = meta.avatar_url || meta.picture || '';

      // Upsert profile in Supabase profiles table
      try {
        await supabase.from('profiles').upsert(
          {
            id: user.id,
            username,
            name: fullName,
            avatar_url: avatarUrl,
            github_url: meta.user_name ? `https://github.com/${meta.user_name}` : null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'id' }
        );
      } catch (upsertErr) {
        console.warn('[AuthCallback] Profile upsert notice:', upsertErr);
      }

      // Check if user has completed onboarding
      const isGoogle = user.app_metadata?.provider === 'google';
      const isOnboarded = Boolean(meta.onboarding_completed);
      const destination = (!isOnboarded || isGoogle) ? `${origin}/onboarding` : `${origin}${next}`;

      const response = NextResponse.redirect(destination);

      // Set DevLedgr session cookies (both devledgr_session and devledgr_token for compatibility)
      response.cookies.set('devledgr_session', data.session.access_token, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      response.cookies.set('devledgr_token', data.session.access_token, {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      response.cookies.set('devledgr_role', 'user', {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 7,
      });

      return response;
    }
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

  // Fallback if code exchange fails or is missing
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
