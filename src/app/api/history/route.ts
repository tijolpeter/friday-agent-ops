import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET(req: Request) {
  const base = process.env.PROXY_BASE_URL;
  const token = process.env.PROXY_TOKEN;
  if (!base || !token) {
    return NextResponse.json(
      { error: 'Missing PROXY_BASE_URL or PROXY_TOKEN on server' },
      { status: 500 },
    );
  }

  const { searchParams } = new URL(req.url);
  const sessionKey = searchParams.get('sessionKey');
  if (!sessionKey) {
    return NextResponse.json({ error: 'missing sessionKey' }, { status: 400 });
  }

  const basicUser = process.env.PROXY_BASIC_AUTH_USER;
  const basicPass = process.env.PROXY_BASIC_AUTH_PASS;
  const basic = basicUser && basicPass ? Buffer.from(`${basicUser}:${basicPass}`).toString('base64') : null;

  const res = await fetch(`${base}/history?sessionKey=${encodeURIComponent(sessionKey)}`, {
    headers: {
      ...(basic ? { authorization: `Basic ${basic}` } : {}),
      'x-proxy-token': token,
    },
    cache: 'no-store',
  });

  const text = await res.text();
  return new NextResponse(text, {
    status: res.status,
    headers: {
      'content-type': res.headers.get('content-type') ?? 'application/json',
      'cache-control': 'no-store',
    },
  });
}
