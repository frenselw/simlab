# 運動合成完整獨立審核 2

審核日期：2026-10-01。分支：`codex/motion-composition-stroboscopic-plan`。本次獨立審核以 `1c1815283c41420b09dfb6ce8e27bd8059073391` 為實作基準，檢查 `origin/main...HEAD` 的整份變更；未先閱讀其他審核者的報告，未修改活動或測試程式。

結論：四個情境的物理模型、評分與持久化核心通過本次核對。發現一項可重現的學生介面問題及一項本機驗收證據缺口；沒有發現 P0/P1 問題。下列兩項修正後，應重跑受影響的 source/ZIP 檢查，再記錄 package-ready 結果。真實 Moodle／實體手機仍是另行驗收的部署 gate。

## 可重現問題

### R2-1 [P2] 空白或未觀察題目的只讀頁仍提示執行已隱藏的操作

- 位置：`sim/motion-composition-stroboscopic-lab/main.js:75`；顯示頻閃按鈕的隱藏邏輯在同檔 `:33`。
- 重現：全新 standalone，直接按「檢查作答」→「確認提交目前作答」→「顯示參考作圖」。也適用於只答分類而未顯示頻閃的題目，以及提交後切到任何未觀察題目。
- 實際：mode=`review`、reference=`true`，stage hint 仍為「在操作面板顯示頻閃圖」，但 `observeButton` 已隱藏。參考曲線已畫出，卻配上無法執行的編輯提示。pending 的未觀察題目亦優先落入相同提示，而非凍結狀態說明。
- 影響：空白／部分提交是正式支援流程；學生會被指示尋找不存在的按鈕，且參考圖的標示不正確。
- 證據：`output/playwright/motion-composition-stroboscopic-lab/review-2/targeted-report.json` 的 `blank submitted reference hint` 記錄 `observeVisible=false`。
- 建議：先依 review/reference/frozen 等只讀模式決定提示；「顯示頻閃圖」指示只限可編輯且未觀察時。補上空白提交、分類先答、未觀察題目 review/reference/frozen 的實際 DOM 回歸。

### R2-2 [P2，驗證缺口] 手勢報告丟棄 tray 指標，預覽亦未核對實際位置

- 位置：`tools/motion-composition-browser-regression.js:117`、`:119`、`:120`。
- 已執行的 tray 斷言在 `:118` 會比較 before/after；但接著 `:119` 將兩者改成 active-handle 的測量，最後 `:120` 只保存這一組。`report.json` 的每一題／時刻因此只保留 active-handle 前後指標，沒有 tray-handle 的指標，不能由報告重查兩種 target 的完整矩陣。
- 同時 `:117` 的預覽斷言只檢查顯示、位於 stage 內及 `pointer-events:none`，未核對真實場景、吸附焦點、讀數與最終放點一致，也未核對與手指位置的遮擋關係。
- 具體證據：現有完整 `report.json` 的 `source-320`、index=0、slot=0 記錄 tray 預覽 `x 0.800 m / y -1.200 m`，但已保存位置（該 row 的 active 開始前 state）是 `[800,-800]`；還有其他 row 出現同類差異。這可能是 CDP／Pointer Event 最後一個 move 尚未被處理時提前取樣，**不能據此直接斷言活動的預覽有產品缺陷**，卻足以顯示目前的「通過」未驗證預覽／放手一致性。
- 影響：製作指南要求兩種抓手均留下 owner/non-owner metrics，以及實際 geometry/snapped focus 的預覽證據；目前記錄不足以支持這一項 package gate。
- 建議：分別保存 `tray:{before,after,preview}` 及 `active:{before,after,preview}`；最後 move 後等待已處理的目前座標，再抓取 main scene／preview／resolved point，核對讀數與吸附位置、手指避讓、release 一致性。兩種 target 都驗證預覽，source 與 ZIP 重跑完整矩陣。保留原有正確的固定 scroll/viewport/iframe 斷言。

## 全範圍審核結果

| 範圍 | 審核結果與證據 |
|---|---|
| 物理模型 | 獨立核對四題全部 16 個位置及連續模型：A/D 為 `y=-x`；B 為 `y=-(5/16)x²`；C 為 `x=(5/16)y²` 的 `y≤0` 分支。共同原點、時間與 x/y 比例一致；B 的 `g=10 m/s²` 近似與忽略阻力已在回饋明示；C 不被稱為自由落體；D 沒有把「兩方向加速」無條件推論成直線。 |
| 等時頻閃與間距 | 0.20 s 等間隔；勻速每段 0.80 m，由靜止勻加速為 0.20/0.60/1.00/1.40 m，增加量 0.40 m。工具量的是相鄰球影距離，橫條共用比例；有限資料使用「符合模型」而非聲稱證明每瞬間加速度。沒有把所有勻加速都說成 1:3:5:7。 |
| 文字與教學 | 繁體中文，操作及分類用字精簡；情境名稱不預洩軌跡，兩球明確是分運動示意；學生折線標為「你的連線」，不偽稱精確光滑軌跡。上述 R2-1 是需修正的不可執行提示。 |
| UI／共享風格 | 使用三區布局、共用樣式與 native HTML/SVG；桌面 stage/panel 分欄，手機上下 bounded shell；header 直接切題、保存各題答案；清除本題有明確範圍及確認。必要圖字原生 CSS 14 px，不隨 SVG camera 縮成小字；手機早期球影較近，局部預覽有必要且沒有生成隱藏正解。 |
| 手機尺寸／捲動 | source/ZIP 各 10 個 viewport 的 bounded、無水平溢出、44 px navigation、提交控制可達檢查通過。檢視 390/320 手機、桌面、比較工具、review、preview 圖片。既有完整 trusted-touch 報告涵蓋 source/ZIP 的 390/320×500 scrollable Moodle-like iframe、stage/兩側各 24 px strip、panel 中段與兩端、四題四時刻兩種抓手、review/frozen/committed 舊 target 區域。host forwarding 是明示的 same-host 策略；R2-2 是紀錄／預覽驗證缺口。 |
| 拖放／鍵盤 | 穩定 HTML 抓手、Pointer capture、僅 target 使用 `touch-action:none`；公開 grid 允許正確及錯誤位置吸附，不做答案磁吸；四時刻可任意順序，僅連接相鄰已答 slot。本次額外使用 Chrome trusted input 確認：輕點 tray 不保存、錯誤交點可保存、圖外放手 rollback、lost capture rollback、第二隻手指 rollback、mid-drag resize rollback、Shift+方向鍵保存 10 mm 精度、native select 可用鍵盤選擇。200% visual viewport 可以 trusted pan；既有 zoom 截圖本身不代表真實手機 zoom 全流程已驗收。 |
| 空白／部分／評分 | 全空 0、全對 100、分類全對 36、位置全對 64；坐標分量、時刻、題目與分類獨立給分。±50 mm 內／外（全部 16 個 slot、兩軸）通過；未答、只觀察、待放球均不給分；重複末點不能代替前面時刻。所有 editable 狀態都可到 check，submit 明確觸發，沒有自動提交。 |
| state／依賴 | `observed` 只限制放點，不限制分類或 final check；四題相互獨立，導航維持原答案；check→edit 的 `returnToCheck` 保存。暫態 pointer/keyboard/animation 不存入權威答案，導航/check 取消未保存工作點。 |
| persistence／合法續作 | 版本、phase/kind、索引、tuple、整數範圍、枚舉、observed→point 依賴明確；錯誤物理答案與 legal null 不被當作壞資料。512 個 production encode/decode/controller restore 與合法續作通過；本次另執行 restore 後改分類／刪點／放點／重新 check/submit 的合法續作，全部成功。最長 draft/review/pending 為 791/818/1061 UTF-8 bytes，低於 4000。 |
| SCORM／信任／鎖定 | 使用 shared loadAttempt/startup、draft provider、submitWithCallbacks/submission，四類 outcomes 均有 handler；沒有活動自寫 LMS欄位/commit/finish/pagehide。finished mismatch/unknown 保持只讀及可信 summary；invalid draft 鎖定；invalid deep pending quarantine；凍結／已提交沒有清除重做。驗證 pending、committed finish retry、無 durable final 的 retry 及 non-retryable lock；最後權威答案亦核對而非僅比較總分。 |
| standalone／Moodle | standalone memory-only，refresh 後 empty initial state；拒絕 browser storage 仍可操作，沒有讀取／遷移／刪除舊 standalone checkpoint。fake-LMS resume 能保持同 attempt；本次另核對 finished-with-draft/pending 舊封套只顯示 Moodle summary、無寫入。真實 Moodle attempt/新 attempt 行為仍未驗。 |
| catalogue／manifest／ZIP | slug、metadata、manifest launch 一致。目錄暫為 planned 與「驗證／審核完成後啟用」一致，最終通過後要更新。ZIP 有根 `imsmanifest.xml`，共 13 檔；所有 declared files 與 source bytes 完全一致，無缺少／多出 development 檔，無 CDN／新增 runtime dependency。 |
| 測試質素 | 五個新增純測試及 browser runner 都登記在 run-tests；邊界評分、部分分、restore continuation、LMS failure/trust、missing-slot 連線是有意義的測試。獨立 smoke 無 runtime errors。R2-2 要補上完整 preview/兩 target 記錄。沒有另跑整個 npm test，避免與主 agent 的全項目回歸重複。 |

## 本次獨立執行命令

- `node sim/motion-composition-stroboscopic-lab/model.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/scoring.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/persistence.test.js`：通過，512 round-trips/continuations。
- `node sim/motion-composition-stroboscopic-lab/lifecycle.test.js`：通過。
- `node sim/motion-composition-stroboscopic-lab/scene.test.js`：通過。
- `node tools/check.js`：通過。
- `git diff --check origin/main...HEAD`：通過。
- `MOTION_ARTIFACT_SUFFIX=review-2 node tools/motion-composition-browser-regression.js --smoke`：通過，Chrome 155.0.8059.12，source 與實際 ZIP 各 10 個 viewport／完整作答、空白／部分、review resume、pending retry、standalone refresh、keyboard、comparison flows，runtime errors 為空。
- 額外隔離 Chrome/CDP 目標驗證：`output/playwright/motion-composition-stroboscopic-lab/review-2/targeted-report.json`；未修改產品程式，測試暫存腳本在 `/private/tmp`。
- ZIP 檔案與 source bytes 獨立比對：13 entries、root manifest、missing/extra 均空、runtime byte parity=true。

## 證據及待完成 gate

本次獨立圖像／smoke：`output/playwright/motion-composition-stroboscopic-lab/review-2/`。既有完整 trusted-touch：`output/playwright/motion-composition-stroboscopic-lab/report.json`（本次所讀初版另保存於 `review-2/initial-full-touch-report.json`）；完整執行有通過的 scroll/state 斷言，但需依 R2-2 補足保留的 metrics 與預覽核對。

R2-1/R2-2 是本機可處理項目，不能在未處理前宣稱所有本機 package gates 完成。真實 Moodle 學生帳戶的 score/status、同 attempt 刷新／離開再入、Moodle 新 attempt policy，以及實體手機 current-window／提供時的 new-window 完整矩陣，均尚未有證據；這些是部署驗收限制，不是本次已重現的產品 bug。此活動定位形成性練習，可信伺服端高風險評分為 N/A。

## 2026-10-01 修正版完整複審（90a09cc）

再次以 `origin/main...90a09cc116a611bd963d6d19ce8edab93a106707` 審核整條 branch 的活動、計劃、目錄、manifest、測試及 browser runner。保留上面的首輪報告；以下是新一輪獨立結論，沒有修改產品或測試。再次覆蓋全部領域，並非只驗原 R2-1/R2-2。

結論：R2-1/R2-2 均已修正；strict enums、零分非法 pending 的 quarantine、正常尺寸多指 ownership、停止播放標籤及數學排版亦已核對。再發現一項 P2 手機缺陷 R2-3，尚未可關閉本機驗收。其餘本次全範圍核對未發現新的可重現問題。

### R2-3 [P2] 短高度兩欄時，觸控預覽覆蓋手指並超出 stage

- 位置：`sim/motion-composition-stroboscopic-lab/main.js:108`–`:110`；觸發布局在 `styles.css:49`–`:56`，stage 裁切設定在 `styles.css:16`。
- 重現：Chrome/CDP，CSS viewport 320×225（本版聲明支援的短 viewport／200% 等價 reflow），新 standalone 按「顯示頻閃圖」，用可信 touch input 將情境 1 的 tray 拖到 `P₁=(0.800,-0.800) m`，最後 move 後停留 200 ms 再讀目前預覽。
- 實際：stage 寬 160、高 138.59375 px，預覽實際大小為 124×137.796875 px；程式仍用固定 `height=132` 篩選位置，而且沒有任何可避指候選時 fallback 到第一個位置。預覽 rect 是 `(28,88.40625)` 到 `(152,226.203125)`；手指在 `(69.88125,135.58438)`，即預覽內。底部也超出 stage／viewport 的 225 px，被 `overflow:hidden` 裁切。
- 證據：`output/playwright/motion-composition-stroboscopic-lab/recheck-2/targeted-report.json` 的 `320x225 trusted-touch preview`，`containsFinger=true`、`inside=false`；同目錄 `short-touch-preview.png`。最終保存位置正確，因此這是觸控精準作圖的預覽／呈現問題，不是物理或評分錯誤。
- 影響：短畫面依賴預覽看清密集方格與球心，現有 overlay 幾乎填滿半欄 stage，反而受手指遮擋。檢查／提交按鈕可達的修正，不能替代此布局的拖放可用性驗收。
- 建議：在窄短 stage 提供確實能避指的預覽位置／呈現，例如暫時浮到同一 shell 內的另一側，保持 pointer-inert、3× 真實場景、工作點一致及退出清理；位置計算應採實際 overlay 尺寸。將 320×225 的兩種抓手與預覽加入 source／ZIP trusted-touch 回歸；沿用 `previewEvidence` 的 geometry、避指、release、owner/non-owner 斷言，避免只驗 short-layout 提交。這一修正不用改物理模型、答案、容差或手機主要字體。

### 全範圍再次核對

| 範圍 | 修正版核對結果 |
|---|---|
| 物理／等時頻閃 | 重新閱讀全部 model、scene、scoring 與 plan；四題公式、16 點、0.20 s、0.80 m／0.20/0.60/1.00/1.40 m、0.40 m 增加量、A/D 直線而速率分布不同、B/C 拋物線分支皆正確。模型唯一修改是呈現 top=34，不改比例與世界坐標。 |
| 文字／圖／符號 | 學生文字維持繁體及精簡；空白／分類先答提交、reference、未觀察題目的只讀提示已正確。參考模式補上分運動球影而不改 observed／submitted answer。selected Xᵢ/Yᵢ 及圖例、回饋／預覽真下標、italic 變量與平方單位均核對；普通手機圖像沒有新遮字問題。 |
| UI／手機／操作 | 普通十個尺寸 source/ZIP 獨立 smoke 通過。320×225 standalone／fluid iframe 的實際 check→submit→reference 通過，16 px 提交文字、44 px 以上按鈕、panel 可捲動，無第三個 document scroller／水平溢出。此尺寸的 **touch preview** 有 R2-3；不能因 submit flow 通過就推論所有操作通過。 |
| 手勢／preview | 讀取修正版四組 full report，各 43 rows，16 row 分別保留 tray/active 的 before/during/after 與 preview，含 cursor 已處理、真實球心／viewBox 3×、讀數、避指、release 同點、cleanup；R2-2 關閉。8 個多指案例、4 種取消、host/兩側 strip/panel 中段與兩端/只讀 pan 的 metrics 齊備。短尺寸的新增獨立 trusted-touch 才重現 R2-3。 |
| 真實 blur／visibility | 額外以 `Page.bringToFront` 切到另一個 Chrome 分頁，非 DOM dispatch。觀察到 `blur` 與 `visibilitychange` 均 `isTrusted=true`、hidden=true：工作點取消、preview 隱藏、最近保存答案不變。播放時實際隱藏分頁後，標籤恢復「播放分運動」。診斷首次向 background CDP target 送 touchEnd 曾 timeout；改為恢復前景後結束序列，完整診斷通過，此為 driver 操作限制而非產品失敗。 |
| 鍵盤／吸附 | 重讀處理流程並經獨立 smoke 驗方向鍵、Enter、Escape、Shift 微調、先分類後放點；44 px 穩定 HTML target 與公開 grid 策略保留。只計明確放手／確認的 final work；無答案磁吸，取消保持原點。 |
| 評分／check／依賴 | 再跑全部 scoring/model tests：0/100、36/64、坐標分量部分分、±50 mm 所有邊界、重複末點與未觀察零分通過。任何 editable phase 可直接 check/submit；四題、類型、軌跡獨立，observed 只限制放點；return-to-check 原答案保留。 |
| persistence／無效狀態 | 再跑 512 production round-trips 及合法續作，score/passed 等價、版本／phase／tuple／索引／範圍／依賴 fail closed；791/818/1061 bytes。新增非字串 motions/trajectory（含 arrays/objects/boolean/number）在 draft/review 拒絕；score-zero 非法 pending quarantine 及 pagehide 不寫入通過。合法錯答、null、未訪問仍保留。 |
| SCORM／trust／鎖定 | 重讀 Controller 與 shared API 接合：四 startup/submission outcomes、retryable/非 retryable、commit 後 finish retry、canonical final answer 比對、mismatch/unknown summary、invalid draft lock、pending quarantine 皆符合。純 lifecycle tests 再通過，browser fake-LMS pending/review resume 與 invalid draft render 通過。Standalone memory-only refresh 和 storage-denied 操作通過；只讀／pending 沒有清除重做。 |
| catalogue／package／測試 | 目錄已 active，slug／題名／描述一致；manifest root、13 entries、全部 runtime assets 與最新 source **逐 byte 相等**，extra/missing 均空，無 CDN／測試檔。新 tests 均在 run-tests；shared／其他活動沒有變更。主 agent 全 repo 初版 npm test 的 log 收尾為 shared SCORM/activity-flow passed；按任務要求沒有再次重複全 repo suite。修正版本活動全部純測試與獨立 smoke 已實跑。 |

### 本輪實際命令與證據

- 五個 `node sim/motion-composition-stroboscopic-lab/{model,scoring,persistence,lifecycle,scene}.test.js`：各退出碼 0。
- `MOTION_ARTIFACT_SUFFIX=recheck-2 node tools/motion-composition-browser-regression.js --smoke`：退出碼 0；source/ZIP 各十種普通布局、全面 flow 及 320×225 standalone/iframe check-submit-reference，`errors=[]`。
- `node tools/check.js`：退出碼 0。
- `git diff --check origin/main...HEAD`：退出碼 0（append 本記錄前執行）。
- 最新 ZIP/source 獨立比對：entryCount=13、rootManifest=true、extra=[]、missing=[]、byteParity=true、catalogue status=active。
- 額外 Chrome/CDP 短尺寸／真實 tab blur/visibility：`recheck-2/targeted-report.json`、`short-touch-preview.png`；其中 R2-3 是可重現失敗，blur/visibility 和只讀提示檢查通過。
- 讀取並保留目前完整 `report.json` 的 43-row×4 組證據；其普通手機 preview 已符合 R2-2，而短 reflow 的 touch matrix 仍要補。

尚未解決：R2-3。實體手機與真實 Moodle 的學生 score/status、same-attempt resume/pending/review、新 attempt policy，以及 current-window/提供時的 new-window 全手勢矩陣仍未有部署證據，繼續與本機問題分開列示。本版形成性定位與服務端高風險評分 N/A 不變。

## 2026-10-01 第三輪完整獨立複審（850eae6）

審核 `origin/main...850eae68c1b5232346699cf41ce0dbd36d51bcf5` 的完整活動、計劃、catalogue、manifest、package 及測試；完成前沒有讀取其他人的第三輪報告。本輪僅追加自己的報告與獨立驗證 artifacts，沒有修改產品／正式測試。結論：R2-1、R2-2、R2-3 均已關閉，沒有新可重現 runtime 缺陷；尚有一項 P3 計劃文件一致性修正 R2-4。

### R2-4 [P3，文檔] 計劃仍混有舊的圖上標籤及 radio 描述

- 位置：`plans/25-motion-composition-stroboscopic-lab.md:133`、`:185`。
- `:133` 仍稱圖域≥145px會在選中球影旁標 Xᵢ／Yᵢ，與同計劃 `:164` 及 production `scene.js:26`–`:30` 的最新粗圈＋真下標圖例決定不符。`main.js:78`–`:79` 實際在 stage 頂列圖例標時刻。
- `:185` 稱分類控件為 radio 並描述 radio 方向鍵，但 production `index.html:29`、`:34` 的三個分類控件均為 native select；比較／微調開關則為 checkbox。
- 影響／建議：這是設計與驗收文件的可重現描述矛盾，沒有造成操作故障。將兩句更新為現行粗圈、圖例／時刻選擇，以及 button／select／checkbox 的原生鍵盤操作；保留短畫面收起頂列的說明。毋須改 runtime。

### 原問題 closure 與完整範圍

| 範圍 | 本輪獨立核對結果 |
|---|---|
| R2-1／只讀提示 | `main.js:80` 先判 frozen/reference/只讀，再判 editable 未觀察。Source／ZIP 的空白、分類先答、未觀察題目 review/reference 回歸通過，沒有不可執行的頻閃提示。 |
| R2-2／證據完整性 | Runner `:72`–`:90` 的 previewEvidence 與 `:171`–`:194` 的 shortTouch 分開保留 tray／active 的 before/during/after，核對真正場景、resolved focus、讀數、3×、避指與 release。完整普通矩陣四組各43 rows 的紀錄亦已讀取，不再覆寫 tray 指標。 |
| R2-3／短畫面 preview | `main.js:106`–`:121` 先 render 再量 actual overlay／lens，preview 為 shell 內 pointer-inert sibling。320×225 的 t₁ preview rect 為 `(194,85.203125)` 至 `(318,223)`，完整位於320×225 shell，離開原本160px stage及手指；actual lens122×70、viewBox40⅔×23⅓，精確3×。本輪獨立 trusted touch 在 source／ZIP、standalone／fluid iframe 各四題四時刻的兩種抓手通過；128次正常拖放、8次公開錯格拖放、16次touchCancel皆通過。另以獨立 Python 重算全部136個正常／錯格預覽的 shell bounds、focus、精確3×、16px避指與 owner/non-owner 指標，全相符。普通 preview仍留在stage。 |
| 物理／教學／繁體文字 | 重讀完整 model/scoring/scene/plan：0.20s共同時刻、等比例坐標、全部16點正確；A/D為`y=-x`但速度分布不同，B為`y=-(5/16)x²`，C為`x=(5/16)y²`的`y≤0`分支。由靜止加速的間距0.20/0.60/1.00/1.40m與0.40m增加量正確；有限資料只說符合模型，沒有當作連續加速度的證明。B的g近似／無阻力、C的水平加速及D直線條件都說明清楚。繁體操作及回饋精簡，未答仍為null，提交前不洩露正解。 |
| 圖／符號／UI標準 | 三區有界布局、shared樣式／runtime、native HTML/SVG、44px抓手、16px主控件、14px必要圖字保持。Xᵢ／Yᵢ圖例與粗圈替代密集軸旁重複字，Pᵢ近y軸名時下移且留plot內。獨立source／ZIP十個普通viewport、C/D所有選中時刻及reference、短畫面的文字bbox回歸通過；查看新的手機、參考圖及短畫面preview截圖，沒有新的標籤相撞。上述R2-4只涉及plan舊句。 |
| 手機／手勢／鍵盤 | 本輪完整短trusted-touch覆蓋四題四時刻、tray／active、正確／錯誤位置、iframe及取消；doc/panel/stage/activity visual viewport/host/selection皆固定，放手只改指定slot，取消恢復原答案並清preview。另讀最新完整普通390/320 source／ZIP各43rows的stage／左右24pxstrip／panel中段與兩端、review/frozen/committed及多指／各種打斷證據。公開grid無正解磁吸；兩條scroll strip可用，沒有第三個scroller。Keyboard／Shift微調／Enter保存／Escape取消、200%等價reflow的check-submit-reference及播放resize重播皆由本輪smoke再通過。90a09cc時以另一真實Chrome分頁觸發的trusted blur/visibility取消證據仍有效，850eae6未改該處理，沒有將DOM dispatch當作本輪新增驗證。 |
| 評分／blank-partial／phase依賴 | 全空0、全對100、分類36／坐標64、兩分量各2分、分類各3分、±50mm所有邊界及重複末點16分再通過。任意editable可check及明確submit，包括未訪問／未觀察／只答分類／錯答／部分答案；只observed限制放點。導航保持四題，returnToCheck保留原作答；取消未保存工作點後才check／submit。 |
| Production persistence／合法續作 | 重讀exact schema、strict enums、kind/phase、索引、mm tuple範圍及observed依賴。再執行512組production encode/decode/controller restore＋legal continuation；每種合法blank/partial/complete、return/check/review/pending等價通過，非法枚舉／依賴／tuple另測fail closed，合法錯答不被拒絕。draft/review/pending最長791/818/1061 UTF-8 bytes，低於4000。暫態pointer／keyboard／animation不寫入權威快照。 |
| SCORM／trust／refresh | Controller維持shared loadAttempt/startup與submitWithCallbacks；success/committed/frozen/retry、finish retry、draft-save retry、非retryable lock、canonical final answer與rescore比對、unknown/mismatch只讀summary、invalid draft與deep invalid pending quarantine均重讀並再測通過。非法zero-score pending亦不寫回；pending固定同payload，review/committed無重做／清結果。沒有活動自寫raw LMS欄位或commit/finish/page-lifecycle。Standalone memory-only刷新全新、拒絕storage仍可用；fake-LMS same-attempt resume保留答案；未確認技術結果不假稱成功。 |
| Catalogue／manifest／ZIP／tests | Catalogue active、slug/title/description/launch相符；root manifest、13 entries無缺／多檔，逐byte相等目前source及config，無外部runtime dependency／development檔。全部五pure suites及browser runner有登記，測試涵蓋獨立分量、邊界、null與錯答、restore續作、trust/failure locks、實際preview/ownership及label collision，有意義而非僅重述實作。Shared／其他活動未變。 |

### 本輪實際驗證及限制

- 五個 `node sim/motion-composition-stroboscopic-lab/{model,scoring,persistence,lifecycle,scene}.test.js`：分別執行，全部退出0，含512組round-trips/continuations。
- `MOTION_ARTIFACT_SUFFIX=final-recheck-2 node tools/motion-composition-browser-regression.js --smoke`：退出0，Chrome155.0.8059.12，source／實際ZIP各10普通viewport、全部10項flow、2項短reflow提交／參考flow、36 rows短trusted-touch；`errors=[]`。本輪smoke沒有另跑普通43-row×4矩陣，該最新完整矩陣已逐項讀取與核對。
- `node tools/check.js`、`git diff --check origin/main...HEAD`：退出0。另執行manifest／13個ZIP entries與現行source逐byte獨立比對：rootManifest=true、missing/extra=[]、byteParity=true、catalogue=active。
- 新獨立圖像及報告：`output/playwright/motion-composition-stroboscopic-lab/final-recheck-2/smoke-report.json`；同目錄保留所讀850eae6完整report副本。獨立Python再算本輪與完整report各136個短preview：全部geometry／3×／避指／owner相符。
- 初版1c18152的whole-repo `npm test` 已由root執行退出0，log為`output/motion-composition-repo-tests.log`，本次讀其末尾shared SCORM/activity-flow通過證據。850eae6受影響的本活動五pure suites及完整短／普通layout-flow回歸已重新實跑；shared／其他活動未改，按任務要求沒有重跑whole-repo suite，也沒有將初版全庫結果說成最終全庫重跑。

本機runtime findings全數關閉；剩餘R2-4是plan文字一致性。真實Moodle學生score/status、同attempt刷新／離開再入及新attempt政策、pending/review真實續作，以及實體手機current-window／提供時new-window的完整手勢矩陣仍未有部署證據，屬另列Moodle-ready gate，不能由Chrome/CDP或fake LMS通過推論已完成。形成性用途維持，trusted-server高風險判分為N/A。

## 2026-10-01 R2-4 文檔修正確認

已直接重讀計劃 `:133`、`:185` 並核對 production：選定分運動以粗圈、真下標Xᵢ／Yᵢ圖例及面板時刻識別，所有圖域均無軸旁重複字；極短viewport收起頂列的說明與 `scene.js:26`–`:30`、`main.js:78`–`:79`、`styles.css:53` 一致。控件表已改為button／select／checkbox及原生選單鍵盤操作，44px button／select及checkbox label熱區亦與 `index.html:28`–`:34` 和既有CSS／驗證相符。

R2-4 **關閉**，本 reviewer 全部可重現 findings 均已解決。`git diff --name-only 850eae6 -- sim/motion-composition-stroboscopic-lab tools/motion-composition-browser-regression.js sim/config.js sim/manifests/motion-composition-stroboscopic-lab.xml` 為空；本次只有文檔核對，沒有重跑runtime或whole-repo測試，850eae6完整複審及ZIP證據仍適用。真實Moodle／實體手機部署gate仍按上一節另列。
