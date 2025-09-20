export const metadata = { title: 'ReservoYA', description: 'Reservas con depósito' };

import './globals.css';
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
