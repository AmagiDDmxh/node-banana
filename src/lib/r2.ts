import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createHash } from "node:crypto";

const EXPIRY_SECONDS = 900;

function config() {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucket = process.env.R2_BUCKET?.trim();
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) return null;
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

export function r2Configured(): boolean {
  return config() !== null;
}

function client(c: NonNullable<ReturnType<typeof config>>) {
  return new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
  });
}

function safePart(value: string): string {
  return value.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(0, 160) || "root";
}

export function objectPrefix(workflowPath: string, folder: string): string {
  const digest = createHash("sha256").update(workflowPath).digest("hex").slice(0, 24);
  return `node-banana/${digest}/${safePart(folder)}`;
}

export function objectKey(workflowPath: string, folder: string, objectId: string, extension: string): string {
  return `${objectPrefix(workflowPath, folder)}/${safePart(objectId)}.${safePart(extension)}`;
}

export async function presignUpload(input: { workflowPath: string; folder: string; objectId: string; extension: string; contentType: string }) {
  const c = config();
  if (!c) return null;
  const key = objectKey(input.workflowPath, input.folder, input.objectId, input.extension);
  const url = await getSignedUrl(client(c), new PutObjectCommand({ Bucket: c.bucket, Key: key, ContentType: input.contentType }), { expiresIn: EXPIRY_SECONDS });
  return { key, url, expiresIn: EXPIRY_SECONDS };
}

export async function presignDownload(input: { workflowPath: string; folder: string; objectId: string; extensions: string[] }) {
  const c = config();
  if (!c) return null;
  const s3 = client(c);
  for (const extension of input.extensions) {
    const key = objectKey(input.workflowPath, input.folder, input.objectId, extension);
    try {
      await s3.send(new HeadObjectCommand({ Bucket: c.bucket, Key: key }));
      const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: c.bucket, Key: key }), { expiresIn: EXPIRY_SECONDS });
      return { key, url, expiresIn: EXPIRY_SECONDS };
    } catch {
      // Try the next supported extension.
    }
  }
  return null;
}

export async function putAndPresign(input: { workflowPath: string; folder: string; objectId: string; extension: string; contentType: string; body: Uint8Array }) {
  const c = config();
  if (!c) return null;
  const s3 = client(c);
  const key = objectKey(input.workflowPath, input.folder, input.objectId, input.extension);
  await s3.send(new PutObjectCommand({ Bucket: c.bucket, Key: key, ContentType: input.contentType, Body: input.body }));
  const url = await getSignedUrl(s3, new GetObjectCommand({ Bucket: c.bucket, Key: key }), { expiresIn: EXPIRY_SECONDS });
  return { key, url, expiresIn: EXPIRY_SECONDS };
}
