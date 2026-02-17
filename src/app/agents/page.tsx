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
  const agents = useMemo(() => getAgents(), []);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    setError(null);
    setLoading(true);
    try {
      const r = await fetch('/api/sessions', { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      const res = await r.json();
      const list = res?.sessions ?? res;
      setSessions(Array.isArray(list) ? list : []);
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
    return preferred ?? sessions.find((s) => s.agentId === agentId) ?? sessions.find((s) => s.sessionKey.includes(`:${agentId}:`));
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
