/**
 * Per-lesson learning extras for the Aula (lesson reader):
 * - check: a single self-check question shown next to the lesson (not graded, not the unit exam)
 * - apply: a link to the place in the platform where the concept can be practiced
 */
export interface LessonCheck {
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface LessonApply {
  text: string
  href: string
  cta: string
}

export interface LessonExtras {
  check?: LessonCheck
  apply?: LessonApply
}

export const LESSON_EXTRAS: Record<string, LessonExtras> = {
  'beg-0-l1': {
    check: { prompt: '¿Qué instrumento agrupa una canasta de acciones y cotiza como una sola?', options: ['Un ETF', 'Una opción put', 'Un futuro'], correctIndex: 0, explanation: 'Un ETF contiene muchos activos pero se compra y vende como una acción.' },
    apply: { text: 'Compara el movimiento del S&P 500 y el Nasdaq 100 hoy en el detalle del activo.', href: '/dashboard/stock/SPX500', cta: 'Ver SPX500' },
  },
  'beg-0-l2': {
    check: { prompt: '¿Qué contrato de futuros replica el Nasdaq 100?', options: ['ES', 'NQ', 'YM'], correctIndex: 1, explanation: 'NQ replica el Nasdaq 100, ES el S&P 500 y YM el Dow Jones.' },
    apply: { text: 'Mira cómo se mueven SPX500 y NAS100 antes de la apertura en Market State.', href: '/dashboard/pulse', cta: 'Abrir Market State' },
  },
  'beg-0-l3': {
    check: { prompt: 'Una put te da el derecho a…', options: ['Comprar al strike', 'Vender al strike', 'Recibir dividendos'], correctIndex: 1, explanation: 'Call = derecho a comprar; put = derecho a vender al precio de ejercicio.' },
  },
  'beg-0-l4': {
    check: { prompt: 'Frente a un índice accionario, el tamaño de posición en BTC debería ser…', options: ['Igual', 'Mayor', 'Menor, por su mayor volatilidad'], correctIndex: 2, explanation: 'A mayor volatilidad, menor tamaño para mantener el mismo riesgo.' },
    apply: { text: 'Revisa el drawdown de BTCUSD frente a los índices en Market State.', href: '/dashboard/pulse', cta: 'Ver drawdown' },
  },
  'beg-1-l1': {
    check: { prompt: 'Máximos y mínimos decrecientes indican…', options: ['Tendencia alcista', 'Tendencia bajista', 'Rango perfecto'], correctIndex: 1, explanation: 'LH/LL define estructura bajista.' },
    apply: { text: 'Busca activos con tendencia alcista confirmada en el Scanner.', href: '/dashboard/scanner', cta: 'Abrir Scanner' },
  },
  'beg-1-l2': {
    check: { prompt: '¿En qué horario es la sesión regular de la bolsa de EE. UU.?', options: ['8:00–15:00 ET', '9:30–16:00 ET', '24 horas'], correctIndex: 1, explanation: 'La sesión regular va de 9:30 a 16:00 hora del Este.' },
    apply: { text: 'Observa qué sesiones están abiertas ahora mismo en Command.', href: '/dashboard', cta: 'Abrir Command' },
  },
  'beg-1-l3': {
    check: { prompt: '¿Qué sector suele ser más sensible a subidas de tasas?', options: ['Tecnología de crecimiento', 'Utilities', 'Consumo básico'], correctIndex: 0, explanation: 'Las acciones de alto múltiplo descuentan flujos futuros y sufren más con tasas altas.' },
    apply: { text: 'Consulta los próximos eventos macro en la agenda de Market State.', href: '/dashboard/pulse', cta: 'Ver agenda' },
  },
  'beg-2-l1': {
    check: { prompt: 'Si el stop está más lejos, el tamaño de posición debe…', options: ['Aumentar', 'Disminuir', 'No cambiar'], correctIndex: 1, explanation: 'Para arriesgar el mismo dinero con un stop más amplio, reduces el tamaño.' },
    apply: { text: 'Calcula tu tamaño de posición con riesgo fijo.', href: '/dashboard/calculators', cta: 'Abrir calculadora' },
  },
  'beg-2-l2': {
    check: { prompt: 'Con RR 2:1, ¿qué win rate mínimo necesitas para no perder?', options: ['Más del 33%', 'Más del 50%', 'Más del 66%'], correctIndex: 0, explanation: 'Ganando 2 por cada 1 arriesgado, basta con acertar algo más de 1 de cada 3.' },
    apply: { text: 'Registra tu próxima operación y mira su R:R en vivo.', href: '/dashboard/tools', cta: 'Abrir Trade Audit' },
  },
  'beg-2-l3': {
    check: { prompt: 'Si una respuesta del checklist es “no”, lo profesional es…', options: ['Entrar con menos tamaño', 'Esperar', 'Quitar el stop'], correctIndex: 1, explanation: 'El checklist existe para filtrar; un “no” significa no operar.' },
    apply: { text: 'El paso 1 del registro de operaciones es este mismo checklist.', href: '/dashboard/tools', cta: 'Abrir Trade Audit' },
  },
  'int-1-l1': {
    check: { prompt: 'Una confluencia robusta combina señales…', options: ['Correlacionadas', 'Independientes', 'Del mismo indicador'], correctIndex: 1, explanation: 'Señales independientes reducen falsos positivos.' },
    apply: { text: 'Mira cómo el Scanner combina macro, técnico y timing en un solo score.', href: '/dashboard/scanner', cta: 'Abrir Scanner' },
  },
  'int-1-l2': {
    check: { prompt: 'Llegar a una zona de reacción es…', options: ['Una señal de entrada', 'Un lugar para buscar confirmación', 'Motivo para cerrar todo'], correctIndex: 1, explanation: 'La zona es contexto; la confirmación es la señal.' },
  },
  'int-1-l3': {
    check: { prompt: '¿Cuál de estos NO es un evento que distorsiona el timing?', options: ['FOMC', 'Opex mensual', 'Un martes sin datos'], correctIndex: 2, explanation: 'FOMC, CPI, earnings y opex elevan la volatilidad; un día sin catalizadores no.' },
    apply: { text: 'Revisa la agenda de la semana antes de planear entradas.', href: '/dashboard/pulse', cta: 'Ver agenda' },
  },
  'int-2-l1': {
    check: { prompt: 'Mover el stop a breakeven tras el primer objetivo sirve para…', options: ['Proteger el capital inicial', 'Aumentar el riesgo', 'Cerrar antes'], correctIndex: 0, explanation: 'El resto de la posición ya no puede generar pérdida.' },
  },
  'int-2-l2': {
    check: { prompt: 'Un trade ganador sin proceso es…', options: ['Siempre bueno', 'Una señal de alerta', 'Irrelevante'], correctIndex: 1, explanation: 'Refuerza hábitos que no son sostenibles.' },
    apply: { text: 'Completa el checklist post-trade de tus operaciones cerradas.', href: '/dashboard/tools', cta: 'Abrir Trade Audit' },
  },
  'int-2-l3': {
    check: { prompt: 'El win rate por sí solo…', options: ['Define la rentabilidad', 'No basta sin la expectativa', 'Mide el drawdown'], correctIndex: 1, explanation: 'Importa combinado con el tamaño medio de ganancias y pérdidas.' },
    apply: { text: 'Mira tu win rate y profit factor reales en Trade Audit.', href: '/dashboard/tools', cta: 'Ver mis métricas' },
  },
  'adv-1-l1': {
    check: { prompt: 'Un playbook se escribe…', options: ['Después de operar', 'Antes de operar', 'Solo si se pierde'], correctIndex: 1, explanation: 'Las reglas se fijan por adelantado para poder medir el edge.' },
  },
  'adv-1-l2': {
    check: { prompt: '¿Cuántas operaciones se recomiendan como mínimo para evaluar un playbook?', options: ['5', '10', '30+'], correctIndex: 2, explanation: 'Con menos, la varianza domina el resultado.' },
  },
  'adv-1-l3': {
    check: { prompt: '¿Qué indicador ayuda a clasificar el régimen de mercado?', options: ['VIX', 'El logo del activo', 'La hora local'], correctIndex: 0, explanation: 'El VIX y la amplitud de mercado describen el régimen.' },
    apply: { text: 'Consulta el régimen actual y el VIX en Market State.', href: '/dashboard/pulse', cta: 'Ver régimen' },
  },
  'adv-2-l1': {
    check: { prompt: 'El límite de pérdida diaria se define…', options: ['Durante una racha negativa', 'Antes de operar', 'Al final del mes'], correctIndex: 1, explanation: 'Se fija antes, nunca en caliente.' },
  },
  'adv-2-l2': {
    check: { prompt: 'Escalar tamaño debe basarse en…', options: ['La última racha', 'Métricas de consistencia', 'La intuición'], correctIndex: 1, explanation: 'Reglas objetivas, no euforia.' },
  },
  'adv-2-l3': {
    check: { prompt: 'Al retomar tras una pausa, lo recomendable es…', options: ['Tamaño reducido', 'Doble tamaño', 'El mismo tamaño'], correctIndex: 0, explanation: 'Reconstruir consistencia sin exponer capital.' },
  },
}

export function readMinutes(content: string, keyPoints: string[]): number {
  const words = `${content} ${keyPoints.join(' ')}`.split(/\s+/).filter(Boolean).length
  return Math.max(3, Math.round(words / 180) + 2)
}
