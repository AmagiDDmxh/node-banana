# Public access

The web deployment has a small password gate for personal or friend-only
sharing. It is implemented in `src/proxy.ts` and `/login`; the session is an
HMAC-signed, `HttpOnly`, `SameSite=Lax` cookie. API routes return `401` before
the caller can reach a provider.

Set these **server-only** environment variables in Vercel:

```dotenv
NODE_BANANA_ACCESS_PASSWORD=<shared password>
NODE_BANANA_AUTH_SECRET=<long random secret>
NARRA_GATEWAY_BASE_URL=https://narra.up.railway.app/v1
NARRA_GATEWAY_API_KEY=<gateway key>
R2_ACCOUNT_ID=<cloudflare account id>
R2_ACCESS_KEY_ID=<r2 access key>
R2_SECRET_ACCESS_KEY=<r2 secret>
R2_BUCKET=node-banana-media
```

Do not put the Gateway key in the Node Banana provider settings or in a
`NEXT_PUBLIC_*` variable. The password gate is intentionally simple and is
for a personal project; it is not a multi-tenant identity system. Keep the
deployment behind HTTPS, add platform rate limiting if it is shared broadly,
and rotate both secrets if the password is shared outside the intended group.

When the access variables are absent, local development remains open. A
production deployment with only one of the two access variables configured
fails closed at the proxy.

Vercel deployments do not provide a persistent local filesystem. The hosted
demo therefore disables the local asset library, directory browsing, workflow
file saves, and generation-file loading APIs. Inline image generation through
the configured Gateway remains available; use the desktop/local server or a
future object-storage adapter for projects and media that must persist.

R2 uploads use `POST /api/storage/r2/presign` followed by a browser `PUT` to
the returned URL, so large files do not pass through a Vercel Function. Add a
bucket CORS rule allowing the deployed origin to `PUT` and `GET` objects with
the `Content-Type` header. Keep the bucket private; the server signs each URL
for 15 minutes. The S3 endpoint is
`https://<account-id>.r2.cloudflarestorage.com` and uses region `auto`.
