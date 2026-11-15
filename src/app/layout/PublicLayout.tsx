import type { ReactNode } from 'react';
import { Garland, SnowBackdrop } from '@/shared/ui/Ambience';
import { Moon, Snowfall, WinterScene } from '@/shared/ui/illustrations';

/** Pantallas sin sesión: bienvenida, entrar, registro. */
export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="relative z-10 min-h-dvh">
      <SnowBackdrop />
      <header className="sky-bg snow-bg relative overflow-hidden px-5 pb-32 pt-[calc(1.5rem+env(safe-area-inset-top))] text-white">
        <Snowfall fall={320} />
        <Moon className="absolute right-5 top-5 w-14 motion-safe:animate-float" />
        <div className="relative mx-auto max-w-lg pr-16">
          <p className="eyebrow text-gold-300">Regalos · Juegos · Celebración</p>
          <p className="font-display mt-1 text-[2.6rem] font-extrabold leading-[0.95]">
            Navidad
            <br />
            en Familia
          </p>
        </div>
        <WinterScene className="h-28" />
      </header>
      <Garland count={8} className="relative mx-auto max-w-3xl" />
      <main className="relative mx-auto w-full max-w-lg px-4 py-6">{children}</main>
    </div>
  );
}
