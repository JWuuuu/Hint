import type { HintLanguage } from "./i18n";
export const QUALITY_COPY: Record<HintLanguage, Record<string, string>> = {
  "en": {
    "quality.savedLocal": "Saved locally",
    "quality.saveRetry": "Not saved. Retry saving",
    "quality.saveCollection": "Save to Collection",
    "quality.draftFailed": "Draft is only on this screen. Local storage is unavailable.",
    "quality.retry": "Retry",
    "quality.historyError": "History could not be loaded. Available local records are shown below.",
    "quality.clearConfirm": "Delete your readings, journal entries, drafts, collection and compatibility records? Shared compatibility links you created will stop working. Your account, birth details, language, appearance and today’s card remain.",
    "quality.clearError": "Could not finish clearing history. Retry to complete; your account and preferences are preserved.",
    "quality.birthConflict": "Birth details disagree between saved profiles. Review and save the correct details before calculating a chart. Both original records are preserved."
  },
  "zh": {
    "quality.savedLocal": "已存本机",
    "quality.saveRetry": "尚未保存。重试保存",
    "quality.saveCollection": "保存到收藏",
    "quality.draftFailed": "草稿仅保留在此画面。本机存储不可用。",
    "quality.retry": "重试",
    "quality.historyError": "无法加载历史。下方显示可用的本机记录。",
    "quality.clearConfirm": "删除阅读、日记、草稿、收藏和合盘记录？你创建的合盘分享链接将失效。账号、出生资料、语言、外观和今日牌保持不变。",
    "quality.clearError": "未能完成历史清除。请重试；账号和偏好设置已保留。",
    "quality.birthConflict": "保存的出生资料不一致。请确认并保存正确资料后再计算星盘。原始记录均已保留。"
  },
  "es": {
    "quality.savedLocal": "Guardado localmente",
    "quality.saveRetry": "No se guardó. Reintentar",
    "quality.saveCollection": "Guardar en la colección",
    "quality.draftFailed": "El borrador solo está en esta pantalla. El almacenamiento local no está disponible.",
    "quality.retry": "Reintentar",
    "quality.historyError": "No se pudo cargar el historial. Abajo se muestran los registros locales disponibles.",
    "quality.clearConfirm": "¿Eliminar lecturas, diario, borradores, colección y compatibilidades? Tus enlaces de compatibilidad dejarán de funcionar. Se conservan cuenta, datos de nacimiento, idioma, apariencia y carta de hoy.",
    "quality.clearError": "No se pudo completar el borrado. Reintenta; tu cuenta y preferencias se conservan.",
    "quality.birthConflict": "Los perfiles guardados tienen datos de nacimiento distintos. Revisa y guarda los datos correctos antes de calcular la carta. Se conservan ambos originales."
  },
  "ja": {
    "quality.savedLocal": "この端末に保存済み",
    "quality.saveRetry": "未保存。保存を再試行",
    "quality.saveCollection": "コレクションに保存",
    "quality.draftFailed": "下書きはこの画面にのみ残っています。端末に保存できません。",
    "quality.retry": "再試行",
    "quality.historyError": "履歴を読み込めませんでした。利用可能な端末の記録を表示しています。",
    "quality.clearConfirm": "リーディング、日記、下書き、コレクション、相性記録を削除しますか？作成した相性共有リンクは無効になります。アカウント、出生情報、言語、外観、今日のカードは保持されます。",
    "quality.clearError": "履歴の削除が完了しませんでした。再試行してください。アカウントと設定は保持されています。",
    "quality.birthConflict": "保存された出生情報が一致しません。正しい情報を確認して保存してから計算してください。元の記録は両方保持されています。"
  },
  "ko": {
    "quality.savedLocal": "이 기기에 저장됨",
    "quality.saveRetry": "저장되지 않았습니다. 다시 저장",
    "quality.saveCollection": "컬렉션에 저장",
    "quality.draftFailed": "초안은 이 화면에만 남아 있습니다. 기기 저장소를 사용할 수 없습니다.",
    "quality.retry": "다시 시도",
    "quality.historyError": "기록을 불러오지 못했습니다. 이용 가능한 기기 기록을 아래에 표시합니다.",
    "quality.clearConfirm": "리딩, 일기, 초안, 컬렉션 및 궁합 기록을 삭제할까요? 생성한 궁합 공유 링크는 사용할 수 없게 됩니다. 계정, 출생 정보, 언어, 외관 및 오늘의 카드는 유지됩니다.",
    "quality.clearError": "기록 삭제를 완료하지 못했습니다. 다시 시도하세요. 계정과 설정은 유지됩니다.",
    "quality.birthConflict": "저장된 출생 정보가 서로 다릅니다. 올바른 정보를 확인하고 저장한 후 차트를 계산하세요. 원본 기록은 모두 보존됩니다."
  }
};
Object.assign(QUALITY_COPY.en, { "common.cancel": "Cancel", "tarot.flow.chat.local.cardMeaning": "At {position}, {card} ({orientation}) invites you to separate facts, hopes and worries before choosing an honest next step.", "tarot.flow.chat.local.invitation": "You can ask about a card to explore it further.", "tarot.flow.chat.local.followUpReply": "About {followUp}: {card} ({orientation}) invites you to separate facts from hopes and choose a clear, reversible next step." });
Object.assign(QUALITY_COPY.zh, { "common.cancel": "取消", "tarot.flow.chat.local.cardMeaning": "在{position}位置，{card}（{orientation}）邀请你分清事实、期待与担忧，再选择诚实的下一步。", "tarot.flow.chat.local.invitation": "你可以继续问某张牌，探索更深的含义。", "tarot.flow.chat.local.followUpReply": "关于{followUp}：{card}（{orientation}）邀请你分清事实与期待，再选择清楚、可收回的下一步。" });
Object.assign(QUALITY_COPY.es, { "common.cancel": "Cancelar", "tarot.flow.chat.local.cardMeaning": "En {position}, {card} ({orientation}) invita a separar hechos, esperanzas y preocupaciones antes de elegir un paso honesto.", "tarot.flow.chat.local.invitation": "Puedes preguntar por una carta para profundizar.", "tarot.flow.chat.local.followUpReply": "Sobre {followUp}: {card} ({orientation}) invita a separar hechos y esperanzas, y elegir un paso claro y reversible." });
Object.assign(QUALITY_COPY.ja, { "common.cancel": "キャンセル", "tarot.flow.chat.local.cardMeaning": "{position}の{card}（{orientation}）は、事実・期待・心配を分けてから誠実な一歩を選ぶよう促します。", "tarot.flow.chat.local.invitation": "気になるカードについて、さらに質問できます。", "tarot.flow.chat.local.followUpReply": "{followUp}について：{card}（{orientation}）は、事実と期待を分け、明確で引き返せる一歩を選ぶよう促します。" });
Object.assign(QUALITY_COPY.ko, { "common.cancel": "취소", "tarot.flow.chat.local.cardMeaning": "{position}의 {card}({orientation})는 사실, 기대, 걱정을 구분한 뒤 솔직한 다음 걸음을 고르도록 권해요.", "tarot.flow.chat.local.invitation": "카드에 관해 더 깊이 질문할 수 있어요.", "tarot.flow.chat.local.followUpReply": "{followUp}에 대해: {card}({orientation})는 사실과 기대를 구분하고 명확하고 되돌릴 수 있는 다음 걸음을 고르도록 권해요." });
const betaCopy = {
  en: ["Local beta profile. Formal sign-in and cross-device synchronization are not connected.", "Demo code generated for {target}. No email or SMS was sent.", "This demonstration does not send email or SMS.", "A demo code creates a profile on this device; it does not verify ownership of an email or phone number.", "Apple, Google and Facebook sign-in are previews and are not connected.", "Birth details save on this device and, when connected, to the configured beta server. This does not enable cross-device login or synchronization.", "The tester profile contains fictional birth details for previewing the form.", "Generate demo code"],
  zh: ["本机 beta 档案。正式登录与跨设备同步尚未连接。", "已为 {target} 生成演示码，未寄送邮件或短信。", "此演示不会寄送邮件或短信。", "演示码仅在本机创建档案，不会验证邮箱或电话号码的所有权。", "Apple、Google 与 Facebook 登录为预览，尚未连接。", "出生资料保存在本机，并在连接时保存至配置的 beta 服务器。这不提供跨设备登录或同步。", "测试档案使用虚构出生资料来预览表单。", "生成演示码"],
  es: ["Perfil beta local. El acceso real y la sincronización entre dispositivos no están conectados.", "Código de demostración generado para {target}. No se envió correo ni SMS.", "Esta demostración no envía correos ni SMS.", "El código crea un perfil en este dispositivo; no verifica la propiedad de un correo o teléfono.", "El acceso con Apple, Google y Facebook es una vista previa sin conexión.", "Los datos de nacimiento se guardan en este dispositivo y, al conectarse, en el servidor beta configurado. Esto no habilita el acceso ni la sincronización entre dispositivos.", "El perfil de prueba contiene datos ficticios para previsualizar el formulario.", "Generar código de prueba"],
  ja: ["端末内のベータプロフィールです。正式なログインや端末間同期は未接続です。", "{target} のデモコードを生成しました。メールやSMSは送信していません。", "このデモではメールやSMSを送信しません。", "デモコードは端末内にプロフィールを作ります。メールや電話番号の所有者確認は行いません。", "Apple・Google・Facebookログインは未接続のプレビューです。", "出生情報は端末内と、接続時には設定済みのベータサーバーに保存されます。端末間のログインや同期はできません。", "テスト用プロフィールは架空の出生情報を使ったフォームのプレビューです。", "デモコードを生成"],
  ko: ["기기 내 베타 프로필입니다. 정식 로그인과 기기 간 동기화는 연결되지 않았습니다.", "{target}의 데모 코드를 생성했습니다. 이메일이나 SMS는 보내지 않았습니다.", "이 데모는 이메일이나 SMS를 보내지 않습니다.", "데모 코드는 기기에 프로필을 만들며 이메일이나 전화번호의 소유권을 확인하지 않습니다.", "Apple, Google, Facebook 로그인은 연결되지 않은 미리보기입니다.", "출생 정보는 이 기기에 저장되고 연결되면 설정된 베타 서버에도 저장돼요. 기기 간 로그인이나 동기화를 제공하지는 않아요.", "테스터 프로필은 폼 미리보기용 가상 출생 정보를 사용합니다.", "데모 코드 생성"],
};
QUALITY_COPY.en["quality.synced"] = "Synced to the configured beta server";
QUALITY_COPY.en["dailyPull.eyebrow"] = "Daily reflection";
QUALITY_COPY.zh["dailyPull.eyebrow"] = "每日反思";
QUALITY_COPY.es["dailyPull.eyebrow"] = "Reflexión diaria";
QUALITY_COPY.ja["dailyPull.eyebrow"] = "毎日の振り返り";
QUALITY_COPY.ko["dailyPull.eyebrow"] = "매일의 성찰";
QUALITY_COPY.zh["quality.synced"] = "已同步至配置的 beta 服务器";
QUALITY_COPY.es["quality.synced"] = "Sincronizado con el servidor beta configurado";
QUALITY_COPY.ja["quality.synced"] = "設定済みのベータサーバーに同期済み";
QUALITY_COPY.ko["quality.synced"] = "설정된 베타 서버에 동기화됨";
for (const locale of Object.keys(betaCopy) as HintLanguage[]) {
  ["login.subtitle", "login.notice.codeRequested", "login.betaCodeSuffix", "login.saves.item1", "login.saves.item2", "login.saves.item3", "login.saves.item4", "login.requestCode"].forEach((key, index) => { QUALITY_COPY[locale][key] = betaCopy[locale][index]; });
}

Object.assign(QUALITY_COPY.en, {"quality.cardConflict":"Your revealed card is kept on this device. A different revealed server card prevents synchronization.","quality.cardPending":"Saved on this device; waiting to sync.","quality.cardMemory":"This card is only in memory. Keep this screen open and retry saving."});
Object.assign(QUALITY_COPY.zh, {"quality.cardConflict":"此设备保留原牌。服务器已有不同的已揭示牌，因此尚未同步。","quality.cardPending":"已存本机，等待同步。","quality.cardMemory":"此牌仅保留在当前画面。请保持画面开启并重试保存。"});
Object.assign(QUALITY_COPY.es, {"quality.cardConflict":"Tu carta se conserva aquí. Otra carta revelada en el servidor impide sincronizarla.","quality.cardPending":"Guardado en este dispositivo; pendiente de sincronización.","quality.cardMemory":"Esta carta solo está en memoria. Mantén la pantalla abierta y vuelve a guardarla."});
Object.assign(QUALITY_COPY.ja, {"quality.cardConflict":"公開したカードをこの端末に保持しています。サーバーのカードと異なるため未同期です。","quality.cardPending":"この端末に保存済み。同期を待っています。","quality.cardMemory":"この画面を開いたまま保存を再試行してください。"});
Object.assign(QUALITY_COPY.ko, {"quality.cardConflict":"공개한 카드는 이 기기에 유지됩니다. 서버의 카드와 달라 동기화되지 않았습니다.","quality.cardPending":"이 기기에 저장됨. 동기화 대기 중.","quality.cardMemory":"이 화면을 유지하고 저장을 다시 시도하세요."});
Object.assign(QUALITY_COPY.en, {"quality.shareFailed":"Could not create or download the image. Please retry.","quality.downloadStarted":"Download started. Check your downloads.","quality.sharePreview":"Share preview","quality.sharePrivacy":"Only the public personality result appears here. Your birth details and individual answers are excluded.","quality.download":"Download image","quality.editAnswers":"Review and edit answers"});
Object.assign(QUALITY_COPY.zh, {"quality.shareFailed":"无法生成或下载图片，请重试。","quality.downloadStarted":"已开始下载，请查看下载内容。","quality.sharePreview":"分享预览","quality.sharePrivacy":"仅显示公开的性格结果，不包含出生资料或个人答案。","quality.download":"下载图片","quality.editAnswers":"查看并修改答案"});
Object.assign(QUALITY_COPY.es, {"quality.shareFailed":"No se pudo crear o descargar la imagen. Reintenta.","quality.downloadStarted":"Descarga iniciada. Revisa tus descargas.","quality.sharePreview":"Vista previa para compartir","quality.sharePrivacy":"Solo aparece el resultado de personalidad. No incluye datos de nacimiento ni respuestas individuales.","quality.download":"Descargar imagen","quality.editAnswers":"Revisar y editar respuestas"});
Object.assign(QUALITY_COPY.ja, {"quality.shareFailed":"画像を作成またはダウンロードできませんでした。再試行してください。","quality.downloadStarted":"ダウンロードを開始しました。ダウンロード先を確認してください。","quality.sharePreview":"共有プレビュー","quality.sharePrivacy":"性格の結果のみを表示します。出生情報や個々の回答は含まれません。","quality.download":"画像をダウンロード","quality.editAnswers":"回答を確認・変更"});
Object.assign(QUALITY_COPY.ko, {"quality.shareFailed":"이미지를 생성하거나 다운로드하지 못했습니다. 다시 시도하세요.","quality.downloadStarted":"다운로드를 시작했습니다. 다운로드 목록을 확인하세요.","quality.sharePreview":"공유 미리보기","quality.sharePrivacy":"성격 결과만 표시합니다. 출생 정보와 개별 답변은 포함되지 않습니다.","quality.download":"이미지 다운로드","quality.editAnswers":"답변 검토 및 수정"});

// Release-flow templates include dynamic labels and accessibility text.
const flowCopy: Array<[string, string, string, string, string, string]> = [
  ["quality.originalText", "Original saved wording", "原始保存内容", "Texto original guardado", "保存時の原文", "저장된 원문"],
  ["quality.inviteAccepted", "Invitation already accepted", "邀请已被接受", "Invitación ya aceptada", "招待は受諾済みです", "이미 수락된 초대"],
  ["quality.privateResult", "This result is private to the profiles that created and accepted the invitation.", "此结果仅对创建和接受邀请的档案开放。", "Este resultado es privado para los perfiles que crearon y aceptaron la invitación.", "結果は招待を作成・受諾したプロフィールにのみ表示されます。", "이 결과는 초대를 만들고 수락한 프로필만 볼 수 있어요."],
  ["quality.localProfiles", "Profiles on this device", "此设备上的档案", "Perfiles de este dispositivo", "この端末のプロフィール", "이 기기의 프로필"],
  ["quality.localProfilesHint", "Each local profile keeps separate birth details, conversations and history. Selecting one does not sign in to an online account. Changing an email label does not switch profiles.", "每个本机档案分别保存出生资料、对话和历史。切换不会登录线上账号，修改邮箱标签也不会切换档案。", "Cada perfil local conserva sus propios datos, conversaciones e historial. Seleccionarlo no inicia sesión en una cuenta en línea. Cambiar la etiqueta de correo no cambia de perfil.", "各プロフィールは出生情報・会話・履歴を個別に保存します。選択してもオンラインアカウントにはログインしません。メール表示の変更では切り替わりません。", "로컬 프로필마다 출생 정보, 대화와 기록을 따로 저장해요. 선택해도 온라인 계정에 로그인하지 않으며 이메일 표시를 바꿔도 프로필은 전환되지 않아요."],
  ["quality.newLocalProfile", "Start another local profile", "建立另一个本机档案", "Crear otro perfil local", "別の端末内プロフィールを作る", "다른 로컬 프로필 만들기"],
  ["quality.restoreProfile", "Switch to {name}", "切换到{name}", "Cambiar a {name}", "{name}に切り替える", "{name}(으)로 전환"],
  ["quality.unnamedProfile", "Local profile {number}", "本机档案{number}", "Perfil local {number}", "端末内プロフィール{number}", "로컬 프로필 {number}"],
  ["quality.accountSaveFailed", "Could not save on this device. Your details remain here; retry when storage is available.", "无法存入本机。资料仍保留在这里，请在存储可用时重试。", "No se pudo guardar en este dispositivo. Tus datos siguen aquí; reintenta cuando haya espacio disponible.", "この端末に保存できませんでした。入力内容は保持しています。保存可能になったら再試行してください。", "기기에 저장하지 못했어요. 입력 내용은 유지되니 저장 공간을 사용할 수 있을 때 다시 시도하세요."],
  ["quality.unsaved", "Not saved on this device", "尚未存入本机", "Sin guardar en este dispositivo", "この端末には未保存", "이 기기에 저장되지 않음"],
  ["quality.copied", "Link copied", "已复制链接", "Enlace copiado", "リンクをコピーしました", "링크를 복사했어요"],
  ["quality.copyFailed", "Could not copy. Select the link and copy it manually.", "无法复制。请选择链接并手动复制。", "No se pudo copiar. Selecciona el enlace y cópialo manualmente.", "コピーできませんでした。リンクを選択して手動でコピーしてください。", "복사하지 못했어요. 링크를 선택해 직접 복사하세요."],
  ["quality.askSaved", "Conversation saved on this device", "对话已存入本机", "Conversación guardada en este dispositivo", "会話をこの端末に保存しました", "대화를 이 기기에 저장했어요"],
  ["quality.askUnsaved", "This reply is only on this screen. Retry saving the conversation.", "此回复仅保留在画面中。请重试保存对话。", "Esta respuesta solo está en pantalla. Reintenta guardar la conversación.", "この返信は画面上にのみ残っています。会話の保存を再試行してください。", "답변은 이 화면에만 남아 있어요. 대화 저장을 다시 시도하세요."],
  ["quality.askHistory", "Ask conversations", "Ask 对话记录", "Conversaciones de Ask", "Ask の会話履歴", "Ask 대화 기록"],
  ["quality.askResume", "Continue conversation", "继续对话", "Continuar conversación", "会話を続ける", "대화 이어가기"],
  ["quality.askNew", "New conversation", "新对话", "Nueva conversación", "新しい会話", "새 대화"],
  ["quality.quizSaved", "Quiz progress saved on this device", "测验进度已存入本机", "Progreso guardado en este dispositivo", "クイズの進み具合をこの端末に保存しました", "퀴즈 진행 상황을 기기에 저장했어요"],
  ["quality.character", "{name} character", "{name}角色", "Personaje: {name}", "{name}のキャラクター", "{name} 캐릭터"],
  ["quality.invited", "{name} invited you", "{name}邀请了你", "{name} te ha invitado", "{name}さんからの招待", "{name}님의 초대"],
  ["quality.someone", "Someone", "某人", "Alguien", "ある人", "누군가"],
  ["quality.chartAnchor", "{sun} Sun, {moon} Moon, {rising} Rising will anchor the shared chart.", "共享星盘将以太阳{sun}、月亮{moon}和上升{rising}为基础。", "El Sol en {sun}, la Luna en {moon} y el ascendente en {rising} serán la base de la carta compartida.", "太陽{sun}・月{moon}・アセンダント{rising}を共有チャートの基礎にします。", "태양 {sun}, 달 {moon}, 상승궁 {rising}을 공유 차트의 기초로 사용해요."],
  ["quality.calculatedChart", "Calculated chart comparison", "已计算的星盘比较", "Comparación de cartas calculadas", "計算済みチャートの比較", "계산된 차트 비교"],
  ["quality.collectionReward", "Today's reward stays in your deck once opened. Next reset: {date}.", "今日奖励开启后会保留在牌组中。下次重置：{date}。", "La recompensa de hoy permanece en tu baraja al abrirla. Próximo reinicio: {date}.", "今日の報酬は開くとデッキに残ります。次の更新：{date}。", "오늘의 보상은 열면 덱에 남아요. 다음 갱신: {date}."],
  ["quality.openRare", "Open today's rare reward for {card}", "开启今日稀有奖励：{card}", "Abrir la recompensa rara de hoy: {card}", "今日のレア報酬を開く：{card}", "오늘의 희귀 보상 열기: {card}"],
  ["quality.replayRare", "Replay rare unlock for {card}", "重播稀有解锁：{card}", "Repetir el desbloqueo raro de {card}", "レアカードの解放を再生：{card}", "희귀 카드 해제 다시 보기: {card}"],
  ["quality.lockedCard", "{card} locked", "{card}尚未解锁", "{card} bloqueada", "{card}は未解放", "{card} 잠김"],
  ["quality.searchRooms", "Search rooms", "搜索房间", "Buscar salas", "部屋を検索", "방 검색"],
  ["quality.roomCategories", "Room categories", "房间分类", "Categorías de salas", "部屋のカテゴリー", "방 분류"],
  ["quality.allRooms", "All", "全部", "Todas", "すべて", "전체"],
  ["quality.includePreviews", "Include previews and upcoming rooms", "包括预览与开发中的房间", "Incluir vistas previas y próximas salas", "プレビューと今後の部屋を含める", "미리보기와 예정된 방 포함"],
  ["quality.roomCount", "Rooms: {count}", "房间：{count}个", "Salas: {count}", "部屋：{count}", "방: {count}개"],
  ["quality.noRooms", "No rooms found", "没有符合的房间", "No se encontraron salas", "部屋が見つかりません", "검색된 방이 없어요"],
  ["quality.noRoomsHint", "Try another word, or reset your filters.", "试试其他关键词，或清除筛选。", "Prueba otra palabra o restablece los filtros.", "別の言葉を試すか、絞り込みを解除してください。", "다른 단어로 검색하거나 필터를 초기화하세요."],
  ["quality.resetFilters", "Reset filters", "清除筛选", "Restablecer filtros", "絞り込みを解除", "필터 초기화"],
  ["quality.preview", "Preview", "预览", "Vista previa", "プレビュー", "미리보기"],
  ["quality.upcoming", "Coming soon", "即将推出", "Próximamente", "近日公開", "출시 예정"],
  ["quality.onboardingStep", "Step {step} of 3", "第{step}步，共3步", "Paso {step} de 3", "全3ステップ中の{step}", "3단계 중 {step}단계"],
  ["quality.birthMonth", "Birth month", "出生月份", "Mes de nacimiento", "出生月", "출생 월"],
  ["quality.birthDay", "Birth day", "出生日期", "Día de nacimiento", "出生日", "출생 일"],
  ["quality.birthYear", "Birth year", "出生年份", "Año de nacimiento", "出生年", "출생 연도"],
  ["quality.temporaryService", "The reading service is temporarily unavailable. Your question is kept here; please try again later.", "解读服务暂时不可用。问题已保留，请稍后重试。", "El servicio de lecturas no está disponible temporalmente. Tu pregunta se conserva; vuelve a intentarlo más tarde.", "リーディングサービスを一時的に利用できません。質問は保持しています。しばらくして再試行してください。", "리딩 서비스를 잠시 이용할 수 없어요. 질문은 유지되니 나중에 다시 시도하세요."],
];
for (const [key, ...values] of flowCopy) {
  (["en", "zh", "es", "ja", "ko"] as HintLanguage[]).forEach((locale, index) => { QUALITY_COPY[locale][key] = values[index]; });
}
for (const locale of ["en", "zh", "es", "ja", "ko"] as HintLanguage[]) {
  QUALITY_COPY[locale]["ask.error.quota"] = QUALITY_COPY[locale]["quality.temporaryService"];
  QUALITY_COPY[locale]["tarot.error.quota"] = QUALITY_COPY[locale]["quality.temporaryService"];
}
