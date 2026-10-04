# Me 頁面重設與功能入口轉場 — 2026-09-10

Me 已改為更有層次的個人空間；首頁、Rooms 與 Me 的功能入口增加短暫、各有識別的轉場。這輪維持本機 beta、既有資料邊界與 Tarot 核心流程，沒有部署、上傳 TestFlight、執行付費服務或操作真實帳號。

同版本前端驗證完成：**590 個單元／元件測試通過；型別檢查與 production 建置通過；手機 WebKit E2E 166 通過、10 項按範圍跳過，0 失敗、0 flaky**。功能 E2E 共 176 個設定案例，耗時 4.2 分鐘。另有 **2 個獨立瀏覽器效能案例通過**；轉場與手機截圖審查完成。這些證據不能代替實體 iPhone 驗收或原生發布判定。

**畫面與整理方式**

| 區域 | 完成的行為 |
|---|---|
| 個人資料 | 珍珠漸層、姓名字母徽章、真實出生資料與保存狀態；未知時間保持未知。編輯時進入專用表單，取消／返回後焦點回到原按鈕。 |
| 我的內容 | 星盤、閱讀歷史、收藏各有完整入口與簡短說明；星盤連結保留 `tab=chart` 目的地。 |
| 外觀與偏好 | 可直接比較的明暗色樣、語言、減少動態與觸感設定；設定與其他頁面／分頁同步。 |
| 檔案與儲存 | 本機身份說明、裝置連線狀態與檔案管理集中呈現。清除歷史先展開範圍說明，再使用既有確認與失敗重試。 |
| 支援與法律 | 收入可展開區，保留 About、聯絡、隱私、條款與免責聲明入口。 |
| 手機閱讀 | 自適應高度、長字串換行、至少 44px 的主要觸控範圍、底部導航留白，保留五語系。 |

![Me — SE 明色](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-top.png)

![Me — SE 深色](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-dark-top.png)

**入口動效**

點擊後路由立即前進；裝飾色面由入口卡片／按鈕的位置展開，配合功能符號，再淡出顯露內容。這是有限時間的視覺銜接，內容載入、輸入與操作不等待它結束。

| 功能 | 視覺識別 | 一般模式時長 |
|---|---|---:|
| Tarot | 細線牌背、淡紫與薄荷色面 | 340ms |
| Astrology | 星環與星點、珍珠玫瑰色 | 320ms |
| Animal Tarot | 葉形線條、鼠尾草色 | 320ms |
| Journal／History | 紙頁／書頁 | 290／280ms |
| Compatibility | 相連雙環 | 320ms |
| Collection／Personalities | 疊牌／稜形線條 | 300ms |
| Dream／Daily | 月牙／日出 | 300ms |
| Ask／Me／Rooms | 光環／珍珠／輕薄色面 | 280ms |

App 或系統任一開啟減少動態時，改為 **90ms 淡出**，不縮放、不大幅位移。返回、重新整理、只有查詢參數改變，以及離開畫面後恢復，都不重播舊入口。動效層不接受點擊、不進入輔助使用樹；背景、resize、離頁與動畫結束時會清理。重複點擊同一目的地不新增第二筆瀏覽歷史。

設計原則參照 Apple 對有目的、可選動效的建議；本文的具體形狀與時長是 Hint 的實作選擇，並非 Apple 的數值要求。[Apple Motion](https://developer.apple.com/design/human-interface-guidelines/motion)；啟用減少動態時避免大幅動畫。[Apple Reduce Motion](https://developer.apple.com/documentation/swiftui/environmentvalues/accessibilityreducemotion)

**這輪定位並修復的缺陷**

| 問題與重現 | 原行為 | 修正與證據 |
|---|---|---|
| 提交資料 A 後繼續輸入 B，或返回再重開輸入 B；此時 A 才完成 | A 的回應關閉新編輯器，B 與焦點消失 | 增加編輯工作階段及輸入版本檢查。舊實作的 3 個元件回歸先失敗，修正後通過；兩個手機均通過「原表單續寫」和「返回後重開」延遲 POST 案例。[前測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/me-save-races-before.log)／[後測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/me-save-races-after.log) |
| 首次快速從 Home 點進 Tarot | 房間入口上方又出現 App 啟動動畫 | 路由前進時結束未完成啟動動畫。舊實作兩個手機均重現 `launchVisible=true`；最終 E2E 均確認不重疊。[前測](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/launch-before.json) |
| 語言選單浮在設定文字上 | 半透明浮層降低文字辨識度 | Me 使用獨立、不透明的浮層色面；保留位置避讓、方向鍵、Escape、點外關閉與焦點返回。五語系／兩主題／兩手機測試及截圖核對。[深色選單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-dark-languages.png) |
| Me 選擇深色外觀 | 舊 cream route 外框與背景仍覆蓋深色設定 | 覆蓋 Me 專用頁面、文字、背景、導航與浮層色彩；外部偏好事件也更新選中狀態。明暗矩陣與設定同步元件測試通過。 |

保存仍區分「已存本機」與「已同步」。儲存空間不足時保留表單、顯示錯誤並可重試；離線成功保存只顯示已存本機。修改出生地使舊座標與時區失效，未知時間不補值。[儲存失敗畫面](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-storage-failure.png)

**同版本覆蓋表**

SE 375×667 與 Pro Max 440×956 使用虛構身份、隔離 API 回應及獨立 production 連接埠；沒有請求真實計算服務。每個手機案例為獨立 WebKit context。

| 範圍 | 通過 | 按範圍跳過 | 證據內容 |
|---|---:|---:|---|
| Me 重設 | 29 | 1 | 20 個五語系×明暗×手機組合；實際頂／中／底與展開畫面；主要 hitbox、文字行、焦點、設定、儲存失敗／離線／延遲回應；SE 西文長姓名／網址與 200% 文字。 |
| 功能入口 | 44 | 0 | Home、Rooms、Me、底部導航；四種 App／系統動態組合；連點、返回、背景、查詢參數、清理與輸入不中斷。 |
| Home 既有回歸 | 32 | 0 | 揭牌、保存失敗重試、浮層焦點、五語系與 200% 長結果、chunk 載入重試。 |
| 導航 200% 文字 | 10 | 0 | 五語系×兩手機的完整標籤、觸控範圍及底部空間。 |
| Profile／History／Astrology 補漏 | 14 | 0 | 保存按鈕與時間地點、長問題、翻譯與操作、免 email 的占星入口。 |
| 保存與恢復 | 26 | 0 | Daily、Ask、Animal、歷史、刪除失敗／重試、邀請、筆記晚回應、跨午夜。 |
| Tarot 九種牌陣完整流程 | 9 | 9 | 完整選牌、閱讀、保存及位置恢復配置於 Pro Max；SE 的同九項按測試設計跳過，不宣稱兩手機都完成九次完整流程。 |
| 非 Tarot 路由／手機盤點 | 2 | 0 | 兩手機的既有頁面與入口盤點。 |
| **合計** | **166** | **10** | 其餘 1 個 skip 是僅針對 SE 的西文 200% 壓力案例在 Pro Max 不重跑。 |

幾何斷言包含觸控中心／邊緣是否被覆蓋、完整文字行、可到達的最後內容與導航間距；**沒有橫向溢出不等於視覺驗收完成**。主流程截圖、選單及 SE 200% 畫面已由主代理查看；補充入口與落地畫面亦完成審查，包含明暗 Tarot；本輪未發現新的已確認遮擋或文字裁切。[200% 頂部](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-es-200text-top.png)／[200% 展開底部](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/me-se-es-200text-expanded-bottom.png)

**效能與發布限制**

單一 worker 的桌面 WebKit RAF 取樣已完成，2 個測試通過（24.5 秒）。兩種手機視窗各重複 3 次 Tarot、3 次 Astrology，合計 12 個已預熱入口觀測區間；從實際點擊開始取樣約 450ms。

| 視窗 | 區間數 | 各區間 frame gap p95 | 最大 frame gap | ≥100ms 間隔 |
|---|---:|---:|---:|---:|
| Pro Max 440×956 | 6 | 24–26ms | 43ms | 0 |
| SE 375×667 | 6 | 18–24ms | 54ms | 0 |

[原始效能資料](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/performance-samples.json)／[執行日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/performance-e2e.log)。這是短時間桌面瀏覽器幀間隔樣本，不包含真實手機 CPU、冷啟動、輸入回饋 p95 或長時間熱降頻，也不把 p95 合併成未量測的全 App 指標。
- 初始主 JS chunk 約 919.34kB，建置保留大於 500kB 的提示；本輪沒有將此提示解讀成已證實卡頓，也沒有擴充到全 App bundle 重構。
- 原生鍵盤／輸入法、iOS 動態字體、實體 iPhone 幀率、原生背景恢復與互動返回仍未驗證。WebKit 模擬與文字放大是瀏覽器證據。
- 正式 API／公開／下載網址、Apple Team ID、完整 Xcode／SDK、簽章及實機驗收仍待設定或取得證據。這輪未部署或上傳 TestFlight。
- 這是 Me 與入口轉場的同版本前端回歸，沒有重新宣稱已完成全部 API／資料庫／migration 發布驗收。

**可審閱資料**

| 項目 | 位置 |
|---|---|
| Me 實作 | [MeView.tsx](/Users/jwu/Documents/Hint-main/artifacts/hint/src/modules/me/MeView.tsx)、[SettingsList.tsx](/Users/jwu/Documents/Hint-main/artifacts/hint/src/modules/me/components/SettingsList.tsx)、[me.css](/Users/jwu/Documents/Hint-main/artifacts/hint/src/modules/me/me.css) |
| 入口實作 | [RoomTransitions.tsx](/Users/jwu/Documents/Hint-main/artifacts/hint/src/components/app/RoomTransitions.tsx)、[roomEntrance.ts](/Users/jwu/Documents/Hint-main/artifacts/hint/src/components/app/roomEntrance.ts) |
| 手機測試 | [me-redesign.spec.ts](/Users/jwu/Documents/Hint-main/artifacts/hint/e2e/me-redesign.spec.ts)、[room-entrances.spec.ts](/Users/jwu/Documents/Hint-main/artifacts/hint/e2e/room-entrances.spec.ts) |
| 測試完整結果 | [E2E JSON](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/final-e2e.json)、[E2E 日誌](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/final-e2e.log)、[590 個前端測試](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/unit-final.log)、[建置](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/logs/build-final.log) |
| 來源版本 | [375 份來源檔雜湊清單](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/source-final.json)，本報告建立時逐檔相符。清單本身 SHA-256：`d867770000cc510ccfc1b68c3f1d68ed6e7939a74197dfd318e36f6eb137f01c`。這是本輪來源清單，不冒稱全 repository release manifest。 |
| 截圖 | [21 張截圖的來源與 SHA-256](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screenshots.json)。包含頂／中／底、明暗、選單、200% 長文字、保存錯誤與轉場。截圖僅含虛構資料。 |


**本機查看**

[設計預覽](http://127.0.0.1:5205/design-preview.html) 由本輪隔離伺服器提供。預覽的虛構資料啟動頁僅位於暫存目錄，未加入正式來源；不寫入假憑證，不覆寫既有資料，API 維持離線隔離。

[Tarot 明色入口](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/tarot-entrance.png)／[明色落地](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/tarot-destination.png)；[Tarot 深色入口](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/tarot-dark-entrance.png)／[深色落地](/Users/jwu/Documents/Hint-main/artifacts/hint/docs/me-and-entrances-2026-09-10/screens/tarot-dark-destination.png)。靜態截圖用於檢查畫面；動效時長與清理由瀏覽器觀測及回歸測試另行驗證。
