// apps/web/app/app/onboarding/page.tsx
'use client';

import { useState } from 'react';

export default function OnboardingPage() {
  const [slug, setSlug] = useState('demo-salon');
  const [adminCode, setAdminCode] = useState('admin123');
  const [operCode, setOperCode] = useState('oper123');
  const [svcName, setSvcName] = useState('Corte y Secado');
  const [price, setPrice] = useState(2000); // 20.00 USD
  const [depositType, setDepositType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [depositValue, setDepositValue] = useState(1000); // 10.00 USD fijo
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/app/onboarding/seed', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, adminCode, operCode, svcName, price, depositType, depositValue }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Error');
      setMsg('¡Listo! Códigos y servicio creados.');
    } catch (err: any) {
      setMsg(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-xl">
      <h1 className="text-xl font-semibold mb-1">Onboarding — 5 minutos</h1>
      <p className="text-sm text-gray-600 mb-4">Define los códigos del workspace y crea un servicio con depósito.</p>

      <form onSubmit={handleSave} className="space-y-4 bg-white border rounded p-4">
        <div>
          <label className="block text-sm mb-1">Workspace (slug)</label>
          <input className="w-full border rounded px-2 py-1" value={slug} onChange={e => setSlug(e.target.value)} />
          <p className="text-xs text-gray-500">Ej: demo-salon</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">Código Admin</label>
            <input className="w-full border rounded px-2 py-1" value={adminCode} onChange={e => setAdminCode(e.target.value)} />
          </div>
          <div>
            <label className="block text-sm mb-1">Código Operador</label>
            <input className="w-full border rounded px-2 py-1" value={operCode} onChange={e => setOperCode(e.target.value)} />
          </div>
        </div>

        <hr className="my-2" />

        <div>
          <label className="block text-sm mb-1">Servicio</label>
          <input className="w-full border rounded px-2 py-1" value={svcName} onChange={e => setSvcName(e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">Precio (cents)</label>
            <input type="number" className="w-full border rounded px-2 py-1" value={price} onChange={e => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="block text-sm mb-1">Depósito</label>
            <select className="w-full border rounded px-2 py-1" value={depositType} onChange={e => setDepositType(e.target.value as any)}>
              <option value="FIXED">Fijo (cents)</option>
              <option value="PERCENT">Porcentaje (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">{depositType === 'FIXED' ? 'Valor (cents)' : 'Valor (%)'}</label>
            <input type="number" className="w-full border rounded px-2 py-1" value={depositValue} onChange={e => setDepositValue(Number(e.target.value))} />
          </div>
        </div>

        <button disabled={loading} className="px-3 py-1 rounded bg-black text-white">
          {loading ? 'Guardando…' : 'Guardar y crear'}
        </button>

        {msg && <p className="text-sm mt-2">{msg}</p>}
      </form>
    </div>
  );
}
