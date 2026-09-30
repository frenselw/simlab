# 運動合成完整獨立審核 1

日期：2026-10-01。審核分支：`codex/motion-composition-stroboscopic-plan`。基準：`origin/main`；實作版本：`1c18152`。

本次獨立審核涵蓋整條 branch，沒有按領域拆分。審核前未閱讀其他審核者的報告，沒有修改產品或正式測試程式。臨時重現腳本與瀏覽器證據置於 `output/playwright/motion-composition-stroboscopic-lab/review-1/`。

結論：物理模型、評分、合法空白／部分作答、保存與 SCORM 的主要流程正確；常規 source／ZIP 瀏覽器檢查通過。發現 1 個可重現的手機手勢缺陷及 1 個驗證紀錄缺口，建議修正後再通過 package-ready。真實 Moodle／實體手機未驗證屬部署 gate，並非已發現的產品缺陷。

## 必須處理的 findings

### R1-01 · [P2] 第二隻手指會把取消中的拖放轉交給 host 捲動

- 位置：`sim/motion-composition-stroboscopic-lab/main.js:133–137`，尤其 `touchstart` 的 `host` 判斷（135）與 `touchmove` 的 parent forwarding（136）。
- 重現環境：Chrome `155.0.8059.12`、CDP trusted touch、320 × 500、可捲動 Moodle-like iframe；**source 及實際 ZIP 兩路均重現**。
- 重現步驟：顯示情境 1 頻閃；第一隻手指按待放球，拖入圖域至 `(0.800, −0.800) m`，preview 出現；第一隻手指仍按住時，第二隻手指從右側 scroll strip 開始，再向上移動 35 CSS px。
- 結果：第二個 `pointerdown` 正確取消原 drag、答案保持空白、preview 清除，但 host `scrollY` 由 **300 → 335**，iframe top 由 **0 → −35**。activity document 與 panel 保持 0。兩路均記錄 1 個 trusted touch down、1 次 move、1 次 cancel；沒有完成放手保存。
- 原因：133 取消 `drag` 後，135 仍把第二個 touch 記為 `host: true`；136 不保留原操作的 gesture owner，也沒有多指／取消鎖，因此直接 `parent.scrollBy()`。
- 影響：手機上意外第二指、掌邊接觸會在操作中把整個 activity 移走。單指 target 起始的手勢取消後應回復最近保存答案，並在該次 touch sequence 結束前保持非 owner 的 host 固定；不能因取消而改變捲動歸屬。
- 修正建議：把 owner／blocked 狀態保留至該 touch sequence 全部結束；多指打斷 simulation-owned 操作時，取消答案暫態並禁止餘下 touch 的 host forwarding。正常單指從 stage／兩侧 strip 開始的 host pan 仍須可用。加入 source／ZIP trusted-touch 回歸，測 secondary touch 分別從 stage、左右 strip 及另一 target 開始，確認 host／iframe／panel／答案保持正確。
- 證據：`output/playwright/motion-composition-stroboscopic-lab/review-1/targeted.js`、`targeted-report.json`。命令：`node output/playwright/motion-composition-stroboscopic-lab/review-1/targeted.js`。這是實際可信 touch 重現，不是 DOM `dispatchEvent` 或 CSS 推斷。

### R1-02 · [P3] 完整 touch 報告遺失待放球的 before／after metrics

- 位置：`tools/motion-composition-browser-regression.js:116–120`。
- 116／118 取得 tray drag 的 before／after 並完成 assertion；119 隨即把這兩個變數改成 active-handle drag 的 metrics；120 只保存後者。
- `report.json` 的每個 `index`／`slot` row 因此只有 active target 的 before／after。tray 的 preview 仍有保存，但 tray 的 host、iframe、document、visual viewport、panel、權威答案與 pointer before／after 不能從最終報告直接檢視。
- 這不是 tray drag 已知功能錯誤：測試中的 tray assertions 及獨立 smoke 均通過。但製作指南要求**記錄每種 target 的 owner 與所有非 owner metrics**，目前報告不足以支持「所有 target metrics 已記錄」的驗收敘述。
- 修正建議：分別保存 `tray: { before, during, after }` 與 `active: { before, after }`，勿覆寫；重跑 source／ZIP 完整 touch matrix，確認 report 中每種 target 的 trusted touch、move／up、cancel、preview 與 fixed non-owner 證據可追查。新增多指案例也應保存相同 metrics。

## 全範圍審核與結果

| 領域 | 獨立核對及結果 |
|---|---|
| 使用者目標／範圍 | 四個正交分運動情境、同步播放、等時頻閃、四個拖放時刻、自動連接學生點、兩方向類型及軌跡判斷均已實作。情境獨立切換；沒有把題名當作正解提示。 |
| 物理 | `x = vₓ₀t + ½aₓt²`、`y = vᵧ₀t + ½aᵧt²`、`Δt = 0.20 s`、共同 O 及時間正確。16 個基準位置與計劃一致。A／D 為 `y = −x`；B 為 `y = −(5/16)x²`；C 為 `x = (5/16)y²` 的 `y ≤ 0` 分支。B 的 `g = 10 m/s²` 與忽略空氣阻力有明示，C 沒有誤稱水平加速為自由落體。 |
| 間距推理 | 工具比較的是**相鄰**球影距離，不是由 O 量的總位移。勻速為 0.80 m × 4；由靜止勻加速為 0.20／0.60／1.00／1.40 m，後三段各多 0.40 m。文字使用「符合模型」，沒有把有限點說成能證明每一瞬間加速度；沒有把 1:3:5:7 當成所有勻加速運動的必然比例。 |
| 圖像正確性 | x 右正、y 上正、向下為負 y；M.pixel／world 可逆，橫豎等比例。只強調所選時刻的兩個投影；沒有提前畫正確交點／答案曲線。學生折線只連相鄰且存在的 slot，不跨未答時刻；提交後才畫精細參考軌跡。 |
| 用字與精煉 | 主要 learner copy 為繁體中文、短句。分運動球說明為同一運動的投影，避免兩個實球相撞／融合。分段式 fieldset 與折疊比較／微調工具避免首屏說明過長；結果按當前情境呈現。沒有重複長篇操作說明或技術術語洩入正常操作。 |
| UI／共用風格 | header、stage、control panel 三區分明；題目導航在 header；沿用 shared colors、button、border、font，淺色底、藍色主要 action，無裝飾封面或額外 runtime library。必要圖字以 CSS px 繪圖，不隨 SVG viewBox 縮成難讀小字。 |
| 手機布局 | 已讀完整 report 的 320×500、390×500、390×600、390×844、768×900、1024×768、1280×900、740×360、320×400、640×450 兩路數據：document range 與 horizontal overflow 均為 0；panel 最小 146 px，stage 最小 167 px。獨立 smoke 重跑同一組布局通過。正常／短手機及橫向圖片無必要控件被 stage intrinsic size 推走；panel 底部可到達。 |
| Targets／gesture | 44 px positioned HTML tray／active targets，capture target 穩定；僅 target 使用 `touch-action: none`。stage 與 24 px 左右 strip 為 pan-y，panel 有自己的 containment。已逐類閱讀 source／ZIP 390／320 full report：tray／active、左右 strip／blank stage 兩向 pan、panel 中段／上下邊界、review／frozen／committed 原 target pan 均有執行 assertions；**另以可信多指輸入找到 R1-01**。 |
| Preview／snap | touch 使用真實 3× 局部場景與目前 snapped working point；readout 不呈現隱藏正解；preview 不截取事件。圖／預覽／release 共用 geometry；world mm 與 CSS px snap threshold 分離。所有公開格點包括錯誤格點都可吸附；4 px 新點拖動門檻、圖外放手／cancel 回復保存點有合理實作。既有點以抓取偏移拖動。 |
| 鍵盤／微調 | Pointer target 有方向鍵 0.20 m、Shift 0.01 m、Enter 保存、Escape 取消；面板另有普通按鈕微調。空白點工作值為暫態，未明確保存不算答案。獨立 source／ZIP smoke 透過 production handler 驗證鍵盤放置與 Escape 回復。焦點／select 保留及 nav 重建後的焦點回復程式合理。 |
| Blank／partial／scoring | 未觀察、只有分類、部分點、分類缺漏均可進檢查；無逐題訪問門檻。每題 16 分位置＋6 分類型＋3 分軌跡，四題 100、60 達標；x／y／分類互相獨立。空白 0、全部分類 36、全部位置 64、全對 100 均獨立執行通過。±50 mm inclusive 且與 snap 分離，全部題／時刻／坐標的 49／50／51 mm 正負界線通過。共同末點複製不冒充前面時刻。 |
| Phase／dependencies | observed 是放點唯一真正依賴，分類不依賴觀察。四題工作保留，time slot 明確；返回檢查保留語義 returnToCheck。檢查／導航／鎖定取消未保存 work。完成最後題不自動提交，明確 submit 才保存結果。 |
| 保存／還原 | Production encode／decode、8 類樣本 × 4 題 × 4 時刻 × edit／check／return／review = **512 round-trips** 與合法續作獨立通過；分數及 passed 相等。保存 authoritative mm／類型／phase／選題選時／observed；不保存 pointer／動畫／DOM。未知版本、錯 enum／tuple／索引／依賴、非有限數／非整數／越界拒絕；物理錯答不當損壞。 |
| Snapshot size | representative draft／review／pending 封套為 **791／818／1061 UTF-8 bytes**，全部小於 4000。review 不儲存冗長 feedback、圖像或指標日誌；4000 檢查存在 production boundary。 |
| SCORM lifecycle | 使用 shared `loadAttempt/startup`、draft provider、`submitWithCallbacks/submission`；沒有活動自行呼叫 raw LMS、commit／finish／pagehide。review／editable／frozen／load-error 與 success／committed／frozen／retry、retryable 兩類皆有 production-controller 測試且獨立通過。finished-invalid／mismatch／unknown status 保持只讀摘要；pending deep-invalid quarantine 後 pagehide 不寫入；equal-score but altered authoritative answers 不接受。 |
| Final locks／失敗語義 | submission pending 保持凍結，不顯示正解或已確認分數；committed 可重試 finish、不能編輯；成功後沒有 clear／restart。draft save 失敗保留記憶體並提示重試；不把 read failure 當新 standalone。Standalone 同頁結果只讀，刷新從空白開始；source／ZIP production UI 的 edit／check／review refresh、拒絕 storage 與 fake-LMS resume 已通過 smoke。 |
| 信任邊界 | 計劃明確 formative，瀏覽器評分不宣稱可信高風險 grading。沒有 secrets／signing keys、偽稱防改答案機制。 |
| Catalogue／manifest／ZIP | metadata 六欄完整、folder／slug／manifest 一致，目前 `planned` 合理反映獨立審核未完成；通過修正後可再啟用。所有 HTML local script／CSS runtime refs 與 manifest 一致；ZIP 根有 imsmanifest.xml，13 entries 與 manifest 完全相等；**所有 ZIP bytes 與目前 source 一致**。無測試或 screenshot 混入 ZIP。 |
| 測試有效性 | 五個 activity pure suites 與 browser runner 已加入 `tools/run-tests.js`；模型固定數據、評分邊界與獨立部分分、production restore／合法續作、shared fake-LMS outcome／quarantine、學生線不跨空白 slot 都有實際 assertions。source／ZIP smoke 重跑通過。R1-01 暴露 multi-touch case 未進常規矩陣；R1-02 要補可查證 metrics。 |

## 本次實際執行

以下檢查由本審核者獨立執行，不只接受主 agent 的說明：

- `node sim/motion-composition-stroboscopic-lab/model.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/scoring.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/persistence.test.js`：512 round-trips／續作通過。
- `node sim/motion-composition-stroboscopic-lab/lifecycle.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/scene.test.js`：通過。
- `git diff --check origin/main...HEAD`：通過。
- `npm run check`：JavaScript syntax 與 SCORM 1.2 manifest profile 通過。
- `MOTION_ARTIFACT_SUFFIX=review-1 node tools/motion-composition-browser-regression.js --smoke`：source／ZIP 兩路布局及 UI flows 通過；`review-1/smoke-report.json` errors 為空。
- 獨立 ZIP／manifest／HTML references 與 source byte parity：13 個 ZIP entries 完全相符。
- `node output/playwright/motion-composition-stroboscopic-lab/review-1/targeted.js`：可信多指缺陷兩路重現，詳 R1-01。

亦完整檢查初版 `report.json` 的四組 31 rows（source／package × 390／320）與 before／after owners；檢視 desktop 四情境、phone、間距工具、reference review、3× preview 與 200% zoom screenshot。未獨立重跑全 repo `npm test`，因主 agent 已在執行；沒有平行啟動另一個 whole-repo run。

## 尚未驗證／不可宣稱的 deployment gates

- 真實 Moodle 的 student attempt score/status、whole-player refresh／離開再入、new-attempt policy、pending retry 及 finished review-only 尚未驗證。
- 實體手機的 current-window／new-window Moodle player、真實 host 嵌入拓撲與 device touch 行為尚未驗證。現有 host pan 是同源 parent forwarding；不同／多層 host 拓撲需要部署實測。
- 現有 200% 證據是 CDP page scale 與 screenshot，不能替代真實 browser text zoom／OS accessibility、軟鍵盤或外部 select picker 的驗收。沒有文字輸入欄位，軟鍵盤不屬正常作答所需操作；仍應把實際裝置測試寫清楚。
- 全 repo `npm test`、最終 package-all、最終 active catalogue 與修正後 source／ZIP 回歸由主 agent 完成並更新最終驗收。初版測試證據不能用來宣稱尚未測的最終版本。

上述外部 gate 不要求為本地形成性活動加無關的安全流程；只要求交付說明如實區分 package-ready 與 Moodle-ready。

## 修正版完整獨立複審：90a09cc

日期仍為 2026-10-01。本輪重新審核整條 branch 相對 `origin/main` 的結果，候選版本為 `90a09cc`；並非只複查首輪 findings。首輪內容保留為歷史證據。本輪沒有閱讀其他審核者的報告，也沒有修改產品或正式測試。獨立重現腳本、JSON 及圖片位於 `output/playwright/motion-composition-stroboscopic-lab/recheck-1/`。

結論：R1-01、R1-02 已修正，strict enum／invalid pending quarantine、只讀提示與停止播放文字亦通過核對。物理、評分、合法續作、SCORM 失敗鎖及 package parity 未發現新問題。新增兩項可重現 UI 問題：短 viewport 的 preview 被手指遮擋且邊界略被裁切（R1-03，P2），正常手機上的所選 X₁ 與 y 軸名稱重疊（R1-04，P3）。應修正並重跑對應 source／ZIP 驗證後才關閉本地審核；真實 Moodle／實體手機的部署 gate 仍另外保留。

### 首輪 findings 與修正核對

| 項目 | 本輪證據與結論 |
|---|---|
| R1-01 多指取消後 host 移動 | **已修正。** `main.js:139–143` 保留 blocked touch sequence 至所有 touch 結束。獨立重跑原 320×500 iframe 的 tray 拖放＋第二指右 strip：source／ZIP 的 host 全程 300、iframe top 全程 0、document／panel 全程 0；權威答案不變，preview 清除，1 次 trusted down／move／cancel、0 次 release，最後解除 blocked。完整報告另覆蓋 tray／active 與四種第二指入口，以及所有 touch 結束後恢復正常 pan。 |
| R1-02 tray metrics 被 active 覆寫 | **已修正。** 已逐組核對目前 `report.json` 的 source／package × 390／320 共 172 rows。每個情境／時刻均分別保存 `tray`、`active` 的 before／during／after、preview 及 release 資料；多指取消亦有非 owner 與權威答案指標。四組各 43 rows、errors 為空，沒有把舊 runner diagnostics 當成目前失敗。 |
| Enum／pending trust | `model.js:21,23` 使用 string＋own-key 的 strict enum；陣列、物件、布林、數字不能被屬性 coercion 接受。pure suites 亦驗證 invalid pending 在零分也被 quarantine，retry／pagehide 不覆寫 LMS。合法空白仍能評分及提交。 |
| 只讀與播放提示 | `main.js:80` 按 phase 顯示「你的作圖」或 reference 提示；review／pending 不再提示學生拖放。`stop()` 更新播放 label；獨立以真正 tab activation 觸發 trusted blur／visibilitychange，兩路均從「停止播放」回到「播放分運動」，回到頁面仍正確。resize 停止文字亦由 production smoke 覆蓋。 |
| 320×225 reflow | 兩欄短 viewport 下 panel 的檢查、提交、結果及 reference 可到達；source／ZIP standalone 與 fluid iframe 的 production smoke 均通過。但此布局使 stage 只有約 160×139 px，暴露 R1-03 的 preview 問題，不能以可提交推論拖放放大鏡也已通過。 |
| 下標／數學記號 | 所選時刻的圖例與 time control 使用真下標，feedback 的變數及次方記號正確；新增圖內所選標籤引入 R1-04。 |

### R1-03 · [P2] 320×225 的拖放 preview 無法避指，實際高度亦超出 stage

- 位置：`sim/motion-composition-stroboscopic-lab/main.js:108–110` 的固定 `124×132` 尺寸、候選位置及無可避指位置時的 fallback；`styles.css:48–56` 的短 viewport 兩欄布局。
- 重現：Chrome CDP **trusted touch**、320×225 fluid iframe，source 與實際 ZIP 均重現。顯示情境 B 頻閃，選 t₂，從待放球拖至 `(1.600, −0.800) m`，保持按住；再拖至公開合法但錯誤的格點 `(2.400, 0.000) m`。
- 實測 stage 為 **160×138.59375 CSS px**。preview 實際 bounds 為 **x=28、y=2、width=124、height=137.796875**，其 bottom 約 139.797，比 stage 底部多約 1.203 px；程式以 132 px 假設高度，沒有按目前下標文字的實際高度定位。
- 在正確 t₂ 位置，pointer 在 preview 內，preview 球心離手指只有 **14.998 px**，已未符合程式／runner 的 16 px 避指距離。移至上述公開錯誤格點時，pointer 為 `(90.119,39.059)`、preview 球心為 `(90,38)`，兩者相距僅 **1.066 px**。球心實際落在可信 touch 的手指接觸範圍內，放大鏡失去讓學生看清放置位置的用途。
- 原因：160 px stage 無法容納 124 px preview 並保持該 pointer 的避指範圍；所有 `clear()` 位置都不適合時仍採用 `options[0]`。使用實際高度只可修正裁切，仍需另處理狹小 stage 的放置空間。
- 答案保存仍正確：移回 `(1.600, −0.800) m` 再放手，權威答案保存 `[1600,-800]`、preview 清除；未發現評分或 gesture owner 損壞。此 finding 是支援布局的操作可讀性問題。
- 建議：短 viewport 可把 pointer-inert preview 放到整個 app shell 的可見空間；按實際 bounds 定位，讓放大球心及 readout 都避開手指並完整可見，同時保留真實 3× 幾何與 release 一致。加上 source／ZIP 320×225 的 tray／active 可信拖放、公開錯誤格點、release／cancel 的 preview bounds／避指檢查。現有 compact smoke 只以預填答案檢查提交／reference，未涵蓋此操作。
- 證據：`recheck-1/targeted.js`、`targeted-report.json` 的兩個 `320x225 trusted drag preview` rows；`source-compact-drag.png`、`package-compact-drag.png`、`source-compact-candidate.png`、`package-compact-candidate.png`。不是 DOM 合成事件、單純 CSS 推斷或僅以 screenshot 猜測。

### R1-04 · [P3] 所選 X₁ 標籤與 y 軸名稱重疊

- 位置：`sim/motion-composition-stroboscopic-lab/scene.js:19,30`；y 軸名稱固定在原點右方，Xᵢ 標籤固定在所選水平投影上方。
- 重現：source／ZIP、390×600，顯示情境 D 的頻閃並選 t₁。所選水平位置為 0.200 m，靠近原點；X₁ 的 DOM rect 為 **(130.484,124.829,14.688,19.5)**，y 軸名稱為 **(136.942,126.423,9.207,14.276)**，rect 有重疊，PNG 可見兩字擠在一起。
- 影響：增加下標本來是為學生清楚配對所選時刻，此處卻使變數名稱難辨；沒有答案或物理錯誤。情境 C 的首個水平投影同為 0.200 m，採同一定位公式，亦有相同風險（正式重現數據為 D）。
- 建議：保留現有真正下標的圖例／time panel，移除密集軸旁重複 selected labels，或用實際 bounds 避開軸名稱／刻度。至少核對正常手機四個情境首時刻及 reference 畫面，避免只測 desktop。
- 證據：`recheck-1/targeted-report.json` 的兩個 `390x600 selected X1 / y-axis label` rows；`source-label-collision.png`、`package-label-collision.png`。

### 本輪全範圍結論

| 領域 | 完整複審結果 |
|---|---|
| 目標與教學流程 | 四情境、等時分運動頻閃、四時刻拖放、兩方向分類、軌跡分類、學生點的自動連線、提交後 reference 均仍符合使用者目標。觀察是放點的必要依賴；分類、空白／部分 check-and-submit 不被無關步驟阻擋。 |
| 物理與相鄰間距 | 重新核對 16 個位置、四種運動類型、正交坐標、共同 O、Δt=0.20 s、g=10 m/s²、忽略空阻及 B／C／A／D 曲線。相鄰間距為 0.80×4 或 0.20／0.60／1.00／1.40 m，後者每次增加 0.40 m；有限資料只說符合模型。未發現新物理問題。 |
| 圖像與答案隔離 | x／y 方向、等比例、所選時刻投影、學生點與 working point、public snapping、參考曲線及空白段不跨連仍正確。reference 可顯示原本未觀察的分運動，而不改動權威 observed；編輯期沒有顯示隱藏正解。選點標籤另見 R1-04。 |
| 繁體中文與精煉 | 活動主要文案保持繁體、短句及漸進工具；「同一運動的投影」清楚，無把兩球視為實物合併的引導。間距工具不混淆總位移與相鄰距離；review hint 已修正；數學變數／下標／次方改善。未發現需另立 finding 的冗長或用詞問題。 |
| 共用風格／布局 | shared styles/runtime 正常沿用，三區與主要操作位置符合 baseline，沒有 runtime dependency 擴張。十種常規布局的 source／ZIP smoke 通過，水平 overflow／document 捲動及 panel 可到達性有 assertions；新增 320×225 兩欄可提交及看 reference，但其觸控 preview 有 R1-03。 |
| Touch／preview／中斷 | 完整 172 rows 包括每題每時刻 tray／active、非 owner 固定、3× 真實場景與 readout、唯一 SVG IDs、snap／release 一致、多指八類組合、cancel／lost capture／resize／圖外 release、stage／左右 strip、panel 中段／上下邊界及各種鎖定。原多指重現已獨立確認關閉；一般尺寸 preview 通過。短 viewport 缺陷另見 R1-03。 |
| Keyboard／微調 | 方向鍵 0.20 m、Shift 0.01 m、Enter 保存、Escape 取消、普通微調按鈕仍一致。暫態點不混入保存；production smoke 重新驗證放置／取消及依賴／焦點流程。 |
| 空白／部分評分 | 64 分位置＋36 分分類、每題 25、60 達標、x／y／類型獨立得分、±50 mm inclusive 仍正確。untouched 0、只有分類 36、只有點 64、全對 100、所有 49／50／51 mm 正負界線及共同末點誤用都由 meaningful assertions 通過；未把 invalid enum 當合法答案。 |
| State／production persistence | 五純 suites 全通過，包括 **512** encode／decode／restore round-trips 及每個合法 continuation；保持 phase／variant、returnToCheck、observed、選題選時與 authoritative answers。不保存 pointer／動畫／DOM。invalid 與 legal unanswered 分開；strict enum 後 draft／review／pending 仍在 4000 bytes 內。 |
| SCORM／trust／failure locks | 活動仍只用 shared loadAttempt／startup／draft／submission callbacks；沒有 raw LMS、local commit／finish／lifecycle。success／committed／frozen／retry、load-error、finished-invalid、score／snapshot mismatch、deep-invalid pending quarantine、相同分數而不同答案皆核對及測試通過。pending／committed 的 review-only、technical failure 不宣稱確認結果、retry 不解鎖答案，亦無 restart。 |
| Refresh／resume | source／ZIP smoke 通過 standalone edit／check／review 刷新回空白、storage 拒絕不崩潰、fake-LMS 同 attempt resume、合法繼續及已提交只讀。真實 Moodle player refresh／再進入仍未驗證，沒有用 fake API 結果冒充部署驗收。 |
| Catalogue／manifest／ZIP | final catalogue 六欄與 slug 一致，現在是 `active`；manifest 含全部本地 runtime、shared refs，沒有測試／QA artifacts。獨立檢查 **13 ZIP entries、10 HTML runtime refs 全部匹配，13 entries 與目前 source bytes 完全相同**。活動與共享／其他活動的 diff scope合理；本輪未新增共享改動。 |
| 測試與 gate | 新測試仍在 `tools/run-tests.js`；五活動 suites、獨立 source／ZIP smoke、check、diff、ZIP parity 皆通過；完整 trusted-touch report 可檢視 tray／active 的所有指標。新 findings 是目前 matrix 未覆蓋的 compact dragging／label collision，應補針對性檢查。全 repo 首輪 npm test 的成功 log 已核對，未另啟 whole-repo run。 |

### 本輪實際命令、證據與限制

以下由本審核者獨立執行，候選 runtime 一直保持 `90a09cc`：

- 五項 `node sim/motion-composition-stroboscopic-lab/{model,scoring,persistence,lifecycle,scene}.test.js`：逐項執行，全部退出 0；persistence 512 round-trips／continuations，representative draft／review／pending 為 **791／818／1061 UTF-8 bytes**。
- `MOTION_ARTIFACT_SUFFIX=recheck-1 node tools/motion-composition-browser-regression.js --smoke`：退出 0；source／ZIP 常規布局、production flows、320×225 standalone／iframe 提交與 reference 通過；`recheck-1/smoke-report.json` errors 為空。
- `npm run check`：退出 0；syntax 與 SCORM manifest profile 通過。
- `git diff --check origin/main...HEAD`：通過。
- Node 獨立核對活動 HTML local runtime refs、manifest、ZIP entries 及 source bytes：13 entries、10 refs、allByteIdentical=true。
- `node output/playwright/motion-composition-stroboscopic-lab/recheck-1/targeted.js`：退出 0，產生完整 JSON；兩路均確認原多指問題修正、R1-03／R1-04 重現、真實 tab blur／visibility 停止文字正確。腳本把已知 UI finding 保存為 evidence，故 errors=[] 不代表兩項 UI finding 已通過。
- 真實 visibility 方法：另開 Chrome tab，使用 `Page.bringToFront`；前台活動收到 trusted `blur`／`visibilitychange`，`document.hidden=true`、`hasFocus=false`，停止後 label「播放分運動」。回原 tab 收到 trusted focus／visibilitychange，hidden=false、focus=true，label 保持一致。此獨立 probe 驗證播放，不宣稱亦已驗證手指按住時的真實 tab 切換。
- 已閱讀 root 的目前完整 `report.json` 四組各 43 rows（172 rows）、對應 source／ZIP screenshots 及 `output/motion-composition-repo-tests.log` 成功尾段；全 repo exit 0 由 root 的實際執行提供。本輪沒有重新跑整套 repo，也沒有以已歸檔失敗 driver diagnostics 當成目前產品失敗。

未解事項只有本輪兩個可重現 findings 與前述外部部署 gate。320×225 CSS viewport／reflow 的實測不等於實機 browser UI 200% text zoom／OS accessibility 已通過；真實 Moodle 與實體手機的 current/new-window player、host 拓撲、attempt policy、retry／finish／review 實測仍需在交付中列明。其餘已審領域未發現新的可重現缺陷。
