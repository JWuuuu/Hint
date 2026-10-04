# 瀏覽器效能取樣

同一 production 建置、WebKit、單一 worker；數值為各動態設定取樣中的最大值。不是實體 iPhone 60Hz 或操作延遲驗收。

| 場景 | 手機 viewport | frame gap p95 最大值 | 單幀最大值 |
|---|---|---:|---:|
| Astrology 星盤／詳情／捲動 | iphone-17-pro-max | 24 ms | 32 ms |
| Astrology 星盤／詳情／捲動 | iphone-se | 22 ms | 32 ms |
| Home 待機 | iphone-17-pro-max | 34 ms | 36 ms |
| Home 捲動 | iphone-17-pro-max | 25 ms | 28 ms |
| Home 揭示浮層 | iphone-17-pro-max | 28 ms | 63 ms |
| Animal 揭示 | iphone-17-pro-max | 26 ms | 31 ms |
| Tarot 自動洗牌 | iphone-17-pro-max | 29 ms | 93 ms |
| Home 待機 | iphone-se | 31 ms | 50 ms |
| Home 捲動 | iphone-se | 25 ms | 27 ms |
| Home 揭示浮層 | iphone-se | 26 ms | 63 ms |
| Animal 揭示 | iphone-se | 25 ms | 55 ms |
| Tarot 自動洗牌 | iphone-se | 26 ms | 80 ms |

Astrology 的互動取樣：Pro Max p95 24ms、SE p95 22ms；兩者單幀最大 32ms。Home 待機取樣最高 p95 34ms。其他互動場景 p95 最高 29ms，單幀最高 93ms；所有取樣都沒有 ≥100ms 停頓。

這是短時間、虛構資料的 host RAF 回歸檢查。不能推論實際 iPhone 操作回饋 p95 ≤100ms、GPU／耗電／溫度，或較長生命週期下的原生表現。原始資料見 [browser-performance.json](browser-performance.json)。
