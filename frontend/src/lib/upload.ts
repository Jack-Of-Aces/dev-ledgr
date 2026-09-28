/**
 * @file upload.ts
 * @description Client helper for uploading images to Cloudinary via /api/upload.
 */

export interface UploadImageResult {
  url: string;
  publicId?: string;
  width?: number;
  height?: number;
}

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json();

  if (!res.ok || data.unconfigured || !data.url) {
    throw new Error(data.error || 'Cloudinary upload unconfigured or unavailable.');
  }

  return data.url;
}
