// apps/web/app/app/dashboard/page.tsx
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DashboardFilters from '@/components/DashboardFilters';
import SelectBulk from '@/components/SelectBulk';

type Row = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_at: string | null;
  status: string;
  payment_status: string;
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

function toISOEdge(dateStr?: string | null) {
  if (!dateStr) return null;
  try { return new Date(dateStr + 'T00:00:00Z').toISOString(); } catch { return null; }
}

export default async function DashboardPage({ searchParams }: { searchParams: { [k: string]: string | undefined } }) {
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

  const from = toISOEdge(searchParams.from);
  const to = toISOEdge(searchParams.to);
  const q = (searchParams.q || '').trim();

  let qb = supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_phone, start_at, status, payment_status')
    .eq('workspace_id', workspace_id)
    .order('start_at', { ascending: true });

  if (from) qb = qb.gte('start_at', from);
  if (to) qb = qb.lte('start_at', new Date(new Date(to).getTime() + 24*60*60*1000).toISOString());
  if (q) qb = qb.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);

  const { data: rows, error } = await qb.limit(500);

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 border rounded bg-white">
        <h1 className="text-lg font-semibold mb-2">Error cargando reservas</h1>
        <p className="text-sm text-red-700">{error.message}</p>
      </div>
    );
  }

  const list: Row[] = rows || [];
  const todayList = list.filter(r => isTodayPanama(r.start_at));
  const paid = list.filter(r => r.payment_status === 'PAID').length;
  const pending = list.filter(r => r.payment_status !== 'PAID').length;
  const confirmed = list.filter(r => r.status === 'CONFIRMED').length;
  const ids = list.map(r => r.id);

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard — {workspace_slug}</h1>
          <p className="text-sm text-gray-600">Rol: <span className="font-medium">{role}</span></p>
        </div>
      </div>

      {/* Filtros */}
      <section className="rounded-2xl border bg-white p-3 shadow-sm">
        <DashboardFilters />
      </section>

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

      {/* Tabla + acciones masivas */}
      <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
        <SelectBulk ids={ids} />
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-gray-50 border-b text-xs text-gray-600">
              <tr>
                <th className="text-left px-3 py-2">Sel.</th>
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
                  <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin reservas en el rango.</td>
                </tr>
              )}
              {list.map((r, idx) => {
                const paidTone = r.payment_status === 'PAID' ? 'green' : 'amber';
                const stTone =
                  r.status === 'CONFIRMED' ? 'green' :
                  r.status === 'CANCELLED' ? 'red' : 'slate';
                return (
                  <tr key={r.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                    <td className="px-3 py-2">
                      <input type="checkbox" onChange={() => (globalThis as any).toggleBulkRow?.(r.id)} />
                    </td>
                    <td className="px-3 py-2">{fmt(r.start_at)}</td>
                    <td className="px-3 py-2">{r.customer_name || '-'}</td>
                    <td className="px-3 py-2">{r.customer_phone || '-'}</td>
                    <td className="px-3 py-2"><Badge tone={paidTone as any}>{r.payment_status}</Badge></td>
                    <td className="px-3 py-2"><Badge tone={stTone as any}>{r.status}</Badge></td>
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
