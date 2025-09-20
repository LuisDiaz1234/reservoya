'use client';

import { useMemo, useState } from 'react';
import YappyButton from '@/components/YappyButton';

function money(cents: number) {
  return new Intl.NumberFormat('es-PA', { style: 'currency', currency: 'USD' }).format((cents || 0) / 100);
}

export default function PayBox({
  bookingId,
  defaultDepositCents
}: {
  bookingId: string;
  defaultDepositCents: number;
}) {
  const [testOneCent, setTestOneCent] = useState(false);

  const amountToPayCents = useMemo(
    () => (testOneCent ? 1 : defaultDepositCents),
    [testOneCent, defaultDepositCents]
  );

  return (
    <div className="rounded-2xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-sm">
          <div className="font-semibold">Importe a pagar ahora</div>
          <div className="text-gray-600">
            {testOneCent ? (
              <>
                <span className="mr-2">{money(1)}</span>
                <span className="px-2 py-0.5 text-xs rounded bg-yellow-100 text-yellow-900">Modo prueba</span>
              </>
            ) : (
              money(defaultDepositCents)
            )}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            className="h-4 w-4"
            checked={testOneCent}
            onChange={(e) => setTestOneCent(e.target.checked)}
          />
          Pagar solo <strong>USD 0.01</strong> (prueba)
        </label>
      </div>

      <div className="space-y-2">
        <p className="text-sm">Pagar con Yappy</p>
        <YappyButton bookingId={bookingId} testOneCent={testOneCent} />
        <p className="text-xs text-gray-500">
          Puedes activar/desactivar el modo prueba antes de pagar. El cobro real llegará al aprobarlo en tu app bancaria.
        </p>
      </div>
    </div>
  );
}
