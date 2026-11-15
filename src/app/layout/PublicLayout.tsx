import type { ReactNode } from 'react';

/** Pantallas sin sesión: bienvenida, entrar, registro. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="snow-bg bg-brand px-4 py-6 text-center text-white">
        <p className="text-4xl" aria-hidden>
          🎄
        </p>
        <p className="mt-1 text-2xl font-bold">Navidad en Familia</p>
      </header>
      <main className="mx-auto w-full max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
