// apps/web/components/DashboardFilters.tsx
'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect } from 'react';

export default function DashboardFilters() {
  const router = useRouter();
  const sp = useSearchParams();
  const [from, setFrom] = useState(sp.get('from') ?? '');
  const [to, setTo] = useState(sp.get('to') ?? '');
  const [q, setQ] = useState(sp.get('q') ?? '');

  useEffect(() => {
    setFrom(sp.get('from') ?? '');
    setTo(sp.get('to') ?? '');
    setQ(sp.get('q') ?? '');
  }, [sp]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const p = new URLSearchParams();
    if (from) p.set('from', from);
    if (to) p.set('to', to);
    if (q) p.set('q', q);
    router.replace(`/app/dashboard?${p.toString()}`);
  }

  function clear() {
    router.replace('/app/dashboard');
  }

  return (
    <form onSubmit={submit} className="flex flex-col md:flex-row gap-3 items-end">
      <div>
        <label className="block text-xs text-gray-600">Desde</label>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={from} onChange={e => setFrom(e.target.value)} />
      </div>
      <div>
        <label className="block text-xs text-gray-600">Hasta</label>
        <input type="date" className="border rounded px-2 py-1 text-sm" value={to} onChange={e => setTo(e.target.value)} />
      </div>
      <div className="flex-1">
        <label className="block text-xs text-gray-600">Buscar</label>
        <input placeholder="Cliente o teléfono…" className="w-full border rounded px-3 py-1.5 text-sm"
               value={q} onChange={e => setQ(e.target.value)} />
      </div>
      <button className="px-3 py-1.5 rounded bg-black text-white text-sm">Aplicar</button>
      <button type="button" onClick={clear} className="px-3 py-1.5 rounded border text-sm">Limpiar</button>
      <a className="px-3 py-1.5 rounded border text-sm"
         href={`/api/app/bookings/export?${sp.toString()}`}
         target="_blank" rel="noopener noreferrer">Exportar CSV</a>
    </form>
  );
}
