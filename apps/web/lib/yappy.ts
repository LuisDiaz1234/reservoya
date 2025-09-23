// apps/web/lib/yappy.ts
// Cliente mínimo para Botón de Pago Yappy V2

function getApiBase() {
  const env = (process.env.YAPPY_ENV || 'prod').toLowerCase();
  // prod: apipagosbg.bgeneral.cloud | uat: api-comecom-uat.yappycloud.com
  return env === 'uat'
    ? 'https://api-comecom-uat.yappycloud.com'
    : 'https://apipagosbg.bgeneral.cloud';
}

export function getYappyCdn() {
  const env = (process.env.YAPPY_ENV || 'prod').toLowerCase();
  return env === 'uat'
    ? 'https://bt-cdn-uat.yappycloud.com/v1/cdn/web-component-btn-yappy.js'
    : 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js';
}

export function normalizePaPhone(input: string) {
  if (!input) return '';
  const digits = (input || '').replace(/[^\d]/g, '');
  // Quita 507 al inicio si viene con +507 o 507
  return digits.startsWith('507') ? digits.slice(3) : digits;
}

// Paso 1: validar comercio → obtener token
export async function yappyValidateMerchant(origin: string) {
  const apiBase = getApiBase();
  const merchantId = process.env.YAPPY_MERCHANT_ID!;
  if (!merchantId) throw new Error('Falta YAPPY_MERCHANT_ID');

  // Debe coincidir EXACTO con el configurado en Yappy Comercial
  const urlDomain = process.env.YAPPY_DOMAIN_OVERRIDE || origin;

  const res = await fetch(`${apiBase}/payments/validate/merchant`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ merchantId, urlDomain }),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`validate ${res.status}: ${JSON.stringify(json)}`);
  }
  const token = json?.body?.token;
  const epochTime = json?.body?.epochTime;
  if (!token) throw new Error(`validate sin token: ${JSON.stringify(json)}`);
  return { token, epochTime, urlDomain };
}

// Paso 2: crear orden
export async function yappyCreateOrder(args: {
  token: string;
  orderId: string;           // máx 15 chars
  domain: string;
  aliasYappy: string;        // teléfono panameño SIN +507
  total: string;             // "0.01" etc.
  ipnUrl: string;            // nuestro webhook GET
  subtotal?: string;
  taxes?: string;
  discount?: string;
}) {
  const apiBase = getApiBase();
  const merchantId = process.env.YAPPY_MERCHANT_ID!;
  const body = {
    merchantId,
    orderId: args.orderId,
    domain: args.domain,
    paymentDate: Date.now(), // epoch ms
    aliasYappy: args.aliasYappy,
    ipnUrl: args.ipnUrl,
    discount: args.discount ?? '0.00',
    taxes: args.taxes ?? '0.00',
    subtotal: args.subtotal ?? args.total,
    total: args.total,
  };

  const res = await fetch(`${apiBase}/payments/payment-wc`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'Authorization': args.token,
    },
    body: JSON.stringify(body),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error(`create ${res.status}: ${JSON.stringify(json)}`);
  }
  const transactionId = json?.body?.transactionId;
  const token = json?.body?.token;
  const documentName = json?.body?.documentName;
  if (!transactionId || !token || !documentName) {
    throw new Error(`create incompleto: ${JSON.stringify(json)}`);
  }
  return { transactionId, token, documentName };
}
