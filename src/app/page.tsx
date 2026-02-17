import Link from 'next/link';

export default function Home() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-8">
        <h1 className="text-2xl font-semibold">Friday Agent Ops</h1>
        <p className="mt-2 text-zinc-300">
          Connect to your OpenClaw Gateway WebSocket and view sessions + audit events.
        </p>

        <div className="mt-6 flex gap-3">
          <Link
            href="/settings"
            className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-zinc-900"
          >
            Settings
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-700 px-4 py-2 text-sm font-medium"
          >
            Dashboard
          </Link>
        </div>

        <p className="mt-6 text-sm text-zinc-400">
          Tip: if connecting remotely, you’ll typically want wss:// via Tailscale Serve.
        </p>
      </div>
    </main>
  );
}
