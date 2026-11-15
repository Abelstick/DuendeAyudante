import { createContext, useContext, type ReactNode } from 'react';
import type { Container } from './container';

const ContainerContext = createContext<Container | null>(null);

export function ContainerProvider({ container, children }: { container: Container; children: ReactNode }) {
  return <ContainerContext.Provider value={container}>{children}</ContainerContext.Provider>;
}

/** Acceso a los servicios de aplicación desde hooks de presentación. */
export function useServices(): Container {
  const ctx = useContext(ContainerContext);
  if (!ctx) throw new Error('useServices debe usarse dentro de ContainerProvider');
  return ctx;
}
