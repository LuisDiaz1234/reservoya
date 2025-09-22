// apps/web/app/app-tools/create-service/page.tsx
'use client';
import { useState } from 'react';

export default function CreateServiceTool() {
  const [state, setState] = useState({
    key: '',
    slug: '',
    name: '',
    duration: 30,
    price: 25,
    depType: 'FIXED', // 'FIXED' | 'PERCENT'
    depVal: 5
  });
  const [result, setResult] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setResult(null);
    try {
      const res = await fetch(`/api/tools/create-service?key=${encodeURIComponent(state.key)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          workspaceSlug: state.slug.trim(),
          name: state.name.trim(),
          durationMinutes: Number(state.duration),
          priceUsd: Number(state.price),
          depositType: state.depType,
          depositValue: state.depVal
        })
      });
      const json = await res.json();
      setResult({ status: res.status, json });
    } catch (e: any) {
      setResult({ status: 0, json: { ok: false, error: String(e?.message || e) } });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-xl mx-auto p-6 space-y-4">
      <h1 className="text-xl font-semibold">Crear servicio (herramienta rápida)</h1>
      <p className="text-sm text-gray-600">Usa tu <b>CRON_SECRET</b> para autorizar.</p>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-sm font-medium">Admin key (CRON_SECRET)</label>
          <input
            value={state.key}
            onChange={e => setState(s => ({ ...s, key: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            placeholder="tu-secreto-cron"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Workspace slug</label>
          <input
            value={state.slug}
            onChange={e => setState(s => ({ ...s, slug: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            placeholder="demo-salon"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium">Nombre del servicio</label>
          <input
            value={state.name}
            onChange={e => setState(s => ({ ...s, name: e.target.value }))}
            className="border rounded px-3 py-2 w-full"
            placeholder="Color + Corte"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Duración (min)</label>
            <input
              type="number" min={5} step={5}
              value={state.duration}
              onChange={e => setState(s => ({ ...s, duration: Number(e.target.value) }))}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium">Precio (USD)</label>
            <input
              type="number" min={0} step={0.01}
              value={state.price}
              onChange={e => setState(s => ({ ...s, price: Number(e.target.value) }))}
              className="border rounded px-3 py-2 w-full"
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-medium">Tipo de depósito</label>
            <select
              value={state.depType}
              onChange={e => setState(s => ({ ...s, depType: e.target.value }))}
              className="border rounded px-3 py-2 w-full"
            >
              <option value="FIXED">Fijo (USD)</option>
              <option value="PERCENT">Porcentaje (%)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium">Valor del depósito</label>
            <input
              type="number" min={0} step={state.depType === 'FIXED' ? 0.01 : 1}
              value={state.depVal}
              onChange={e => setState(s => ({ ...s, depVal: Number(e.target.value) }))}
              className="border rounded px-3 py-2 w-full"
              placeholder={state.depType === 'FIXED' ? '5.00' : '20'}
              required
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="bg-black text-white px-4 py-2 rounded"
        >
          {loading ? 'Creando...' : 'Crear servicio'}
        </button>
      </form>

      {result && (
        <pre className="bg-gray-50 border rounded p-3 text-xs overflow-auto">
{JSON.stringify(result, null, 2)}
        </pre>
      )}

      {result?.json?.ok && (
        <div className="p-3 rounded bg-green-50 border text-green-700">
          Listo. Abre{' '}
          <a className="underline" href={`/${state.slug}/book?r=${Date.now()}`} target="_blank">
            /{state.slug}/book
          </a>{' '}
          para verlo.
        </div>
      )}
    </main>
  );
}
