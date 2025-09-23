// apps/web/app/tools/create-service/page.tsx
'use client';

import { useState } from 'react';

type Result = {
  status: number;
  json?: any;
  raw?: string;
};

export default function CreateServiceTool() {
  const [adminKey, setAdminKey] = useState('');
  const [workspaceSlug, setWorkspaceSlug] = useState('demo-salon');
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [priceUsd, setPriceUsd] = useState(5);
  const [depositType, setDepositType] = useState<'FIXED' | 'PERCENT'>('FIXED');
  const [depositValue, setDepositValue] = useState(2);
  const [providerName, setProviderName] = useState('');
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(false);

  const basePath = '/api/tools/create-service';

  async function testKey() {
    setLoading(true);
    try {
      const r = await fetch(`${basePath}?key=${encodeURIComponent(adminKey)}`);
      const j = await r.json().catch(() => null);
      setResult({ status: r.status, json: j ?? null, raw: j ? '' : await r.text() });
    } catch (e: any) {
      setResult({ status: 0, raw: String(e) });
    } finally {
      setLoading(false);
    }
  }

  async function submit() {
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch(basePath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: adminKey,
          workspaceSlug,
          name,
          durationMin: Number(durationMin),
          priceUsd: Number(priceUsd),
          depositType,
          depositValue: Number(depositValue),
          providerName: providerName.trim() || null,
        }),
      });
      const txt = await r.text();
      let j: any = null;
      try { j = JSON.parse(txt); } catch { /* no-op */ }
      setResult({ status: r.status, json: j ?? undefined, raw: j ? '' : txt });
    } catch (e: any) {
      setResult({ status: 0, raw: String(e) });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Crear servicio (herramienta rápida)</h1>

      <div className="rounded-lg border p-4 bg-white">
        <p className="font-medium mb-2">PRUEBA RÁPIDA</p>
        <ol className="list-decimal list-inside text-sm space-y-1">
          <li>
            En otra pestaña, abre:{' '}
            <code className="px-2 py-1 bg-gray-100 rounded">
              /api/tools/create-service?key=TU_CRON_SECRET
            </code>
          </li>
          <li>Si ves {'{ ok: true, method: \'GET\' }'}, la key es correcta.</li>
          <li>Luego envía el formulario de abajo.</li>
        </ol>
      </div>

      <div className="grid gap-4">
        <label className="grid gap-1">
          <span className="text-sm">Admin key (CRON_SECRET)</span>
          <input
            className="border rounded px-3 py-2"
            value={adminKey}
            onChange={(e) => setAdminKey(e.target.value)}
            placeholder="Tu CRON_SECRET (ej. luisd)"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Workspace slug</span>
          <input
            className="border rounded px-3 py-2"
            value={workspaceSlug}
            onChange={(e) => setWorkspaceSlug(e.target.value)}
            placeholder="demo-salon"
          />
        </label>

        <label className="grid gap-1">
          <span className="text-sm">Nombre del servicio</span>
          <input
            className="border rounded px-3 py-2"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Manicure, Barbería, etc."
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">Duración (min)</span>
            <input
              type="number"
              className="border rounded px-3 py-2"
              value={durationMin}
              onChange={(e) => setDurationMin(Number(e.target.value))}
              min={5}
              step={5}
            />
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Precio (USD)</span>
            <input
              type="number"
              className="border rounded px-3 py-2"
              value={priceUsd}
              onChange={(e) => setPriceUsd(Number(e.target.value))}
              min={0}
              step={0.5}
            />
          </label>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-1">
            <span className="text-sm">Tipo de depósito</span>
            <select
              className="border rounded px-3 py-2"
              value={depositType}
              onChange={(e) => setDepositType(e.target.value as 'FIXED' | 'PERCENT')}
            >
              <option value="FIXED">Fijo (USD)</option>
              <option value="PERCENT">Porcentaje (%)</option>
            </select>
          </label>

          <label className="grid gap-1">
            <span className="text-sm">Valor del depósito</span>
            <input
              type="number"
              className="border rounded px-3 py-2"
              value={depositValue}
              onChange={(e) => setDepositValue(Number(e.target.value))}
              min={0}
              step={depositType === 'FIXED' ? 0.5 : 1}
            />
          </label>
        </div>

        <label className="grid gap-1">
          <span className="text-sm">
            Profesional (opcional) — si no existe, lo crea
          </span>
          <input
            className="border rounded px-3 py-2"
            value={providerName}
            onChange={(e) => setProviderName(e.target.value)}
            placeholder="General / Luis / Silla 1"
          />
        </label>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={testKey}
            className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
            disabled={loading}
          >
            Probar key (GET)
          </button>

          <button
            type="button"
            onClick={submit}
            className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            disabled={loading}
          >
            {loading ? 'Enviando…' : 'Crear servicio'}
          </button>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-sm font-medium mb-1">Respuesta</p>
        <pre className="bg-gray-50 border rounded p-3 overflow-auto text-sm">
{JSON.stringify(result ?? {}, null, 2)}
        </pre>
      </div>
    </div>
  );
}
