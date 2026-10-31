import { NextResponse } from "next/server";
import { objectKey, presignDownload, presignUpload, r2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const EXTENSIONS = ["png", "jpg", "jpeg", "gif", "webp", "svg", "mp4", "webm", "mov", "mp3", "wav", "ogg", "flac", "aac", "m4a"];

export async function POST(request: Request) {
  if (!r2Configured()) return NextResponse.json({ configured: false }, { status: 404 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  const workflowPath = typeof body?.workflowPath === "string" ? body.workflowPath : "";
  const folder = typeof body?.folder === "string" ? body.folder : "generations";
  const objectId = typeof body?.objectId === "string" ? body.objectId : "";
  const extension = typeof body?.extension === "string" ? body.extension : "png";
  const contentType = typeof body?.contentType === "string" ? body.contentType : "application/octet-stream";
  if (!workflowPath || !objectId || !EXTENSIONS.includes(extension)) return NextResponse.json({ error: "Invalid object request" }, { status: 400 });
  return NextResponse.json({ configured: true, operation: "put", ...(await presignUpload({ workflowPath, folder, objectId, extension, contentType })) });
}

export async function GET(request: Request) {
  if (!r2Configured()) return NextResponse.json({ configured: false }, { status: 404 });
  const url = new URL(request.url);
  const workflowPath = url.searchParams.get("workflowPath") || "";
  const folder = url.searchParams.get("folder") || "generations";
  const objectId = url.searchParams.get("objectId") || "";
  if (!workflowPath || !objectId) return NextResponse.json({ error: "Invalid object request" }, { status: 400 });
  const result = await presignDownload({ workflowPath, folder, objectId, extensions: EXTENSIONS });
  if (!result) return NextResponse.json({ configured: true, found: false }, { status: 404 });
  return NextResponse.json({ configured: true, found: true, operation: "get", ...result });
}
