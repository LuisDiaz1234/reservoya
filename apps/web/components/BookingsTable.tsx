// apps/web/components/BookingsTable.tsx
'use client';

import { useMemo, useState } from 'react';

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

function Badge({ children, tone }: { children: React.ReactNode; tone: 'green'|'amber'|'red'|'slate' }) {
  const tones: Record<string, string> = {
    green: 'bg-green-100 text-green-800 border-green-200',
    amber: 'bg-amber-100 text-amber-800 border-amber-200',
    red:   'bg-rose-100 text-rose-800 border-rose-200',
    slate: 'bg-slate-100 text-slate-800 border-slate-200'
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs border ${tones[tone]}`}>{children}</span>;
}

export default function BookingsTable({ rows }: { rows: Row[] }) {
  const ids = useMemo(() => rows.map(r => r.id), [rows]);
  const [selected, setSelected] = useState<string[]>([]);

  const allChecked = selected.length === ids.length && ids.length > 0;

  function toggleAll() {
    setSelected(allChecked ? [] : ids);
  }
  function toggle(id: string) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function doAction(action: 'confirm' | 'cancel' | 'remind') {
    if (selected.length === 0) return;
    const res = await fetch('/api/app/bookings/bulk', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action, ids: selected }),
    });
    if (res.ok) {
      window.location.reload();
    } else {
      const j = await res.json().catch(() => ({} as any));
      alert(`Error: ${j?.error || res.statusText}`);
    }
  }

  return (
    <div className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-gray-50">
        <div className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={allChecked} onChange={toggleAll} />
          <span>{selected.length} seleccionadas</span>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => doAction('confirm')}
                  className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50">Confirmar</button>
          <button type="button" onClick={() => doAction('cancel')}
                  className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50 text-rose-700">Cancelar</button>
          <button type="button" onClick={() => doAction('remind')}
                  className="px-2 py-1 text-xs rounded-lg border hover:bg-gray-50">Enviar recordatorio</button>
        </div>
      </div>

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
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-6 text-center text-gray-500">Sin reservas en el rango.</td>
              </tr>
            )}
            {rows.map((r, idx) => {
              const paidTone = r.payment_status === 'PAID' ? 'green' : 'amber';
              const stTone =
                r.status === 'CONFIRMED' ? 'green' :
                r.status === 'CANCELLED' ? 'red' : 'slate';
              const checked = selected.includes(r.id);
              return (
                <tr key={r.id} className={idx % 2 ? 'bg-white' : 'bg-gray-50/50'}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked} onChange={() => toggle(r.id)} />
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
    </div>
  );
}
