# Hint「每天一封宇宙來信」與 Tarot 儀式改善 — 2026-09-10

這輪以 **“The universe leaves you a letter every day.”／「宇宙每天都會給你寄一封信」** 作為品牌的詩意主題，將入口、牌面、動作與閱讀整理成收到一封信的儀式。整體偏柔和、成熟與女性向，同時保留任何人都能自然使用的中性閱讀介面。

工作順序是先重現使用者指出的入口、牌陣切換、洗牌與選牌遮擋，再修正共用返回導航，最後用同一 production 候選版本驗收。保留牌陣、實際選牌身份、保存與恢復，不部署、不上傳 TestFlight、不操作真實帳號或呼叫付費服務。

本輪候選完成 **618 個單元／元件測試、型別檢查與建置**；手機測試分段執行後按唯一案例彙整，**240 通過、12 項按範圍跳過，0 未完成、0 最終失敗**。實際可切換的 [iPhone 預覽](http://127.0.0.1:5219/app?hintPreview=frame) 使用虛構本機身份，API 維持隔離。

**這輪完成的改動**

| 區域 | 改動與目的 |
|---|---|
| iPhone 預覽 | Production 可用 `hintPreview=frame` 打開可切換的手機外框；提供 Pro Max、Pro、一般尺寸及 SE。切換機型調整尺寸與安全區，不重新建立房間，也不清除已輸入的問題。框架是瀏覽器預覽，不代表實機證據。 |
| Me → Tarot | 入口牌背符號更清楚，Tarot 過場調整為 400ms；預載房間程式，已就緒的房間可直接呈現，消除多餘載入閃現。裝飾層不攔截操作；App 或系統減少動態時保留短淡出。最終候選的逐幀回歸於兩個手機均通過。 |
| Personal spread | 上一個／下一個牌陣移到內容左右兩側，點擊範圍 48px。手勢先判斷方向，垂直捲動不誤切牌陣；水平滑動仍可切換。 |
| Wash deck | 修正手指正中心的牌無法受力，以及微小移動與快速拖曳強度相同的問題。擴大洗牌範圍、縮小牌面，讓牌散布於桌面；收牌沿用洗牌幾何，避免突然擠回小框。 |
| 洗牌節奏與切牌 | 降低洗牌節奏，按時間而非 RAF 次數推進，避免高更新率螢幕加速。縮小合成圖層的範圍，收牌完成有明確的結束界線，避免動畫事件未回報時卡住。六個針對性手機流程通過；桌面 WebKit 取樣的放手至切牌標題可見時間縮短約 0.5 秒。 |
| Pick Cards | 依已選牌槽的實際位置保留卡弧空間，逐一驗證九種牌陣；牌槽與卡弧之間至少保留 18px。收斂玫瑰、珍珠、柔紫色彩，減少突兀的高飽和色塊。 |
| 所有 space 的返回 | Astrology、Animal、Collection、Compatibility、Daily、History、Me 補上 Home。Journal、Dream、Login、歷史詳情、法律頁與合盤子頁保留具名的上一層，並提供 Home；使用明確路由，直接開啟或重新整理後仍能返回。 |

**重現與修正證據**

| 問題 | 修正前 | 修正後／目前證據 |
|---|---|---|
| Astrology 缺少清楚的頂部 Home | 兩個手機的既有 production 版均找不到 Home 控制；原先只有底部 Today 導航。 | 新增 44px Home，20 個直接入口、7 組子頁／重新整理返回，以及 Astrology 星座詳情／出生設定返回，於 SE、Pro Max 均驗證。 |
| 洗牌中心牌、範圍與受力 | 隔離物理案例確認中心固定、範圍太窄、1px 與 18px 移動反應相近。 | 三個前測先失敗，18 個針對性案例修正後通過；最終瀏覽器流程與截圖另列。 |
| 牌陣左右箭頭與手勢 | 舊版箭頭偏小且集中；垂直手勢可誤觸發橫向切換。 | 兩手機四個新回歸先失敗；修正後連同既有牌陣內容／取消手勢案例，共八項通過。[前測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/spread-before.log)／[後測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/spread-after.log)。 |
| 卡弧碰到已選牌槽 | 保留使用者回報版本的 SE／Pro Max 對照截圖，SE 可見卡弧跨入牌槽。 | 九種牌陣在兩個手機均通過完整卡弧與牌槽距離、選牌身份及重新整理恢復檢查。 |
| 預載後仍出現載入頁 | 瀏覽器逐幀觀測發現：只下載模組，仍可能先畫出路由載入內容。 | 修正已就緒模組的渲染銜接，同時維持穩定掛載身份；兩個手機的逐幀回歸通過，不再畫出多餘載入頁。[前測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/entry-final.log)／[後測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/entry-fixed.log)。 |

**相同候選版本的驗收結果**

| 驗收 | 狀態 | 證據／限制 |
|---|---|---|
| 全部前端單元／元件測試 | **618／618 通過** | 74 個測試檔；[最終日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/candidate-unit.log)。 |
| TypeScript／production build | **通過** | [型別日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/candidate-types.log)／[建置日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/candidate-build.log)。 |
| Production 手機 E2E | **240 通過／12 跳過** | SE 375×667／Pro Max 440×956；原執行保留 127 通過、1 跳過，因使用者中斷停止後，以相同來源和候選續跑，113 通過、11 跳過；按唯一案例彙整，0 缺漏、0 額外案例、0 最終失敗。 |
| 洗牌與切牌效能 | 已完成 12 組取樣 | 舊版／最終 5219 候選，每機型每版本各三次，依序執行；數據與限制見下表。 |
| 視覺證據 | **完成本輪畫面與實際操作檢查** | 5219 手機框完成 Home → Tarot → 牌陣、切 SE 檢查底部按鈕、返回 Pro Max → Home → Astrology → Home；另檢查洗牌、選牌與各頁返回截圖。 |
| 實體 iPhone／原生 | 未驗證 | 實機幀率、原生背景恢復、手勢返回、鍵盤、觸覺、分享與生命週期，仍需要裝置證據。 |

原執行的[具名日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/interrupted-e2e.log)已保存，中斷時未產生完整 JSON。使用 project、檔案與完整案例名稱去重，保留每次嘗試與來源；這是相同候選的分段驗收。[續跑日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/resume-e2e.log)／[續跑原始 JSON](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/resume-e2e.json)／[合併覆蓋清單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/combined-e2e.json)／[彙整程式](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/combine-verification.py)。Me 的 20 組獨立重跑作為補充證據，不再次加入 240 的數量。

| 手機覆蓋範圍 | 通過 | 跳過 |
|---|---:|---:|
| 九種選牌空間、手機框切換、Me → Tarot | 22 | 0 |
| Me 五語系、明暗、保存與錯誤恢復 | 29 | 1 |
| 各功能入口、動態設定、返回與清理 | 44 | 0 |
| 20 個直接入口、子頁與 Home 返回 | 14 | 0 |
| 九種牌陣完整選牌、閱讀、保存與恢復 | 9 | 9 |
| Tarot 問題、儀式、解讀、追問、保存、分享與版面 | 112 | 2 |
| 左右牌陣操作與手勢方向 | 4 | 0 |
| 洗牌受力、範圍、收牌與取消 | 6 | 0 |
| **合計** | **240** | **12** |

12 項跳過沿用明確的裝置分工：九個完整牌陣旅程在 Pro Max 執行，SE 保留九種版面回歸；西文 200% 壓力案例與縮短視窗的鍵盤版面案例只在 SE 執行（Pro Max 共跳過兩項）；連續五次儀式只在 Pro Max 執行（SE 跳過一項）。

另有 **28 個具名案例未納入這 252 項功能矩陣**，沒有算作通過：18 項沿用舊像素基準的截圖案例（語音完成 2、卡弧 6、閱讀版面 10），4 項開發模式手機預覽、2 項原生打包檔案 watcher、4 項主機效能門檻／入口 RAF 案例。本輪以實際 production 手機框與新的幾何／互動驗收檢查改版畫面；洗牌效能另以依序取樣列出。未更新舊快照，也未宣稱這 28 項全部重新驗證。[完整排除清單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/excluded-cases.json)。

**驗收中排除的誤報**

Me 多語系檢查曾把不可見的裝飾層誤判為文字溢出。以簡中 Home 為例，控制範圍為 73.84×44px，文字實際位於 x55–79，完整落在 x18–92 的控制範圍內，觸控命中正常；父層 `overflow:hidden`，透明裝飾偽元素卻令 `scrollWidth` 回報 103px。只在診斷瀏覽器停用該偽元素後，`scrollWidth` 變成 72px，文字與控制位置完全相同。

此處**未更動產品或更新快照**。測試改量真實 DOM 內容，並同時檢查內容沒有越出自己的控制範圍及手機內容範圍；原有觸控中心／邊緣與完整文字檢查保留。相同候選的 **20 組 Me 語言／主題／手機案例全部通過**。[重跑日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/logs/me-final.log)。[量測資料](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/home-decoration-measurements.json)／[實際畫面](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/home-zh-dark-inspection.png)。

**洗牌與切牌效能**

| 指標 | 修改前 | 最終候選 |
|---|---:|---:|
| 手動洗牌各次 frame gap p95 | 18–19ms | 18–19ms |
| 手動洗牌最大 frame gap | 19–21ms | 19–21ms |
| ≥100ms 間隔 | 0 | 0 |
| 放手至 Cut deck 標題可見 | 1801–1809ms | 1299–1314ms |

舊版 5205 與候選 5219 使用相同虛構輸入，SE／Pro Max 各重複三次；依序執行，取樣期間未錄影。**切牌等待縮短約 0.5 秒，但本次桌面 WebKit 沒有量到手動洗牌 FPS 提升。** 這些短時間取樣無法判定實體 iPhone 的 GPU、觸控延遲或長時間熱降頻。[原始資料](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/wash-performance.json)／[取樣程式](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/wash-profile.mjs)。

獨立程式審查未發現預載／掛載穩定性、入口清理或取消滑動的額外問題。

**代表畫面**

以下是最終 production 候選的實際可切換 iPhone 外框；Pro Max 440×956 畫面以 1:1 顯示：

![iPhone 17 Pro Max — Personal spread](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/pro-max-personal-spread.png)

[SE 捲動到底部](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/se-personal-spread-bottom.png) 可完整看到 54px 主要按鈕，底部保留約 32px；[框架與控制範圍量測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/frame-metadata.json)／[截圖程式](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/frame-capture.mjs)。

[SE 洗牌桌面](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/wash-ready-se.png) 擴展到完整可用寬度，牌面尺寸與桌面比例重新調整。

牌陣操作的[修正前](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/spread-before-se.png)與[最終候選](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/spread-after-se.png)；[Pro Max 洗牌中](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/wash-moving-pro-max.png)、[SE 收牌中](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/wash-gathering-se.png)。截圖只檢查視覺，實際節奏與完成狀態由互動測試和取樣驗證。

SE 的選牌[修正前](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/pick-before-se.png)／[修正後](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/pick-after-se.png)可看到卡弧與已選牌槽分開。同版本的 [Pro Max 選牌畫面](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/pick-after-pro-max.png)與 [Astrology Home 返回](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screens/astrology-home-pro-max.png)。[截圖來源與 SHA-256 清單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/screenshots.json) 分別標明舊版、針對性驗證與最終候選，未將不同階段的截圖混稱同版本。

**候選版本與可審閱資料**

- 最終暫存 production 位於 `/tmp/hint-letter-20260910/candidate`，隔離連接埠 5219，API proxy 指向 `127.0.0.1:1`。[381 份來源檔雜湊清單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/letter-ritual-polish-2026-09-10/source-final.json) 已逐檔核對相符；清單 SHA-256 為 `c616cccf8c763a72ff7f365f44a204712119f3b8d14da8a77e5519927786da30`。此清單記錄前端來源，未作為原生包 manifest。
- 新增驗收檔：[letter-ritual-layout.spec.ts](/Users/jwu/Documents/Hint-main/artifacts/hint/e2e/letter-ritual-layout.spec.ts)、[space-navigation.spec.ts](/Users/jwu/Documents/Hint-main/artifacts/hint/e2e/space-navigation.spec.ts)。
- 本報告的截圖、原始日誌、合併結果、量測與來源清單已保存在相鄰 `letter-ritual-polish-2026-09-10/` 目錄；前次 Me 重設報告保持原樣。
- 正式 API／公開／下載網址、Apple Team ID、Xcode／簽章及實機驗收仍是發布門檻。本輪完成後也不據此宣稱原生發布就緒。
