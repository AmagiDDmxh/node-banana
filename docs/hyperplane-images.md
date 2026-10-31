# Hyperplane image execution

With `HYPERPLANE_URL` configured on the Node Banana server, its existing OpenAI
image nodes submit to Hyperplane. Gateway credentials are configured only in
Hyperplane; no gateway key is required in the browser.

```text
Node Banana image node → /api/generate
  → Hyperplane /operations/narra-gateway/image
  → Workflow + Postgres Invocation
  → Narra Gateway /v1/images/generations or /edits
  → immutable Artifact
  → /artifacts/:id/content → Node Banana image/asset pipeline
```

Node Banana server configuration:

```dotenv
HYPERPLANE_URL=http://127.0.0.1:13000
HYPERPLANE_API_TOKEN=<match Engine token if configured>
```

Engine configuration:

```dotenv
NARRA_GATEWAY_BASE_URL=https://narra.up.railway.app/v1
NARRA_GATEWAY_API_KEY=<server secret>
NARRA_GATEWAY_IMAGE_MODEL=gpt-image-2.5-flare
NARRA_GATEWAY_IMAGE_MODELS=gpt-image-2.5-flare,gpt-image-2.5-sunburst
```

Choose GPT Image 2.5 Flare or Sunburst in the existing model picker. Discovery
uses the existing static catalog; Engine enforces its configured allowlist.
Generation and reference image editing use the same image node and settings.
Without `HYPERPLANE_URL`, `NARRA_GATEWAY_BASE_URL` switches the same OpenAI
provider implementation to the Narra Gateway directly; otherwise the existing
direct OpenAI path remains available.
LLM nodes continue to use their own provider configuration.

This is a local experimental integration, not a production rollout. It does
not use Compute Agent or claim local GPUs. Invocation persists a request digest
and uses a created → submitting CAS: concurrent calls and replay never submit
another upstream request. Unknown outcomes (including 5xx and transport errors)
require reconciliation. The frontend does not run a fallback model when the
server reports `submission_unknown`. Closing/aborting the waiter does not
cancel a paid generation already running in Engine.

Outputs are stored as immutable Artifact bytes and SHA-256; configured RustFS
is supported, with PostgreSQL bytea as the local fallback. Actual provider
usage/cost, tenant quota enforcement, resumable UI runs and production tenant
authorization are future work. The synchronous gateway response currently
requires `data[0].b64_json`; URL-only output is not automatically downloaded.

Verification is in Hyperplane `engine/verification/gateway-e2e.mjs`; it boots
both servers and tests concurrent/replayed submissions, conflicting input,
ambiguous 503 responses, multipart edits and exact artifact downloads. Run
Engine's bootstrap migration first. Real verification uses
`node verification/node-banana-real.mjs --paid`, explicitly spending one image
request, and saves an evidence JSON plus `/tmp/Hyperplane_NodeBanana_Gateway.png`.
