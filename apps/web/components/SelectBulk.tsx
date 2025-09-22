// apps/web/components/SelectBulk.tsx
'use client';

import { useState } from 'react';

export default function SelectBulk({ ids }: { ids: string[] }) {
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
      // recargar dashboard con los mismos filtros
      window.location.reload();
    } else {
      const j = await res.json().catch(() => ({} as any));
      alert(`Error: ${j?.error || res.statusText}`);
    }
  }

  return (
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
      {/* Tabla usará este control: asignamos window.bulkToggle para filas */}
      <script
        dangerouslySetInnerHTML={{
          __html: `
          window.toggleBulkRow = function(id){
            const ev = new CustomEvent('bulk-toggle', { detail: id });
            window.dispatchEvent(ev);
          };`,
        }}
      />
    </div>
  );
}
