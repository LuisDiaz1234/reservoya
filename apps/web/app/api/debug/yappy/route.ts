import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const bookingId = url.searchParams.get('bookingId') || '';
  const API_BASE = process.env.YAPPY_API_BASE || '';
  const merchantId = process.env.YAPPY_MERCHANT_ID || '';
  const domain = process.env.YAPPY_DOMAIN || process.env.APP_BASE_URL || '';

  if (!bookingId) {
    return NextResponse.json({ error: 'bookingId requerido en query ?bookingId=' }, { status: 400 });
  }
  try {
    const vRes = await fetch(`${API_BASE}/payments/validate/merchant`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ merchantId, urlDomain: domain }),
      cache: 'no-store',
    });
    const vJson = await vRes.json();
    return NextResponse.json({
      ok: vRes.ok,
      request: { API_BASE, merchantId_present: !!merchantId, domain },
      validate_merchant_response: vJson
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 });
  }
}
