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
    // If no ?code= was received in the query parameters, Supabase might be using
    // the Implicit Flow where tokens are returned in the URL hash (#access_token=...).
    // Since browsers never transmit hash fragments to the server over HTTP, return a
    // lightweight client-side bridge that parses the hash, sets the session cookies,
    // and seamlessly transitions to /dashboard without ever hitting the login error page.
    const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Authenticating | DevLedgr</title>
  <style>
    body {
      background-color: #0b0f17;
      color: #94a3b8;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 100vh;
      margin: 0;
    }
    .spinner {
      width: 28px;
      height: 28px;
      border: 2px solid rgba(16, 185, 129, 0.2);
      border-top-color: #10b981;
      border-radius: 50%;
      animation: spin 0.8s linear infinite;
      margin-bottom: 16px;
    }
    .msg { font-size: 13px; font-weight: 500; letter-spacing: -0.01em; color: #f1f5f9; }
    @keyframes spin { to { transform: rotate(360deg); } }
  </style>
</head>
<body>
  <div class="spinner"></div>
  <div class="msg">Completing authentication...</div>
  <script>
    try {
      var hash = window.location.hash;
      if (hash && hash.indexOf('access_token=') !== -1) {
        var params = new URLSearchParams(hash.substring(1));
        var token = params.get('access_token');
        if (token) {
          var maxAge = 60 * 60 * 24 * 7;
          var isSecure = window.location.protocol === 'https:';
          var secureFlag = isSecure ? '; Secure' : '';
          document.cookie = 'devledgr_token=' + encodeURIComponent(token) + '; path=/; max-age=' + maxAge + '; SameSite=Lax' + secureFlag;
          document.cookie = 'devledgr_role=user; path=/; max-age=' + maxAge + '; SameSite=Lax' + secureFlag;
          window.location.replace('/dashboard');
        } else {
          window.location.replace('/login?error=auth_callback_failed&reason=no_token');
        }
      } else {
        window.location.replace('/login?error=auth_callback_failed&reason=no_code');
      }
    } catch (e) {
      window.location.replace('/login?error=auth_callback_failed&reason=client_exception');
    }
  </script>
</body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, max-age=0',
      },
    });
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
