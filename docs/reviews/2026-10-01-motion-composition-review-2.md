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
