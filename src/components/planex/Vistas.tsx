'use client';

// ============================================================================
// PLANEX — shell de vistas (navegación por hash + protección de acceso).
//
//   #/         → Landing de presentación        (pública)
//   #/login    → Acceso mediante contraseña     (pública)
//   #/app      → Aplicación (editor del plan)   (protegida)
//   #/preview  → Vista documental del plan      (protegida)
//
// Flujo: Landing → Login → Aplicación → Previsualización → edición.
// Las vistas protegidas comprueban la sesión antes de renderizarse; un
// visitante sin sesión se redirige al login conservando su destino.
//
// División de paquetes: landing y login son ligeras y van en el paquete
// inicial; el editor (motor, plantillas, secciones) y la previsualización se
// cargan en diferido, de modo que la maquinaria de edición financiera no se
// descarga hasta acceder a la aplicación.
// ============================================================================

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRuta, navegar, type VistaRuta } from './navegacion';
import { sesionActiva, guardarDestino } from '@/lib/planex/auth';
import { Landing } from './landing/Landing';
import { Login } from './landing/Login';

const Cargando = ({ texto }: { texto: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-sm text-muted-foreground animate-pulse">{texto}</div>
  </div>
);

const Editor = dynamic(() => import('./PlanexApp').then((m) => ({ default: m.PlanexApp })), {
  ssr: false,
  loading: () => <Cargando texto="Cargando el editor…" />,
});

const Previsualizacion = dynamic(() => import('./VistaPreviaDoc'), {
  ssr: false,
  loading: () => <Cargando texto="Cargando la vista documental…" />,
});

function Redirigiendo() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-sm text-muted-foreground">Se requiere acceso. Redirigiendo…</div>
    </div>
  );
}

const PROTEGIDAS: VistaRuta[] = ['app', 'preview'];

export function Vistas() {
  const vista = useRuta();
  const [montado, setMontado] = React.useState(false);

  // El HTML prerenderizado corresponde a la landing; el hash se resuelve al
  // montar en el cliente (evita divergencias de hidratación en entradas
  // directas por URL) y la vista real se renderiza inmediatamente después.
  React.useEffect(() => {
    setMontado(true);
  }, []);

  // Guardia de acceso: comprueba la sesión en cada cambio de vista, al
  // recargar y ante entradas directas por URL. Guarda el destino solicitado
  // para volver a él tras autenticarse correctamente.
  React.useEffect(() => {
    if (PROTEGIDAS.includes(vista) && !sesionActiva()) {
      guardarDestino(window.location.hash || '#/app');
      navegar('/login');
    }
  }, [vista, montado]);

  if (!montado) return <Landing />;

  switch (vista) {
    case 'login':
      return <Login />;
    case 'app':
      return sesionActiva() ? <Editor /> : <Redirigiendo />;
    case 'preview':
      return sesionActiva() ? <Previsualizacion /> : <Redirigiendo />;
    default:
      return <Landing />;
  }
}
