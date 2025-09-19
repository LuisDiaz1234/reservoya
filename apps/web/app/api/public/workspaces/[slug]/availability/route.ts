import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";
import { dateAtPanama } from "@/lib/time";

/**
 * Query params:
 *  - providerId (uuid)
 *  - serviceId (uuid)
 *  - date (YYYY-MM-DD, zona Panamá)
 *
 * Devuelve lista de "startISO" disponibles para esa fecha, considerando:
 *  - slots del provider para el weekday
 *  - duración del servicio
 *  - solapa con reservas existentes
 *  - capacidad=1 (MVP)
 */
export async function GET(req: Request, { params }: { params: { slug: string } }) {
  const url = new URL(req.url);
  const slug = (params.slug || "").toLowerCase();
  const providerId = url.searchParams.get("providerId");
  const serviceId = url.searchParams.get("serviceId");
  const dateStr = url.searchParams.get("date"); // YYYY-MM-DD

  if (!providerId || !serviceId || !dateStr) {
    return NextResponse.json({ error: "Faltan parámetros: providerId, serviceId, date" }, { status: 400 });
  }

  const s = supabaseService();

  // Obtener workspace
  const { data: ws } = await s
    .from("workspaces")
    .select("id, timezone, public_booking_enabled")
    .eq("slug", slug)
    .single();

  if (!ws || !ws.public_booking_enabled) {
    return NextResponse.json({ error: "Workspace no habilitado" }, { status: 404 });
  }

  // Obtener servicio (duración)
  const { data: serv } = await s
    .from("services")
    .select("id, duration_minutes, workspace_id")
    .eq("id", serviceId)
    .eq("workspace_id", ws.id)
    .single();

  if (!serv) {
    return NextResponse.json({ error: "Servicio inválido" }, { status: 400 });
  }

  // Slots del provider para el weekday dado
  const weekday = new Date(dateAtPanama(dateStr, "00:00")).getUTCDay(); // 0..6 (domingo..sábado)
  const { data: slots, error: slotsErr } = await s
    .from("slots")
    .select("id, start_time, end_time, capacity")
    .eq("workspace_id", ws.id)
    .eq("provider_id", providerId)
    .eq("weekday", weekday)
    .eq("is_active", true);

  if (slotsErr) return NextResponse.json({ error: slotsErr.message }, { status: 500 });

  // Bookings existentes del provider en esa fecha (cualquier estado excepto cancelado)
  const dayStart = new Date(dateAtPanama(dateStr, "00:00")).toISOString();
  const dayEnd = new Date(dateAtPanama(dateStr, "23:59")).toISOString();
  const { data: bookings } = await s
    .from("bookings")
    .select("id, start_at, end_at, status")
    .eq("workspace_id", ws.id)
    .eq("provider_id", providerId)
    .gte("start_at", dayStart)
    .lte("start_at", dayEnd)
    .neq("status", "CANCELLED");

  // Generar horarios disponibles con paso = duración del servicio
  const taken: Array<{ start: number; end: number }> = (bookings || []).map(b => ({
    start: new Date(b.start_at).getTime(),
    end: new Date(b.end_at).getTime()
  }));

  function overlaps(aStart: number, aEnd: number): boolean {
    return taken.some(t => Math.max(t.start, aStart) < Math.min(t.end, aEnd));
  }

  const durationMs = serv.duration_minutes * 60 * 1000;
  const options: string[] = [];

  for (const sl of (slots || [])) {
    const st = (sl.start_time as string).slice(0,5); // "HH:MM"
    const en = (sl.end_time as string).slice(0,5);
    let cursor = dateAtPanama(dateStr, st).getTime();
    const end = dateAtPanama(dateStr, en).getTime();

    while (cursor + durationMs <= end) {
      const stISO = new Date(cursor).toISOString();
      const enISO = new Date(cursor + durationMs).toISOString();
      if (!overlaps(cursor, cursor + durationMs)) {
        options.push(stISO);
      }
      cursor += durationMs; // paso = duración servicio
    }
  }

  // Ordenar cronológicamente
  options.sort();

  return NextResponse.json({ date: dateStr, availability: options });
}
