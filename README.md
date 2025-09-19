# ReservoYA (monorepo)

Este repositorio contiene el proyecto **ReservoYA**: plataforma de reservas con depósito y recordatorios por WhatsApp.

## Estructura mínima

- `apps/web/` → App Next.js 14 (App Router) + TypeScript + Tailwind
- `supabase/migrations/` → (FASE 1) migraciones SQL
- `supabase/seed.sql` → (FASE 1) datos demo para carga inicial

## Fases
- **FASE 0**: Repo, estructura, despliegue base en Vercel (ESTA FASE)
- **FASE 1**: Base de datos en Supabase + RLS + funciones
- ...

> No se usa nada local. Solo GitHub, Vercel y Supabase (web).
