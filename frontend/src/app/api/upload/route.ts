/**
 * @file route.ts
 * @description Secure Server Route for uploading images to Cloudinary.
 * Generates an authenticated SHA-1 signature using CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET,
 * and streams the file to Cloudinary CDN, returning the persistent HTTPS secure_url.
 *
 * Authenticated, rate limited and size capped. This route holds a signed upload
 * credential, so an open one is a free Cloudinary proxy on the app's account.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { checkRateLimit } from '@/lib/rate-limiter';
import { resolveServerSession } from '@/lib/server-session';

/**
 * Avatar size ceiling. The settings form already refuses anything over 5MB and
 * requires an `image/*` type, so this matches what a legitimate client sends.
 * Overridable for deployments fronting a different asset size.
 */
const MAX_UPLOAD_BYTES = Number(process.env.CLOUDINARY_MAX_UPLOAD_BYTES) || 5 * 1024 * 1024;

/**
 * multipart/form-data framing (boundaries, part headers) on top of the file.
 * The declared Content-Length covers the envelope as well as the payload, so
 * the pre-read check has to allow for it.
 */
const MAX_REQUEST_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;

const TOO_LARGE = `Image is too large. The maximum size is ${Math.floor(
  MAX_UPLOAD_BYTES / (1024 * 1024)
)}MB.`;

export async function POST(req: Request) {
  // 1. Sliding Window Rate Limiting (10 uploads per minute per IP)
  const rl = checkRateLimit(req, 'avatar-upload', { limit: 10, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: `Rate limit exceeded. Please wait ${rl.resetInSeconds} seconds before uploading again.`,
        limit: rl.limit,
        remaining: 0,
        resetInSeconds: rl.resetInSeconds,
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rl.resetInSeconds),
          'X-RateLimit-Limit': String(rl.limit),
          'X-RateLimit-Remaining': '0',
        },
      }
    );
  }

  // 2. Authenticate. This route had no session check at all, so anyone who
  // could reach it could spend the app's Cloudinary quota and publish into its
  // media library. The settings form falls back to a local preview when this
  // throws, so a 401 degrades the avatar picker rather than breaking it.
  const session = await resolveServerSession(req);
  if (!session.ok) {
    return NextResponse.json({ error: session.error, code: session.code }, { status: session.status });
  }

  try {
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.CLOUDINARY_API_KEY ||
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      // 503, not 200. The old status told the client the upload had been
      // handled when nothing had been, and the `unconfigured` flag was the only
      // thing distinguishing success from failure — a shape a caller reading
      // only res.ok could not see. The flag stays so upload.ts can still report
      // the reason.
      return NextResponse.json(
        {
          error: 'Image uploads are not configured on this server.',
          unconfigured: true,
        },
        { status: 503 }
      );
    }

    // 3. Refuse an oversized body before it is buffered. Content-Length is
    // client-supplied, so this is a cheap first pass, not a guarantee.
    const declaredLength = Number(req.headers.get('content-length') || '0');
    if (Number.isFinite(declaredLength) && declaredLength > MAX_REQUEST_BYTES) {
      return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
    }

    // 4. `await req.formData()` materialises the entire body in memory, so the
    // declared length cannot be trusted on its own: a chunked request with no
    // Content-Length, or one that lies about it, still has to be measured.
    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No valid image file provided in form-data.' },
        { status: 400 }
      );
    }

    const uploadedBytes = Array.from(formData.values()).reduce(
      (total, entry) => total + (entry instanceof Blob ? entry.size : 0),
      0
    );
    if (uploadedBytes > MAX_UPLOAD_BYTES) {
      return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
    }

    // 5. Content type. Cloudinary's image endpoint would reject anything that
    // is not an image anyway, but the point of checking here is that this route
    // should not be the thing that finds out.
    if (!file.type || !file.type.toLowerCase().startsWith('image/')) {
      return NextResponse.json(
        { error: 'Only image uploads are accepted (PNG, JPG, WEBP, SVG).' },
        { status: 415 }
      );
    }

    // Prepare timestamp and signature for authenticated upload
    const timestamp = Math.round(new Date().getTime() / 1000);
    const folder = 'devledgr/avatars';

    // Signature must be sorted alphabetically by parameter key
    const stringToSign = `folder=${folder}&timestamp=${timestamp}${apiSecret}`;
    const signature = crypto
      .createHash('sha1')
      .update(stringToSign)
      .digest('hex');

    // Build payload to Cloudinary
    const cloudinaryPayload = new FormData();
    cloudinaryPayload.append('file', file, 'upload');
    cloudinaryPayload.append('api_key', apiKey);
    cloudinaryPayload.append('timestamp', timestamp.toString());
    cloudinaryPayload.append('folder', folder);
    cloudinaryPayload.append('signature', signature);

    const uploadRes = await fetch(
      `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
      {
        method: 'POST',
        body: cloudinaryPayload,
      }
    );

    const data = await uploadRes.json();

    if (!uploadRes.ok) {
      console.error('[Cloudinary Upload Error]', data);
      return NextResponse.json(
        { error: data.error?.message || 'Failed to upload image to Cloudinary' },
        { status: uploadRes.status }
      );
    }

    return NextResponse.json({
      url: data.secure_url || data.url,
      publicId: data.public_id,
      format: data.format,
      width: data.width,
      height: data.height,
    });
  } catch (error: unknown) {
    console.error('[Upload Handler Exception]', error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Internal server error processing image upload',
      },
      { status: 500 }
    );
  }
}
