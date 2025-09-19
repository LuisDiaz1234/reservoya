import { NextResponse } from "next/server";
import { supabaseService } from "@/lib/supabase/server";

export async function GET(
  req: Request,
  { params }: { params: { slug: string } }
) {
  const slug = (params.slug || "").toLowerCase();
  const s = supabaseService();

  // workspace básico
  const { data: ws, error: wsErr } = await s
    .from("workspaces")
    .select("id, name, slug, timezone, currency, public_booking_enabled")
    .eq("slug", slug)
    .single();

  if (wsErr || !ws || !ws.public_booking_enabled) {
    return NextResponse.json({ error: "Workspace no encontrado o no permite reservas públicas" }, { status: 404 });
  }

  const [servicesRes, providersRes] = await Promise.all([
    s.from("services")
      .select("id, name, description, duration_minutes, price_cents, deposit_type, deposit_amount_cents, deposit_percent")
      .eq("workspace_id", ws.id)
      .order("name", { ascending: true }),
    s.from("providers")
      .select("id, name, is_active")
      .eq("workspace_id", ws.id)
      .eq("is_active", true)
      .order("name", { ascending: true })
  ]);

  if (servicesRes.error) return NextResponse.json({ error: servicesRes.error.message }, { status: 500 });
  if (providersRes.error) return NextResponse.json({ error: providersRes.error.message }, { status: 500 });

  return NextResponse.json({
    workspace: ws,
    services: servicesRes.data || [],
    providers: providersRes.data || []
  });
}
