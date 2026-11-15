import type { ReactNode } from 'react';
import { Stars, WinterScene } from '@/shared/ui/illustrations';

/** Pantallas sin sesión: bienvenida, entrar, registro. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="sky-bg relative overflow-hidden px-4 pb-20 pt-[calc(1.75rem+env(safe-area-inset-top))] text-center text-white">
        <Stars />
        <p className="relative text-5xl motion-safe:animate-float" aria-hidden>
          🎄
        </p>
        <p className="relative mt-1 text-3xl font-black">Navidad en Familia</p>
        <p className="relative text-base text-white/85">Regalos, juegos y celebración, todos juntos</p>
        <WinterScene className="absolute inset-x-0 bottom-0 h-20 w-full text-brand-page" />
      </header>
      <main className="relative mx-auto -mt-6 w-full max-w-lg px-4 pb-10">{children}</main>
    </div>
  );
}
