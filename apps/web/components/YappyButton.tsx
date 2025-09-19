// apps/web/components/YappyButton.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Script from 'next/script';

type Props = { bookingId: string };

export default function YappyButton({ bookingId }: Props) {
  const [loading, setLoading] = useState(false);
  const btnRef = useRef<HTMLElement | null>(null);
  const cdn = process.env.NEXT_PUBLIC_YAPPY_BUTTON_CDN || 'https://bt-cdn.yappy.cloud/v1/cdn/web-component-btn-yappy.js';

  useEffect(() => {
    btnRef.current = document.querySelector('btn-yappy');
    if (!btnRef.current) return;

    const onClick = async () => {
      try {
        setLoading(true);
        const r = await fetch('/api/payments/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bookingId }),
        });
        const j = await r.json();
        const y = j?.yappy;
        if (y?.transactionId && y?.token && y?.documentName) {
          // @ts-ignore (API del web component)
          (btnRef.current as any).eventPayment({
            transactionId: y.transactionId,
            token: y.token,
            documentName: y.documentName,
          });
        } else {
          alert('No se pudo iniciar Yappy');
        }
      } catch (e) {
        console.error(e);
        alert('Error iniciando Yappy');
      } finally {
        setLoading(false);
      }
    };

    const onSuccess = () => {
      // La confirmación real llega por IPN
      alert('Pago en proceso. Recibirás confirmación.');
    };
    const onError = () => {
      alert('El pago no pudo completarse.');
    };

    btnRef.current.addEventListener('eventClick', onClick);
    btnRef.current.addEventListener('eventSuccess', onSuccess);
    btnRef.current.addEventListener('eventError', onError);

    return () => {
      if (!btnRef.current) return;
      btnRef.current.removeEventListener('eventClick', onClick);
      btnRef.current.removeEventListener('eventSuccess', onSuccess);
      btnRef.current.removeEventListener('eventError', onError);
    };
  }, [bookingId]);

  return (
    <>
      <Script id="yappy-cdn" type="module" src={cdn} strategy="afterInteractive" />
      <btn-yappy theme="blue" rounded="true" style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }} />
    </>
  );
}
