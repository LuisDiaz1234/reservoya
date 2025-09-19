export default function ConfirmPage({ searchParams }: { searchParams: { bookingId?: string; deposit?: string } }) {
  const bookingId = searchParams.bookingId || "";
  const depositCents = Number(searchParams.deposit || "0");

  const deposit = new Intl.NumberFormat("es-PA", { style: "currency", currency: "USD" }).format(depositCents / 100);

  return (
    <section className="space-y-4">
      <h2 className="text-2xl font-semibold">Reserva creada</h2>
      <p>Tu reserva fue creada con estado <strong>PENDING</strong>.</p>
      <p>Depósito estimado: <strong>{deposit}</strong></p>
      <div className="rounded border p-4 text-sm">
        <p className="mb-1">ID de la reserva:</p>
        <code className="break-all">{bookingId}</code>
      </div>
      <p className="text-sm text-gray-600">En la siguiente fase habilitaremos el pago en línea para confirmar.</p>
    </section>
  );
}
