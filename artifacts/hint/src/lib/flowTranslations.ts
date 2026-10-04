import type { HintLanguage } from "./i18n";

export const FLOW_COPY: Record<HintLanguage, Record<string, string>> = { en: {}, zh: {}, es: {}, ja: {}, ko: {} };
FLOW_COPY.en["dailyPull.method"] = "A saved daily card with tarot symbolism and general reflection. Personal charts are available in Astrology after calculation.";
FLOW_COPY.zh["dailyPull.method"] = "已保存的今日牌，结合塔罗象征与一般反思。个人星盘需在占星页面完成计算后查看。";
FLOW_COPY.es["dailyPull.method"] = "Una carta diaria guardada con simbolismo y reflexión general. Tu carta natal está en Astrología tras calcularla.";
FLOW_COPY.ja["dailyPull.method"] = "保存された今日のカードを、タロットの象徴と一般的な振り返りで読みます。個人の出生図は占星術で計算後に確認できます。";
FLOW_COPY.ko["dailyPull.method"] = "저장된 오늘의 카드를 타로 상징과 일반적인 성찰로 읽습니다. 개인 출생 차트는 점성술에서 계산 후 확인하세요.";
function add(prefix: string, lines: string) {
  for (const line of lines.trim().split("\n")) {
    const [key, es, ja, ko] = line.split("|");
    if (!key || !es || !ja || !ko) throw new Error(`Incomplete translation: ${line}`);
    FLOW_COPY.es[prefix + key] = es; FLOW_COPY.ja[prefix + key] = ja; FLOW_COPY.ko[prefix + key] = ko;
  }
}
add("tarot.", `
setup.preview|Vista previa|プレビュー|미리보기
setup.previewLabel|Vista previa de la sala|部屋のプレビュー|방 미리보기
setup.customPreviewTitle|Sala personalizada|カスタムルーム|맞춤 방
setup.customPreviewMood|Tus ilustraciones, reverso y fondo elegidos.|選択したカードの絵柄、裏面、背景。|선택한 카드 그림, 뒷면 및 방 배경입니다.
start.eyebrow|Comenzar la lectura|リーディングを始める|리딩 시작
start.title|Haz tu pregunta al tarot|タロットへの質問|타로에 질문하기
start.body|Escribe tu pregunta o elige una situación para preparar la tirada.|質問を入力するか、下の場面から選んでスプレッドを準備しましょう。|질문을 입력하거나 아래 상황을 골라 스프레드를 준비하세요.
start.questionLabel|Tu pregunta|あなたの質問|나의 질문
start.placeholder|¿Qué necesito comprender de esta situación?|この状況について何を理解すればよいですか？|이 상황에서 무엇을 이해해야 할까요?
start.emptyHint|Puedes empezar sin texto y precisar la pregunta después.|空欄のまま始めて、次のステップで質問を整えられます。|빈칸으로 시작하고 다음 단계에서 질문을 정해도 됩니다.
start.readyHint|Esta pregunta te acompañará a la sala.|この質問を部屋に持っていきます。|이 질문을 방으로 가져갑니다.
start.button|Comenzar lectura|リーディング開始|리딩 시작
scenes.eyebrow|Situaciones|質問の場面|질문 상황
scenes.title|¿No sabes qué preguntar?|何を聞くか迷っていますか？|무엇을 물을지 모르겠나요?
scenes.body|Elige una situación para completar la pregunta y la tirada.|場面を選ぶと質問とスプレッドが入力されます。|상황을 선택하면 질문과 스프레드가 채워집니다.
scenes.love|Amor y vínculos|恋愛とつながり|사랑과 관계
scenes.life|Estudios, trabajo y personas|学校・仕事・人間関係|학교, 직장, 사람들
scene.connection.title|Vuestra conexión|二人のつながり|두 사람의 관계
scene.connection.body|Hacia dónde va la relación y qué necesita el vínculo.|関係の行方と、つながりが求めていること。|관계의 방향과 지금 필요한 것.
scene.connection.question|¿Qué necesito comprender de esta conexión ahora?|今、このつながりについて何を理解すればよいですか？|지금 이 관계에서 무엇을 이해해야 할까요?
scene.rightLove.title|Amor y citas|恋愛・出会い|연애와 만남
scene.rightLove.body|Nuevas oportunidades y el tipo de persona que se acerca.|新たな恋の可能性と、近づいてくる人について。|새로운 인연과 다가오는 사람에 관해 알아봅니다.
scene.rightLove.question|¿Qué debería saber sobre mi próxima conexión romántica?|次の恋愛のつながりについて何を知っておくとよいですか？|다음 연애 관계에 대해 무엇을 알아야 할까요?
scene.thoughts.title|Lo que piensa esa persona|相手の気持ち|상대의 생각
scene.thoughts.body|Lo que siente, lo que muestra y lo que puede evitar.|相手が感じていること、見せる姿、避けていること。|상대가 느끼고 드러내며 피하는 것.
scene.thoughts.question|¿Qué piensa y siente realmente hacia mí?|相手は私についてどう考え、どんな態度でいるのでしょう？|상대의 진짜 생각과 태도는 무엇일까요?
scene.reconcile.title|Ruptura y reconciliación|別れ・復縁|이별과 재회
scene.reconcile.body|La posibilidad de retomar el vínculo y sus obstáculos.|関係を再開できる可能性と、その妨げ。|관계를 다시 시작할 가능성과 방해 요소.
scene.reconcile.question|¿Aún hay una oportunidad de reparar esta relación?|この関係を修復する機会はまだありますか？|이 관계를 회복할 기회가 아직 있을까요?
scene.exam.title|Exámenes|試験について|시험 운
scene.exam.body|En qué concentrarte antes de un examen, resultado o solicitud.|試験、結果発表、出願の前に意識したいこと。|시험, 결과 발표, 지원 전에 집중할 것.
scene.exam.question|¿En qué debo concentrarme para mejorar en este examen o solicitud?|試験や出願で力を発揮するため、何に集中すればよいですか？|시험이나 지원에서 더 잘하려면 무엇에 집중해야 할까요?
scene.people.title|Personas a tu alrededor|周囲の人々|주변 사람들
scene.people.body|Amistades, compañeros y tensiones sociales.|友人、同級生、同僚との関係や緊張。|친구, 학우, 동료와의 관계 및 긴장.
scene.people.question|¿Qué debería comprender de mis relaciones actuales?|今の人間関係について何を理解すればよいですか？|현재 대인관계에서 무엇을 이해해야 할까요?
scene.career.title|Oportunidades laborales|仕事の機会|취업 기회
scene.career.body|Entrevistas, ofertas, búsqueda de empleo y próximos pasos.|面接、内定、求職のタイミングと次の行動。|면접, 제안, 구직 시기와 다음 행동.
scene.career.question|¿Qué debería saber de mi próxima oportunidad laboral?|次の仕事の機会について何を知っておくとよいですか？|다음 취업 기회에 대해 무엇을 알아야 할까요?
studio.deck|Mazo|デッキ|덱
studio.cards|Cartas|カード|카드
studio.room|Sala|部屋|방
style.title|Estilo de la sala|部屋のスタイル|방 스타일
style.subtitle|Opciones de mazo, ilustraciones y fondo.|デッキ、カードの絵柄、背景の設定。|덱, 카드 그림 및 배경 설정.
style.open|Personalizar|カスタマイズ|꾸미기
style.close|Ocultar|閉じる|숨기기
`);
add("tarot.flow.", `
question.eyebrow|Pregunta a Hint|Hintに聞く|Hint에 질문하기
question.title.general|¿Qué necesitas ver con claridad?|何をはっきり見たいですか？|무엇을 명확히 보고 싶나요?
question.title.career|¿Qué necesitas aclarar sobre tu próximo paso?|次の一歩について、何を明確にしたいですか？|다음 단계에서 무엇을 명확히 하고 싶나요?
question.title.love|¿Qué necesita claridad en esta conexión?|このつながりで何を明確にしたいですか？|이 관계에서 무엇을 명확히 하고 싶나요?
question.title.timing|¿Qué momento quieres comprender?|どんなタイミングを知りたいですか？|어떤 시기를 이해하고 싶나요?
question.title.choice|¿Qué decisión necesita una señal más clara?|どの選択に手がかりが必要ですか？|어떤 선택에 더 분명한 신호가 필요한가요?
question.title.self|¿Qué patrón quieres mirar de otra manera?|どの繰り返しを違う視点で見たいですか？|어떤 패턴을 다르게 보고 싶나요?
question.body.general|Pregunta en una frase o elige una sugerencia.|一文で質問するか、候補を選んでください。|한 문장으로 묻거나 추천 질문을 선택하세요.
question.body.career|Nombra el paso, la oferta o la decisión y Hint elegirá una tirada.|次の行動、提案、決断を伝えると、Hintがスプレッドを選びます。|다음 행동, 제안 또는 결정을 적으면 Hint가 스프레드를 고릅니다.
question.body.love|Describe la conexión y lo que no está claro para orientar la lectura.|つながりと曖昧に感じることを伝え、リーディングの方向を定めましょう。|관계와 불분명한 점을 적어 리딩의 방향을 정하세요.
question.body.timing|Pregunta qué se abre ahora, qué requiere paciencia o cuándo actuar.|今開かれる可能性、待つべきこと、動く時期を聞いてみましょう。|지금 열리는 기회, 기다려야 할 일, 행동할 때를 물어보세요.
question.body.choice|Describe la decisión y Hint elegirá una tirada centrada en ella.|決断の内容に合わせて、Hintがスプレッドを選びます。|결정할 내용을 적으면 Hint가 그에 맞는 스프레드를 고릅니다.
question.body.self|Describe el sentimiento o la conducta repetida que quieres comprender.|理解したい、繰り返す感情や行動を伝えてください。|이해하고 싶은 반복되는 감정이나 행동을 적어주세요.
question.current|Pregunta actual|現在の質問|현재 질문
question.suggested|Preguntas sugeridas|質問の候補|추천 질문
question.autoSpread|Tirada automática|自動スプレッド|자동 스프레드
question.placeholder|Escribe tu pregunta…|質問を入力…|질문을 입력하세요…
question.voiceInput|Entrada de voz|音声入力|음성 입력
question.voiceHint|Expresa tu pregunta en una frase.|一文で質問を話してください。|한 문장으로 질문해 주세요.
question.voiceListening|Te escucho…|聞いています…|듣고 있어요…
question.voiceStarting|Abriendo micrófono…|マイクを起動中…|마이크 여는 중…
question.voiceReady|Tu pregunta está lista.|質問の準備ができました。|질문이 준비되었습니다.
question.cancel|Cancelar|キャンセル|취소
question.useVoice|Usar esta pregunta|この質問を使う|이 질문 사용
prompt.love.category|Amor|恋愛|사랑
prompt.love.question|¿Por qué sigo pensando en esa persona?|なぜ相手のことを考え続けてしまうのでしょう？|왜 자꾸 그 사람이 생각날까요?
prompt.career.category|Trabajo|仕事|일
prompt.career.question|¿Qué debo saber antes de mi próximo cambio laboral?|次の仕事の一歩の前に何を知っておくべきですか？|다음 커리어 단계 전에 무엇을 알아야 할까요?
prompt.decision.category|Decisión|決断|결정
prompt.decision.question|¿Qué camino me conviene más ahora?|今の私にはどちらの道がよいですか？|지금 나에게 어느 길이 더 좋을까요?
prompt.self.category|Yo|自分|나 자신
prompt.self.question|¿Qué estoy evitando emocionalmente?|感情の面で何を避けているのでしょう？|나는 어떤 감정을 피하고 있나요?
prompt.timing.category|Momento|タイミング|시기
prompt.timing.question|¿Es el momento adecuado para actuar?|今は行動するのによい時期ですか？|지금 행동할 때일까요?
prompt.truth.category|Verdad|真実|진실
prompt.truth.question|¿Qué verdad me estoy perdiendo?|見落としている本当のことは何ですか？|내가 놓치고 있는 진실은 무엇일까요?
focus.career|Próximo paso|次の一歩|다음 단계
focus.love|Sentimientos internos|内なる気持ち|내면의 감정
focus.timing|Señal del momento|時期の手がかり|시기의 신호
focus.choice|Camino de decisión|選択の道|선택의 길
focus.self|Patrón personal|自分のパターン|나의 패턴
focus.general|Señal clara|明確な手がかり|분명한 신호
recommendation.eyebrow|Tirada personal|あなたのスプレッド|나만의 스프레드
recommendation.title|La sala eligió {spread}.|{spread}が選ばれました。|{spread}가 선택되었습니다.
recommendation.swipe|Desliza para comparar otra distribución.|スワイプして他の形と比べましょう。|밀어서 다른 배열과 비교하세요.
recommendation.loading|Buscando tu tirada…|スプレッドを探しています…|스프레드 찾는 중…
recommendation.api|Según tu pregunta|質問に合わせて選択|질문에 맞춘 선택
recommendation.local|Sugerida para ti|あなたへの提案|추천 스프레드
recommendation.manual|Explorar tiradas|スプレッドを探索|스프레드 살펴보기
recommendation.confidence|Confianza: {level}|確信度：{level}|확신 수준: {level}
recommendation.use|Usar esta tirada|このスプレッドを使う|이 스프레드 사용
recommendation.current|Tirada actual|現在のスプレッド|현재 스프레드
recommendation.cardCount|{count} cartas|{count}枚|카드 {count}장
recommendation.singleCard|1 carta|1枚|카드 1장
recommendation.previous|Tirada anterior|前のスプレッド|이전 스프레드
recommendation.next|Siguiente tirada|次のスプレッド|다음 스프레드
recommendation.why|Por qué esta tirada|このスプレッドの理由|이 스프레드인 이유
recommendation.confidence.high|Confianza alta|確信度：高|높은 확신
recommendation.confidence.medium|Confianza media|確信度：中|보통 확신
recommendation.confidence.low|Confianza baja|確信度：低|낮은 확신
design.settingsEyebrow|Estilo de la sala de tarot|タロットルームのスタイル|타로 방 스타일
design.setupEyebrow|Preparar lectura|リーディングの準備|리딩 설정
design.settingsTitle|Decora tu sala.|部屋を飾りましょう。|방을 꾸며보세요.
design.setupTitle|Tu lectura está lista.|リーディングの準備ができました。|리딩이 준비되었습니다.
design.settingsBody|Elige el ambiente, las ilustraciones y el reverso para tus próximas lecturas.|今後のリーディングで使う雰囲気、絵柄、裏面を選びましょう。|다음 리딩에 사용할 분위기, 카드 그림과 뒷면을 고르세요.
design.setupBody|La tirada y el reverso de tu signo están preparados. Empieza o ajusta el estilo.|スプレッドと星座の裏面を準備しました。始めるか、見た目を調整できます。|스프레드와 별자리 카드 뒷면이 준비되었습니다. 시작하거나 모양을 조정하세요.
design.livePreview|Vista previa de la sala|部屋のプレビュー|방 미리보기
design.readySetup|Preparación lista|準備完了|설정 완료
design.yourRoom|Tu sala de tarot|あなたのタロットルーム|나의 타로 방
design.roomStyle|Estilo de la sala|部屋のスタイル|방 스타일
design.front|Anverso|表面|앞면
design.back|Reverso|裏面|뒷면
design.customize|Personalizar|カスタマイズ|꾸미기
design.customizeBody|Sala, anverso y reverso|部屋・カードの表面・裏面|방, 카드 앞면과 뒷면
design.roomBackground|Fondo de la sala|部屋の背景|방 배경
design.roomBackgroundBody|Elige el ambiente de la lectura.|リーディングの雰囲気を選びましょう。|리딩의 분위기를 고르세요.
design.cardFront|Anverso de las cartas|カードの表面|카드 앞면
design.cardFrontBody|Elige las ilustraciones que se verán al revelar.|公開後に表示する絵柄を選びましょう。|공개 후 보이는 그림 스타일을 고르세요.
design.cardBack|Reverso de las cartas|カードの裏面|카드 뒷면
design.save|Guardar sala|部屋を保存|방 저장
design.begin|Comenzar el ritual|儀式を始める|의식 시작
design.room|Sala|部屋|방
design.spread|Tirada|スプレッド|스프레드
design.cardBackHelpPersonal|Los estilos básicos y de {sign} están incluidos. Los premium usan fichas.|基本と{sign}の裏面は利用できます。プレミアムにはトークンを使います。|기본 및 {sign} 뒷면은 포함됩니다. 프리미엄에는 토큰을 사용합니다.
design.cardBackHelpGuest|Incluye estilos básicos. Los reversos del zodiaco aparecen al configurar el perfil.|基本スタイルを利用できます。星座の裏面はプロフィール設定後に表示されます。|기본 스타일이 포함됩니다. 별자리 뒷면은 프로필 설정 후 표시됩니다.
design.token|Ficha|トークン|토큰
design.showMyBacks|Mostrar solo los reversos de mi signo|自分の星座の裏面のみ表示|내 별자리 뒷면만 표시
design.showTokenStyles|Mostrar estilos con fichas|トークンのスタイルを表示|토큰 스타일 표시
`);
add("tarot.flow.", `
prepare.title|Mantén tu pregunta en mente.|質問を心に留めてください。|질문을 마음에 담아주세요.
prepare.body|Mueve las cartas como te resulte natural. Suelta cuando estén listas.|自然に感じるままカードを動かし、整ったら手を離しましょう。|자연스럽게 카드를 움직이고 준비되면 손을 떼세요.
wash.cards|{count} cartas|{count}枚|카드 {count}장
wash.fullDeck|Mazo completo|全デッキ|전체 덱
wash.gathering|Reuniendo|集めています|모으는 중
wash.deckSquared|Mazo ordenado|デッキを整えました|덱 정리 완료
wash.cutDeck|Cortar el mazo|デッキをカット|덱 자르기
wash.readyToCut|Listo para cortar|カットの準備完了|자를 준비 완료
wash.title|Mezclar cartas|カードを混ぜる|카드 섞기
wash.placedBody|Toca la mesa para mezclar a mano o elige la mezcla automática.|テーブルに触れて手で混ぜるか、自動を選んでください。|테이블을 터치해 직접 섞거나 자동 섞기를 선택하세요.
wash.body|Mezcla suavemente en sentido horario. Levanta la mano cuando estés a gusto.|時計回りにやさしく混ぜ、よいと感じたら手を離しましょう。|시계 방향으로 부드럽게 섞고, 준비되면 손을 떼세요.
wash.cutReadyBody|Las cartas están reunidas y listas para cortar.|カードが集まり、カットの準備ができました。|카드가 모여 자를 준비가 되었습니다.
wash.cuttingBody|El mazo se está cortando y ordenando para tu pregunta.|質問に向けてデッキをカットし、整えています。|질문을 위해 덱을 자르고 정리하고 있습니다.
wash.auto|Mezcla automática|自動で混ぜる|자동 섞기
wash.washing|Mezclando…|混ぜています…|섞는 중…
wash.clockwise|Mezclar en sentido horario|時計回りに混ぜる|시계 방향으로 섞기
wash.counterclockwise|Mezclar en sentido antihorario|反時計回りに混ぜる|반시계 방향으로 섞기
wash.again|Mezclar otra vez|もう一度混ぜる|다시 섞기
wash.aria|Mezcla en sentido horario y levanta la mano al terminar. Con el teclado, usa cualquier flecha para mezclar en sentido horario y pulsa Intro para terminar.|時計回りに混ぜ、準備ができたら手を離してください。キーボードでは矢印キーで時計回りに混ぜ、Enterキーで完了します。|시계 방향으로 섞고 준비되면 손을 떼세요. 키보드에서는 방향키로 시계 방향으로 섞고 Enter 키로 마칩니다.
cut.title|Cortando el mazo.|デッキをカット中。|덱을 자르는 중입니다.
cut.body|La sala dividirá el mazo conservando su orden oculto.|見えない並び順を保ったままデッキを分けます。|숨겨진 순서를 유지하며 덱을 나눕니다.
cut.stack|Apilando los tres montones.|三つの山を重ねています。|세 묶음을 쌓고 있습니다.
cut.squared|El corte está completo.|カットが完了しました。|자르기가 완료되었습니다.
cut.shuffleTitle|Barajando el mazo.|デッキをシャッフル中。|덱을 섞는 중입니다.
cut.readyTitle|El mazo está listo.|デッキの準備ができました。|덱이 준비되었습니다.
cut.shuffle|Intercalando las cartas…|カードを交互に重ねています…|카드를 교차해 섞는 중…
cut.shuffleAria|Barajado automático después del corte|カット後の自動シャッフル|자른 후 자동 섞기
cut.ready|El mazo está barajado y listo.|シャッフルが終わり、準備ができました。|덱을 섞었고 준비가 끝났습니다.
cut.action|Cortar el mazo|デッキをカット|덱 자르기
cut.cutting|Dividiendo el mazo…|デッキを分けています…|덱을 나누는 중…
cut.spread|Extender el mazo|デッキを広げる|덱 펼치기
cut.pile|Montón {pile}|山 {pile}|묶음 {pile}
pick.title|Elegir cartas|カードを選ぶ|카드 고르기
pick.chosen|{spread}: {chosen} de {total} elegidas|{spread}：{total}枚中{chosen}枚選択|{spread}: {total}장 중 {chosen}장 선택
pick.expand|Ampliar|広げる|펼치기
pick.close|Cerrar|閉じる|닫기
pick.expandAria|Ampliar el mazo|デッキを広げる|덱 펼치기
pick.closeAria|Cerrar el mazo ampliado|広げたデッキを閉じる|펼친 덱 닫기
pick.reveal|Revelar lectura|カードを公開|리딩 공개
pick.card|Carta {number}|カード {number}|카드 {number}
pick.wheelAria|Rueda de cartas de tarot|回転するタロットデッキ|회전하는 타로 덱
pick.confirmCard|Confirmar carta {number}|カード{number}を確定|카드 {number} 확정
pick.liftCard|Levantar carta {number}|カード{number}を持ち上げる|카드 {number} 들어 올리기
reveal.openTitle|Las cartas están abiertas.|カードが開きました。|카드가 공개되었습니다.
reveal.openingTitle|Las cartas se están abriendo.|カードを開いています。|카드를 공개하는 중입니다.
reveal.manualTitle|Estas son las cartas que aparecieron.|選ばれたカードです。|당신에게 나온 카드입니다.
reveal.openSubtitle|Descubre hacia dónde apuntan.|カードが示すものを読んでみましょう。|카드가 가리키는 것을 읽어보세요.
reveal.openingSubtitle|La tirada se revelará en el orden que elegiste.|選んだ順にスプレッドが開いていきます。|선택한 순서대로 스프레드가 공개됩니다.
reveal.manualSubtitle|Gira cada carta cuando estés listo.|準備ができたら、一枚ずつめくってください。|준비되면 한 장씩 뒤집으세요.
reveal.spreadRevealed|Tirada revelada|スプレッド公開済み|스프레드 공개 완료
reveal.openingSequence|Secuencia de apertura|公開の順序|공개 순서
reveal.manualReveal|Revelar a mano|手動で公開|직접 공개
reveal.read|Leer mi Hint|Hintを読む|내 Hint 읽기
reveal.turnPosition|Gira {position} cuando estés listo.|準備ができたら{position}をめくってください。|준비되면 {position}을 뒤집으세요.
reveal.faceDown|{position}, boca abajo|{position}、裏向き|{position}, 뒷면
chat.title|Leer mi Hint|Hintを読む|내 Hint 읽기
chat.subtitle|Respuesta breve, cartas y conversación para profundizar.|短い答え、カード、その先は会話で深められます。|짧은 답변과 카드를 보고, 더 알고 싶으면 대화하세요.
chat.cardsDrawn|Cartas extraídas|引いたカード|뽑은 카드
chat.reading|Lectura|リーディング|리딩
chat.answer|Respuesta|答え|답변
chat.cards|Cartas|カード|카드
chat.nextStep|Próximo paso|次の一歩|다음 단계
chat.wantMore|¿Quieres profundizar?|もっと知りたいですか？|더 알고 싶나요?
chat.deepTitle|Profundiza en tu lectura|リーディングを深める|리딩 깊이 살펴보기
chat.deepBody|Explora cómo se conectan las cartas, qué aporta cada posición y tu próximo paso.|カードのつながり、各位置の意味、次の一歩を探ります。|카드의 연결, 각 위치의 의미와 다음 단계를 살펴보세요.
chat.deepOpen|Explorar más · Demo gratis|深く読む・無料デモ|깊이 읽기 · 무료 데모
chat.deepDemo|Gratis durante la demo. No usa créditos.|デモ期間中は無料です。クレジットは使いません。|데모 기간에는 무료입니다. 크레딧을 사용하지 않습니다.
chat.deepLoading|Profundizando…|詳しく読んでいます…|더 깊이 읽는 중…
chat.deepLoadingBody|La respuesta original permanece mientras Hint explora las mismas cartas.|同じカードを詳しく読む間も、元の答えは残ります。|Hint가 같은 카드를 살펴보는 동안 원래 답변은 유지됩니다.
chat.deepError|No se pudo terminar. La respuesta original se conserva. Reintenta cuando quieras.|詳しい解釈を完了できませんでした。元の答えは保持されています。再試行できます。|깊은 해석을 완료하지 못했습니다. 원래 답변은 유지됩니다. 다시 시도하세요.
chat.deepRetry|Reintentar lectura profunda · Demo gratis|詳しい解釈を再試行・無料デモ|깊은 해석 재시도 · 무료 데모
chat.deepShow|Leer la interpretación profunda|詳しい解釈を読む|깊은 해석 읽기
chat.deepHide|Cerrar interpretación profunda|詳しい解釈を閉じる|깊은 해석 닫기
chat.deepContextLabel|Un detalle para ayudar a Hint · Opcional|Hintが理解するための補足・任意|Hint가 이해할 수 있는 세부사항 · 선택
chat.deepContextPlaceholder|¿Qué es lo que más dificulta esta situación?|一番難しく感じることは何ですか？|이 일을 가장 어렵게 만드는 것은 무엇인가요?
chat.deepWhy|Por qué esta respuesta|この答えの理由|이 답변인 이유
chat.deepConnection|Cómo se conectan las cartas|カードのつながり|카드의 연결
chat.deepWatch|En qué fijarte|気をつけたいこと|살펴볼 점
chat.deepNext|Tu próximo paso|あなたの次の一歩|나의 다음 단계
chat.deepFeedbackQuestion|¿Te ayudó a comprender algo nuevo?|新しい気づきがありましたか？|새로운 것을 이해하는 데 도움이 되었나요?
chat.deepFeedback.yes|Sí|はい|네
chat.deepFeedback.somewhat|Un poco|少し|어느 정도
chat.deepFeedback.no|Aún no|まだ|아직요
chat.deepFeedbackThanks|Gracias. Tu opinión se guarda con esta lectura en este dispositivo.|ありがとうございます。感想はこの端末のリーディングと一緒に保存されます。|감사합니다. 의견은 이 기기의 리딩과 함께 저장됩니다.
chat.deepFeedbackPrivacy|Opinión opcional de la demo, guardada solo en este dispositivo.|デモの感想は任意で、この端末だけに保存されます。|선택적인 데모 의견이며 이 기기에만 저장됩니다.
chat.saved|Guardado en el historial. Puedes salir y volver después.|履歴に保存しました。離れても後で戻れます。|기록에 저장되었습니다. 나갔다가 돌아와도 됩니다.
chat.saveFailed|Los cambios no se guardaron aquí. Mantén la página abierta y reintenta.|変更をこの端末に保存できませんでした。ページを開いたまま再試行してください。|이 기기에 변경 사항을 저장하지 못했습니다. 페이지를 유지하고 다시 시도하세요.
chat.notSaved|Esta lectura no se ha guardado.|このリーディングは未保存です。|이 리딩은 저장되지 않았습니다.
chat.retrySave|Reintentar guardado|保存を再試行|저장 다시 시도
chat.unsavedLeave|Hay cambios sin guardar. ¿Salir de todos modos?|未保存の変更があります。それでも離れますか？|저장되지 않은 변경 사항이 있습니다. 그래도 나갈까요?
chat.history|Historial|履歴|기록
chat.leave|Salir de la sala|部屋を出る|방 나가기
chat.newReading|Nueva lectura|新しいリーディング|새 리딩
chat.placeholder|Pregunta lo que quieras comprender ahora…|次に知りたいことを聞いてください…|다음으로 이해하고 싶은 것을 물어보세요…
chat.pending|Hint está leyendo…|Hintが読んでいます…|Hint가 읽고 있습니다…
chat.savedTitle|Guardado en el historial|履歴に保存済み|기록에 저장됨
chat.savedBody|La conversación seguirá aquí cuando vuelvas.|戻ったときもこの会話は残っています。|다시 돌아와도 대화가 남아 있습니다.
chat.openHistory|Abrir historial de lecturas|リーディング履歴を開く|리딩 기록 열기
chat.returnHome|Volver al inicio|ホームに戻る|홈으로 돌아가기
chat.cardCount|{count} cartas|{count}枚|카드 {count}장
chat.upright|derecha|正位置|정방향
chat.reversed|invertida|逆位置|역방향
chat.cardPreview|Detalle de la carta|カードの詳細|카드 상세
chat.previewCardAria|Vista previa: {position}, {card}, {orientation}|プレビュー：{position}、{card}、{orientation}|미리보기: {position}, {card}, {orientation}
chat.deepBackToAnswer|Volver a la respuesta breve|短い答えに戻る|짧은 답변으로 돌아가기
chat.cardHintTitle|Toca una carta para verla de cerca|カードをタップして詳しく見る|카드를 눌러 자세히 보기
chat.cardHintBody|Abre cualquier carta y toca o pellizca para ampliar la ilustración.|カードを開き、タップやピンチで絵柄を拡大できます。|카드를 열고 누르거나 두 손가락으로 그림을 확대하세요.
chat.dismissCardHint|Cerrar consejo de cartas|カードのヒントを閉じる|카드 도움말 닫기
chat.closeCardPreview|Cerrar detalle de la carta|カードの詳細を閉じる|카드 상세 닫기
chat.previousCard|Carta anterior|前のカード|이전 카드
chat.nextCard|Siguiente carta|次のカード|다음 카드
chat.zoomOut|Alejar|縮小|축소
chat.zoomIn|Acercar|拡大|확대
chat.resetZoom|Restablecer ampliación|拡大をリセット|확대 초기화
chat.toggleCardZoom|Alternar ampliación de carta|カードの拡大を切り替える|카드 확대 전환
chat.defaultQuestion|¿Qué necesito comprender ahora?|今、何を理解すればよいですか？|지금 무엇을 이해해야 할까요?
chat.networkFallback|La lectura en línea no está disponible; esta respuesta usa el contexto local.|オンラインのリーディングを利用できないため、端末の文脈を使った返答です。|온라인 리딩을 사용할 수 없어 기기에 저장된 맥락으로 답했습니다.
chat.send|Enviar pregunta de seguimiento|追加の質問を送る|후속 질문 보내기
chat.generating|Leyendo las cartas…|カードを読んでいます…|카드를 읽는 중…
chat.retryReading|Actualizar interpretación|解釈を更新|해석 새로고침
chat.share|Compartir|共有|공유
chat.receive|Recibir|受け取る|받기
chat.receiveTitle|Recibe tu lectura|リーディングを受け取る|리딩 받기
chat.receiveSubtitle|Mira cómo las cartas se convierten en un recuerdo privado.|一枚ずつ、あなたの記念のカードになっていきます。|카드가 나만의 기념이 되는 순간을 보세요.
chat.closeReceipt|Cerrar recuerdo|記念カードを閉じる|리딩 카드 닫기
chat.printing|Preparando tu lectura…|リーディングを印刷中…|리딩을 인쇄하는 중…
chat.receiptReady|Tu lectura está lista.|リーディングの準備ができました。|리딩이 준비되었습니다.
chat.receiptInsight|El mensaje|メッセージ|메시지
chat.shareReceipt|Compartir recuerdo|記念カードを共有|리딩 카드 공유
chat.sharePreparing|Preparando|準備中|준비 중
chat.shareSharing|Abriendo opciones para compartir|共有画面を開いています|공유 화면 여는 중
chat.shareQuestion|Incluir mi pregunta privada|個人的な質問を含める|내 개인 질문 포함
chat.shared|Compartido|共有しました|공유됨
chat.imageSaved|Imagen guardada|画像を保存しました|이미지 저장됨
chat.shareRetry|Reintentar|再試行|다시 시도
chat.followUp.next|¿Qué debería hacer ahora?|次に何をすればよいですか？|다음에 무엇을 해야 할까요?
chat.followUp.release|¿Qué debería dejar de sostener?|何を手放すとよいですか？|무엇을 놓아야 할까요?
chat.followUp.truth|¿Cuál es la verdad silenciosa aquí?|ここにある静かな真実は何ですか？|여기에 담긴 조용한 진실은 무엇인가요?
`);
Object.assign(FLOW_COPY.zh, { "login.signedInAs": "当前本机身份", "login.changeAccount": "需要更换本机身份？可先退出，或使用下方的其他邮箱或电话号码。" });
add("login.", `
signedInAs|Identidad local actual|現在の端末内のユーザー|현재 기기 내 사용자
changeAccount|¿Otra identidad local? Cierra la sesión o usa otro correo o teléfono abajo.|別の端末内ユーザーを使うには、ログアウトするか別のメール・電話番号を入力してください。|다른 기기 내 사용자를 쓰려면 로그아웃하거나 아래에 다른 이메일 또는 전화번호를 입력하세요.
`);
