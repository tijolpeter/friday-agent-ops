'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
type RpcEvent = any;

type SessionRow = {
  sessionKey: string;
  label?: string;
  agentId?: string;
  kind?: string;
  updatedAt?: number;
};

export default function DashboardPage() {
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [events, setEvents] = useState<RpcEvent[]>([]);
  const [selectedSession, setSelectedSession] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);

  useEffect(() => {
    // connect = start SSE stream
    let es: EventSource | null = null;
    if (connected) {
      es = new EventSource('/api/events');
      es.addEventListener('gw', (e: MessageEvent) => {
        try {
          const ev = JSON.parse(String((e as any).data));
          setEvents((prev) => [ev, ...prev].slice(0, 200));
        } catch {
          // ignore
        }
      });
      es.addEventListener('error', () => {
        // SSE errors are common on deploys; keep last error in UI
        setError('Live events stream error (check PROXY_BASE_URL/PROXY_TOKEN and proxy reachability)');
      });
    }
    return () => {
      try { es?.close(); } catch {}
    };
  }, [connected]);

  async function connect() {
    setError(null);
    try {
      // simple connectivity check
      const r = await fetch('/api/sessions', { cache: 'no-store' });
      if (!r.ok) throw new Error(await r.text());
      setConnected(true);
    } catch (e: any) {
      setConnected(false);
      setError(e?.message ?? String(e));
    }
  }

  async function loadSessions() {
    setError(null);
    try {
      const r = await fetch('/api/sessions', { cache: 'no-store' });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `sessions failed: ${r.status}`);
      }
      const res = await r.json();
      const list = res?.sessions ?? res;
      if (!Array.isArray(list)) {
        throw new Error(`Unexpected sessions payload (expected array): ${JSON.stringify(res).slice(0, 500)}`);
      }
      const rows: SessionRow[] = list.map((s: any) => ({
        sessionKey: s.sessionKey ?? s.key ?? s.id,
        label: s.label,
        agentId: s.agentId,
        kind: s.kind,
        updatedAt: s.updatedAt,
      }));
      setSessions(rows);
      if (!selectedSession && rows[0]?.sessionKey) setSelectedSession(rows[0].sessionKey);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function loadHistory(sessionKey: string) {
    setError(null);
    try {
      const r = await fetch(`/api/history?sessionKey=${encodeURIComponent(sessionKey)}`, { cache: 'no-store' });
      if (!r.ok) {
        const text = await r.text().catch(() => '');
        throw new Error(text || `history failed: ${r.status}`);
      }
      const res = await r.json();
      const msgs = res?.messages ?? res?.history ?? res;
      if (!Array.isArray(msgs)) {
        throw new Error(`Unexpected history payload (expected array): ${JSON.stringify(res).slice(0, 500)}`);
      }
      setHistory(msgs);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <p className="mt-1 text-sm text-zinc-400">Connected via server proxy</p>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/settings" className="text-sm text-zinc-300 underline">
            Settings
          </Link>
          <button
            onClick={connect}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
          >
            {connected ? 'Re-connect' : 'Connect'}
          </button>
          <button
            onClick={loadSessions}
            disabled={!connected}
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            Refresh sessions
          </button>
        </div>
      </div>

      {error ? (
        <div className="mt-6 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Sessions</h2>
            <span className="text-xs text-zinc-500">{sessions.length}</span>
          </div>
          <div className="mt-3 space-y-2">
            {sessions.map((s) => (
              <button
                key={s.sessionKey}
                onClick={() => {
                  setSelectedSession(s.sessionKey);
                  loadHistory(s.sessionKey);
                }}
                className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                  selectedSession === s.sessionKey
                    ? 'border-zinc-500 bg-zinc-950'
                    : 'border-zinc-800 bg-zinc-950/40 hover:border-zinc-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-medium">{s.label ?? s.sessionKey}</span>
                  <span className="text-xs text-zinc-500">{s.kind ?? ''}</span>
                </div>
                <div className="mt-1 text-xs text-zinc-500">{s.agentId ?? ''}</div>
              </button>
            ))}
            {sessions.length === 0 ? (
              <div className="text-sm text-zinc-500">No sessions loaded yet.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Transcript (chat.history)</h2>
            <button
              onClick={() => selectedSession && loadHistory(selectedSession)}
              disabled={!connected || !selectedSession}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs font-medium disabled:opacity-50"
            >
              Reload
            </button>
          </div>

          <div className="mt-4 max-h-[560px] space-y-3 overflow-auto pr-2">
            {history.map((m, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{m.role ?? m.type ?? 'msg'}</span>
                  <span>{m.ts ? new Date(m.ts).toLocaleString() : ''}</span>
                </div>
                <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">
                  {typeof m.content === 'string'
                    ? m.content
                    : typeof m.text === 'string'
                      ? m.text
                      : JSON.stringify(m, null, 2)}
                </pre>
              </div>
            ))}
            {history.length === 0 ? (
              <div className="text-sm text-zinc-500">Select a session to load history.</div>
            ) : null}
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Live events (raw)</h2>
            <span className="text-xs text-zinc-500">showing last {events.length}</span>
          </div>
          <div className="mt-3 max-h-80 overflow-auto rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
            <pre className="text-xs text-zinc-300">{JSON.stringify(events, null, 2)}</pre>
          </div>
        </section>
      </div>
    </main>
  );
}
