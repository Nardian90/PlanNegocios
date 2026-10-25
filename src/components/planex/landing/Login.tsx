'use client';

// ============================================================================
// PLANEX — vista de acceso (solo contraseña).
// Sin usuario, correo ni registro de cuentas: una única contraseña,
// comparación exacta y sensible a mayúsculas. La sesión vive en
// sessionStorage; la contraseña introducida nunca se almacena.
// ============================================================================

import * as React from 'react';
import { Fraunces } from 'next/font/google';
import { Eye, EyeOff, ArrowLeft, AlertCircle } from 'lucide-react';
import './landing.css';
import { navegar } from '../navegacion';
import { contrasenaCorrecta, iniciarSesion, sesionActiva, consumirDestino } from '@/lib/planex/auth';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--fraunces',
  display: 'swap',
});

export function Login() {
  const [contrasena, setContrasena] = React.useState('');
  const [visible, setVisible] = React.useState(false);
  const [error, setError] = React.useState(false);
  const [procesando, setProcesando] = React.useState(false);
  const [yaSesion, setYaSesion] = React.useState(false);
  const entrada = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    // Se comprueba tras el montaje para evitar divergencias de hidratación.
    setYaSesion(sesionActiva());
    entrada.current?.focus();
  }, []);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (procesando) return;
    setProcesando(true);
    setError(false);
    // Indicador discreto de procesamiento antes de resolver la comprobación.
    window.setTimeout(() => {
      if (contrasenaCorrecta(contrasena)) {
        iniciarSesion();
        navegar(consumirDestino() ?? '/app');
      } else {
        setProcesando(false);
        setError(true);
        entrada.current?.select();
      }
    }, 380);
  };

  const entrarConSesion = () => {
    navegar(consumirDestino() ?? '/app');
  };

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
            <p className="plx-login-sub">Introduzca la contraseña de acceso para continuar a la aplicación.</p>

            <form onSubmit={enviar} noValidate>
              <label htmlFor="plx-contrasena">Contraseña</label>
              <div className="plx-campo">
                <input
                  id="plx-contrasena"
                  ref={entrada}
                  type={visible ? 'text' : 'password'}
                  value={contrasena}
                  onChange={(e) => { setContrasena(e.target.value); if (error) setError(false); }}
                  placeholder="Contraseña"
                  autoComplete="current-password"
                  aria-invalid={error}
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
                    Contraseña incorrecta. Vuelva a intentarlo.
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

            {yaSesion && (
              <div className="plx-login-sesion">
                Ya existe una sesión activa en esta pestaña.
                <br />
                <button type="button" onClick={entrarConSesion}>Entrar a la aplicación</button>
              </div>
            )}

            <button type="button" className="plx-login-volver" onClick={() => navegar('/')}>
              <ArrowLeft className="size-4" /> Volver a la presentación
            </button>
          </div>
        </main>

        <footer className="plx-login-pie">La sesión se mantiene en esta pestaña; los proyectos guardados no se eliminan al cerrar sesión.</footer>
      </div>
    </div>
  );
}
