// apps/web/app/[workspace]/book/confirm/page.tsx
import PayBox from '@/components/PayBox';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export default async function ConfirmPage({
  params,
  searchParams
}: {
  params: { workspace: string },
  searchParams: Record<string, string | string[] | undefined>
}) {
  const bookingId = typeof searchParams.bookingId === 'string' ? searchParams.bookingId : '';

  if (!bookingId) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Confirmar y pagar</h1>
        <p className="text-sm text-gray-600">Workspace: <span className="font-mono">{params.workspace}</span></p>
        <div className="rounded-2xl border p-4">
          <p className="text-red-600 font-medium">Falta <code>bookingId</code> en la URL.</p>
          <ol className="list-decimal ml-5 text-sm mt-2 space-y-1">
            <li>Ve a <strong>Supabase → Table Editor → bookings</strong>.</li>
            <li>Copia el <strong>id</strong> de tu reserva.</li>
            <li>Abre: <code>/{params.workspace}/book/confirm?bookingId=&lt;ID&gt;</code></li>
          </ol>
        </div>
      </div>
    );
  }

  // Traer la reserva para mostrar el depósito real (ya no dependemos de ?deposit)
  const { data: booking, error } = await supabaseAdmin
    .from('bookings')
    .select('id, deposit_cents, status')
    .eq('id', bookingId)
    .maybeSingle();

  if (error) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Confirmar y pagar</h1>
        <p className="text-sm text-gray-600">Workspace: <span className="font-mono">{params.workspace}</span></p>
        <div className="rounded-2xl border p-4">
          <p className="text-red-600">Error consultando Supabase: {error.message}</p>
        </div>
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-4">
        <h1 className="text-2xl font-bold">Confirmar y pagar</h1>
        <p className="text-sm text-gray-600">Workspace: <span className="font-mono">{params.workspace}</span></p>
        <div className="rounded-2xl border p-4">
          <p className="text-red-600">La reserva con id <span className="font-mono">{bookingId}</span> no existe.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Confirmar y pagar</h1>
      <p className="text-sm text-gray-600">Workspace: <span className="font-mono">{params.workspace}</span></p>
      <p className="text-sm text-gray-600">Reserva: <span className="font-mono">{bookingId}</span></p>

      <PayBox bookingId={bookingId} defaultDepositCents={booking.deposit_cents || 0} />
    </div>
  );
}
