// apps/web/app/app/dashboard/page.tsx
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

type Row = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_at: string | null;
  status: string;
  payment_status: string;
  provider_id: string | null;
  service_id: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('es-PA', { timeZone: 'America/Panama', dateStyle: 'short', timeStyle: 'short' });
}

function isTodayPanama(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' };
  const today = new Date().toLocaleDateString('es-PA', opts);
  const that  = d.toLocaleDateString('es-PA', opts);
  return today === that;
}

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green'|'amber'|'red'|'slate' }) {
  const tones: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red:   'bg-rose-100 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${tones[tone]}`}>{children}</span>;
}

export default async function DashboardPage() {
  const token = cookies().get('app_session')?.value || '';
  let workspace_id = '';
  let workspace_slug = '';
  let role: 'admin' | 'operator' = 'operator';
  try {
    const decoded = JSON.parse(Buffer.from(token.split('.')[0], 'base64url').toString('utf-8'));
    workspace_id = decoded.workspace_id;
    workspace_slug = decoded.workspace_slug;
    role = decoded.role;
  } catch {}

  if (!workspace_id) {
    return <div className="text-red-600">No autenticado.</div>;
  }

  // Traemos reservas recientes (últimos 7 días y próximas 14) para métricas y tabla
  const now = new Date();
  const past = new Date(now.getTime() - 7*24*60*60*1000).toISOString();
  const future = new Date(now.getTime() + 14*24*60*60*1000).toISOString();

  const { data: rows } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_phone, start_at, status, payment_status, provider_id, service_id')
    .eq('workspace_id', workspace_id)
    .gte('start_at', past)
    .lte('start_at', future)
    .order('start_at', { ascending: true })
    .limit(200);

  const list = rows || [];

  // Métricas
  const todayList = list.filter(r => isTodayPanama(r.start_at));
  const paid = list.filter(r => r.payment_status === 'PAID').length;
  const pending = list.filter(r => r.payment_status !== 'PAID').length;
  const confirmed = list.filter(r => r.status === 'CONFIRMED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard — {workspace_slug}</h1>
          <p className="text-sm text-gray-600">Vista operativa del negocio. Rol: <span className="font-medium">{role}</span></p>
        </div>
      </div>

      {/* Métricas */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Reservas (hoy)</div>
          <div className="mt-2 text-2xl font-semibold">{todayList.length}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Confirmadas</div>
          <div className="mt-2 text-2xl font-semibold">{confirmed}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Pagadas</div>
          <div className="mt-2 text-2xl font-semibold">{paid}</div>
        </div>
        <div className="rounded-2xl border bg-white p-4 shadow-sm">
          <div className="text-xs text-gray-500">Pendiente de pago</div>
          <div className="mt-2 text-2xl font-semibold">{pending}</div>
        </div>
      </section>

      {/* Filtro simple (solo UI por ahora) */}
      <section className="rounded-2xl border bg-white p-3 shadow-sm">
        <div className="flex flex-col md:flex-row gap-3 items-center">
          <input placeholder="Buscar cliente o teléfono…" className="w-full md:w-80 border rounded-lg px-3 py-2 text-sm"
                 onChange={() => { /* placeholder - se puede mejorar con client components */ }} />
          <div className="text-xs text-gray-500">* Filtro visual (si quieres filtro real, lo hacemos con un Client Component)</div>
        </div>
      </section>

      {/* Tabla */}
      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Fecha/Hora</th>
                <th className="text-left px-3 py-2">Cliente</th>
                <th className="text-left px-3 py-2">Teléfono</th>
                <th className="text-left px-3 py-2">Pago</th>
                <th className="text-left px-3 py-2">Estado</th>
                <th className="text-left px-3 py-2">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-gray-500">Sin reservas en el rango.</td>
                </tr>
              )}
              {list.map((r, idx) => {
                const paidTone = r.payment_status === 'PAID' ? 'green' : 'amber';
                const stTone =
                  r.status === 'CONFIRMED' ? 'green' :
                  r.status === 'CANCELLED' ? 'red' : 'slate';
                return (
                  <tr key={r.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2">{fmt(r.start_at)}</td>
                    <td className="px-3 py-2">{r.customer_name || '-'}</td>
                    <td className="px-3 py-2">{r.customer_phone || '-'}</td>
                    <td className="px-3 py-2">
                      <Badge tone={paidTone as any}>{r.payment_status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <Badge tone={stTone as any}>{r.status}</Badge>
                    </td>
                    <td className="px-3 py-2">
                      <div className="flex gap-2">
                        <form action="/api/app/bookings/confirm" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50">Confirmar</button>
                        </form>
                        <form action="/api/app/bookings/cancel" method="post">
                          <input type="hidden" name="id" value={r.id} />
                          <button className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50 text-rose-700">Cancelar</button>
                        </form>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
