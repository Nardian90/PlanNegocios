'use client';

// ============================================================================
// PLANEX — vista de acceso con alias de colaborador.
//
// Se pide USUARIO (alias) y CONTRASEÑA; nunca el correo. El alias se resuelve
// al correo interno de Supabase Auth (variable de compilación pública) y la
// verificación de la contraseña la hace el SERVIDOR con el método estándar
// de correo y contraseña. Las contraseñas no se almacenan en el navegador.
//
// Tras autenticar se comprueba, en el servidor (RLS), que la cuenta tenga
// perfil y pertenezca al espacio de trabajo autorizado; si no, no entra.
// ============================================================================

import * as React from 'react';
import { Fraunces } from 'next/font/google';
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import './landing.css';
import { navegar } from '../navegacion';
import { useAuth, consumirDestino } from '@/lib/supabase/auth';
import { aliasesAdmitidos, normalizarAlias } from '@/lib/supabase/alias';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--fraunces',
  display: 'swap',
});

export function Login() {
  const [usuario, setUsuario] = React.useState('');
  const [contrasena, setContrasena] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [procesando, setProcesando] = React.useState(false);
  const entrar = useAuth((s) => s.entrar);
  const estado = useAuth((s) => s.estado);
  const entradaUsuario = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    entradaUsuario.current?.focus();
  }, []);

  const enviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setError(null);
    const r = await entrar(usuario, contrasena);
    if (r.ok) {
      navegar(consumirDestino() ?? '/proyectos');
      return;
    }
    setProcesando(false);
    setError(r.error ?? 'No se pudo iniciar sesión.');
    if (!normalizarAlias(usuario)) entradaUsuario.current?.select();
    else entradaUsuario.current?.focus();
  };

  const aliasAyuda = aliasesAdmitidos().join(' · ');

  return (
    <div className={`plx-escena ${fraunces.variable}`}>
      <div className="plx-login">
        <header className="plx-wrap" style={{ paddingTop: 26 }}>
          <button className="plx-marca" onClick={() => navegar('/')} aria-label="PLANEX — volver a la presentación">
            <span className="plx-marca-nombre" style={{ fontSize: 17 }}>PLANEX</span>
          </button>
        </header>

        <main className="plx-login-cuerpo">
          <div className="plx-login-tarjeta">
            <div className="plx-login-marca">
              <button onClick={() => navegar('/')} aria-label="PLANEX — volver a la presentación">
                <span className="plx-marca-nombre">PLANEX</span>
                <span className="plx-marca-sub" style={{ display: 'block', marginTop: 6 }}>Plan de Negocios · Inversión Extranjera</span>
              </button>
            </div>

            <h1 className="plx-login-titulo">Acceso a PLANEX</h1>
            <p className="plx-login-sub">
              Introduzca su alias de colaborador y su contraseña para entrar al espacio compartido.
            </p>

            <form onSubmit={enviar} noValidate>
              <label htmlFor="plx-usuario">Usuario</label>
              <div className="plx-campo">
                <input
                  id="plx-usuario"
                  ref={entradaUsuario}
                  type="text"
                  value={usuario}
                  onChange={(e) => { setUsuario(e.target.value); if (error) setError(null); }}
                  placeholder="Colaborador1"
                  autoComplete="username"
                  aria-invalid={!!error}
                  disabled={procesando}
                />
              </div>

              <label htmlFor="plx-contrasena" style={{ marginTop: 12 }}>Contraseña</label>
              <div className="plx-campo">
                <input
                  id="plx-contrasena"
                  type={visible ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => { setContrasena(e.target.value); if (error) setError(null); }}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  aria-invalid={!!error}
                  aria-describedby={error ? 'plx-error-contrasena' : undefined}
                  disabled={procesando}
                />
                <button
                  type="button"
                  className="plx-campo-ojo"
                  onClick={() => setVisible((v) => !v)}
                  aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
                  aria-pressed={visible}
                >
                  {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>

              <div className="plx-error" id="plx-error-contrasena" role="alert" aria-live="assertive">
                {error && (
                  <span style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <AlertCircle className="size-4 shrink-0" style={{ marginTop: 2 }} />
                    {error}
                  </span>
                )}
              </div>

              <button type="submit" className="plx-btn-entrar" disabled={procesando}>
                {procesando ? (
                  <>
                    <span className="plx-btn-entrar-espera" aria-hidden="true" />
                    Verificando…
                  </>
                ) : (
                  'Entrar'
                )}
              </button>
            </form>

            {estado === 'autenticado' && (
              <div className="plx-login-sesion">
                Ya existe una sesión activa en este navegador.
                <br />
                <button type="button" onClick={() => navegar(consumirDestino() ?? '/proyectos')}>Entrar a la aplicación</button>
              </div>
            )}

            <p className="plx-login-pie" style={{ marginTop: 18, fontSize: 11.5 }}>
              Alias admitidos: {aliasAyuda}. La autenticación se realiza contra Supabase Auth; las contraseñas
              no se guardan en este navegador.
            </p>

            <button type="button" className="plx-login-volver" onClick={() => navegar('/')}>
              <ArrowLeft className="size-4" /> Volver a la presentación
            </button>
          </div>
        </main>

        <footer className="plx-login-pie">La sesión se gestiona con Supabase Auth; los proyectos guardados no se eliminan al cerrar sesión.</footer>
      </div>
    </div>
  );
}
