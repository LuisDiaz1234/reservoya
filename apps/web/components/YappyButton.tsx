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

        if (!r.ok) {
          const msg = j?.error || 'Error al crear sesión';
          const detail = typeof j?.detail === 'string' ? j.detail : JSON.stringify(j?.detail || {});
          alert(`Error backend: ${msg}\nDetalle: ${detail}`);
          return;
        }

        const y = j?.yappy;
        if (y?.transactionId && y?.token && y?.documentName) {
          // @ts-ignore Web Component oficial
          (btnRef.current as any).eventPayment({
            transactionId: y.transactionId,
            token: y.token,
            documentName: y.documentName,
          });
        } else {
          alert('Respuesta incompleta de Yappy (falta transactionId/token/documentName)');
        }
      } catch (e: any) {
        alert(`Error iniciando Yappy: ${e?.message || e}`);
      } finally {
        setLoading(false);
      }
    };

    const onSuccess = () => { alert('Pago en proceso. Recibirás confirmación.'); };
    const onError = (e: any) => { alert(`Yappy reportó error: ${e?.detail ? JSON.stringify(e.detail) : 'desconocido'}`); };

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
      {/* @ts-ignore declarado en custom-elements.d.ts */}
      <btn-yappy theme="blue" rounded="true" style={{ opacity: loading ? 0.6 : 1, pointerEvents: loading ? 'none' : 'auto' }} />
    </>
  );
}
