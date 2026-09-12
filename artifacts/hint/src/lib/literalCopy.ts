import type { HintLanguage } from "./i18n";
export const LITERAL_COPY: Record<string, Record<HintLanguage, string>> = {};
function add(lines: string) {
  for (const line of lines.trim().split("\n")) {
    const [en, zh, es, ja, ko] = line.split("|");
    if (!en || !zh || !es || !ja || !ko) throw new Error(`Incomplete page translation: ${en}`);
    LITERAL_COPY[en] = { en, zh, es, ja, ko };
  }
}
add(`
Card reflection ✦|牌卡反思 ✦|Reflexión de la carta ✦|カードの振り返り ✦|카드 성찰 ✦
Reveal one daily card for a general reflection. Personal chart calculations are available in Astrology.|揭示一张今日牌，进行一般反思。个人星盘计算请前往占星页面。|Revela una carta diaria para reflexionar. Los cálculos de tu carta personal están en Astrología.|今日のカードで振り返りましょう。個人の出生図は占星術で計算できます。|오늘의 카드로 성찰해 보세요. 개인 차트 계산은 점성술에서 이용할 수 있어요.
Your profile could not be saved. Keep your details here and try again.|无法保存个人资料，输入仍保留，请重试。|No se pudo guardar el perfil. Tus datos siguen aquí; inténtalo de nuevo.|プロフィールを保存できませんでした。入力内容は残っています。再試行してください。|프로필을 저장하지 못했어요. 입력 정보는 남아 있어요. 다시 시도해 주세요.
Your sky|你的天空|Tu cielo|あなたの空|나의 하늘
Start with the details that matter.|从有用的资料开始。|Empieza por los datos importantes.|必要な情報から始めましょう。|필요한 정보부터 시작해요.
Your date sets your sun sign. Birth time and city refine your rising sign and houses.|生日用于星座主题。准确时间和地点用于计算个人上升与宫位。|La fecha permite explorar el signo solar. La hora y el lugar exactos permiten calcular el ascendente y las casas.|誕生日は太陽星座のテーマに使います。上昇点とハウスの計算には正確な時刻と場所が必要です。|생일로 태양 별자리 주제를 살펴봐요. 상승점과 하우스 계산에는 정확한 시간과 장소가 필요해요.
What should Hint call you?|Hint 应该怎么称呼你？|¿Cómo te llamamos?|お名前を教えてください|어떻게 불러드릴까요?
One intention|一个意向|Una intención|ひとつの意図|하나의 의도
What should Hint notice first?|你想先关注什么？|¿Qué quieres explorar primero?|最初に何を見つめますか？|무엇부터 살펴볼까요?
Choose the area you want your first readings to lean toward. You can change this later.|选择首次阅读的关注方向，之后可以修改。|Elige el tema de tus primeras lecturas. Puedes cambiarlo después.|最初のリーディングのテーマを選びましょう。後で変更できます。|첫 리딩의 주제를 골라요. 나중에 바꿀 수 있어요.
Love & relationships|爱情与关系|Amor y relaciones|恋愛と人間関係|사랑과 관계
Connection, boundaries, and closeness|连结、界线与亲密|Conexión, límites y cercanía|つながり・境界・親密さ|연결, 경계, 친밀함
Career & study|工作与学习|Trabajo y estudios|仕事と学習|일과 공부
Direction, timing, and momentum|方向、时机与动力|Dirección, momento e impulso|方向・タイミング・勢い|방향, 시기, 추진력
Self & patterns|自我与模式|Tu interior y tus patrones|自分と行動パターン|나 자신과 패턴
Emotions, habits, and inner growth|情感、习惯与内在成长|Emociones, hábitos y crecimiento interior|感情・習慣・内面の成長|감정, 습관, 내면의 성장
A decision|一个决定|Una decisión|ひとつの決断|하나의 결정
See the situation from a clearer angle|从更清楚的角度看事情|Ver la situación con más claridad|状況をより明確な視点から見る|더 명확한 관점에서 상황 보기
Six-digit code|六位演示码|Código de seis dígitos|6桁のデモコード|6자리 데모 코드
Saving...|正在保存…|Guardando…|保存中…|저장 중…
Verify & enter Hint|确认并进入 Hint|Confirmar y entrar en Hint|確認して Hint に入る|확인하고 Hint 시작
Send sign-in code|生成本机演示码|Generar código de demostración local|ローカルのデモコードを生成|로컬 데모 코드 생성
That code does not match. Try the six digits shown below.|演示码不符，请输入下方六位数字。|El código no coincide. Usa los seis dígitos que aparecen abajo.|コードが一致しません。下の6桁を入力してください。|코드가 일치하지 않아요. 아래 여섯 자리를 입력해 주세요.
Invite unavailable|邀请不可用|Invitación no disponible|招待を利用できません|초대 이용 불가
Shared chart|双人星盘|Carta compartida|共有チャート|공유 차트
Loading invitation...|正在读取邀请…|Cargando invitación…|招待を読み込み中…|초대 불러오는 중…
Calculation in progress|正在计算|Cálculo en curso|計算中|계산 진행 중
This invitation already has a calculation in progress.|此邀请已有计算正在进行。|Esta invitación ya tiene un cálculo en curso.|この招待はすでに計算中です。|이 초대는 이미 계산 중이에요.
Invite not found.|找不到邀请。|No se encontró la invitación.|招待が見つかりません。|초대를 찾을 수 없어요.
This invitation has expired.|此邀请已到期。|Esta invitación ha caducado.|招待の有効期限が切れています。|초대가 만료됐어요.
Invite service unavailable. Please retry.|邀请服务不可用，请重试。|Servicio de invitaciones no disponible. Reinténtalo.|招待サービスを利用できません。再試行してください。|초대 서비스를 사용할 수 없어요. 다시 시도해 주세요.
Calculation could not be completed. Your details are still here; retry.|计算未完成，你的资料仍保留，请重试。|No se pudo completar el cálculo. Tus datos siguen aquí; reinténtalo.|計算を完了できませんでした。情報は保持されています。再試行してください。|계산을 완료하지 못했어요. 입력 정보는 남아 있어요. 다시 시도해 주세요.
Could not complete invite.|无法完成邀请。|No se pudo completar la invitación.|招待を完了できませんでした。|초대를 완료하지 못했어요.
Could not create invite.|无法建立邀请。|No se pudo crear la invitación.|招待を作成できませんでした。|초대를 만들지 못했어요.
Opening compatibility result...|正在打开合盘结果…|Abriendo resultado de compatibilidad…|相性の結果を開いています…|궁합 결과 여는 중…
Result unavailable. The link may have been removed.|结果不可用，链接可能已被移除。|Resultado no disponible. El enlace puede haberse eliminado.|結果を利用できません。リンクが削除された可能性があります。|결과를 이용할 수 없어요. 링크가 삭제되었을 수 있어요.
Could not refresh this result. Retry when connected.|无法更新结果，连线后请重试。|No se pudo actualizar. Reinténtalo con conexión.|更新できませんでした。接続後に再試行してください。|결과를 새로고침하지 못했어요. 연결 후 다시 시도해 주세요.
Your birth details|你的出生资料|Tus datos natales|あなたの出生情報|내 출생 정보
These details are used only for this shared comparison. Review them before continuing.|这些资料用于本次双人比较，请先确认再继续。|Estos datos se usan para esta comparación. Revísalos antes de continuar.|この情報は今回の比較に使われます。続ける前に確認してください。|이 정보는 이번 비교에 사용돼요. 계속하기 전에 확인해 주세요.
Add your birth details only if you consent. Hint will build a shared compatibility preview from both charts.|仅在同意时填写出生资料，Hint 将使用双方星盘进行合盘预览。|Añade tus datos solo si das tu consentimiento. Hint creará una comparación de ambas cartas.|同意する場合のみ出生情報を入力してください。Hint が双方のチャートを比較します。|동의하는 경우에만 출생 정보를 입력해 주세요. Hint가 두 차트를 비교해요.
Comparison of the saved birth inputs. Scores are symbolic reflection prompts, not measured relationship outcomes.|比较已保存的出生资料。分数仅是象征性反思提示，并非关系成效的测量。|Comparación de los datos guardados. Las puntuaciones son símbolos para reflexionar, no medidas del éxito de una relación.|保存された出生情報の比較です。スコアは振り返りの象徴であり、関係の成果を測る数値ではありません。|저장된 출생 정보를 비교해요. 점수는 성찰을 위한 상징이며 관계의 성과를 측정한 값이 아니에요.
Initiative · courage · directness|主动 · 勇气 · 直接|Iniciativa · valentía · franqueza|行動力・勇気・率直さ|주도성 · 용기 · 솔직함
Patience · steadiness · the senses|耐心 · 稳定 · 感官|Paciencia · estabilidad · sentidos|忍耐・安定・感覚|인내 · 안정 · 감각
Curiosity · language · connection|好奇 · 表达 · 连结|Curiosidad · lenguaje · conexión|好奇心・言葉・つながり|호기심 · 언어 · 연결
Care · belonging · protection|关怀 · 归属 · 保护|Cuidado · pertenencia · protección|気遣い・居場所・保護|돌봄 · 소속 · 보호
Warmth · creativity · expression|温暖 · 创意 · 表现|Calidez · creatividad · expresión|温かさ・創造性・表現|따뜻함 · 창의성 · 표현
Discernment · practice · usefulness|辨识 · 练习 · 实用|Discernimiento · práctica · utilidad|見極め・実践・実用性|분별 · 연습 · 유용함
Balance · partnership · perspective|平衡 · 合作 · 视角|Equilibrio · colaboración · perspectiva|バランス・協力・視点|균형 · 협력 · 관점
Depth · honesty · transformation|深度 · 坦诚 · 转变|Profundidad · honestidad · transformación|深さ・誠実さ・変容|깊이 · 정직 · 변화
Exploration · meaning · openness|探索 · 意义 · 开放|Exploración · sentido · apertura|探究・意味・開放性|탐구 · 의미 · 열린 마음
Responsibility · structure · persistence|责任 · 结构 · 坚持|Responsabilidad · estructura · constancia|責任・構造・粘り強さ|책임 · 구조 · 끈기
Originality · community · independence|独创 · 群体 · 独立|Originalidad · comunidad · independencia|独創性・共同体・自立|독창성 · 공동체 · 독립
Imagination · empathy · sensitivity|想象 · 共情 · 敏感|Imaginación · empatía · sensibilidad|想像力・共感・感受性|상상력 · 공감 · 감수성
Fire|火象|Fuego|火|불
Earth|土象|Tierra|地|땅
Air|风象|Aire|風|공기
Water|水象|Agua|水|물
Cardinal|基本|Cardinal|活動|활동
Fixed|固定|Fijo|固定|고정
Mutable|变动|Mutable|柔軟|변동
Identity & expression|自我与表达|Identidad y expresión|自分らしさと表現|정체성과 표현
Emotional needs|情感需求|Necesidades emocionales|心のニーズ|감정적 필요
How you meet the world|面对世界的方式|Cómo te acercas al mundo|世界との向き合い方|세상을 만나는 방식
Communication|沟通|Comunicación|コミュニケーション|소통
Affection & values|亲密与价值|Afecto y valores|愛情と価値観|애정과 가치관
Action & drive|行动与动力|Acción e impulso|行動と意欲|행동과 추진력
House|宫位|Casa|ハウス|하우스
Retrograde|逆行|Retrógrado|逆行|역행
Zodiac signs|十二星座|Signos zodiacales|12星座|열두 별자리
Birth chart|出生星盘|Carta natal|出生図|출생 차트
Transits|行运|Tránsitos|トランジット|트랜짓
Birth details|出生资料|Datos natales|出生情報|출생 정보
Report previews|报告预览|Vistas previas de informes|レポートのプレビュー|보고서 미리보기
Personal placements|个人配置|Posiciones personales|個人の配置|개인 배치
Start with your birth details|从出生资料开始|Empieza por tus datos natales|出生情報から始める|출생 정보부터 시작하기
A personal chart needs your birth date, time, and place. If your time is unknown, explore the zodiac guide first. We won’t guess your Moon, Ascendant, or houses.|个人星盘需要出生日期、时间和地点。时间未知时先探索星座指南；不会猜测月亮、上升或宫位。|La carta personal necesita fecha, hora y lugar de nacimiento. Si no conoces la hora, empieza por los signos. No inventaremos tu Luna, ascendente ni casas.|個人の出生図には生年月日・時刻・場所が必要です。時刻が不明なら星座ガイドから始めましょう。月・上昇点・ハウスは推測しません。|개인 차트에는 출생 날짜, 시간, 장소가 필요해요. 시간을 모르면 별자리 안내부터 보세요. 달, 상승점, 하우스를 추측하지 않아요.
Log in to save birth details|登录以保存出生资料|Acceder para guardar datos natales|プロフィールで出生情報を保存|프로필에서 출생 정보 저장
Calculating chart…|正在计算星盘…|Calculando carta…|チャートを計算中…|차트 계산 중…
Calculate birth chart|计算出生星盘|Calcular carta natal|出生図を計算|출생 차트 계산
Explore zodiac signs first|先了解十二星座|Explorar primero los signos|まず12星座を見る|별자리부터 살펴보기
Leave birth time blank if you don’t know it. An invented time can change the Ascendant, houses, and Moon placement.|不知道出生时间时请留空，猜测时间会影响上升、宫位与月亮配置。|Deja la hora vacía si no la sabes. Inventarla puede cambiar el ascendente, las casas y la Luna.|出生時刻が不明なら空欄にしてください。仮の時刻は上昇点・ハウス・月の配置を変えることがあります。|출생 시간을 모르면 비워 두세요. 임의의 시간은 상승점, 하우스, 달의 배치를 바꿀 수 있어요.
Save birth details|保存出生资料|Guardar datos natales|出生情報を保存|출생 정보 저장
Back to birth chart|返回出生星盘|Volver a la carta natal|出生図に戻る|출생 차트로 돌아가기
In preview|预览中|En vista previa|プレビュー|미리보기
Deeper readings|深入阅读|Lecturas más profundas|詳しいリーディング|심화 리딩
These are planned report topics. Full personal reports are not available yet.|这些是规划中的报告主题，完整个人报告尚未提供。|Estos son temas previstos. Los informes personales completos aún no están disponibles.|これらは予定されているテーマです。完全な個人レポートはまだ提供されていません。|예정된 보고서 주제예요. 완전한 개인 보고서는 아직 제공되지 않아요.
Explore your birth chart|查看出生星盘|Explorar tu carta natal|自分の出生図を見る|내 출생 차트 살펴보기
Astrology is a reflection tool, not a guaranteed prediction. Your birth details and chart are stored with the local profile on this device.|占星用于反思，并非确定预测。出生资料和星盘随本机个人档案保存。|La astrología sirve para reflexionar, no garantiza predicciones. Tus datos y carta se guardan en el perfil local de este dispositivo.|占星術は振り返りの道具であり、確実な予言ではありません。出生情報とチャートはこの端末のローカルプロフィールに保存されます。|점성술은 성찰 도구이며 확정된 예측이 아니에요. 출생 정보와 차트는 이 기기의 로컬 프로필에 저장돼요.
A little context for your sky|认识你的天空|Un poco de contexto para tu cielo|あなたの空を知るために|나의 하늘을 이해하기
Start with the signs, explore your birth chart, then see how today’s sky connects.|从星座入门，探索出生星盘，再了解今天的天空如何与之连接。|Empieza por los signos, explora tu carta natal y descubre cómo se relaciona el cielo de hoy.|星座を知り、出生図を読み、今日の空とのつながりを見てみましょう。|별자리를 알고 출생 차트를 살핀 뒤 오늘의 하늘과 연결해 보세요.
The building blocks|入门|Las bases|基本の要素|기본 요소
A sign is one part of a chart|星座是星盘的一部分|Un signo es una parte de la carta|星座はチャートの一部|별자리는 차트의 한 부분
“My sign” usually means your Sun sign. Your full chart includes many more placements.|“我的星座”通常指太阳星座，完整星盘还有更多配置。|«Mi signo» suele referirse al signo solar. La carta completa incluye muchas otras posiciones.|「自分の星座」は通常、太陽星座を指します。出生図には他にも多くの配置があります。|‘내 별자리’는 보통 태양 별자리를 뜻해요. 전체 차트에는 더 많은 배치가 있어요.
Explore the twelve signs|探索十二星座|Explora los doce signos|12星座を知る|열두 별자리 살펴보기
Sign notes|星座笔记|Notas del signo|星座のメモ|별자리 메모
The element describes a symbolic style; the modality describes initiating, sustaining, or adapting. The same sign takes on a different role depending on the planet.|元素描述象征风格；模式描述开始、维持或适应。相同星座在不同行星上有不同角色。|El elemento describe un estilo simbólico; la modalidad, cómo se inicia, sostiene o adapta. Un signo cumple un papel distinto según el planeta.|エレメントは象徴的な表現を、区分は始める・維持する・適応する傾向を示します。同じ星座でも惑星によって役割が変わります。|원소는 상징적 표현을, 양식은 시작·유지·적응의 경향을 나타내요. 같은 별자리도 행성에 따라 역할이 달라져요.
In your chart:|你的星盘中：|En tu carta:|あなたのチャート：|내 차트에서:
None of your returned placements are in this sign.|返回的配置中没有行星落在此星座。|Ninguna posición recibida está en este signo.|返された配置に、この星座の天体はありません。|반환된 배치 중 이 별자리에 있는 천체가 없어요.
How do signs and charts connect?|星座和星盘如何连接？|¿Cómo se relacionan signos y cartas?|星座とチャートのつながりは？|별자리와 차트는 어떻게 연결될까요?
These are the twelve signs of the tropical zodiac, used here for learning and reflection. They are not the astronomical constellations or a personality diagnosis.|这里的回归黄道十二星座用于学习与反思，不是天文学星座或性格诊断。|Estos son los doce signos del zodiaco tropical, para aprender y reflexionar. No son constelaciones astronómicas ni un diagnóstico de personalidad.|ここではトロピカル方式の12星座を学びと振り返りに使います。天文学の星座や性格診断とは異なります。|여기서는 회귀 황도의 열두 별자리를 배움과 성찰에 사용해요. 천문학적 별자리나 성격 진단이 아니에요.
A chart includes the Sun, Moon, and other planets. The Ascendant and houses depend on an accurate birth time and place.|星盘包括太阳、月亮与其他行星；上升和宫位取决于准确出生时间与地点。|La carta incluye el Sol, la Luna y otros planetas. El ascendente y las casas dependen de la hora y el lugar exactos de nacimiento.|出生図には太陽・月・他の惑星が含まれます。アセンダントとハウスには正確な出生時刻と場所が必要です。|차트에는 태양, 달, 다른 행성이 포함돼요. 상승점과 하우스에는 정확한 출생 시간과 장소가 필요해요.
Connect this to my birth chart|连接到我的出生星盘|Conectar con mi carta natal|自分の出生図につなげる|내 출생 차트와 연결하기
Your sky at birth|出生时的天空|Tu cielo al nacer|生まれたときの空|태어났을 때의 하늘
Planets describe themes, signs describe expression, houses describe areas of life, and aspects connect the placements.|行星代表主题，星座描述表达方式，宫位代表生活领域，相位连接配置。|Los planetas describen temas; los signos, la expresión; las casas, áreas de vida; y los aspectos conectan las posiciones.|惑星はテーマ、星座は表現、ハウスは生活分野を表し、アスペクトは配置を結びます。|행성은 주제, 별자리는 표현, 하우스는 삶의 영역을 나타내고, 각은 배치를 연결해요.
Time unknown|时间未知|Hora desconocida|時刻不明|시간 모름
Edit birth details|编辑出生资料|Editar datos natales|出生情報を編集|출생 정보 수정
Not available|未提供|No disponible|情報なし|정보 없음
Only placements returned by the calculation are shown. Missing points stay unavailable.|仅显示计算返回的配置，缺少的资料保持未知。|Solo se muestran las posiciones recibidas. Los datos que faltan quedan sin determinar.|計算から返された配置だけを表示します。不足している情報は不明のままにします。|계산에서 반환된 배치만 표시해요. 빠진 정보는 알 수 없음으로 남겨요.
Read the chart|看懂星盘|Leer la carta|チャートを読む|차트 읽기
The wheel maps zodiac signs and planet positions. Read the exact values below; missing houses and aspects are not filled in.|圆环显示星座与行星位置，精确值见下方；不会补入缺少的宫位和相位。|La rueda muestra signos y planetas. Los valores exactos están abajo; no se inventan casas ni aspectos ausentes.|円は星座と惑星の位置を示します。正確な値は下で確認できます。不明なハウスやアスペクトは補いません。|원은 별자리와 행성 위치를 보여줘요. 정확한 값은 아래에서 확인하며, 없는 하우스와 각은 채우지 않아요.
Planet placements|行星配置|Posiciones planetarias|惑星の配置|행성 배치
Aspects: connections between placements|相位：配置之间的关系|Aspectos: conexiones entre posiciones|アスペクト：配置のつながり|각: 배치 사이의 연결
Conjunctions combine themes; trines and sextiles suggest ease; squares and oppositions suggest tension. They are not a verdict of good or bad.|合相连接主题；三分和六分象征流畅；四分和对分象征张力，并非好坏判决。|Las conjunciones unen temas; trígonos y sextiles sugieren fluidez; cuadrados y oposiciones, tensión. No son un juicio de bueno o malo.|合はテーマを結び、トラインとセクスタイルは流れを、スクエアとオポジションは緊張を象徴します。善悪の判定ではありません。|합은 주제를 연결하고, 삼분각과 육분각은 흐름을, 사분각과 대립각은 긴장을 상징해요. 좋고 나쁨의 판결은 아니에요.
No aspect data was returned by this calculation.|这次计算未返回相位资料。|Este cálculo no devolvió aspectos.|今回の計算ではアスペクト情報が返されませんでした。|이번 계산에서 각 정보가 반환되지 않았어요.
Houses: areas of life|宫位：生活领域|Casas: áreas de vida|ハウス：生活の分野|하우스: 삶의 영역
Houses were not returned. Houses and the Ascendant require an accurate birth time and place.|未返回宫位。宫位和上升需要准确的出生时间与地点。|No se recibieron casas. Las casas y el ascendente requieren hora y lugar exactos de nacimiento.|ハウス情報がありません。ハウスとアセンダントには正確な出生時刻と場所が必要です。|하우스 정보가 없어요. 하우스와 상승점에는 정확한 출생 시간과 장소가 필요해요.
Next, look at today|接着看看今天|Después, mira el presente|次に今日の空を見る|이제 오늘을 살펴봐요
Your natal placements stay fixed. Transits describe how the moving sky relates to those placements later.|出生配置固定，行运描述之后的天空如何与之形成关系。|Las posiciones natales son fijas. Los tránsitos describen cómo se relaciona con ellas el cielo en movimiento.|出生時の配置は固定です。トランジットは、その配置と移りゆく空との関係を表します。|출생 배치는 고정돼요. 트랜짓은 움직이는 하늘과 그 배치의 관계를 나타내요.
Explore today’s transits|查看今日行运|Explorar los tránsitos de hoy|今日のトランジットを見る|오늘의 트랜짓 보기
Refreshing chart…|正在更新星盘…|Actualizando carta…|チャートを更新中…|차트 업데이트 중…
Refresh chart calculation|重新计算星盘|Recalcular carta|チャートを再計算|차트 다시 계산
The moving sky|流动的天空|El cielo en movimiento|移りゆく空|움직이는 하늘
Today’s transits|今日行运|Tránsitos de hoy|今日のトランジット|오늘의 트랜짓
Transits compare moving planets with your natal placements. They are different from your fixed birth chart and from a general Sun-sign horoscope.|行运比较运行行星与出生配置，区别于固定出生星盘及一般太阳星座运势。|Los tránsitos comparan los planetas en movimiento con tu carta natal. Son distintos de la carta fija y del horóscopo solar general.|トランジットは動く惑星と出生時の配置を比較します。固定された出生図や一般的な太陽星座占いとは異なります。|트랜짓은 움직이는 행성과 출생 배치를 비교해요. 고정된 출생 차트나 일반적인 태양 별자리 운세와 달라요.
Loading transits…|正在读取行运…|Cargando tránsitos…|トランジットを読み込み中…|트랜짓 불러오는 중…
Refresh transits|更新行运|Actualizar tránsitos|トランジットを更新|트랜짓 새로고침
Checking the latest available calculation…|正在查看最新计算…|Consultando el cálculo más reciente…|最新の計算を確認中…|최신 계산 확인 중…
Personal transits are unavailable right now. Please try again later.|个人行运暂时不可用，请稍后重试。|Los tránsitos personales no están disponibles. Inténtalo más tarde.|個人トランジットは現在利用できません。後でもう一度お試しください。|개인 트랜짓을 지금 사용할 수 없어요. 나중에 다시 시도해 주세요.
Calculation date:|计算日期：|Fecha del cálculo:|計算日：|계산 날짜:
Timing and context|时间与依据|Fechas y contexto|時期と背景|시기와 배경
Starts:|开始：|Inicio:|開始：|시작:
Exact:|精确相位：|Exacto:|正確な時点：|정확한 시점:
Ends:|结束：|Fin:|終了：|종료:
Exact timing was not supplied.|未提供精确时间。|No se proporcionó la hora exacta.|正確な時刻は提供されていません。|정확한 시간이 제공되지 않았어요.
Orb:|容许度：|Orbe:|オーブ：|오브:
No transits returned|没有返回行运|Sin tránsitos recibidos|トランジット情報なし|반환된 트랜짓 없음
The calculation returned no transits to display. This is not a prediction about how your day will go.|计算未返回可显示的行运，这并不预测今天将如何发展。|El cálculo no devolvió tránsitos. Esto no predice cómo será tu día.|表示できるトランジットが返されませんでした。今日の良し悪しを予測するものではありません。|표시할 트랜짓이 반환되지 않았어요. 오늘 하루에 대한 예측은 아니에요.
Do|建议行动|Qué hacer|試してみること|해볼 일
Avoid|避免|Qué evitar|避けたいこと|피할 일
Work / study|工作与学习|Trabajo y estudio|仕事・学習|일과 공부
Self|自我|Contigo|自分自身|나 자신
Why this card|为什么是这张牌|Por qué esta carta|このカードの理由|이 카드의 이유
Locked|未解锁|Sin desbloquear|未解放|잠김
Moon Moth|月蛾|Polilla lunar|月の蛾|달 나방
Black Cat|黑猫|Gato negro|黒猫|검은 고양이
White Stag|白鹿|Ciervo blanco|白い鹿|흰 사슴
Night Swan|夜天鹅|Cisne nocturno|夜の白鳥|밤의 백조
Amber Fox|琥珀狐|Zorro ámbar|琥珀の狐|호박빛 여우
Silver Rabbit|银兔|Conejo plateado|銀の兎|은빛 토끼
Golden Lion|金狮|León dorado|金の獅子|황금 사자
Soft signal|轻柔信号|Señal suave|静かなサイン|부드러운 신호
Threshold|门槛|Umbral|境界|문턱
Direction|方向|Dirección|方向|방향
Release|放下|Soltar|手放す|놓아주기
Strategy|策略|Estrategia|戦略|전략
Sensitivity|敏感度|Sensibilidad|繊細さ|섬세함
Courage|勇气|Valentía|勇気|용기
You are picking up a quiet truth before it has words.|你在言语出现前，就察觉了安静的真实。|Captas una verdad silenciosa antes de que tenga palabras.|言葉になる前の静かな真実を感じ取っています。|말이 되기 전의 조용한 진실을 느끼고 있어요.
Move toward the thing that keeps glowing after everything else gets loud.|走向那件在喧闹之后仍然发光的事。|Acércate a lo que sigue brillando cuando todo lo demás hace ruido.|周りが騒がしくなっても輝き続けるものへ進んで。|주변이 시끄러워져도 계속 빛나는 것을 향해 가요.
What small signal has been repeating, even when you try to ignore it?|有什么小信号，即使你忽略它，也一直重复出现？|¿Qué señal pequeña se repite incluso cuando intentas ignorarla?|無視しようとしても繰り返し現れる、小さなサインは何ですか？|무시하려 해도 반복되는 작은 신호는 무엇인가요?
Choose one quiet action before asking for another sign.|寻找下一个信号之前，先做一件安静的小事。|Elige una acción tranquila antes de pedir otra señal.|次のサインを求める前に、静かな行動を一つ選んで。|다음 신호를 찾기 전에 조용한 행동 하나를 골라요.
Your instinct noticed a doorway before your mind named it.|在头脑说清楚之前，直觉已经发现了入口。|Tu instinto vio una puerta antes de que tu mente la nombrara.|頭で言葉にする前に、直感が入口に気づきました。|머리가 이름 붙이기 전에 직감이 입구를 알아봤어요.
Trust the pause. You do not need to cross every threshold the moment it appears.|相信停顿。不是每扇门一出现，你就得跨过去。|Confía en la pausa. No tienes que cruzar cada umbral en cuanto aparece.|立ち止まることを信じて。現れたすべての境界をすぐ越える必要はありません。|멈춤을 믿어요. 나타나는 모든 문턱을 즉시 넘을 필요는 없어요.
Where is your body asking you to slow down before you answer?|回应之前，你的身体在哪件事上提醒你放慢？|¿Dónde te pide el cuerpo ir más despacio antes de responder?|返事をする前に、体がゆっくり進むよう求めているのはどこですか？|답하기 전에 몸이 천천히 하라고 말하는 부분은 어디인가요?
Wait one breath longer before replying to anything emotionally loaded.|面对情绪强烈的话题，多等一口呼吸再回答。|Respira una vez más antes de responder a algo emocionalmente intenso.|感情が強く動く話題には、もう一呼吸置いてから返事を。|감정이 실린 말에는 한 번 더 숨을 쉬고 답해요.
Dignity is the compass. Performance is only noise.|尊严是指南针，表演只是噪音。|La dignidad es la brújula; la actuación es solo ruido.|尊厳が羅針盤。見せかけは雑音です。|존엄이 나침반이에요. 보여주기는 소음일 뿐이에요.
Choose the path that lets you stand taller tomorrow.|选择让明天的你更能抬头挺胸的路。|Elige el camino que mañana te permita sentir más dignidad.|明日の自分が胸を張れる道を選んで。|내일 더 당당해질 수 있는 길을 골라요.
Which option feels quieter but more self-respecting?|哪个选择更安静，却更尊重自己？|¿Qué opción es más tranquila y respeta más quién eres?|静かでも、自分をより大切にできる選択はどれですか？|더 조용하지만 나를 존중하는 선택은 무엇인가요?
Make one clean decision and leave the explanation short.|做一个清楚的决定，解释简短就好。|Toma una decisión clara y explícalo brevemente.|明確な決断を一つ。説明は短くて大丈夫。|분명한 결정 하나를 내리고 설명은 짧게 해요.
Something can be graceful and still be complete.|美好的事物，也可以已经结束。|Algo puede ser hermoso y haber terminado.|美しいものにも、終わりはあります。|아름다운 것도 끝날 수 있어요.
Let the old shape leave cleanly. Do not keep touching the ending to prove it mattered.|让旧的形式完整离开，别反复触碰结局来证明它重要。|Deja ir la forma antigua. No revivas el final para probar que importó.|古い形をすっきり手放して。大切だった証明のために、終わりへ触れ続けなくていいのです。|오래된 형태를 깨끗이 보내요. 중요했다는 걸 증명하려고 끝을 계속 건드리지 않아도 돼요.
What are you ready to stop carrying with both hands?|你准备好不再双手紧抱着什么？|¿Qué estás listo para dejar de sostener con ambas manos?|両手で抱え続けるのをやめられそうなものは何ですか？|두 손으로 붙잡고 있던 무엇을 이제 놓을 준비가 됐나요?
Remove one reminder that keeps reopening the same feeling.|移开一个总让相同感受再次涌现的提醒物。|Aparta un recordatorio que reabre la misma emoción.|同じ気持ちを繰り返し呼び起こすものを、一つ片づけて。|같은 감정을 다시 불러오는 물건이나 알림 하나를 치워요.
You do not need more force. You need cleaner timing.|你不需要更用力，而是更清楚的时机。|No necesitas más fuerza, sino un mejor momento.|さらに力を入れるより、よいタイミングが必要です。|더 큰 힘보다 더 적절한 타이밍이 필요해요.
Move lightly. Say less, observe more, and use the opening that is already there.|轻巧行动，少说多观察，利用已经出现的机会。|Muévete con ligereza. Habla menos, observa más y aprovecha la apertura existente.|身軽に動き、話すより観察を。すでにある入口を活かしましょう。|가볍게 움직여요. 말은 줄이고 더 관찰하며 이미 열린 기회를 활용해요.
Where would subtlety work better than pressure today?|今天在哪件事上，细腻比施压更有效？|¿Dónde serviría hoy más la sutileza que la presión?|今日はどこで、圧力より繊細さが役立ちそうですか？|오늘은 어디에서 압박보다 섬세함이 더 효과적일까요?
Take the smallest useful step without announcing it first.|不用先宣告，做最小但有用的一步。|Da el paso útil más pequeño sin anunciarlo antes.|宣言する前に、小さく役立つ一歩を踏み出して。|먼저 알리지 않아도 작고 유용한 한 걸음을 내디뎌요.
Your sensitivity is information, not weakness.|敏感是信息，不是软弱。|Tu sensibilidad es información, no debilidad.|繊細さは弱さではなく、情報です。|섬세함은 약점이 아니라 정보예요.
Protect your pace. The right thing will not require you to abandon your nervous system.|保护自己的节奏，适合你的事不该要求你忽视身心承受力。|Protege tu ritmo. Lo adecuado no exige ignorar tus límites emocionales.|自分のペースを守って。合うもののために、心身の限界を無視する必要はありません。|내 속도를 지켜요. 나에게 맞는 일은 몸과 마음의 한계를 무시하라고 하지 않아요.
What boundary would make today feel breathable again?|什么边界能让今天重新有喘息空间？|¿Qué límite te devolvería espacio para respirar hoy?|どんな境界があれば、今日はまた呼吸しやすくなりますか？|어떤 경계가 오늘 다시 숨 쉴 여유를 줄까요?
Create a soft limit around one draining conversation or task.|为一段消耗你的对话或任务设下温和界限。|Pon un límite amable a una conversación o tarea agotadora.|消耗する会話や作業に、優しい限度を一つ設けて。|지치게 하는 대화나 일 하나에 부드러운 한계를 정해요.
Real courage is steady, not loud.|真正的勇气是稳定，不是大声。|La valentía real es firme, no ruidosa.|本当の勇気は、大声より揺るがなさです。|진짜 용기는 요란함보다 차분한 단단함이에요.
Hold your ground without hardening your heart.|站稳自己的位置，同时让心保持柔软。|Mantén tu posición sin endurecer el corazón.|心を固くせず、自分の立場を守って。|마음을 굳히지 않으면서 내 자리를 지켜요.
What would calm confidence choose here?|平静而自信的你，会在这里做什么选择？|¿Qué elegiría aquí una confianza serena?|落ち着いた自信があれば、ここで何を選びますか？|차분한 자신감이라면 여기서 무엇을 고를까요?
Name your position once, clearly, and do not negotiate with panic.|清楚说出你的立场一次，不必和恐慌讨价还价。|Expresa tu posición una vez con claridad y no negocies con el pánico.|立場を一度、明確に伝えて。不安に振り回されなくて大丈夫。|내 입장을 한 번 분명히 말하고 공포에 끌려가지 않아요.
Required|必填|Obligatorio|必須|필수
Optional|选填|Opcional|任意|선택
Ready|就绪|Listo|準備完了|준비됨
Sharper|更准确|Más preciso|より詳しく|더 정확하게
Needed|待填写|Necesario|入力が必要|입력 필요
Date|日期|Fecha|日付|날짜
Place|地点|Lugar|場所|장소
Time|时间|Hora|時間|시간
Partner profile|对方档案|Perfil de la otra persona|相手のプロフィール|상대방 프로필
Add birth profile|添加出生资料|Añadir datos de nacimiento|出生情報を追加|출생 정보 추가
Save birth profile|保存出生资料|Guardar datos de nacimiento|出生情報を保存|출생 정보 저장
Create relationship map|创建关系星图|Crear mapa de relación|関係マップを作成|관계 지도 생성
Creating...|正在创建…|Creando…|作成中…|생성 중…
This quiz uses your answers.|本测验使用你的答案。|Este cuestionario usa tus respuestas.|回答に基づくクイズです。|답변에 기반한 퀴즈입니다.
You may feel a little tender today. If nobody notices, name it gently and ask to be heard.|今天可能有些敏感。若无人察觉，温柔地说出感受，请求被倾听。|Quizá hoy estés sensible. Si nadie lo nota, exprésalo con calma y pide que te escuchen.|今日は少し繊細かもしれません。気づいてもらえなければ、優しく気持ちを伝え、聞いてほしいと頼みましょう。|오늘은 조금 예민할 수 있어요. 아무도 알아채지 못하면 부드럽게 말하고 들어달라고 부탁해요.
Do not digest everything alone today. One safe conversation will help more than pushing through.|今天别独自消化所有事。一次安心的对话，比继续硬撑更有帮助。|No lo proceses todo a solas. Una conversación segura ayuda más que seguir aguantando.|今日はすべて一人で抱えないで。安心できる会話は、無理を続けるより助けになります。|오늘은 모든 것을 혼자 소화하지 마세요. 안전한 대화 한 번이 버티기보다 도움이 돼요.
Your feelings are not a problem; they need a doorway. Care for the feeling before fixing the task.|感受不是麻烦，它需要出口。处理事情之前，先照顾感受。|Tus emociones no son un problema: necesitan salida. Cuídalas antes de resolver la tarea.|感情は問題ではなく、出口を必要としています。課題を解決する前に気持ちを大切に。|감정은 문제가 아니라 출구가 필요한 거예요. 일을 해결하기 전에 마음부터 돌보세요.
Respond a little slower today. You do not owe everyone a perfect answer immediately.|今天慢一点回应。你不必立即给每个人完美答案。|Responde un poco más despacio. No debes una respuesta perfecta e inmediata a todo el mundo.|今日は少しゆっくり返事を。誰にでもすぐ完璧な答えを返す必要はありません。|오늘은 조금 천천히 답해요. 모두에게 즉시 완벽한 답을 줄 필요는 없어요.
A brief 'nobody gets me' moment may arrive. Check the facts, then honor the feeling, before making a whole-day conclusion.|也许会短暂觉得“没人懂我”。先核对事实，再尊重感受，别用一瞬间替整天作结论。|Puede aparecer un momento de «nadie me entiende». Revisa los hechos y respeta la emoción antes de juzgar todo el día.|「誰もわかってくれない」と一瞬感じるかもしれません。一日全体を決めつける前に、事実を確かめて気持ちを受け止めましょう。|잠시 '아무도 나를 이해 못 해'라고 느낄 수 있어요. 하루 전체를 판단하기 전에 사실을 확인하고 감정을 존중해요.
Pressure may act like an inner alarm more than an external emergency. Smaller tasks bring steadiness back.|压力可能更像内心警报，而非外界危机。把任务拆小，稳定感就能回来。|La presión puede ser una alarma interna más que una emergencia externa. Las tareas pequeñas devuelven estabilidad.|プレッシャーは外の緊急事態より、内側の警報かもしれません。小さな課題に分けると安定を取り戻せます。|압박은 외부의 비상사태보다 내면의 경보일 수 있어요. 일을 작게 나누면 안정감을 되찾아요.
You may want closeness and distance at the same time. Let yourself observe before you explain.|你可能同时想亲近与退后。表达之前，允许自己先观察。|Quizá quieras cercanía y distancia a la vez. Permítete observar antes de explicar.|近づきたい気持ちと離れたい気持ちが同時にあるかもしれません。説明する前に、まず観察しても大丈夫。|가까움과 거리를 동시에 원할 수 있어요. 설명하기 전에 먼저 관찰해도 괜찮아요.
Find Your Type|找到你的类型|Encuentra tu tipo|あなたのタイプを見つける|나의 유형 찾기
Personalities|性格|Personalidades|パーソナリティ|성격
Quiz result ready|测验结果已就绪|Resultado del cuestionario listo|クイズ結果ができました|퀴즈 결과 준비 완료
When you are stressed, you usually:|感到压力时，你通常会：|Cuando tienes estrés, sueles:|ストレスを感じると、普段は：|스트레스를 받으면 보통:
Take space|留出个人空间|Tomarte espacio|距離を置く|혼자만의 공간 갖기
Stay hopeful|保持希望|Mantener la esperanza|希望を持つ|희망 유지하기
Make a plan|制定计划|Hacer un plan|計画を立てる|계획 세우기
React fast|迅速反应|Reaccionar rápido|すぐに反応する|빠르게 반응하기
When your mood feels messy, you usually:|情绪混乱时，你通常会：|Cuando tus emociones se enredan, sueles:|気持ちが乱れたとき、普段は：|마음이 복잡할 때 보통:
Try to stay nice|尽量保持友善|Intentar ser amable|優しく接しようとする|친절하려고 노력하기
Think too much|想得太多|Pensar demasiado|考えすぎる|너무 많이 생각하기
Distract yourself|转移注意力|Distraerte|気をそらす|다른 일로 주의 돌리기
Imagine better things|想象更好的事|Imaginar algo mejor|より良いことを想像する|더 좋은 일 상상하기
When things go wrong, you think:|事情出错时，你会想：|Cuando algo sale mal, piensas:|物事がうまくいかないとき、こう考える：|일이 잘못되면 이런 생각을 해요:
I'll deal with it later|我之后再处理|Lo resolveré después|後で対処しよう|나중에 해결하자
It happened for a reason|这一定有原因|Pasó por algo|何か理由があるはず|이유가 있을 거야
I need to fix this|我得解决这件事|Tengo que arreglarlo|解決しなければ|해결해야 해
This is too much|这太难承受了|Esto es demasiado|もう手に負えない|너무 벅차
You feel best when:|以下情况让你感觉最好：|Te sientes mejor cuando:|一番心地よいのは：|이럴 때 가장 기분이 좋아요:
People need you|别人需要你|Te necesitan|人に必要とされるとき|사람들이 나를 필요로 할 때
People get you|别人理解你|Te comprenden|理解してもらえるとき|사람들이 나를 이해할 때
You feel free|你感到自由|Sientes libertad|自由を感じるとき|자유로울 때
You feel special|你觉得自己独特|Te sientes especial|特別だと感じるとき|특별하다고 느낄 때
When someone criticizes you, you:|有人批评你时，你会：|Cuando te critican:|批判されたときは：|누군가 비판하면:
Shut down|封闭自己|Te cierras|心を閉ざす|마음 닫기
Explain yourself|解释自己的想法|Te explicas|自分の考えを説明する|내 생각 설명하기
Defend myself|为自己辩护|Te defiendes|自分を守る|나를 방어하기
Get emotional|情绪激动|Te emocionas|感情的になる|감정적으로 반응하기
Pick the one that sounds like you:|选择最像你的描述：|Elige lo que más se parece a ti:|自分に近いものを選んでください：|나와 가장 비슷한 것을 골라요:
I say yes too much|我太常答应别人|Digo que sí demasiado|つい引き受けすぎる|너무 자주 승낙해요
I overthink a lot|我经常想太多|Pienso demasiado|考えすぎることが多い|생각을 너무 많이 해요
I avoid feelings|我回避感受|Evito mis emociones|感情を避けてしまう|감정을 피해요
I dream big|我有远大的梦想|Tengo grandes sueños|大きな夢を持っている|큰 꿈을 꿔요
Distance|距离|Distancia|距離|거리
Romance|浪漫|Romance|ロマンス|낭만
Structure|秩序|Estructura|秩序|체계
Drama|戏剧性|Drama|ドラマ|극적인 감정
Approval|认可|Aprobación|承認|인정
Analysis|分析|Análisis|分析|분석
Freedom|自由|Libertad|自由|자유
Vision|愿景|Visión|ビジョン|비전
HINT PERSONALITY|HINT 性格|PERSONALIDAD HINT|HINT パーソナリティ|HINT 성격
SCAN TO TRY HINT|扫码体验 HINT|ESCANEA Y PRUEBA HINT|スキャンしてHINTを体験|스캔하여 HINT 체험
Find your personality result|探索你的性格结果|Descubre tu personalidad|あなたのタイプを見つける|내 성격 결과 알아보기
This quiz uses your answers. With a birthday, zodiac themes add a small symbolic influence; no personal chart is calculated.|测验以你的答案为主。有生日时，星座主题会带来少量象征性影响；此处不计算个人星盘。|El cuestionario usa tus respuestas. Tu cumpleaños añade una pequeña influencia simbólica zodiacal; aquí no se calcula una carta personal.|回答をもとにしたクイズです。誕生日があれば星座の象徴を少し加味します。個人の出生図は計算しません。|답변에 기반한 퀴즈입니다. 생일이 있으면 별자리의 상징을 조금 반영하며 개인 차트는 계산하지 않습니다.
Answer-based quiz result|基于答案的测验结果|Resultado basado en respuestas|回答に基づくクイズ結果|답변 기반 퀴즈 결과
Quiz result with zodiac themes|加入星座主题的测验结果|Resultado con temas zodiacales|星座のテーマを含むクイズ結果|별자리 주제를 반영한 퀴즈 결과
Could not save your birth details. Please try again.|无法保存出生资料，请重试。|No se pudieron guardar tus datos. Inténtalo de nuevo.|出生情報を保存できませんでした。再試行してください。|출생 정보를 저장하지 못했습니다. 다시 시도하세요.
`);
add(`
Private by design|本机 beta 档案|Perfil beta local|端末内のベータプロフィール|기기 내 베타 프로필
A reading that starts with you|从你开始的阅读|Una lectura que empieza contigo|あなたから始まるリーディング|나에게서 시작되는 리딩
A clearer signal, shaped around your sky.|从反思中找到更清晰的方向。|Una señal más clara para reflexionar.|振り返りから、より明確な手がかりを。|성찰로 더 분명한 방향을 찾아보세요.
Share only what changes the reading. Hint uses your birth date and one intention to make the experience personal.|只填写愿意提供的资料。生日和意图可帮助选择反思内容。|Comparte solo lo que quieras. Tu cumpleaños e intención ayudan a elegir temas de reflexión.|提供したい情報だけを入力してください。誕生日と意図を振り返りのテーマに使います。|원하는 정보만 입력하세요. 생일과 의도로 성찰의 주제를 고릅니다.
Begin|开始|Comenzar|始める|시작
About 60 seconds|约 60 秒|Unos 60 segundos|約60秒|약 60초
Birthday|生日|Fecha de nacimiento|誕生日|생일
Time and city are optional. You can add or change them later from Profile.|时间与城市为选填，之后可在档案中修改。|La hora y la ciudad son opcionales. Puedes cambiarlas después en Perfil.|時間と都市は任意です。後からプロフィールで変更できます。|시간과 도시는 선택 사항이며 나중에 프로필에서 바꿀 수 있습니다.
Continue|继续|Continuar|続ける|계속
Continue as|以此身份继续|Continuar como|このユーザーで続ける|이 사용자로 계속
Use a different email|使用其他邮箱|Usar otro correo|別のメールを使う|다른 이메일 사용
Beta sign-in code:|本机 beta 演示码：|Código beta local:|端末内ベータのデモコード：|기기 내 베타 데모 코드:
Send a new code|生成新演示码|Generar otro código|新しいデモコードを生成|새 데모 코드 생성
No password. No marketing questions. Only the details used to personalize and keep your readings.|这是本机 beta 身份，尚未提供正式登录或跨设备同步。|Esta identidad beta es local. El acceso real y la sincronización entre dispositivos aún no están disponibles.|端末内のベータユーザーです。正式なログインや端末間同期は未対応です。|기기 내 베타 사용자입니다. 정식 로그인과 기기 간 동기화는 아직 제공되지 않습니다.
Daily SkyDeck|每日星空牌组|Mazo celeste diario|毎日のスカイデッキ|매일의 스카이 덱
Previous slide|上一页|Diapositiva anterior|前のスライド|이전 슬라이드
Next slide|下一页|Siguiente diapositiva|次のスライド|다음 슬라이드
More pages|更多页面|Más páginas|他のページ|더 많은 페이지
Sidebar|侧栏|Barra lateral|サイドバー|사이드바
Displays the mobile sidebar.|显示移动端侧栏。|Muestra la barra lateral móvil.|モバイルのサイドバーを表示します。|모바일 사이드바를 표시합니다.
Toggle Sidebar|切换侧栏|Alternar barra lateral|サイドバーの表示切替|사이드바 전환
Animal Terrace|动物露台|Terraza animal|動物のテラス|동물 테라스
Draw the animal walking with you today. The card is assigned once per server day and stays open after you reveal it.|抽取今日陪伴你的动物。每天固定一张，揭示后保留。|Descubre el animal que te acompaña hoy. Una carta por día, conservada tras revelarla.|今日寄り添う動物を引きましょう。一日一枚、公開後も保持されます。|오늘 함께할 동물을 뽑으세요. 하루에 한 장이며 공개 후 유지됩니다.
Finding today’s animal.|正在寻找今日动物。|Buscando el animal de hoy.|今日の動物を探しています。|오늘의 동물을 찾고 있습니다.
Asking the server for today’s locked draw.|正在载入今日固定抽取结果。|Cargando la carta asignada de hoy.|今日の固定されたカードを読み込み中。|오늘의 고정된 카드를 불러오는 중입니다.
Let one animal step forward.|让一位动物伙伴走近你。|Deja que un animal se acerque.|一匹の動物を迎えましょう。|동물 한 마리를 맞이하세요.
This is not a childish animal picker. Treat it like an instinct card: one animal, one companion tarot card, one clean message for today.|一位动物、一张对应塔罗牌，以及今日的一句反思。|Un animal, una carta de tarot compañera y una reflexión para hoy.|一匹の動物、一枚のタロット、今日の振り返り。|동물 한 마리, 함께하는 타로 카드 한 장, 오늘의 성찰 하나.
The terrace is opening.|露台正在开启。|La terraza se abre.|テラスが開いています。|테라스가 열리고 있습니다.
The animal is stepping through the card. Stay with the first feeling you notice.|动物伙伴即将现身，留意你的第一份感受。|El animal aparece. Observa la primera sensación que surja.|動物が姿を現します。最初に感じたことを味わってください。|동물이 모습을 드러냅니다. 처음 느껴지는 감정에 머물러 보세요.
Today's animal|今日动物|Animal de hoy|今日の動物|오늘의 동물
Companion:|对应牌：|Compañera:|対応するカード：|함께하는 카드:
Draw animal card|抽取动物牌|Sacar carta animal|動物カードを引く|동물 카드 뽑기
Loading lock|载入固定结果|Cargando carta|固定結果を読み込み中|고정 결과 불러오는 중
Revealing|揭示中|Revelando|公開中|공개 중
Replay reveal|重新观看揭示|Repetir revelación|公開演出をもう一度見る|공개 장면 다시 보기
Draw in Tarot Room|前往塔罗房间抽牌|Sacar cartas en la sala de tarot|タロットルームで引く|타로 방에서 뽑기
Open Daily Draw|打开每日抽牌|Abrir carta diaria|毎日のカードを開く|매일의 카드 열기
Open Collection|打开收藏|Abrir colección|コレクションを開く|컬렉션 열기
Collection|收藏|Colección|コレクション|컬렉션
Your deck memory|你的牌卡记录|La memoria de tu mazo|あなたのカードの記録|나의 카드 기록
Cards enter the collection when they appear in Daily or the Tarot Room. Tonight's rare reward is assigned once and stays open after you unlock it.|每日牌与塔罗阅读中的牌可进入收藏。每日稀有奖励固定一次，解锁后保留。|Las cartas diarias y de tarot entran en tu colección. La recompensa rara diaria se conserva al abrirla.|毎日のカードやタロットのカードがコレクションに入ります。毎日のレア報酬は開いた後も保持されます。|매일의 카드와 타로 카드를 컬렉션에 모읍니다. 매일의 희귀 보상은 연 후에도 유지됩니다.
Progress|进度|Progreso|進み具合|진행도
rare|稀有|raras|レア|희귀
All cards|全部牌卡|Todas las cartas|すべてのカード|모든 카드
Rare|稀有|Rara|レア|희귀
Rare card unlock|稀有牌解锁|Desbloquear carta rara|レアカードを開く|희귀 카드 열기
Some nights, the deck gives back.|有些夜晚，牌组会送来回礼。|Algunas noches, el mazo te devuelve un regalo.|ときには、デッキから贈り物が届きます。|어떤 밤에는 덱이 선물을 건넵니다.
Chart A|星盘 A|Carta A|チャートA|차트 A
Chart B|星盘 B|Carta B|チャートB|차트 B
Together|合盘|Juntos|二人の星図|함께
The Space Between You|你们之间|El espacio entre ambos|二人の間にあるもの|두 사람 사이
Compare two saved birth charts, or invite someone to enter their own details. A personal comparison appears only after a calculation succeeds.|比较两份出生资料，或邀请对方自行填写。计算成功后才显示个人比较结果。|Compara dos perfiles o invita a alguien a introducir sus datos. El resultado personal aparece solo tras un cálculo válido.|二人の出生情報を比べるか、相手を招待して入力してもらいましょう。有効な計算後にのみ個人の比較を表示します。|두 출생 정보를 비교하거나 상대를 초대하세요. 유효한 계산이 성공한 후에만 개인 비교 결과를 표시합니다.
Synastry receipts|合盘依据|Aspectos de la comparación|相性の相位データ|궁합의 근거
Space Between You card|你们之间的卡片|Tarjeta del vínculo|二人のつながりのカード|두 사람의 관계 카드
Consent first|同意优先|Primero, el consentimiento|まず同意を|먼저 동의부터
Invite them in|邀请对方|Invita a esa persona|相手を招待する|상대 초대하기
Send a private web link. They add their own birth details and consent before the shared chart opens.|分享邀请链接，对方填写出生资料并同意后，才会进行合盘。|Comparte el enlace. La otra persona introduce sus datos y acepta antes del cálculo.|リンクを共有し、相手が出生情報を入力して同意してから計算します。|링크를 공유하세요. 상대가 출생 정보를 입력하고 동의한 후 계산합니다.
Your side|你的资料|Tus datos|あなたの情報|나의 정보
Invite link|邀请链接|Enlace de invitación|招待リンク|초대 링크
Expires|到期|Caduca|有効期限|만료
I have consent to use these details for this relationship preview.|我已获得同意，可使用这些资料进行关系比较。|Tengo permiso para usar estos datos en la comparación.|この比較に情報を使う同意を得ています。|이 비교에 정보를 사용할 동의를 받았습니다.
Sample preview is active. Save your profile to create a web invite.|当前为预览。保存出生资料后可创建邀请。|Vista previa activa. Guarda tu perfil para crear una invitación.|現在はプレビューです。プロフィールを保存して招待を作成できます。|현재 미리보기입니다. 프로필을 저장하면 초대할 수 있습니다.
I consent to share these birth details for this compatibility preview.|我同意分享这些出生资料以进行合盘。|Acepto compartir estos datos de nacimiento para esta comparación.|この相性比較に出生情報を共有することに同意します。|이 궁합 비교를 위해 출생 정보를 공유하는 데 동의합니다.
Moon ·|月亮 ·|Luna ·|月・|달 ·
Retry|重试|Reintentar|再試行|다시 시도
Back to Together|返回合盘|Volver a Juntos|二人の星図に戻る|함께로 돌아가기
Shared rhythm|共同节奏|Ritmo compartido|二人のリズム|함께하는 리듬
Create a new invite|创建新邀请|Crear otra invitación|新しい招待を作成|새 초대 만들기
Please wait.|请稍候。|Espera un momento.|お待ちください。|잠시 기다려 주세요.
Check result|查看结果|Consultar resultado|結果を確認|결과 확인
Compatibility is a reflective chart preview. It is not a guaranteed prediction, and invite completion requires consent.|合盘用于反思，并非确定预测。完成邀请需要本人同意。|La comparación es para reflexionar, no una predicción garantizada. Requiere consentimiento.|相性比較は振り返りのためのもので、確実な予測ではありません。同意が必要です。|궁합 비교는 성찰용이며 확정된 예측이 아닙니다. 완료하려면 동의가 필요합니다.
Invite flow|邀请流程|Proceso de invitación|招待の流れ|초대 절차
Consent required|需要同意|Se requiere consentimiento|同意が必要です|동의 필요
Compare two charts without making it weird.|以清晰的方式比较两份星盘。|Compara dos cartas con claridad.|二つのチャートをわかりやすく比較。|두 차트를 명확하게 비교하세요.
Save your birth profile before creating an invite.|创建邀请前，请先保存出生资料。|Guarda tu perfil antes de invitar.|招待前に出生プロフィールを保存してください。|초대하기 전에 출생 프로필을 저장하세요.
Copy|复制|Copiar|コピー|복사
Your side is ready.|你的资料已就绪。|Tus datos están listos.|あなたの情報は準備できています。|나의 정보가 준비되었습니다.
Venus and|金星与|Venus y|金星と|금성과
Mars help shape the relationship preview.|火星为关系比较提供参考。|Marte aportan contexto a la comparación.|火星が関係の比較の手がかりになります。|화성은 관계 비교에 참고가 됩니다.
Calendar jump|跳转日期|Ir a una fecha|日付へ移動|날짜로 이동
This is a preview with example dream fragments. You can record a dream in your journal now.|这里展示示例梦境片段。你现在可以在日记中记录梦境。|Esta vista contiene fragmentos de ejemplo. Ya puedes registrar un sueño en tu diario.|夢の例を表示するプレビューです。夢は今すぐ日記に記録できます。|예시 꿈 조각을 보여주는 미리보기입니다. 지금 일기에 꿈을 기록할 수 있습니다.
Write in my journal|写入日记|Escribir en mi diario|日記に書く|일기에 쓰기
Example dream fragments|示例梦境片段|Fragmentos de sueños de ejemplo|夢の断片の例|예시 꿈 조각
Result|结果|Resultado|結果|결과
Your assigned personality|你的性格结果|Tu resultado de personalidad|あなたの性格の結果|나의 성격 결과
Share result|分享结果|Compartir resultado|結果を共有|결과 공유
Retake quiz|重新测验|Repetir cuestionario|もう一度答える|퀴즈 다시 하기
Choose what feels most like you|选择最像你的答案|Elige lo que más se parece a ti|一番自分らしい答えを選んでください|가장 나다운 답을 고르세요
Quiz pattern|测验倾向|Patrón del cuestionario|回答の傾向|답변 성향
`);
add(`
Deeper thread ready|可以继续深入|Listo para profundizar|さらに深く読めます|더 깊이 읽을 준비 완료
Keep this reading open.|留在这次阅读中。|Mantén abierta esta lectura.|このリーディングを開いておきましょう。|이 리딩을 열어두세요.
Ask for card-by-card detail, action steps, timing, or what to watch next. The best follow-up is usually already hiding inside the first spread.|可询问每张牌的细节、行动、时机或需要留意的事。|Pregunta por cada carta, próximos pasos, momentos o señales que observar.|各カードの詳細、行動、タイミング、注意点を聞いてみましょう。|각 카드의 세부사항, 행동, 시기 또는 주의할 점을 물어보세요.
Continue in this reading|继续本次阅读|Continuar esta lectura|このリーディングを続ける|이 리딩 계속하기
Energy-selected|按反思主题选择|Elegido por el tema|テーマに合わせて選択|주제에 맞춘 선택
The cards wait for your hand.|牌卡等你选择。|Las cartas esperan tu mano.|カードはあなたを待っています。|카드가 당신의 손길을 기다립니다.
Hint question|给 Hint 的问题|Pregunta para Hint|Hintへの質問|Hint에 할 질문
What do you want Hint to look into?|你想让 Hint 帮你看什么？|¿Qué quieres explorar con Hint?|Hintと何を探りたいですか？|Hint와 무엇을 살펴보고 싶나요?
Big, small, messy, or specific. Ask it in your own words; Hint will choose a reading shape from the question.|无论大小或是否清晰，用自己的话提问，Hint 会据此选择牌阵。|Pregunta con tus propias palabras. Hint elegirá una tirada según tu pregunta.|自分の言葉で質問してください。Hintが質問に合わせてスプレッドを選びます。|자신의 말로 물어보세요. Hint가 질문에 맞는 스프레드를 고릅니다.
Try a question|试试这些问题|Prueba una pregunta|質問を試す|질문해 보기
What kind of question is it?|这是哪一类问题？|¿Qué tipo de pregunta es?|どんな種類の質問ですか？|어떤 종류의 질문인가요?
Add context if it matters|需要时补充背景|Añade contexto si ayuda|必要なら背景を追加|필요하면 배경 추가
Choose spread|选择牌阵|Elegir tirada|スプレッドを選ぶ|스프레드 선택
Saved to Readings|已保存到阅读记录|Guardado en lecturas|リーディングに保存済み|리딩 기록에 저장됨
signals|线索|señales|手がかり|신호
Tap to set tonight's mood|点击记录今晚心情|Toca para registrar tu ánimo|タップして今夜の気分を記録|눌러서 오늘 밤의 기분 기록
How heavy is tonight?|今晚的心情有多沉重？|¿Cómo te pesa esta noche?|今夜の気持ちはどれくらい重いですか？|오늘 밤 마음이 얼마나 무겁나요?
Today's signals|今日线索|Señales de hoy|今日の手がかり|오늘의 신호
Draw first. Scores are calculated from the card you reveal.|先揭示今日牌，再查看反思提示。分数仅用于娱乐与反思。|Revela la carta para ver los temas. Las puntuaciones son orientativas y recreativas.|カードを公開して振り返りのテーマを見ましょう。スコアは娯楽・振り返り用です。|카드를 공개해 성찰 주제를 보세요. 점수는 오락과 성찰용입니다.
Score hidden|分数未揭示|Puntuación oculta|スコア非表示|점수 숨김
Hint scores energy, love, and career from today's sky, your birth details, and your ritual streak.|这些分数是娱乐性的反思提示，不是个人星盘计算或结果预测。|Estas puntuaciones son reflexiones recreativas, no cálculos de una carta personal ni predicciones.|スコアは娯楽のための振り返りで、個人の星図の計算や予測ではありません。|점수는 오락적 성찰이며 개인 차트 계산이나 결과 예측이 아닙니다.
Overall|综合|General|全体|종합
Add birth details for sharper daily scores|添加出生资料，探索星座内容|Añade datos para explorar el zodiaco|出生情報を追加して星座を探索|출생 정보를 추가해 별자리 살펴보기
Aura|气息|Aura|オーラ|오라
overall|综合|general|全体|종합
Aura score is sealed.|气息分数尚未揭示。|La puntuación del aura está cerrada.|オーラのスコアはまだ閉じています。|오라 점수가 아직 닫혀 있습니다.
Draw once to reveal today’s card, overall score, and five life signals.|揭示今日牌、综合分数与五项生活反思。|Revela la carta, la puntuación general y cinco temas para reflexionar.|今日のカード、全体スコア、五つの振り返りを公開します。|오늘의 카드, 종합 점수와 다섯 가지 성찰을 공개하세요.
Your daily signal from the universe.|来自宇宙的每日小提示。|Tu señal diaria del universo.|宇宙からの毎日の小さなヒント。|우주가 전하는 매일의 작은 힌트.
Today's tarot card|今日塔罗牌|Carta de tarot de hoy|今日のタロット|오늘의 타로 카드
OK, view today's signal|查看今日线索|Ver la señal de hoy|今日の手がかりを見る|오늘의 신호 보기
Take a deep breath, and receive.|深呼吸，接住这份提示。|Respira hondo y recibe.|深呼吸して、受け取りましょう。|깊이 숨 쉬고 받아보세요.
Today's card signal|今日牌卡提示|Señal de la carta de hoy|今日のカードのヒント|오늘 카드의 힌트
Add birth details|添加出生资料|Añadir datos de nacimiento|出生情報を追加|출생 정보 추가
Card revealed|牌已揭示|Carta revelada|カード公開済み|카드 공개됨
Tarot interpretation|塔罗解读|Interpretación de tarot|タロットの解釈|타로 해석
Offline daily lock active. This result will use local fallback until the API returns.|离线原牌已保留，恢复连线后会尝试同步。|Tu carta sin conexión se conserva y se sincronizará al volver a conectarte.|オフラインのカードを保持しています。接続後に同期を試みます。|오프라인 카드를 유지합니다. 연결이 복구되면 동기화합니다.
For you today|今天给你的|Para ti hoy|今日のあなたへ|오늘의 나에게
Ask AI for specifics|向 Hint 询问细节|Pregunta detalles a Hint|Hintに詳細を聞く|Hint에 자세히 묻기
Ritual|仪式|Ritual|儀式|의식
Today’s tarot|今日塔罗|Tarot de hoy|今日のタロット|오늘의 타로
Read interpretation|阅读解读|Leer interpretación|解釈を読む|해석 읽기
Return to Today|返回今日|Volver a Hoy|今日に戻る|오늘로 돌아가기
View card again|再次查看牌卡|Volver a ver la carta|カードをもう一度見る|카드 다시 보기
Your Hint|你的 Hint|Tu Hint|あなたのHint|나의 Hint
is|正在|está|は|가
waiting.|等你。|esperando.|待っています。|기다리고 있어요.
The universe left you a little note.|宇宙给你留了一张小纸条。|El universo te dejó una pequeña nota.|宇宙から小さなメモが届きました。|우주가 작은 쪽지를 남겼어요.
Today’s energy|今日能量|Energía de hoy|今日のエネルギー|오늘의 에너지
Today’s theme|今日主题|Tema de hoy|今日のテーマ|오늘의 주제
Tap to see more details|点击查看更多|Toca para ver más detalles|タップして詳細を見る|눌러서 자세히 보기
Why this hint?|为什么是这个提示？|¿Por qué esta señal?|このヒントの理由は？|왜 이 힌트일까요?
Why|原因|Por qué|理由|이유
Brings|带来|Aporta|もたらすもの|전하는 것
Sky Evidence ✦|星空依据 ✦|Señales del cielo ✦|空の手がかり ✦|하늘의 근거 ✦
Open sky map|打开星空图|Abrir mapa celeste|星空マップを開く|하늘 지도 열기
Ask about this hint|询问这个提示|Preguntar por esta señal|このヒントについて聞く|이 힌트에 대해 묻기
Your spaces|你的空间|Tus espacios|あなたのスペース|나의 공간
A small signal from today’s sky.|来自今日星空的小提示。|Una pequeña señal del cielo de hoy.|今日の空からの小さなヒント。|오늘 하늘에서 온 작은 힌트.
Signed in|已使用本机身份|Identidad local activa|端末内ユーザーを使用中|기기 내 사용자 사용 중
Sign out|退出|Salir|ログアウト|로그아웃
Reset|重置|Restablecer|リセット|초기화
This account is stored for this browser while provider login is being wired.|本机 beta 身份保存在此浏览器，正式登录尚未连接。|Esta identidad beta se guarda en este navegador. El acceso real aún no está conectado.|ベータユーザーはこのブラウザーに保存されます。正式なログインは未接続です。|베타 사용자는 이 브라우저에 저장되며 정식 로그인은 아직 연결되지 않았습니다.
· Soon|· 即将推出|· Próximamente|・近日予定|· 출시 예정
Memory|记录|Memoria|記録|기록
Your Hint memory|你的 Hint 记录|Tu memoria de Hint|あなたのHintの記録|나의 Hint 기록
These are shortcuts to Astrology tools. They are not saved reading records.|以下是占星工具入口，并非已保存的阅读记录。|Estos enlaces abren herramientas de astrología, no lecturas guardadas.|占星術ツールへのリンクです。保存されたリーディングではありません。|점성술 도구의 바로가기이며 저장된 리딩 기록은 아닙니다.
Signal path|线索路径|Ruta de señales|手がかりの道|신호의 길
Reveal is opening|正在揭示|Abriendo la revelación|公開を始めています|공개를 시작하는 중
of|／|de|／|/
Question field|问题区域|Campo de pregunta|質問欄|질문 영역
Sealed|未揭示|Cerrado|未公開|미공개
Lens|视角|Perspectiva|視点|관점
. Swipe the wheel to browse. Pinch open or scroll up to zoom; numbers appear above the cards.|。滑动牌轮浏览，用双指或向上滚动放大，数字会显示在牌上方。|. Desliza la rueda. Amplía con dos dedos o desplazando hacia arriba para ver los números.|。ホイールをスワイプ。ピンチや上スクロールで拡大するとカードの上に番号が表示されます。|. 휠을 밀어 살펴보고 두 손가락이나 위로 스크롤해 확대하면 카드 위에 번호가 나타납니다.
sealed|未揭示|cerrado|未公開|미공개
Private reading|私人阅读|Lectura privada|プライベートリーディング|개인 리딩
face-down cards placed.|张牌已背面放置。|cartas colocadas boca abajo.|枚のカードを裏向きで配置しました。|장의 카드가 뒷면으로 놓였습니다.
Choose the shape of the reading.|选择阅读牌阵。|Elige la forma de la lectura.|リーディングの形を選んでください。|리딩의 배열을 고르세요.
Choose this spread|使用此牌阵|Elegir esta tirada|このスプレッドを使う|이 스프레드 선택
Opening the room...|正在打开房间…|Abriendo la sala…|部屋を開いています…|방을 여는 중…
Page not found|找不到页面|Página no encontrada|ページが見つかりません|페이지를 찾을 수 없습니다
This page may have moved. Choose a room to continue.|此页面可能已移动，请选择房间继续。|Esta página puede haber cambiado. Elige una sala para continuar.|ページが移動した可能性があります。部屋を選んで続けてください。|페이지가 이동했을 수 있습니다. 방을 골라 계속하세요.
Back to Today|返回今日|Volver a Hoy|今日に戻る|오늘로 돌아가기
`);
// These English descriptions also need to reflect the local beta's actual capabilities.
LITERAL_COPY["Private by design"].en = "Local beta profile";
LITERAL_COPY["No password. No marketing questions. Only the details used to personalize and keep your readings."].en = "This is a local beta identity. Formal sign-in and cross-device synchronization are not connected yet.";
LITERAL_COPY["Send a new code"].en = "Generate a new demo code";
LITERAL_COPY["Send sign-in code"].en = "Generate local demo code";
LITERAL_COPY["Beta sign-in code:"].en = "Local beta demo code:";
LITERAL_COPY["This is not a childish animal picker. Treat it like an instinct card: one animal, one companion tarot card, one clean message for today."].en = "One animal, one companion tarot card, and a reflection for today.";
LITERAL_COPY["Draw first. Scores are calculated from the card you reveal."].en = "Reveal your daily card and reflection themes. Scores are for entertainment and reflection.";
LITERAL_COPY["Hint scores energy, love, and career from today's sky, your birth details, and your ritual streak."].en = "These scores are entertainment and reflection prompts, not personal chart calculations or predictions.";
LITERAL_COPY["Add birth details for sharper daily scores"].en = "Add birth details to explore zodiac themes";
add(`
The clearest link is attraction; that is where the connection may feel easiest to read.|最清晰的连结是吸引力，这部分关系可能最容易理解。|El vínculo más claro es la atracción; ahí la conexión puede resultar más fácil de entender.|最も明確な結びつきは魅力です。この部分から関係を理解しやすいかもしれません。|가장 뚜렷한 연결은 끌림이에요. 이 부분에서 관계를 이해하기 쉬울 수 있어요.
The clearest link is communication; that is where the connection may feel easiest to read.|最清晰的连结是沟通，这部分关系可能最容易理解。|El vínculo más claro es la comunicación; ahí la conexión puede resultar más fácil de entender.|最も明確な結びつきはコミュニケーションです。この部分から関係を理解しやすいかもしれません。|가장 뚜렷한 연결은 소통이에요. 이 부분에서 관계를 이해하기 쉬울 수 있어요.
The clearest link is emotional rhythm; that is where the connection may feel easiest to read.|最清晰的连结是情绪节奏，这部分关系可能最容易理解。|El vínculo más claro es el ritmo emocional; ahí la conexión puede resultar más fácil de entender.|最も明確な結びつきは感情のリズムです。この部分から関係を理解しやすいかもしれません。|가장 뚜렷한 연결은 감정의 리듬이에요. 이 부분에서 관계를 이해하기 쉬울 수 있어요.
The clearest link is stability; that is where the connection may feel easiest to read.|最清晰的连结是稳定性，这部分关系可能最容易理解。|El vínculo más claro es la estabilidad; ahí la conexión puede resultar más fácil de entender.|最も明確な結びつきは安定感です。この部分から関係を理解しやすいかもしれません。|가장 뚜렷한 연결은 안정감이에요. 이 부분에서 관계를 이해하기 쉬울 수 있어요.
The shared chart works best when both people name what is true before trying to solve it.|双方先说清真实情况，再尝试解决问题，最能发挥共享星盘的反思作用。|La carta compartida resulta más útil cuando ambas personas reconocen lo que ocurre antes de intentar resolverlo.|問題を解決しようとする前に、二人とも事実を言葉にすると共有チャートを活かせます。|문제를 해결하기 전에 두 사람 모두 실제 상황을 말로 표현할 때 공유 차트를 잘 활용할 수 있어요.
Mars and Moon signals may heat up quickly, so pace matters.|火星与月亮信号可能迅速升温，因此节奏很重要。|Las señales de Marte y la Luna pueden intensificarse rápido; por eso importa el ritmo.|火星と月のシグナルは急に高まることがあるため、ペースが大切です。|화성과 달의 신호는 빠르게 강해질 수 있어 속도 조절이 중요해요.
The friction signal is manageable if the conversation stays specific.|只要沟通保持具体，摩擦信号便较容易处理。|La fricción puede manejarse si la conversación se mantiene concreta.|会話を具体的に保つことで、摩擦に対処しやすくなります。|대화를 구체적으로 유지하면 마찰에 대처하기 쉬워요.
Use the chart as a mirror, not a verdict. Ask one direct question and watch the pattern.|把星盘当作自我观察的镜子，而非定论。直接问一个问题，再观察互动模式。|Usa la carta como un espejo, no como un veredicto. Haz una pregunta directa y observa el patrón.|チャートを結論ではなく振り返りの鏡として使いましょう。率直に一つ質問し、パターンを観察してください。|차트를 판정 대신 성찰의 거울로 사용하세요. 직접적인 질문을 하나 하고 패턴을 살펴보세요.
`);
add(`
Preparing today’s tarot|正在准备今日塔罗|Preparando el tarot de hoy|今日のタロットを準備中|오늘의 타로 준비 중
Choosing today’s tarot|正在选择今日塔罗|Eligiendo el tarot de hoy|今日のタロットを選択中|오늘의 타로 선택 중
Your card is arriving.|你的牌正在到来。|Tu carta está llegando.|カードが届きます。|카드가 도착하고 있어요.
The card is turning.|牌正在翻转。|La carta está girando.|カードをめくっています。|카드를 뒤집고 있어요.
One soft second while the daily pull settles.|稍候片刻，让今日牌揭晓。|Un momento mientras se prepara la carta de hoy.|今日のカードが整うまで、少しお待ちください。|오늘의 카드가 준비될 때까지 잠시 기다려 주세요.
The back comes forward first, then opens into today’s message.|先呈现牌背，再揭开今日讯息。|Primero aparece el reverso y después se revela el mensaje de hoy.|まず裏面を見せてから、今日のメッセージが開きます。|먼저 카드 뒷면을 보여준 뒤 오늘의 메시지를 열어요.
Reveal today's Hint card|揭示今日 Hint 牌|Revelar la carta Hint de hoy|今日のHintカードをめくる|오늘의 Hint 카드 공개
Preparing today's Hint card|正在准备今日 Hint 牌|Preparando la carta Hint de hoy|今日のHintカードを準備中|오늘의 Hint 카드 준비 중
`);
add(`
Aries|白羊座|Aries|牡羊座|양자리
Taurus|金牛座|Tauro|牡牛座|황소자리
Gemini|双子座|Géminis|双子座|쌍둥이자리
Cancer|巨蟹座|Cáncer|蟹座|게자리
Leo|狮子座|Leo|獅子座|사자자리
Virgo|处女座|Virgo|乙女座|처녀자리
Libra|天秤座|Libra|天秤座|천칭자리
Scorpio|天蝎座|Escorpio|蠍座|전갈자리
Sagittarius|射手座|Sagitario|射手座|사수자리
Capricorn|摩羯座|Capricornio|山羊座|염소자리
Aquarius|水瓶座|Acuario|水瓶座|물병자리
Pisces|双鱼座|Piscis|魚座|물고기자리
Open|尚未提供|Sin datos|未入力|미입력
You|你|Tú|あなた|나
Friend|朋友|Amistad|友人|친구
them|对方|la otra persona|相手|상대
Create invite link|创建邀请链接|Crear enlace de invitación|招待リンクを作成|초대 링크 만들기
Save your birth details first, then invite someone into a shared chart room.|先保存出生资料，再邀请对方进入共享星盘房间。|Guarda tus datos de nacimiento antes de invitar a alguien a la sala compartida.|出生情報を保存してから、共有チャートの部屋に相手を招待しましょう。|출생 정보를 저장한 후 공유 차트 방에 상대를 초대하세요.
strongest Link|最强连结|Vínculo más fuerte|最も強い結びつき|가장 강한 연결
easy Part|顺畅之处|Lo más fluido|自然に通じる部分|편안한 부분
friction Point|摩擦之处|Punto de fricción|摩擦が生じる部分|마찰이 생기는 부분
advice|建议|Consejo|アドバイス|조언
Birth profile saved|出生档案已保存|Datos de nacimiento guardados|出生情報を保存済み|출생 프로필 저장됨
Birth profile|出生档案|Datos de nacimiento|出生プロフィール|출생 프로필
Review the birth details saved on this device before calculating a personal chart.|计算个人星盘前，请确认此设备保存的出生资料。|Revisa los datos guardados en este dispositivo antes de calcular una carta personal.|個人チャートを計算する前に、この端末の出生情報を確認してください。|개인 차트를 계산하기 전에 기기에 저장된 출생 정보를 확인하세요.
Add birth date, time, and place once, then reuse it across Astrology.|填写一次出生日期、时间和地点，即可在占星功能中重复使用。|Añade fecha, hora y lugar una vez para reutilizarlos en Astrología.|生年月日・時刻・場所を一度入力すると、占星術の各機能で再利用できます。|생년월일, 시간, 장소를 한 번 입력하면 점성술 기능에서 다시 사용할 수 있어요.
Chart graph|星盘图|Gráfico de la carta|チャート図|차트 그림
Natal wheel|本命星盘|Rueda natal|ネイタルチャート|출생 차트
Open your calculated birth chart, or complete the birth details needed to create it.|打开已计算的本命星盘，或补齐计算所需的出生资料。|Abre tu carta calculada o completa los datos necesarios para crearla.|計算済みの出生チャートを開くか、計算に必要な情報を入力してください。|계산된 출생 차트를 열거나 계산에 필요한 정보를 입력하세요.
Transit checks|行运查看|Consultar tránsitos|トランジットの確認|트랜짓 확인
Current sky|当前星空|Cielo actual|現在の空|현재 하늘
Check current transits and the calculation date returned by the service.|查看当前行运和服务返回的计算日期。|Consulta los tránsitos actuales y la fecha de cálculo del servicio.|現在のトランジットとサービスが返した計算日を確認します。|현재 트랜짓과 서비스에서 반환한 계산 날짜를 확인하세요.
Together invites|合盘邀请|Invitaciones de compatibilidad|相性の招待|궁합 초대
Synastry|合盘|Sinastría|相性チャート|궁합 차트
Open relationship maps and invite another person into the web flow.|打开关系图，并邀请对方查看共享星盘。|Abre los mapas de relación e invita a otra persona a la carta compartida.|関係マップを開き、相手を共有チャートに招待します。|관계 지도를 열고 공유 차트에 상대를 초대하세요.
Planned topics|计划中的主题|Temas previstos|今後のテーマ|예정된 주제
Keep birth, transit, and relationship report previews in one place.|在同一处查看本命、行运和关系报告预览。|Consulta aquí las vistas previas de informes natales, de tránsitos y de relaciones.|出生・トランジット・関係のレポートプレビューをまとめて確認します。|출생, 트랜짓, 관계 보고서 미리보기를 한곳에서 확인하세요.
Tonight's daily card|今日牌|Carta de hoy|今日のカード|오늘의 카드
Locked|尚未解锁|Bloqueada|未解放|잠김
One card|一张牌|Una carta|1枚引き|카드 한 장
Three cards|三张牌|Tres cartas|3枚引き|카드 세 장
Choose one area to begin with.|先选择一个方向。|Elige un área para empezar.|最初に取り組むテーマを選んでください。|시작할 분야를 선택하세요.
Your profile could not be saved. Keep your details here and try again.|档案无法保存。资料仍保留在这里，请重试。|No se pudo guardar el perfil. Tus datos siguen aquí; vuelve a intentarlo.|プロフィールを保存できませんでした。入力内容は保持しています。再試行してください。|프로필을 저장하지 못했어요. 입력 내용은 유지되니 다시 시도하세요.
Birth details could not be saved on this device. Your entries are still here; please try again.|无法在本机保存出生资料。内容仍保留，请重试。|No se pudieron guardar los datos de nacimiento. Siguen aquí; vuelve a intentarlo.|出生情報を端末に保存できませんでした。入力内容は残っています。再試行してください。|출생 정보를 기기에 저장하지 못했어요. 입력 내용은 유지되니 다시 시도하세요.
Comfort|舒适感|Comodidad|心地よさ|편안함
Signal|讯号|Señal|サイン|신호
Friction|摩擦|Fricción|摩擦|마찰
Partner|对方|La otra persona|相手|상대
Tarot reading|塔罗解读|Lectura de tarot|タロットリーディング|타로 리딩
HINT TAROT|HINT 塔罗|TAROT HINT|HINT タロット|HINT 타로
YOUR READING|你的解读|TU LECTURA|あなたのリーディング|나의 리딩
Open your own reading in Hint|在 Hint 开启你的解读|Abre tu propia lectura en Hint|Hintで自分のリーディングを始めよう|Hint에서 나만의 리딩 시작하기
My Hint tarot reading|我的 Hint 塔罗解读|Mi lectura de tarot de Hint|私のHintタロットリーディング|나의 Hint 타로 리딩
A reading from Hint|来自 Hint 的解读|Una lectura de Hint|Hintのリーディング|Hint의 리딩
Share your Hint reading|分享你的 Hint 解读|Comparte tu lectura de Hint|Hintのリーディングを共有|Hint 리딩 공유하기
Card reflection · original English|牌卡反思 · 英文原文|Reflexión de las cartas · original en inglés|カードの振り返り・英語の原文|카드 성찰 · 영어 원문
`);

add(`
Save profile|保存出生资料|Guardar datos de nacimiento|出生情報を保存|출생 정보 저장
Saving…|正在保存…|Guardando…|保存中…|저장 중…
Astrology sections|占星分区|Secciones de astrología|占星術のセクション|점성술 섹션
Astrology tools|占星工具|Herramientas de astrología|占星術ツール|점성술 도구
LEO|狮子座|LEO|しし座|사자자리
PISCES|双鱼座|PISCIS|うお座|물고기자리
LIBRA|天秤座|LIBRA|てんびん座|천칭자리
· Retrograde|· 逆行|· Retrógrado|· 逆行|· 역행
Hint Receive|Hint 收讯|Recibe tu Hint|Hintを受け取る|Hint 받기
Opening Today’s Hint|正在打开今日 Hint|Abriendo el Hint de hoy|今日のHintを開いています|오늘의 Hint를 여는 중
Reveal Today’s Hint|揭示今日 Hint|Revelar el Hint de hoy|今日のHintをめくる|오늘의 Hint 공개
Preparing Today’s Hint|正在准备今日 Hint|Preparando el Hint de hoy|今日のHintを準備中|오늘의 Hint 준비 중
Checking today's signal|正在查看今日讯息|Consultando la señal de hoy|今日のメッセージを確認中|오늘의 메시지 확인 중
Reveal today's Hint|揭示今日 Hint|Revelar el Hint de hoy|今日のHintをめくる|오늘의 Hint 공개
Checking today's signal...|正在查看今日讯息…|Consultando la señal de hoy…|今日のメッセージを確認中…|오늘의 메시지 확인 중…
Receiving your signal...|正在接收你的讯息…|Recibiendo tu señal…|メッセージを受け取り中…|메시지를 받는 중…
Your signal is waiting.|你的讯息已就绪。|Tu señal te está esperando.|メッセージが待っています。|메시지가 기다리고 있어요.
Checking...|正在查看…|Consultando…|確認中…|확인 중…
Receiving...|正在接收…|Recibiendo…|受け取り中…|받는 중…
Reveal Today's Hint|揭示今日 Hint|Revelar el Hint de hoy|今日のHintをめくる|오늘의 Hint 공개
`);
