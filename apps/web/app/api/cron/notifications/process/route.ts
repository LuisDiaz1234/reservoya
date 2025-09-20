// apps/web/app/api/cron/notifications/process/route.ts
import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

// ¡Este handler debe correr en Node.js, no en Edge!
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type OutboxItem = {
  id: string;
  workspace_id: string;
  channel: string;
  to_whatsapp: string;
  body_text: string;
  attempts: number;
};

function assertEnv(...keys: string[]) {
  for (const k of keys) {
    if (!process.env[k]) throw new Error(`Falta env var ${k}`);
  }
}

export async function GET(req: Request) {
  // Seguridad simple: token por query (?key=CRON_SECRET)
  const url = new URL(req.url);
  const qKey = url.searchParams.get("key");
  const secret = process.env.CRON_SECRET;
  if (!secret || qKey !== secret) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }

  try {
    // 1) Tomar mensajes pendientes (PENDING) y marcarlos SENDING
    const { data: items, error: claimErr } = await supabaseAdmin.rpc("outbox_claim", { p_limit: 20 });
    if (claimErr) throw new Error(`outbox_claim: ${claimErr.message}`);

    const list = (items || []) as OutboxItem[];
    if (list.length === 0) {
      return NextResponse.json({ ok: true, taken: 0, sent: 0, retried: 0 });
    }

    // 2) Twilio client
    assertEnv("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_WHATSAPP_FROM");
    const accountSid = process.env.TWILIO_ACCOUNT_SID!;
    const authToken = process.env.TWILIO_AUTH_TOKEN!;
    const from = process.env.TWILIO_WHATSAPP_FROM!;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const client = require("twilio")(accountSid, authToken);

    let sent = 0, retried = 0;
    for (const m of list) {
      try {
        if (m.channel !== "whatsapp") {
          // Reprobamos a DEAD si el canal no es soportado
          await supabaseAdmin.rpc("outbox_mark_retry", { p_id: m.id, p_error: `Canal no soportado: ${m.channel}` });
          retried++;
          continue;
        }
        const to = m.to_whatsapp.startsWith("whatsapp:") ? m.to_whatsapp : `whatsapp:${m.to_whatsapp}`;

        const res = await client.messages.create({
          from,
          to,
          body: m.body_text,
        });

        await supabaseAdmin.rpc("outbox_mark_sent", {
          p_id: m.id,
          p_provider_message_id: res.sid,
        });
        sent++;
      } catch (e: any) {
        await supabaseAdmin.rpc("outbox_mark_retry", {
          p_id: m.id,
          p_error: e?.message || String(e),
        });
        retried++;
      }
    }

    return NextResponse.json({ ok: true, taken: list.length, sent, retried });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || String(e) }, { status: 500 });
  }
}
