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
