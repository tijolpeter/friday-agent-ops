export type ProxyClientOptions = {
  proxyBaseUrl: string; // https://your-proxy.example.com
  proxyToken: string;
};

export class ProxyClient {
  constructor(private opts: ProxyClientOptions) {}

  private async getJson(path: string) {
    const res = await fetch(`${this.opts.proxyBaseUrl}${path}`, {
      headers: {
        authorization: `Bearer ${this.opts.proxyToken}`,
      },
      cache: 'no-store',
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`proxy ${res.status}: ${text || res.statusText}`);
    }
    return await res.json();
  }

  sessions() {
    return this.getJson('/sessions');
  }

  history(sessionKey: string) {
    return this.getJson(`/history?sessionKey=${encodeURIComponent(sessionKey)}`);
  }
}
