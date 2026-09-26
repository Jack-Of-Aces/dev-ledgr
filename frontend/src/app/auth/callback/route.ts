/**
 * @file route.ts
 * @description Next.js Route Handler for Supabase Auth PKCE code exchange.
 * Exchanging authorization code for user session, storing session cookies,
 * and seamlessly redirecting to the requested destination.
 */

import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { envConfig } from '@/lib/config';

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
    // Non-fatal: profile upsert failure should not block auth
    console.warn('[AuthCallback] Profile upsert notice:', upsertErr);
  }

  const response = NextResponse.redirect(`${origin}/dashboard`);

  // Set DevLedgr session cookies
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
