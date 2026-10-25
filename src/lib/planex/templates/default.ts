// ============================================================================
// Plantilla «Default» — estructura metodológica completa, formularios vacíos,
// ayudas por apartado y motor de cálculo activo. Sin datos ficticios de negocio.
// ============================================================================

import { PlanexProject } from '../types';
import { crearProyectoBase } from '../model/factory';
import { normalizarSerie } from '../model/factory';

export interface AyudaApartado {
  clave: string;
  titulo: string;
  texto: string;
}

/** Ayudas metodológicas (resumen fiel de la GOC-2026-O57) mostradas en Default. */
export const AYUDAS_METODOLOGICAS: AyudaApartado[] = [
  {
    clave: 'general',
    titulo: '4.1 Información general',
    texto:
      'Nombre de quien elaboró el plan, firma o identificación, fecha y declaración de responsabilidad sobre la veracidad y confiabilidad de los datos presentados. La firma acredita la autoría del documento.',
  },
  {
    clave: 'titulo',
    titulo: '4.2 Título',
    texto: 'Nombre del proyecto y denominación de la propuesta de negocio con inversión extranjera.',
  },
  {
    clave: 'indice',
    titulo: '4.3 Índice',
    texto: 'Se genera automáticamente a partir de los apartados existentes, con numeración coherente con la paginación del documento exportable.',
  },
  {
    clave: 'resumen',
    titulo: '4.4 Resumen ejecutivo',
    texto:
      'Descripción del negocio, entidades participantes, importe de la inversión, duración estimada del proceso inversionista, resultados esperados y beneficios previstos. En PLANEX, las cifras de este apartado se vinculan al modelo financiero para evitar duplicaciones manuales.',
  },
  {
    clave: 'negocio',
    titulo: '4.5 Descripción del negocio',
    texto:
      'Modalidad de inversión extranjera (empresa mixta, contrato de asociación económica internacional o inversión extranjera total), objeto social o contractual, plazo de vigencia, fundamentación y propuesta de valor, relación con los objetivos de la inversión extranjera, con el Plan Nacional de Desarrollo Económico y Social y con la estrategia territorial, bienes y servicios, análisis de mercado, caracterización de los inversionistas, aportaciones de los socios con su valoración (miles de USD con un decimal) y regla de distribución de beneficios. Los aportes de derechos reales requieren la certificación de la Dirección de Patrimonio del MFP.',
  },
  {
    clave: 'tecnico',
    titulo: '4.6 Aspectos técnicos y operativos',
    texto:
      'Caracterización de bienes y servicios, capacidad instalada y plazo para alcanzar los niveles previstos, tecnologías, localización e infraestructura, terrenos e instalaciones, necesidades de construcción y estimación de consumos. La capacidad se deriva de la tabla de RECURSOS OPERATIVOS (gabinetes, equipos, profesionales…): defina duración media por procedimiento y los recursos que ocupa cada servicio; el motor reparte el tiempo compartido y limita la producción a lo realmente atendible según el escenario activo (A constante / B ampliaciones).',
  },
  {
    clave: 'financiero',
    titulo: '4.7 Análisis financiero',
    texto:
      'Costo total de la inversión inicial (gastos previos, inversión fija y capital de trabajo), fuentes de financiamiento, proyección de ingresos, costos y utilidades, impuestos, flujos de caja y recuperación. El modelo calcula DOS indicadores separados: recuperación de la inversión total (flujo del proyecto, FCFF) y del capital aportado (flujo de los socios, FCFE), ambos por interpolación lineal. La depreciación corre por activo (vida útil, residual y año de disponibilidad) y la deuda tiene calendario explícito (gracia y método configurables). No se suman monedas distintas sin conversión documentada y la proyección debe extenderse al menos a recuperación + 1.',
  },
  {
    clave: 'mercado',
    titulo: '4.8 Análisis o caracterización del mercado',
    texto:
      'Caracterización de productos y servicios, requisitos regulatorios y registros necesarios, materias primas y materiales auxiliares, fuentes y ubicación de los suministros, consumo estimado, demanda aparente y solvente, y comercialización en moneda nacional, en divisas y exportaciones. Documente fuentes, fechas y métodos; no presente supuestos como hechos demostrados.',
  },
  {
    clave: 'fuerza',
    titulo: '4.9 Fuerza de trabajo',
    texto:
      'Trabajadores cubanos y extranjeros, directivos y otros trabajadores, subtotales, total general, etapa de contratación, salario promedio anual en CUP y entidad autorizada a contratar. El costo laboral se vincula a la proyección financiera.',
  },
  {
    clave: 'inversiones',
    titulo: '4.10 Inversiones',
    texto:
      'Construcción y montaje, maquinaria y equipos, otros conceptos e inversiones inducidas, con importes en las monedas correspondientes; desglose de vehículos por tipo, cantidad y monto; cronograma de preinversión, ejecución, desactivación e inicio de explotación, pruebas y puesta en marcha.',
  },
  {
    clave: 'beneficios',
    titulo: '4.11 Indicadores de beneficios directos al país',
    texto:
      'Por año: impuestos sobre utilidades, otros impuestos, tasas y contribuciones, dividendos o beneficios de la parte cubana, aranceles, pagos por la fuerza de trabajo, canon, royalties y otros ingresos. El período de análisis debe contemplar la recuperación de la inversión más un año.',
  },
  {
    clave: 'conclusiones',
    titulo: '4.12 Conclusiones',
    texto:
      'Conclusiones sobre la viabilidad preliminar, resultados económicos, recuperación, beneficios al país, empleo, tecnología, encadenamientos, impacto territorial, riesgos y condiciones pendientes. No declare viable un proyecto solo porque presente beneficios contables en un año.',
  },
];

export function crearProyectoDefault(): PlanexProject {
  const p = crearProyectoBase('default');
  p.nombre = 'Nuevo plan de negocios (plantilla general)';
  p.ajustes.horizonteAnios = 10;
  p.financiero.otrosIngresos = normalizarSerie([], 10);
  p.general.fecha = '';
  p.resumen = {
    introduccion:
      'Redacte aquí una síntesis del negocio: qué se propone, quiénes participan, cuánto se invertirá, cuánto durará el proceso inversionista y qué resultados y beneficios se esperan. Las cifras clave se vinculan automáticamente al modelo financiero en cuanto complete los datos.',
    notas: 'La plantilla Default incluye textos de ayuda en cada apartado y reglas de cálculo activas. Los resultados dependientes de datos no completados se marcan como pendientes: la aplicación no presenta resultados financieros definitivos con datos inexistentes.',
  };
  p.negocio = {
    modalidad: '',
    objetoSocial: '',
    plazoVigencia: '',
    fundamentacion: '',
    objetivosInversion: '',
    relacionPNDES: '',
    relacionEDT: '',
    bienesServicios: '',
    mercadoInterno: '',
    mercadoExterno: '',
    reglaDistribucion: '',
  };
  p.fuerza = { entidadContratante: '' };
  p.conclusiones = { texto: '' };
  return p;
}
