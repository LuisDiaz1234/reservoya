// apps/web/app/app/login/page.tsx
'use client';

import { useState } from 'react';

export default function LoginPage() {
  const [slug, setSlug] = useState('demo-salon');
  const [role, setRole] = useState<'admin' | 'operator'>('admin');
  const [code, setCode] = useState('admin123');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setErr(null);
    try {
      const r = await fetch('/api/app/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug, role, code }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j?.error || 'Error');
      window.location.href = '/app/dashboard';
    } catch (e: any) {
      setErr(e?.message || 'Error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-sm mx-auto bg-white border rounded p-4">
      <h1 className="text-lg font-semibold mb-2">Entrar al Panel</h1>
      <form onSubmit={onSubmit} className="space-y-3">
        <div>
          <label className="block text-sm mb-1">Workspace (slug)</label>
          <input className="w-full border rounded px-2 py-1" value={slug} onChange={e => setSlug(e.target.value)} />
        </div>
        <div>
          <label className="block text-sm mb-1">Rol</label>
          <select className="w-full border rounded px-2 py-1" value={role} onChange={e => setRole(e.target.value as any)}>
            <option value="admin">Admin</option>
            <option value="operator">Operador</option>
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">Código</label>
          <input className="w-full border rounded px-2 py-1" value={code} onChange={e => setCode(e.target.value)} />
        </div>
        <button disabled={loading} className="px-3 py-1 rounded bg-black text-white">
          {loading ? 'Entrando…' : 'Entrar'}
        </button>
        {err && <p className="text-sm text-red-600">{err}</p>}
      </form>
    </div>
  );
}
