'use client';

// ============================================================================
// PLANEX — shell de vistas (navegación por hash + protección de acceso).
//
//   #/               → Landing de presentación        (pública)
//   #/login          → Acceso (alias + contraseña)    (pública)
//   #/proyectos    → Proyectos compartidos          (protegida)
//   #/editor?plan= → Editor del plan                (protegida)
//   #/preview?plan=→ Vista documental                (protegida)
//   #/colaboracion?plan=&tab= → Colaboración/versiones (protegida)
//   #/ayuda?capa=&articulo=   → Centro de ayuda       (pública)
//
// La sesión la gestiona Supabase Auth (persistida por supabase-js). Las
// vistas protegidas esperan a que el estado de sesión se restaure antes de
// decidir; un visitante sin sesión se redirige al login conservando su
// destino. Los destinos históricos (#/app) se redirigen al panel de
// proyectos.
//
// División de paquetes: landing y login son ligeras y van en el paquete
// inicial; el panel, el editor (motor, plantillas, secciones), la vista
// documental, la colaboración y la ayuda se cargan en diferido.
// ============================================================================

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useRuta, navegar, rutaDeHash } from './navegacion';
import { useAuth, guardarDestino, consumirDestino } from '@/lib/supabase/auth';
import { Landing } from './landing/Landing';
import { Login } from './landing/Login';

const Cargando = ({ texto }: { texto: string }) => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="text-sm text-muted-foreground animate-pulse">{texto}</div>
  </div>
);

const Proyectos = dynamic(() => import('./Proyectos'), {
  ssr: false,
  loading: () => <Cargando texto="Cargando los proyectos compartidos…" />,
});

const Editor = dynamic(() => import('./PlanexApp').then((m) => ({ default: m.PlanexApp })), {
  ssr: false,
  loading: () => <Cargando texto="Cargando el editor…" />,
});

const Previsualizacion = dynamic(() => import('./VistaPreviaDoc'), {
  ssr: false,
  loading: () => <Cargando texto="Cargando la vista documental…" />,
});

const ColaboracionVista = dynamic(() => import('./VistaColaboracion').then((m) => ({ default: m.VistaColaboracion })), {
  ssr: false,
  loading: () => <Cargando texto="Cargando la colaboración del plan…" />,
});

const AyudaVista = dynamic(() => import('./Ayuda').then((m) => ({ default: m.Ayuda })), {
  ssr: false,
  loading: () => <Cargando texto="Cargando la ayuda…" />,
});

function NoConfigurado() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="max-w-md rounded-xl border bg-card p-6 text-sm space-y-3">
        <h1 className="text-base font-semibold">Falta la configuración de colaboración</h1>
        <p className="text-muted-foreground">
          Esta compilación no define las variables públicas <code>NEXT_PUBLIC_SUPABASE_URL</code> y{' '}
          <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code>. Compilación local: cree <code>.env.local</code>;
          despliegue: revise las variables de entorno del flujo de GitHub Actions.
        </p>
        <p className="text-muted-foreground">
          La clave publicable NO es secreta; los datos quedan protegidos por autenticación real y políticas
          RLS del servidor.
        </p>
      </div>
    </div>
  );
}

export function Vistas() {
  const vista = useRuta();
  const estado = useAuth((s) => s.estado);
  const iniciar = useAuth((s) => s.iniciar);
  const [montado, setMontado] = React.useState(false);

  // El HTML prerenderizado corresponde a la landing; el hash se resuelve al
  // montar en el cliente (evita divergencias de hidratación en entradas
  // directas por URL) y la vista real se renderiza inmediatamente después.
  React.useEffect(() => {
    setMontado(true);
  }, []);

  // Restaurar la sesión de Supabase una sola vez (persistida por supabase-js).
  React.useEffect(() => {
    void iniciar();
  }, [iniciar]);

  // Redirección de rutas históricas.
  React.useEffect(() => {
    if (!montado) return;
    const ruta = rutaDeHash(window.location.hash);
    if (ruta === '/app') {
      navegar('/proyectos');
    }
  }, [montado, vista]);

  // Guardia de acceso: solo tras conocer el estado de la sesión. Guarda el
  // destino solicitado para volver a él tras autenticarse correctamente.
  React.useEffect(() => {
    if (!montado) return;
    const protegida = vista === 'proyectos' || vista === 'editor' || vista === 'preview' || vista === 'colaboracion';
    if (!protegida) return;
    if (estado === 'anonimo' || estado === 'no_configurado') {
      guardarDestino(window.location.hash || '#/proyectos');
      navegar('/login');
    }
  }, [vista, montado, estado]);

  // Con sesión válida, el login reenvía al destino pendiente o al panel.
  React.useEffect(() => {
    if (!montado) return;
    if (vista === 'login' && estado === 'autenticado') {
      navegar(consumirDestino() ?? '/proyectos');
    }
  }, [vista, montado, estado]);

  if (!montado) return <Landing />;

  if (estado === 'cargando' && vista !== 'landing' && vista !== 'login') {
    return <Cargando texto="Restaurando la sesión…" />;
  }
  if (estado === 'no_configurado') {
    return vista === 'landing' ? <Landing /> : <NoConfigurado />;
  }

  switch (vista) {
    case 'login':
      return <Login />;
    case 'proyectos':
      return estado === 'autenticado' ? <Proyectos /> : <Cargando texto="Se requiere acceso…" />;
    case 'editor':
      return estado === 'autenticado' ? <Editor /> : <Cargando texto="Se requiere acceso…" />;
    case 'preview':
      return estado === 'autenticado' ? <Previsualizacion /> : <Cargando texto="Se requiere acceso…" />;
    case 'colaboracion':
      return estado === 'autenticado' ? <ColaboracionVista /> : <Cargando texto="Se requiere acceso…" />;
    case 'ayuda':
      return <AyudaVista />;
    default:
      return <Landing />;
  }
}
