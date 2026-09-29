# Hint 三方整合驗收 — 2026-09-29

以 `b9594adf2f4d3114cf8bc33d6cd319d123477a13` 的功能版為基底，移植小宇 Home／Daily 的視覺與甜甜的小票機；不以 ZIP 覆蓋較新的功能、安全或保存邏輯。

實作提交：`2f6c1962aa0cee608ec536daa835148fc3a7d98a`（前一批小票模組提交 `f17e272`）。

[手機畫面圖庫](gallery.html) · [Daily 小票 PNG](daily-receipt-sample.png) · [Tarot 公開小票 PNG](tarot-public-receipt-sample.png) · [修正清單](fixes.json)

## 來源與保留範圍

| 來源 | 採用內容 | 識別 |
|---|---|---|
| 功能版 | Tarot、Astrology、身份隔離、保存、追問、歷史與錯誤恢復 | 原交接分支 `codex/windows-handoff-2026-09-12` |
| 小宇 `latest-hint` | 首頁字級與留白、日牌、分數、房間格狀入口、Daily 日期橫列與分數柱、導航外觀 | ZIP SHA-256 `ffef50e609c0f5265cb881e7979fcb85c26092f33e69041493673b6c71c4c31f` |
| 甜甜 `receipt-printer-polish` | 原始機器、紙張素材、送紙與列印效果 | ZIP SHA-256 `45372b60426823d48cb9d647507b43c215885ccc9c560be0b5741fa8dea728ae` |

小票機由展示畫面改為分享浮層，移除示範 Wheel／66 分及素材內的固定英文提示。保留原素材的機器、空白紙張與撕邊。所有分享內容均來自當次已揭示牌／閱讀快照，不會重新抽牌。

`protected-core.json` 記錄未修改的 Tarot 牌序、物理、狀態機、保存、身份與清除歷史檔案。API、資料庫 schema、migration 及 Astrology 實作未變更。

## 已完成的整合與修正

| 項目 | 修正 | 證據 |
|---|---|---|
| Home／Daily 視覺 | 使用小宇的圖文比例、格狀入口、分數柱、日期列；保留正式資料與原房間導覽 | Home motion、Daily history/text、merge receipt E2E |
| 歷史日期 | 優先已保存牌卡；不以未揭示的新分配覆蓋；不生成缺少的歷史分數與幸运資訊 | `a saved historical Daily card wins...` |
| 日期觸控與長字 | 前後日期鍵至少 44px；期間選單與分數欄可換行；保留橫向日期捲動 | SE 西文 200% 真實字級測試 |
| 分享來源 | Home、Daily、Tarot 當次／歷史閱讀均可開啟；日期、全部牌位、正逆位與摘要來自固定快照 | PNG 尺寸／繪圖邊界／內容與原保存資料比對 |
| 分享隱私 | 每次開啟預設排除私人問題與個人解讀；明確同意後才加入；聊天永不加入 | 公開→私人→公開的實際 PNG 比對 |
| 列印與產圖 | 列印完成及圖片成功產生為兩個條件；有固定略過、重新列印與實際 PNG 預覽 | preparation failure、replay、download E2E |
| 過期工作 | 取消舊產圖／分享、釋放 object URL、身份與刪除版本檢查；不使用前一個隱私版本的圖片 | receipt component tests |
| 返回與焦點 | 共用 Dialog、Escape／返回關閉、背景鎖定；Safari 觸控開啟也能返回正確按鈕 | 手機矩陣的焦點與原牌不變斷言 |
| 五語系 | 分享狀態、同意、錯誤、按鈕、日期；補回 Home 新區塊和日期輔助名稱翻譯 | en／zh／es／ja／ko 矩陣 |
| 未設定公開網址 | 不輸出 localhost、placeholder 或不安全網址；省略 QR／下載呼籲 | receipt model tests |
| 過長私人文字 | 明確提示單張容量不足，使用者可改用公開反思；不靜默裁切 | oversized private text regression |

## 驗收結果

- 同一實作版本：前端 **695／695** 單元／元件測試通過，82 個檔案；API 與隔離資料庫 **66／66** 通過，9 個檔案。
- 前端／API／共用套件型別、前後端 production 建置、launch intro 檢查及本次 diff 空白檢查通過。
- production E2E **612 項完成記錄：586 通過、23 預定跳過、3 舊 SE golden 失敗**。使用者中斷前已有 219 項通過與 11 項跳過；保留完成行紀錄，再精確選取其餘 382 項，使用相同來源與 build 完成。沒有將中斷中的測試當成通過。
- 九種牌陣完整流程、1／3／5／7／9 張 PNG 與中文長內容、兩種手機的閱讀圖面、失敗重試及資料恢復均通過。三個失敗均為下方公開列出的舊基準差異，不能宣稱整套 pixel goldens 已通過。
- 效能以單 worker 分開執行：原功能版 **5／5**、合併版 **9／9** 通過；中斷前完成 8 項，僅續跑未完成的五次 Tarot。結果與限制記錄在 `performance.json`。

## 瀏覽器流暢度紀錄

| 量測 | 結果 |
|---|---|
| Home／捲動／揭牌／Animal／Tarot，四種動態設定 | 20 組對照；原版各組 frame gap p95 為 22–39ms，合併版為 22–28ms；兩版這些取樣均沒有超過 100ms 的 frame gap |
| 小票開啟、產圖、列印與重播 | 開啟至下一畫面 23ms；701 個取樣，p95 18ms；**仍有一次 183ms 長幀**，沒有連續長幀 |
| Astrology 星盤、詳情與捲動 | 互動 frame gap p95 19ms，最長 29ms |
| Auto Wash | p95 26ms，未觀察到連續停頓 |
| 連續五次 Tarot | 16,536／16,292／16,267／16,246／16,307ms；五次均完成並保存，最後一次未比首次變慢 |

這是同一台 Mac 的 WebKit 瀏覽器取樣，不是受控硬體 benchmark，也不是 Windows 或實體 iPhone 的結果。小票的單次長幀尚未定位到確切階段，列為後續 Windows／iPhone 的效能複核項；不能由 p95 或測試通過宣稱完全沒有卡頓。

## 驗收範圍與限制

`validation.json` 是同一候選版本的完整測試清單與結果；`runtime-manifest.json` 記錄來源雜湊，`performance.json` 記錄獨立循序的瀏覽器量測。圖片與 PNG 範例均為虛構資料。

| 範圍 | 驗收方法 |
|---|---|
| Tarot 九種牌陣 | Pro Max 從輸入、推薦、設定、Wash／Cut／Shuffle、Pick、Reveal、閱讀、保存、History 恢復逐一走完；SE 補九種布局與代表性完整流程 |
| 2.8 秒 Shuffle／手動 Wash | 真實拖曳、靜止手指、取消、放手、三疊切牌、雙疊交錯、事件遺失與背景中斷 |
| 分享 | 1／3／5／7／9 張圖文、正逆位、歷史日期、長中英文、私密內容同意、取消與重試 |
| Daily 連續性 | Home→Daily→Collection→分享；刷新、離線、同步衝突、跨午夜、筆記晚回應與配額失敗 |
| 其他共用介面 | Astrology、Profile、History、房間進出、底部導航、首次使用與失效邀請 |
| 圖面 | 375×667／440×956；明暗與五語；一般、僅 App、僅系統、兩者減少動態；實際 200% DOM 文字、捲動與操作區命中 |
| API／DB | 虛構 PostgreSQL 18 資料庫；身份權限、歷史交易、日牌衝突與增量 migration；未執行 db:push |

語言／主題／動態矩陣採明列組合覆蓋，非所有條件的完整笛卡兒積。實體 iPhone 的鍵盤、原生分享面板、觸覺、語音與生命週期仍未驗證；WebKit mock 不是實機證據。瀏覽器效能不是 60Hz 實機發布認證。

保留單張 PNG；超長私人文字不做多頁匯出。未加入後端 API、migration、正式登入或跨裝置同步。公開網址、簽章、Apple Team ID 與原生驗收仍為發布門檻。本輪未部署、未上傳 TestFlight、未寄送邀請，未使用付費 provider 或真實帳號資料。

## 舊畫面基準差異

SE 的 `pick-stars`、`pick-dawn`、`pick-sea` 三張 repository PNG 基準已落後於原功能版。用原交接 commit 另行建置後，三項也同樣失敗；原版與合併版的實際畫面逐像素比較均為 **0 像素差異**。`legacy-golden-comparison.json` 保存雜湊與比對結果，screenshots 保存實際畫面。原始 goldens 保持不變，測試失敗如實列在 validation 中，不列成通過，也沒有為了變綠而修改 Tarot 排版。

## 重現

Windows 啟動與精確交接版本請見根目錄 `HANDOFF_WINDOWS.md`。測試使用 `playwright.handoff.config.ts`，以 `HINT_E2E_BASE_URL` 指向隔離 production preview，以 `HINT_HANDOFF_OUTPUT` 指定新暫存目錄；不要連正式 API。

完整的既有 Tarot pixel goldens 保持原樣；不更新快照來隱藏差異。原生包監看測試不執行，因其會暫時寫入原生封裝資料夾。
