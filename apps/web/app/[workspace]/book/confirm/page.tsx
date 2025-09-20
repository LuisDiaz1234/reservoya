import PayBox from '@/components/PayBox';

export const dynamic = 'force-dynamic';

export default async function ConfirmPage({
  params,
  searchParams
}: {
  params: { workspace: string },
  searchParams: Record<string, string | string[] | undefined>
}) {
  const bookingId = typeof searchParams.bookingId === 'string' ? searchParams.bookingId : '';
  const depositCents = Number(typeof searchParams.deposit === 'string' ? searchParams.deposit : '0');

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Confirmar y pagar</h1>
      <p className="text-sm text-gray-600">Workspace: <span className="font-mono">{params.workspace}</span></p>
      <p className="text-sm text-gray-600">Reserva: <span className="font-mono">{bookingId || '(desconocida)'}</span></p>

      {bookingId ? (
        <PayBox bookingId={bookingId} defaultDepositCents={depositCents || 0} />
      ) : (
        <div className="rounded-2xl border p-4">
          <p className="text-red-600 text-sm">Falta bookingId en la URL.</p>
        </div>
      )}
    </div>
  );
}
