import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  const base = process.env.PROXY_BASE_URL;
  const token = process.env.PROXY_TOKEN;
  const basicUser = process.env.PROXY_BASIC_AUTH_USER;
  const basicPass = process.env.PROXY_BASIC_AUTH_PASS;
  const basic = basicUser && basicPass ? Buffer.from(`${basicUser}:${basicPass}`).toString('base64') : null;

  if (!base || !token) {
    return NextResponse.json(
      { error: 'Missing PROXY_BASE_URL or PROXY_TOKEN on server' },
      { status: 500 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.sessionKey || !body?.message) {
    return NextResponse.json({ error: 'missing sessionKey/message' }, { status: 400 });
  }

  const upstream = await fetch(`${base}/nudge`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(basic ? { authorization: `Basic ${basic}` } : {}),
      'x-proxy-token': token,
    },
    body: JSON.stringify({ sessionKey: body.sessionKey, message: body.message }),
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}
