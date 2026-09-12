import type { HintLanguage } from "../../lib/i18n";

const en = {
  title: "Your space", subtitle: "The things you keep. The way you feel at home.",
  localProfile: "Your local profile", birthDetails: "Birth details", birthIntro: "Your starting point for a personal chart.",
  date: "Date", time: "Time", place: "Place", unknown: "Not added", unknownTime: "Time unknown",
  birthMissing: "Add your birth details when you’re ready to explore your chart.", edit: "Edit details",
  editIntro: "A few details, kept with this local profile.", back: "Back to your space",
  personalSpace: "Made personal", chart: "My birth chart", chartDetail: "Explore your planetary placements.",
  history: "Reading history", historyDetail: "Return to words that stayed with you.",
  collection: "My collection", collectionDetail: "Your saved cards, all in one place.",
  preferences: "Set the mood", preferencesDetail: "Make Hint feel like you.",
  appearance: "Appearance", appearanceDetail: "Choose the light for your space.", bright: "Pearl light", dark: "Evening plum",
  languageDetail: "The language you feel at home in.", motionDetail: "A quieter experience with less movement.",
  feedback: "Touch feedback", feedbackDetail: "Gentle vibration on supported devices.",
  device: "Profiles & storage", deviceDetail: "This device, your saved details, your choices.",
  beta: "This beta uses a profile linked to this device. Some saved content is stored by Hint services; opening a profile does not sync it across devices.",
  account: "Profile access", accountDetail: "Manage a local beta profile.", create: "Create a local profile", open: "Open a local profile",
  help: "A little guidance", helpDetail: "About Hint, support and the small print.",
  privacyDetail: "How Hint handles your information.", supportDetail: "Find help or get in touch.",
  clearDetail: "Delete readings, notes and saved cards. Your profile, birth details and preferences stay.",
  clearLabel: "Manage saved history", clearIntro: "Review what will be removed before confirming.",
  footer: "A space for reflection, at your own pace.",
} as const;

export type MeCopy = { [K in keyof typeof en]: string };
export const ME_COPY: Record<HintLanguage, MeCopy> = {
  en,
  zh: {
    title: "我的空间", subtitle: "收藏心意，也找到自己的舒适节奏。", localProfile: "本机个人资料",
    birthDetails: "出生资料", birthIntro: "从这里开始认识你的个人星盘。", date: "日期", time: "时间", place: "地点", unknown: "尚未填写", unknownTime: "时间未知",
    birthMissing: "准备好时，添加出生资料，开始探索你的星盘。", edit: "编辑资料", editIntro: "这些资料会与本机个人档案一同保存。", back: "返回我的空间",
    personalSpace: "属于你的", chart: "我的出生星盘", chartDetail: "认识你的行星配置。", history: "阅读记录", historyDetail: "重读那些曾经触动你的话。", collection: "我的收藏", collectionDetail: "珍藏的牌卡，都在这里。",
    preferences: "我的氛围", preferencesDetail: "让 Hint 更贴近你的习惯。", appearance: "外观", appearanceDetail: "为你的空间选择一道光。", bright: "珍珠微光", dark: "暮色梅紫", languageDetail: "选择最自在的语言。", motionDetail: "减少画面移动，让体验更安静。", feedback: "触感反馈", feedbackDetail: "在支持的设备上提供轻柔振动。",
    device: "档案与储存", deviceDetail: "管理这台设备上的资料与选择。", beta: "此测试版使用与本设备关联的档案。部分保存内容储存在 Hint 服务中；打开档案不会在设备之间同步资料。", account: "档案入口", accountDetail: "管理本机测试版档案。", create: "创建本机档案", open: "打开本机档案",
    help: "一些帮助", helpDetail: "了解 Hint、获取帮助及阅读相关说明。", privacyDetail: "了解 Hint 如何处理你的资料。", supportDetail: "查找帮助或联系我们。", clearDetail: "删除阅读、笔记和收藏牌卡。个人资料、出生信息与偏好会保留。", clearLabel: "管理已保存记录", clearIntro: "确认前，请查看将删除的内容。", footer: "留一点空间，按自己的节奏反思。",
  },
  es: {
    title: "Tu espacio", subtitle: "Lo que guardas. Lo que te hace sentir en casa.", localProfile: "Tu perfil local",
    birthDetails: "Datos de nacimiento", birthIntro: "El punto de partida de tu carta natal.", date: "Fecha", time: "Hora", place: "Lugar", unknown: "Sin añadir", unknownTime: "Hora desconocida", birthMissing: "Añade tus datos cuando quieras explorar tu carta natal.", edit: "Editar datos", editIntro: "Estos datos se guardan con tu perfil local.", back: "Volver a tu espacio",
    personalSpace: "Algo muy tuyo", chart: "Mi carta natal", chartDetail: "Explora tus posiciones planetarias.", history: "Historial de lecturas", historyDetail: "Vuelve a las palabras que te acompañaron.", collection: "Mi colección", collectionDetail: "Tus cartas guardadas, en un solo lugar.",
    preferences: "Crea tu ambiente", preferencesDetail: "Haz que Hint se sienta más tuyo.", appearance: "Apariencia", appearanceDetail: "Elige la luz de tu espacio.", bright: "Luz de perla", dark: "Ciruela nocturna", languageDetail: "El idioma en el que te sientes a gusto.", motionDetail: "Una experiencia tranquila, con menos movimiento.", feedback: "Respuesta táctil", feedbackDetail: "Vibración suave en dispositivos compatibles.",
    device: "Perfiles y almacenamiento", deviceDetail: "Tu dispositivo, tus datos, tus decisiones.", beta: "Esta beta usa un perfil vinculado a este dispositivo. Parte del contenido guardado se almacena en los servicios de Hint; abrir un perfil no lo sincroniza entre dispositivos.", account: "Acceso al perfil", accountDetail: "Gestiona un perfil de la beta local.", create: "Crear un perfil local", open: "Abrir un perfil local",
    help: "Un poco de ayuda", helpDetail: "Sobre Hint, ayuda y condiciones de uso.", privacyDetail: "Cómo trata Hint tu información.", supportDetail: "Busca ayuda o ponte en contacto.", clearDetail: "Elimina lecturas, notas y cartas guardadas. Tu perfil, datos natales y preferencias se conservan.", clearLabel: "Gestionar el historial guardado", clearIntro: "Revisa qué se eliminará antes de confirmar.", footer: "Un espacio para reflexionar a tu ritmo.",
  },
  ja: {
    title: "あなたの空間", subtitle: "大切にしたいもの。心地よく過ごせる場所。", localProfile: "端末内のプロフィール",
    birthDetails: "出生情報", birthIntro: "あなただけの出生図を知る出発点。", date: "日付", time: "時刻", place: "場所", unknown: "未入力", unknownTime: "時刻不明", birthMissing: "出生図を見てみたくなったら、出生情報を追加しましょう。", edit: "情報を編集", editIntro: "これらの情報は端末内のプロフィールに保存されます。", back: "あなたの空間に戻る",
    personalSpace: "あなたのために", chart: "私の出生図", chartDetail: "あなたの天体配置を見てみましょう。", history: "リーディング履歴", historyDetail: "心に残った言葉を、もう一度。", collection: "マイコレクション", collectionDetail: "保存したカードをひとつの場所に。",
    preferences: "心地よい雰囲気に", preferencesDetail: "Hintをあなたらしく整えましょう。", appearance: "外観", appearanceDetail: "空間を照らす光を選んでください。", bright: "パールの光", dark: "夜のプラム", languageDetail: "心地よく読める言語を。", motionDetail: "動きを抑えた、より静かな体験。", feedback: "触覚フィードバック", feedbackDetail: "対応端末で穏やかな振動を使います。",
    device: "プロフィールと保存", deviceDetail: "この端末の情報を、あなたの選択で。", beta: "このベータ版は端末に紐づくプロフィールを使用します。保存内容の一部はHintのサービスにも保存されます。プロフィールを開いても端末間では同期されません。", account: "プロフィールへのアクセス", accountDetail: "ローカルベータのプロフィールを管理。", create: "ローカルプロフィールを作成", open: "ローカルプロフィールを開く",
    help: "使い方とご案内", helpDetail: "Hintについて、サポートと各種規約。", privacyDetail: "Hintでの情報の取り扱いについて。", supportDetail: "ヘルプを探す・お問い合わせ。", clearDetail: "リーディング、メモ、保存カードを削除します。プロフィール、出生情報、設定は残ります。", clearLabel: "保存した履歴を管理", clearIntro: "確定する前に、削除される内容をご確認ください。", footer: "自分のペースで、心を見つめる空間。",
  },
  ko: {
    title: "나만의 공간", subtitle: "간직하고 싶은 것들. 편안히 머무는 방식.", localProfile: "기기에 저장된 프로필",
    birthDetails: "출생 정보", birthIntro: "나만의 출생 차트를 알아가는 시작점.", date: "날짜", time: "시간", place: "장소", unknown: "입력하지 않음", unknownTime: "시간 모름", birthMissing: "차트를 살펴보고 싶을 때 출생 정보를 추가하세요.", edit: "정보 수정", editIntro: "이 정보는 기기의 로컬 프로필과 함께 저장됩니다.", back: "나만의 공간으로 돌아가기",
    personalSpace: "나를 위한 기록", chart: "나의 출생 차트", chartDetail: "나의 행성 배치를 살펴보세요.", history: "리딩 기록", historyDetail: "마음에 남았던 말을 다시 만나세요.", collection: "나의 컬렉션", collectionDetail: "간직한 카드를 한곳에서 만나세요.",
    preferences: "나만의 분위기", preferencesDetail: "Hint를 나에게 더 편안하게.", appearance: "화면 테마", appearanceDetail: "공간을 채울 빛을 골라보세요.", bright: "진주빛", dark: "저녁의 자두빛", languageDetail: "가장 편안한 언어를 선택하세요.", motionDetail: "움직임을 줄여 더 차분한 경험을.", feedback: "터치 피드백", feedbackDetail: "지원 기기에서 부드러운 진동을 사용합니다.",
    device: "프로필과 저장 공간", deviceDetail: "이 기기의 정보와 설정을 관리하세요.", beta: "이 베타는 기기에 연결된 프로필을 사용합니다. 저장한 콘텐츠 일부는 Hint 서비스에 보관됩니다. 프로필을 열어도 기기 간에 동기화되지 않습니다.", account: "프로필 열기", accountDetail: "로컬 베타 프로필을 관리하세요.", create: "로컬 프로필 만들기", open: "로컬 프로필 열기",
    help: "도움이 필요할 때", helpDetail: "Hint 소개, 도움말과 이용 안내.", privacyDetail: "Hint가 정보를 처리하는 방법.", supportDetail: "도움말을 찾거나 문의하세요.", clearDetail: "리딩, 메모, 저장한 카드를 삭제합니다. 프로필, 출생 정보와 설정은 유지됩니다.", clearLabel: "저장한 기록 관리", clearIntro: "확인하기 전에 삭제될 내용을 살펴보세요.", footer: "나의 속도로 돌아보는 공간.",
  },
};

export const ME_LOCALES: Record<HintLanguage, string> = { en: "en-US", zh: "zh-CN", es: "es-ES", ja: "ja-JP", ko: "ko-KR" };
