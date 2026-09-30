# 運動合成：完整獨立審核彙整及最終驗收報告

日期：2026-10-01。分支：`codex/motion-composition-stroboscopic-plan`。首輪審核版本：`1c1815283c41420b09dfb6ce8e27bd8059073391`，相對 `origin/main` 的完整實作變更。

**目前結論：首輪彙整完成，仍有 5 個已確認產品問題及 1 個本機驗證缺口開啟；尚未通過 package-ready。** 未發現 P0／P1 問題。物理模型、主要評分與保存／SCORM 流程通過三位審核者的完整核對。修正及受影響回歸完成後更新本報告的 closure；初版通過的測試不能替代修正版證據。真實 Moodle／實體手機驗收仍未執行，另列為外部部署 gate。

## 仍開啟的事項

| ID | 優先序／性質 | 首輪狀態 | 問題及來源 | 必須達成的修正結果 |
|---|---|---|---|---|
| F01 | P2，產品缺陷 | Open | 非字串分類值通過 schema，顯示與評分不一致，非法 pending 可重試。R3-1 | 只接受 `null` 或合法 enum 字串；非法 draft／review 拒絕，非法 pending quarantine，沒有 LMS 寫入。 |
| F02 | P2，產品缺陷 | Open | 320×225 CSS viewport（640×450 的 200% reflow 等價）面板整個落在可視區外。R3-2 | 短高度重排 header／stage，面板與最終提交控制可達，主要字體及 44 px 控件保留。 |
| F03 | P2，產品缺陷 | Open | target 起始的多指中斷把餘下 touch 轉交 host，活動整體移走。R1-01 | 從 simulation 起始的 touch sequence 保留 ownership 至全部 touch 結束；取消暫態、答案不變、host／iframe／panel 固定。 |
| F04 | P2，產品缺陷 | Open | 未觀察的空白／部分提交及 frozen 頁提示使用已隱藏的「顯示頻閃圖」。R2-1 | stage hint 先反映 review／reference／frozen／committed 模式；可編輯且未觀察才顯示觀察指示。 |
| F05 | P3，產品缺陷 | Open | resize／blur／hidden 中斷播放後按鈕仍顯示「停止播放」。Root 額外重現 | 停止動畫時同步更新按鈕與 stage；下一次點擊及狀態文字一致。 |
| V01 | P2，本機驗證缺口 | Open | tray 指標被 active 指標覆寫；preview 只驗可見／位置邊界，未驗 geometry／讀數／release 一致性。R1-02＋R2-2 | 分別保存兩種 target 的 before／during／after；等待 production handler 處理 move 後，驗證真實場景、吸附焦點、避指及放手位置一致。 |

F01–F04 直接違反既定 schema、可操作性或 ownership／模式提示契約；F05 是可見狀態錯誤。V01 是驗證與證據缺口，**沒有把取樣時序差異誤判為已確認的 preview 產品 bug**。上述均可在本機修正及再驗，不能用「真實手機未測」代替處理。

## 審核來源及方法

使用者要求的三位審核者均各自審核整條 branch，沒有按領域分工，審核前沒有閱讀彼此報告；第四位彙整者在三份報告齊備後才開始整合。

- [完整獨立審核 1](2026-10-01-motion-composition-review-1.md)：物理、教學文字、UI／手機、手勢、評分、保存、SCORM、目錄／包裝及測試；另在 source／ZIP 以可信多指 touch 重現 F03。
- [完整獨立審核 2](2026-10-01-motion-composition-review-2.md)：同一完整範圍；另重現 F04，執行圖外放手、lost capture、多指／resize rollback、鍵盤及 native select 等 targeted 檢查。
- [完整獨立審核 3](2026-10-01-motion-composition-review-3.md)：同一完整範圍；另重現 F01、F02，執行 preview 工作點、取消及非法 pending 的 production 流程。

三人都獨立執行五個 activity Node tests、source／實際 rebuilt ZIP smoke，並核對 manifest／ZIP source byte parity；沒有平行重跑 Root 正在執行的 whole-repo `npm test`。第四位讀完三份報告、各 targeted JSON、Root 的中斷播放 JSON，並核對相應 runtime／browser runner、[共用基線](../../plans/00-shared-platform-and-style.md)、[製作指南](../simulation-scorm-production-guide.md)及[活動計劃](../../plans/25-motion-composition-stroboscopic-lab.md)。本報告只彙整及判定，沒有修改產品或正式測試。

### 重複與表面差異的處理

- R1-02 與 R2-2 的 tray before／after 遺失是同一個報告覆寫問題，合併為 V01；R2-2 額外要求 preview 一致性驗證，併入同一修正／再驗項。
- 審核 2／3 的「多指取消後答案不變」與 F03 並不矛盾：F03 發現的是取消後 **host／iframe 移動**。答案 rollback 正確不能證明所有非 owner 固定。
- 審核 3 的單一 `(1.600, −1.600) m` preview 檢查支持該操作正確；它不能補足 V01 要求的兩 target、四題四時刻、source／ZIP 完整紀錄。
- 正常 320×500／640×450 布局通過與 F02 並不矛盾。CDP page scale screenshot 是視覺放大；320×225 CSS viewport 驗證的是 reflow。兩種證據不能互相替代。
- 根目錄歷史 `failure.json` 的 document overflow 已被後續初版檢查消除，沒有列作現存問題；本報告只保留新重現項目。

## 修正及再驗要求

### F01：分類型別與非法 pending

初版位置：`sim/motion-composition-stroboscopic-lab/model.js:21`、`:23`；`persistence.js:14` 使用 `M.validCase`。`Object.hasOwn` 會將陣列轉成 property key，因而接受 `['uniform']`／`['line']`。select 將陣列顯示成正常選項，但 strict-equality scorer 給 0 分；相同資料可通過 deep pending validation。

改為明確驗證 `typeof value === 'string'` 後才查 enum，不把非法值轉成字串或 `null`。測試兩個 motion 欄位及 trajectory 的陣列、物件、數字／boolean 型別；production decode 必須拒絕。對合法外層、非法深層 enum 的 pending-final 執行 Controller restore，確認 quarantine／technical lock，manual retry 及 pagehide 不寫 LMS。既有合法 `null`、合法錯答、0 分 review 及 512 restore／合法續作仍須通過。

證據：`output/playwright/motion-composition-stroboscopic-lab/review-3/targeted-report.json` 的 `non-string enum accepted and coerced by UI`、`malformed-enum-ui.png`，以及審核 3 記錄的 production pending restore → retry 結果。

### F02：短高度及 200% reflow

初版位置：`styles.css:4`、`:47`；browser runner `:99` 只有 page scale 檢查。320×225 的 header 約85 px、stage 約151 px，panel top=238.40625 px、height≈27 px；body／shell 無 scroll range，最終控制不可達。

短高度必須讓 panel 留有可操作空間，不能以新增 activity document／stage 捲動解決既定 bounded shell 問題。保留主要字體和 44 px targets；可收起非必要說明或重排 stage。對 source／ZIP 測 320×225 CSS reflow 等價 viewport，實際開 check、捲到 panel 底、點提交、切回檢討，並記錄控件可視 bounds。重查正常手機／橫向、兩軸等比例、圖字、抓手及 side strips；如 geometry／stage 改變，重新跑完整 touch matrix。

證據：`review-3/targeted-report.json` 的 `200-percent-equivalent CSS viewport from 640 by 450`，`review-3/zoom-short-check.png`。本項不宣稱已測真實 browser UI zoom 或實體手機。

### F03：多指取消仍保留原 ownership

初版位置：`main.js:133–137`。取消 drag 後，第二指由 strip 開始被記為 `host:true`，`touchmove` 隨即 parent forwarding。可信 touch 在 source／ZIP 均使 host `scrollY` 300→335、iframe top 0→−35；答案及 panel 不變。

touch sequence 的 simulation owner／blocked 狀態不能因取消 drag 消失，須保留至所有 touch 結束，並清除 preview／未保存工作點。測 tray／active 起始後，第二指由 stage、左 strip、右 strip及另一 target 開始；before／during／after 記錄 host、iframe、document／visual viewport、panel、選題／選時、答案及 pointer diagnostics。全部 touch 結束後另起正常單指，確認 stage／左右 strip 的 host 上下 pan 仍可用。

證據：`review-1/targeted.js`、`review-1/targeted-report.json`。不要求新增無關的全 stage `touch-action:none`；正常 owner matrix 必須保留。

### F04：只讀與未觀察情境的提示

初版位置：`main.js:75`，editable observe button 在 `:33` 隱藏。hint 先判 `observed`，使 review reference／frozen 的未觀察題目顯示不可執行的操作指示。

按模式及 reference 決定提示，再判 editable 下的 observed／tray。source／ZIP 用 actual DOM 流程測空白提交、分類先答、提交後切未觀察題、reference 開關及 frozen／committed。只讀沒有「顯示頻閃圖」指示；reference 有清楚標示，pending 保持凍結、未確認分數及不顯正解。

證據：`review-2/targeted-report.json` 第一筆，mode=`review`、reference=`true`、observeVisible=`false`。

### F05：中斷動畫的按鈕文字

初版位置：`main.js:138`。blur／resize／hidden 的 handler 呼叫 `stop()` 後只 `renderStage()`，沒有更新 `playButton`；`render()` 才根據 playing 設定文字。

同步更新播放控件，並保留中斷操作 rollback。以真實 viewport resize 驗停止後 label／時間，再按一次須啟動播放；若測 blur／visibility，記清楚真實 browser focus／visibility 方法。source／ZIP 都須有證據，不將合成事件說成可信 touch／實體 focus 操作。

證據：`output/playwright/motion-composition-stroboscopic-lab/root-interruption-probe.json`：中斷前 `t = 0.02 s`、中斷後 `t₁ = 0.20 s`，兩次 button 都是「停止播放」。

### V01：兩種 target 與 preview 的完整證據

初版位置：`tools/motion-composition-browser-regression.js:116–120`。tray assertions 已執行，但 `before/after` 在 active 測試被覆寫。preview 的 DOM 取樣未等待 move 已處理；初版某 row 顯示 preview `(0.800, −1.200) m`，release 答案為 `[800,−800]`。這是待釐清的取樣／驗證缺口，不能直接當產品 bug。

每 row 分別存 `tray`、`active` 的 before／during／after及 preview。最後 move 後等待 production working point／讀數穩定，核對主 scene、局部真實場景、viewBox 中心／3×比例、snapped point／讀數一致、避開 finger、pointer-events none、release 保存同一點、cleanup；不得只用 timeout／可見性當成功條件。需兼顧既有點抓取偏移。保留所有 fixed non-owner assertions並重跑 source／ZIP、390／320寬、四題四時刻兩 target及所有 host／panel rows。錯誤公開格點仍可保存，不能靠預覽暴露或磁吸正解。

## 全範圍共同結論

| 範圍 | 首輪核對結果與限制 |
|---|---|
| 物理與教學目標 | 四個固定情境同一 O／同一 `Δt=0.20 s`，16個位置正確。A／D `y=−x`；B `y=−(5/16)x²`；C `x=(5/16)y²`、`y≤0`。B 明示 `g=10 m/s²`、忽略阻力；C 沒有誤稱水平自由落體。D 的直線結論限於本題條件。 |
| 頻閃推理 | 比較相鄰球影距離：勻速每段0.80 m；由靜止勻加速0.20／0.60／1.00／1.40 m、每次增加0.40 m。有限資料只說「符合模型」；沒有把間距越大說成證明勻加速，也沒有泛化1:3:5:7。 |
| 作圖、文字與標準 | 同比例坐標、向下負 y、繁體簡短指示、三區／共用風格、學生折線不跨空白 slot、參考細曲線提交後才顯示。F04／F05 是文字狀態缺陷；另有下述輕微 notation 對齊。 |
| 手機與互動 | 正常10組 viewports source／ZIP皆通過 bounded／無水平 overflow／導航≥44 px；兩種 HTML抓手、公開200 mm grid及 keyboard／panel微調均可用。F02／F03仍需修正，V01需完整證據，正常矩陣通過不能消除它們。 |
| 評分與空白／部分 | 每題位置16＋兩類型6＋軌跡3；四題100、60達標。空白0、全分類36、全位置64、全對100。x／y及分類獨立，±50 mm inclusive，49／50／51邊界通過。任一 editable 可 check／明確 submit，無全題訪問門檻或自動提交。 |
| 導航與 authoritative state | 四題相互獨立，只有放點依賴 observed；類型可先答。保存 selection、phase、returnToCheck及權威毫米坐標，不存 pointer／動畫／DOM；未確認暫態會取消。final／pending 沒有重做／clear，readonly navigation不改 submitted答案。 |
| 保存與 SCORM | 512 production round-trips＋合法續作、score／passed保持；最大 draft／review／pending 791／818／1061 UTF-8 bytes。shared lifecycle四 startup／submit outcomes、retry兩類、trust mismatch／unknown、invalid pending quarantine、finished lock及 standalone refresh 均有通過證據。F01 為漏驗非字串 enum 的特定反例，必須補足。 |
| 信任及使用風險 | 形成性／低風險活動；browser scorer 不宣稱可信高風險 grading。沒有 secrets、新增 CDN或活動自有 raw LMS／commit／finish／pagehide。高風險伺服端評分為本次 N/A。 |
| 目錄、包裝及測試 | metadata齊全；初版 planned合理。manifest／13檔ZIP與 source bytes一致，全部 runtime refs 已列入，沒有 tests／截圖混入。五套純測試及browser runner已登記 run-tests；最終 active、全repo gates及修正版source／ZIP證據尚待Root完成。 |

### 輕微對齊改善 N01（P3）

審核 3 提出 selected 分運動球沒有 `Xᵢ／Yᵢ` 時刻標籤，結果參考串用普通 `t1`，部分公式用普通文字。這些沒有造成物理／評分錯誤，屬輕微規格對齊；建議在本次修正一併完成：selected影旁加簡短真下標，不擠滿全部早期影；HTML結果／preview依共用math serif、italic變量、正體單位及真下標。重查窄手機不遮邊／控件，必要時以 plan 明確記錄可讀性的命名選擇。

## 最終 closure 與 release gate（待 Root 修正後更新）

| 事項 | 修正版本／證據 | 再審結論 |
|---|---|---|
| F01 | 待補 | Open |
| F02 | 待補 | Open |
| F03 | 待補 | Open |
| F04 | 待補 | Open |
| F05 | 待補 | Open |
| V01 | 待補 | Open |
| N01 | 待補；非主要阻擋項 | 待決定／對齊 |
| Repo／package gates | Root初版 whole-repo `npm test`仍在進行；最終check／package-all／diff及修正版回歸待補 | 尚未確認最終版本 |
| Catalogue／plan evidence | 通過後更新active及實際證據；修正初步紀錄對tray metrics／zoom的過廣敘述 | 待補 |

再驗順序：先修 F01與local schema／lifecycle tests，再修UI／gesture並补browser assertions及reports；重跑活動五套tests、source／ZIP完整matrix及受影響flows，記錄actual版本。三位原完整審核者再核對修正版及 closure；第四位以其結論更新本表及最終verdict。`npm run check`、`npm test`、`npm run package:all`、`git diff --check origin/main...HEAD`須有實際成功記錄；Root可依改動影響選擇合理回歸，不重複無關完整測試以充數。最後ZIP bytes須與最終source一致。

## 外部部署 gates（不是上述產品缺陷）

- 真實 Moodle學生attempt的score／status、空白／部分提交、同attempt whole-player刷新／離開再入、pending retry、finished review-only及new-attempt policy：**未驗證**。
- 實體手機current-window及提供時new-window player：完整owner matrix、side strips、panel底及返回、真實preview／snap、工具列／viewport／native select／zoom：**未驗證**。活動無文字輸入欄位，不能把合成鍵盤viewport當實體軟鍵盤驗收。
- 本機host forwarding以同源Moodle-like iframe驗證；真實Moodle跨域／多層host topology可用性：**未驗證**。不同嵌入條件需部署實測。
- CSS reflow等價／CDP visual zoom是本機證據；不宣稱已完成真實browser UI zoom／OS accessibility或實體裝置驗收。

修正及本機gates全部通過可判定package-ready；Moodle-ready須另有上述真實部署證據。本報告不把外部缺證據虛構成程式bug，也不將本機成功擴張成真實Moodle／手機就緒。
