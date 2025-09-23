"use client";

import { useEffect, useMemo, useState } from "react";
import { formatUSD } from "@/lib/time";

type MetaResp = {
  workspace: { id: string; name: string; slug: string; timezone: string; currency: string };
  services: Array<{
    id: string; name: string; description: string | null;
    duration_minutes: number; price_cents: number;
    deposit_type: string; deposit_amount_cents: number; deposit_percent: number;
  }>;
  providers: Array<{ id: string; name: string }>;
};

export default function BookPage({ params }: { params: { workspace: string } }) {
  const slug = params.workspace.toLowerCase();

  const [meta, setMeta] = useState<MetaResp | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [serviceId, setServiceId] = useState<string>("");
  const [providerId, setProviderId] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("");
  const [availability, setAvailability] = useState<string[]>([]);
  const [timeISO, setTimeISO] = useState<string>("");

  // Datos de cliente
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");

  const [error, setError] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);
  const [okMsg, setOkMsg] = useState<string>("");

  useEffect(() => {
    setLoadingMeta(true);
    fetch(`/api/public/workspaces/${slug}/meta`)
      .then(r => r.json())
      .then((j) => {
        if (j.error) throw new Error(j.error);
        setMeta(j);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoadingMeta(false));
  }, [slug]);

  const selectedService = useMemo(
    () => meta?.services.find(s => s.id === serviceId),
    [meta, serviceId]
  );

  const depositPreview = useMemo(() => {
    if (!selectedService) return 0;
    if (selectedService.deposit_type === "PERCENT") {
      return Math.max(1, Math.round((selectedService.price_cents * (selectedService.deposit_percent || 0)) / 100));
    }
    return selectedService.deposit_amount_cents || 0;
  }, [selectedService]);

  function normalizePA(input: string) {
    let s = (input || "").trim().replace(/\s+/g, "");
    if (!s) return s;
    // si no trae +, asumimos Panamá
    if (!s.startsWith("+")) s = "+507" + s.replace(/^0+/, "");
    return s;
  }

  async function loadAvailability() {
    setAvailability([]);
    setTimeISO("");
    setError("");
    if (!providerId || !serviceId || !dateStr) {
      setError("Selecciona servicio, profesional y fecha.");
      return;
    }
    const url = `/api/public/workspaces/${slug}/availability?providerId=${providerId}&serviceId=${serviceId}&date=${dateStr}`;
    const j = await fetch(url).then(r => r.json());
    if (j.error) { setError(j.error); return; }
    setAvailability(j.availability || []);
    if ((j.availability || []).length === 0) {
      setError("No hay horarios disponibles para ese día.");
    }
  }

  async function submitBooking() {
    setError("");
    setOkMsg("");
    if (!serviceId || !providerId || !dateStr || !timeISO || !name || !phone) {
      setError("Completa todos los campos obligatorios (*)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          // 👇 CAMBIO CLAVE: el API exige 'workspace'
          workspace: slug,
          serviceId,
          providerId,
          startAt: timeISO,
          customerName: name,
          // 👇 Nombres que espera el API
          phone: normalizePA(phone),
          email: email || null,
        }),
      });

      const j = await res.json();
      if (!res.ok) throw new Error(j.error || "Error al crear la reserva");

      const bookingId = j?.result?.booking_id;
      const deposit = j?.result?.deposit_cents ?? 0;

      setOkMsg(`Reserva creada. Depósito estimado: ${formatUSD(deposit)}. Redirigiendo...`);

      // Redirigir a confirmación
      const u = new URL(window.location.href);
      u.pathname = `/${slug}/book/confirm`;
      u.searchParams.set("bookingId", bookingId);
      u.searchParams.set("deposit", String(deposit));
      window.location.href = u.toString();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="space-y-6">
      <h2 className="text-2xl font-semibold">Reservar</h2>
      {loadingMeta && <p>Cargando...</p>}
      {error && <p className="text-red-600 text-sm">{error}</p>}
      {meta && (
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Servicio *</label>
              <select
                className="w-full rounded border px-3 py-2"
                value={serviceId}
                onChange={e => setServiceId(e.target.value)}
              >
                <option value="">Selecciona servicio</option>
                {meta.services.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} — {formatUSD(s.price_cents)} ({s.duration_minutes} min)
                  </option>
                ))}
              </select>
              {selectedService && (
                <p className="text-xs text-gray-600 mt-1">
                  Depósito estimado: <strong>{formatUSD(depositPreview)}</strong>
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Profesional *</label>
              <select
                className="w-full rounded border px-3 py-2"
                value={providerId}
                onChange={e => setProviderId(e.target.value)}
              >
                <option value="">Selecciona profesional</option>
                {meta.providers.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Fecha (zona Panamá) *</label>
              <input
                type="date"
                className="w-full rounded border px-3 py-2"
                value={dateStr}
                onChange={e => setDateStr(e.target.value)}
              />
              <button
                onClick={loadAvailability}
                className="mt-2 rounded bg-black text-white px-4 py-2"
              >
                Ver horarios
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Horario *</label>
              <div className="flex flex-wrap gap-2">
                {availability.length === 0 && <span className="text-sm text-gray-500">—</span>}
                {availability.map(iso => {
                  const d = new Date(iso);
                  const hh = String(d.getUTCHours()).padStart(2, "0");
                  const mm = String(d.getUTCMinutes()).padStart(2, "0");
                  const label = `${hh}:${mm}`;
                  const active = timeISO === iso;
                  return (
                    <button
                      key={iso}
                      onClick={() => setTimeISO(iso)}
                      className={`px-3 py-1 rounded border ${active ? "bg-black text-white" : "bg-white"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-600 mt-1">Los horarios se muestran en hora local (Panamá).</p>
            </div>

            <div className="space-y-2">
              <label className="block text-sm font-medium">Tu nombre *</label>
              <input className="w-full rounded border px-3 py-2" value={name} onChange={e => setName(e.target.value)} />

              <label className="block text-sm font-medium">Teléfono (con o sin +507) *</label>
              <input className="w-full rounded border px-3 py-2" value={phone} onChange={e => setPhone(e.target.value)} />

              <label className="block text-sm font-medium">Email (opcional)</label>
              <input className="w-full rounded border px-3 py-2" value={email} onChange={e => setEmail(e.target.value)} />
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={submitBooking}
                disabled={submitting}
                className="rounded bg-green-600 text-white px-5 py-2 disabled:opacity-50"
              >
                {submitting ? "Creando..." : "Reservar (sin pago)"}
              </button>
              {okMsg && <span className="text-sm text-green-700">{okMsg}</span>}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
