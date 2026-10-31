/**
 * Shared helpers for the generate routes.
 *
 * This is a NON-route module (no HTTP handler exports) so that both
 * `route.ts` and `poll/route.ts` — and tests — can import shared logic
 * without shipping non-handler exports through a Next.js route file.
 */
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import type { GenerateResponse, ImageGenerationMetadata } from "@/types";
import { clearFalInputMappingCache as _clearFalInputMappingCache } from "./providers/fal";
import { putAndPresign, r2Configured } from "@/lib/r2";

/**
 * Re-exported so tests (and any caller) can reset fal's input-mapping cache
 * without importing from a route module.
 */
export const clearFalInputMappingCache = _clearFalInputMappingCache;

/**
 * Build the final NextResponse for a completed generation output.
 * Shared by the synchronous generate route and the async poll route.
 */
export async function buildMediaResponse(output: { type: string; data: string; url?: string }, generation?: ImageGenerationMetadata): Promise<NextResponse> {
  if (r2Configured() && output.data?.startsWith("data:")) {
    const match = /^data:([^;,]+);base64,([\s\S]+)$/.exec(output.data);
    if (match) {
      const stored = await putAndPresign({
        workflowPath: "hosted-generations",
        folder: "generations",
        objectId: randomUUID(),
        extension: match[1].split("/")[1] || "bin",
        contentType: match[1],
        body: Buffer.from(match[2], "base64"),
      });
      if (stored) output = { ...output, data: "", url: stored.url };
    }
  }
  if (output.type === "3d") {
    return NextResponse.json<GenerateResponse>({
      success: true,
      model3dUrl: output.url,
      contentType: "3d",
    });
  }

  if (output.type === "video") {
    const isLarge = !output.data && output.url;
    return NextResponse.json<GenerateResponse>({
      success: true,
      video: isLarge ? undefined : output.data,
      videoUrl: isLarge ? output.url : undefined,
      contentType: "video",
    });
  }

  if (output.type === "audio") {
    const isLarge = !output.data && output.url;
    return NextResponse.json<GenerateResponse>({
      success: true,
      audio: isLarge ? undefined : output.data,
      audioUrl: isLarge ? output.url : undefined,
      contentType: "audio",
    });
  }

  return NextResponse.json<GenerateResponse>({
    success: true,
    image: output.data || undefined,
    imageUrl: output.url,
    ...(generation ? { generation } : {}),
    contentType: "image",
  });
}
