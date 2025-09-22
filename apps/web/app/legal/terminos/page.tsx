// apps/web/app/legal/terminos/page.tsx
export const dynamic = 'force-dynamic';
export default function Page() {
  return (
    <main className="max-w-3xl mx-auto p-6 prose">
      <h1>Términos y Condiciones</h1>
      <p>Bienvenido a ReservoYA. Al usar la plataforma aceptas estos términos...</p>
      <h2>Uso de la plataforma</h2>
      <ul>
        <li>Reservas y pagos: El comercio define depósitos y políticas.</li>
        <li>Reembolsos: Se rigen por la política del comercio.</li>
        <li>WhatsApp: Solo se envían confirmaciones y recordatorios.</li>
      </ul>
      <h2>Responsabilidades</h2>
      <p>La plataforma facilita el agendamiento y cobro de depósitos, no presta el servicio contratado.</p>
      <h2>Contacto</h2>
      <p>Soporte: soporte@reservoya.app</p>
    </main>
  );
}
