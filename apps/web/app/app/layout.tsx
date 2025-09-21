// apps/web/app/app/layout.tsx
import Link from 'next/link';
import { cookies } from 'next/headers';

export const metadata = { title: 'ReservoYA — Panel', description: 'Panel operativo' };

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const cookie = cookies().get('app_session');
  const isLogged = !!cookie?.value;
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900">
      <header className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-semibold">ReservoYA — Panel</div>
          <nav className="flex gap-4 text-sm">
            <Link href="/app/dashboard" className="hover:underline">Dashboard</Link>
            <Link href="/app/onboarding" className="hover:underline">Onboarding</Link>
            {isLogged ? (
              <form action="/api/app/logout" method="post">
                <button className="text-red-600 hover:underline">Salir</button>
              </form>
            ) : null}
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
    </div>
  );
}
