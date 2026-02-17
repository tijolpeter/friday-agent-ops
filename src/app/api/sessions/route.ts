import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

export async function GET() {
  const base = process.env.PROXY_BASE_URL;
  const token = process.env.PROXY_TOKEN;

  if (!base || !token) {
    return NextResponse.json(
      { error: 'Missing PROXY_BASE_URL or PROXY_TOKEN on server' },
      { status: 500 },
    );
  }

  const res = await fetch(`${base}/sessions`, {
    headers: { authorization: `Bearer ${token}` },
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
