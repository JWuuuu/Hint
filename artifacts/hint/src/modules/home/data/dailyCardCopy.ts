import type { HintLanguage } from "../../../lib/i18n";

type Detail = { keyword: string; do: string; avoid: string; love: string; work: string; self: string };
type TranslatedLanguage = Exclude<HintLanguage, "en">;

// These fields follow the canonical English card guidance in dailyPulls.ts.
// Keep narrative copy separate: an action tip is not a card's whisper or theme.
export const DAILY_DETAILS: Partial<Record<HintLanguage, Record<string, Detail>>> = {};
function add(language: TranslatedLanguage, rows: string) {
  const map = DAILY_DETAILS[language] ??= {};
  for (const row of rows.trim().split("\n")) {
    const values = row.split("|");
    const [id, keyword, action, avoid, love, work, self] = values;
    if (values.length !== 7 || values.some(value => !value.trim()) || map[id]) {
      throw new Error(`Invalid daily translation ${language}:${id}`);
    }
    map[id] = { keyword, do: action, avoid, love, work, self };
  }
}

add("zh", `
0-fool|开始 · 信任 · 轻盈|迈出风险较低的第一步。|要求有完美计划才肯开始。|保持开放，不急着定义关系。|用一个小而看得见的行动试验想法。|让好奇心先带路，别急着让恐惧改写它。
1-magician|意志 · 技能 · 专注|用好手中已经有的东西。|等别人肯定你的能力。|把想说的说清楚，不必绕着暗示。|把分散的工具变成一个完成的行动。|留意自己哪些能力比承认的更强。
2-high-priestess|直觉 · 安静 · 内心所知|回答之前，给自己一个安静的停顿。|过度解释一种仍在形成的感受。|听听那些没有说出口的部分。|先观察现场的氛围，再推动计划。|相信身体反复传来的信号。
3-empress|成长 · 照顾 · 丰盛|滋养你希望成长的事物。|只因进展缓慢，就认定它失败。|用温暖相待，不必刻意表现。|整理工作空间，让自己更容易回来继续。|选择一种真正能让你恢复的安慰。
4-emperor|结构 · 边界 · 秩序|为今天定下一条清楚的规则。|因为别人的进度而给自己压力。|温和而直接地说出边界。|把下一步具体化，并安排时间。|稳定也可以是关怀，而非冷漠。
5-hierophant|指引 · 传统 · 信念|遵循一条规则之前，先问问它是否合适。|把过去的认可当成现在的真相。|留意哪些期待真正属于你。|寻求指引，再根据现实调整。|保留智慧，放下不加思考的服从。
6-lovers|选择 · 一致 · 连结|选择你愿意认同并承担的选项。|因害怕而试图保留所有可能。|让彼此契合比强烈的感受更重要。|选择与更大目标一致的优先事项。|确认你的选择是否尊重自己的价值观。
7-chariot|方向 · 动力 · 掌控|有意识地推动一件事向前。|让一点摩擦决定整天的走向。|让对话始终朝着修复的方向。|选定路线，踏实走出第一段。|你的精力需要方向，而非更多压力。
8-strength|勇气 · 耐心 · 真心|在习惯用力的地方，试着温柔一点。|把苛刻误认为自律。|放柔语气，同时不隐藏真实。|把困难的任务拆小，一次缓一口气。|耐心对待自己疲惫的那一部分。
9-hermit|独处 · 真实 · 反思|留出空间，听见自己的答案。|只因沉默让人不自在，就急着填满它。|给彼此空间，而非突然消失。|保护一段能深入专注的时间。|让安静成为一种信息。
10-wheel|周期 · 时机 · 变化|推动之前，先留意什么正在转变。|把一次情绪变化当成最终定论。|先让关系的互动自然呼吸，别急着永远定型。|顺应时机调整，而非与它对抗。|变化是一种信息，不是你失败的证明。
11-justice|真实 · 平衡 · 责任|作出公平的选择，即使只是一件小事。|为了省事而跳过诚实面对的部分。|坦白地说，也同样坦诚地听。|作决定之前，先核对细节。|承担责任可以让人清明，不必成为惩罚。
12-hanged-man|暂停 · 视角 · 放下|行动之前，先试一个不同的角度。|只为逃离不适而强迫事情推进。|让暂停显露出一味推动时看不见的事。|换个方式理解阻碍，而非一味攻击它。|当静止改变了你的视角，它也可以是一种行动。
13-death|结束 · 放下 · 改变|诚实地结束一件事。|拖延一个已经结束的阶段。|放下故事中不再合适的旧版本。|停止一种代价过高的方法。|温柔地放下旧的自我形象。
14-temperance|平衡 · 修复 · 耐心|调和两种需要，而非选择一个极端。|因为觉得落后而矫枉过正。|选择适度相处，而非激烈地试探。|安排能让任务真正完成的节奏。|今天，修复也许表现为稳定。
15-devil|模式 · 依附 · 诚实|说出那个习惯，不必羞辱自己。|把反复的循环当成自己的个性。|留意渴望与控制之间的拉扯。|为分散注意力的事设下界限。|觉察是走出循环的第一步。
16-tower|真实 · 冲击 · 清理|让不稳定的部分告诉你它需要什么。|试图挽救一个不断出现裂缝的结构。|诚实面对哪些事已不再让你感到安全或真实。|处理根本问题，不只收拾表面的混乱。|清楚地结束，可以为重建留出空间。
17-star|希望 · 更新 · 灵感|让一个带着希望的行动就已足够。|因为安慰看起来太小，就拒绝它。|尝试更温柔、更宽厚地理解对方。|带着更清晰的期待重新开始。|在过程证明自己之前，先给予它信任。
18-moon|不确定 · 梦 · 直觉|事实不清楚的地方，放慢脚步。|把焦虑变成预言。|请求澄清，而非指责。|分清你知道的事和你害怕的事。|让感受成为信号，而非判决。
19-sun|清晰 · 温暖 · 喜悦|选择那件简单而明亮的事。|把已经清楚的事变得复杂。|让你的欣赏清楚地被看见。|把轻松取得的小成果放在大家看得见的地方。|接受好事，不必缩小它的分量。
20-judgement|召唤 · 觉醒 · 回顾|回应心里那个渴望改变的部分。|因为一个模式很熟悉，就忽略它。|用一次真实的对话替代旧的相处台词。|回顾上一个循环教会你的事。|你可以成长到不再适合过去的角色。
21-world|完成 · 整合 · 抵达|继续前进之前，先为完成的事留下记号。|匆匆跳过一个已完成章节的意义。|肯定这段连结已经走了多远。|把这一轮完整而清楚地收尾。|让自己有片刻完整的感觉。
ace|新种子|从一个清楚的开端开始。|等到开端有了保证才行动。|打开门，不强迫关系。|记录想法并迈出第一步。|允许新的可能出现。
two|选择|诚实比较选项。|因两条路都有代价而停滞。|寻找彼此的平衡。|选择下一项优先任务，别分散注意力。|问问自己，身心真正能承受多少。
three|合作|接纳支持或反馈。|试图证明一切都能独自完成。|给共同努力留出空间。|借助伙伴、笔记或更清楚的计划来推进。|留意连结如何帮助你成长。
four|稳定|建立一个稳定的基础。|把静止当成失败。|保护关系中平静的部分。|先建立结构，再增加任务。|把休息视为工作的一部分。
five|摩擦|直接处理小冲突。|因不适让人着急而升级冲突。|先修复语气，再讨论事实。|说清障碍并缩小它。|不舒服时也可以保持稳定。
six|支持|坦然接受支持，或真诚地提供帮助。|善意已经足够时，仍不断计较得失。|回到简单的照顾。|使用曾经奏效的方法。|允许事情轻松一点。
seven|评估|增加投入前，先审视情况。|把延迟当成什么都没发生的证明。|看清模式，再选择回应。|决定哪里值得继续投入。|相信缓慢而认真的评估。
eight|练习|练习下一个有用的步骤。|每次觉得无聊就改变计划。|持续而稳定地出现。|专注地重复关键动作。|让进步逐步建立，而非等着发现它。
nine|韧性|保持投入，同时保护精力。|为所有可能的问题做准备。|守住让你保持善意的边界。|认真收尾，不耗尽自己。|珍惜自己已经承受过的一切。
ten|完成|完成循环，或减轻负担。|因习惯承担更多，就继续加码。|让关系超越旧模式，继续成长。|完成、归档、委托或放下。|你不必扛起全部。
page|好奇|提问、学习，或做一个小实验。|假装已经知道一切。|好奇地了解对方的世界。|把不确定变成一个问题。|今天允许自己当学生。
knight|动力|有目的地前进。|只为避免等待而向前冲。|带来活力，但不催促关系。|用清楚的下一步推进计划。|留意哪些紧迫感有用，哪些只是噪音。
queen|成熟|从踏实的自尊出发，引领行动。|付出到忘记自己。|关心别人，也不放弃自己。|平静地定下基调。|保护那个滋养着其他一切的自己。
king|领导力|作出负责任的选择。|用断言拒绝细微的差别。|让自己稳定到能够坦诚。|承担决定，以及支持它的结构。|让成熟安静而有用。
wands|火花|趁想法仍有热度时行动。|把精力花在纷争或证明自己上。|带来温暖与诚实，而非压力。|推进一项需要创造力或充沛精力的任务。|留意什么让你充满活力。
cups|感受|反应之前，先问问内心。|让一时情绪成为整个故事。|选择温柔与真诚倾听。|注意任务背后人的感受。|让情绪有安静的落脚处。
swords|清晰|用最简单的话说出真实。|想太多，直到每个选项都显得尖锐。|清楚表达，不把语言当武器。|作出决定，或确定下一个问题。|分清事实与恐惧。
pentacles|踏实|照顾一个现实生活的细节。|忽视身体或基本收支。|用可靠的行动表达关心。|让进展看得见、可衡量。|回到饮食、休息、金钱、空间或日程。
`);

add("es", `
0-fool|Inicio · Confianza · Ligereza|Da un primer paso de bajo riesgo.|Exigir un plan perfecto antes de empezar.|Mantente abierto sin apresurar las etiquetas.|Prueba la idea con algo pequeño y visible.|Deja que la curiosidad guíe antes de que el miedo la corrija.
1-magician|Voluntad · Habilidad · Enfoque|Usa lo que ya tienes en tus manos.|Esperar que otros validen tu capacidad.|Di las cosas claramente en vez de insinuarlas.|Convierte herramientas dispersas en una acción terminada.|Observa dónde eres más capaz de lo que admites.
2-high-priestess|Intuición · Silencio · Saber interior|Haz una pausa tranquila antes de responder.|Explicar demasiado un sentimiento que aún se está formando.|Escucha lo que no se está diciendo.|Lee el ambiente antes de impulsar el plan.|Confía en la señal que tu cuerpo sigue repitiendo.
3-empress|Crecimiento · Cuidado · Abundancia|Nutre aquello que quieres ver crecer.|Llamar fracaso a algo porque avanza despacio.|Acércate con calidez, sin intentar impresionar.|Haz que sea más fácil volver a tu espacio de trabajo.|Elige un consuelo que de verdad te renueve.
4-emperor|Estructura · Límites · Orden|Define una regla clara para tu día.|Cargarte de presión por los plazos de otra persona.|Expresa el límite con amabilidad y claridad.|Concreta el siguiente paso y ponle un horario.|La estabilidad puede cuidar, sin ser fría.
5-hierophant|Guía · Tradición · Creencia|Cuestiona una regla antes de seguirla.|Confundir la aprobación de antes con la verdad de hoy.|Observa qué expectativas son realmente tuyas.|Pide orientación y adáptala a la realidad.|Conserva la sabiduría y suelta la obediencia automática.
6-lovers|Elección · Coherencia · Vínculo|Elige una opción que puedas defender.|Mantener todas las puertas abiertas por miedo.|Da más valor a la sintonía que a la intensidad.|Elige la prioridad que encaje con el objetivo mayor.|Comprueba si tu elección respeta tus valores.
7-chariot|Dirección · Impulso · Control|Haz avanzar una cosa con intención.|Dejar que una fricción decida todo el día.|Orienta la conversación hacia la reparación.|Elige la ruta y comprométete con el primer tramo.|Tu energía necesita dirección, no más presión.
8-strength|Valentía · Paciencia · Corazón|Usa suavidad donde sueles usar la fuerza.|Confundir dureza con disciplina.|Suaviza el tono sin ocultar la verdad.|Aborda la tarea difícil poco a poco, respirando entre pasos.|Ten paciencia con la parte de ti que está cansada.
9-hermit|Soledad · Verdad · Reflexión|Haz espacio para escuchar tu propia respuesta.|Llenar el silencio solo porque incomoda.|Toma espacio sin desaparecer.|Protege un bloque de tiempo para concentrarte a fondo.|Deja que la calma te aporte información.
10-wheel|Ciclo · Momento · Cambio|Observa lo que está girando antes de empujar.|Tomar un cambio de ánimo como un veredicto final.|Deja respirar la dinámica antes de definirla para siempre.|Adáptate al momento en vez de luchar contra él.|El cambio es información, no prueba de que hayas fallado.
11-justice|Verdad · Equilibrio · Responsabilidad|Haz la elección justa, aunque sea pequeña.|Saltarte la parte honesta para que todo sea más fácil.|Habla con claridad y escucha con la misma honestidad.|Comprueba los detalles antes de decidir.|Asumir tu responsabilidad puede dar claridad, sin ser un castigo.
12-hanged-man|Pausa · Perspectiva · Soltar|Prueba otro ángulo antes de actuar.|Forzar el movimiento solo para escapar de la incomodidad.|Deja que una pausa revele lo que la presión no puede.|Replantea el obstáculo en vez de atacarlo.|La quietud puede ser activa si cambia tu perspectiva.
13-death|Final · Soltar · Cambio|Cierra una cosa con honestidad.|Prolongar lo que ya ha terminado.|Suelta la versión de la historia que ya no encaja.|Retira un método que está costando demasiado.|Deja ir con suavidad una imagen antigua de ti.
14-temperance|Equilibrio · Sanación · Paciencia|Combina dos necesidades en vez de elegir un extremo.|Corregir en exceso porque sientes que vas tarde.|Elige la moderación en vez de poner a prueba el vínculo con dramatismo.|Da a la tarea un ritmo que permita terminarla.|Hoy, sanar puede parecerse a mantener la estabilidad.
15-devil|Patrón · Apego · Honestidad|Nombra el hábito sin avergonzarte.|Confundir un ciclo repetido con tu personalidad.|Observa la tensión entre deseo y control.|Pon un límite a la distracción.|La conciencia es el primer paso para salir.
16-tower|Verdad · Sacudida · Despejar|Deja que la parte inestable te muestre qué necesita.|Intentar salvar una estructura que sigue agrietándose.|Sé honesto sobre lo que ya no se siente seguro o verdadero.|Resuelve la raíz del problema, no solo el desorden visible.|Un cierre claro puede abrir espacio para reconstruir.
17-star|Esperanza · Renovación · Inspiración|Deja que una acción esperanzada sea suficiente.|Rechazar el consuelo porque parece demasiado pequeño.|Busca una interpretación más amable y generosa.|Empieza de nuevo con una expectativa más clara.|Confía en el proceso antes de que demuestre su valor.
18-moon|Incertidumbre · Sueño · Intuición|Avanza despacio donde los hechos no estén claros.|Convertir la ansiedad en una predicción.|Pide claridad sin acusar.|Separa lo que sabes de lo que temes.|Deja que los sentimientos sean señales, no veredictos.
19-sun|Claridad · Calidez · Alegría|Elige lo sencillo y luminoso.|Complicar lo que ya está claro.|Haz visible tu aprecio.|Pon el logro sencillo donde todos puedan verlo.|Recibe lo bueno sin restarle valor.
20-judgement|Llamado · Despertar · Revisión|Responde a la parte de ti que pide un cambio.|Ignorar un patrón porque resulta familiar.|Deja que una conversación real sustituya el guion de siempre.|Revisa lo que te enseñó el ciclo anterior.|Puedes crecer más allá de un papel que has ocupado.
21-world|Finalización · Integración · Llegada|Reconoce lo terminado antes de seguir.|Pasar de largo por el significado de un capítulo completado.|Reconoce cuánto ha avanzado el vínculo.|Cierra el ciclo con claridad.|Permítete sentir plenitud por un momento.
ace|Semilla nueva|Empieza con un comienzo claro.|Esperar a que el comienzo tenga garantías.|Abre la puerta sin forzar el vínculo.|Anota la idea y da el primer paso.|Deja que lo nuevo parezca posible.
two|Elección|Compara las opciones honestamente.|Paralizarte porque ambos caminos tienen un coste.|Busca equilibrio mutuo.|Elige la siguiente prioridad en vez de dividir tu atención.|Pregúntate cuánto puede sostener realmente tu sistema nervioso.
three|Colaboración|Acepta apoyo o comentarios.|Intentar demostrar que puedes hacerlo todo a solas.|Haz espacio al esfuerzo compartido.|Construye con personas, notas o un plan más claro.|Observa dónde la conexión te ayuda a crecer.
four|Estabilidad|Crea una base estable.|Confundir quietud con fracaso.|Protege la calma del vínculo.|Define la estructura antes de añadir más.|Cuenta el descanso como parte del trabajo.
five|Fricción|Aborda directamente el pequeño conflicto.|Intensificar el conflicto porque la incomodidad te apremia.|Repara el tono antes de debatir los hechos.|Nombra el obstáculo y reduce su tamaño.|Puedes sentir incomodidad y seguir firme.
six|Apoyo|Acepta apoyo u ofrécelo con sinceridad.|Llevar cuentas cuando basta con la generosidad.|Vuelve a los cuidados sencillos.|Usa lo que funcionó antes.|Permite que algo sea fácil.
seven|Evaluación|Revisa la situación antes de esforzarte más.|Tomar una demora como prueba de que no pasa nada.|Observa el patrón antes de elegir tu respuesta.|Decide qué merece más inversión.|Confía en una evaluación pausada.
eight|Práctica|Practica el siguiente paso útil.|Cambiar de plan cada vez que resulte aburrido.|Mantén una presencia constante.|Repite con concentración.|Deja que el progreso se construya, no que haya que descubrirlo.
nine|Resiliencia|Cuida tu energía mientras sigues presente.|Prepararte para todos los problemas posibles.|Mantén el límite que te permite ser amable.|Termina con cuidado sin agotarte.|Honra lo que ya has sostenido.
ten|Finalización|Cierra el ciclo o aligera la carga.|Añadir más porque estás acostumbrado a cargar más.|Deja que la relación evolucione más allá del viejo patrón.|Termina, archiva, delega o suelta.|No necesitas cargar con todo.
page|Curiosidad|Pregunta, aprende o prueba el pequeño experimento.|Fingir que ya lo sabes todo.|Explora con curiosidad el mundo de la otra persona.|Convierte la incertidumbre en una pregunta.|Permítete aprender hoy.
knight|Impulso|Avanza con propósito.|Lanzarte hacia delante solo para evitar esperar.|Aporta energía sin apresurar el vínculo.|Avanza el plan con un siguiente paso claro.|Observa dónde la urgencia es útil y dónde es ruido.
queen|Madurez|Guía desde un respeto propio firme.|Dar tanto que te pierdas.|Ofrece cuidado sin abandonarte.|Marca el tono con calma.|Protege la parte de ti que nutre todo lo demás.
king|Liderazgo|Elige con responsabilidad.|Usar la certeza para cerrar la puerta a los matices.|Mantén la estabilidad suficiente para ser honesto.|Asume la decisión y la estructura que la rodea.|Haz que la madurez sea útil y serena.
wands|Chispa|Actúa sobre la idea mientras conserve su energía.|Gastar energía en dramas o en demostrar tu valor.|Aporta calidez y honestidad en vez de presión.|Avanza una tarea creativa o que requiera mucha energía.|Observa lo que te hace sentir despierto.
cups|Sentimiento|Consulta al corazón antes de reaccionar.|Convertir un estado de ánimo en toda la historia.|Elige ternura y escucha honesta.|Considera el tono humano que hay detrás de la tarea.|Da a tus sentimientos un lugar tranquilo donde descansar.
swords|Claridad|Di la verdad de la forma más sencilla.|Pensar demasiado hasta que todas las opciones parezcan afiladas.|Usa palabras claras sin convertirlas en armas.|Toma la decisión o define la siguiente pregunta.|Separa los hechos del miedo.
pentacles|Base|Cuida un detalle de la vida cotidiana.|Ignorar el cuerpo o las cuentas básicas.|Demuestra cuidado con algo fiable.|Haz el progreso visible y medible.|Vuelve a la comida, el descanso, el dinero, el espacio o los horarios.
`);

add("ja", `
0-fool|始まり・信頼・軽やかさ|小さなリスクで、最初の一歩を踏み出して。|始める前に完璧な計画を求めること。|関係に名前をつけることを急がず、心を開いて。|アイデアを、小さく目に見える形で試して。|恐れが口を挟む前に、好奇心に導かれて。
1-magician|意志・技能・集中|すでに手の中にあるものを使って。|自分の力を誰かに認めてもらうまで待つこと。|遠回しにほのめかさず、はっきり言葉にして。|散らばった道具を、一つの完了した行動につなげて。|認めている以上に力を発揮できているところに気づいて。
2-high-priestess|直感・静けさ・内なる知|答える前に、静かな間を自分にあげて。|まだ形になっていない気持ちを説明しすぎること。|言葉になっていないことに耳を澄ませて。|計画を進める前に、場の空気を読んで。|体が繰り返し伝えてくるサインを信じて。
3-empress|成長・いたわり・豊かさ|育てたいものに、栄養をあげて。|ゆっくりだからと、失敗と決めつけること。|見せ方よりも、温かさを大切にして。|戻ってきやすい仕事場に整えて。|本当に自分を回復させてくれる心地よさを、一つ選んで。
4-emperor|秩序・境界線・構造|今日のために、明確なルールを一つ決めて。|他の人の時間軸から、焦りを借りてくること。|境界線を、やさしく率直に伝えて。|次の一歩を具体的にして、予定に入れて。|安定は、冷たさではなくいたわりにもなります。
5-hierophant|導き・伝統・信念|一つのルールに従う前に、問い直して。|昔の承認を、今の真実と混同すること。|どの期待が自分自身のものなのか、気づいて。|助言を求めてから、現実に合わせて取り入れて。|知恵は残して、無条件に従う癖は手放して。
6-lovers|選択・一致・絆|自分で納得し、責任を持てる選択をして。|恐れから、すべての可能性を残そうとすること。|強いときめきより、価値観が合うことを大切にして。|大きな目標に合う優先事項を選んで。|その選択が、自分の価値観を尊重しているか確かめて。
7-chariot|方向・推進力・手綱|意図を持って、一つのことを前へ進めて。|一つのつまずきに、一日全体を決めさせること。|関係の修復へ向かう対話を続けて。|道を選び、最初の一歩から進むと決めて。|あなたのエネルギーに必要なのは、さらなる重圧ではなく方向です。
8-strength|勇気・忍耐・心|いつも力で押すところに、やさしさを使って。|厳しさを規律と取り違えること。|真実を隠さずに、言い方を柔らかくして。|難しい仕事は、小さく区切って一息ずつ進めて。|疲れている自分に、ゆっくり付き合って。
9-hermit|ひとりの時間・真実・内省|自分自身の答えが聞こえる余白を作って。|気まずいというだけで、沈黙を埋めること。|連絡を絶つのではなく、自分の時間を取って。|深く集中できる時間を、一枠守って。|静けさの中から、手がかりを受け取って。
10-wheel|巡り・時機・変化|押し進める前に、何が動き始めているか気づいて。|気分の変化を、最終的な結論と扱うこと。|関係を永久に決めつける前に、動く余地を与えて。|タイミングに逆らうより、合わせてみて。|変化は手がかりであって、失敗の証拠ではありません。
11-justice|真実・均衡・責任|小さなことでも、公平な選択をして。|楽に済ませるために、正直に向き合う部分を飛ばすこと。|率直に話し、同じようにまっすぐ聞いて。|決める前に、細部を確かめて。|責任を引き受けることは、罰ではなく心をすっきりさせることにもなります。
12-hanged-man|立ち止まる・視点・委ねる|行動する前に、別の角度を一つ試して。|居心地の悪さから逃れるためだけに、無理に動くこと。|押しても見えないものを、間を置くことで見つけて。|障害にぶつかるより、捉え方を変えて。|見方を変える静けさは、積極的な行動にもなります。
13-death|終わり・解放・変化|一つのことを、正直に終わらせて。|すでに終わったことを、引き延ばすこと。|もう今に合わない関係の物語を手放して。|負担が大きくなりすぎたやり方を終えて。|古い自己像を、やさしく手放して。
14-temperance|均衡・癒やし・忍耐|極端に振れる代わりに、二つの必要を組み合わせて。|遅れていると感じて、修正しすぎること。|劇的に試すより、穏やかな加減を選んで。|最後まで終えられるペースで進めて。|今日の癒やしは、安定した歩みに見えるかもしれません。
15-devil|パターン・執着・正直さ|自分を責めずに、習慣を言葉にして。|繰り返す癖を、自分の性格と決めつけること。|望む気持ちと、相手を動かしたい気持ちのせめぎ合いに気づいて。|気を散らすものに、限度を決めて。|気づくことが、抜け出す最初の道です。
16-tower|真実・揺らぎ・整理|不安定な部分が何を必要としているか、耳を傾けて。|ひびが入り続ける仕組みを、守ろうとすること。|もう安心できないことや、本当と思えないことに正直になって。|見えている混乱だけでなく、根本の問題に取り組んで。|はっきり区切ることで、立て直す余地が生まれます。
17-star|希望・再生・ひらめき|希望につながる行動は、一つで十分にして。|小さすぎると感じて、慰めを退けること。|よりやさしく、寛大な受け止め方を選んで。|余計な思い込みを減らして、もう一度始めて。|結果が証明される前から、その過程を信じて。
18-moon|不確かさ・夢・直感|事実が曖昧なところでは、ゆっくり進んで。|不安を、未来の予測に変えること。|責めずに、はっきりさせたいことを尋ねて。|知っていることと、恐れていることを分けて。|気持ちを、判決ではなくサインとして受け取って。
19-sun|明晰さ・温もり・喜び|シンプルで明るいものを選んで。|すでにはっきりしていることを、複雑にすること。|感謝が伝わるように、はっきり表して。|手にしやすい成果を、みんなに見える形にして。|良いことを小さく扱わず、そのまま受け取って。
20-judgement|呼びかけ・目覚め・見直し|変化を求めている自分の声に応えて。|慣れているからと、繰り返すパターンを見過ごすこと。|古い台本の代わりに、本当の対話をして。|前のサイクルから何を学んだか振り返って。|これまでの役割を卒業してもいいのです。
21-world|完成・統合・到達|次へ進む前に、終わったことに印をつけて。|終えた章の意味を、急いで通り過ぎること。|絆がここまで育ってきたことを認めて。|最後の仕上げまで、きれいに終えて。|少しの間、満ち足りた自分を感じて。
ace|新しい種|一つのまっさらな始まりから始めて。|始まりの成功が保証されるまで待つこと。|先を無理に進めず、まず扉を開いて。|アイデアを残して、最初の一歩を踏み出して。|新しいことも可能だと感じる余地をあげて。
two|選択|選択肢を正直に比べて。|どちらにも代償があるからと、決めずにいること。|お互いにとっての均衡を探して。|注意を分散させず、次の優先事項を選んで。|今の心身が実際に受け止められる量を確かめて。
three|協力|支えやフィードバックを受け入れて。|すべて一人でできると証明しようとすること。|一緒に取り組む余地を作って。|人の力、メモ、より明確な計画とともに形にして。|つながりが自分を広げてくれるところに気づいて。
four|安定|安心して収められる枠組みを一つ作って。|動かないことを失敗と混同すること。|関係の穏やかな部分を守って。|増やす前に、土台となる仕組みを整えて。|休息も仕事の一部に数えて。
five|摩擦|小さな対立に、直接向き合って。|不快感に急かされて、対立を大きくすること。|事実を議論する前に、話し方を整えて。|障害を言葉にして、小さく分けて。|落ち着かなさを感じていても、足元は保てます。
six|支え|支えを受け取るか、余計な条件をつけずに差し出して。|厚意だけで十分なときに、貸し借りを数えること。|シンプルないたわりに戻って。|以前うまくいった方法を使って。|楽であることを、自分に許して。
seven|見極め|力を足す前に、状況を見直して。|遅れを、何も起きていない証拠と扱うこと。|反応を選ぶ前に、パターンに気づいて。|さらに時間や力を注ぐ価値があるものを決めて。|時間をかけて見極めることを信じて。
eight|練習|次に役立つ一歩を練習して。|退屈になるたびに、計画を変えること。|変わらず関わり続けて。|集中して、繰り返し取り組んで。|進歩は見つけるものではなく、積み上げるものにして。
nine|しなやかさ|今ここにいながら、自分の力を守って。|起こりうる問題すべてに備えようとすること。|やさしさを保てる境界線を守って。|自分を消耗させず、丁寧に仕上げて。|すでに抱えてきたものを、きちんと認めて。
ten|完了|一つの区切りをつけるか、荷物を軽くして。|多く背負うことに慣れているからと、さらに増やすこと。|古いパターンを超えて、関係が育つのを許して。|終える、保管する、任せる、あるいは手放して。|山積みのすべてを、一人で背負わなくていいのです。
page|好奇心|尋ねる、学ぶ、小さく試すことをしてみて。|すべて知っているふりをすること。|相手の世界に好奇心を向けて。|不確かさを、質問に変えて。|今日は学ぶ側でいることを、自分に許して。
knight|勢い|目的を持って動いて。|待つのを避けるためだけに、突き進むこと。|絆を急がせず、活気を持ち込んで。|次の一手を明確にして、計画を進めて。|急ぐことが役立つところと、ただの雑音になるところに気づいて。
queen|成熟|地に足のついた自尊心から、周囲を導いて。|自分が消えてしまうほど、与えすぎること。|自分を置き去りにせず、いたわりを差し出して。|落ち着いて、場の調子を整えて。|他のすべてを育んでいる、自分の一部を守って。
king|統率|責任ある選択をして。|断言することで、細かな違いを封じること。|正直でいられるだけの安定を保って。|決定と、それを支える仕組みに責任を持って。|成熟を、静かで役立つものにして。
wands|火花|アイデアに熱があるうちに、行動して。|騒ぎや自己証明に、力を使い果たすこと。|重圧ではなく、温かさと正直さを持ち込んで。|創造力や活力を使う仕事を、一つ進めて。|何が自分を生き生きさせるか、気づいて。
cups|気持ち|反応する前に、自分の心に確かめて。|一時の気分を、物語のすべてにすること。|やさしさと、正直に耳を傾けることを選んで。|仕事の向こうにいる人の気持ちを考えて。|気持ちが穏やかに落ち着ける場所をあげて。
swords|明晰さ|本当のことを、いちばんシンプルに伝えて。|どの選択肢も痛く感じるまで考えすぎること。|明確な言葉を、武器にせず使って。|決断するか、次に確かめる問いを定めて。|事実と恐れを分けて。
pentacles|土台|現実の細かなことを一つ整えて。|体のことや、基本的な数字を無視すること。|確かな行動で、いたわりを示して。|進み具合を、目に見えて測れる形にして。|食事、休息、お金、空間、予定に立ち返って。
`);

add("ko", `
0-fool|시작 · 신뢰 · 가벼움|부담이 작은 첫걸음을 하나 내디뎌 보세요.|시작하기 전에 완벽한 계획을 요구하는 것.|관계에 이름을 붙이려고 서두르지 말고 마음을 열어두세요.|아이디어를 작고 눈에 보이는 방식으로 시험해 보세요.|두려움이 끼어들기 전에 호기심이 이끌게 해보세요.
1-magician|의지 · 기술 · 집중|이미 손안에 있는 것을 활용해 보세요.|누군가 능력을 인정해 줄 때까지 기다리는 것.|돌려서 암시하기보다 분명히 말해보세요.|흩어진 도구들을 하나의 완료된 행동으로 모아보세요.|스스로 인정하는 것보다 더 잘하고 있는 부분을 알아차려 보세요.
2-high-priestess|직관 · 고요 · 내면의 앎|대답하기 전에 조용히 멈출 시간을 주세요.|아직 형태를 갖추는 중인 감정을 지나치게 설명하는 것.|말로 드러나지 않는 것에도 귀 기울여 보세요.|계획을 진행하기 전에 분위기를 살펴보세요.|몸이 반복해서 보내는 신호를 믿어보세요.
3-empress|성장 · 돌봄 · 풍요|자라나길 바라는 것에 양분을 주세요.|느리다는 이유로 실패라고 부르는 것.|잘 보이려 하기보다 따뜻함으로 다가가 보세요.|다시 돌아오기 편한 작업 공간을 만들어 보세요.|실제로 회복을 돕는 편안함을 하나 골라보세요.
4-emperor|체계 · 경계 · 질서|오늘을 위한 분명한 규칙을 하나 세워보세요.|다른 사람의 속도에서 압박감을 빌려오는 것.|경계를 다정하고 직접적으로 말해보세요.|다음 단계를 구체적으로 정하고 일정에 넣어보세요.|안정은 차가움이 아니라 돌봄일 수도 있어요.
5-hierophant|안내 · 전통 · 믿음|규칙 하나를 따르기 전에 질문해 보세요.|과거의 인정을 지금의 진실과 혼동하는 것.|어떤 기대가 자신의 것인지 알아차려 보세요.|조언을 구한 뒤 현실에 맞게 조정해 보세요.|지혜는 남기고 자동적인 복종은 내려놓으세요.
6-lovers|선택 · 조화 · 유대|스스로 납득하고 지지할 수 있는 쪽을 선택해 보세요.|두려워서 모든 가능성을 열어두려는 것.|강렬함보다 서로의 가치가 맞는지를 중요하게 여겨보세요.|더 큰 목표와 맞는 우선순위를 골라보세요.|그 선택이 자신의 가치를 존중하는지 확인해 보세요.
7-chariot|방향 · 추진력 · 주도권|의도를 가지고 한 가지를 앞으로 움직여 보세요.|작은 마찰이 하루 전체를 결정하게 두는 것.|관계를 회복하는 방향으로 대화를 이어가 보세요.|길을 고르고 첫 구간부터 나아가기로 해보세요.|에너지에 필요한 것은 더 큰 압박이 아니라 방향이에요.
8-strength|용기 · 인내 · 마음|평소 힘으로 밀어붙이던 곳에 부드러움을 써보세요.|가혹함을 자기 관리와 혼동하는 것.|진실을 숨기지 않으면서 말투를 부드럽게 해보세요.|어려운 일은 작게 나누어 한숨씩 고르며 해보세요.|지친 자신에게 인내심을 가져보세요.
9-hermit|혼자만의 시간 · 진실 · 성찰|자신의 답을 들을 공간을 만들어 보세요.|어색하다는 이유만으로 침묵을 채우는 것.|연락을 끊고 사라지기보다 필요한 거리를 두세요.|깊이 집중할 시간을 한 구간 지켜보세요.|고요 속에서 단서를 얻어보세요.
10-wheel|주기 · 때 · 변화|밀어붙이기 전에 무엇이 바뀌는지 알아차려 보세요.|기분의 변화를 최종 판결처럼 여기는 것.|관계를 영원히 규정하기 전에 숨 쉴 여지를 주세요.|때와 싸우기보다 흐름에 맞춰보세요.|변화는 정보이지 실패의 증거가 아니에요.
11-justice|진실 · 균형 · 책임|작은 일이라도 공정한 선택을 해보세요.|편하게 넘어가려고 솔직해야 할 부분을 건너뛰는 것.|분명하게 말하고 그만큼 솔직하게 들어보세요.|결정하기 전에 세부 사항을 확인해 보세요.|책임을 받아들이는 일은 벌이 아니라 마음을 맑게 하는 일이 될 수 있어요.
12-hanged-man|멈춤 · 관점 · 내려놓음|행동하기 전에 다른 각도 하나를 시도해 보세요.|불편함에서 벗어나려고 억지로 움직이는 것.|밀어붙여도 보이지 않던 것을 잠시 멈추며 발견해 보세요.|장애물과 싸우기보다 바라보는 틀을 바꿔보세요.|관점을 바꿔주는 고요함은 적극적인 움직임일 수도 있어요.
13-death|끝맺음 · 놓아줌 · 변화|한 가지를 솔직하게 마무리해 보세요.|이미 끝난 것을 계속 끌고 가는 것.|더는 맞지 않는 관계의 이야기를 내려놓으세요.|비용과 부담이 너무 큰 방식을 끝내보세요.|오래된 자기 모습을 부드럽게 놓아주세요.
14-temperance|균형 · 치유 · 인내|극단을 고르기보다 두 가지 필요를 조화시켜 보세요.|뒤처졌다고 느껴 지나치게 바로잡으려는 것.|극적인 시험보다 절제된 태도를 선택해 보세요.|실제로 끝낼 수 있는 속도로 일을 진행해 보세요.|오늘의 치유는 꾸준함의 모습일 수 있어요.
15-devil|패턴 · 집착 · 솔직함|자신을 부끄럽게 만들지 말고 습관에 이름을 붙여보세요.|반복되는 패턴을 자신의 성격이라고 부르는 것.|바라는 마음과 통제하려는 마음 사이의 끌림을 살펴보세요.|주의를 빼앗는 것에 한계를 정해보세요.|알아차림이 벗어나는 첫걸음이에요.
16-tower|진실 · 흔들림 · 정리|불안정한 부분이 무엇을 필요로 하는지 들어보세요.|계속 금이 가는 구조를 지키려는 것.|더는 안전하거나 진실하게 느껴지지 않는 것에 솔직해져 보세요.|눈앞의 혼란뿐 아니라 근본 문제를 해결해 보세요.|분명한 단절은 다시 세울 공간을 만들 수 있어요.
17-star|희망 · 새로움 · 영감|희망을 담은 행동 하나면 충분하게 해보세요.|너무 작게 느껴진다고 위안을 거절하는 것.|더 부드럽고 너그러운 해석을 선택해 보세요.|불필요한 기대를 덜어내고 다시 시작해 보세요.|결과로 증명되기 전에도 그 과정을 믿어보세요.
18-moon|불확실함 · 꿈 · 직관|사실이 불분명한 곳에서는 천천히 움직여 보세요.|불안을 예측으로 바꾸는 것.|비난하지 않고 명확하게 알고 싶은 것을 물어보세요.|알고 있는 것과 두려워하는 것을 구분해 보세요.|감정을 판결이 아니라 신호로 받아들여 보세요.
19-sun|명료함 · 온기 · 기쁨|단순하고 밝은 것을 골라보세요.|이미 분명한 것을 복잡하게 만드는 것.|고마운 마음을 분명하게 표현해 보세요.|쉽게 얻을 수 있는 성과를 모두가 볼 수 있게 해보세요.|좋은 것을 축소하지 말고 그대로 받아들여 보세요.
20-judgement|부름 · 깨어남 · 돌아봄|변화를 바라는 자신의 목소리에 응답해 보세요.|익숙하다는 이유로 패턴을 외면하는 것.|오래된 대본 대신 진짜 대화를 나눠보세요.|지난 주기가 무엇을 가르쳐 주었는지 돌아보세요.|이전의 역할을 넘어 자라도 괜찮아요.
21-world|완성 · 통합 · 도달|다음으로 가기 전에 끝낸 것에 표시를 해보세요.|완료된 한 장의 의미를 서둘러 지나치는 것.|관계가 여기까지 자라온 것을 인정해 보세요.|마지막까지 깔끔하게 마무리해 보세요.|잠시 완성된 느낌을 누려보세요.
ace|새로운 씨앗|하나의 산뜻한 시작부터 해보세요.|시작의 성공이 보장될 때까지 기다리는 것.|앞을 억지로 밀어붙이지 말고 먼저 문을 열어보세요.|아이디어를 기록하고 첫 움직임을 만들어 보세요.|새로운 것도 가능하다고 느낄 여지를 주세요.
two|선택|선택지를 솔직하게 비교해 보세요.|두 길 모두 대가가 있다는 이유로 미루는 것.|서로에게 맞는 균형을 찾아보세요.|주의를 나누기보다 다음 우선순위를 고르세요.|지금 몸과 마음이 실제로 감당할 수 있는 만큼을 물어보세요.
three|협력|도움이나 의견을 받아들여 보세요.|모든 일을 혼자 할 수 있다고 증명하려는 것.|함께 노력할 자리를 만들어 보세요.|사람들, 메모, 더 명확한 계획과 함께 만들어 보세요.|연결이 자신을 넓혀주는 곳을 알아차려 보세요.
four|안정|안심하고 담아둘 틀을 하나 만들어 보세요.|고요함을 실패와 혼동하는 것.|관계의 평온한 부분을 지켜보세요.|더하기 전에 구조부터 세워보세요.|쉼도 일의 일부로 인정해 보세요.
five|마찰|작은 갈등을 직접 다뤄보세요.|불편함이 급하게 느껴져 일을 키우는 것.|사실을 논하기 전에 말투부터 바로잡아 보세요.|장애물을 이름 붙이고 작게 나눠보세요.|불편해도 중심을 지킬 수 있어요.
six|지원|도움을 받거나 불필요한 조건 없이 건네보세요.|너그러움으로 충분할 때 주고받은 것을 따지는 것.|단순한 돌봄으로 돌아가 보세요.|전에 효과가 있었던 방법을 써보세요.|편안해도 괜찮다고 허락해 주세요.
seven|살펴봄|노력을 더하기 전에 상황을 검토해 보세요.|지연을 아무 일도 일어나지 않는 증거로 여기는 것.|대응을 고르기 전에 패턴을 알아차려 보세요.|어디에 더 시간과 힘을 쓸 가치가 있는지 정해보세요.|천천히 살펴보는 과정을 믿어보세요.
eight|연습|다음에 도움이 될 단계를 연습해 보세요.|지루해질 때마다 계획을 바꾸는 것.|꾸준히 곁을 지켜보세요.|집중해서 반복해 보세요.|발전을 발견하려 하기보다 쌓아보세요.
nine|회복력|지금에 머물며 자신의 에너지를 지켜보세요.|가능한 모든 문제를 대비하려는 것.|다정함을 지켜주는 경계를 유지해 보세요.|자신을 소진하지 않으면서 신중하게 마무리해 보세요.|이미 감당해 온 것을 인정해 주세요.
ten|완료|마무리를 짓거나 짐을 가볍게 해보세요.|많이 짊어지는 데 익숙하다는 이유로 더 얹는 것.|관계가 오래된 패턴을 넘어 자라게 해보세요.|끝내고, 보관하고, 맡기거나 내려놓으세요.|쌓인 짐을 전부 짊어질 필요는 없어요.
page|호기심|묻고 배우거나 작은 실험을 해보세요.|이미 모든 것을 아는 척하는 것.|상대의 세계에 호기심을 가져보세요.|불확실함을 질문으로 바꿔보세요.|오늘은 배우는 사람이 되어도 괜찮아요.
knight|추진력|목적을 가지고 움직여 보세요.|기다림을 피하려고 무작정 돌진하는 것.|관계를 서두르지 않으면서 활기를 더해보세요.|다음 행동을 분명히 하며 계획을 진행해 보세요.|급한 마음이 도움이 되는 곳과 잡음이 되는 곳을 알아차려 보세요.
queen|성숙|단단한 자존감을 바탕으로 이끌어 보세요.|자신이 사라질 만큼 지나치게 베푸는 것.|자신을 버려두지 않으면서 돌봄을 건네보세요.|차분하게 분위기를 잡아보세요.|다른 모든 것을 돌보는 자신의 부분을 지켜주세요.
king|리더십|책임 있는 선택을 해보세요.|확신으로 미묘한 차이를 닫아버리는 것.|솔직해질 수 있을 만큼 안정감을 지켜보세요.|결정과 그것을 지탱하는 구조에 책임을 가져보세요.|성숙함이 조용하고 쓸모 있게 드러나게 해보세요.
wands|불꽃|아이디어에 열기가 남아 있을 때 행동해 보세요.|소란이나 자기 증명에 에너지를 소모하는 것.|압박 대신 온기와 솔직함을 전해보세요.|창의력이나 활력이 필요한 일 하나를 진행해 보세요.|무엇이 자신을 생기 있게 하는지 알아차려 보세요.
cups|감정|반응하기 전에 마음을 살펴보세요.|기분이 전체 이야기가 되게 두는 것.|다정함과 솔직한 경청을 선택해 보세요.|일 뒤에 있는 사람의 마음을 고려해 보세요.|감정이 차분히 내려앉을 자리를 주세요.
swords|명료함|진실을 가장 단순한 말로 전해보세요.|모든 선택지가 날카롭게 느껴질 때까지 생각하는 것.|명확한 말을 무기로 만들지 말고 사용해 보세요.|결정하거나 다음 질문을 정해보세요.|사실과 두려움을 구분해 보세요.
pentacles|기반|현실의 작은 일 하나를 챙겨보세요.|몸이나 기본적인 수치를 외면하는 것.|믿을 수 있는 행동으로 마음을 보여주세요.|진행 상황을 눈에 보이고 측정할 수 있게 해보세요.|식사, 휴식, 돈, 공간, 일정으로 돌아와 보세요.
`);


type DailyNarrative = {
  majorTheme: Record<string, string>;
  rankWhisper: Record<string, string>;
  suit: Record<string, { domain: string; whisper: string }>;
  minorTheme: string;
  minorWhisper: string;
};

export const DAILY_NARRATIVE: Record<TranslatedLanguage, DailyNarrative> = {
  "zh": {
    "majorTheme": {
      "0-fool": "大阿尔卡那：今天的牌带来一个较大的主题，但仍通过一个简单的选择落地。",
      "1-magician": "大阿尔卡那：今天有一个关于自主行动与意图的较大主题。",
      "2-high-priestess": "大阿尔卡那：今天的较大主题很细微、很私密，值得保护。",
      "3-empress": "大阿尔卡那：今天请认真对待成长，同时不强迫它。",
      "4-emperor": "大阿尔卡那：今天的较大主题，是建立能支持你的框架。",
      "5-hierophant": "大阿尔卡那：今天可能让一个模式、一种信念或一位引导者更清晰。",
      "6-lovers": "大阿尔卡那：今天的较大主题是彼此契合，不只是吸引。",
      "7-chariot": "大阿尔卡那：今天请主动掌舵，而非随波逐流。",
      "8-strength": "大阿尔卡那：今天的较大主题是安静的力量，而非支配。",
      "9-hermit": "大阿尔卡那：今天通过私密空间与反思，带来一个较大的主题。",
      "10-wheel": "大阿尔卡那：今天的较大主题与时机和周期有关。",
      "11-justice": "大阿尔卡那：今天可能带来一个关于真实与后果的较大主题。",
      "12-hanged-man": "大阿尔卡那：今天的较大主题，可能在等待中浮现。",
      "13-death": "大阿尔卡那：今天有一个关于放下与更新的较大主题。",
      "14-temperance": "大阿尔卡那：今天的较大主题是能够持续的平衡。",
      "15-devil": "大阿尔卡那：今天可能显露一个更大的模式，让你有机会松开它。",
      "16-tower": "大阿尔卡那：今天的较大主题可能来得突然，但它也腾出了空间。",
      "17-star": "大阿尔卡那：今天带来一个关于更新与信念的较大主题。",
      "18-moon": "大阿尔卡那：今天的较大主题，是如何走过不确定。",
      "19-sun": "大阿尔卡那：今天通过清晰与温暖，带来一个较大的主题。",
      "20-judgement": "大阿尔卡那：今天的较大主题，可能像一次唤醒。",
      "21-world": "大阿尔卡那：今天带来一个关于完成与完整的较大主题。"
    },
    "rankWhisper": {
      "ace": "新的开端很小，却真实存在。",
      "two": "两条路正在邀请你认真选择。",
      "three": "有些事在分享中成长得更好。",
      "four": "更稳定的基础，比更大的动作更重要。",
      "five": "只要不把紧张当成自己的身份，它就可以派上用场。",
      "six": "帮助、回忆或善意，可以推动今天向前。",
      "seven": "先停一下，选择策略，而非立即反应。",
      "eight": "重复的行动，比一次盛大的举动更能塑造结果。",
      "nine": "你比感觉中更接近目标，但节奏仍然重要。",
      "ten": "一个循环已经完整；现在，简化下一步要带走的负担。",
      "page": "初学者的心态，可能带来你需要的信息。",
      "knight": "行动有帮助，但方向同样重要。",
      "queen": "当你的力量得到照顾，它会更加稳定。",
      "king": "今天需要沉着的引领，而非控制。"
    },
    "suit": {
      "wands": {
        "domain": "精力、创造力与行动",
        "whisper": "让精力流动，同时给它一个清楚的方向。"
      },
      "cups": {
        "domain": "感受、关系与直觉",
        "whisper": "解释之前，先让真实的感受简单地存在。"
      },
      "swords": {
        "domain": "思想、语言与决定",
        "whisper": "今天，一个更清晰的想法可以穿过噪音。"
      },
      "pentacles": {
        "domain": "身体、工作、金钱与日常习惯",
        "whisper": "把事情变得实际，今天就会更容易一些。"
      }
    },
    "minorTheme": "小阿尔卡那：这是一张关于日常生活的牌，可把它看作有关{domain}的实际指引。",
    "minorWhisper": "{rankWhisper} 在{domain}方面，{suitWhisper}"
  },
  "es": {
    "majorTheme": {
      "0-fool": "Arcano mayor: la carta de hoy trae un mensaje más amplio, que se concreta en una elección sencilla.",
      "1-magician": "Arcano mayor: hoy hay un mensaje más amplio sobre tu capacidad de actuar y tu intención.",
      "2-high-priestess": "Arcano mayor: el mensaje más amplio de hoy es sutil, privado y merece protección.",
      "3-empress": "Arcano mayor: hoy se te invita a tomar en serio el crecimiento sin forzarlo.",
      "4-emperor": "Arcano mayor: el mensaje más amplio de hoy trata de construir una estructura que te sostenga.",
      "5-hierophant": "Arcano mayor: hoy puede destacar un patrón, una creencia o alguien que te enseñe.",
      "6-lovers": "Arcano mayor: el mensaje más amplio de hoy trata de la sintonía, no solo de la atracción.",
      "7-chariot": "Arcano mayor: hoy se te invita a llevar el timón en vez de ir a la deriva.",
      "8-strength": "Arcano mayor: el mensaje más amplio de hoy es la fuerza serena, no el dominio.",
      "9-hermit": "Arcano mayor: hoy llega un mensaje más amplio a través de la privacidad y la reflexión.",
      "10-wheel": "Arcano mayor: el mensaje más amplio de hoy trata del momento y los ciclos.",
      "11-justice": "Arcano mayor: hoy puede llegar un mensaje más amplio sobre la verdad y las consecuencias.",
      "12-hanged-man": "Arcano mayor: el mensaje más amplio de hoy puede llegar a través de la espera.",
      "13-death": "Arcano mayor: hoy hay un mensaje más amplio sobre soltar y renovarse.",
      "14-temperance": "Arcano mayor: el mensaje más amplio de hoy es un equilibrio que perdura.",
      "15-devil": "Arcano mayor: hoy puede mostrarse un patrón más amplio para que puedas aflojar su fuerza.",
      "16-tower": "Arcano mayor: el mensaje más amplio de hoy puede sentirse repentino, pero despeja espacio.",
      "17-star": "Arcano mayor: hoy llega un mensaje más amplio de renovación y fe.",
      "18-moon": "Arcano mayor: el mensaje más amplio de hoy trata de orientarse en la incertidumbre.",
      "19-sun": "Arcano mayor: hoy llega un mensaje más amplio a través de la claridad y la calidez.",
      "20-judgement": "Arcano mayor: el mensaje más amplio de hoy puede sentirse como una llamada a despertar.",
      "21-world": "Arcano mayor: hoy llega un mensaje más amplio sobre completar y sentir plenitud."
    },
    "rankWhisper": {
      "ace": "Una nueva apertura es pequeña, pero real.",
      "two": "Dos caminos te piden que elijas con cuidado.",
      "three": "Hay cosas que crecen mejor cuando se comparten.",
      "four": "Una base más firme importa más que un movimiento mayor.",
      "five": "La tensión es útil si no la conviertes en tu identidad.",
      "six": "La ayuda, un recuerdo o la amabilidad pueden hacer avanzar el día.",
      "seven": "Haz una pausa y elige tu estrategia en vez de reaccionar.",
      "eight": "La repetición moldea el resultado más que un gran gesto.",
      "nine": "Estás más cerca de lo que sientes, pero el ritmo sigue importando.",
      "ten": "Un ciclo está completo; ahora simplifica lo que llevarás después.",
      "page": "La energía de principiante puede traer el mensaje que necesitas.",
      "knight": "Moverse ayuda, pero la dirección importa.",
      "queen": "Tu fuerza es más estable cuando recibe cuidado.",
      "king": "Hoy se pide una dirección serena, no control."
    },
    "suit": {
      "wands": {
        "domain": "la energía, la creatividad y la acción",
        "whisper": "Deja que tu energía se mueva, pero dale una dirección clara."
      },
      "cups": {
        "domain": "los sentimientos, las relaciones y la intuición",
        "whisper": "Deja que la verdad emocional sea sencilla antes de explicarla."
      },
      "swords": {
        "domain": "los pensamientos, las palabras y las decisiones",
        "whisper": "Un pensamiento más claro puede atravesar el ruido hoy."
      },
      "pentacles": {
        "domain": "el cuerpo, el trabajo, el dinero y las rutinas",
        "whisper": "El día se vuelve más fácil cuando lo haces práctico."
      }
    },
    "minorTheme": "Arcano menor: esta es una carta de la vida cotidiana; léela como una guía práctica sobre {domain}.",
    "minorWhisper": "{rankWhisper} En {domain}: {suitWhisper}"
  },
  "ja": {
    "majorTheme": {
      "0-fool": "大アルカナ：今日のカードには大きなメッセージがありますが、それは一つのシンプルな選択を通して届きます。",
      "1-magician": "大アルカナ：今日には、自ら動く力と意図についての大きなメッセージがあります。",
      "2-high-priestess": "大アルカナ：今日の大きなメッセージは、かすかで個人的なもの。大切に守る価値があります。",
      "3-empress": "大アルカナ：今日は、無理に進めずに成長を大切にするよう促しています。",
      "4-emperor": "大アルカナ：今日の大きなメッセージは、自分を支える枠組みを作ることです。",
      "5-hierophant": "大アルカナ：今日は、あるパターン、信念、あるいは導いてくれる人に光が当たるかもしれません。",
      "6-lovers": "大アルカナ：今日の大きなメッセージは、惹かれる気持ちだけでなく、価値観が一致することです。",
      "7-chariot": "大アルカナ：今日は、流される代わりに自分で舵を取るよう促しています。",
      "8-strength": "大アルカナ：今日の大きなメッセージは、支配ではなく静かな強さです。",
      "9-hermit": "大アルカナ：今日は、一人の時間と内省を通じて、大きなメッセージが届きます。",
      "10-wheel": "大アルカナ：今日の大きなメッセージは、時機と巡りについてです。",
      "11-justice": "大アルカナ：今日は、真実とその結果について、大きなメッセージが届くかもしれません。",
      "12-hanged-man": "大アルカナ：今日の大きなメッセージは、待つことを通して届くかもしれません。",
      "13-death": "大アルカナ：今日には、手放すことと新たに始まることについて、大きなメッセージがあります。",
      "14-temperance": "大アルカナ：今日の大きなメッセージは、長く続く均衡です。",
      "15-devil": "大アルカナ：今日は、より大きなパターンが見えるかもしれません。その結びつきを緩めるために。",
      "16-tower": "大アルカナ：今日の大きなメッセージは突然に感じられても、新しい余地を作ります。",
      "17-star": "大アルカナ：今日は、再生と信じる気持ちについて、大きなメッセージが届きます。",
      "18-moon": "大アルカナ：今日の大きなメッセージは、不確かさの中を進むことです。",
      "19-sun": "大アルカナ：今日は、明晰さと温もりを通じて、大きなメッセージが届きます。",
      "20-judgement": "大アルカナ：今日の大きなメッセージは、目を覚ます呼びかけのように感じられるかもしれません。",
      "21-world": "大アルカナ：今日は、完成と全体として満ちることについて、大きなメッセージが届きます。"
    },
    "rankWhisper": {
      "ace": "新しい入り口は小さくても、確かにそこにあります。",
      "two": "二つの道が、丁寧に選ぶことを求めています。",
      "three": "分かち合うことで、よりよく育つものがあります。",
      "four": "大きく動くことより、安定した土台が大切です。",
      "five": "緊張を自分そのものとしなければ、役立つものになります。",
      "six": "助け、記憶、やさしさが、一日を前へ進めてくれます。",
      "seven": "すぐ反応する代わりに、立ち止まって進め方を選んで。",
      "eight": "一度の大きな行動より、繰り返しが結果を形作っています。",
      "nine": "感じているよりゴールは近くにあります。それでもペースは大切です。",
      "ten": "一つの巡りが満ちました。次へ持っていくものを、シンプルにして。",
      "page": "初心者のような気持ちが、必要なメッセージを届けることもあります。",
      "knight": "動くことは助けになりますが、方向も大切です。",
      "queen": "自分の力をいたわると、その力はより安定します。",
      "king": "今日求められるのは、支配ではなく落ち着いた統率です。"
    },
    "suit": {
      "wands": {
        "domain": "エネルギー、創造性、行動",
        "whisper": "エネルギーを動かしながら、明確な方向を与えて。"
      },
      "cups": {
        "domain": "感情、人との関係、直感",
        "whisper": "説明する前に、感情の真実をシンプルに受け止めて。"
      },
      "swords": {
        "domain": "思考、言葉、決断",
        "whisper": "今日は、より明確な考えが雑音を切り開いてくれます。"
      },
      "pentacles": {
        "domain": "体、仕事、お金、日々の習慣",
        "whisper": "現実に役立つ形にすると、今日が少し楽になります。"
      }
    },
    "minorTheme": "小アルカナ：日常生活のカードです。{domain}についての実践的なヒントとして受け取ってください。",
    "minorWhisper": "{rankWhisper} {domain}では、{suitWhisper}"
  },
  "ko": {
    "majorTheme": {
      "0-fool": "메이저 아르카나: 오늘의 카드는 더 큰 메시지를 담지만, 하나의 단순한 선택을 통해 일상에 닿아요.",
      "1-magician": "메이저 아르카나: 오늘은 스스로 움직이는 힘과 의도에 관한 더 큰 메시지가 있어요.",
      "2-high-priestess": "메이저 아르카나: 오늘의 더 큰 메시지는 미묘하고 개인적이며 소중히 지킬 가치가 있어요.",
      "3-empress": "메이저 아르카나: 오늘은 성장을 억지로 밀지 않으면서 진지하게 돌보라고 해요.",
      "4-emperor": "메이저 아르카나: 오늘의 더 큰 메시지는 자신을 지탱할 틀을 만드는 것이에요.",
      "5-hierophant": "메이저 아르카나: 오늘은 어떤 패턴이나 믿음, 또는 가르침을 주는 사람이 두드러질 수 있어요.",
      "6-lovers": "메이저 아르카나: 오늘의 더 큰 메시지는 단순한 끌림을 넘어 가치가 서로 맞는 것에 관한 것이에요.",
      "7-chariot": "메이저 아르카나: 오늘은 떠밀리기보다 직접 방향을 잡으라고 해요.",
      "8-strength": "메이저 아르카나: 오늘의 더 큰 메시지는 지배가 아니라 조용한 힘이에요.",
      "9-hermit": "메이저 아르카나: 오늘은 혼자만의 시간과 성찰을 통해 더 큰 메시지가 전해져요.",
      "10-wheel": "메이저 아르카나: 오늘의 더 큰 메시지는 때와 주기에 관한 것이에요.",
      "11-justice": "메이저 아르카나: 오늘은 진실과 그 결과에 관한 더 큰 메시지가 올 수 있어요.",
      "12-hanged-man": "메이저 아르카나: 오늘의 더 큰 메시지는 기다림을 통해 올 수 있어요.",
      "13-death": "메이저 아르카나: 오늘은 놓아줌과 새로 시작함에 관한 더 큰 메시지가 있어요.",
      "14-temperance": "메이저 아르카나: 오늘의 더 큰 메시지는 오래 지속되는 균형이에요.",
      "15-devil": "메이저 아르카나: 오늘은 더 큰 패턴을 보여주어 그 매듭을 느슨하게 할 수 있게 해줘요.",
      "16-tower": "메이저 아르카나: 오늘의 더 큰 메시지가 갑작스럽게 느껴져도 새로운 공간을 만들어줘요.",
      "17-star": "메이저 아르카나: 오늘은 새로움과 믿음에 관한 더 큰 메시지가 전해져요.",
      "18-moon": "메이저 아르카나: 오늘의 더 큰 메시지는 불확실함 속에서 나아가는 것이에요.",
      "19-sun": "메이저 아르카나: 오늘은 명료함과 온기를 통해 더 큰 메시지가 전해져요.",
      "20-judgement": "메이저 아르카나: 오늘의 더 큰 메시지는 잠을 깨우는 부름처럼 느껴질 수 있어요.",
      "21-world": "메이저 아르카나: 오늘은 완성과 온전함에 관한 더 큰 메시지가 전해져요."
    },
    "rankWhisper": {
      "ace": "새로운 시작은 작지만 분명히 존재해요.",
      "two": "두 갈래 길이 신중하게 골라달라고 해요.",
      "three": "나눌 때 더 잘 자라는 것이 있어요.",
      "four": "더 크게 움직이는 것보다 든든한 기반이 중요해요.",
      "five": "긴장을 자신의 정체성으로 삼지 않으면 유용하게 쓸 수 있어요.",
      "six": "도움, 기억, 다정함이 하루를 앞으로 움직일 수 있어요.",
      "seven": "즉각 반응하기보다 잠시 멈추고 전략을 골라보세요.",
      "eight": "한 번의 큰 행동보다 반복이 결과를 만들고 있어요.",
      "nine": "느끼는 것보다 가까이 와 있지만, 속도 조절은 여전히 중요해요.",
      "ten": "한 주기가 가득 찼어요. 이제 다음에 가져갈 짐을 단순하게 해보세요.",
      "page": "처음 배우는 마음이 필요한 메시지를 가져올 수 있어요.",
      "knight": "움직임은 도움이 되지만 방향도 중요해요.",
      "queen": "자신의 힘을 돌볼 때 그 힘은 더 안정돼요.",
      "king": "오늘은 통제가 아니라 차분한 이끌음을 요구해요."
    },
    "suit": {
      "wands": {
        "domain": "에너지, 창의성, 행동",
        "whisper": "에너지가 움직이게 하되 분명한 방향을 주세요."
      },
      "cups": {
        "domain": "감정, 관계, 직관",
        "whisper": "설명하기 전에 감정의 진실을 단순하게 받아들여 보세요."
      },
      "swords": {
        "domain": "생각, 말, 결정",
        "whisper": "오늘은 더 맑은 생각이 잡음을 가를 수 있어요."
      },
      "pentacles": {
        "domain": "몸, 일, 돈, 일상의 습관",
        "whisper": "실용적으로 접근하면 오늘이 조금 더 편해져요."
      }
    },
    "minorTheme": "마이너 아르카나: 일상생활의 카드이므로 {domain}에 관한 실용적인 안내로 읽어보세요.",
    "minorWhisper": "{rankWhisper} {domain}에서는 {suitWhisper}"
  }
};


export const MINOR_NAMES = {
  zh: { suits: ["权杖", "圣杯", "宝剑", "星币"], ranks: ["王牌", "二", "三", "四", "五", "六", "七", "八", "九", "十", "侍从", "骑士", "王后", "国王"] },
  es: { suits: ["Bastos", "Copas", "Espadas", "Oros"], ranks: ["As", "Dos", "Tres", "Cuatro", "Cinco", "Seis", "Siete", "Ocho", "Nueve", "Diez", "Sota", "Caballero", "Reina", "Rey"] },
  ja: { suits: ["ワンド", "カップ", "ソード", "ペンタクル"], ranks: ["エース", "2", "3", "4", "5", "6", "7", "8", "9", "10", "ペイジ", "ナイト", "クイーン", "キング"] },
  ko: { suits: ["완드", "컵", "소드", "펜타클"], ranks: ["에이스", "2", "3", "4", "5", "6", "7", "8", "9", "10", "페이지", "나이트", "퀸", "킹"] },
};
