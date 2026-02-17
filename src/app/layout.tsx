import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Friday Agent Ops',
  description: 'OpenClaw agent dashboard + audit log',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-zinc-950 text-zinc-50">
        {children}
      </body>
    </html>
  );
}
