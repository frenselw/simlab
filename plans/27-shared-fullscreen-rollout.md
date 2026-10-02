# 全活動一鍵全螢幕

依[共用設計](00-shared-platform-and-style.md)、[製作指引](../docs/simulation-scorm-production-guide.md)及[活動計劃範本](NEW-SIMULATION-PLAN-TEMPLATE.md)記錄本次共用顯示功能；沿用各活動既有模型、rubric、phase/variant及snapshot schema，沒有新增評分或持久化資料。

## Scope and decisions before coding

- 使用者已在原測試版確認 Firefox、Chrome及Android瀏覽器成功；未提供版本／Moodle版本，這是測試版的使用者回報，不代表全部活動已逐一完成實機驗收。
- 將已驗證的controller移至`sim/shared/fullscreen.js`；每個現有活動標記完整main為`data-sim-fullscreen-target`、header為`data-sim-fullscreen`並載入共用script，manifest列入依賴。
- 按鈕位於header右上角，20px圖示、44px可點擊範圍；標題及右側status預留空間，原導覽、stage、panel結構保留。共用樣式只作用在明確標記的header。
- 請求整個activity main，包括header、stage及controls；維持同一SCO頁面與SCORM連線，不開新頁或修改Moodle父頁。
- 標準／WebKit API、實際狀態同步、退出、busy及不支援／權限拒絕提示沿用原測試版。
- 全螢幕為transient顯示控制，各活動既有edit/check/review/pending/technical狀態及partial／blank合法提交不變；不保存fullscreen、清除答案、改rubric或增加commit/finish handler。
- 更新共用產品規則、製作方法、活動plan template及AGENTS連結，後續活動必須接入。

## Verification decisions

因使用者先前希望此顯示功能的處理更簡潔，本輪集中在改動相關的controller tests、所有source／extracted SCORM的全螢幕接入、desktop／phone布局及權限拒絕checks、語法／manifest及package checks；不重跑所有活動既有物理／評分瀏覽器回歸。新tests登記在runner；未跑的完整歷史回歸不當作本輪證據。

- Controller既有標準／WebKit、busy、失敗、外部退出tests轉為測shared controller。
- 全21個manifest逐一核對shared script、target/header標記、root manifest及source/package逐byte一致。
- 瀏覽器對所有活動執行trusted fullscreen button click／tap、退出、header無遮擋、activity涵蓋viewport，source及extracted兩種launch；viewport 320×500與1280×900。
- 代表性iframe允許／拒絕及same-page保留檢查；既有Newton測試版完整fullscreen／SCORM browser runner沿用。
- 全部ZIP重建；另提供原有20個正式活動ZIP的集合供使用者更新Moodle。
- 真實Moodle、各活動實機及iOS未執行項繼續保持開放。

## Evidence

2026-10-02 本地接入驗證：

| Check | Actual evidence |
|---|---|
| Shared controller | `node sim/shared/fullscreen.test.js`通過；標記target（不依赖`id="app"`）、標準／WebKit狀態、busy、外部退出、unsupported、權限拒絕及重試 |
| Source / extracted SCORM | `node tools/fullscreen-rollout-browser-regression.js`通過；Chrome 155.0.8059.27，headless native DOM fullscreen，CDP trusted touch／mouse。21個活動×source/package×320×500／1280×900，共84組進入／退出、header無遮擋、viewport涵蓋、44px target、panel可用及SCORM欄位保持不變 |
| Native dialogs | 全部6個既有`showModal()`對話框在source/package及phone/desktop執行，共24次；可見、中心命中dialog、保持全螢幕。它們可以保留在document top layer |
| Denied player | 拒絕fullscreen的iframe維持非全螢幕、按鈕可再用，並顯示可見的繁體中文提示 |
| Runtime / manifest | `npm run check`通過JS語法及SCORM 1.2 manifest語義；`package-all.js`通過21個ZIP root manifest、依賴／entries核對；所有extracted runtime與source逐byte一致 |
| Scope | 所有活動的`main.js`、model、generator、scoring及persistence未修改；只接入共用顯示控制、樣式及manifest |
| Delivery | `output/simlab-fullscreen-scorm-packages.zip`包含20個正式活動的獨立SCORM ZIP及繁體中文使用說明；內層ZIP與本次已驗證的個別套件逐byte一致 |

瀏覽器報告及截圖：`output/playwright/fullscreen-rollout/report.json`及同目錄PNG；語法／manifest log：`output/fullscreen-rollout-check.log`。集合ZIP SHA-256：`638c36d6f3bda31b9f51932143f0c270afd54ac070d7f3ffcc72fd74ba1c1eff`。

Headed探測曾記錄trusted click進入後由瀏覽器自行退出，該次矩陣未完成，不列為通過證據。上表是headless原生DOM API的本地結果；本輪未執行完整`npm test`、全部活動的真實Moodle、實體手機或iOS驗收。先前使用者回報僅適用於原Newton測試版。
