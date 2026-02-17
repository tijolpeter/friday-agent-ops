'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { getAgents } from '@/lib/agents';

type SessionRow = {
  sessionKey: string;
  agentId?: string;
  kind?: string;
  updatedAt?: number;
};

function normalizeText(m: any): string {
  if (typeof m?.content === 'string') return m.content;
  if (typeof m?.text === 'string') return m.text;
  if (Array.isArray(m?.content)) {
    return m.content
      .map((p: any) => {
        if (typeof p === 'string') return p;
        if (p?.type === 'text' && typeof p?.text === 'string') return p.text;
        if (p?.type === 'thinking' && typeof p?.thinking === 'string') return `[thinking]\n${p.thinking}`;
        return JSON.stringify(p);
      })
      .join('\n');
  }
  return JSON.stringify(m, null, 2);
}

function isToolish(m: any): boolean {
  const r = String(m?.role ?? '').toLowerCase();
  return r.includes('tool');
}

export default function AgentDetailPage({ params }: { params: { agentId: string } }) {
  const agentId = decodeURIComponent(params.agentId);
  const agents = useMemo(() => getAgents(), []);
  const agent = agents.find((a) => a.agentId === agentId);

  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [sessionKey, setSessionKey] = useState<string>('');
  const [history, setHistory] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [nudge, setNudge] = useState('');
  const [sending, setSending] = useState(false);

  async function loadSessions() {
    const r = await fetch('/api/sessions', { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    const res = await r.json();
    const list = res?.sessions ?? res;
    if (!Array.isArray(list)) throw new Error('sessions payload unexpected');
    const safe: SessionRow[] = list
      .map((s: any) => ({
        sessionKey: String(s?.sessionKey ?? s?.key ?? s?.id ?? ''),
        agentId: s?.agentId,
        kind: s?.kind,
        updatedAt: s?.updatedAt,
      }))
      .filter((s: any) => s.sessionKey);

    setSessions(safe);

    const preferred = safe.find((s: any) => s.sessionKey === `agent:${agentId}:main`);
    const pick =
      preferred ??
      safe.find((s: any) => s.agentId === agentId) ??
      safe.find((s: any) => String(s.sessionKey).includes(`:${agentId}:`));
    if (pick?.sessionKey) setSessionKey(pick.sessionKey);
  }

  async function loadHistory(key: string) {
    const r = await fetch(`/api/history?sessionKey=${encodeURIComponent(key)}`, { cache: 'no-store' });
    if (!r.ok) throw new Error(await r.text());
    const res = await r.json();
    const msgs = res?.messages ?? res?.history ?? res;
    if (!Array.isArray(msgs)) throw new Error('history payload unexpected');
    setHistory(msgs);
  }

  async function refreshAll() {
    setError(null);
    try {
      await loadSessions();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  useEffect(() => {
    refreshAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId]);

  useEffect(() => {
    if (!sessionKey) return;
    setError(null);
    loadHistory(sessionKey).catch((e: any) => setError(e?.message ?? String(e)));
  }, [sessionKey]);

  async function sendNudge(text: string) {
    if (!sessionKey) {
      setError('No sessionKey found for this agent');
      return;
    }
    setSending(true);
    setError(null);
    try {
      const r = await fetch('/api/nudge', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionKey, message: text }),
      });
      if (!r.ok) throw new Error(await r.text());
      setNudge('');
      // optimistic refresh
      await loadHistory(sessionKey);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    } finally {
      setSending(false);
    }
  }

  const session = sessions.find((s) => s.sessionKey === sessionKey);

  return (
    <main className="mx-auto max-w-6xl px-5 py-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Link href="/agents" className="text-sm text-zinc-400 underline">← Agents</Link>
          <h1 className="mt-2 text-xl font-semibold">{agent?.name ?? agentId}</h1>
          <p className="mt-1 text-sm text-zinc-400">{agent?.purpose ?? ''}</p>
          <div className="mt-2 text-xs text-zinc-500 font-mono">{sessionKey || 'No session found yet'}</div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={refreshAll} className="rounded-lg border border-zinc-700 px-3 py-2 text-sm">Refresh</button>
          <button onClick={() => sessionKey && loadHistory(sessionKey)} className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900">Reload transcript</button>
        </div>
      </div>

      {error ? (
        <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/40 p-4 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="mt-6 grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-1">
          <h2 className="text-sm font-semibold text-zinc-200">Now</h2>
          <div className="mt-3 text-sm text-zinc-300">
            <div className="flex items-center justify-between">
              <span className="text-zinc-400">Kind</span>
              <span>{session?.kind ?? '—'}</span>
            </div>
            <div className="mt-2 flex items-center justify-between">
              <span className="text-zinc-400">Updated</span>
              <span>{session?.updatedAt ? new Date(session.updatedAt).toLocaleString() : '—'}</span>
            </div>
          </div>

          <div className="mt-5">
            <h3 className="text-sm font-semibold text-zinc-200">Nudge</h3>
            <textarea
              value={nudge}
              onChange={(e) => setNudge(e.target.value)}
              placeholder="Give a short instruction…"
              className="mt-2 h-28 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
            />
            <div className="mt-2 flex flex-wrap gap-2">
              <button
                onClick={() => sendNudge(nudge)}
                disabled={sending || !nudge.trim()}
                className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
              >
                {sending ? 'Sending…' : 'Send'}
              </button>
              <button
                onClick={() => sendNudge('Give me a 1-line status + next step.')}
                disabled={sending}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
              >
                Ask status
              </button>
              <button
                onClick={() => sendNudge('Stop what you are doing and tell me what’s blocked.')}
                disabled={sending}
                className="rounded-lg border border-zinc-700 px-3 py-2 text-sm disabled:opacity-50"
              >
                Stop + explain
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-zinc-200">Transcript</h2>
            <span className="text-xs text-zinc-500">{history.length} messages</span>
          </div>
          <div className="mt-4 max-h-[70vh] space-y-3 overflow-auto pr-2">
            {history.map((m, idx) => (
              <div key={idx} className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-3">
                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <span>{m.role ?? m.type ?? 'msg'}</span>
                  <span>{m.ts ? new Date(m.ts).toLocaleString() : ''}</span>
                </div>
                {isToolish(m) ? (
                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm text-zinc-300">
                      {m.toolName ? `Tool: ${m.toolName}` : 'Tool payload'} (click to expand)
                    </summary>
                    <pre className="mt-2 whitespace-pre-wrap break-words text-xs text-zinc-200">{normalizeText(m)}</pre>
                  </details>
                ) : (
                  <pre className="mt-2 whitespace-pre-wrap break-words text-sm text-zinc-200">{normalizeText(m)}</pre>
                )}
              </div>
            ))}
            {history.length === 0 ? <div className="text-sm text-zinc-500">No transcript loaded yet.</div> : null}
          </div>
        </section>
      </div>

      {/* Mobile sticky actions */}
      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-800 bg-zinc-950/90 p-3 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-2 px-2">
          <input
            value={nudge}
            onChange={(e) => setNudge(e.target.value)}
            placeholder="Nudge…"
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          />
          <button
            onClick={() => sendNudge(nudge)}
            disabled={sending || !nudge.trim()}
            className="rounded-lg bg-white px-3 py-2 text-sm font-medium text-zinc-900 disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </div>
      <div className="h-20 lg:hidden" />
    </main>
  );
}
