/** Node Banana submits images to Hyperplane; provider credentials stay in Engine. */
import { randomUUID } from "node:crypto";
import type { GenerationInput, GenerationOutput } from "@/lib/providers/types";
import { validateOpenAIImageParameters } from "@/lib/providers/openaiImages";

export async function generateWithHyperplane(_requestId: string, input: GenerationInput): Promise<GenerationOutput> {
  const invalid = validateOpenAIImageParameters(input.model.id, input.parameters ?? {});
  if (invalid) return { success: false, statusCode: 400, error: invalid };
  const base = process.env.HYPERPLANE_URL?.replace(/\/$/, "");
  if (!base) return { success: false, statusCode: 503, error: "Hyperplane is not configured." };
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (process.env.HYPERPLANE_API_TOKEN) headers.Authorization = `Bearer ${process.env.HYPERPLANE_API_TOKEN}`;
  // Aborting this HTTP waiter does not cancel a paid invocation already running.
  const deadline = AbortSignal.timeout(540000);
  const signal = input.signal ? AbortSignal.any([input.signal, deadline]) : deadline;
  const dynamicImages = input.dynamicInputs?.image;
  const images = input.images?.length ? input.images : dynamicImages ? (Array.isArray(dynamicImages) ? dynamicImages : [dynamicImages]) : [];
  let runId: string | undefined;
  try {
    const submitted = await fetch(`${base}/operations/narra-gateway/image`, {
      method: "POST", headers, signal, redirect: "error",
      body: JSON.stringify({ operationId: `node-banana-${randomUUID()}`, prompt: input.prompt, model: input.model.id, images, parameters: input.parameters }),
    });
    if (!submitted.ok) return { success: false, statusCode: submitted.status, error: `Hyperplane rejected submission (HTTP ${submitted.status}).` };
    const receipt = await submitted.json();
    runId = receipt.runId;
    if (!runId) throw new Error("missing_run_id");
    while (!signal.aborted) {
      const response = await fetch(`${base}/operations/${encodeURIComponent(runId!)}`, { headers, signal, redirect: "error" });
      if (!response.ok) throw new Error("status_unavailable");
      const snapshot = await response.json();
      if (snapshot.status === "completed") {
        const result = snapshot.result;
        if (result?.status !== "succeeded" || !result.artifact?.id) {
          return { success: false, statusCode: 409, errorCode: result?.status ?? "unknown", error: `Hyperplane ${runId}: ${result?.error ?? "requires reconciliation"}. Do not resubmit automatically.` };
        }
        const artifact = await fetch(`${base}/artifacts/${encodeURIComponent(result.artifact.id)}/content`, { headers, signal, redirect: "error" });
        if (!artifact.ok) throw new Error("artifact_unavailable");
        const bytes = Buffer.from(await artifact.arrayBuffer());
        return { success: true, outputs: [{ type: "image", data: `data:${artifact.headers.get("content-type") ?? "image/png"};base64,${bytes.toString("base64")}` }], generation: { modelId: input.model.id, parameters: input.parameters ?? {} } };
      }
      if (["failed", "cancelled"].includes(snapshot.status)) throw new Error(`operation_${snapshot.status}`);
      await new Promise<void>((resolve, reject) => {
        const abort = () => { clearTimeout(timer); reject(signal.reason); };
        const timer = setTimeout(() => { signal.removeEventListener("abort", abort); resolve(); }, 1000);
        signal.addEventListener("abort", abort, { once: true });
      });
    }
    throw new Error("wait_aborted");
  } catch {
    return { success: false, statusCode: 409, errorCode: "submission_unknown", error: `Hyperplane ${runId ?? "submission"} requires observation or reconciliation. A submitted image operation may still be running; do not submit it again automatically.` };
  }
}
