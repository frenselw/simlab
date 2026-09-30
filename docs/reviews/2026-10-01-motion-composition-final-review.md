# 運動合成：完整獨立審核彙整及最終驗收報告

日期：2026-10-01。分支：`codex/motion-composition-stroboscopic-plan`。首輪：`1c18152`；第二輪：`90a09cc`；第三輪最終runtime／正式測試：`850eae68c1b5232346699cf41ce0dbd36d51bcf5`。每輪均審核相對 `origin/main` 的完整 branch。

**最終結論：package-ready通過。三位三輪完整獨立審核、第四位彙整及最終文檔核對完成；F01–F08、V01、N01全部關閉，沒有未處理的可重現本機問題。** 證據範圍為初版whole-repo `npm test` exit0，加最終850eae6全部受影響回歸；沒有聲稱最終全repo重跑。真實Moodle／實體手機仍未驗證，Moodle-ready未驗證。

## 最後文檔項目（已關閉）

| ID | 優先序／性質 | 目前狀態 | 合併來源與問題 | 必須達成的修正結果 |
|---|---|---|---|---|
| F08 | P3，文檔一致性 | Closed，850eae6後docs-only同步 | R2-4：plan:133舊球影旁Xᵢ／Yᵢ描述及:185舊radio描述。 | 已改為粗圈／真下標圖例／時刻識別及native button／select／checkbox；第四位直接核對plan:133／:164／:185與production HTML／main／scene一致。 |

目前沒有Open本機項目。F06／F07及F08的歷史與closure保留於本文；最後更正僅文檔，runtime／正式tests／ZIP維持850eae6，沒有額外runtime重跑。

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

## 目前 closure 與 release gate（850eae6）

三位第三輪全範圍審核均確認F01–F05維持修正，F06／F07及V01最終證據亦通過；詳各自正式第三輪段落。以下保留修正版本來源及最終狀態。

| 事項 | 修正版本／證據 | 再審結論 |
|---|---|---|
| F01 | 90a09cc strict-string enum；兩motion及trajectory的非字串draft／review拒絕，score-zero非法pending quarantine／retry／pagehide無寫入。三位五純tests及production流程再次通過。 | Closed |
| F02 | 90a09cc短viewport兩欄；三位source／ZIP、standalone／fluid iframe實際320×225 check→submit→reference通過，16px字／≥44px提交控件、panel可達、無額外document scroll。preview另列F06。 | Closed |
| F03 | 90a09cc保留blocked touch sequence；完整四組各8個tray／active×四入口案例及同頁後續pan通過。審核1獨立重跑原重現，source／ZIP host全程300、iframe top全程0、答案不變。 | Closed |
| F04 | 90a09cc mode-first hint；空白／先分類review及reference、frozen／committed的actual DOM回歸兩路通過，審核2獨立確認未觀察reference顯示「參考軌跡」。 | Closed |
| F05 | 90a09cc `stop()`同步playback label；actual resize後再播放及三位真正Chrome tab activation引發的trusted blur／visibility文字／cleanup證據通過。 | Closed |
| V01 | 最終四組source／ZIP×390／320各43rows，tray／active完整指標與preview核對；短viewport另有source／ZIP各36rows，全部geometry／owner／release／cleanup通過。 | Closed |
| N01 | 真下標圖例、time／preview／feedback與math變量已對齊；850eae6移除密集軸旁重複字、保留粗圈及時刻識別，碰撞gate通過。 | Closed |
| F06 | 850eae6 preview移為pointer-inert shell sibling，先render再量實際overlay／lens；三人獨立source／ZIP、standalone／iframe短矩陣128正常拖放＋8錯格＋16cancel通過，完整可視／16px避指／精確3×／release及非owner固定。 | Closed |
| F07 | 850eae6移除軸旁selected X／Y重複字並另避讓Pᵢ／y軸名；普通手機C／D所有slot及reference、短圖／錯格的SVG文字bbox與PNG核對通過。 | Closed |
| F08 | Root更正plan:133／:185；第四位直接與:164、index.html:28–34、main.js:78–79及scene.js:26–30核對，現行標記／控件／鍵盤描述一致，文檔diff check通過。 | Closed，docs-only |
| Repo／package gates | 初版1c18152 whole-repo `npm test` exit0；850eae6全部活動純tests／完整browser、check、package-all／branch diff及13entry ZIP byte parity通過，三人獨立驗證亦通過。shared／其他活動未改；沒有最終全repo重跑。 | Package-ready通過 |
| Catalogue／plan evidence | active metadata、現行描述及歷史證據已核對；Root按本報告同步最終完成標記，屬驗收紀錄更新。真實部署gates維持未驗。 | Closed；外部gates另列 |

最終文檔核對已完成，F08關閉；不需要第四輪runtime完整審核或重跑已通過的測試。初版全repo與最終受影響回歸的證據範圍、真實Moodle／實體手機未驗限制維持。

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

## 第三輪完整獨立審核彙整（850eae6）

三份第三輪正式追加報告均已齊備才完成本輪彙整；各自完整覆蓋branch及全領域，不只檢查F06／F07。三位皆確認所有runtime findings關閉，物理、精簡繁體文字、UI／手機、評分、512 production還原／合法續作、SCORM／trust及13entry包裝未發現新問題；全範圍依前述三份來源的第三輪正式段落核對。

- 三位分別執行五純tests及`final-recheck-{1,2,3}` source／ZIP smoke（含全部短trusted touch），並核對manifest／13entry byte parity、check／diff及Root最終normal四組43rows。Root及三人自己的report均`errors=[]`；短source／package各36rows＝128正常拖放＋8公開錯格＋16cancel，actual3×／場景／避指／讀數／release／cleanup及所有非owner通過。F06／F07現有直接反例均已消除；普通C／D各slot及reference、短scene文字bbox不重疊，Pᵢ／y額外碰撞亦已修正。
- 最終check／package-all／branch diff及全部13ZIP entry與source bytes一致已通過。shared／其他活動未改；保留「初版whole-repo `npm test` exit0＋最終全部受影響回歸」，不宣稱最終whole-repo重跑。真實tab blur／visibility的第二輪獨立證據仍適用，相關handler本輪未改。

### F08：計劃文字一致性（P3，R2-4，原finding歷史）

彙整者直接讀取plan及production HTML／scene，確認下列兩處過時描述；這是文檔矛盾，沒有runtime故障：

1. `plans/25-motion-composition-stroboscopic-lab.md:133`刪除「圖域≥145px在球影旁標Xᵢ／Yᵢ」，統一為selected粗圈、真下標圖例與時刻按鈕識別；極短viewport收起頂列、面板時刻保留仍需寫清楚。與同文件`:164`的最新可讀性決定一致。
2. 同文件`:185`改為native button／select／checkbox及其label target，依實際控件說明Tab焦點、按鈕Enter／Space、checkbox Space與原生select選項鍵盤操作；不能再寫radio／radio方向鍵。production三個分類是`index.html:29,34`的select，工具開關是`:28,31`的checkbox。

Root修正後由第四位直接讀文檔及diff核對，不需runtime重跑。最終checklist只按已記錄證據標示；真實Moodle／實體手機仍未勾選。F08關閉前整體verdict為待文檔完成；F08關閉後可判定本機package-ready，Moodle-ready仍未驗證。

### 最終文檔closure（2026-10-01）

Root已修正兩處現行描述。第四位直接讀plan:133／:164／:185，對照production index.html的button／三個select／兩個checkbox、main的真下標圖例及scene的selected粗圈，確認一致；極短viewport收起頂列、面板時刻保留亦有記錄。原審核者2亦已在自己的正式報告追加R2-4文檔closure，獨立確認同一修正。文檔diff check通過，F08關閉。此更正沒有改850eae6的runtime、tests或ZIP，毋須再測程式。

全部可重現本機findings已關閉，最終verdict為package-ready通過。真實Moodle／實體手機驗收仍未執行，前述外部gates維持，不宣稱Moodle-ready。
