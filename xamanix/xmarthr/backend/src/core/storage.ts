/* eslint-disable @typescript-eslint/no-var-requires */
import crypto from 'crypto';
import { env } from './env';

/**
 * Document blob storage abstraction. Two drivers:
 *  - "db"  (default): the file lives as base64 in the DB — zero infra, portable.
 *  - "s3"  : the file goes to S3 / any S3-compatible bucket (MinIO, R2, Spaces).
 *
 * The S3 SDK is loaded lazily via require(), so it is only needed when the s3
 * driver is actually selected — db-only deployments don't need it installed.
 */
export interface StoredBlob { driver: string; storageKey: string | null; contentBase64: string | null }

function s3Client(): any {
  const { S3Client } = require('@aws-sdk/client-s3');
  return new S3Client({
    region: env.s3.region,
    ...(env.s3.endpoint ? { endpoint: env.s3.endpoint, forcePathStyle: true } : {}),
    ...(env.s3.accessKeyId ? { credentials: { accessKeyId: env.s3.accessKeyId, secretAccessKey: env.s3.secretAccessKey } } : {}),
  });
}

export async function storeBlob(base64: string, mime: string): Promise<StoredBlob> {
  if (env.storageDriver === 's3') {
    const { PutObjectCommand } = require('@aws-sdk/client-s3');
    const key = `${env.s3.prefix}/${new Date().toISOString().slice(0, 10)}/${crypto.randomUUID()}`;
    await s3Client().send(new PutObjectCommand({ Bucket: env.s3.bucket, Key: key, Body: Buffer.from(base64, 'base64'), ContentType: mime }));
    return { driver: 's3', storageKey: key, contentBase64: null };
  }
  return { driver: 'db', storageKey: null, contentBase64: base64 };
}

export async function readBlob(doc: { storageDriver: string; storageKey: string | null; contentBase64: string | null }): Promise<Buffer> {
  if (doc.storageDriver === 's3' && doc.storageKey) {
    const { GetObjectCommand } = require('@aws-sdk/client-s3');
    const out = await s3Client().send(new GetObjectCommand({ Bucket: env.s3.bucket, Key: doc.storageKey }));
    const chunks: Buffer[] = [];
    for await (const c of out.Body as AsyncIterable<Uint8Array>) chunks.push(Buffer.from(c));
    return Buffer.concat(chunks);
  }
  return Buffer.from(doc.contentBase64 ?? '', 'base64');
}

/** Base64 of a document's content, regardless of driver (used for hashing). */
export async function readBlobBase64(doc: { storageDriver: string; storageKey: string | null; contentBase64: string | null }): Promise<string> {
  if (doc.storageDriver === 's3') return (await readBlob(doc)).toString('base64');
  return doc.contentBase64 ?? '';
}
