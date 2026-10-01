// Static glossary for the in-terminal "?" help badges (<TermHelp />). Same
// spirit as the AI briefs: plain explanations of what a metric is and why it
// matters, never a trading signal or recommendation. Keyed by a stable id so
// callers don't depend on display copy.
export interface GlossaryTerm {
  id: string
  term: string
  definition: string
  whyItMatters: string
  /** Optional deep link once a specific Academy lesson covers this in depth. */
  learnMoreHref?: string
}

export const GLOSSARY: Record<string, GlossaryTerm> = {
  open_interest: {
    id: 'open_interest',
    term: 'Open Interest',
    definition:
      'Número de contratos de futuros u opciones que siguen abiertos (sin cerrar ni liquidar) en un momento dado.',
    whyItMatters:
      'Open interest creciente junto con precio creciente puede indicar que está entrando dinero nuevo al mercado, no solo que los que ya estaban adentro movieron el precio. Open interest cayendo junto con el precio suele ser cierre de posiciones, no convicción nueva.',
  },
  cvd: {
    id: 'cvd',
    term: 'CVD (Cumulative Volume Delta)',
    definition:
      'Suma acumulada del volumen ejecutado por compradores agresivos menos el ejecutado por vendedores agresivos, desde que empezó a medirse (se reinicia cada vez que recargas la página).',
    whyItMatters:
      'Si el precio sube pero el CVD no acompaña (o cae), la subida no está siendo confirmada por flujo agresivo comprador — es una divergencia que vale la pena notar, no necesariamente una reversión.',
  },
  funding_rate: {
    id: 'funding_rate',
    term: 'Funding Rate',
    definition:
      'Pago periódico entre posiciones largas y cortas en futuros perpetuos, pensado para mantener el precio del futuro cerca del precio spot.',
    whyItMatters:
      'Un funding muy positivo y sostenido indica que los largos están pagando una prima alta — señal de que ese lado del mercado puede estar sobreapalancado, no una predicción de hacia dónde va el precio.',
  },
  order_book_imbalance: {
    id: 'order_book_imbalance',
    term: 'Desequilibrio del libro de órdenes',
    definition:
      'Diferencia entre la profundidad (cantidad) visible del lado comprador y del lado vendedor en el libro de órdenes.',
    whyItMatters:
      'Más profundidad de un lado no garantiza que el precio vaya hacia allá — solo importa si esa profundidad persiste y se ejecuta de verdad, no si es una pared que se puede retirar en cualquier momento.',
  },
  liquidation: {
    id: 'liquidation',
    term: 'Liquidación',
    definition:
      'Cierre forzado de una posición apalancada porque el margen del trader ya no cubre las pérdidas.',
    whyItMatters:
      'Un pico de liquidaciones concentradas en una dirección puede acelerar el movimiento del precio en cascada, porque cada liquidación es una orden de mercado forzada, no una decisión voluntaria.',
  },
  spread: {
    id: 'spread',
    term: 'Spread',
    definition:
      'Diferencia entre el mejor precio de compra (bid) y el mejor precio de venta (ask) disponibles en el libro de órdenes.',
    whyItMatters:
      'Un spread que se expande de golpe suele significar que se retiró liquidez — operar en ese momento cuesta más de lo normal, incluso si el precio no se movió.',
  },
  sample_size: {
    id: 'sample_size',
    term: 'Sample size (n)',
    definition:
      'Cuántas observaciones históricas respaldan una estadística — por ejemplo, cuántas veces apareció antes una condición parecida a la actual.',
    whyItMatters:
      'Una tasa de acierto del 80% sobre 8 casos no dice casi nada; la misma tasa sobre 300 casos ya es otra cosa. Siempre vale la pena mirar el n, no solo el porcentaje.',
  },
  mfe_mae: {
    id: 'mfe_mae',
    term: 'MFE / MAE',
    definition:
      'Maximum Favorable Excursion (lo máximo que avanzó el precio a favor) y Maximum Adverse Excursion (lo máximo que retrocedió en contra) durante una ventana de tiempo.',
    whyItMatters:
      'Muestran si un movimiento "llegó limpio" o si hubo que aguantar un retroceso fuerte en el camino — dos casos con el mismo retorno final pueden haberse sentido muy distinto.',
  },
  confidence: {
    id: 'confidence',
    term: 'Confidence (M.A.N.U.)',
    definition:
      'Qué tan completos y robustos son los datos detrás del análisis actual — no es una probabilidad de que el precio suba o baje.',
    whyItMatters:
      'Confidence baja no significa "mercado bajista", significa "hay poca evidencia todavía" — por datos en vivo incompletos o por una muestra histórica insuficiente.',
  },
}

export function getGlossaryTerm(id: string): GlossaryTerm | null {
  return GLOSSARY[id] ?? null
}
