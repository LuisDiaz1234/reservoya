// apps/web/app/app/dashboard/page.tsx
export const dynamic = 'force-dynamic';

import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import DashboardFilters from '@/components/DashboardFilters';
import BookingsTable from '@/components/BookingsTable';

type Row = {
  id: string;
  customer_name: string | null;
  customer_phone: string | null;
  start_at: string | null;
  status: string;
  payment_status: string;
};

function isTodayPanama(iso: string | null) {
  if (!iso) return false;
  const d = new Date(iso);
  const opts: Intl.DateTimeFormatOptions = { timeZone: 'America/Panama', year: 'numeric', month: '2-digit', day: '2-digit' };
  const today = new Date().toLocaleDateString('es-PA', opts);
  const that  = d.toLocaleDateString('es-PA', opts);
  return today === that;
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

  // Listas para filtros (si existen)
  const [{ data: services = [] }, { data: providers = [] }] = await Promise.all([
    supabaseAdmin.from('services').select('id,name').eq('workspace_id', workspace_id).order('name', { ascending: true }),
    supabaseAdmin.from('providers').select('id,name').eq('workspace_id', workspace_id).order('name', { ascending: true }),
  ]);

  const from = toISOEdge(searchParams.from);
  const to   = toISOEdge(searchParams.to);
  const q    = (searchParams.q || '').trim();
  const serviceId   = (searchParams.serviceId || '').trim();
  const providerId  = (searchParams.providerId || '').trim();

  // Intento con service_id/provider_id y fallback si no existen
  async function fetchBookings(tryWithRelations: boolean) {
    const baseSelect = tryWithRelations
      ? 'id, customer_name, customer_phone, start_at, status, payment_status, service_id, provider_id'
      : 'id, customer_name, customer_phone, start_at, status, payment_status';

    let qb = supabaseAdmin
      .from('bookings')
      .select(baseSelect)
      .eq('workspace_id', workspace_id)
      .order('start_at', { ascending: true });

    if (from) qb = qb.gte('start_at', from);
    if (to) qb = qb.lte('start_at', new Date(new Date(to).getTime() + 24*60*60*1000).toISOString());
    if (q) qb = qb.or(`customer_name.ilike.%${q}%,customer_phone.ilike.%${q}%`);
    if (tryWithRelations && serviceId)  qb = qb.eq('service_id', serviceId);
    if (tryWithRelations && providerId) qb = qb.eq('provider_id', providerId);

    return qb.limit(500);
  }

  let { data: rows, error } = await fetchBookings(true);
  let showService = true, showProvider = true;

  if (error && /does not exist/i.test(error.message)) {
    // Vuelve a intentar sin esas columnas
    const r2 = await fetchBookings(false);
    rows = r2.data ?? [];
    error = r2.error ?? null;
    showService = false;
    showProvider = false;
  }

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-4 border rounded bg-white">
        <h1 className="text-lg font-semibold mb-2">Error cargando reservas</h1>
        <p className="text-sm text-red-700">{error.message}</p>
      </div>
    );
  }

  const list: Row[] = (rows as any[]) || [];
  const todayList = list.filter(r => isTodayPanama(r.start_at));
  const paid = list.filter(r => r.payment_status === 'PAID').length;
  const pending = list.filter(r => r.payment_status !== 'PAID').length;
  const confirmed = list.filter(r => r.status === 'CONFIRMED').length;

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
        <DashboardFilters
          services={services as any}
          providers={providers as any}
          showService={showService}
          showProvider={showProvider}
        />
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

      {/* Tabla (Client Component) */}
      <BookingsTable rows={list} />
    </div>
  );
}
