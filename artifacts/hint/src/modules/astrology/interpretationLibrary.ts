import type { HintLanguage } from "@/lib/i18n";
import type { PlanetPlacement } from "@/types/astrology";
import { astroText, type AstroCopy } from "./astrologyCopy";
import {
  bodyDescription,
  bodyName,
  signArticle,
  signName,
  houseDescription,
  aspectDescription,
  SIGN_ORDER,
} from "./astrologyLibrary";

// Authored, versioned building blocks. A planet's function, its expression and
// its life area remain separate evidence, rather than a generic sun-sign result.
export const INTERPRETATION_VERSION = "pearl-letter-1";
const functions: Record<string, AstroCopy> = {
  sun: [
    "identity and a sense of purpose",
    "自我认同与方向感",
    "identidad y propósito",
    "自分らしさと目的",
    "정체성과 목적",
  ],
  moon: [
    "emotional safety and familiar rhythms",
    "情绪安全与熟悉的节奏",
    "seguridad emocional y ritmos familiares",
    "心の安心と慣れ親しんだリズム",
    "정서적 안정과 익숙한 리듬",
  ],
  rising: [
    "first responses and the way you approach new situations",
    "第一反应与面对新情境的方式",
    "primeras respuestas y forma de abordar lo nuevo",
    "最初の反応と新しい状況への向き合い方",
    "첫 반응과 새로운 상황을 대하는 방식",
  ],
  mercury: [
    "attention, learning and the exchange of ideas",
    "注意力、学习与想法交流",
    "atención, aprendizaje e intercambio de ideas",
    "注意、学び、考えのやり取り",
    "집중, 배움과 생각의 교환",
  ],
  venus: [
    "affection, pleasure and what you value",
    "爱意、愉悦与重视的事物",
    "afecto, disfrute y valores",
    "愛情、喜び、大切にするもの",
    "애정, 즐거움과 소중한 가치",
  ],
  mars: [
    "initiative, desire and the way you assert a boundary",
    "主动性、渴望与表达界线的方式",
    "iniciativa, deseo y forma de marcar límites",
    "行動力、意欲、境界の伝え方",
    "주도성, 욕구와 경계를 표현하는 방식",
  ],
  jupiter: [
    "possibility, learning through experience and belief",
    "可能性、经验中的学习与信念",
    "posibilidades, experiencia y creencias",
    "可能性、経験からの学び、信念",
    "가능성, 경험을 통한 배움과 믿음",
  ],
  saturn: [
    "responsibility, limits and trust built over time",
    "责任、限制与日积月累的信任",
    "responsabilidad, límites y confianza construida",
    "責任、限界、時間をかけて育つ信頼",
    "책임, 한계와 시간을 들여 쌓는 신뢰",
  ],
  uranus: [
    "independence and the need to question familiar rules",
    "独立性与重新审视既有规则的需要",
    "independencia y revisión de reglas conocidas",
    "自立と慣れたルールを問い直すこと",
    "독립성과 익숙한 규칙을 돌아보는 필요",
  ],
  neptune: [
    "imagination, sensitivity and the search for meaning",
    "想象力、敏感度与意义探索",
    "imaginación, sensibilidad y búsqueda de sentido",
    "想像力、感受性、意味を探すこと",
    "상상력, 감수성과 의미 찾기",
  ],
  pluto: [
    "depth, power and processes of lasting change",
    "深度、力量与持久的改变",
    "profundidad, poder y cambio duradero",
    "深さ、力、長く続く変化",
    "깊이, 힘과 지속적인 변화",
  ],
};
const expressions: AstroCopy[] = [
  [
    "directness, initiative and a willingness to begin before everything is certain",
    "直接、主动，以及在尚未完全确定时开始的勇气",
    "franqueza, iniciativa y disposición a empezar sin tener todas las certezas",
    "率直さ、主体性、すべてが確かでなくても始める姿勢",
    "솔직함, 주도성, 확실하지 않아도 시작하는 용기",
  ],
  [
    "steadiness, sensory experience and trust in what can be sustained",
    "稳定、感官体验与可以持续的信任",
    "constancia, experiencia sensorial y confianza en lo sostenible",
    "安定、感覚的な経験、続けられるものへの信頼",
    "꾸준함, 감각적 경험과 지속할 수 있는 것에 대한 신뢰",
  ],
  [
    "curiosity, multiple perspectives and the freedom to ask another question",
    "好奇、多种视角与继续提问的自由",
    "curiosidad, perspectivas diversas y libertad para seguir preguntando",
    "好奇心、多様な視点、さらに問いかける自由",
    "호기심, 다양한 관점과 계속 질문할 자유",
  ],
  [
    "care, memory and sensitivity to the atmosphere around you",
    "关怀、记忆与对周围气氛的敏感",
    "cuidado, memoria y sensibilidad al entorno",
    "ケア、記憶、周囲の空気への感受性",
    "돌봄, 기억과 주변 분위기에 대한 감수성",
  ],
  [
    "warmth, creative expression and the courage to let something personal be seen",
    "温暖、创造性表达与展现真实自我的勇气",
    "calidez, creatividad y valor para mostrar algo propio",
    "温かさ、創造的な表現、自分の大切なものを見せる勇気",
    "따뜻함, 창의적 표현과 나다운 것을 보여 줄 용기",
  ],
  [
    "discernment, useful details and improvement through small repetitions",
    "辨别力、实用细节与反复练习中的改善",
    "discernimiento, detalles útiles y mejora mediante pequeños hábitos",
    "見極め、役立つ細部、小さな繰り返しによる改善",
    "분별력, 유용한 세부와 작은 반복을 통한 개선",
  ],
  [
    "reciprocity, perspective and an awareness of both sides of an exchange",
    "互惠、换位思考与对交流双方的关注",
    "reciprocidad, perspectiva y atención a ambas partes",
    "相互性、視点の切り替え、双方への配慮",
    "상호성, 관점 전환과 양쪽을 살피는 배려",
  ],
  [
    "depth, privacy and a preference for what feels emotionally honest",
    "深度、隐私与对情感诚实的重视",
    "profundidad, intimidad y honestidad emocional",
    "深さ、プライバシー、感情に誠実であること",
    "깊이, 사생활과 정서적 진실함",
  ],
  [
    "exploration, broad perspective and the wish to understand a larger story",
    "探索、宽广视角与理解更大图景的愿望",
    "exploración, amplitud de miras y búsqueda de un sentido mayor",
    "探求、広い視野、大きな物語を理解する願い",
    "탐색, 넓은 관점과 더 큰 이야기를 이해하려는 마음",
  ],
  [
    "commitment, structure and confidence earned through practice",
    "承诺、结构与通过实践积累的信心",
    "compromiso, estructura y confianza adquirida con la práctica",
    "取り組み続けること、仕組み、実践で育つ自信",
    "헌신, 구조와 실천으로 얻는 자신감",
  ],
  [
    "independence, experimentation and a concern for the wider group",
    "独立、尝试与对更大群体的关注",
    "independencia, experimentación e interés por el grupo",
    "自立、実験、より広い集団への関心",
    "독립, 실험과 더 넓은 공동체에 대한 관심",
  ],
  [
    "imagination, empathy and attention to meanings that are hard to put into words",
    "想象、共情与对难以言说的意义的感知",
    "imaginación, empatía y atención a lo difícil de expresar",
    "想像力、共感、言葉にしにくい意味への注意",
    "상상력, 공감과 말로 표현하기 어려운 의미에 대한 주의",
  ],
];
const practices: Record<string, AstroCopy> = {
  sun: [
    "Choose one commitment because it matters to you, then notice whether it gives you energy or only earns approval.",
    "选一件你真正重视的事，观察它带来的是活力，还是只为了获得认可。",
    "Elige un compromiso que te importe y observa si te da energía o solo aprobación.",
    "自分に大切な約束を一つ選び、活力になるのか、承認だけを求めているのか確かめてみて。",
    "내게 중요한 약속을 하나 고르고, 활력을 주는지 인정만을 얻으려는지 살펴봐요.",
  ],
  moon: [
    "Name the feeling before solving the situation. Notice which small, repeatable forms of care help you settle.",
    "先说出感受，再处理情境。观察哪些可以重复的小照顾让你安定。",
    "Nombra la emoción antes de resolver la situación. Observa qué cuidados pequeños te ayudan a calmarte.",
    "状況を解決する前に気持ちを言葉に。繰り返せる小さなケアで何が落ち着くか確かめて。",
    "상황을 해결하기 전에 감정에 이름을 붙여요. 어떤 작은 돌봄이 편안함을 주는지 살펴봐요.",
  ],
  rising: [
    "Notice your first response in a new room. Give yourself a second response too; an introduction need not define the whole person.",
    "留意进入新环境时的第一反应，也允许自己有第二种回应。初见不能定义完整的你。",
    "Observa tu primera respuesta en un lugar nuevo y permite una segunda. Una presentación no define a toda la persona.",
    "新しい場での最初の反応を観察し、別の反応も許してみて。第一印象がすべてではありません。",
    "새로운 곳에서 첫 반응을 살피고 다른 반응도 허용해요. 첫인상이 나의 전부는 아니에요.",
  ],
  mercury: [
    "Before replying, separate what you heard from what you inferred. Ask for an example when the meaning remains unclear.",
    "回复前，把听到的事实与自己的推测分开。不确定意思时，请对方举例。",
    "Antes de responder, separa lo escuchado de lo inferido. Pide un ejemplo si el sentido no está claro.",
    "返事の前に、聞いたことと推測を分けてみて。意味が曖昧なら例を尋ねましょう。",
    "답하기 전에 들은 내용과 추측을 구분해요. 뜻이 모호하면 예를 요청해 봐요.",
  ],
  venus: [
    "Ask how you like to give care and how you like to receive it. They may be different; an explicit preference is kinder than a test.",
    "问问自己喜欢如何付出和接受关心。两者可以不同；说清偏好，比让人猜测更温柔。",
    "Pregunta cómo prefieres dar y recibir cariño. Pueden ser formas distintas; expresar una preferencia ayuda más que poner a prueba.",
    "ケアをどう与え、受け取りたいか考えてみて。違っていてもよく、試すより伝えるほうが親切です。",
    "배려를 주고받는 방식을 살펴봐요. 서로 달라도 괜찮아요. 시험하기보다 원하는 것을 말해요.",
  ],
  mars: [
    "Choose a small action with a clear stopping point. Express a boundary as something you will do, without trying to control another person's response.",
    "选一个有明确终点的小行动。把界线表达成自己会如何行动，而非控制别人的回应。",
    "Elige una acción pequeña con un final claro. Expresa el límite como una decisión propia, sin controlar la respuesta ajena.",
    "終わりが明確な小さな行動を選んでみて。境界は相手の反応を操るより、自分の行動として伝えましょう。",
    "끝이 분명한 작은 행동을 골라요. 경계는 상대를 통제하기보다 내가 할 행동으로 표현해요.",
  ],
  jupiter: [
    "Try a new perspective on a manageable scale. A hopeful possibility becomes more useful when you check the time and resources it asks of you.",
    "在可承担的范围内尝试新视角，也核对它需要的时间与资源。希望可以与现实并存。",
    "Prueba una perspectiva nueva a pequeña escala y revisa el tiempo y los recursos que requiere.",
    "無理のない規模で新しい視点を試し、必要な時間と資源も確認してみて。",
    "감당할 수 있는 규모로 새 관점을 시도하고 필요한 시간과 자원도 확인해요.",
  ],
  saturn: [
    "Separate a useful responsibility from a rule you no longer endorse. Build one sustainable agreement, including a place for rest.",
    "区分有用的责任与不再认同的规则。建立一项可持续的约定，也为休息留位置。",
    "Distingue una responsabilidad útil de una regla que ya no compartes. Crea un acuerdo sostenible que incluya descanso.",
    "役立つ責任と、もう納得していないルールを分け、休みを含む続けられる約束をつくってみて。",
    "필요한 책임과 더는 동의하지 않는 규칙을 구분해요. 휴식도 포함한 지속 가능한 약속을 만들어요.",
  ],
  uranus: [
    "Change one part of a familiar routine and observe the result. Freedom can be a thoughtful experiment rather than a sudden rupture.",
    "改变熟悉习惯中的一个环节并观察结果。自由可以是有思考的尝试，不一定要突然决裂。",
    "Cambia una parte de una rutina y observa. La libertad puede ser un experimento cuidadoso, sin una ruptura abrupta.",
    "習慣の一部を変えて結果を観察してみて。自由は急な断絶ではなく、丁寧な実験にもなります。",
    "익숙한 일상의 한 부분을 바꾸고 지켜봐요. 자유는 갑작스러운 단절보다 신중한 실험일 수 있어요.",
  ],
  neptune: [
    "Give an image or feeling a creative outlet, then check the practical details separately. Compassion can include a clear limit.",
    "给意象或感受一个创造性的出口，再单独核对现实细节。共情也可以包含清晰界线。",
    "Da una salida creativa a una imagen o emoción y comprueba los detalles por separado. La compasión admite límites.",
    "イメージや感情を創作で表し、現実の細部は別に確かめて。思いやりと境界は両立します。",
    "이미지나 감정을 창작으로 표현하고 현실의 세부는 따로 확인해요. 공감에도 경계가 있을 수 있어요.",
  ],
  pluto: [
    "Notice where holding on offers safety and where it costs you choice. Begin with one honest decision within your own control.",
    "留意紧抓不放在哪些地方保护你，又在哪些地方限制选择。从自己能掌握的诚实决定开始。",
    "Observa dónde aferrarte da seguridad y dónde limita tu elección. Empieza por una decisión honesta a tu alcance.",
    "手放さないことが安心になる場面と、選択を狭める場面を見つめ、自分で選べる誠実な一歩から。",
    "붙잡는 것이 안정감을 주는지 선택을 제한하는지 살펴봐요. 내가 할 수 있는 솔직한 결정부터 시작해요.",
  ],
};
export function placementReading(
  p: PlanetPlacement,
  language: HintLanguage,
): string[] {
  if (!p.sign) return [bodyDescription(p.body, language)];
  const functionText = astroText(language, functions[p.body]);
  const expression = astroText(
    language,
    expressions[SIGN_ORDER.indexOf(p.sign)],
  );
  const name = bodyName(p.body, language),
    sign = signName(p.sign, language);
  const connected = astroText(language, [
    `${name} in ${sign} brings ${functionText} into the language of ${expression}. This describes a way to explore the placement, not a requirement to behave one way.`,
    `${name}落在${sign}，将${functionText}与${expression}联系起来。这是理解这项配置的角度，并不要求你只能以一种方式生活。`,
    `${name} en ${sign} vincula ${functionText} con ${expression}. Es una forma de explorar esta posición, no una obligación de comportarte de cierta manera.`,
    `${sign}の${name}は、${functionText}を、${expression}と結びつけます。配置を理解する一つの視点であり、行動を決めつけるものではありません。`,
    `${name} — ${sign}. ${functionText}, 그리고 ${expression}. 두 주제의 연결을 살펴봐요. 이 배치를 탐색하는 관점이며 행동을 정해 놓는 것은 아니에요.`,
  ]);
  const article = signArticle(p.sign, language);
  return [
    connected,
    ...(p.body === "sun"
      ? [article.sun]
      : p.body === "moon"
        ? [article.moon]
        : p.body === "rising"
          ? [article.rising]
          : []),
    astroText(language, practices[p.body]),
  ];
}
export function placementHouseReading(
  p: PlanetPlacement,
  language: HintLanguage,
): string[] {
  if (!p.house) return [];
  const name = bodyName(p.body, language),
    theme = astroText(language, functions[p.body]);
  return [
    astroText(language, [
      `${name} in house ${p.house} places the theme of ${theme} in this area of life. Read it alongside the sign: the house identifies a setting, while the sign describes an expression.`,
      `${name}在第${p.house}宫，将${theme}带入这一生活领域。宫位说明场景，星座说明表达方式，两者需要一起看。`,
      `${name} en la casa ${p.house} sitúa ${theme} en este ámbito. La casa señala el escenario y el signo, la expresión.`,
      `${p.house}ハウスの${name}は、${theme}をこの生活領域に結びつけます。ハウスは場面、星座は表現として一緒に読みます。`,
      `${p.house}하우스의 ${name}. ${theme}. 이 삶의 영역에서 드러나는 주제예요. 하우스는 무대, 별자리는 표현 방식으로 함께 읽어요.`,
    ]),
    houseDescription(p.house, language),
  ];
}
export function aspectReading(
  from: string,
  to: string,
  type: string,
  language: HintLanguage,
  relationship = false,
): string[] {
  const f = functions[from],
    t = functions[to];
  if (!f || !t) return [aspectDescription(type, language)];
  const a = astroText(language, f),
    b = astroText(language, t);
  const link = astroText(language, [
    `${bodyName(from, language)} and ${bodyName(to, language)} connect ${a} with ${b}. ${relationship ? "These themes belong to two different people; ask how each person actually experiences them." : "Both themes are part of the same chart and can ask for different things at the same time."}`,
    `${bodyName(from, language)}与${bodyName(to, language)}，把${a}和${b}连在一起。${relationship ? "这些主题属于不同的人，要结合双方实际的感受理解。" : "这两个主题都属于同一张星盘，可能同时提出不同的需要。"}`,
    `${bodyName(from, language)} y ${bodyName(to, language)} relacionan ${a} con ${b}. ${relationship ? "Pertenecen a dos personas: pregunta cómo las vive cada una." : "Ambos temas forman parte de la misma carta y pueden pedir cosas distintas a la vez."}`,
    `${bodyName(from, language)}と${bodyName(to, language)}は、${a}と${b}を結びます。${relationship ? "別々の人のテーマなので、それぞれがどう感じるかを尋ねてみて。" : "同じチャートの中で、異なる願いが同時に生まれることもあります。"}`,
    `${bodyName(from, language)} · ${bodyName(to, language)}. ${a}, 그리고 ${b}. 두 주제의 연결을 살펴봐요. ${relationship ? "서로 다른 사람의 주제이니 각자의 실제 경험을 물어봐요." : "한 차트 안에서 동시에 다른 것을 원할 수도 있어요."}`,
  ]);
  const action = astroText(
    language,
    type === "square" || type === "opposition"
      ? [
          `When the themes compete, give ${bodyName(from, language)} and ${bodyName(to, language)} separate room before asking for a compromise. Name the need, agree on timing, and return to the conversation.`,
          `当两种需要冲突时，先分别听见${bodyName(from, language)}与${bodyName(to, language)}的主题，再寻找协调。说清需要、约定时机，然后重新交流。`,
          `Si los temas compiten, da espacio a ${bodyName(from, language)} y ${bodyName(to, language)} antes de negociar. Nombra la necesidad, acuerda un momento y retoma la conversación.`,
          `テーマがぶつかるときは、まず${bodyName(from, language)}と${bodyName(to, language)}それぞれに余白を。必要なことと話す時間を確かめ、再び対話してみて。`,
          `주제가 충돌하면 ${bodyName(from, language)}, ${bodyName(to, language)} 각각에 공간을 줘요. 필요한 것과 대화할 시간을 정하고 다시 이야기해요.`,
        ]
      : type === "conjunction"
        ? [
            "The themes arrive together. Notice when one amplifies the other, and make space to recognize each need separately.",
            "这些主题一起出现。留意何时彼此放大，也练习分别辨认每一种需要。",
            "Los temas llegan juntos. Observa cuándo se amplifican y reconoce cada necesidad por separado.",
            "テーマが一緒に現れます。互いを強める場面に気づき、それぞれの必要も見分けてみて。",
            "주제가 함께 나타나요. 서로를 강화하는 순간을 살피고 각 필요도 따로 알아봐요.",
          ]
        : [
            "Ease still benefits from attention. Choose one small shared practice that gives both themes a place, rather than assuming the connection will maintain itself.",
            "顺畅也需要照顾。选一个让两种主题都有位置的小练习，而不假设连接会自动维持。",
            "La facilidad también necesita atención. Elige una práctica pequeña que dé espacio a ambos temas.",
            "自然な流れにも気配りを。つながりが自動で続くと思わず、両方を活かす小さな実践を選んでみて。",
            "편안함에도 관심이 필요해요. 연결이 저절로 유지된다고 여기기보다 두 주제를 살릴 작은 실천을 골라요.",
          ],
  );
  return [link, aspectDescription(type, language), action];
}
