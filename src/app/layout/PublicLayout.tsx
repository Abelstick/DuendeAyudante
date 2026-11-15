import type { ReactNode } from 'react';
import { LevelScene, PixelCloud, PixelStar, Snowfall } from '@/shared/ui/illustrations';

/** Pantallas sin sesión: bienvenida, entrar, registro. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh">
      <header className="day-sky relative overflow-hidden border-b-[3px] border-night-900 px-4 pb-28 pt-[calc(1.5rem+env(safe-area-inset-top))] text-center">
        <PixelCloud className="pointer-events-none absolute left-0 top-4 w-20 motion-safe:animate-drift" />
        <PixelCloud className="pointer-events-none absolute left-0 top-20 w-14 motion-safe:animate-drift" style={{ animationDuration: '55s', animationDelay: '-30s' }} />
        <Snowfall fall={300} />
        <PixelStar className="relative mx-auto w-12 motion-safe:animate-spin-coin" />
        <p className="font-display text-outline relative mt-2 text-[2.1rem] font-bold leading-tight">Navidad en Familia</p>
        <p className="relative mx-auto mt-3 w-fit rounded-lg border-2 border-night-900 bg-white px-3 py-1 text-base font-bold text-night-900">
          Regalos, juegos y celebración
        </p>
        <LevelScene />
      </header>
      <main className="relative mx-auto w-full max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
