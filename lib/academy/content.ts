export type AcademyLevel = 'beginner' | 'intermediate' | 'advanced' | 'edge'

export interface ExamQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface AcademyBlock {
  id: string
  title: string
  objective: string
  lessons: string[]
  durationMinutes?: number
  resources?: string[]
  difficulty?: 'base' | 'intermedio' | 'avanzado'
  exam: {
    passScore: number
    questions: ExamQuestion[]
  }
}

export interface AcademyRoute {
  id: string
  level: AcademyLevel
  title: string
  summary: string
  objective: string
  estimatedHours: number
  prerequisites: string[]
  blocks: AcademyBlock[]
}

export type PublicExamQuestion = Omit<ExamQuestion, 'correctIndex'>
export type PublicAcademyBlock = Omit<AcademyBlock, 'exam'> & {
  exam: {
    passScore: number
    questions: PublicExamQuestion[]
  }
}
export type PublicAcademyRoute = Omit<AcademyRoute, 'blocks'> & {
  blocks: PublicAcademyBlock[]
}

const ACADEMY_ROUTES: AcademyRoute[] = [
  {
    id: 'beginner',
    level: 'beginner',
    title: 'Ruta Principiante · ATLAS',
    summary: 'Programa guiado para construir lectura de mercado paso a paso.',
    objective: 'Dominar estructura, contexto, zonas y ejecución base antes de pasar a intermedio.',
    estimatedHours: 42,
    prerequisites: ['Ninguno'],
    blocks: [
      {
        id: 'beg-1',
        title: 'Fundamentos del mercado financiero',
        objective: 'Entender participantes, sesiones y mecánica básica del precio.',
        durationMinutes: 35,
        resources: ['Mapa de sesiones', 'Glosario bid/ask'],
        difficulty: 'base',
        lessons: [
          'Participantes del mercado y liquidez',
          'Sesiones, spread, pip y dinámica base',
          'Lectura inicial de contexto',
        ],
        exam: {
          passScore: 70,
          questions: [
            {
              id: 'beg-1-q1',
              prompt: '¿Qué sesión suele concentrar mayor movimiento intradía en FX?',
              options: ['Solape Londres-Nueva York', 'Cierre de Sydney', 'Horario sin sesiones activas'],
              correctIndex: 0,
              explanation: 'El solape Londres-Nueva York concentra liquidez y volatilidad.',
            },
            {
              id: 'beg-1-q2',
              prompt: '¿Qué representa mejor el spread?',
              options: ['Comisión fija del broker', 'Diferencia bid/ask', 'Distancia entre SL y TP'],
              correctIndex: 1,
              explanation: 'El spread es la diferencia entre precio de compra (ask) y venta (bid).',
            },
          ],
        },
      },
      {
        id: 'beg-2',
        title: 'Velas japonesas y estructura',
        objective: 'Construir lectura técnica base con estructura multi-timeframe.',
        durationMinutes: 40,
        resources: ['Checklist BOS', 'Plantilla estructura'],
        difficulty: 'base',
        lessons: [
          'Patrones de vela de continuidad y reversión',
          'Soportes, resistencias y swing points',
          'Tendencia y ruptura válida de estructura',
        ],
        exam: {
          passScore: 70,
          questions: [
            {
              id: 'beg-2-q1',
              prompt: '¿Qué confirma mejor una ruptura válida de estructura?',
              options: ['Un toque rápido del nivel', 'Cierre y continuación sobre el swing', 'Solo una mecha extensa'],
              correctIndex: 1,
              explanation: 'Se valida con cierre y continuación, no solo con una mecha.',
            },
            {
              id: 'beg-2-q2',
              prompt: 'En estructura alcista, ¿qué esperas ver?',
              options: ['Máximos y mínimos crecientes', 'Máximos y mínimos decrecientes', 'Rango eterno sin sesgo'],
              correctIndex: 0,
              explanation: 'Una secuencia de máximos y mínimos crecientes confirma sesgo alcista.',
            },
          ],
        },
      },
      {
        id: 'beg-3',
        title: 'Análisis técnico clásico',
        objective: 'Aplicar indicadores con criterio y evitar sobrecarga de señales.',
        durationMinutes: 44,
        resources: ['Setup EMA/RSI', 'Plantilla confluencia'],
        difficulty: 'base',
        lessons: [
          'EMA, RSI y MACD en contexto',
          'Fibonacci y zonas de reacción',
          'Cuándo NO usar indicadores',
        ],
        exam: {
          passScore: 72,
          questions: [
            {
              id: 'beg-3-q1',
              prompt: '¿Cuál es el error más común al usar indicadores?',
              options: ['Usarlos como contexto', 'Usarlos como gatillo único sin estructura', 'Combinarlos con precio'],
              correctIndex: 1,
              explanation: 'Indicadores sin estructura generan entradas de baja calidad.',
            },
            {
              id: 'beg-3-q2',
              prompt: '¿Para qué sirve mejor una EMA?',
              options: ['Definir sesgo dinámico', 'Predecir noticias macro', 'Evitar usar stop loss'],
              correctIndex: 0,
              explanation: 'La EMA aporta contexto de tendencia y estructura dinámica.',
            },
          ],
        },
      },
      {
        id: 'beg-4',
        title: 'Supply & Demand institucional',
        objective: 'Identificar zonas institucionales de reacción con checklist.',
        durationMinutes: 45,
        resources: ['Checklist 5 criterios', 'Plantilla zonas HTF/LTF'],
        difficulty: 'intermedio',
        lessons: [
          'RBD/DBR/RBR/DBD',
          'Checklist de 5 criterios para validar zona',
          'Confluencia multi-timeframe',
        ],
        exam: {
          passScore: 75,
          questions: [
            {
              id: 'beg-4-q1',
              prompt: '¿Qué mejora la validez de una zona Supply/Demand?',
              options: ['Más líneas dibujadas', 'Impulso claro + salida limpia + contexto', 'Entrar sin esperar reacción'],
              correctIndex: 1,
              explanation: 'La zona válida combina estructura, impulso y contexto.',
            },
            {
              id: 'beg-4-q2',
              prompt: '¿Qué rol cumple el multi-timeframe?',
              options: ['Complicar el análisis', 'Alinear contexto mayor y ejecución menor', 'Reemplazar la gestión de riesgo'],
              correctIndex: 1,
              explanation: 'Permite alinear la narrativa de contexto con la entrada.',
            },
          ],
        },
      },
      {
        id: 'beg-5',
        title: 'Smart Money Concepts (SMC)',
        objective: 'Entender BOS/CHOCH, Order Blocks, FVG y liquidez.',
        durationMinutes: 42,
        resources: ['Guía Order Blocks', 'Mapa de liquidez'],
        difficulty: 'intermedio',
        lessons: [
          'BOS y CHOCH',
          'Order Blocks y validación',
          'FVG, liquidez e imbalances',
        ],
        exam: {
          passScore: 78,
          questions: [
            {
              id: 'beg-5-q1',
              prompt: '¿Qué describe mejor un Order Block útil?',
              options: ['Cualquier vela previa al movimiento', 'Última vela opuesta antes de desplazamiento institucional', 'Zona tomada al azar'],
              correctIndex: 1,
              explanation: 'El Order Block se valida por desplazamiento y contexto estructural.',
            },
            {
              id: 'beg-5-q2',
              prompt: '¿Qué suele buscar el precio al barrer liquidez?',
              options: ['Rechazar sin intención', 'Capturar órdenes para continuar movimiento', 'Eliminar el spread'],
              correctIndex: 1,
              explanation: 'El barrido suele preceder desplazamiento con intención.',
            },
          ],
        },
      },
      {
        id: 'beg-6',
        title: 'ICT — Kill Zones y AMD Cycle',
        objective: 'Sincronizar timing de entrada con ventanas de mayor calidad.',
        durationMinutes: 38,
        resources: ['Tabla Kill Zones', 'Plantilla AMD'],
        difficulty: 'avanzado',
        lessons: [
          'Kill Zones y ventanas horarias',
          'AMD (Accumulation-Manipulation-Distribution)',
          'Power of 3 y ejecución disciplinada',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'beg-6-q1',
              prompt: '¿Qué ventaja aporta operar en Kill Zone?',
              options: ['Más ruido y menos liquidez', 'Mayor probabilidad de desplazamiento real', 'Eliminar gestión de riesgo'],
              correctIndex: 1,
              explanation: 'Kill Zones concentran liquidez y movimiento institucional.',
            },
            {
              id: 'beg-6-q2',
              prompt: 'En AMD, la fase de manipulación suele:',
              options: ['Invalidar toda estructura', 'Desplazar contra el sesgo antes de la distribución', 'Cerrar mercado temprano'],
              correctIndex: 1,
              explanation: 'La manipulación suele barrer extremos antes del movimiento principal.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'intermediate',
    level: 'intermediate',
    title: 'Ruta Intermedio',
    summary: 'Confluencias y lectura multi-factor para mejores setups.',
    objective: 'Unificar estructura + zona + timing + riesgo en decisiones consistentes.',
    estimatedHours: 26,
    prerequisites: ['Ruta Principiante completada'],
    blocks: [
      {
        id: 'int-1',
        title: 'Confluencias operativas',
        objective: 'Construir setups con señales que se refuercen entre sí.',
        durationMinutes: 48,
        lessons: [
          'Confluencia técnica y contexto macro',
          'Zonas de reacción y validación de entrada',
          'Filtro de timing por sesión y evento',
        ],
        exam: {
          passScore: 75,
          questions: [
            {
              id: 'int-1-q1',
              prompt: '¿Qué define una confluencia robusta?',
              options: ['Una sola señal muy fuerte', 'Varias señales independientes alineadas', 'Entrar sin contexto'],
              correctIndex: 1,
              explanation: 'Cuantas más señales independientes alineadas, mejor robustez del setup.',
            },
            {
              id: 'int-1-q2',
              prompt: 'Si hay evento macro high-impact en 15 minutos, lo más prudente es:',
              options: ['Aumentar lotaje', 'Evitar entrada impulsiva y esperar resolución', 'Quitar stop loss'],
              correctIndex: 1,
              explanation: 'La volatilidad del evento puede invalidar entradas prematuras.',
            },
          ],
        },
      },
      {
        id: 'int-2',
        title: 'Gestión activa y journal',
        objective: 'Elevar consistencia con revisión post-trade estructurada.',
        durationMinutes: 46,
        lessons: [
          'Gestión parcial y protección dinámica',
          'Checklist post-trade y aprendizaje',
          'Métricas: win-rate, expectativa, drawdown',
        ],
        exam: {
          passScore: 75,
          questions: [
            {
              id: 'int-2-q1',
              prompt: '¿Para qué sirve el post-trade checklist?',
              options: ['Solo para registrar profit', 'Medir calidad de proceso y conducta', 'Reemplazar el plan'],
              correctIndex: 1,
              explanation: 'El checklist captura disciplina y calidad de ejecución, no solo resultado.',
            },
            {
              id: 'int-2-q2',
              prompt: '¿Qué métrica describe mejor estabilidad de riesgo?',
              options: ['Drawdown máximo', 'Cantidad de entradas por día', 'Color del activo'],
              correctIndex: 0,
              explanation: 'El drawdown máximo muestra la caída acumulada de capital.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'advanced',
    level: 'advanced',
    title: 'Ruta Avanzado',
    summary: 'Operativa sistémica, validación estadística y control de riesgo profesional.',
    objective: 'Diseñar y ejecutar playbooks con edge medible y gobernanza de riesgo.',
    estimatedHours: 34,
    prerequisites: ['Ruta Intermedio completada'],
    blocks: [
      {
        id: 'adv-1',
        title: 'Playbooks y edge estadístico',
        objective: 'Formalizar setups repetibles con métricas de ventaja.',
        durationMinutes: 52,
        lessons: [
          'Definición de playbook y criterios de activación',
          'Muestreo, varianza y significancia básica',
          'Segmentación por régimen de mercado',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'adv-1-q1',
              prompt: 'Un edge sostenible requiere:',
              options: ['Aciertos aislados', 'Proceso repetible y medible', 'Cambiar reglas cada día'],
              correctIndex: 1,
              explanation: 'La ventaja real surge de repetición consistente y evaluación objetiva.',
            },
            {
              id: 'adv-1-q2',
              prompt: '¿Qué ayuda a reducir sesgo al evaluar un setup?',
              options: ['Muestra suficiente de operaciones', 'Una operación destacada', 'Ajustar datos al resultado esperado'],
              correctIndex: 0,
              explanation: 'Una muestra suficiente reduce el peso del ruido y casos aislados.',
            },
          ],
        },
      },
      {
        id: 'adv-2',
        title: 'Gobernanza de riesgo profesional',
        objective: 'Mantener desempeño bajo límites de riesgo explícitos.',
        durationMinutes: 50,
        lessons: [
          'Límites diarios/semanales de pérdida',
          'Escalado de tamaño por desempeño',
          'Protocolos de pausa y recuperación',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'adv-2-q1',
              prompt: '¿Qué debe ocurrir al superar el límite diario de pérdida?',
              options: ['Duplicar riesgo para recuperar', 'Activar pausa operativa', 'Abrir más activos a la vez'],
              correctIndex: 1,
              explanation: 'La pausa protege capital y evita decisiones emocionales.',
            },
            {
              id: 'adv-2-q2',
              prompt: 'Escalar tamaño de posición de forma profesional implica:',
              options: ['Escalar por impulso', 'Escalar con reglas ligadas a desempeño', 'Escalar tras cada trade ganador'],
              correctIndex: 1,
              explanation: 'El escalado debe responder a métricas objetivas y reglas previas.',
            },
          ],
        },
      },
    ],
  },
  {
    id: 'edge',
    level: 'edge',
    title: 'Edge Mentor · Riesgo, Psicologia y Plan',
    summary: 'Ruta de disciplina operativa: protege capital, reduce sesgos y convierte analisis en ejecucion consistente.',
    objective: 'Instalar un sistema profesional de gestion de riesgo, control emocional y mejora continua.',
    estimatedHours: 36,
    prerequisites: ['Tener al menos una metodologia tecnica base'],
    blocks: [
      {
        id: 'edge-1',
        title: 'Por que el riesgo mata antes que el analisis',
        objective: 'Entender la matematica de ruina y por que el lotaje define supervivencia.',
        durationMinutes: 38,
        resources: ['Plantilla riesgo por trade', 'Curva de recuperacion de perdidas'],
        difficulty: 'base',
        lessons: [
          'Paradoja del buen analisis con cuenta en perdida',
          'Asimetria de perdidas y recuperacion',
          'Expectativa positiva vs supervivencia de cuenta',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-1-q1',
              prompt: 'Perder 50% de una cuenta requiere para recuperar:',
              options: ['Ganar 25%', 'Ganar 50%', 'Ganar 100%'],
              correctIndex: 2,
              explanation: 'Tras una caida de 50%, la cuenta necesita duplicarse para volver al punto inicial.',
            },
          ],
        },
      },
      {
        id: 'edge-2',
        title: 'R:R y expectativa matematica',
        objective: 'Dejar de perseguir winrate y empezar a medir expectativa en R.',
        durationMinutes: 35,
        resources: ['Calculadora expectativa', 'Sheet de metricas en R'],
        difficulty: 'base',
        lessons: [
          'Formula de expectativa: (W x AvgWin) - (L x AvgLoss)',
          'Comparacion de sistemas por R:R y no por ego',
          'Como validar si un sistema merece capital real',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-2-q1',
              prompt: 'Con 40% de acierto y R:R promedio 1:2.5, la expectativa es:',
              options: ['Negativa', 'Aproximadamente +0.5R', 'Cero exacto'],
              correctIndex: 1,
              explanation: '0.4 x 2.5 - 0.6 x 1 = +0.4R aprox.; con variacion operativa se usa rango cercano a +0.5R.',
            },
          ],
        },
      },
      {
        id: 'edge-3',
        title: 'Position sizing real por activo',
        objective: 'Calcular tamano de posicion con riesgo fijo y stop tecnico.',
        durationMinutes: 42,
        resources: ['Formula sizing por mercado', 'Ejemplos Forex/Crypto/Futuros'],
        difficulty: 'intermedio',
        lessons: [
          'Riesgo por operacion = capital x % riesgo',
          'Sizing por distancia al stop y volatilidad',
          'Regla 1%-2% y excepciones controladas',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-3-q1',
              prompt: 'Con cuenta de 10,000 y riesgo 1%, el riesgo monetario maximo por trade es:',
              options: ['$50', '$100', '$250'],
              correctIndex: 1,
              explanation: 'El 1% de 10,000 equivale a 100 unidades monetarias de riesgo maximo.',
            },
          ],
        },
      },
      {
        id: 'edge-4',
        title: 'Drawdown y supervivencia operativa',
        objective: 'Medir drawdown normal vs drawdown peligroso y actuar con protocolo.',
        durationMinutes: 40,
        resources: ['Tabla drawdown', 'Plantilla rachas esperadas'],
        difficulty: 'intermedio',
        lessons: [
          'Drawdown absoluto vs relativo',
          'Rachas de perdida estadisticamente normales',
          'Cuanto ganar para recuperar capital',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-4-q1',
              prompt: 'Una racha de perdidas en un sistema con 50% de winrate:',
              options: ['Siempre indica sistema roto', 'Puede ser estadisticamente normal', 'Se evita subiendo riesgo'],
              correctIndex: 1,
              explanation: 'Las rachas existen por varianza; lo critico es respetar riesgo y limites.',
            },
          ],
        },
      },
      {
        id: 'edge-5',
        title: 'Circuit breakers diarios y semanales',
        objective: 'Instalar reglas de pausa para impedir espiral emocional.',
        durationMinutes: 36,
        resources: ['Checklist de pausas', 'Plantilla limite diario/semanal'],
        difficulty: 'intermedio',
        lessons: [
          'Limite de perdida diaria y semanal',
          'Maximo de operaciones por sesion',
          'Protocolo de apagado despues de romper limite',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-5-q1',
              prompt: 'Si alcanzas tu limite diario de perdida, la accion correcta es:',
              options: ['Aumentar riesgo para recuperar', 'Parar la sesion y revisar', 'Cambiar de activo y seguir'],
              correctIndex: 1,
              explanation: 'El circuit breaker protege capital y corta decisiones impulsivas.',
            },
          ],
        },
      },
      {
        id: 'edge-6',
        title: 'Sesgos cognitivos del trader',
        objective: 'Detectar sesgos dominantes y neutralizarlos con reglas objetivas.',
        durationMinutes: 34,
        resources: ['Mapa de sesgos', 'Guia anti-confirmacion'],
        difficulty: 'intermedio',
        lessons: [
          'Confirmacion, anclaje y exceso de confianza',
          'Perdida, disposicion y disponibilidad',
          'Reglas conductuales para desactivar sesgos',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-6-q1',
              prompt: 'Vender ganadores rapido y mantener perdedores es:',
              options: ['Gestion avanzada', 'Efecto disposicion', 'Ejecucion institucional'],
              correctIndex: 1,
              explanation: 'El efecto disposicion es un patron conductual que deteriora expectativa.',
            },
          ],
        },
      },
      {
        id: 'edge-7',
        title: 'FOMO, revenge y over-trading',
        objective: 'Cortar patrones autodestructivos antes de escalar a perdida grave.',
        durationMinutes: 44,
        resources: ['Protocolo anti-revenge 15m', 'Registro de impulsos'],
        difficulty: 'avanzado',
        lessons: [
          'Triggers de FOMO y entrada tardia',
          'Revenge trading y escalada de lotaje',
          'Sobreoperacion y degradacion emocional',
        ],
        exam: {
          passScore: 85,
          questions: [
            {
              id: 'edge-7-q1',
              prompt: 'Despues de una perdida, urge entrar de nuevo en 5 minutos. Eso suele ser:',
              options: ['Confirmacion tecnica', 'Revenge trading', 'Operacion de continuidad'],
              correctIndex: 1,
              explanation: 'La prisa por recuperar es senal clasica de revenge y debe bloquearse.',
            },
          ],
        },
      },
      {
        id: 'edge-8',
        title: 'Rutina y consistencia de proceso',
        objective: 'Construir ejecucion repetible pre, during y post mercado.',
        durationMinutes: 32,
        resources: ['Rutina pre-market', 'Checklist sesion'],
        difficulty: 'intermedio',
        lessons: [
          'Rutina pre-mercado top-down',
          'Control en sesion: proceso sobre resultado',
          'Revision post-sesion y aprendizajes accionables',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-8-q1',
              prompt: 'La metrica principal de consistencia semanal debe ser:',
              options: ['Solo P&L', 'Cumplimiento de reglas del plan', 'Cantidad de operaciones'],
              correctIndex: 1,
              explanation: 'El proceso se controla con adherencia al plan; el P&L es consecuencia.',
            },
          ],
        },
      },
      {
        id: 'edge-9',
        title: 'Construccion del plan de trading',
        objective: 'Definir un plan completo con estrategia, riesgo y reglas psicologicas.',
        durationMinutes: 46,
        resources: ['Template plan profesional', 'Matriz NO-TRADE'],
        difficulty: 'avanzado',
        lessons: [
          'Definicion del trader y mercados',
          'Setups validos, invalidacion y gestion',
          'Reglas psicologicas y evaluacion semanal',
        ],
        exam: {
          passScore: 85,
          questions: [
            {
              id: 'edge-9-q1',
              prompt: 'Un plan profesional incompleto suele faltar:',
              options: ['Reglas de pausa y max riesgo', 'Nombre del setup', 'Color de velas'],
              correctIndex: 0,
              explanation: 'Sin limites y pausas no hay gobernanza de riesgo, solo intencion.',
            },
          ],
        },
      },
      {
        id: 'edge-10',
        title: 'Journal operativo profesional',
        objective: 'Registrar cada trade en R y extraer patrones semanales reales.',
        durationMinutes: 40,
        resources: ['Plantilla journal en R', 'Checklist post-trade'],
        difficulty: 'intermedio',
        lessons: [
          'Campos obligatorios de cada operacion',
          'Registro emocional antes y durante',
          'Metricas: winrate, R:R, expectativa y fuera de plan',
        ],
        exam: {
          passScore: 80,
          questions: [
            {
              id: 'edge-10-q1',
              prompt: 'El journal mas util se completa:',
              options: ['Solo en ganadoras', 'Dias despues de memoria', 'Al terminar cada trade'],
              correctIndex: 2,
              explanation: 'Registrar en caliente reduce sesgo de memoria y mejora calidad de datos.',
            },
          ],
        },
      },
      {
        id: 'edge-11',
        title: 'Backtesting y validacion de estrategia',
        objective: 'Validar un sistema con muestra estadistica antes de capital real.',
        durationMinutes: 42,
        resources: ['Sheet backtest 200 trades', 'Guia anti hindsight bias'],
        difficulty: 'avanzado',
        lessons: [
          'Backtest manual vs automatizado',
          'Muestra minima y control de sesgo',
          'Forward testing demo como puente',
        ],
        exam: {
          passScore: 85,
          questions: [
            {
              id: 'edge-11-q1',
              prompt: 'Una muestra de 20 trades para validar estrategia es:',
              options: ['Suficiente para real', 'Generalmente insuficiente por alta varianza', 'Mejor que 200 trades'],
              correctIndex: 1,
              explanation: 'Con pocas operaciones la varianza domina; la conclusion es fragil.',
            },
          ],
        },
      },
      {
        id: 'edge-12',
        title: 'Revision semanal y mejora continua',
        objective: 'Cerrar el loop de aprendizaje con cambios concretos cada semana.',
        durationMinutes: 30,
        resources: ['Plantilla revision 30 min', 'Bitacora de mejoras'],
        difficulty: 'avanzado',
        lessons: [
          'Las 5 preguntas de revision profesional',
          'Ajustar ejecucion vs ajustar sistema',
          'Plan de mejora para la siguiente semana',
        ],
        exam: {
          passScore: 85,
          questions: [
            {
              id: 'edge-12-q1',
              prompt: 'La revision semanal profesional debe terminar con:',
              options: ['Ningun cambio', 'Una accion concreta para la semana siguiente', 'Solo mirar balance'],
              correctIndex: 1,
              explanation: 'Sin accion concreta no hay mejora continua, solo observacion.',
            },
          ],
        },
      },
    ],
  },
]

export function listAcademyRoutes(): AcademyRoute[] {
  return ACADEMY_ROUTES
}

export function listPublicAcademyRoutes(): PublicAcademyRoute[] {
  return ACADEMY_ROUTES.map((route) => ({
    ...route,
    blocks: route.blocks.map((block) => ({
      ...block,
      exam: {
        passScore: block.exam.passScore,
        questions: block.exam.questions.map(({ correctIndex: _, ...question }) => question),
      },
    })),
  }))
}

export function findAcademyRoute(routeId: string): AcademyRoute | null {
  return ACADEMY_ROUTES.find((route) => route.id === routeId) ?? null
}

export function findAcademyBlock(routeId: string, blockId: string): AcademyBlock | null {
  const route = findAcademyRoute(routeId)
  if (!route) return null
  return route.blocks.find((block) => block.id === blockId) ?? null
}
