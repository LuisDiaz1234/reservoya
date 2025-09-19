export default function Page() {
  const appName = process.env.NEXT_PUBLIC_APP_NAME || "ReservoYA";
  const supabaseUrlOk = !!process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKeyOk = !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  return (
    <section className="space-y-6">
      <h2 className="text-xl font-medium">Despliegue base listo</h2>
      <p>
        Esta es la landing base de <strong>{appName}</strong>. Si ves esta página,
        el proyecto Next.js está desplegado en Vercel correctamente.
      </p>

      <div className="rounded-lg border p-4">
        <p className="font-medium mb-2">Checklist rápido</p>
        <ul className="list-disc pl-6 text-sm space-y-1">
          <li>
            Tailwind funcionando: <span className="px-2 py-0.5 rounded bg-gray-100">✅</span>
          </li>
          <li>
            API de salud: visita{" "}
            <a className="underline" href="/api/health" target="_blank">/api/health</a>
          </li>
          <li>Variables presentes (marcan ✅ si están definidas):</li>
          <ul className="list-disc pl-6">
            <li>NEXT_PUBLIC_SUPABASE_URL: {supabaseUrlOk ? "✅" : "⚠️"}</li>
            <li>NEXT_PUBLIC_SUPABASE_ANON_KEY: {supabaseKeyOk ? "✅" : "⚠️"}</li>
          </ul>
        </ul>
      </div>

      <p className="text-sm text-gray-600">
        Próximo paso (FASE 1): Base de datos en Supabase con RLS.
      </p>
    </section>
  );
}
