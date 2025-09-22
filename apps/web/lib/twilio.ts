// apps/web/lib/twilio.ts
export type TwilioSendResult = { sid: string };

export async function sendWhatsApp(opts: { to: string; body: string }): Promise<TwilioSendResult> {
  const { to, body } = opts;
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  const from = process.env.TWILIO_WHATSAPP_FROM!; // formato: whatsapp:+507XXXXXXX
  if (!sid || !token || !from) {
    throw new Error('Missing Twilio env vars');
  }

  // Import dinámico: sólo en server Node.js
  const twilioMod: any = await import('twilio');
  const twilio = twilioMod.default ?? twilioMod;
  const client = twilio(sid, token);

  const msg = await client.messages.create({
    from,
    to: to.startsWith('whatsapp:') ? to : `whatsapp:${to}`,
    body
  });

  return { sid: msg.sid as string };
}
