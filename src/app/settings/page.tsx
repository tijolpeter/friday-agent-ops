'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { loadSettings, saveSettings } from '@/lib/storage';

export default function SettingsPage() {
  const [gatewayUrl, setGatewayUrl] = useState('ws://127.0.0.1:18789');
  const [token, setToken] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const s = loadSettings();
    setGatewayUrl(s.gatewayUrl);
    setToken(s.token ?? '');
  }, []);

  return (
    <main className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Settings</h1>
        <Link href="/dashboard" className="text-sm text-zinc-300 underline">
          Dashboard
        </Link>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
        <label className="block text-sm font-medium">Gateway WS URL</label>
        <input
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={gatewayUrl}
          onChange={(e) => setGatewayUrl(e.target.value)}
          placeholder="wss://your-magicdns/ (or ws://127.0.0.1:18789)"
        />

        <label className="mt-5 block text-sm font-medium">Gateway token (optional)</label>
        <input
          className="mt-2 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="paste token"
        />

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={() => {
              saveSettings({ gatewayUrl, token: token || undefined });
              setSaved(true);
              setTimeout(() => setSaved(false), 1200);
            }}
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
          >
            Save
          </button>

          {saved ? <span className="text-sm text-emerald-400">Saved</span> : null}
        </div>

        <div className="mt-6 text-xs text-zinc-400">
          <p className="font-semibold text-zinc-300">Notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              This MVP connects directly from your browser to the Gateway WebSocket.
            </li>
            <li>
              Device pairing/signature is not implemented yet. For remote usage, you may need
              <span className="text-zinc-200"> gateway.controlUi.allowInsecureAuth=true</span> or to access via a trusted local tunnel.
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
