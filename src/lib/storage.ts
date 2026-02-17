const KEY = 'friday_agent_ops_settings_v1';

export type StoredSettings = {
  gatewayUrl: string;
  token?: string;
};

export function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') return { gatewayUrl: 'ws://127.0.0.1:18789' };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { gatewayUrl: 'ws://127.0.0.1:18789' };
    const parsed = JSON.parse(raw);
    return {
      gatewayUrl: parsed.gatewayUrl ?? 'ws://127.0.0.1:18789',
      token: parsed.token,
    };
  } catch {
    return { gatewayUrl: 'ws://127.0.0.1:18789' };
  }
}

export function saveSettings(s: StoredSettings) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY, JSON.stringify(s));
}
