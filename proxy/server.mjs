import http from 'node:http';
import { WebSocket } from 'ws';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const PROXY_TOKEN = process.env.PROXY_TOKEN;
const GATEWAY_WS_URL = process.env.GATEWAY_WS_URL || 'ws://127.0.0.1:52764';
const GATEWAY_TOKEN = process.env.GATEWAY_TOKEN; // optional

if (!PROXY_TOKEN) {
  console.error('Missing PROXY_TOKEN');
  process.exit(1);
}

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function unauthorized(res) {
  res.writeHead(401, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(JSON.stringify({ error: 'unauthorized' }));
}

function requireAuth(req, res) {
  // Prefer a dedicated header so edge Basic Auth can still use Authorization.
  const x = String(req.headers['x-proxy-token'] || '');
  if (x && x === PROXY_TOKEN) return true;

  // Back-compat: allow Bearer token too.
  const hdr = req.headers['authorization'] || '';
  const m = /^Bearer\s+(.+)$/i.exec(String(hdr));
  if (m && m[1] === PROXY_TOKEN) return true;

  unauthorized(res);
  return false;
}

function uuid() {
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

async function connectGateway() {
  const ws = new WebSocket(GATEWAY_WS_URL);

  await new Promise((resolve, reject) => {
    ws.once('open', resolve);
    ws.once('error', () => reject(new Error('ws open failed')));
    ws.once('close', (code, reason) => reject(new Error(`ws closed early code=${code} reason=${reason}`)));
  });

  // wait for connect.challenge
  const challenge = await new Promise((resolve, reject) => {
    const onMsg = (data) => {
      try {
        const frame = JSON.parse(String(data));
        if (frame?.type === 'event' && frame?.event === 'connect.challenge') {
          ws.off('message', onMsg);
          resolve(frame);
        }
      } catch {
        // ignore
      }
    };
    ws.on('message', onMsg);
    ws.once('close', (code, reason) => reject(new Error(`closed before challenge code=${code} reason=${reason}`)));
  });

  const reqId = uuid();
  const connectReq = {
    type: 'req',
    id: reqId,
    method: 'connect',
    params: {
      minProtocol: 3,
      maxProtocol: 3,
      // Use a schema-valid client identity.
      // (The gateway validates client.id + client.mode against an allowlist.)
      client: {
        id: 'cli',
        displayName: 'friday-proxy',
        version: '0.1.0',
        platform: 'node',
        mode: 'cli',
      },
      role: 'operator',
      scopes: ['operator.read', 'operator.write', 'operator.admin'],
      caps: [],
      commands: [],
      permissions: {},
      auth: { token: GATEWAY_TOKEN },
      locale: 'en-US',
      userAgent: 'friday-agent-ops-proxy/0.1.0',
      // IMPORTANT: do NOT echo back connect.challenge payload here.
      // Device signing is its own field (not implemented in this proxy).
    },
  };

  ws.send(JSON.stringify(connectReq));

  await new Promise((resolve, reject) => {
    const onMsg = (data) => {
      try {
        const frame = JSON.parse(String(data));
        if (frame?.type === 'res' && frame?.id === reqId) {
          ws.off('message', onMsg);
          if (frame.ok) resolve();
          else reject(new Error(`connect failed: ${JSON.stringify(frame.error ?? frame)}`));
        }
      } catch {
        // ignore
      }
    };
    ws.on('message', onMsg);
  });

  return ws;
}

async function gatewayRpc(ws, method, params) {
  const id = uuid();
  const req = { type: 'req', id, method, params };
  ws.send(JSON.stringify(req));
  return await new Promise((resolve, reject) => {
    const onMsg = (data) => {
      try {
        const frame = JSON.parse(String(data));
        if (frame?.type === 'res' && frame?.id === id) {
          ws.off('message', onMsg);
          if (frame.ok) resolve(frame.payload);
          else reject(frame.error ?? frame);
        }
      } catch {
        // ignore
      }
    };
    ws.on('message', onMsg);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host}`);

    if (url.pathname === '/health') {
      return json(res, 200, { ok: true });
    }

    if (!requireAuth(req, res)) return;

    if (url.pathname === '/sessions') {
      const ws = await connectGateway();
      try {
        const payload = await gatewayRpc(ws, 'sessions.list', { limit: 200 });
        return json(res, 200, payload);
      } finally {
        ws.close();
      }
    }

    if (url.pathname === '/history') {
      const sessionKey = url.searchParams.get('sessionKey');
      if (!sessionKey) return json(res, 400, { error: 'missing sessionKey' });
      const ws = await connectGateway();
      try {
        // Note: some gateway builds don't support includeTools on chat.history.
        const payload = await gatewayRpc(ws, 'chat.history', { sessionKey, limit: 200 });
        return json(res, 200, payload);
      } finally {
        ws.close();
      }
    }

    if (url.pathname === '/events') {
      // Server-Sent Events stream of raw gateway events.
      res.writeHead(200, {
        'content-type': 'text/event-stream; charset=utf-8',
        'cache-control': 'no-store',
        connection: 'keep-alive',
      });
      res.write('event: ready\ndata: {}\n\n');

      const ws = await connectGateway();
      const onMsg = (data) => {
        // forward events only (reduce noise)
        try {
          const frame = JSON.parse(String(data));
          if (frame?.type === 'event') {
            res.write(`event: gw\ndata: ${JSON.stringify(frame)}\n\n`);
          }
        } catch {
          // ignore
        }
      };
      ws.on('message', onMsg);

      const heartbeat = setInterval(() => {
        res.write('event: ping\ndata: {}\n\n');
      }, 15000);

      const cleanup = () => {
        clearInterval(heartbeat);
        try { ws.close(); } catch {}
      };

      req.on('close', cleanup);
      req.on('aborted', cleanup);
      return;
    }

    res.writeHead(404, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'not_found' }));
  } catch (e) {
    res.writeHead(500, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'server_error', detail: String(e?.message ?? e) }));
  }
});

server.listen(PORT, () => {
  console.log(`proxy listening on :${PORT}`);
  console.log(`GATEWAY_WS_URL=${GATEWAY_WS_URL}`);
});
