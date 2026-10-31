"use client";

import { FormEvent, useState } from "react";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) { setError(body.error || "Unable to sign in."); return; }
      const next = new URLSearchParams(window.location.search).get("next");
      window.location.assign(next?.startsWith("/") ? next : "/");
    } catch { setError("Unable to reach the login service."); }
    finally { setBusy(false); }
  }

  return (
    <main className="min-h-screen bg-[#0f0f0f] text-white flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-2xl">
        <div className="mb-7">
          <div className="text-xs uppercase tracking-[0.28em] text-amber-300/80">Private workspace</div>
          <h1 className="mt-3 text-2xl font-semibold">Node Banana</h1>
          <p className="mt-2 text-sm text-white/55">Enter the shared access password to continue.</p>
        </div>
        <label className="block text-xs uppercase tracking-[0.18em] text-white/50" htmlFor="access-password">Access password</label>
        <input id="access-password" autoFocus type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 w-full rounded-lg border border-white/15 bg-black/30 px-3 py-3 text-sm outline-none focus:border-amber-300/70" />
        {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
        <button disabled={busy || !password} className="mt-6 w-full rounded-lg bg-amber-300 px-4 py-3 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">{busy ? "Checking…" : "Enter workspace"}</button>
      </form>
    </main>
  );
}
