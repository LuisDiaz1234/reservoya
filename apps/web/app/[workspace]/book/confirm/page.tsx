// apps/web/app/[workspace]/book/confirm/page.tsx
import YappyButton from '@/components/YappyButton';

export const dynamic = 'force-dynamic';

function money(cents: number) {
  return new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

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

      <div className="rounded-2xl border p-4">
        <h2 className="text-lg font-semibold mb-2">Pagar con Yappy</h2>
        {bookingId ? (
          <>
            <p className="text-sm mb-2">Se abrirá el flujo de Yappy en una ventana/modal.</p>
            <YappyButton bookingId={bookingId} />
          </>
        ) : (
          <p className="text-red-600 text-sm">Falta bookingId en la URL.</p>
        )}
      </div>

      <p className="text-xs text-gray-500">
        Depósito estimado: <strong>{money(depositCents)}</strong>
      </p>
    </div>
  );
}
