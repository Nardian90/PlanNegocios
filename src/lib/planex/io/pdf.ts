// ============================================================================
// Exportador PDF — COMPOSITOR EDITORIAL (misión PLANEX-DOC-003).
//
// El contenido (texto, tablas, importes, análisis, avisos, figuras) sigue
// viniendo SOLO de doc/construir.ts (modelo canónico compartido con el visor
// y el DOCX). Este archivo decide la COMPOSICIÓN sobre papel A4 con un
// compositor con conocimiento de página:
//
//   · P0-1 JUSTIFICACIÓN REAL (§3): renderizador de párrafo que corta por
//     palabras, mide con las métricas de la fuente activa y reparte el
//     espacio sobrante ENTRE PALABRAS de cada línea intermedia (la última
//     queda natural, a la izquierda). Los párrafos que cruzan un salto de
//     página siguen justificados a ambos lados del corte. Control de
//     huérfanas de 1–2 palabras recomponiendo el ancho objetivo. Tope de
//     estiramiento para evitar espacios exagerados.
//   · P0-2 PAGINACIÓN (§4): política por niveles — los capítulos fluyen y
//     solo abren página cuando el espacio restante no admite un arranque
//     digno; los grupos de tablas apaisadas NO dejan páginas verticales
//     vacías detrás (la página posterior se abre solo si hay contenido que
//     continuar); el encabezado fijo es de EJECUCIÓN documental (título del
//     informe + proyecto) y los títulos de sección fluyen como contenido.
//   · P0-3 TABLAS (§5): estilo corporativo APA adaptado a finanzas — filetes
//     horizontales selectivos (título/cabecera/totales/cierre), SIN rejilla
//     vertical, cabecera con relleno suave y texto oscuro, subtotales en
//     negrita con filete superior, cifras a la derecha y conceptos a la
//     izquierda SEGÚN EL CONTENIDO de cada columna (respeta
//     TablaDoc.alineaciones), fuente autoajustada con mínimos editoriales
//     (≥ 8,5 pt normal, ≥ 7 pt apaisada), encabezados repetidos y notas al
//     pie de tabla.
//   · Diagnóstico de composición exportable (densidad por página y medición
//     del justificado) para las pruebas de §3.3 y la auditoría de §4.4.
// ============================================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PlanexProject, ComputedModel } from '../types';
import { construirDocumentoPlanex, OpcionesDocumento } from '../doc/construir';
import { DocumentoPlanex, ElementoDoc, SeccionDoc, TablaDoc, etiquetaAnalisis } from '../doc/modelo';
import { asegurarTexto } from '../doc/texto';
import { FiguraDoc } from '../doc/figuras';

// ---------------------------------------------------------------------------
// Guía editorial (DOC003_GUIA_EDITORIAL.md) — constantes de diseño
// ---------------------------------------------------------------------------
const M = 14; // margen mm
const ANCHO = 210;
const ALTO = 297;
const ZONA_PIE = 18; // reservado para el pie (línea + numeración)

// Tipografía (pt)
const TAM_CAPITULO = 13;
const TAM_SUBTITULO = 10.5;
const TAM_CUERPO = 9;
const TAM_NOTA = 7.8;
const TAM_TITULO_TABLA = 9.5;
const TAM_NOTA_TABLA = 7.2;
const TAM_TABLA_NORMAL = 8.5; // objetivo en vertical
const TAM_TABLA_MINIMA = 7.5; // mínimo aceptable en vertical
const TAM_TABLA_APaisada = 8; // objetivo apaisado
const TAM_TABLA_APaisADA_MIN = 7; // mínimo aceptable apaisado (§5.2)
const TAM_ANALISIS = 8;
const TAM_AVISO = 7.5;
const TAM_INDICE = 9.5;
const INTER_INDICE = 6.8; // mm entre entradas del índice

// Paleta sobria (jerarquía y contraste, no decoración)
const TINTA: [number, number, number] = [51, 65, 85]; // cuerpo
const TITULO: [number, number, number] = [30, 41, 59]; // títulos
const GRIS: [number, number, number] = [100, 116, 139]; // secundario
const LINEA_SUAVE: [number, number, number] = [203, 213, 225];
const LINEA_MEDIA: [number, number, number] = [148, 163, 184];
const RELLENO_CABECERA: [number, number, number] = [238, 242, 247];
const CEBRA: [number, number, number] = [246, 248, 251];
const AMBAR: [number, number, number] = [146, 64, 14];
const AMBAR_TITULO: [number, number, number] = [120, 81, 40];
const AMBAR_BORDE: [number, number, number] = [217, 119, 6];
const AMBAR_FONDO: [number, number, number] = [255, 243, 205];
const ROJO: [number, number, number] = [185, 28, 28];

/** ¿Celda con aspecto numérico/monetario? (alineación por CONTENIDO, §5.3). */
const PATRON_NUMERICO = /^[-–—(]*[\d.,\s]+[)]?([ ]?(%|kUSD|kCUP|USD|CUP|CUP por USD|años?|meses?|uds?\.?|ptos?\.?)?)?$/;

function esNumerica(texto: string): boolean {
  const t = texto.trim();
  if (!t || t === '—' || t === '-') return false;
  return PATRON_NUMERICO.test(t);
}

/** Columnas numéricas por CONTENIDO del cuerpo (≥ 80 % de celdas con
 *  aspecto numérico). Una columna «Estado» o «Fuente» no es numérica por
 *  estar a la derecha de los conceptos (§5.3). */
function columnasNumericas(head: string[], body: string[][]): boolean[] {
  const nCols = head.length;
  const numericas: boolean[] = [];
  for (let i = 0; i < nCols; i++) {
    const celdas = body.map((f) => (f[i] ?? '').trim()).filter((c) => c !== '' && c !== '—');
    if (i === 0 || !celdas.length) {
      numericas[i] = false;
      continue;
    }
    numericas[i] = celdas.filter((c) => esNumerica(c)).length / celdas.length >= 0.8;
  }
  return numericas;
}

/** Anchos de columna para un tamaño dado (mm): las columnas numéricas al
 *  ancho de su cifra más ancha; las de texto con tope (las frases largas se
 *  envuelven). Los IDENTIFICADORES largos (p. ej. «financiacion_disponible_k»)
 *  pueden partirse cuando la tabla tiene muchas columnas: el suelo de
 *  compresión es la parte proporcional del ancho, no la palabra entera. */
export type MedidorAncho = (texto: string, size: number, negrita: boolean) => number;

function medirAnchosTabla(
  medir: MedidorAncho,
  head: string[],
  body: string[][],
  numericas: boolean[],
  size: number,
  anchoUtil: number
): { anchos: number[]; minimos: number[] } {
  const padX = 4;
  const nCols = head.length;
  const parteProporcional = anchoUtil / Math.max(1, nCols);
  const anchos: number[] = [];
  const minimos: number[] = [];
  for (let i = 0; i < nCols; i++) {
    if (numericas[i]) {
      let w = 0;
      for (const f of body) w = Math.max(w, medir(f[i] ?? '', size, false));
      for (const palabra of head[i].split(/\s+/)) w = Math.max(w, medir(palabra, size, true));
      anchos.push(Math.max(7, w + padX));
      minimos.push(Math.max(7, w + padX)); // las cifras NUNCA se encogen
    } else {
      let maxPalabra = 0;
      for (const f of body) for (const palabra of (f[i] ?? '').split(/\s+/)) maxPalabra = Math.max(maxPalabra, medir(palabra, size, false));
      for (const palabra of head[i].split(/\s+/)) maxPalabra = Math.max(maxPalabra, medir(palabra, size, true));
      let contenido = 0;
      for (const f of body) contenido = Math.max(contenido, medir(f[i] ?? '', size, false));
      const cap = (i === 0 ? 0.34 : 0.22) * anchoUtil;
      anchos.push(Math.min(Math.max(maxPalabra + padX, Math.min(contenido + padX, cap)), cap));
      // Suelo de compresión: la palabra entera, salvo que sea más ancha que su
      // parte proporcional (identificadores largos con muchas columnas).
      minimos.push(Math.min(maxPalabra + padX, Math.max(10, parteProporcional)));
    }
  }
  return { anchos, minimos };
}

/** ¿La tabla exige página APAISADA? (§4.2/§5.2) Criterio compartido por PDF y
 *  DOCX: solo si, marcada como ancha, NO cabe en vertical aplicando TODO el
 *  repertorio de ajuste (autoajuste de fuente + último recurso de comprimir
 *  solo columnas de texto). El apaisado es una decisión de CONTENIDO, no de
 *  conteo de columnas: las cifras jamás se comprimen (una proyección con 11
 *  años en CUP no cabe y va a apaisado); una tabla de texto envuelve y queda
 *  en vertical, donde se lee mejor. */
export function requiereApaisada(t: TablaDoc, medir: MedidorAncho, anchoRetrato: number, sizeMinimo: number): boolean {
  if (!t.ancha) return false;
  const head = t.encabezados.map((c) => T(c));
  const body = t.filas.map((f) => f.map((c) => T(c ?? '')));
  const numericas = columnasNumericas(head, body);
  let size = Math.max(sizeMinimo, 8.5);
  for (;;) {
    const { anchos, minimos } = medirAnchosTabla(medir, head, body, numericas, size, anchoRetrato);
    const suma = anchos.reduce((s, a) => s + a, 0);
    if (suma <= anchoRetrato) return false;
    if (size <= sizeMinimo) {
      // Último recurso: comprimir columnas de texto hacia su suelo.
      const exceso = suma - anchoRetrato;
      const holgura = anchos.map((a, i) => (numericas[i] ? 0 : Math.max(0, a - minimos[i])));
      const holguraTotal = holgura.reduce((s, h) => s + h, 0);
      return holguraTotal < exceso;
    }
    size = Math.max(sizeMinimo, size - 0.25);
  }
}

function T(texto: string | null | undefined): string {
  return asegurarTexto(texto);
}

function hexARgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

// ---------------------------------------------------------------------------
// Diagnóstico de composición (§3.3 medición del justificado, §4.4 densidad)
// ---------------------------------------------------------------------------
export interface LineaCompuesta {
  pagina: number;
  y: number;
  x1: number; // borde derecho real de la última palabra dibujada (pt)
  ultima: boolean; // ¿última línea de su párrafo?
}

export interface DiagnosticoComposicion {
  paginas: {
    pagina: number;
    orientacion: 'retrato' | 'apaisada';
    /** Profundidad del cuerpo cubierta por contenido sustantivo (0–1). */
    ocupacion: number;
    elementos: string[];
  }[];
  justificado: {
    parrafos: number;
    lineasIntermedias: number;
    intermediasJustificadas: number;
    desvioMaximoPt: number;
  };
  lineas: LineaCompuesta[];
  tablas: {
    numero: number;
    titulo: string;
    fuentePt: number;
    apaisada: boolean;
    columnas: { indice: number; alineacion: 'left' | 'right' | 'center'; numerica: boolean }[];
  }[];
}

interface EstadoPagina {
  orientacion: 'retrato' | 'apaisada';
  yFin: number; // marca la profundidad alcanzada por el contenido
  elementos: string[];
}

/** Interlineado editorial (mm) para un tamaño en pt: ratio ≈ 1,42. */
function interlineado(size: number): number {
  return size * 0.5;
}

// ---------------------------------------------------------------------------
// Compositor con conocimiento de página
// ---------------------------------------------------------------------------
class Compositor {
  private doc: jsPDF;
  private orientacion: 'retrato' | 'apaisada' = 'retrato';
  private y = 0;
  private paginas: EstadoPagina[] = [];
  private encabezadas = new Set<number>(); // páginas que ya llevan encabezado
  private diag: DiagnosticoComposicion = {
    paginas: [],
    justificado: { parrafos: 0, lineasIntermedias: 0, intermediasJustificadas: 0, desvioMaximoPt: 0 },
    lineas: [],
    tablas: [],
  };

  constructor(private documento: DocumentoPlanex) {
    this.doc = new jsPDF({ unit: 'mm', format: 'a4', compress: false });
    this.paginas.push({ orientacion: 'retrato', yFin: 0, elementos: ['portada'] });
  }

  // ------------------------------------------------------- geometría
  private get dims(): { ancho: number; alto: number } {
    return this.orientacion === 'retrato' ? { ancho: ANCHO, alto: ALTO } : { ancho: ALTO, alto: ANCHO };
  }
  private get anchoUtil(): number {
    return this.dims.ancho - 2 * M;
  }
  private get cuerpoInicio(): number {
    return 22; // bajo el encabezado de ejecución
  }
  private get cuerpoFin(): number {
    return this.dims.alto - ZONA_PIE;
  }
  private get nPagina(): number {
    return this.doc.getNumberOfPages();
  }

  private registrarElemento(tipo: string) {
    const pag = this.paginas[this.nPagina - 1];
    if (pag && !pag.elementos.includes(tipo)) pag.elementos.push(tipo);
    if (this.y > pag.yFin) pag.yFin = this.y;
  }

  /** Abre página con la orientación dada y dibuja el encabezado de ejecución. */
  private nuevaPagina(orientacion: 'retrato' | 'apaisada' = this.orientacion) {
    if (process.env.DOC003_DEBUG) {
      const previa = this.paginas[this.paginas.length - 1];
      console.error(`DEBUG nuevaPagina tras pág ${this.paginas.length} (elems=${JSON.stringify(previa?.elementos ?? [])} y=${this.y.toFixed(1)}) -> ${orientacion} | ${new Error().stack?.split('\n').slice(2, 5).join(' <= ').replace(/.*pdf\.ts:\d+/g, (m) => m)}`);
    }
    this.doc.addPage(
      orientacion === 'retrato' ? [ANCHO, ALTO] : [ALTO, ANCHO],
      orientacion === 'retrato' ? 'portrait' : 'landscape'
    );
    this.orientacion = orientacion;
    this.y = this.cuerpoInicio;
    this.paginas.push({ orientacion, yFin: this.y, elementos: [] });
    this.encabezadoCorriente();
  }

  /** Encabezado de EJECUCIÓN documental (no de sección): informe + proyecto.
   *  Idempotente por página (la dibujan nuevaPagina y autoTable una sola vez). */
  private encabezadoCorriente() {
    const actual = this.nPagina;
    if (this.encabezadas.has(actual)) return;
    this.encabezadas.add(actual);
    const { ancho } = this.dims;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...TITULO);
    this.doc.text('PLAN DE NEGOCIOS', M, 11);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setTextColor(...GRIS);
    const proy = T(this.documento.meta.nombreProyecto);
    const wMarca = this.doc.getTextDimensions('PLAN DE NEGOCIOS').w;
    const disponible = ancho - 2 * M - wMarca - 8;
    const recortado =
      this.doc.getTextWidth(proy) > disponible
        ? `${proy.slice(0, Math.max(0, Math.floor((proy.length * disponible) / this.doc.getTextWidth(proy))))}…`
        : proy;
    this.doc.text(recortado, ancho - M, 11, { align: 'right' });
    this.doc.setDrawColor(...LINEA_SUAVE);
    this.doc.setLineWidth(0.35);
    this.doc.line(M, 14.5, ancho - M, 14.5);
    this.doc.setTextColor(...TINTA);
  }

  /** Cambia a retrato si hace falta (abriendo página solo si hay contenido). */
  private irARetrato() {
    if (this.orientacion !== 'retrato') this.nuevaPagina('retrato');
  }

  // ------------------------------------------------------- medición de texto
  /** Corta un texto en líneas por palabras con el ancho dado (mm). Comparte
   *  criterio con el justificador: mismas métricas, mismo corte. */
  private cortarLineas(texto: string, size: number, ancho: number): { palabras: string[]; ancho: number }[] {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(size);
    const espacio = this.doc.getTextWidth(' ');
    const tokens = texto.split(/\s+/).filter(Boolean);
    const lineas: { palabras: string[]; ancho: number }[] = [];
    let actual: { palabras: string[]; ancho: number } = { palabras: [], ancho: 0 };
    for (const token of tokens) {
      let anchoPalabra = this.doc.getTextWidth(token);
      // Palabra más ancha que la columna: se parte por caracteres (raro).
      if (anchoPalabra > ancho) {
        const piezas: string[] = [];
        let pieza = '';
        for (const ch of token) {
          if (this.doc.getTextWidth(pieza + ch) > ancho - 1 && pieza) {
            piezas.push(`${pieza}-`);
            pieza = ch;
          } else pieza += ch;
        }
        if (pieza) piezas.push(pieza);
        for (const p of piezas) {
          if (actual.palabras.length && actual.ancho + espacio + this.doc.getTextWidth(p) > ancho) {
            lineas.push(actual);
            actual = { palabras: [p], ancho: this.doc.getTextWidth(p) };
          } else {
            actual.palabras.push(p);
            actual.ancho += (actual.palabras.length > 1 ? espacio : 0) + this.doc.getTextWidth(p);
          }
        }
        continue;
      }
      const extra = actual.palabras.length ? espacio + anchoPalabra : anchoPalabra;
      if (actual.palabras.length && actual.ancho + extra > ancho) {
        lineas.push(actual);
        actual = { palabras: [token], ancho: anchoPalabra };
      } else {
        actual.palabras.push(token);
        actual.ancho += extra;
      }
    }
    if (actual.palabras.length) lineas.push(actual);
    return lineas;
  }

  /** Altura estimada (mm) de un párrafo al ancho actual. */
  private altoParrafo(texto: string, size: number, ancho: number): number {
    const limpio = T(texto);
    if (!limpio) return 0;
    return this.cortarLineas(limpio, size, ancho).length * interlineado(size) + 2.4;
  }

  // ------------------------------------------------------- P0-1: párrafos
  /** Párrafo narrativo con JUSTIFICACIÓN REAL por reparto de espacio entre
   *  palabras (§3). La última línea queda natural; las intermedias llegan
   *  al margen derecho salvo que el estiramiento exigido supere el tope
   *  editorial (mejor un leve desalineado que huecos enormes). */
  parrafo(
    texto: string,
    opts?: { size?: number; italica?: boolean; justificado?: boolean; color?: [number, number, number] }
  ): number {
    const limpio = T(texto);
    if (!limpio) return this.y;
    const size = opts?.size ?? TAM_CUERPO;
    const justificado = opts?.justificado ?? true;
    const ancho = this.anchoUtil;
    this.doc.setFont('helvetica', opts?.italica ? 'italic' : 'normal');
    this.doc.setFontSize(size);
    this.doc.setTextColor(...(opts?.color ?? TINTA));

    let lineas = this.cortarLineas(limpio, size, ancho);
    // Control de huérfanas (§3.2): última línea de 1 palabra o < 18 % del
    // ancho → recomponer con un ancho objetivo algo menor.
    if (justificado && lineas.length >= 3) {
      const ultima = lineas[lineas.length - 1];
      if (ultima.palabras.length < 2 || ultima.ancho < ancho * 0.18) {
        for (const factor of [0.97, 0.95, 0.92, 0.9]) {
          const alt = this.cortarLineas(limpio, size, ancho * factor);
          const u = alt[alt.length - 1];
          if (u.palabras.length >= 2 && u.ancho >= ancho * 0.15) {
            lineas = alt;
            break;
          }
        }
      }
    }

    const paso = interlineado(size);
    this.diag.justificado.parrafos += 1;
    const margenDerecho = M + ancho;
    for (let i = 0; i < lineas.length; i++) {
      const linea = lineas[i];
      const esUltima = i === lineas.length - 1;
      if (this.y + paso * 0.85 > this.cuerpoFin) {
        // El párrafo CRUZA el salto: las líneas siguen justificadas a ambos
        // lados del corte (§3.2).
        this.nuevaPagina();
        this.doc.setFont('helvetica', opts?.italica ? 'italic' : 'normal');
        this.doc.setFontSize(size);
        this.doc.setTextColor(...(opts?.color ?? TINTA));
      }
      let x1 = M;
      if (justificado && !esUltima && linea.palabras.length > 1) {
        const huecos = linea.palabras.length - 1;
        const espacio = this.doc.getTextWidth(' ');
        const extra = (ancho - linea.ancho) / huecos;
        if (extra <= espacio * 1.9) {
          // Justificada: reparto del sobrante entre palabras.
          const pasoPalabra = espacio + extra;
          let x = M;
          for (const palabra of linea.palabras) {
            this.doc.text(palabra, x, this.y);
            x += this.doc.getTextWidth(palabra) + pasoPalabra;
          }
          x1 = x - pasoPalabra;
        } else {
          // Tope editorial: dejaría huecos exagerados → línea a la izquierda.
          x1 = this.dibujarLineaNatural(linea);
        }
      } else {
        x1 = this.dibujarLineaNatural(linea);
      }
      if (!esUltima) {
        this.diag.justificado.lineasIntermedias += 1;
        const desvio = Math.abs(x1 - margenDerecho) * 2.8346; // mm → pt
        if (desvio <= 2.2) this.diag.justificado.intermediasJustificadas += 1;
        this.diag.justificado.desvioMaximoPt = Math.max(this.diag.justificado.desvioMaximoPt, desvio);
      }
      this.diag.lineas.push({ pagina: this.nPagina, y: this.y, x1: x1 * 2.8346, ultima: esUltima });
      this.y += paso;
    }
    this.y += 2.4;
    this.registrarElemento('parrafo');
    return this.y;
  }

  /** Línea con espaciado natural (última línea y líneas no justificadas). */
  private dibujarLineaNatural(linea: { palabras: string[]; ancho: number }): number {
    const espacio = this.doc.getTextWidth(' ');
    let x = M;
    for (const palabra of linea.palabras) {
      this.doc.text(palabra, x, this.y);
      x += this.doc.getTextWidth(palabra) + espacio;
    }
    return x - espacio;
  }

  // ------------------------------------------------------- títulos en flujo
  /** Título de CAPÍTULO como contenido (§4.1): no es un encabezado fijo de
   *  página. Abre página solo si no queda arranque digno; si fluye, lleva
   *  aire superior mayor. Se mantiene junto a su primer contenido. */
  tituloCapitulo(titulo: string, forzarPaginaNueva: boolean): number {
    const alto = 14 + 8; // título (hasta 2 líneas) + aire
    if (forzarPaginaNueva || this.y + alto + 22 > this.cuerpoFin) {
      this.nuevaPagina('retrato');
    } else if (this.y > this.cuerpoInicio + 2) {
      this.y += 6; // aire de separación cuando fluye a mitad de página
    }
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(TAM_CAPITULO);
    this.doc.setTextColor(...TITULO);
    const lineas = this.doc.splitTextToSize(T(titulo), this.anchoUtil);
    this.doc.text(lineas, M, this.y + 4);
    this.y += 4.6 * lineas.length + 1.4;
    this.doc.setDrawColor(...LINEA_MEDIA);
    this.doc.setLineWidth(0.5);
    this.doc.line(M, this.y, M + this.anchoUtil, this.y);
    this.y += 7;
    this.registrarElemento('capitulo');
    return this.y;
  }

  /** Subtítulo en flujo, pegado a su contenido (§3.2 corregido de raíz). */
  subtitulo(texto: string): number {
    if (this.y + 26 > this.cuerpoFin) this.nuevaPagina();
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(TAM_SUBTITULO);
    this.doc.setTextColor(...TITULO);
    const lineas = this.doc.splitTextToSize(T(texto), this.anchoUtil);
    this.doc.text(lineas, M, this.y + 3.6);
    this.y += 4.4 * lineas.length + 1;
    this.doc.setDrawColor(...LINEA_SUAVE);
    this.doc.setLineWidth(0.3);
    this.doc.line(M, this.y - 1.6, M + this.anchoUtil, this.y - 1.6);
    this.y += 3.5;
    this.registrarElemento('subtitulo');
    return this.y;
  }

  // ------------------------------------------------------- campos etiquetados
  campos(items: { etiqueta: string; valor: string }[]): number {
    // El bloque se mantiene ENTERO si no cabe en lo que queda pero sí en una
    // página (§4.3): evita remanentes de 2–3 campos huérfanos antes de un
    // cambio de orientación o de sección.
    const alturaBloque = items.reduce(
      (s, item) => s + 5.2 + this.altoParrafo(T(item.valor) || '—', 8.7, ANCHO - 2 * M - 2) + 1.4,
      2
    );
    if (alturaBloque > 14 && this.y + alturaBloque > this.cuerpoFin && alturaBloque <= (this.cuerpoFin - this.cuerpoInicio) * 0.78) {
      this.nuevaPagina();
    }
    for (const item of items) {
      const valor = T(item.valor) || '—';
      const altoValor = this.altoParrafo(valor, 8.7, this.anchoUtil - 2);
      if (this.y + 12 + Math.min(altoValor, 9) > this.cuerpoFin) this.nuevaPagina();
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(9);
      this.doc.setTextColor(...TITULO);
      this.doc.text(T(`${item.etiqueta}:`), M, this.y + 3);
      this.y += 5.2;
      const yAntes = this.y;
      this.parrafo(valor, { size: 8.7, justificado: false });
      if (this.y === yAntes) this.y += 2;
      this.y += 1.4;
    }
    this.registrarElemento('campos');
    return this.y;
  }

  // ------------------------------------------------------- P0-3: tablas
  /** Medición con la fuente activa del documento (helvetica). */
  private medir = (texto: string, size: number, negrita: boolean): number => {
    this.doc.setFont('helvetica', negrita ? 'bold' : 'normal');
    this.doc.setFontSize(size);
    return this.doc.getTextWidth(texto);
  };

  /** ¿La tabla exige página apaisada? Criterio de CONTENIDO compartido con el
   *  DOCX (requiereApaisada). */
  necesitaApaisada(t: TablaDoc): boolean {
    return requiereApaisada(t, this.medir, ANCHO - 2 * M, TAM_TABLA_MINIMA);
  }

  /** Tabla corporativa: filetes horizontales selectivos, sin rejilla vertical,
   *  fuente autoajustada con mínimos, alineación por contenido y resaltes. */
  tabla(t: TablaDoc): number {
    const apaisada = this.orientacion === 'apaisada';
    const sizeObjetivo = apaisada ? TAM_TABLA_APaisada : TAM_TABLA_NORMAL;
    const sizeMinimo = apaisada ? TAM_TABLA_APaisADA_MIN : TAM_TABLA_MINIMA;
    const anchoUtil = this.anchoUtil;
    const nCols = t.encabezados.length;
    const head = t.encabezados.map((c) => T(c));
    const body = t.filas.map((f) => f.map((c) => T(c ?? '')));
    const numericas = columnasNumericas(head, body);
    const alineaciones: ('left' | 'right' | 'center')[] = [];
    for (let i = 0; i < nCols; i++) {
      const declarada = t.alineaciones?.[i];
      alineaciones[i] =
        declarada === 'izq' ? 'left' : declarada === 'der' ? 'right' : declarada === 'cen' ? 'center' : numericas[i] ? 'right' : 'left';
    }

    // ----- autoajuste de fuente y anchos de columna (§5.2) -----
    let size = sizeObjetivo;
    let { anchos, minimos } = medirAnchosTabla(this.medir, head, body, numericas, size, anchoUtil);
    let suma = anchos.reduce((s, a) => s + a, 0);
    while (suma > anchoUtil && size > sizeMinimo) {
      size = Math.max(sizeMinimo, size - 0.25);
      ({ anchos, minimos } = medirAnchosTabla(this.medir, head, body, numericas, size, anchoUtil));
      suma = anchos.reduce((s, a) => s + a, 0);
    }
    if (suma > anchoUtil) {
      // Último recurso (§5.2): se encogen primero las columnas de TEXTO hacia
      // su suelo (palabra más larga o parte proporcional), jamás las cifras.
      let exceso = suma - anchoUtil;
      const holgura = anchos.map((a, i) => (numericas[i] ? 0 : Math.max(0, a - minimos[i])));
      const holguraTotal = holgura.reduce((s, h) => s + h, 0);
      if (holguraTotal >= exceso) {
        // Reparto proporcional del déficit entre las columnas de texto.
        for (let i = 0; i < nCols; i++) {
          const quita = holguraTotal > 0 ? Math.min(holgura[i], (exceso * holgura[i]) / holguraTotal + 0.05) : 0;
          anchos[i] -= quita;
        }
      } else {
        const factor = anchoUtil / Math.max(1e-6, suma);
        anchos = anchos.map((a) => a * factor);
      }
    } else {
      const factor = anchoUtil / Math.max(1e-6, suma); // el sobrante reparte aire
      anchos = anchos.map((a) => a * factor);
    }
    // Normalización EXACTA al ancho útil (evita desbordes por redondeo).
    const sumaFinal = anchos.reduce((s, a) => s + a, 0);
    if (Math.abs(sumaFinal - anchoUtil) > 0.005 && sumaFinal > 0) {
      const f = anchoUtil / sumaFinal;
      anchos = anchos.map((a) => a * f);
    }

    // ----- título (en flujo, pegado a la cabecera + primeras filas) -----
    const altoMinimo = (t.titulo ? 11 : 0) + 8 + 9;
    if (t.titulo) {
      if (this.y + altoMinimo > this.cuerpoFin) this.nuevaPagina();
      this.doc.setFont('helvetica', 'bold');
      this.doc.setFontSize(TAM_TITULO_TABLA);
      this.doc.setTextColor(...TITULO);
      const lineas = this.doc.splitTextToSize(T(t.titulo), anchoUtil);
      this.doc.text(lineas, M, this.y + 3.2);
      this.y += 4 * lineas.length + 2.2;
    }

    const resaltar = new Set(t.resaltar ?? []);
    const columnStyles: Record<number, { halign: 'left' | 'right' | 'center'; cellWidth: number; fillColor?: [number, number, number] }> = {};
    for (let i = 0; i < nCols; i++) {
      columnStyles[i] = { halign: alineaciones[i], cellWidth: anchos[i] };
    }

    const paginaInicioTabla = this.nPagina;
    const paginasAntes = this.doc.getNumberOfPages();
    autoTable(this.doc, {
      head: [head],
      body,
      startY: this.y,
      margin: { left: M, right: M, top: this.cuerpoInicio - 2, bottom: ZONA_PIE },
      theme: 'plain',
      styles: {
        font: 'helvetica',
        fontSize: size,
        cellPadding: { top: 1.25, bottom: 1.25, left: 1.7, right: 1.7 },
        overflow: 'linebreak',
        textColor: TINTA,
        lineColor: LINEA_MEDIA,
        lineWidth: 0,
        valign: 'middle',
      },
      headStyles: {
        fillColor: RELLENO_CABECERA,
        textColor: TITULO,
        fontStyle: 'bold',
        fontSize: Math.max(size, 7),
        lineColor: LINEA_MEDIA,
        lineWidth: { top: 0.55, right: 0, bottom: 0.3, left: 0 },
      },
      alternateRowStyles: body.length > 12 ? { fillColor: CEBRA } : undefined,
      columnStyles,
      showHead: 'everyPage',
      rowPageBreak: 'avoid',
      didParseCell: (data) => {
        if (data.section === 'head') {
          data.cell.styles.halign = alineaciones[data.column.index] === 'left' ? 'left' : 'center';
        } else {
          const fila = data.row.index;
          if (resaltar.has(fila)) {
            data.cell.styles.fontStyle = 'bold';
            data.cell.styles.lineWidth = { top: 0.3, right: 0, bottom: 0, left: 0 };
          }
          if (fila === body.length - 1) {
            const previo = typeof data.cell.styles.lineWidth === 'object' ? data.cell.styles.lineWidth : {};
            data.cell.styles.lineWidth = { top: previo.top ?? 0, right: 0, bottom: 0.55, left: 0 };
          }
        }
      },
      willDrawPage: () => this.encabezadoCorriente(),
    });

    // Sincroniza las páginas abiertas por autoTable (continuación multipágina)
    // y marca TODO el rango recorrido: registrarElemento escribe en la ÚLTIMA
    // página, de modo que la página INICIAL de una tabla partida se marca aquí.
    const paginasAhora = this.doc.getNumberOfPages();
    for (let p = paginasAntes + 1; p <= paginasAhora; p++) {
      this.paginas.push({ orientacion: this.orientacion, yFin: this.cuerpoFin, elementos: ['tabla'] });
    }
    for (let p = paginaInicioTabla; p <= paginasAhora; p++) {
      const est = this.paginas[p - 1];
      if (!est) continue;
      if (!est.elementos.includes('tabla')) est.elementos.push('tabla');
      est.yFin = Math.max(est.yFin, p === paginasAhora ? this.y : this.cuerpoFin);
    }
    this.y = (this.doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 3;

    // Nota al pie de tabla (APA): fuente/supuesto/lectura (§5.1).
    if (t.nota) {
      this.doc.setFont('helvetica', 'italic');
      this.doc.setFontSize(TAM_NOTA_TABLA);
      this.doc.setTextColor(...GRIS);
      const lineasNota = this.doc.splitTextToSize(T(`Nota. ${t.nota}`), anchoUtil);
      for (const linea of lineasNota) {
        if (this.y + 3.4 > this.cuerpoFin) {
          this.nuevaPagina();
          this.doc.setFont('helvetica', 'italic');
          this.doc.setFontSize(TAM_NOTA_TABLA);
          this.doc.setTextColor(...GRIS);
        }
        this.doc.text(linea, M, this.y);
        this.y += 3.4;
      }
      this.y += 2;
    }
    this.registrarElemento('tabla');
    this.diag.tablas.push({
      numero: t.numero ?? 0,
      titulo: T(t.titulo ?? ''),
      fuentePt: size,
      apaisada,
      columnas: alineaciones.map((a, i) => ({ indice: i, alineacion: a, numerica: numericas[i] })),
    });
    return this.y;
  }

  // ------------------------------------------------------- bloques auxiliares
  aviso(texto: string): number {
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(TAM_AVISO);
    const limpio = T(texto);
    const lineas = this.doc.splitTextToSize(limpio, this.anchoUtil - 8);
    const alto = Math.max(14, lineas.length * 3.5 + 7);
    if (this.y + alto + 4 > this.cuerpoFin) this.nuevaPagina();
    let yy = this.y + 1;
    this.doc.setFillColor(...AMBAR_FONDO);
    this.doc.setDrawColor(...AMBAR_BORDE);
    this.doc.setLineWidth(0.4);
    this.doc.rect(M, yy, this.anchoUtil, alto, 'FD');
    this.doc.setTextColor(...AMBAR);
    this.doc.text(lineas, M + 4, yy + 5);
    this.y = yy + alto + 6;
    this.registrarElemento('aviso');
    return this.y;
  }

  analisis(bloque: { titulo: string; texto: string; estado: string }): number {
    const limpio = T(bloque.texto);
    const altoCuerpo = this.altoParrafo(limpio, TAM_ANALISIS, this.anchoUtil - 6);
    const altoBloque = 5 + 3 + altoCuerpo + 4;
    // El bloque se mantiene junto si cabe entero; si no, al menos caben el
    // título, la etiqueta y las primeras líneas (§4.3).
    if (this.y + Math.min(altoBloque, 60) > this.cuerpoFin) this.nuevaPagina();
    const xTexto = M + 5;
    const yTitulo = this.y + 4;
    const paginaInicio = this.nPagina;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(9);
    this.doc.setTextColor(...AMBAR_TITULO);
    this.doc.text(T(bloque.titulo), xTexto, yTitulo);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(6.6);
    this.doc.setTextColor(...(bloque.estado === 'desactualizado' ? ROJO : AMBAR));
    this.doc.text(T(etiquetaAnalisis(bloque.estado as never)), xTexto, yTitulo + 3.6);
    this.y = yTitulo + 7.2;
    this.parrafo(limpio, { size: TAM_ANALISIS, color: TINTA });
    // Filete lateral ámbar que abraza título y cuerpo (proporción moderada).
    // Si el cuerpo cruzó un salto de página, el filete acompaña en DOS
    // segmentos (nunca con coordenadas de la página anterior).
    this.doc.setDrawColor(...AMBAR_BORDE);
    this.doc.setLineWidth(0.9);
    if (this.nPagina === paginaInicio) {
      this.doc.line(M + 1.2, yTitulo - 2.6, M + 1.2, this.y - 3.2);
    } else {
      const paginaFin = this.nPagina;
      this.doc.setPage(paginaInicio);
      this.doc.line(M + 1.2, yTitulo - 2.6, M + 1.2, this.cuerpoFin - 1);
      this.doc.setPage(paginaFin);
      this.doc.line(M + 1.2, this.cuerpoInicio + 1, M + 1.2, this.y - 3.2);
    }
    this.y += 2.5;
    this.registrarElemento('analisis');
    return this.y;
  }

  // ------------------------------------------------------- figuras (§9)
  figura(f: FiguraDoc): number {
    const paginaInicioFigura = this.nPagina;
    const anchoUtil = this.anchoUtil;
    const altoFig = 76;
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(TAM_TITULO_TABLA);
    const lineasTitulo = this.doc.splitTextToSize(T(f.titulo), anchoUtil);
    const notaLineas = this.doc.splitTextToSize(T(`Nota. ${f.nota}`), anchoUtil);
    const altoTotal = 4 * lineasTitulo.length + 2 + altoFig + f.leyenda.length * 3.6 + 4.5 + notaLineas.length * 3.4 + 6;
    // Figura indivisible: si no cabe y cabe en página nueva, se mueve entera.
    if (this.y + altoTotal > this.cuerpoFin && altoTotal <= this.cuerpoFin - this.cuerpoInicio) {
      this.nuevaPagina();
    }
    this.doc.setTextColor(...TITULO);
    this.doc.text(lineasTitulo, M, this.y + 3.2);
    this.y += 4 * lineasTitulo.length + 2;

    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(5.5);
    const anchoEtiquetaY = f.marcasY.reduce((m, x) => Math.max(m, this.doc.getTextDimensions(T(x.etiqueta)).w), 0);
    const izq = M + 4 + anchoEtiquetaY + 2;
    const der = M + anchoUtil - 4;
    const abajo = this.y + altoFig;
    const { xMin, xMax, yMin, yMax } = f.ejes;
    const px = (x: number) => izq + ((x - xMin) / Math.max(1e-9, xMax - xMin)) * (der - izq);
    const py = (v: number) => abajo - ((v - yMin) / Math.max(1e-9, yMax - yMin)) * (altoFig - 6);

    this.doc.setDrawColor(226, 232, 240);
    this.doc.setLineWidth(0.15);
    for (const marca of f.marcasY) this.doc.line(izq, py(marca.y), der, py(marca.y));
    this.doc.setDrawColor(...LINEA_MEDIA);
    this.doc.setLineWidth(0.4);
    this.doc.line(izq, this.y + 2, izq, abajo);
    this.doc.line(izq, abajo, der, abajo);
    if (yMin < 0 && yMax > 0) {
      this.doc.setDrawColor(...LINEA_SUAVE);
      this.doc.line(izq, py(0), der, py(0));
    }
    this.doc.setFontSize(5.5);
    this.doc.setTextColor(...GRIS);
    for (const marca of f.marcasY) {
      this.doc.setDrawColor(...LINEA_MEDIA);
      this.doc.setLineWidth(0.4);
      this.doc.line(izq - 1.1, py(marca.y), izq, py(marca.y));
      this.doc.text(T(marca.etiqueta), izq - 1.5, py(marca.y) + 1.1, { align: 'right' });
    }
    for (const marca of f.marcasX) {
      this.doc.line(px(marca.x), abajo, px(marca.x), abajo + 1.1);
      this.doc.text(T(marca.etiqueta), px(marca.x), abajo + 3.6, { align: 'center' });
    }
    const trazo = (color: string, grosor: number) => {
      const [r, g, b] = hexARgb(color);
      this.doc.setDrawColor(r, g, b);
      this.doc.setLineWidth(grosor);
    };
    for (const pr of f.primitivas) {
      if (pr.t === 'linea') {
        trazo(pr.color, pr.grosor);
        this.doc.setLineDashPattern(pr.punteada ? [1.6, 1.4] : [], 0);
        this.doc.line(px(pr.x1), py(pr.y1), px(pr.x2), py(pr.y2));
        this.doc.setLineDashPattern([], 0);
      } else if (pr.t === 'polilinea') {
        trazo(pr.color, pr.grosor);
        for (let i = 1; i < pr.puntos.length; i++) {
          const [x1, y1] = pr.puntos[i - 1];
          const [x2, y2] = pr.puntos[i];
          this.doc.line(px(x1), py(y1), px(x2), py(y2));
        }
      } else if (pr.t === 'rect') {
        const [r, g, b] = hexARgb(pr.color);
        this.doc.setFillColor(r, g, b);
        this.doc.rect(px(pr.x), py(pr.y + pr.h), px(pr.x + pr.w) - px(pr.x), py(pr.y) - py(pr.y + pr.h), pr.rellena ? 'F' : 'S');
      }
    }
    let yFin = abajo + 6;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(7);
    for (const item of f.leyenda) {
      if (yFin > this.cuerpoFin - 6) {
        this.nuevaPagina();
        yFin = this.cuerpoInicio;
      }
      const [r, g, b] = hexARgb(item.color);
      this.doc.setDrawColor(r, g, b);
      this.doc.setLineWidth(1.2);
      this.doc.line(M, yFin - 1, M + 5, yFin - 1);
      this.doc.setTextColor(71, 85, 105);
      this.doc.text(T(item.etiqueta), M + 7, yFin);
      yFin += 3.6;
    }
    this.doc.setTextColor(...GRIS);
    this.doc.setFontSize(7);
    this.doc.text(T(`Unidades del eje vertical: ${f.unidad}. Eje horizontal: ${f.ejeX}.`), M, yFin + 1);
    yFin += 4.5;
    this.doc.setFontSize(7);
    this.doc.setTextColor(...GRIS);
    for (const linea of notaLineas) {
      if (yFin > this.cuerpoFin - 4) {
        this.nuevaPagina();
        yFin = this.cuerpoInicio;
      }
      this.doc.text(linea, M, yFin);
      yFin += 3.4;
    }
    this.y = yFin + 5;
    // Marca TODO el rango de páginas de la figura (título+gráfico+leyenda+nota
    // son indivisibles salvo la leyenda/nota al final).
    for (let p = paginaInicioFigura; p <= this.nPagina; p++) {
      const est = this.paginas[p - 1];
      if (!est) continue;
      if (!est.elementos.includes('figura')) est.elementos.push('figura');
      est.yFin = Math.max(est.yFin, p === this.nPagina ? this.y : this.cuerpoFin);
    }
    return this.y;
  }

  // ------------------------------------------------------- elementos
  elemento(el: ElementoDoc): number {
    switch (el.tipo) {
      case 'parrafo':
        return this.parrafo(el.texto, { size: el.pequeno ? TAM_NOTA : el.italica ? TAM_CUERPO : TAM_CUERPO, italica: el.italica });
      case 'campos':
        return this.campos(el.items);
      case 'subtitulo':
        return this.subtitulo(el.texto);
      case 'tabla':
        return this.tabla(el.tabla);
      case 'analisis':
        return this.analisis({ titulo: el.bloque.titulo, texto: el.bloque.texto, estado: el.bloque.estado });
      case 'aviso':
        return this.aviso(el.texto);
      case 'figura':
        return this.figura(el.figura);
    }
  }

  // ------------------------------------------------------- P0-2: secciones
  private esLiviano(el: ElementoDoc): boolean {
    if (el.tipo === 'parrafo') {
      const alto = this.altoParrafo(T(el.texto), el.pequeno ? TAM_NOTA : TAM_CUERPO, ANCHO - 2 * M);
      return alto <= 62;
    }
    if (el.tipo === 'analisis') return true;
    if (el.tipo === 'aviso') return true;
    return false; // figuras, tablas y campos: nunca se absorben en apaisado
  }

  /** Sección con política de paginación por niveles (§4.1) y grupos
   *  apaisados sin páginas vacías (§4.2). */
  seccion(sec: SeccionDoc, registrar?: Record<string, number>): void {
    const esApaisadaEl = (el: ElementoDoc): el is Extract<ElementoDoc, { tipo: 'tabla' }> =>
      el.tipo === 'tabla' && this.necesitaApaisada(el.tabla);
    const primeraApaisada = sec.elementos.findIndex(esApaisadaEl);
    // §4.2: sección dominada por una tabla ancha → el título y su breve
    // introducción se componen JUNTO a la tabla en el bloque apaisado.
    const abreConApaisada =
      primeraApaisada >= 0 &&
      primeraApaisada <= 1 &&
      sec.elementos.slice(0, primeraApaisada).every((e) => this.esLiviano(e));

    if (!abreConApaisada) {
      this.irARetrato();
      this.tituloCapitulo(sec.titulo, sec.paginaNueva);
      if (registrar) registrar[sec.titulo] = this.nPagina;
    }

    let i = 0;
    while (i < sec.elementos.length) {
      const el = sec.elementos[i];
      if (esApaisadaEl(el)) {
        // Abre el bloque apaisado (la página vertical anterior queda como
        // esté: NO se añade ninguna página vacía de transición).
        this.nuevaPagina('apaisada');
        if (abreConApaisada && i === primeraApaisada) {
          this.tituloCapitulo(sec.titulo, false);
          if (registrar) registrar[sec.titulo] = this.nPagina;
        }
        // Absorbe tablas apaisadas consecutivas y los bloques livianos
        // intermedios/ finales que quepan (§4.2/§4.3), sin fragmentar.
        while (i < sec.elementos.length) {
          const actual = sec.elementos[i];
          const esAncha = esApaisadaEl(actual);
          const despues = sec.elementos.slice(i + 1);
          const absorbible =
            esAncha ||
            (this.esLiviano(actual) &&
              (despues.some(esApaisadaEl) || despues.every((d) => this.esLiviano(d))) &&
              this.y + 8 <= this.cuerpoFin);
          if (!absorbible) break;
          this.elemento(actual);
          i++;
        }
        // El grupo termina SIN página vertical incondicional: la siguiente
        // llamada a irARetrato() abrirá vertical solo si hay contenido.
      } else {
        this.irARetrato();
        this.elemento(el);
        i++;
      }
    }
  }

  // ------------------------------------------------------- portada e índice
  private portada(): void {
    const p = this.documento.portada;
    this.doc.setFillColor(30, 41, 59);
    this.doc.rect(0, 0, ANCHO, 52, 'F');
    this.doc.setTextColor(255);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(20);
    this.doc.text(T(p.titulo), ANCHO / 2, 24, { align: 'center' });
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10.5);
    this.doc.text(T(p.subtitulo), ANCHO / 2, 33.5, { align: 'center', maxWidth: ANCHO - 2 * M });
    this.doc.setFontSize(8.5);
    this.doc.setTextColor(203, 213, 225);
    this.doc.text(T(p.marca), ANCHO / 2, 43, { align: 'center' });

    this.doc.setTextColor(...TITULO);
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(15);
    const lineasNP = this.doc.splitTextToSize(T(p.nombreProyecto), ANCHO - 2 * M - 16);
    this.doc.text(lineasNP, M, 74);
    let y = 74 + lineasNP.length * 6.4 + 4;
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(10.5);
    if (p.denominacion) {
      const lineasDen = this.doc.splitTextToSize(T(p.denominacion), ANCHO - 2 * M - 16);
      this.doc.text(lineasDen, M, y);
      y += lineasDen.length * 4.8 + 4;
    }
    this.doc.setFontSize(9.5);
    for (const cifra of p.cifras) {
      const etiqueta = T(cifra.etiqueta);
      const valor = T(cifra.valor);
      this.doc.setFont('helvetica', 'bold');
      this.doc.setTextColor(...TITULO);
      const wE = this.doc.getTextWidth(`${etiqueta}: `);
      const wV = this.doc.getTextWidth(valor);
      if (wE + wV > ANCHO - 2 * M) {
        this.doc.text(`${etiqueta}:`, M, y);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...TINTA);
        this.doc.text(valor, M + 4, y + 4.6);
        y += 9.6;
      } else {
        this.doc.text(`${etiqueta}:`, M, y);
        this.doc.setFont('helvetica', 'normal');
        this.doc.setTextColor(...TINTA);
        this.doc.text(valor, M + wE, y);
        y += 5.4;
      }
    }
    this.y = y;
    if (p.avisoDemo) this.aviso(p.avisoDemo);
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setTextColor(...GRIS);
    this.doc.text(
      T(
        `Generado localmente por PLANEX Cuba el ${new Date().toLocaleString('es-ES')}. Cifras y análisis provienen del modelo de cálculo activo (misma versión para tablas, resumen, conclusiones y exportaciones).`
      ),
      M,
      ALTO - 16
    );
    this.paginas[0].yFin = Math.max(this.paginas[0].yFin, this.y);
  }

  /** Índice con numeración real (la da la doble pasada del exportador). */
  private indice(paginasSecciones: Record<string, number>): number {
    this.nuevaPagina('retrato');
    this.doc.setFont('helvetica', 'bold');
    this.doc.setFontSize(TAM_CAPITULO);
    this.doc.setTextColor(...TITULO);
    this.doc.text('Índice', M, this.cuerpoInicio + 4);
    this.doc.setDrawColor(...LINEA_MEDIA);
    this.doc.setLineWidth(0.5);
    this.doc.line(M, this.cuerpoInicio + 7.5, M + this.anchoUtil, this.cuerpoInicio + 7.5);
    let ty = this.cuerpoInicio + 18;
    let paginas = 1;
    for (const seccion of this.documento.secciones) {
      if (!seccion.enIndice) continue;
      const pag = paginasSecciones[seccion.titulo];
      if (pag === undefined) continue;
      if (ty > this.cuerpoFin - 8) {
        this.nuevaPagina('retrato');
        ty = this.cuerpoInicio + 6;
        paginas++;
      }
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(TAM_INDICE);
      this.doc.setTextColor(...TINTA);
      const titulo = T(seccion.titulo);
      this.doc.text(titulo, M, ty);
      const wT = this.doc.getTextWidth(titulo);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(String(pag), ANCHO - M, ty, { align: 'right' });
      const wP = this.doc.getTextWidth(String(pag));
      this.doc.setDrawColor(...LINEA_SUAVE);
      this.doc.setLineWidth(0.12);
      this.doc.setLineDashPattern([0.7, 1.3], 0);
      this.doc.line(M + wT + 3, ty - 1, ANCHO - M - wP - 3, ty - 1);
      this.doc.setLineDashPattern([], 0);
      ty += INTER_INDICE;
    }
    this.paginas[this.nPagina - 1].yFin = Math.max(this.paginas[this.nPagina - 1].yFin, ty);
    this.registrarElemento('indice');
    return paginas;
  }

  /** Pies de página numerados, adaptados a la orientación de CADA página. */
  private pies(): void {
    const total = this.doc.getNumberOfPages();
    const meta = this.documento.meta;
    for (let i = 2; i <= total; i++) {
      this.doc.setPage(i);
      const anchoPag = this.doc.internal.pageSize.getWidth();
      const altoPag = this.doc.internal.pageSize.getHeight();
      this.doc.setDrawColor(...LINEA_SUAVE);
      this.doc.setLineWidth(0.25);
      this.doc.line(M, altoPag - 13, anchoPag - M, altoPag - 13);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(7);
      this.doc.setTextColor(...GRIS);
      this.doc.text('PLANEX Cuba — Plan de Negocios (GOC-2026-O57)', M, altoPag - 8.5);
      this.doc.text(`Página ${i} de ${total}`, anchoPag - M, altoPag - 8.5, { align: 'right' });
      if (meta.esDemo) this.doc.text('EJEMPLO ILUSTRATIVO CON DATOS FICTICIOS', anchoPag / 2, altoPag - 8.5, { align: 'center' });
    }
  }

  /** Cuerpo completo: portada + índice (opcional) + secciones + pies. */
  componer(opciones?: { paginasSecciones?: Record<string, number>; registrar?: Record<string, number> }): void {
    this.portada();
    if (opciones?.paginasSecciones) {
      this.indice(opciones.paginasSecciones);
      this.nuevaPagina('retrato'); // el cuerpo abre en página propia, igual que en la pasada 1
    } else {
      this.nuevaPagina('retrato'); // pasada 1: el cuerpo abre en página 2
    }
    for (const seccion of this.documento.secciones) {
      this.seccion(seccion, opciones?.registrar);
    }
    this.pies();
    this.compactarDiagnostico();
  }

  resultado(): { doc: jsPDF; diagnostico: DiagnosticoComposicion } {
    return { doc: this.doc, diagnostico: this.diag };
  }

  private compactarDiagnostico(): void {
    this.diag.paginas = this.paginas.map((p, idx) => {
      const altoCuerpo = (p.orientacion === 'retrato' ? ALTO : ANCHO) - ZONA_PIE - this.cuerpoInicio;
      return {
        pagina: idx + 1,
        orientacion: p.orientacion,
        ocupacion: Math.max(0, Math.min(1, (p.yFin - this.cuerpoInicio) / Math.max(1, altoCuerpo))),
        elementos: p.elementos,
      };
    });
  }
}

/** Número de páginas de índice que ocupan n entradas (misma constante que
 *  usa el renderizador: la doble pasada depende de este cálculo). */
export function paginasDeIndice(nEntradas: number): number {
  const porPagina = Math.floor((ALTO - ZONA_PIE - 22 - 18 - 6) / INTER_INDICE);
  return Math.max(1, Math.ceil(nEntradas / Math.max(1, porPagina)));
}

// ---------------------------------------------------------------------------
// Exportación (doble pasada para el índice con numeración REAL)
// ---------------------------------------------------------------------------
function componerDocumento(documento: DocumentoPlanex, paginasSecciones?: Record<string, number>, registrar?: Record<string, number>) {
  const comp = new Compositor(documento);
  comp.componer({ paginasSecciones, registrar });
  return comp.resultado();
}

/** Genera el PDF con índice paginado (doble pasada) y diagnóstico de
 *  composición (densidad por página + medición del justificado). */
export function exportarPDFConDiagnostico(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: OpcionesDocumento
): { datos: Blob; nombre: string; documento: DocumentoPlanex; diagnostico: DiagnosticoComposicion } {
  const documento = construirDocumentoPlanex(proyecto, modelo, opciones);

  // Pasada 1: registrar en qué página empieza cada sección (sin índice).
  const registro: Record<string, number> = {};
  componerDocumento(documento, undefined, registro);
  const enIndice = documento.secciones.filter((s) => s.enIndice).length;
  const paginasIndice = paginasDeIndice(enIndice);
  const paginasAjustadas = Object.fromEntries(Object.entries(registro).map(([k, v]) => [k, v + paginasIndice]));

  // Pasada 2: documento final con índice y numeración coherente.
  const { doc, diagnostico } = componerDocumento(documento, paginasAjustadas);
  const datos = doc.output('blob');
  const sufijo = documento.meta.moneda === 'CUP' ? ' CUP' : ' USD';
  const nombre = `${T((documento.meta.nombreProyecto || proyecto.nombre).slice(0, 40))}${sufijo}.pdf`;
  return { datos, nombre, documento, diagnostico };
}

/** Composición directa desde un modelo documental canónico (pruebas de la
 *  misión DOC-003 §3.3/§4.4: documentos sintéticos con patrones controlados).
 *  Devuelve el PDF y el diagnóstico de composición (posiciones de línea
 *  medidas, densidad por página, fuentes y alineaciones de tabla). */
export function componerDesdeModelo(documento: DocumentoPlanex): { datos: ArrayBuffer; diagnostico: DiagnosticoComposicion } {
  const comp = new Compositor(documento);
  comp.componer();
  const { doc, diagnostico } = comp.resultado();
  return { datos: doc.output('arraybuffer'), diagnostico };
}

/** Genera el PDF con índice paginado (doble pasada) desde el modelo canónico. */
export function exportarPDF(
  proyecto: PlanexProject,
  modelo: ComputedModel,
  opciones?: OpcionesDocumento
): { datos: Blob; nombre: string; documento: DocumentoPlanex } {
  const { datos, nombre, documento } = exportarPDFConDiagnostico(proyecto, modelo, opciones);
  return { datos, nombre, documento };
}

/** Versión de solo texto plano del documento (índices de pruebas E2E). */
export { construirDocumentoPlanex };
