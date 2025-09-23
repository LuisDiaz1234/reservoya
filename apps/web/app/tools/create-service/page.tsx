'use client';

import * as React from 'react';

type ProbeResult = {
  status: number;
  json?: unknown;
  raw?: string;
};

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-sm font-medium mb-1">{children}</label>;
}

// Lee la respuesta SOLO una vez (si no es JSON, cae a texto)
async function readOnce(res: Response): Promise<ProbeResult> {
  try {
    const json = await res.json();
    return { status: res.status, json, raw: '' };
  } catch {
    const raw = await res.text();
    return { status: res.status, raw };
  }
}

export default function CreateServiceTool() {
  const [key, setKey] = React.useState('');
  const [workspaceSlug, setWorkspaceSlug] = React.useState('demo-salon');
  const [name, setName] = React.useState('');
  const [durationMin, setDurationMin] = React.useState<number | ''>(30);
  const [priceUsd, setPriceUsd] = React.useState<number | ''>(5);
  const [depositType, setDepositType] = React.useState<'fixed' | 'percent'>('fixed');
  const [depositValue, setDepositValue] = React.useState<number | ''>(2);
  const [provider, setProvider] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [resp, setResp] = React.useState<ProbeResult | null>(null);

  const onProbe = async () => {
    if (!key) {
      setResp({ status: 0, raw: 'Falta Admin key (CRON_SECRET)' });
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/tools/create-service?key=${encodeURIComponent(key)}`, {
        method: 'GET',
        cache: 'no-store',
      });
      setResp(await readOnce(res));
    } catch (e: any) {
      setResp({ status: 0, raw: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!key) {
      setResp({ status: 0, raw: 'Falta Admin key (CRON_SECRET)' });
      return;
    }
    if (!workspaceSlug || !name) {
      setResp({ status: 0, raw: 'Faltan campos: workspace y/o nombre del servicio' });
      return;
    }
    setLoading(true);
    try {
      const body = {
        workspaceSlug,
        name,
        durationMin: Number(durationMin || 0),
        priceUsd: Number(priceUsd || 0),
        depositType, // 'fixed' | 'percent'
        depositValue: Number(depositValue || 0),
        provider: provider.trim() || null, // opcional
      };

      const res = await fetch(`/api/tools/create-service?key=${encodeURIComponent(key)}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      });

      setResp(await readOnce(res));
    } catch (e: any) {
      setResp({ status: 0, raw: String(e?.message || e) });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-semibold">Crear servicio (herramienta rápida)</h1>

      <div className="rounded-lg border p-4 bg-white">
        <p className="font-medium mb-2">PRUEBA RÁPIDA</p>
        <ol className="list-decimal ml-5 space-y-1 text-sm">
          <li>
            En otra pestaña, abre:{' '}
            <code className="bg-gray-100 px-1 py-0.5 rounded">
              /api/tools/create-service?key=TU_CRON_SECRET
            </code>
          </li>
          <li>
            Si ves <code>{`{ ok: true, method: 'GET' }`}</code>, la key es correcta.
          </li>
          <li>Luego envía el formulario de abajo.</li>
        </ol>
      </div>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <Label>Admin key (CRON_SECRET)</Label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="tu CRON_SECRET (ej. luisd)"
            value={key}
            onChange={(e) => setKey(e.target.value)}
          />
        </div>

        <div>
          <Label>Workspace slug</Label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="demo-salon"
            value={workspaceSlug}
            onChange={(e) => setWorkspaceSlug(e.target.value)}
          />
        </div>

        <div>
          <Label>Nombre del servicio</Label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Manicure / Barbería / ... "
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Duración (min)</Label>
            <input
              type="number"
              min={1}
              className="w-full rounded border px-3 py-2"
              value={durationMin}
              onChange={(e) => setDurationMin(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
          <div>
            <Label>Precio (USD)</Label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded border px-3 py-2"
              value={priceUsd}
              onChange={(e) => setPriceUsd(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label>Tipo de depósito</Label>
            <select
              className="w-full rounded border px-3 py-2"
              value={depositType}
              onChange={(e) => setDepositType(e.target.value as 'fixed' | 'percent')}
            >
              <option value="fixed">Fijo (USD)</option>
              <option value="percent">Porcentaje (%)</option>
            </select>
          </div>
          <div>
            <Label>Valor del depósito</Label>
            <input
              type="number"
              min={0}
              step="0.01"
              className="w-full rounded border px-3 py-2"
              value={depositValue}
              onChange={(e) => setDepositValue(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>
        </div>

        <div>
          <Label>Profesional (opcional) — si no existe, lo crea</Label>
          <input
            className="w-full rounded border px-3 py-2"
            placeholder="Silla 1 / Luis / ... (opcional)"
            value={provider}
            onChange={(e) => setProvider(e.target.value)}
          />
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onProbe}
            disabled={loading || !key}
            className="rounded bg-gray-100 hover:bg-gray-200 px-4 py-2 text-sm"
          >
            Probar key (GET)
          </button>

          <button
            type="submit"
            disabled={loading}
            className="rounded bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
          >
            {loading ? 'Creando...' : 'Crear servicio'}
          </button>
        </div>
      </form>

      <div className="rounded-lg border p-4 bg-white">
        <p className="font-medium mb-2">Respuesta</p>
        <pre className="text-xs whitespace-pre-wrap">
          {resp ? JSON.stringify(resp, null, 2) : '// aquí verás la respuesta'}
        </pre>
      </div>
    </div>
  );
}
