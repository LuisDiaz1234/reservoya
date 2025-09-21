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

  const { data: rows } = await supabaseAdmin
    .from('bookings')
    .select('id, customer_name, customer_phone, start_at, status, payment_status, provider_id, service_id')
    .eq('workspace_id', workspace_id)
    .order('start_at', { ascending: true })
    .limit(50);

  return (
    <div>
      <h1 className="text-xl font-semibold mb-2">Dashboard — {workspace_slug}</h1>
      <p className="text-sm text-gray-600 mb-4">Rol: {role}</p>

      {!rows?.length && <div className="p-4 border rounded bg-white">Sin reservas todavía.</div>}

      {!!rows?.length && (
        <div className="grid gap-2">
          <div className="grid grid-cols-6 text-xs font-medium text-gray-500 px-2">
            <div>Fecha/Hora</div><div>Cliente</div><div>Teléfono</div><div>Pago</div><div>Estado</div><div>Acciones</div>
          </div>
          {rows.map((r: Row) => (
            <div key={r.id} className="grid grid-cols-6 items-center bg-white border rounded px-2 py-2">
              <div className="text-sm">{fmt(r.start_at)}</div>
              <div className="text-sm">{r.customer_name || '-'}</div>
              <div className="text-sm">{r.customer_phone || '-'}</div>
              <div className={`text-xs ${r.payment_status === 'PAID' ? 'text-green-700' : 'text-amber-700'}`}>
                {r.payment_status}
              </div>
              <div className="text-xs">{r.status}</div>
              <div className="flex gap-2">
                {/* acciones simples — placeholders */}
                <form action="/api/app/bookings/confirm" method="post">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-blue-600 text-xs underline">Confirmar</button>
                </form>
                <form action="/api/app/bookings/cancel" method="post">
                  <input type="hidden" name="id" value={r.id} />
                  <button className="text-red-600 text-xs underline">Cancelar</button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
