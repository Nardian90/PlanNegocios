// Cumplimentación por sección (checklist interno; los «pendientes» del motor
// alimentan las alertas, no este indicador).

import { PlanexProject, ComputedModel } from '../types';
import { esValorPendiente } from '../format';

export interface Cumplimiento {
  total: number;
  porSeccion: Record<string, number>;
}

function pct(items: boolean[]): number {
  if (!items.length) return 100;
  return Math.round((items.filter(Boolean).length / items.length) * 100);
}

const lleno = (s: string | undefined | null, min = 1) => !!s && s.trim().length >= min;

export function calcularCumplimiento(p: PlanexProject, m: ComputedModel): Cumplimiento {
  const porSeccion: Record<string, number> = {
    general: pct([!esValorPendiente(p.general.elaboradoPor), lleno(p.general.fecha), p.general.declaracionResponsabilidad, lleno(p.titulo.nombreProyecto), lleno(p.titulo.denominacionPropuesta)]),
    resumen: pct([lleno(p.resumen.introduccion, 80)]),
    negocio: pct([lleno(p.negocio.modalidad), lleno(p.negocio.objetoSocial, 20), lleno(p.negocio.fundamentacion, 20), lleno(p.negocio.reglaDistribucion), p.aportaciones.length > 0, lleno(p.inversionistaExtranjero.nombre)]),
    tecnico: pct([lleno(p.tecnico.caracterizacion, 20), lleno(p.tecnico.capacidadInstalada), p.servicios.length > 0, lleno(p.tecnico.localizacion)]),
    financiero: pct([p.financiero.inversion.length > 0, m.ok, m.indicadores.recuperacionProyecto.anios !== null]),
    mercado: pct([lleno(p.mercado.requisitosRegulatorios), lleno(p.mercado.demandaAparente), lleno(p.mercado.demandaSolvente), lleno(p.mercado.metodoEstimacion)]),
    fuerza: pct([p.personal.some((x) => x.etapa === 'operacion'), lleno(p.fuerza.entidadContratante)]),
    inversiones: pct([p.cronograma.length > 0, p.financiero.vehiculos.length >= 0, p.financiero.inversion.length > 0]),
    beneficios: 100,
    conclusiones: pct([lleno(p.conclusiones.texto, 100)]),
  };
  const valores = Object.values(porSeccion);
  const total = Math.round(valores.reduce((s, x) => s + x, 0) / Math.max(1, valores.length));
  return { total, porSeccion };
}
