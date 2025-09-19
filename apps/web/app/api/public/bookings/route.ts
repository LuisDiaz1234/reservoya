import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

/**
 * POST JSON:
 * {
 *   "workspaceSlug": "demo-salon",
 *   "serviceId": "uuid",
 *   "providerId": "uuid",
 *   "startAt": "2025-09-22T15:00:00-05:00" (o ISO con Z; servidor lo pasa tal cual a RPC),
 *   "customerName": "string",
 *   "customerPhone": "string",
 *   "customerEmail": "string|null"
 * }
 */
export async function POST(req: Request) {
  const s = supabaseService();
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const {
    workspaceSlug,
    serviceId,
    providerId,
    startAt,
    customerName,
    customerPhone,
    customerEmail
  } = body || {};

  if (!workspaceSlug || !serviceId || !providerId || !startAt || !customerName || !customerPhone) {
    return NextResponse.json({ error: "Faltan campos obligatorios" }, { status: 400 });
  }

  // Validar que el workspace existe y permite público
  const { data: ws } = await s
    .from("workspaces")
    .select("id, public_booking_enabled")
    .eq("slug", (workspaceSlug as string).toLowerCase())
    .single();

  if (!ws || !ws.public_booking_enabled) {
    return NextResponse.json({ error: "Workspace no disponible para reservas" }, { status: 400 });
  }

  // Llamar a la RPC (SECURITY DEFINER)
  const { data, error } = await s.rpc("create_booking_public", {
    p_workspace_slug: (workspaceSlug as string).toLowerCase(),
    p_service_id: serviceId,
    p_provider_id: providerId,
    p_start_at: new Date(startAt).toISOString(),
    p_customer_name: customerName,
    p_customer_phone: customerPhone,
    p_customer_email: customerEmail || null
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  return NextResponse.json({ ok: true, result: data });
}
