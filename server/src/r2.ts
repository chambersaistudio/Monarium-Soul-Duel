import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from './env.js';

const endpoint = env.R2_ENDPOINT ?? `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`;
export const r2 = new S3Client({
  region: 'auto', endpoint,
  credentials: { accessKeyId: env.R2_ACCESS_KEY_ID, secretAccessKey: env.R2_SECRET_ACCESS_KEY },
});

export function safeSegment(value: string, fallback: string): string {
  const safe = value.toLowerCase().normalize('NFKD').replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100);
  return safe || fallback;
}

export async function createUploadUrl(objectKey: string, contentType: string): Promise<string> {
  return getSignedUrl(r2, new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: objectKey, ContentType: contentType }), { expiresIn: 300 });
}

export function publicUrl(objectKey: string): string {
  return `${env.R2_PUBLIC_BASE_URL.replace(/\/$/, '')}/${objectKey.split('/').map(encodeURIComponent).join('/')}`;
}
