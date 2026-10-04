import type { HintLanguage } from "../../lib/i18n";
type Copy = { name: string; subtitle: string; body: string; traits: string[] };
const localized: Record<string, Partial<Record<HintLanguage, Copy>>> = {};
function entry(name: string, rows: string) {
  localized[name] = {};
  for (const line of rows.trim().split("\n")) {
    const [language, title, subtitle, body, traits] = line.split("|");
    if (!body || !traits) throw new Error(`Incomplete personality translation: ${name}`);
    localized[name][language as HintLanguage] = { name: title, subtitle, body, traits: traits.split(";") };
  }
}
entry("The Professional Avoider", `
zh|专业回避者|你总能精准避开情绪账单。|你会在不堪重负前退后一步，保护自己的平静。距离让你分清感受和压力。表面的冷静之下，你正在判断哪些话可以安心说出。回来时，你的坦诚通常是谨慎，而非冷漠。|策略性距离;私下消化;迟来但诚实
es|El evasor profesional|Esquivas las cuentas emocionales con precisión olímpica.|Te alejas antes de sentirte desbordado para proteger tu calma. La distancia te ayuda a separar emoción y presión. Tras tu serenidad decides qué puedes revelar con seguridad. Cuando vuelves, tu honestidad suele ser cuidadosa, no fría.|Distancia estratégica;Procesamiento privado;Honestidad tardía
ja|回避のプロ|感情の請求書を見事にかわす人。|圧倒される前に一歩引き、心の平穏を守ります。距離を置くことで感情とプレッシャーを整理します。落ち着いた表情の内側では、安心して話せる範囲を見極めています。戻ってきたときの率直さは、冷たさより慎重さの表れです。|戦略的な距離;一人で整理;遅くても誠実
ko|회피의 전문가|감정의 청구서를 정확히 피해 가요.|감당하기 어려워지기 전에 물러나 평온을 지켜요. 거리를 두면 감정과 압박을 구분할 시간이 생겨요. 차분한 모습 안에서는 무엇을 안전하게 드러낼지 판단하고 있어요. 돌아왔을 때의 솔직함은 차가움보다 신중함에 가까워요.|전략적 거리;혼자 정리;늦어도 솔직함
`);
entry("The Delulu", `
zh|浪漫幻想家|现实来了，你还想替它打个柔光。|你习惯从想象和可能性出发，小小的迹象也能成为完整的情感故事。这种魔力确实存在，只是有时你会先抓住更美的版本。你的心往往先寻找意义，再寻找证据。|乐观解读;象征思维;选择性证据
es|El soñador romántico|Llega la realidad y le pides mejor iluminación.|Te guían la imaginación y las posibilidades. Conviertes pequeñas señales en historias emocionales completas. Esa magia existe, aunque a veces prefieres primero la versión más bonita. Tu corazón busca significado antes que pruebas.|Lectura optimista;Pensamiento simbólico;Pruebas selectivas
ja|ロマンチックな夢想家|現実にも柔らかな照明を求める人。|想像力と可能性を大切にし、小さなサインから豊かな感情の物語を描きます。その力は本物ですが、ときには美しいほうの解釈を先に信じます。心は証拠より先に意味を求めるのです。|希望ある解釈;象徴的な思考;選ぶ証拠
ko|낭만적인 몽상가|현실에도 더 예쁜 조명을 찾는 사람.|상상과 가능성이 먼저예요. 작은 신호도 완전한 감정 이야기로 만들 수 있어요. 그 마법은 진짜지만 때로는 더 아름다운 해석을 먼저 붙잡아요. 마음은 증거보다 의미를 먼저 원해요.|희망적 해석;상징적 사고;선택적 증거
`);
entry("The Control Freak", `
zh|掌控规划师|你称之为标准，朋友称之为系统接管。|明确的安排、计划和下一步让你安心。不确定时，你会抓得更紧。你比多数人更早发现可能出错的地方，掌控于是成为安定周围与自己的方式。|高标准;提前准备;抓紧控制
es|El planificador al mando|Tú lo llamas estándares; el grupo, tomar el control.|La estructura y los pasos claros te dan seguridad. Ante la incertidumbre, aprietas más. Detectas los riesgos antes que muchos. El control se convierte en tu forma de calmar al grupo y a ti mismo.|Estándares altos;Preparación;Control creciente
ja|仕切り上手な計画家|自分には基準、周りにはシステムの乗っ取り。|構造、計画、明確な次の一歩が安心につながります。不確かな状況ほど強く握りしめます。誰より早く問題の兆しに気づき、管理することで周囲と自分を落ち着かせます。|高い基準;準備万全;強まる管理
ko|주도하는 계획가|나는 기준이라 부르고, 친구들은 시스템 장악이라 해요.|체계와 계획, 분명한 다음 단계가 안전하게 느껴져요. 불확실해지면 더 꽉 붙잡아요. 다른 사람보다 위험을 일찍 알아차리고, 통제로 주변과 자신을 진정시켜요.|높은 기준;준비성;강해지는 통제
`);
entry("The Hot Mess", `
zh|迷人混乱派|混乱、迷人，却总能站稳。|你带着速度、感受和漂亮的混乱生活。压力下不容易僵住，反而可能表现出色；但情绪往往稍后才追上来。即便如此，你仍能让混乱显得有趣。|即兴应变;迅速反应;意外坚韧
es|El caos encantador|Caótico, encantador y aún en pie.|Avanzas con velocidad, emoción y un caos atractivo. Bajo presión puedes brillar porque no te paralizas fácilmente. Las emociones suelen alcanzarte después. Aun así, consigues que el desorden resulte interesante.|Improvisación;Reacción rápida;Resiliencia inesperada
ja|魅力的なカオス|混乱していても、なぜか立ち直る。|速さ、感情、美しい混乱とともに生きています。プレッシャーの中でも固まりにくく、力を発揮することがあります。ただ感情は後から追いつきます。それでも混乱を面白く見せる魅力があります。|即興力;反応の速さ;意外な粘り強さ
ko|매력적인 혼돈|혼란스럽고 매력적이며 여전히 서 있어요.|속도와 감정, 아름다운 혼란 속에서 움직여요. 압박에도 쉽게 굳지 않아 빛날 수 있어요. 다만 감정은 나중에 따라잡곤 해요. 그래도 혼란마저 흥미롭게 보이게 만들어요.|즉흥성;빠른 반응;뜻밖의 회복력
`);
entry("The People Pleaser", `
zh|贴心迎合者|你读懂了气氛，却容易忘记自己。|你对别人的舒适度非常敏锐，会很快察觉并缓和紧张。这使你体贴，也可能让你消失在别人的需求里。当和气比真实感受更重要时，这个模式就会变得沉重。|敏锐体贴;回避冲突;在意认可
es|El complaciente|Lees el ambiente y a veces te pierdes dentro de él.|Percibes enseguida la comodidad ajena y suavizas las tensiones. Eso te hace atento, pero puede borrarte entre las necesidades de otros. El patrón pesa cuando mantener la paz importa más que decir tu verdad.|Sintonía emocional;Evita conflictos;Busca aprobación
ja|気づかいの達人|空気を読んで、自分を置き去りにしがち。|人の居心地に敏感で、緊張にすぐ気づき和らげようとします。思いやりの強さである一方、他人の要求の中に自分が埋もれることもあります。自分の本音より平和を優先し続けると負担になります。|気配り;衝突を避ける;承認に敏感
ko|배려하는 맞춤형 사람|분위기를 읽다가 나를 잊기도 해요.|다른 사람의 편안함에 민감하고 긴장을 빨리 알아채 풀어주려 해요. 다정하지만 다른 사람의 필요 속에 내가 사라질 수도 있어요. 진심보다 평화를 더 중시하면 이 패턴이 무거워져요.|세심함;갈등 회피;인정에 민감함
`);
entry("The Overthinker", `
zh|深度思考者|你的脑袋里还有一个脑袋在开播客。|彻底理解之前，你很难放松。你会追踪语气、时机和细微变化，一个小信号就能展开完整的情绪调查。你未必夸张，只是思绪准备得太充分。|扫描模式;思绪丰富;构建情境
es|El pensador incansable|Tu mente tiene otra mente, y esa mente tiene un pódcast.|Intentas comprenderlo todo antes de relajarte. Registras tonos, tiempos y cambios mínimos. Una señal pequeña inicia toda una investigación emocional. No buscas drama: tu mente simplemente se prepara de más.|Detecta patrones;Mente verbal;Imagina escenarios
ja|考え続ける人|頭の中のもう一人が、ずっと語り続ける。|すべて理解してからでないと安心しにくい人です。口調、タイミング、小さな変化まで追いかけます。一つのサインが感情の大捜査になることも。大げさというより、心の準備が入念すぎるのです。|パターン探し;言葉が豊富;状況を想定
ko|끝없이 생각하는 사람|생각 속 생각이 팟캐스트까지 열어요.|모든 것을 이해해야 마음이 놓여요. 말투와 타이밍, 작은 변화를 추적해요. 작은 신호가 감정 수사로 번지기도 해요. 과장하려는 게 아니라 마음의 준비가 지나치게 철저한 거예요.|패턴 탐색;풍부한 언어;상황 예측
`);
entry("The Emotional Escape Artist", `
zh|情绪脱身大师|感受一进门，你就找到了出口。|你感受很深，但太强烈时就会退开。清楚表达前，你可能需要空间。距离帮助呼吸，也可能成为习惯。成长在于学会留在当下，同时不觉得被困住。|压力下脱身;追求自由;温柔防备
es|El escapista emocional|Llegan los sentimientos y localizas la salida.|Sientes con profundidad y te alejas si la intensidad crece. Tal vez necesites espacio antes de hablar. La distancia da aire, pero puede hacerse costumbre. Crecer es permanecer presente sin sentirte atrapado.|Se escapa bajo presión;Busca libertad;Protección suave
ja|感情の脱出名人|気持ちが入ってくると、出口を探す。|深く感じるからこそ、強すぎると離れたくなります。言葉にする前に空間が必要なこともあります。距離は呼吸を助けますが、癖にもなります。閉じ込められずに、その場にいられることが成長の鍵です。|圧力から離れる;自由を求める;柔らかな守り
ko|감정 탈출의 명수|감정이 들어오면 가장 가까운 출구를 찾아요.|깊이 느끼지만 너무 강해지면 멀어져요. 분명히 말하려면 먼저 공간이 필요할 수 있어요. 거리는 숨을 쉬게 하지만 습관이 되기도 해요. 갇힌 느낌 없이 현재에 머무는 것이 성장의 방향이에요.|압박에서 벗어남;자유 추구;부드러운 방어
`);
entry("The Visionary", `
zh|远见梦想家|看见了未来，却绊到今天的衣物。|你比别人更早看见可能的未来，想象也比实际细节更快。潜力、模式和未来的自己吸引着你。挑战是把愿景变成一个踏实的下一步。|宏观视角;吸引力;面向未来
es|El visionario|Ves el futuro y tropiezas con la ropa de hoy.|Ves lo que algo puede llegar a ser antes que otros. Tu imaginación adelanta a los detalles prácticos. Te atraen el potencial, los patrones y tu yo futuro. El reto es convertir esa visión en un paso concreto.|Visión amplia;Magnetismo;Mira al futuro
ja|未来を描く人|未来は見えるのに、今日の洗濯物につまずく。|他の人より早く可能性を見つけます。想像力は実務的な細部より速く進みます。潜在力やパターン、未来の自分に惹かれます。そのビジョンを現実的な次の一歩に変えることが課題です。|広い視野;魅力;未来志向
ko|미래를 그리는 사람|미래는 보이는데 오늘의 빨래에 걸려요.|다른 사람보다 가능성을 먼저 보고 상상은 현실의 세부 사항보다 빠르게 움직여요. 잠재력과 패턴, 미래의 내 모습에 끌려요. 그 비전을 현실적인 다음 한 걸음으로 바꾸는 것이 과제예요.|큰 그림;매력;미래 지향
`);
entry("The Walking Contradiction", `
zh|矛盾共存者|两种真实，在同一个人里共存。|你可以同时承载多种真实，同一刻既想亲近又想自由。你能温柔也能防备，开放也能私密，稳定也难预测。这不是虚假，而是有层次。|双重面向;难以归类;随情境变化
es|La contradicción andante|Dos verdades en una persona, sin una explicación simple.|Llevas varias verdades a la vez. Puedes querer cercanía y libertad al mismo tiempo, ser abierto y reservado, estable e impredecible. La contradicción no es falsedad: son tus distintas capas.|Naturaleza dual;Difícil de etiquetar;Depende del contexto
ja|矛盾を抱く人|一人の中に二つの本音がある。|複数の真実を同時に抱えます。親密さと自由を同時に望むことも。優しくも慎重で、開放的でも私的で、安定しながら予測しにくい人です。矛盾は偽りではなく、奥行きです。|二つの面;分類しにくい;状況によって変化
ko|모순을 품은 사람|한 사람 안에 두 가지 진실이 있어요.|여러 진실을 동시에 품어요. 가까움과 자유를 함께 원하고, 부드러우면서 경계하고, 개방적이면서 사적일 수 있어요. 안정적이면서 예측하기 어려운 그 모순은 거짓이 아니라 여러 층의 모습이에요.|양면성;분류하기 어려움;상황에 따른 변화
`);
entry("The Challenger", `
zh|直率挑战者|你没有挑起冲突，只是看见了薄弱的论点。|你能察觉虚假或不公平，敢问大家回避的问题。直率可以保护别人，也可能显得强烈。你之所以反对，是因为假装一切都好更难受。|直接;敢于质疑;保护性
es|El desafiante|No buscas conflicto; detectas argumentos débiles.|Percibes lo falso o injusto y cuestionas lo que otros evitan. Tu franqueza puede proteger, aunque también resultar intensa. Te opones porque fingir que todo va bien se siente peor.|Directo;Provocador;Protector
ja|問いかける挑戦者|争いではなく、弱い論点に気づく人。|不誠実さや不公平さを察し、皆が避けることにも疑問を投げかけます。率直さは人を守る一方、強く感じられることもあります。平気なふりをするほうが苦しいからこそ、声を上げるのです。|率直;問いかける;守る力
ko|질문하는 도전자|갈등을 만드는 게 아니라 약한 논리를 알아봐요.|거짓이나 불공정을 느끼고 모두가 피하는 것을 물어요. 솔직함은 보호가 되지만 강렬하게 느껴질 수도 있어요. 괜찮은 척하는 것이 더 힘들기에 맞서는 거예요.|직설적;질문하는 태도;보호적
`);
entry("The Main Character", `
zh|故事主角|剧情找到你，因为你一直在旁白。|你通过意义和故事体验生活，每一刻都有启示、气氛与转折。你自然带来存在感，但也要记得，别人同样拥有完整的故事。|表达鲜明;戏剧性清晰;故事驱动
es|El protagonista|La trama te encuentra porque sigues narrándola.|Vives mediante historias y significados. Cada momento trae una lección, un tono o un giro. Tu presencia se nota sin mucho esfuerzo. La sombra aparece cuando olvidas que los demás también tienen historias completas.|Expresivo;Claridad dramática;Piensa en historias
ja|物語の主人公|語り続けるあなたに、展開が集まる。|意味と物語を通して人生を体験します。どの瞬間にも学び、雰囲気、転機があります。自然な存在感がありますが、他の人にもそれぞれ完全な物語があることを忘れないでください。|表現豊か;印象的な明快さ;物語で捉える
ko|이야기의 주인공|계속 이야기를 하니 줄거리가 나를 찾아와요.|의미와 이야기로 삶을 경험해요. 모든 순간에 교훈과 분위기, 반전이 있어요. 자연스러운 존재감을 갖지만 다른 사람에게도 완전한 이야기가 있다는 사실을 잊지 않는 것이 중요해요.|표현력;극적인 명료함;이야기 중심
`);
entry("The Lover", `
zh|深情爱人|你浪漫、依恋、原谅，并称之为深刻。|你的心离表面很近。爱、美与温柔对你很重要。连接对你而言珍贵，因此你可能比别人预想的更愿意原谅。但深情仍需要边界，才能保持健康。|投入;感官细腻;跟随内心
es|El amante|Romantizas, te apegas, perdonas y lo llamas profundidad.|Llevas el corazón cerca de la superficie. El amor, la belleza y la ternura importan mucho. Perdonas más de lo esperado porque valoras la conexión. Aun así, la entrega necesita límites saludables.|Devoción;Sensualidad;Corazón al mando
ja|愛を大切にする人|憧れ、結びつき、許すことを深さと呼ぶ。|心がすぐ表に現れる人です。愛、美しさ、優しさが大切です。つながりを尊く思うからこそ、予想以上に許せます。それでも健やかな愛情には境界が必要です。|献身;感性豊か;心に従う
ko|사랑을 소중히 하는 사람|낭만을 품고, 애착을 맺고, 용서하며 깊이라 불러요.|마음이 가까이 드러나는 사람이에요. 사랑과 아름다움, 다정함이 중요해요. 연결이 소중해서 예상보다 많이 용서하지만 건강한 헌신에는 경계도 필요해요.|헌신;섬세한 감각;마음을 따름
`);
entry("The Self-Saboteur", `
zh|自我绊脚者|找到了门，却开始和门把手争论。|好事刚稳定下来，你可能就打断它。保护自己的那部分想抢在失望之前行动，因而把不确定误认成危险。练习接受好事，而不总为失去做准备。|几乎准备好;保护性混乱;对成长犹豫
es|El autosaboteador|Encuentras la puerta y discutes con el pomo.|Puedes interrumpir algo bueno justo cuando se estabiliza. Una parte protectora intenta adelantarse a la decepción y confunde incertidumbre con peligro. Aprendes a recibir sin prepararte siempre para perder.|Casi listo;Caos protector;Resistencia al cambio
ja|自分につまずく人|扉を見つけても、取っ手と議論してしまう。|良いことが安定しかけると、自ら中断することがあります。自分を守る部分が失望を先回りし、不確かさを危険と取り違えます。失う準備ばかりせず、受け取ることを学ぶのがテーマです。|あと一歩;守るための混乱;変化へのためらい
ko|스스로 걸림돌을 놓는 사람|문을 찾고도 손잡이와 다퉈요.|좋은 일이 안정될 때 끊어버리기도 해요. 나를 보호하는 부분이 실망보다 먼저 움직이며 불확실함을 위험으로 착각할 수 있어요. 상실에만 대비하지 않고 좋은 것을 받아들이는 연습이 필요해요.|거의 준비됨;보호적 혼란;변화에 대한 망설임
`);
entry("The Walking Red Flag", `
zh|强烈信号派|不是小小警示，而是整面亮起的招牌。|你的存在强烈且难以忽视，感受有力，反应炽热。小事也会因你变得难忘。力量是真实的，但修复和热情同样重要。|强烈;吸引力;不修饰的坦诚
es|La señal intensa|No eres una señal pequeña, sino todo un cartel iluminado.|Tu presencia es intensa e imposible de ignorar. Sientes con fuerza y reaccionas con calor. Contigo los momentos pequeños se vuelven memorables. Esa potencia existe, pero reparar importa tanto como la pasión.|Intensidad;Magnetismo;Honestidad imperfecta
ja|強烈なサイン|小さな警告ではなく、明るい看板のよう。|存在感が強く、見過ごせない人です。力強く感じ、熱く反応します。小さな出来事もあなたの周りでは忘れられなくなります。その力と同じくらい、修復も大切です。|強烈;魅力;飾らない率直さ
ko|강렬한 신호|작은 경고가 아니라 환하게 켜진 간판 같아요.|존재감이 강렬해 무시하기 어려워요. 힘차게 느끼고 뜨겁게 반응하며 작은 순간도 잊지 못하게 만들어요. 그 힘은 진짜지만 회복과 수습도 열정만큼 중요해요.|강렬함;매력;다듬지 않은 솔직함
`);
entry("The Attention Addict", `
zh|目光追逐者|你说不需要聚光灯，却总知道它何时离开。|被看见比你承认的更重要，注意力像是在证明你的存在。当它消退，你可能会表演以寻求安心。被看见是加分，而非全部时，你反而更闪亮。|表现魅力;渴望被看见;反应敏锐
es|El buscador de atención|No necesitas el foco, pero notas cuándo se va.|Ser visto importa más de lo que admites. La atención confirma que tu presencia cuenta. Si desaparece, puedes actuar para buscar seguridad. Brillas más cuando la visibilidad es un extra, no toda la recompensa.|Encanto escénico;Busca visibilidad;Receptivo
ja|視線を求める人|スポットライトが離れると、すぐ気づく。|見てもらえることは、認める以上に大切です。注目が存在の証明に感じられ、薄れると安心のために演じたくなることも。注目をすべてではなく、おまけとして受け取るときに輝きます。|演じる魅力;見られたい気持ち;反応が豊か
ko|시선을 찾는 사람|조명이 필요 없다지만 꺼지는 순간은 알아요.|보이는 것은 인정하는 것보다 중요해요. 관심이 내 존재를 증명하는 것 같고 사라지면 안심하려고 연기할 수도 있어요. 주목이 전부가 아닌 보너스가 될 때 더 빛나요.|표현하는 매력;보이고 싶은 마음;민감한 반응
`);
entry("The Disaster Magnet", `
zh|转折吸引体|剧情反转似乎开启了你的位置权限。|你的生活很少无聊，完整地图出现前就会跟着冲动快速行动。这让你有趣，也让你熟悉各种转折。通常你会带着一个故事走出来。|多姿多彩;冲动;生存韧性
es|El imán de giros|Los giros de trama parecen conocer tu ubicación.|Tu vida rara vez es aburrida. Actúas deprisa y sigues impulsos antes de ver el mapa completo. Eso te vuelve emocionante y muy familiar con las sorpresas. Sueles salir adelante con una historia que contar.|Vida movida;Impulsividad;Supervivencia
ja|展開を引き寄せる人|どんでん返しがあなたの居場所を知っている。|退屈とは縁が薄く、全体像が見える前に衝動に従って動きます。刺激的な魅力があり、予想外の展開にも慣れています。たいていは新しい物語を手に、乗り越えます。|出来事が豊富;衝動的;生き抜く力
ko|반전을 끌어당기는 사람|줄거리의 반전이 내 위치를 아는 것 같아요.|삶이 좀처럼 지루하지 않아요. 전체 지도가 보이기 전에 충동을 따라 빠르게 움직여요. 흥미로운 사람이지만 반전에도 익숙해요. 대개 이야기 하나를 안고 살아남아요.|다채로운 사건;충동성;살아남는 힘
`);
entry("The Delayed Realizer", `
zh|迟来领悟者|你最终都懂，只是晚了几个工作日。|清晰感往往在事情过后才到来。当下你可能很平静，之后情绪的真相才追上来。你的智慧是真实的，只是需要时间落地。|迟来的清晰;深度消化;事后智慧
es|El que comprende después|Lo entiendes todo, con unos días de retraso.|Tu claridad suele llegar después. Puedes parecer tranquilo mientras algo ocurre; más tarde aparece la verdad emocional. Tu sabiduría es real, simplemente necesita tiempo para asentarse.|Claridad tardía;Procesamiento profundo;Sabiduría posterior
ja|後から気づく人|すべてわかるけれど、少し遅れてやってくる。|明晰さは出来事の後に訪れがちです。その場では平静でも、後から感情の本音が追いつきます。知恵は確かにあります。ただ、心に着地するまで時間が必要なのです。|後からの明快さ;深く整理;経験後の知恵
ko|뒤늦게 깨닫는 사람|모든 걸 이해하지만 며칠 늦게 도착해요.|명료함은 순간이 지난 뒤에 오곤 해요. 일이 일어나는 동안 차분해 보여도 나중에 감정의 진실이 따라와요. 지혜는 진짜이며 자리 잡는 데 시간이 조금 필요한 거예요.|늦게 오는 명료함;깊은 정리;사후의 지혜
`);
entry("The Commitment Phobe", `
zh|自由守门人|你想靠近，也想保留十四个出口。|你想亲近，也需要呼吸空间。承诺来得太快时，像一扇上锁的门；即使连接真实，你也可能退后。当选择和亲近能够共存，安全感才会成长。|自由优先;忽冷忽热;保留选择
es|El guardián de la libertad|Quieres acercarte y conservar catorce salidas.|Deseas cercanía, pero necesitas respirar. Un compromiso demasiado rápido puede parecer una puerta cerrada. Puedes alejarte incluso de una conexión real. La seguridad crece cuando elegir y acercarse pueden convivir.|Libertad primero;Acercarse y alejarse;Conserva opciones
ja|自由の守り手|近づきたいけれど、出口も残したい。|親密さを望む一方、呼吸できる余地が必要です。約束が早すぎると鍵のかかった扉に感じられ、本当のつながりからも退くことがあります。選択と親密さが共存できるとき、安心が育ちます。|自由を優先;近づいては離れる;選択肢を残す
ko|자유의 문지기|가까워지고 싶지만 출구도 남겨두고 싶어요.|가까움을 원하면서도 숨 쉴 공간이 필요해요. 약속이 너무 빨리 오면 잠긴 문처럼 느껴지고 진짜 연결에서도 물러날 수 있어요. 선택과 친밀함이 함께 있을 때 안전감이 자라요.|자유 우선;가까워졌다 멀어짐;선택지 유지
`);
export function personalityCopy(name: string, original: Omit<Copy, "name">, language: HintLanguage): Copy {
  return localized[name]?.[language] ?? { ...original, name };
}
export const PERSONALITY_TRANSLATIONS = localized;
