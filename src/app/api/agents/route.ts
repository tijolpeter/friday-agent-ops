import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

// v1: derive agents from sessions.list so the UI can auto-populate.
// This avoids requiring manual agents.json for discovery.
export async function GET() {
  const base = process.env.PROXY_BASE_URL;
  const token = process.env.PROXY_TOKEN;
  const basicUser = process.env.PROXY_BASIC_AUTH_USER;
  const basicPass = process.env.PROXY_BASIC_AUTH_PASS;
  const basic = basicUser && basicPass ? Buffer.from(`${basicUser}:${basicPass}`).toString('base64') : null;

  if (!base || !token) {
    return NextResponse.json({ error: 'Missing PROXY_BASE_URL or PROXY_TOKEN on server' }, { status: 500 });
  }

  const res = await fetch(`${base}/sessions`, {
    headers: {
      ...(basic ? { authorization: `Basic ${basic}` } : {}),
      'x-proxy-token': token,
    },
    cache: 'no-store',
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    return NextResponse.json({ error: 'upstream_error', detail: text || res.statusText }, { status: 500 });
  }

  const json = await res.json();
  const list = json?.sessions ?? json;
  const sessions = Array.isArray(list) ? list : [];

  const agentIds = new Set<string>();
  for (const s of sessions) {
    const key = String(s?.sessionKey ?? s?.key ?? s?.id ?? '');
    const m = /^agent:([^:]+):/.exec(key);
    if (m?.[1]) agentIds.add(m[1]);
    if (s?.agentId) agentIds.add(String(s.agentId));
  }

  const agents = [...agentIds]
    .filter(Boolean)
    .map((agentId) => ({ agentId, name: agentId }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return NextResponse.json({ agents });
}
