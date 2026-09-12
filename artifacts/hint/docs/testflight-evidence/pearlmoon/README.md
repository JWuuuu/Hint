# Pearl Moon 候選版本驗收

這是包含目前工作區修改的隔離候選版本；未部署、未上傳 TestFlight，也沒有接觸真實帳號、寄送邀請或呼叫付費 provider。Astrology、合盤與失敗恢復的實作說明見 [重建與修正表](../../astrology-pearlmoon-rebuild.md)。

## 固定版本與執行方式

- 複製執行檔、靜態素材、設定、migration 和測試到 `/tmp/hint-pearlmoon-20260910/candidate`。依賴沿用已安裝版本；快取、建置輸出、瀏覽器身份與資料庫獨立。
- 不複製 `.env`。WebKit 的所有 `/api/` 呼叫先由測試攔截，未登錄呼叫一律回傳隔離錯誤；provider 回應與出生資料均為虛構。
- Vite production preview 使用獨立 port 5200；功能案例使用兩個獨立 WebKit worker。10 個效能案例另外以單一 worker 執行。現有使用者服務沒有重啟。
- 執行範圍為 1,494 個檔案；其中 1,377 個 runtime 檔案 SHA-256 為 `d4c0c2b6b71c4e3eed9cc3620301dd21c623ec942b83eaef50a14083a200903d`。
- [版本清單](candidate-manifest.json) 記錄每個檔案的 SHA-256；驗收結束再次核對工作區沒有內容漂移。
- [相對 RC3 的變更清單](changes-from-rc3.json) 與 [獨立 patch](changes-from-rc3.patch) 方便把本輪修改和原先未提交的工作分開檢閱。

## 驗證結果

| 檢查 | 結果與證據 |
|---|---|
| 前端單元／元件 | 560 通過，67 個檔案；[完整紀錄](final-frontend-tests.log)。涵蓋身份、出生資料、草稿、清除、合盤、真實資料轉接、星盤幾何和 Tarot。 |
| API／資料庫 | 54 通過，8 個檔案；[完整紀錄](final-api-tests.log)。包含 19 個實際隔離 PostgreSQL 整合案例，不是跳過資料庫測試的結果。 |
| 型別 | 共用套件、前端、後端皆通過；[紀錄](final-types.log)。 |
| 建置 | [前端](final-web-build.log)、[後端](final-api-build.log) 通過。前端仍有大於 500kB chunk 的建置提醒；它不是實機流暢度證據。 |
| 發布設定／原生來源 | 6 個設定與資產驗證測試通過，launch intro 與 iOS source preflight 通過；[紀錄](final-release-tests.log)。這不包含 Xcode 編譯或簽章。 |
| Tarot 冷啟動 | SE／Pro Max 各三輪，6 次空快取冷啟動及 warm restore 全通過；[報告](tarot-cold-start.json)、[紀錄](final-cold-start.log)。未重現白屏。 |
| Production E2E | 512 個案例中 492 通過、20 按原定尺寸／範圍跳過；[原始基準補齊後的比對](final-snapshot-e2e.log) 已納入最終結果。見 [覆蓋表](coverage.md)、[機器可讀案例](coverage.json)、[功能紀錄](final-e2e.log)、[獨立效能紀錄](final-performance-e2e.log) 與 [從零建立星盤紀錄](final-creation-e2e.log)。 |
| 畫面 | Astrology 五語 × 明暗 × 四種動態設定 × 兩種手機，共 80 個組合；另有舊連結、未知選取、輸入變更、服務失敗、Dialog／放大與實際捲動案例。 |

所有通過數量以此候選版本的紀錄為準。隔離副本最初漏帶 18 個原有截圖基準檔，Pro Max 的 9 項畫面比對因此報錯。補回工作區原始基準後，[9 項重新比對全部通過](final-snapshot-e2e.log)；沒有把本次產生的 actual 圖當成 expected，也沒有修改專案的原始 snapshot。最終覆蓋表保留這項環境修復註記。整合時另重現 WebKit 的 204 空回應封裝錯誤，已用 [修正前](empty-response-before.log)／[修正後](empty-response-after.log) 回歸驗證；舊 onboarding 與恢復 key 測試則改為目前明確的流程及 owner 索引。

## 畫面與效能

- SE 375×667、Pro Max 440×956；英文、簡中、西文、日文、韓文。
- 動態組合為一般、僅 App 減少動態、僅系統減少動態、兩者皆開。放大文字案例模擬 200% 網頁文字，不代表 iOS Dynamic Type 實機驗收。
- 檢查 top／middle／bottom 實際捲動、完整控制文字、44px 觸控範圍、固定底部導航、Dialog 焦點／Escape、長網址與長名稱。正常捲動邊緣截斷不算缺陷。
- [截圖索引](screenshots.json) 與 [畫面檢視紀錄](visual-review.md)；`screens/` 保存 108 張原始尺寸代表圖；完整逐案例圖片及失敗 trace 保留在隔離 evidence directory。
- [效能摘要](performance.md) 與 [原始紀錄](browser-performance.json) 保存 RAF 與互動取樣；Astrology 互動 frame gap p95 為 Pro Max 24ms、SE 22ms。WebKit host 數值僅描述本次測試環境，不等同 60Hz 實體 iPhone 的 p95 操作延遲或 frame gap。
- Tarot 背景修正另由真實 MotionPolicyProvider 接收模擬 native 事件，驗證裝飾停止、手動 RAF 停止、恢復與卸載；沒有宣稱已量測真實 iOS 背景資源使用。

## Migration 與備份還原

本輪沒有新增 schema migration，也未使用 `db:push`。既有 6 個增量 migration 在隔離 PostgreSQL 測試中驗證：重複執行、並行鎖、失敗 DDL 回滾、ledger 雜湊錯誤停止，以及舊資料保留。

[備份還原報告](migration-rehearsal.json) 另外使用兩個暫存資料庫，備份全部 11 個 public 應用資料表，再以相同版本 SQL 重建 schema 並還原資料。還原前後 JSON 雜湊完全一致，6 筆 ledger 核對通過，兩個資料庫均已刪除。這是應用層邏輯備份演練，不包含叢集角色或正式環境的 `pg_dump` 操作工具；[演練程式](migration-rehearsal.mjs) 保存確切流程。

## 發布判定

**尚不能宣告 iOS／TestFlight 可發布。** [工具鏈檢查](native-toolchain.json) 顯示目前只有 Command Line Tools，沒有完整 Xcode 或 iPhone Simulator SDK。使用者尚未設定正式 API／公開邀請／下載 HTTPS 網址與 Apple Team ID。

仍需正式設定、簽章、素材授權及隱私清單核對，以及實體 iPhone 的冷啟動、鍵盤／組字、語音權限拒絕、分享取消、觸覺、背景恢復、強制終止與效能驗收。這些項目沒有被瀏覽器測試替代，也没有以「未發現錯誤」視為已通過。

後續取得設定後，沿用既有 release 流程驗證環境 → 同版本 web build → Capacitor assets sync／hash 核對 → Simulator／實機 → 內部 TestFlight。部署或上傳須另行指示。回滾時使用上一份已驗證的 web/native artifact；資料庫先確認備份可還原，不倒退破壞性的 schema 操作。

## 本機預覽

驗收建置的 [Astrology 預覽](http://127.0.0.1:5201/app/astrology?hintPreview=embedded) 已準備於獨立連接埠。這個預覽不連接真實 API；個人計算的完整畫面與流程使用上述虛構資料截圖／E2E 證據展示。隔離測試資料庫及舊預覽程序已停止，原有使用者服務保持原樣。
