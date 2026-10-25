'use client';

// ============================================================================
// PLANEX — Landing de presentación.
// Página premium de acceso al producto: héroe editorial, funcionalidades
// reales, metodología de trabajo, composiciones de la interfaz real y cierre.
// Solo CSS/SVG; sin bibliotecas de animación; respeta prefers-reduced-motion.
// ============================================================================

import * as React from 'react';
import { Fraunces } from 'next/font/google';
import './landing.css';
import { navegar, prefiereMovimientoReducido } from '../navegacion';
import { useAuth } from '@/lib/supabase/auth';

const fraunces = Fraunces({
  subsets: ['latin'],
  style: ['normal', 'italic'],
  variable: '--fraunces',
  display: 'swap',
});

const RUTA_BASE = process.env.NEXT_PUBLIC_BASE_PATH ?? '';

const FUNCIONALIDADES: { nombre: string; desc: string; glifo: React.ReactNode }[] = [
  {
    nombre: 'Plantillas especializadas y generales',
    desc: 'Ejemplo completo de Clínica Estomatológica con datos ficticios coherentes y plantilla Default con ayudas metodológicas por apartado. Cada plan creado es independiente de su plantilla de origen.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9h18M9 9v12" />
      </svg>
    ),
  },
  {
    nombre: 'Motor de cálculo configurable sin programar',
    desc: 'Veintitrés parámetros editables y cuarenta reglas con fórmulas modificables desde un constructor visual: cambiar la tasa del impuesto y cambiar su fórmula son dos capacidades distintas e independientes.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M4 7h16M4 17h16" />
        <path d="M7 4c0 3-3 3-3 0s3-3 3 0Zm13 0c0 3-3 3-3 0s3-3 3 0Z" />
        <path d="M7 20c0 3-3 3-3 0s3-3 3 0Z" />
      </svg>
    ),
  },
  {
    nombre: 'Proyecciones financieras y análisis de recuperación',
    desc: 'Estado de resultados plurianual, flujo de caja, período de recuperación por interpolación del flujo acumulado y verificación del horizonte ≥ recuperación + 1.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M4 20V4M4 20h16" />
        <path d="M6 16l4-5 3 3 5-7" />
      </svg>
    ),
  },
  {
    nombre: 'Generación de documentos PDF',
    desc: 'Documento con portada, índice paginado a doble pasada, encabezados repetidos en tablas y texto seleccionable, generado con los datos y reglas vigentes del modelo.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M7 3h7l4 4v14H7z" />
        <path d="M14 3v4h4M10 12h6M10 16h6" />
      </svg>
    ),
  },
  {
    nombre: 'Libros Excel con fórmulas reales',
    desc: 'Dieciocho hojas con fórmulas vivas y referencias entre hojas —el impuesto es =MAX(0; UAI × tasa)— con recálculo automático al abrir y celdas de entrada diferenciadas.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="1" />
        <path d="M3 9h18M3 15h18M9 3v18" />
      </svg>
    ),
  },
  {
    nombre: 'Importación y exportación de proyectos JSON',
    desc: 'Esquema versionado con validación: guardar, intercambiar y reabrir proyectos conservando las reglas y parámetros propios del autor. Sin ejecución de código del archivo.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M8 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2M16 3h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2" />
        <path d="M10 8l-2 4h8l-2-4M10 16l-2-4h8l-2 4" opacity="0" />
        <path d="M9 12h6" />
      </svg>
    ),
  },
  {
    nombre: 'Control de aportaciones, inversiones y beneficios al país',
    desc: 'Tablas metodológicas de aportes por socio y año, inversión por componente y moneda, fuerza de trabajo en CUP y beneficios directos al país con acumulados calculados por el motor.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M4 21V10l6-3v14M10 21V4l10 3v14" />
        <path d="M2 21h20" />
      </svg>
    ),
  },
  {
    nombre: 'Colaboración en un espacio compartido',
    desc: 'Dos colaboradores trabajan el mismo plan desde equipos distintos con autoguardado, sincronización en vivo, historial de versiones, registro de actividad y control de conflictos. Los datos viven en Supabase, protegidos por autenticación real y políticas RLS del servidor.',
    glifo: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
        <path d="M12 3a9 9 0 1 0 9 9c0-5-4-9-9-9Z" />
        <path d="M12 3v18M3 12h18" opacity="0.5" />
        <path d="M12 3a9 9 0 0 1 9 9h-9Z" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

const PASOS: { titulo: string; desc: string }[] = [
  { titulo: 'Seleccionar una plantilla', desc: 'Ejemplo clínico completo o estructura general con ayudas metodológicas.' },
  { titulo: 'Completar la información del negocio', desc: 'Formularios de las secciones 4.1 a 4.12 con validaciones e indicadores de avance.' },
  { titulo: 'Configurar parámetros y fórmulas', desc: 'Tasas, tipo de cambio, crecimientos y reglas del motor editables con auditoría.' },
  { titulo: 'Comprobar proyecciones e inconsistencias', desc: 'Alertas clasificadas y navegación directa al apartado afectado.' },
  { titulo: 'Previsualizar y exportar el plan', desc: 'Vista documental independiente y exportación a PDF, Excel y JSON.' },
];

function irASeccion(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: prefiereMovimientoReducido() ? 'auto' : 'smooth' });
}

export function Landing() {
  const raiz = React.useRef<HTMLDivElement>(null);
  const [pegada, setPegada] = React.useState(false);

  // Aparición progresiva de secciones (desactivada si se prefiere menos movimiento)
  React.useEffect(() => {
    const el = raiz.current;
    if (!el) return;
    const objetivos = el.querySelectorAll('.plx-revelar');
    if (prefiereMovimientoReducido() || typeof IntersectionObserver === 'undefined') {
      objetivos.forEach((o) => o.classList.add('plx-visible'));
      return;
    }
    const io = new IntersectionObserver(
      (entradas) => {
        entradas.forEach((en) => {
          if (en.isIntersecting) {
            en.target.classList.add('plx-visible');
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -6% 0px' },
    );
    objetivos.forEach((o) => io.observe(o));
    return () => io.disconnect();
  }, []);

  React.useEffect(() => {
    const alScroll = () => setPegada(window.scrollY > 10);
    alScroll();
    window.addEventListener('scroll', alScroll, { passive: true });
    return () => window.removeEventListener('scroll', alScroll);
  }, []);

  const entrar = () => navegar(useAuth.getState().estado === 'autenticado' ? '/proyectos' : '/login');

  return (
    <div ref={raiz} className={`plx-escena ${fraunces.variable}`}>
      {/* ---------------------------------------------------- cabecera */}
      <header className={`plx-header ${pegada ? 'plx-pegada' : ''}`}>
        <div className="plx-header-in">
          <button className="plx-marca" onClick={() => window.scrollTo({ top: 0, behavior: prefiereMovimientoReducido() ? 'auto' : 'smooth' })} aria-label="PLANEX — volver arriba">
            <span className="plx-marca-nombre">PLANEX</span>
            <span className="plx-marca-sub">Plan de Negocios · Inversión Extranjera</span>
          </button>
          <nav className="plx-nav" aria-label="Navegación de la presentación">
            <a href="#funcionalidades" onClick={(e) => { e.preventDefault(); irASeccion('funcionalidades'); }}>Funcionalidades</a>
            <a href="#metodologia" onClick={(e) => { e.preventDefault(); irASeccion('metodologia'); }}>Metodología</a>
            <a href="#producto" onClick={(e) => { e.preventDefault(); irASeccion('producto'); }}>Producto</a>
            <button className="plx-btn-acceso" onClick={entrar}>Acceder</button>
          </nav>
        </div>
      </header>

      {/* ---------------------------------------------------- héroe */}
      <div className="plx-wrap">
        <section className="plx-hero">
          <div>
            <p className="plx-kicker">Planificación financiera · GOC-2026-O57</p>
            <h1>
              De los supuestos a un plan de negocios <em>estructurado</em>
            </h1>
            <p className="plx-hero-sub">
              Elabora, analiza y documenta propuestas de inversión extranjera con herramientas de planificación
              financiera, cálculos configurables y exportación profesional.
            </p>
            <div className="plx-cta-fila">
              <button className="plx-btn-primario" onClick={entrar}>
                Acceder a PLANEX
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>
              <button className="plx-btn-secundario" onClick={() => irASeccion('funcionalidades')}>
                Explorar funcionalidades
              </button>
            </div>
            <div className="plx-hero-meta">
              <span>Estructura <b>4.1 – 4.12</b></span>
              <span>Motor <b>parametrizable</b></span>
              <span>Exportación <b>PDF · Excel · JSON</b></span>
              <span>Colaboración <b>en tiempo real</b></span>
            </div>
          </div>

          {/* Composición abstracta: proyección sobre retícula técnica */}
          <div className="plx-hero-arte" aria-hidden="true">
            <svg viewBox="0 0 560 520" role="presentation">
              <defs>
                <linearGradient id="plx-g-curva" x1="0" y1="1" x2="1" y2="0">
                  <stop offset="0%" stopColor="#d4875a" stopOpacity="0.15" />
                  <stop offset="100%" stopColor="#e8b088" stopOpacity="1" />
                </linearGradient>
                <linearGradient id="plx-g-area" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4875a" stopOpacity="0.20" />
                  <stop offset="100%" stopColor="#d4875a" stopOpacity="0" />
                </linearGradient>
              </defs>

              {/* retícula de plano */}
              {Array.from({ length: 14 }, (_, i) => (
                <line key={`h${i}`} x1="0" y1={i * 40} x2="560" y2={i * 40} stroke="#ece7db" strokeOpacity="0.05" strokeWidth="1" />
              ))}
              {Array.from({ length: 14 }, (_, i) => (
                <line key={`v${i}`} x1={i * 40} y1="0" x2={i * 40} y2="520" stroke="#ece7db" strokeOpacity="0.05" strokeWidth="1" />
              ))}

              {/* hoja documental en perspectiva */}
              <g transform="translate(150 40) rotate(4)">
                <rect x="0" y="0" width="330" height="300" fill="#0d1119" stroke="#ece7db" strokeOpacity="0.22" />
                <rect x="26" y="28" width="120" height="10" fill="#ece7db" fillOpacity="0.30" />
                <rect x="26" y="48" width="72" height="7" fill="#ece7db" fillOpacity="0.14" />
                {Array.from({ length: 9 }, (_, i) => (
                  <line key={`t${i}`} x1="26" y1={78 + i * 22} x2="278" y2={78 + i * 22} stroke="#ece7db" strokeOpacity="0.10" strokeWidth="1" />
                ))}
                {Array.from({ length: 8 }, (_, i) => (
                  <line key={`c${i}`} x1={110 + (i % 3) * 62} y1={i < 4 ? 78 : 78 + 4 * 22} x2={110 + (i % 3) * 62} y2={i < 4 ? 78 + 4 * 22 : 78 + 9 * 22} stroke="#ece7db" strokeOpacity="0.07" strokeWidth="1" />
                ))}
                <rect x="26" y="252" width="180" height="8" fill="#d4875a" fillOpacity="0.55" />
              </g>

              {/* curva de proyección principal */}
              <path d="M40 430 C 140 420, 200 388, 268 330 S 420 205, 512 108" fill="none" stroke="url(#plx-g-curva)" strokeWidth="2.5" className="plx-trazo-curva" />
              <path d="M40 430 C 140 420, 200 388, 268 330 S 420 205, 512 108 L 512 470 L 40 470 Z" fill="url(#plx-g-area)" opacity="0" className="plx-nodo plx-nodo-3" />

              {/* curva secundaria (costos) */}
              <path d="M40 448 C 150 442, 230 420, 310 372 S 450 290, 512 232" fill="none" stroke="#8fb5a4" strokeOpacity="0.75" strokeWidth="1.6" strokeDasharray="3 5" className="plx-trazo-curva-2" />

              {/* nodos y ticks */}
              {[
                { x: 40, y: 430, c: 'plx-nodo-1' },
                { x: 268, y: 330, c: 'plx-nodo-2' },
                { x: 512, y: 108, c: 'plx-nodo-3' },
              ].map((n, i) => (
                <g key={i} className={`plx-nodo ${n.c}`}>
                  <circle cx={n.x} cy={n.y} r="4.5" fill="#0a0d13" stroke="#d4875a" strokeWidth="2" />
                  <line x1={n.x} y1={n.y + 8} x2={n.x} y2="470" stroke="#d4875a" strokeOpacity="0.28" strokeWidth="1" strokeDasharray="2 4" />
                </g>
              ))}

              {/* línea base */}
              <line x1="40" y1="470" x2="512" y2="470" stroke="#ece7db" strokeOpacity="0.25" strokeWidth="1" />
              <text x="40" y="492" fill="#ece7db" fillOpacity="0.4" fontSize="11" fontFamily="Georgia, serif" fontStyle="italic">Horizonte de análisis</text>
              <text x="512" y="492" textAnchor="end" fill="#ece7db" fillOpacity="0.4" fontSize="11" fontFamily="Georgia, serif" fontStyle="italic">Recuperación</text>
            </svg>
          </div>
        </section>
      </div>

      {/* ---------------------------------------------------- funcionalidades */}
      <section className="plx-seccion plx-seccion-borde" id="funcionalidades" aria-labelledby="titulo-func">
        <div className="plx-wrap">
          <div className="plx-seccion-cab plx-revelar">
            <div>
              <p className="plx-seccion-eyebrow">Funcionalidades</p>
              <h2 className="plx-seccion-titulo" id="titulo-func">
                Herramientas <em>reales</em>, no promesas
              </h2>
            </div>
            <p className="plx-seccion-entradilla">
              Cada capacidad listada corresponde a una función implementada y verificada de la aplicación:
              del motor de cálculo editable a las exportaciones con fórmulas vivas.
            </p>
          </div>
          <div>
            {FUNCIONALIDADES.map((f, i) => (
              <div key={f.nombre} className={`plx-func-item plx-revelar ${i % 2 === 0 ? 'plx-revelar-medio' : 'plx-revelar-lento'}`}>
                <span className="plx-func-num">{String(i + 1).padStart(2, '0')}</span>
                <div>
                  <div className="plx-func-nombre">{f.nombre}</div>
                  <div className="plx-func-desc">{f.desc}</div>
                </div>
                <span className="plx-func-glifo">{f.glifo}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- metodología */}
      <section className="plx-seccion plx-seccion-borde" id="metodologia" aria-labelledby="titulo-metodo">
        <div className="plx-wrap">
          <div className="plx-seccion-cab plx-revelar">
            <div>
              <p className="plx-seccion-eyebrow">Metodología de trabajo</p>
              <h2 className="plx-seccion-titulo" id="titulo-metodo">
                Del supuesto al <em>expediente</em>
              </h2>
            </div>
            <p className="plx-seccion-entradilla">
              Un flujo continuo entre edición y verificación: cualquier cambio de parámetro o fórmula recalcula
              proyecciones, flujo de caja, recuperación, resumen ejecutivo y exportaciones.
            </p>
          </div>
          <ol className="plx-pasos" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {PASOS.map((p, i) => (
              <li key={p.titulo} className={`plx-paso plx-revelar ${i % 2 ? 'plx-revelar-medio' : ''}`}>
                <div className="plx-paso-num">{i + 1}</div>
                <div className="plx-paso-titulo">{p.titulo}</div>
                <div className="plx-paso-desc">{p.desc}</div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------------------------------------------------- producto */}
      <section className="plx-seccion plx-seccion-borde" id="producto" aria-labelledby="titulo-producto">
        <div className="plx-wrap">
          <div className="plx-seccion-cab plx-revelar">
            <div>
              <p className="plx-seccion-eyebrow">El producto</p>
              <h2 className="plx-seccion-titulo" id="titulo-producto">
                La interfaz, <em>sin maquillaje</em>
              </h2>
            </div>
            <p className="plx-seccion-entradilla">
              Capturas reales de PLANEX Cuba con el ejemplo de la Clínica Estomatológica cargado: tablas
              financieras del motor, proyección plurianual y configuración del impuesto.
            </p>
          </div>
          <div className="plx-producto-grid">
            <figure className="plx-captura plx-captura-grande plx-revelar" style={{ margin: 0 }}>
              <div className="plx-captura-marco">
                <img src={`${RUTA_BASE}/capturas/captura-claro.png`} alt="Sección de análisis financiero de PLANEX con la proyección plurianual del ejemplo clínica" loading="lazy" />
              </div>
              <figcaption className="plx-captura-pie">
                <b>4.7 Análisis financiero.</b> Proyección plurianual con estado de resultados, flujo de caja y
                recuperación; las celdas calculadas muestran su fórmula al pasar el cursor.
              </figcaption>
            </figure>
            <div className="plx-captura-columna">
              <figure className="plx-captura plx-captura-mini plx-revelar plx-revelar-medio" style={{ margin: 0 }}>
                <div className="plx-captura-marco">
                  <img src={`${RUTA_BASE}/capturas/captura-oscuro.png`} alt="Interfaz de PLANEX en tema oscuro" loading="lazy" />
                </div>
                <figcaption className="plx-captura-pie">
                  <b>Tema oscuro.</b> La vista documental de previsualización mantiene el fondo neutro para la lectura.
                </figcaption>
              </figure>
              <div className="plx-revelar plx-revelar-lento" style={{ borderLeft: '1px solid var(--linea-fuerte)', padding: '4px 0 4px 18px' }}>
                <div style={{ fontSize: 13.5, lineHeight: 1.7, color: 'var(--papel-55)' }}>
                  Ambas vistas provienen de la misma aplicación desplegada; el motor de cálculo, las reglas y los
                  indicadores idénticos a los del documento exportado.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- cierre */}
      <section className="plx-cierre">
        <div className="plx-wrap">
          <div className="plx-revelar">
            <h2>
              Convierta los supuestos en un expediente <em>presentable</em>
            </h2>
            <p>
              PLANEX organiza la información del negocio conforme a las Bases Metodológicas de la
              GOC-2026-O57, mantiene los cálculos bajo su control y produce el documento final listo
              para revisión. El acceso se realiza con la cuenta de colaborador del espacio compartido.
            </p>
            <button className="plx-btn-primario" onClick={entrar}>
              Acceder a PLANEX
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path d="M5 12h14m-6-6 6 6-6 6" />
              </svg>
            </button>
          </div>
        </div>
      </section>

      {/* ---------------------------------------------------- pie */}
      <footer className="plx-footer">
        <div className="plx-wrap">
          <div className="plx-footer-grid">
            <div>
              <div className="plx-footer-marca">PLANEX</div>
              <p>
                Herramienta para elaborar planes de negocios de propuestas con inversión extranjera,
                conforme a los epígrafes 4.1–4.12 de las Bases Metodológicas publicadas en la Gaceta Oficial
                GOC-2026-O57, con espacio de trabajo compartido y sincronización entre colaboradores.
              </p>
            </div>
            <div>
              <h4>Vistas</h4>
              <div className="plx-footer-links">
                <button onClick={entrar}>Acceso y aplicación</button>
                <button onClick={() => irASeccion('funcionalidades')}>Funcionalidades</button>
                <button onClick={() => irASeccion('metodologia')}>Metodología</button>
                <button onClick={() => irASeccion('producto')}>El producto</button>
              </div>
            </div>
            <div>
              <h4>Nota</h4>
              <p>
                PLANEX organiza y documenta propuestas de inversión; el análisis generado requiere validar las
                normas, autorizaciones y datos aplicables al proyecto real antes de cualquier presentación
                oficial. La plantilla de ejemplo contiene datos ficticios.
              </p>
            </div>
          </div>
          <div className="plx-footer-fin">
            <span>PLANEX — planificación empresarial y financiera</span>
            <span>Aplicación estática · espacio compartido en Supabase con RLS</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
