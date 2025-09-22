// apps/web/lib/rateLimit.ts
import { supabaseAdmin } from './supabaseAdmin';

export async function checkRate(ip: string, route: string, limit: number, windowSec: number) {
  const { data, error } = await supabaseAdmin.rpc('check_rate_limit', {
    p_key: ip || 'unknown',
    p_route: route,
    p_limit: limit,
    p_window_seconds: windowSec
  });
  if (error) {
    console.error('rate-limit.rpc.error', { route, error: error.message });
    return { allowed: true, remaining: limit, resetIn: windowSec }; // fail-open
  }
  return data as { allowed: boolean; remaining: number; reset_in: number };
}
