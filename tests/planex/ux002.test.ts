// ============================================================================
// UX-002 — Pruebas del Centro de ayuda (Diátaxis), la navegación integrada,
// la comparación de versiones, los iconos de la aplicación y la tasa 743.
// ============================================================================

import { describe, expect, test } from 'bun:test';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  ARTICULOS_AYUDA,
  AVISO_DIDACTICO,
  AVISO_TASA,
  CAPAS,
  articuloPorId,
  articulosPorCapa,
  auditarContenido,
  buscarAyuda,
  capaDeArticulo,
  type ArticuloAyuda,
  type BloqueAyuda,
} from '../../src/lib/planex/ayuda/contenido';
import { vistaDesdeHash, urlAyuda, type VistaRuta } from '../../src/components/planex/navegacion';
import { compararSnapshots, contarCambios } from '../../src/lib/supabase/comparar-versiones';
import { diferenciarJSON } from '../../src/lib/planex/diferencias';
import type { VersionRow } from '../../src/lib/supabase/tipos';
import { parametrosPorDefecto } from '../../src/lib/planex/templates/reglas';

const RAIZ = process.cwd();

// ----------------------------------------------------------------------------
// Centro de ayuda — integridad del contenido (misión UX-002 §2)
// ----------------------------------------------------------------------------

describe('UX-002 §2 — Centro de ayuda Diátaxis', () => {
  test('la auditoría de contenido no reporta errores (ids, capas, enlaces, estructura)', () => {
    const { errores } = auditarContenido();
    expect(errores).toEqual([]);
  });

  test('existen las CUATRO capas de Diátaxis y todas tienen artículos', () => {
    expect(CAPAS).toHaveLength(4);
    expect(CAPAS.map((c) => c.id).join(',')).toBe('tutoriales,guias,referencia,conceptos');
    for (const capa of CAPAS) {
      expect(articulosPorCapa(capa.id).length).toBeGreaterThan(0);
    }
  });

  test('hay al menos un tutorial INTEGRAL con pasos verificables (dónde/acción/resultado)', () => {
    const tutoriales = articulosPorCapa('tutoriales');
    expect(tutoriales.length).toBeGreaterThanOrEqual(1);
    const t = articuloPorId('tutorial-primer-plan')!;
    const pasos = t.bloques.filter((b) => b.tipo === 'pasos').flatMap((b) => (b.tipo === 'pasos' ? b.pasos : []));
    expect(pasos.length).toBeGreaterThanOrEqual(8);
    for (const p of pasos) {
      // Cada paso debe indicar DÓNDE está la acción y QUÉ esperar: un
      // tutorial que solo enumera pasos no cuenta como tutorial.
      expect(p.donde.length).toBeGreaterThan(3);
      expect(p.accion.length).toBeGreaterThan(3);
      expect(p.resultado.length).toBeGreaterThan(3);
    }
  });

  test('existen guías prácticas para las tareas más importantes (≥ 12, misión §2.1B)', () => {
    const guias = articulosPorCapa('guias');
    expect(guias.length).toBeGreaterThanOrEqual(12);
    const ids = new Set(guias.map((g) => g.id));
    // Cobertura explícita de la misión.
    for (const id of [
      'guia-cambiar-tasa',
      'guia-monedad-presentacion',
      'guia-supuesto-configurable',
      'guia-plan-financiado',
      'guia-diferencia-resumen-tabla',
      'guia-advertencia-capacidad',
      'guia-formulas-impuestos',
      'guia-generar-pdf',
      'guia-exportar-word',
      'guia-versiones-comparar',
      'guia-restaurar-version',
      'guia-compartir-plan',
    ]) {
      expect(ids.has(id)).toBe(true);
    }
  });

  test('cada guía tiene objetivo, requisitos, pasos, resultado y errores frecuentes', () => {
    for (const g of articulosPorCapa('guias')) {
      expect(g.objetivo).toBeDefined();
      expect(g.requisitos!.length).toBeGreaterThan(0);
      expect(g.resultado).toBeDefined();
      expect(g.errores!.length).toBeGreaterThan(0);
      const tienePasos = g.bloques.some((b) => b.tipo === 'pasos' && b.pasos.length > 0);
      expect(tienePasos).toBe(true);
    }
  });

  test('las fichas de fórmulas incluyen variables con unidad y EJEMPLO NUMÉRICO reproducible', () => {
    const formulas = ARTICULOS_AYUDA.flatMap((a) =>
      a.bloques.filter((b): b is Extract<BloqueAyuda, { tipo: 'formula' }> => b.tipo === 'formula').map((b) => ({ articulo: a.id, b })),
    );
    expect(formulas.length).toBeGreaterThanOrEqual(5);
    for (const { articulo, b } of formulas) {
      expect(b.expresion.length).toBeGreaterThan(3);
      expect(b.variables.length).toBeGreaterThan(0);
      for (const v of b.variables) expect(v.unidad.length).toBeGreaterThan(0);
      expect(b.ejemplo.length).toBeGreaterThan(10);
      void articulo;
    }
    // La ficha de conversión usa la tasa VIGENTE (743), no la antigua 400.
    const conv = ARTICULOS_AYUDA.flatMap((a) => a.bloques)
      .find((b): b is Extract<BloqueAyuda, { tipo: 'formula' }> => b.tipo === 'formula' && b.expresion.includes('USD = CUP / tasa'))!;
    expect(conv.ejemplo).toContain('743');
    expect(conv.ejemplo).not.toContain('400 000 CUP / 400');
  });

  test('los datos didácticos están rotulados como FICTICIOS (misión §2.2)', () => {
    expect(AVISO_DIDACTICO).toContain('Ejemplo didáctico');
    expect(AVISO_DIDACTICO).toContain('no verificadas');
    // Los artículos con cifras de plantilla incluyen el aviso o la tasa.
    const conAviso = ARTICULOS_AYUDA.filter((a) =>
      a.bloques.some((b) => (b.tipo === 'aviso' || b.tipo === 'formula') && (b.tipo === 'aviso' ? b.texto.includes('Ejemplo didáctico') : b.ejemplo.includes('Ejemplo didáctico'))),
    );
    expect(conAviso.length).toBeGreaterThanOrEqual(6);
    expect(AVISO_TASA).toContain('743 CUP/USD');
    expect(AVISO_TASA).toContain('pendiente');
  });

  test('la referencia documenta las secciones 4.1–4.12, parámetros, monedas, indicadores y exportaciones', () => {
    const ref = articulosPorCapa('referencia').map((r) => r.id);
    for (const id of ['ref-secciones', 'ref-parametros', 'ref-monedas-unidades', 'ref-formulas', 'ref-indicadores', 'ref-estados-alertas', 'ref-colaboracion-versiones', 'ref-exportaciones']) {
      expect(ref.includes(id)).toBe(true);
    }
    const secciones = articuloPorId('ref-secciones')!;
    const tabla = secciones.bloques.find((b): b is Extract<BloqueAyuda, { tipo: 'tabla' }> => b.tipo === 'tabla')!;
    const texto = tabla.filas.flat().join('|');
    for (const num of ['4.1', '4.4', '4.5', '4.6', '4.7', '4.8', '4.9', '4.10', '4.11', '4.12']) {
      expect(texto.includes(num)).toBe(true);
    }
  });

  test('la BÚSQUEDA devuelve resultados relevantes con enlaces internos (misión §2.3)', () => {
    // «tasa» → la guía de la tasa es de los primeros resultados.
    const rTasa = buscarAyuda('tasa de cambio');
    expect(rTasa.length).toBeGreaterThan(0);
    expect(rTasa.slice(0, 3).some((r) => r.articulo.id === 'guia-cambiar-tasa')).toBe(true);
    // Tolerancia a acentos y caja.
    const rMoneda = buscarAyuda('MONEDA DE PRESENTACIÓN');
    expect(rMoneda.some((r) => r.articulo.id === 'guia-monedad-presentacion')).toBe(true);
    // «versiones» → comparar/restaurar.
    const rVersiones = buscarAyuda('versiones');
    expect(rVersiones.some((r) => r.articulo.id === 'guia-versiones-comparar' || r.articulo.id === 'guia-restaurar-version')).toBe(true);
    // Sin resultados útiles para consulta inexistente + vacía.
    expect(buscarAyuda('xyzwqinexistente')).toHaveLength(0);
    expect(buscarAyuda('')).toHaveLength(0);
    // Los fragmentos acompañan a cada resultado.
    for (const r of buscarAyuda('conflictos')) expect(r.fragmento.length).toBeGreaterThan(0);
  });

  test('los enlaces contextuales de los módulos apuntan a artículos EXISTENTES (misión §2.3)', () => {
    // Ids usados por los chips EnlaceAyuda colocados en la interfaz.
    const chips = [
      'guia-compartir-plan',       // Colaboración (cabecera y pestaña Colaboradores)
      'guia-versiones-comparar',  // Historial y Comparar
      'guia-plan-financiado',     // 4.7 financiación
      'guia-advertencia-capacidad',// 4.6 capacidad
      'guia-diferencia-resumen-tabla', // 4.4 resumen
      'ref-indicadores',          // 4.11
      'ref-monedas-unidades',     // 4.9
      'con-inversion-vs-gasto',   // 4.10
      'guia-supuesto-configurable', // Configuración de cálculos
      'guia-monedad-presentacion', // Visor documental
      'tutorial-primer-plan',     // Panel de proyectos
    ];
    for (const id of chips) {
      const a = articuloPorId(id);
      expect(a).toBeDefined();
      expect(capaDeArticulo(id)).toBeDefined();
    }
    // Y los archivos de la interfaz que colocan chips los referencian de verdad.
    const archivos = [
      'src/components/planex/VistaColaboracion.tsx',
      'src/components/planex/secciones/secciones1.tsx',
      'src/components/planex/secciones/secciones2.tsx',
      'src/components/planex/secciones/secciones3.tsx',
      'src/components/planex/config.tsx',
      'src/components/planex/VistaPreviaDoc.tsx',
      'src/components/planex/Proyectos.tsx',
    ];
    for (const ruta of archivos) {
      const texto = readFileSync(join(RAIZ, ruta), 'utf-8');
      expect(texto.includes('EnlaceAyuda')).toBe(true);
      const usados = Array.from(texto.matchAll(/articulo="([\w-]+)"/g)).map((m) => m[1]);
      expect(usados.length).toBeGreaterThan(0);
      for (const id of usados) expect(articuloPorId(id)).toBeDefined();
    }
  });
});

// ----------------------------------------------------------------------------
// Navegación integrada — rutas nuevas con URL reproducible (misión §4)
// ----------------------------------------------------------------------------

describe('UX-002 §4 — Navegación por vistas y pestañas', () => {
  test('las rutas nuevas se resuelven desde el hash (entradas directas y recargas)', () => {
    expect(vistaDesdeHash('#/ayuda')).toBe('ayuda');
    expect(vistaDesdeHash('#/ayuda?capa=guias&articulo=guia-cambiar-tasa')).toBe('ayuda');
    expect(vistaDesdeHash('#/colaboracion?plan=abc&tab=historial')).toBe('colaboracion');
    // Las rutas existentes no cambian.
    expect(vistaDesdeHash('#/')).toBe('landing');
    expect(vistaDesdeHash('#/proyectos')).toBe('proyectos');
    expect(vistaDesdeHash('#/editor?plan=x')).toBe('editor');
    expect(vistaDesdeHash('#/preview?plan=x')).toBe('preview');
  });

  test('la URL de ayuda permite enlaces DIRECTOS a capa y artículo', () => {
    expect(urlAyuda()).toBe('#/ayuda');
    expect(urlAyuda('guias')).toBe('#/ayuda?capa=guias');
    expect(urlAyuda('guias', 'guia-cambiar-tasa')).toBe('#/ayuda?capa=guias&articulo=guia-cambiar-tasa');
  });

  test('la vista de colaboración está registrada y protegida en el shell (código fuente)', () => {
    const vistas = readFileSync(join(RAIZ, 'src/components/planex/Vistas.tsx'), 'utf-8');
    expect(vistas.includes("case 'colaboracion'")).toBe(true);
    expect(vistas.includes("vista === 'colaboracion'")).toBe(true);
    expect(vistas.includes("case 'ayuda'")).toBe(true);
    // La ayuda es pública: no se añade a la lista de vistas protegidas.
    const lineaProtegidas = vistas.split('\n').find((l) => l.includes('const protegida ='));
    expect(lineaProtegidas!.includes("vista === 'colaboracion'")).toBe(true);
    expect(lineaProtegidas!.includes("vista === 'ayuda'")).toBe(false);
  });

  test('la colaboración y el historial YA NO viven en modales (política §4.4)', () => {
    const colaboracion = readFileSync(join(RAIZ, 'src/components/planex/Colaboracion.tsx'), 'utf-8');
    // Ya no se DEFINEN diálogos de colaboración (las menciones restantes son
    // comentarios históricos de la migración, no código).
    expect(colaboracion.includes('export function Dialogo')).toBe(false);
    expect(colaboracion.includes('<Dialog')).toBe(false);
    const editor = readFileSync(join(RAIZ, 'src/components/planex/PlanexApp.tsx'), 'utf-8');
    expect(editor.includes('from \'./Colaboracion\'')).toBe(true);
    // El editor no importa ni renderiza los diálogos antiguos…
    expect(/import \{[^}]*Dialogo/.test(editor)).toBe(false);
    expect(/<Dialogo\w+/.test(editor)).toBe(false);
    // …y navega a la vista integrada.
    expect(editor.includes('/colaboracion?plan=')).toBe(true);
    const vista = readFileSync(join(RAIZ, 'src/components/planex/VistaColaboracion.tsx'), 'utf-8');
    expect(vista.includes('Historial de versiones')).toBe(true);
    expect(vista.includes('Comparar versiones')).toBe(true);
    expect(vista.includes('Colaboradores')).toBe(true);
    // El único modal restante de la vista es la confirmación breve de restaurar.
    const confirmaciones = (vista.match(/<DialogContent/g) ?? []).length;
    expect(confirmaciones).toBe(1);
  });
});

// ----------------------------------------------------------------------------
// Comparación REAL de versiones (misión §4.2)
// ----------------------------------------------------------------------------

describe('UX-002 §4.2 — Comparación de versiones con diferencias reales', () => {
  const version = (n: number, secciones: Record<string, unknown>): VersionRow => ({
    id: `v${n}`,
    plan_id: 'plan-x',
    version_number: n,
    created_by: 'u1',
    created_by_name: 'colaborador1',
    description: '',
    snapshot: { formato: 'planex.version.1', secciones },
    created_at: '2026-10-26T10:00:00.000Z',
  });

  test('dos instantáneas idénticas → cero diferencias (y no hay comparación ficticia)', () => {
    const a = version(1, { general: { nombre: 'Clínica', monto: 100 } });
    const b = version(2, { general: { nombre: 'Clínica', monto: 100 } });
    const comp = compararSnapshots(a, b);
    expect(comp).toHaveLength(1);
    expect(contarCambios(comp)).toBe(0);
  });

  test('un campo cambiado aparece con su ruta, valor ANTES y valor DESPUÉS', () => {
    const a = version(1, { general: { nombre: 'Clínica', inversiones: [{ monto: 100 }] } });
    const b = version(2, { general: { nombre: 'Clínica nueva', inversiones: [{ monto: 250 }] } });
    const comp = compararSnapshots(a, b);
    expect(contarCambios(comp)).toBe(2);
    const rutas = comp.flatMap((c) => c.diferencias.map((d) => d.ruta)).sort();
    expect(rutas.join(',')).toBe('inversiones[0].monto,nombre');
    const nombre = comp[0].diferencias.find((d) => d.ruta === 'nombre')!;
    expect(nombre.antes).toBe('"Clínica"');
    expect(nombre.despues).toBe('"Clínica nueva"');
  });

  test('una sección presente solo en una versión queda visible en la comparación', () => {
    const a = version(1, { general: { x: 1 } });
    const b = version(2, { general: { x: 1 }, conclusiones: { texto: 'nuevo' } });
    const comp = compararSnapshots(a, b);
    expect(comp.length).toBe(2);
    expect(contarCambios(comp)).toBe(1);
  });

  test('diferenciarJSON (hojas) alimenta también la comparación de conflictos', () => {
    const d = diferenciarJSON({ a: 1, b: [1, 2] }, { a: 1, b: [1, 3] });
    expect(d).toHaveLength(1);
    expect(d[0].ruta).toBe('b[1]');
    expect(d[0].antes).toBe('2');
    expect(d[0].despues).toBe('3');
  });
});

// ----------------------------------------------------------------------------
// Identidad visual: icono propio y metadatos (misión §3)
// ----------------------------------------------------------------------------

describe('UX-002 §3 — Icono propio, variantes y metadatos', () => {
  test('el icono SVG propio existe y es un diseño vectorial legible', () => {
    const ruta = join(RAIZ, 'public/icon.svg');
    expect(existsSync(ruta)).toBe(true);
    const svg = readFileSync(ruta, 'utf-8');
    expect(svg.includes('viewBox="0 0 64 64"')).toBe(true);
    // No es un emoji ni una letra: no contiene texto.
    expect(svg.includes('<text')).toBe(false);
    // Formas del distintivo: documento + barras ascendentes.
    expect(svg.includes('rect')).toBe(true);
    expect(svg).toContain('PLANEX'); // metadato aria-label del propio icono
  });

  test('las variantes rasterizadas existen: favicon.ico, PNG 192/512 y apple-touch 180', () => {
    for (const archivo of ['favicon.ico', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png']) {
      const ruta = join(RAIZ, 'public', archivo);
      expect(existsSync(ruta)).toBe(true);
      expect(statSync(ruta).size).toBeGreaterThan(500);
    }
    // El ICO es un ICO real (cabecera 00 00 01 00).
    const ico = readFileSync(join(RAIZ, 'public/favicon.ico'));
    expect(ico[0]).toBe(0);
    expect(ico[1]).toBe(0);
    expect(ico[2]).toBe(1);
    expect(ico[3]).toBe(0);
    // El PNG es un PNG real.
    const png = readFileSync(join(RAIZ, 'public/icon-512.png'));
    expect(png[0]).toBe(0x89);
    expect(String.fromCharCode(png[1], png[2], png[3])).toBe('PNG');
  });

  test('los metadatos referencian el icono nuevo y NINGUNO antiguo', () => {
    const layout = readFileSync(join(RAIZ, 'src/app/layout.tsx'), 'utf-8');
    expect(layout.includes('/icon.svg')).toBe(true);
    expect(layout.includes('/favicon.ico')).toBe(true);
    expect(layout.includes('/apple-touch-icon.png')).toBe(true);
    expect(layout.includes('logo.svg')).toBe(false);
    // El favicon anterior fue retirado (no queda referencia ni archivo huérfano).
    expect(existsSync(join(RAIZ, 'public/logo.svg'))).toBe(false);
  });

  test('los activos se copian al build (comprobable por el CI) y el script de regeneración existe', () => {
    expect(existsSync(join(RAIZ, 'scripts/generar-icono-planex.py'))).toBe(true);
    const ci = readFileSync(join(RAIZ, '.github/workflows/ci.yml'), 'utf-8');
    expect(ci.includes('out/favicon.ico')).toBe(true);
    expect(ci.includes('out/icon.svg')).toBe(true);
  });
});

// ----------------------------------------------------------------------------
// Tasa 743 e impuesto 35 % — valores por defecto y advertencias (petición
// del propietario: «el impuesto es 35 %, la tasa es 743»)
// ----------------------------------------------------------------------------

describe('UX-002 — Tasa 743 CUP/USD e impuesto 35 % por defecto', () => {
  test('el parámetro tipo_cambio vale 743 con fecha y advertencia de validación pendiente', () => {
    const tasa = parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 0 }).find((p) => p.id === 'tipo_cambio')!;
    expect(tasa.valor).toBe(743);
    expect(tasa.unidad).toBe('CUP/USD');
    expect(tasa.fechaRef).toBe('2026-10-26');
    expect(String(tasa.descripcion)).toContain('PENDIENTE DE VALIDACIÓN OFICIAL');
    expect(String(tasa.fuente)).toContain('743 CUP/USD');
  });

  test('el impuesto sobre utilidades sigue en 35 % (confirmado por el propietario)', () => {
    const impuesto = parametrosPorDefecto({ creditoKUSD: 0, capitalTrabajoKUSD: 0 }).find((p) => p.id === 'tasa_impuesto_utilidades')!;
    expect(impuesto.valor).toBe(0.35);
  });
});
