/**
 * @file route.ts
 * @description Secure Server Route for uploading images to Cloudinary.
 * Generates an authenticated SHA-1 signature using CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET,
 * and streams the file to Cloudinary CDN, returning the persistent HTTPS secure_url.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(req: Request) {
  try {
    const cloudName =
      process.env.CLOUDINARY_CLOUD_NAME ||
      process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey =
      process.env.CLOUDINARY_API_KEY ||
      process.env.NEXT_PUBLIC_CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json(
        {
          error: 'Cloudinary environment variables not configured on server.',
          unconfigured: true,
        },
        { status: 200 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file');

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'No valid image file provided in form-data.' },
        { status: 400 }
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
    cloudinaryPayload.append('file', file);
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
