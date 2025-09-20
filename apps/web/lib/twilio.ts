// apps/web/lib/twilio.ts
import twilio from 'twilio';

export function getTwilioClient() {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const token = process.env.TWILIO_AUTH_TOKEN!;
  if (!sid || !token) throw new Error('Twilio env vars missing');
  return twilio(sid, token);
}
