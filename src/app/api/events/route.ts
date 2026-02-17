export const runtime = 'nodejs';

export async function GET() {
  const base = process.env.PROXY_BASE_URL;
  const token = process.env.PROXY_TOKEN;

  if (!base || !token) {
    return new Response(
      JSON.stringify({ error: 'Missing PROXY_BASE_URL or PROXY_TOKEN on server' }),
      { status: 500, headers: { 'content-type': 'application/json' } },
    );
  }

  const basicUser = process.env.PROXY_BASIC_AUTH_USER;
  const basicPass = process.env.PROXY_BASIC_AUTH_PASS;
  const basic = basicUser && basicPass ? Buffer.from(`${basicUser}:${basicPass}`).toString('base64') : null;

  const upstream = await fetch(`${base}/events`, {
    headers: {
      ...(basic ? { authorization: `Basic ${basic}` } : {}),
      'x-proxy-token': token,
    },
    cache: 'no-store',
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: {
      'content-type': upstream.headers.get('content-type') ?? 'text/event-stream',
      'cache-control': 'no-store',
      connection: 'keep-alive',
    },
  });
}
