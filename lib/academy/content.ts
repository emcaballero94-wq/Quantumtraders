export type AcademyLevel = 'beginner' | 'intermediate' | 'advanced'

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
    title: 'Ruta Principiante',
    summary: 'Base sólida para operar con proceso y riesgo controlado.',
    objective: 'Entender estructura de mercado, ejecución básica y disciplina inicial.',
    estimatedHours: 18,
    prerequisites: ['Ninguno'],
    blocks: [
      {
        id: 'beg-1',
        title: 'Fundamentos de mercado',
        objective: 'Leer tendencia, rango y sesiones con contexto macro básico.',
        lessons: [
          'Estructura: máximos/mínimos y cambio de carácter',
          'Sesiones y ventanas de mayor liquidez',
          'Impacto macro de alto nivel (tasas, inflación, empleo)',
        ],
        exam: {
          passScore: 70,
          questions: [
            {
              id: 'beg-1-q1',
              prompt: '¿Qué confirma una estructura alcista básica?',
              options: ['Máximos y mínimos decrecientes', 'Máximos y mínimos crecientes', 'Volumen bajo constante'],
              correctIndex: 1,
              explanation: 'Una secuencia de máximos y mínimos crecientes refleja continuidad alcista.',
            },
            {
              id: 'beg-1-q2',
              prompt: '¿Cuál suele ser una ventana de mayor volatilidad intradía en FX?',
              options: ['Cierre de Sydney', 'Solape London-New York', 'Madrugada sin sesiones activas'],
              correctIndex: 1,
              explanation: 'El solape London-New York concentra liquidez y movimiento.',
            },
          ],
        },
      },
      {
        id: 'beg-2',
        title: 'Riesgo y ejecución inicial',
        objective: 'Aplicar riesgo fijo y ejecutar con plan simple.',
        lessons: [
          'Riesgo por operación y tamaño de posición',
          'Stop loss, take profit y relación riesgo/beneficio',
          'Checklist pre-trade de 4 puntos',
        ],
        exam: {
          passScore: 70,
          questions: [
            {
              id: 'beg-2-q1',
              prompt: '¿Cuál es una regla sana para comenzar?',
              options: ['Riesgar 10% por operación', 'Riesgo fijo pequeño por trade', 'No usar stop loss'],
              correctIndex: 1,
              explanation: 'Riesgo fijo y pequeño protege capital durante la curva de aprendizaje.',
            },
            {
              id: 'beg-2-q2',
              prompt: 'Un RR de 2:1 significa:',
              options: ['Riesgo 2 para ganar 1', 'Riesgo 1 para ganar 2', 'Stop más grande que TP siempre'],
              correctIndex: 1,
              explanation: 'RR 2:1 expresa ganancia potencial doble respecto al riesgo.',
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
