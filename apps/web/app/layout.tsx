import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: process.env.NEXT_PUBLIC_APP_NAME || "ReservoYA",
  description: "Plataforma de reservas con depósito y recordatorios por WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className="min-h-screen bg-white text-gray-900 antialiased">
        <div className="mx-auto max-w-4xl p-6">
          <header className="mb-8">
            <h1 className="text-3xl font-semibold">
              {process.env.NEXT_PUBLIC_APP_NAME || "ReservoYA"}
            </h1>
            <p className="text-sm text-gray-600">
              Zona horaria: America/Panama — Moneda: USD
            </p>
          </header>
          <main>{children}</main>
          <footer className="mt-12 border-t pt-4 text-xs text-gray-500">
            © {new Date().getFullYear()} ReservoYA
          </footer>
        </div>
      </body>
    </html>
  );
}
