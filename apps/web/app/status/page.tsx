// apps/web/app/status/page.tsx
export const dynamic = 'force-dynamic';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export default async function Page() {
  let db = 'ok';
  try {
    const { error } = await supabaseAdmin.from('workspaces').select('id').limit(1);
    if (error) db = 'error: ' + error.message;
  } catch (e: any) {
    db = 'error: ' + String(e?.message || e);
  }

  return (
    <main className="max-w-xl mx-auto p-6">
      <h1 className="text-2xl font-semibold mb-3">Estado</h1>
      <div className="rounded-xl border p-4 bg-white">
        <div>App: <span className="font-medium">ok</span></div>
        <div>DB: <span className={`font-medium ${db === 'ok' ? 'text-green-700' : 'text-rose-700'}`}>{db}</span></div>
        <div>Hora Panamá: {new Date().toLocaleString('es-PA', { timeZone: 'America/Panama' })}</div>
      </div>
    </main>
  );
}
