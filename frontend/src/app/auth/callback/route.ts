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
import { AUTH_COOKIE_NAME, ROLE_COOKIE_NAME, REFRESH_COOKIE_NAME } from '@/lib/cookies';
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

      // The dev record comes from the backend, which creates it on this very
      // request via EnsureDev and owns every column on it. Nothing is written
      // from here.
      //
      // This route used to upsert into the profiles table with the anon key
      // first. That could never have worked: migration 0004 revoked write
      // access for anon and authenticated because the Data API has no access
      // to the table at all. It was invisible, because the Supabase client
      // resolves with { data: null, error } rather than throwing, so the
      // try/catch never fired and the rejected write was dropped on the floor.
      // Leaving it in was a trap — it also wrote a username derived from
      // metadata, so the day anyone did grant that access, every sign-in would
      // have reset a handle the dev had deliberately changed.
      const dev = await authService.fetchDevProfile(data.session.access_token);
      const role = dev?.role ?? 'user';

      // The dev record decides whether onboarding is done, not the token.
      // onboarding_completed in user_metadata is editable by the account
      // holder, so a value there cannot be allowed to drive the redirect.
      //
      // A Google login also has to link a GitHub account before it can submit
      // proof, and that used to be decided by metadata as well, which sent
      // every Google user back to onboarding on every single sign-in. Read from
      // the record, it clears once they have actually linked one.
      const isGoogle = user.app_metadata?.provider === 'google';
      const needsOnboarding = dev
        ? !dev.onboardingCompleted || (isGoogle && !dev.githubConnected)
        : !meta.onboarding_completed;
      const destination = needsOnboarding ? `${origin}/onboarding` : `${origin}${next}`;

      const response = NextResponse.redirect(destination);

      const cookieOptions = {
        path: '/',
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax' as const,
        maxAge: 60 * 60 * 24 * 7,
      };

      response.cookies.set(AUTH_COOKIE_NAME, data.session.access_token, cookieOptions);
      response.cookies.set(ROLE_COOKIE_NAME, role, cookieOptions);
      // The exchange above happened in this route, not in the browser, so the
      // client has no Supabase session and nothing to auto-refresh. Handing the
      // refresh token over lets it establish one on mount; without this the
      // access token above expired after an hour with no way to renew and every
      // subsequent request came back 401.
      if (data.session.refresh_token) {
        response.cookies.set(REFRESH_COOKIE_NAME, data.session.refresh_token, cookieOptions);
      }

      return response;
    }
  }

  // Fallback if code exchange fails or is missing
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
