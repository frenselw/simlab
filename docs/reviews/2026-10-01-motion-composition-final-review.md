# 運動合成：完整獨立審核彙整及最終驗收報告

日期：2026-10-01。分支：`codex/motion-composition-stroboscopic-plan`。首輪審核版本：`1c1815283c41420b09dfb6ce8e27bd8059073391`；第二輪完整複審候選：`90a09cc116a611bd963d6d19ce8edab93a106707`。每輪均審核相對 `origin/main` 的完整 branch。

**目前結論：三位第二輪完整複審及第四位彙整完成；首輪 F01–F05、V01 已關閉，仍有 F06（P2）及 F07（P3）兩項可重現 UI 問題開啟，尚未通過 package-ready。** 未發現 P0／P1 或新物理／評分／保存／SCORM 問題。首輪全 repo `npm test` 已通過；`90a09cc` 已通過本活動全部受影響回歸，沒有重新執行修正版全 repo `npm test`。真實 Moodle／實體手機仍未驗證。

## 仍開啟的事項

| ID | 優先序／性質 | 目前狀態 | 合併來源與問題 | 必須達成的修正結果 |
|---|---|---|---|---|
| F06 | P2，產品缺陷 | Open，90a09cc | R1-03＋R2-3＋R3-3：320×225 兩欄 stage 太窄，preview 被手指遮擋，實際高度亦被裁切。 | 按實際 overlay 尺寸在可視空間定位；球心及讀數避指、完全可見，保留真實3×場景、同一工作點、pointer-inert及cleanup；補短viewport兩種target的可信touch回歸。 |
| F07 | P3，產品缺陷 | Open，90a09cc | R1-04＋R3-4：390×600，情境C／D首時刻新增X₁與y軸名稱重疊。 | 近原點標籤避讓或使用既有selected時刻圖例，不遮軸名／刻度；保留真下標及配對識別，補正常手機及reference圖像／bbox核對。 |

第二輪詳細證據與修正／回歸條件見本文末的「第二輪完整複審彙整」。這兩項是本機可處理的呈現問題；保存與評分仍正確，不能以正常尺寸或提交可達性的通過代替修正。

## 首輪歷史事項（1c18152）

首輪 verdict 為「5個已確認產品問題及1個本機驗證缺口開啟；未通過package-ready」。以下保留當時 finding、位置、修正條件及證據，不表示它們在目前版本仍開啟；目前 closure 另列。

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

## 目前 closure 與 release gate（90a09cc）

| 事項 | 修正版本／證據 | 再審結論 |
|---|---|---|
| F01 | 90a09cc strict-string enum；兩motion及trajectory的非字串draft／review拒絕，score-zero非法pending quarantine／retry／pagehide無寫入。三位五純tests及production流程再次通過。 | Closed |
| F02 | 90a09cc短viewport兩欄；三位source／ZIP、standalone／fluid iframe實際320×225 check→submit→reference通過，16px字／≥44px提交控件、panel可達、無額外document scroll。preview另列F06。 | Closed |
| F03 | 90a09cc保留blocked touch sequence；完整四組各8個tray／active×四入口案例及同頁後續pan通過。審核1獨立重跑原重現，source／ZIP host全程300、iframe top全程0、答案不變。 | Closed |
| F04 | 90a09cc mode-first hint；空白／先分類review及reference、frozen／committed的actual DOM回歸兩路通過，審核2獨立確認未觀察reference顯示「參考軌跡」。 | Closed |
| F05 | 90a09cc `stop()`同步playback label；actual resize後再播放及三位真正Chrome tab activation引發的trusted blur／visibility文字／cleanup證據通過。 | Closed |
| V01 | 90a09cc四組source／ZIP×390／320各43 rows，16題時row分存tray／active before／during／after與preview；cursor處理、scene／viewBox／約3×／讀數／避指／release／cleanup均有斷言。原常規矩陣缺口關閉；新增短viewport例外F06仍開啟。 | Closed（原範圍） |
| N01 | 90a09cc圖例、selected標記、time／preview／feedback改用真下標與math變量。內容對齊已實作；新增圖內標記碰撞以F07追蹤。 | 已實作；F07仍Open |
| F06 | 三人各自可信touch在320×225重現；source／ZIP兩路證據齊備，詳本輪彙整。 | Open |
| F07 | 審核3獨立PNG及審核1source／ZIP DOM bbox＋PNG確認。 | Open |
| Repo／package gates | 初版1c18152 whole-repo `npm test` exit0，log已核對；90a09cc全部活動純tests／完整browser、check、package-all／diff及13entry ZIP byte parity通過。共享與其他活動未改；沒有聲稱修正版全repo重跑。 | 候選技術gates通過；F06／F07修正後需受影響回歸及最終重包 |
| Catalogue／plan evidence | 90a09cc active metadata完整；plan已修正初版tray metrics／visual zoom過廣敘述，保留歷史及本輪證據。短preview新問題及最終closure仍需另記。 | metadata／歷史更正完成；最終驗收待補 |

下一輪先修F06／F07，補上短viewport操作及label collision斷言，重跑全部受影響source／ZIP回歸及必要純tests，再做check、package-all、branch diff check及最終ZIP byte parity。三位原審核者再次完整獨立審核修正版，第四位收齊三份本輪正式報告才更新最終verdict。初版全repo成功與後續受影響回歸須保持分開；不將未執行的最終全repo重跑寫成已通過。

## 外部部署 gates（不是上述產品缺陷）

- 真實 Moodle學生attempt的score／status、空白／部分提交、同attempt whole-player刷新／離開再入、pending retry、finished review-only及new-attempt policy：**未驗證**。
- 實體手機current-window及提供時new-window player：完整owner matrix、side strips、panel底及返回、真實preview／snap、工具列／viewport／native select／zoom：**未驗證**。活動無文字輸入欄位，不能把合成鍵盤viewport當實體軟鍵盤驗收。
- 本機host forwarding以同源Moodle-like iframe驗證；真實Moodle跨域／多層host topology可用性：**未驗證**。不同嵌入條件需部署實測。
- CSS reflow等價／CDP visual zoom是本機證據；不宣稱已完成真實browser UI zoom／OS accessibility或實體裝置驗收。

修正及本機gates全部通過可判定package-ready；Moodle-ready須另有上述真實部署證據。本報告不把外部缺證據虛構成程式bug，也不將本機成功擴張成真實Moodle／手機就緒。

## 第二輪完整複審彙整（90a09cc）

三位本輪正式完整複審均已交付後才完成此彙整；不是只複查首輪findings。各自重新審核完整branch及物理、文字、UI／手機、手勢／鍵盤、評分、state／persistence、SCORM／trust／locks、catalogue／manifest／ZIP及測試。三份完整報告均保留在前述來源文件的追加段落，獨立artifact分別為`recheck-1/`、`recheck-2/`、`recheck-3/`。

### 本輪新增F06：短viewport的preview遮指及裁切（P2）

R1-03、R2-3、R3-3為同一問題，合併為F06。位置為`main.js:108–110`及`styles.css:48–56`。320×225 CSS viewport下stage是160×138.59375px；preview實際124×137.796875px，程式仍按132px高定位。候選位置無一能避指時，fallback仍取第一個corner，底部約超出stage1.203px。

三位均用Chrome/CDP可信touch獨立重現。審核1的source／ZIP在情境B t₂將tray拖至正確位置`[1600,−800]`時，放大球心離cursor約14.998px；再移到公開合法錯誤格點`[2400,0]`時，cursor `(90.119,39.059)`與preview球心`(90,38)`只差**1.066px**，實際受手指遮擋。審核2在tray `P₁=[800,−800]`記錄`containsFinger=true`、`inside=false`；審核3以active handle拖至`[1600,−1600]`在source／ZIP亦重現。工作點／release保存仍正確，所以F02提交可達性維持Closed，F06另追蹤精確作圖的可讀性。

證據：`recheck-1/targeted-report.json`、`source/package-compact-drag.png`、`source/package-compact-candidate.png`；`recheck-2/targeted-report.json`、`short-touch-preview.png`；`recheck-3/extra-report.json`、`source/package-zoom-preview.png`，均在`output/playwright/motion-composition-stroboscopic-lab/`下。

修正條件：以實際overlay尺寸在可視shell內安排穩定、避指的位置；preview可以在stage外，但必須pointer-inert、完全可見、與主圖同一post-snap工作點及真實3×局部場景。不能只隱藏必需preview、壓小主要文字／控件、改物理或grading容差。正常stage／strip／panel的gesture owner仍須保留。

回歸條件：source／實際ZIP在320×225、standalone／scrollable fluid iframe均用可信touch操作tray及active，覆蓋四情境各時刻，加入近原點及公開錯誤格點。保存實際preview bounds、cursor／球心／讀數／viewBox／倍率、所有owner／非owner、權威答案及release／cancel cleanup；球心及讀數完整可視並避開pointer的finger margin。重查正常390／320高500的完整矩陣，防止新overlay位置截取正常pan或改抓取偏移／release幾何；實際捲到panel底提交及返回仍可用。

### 本輪新增F07：近原點X₁與y軸名重疊（P3）

R1-04、R3-4合併為F07。位置為`scene.js:19,30`。390×600手機的情境C／D t₁水平位移只有0.20m，新增X₁固定在投影上方，與固定y軸名稱重疊。審核3獨立檢圖找到；審核1在source／ZIP的D確認X₁ bbox `(130.484,124.829,14.688,19.5)`與y軸名bbox `(136.942,126.423,9.207,14.276)`相交，PNG亦可見。審核2沒有另立此finding，不會推翻兩份直接重現證據。

證據：`recheck-1/targeted-report.json`及`source/package-label-collision.png`；`recheck-3/source-390-case-3.png`及相應package圖。

修正條件：以實際間距／bounds避讓軸名與刻度，或在密集區沿用既有Xᵢ／Yᵢ圖例及面板selected時刻，不必在軸旁重複標記。保留真正下標、非顏色識別及同時刻配對；不能擠到stage邊、控件或球心上。

回歸條件：source／ZIP核對四情境首時刻，至少320／390手機及390×600的C／D，同時查student／reference模式。保存DOM bbox不相交及實際PNG，並檢視其餘時刻／桌面，避免以移除單一字串或只測大stage代替圖像驗收。model／scoring不需改動。

### 本輪完整範圍及測試證據

- 三份正式複審的全範圍結論均未發現F06／F07以外的新缺陷；物理、文字、評分、state／persistence、SCORM／trust／locks及包裝依各自追加報告核對。三位獨立五套純tests、source／ZIP smoke及13entry byte parity皆通過；512 production round-trips／合法續作、791／818／1061 bytes不變。
- 最新`report.json`為Chrome155.0.8059.12、trusted touch、`errors=[]`，四組source／package×390／320各43rows；分存tray／active完整指標、128次正常拖放及全部多指／取消／host／panel／只讀rows。320×225提交／reference及真正Chrome tab activation的trusted blur／visibility文字／cleanup另有獨立證據。常規matrix及提交可達性不能代表F06短viewportpreview通過。
- Root初版whole-repo `npm test` exit0，`output/motion-composition-repo-tests.log`成功收尾已被三人及彙整者核對；90a09cc全部活動純tests、完整source／ZIP browser、check、package-all及branch diff／13entry byte parity通過。shared及其他活動未改。**證據範圍是初版全repo通過加修正版全部受影響回歸，沒有聲稱修正版全repo重跑。**

本輪verdict：首輪問題已修正；F06／F07仍開啟，須Root修正、執行受影響回歸，再交三位完整獨立審核及第四位彙整。真實Moodle／實體手機的外部gates維持未驗證。
