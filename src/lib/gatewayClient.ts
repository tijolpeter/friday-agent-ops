export type GatewayConnectOptions = {
  gatewayUrl: string; // ws://host:18789 or wss://...
  token?: string;
  password?: string;
  clientId?: string;
  clientVersion?: string;
  platform?: string;
  scopes?: string[];
};

export type RpcRequest = {
  type: 'req';
  id: string;
  method: string;
  params?: any;
};

export type RpcResponse = {
  type: 'res';
  id: string;
  ok: boolean;
  payload?: any;
  error?: any;
};

export type RpcEvent = {
  type: 'event';
  event: string;
  payload?: any;
  seq?: number;
  stateVersion?: number;
};

export type GatewayFrame = RpcRequest | RpcResponse | RpcEvent;

function uuid(): string {
  // good-enough ID for UI correlation (not crypto)
  return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
}

export class GatewayClient {
  private ws?: WebSocket;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: any) => void }>();
  private listeners = new Set<(ev: RpcEvent) => void>();

  async connect(opts: GatewayConnectOptions): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) return;

    const url = opts.gatewayUrl;
    const ws = new WebSocket(url);
    this.ws = ws;

    const scopes = opts.scopes ?? ['operator.read', 'operator.write', 'operator.admin'];

    await new Promise<void>((resolve, reject) => {
      const onOpen = () => resolve();
      const onError = (e: any) => reject(e);
      ws.addEventListener('open', onOpen, { once: true });
      ws.addEventListener('error', onError, { once: true });
    });

    // Wait for connect.challenge (the gateway sends it first)
    const challenge = await new Promise<RpcEvent>((resolve, reject) => {
      const onMessage = (msg: MessageEvent) => {
        try {
          const frame = JSON.parse(String(msg.data)) as GatewayFrame;
          if (frame.type === 'event' && frame.event === 'connect.challenge') {
            ws.removeEventListener('message', onMessage);
            resolve(frame);
          }
        } catch {
          // ignore
        }
      };
      const onClose = () => reject(new Error('socket closed before challenge'));
      ws.addEventListener('message', onMessage);
      ws.addEventListener('close', onClose, { once: true });
    });

    // NOTE: We intentionally omit device identity/signature for MVP.
    // This requires either localhost auto-approval OR gateway.controlUi.allowInsecureAuth=true.
    const reqId = uuid();
    const connectReq: RpcRequest = {
      type: 'req',
      id: reqId,
      method: 'connect',
      params: {
        minProtocol: 3,
        maxProtocol: 3,
        client: {
          id: opts.clientId ?? 'friday-agent-ops',
          version: opts.clientVersion ?? '0.1.0',
          platform: opts.platform ?? 'web',
          mode: 'operator',
        },
        role: 'operator',
        scopes,
        caps: [],
        commands: [],
        permissions: {},
        auth: {
          token: opts.token,
          password: opts.password,
        },
        locale: typeof navigator !== 'undefined' ? navigator.language : 'en-US',
        userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'friday-agent-ops',
        // We pass nonce/ts back only for future device-auth implementation.
        challenge: (challenge as any).payload,
      },
    };

    const helloPromise = new Promise<void>((resolve, reject) => {
      const onMessage = (msg: MessageEvent) => {
        try {
          const frame = JSON.parse(String(msg.data)) as GatewayFrame;
          if (frame.type === 'res' && frame.id === reqId) {
            ws.removeEventListener('message', onMessage);
            if (frame.ok) resolve();
            else reject(frame.error ?? new Error('connect failed'));
          }
        } catch {
          // ignore
        }
      };
      ws.addEventListener('message', onMessage);
    });

    ws.send(JSON.stringify(connectReq));
    await helloPromise;

    ws.addEventListener('message', (msg) => {
      let frame: GatewayFrame | undefined;
      try {
        frame = JSON.parse(String(msg.data)) as GatewayFrame;
      } catch {
        return;
      }

      if (frame.type === 'res') {
        const p = this.pending.get(frame.id);
        if (!p) return;
        this.pending.delete(frame.id);
        if (frame.ok) p.resolve(frame.payload);
        else p.reject(frame.error ?? new Error('RPC error'));
      } else if (frame.type === 'event') {
        for (const l of this.listeners) l(frame);
      }
    });
  }

  onEvent(listener: (ev: RpcEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  rpc<T = any>(method: string, params?: any): Promise<T> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return Promise.reject(new Error('not connected'));
    }
    const id = uuid();
    const req: RpcRequest = { type: 'req', id, method, params };
    const p = new Promise<T>((resolve, reject) => this.pending.set(id, { resolve, reject }));
    this.ws.send(JSON.stringify(req));
    return p;
  }

  close(): void {
    this.ws?.close();
    this.ws = undefined;
    this.pending.clear();
    this.listeners.clear();
  }
}
