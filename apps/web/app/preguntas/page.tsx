// apps/web/app/preguntas/page.tsx
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main className="max-w-3xl mx-auto p-6 prose">
      <h1>Preguntas Frecuentes</h1>
      <h3>¿Puedo pagar un depósito mínimo de prueba?</h3>
      <p>Sí, marca “Pagar solo USD 0.01 (prueba)” en la pantalla de pago.</p>
      <h3>¿Cuándo llega el WhatsApp?</h3>
      <p>En cuanto el pago se confirma. Recordatorios: 24h y 3h antes.</p>
      <h3>¿Cómo entro al panel?</h3>
      <p>Usa el login con código de Admin u Operador creado en el Onboarding.</p>
    </main>
  );
}
