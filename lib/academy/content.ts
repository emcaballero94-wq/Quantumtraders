export type AcademyLevel = 'beginner' | 'intermediate' | 'advanced'

export interface ExamQuestion {
  id: string
  prompt: string
  options: string[]
  correctIndex: number
  explanation: string
}

export interface AcademyLesson {
  id: string
  title: string
  content: string
  keyPoints: string[]
}

export interface AcademyBlock {
  id: string
  title: string
  objective: string
  lessons: AcademyLesson[]
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
    summary: 'Base sólida para operar el mercado americano con proceso y riesgo controlado.',
    objective: 'Entender los instrumentos del mercado, la estructura de precio, la ejecución básica y la disciplina inicial.',
    estimatedHours: 20,
    prerequisites: ['Ninguno'],
    blocks: [
      {
        id: 'beg-0',
        title: 'Instrumentos del mercado americano',
        objective: 'Conocer los vehículos principales antes de operar: acciones, índices, futuros, opciones y cripto.',
        lessons: [
          {
            id: 'beg-0-l1',
            title: 'Acciones, ETFs e índices',
            content:
              'Una acción representa una participación de propiedad en una empresa (por ejemplo, NVDA, AAPL o MSFT). Un ETF agrupa muchas acciones en un solo instrumento negociable, y un índice como el S&P 500 o el Nasdaq 100 mide el desempeño conjunto de las empresas más representativas de un sector o del mercado en general. Operar índices (vía ETFs como SPY/QQQ o vía futuros) da exposición diversificada sin depender de una sola compañía.',
            keyPoints: [
              'S&P 500 = 500 grandes empresas de EE. UU.; Nasdaq 100 = concentrado en tecnología',
              'Un ETF cotiza como una acción pero contiene una canasta de activos',
              'La diversificación de un índice reduce el riesgo idiosincrático de una sola empresa',
            ],
          },
          {
            id: 'beg-0-l2',
            title: 'Futuros de índices (ES, NQ, YM)',
            content:
              'Los futuros de índices son contratos estandarizados que replican el S&P 500 (ES), el Nasdaq 100 (NQ) o el Dow Jones (YM). Se operan casi 23 horas al día, lo que los convierte en la referencia que usan traders institucionales para medir el sentimiento fuera del horario regular de la bolsa (9:30–16:00 ET). Su apalancamiento implícito exige gestión de riesgo estricta desde el primer contrato.',
            keyPoints: [
              'Los futuros operan casi 24h, dando contexto antes de la apertura oficial',
              'ES = S&P 500, NQ = Nasdaq 100, YM = Dow Jones',
              'El apalancamiento amplifica tanto ganancias como pérdidas: dimensiona la posición con cuidado',
            ],
          },
          {
            id: 'beg-0-l3',
            title: 'Opciones: conceptos básicos',
            content:
              'Una opción call da el derecho (no la obligación) de comprar un activo a un precio fijo (strike) antes de una fecha de vencimiento; una put da el derecho de vender. El precio que se paga por ese derecho es la prima. Las opciones permiten expresar una visión direccional con riesgo definido de antemano, o generar ingresos vendiendo primas, pero su valor se erosiona con el tiempo (theta) y depende de la volatilidad implícita.',
            keyPoints: [
              'Call = derecho a comprar; Put = derecho a vender',
              'La prima es el costo máximo si se compra la opción (riesgo definido)',
              'El tiempo hasta el vencimiento y la volatilidad implícita mueven el precio de la opción',
            ],
          },
          {
            id: 'beg-0-l4',
            title: 'Criptoactivos: un mercado que nunca cierra',
            content:
              'Bitcoin (BTC) y otros criptoactivos cotizan 24 horas, los 7 días de la semana, sin las pausas de la bolsa tradicional. Esto genera movimientos relevantes en fines de semana y madrugadas, y una volatilidad estructuralmente mayor que la de un índice como el S&P 500. Muchos traders lo usan como diversificador de portafolio o como vehículo especulativo de corto plazo, siempre con un tamaño de posición acorde a su volatilidad.',
            keyPoints: [
              'El mercado cripto opera 24/7, incluidos fines de semana',
              'Su volatilidad suele ser varias veces mayor a la de un índice accionario',
              'El tamaño de posición debe ajustarse a esa volatilidad, no usar el mismo criterio que en acciones',
            ],
          },
        ],
        exam: {
          passScore: 70,
          questions: [
            {
              id: 'beg-0-q1',
              prompt: '¿Qué representa el índice Nasdaq 100 frente al S&P 500?',
              options: ['Es idéntico al S&P 500', 'Está concentrado en empresas tecnológicas', 'Solo incluye bancos'],
              correctIndex: 1,
              explanation: 'El Nasdaq 100 agrupa principalmente a las mayores empresas no financieras listadas en el Nasdaq, con fuerte peso tecnológico.',
            },
            {
              id: 'beg-0-q2',
              prompt: 'Al comprar una opción call, ¿cuál es la pérdida máxima posible?',
              options: ['Ilimitada', 'La prima pagada', 'El valor total del activo subyacente'],
              correctIndex: 1,
              explanation: 'Comprar una opción define el riesgo por adelantado: como máximo se pierde la prima pagada.',
            },
          ],
        },
      },
      {
        id: 'beg-1',
        title: 'Fundamentos de mercado',
        objective: 'Leer tendencia, rango y sesiones con contexto macro básico.',
        lessons: [
          {
            id: 'beg-1-l1',
            title: 'Estructura: máximos/mínimos y cambio de carácter',
            content:
              'La estructura de mercado se lee a través de máximos y mínimos. Una secuencia de máximos y mínimos crecientes (HH/HL) define una tendencia alcista; máximos y mínimos decrecientes (LH/LL) definen una bajista. Cuando esa secuencia se rompe —por ejemplo, el S&P 500 deja de hacer mínimos crecientes y rompe el mínimo anterior—, se habla de un cambio de carácter (CHoCH), una señal temprana de que el control entre compradores y vendedores puede estar cambiando.',
            keyPoints: [
              'HH/HL = tendencia alcista; LH/LL = tendencia bajista',
              'Un cambio de carácter (CHoCH) es la primera señal de posible reversión',
              'La estructura se evalúa en el timeframe que opera cada trader, no de forma aislada',
            ],
          },
          {
            id: 'beg-1-l2',
            title: 'Sesiones y ventanas de mayor liquidez en EE. UU.',
            content:
              'El horario regular de la bolsa estadounidense es de 9:30 a 16:00 hora del Este (ET). Los primeros 30–60 minutos tras la apertura concentran la mayor volatilidad del día, ya que se resuelven las órdenes acumuladas en pre-market. Los futuros de índices (ES/NQ) y el mercado cripto permiten operar fuera de ese horario, pero con menor participación institucional y spreads más amplios.',
            keyPoints: [
              'Sesión regular: 9:30–16:00 ET',
              'La apertura (primeros 30–60 min) suele ser la ventana de mayor volatilidad',
              'Pre-market y after-hours tienen menor liquidez: los movimientos deben interpretarse con cautela',
            ],
          },
          {
            id: 'beg-1-l3',
            title: 'Impacto macro de alto nivel (tasas, inflación, empleo)',
            content:
              'Tres publicaciones mueven el mercado americano más que ninguna otra: la decisión de tasas de la Reserva Federal (FOMC), el dato de inflación (CPI) y el reporte de empleo (Nonfarm Payrolls). Tasas más altas presionan a la baja a las acciones de crecimiento —especialmente tecnológicas de alto múltiplo—, mientras que datos de inflación o empleo más débiles de lo esperado suelen favorecer expectativas de recortes y, con ello, a los índices.',
            keyPoints: [
              'FOMC, CPI y Nonfarm Payrolls son los catalizadores macro más relevantes',
              'Las acciones de crecimiento/tecnología son las más sensibles a cambios en tasas',
              'Antes de estos eventos, la volatilidad esperada sube y muchos traders reducen exposición',
            ],
          },
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
              prompt: '¿Cuál suele ser la ventana de mayor volatilidad intradía en acciones/índices de EE. UU.?',
              options: ['Los primeros 30–60 minutos tras la apertura (9:30 ET)', 'La última hora de after-hours sin catalizadores', 'La madrugada sin sesiones activas'],
              correctIndex: 0,
              explanation: 'La apertura oficial concentra las órdenes acumuladas y suele ser el tramo más volátil del día.',
            },
          ],
        },
      },
      {
        id: 'beg-2',
        title: 'Riesgo y ejecución inicial',
        objective: 'Aplicar riesgo fijo y ejecutar con plan simple sobre acciones, índices o futuros.',
        lessons: [
          {
            id: 'beg-2-l1',
            title: 'Riesgo por operación y tamaño de posición',
            content:
              'Antes de calcular cuántas acciones, contratos de futuros u opciones comprar, se define cuánto capital se está dispuesto a perder en esa operación (por ejemplo, 1% de la cuenta). El tamaño de la posición se deriva de esa cifra y de la distancia al stop loss: a mayor distancia, menor tamaño, y viceversa. Esto asegura que ninguna operación individual comprometa la cuenta.',
            keyPoints: [
              'Definir primero el riesgo en dinero, luego calcular el tamaño de posición',
              'Regla común para principiantes: 0.5%–1% de la cuenta por operación',
              'A mayor distancia al stop, menor cantidad de acciones/contratos',
            ],
          },
          {
            id: 'beg-2-l2',
            title: 'Stop loss, take profit y relación riesgo/beneficio',
            content:
              'El stop loss es el nivel donde se acepta estar equivocado y se cierra la operación para limitar la pérdida; el take profit es el objetivo donde se toma la ganancia. La relación riesgo/beneficio (RR) compara ambas distancias: un RR de 2:1 significa que la ganancia potencial es el doble del riesgo asumido. Operar con RR favorable permite ser rentable incluso con menos del 50% de aciertos.',
            keyPoints: [
              'Stop loss = límite de pérdida aceptado; Take profit = objetivo de ganancia',
              'RR 2:1 = se arriesga 1 para ganar 2',
              'Con RR positivo, no se necesita un win-rate alto para ser rentable',
            ],
          },
          {
            id: 'beg-2-l3',
            title: 'Checklist pre-trade de 4 puntos',
            content:
              'Antes de ejecutar, un checklist simple evita decisiones impulsivas: (1) ¿la estructura de precio confirma mi sesgo?, (2) ¿hay un catalizador macro o de earnings en las próximas horas?, (3) ¿mi stop y tamaño de posición respetan mi riesgo máximo?, (4) ¿esta operación encaja en mi plan escrito o es una reacción emocional? Responder "sí" a las cuatro es el mínimo para operar con proceso.',
            keyPoints: [
              'Un checklist convierte decisiones emocionales en decisiones basadas en reglas',
              'Revisar catalizadores (earnings, FOMC, CPI) antes de entrar es tan importante como la técnica',
              'Si una respuesta es "no", la disciplina profesional es esperar',
            ],
          },
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
    summary: 'Confluencias y lectura multi-factor para mejores setups en acciones, índices, futuros y opciones.',
    objective: 'Unificar estructura + zona + timing + riesgo en decisiones consistentes.',
    estimatedHours: 28,
    prerequisites: ['Ruta Principiante completada'],
    blocks: [
      {
        id: 'int-1',
        title: 'Confluencias operativas',
        objective: 'Construir setups con señales que se refuercen entre sí.',
        lessons: [
          {
            id: 'int-1-l1',
            title: 'Confluencia técnica y contexto macro',
            content:
              'Un setup robusto no depende de una sola señal. Por ejemplo, una zona de soporte en el S&P 500 que además coincide con una media móvil relevante y un régimen de tasas estable suma tres factores independientes a favor de la misma dirección. Cuantas más señales no correlacionadas se alineen, mayor la probabilidad de que el movimiento tenga continuidad.',
            keyPoints: [
              'Una sola señal técnica rara vez es suficiente para operar con confianza',
              'Combinar estructura + nivel + contexto macro reduce falsos positivos',
              'Buscar señales independientes entre sí, no variaciones de la misma señal',
            ],
          },
          {
            id: 'int-1-l2',
            title: 'Zonas de reacción y validación de entrada',
            content:
              'Una zona de reacción es un rango de precio donde históricamente el mercado ha girado (soporte/resistencia, gaps sin cubrir, niveles de apertura previa). Llegar a la zona no es suficiente: se busca una confirmación —una vela de rechazo, una pérdida de momentum, o una reacción del volumen— antes de entrar, en vez de anticipar el giro sin validación.',
            keyPoints: [
              'Zona de reacción ≠ señal de entrada automática',
              'La confirmación (rechazo, momentum, volumen) reduce el riesgo de anticiparse',
              'Operar sin confirmación suele traducirse en stops prematuros',
            ],
          },
          {
            id: 'int-1-l3',
            title: 'Filtro de timing por sesión y evento',
            content:
              'El momento de la entrada importa tanto como el nivel. Earnings de mega-caps (AAPL, MSFT, NVDA), decisiones del FOMC, el dato de CPI o el vencimiento mensual de opciones (opex) pueden invalidar un setup técnico en minutos por el salto de volatilidad que generan. La regla prudente es evitar abrir nuevas posiciones justo antes de estos eventos y esperar la resolución del movimiento inicial.',
            keyPoints: [
              'Earnings, FOMC, CPI y opex son los eventos que más distorsionan el timing técnico',
              'Evitar nuevas entradas minutos antes de un catalizador de alto impacto',
              'Esperar la primera reacción del mercado antes de operar el evento, no anticiparla',
            ],
          },
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
              prompt: 'Si hay un evento macro de alto impacto (FOMC/CPI) en 15 minutos, lo más prudente es:',
              options: ['Aumentar el tamaño de posición', 'Evitar entrada impulsiva y esperar resolución', 'Quitar el stop loss'],
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
          {
            id: 'int-2-l1',
            title: 'Gestión parcial y protección dinámica',
            content:
              'En lugar de cerrar toda la posición en un único take profit, muchos traders toman parte de la ganancia en el primer objetivo y mueven el stop loss al punto de entrada (breakeven) para el resto. Esto reduce la presión emocional de "devolver" ganancias abiertas y permite capturar movimientos extendidos sin arriesgar capital ya ganado.',
            keyPoints: [
              'Cerrar parcial en el primer objetivo reduce la presión emocional',
              'Mover el stop a breakeven protege el capital inicial',
              'La gestión dinámica busca capturar extensión sin devolver toda la ganancia',
            ],
          },
          {
            id: 'int-2-l2',
            title: 'Checklist post-trade y aprendizaje',
            content:
              'Después de cerrar una operación, registrar no solo el resultado en dinero sino el proceso: ¿se siguió el plan?, ¿la entrada tuvo confluencia real o fue impulsiva?, ¿la gestión del riesgo fue la planeada? Un trade ganador ejecutado sin proceso es tan preocupante como uno perdedor bien ejecutado, porque refuerza hábitos que no son sostenibles.',
            keyPoints: [
              'El resultado en dinero no mide la calidad de la decisión',
              'Registrar el proceso permite detectar patrones de comportamiento repetidos',
              'Un trade ganador sin proceso puede reforzar malos hábitos',
            ],
          },
          {
            id: 'int-2-l3',
            title: 'Métricas: win-rate, expectativa, drawdown',
            content:
              'El win-rate por sí solo no dice si una estrategia es rentable: importa combinado con el tamaño promedio de ganancias y pérdidas (expectativa matemática). El drawdown máximo —la mayor caída acumulada desde un pico de capital— mide cuánto "dolor" soporta la cuenta en su peor racha, y es clave para dimensionar el riesgo de forma sostenible.',
            keyPoints: [
              'Win-rate sin expectativa matemática no define si un sistema es rentable',
              'Expectativa = (win-rate × ganancia promedio) − (loss-rate × pérdida promedio)',
              'El drawdown máximo mide el peor escenario histórico de la cuenta',
            ],
          },
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
              prompt: '¿Qué métrica describe mejor la estabilidad de riesgo de una cuenta?',
              options: ['Drawdown máximo', 'Cantidad de entradas por día', 'El símbolo del activo operado'],
              correctIndex: 0,
              explanation: 'El drawdown máximo muestra la caída acumulada de capital desde su pico.',
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
    estimatedHours: 36,
    prerequisites: ['Ruta Intermedio completada'],
    blocks: [
      {
        id: 'adv-1',
        title: 'Playbooks y edge estadístico',
        objective: 'Formalizar setups repetibles con métricas de ventaja.',
        lessons: [
          {
            id: 'adv-1-l1',
            title: 'Definición de playbook y criterios de activación',
            content:
              'Un playbook documenta, por escrito y antes de operar, las condiciones exactas que activan un setup: estructura requerida, zona, filtro de timing y gestión de riesgo. Al formalizarlo, cada operación se puede clasificar y evaluar contra las demás del mismo tipo, en lugar de tratar cada trade como un evento aislado sin comparación posible.',
            keyPoints: [
              'Un playbook define reglas de entrada, gestión y salida por adelantado',
              'Formalizar el setup permite agrupar y comparar operaciones similares',
              'Sin un playbook escrito, no hay forma objetiva de medir el edge',
            ],
          },
          {
            id: 'adv-1-l2',
            title: 'Muestreo, varianza y significancia básica',
            content:
              'Diez operaciones ganadoras seguidas no prueban que un setup tenga edge: pueden deberse a varianza favorable de corto plazo. Evaluar un playbook requiere una muestra mínima (habitualmente 30+ operaciones) antes de sacar conclusiones, y entender que incluso un sistema rentable puede tener rachas perdedoras largas sin que eso invalide la ventaja estadística de fondo.',
            keyPoints: [
              'Una racha corta (ganadora o perdedora) no valida ni invalida un sistema',
              'Se recomienda una muestra de al menos 30 operaciones para evaluar un playbook',
              'La varianza de corto plazo es normal incluso en sistemas con edge real',
            ],
          },
          {
            id: 'adv-1-l3',
            title: 'Segmentación por régimen de mercado',
            content:
              'Un mismo playbook puede funcionar en un régimen de baja volatilidad (VIX bajo, tendencia ordenada) y fallar en uno de alta volatilidad o rotación sectorial abrupta. Segmentar los resultados por régimen —en vez de mezclarlos todos— revela en qué condiciones el setup realmente tiene ventaja y en cuáles debería pausarse.',
            keyPoints: [
              'El VIX y la amplitud de mercado ayudan a clasificar el régimen actual',
              'Mezclar resultados de regímenes distintos distorsiona la evaluación del edge',
              'Un setup puede pausarse en regímenes donde históricamente no funciona',
            ],
          },
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
          {
            id: 'adv-2-l1',
            title: 'Límites diarios/semanales de pérdida',
            content:
              'Los traders profesionales operan bajo límites explícitos: un porcentaje máximo de pérdida diaria y otro semanal que, al alcanzarse, detienen toda actividad hasta el siguiente período. Este límite se define antes de operar, nunca durante una racha perdedora, y su propósito es evitar que una mala sesión se convierta en un drawdown severo por intentar "recuperar" pérdidas.',
            keyPoints: [
              'Definir el límite de pérdida antes de operar, no durante una racha negativa',
              'Al tocar el límite diario/semanal, se detiene toda operativa nueva',
              'El objetivo es evitar que una mala sesión escale a un drawdown severo',
            ],
          },
          {
            id: 'adv-2-l2',
            title: 'Escalado de tamaño por desempeño',
            content:
              'Aumentar el tamaño de posición debe responder a reglas objetivas de desempeño —por ejemplo, escalar solo tras alcanzar cierto nivel de consistencia medido en el journal— y no al impulso después de una racha ganadora reciente. Escalar por impulso suele coincidir con el punto de mayor confianza y menor disciplina, justo antes de una reversión de racha.',
            keyPoints: [
              'El escalado debe basarse en métricas de consistencia, no en la racha más reciente',
              'Escalar por euforia tras ganancias recientes es un error común y costoso',
              'Las reglas de escalado se fijan antes, igual que las de reducción',
            ],
          },
          {
            id: 'adv-2-l3',
            title: 'Protocolos de pausa y recuperación',
            content:
              'Tras tocar un límite de pérdida o atravesar una racha negativa relevante, un protocolo profesional define una pausa obligatoria (por ejemplo, 24–48 horas sin operar) y una fase de reducción de tamaño al retomar, hasta recuperar consistencia demostrada. Esto separa la gestión del capital de la gestión emocional, evitando que una mala racha se resuelva con decisiones reactivas.',
            keyPoints: [
              'Una pausa obligatoria tras tocar el límite de pérdida previene decisiones reactivas',
              'Retomar con tamaño reducido permite reconstruir consistencia sin exponer capital',
              'El protocolo se cumple igual, sin importar cuán "segura" parezca la próxima entrada',
            ],
          },
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
