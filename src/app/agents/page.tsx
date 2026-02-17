'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getAgents } from '@/lib/agents';

type SessionRow = {
  sessionKey: string;
  agentId?: string;
  kind?: string;
  updatedAt?: number;
  displayName?: string;
};

function relativeTime(ts?: number) {
  if (!ts) return '';
  const delta = Date.now() - ts;
  const m = Math.round(delta / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h}h ago`;
  const d = Math.round(h / 24);
  return `${d}d ago`;
}

function statusFromUpdated(ts?: number) {
  if (!ts) return { label: 'Unknown', cls: 'bg-zinc-700 text-zinc-200' };
  const delta = Date.now() - ts;
  if (delta < 2 * 60 * 1000) return { label: 'Active', cls: 'bg-emerald-500/15 text-emerald-300 border-emerald-900/60' };
  if (delta < 15 * 60 * 1000) return { label: 'Idle', cls: 'bg-zinc-800 text-zinc-200 border-zinc-700' };
  return { label: 'Stale', cls: 'bg-amber-500/10 text-amber-300 border-amber-900/50' };
}

export default function AgentsPage() {
  const [discovered, setDiscovered] = useState<{ agentId: string; name?: string }[]>([]);
  const agents = useMemo(() => {
    const cfg = getAgents();
    const merged = new Map(cfg.map((a) => [a.agentId, a]));
    for (const d of discovered) {
      if (!d?.agentId) continue;
      if (!merged.has(d.agentId)) merged.set(d.agentId, { agentId: d.agentId, name: d.name ?? d.agentId });
    }
    // Friday pinned by config (pin=true) remains on top.
    return [...merged.values()].sort((a, b) => {
      const ap = a.pin ? 0 : 1;
      const bp = b.pin ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.name ?? a.agentId).localeCompare(b.name ?? b.agentId);
    });
  }, [discovered]);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const [sR, aR] = await Promise.all([
        fetch('/api/sessions', { cache: 'no-store' }),
        fetch('/api/agents', { cache: 'no-store' }),
      ]);
      if (!sR.ok) throw new Error(await sR.text());

      const sJson = await sR.json();
      const list = sJson?.sessions ?? sJson;
      const safe = Array.isArray(list) ? list : [];
      setSessions(
        safe
          .map((s: any) => ({
            sessionKey: String(s?.sessionKey ?? s?.key ?? s?.id ?? ''),
            agentId: s?.agentId,
            kind: s?.kind,
            updatedAt: s?.updatedAt,
            displayName: s?.displayName,
          }))
          .filter((s: any) => s.sessionKey),
      );

      if (aR.ok) {
        const aJson = await aR.json();
        const agents = aJson?.agents;
        if (Array.isArray(agents)) setDiscovered(agents);
      }
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  function sessionFor(agentId: string) {
    // Prefer the canonical main session key if present.
    const preferred = sessions.find((s) => s.sessionKey === `agent:${agentId}:main`);
    return (
      preferred ??
      sessions.find((s) => s.agentId === agentId) ??
      sessions.find((s) => String((s as any)?.sessionKey ?? '').includes(`:${agentId}:`))
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Agents</h1>
          <p className="mt-1 text-sm text-zinc-400">One gateway. Ops view: who exists, what’s active, and where to nudge.</p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/dashboard" className="text-sm text-zinc-400 underline">Legacy</Link>
          <button
            onClick={refresh}
            className="rounded-lg border border-zinc-700 bg-zinc-950/40 px-3 py-2 text-sm font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-5 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {agents.map((a) => {
          const s = sessionFor(a.agentId);
          const st = statusFromUpdated(s?.updatedAt);
          return (
            <Link
              key={a.agentId}
              href={`/agents/${encodeURIComponent(a.agentId)}`}
              className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 hover:border-zinc-700"
            >
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-base font-semibold">{a.name}</div>
                  <div className="mt-1 text-xs text-zinc-400">{a.purpose ?? a.agentId}</div>
                </div>
                <span className={`rounded-full border px-2.5 py-1 text-xs ${st.cls}`}>{st.label}</span>
              </div>

              <div className="mt-4 text-sm text-zinc-300">
                <div className="flex items-center justify-between">
                  <span className="text-zinc-400">Session</span>
                  <span className="font-mono text-xs text-zinc-300">{s?.sessionKey ?? '—'}</span>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-zinc-400">Updated</span>
                  <span className="text-xs text-zinc-300">{s?.updatedAt ? relativeTime(s.updatedAt) : '—'}</span>
                </div>
              </div>

              <div className="mt-4 text-xs text-zinc-500">Tap to view Now + nudge</div>
            </Link>
          );
        })}
      </div>

      {loading ? <div className="mt-6 text-sm text-zinc-500">Loading…</div> : null}
    </main>
  );
}
