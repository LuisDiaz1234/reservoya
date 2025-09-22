// apps/web/lib/validation.ts
import { z } from 'zod';

export const phoneSchema = z.string().trim().min(6).max(20);

export const bookingPublicSchema = z.object({
  workspace: z.string().trim().min(1),
  serviceId: z.string().uuid(),
  providerId: z.string().uuid().optional().nullable(),
  customerName: z.string().trim().min(1, 'Nombre requerido').max(80),
  customerPhone: phoneSchema,
  startAt: z.string().trim().min(10), // ISO local (Panamá) o ISO completo
  notes: z.string().trim().max(280).optional().nullable(),
  payTestOneCent: z.boolean().optional().default(false),
});
