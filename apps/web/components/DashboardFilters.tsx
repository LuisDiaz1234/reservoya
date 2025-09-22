// apps/web/components/DashboardFilters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

type Opt = { id: string; name: string };

export default function DashboardFilters({
  services = [],
  providers = [],
  showService = false,
  showProvider = false,
}: {
  services?: Opt[];
  providers?: Opt[];
  showService?: boolean;
  showProvider?: boolean;
}) {
  const router = useRouter();
  const sp = useSearchParams();

  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');
  const [serviceId, setServiceId] = useState(sp.get('serviceId') ?? '');
  const [providerId, setProviderId] = useState(sp.get('providerId') ?? '');

  useEffect(() => {
    setFrom(sp.get('from') ?? '');
    setTo(sp.get('to') ?? '');
    setQ(sp.get('q') ?? '');
    setServiceId(sp.get('serviceId') ?? '');
    setProviderId(sp.get('providerId') ?? '');
  }, [sp]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (q) p.set('q', q);
    if (showService && serviceId) p.set('serviceId', serviceId);
    if (showProvider && providerId) p.set('providerId', providerId);
    router.replace(`/app/dashboard?${p.toString()}`);
  }

  function clear() {
    router.replace('/app/dashboard');
  }

  const csvHref = (() => {
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (q) p.set('q', q);
    if (showService && serviceId) p.set('serviceId', serviceId);
    if (showProvider && providerId) p.set('providerId', providerId);
    return `/api/app/bookings/export?${p.toString()}`;
  })();

  return (
    <form onSubmit={submit} className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
      <div>
        <label className="block text-xs text-gray-600">Desde</label>
        <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={from} onChange={e => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-600">Hasta</label>
        <input type="date" className="w-full border rounded px-2 py-1 text-sm" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <label className="block text-xs text-gray-600">Buscar</label>
        <input placeholder="Cliente o teléfono…" className="w-full border rounded px-3 py-1.5 text-sm"
               value={q} onChange={e => setQ(e.target.value)} />
      </div>
      {showService ? (
        <div>
          <label className="block text-xs text-gray-600">Servicio</label>
          <select className="w-full border rounded px-2 py-1 text-sm" value={serviceId} onChange={e => setServiceId(e.target.value)}>
            <option value="">Todos</option>
            {services.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      ) : <div className="hidden md:block" />}
      {showProvider ? (
        <div>
          <label className="block text-xs text-gray-600">Profesional</label>
          <select className="w-full border rounded px-2 py-1 text-sm" value={providerId} onChange={e => setProviderId(e.target.value)}>
            <option value="">Todos</option>
            {providers.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>
      ) : <div className="hidden md:block" />}

      <div className="md:col-span-6 flex gap-2">
        <button className="px-3 py-1.5 rounded bg-black text-white text-sm">Aplicar</button>
        <button type="button" onClick={clear} className="px-3 py-1.5 rounded border text-sm">Limpiar</button>
        <a className="px-3 py-1.5 rounded border text-sm" href={csvHref} target="_blank" rel="noopener noreferrer">Exportar CSV</a>
      </div>
    </form>
  );
}
