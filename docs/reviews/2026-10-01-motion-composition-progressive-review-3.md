# 漸進頻閃修訂：第三位完整獨立審核

日期：2026-10-01。目前完整複審候選：`8a8095d877ac76a5a7ed1402efbe24f845c817a9`，分支 `codex/motion-composition-stroboscopic-plan`；完整比較基準為 `origin/main`／`0bb873c`。最新證據及 closure 在文末；前段保留舊候選紀錄。

**最新獨立結論：8a8095d 整條 branch 再審沒有新 findings；重新執行六套活動 Node tests、check、base diff check、source／actual ZIP smoke 及 14-entry byte parity 全部通過。直接查看新候選圖片並重算全部原生資料後，PF06 關閉；PF01–05 的修正仍有效。Root 同候選完整 touch 矩陣亦已完成，原始資料已獨立核對作補證。真實 Moodle／實體手機仍未驗。**

**歷史 d89d44c：當時的零 findings 未涵蓋其後由 Root 重現的 PF06（320×300 caption 裁切）。本審核者已確認 Root 的八筆原始 native 反例及舊圖；原先的成功矩陣沒有該高度，不能推翻反例。下面保留當時執行紀錄，新 closure 見文末。**

**歷史 d89d44c 當時結論：d89d44c 整條 branch 再審沒有新 findings；六套活動 Node tests、check、base diff check、全新 source／actual ZIP smoke 與 14-entry byte parity 通過。PF05（原 R1-04）的字形遮擋已經本審核者直接用新候選的 native records／實際圖片再驗並關閉。Root 的同候選完整 touch 矩陣已 exit 0，本審核者已直接核對其原始資料作補證；真實 Moodle／實體手機仍未驗。**

**歷史 c32c470 結論：當時仍有一項 Open P2：R1-04 短版面 readonly reference 的選中 P 標籤被後續球覆蓋。此反例由第一位審核者提出，本審核者已查看其 source／ZIP 原始圖片及原生 bounds、核對繪圖順序並確認；不能以自己的 smoke 通過或先前零 findings 推翻。下文保留當時 Open verdict，不代表 d89d44c 尚未修正。**

**歷史紀錄：以下 d24b791 審核沒有識別出後來由其他審核者重現的 PF01／PF02 視覺遮擋及 PF03 Scope 漏列 animation。原有零 findings 不代表這三項問題不存在，亦不能作修正候選的驗收證據。最新完整複審及 closure 追加於文末。**

當時結論：本輪獨立審核未列出 findings。指定六個活動測試及獨立 source／actual ZIP smoke 均通過；已直接查看畫面，並在 Root 的完整矩陣完成後核對其原始手勢／preview 資料。真實 Moodle 與實體手機驗收尚未執行，仍是外部部署 gate。

## 範圍與獨立性

- 先閱讀 `AGENTS.md`、`plans/00-shared-platform-and-style.md`、`docs/simulation-scorm-production-guide.md`、`plans/25-motion-composition-stroboscopic-lab.md`。
- 審查整條 branch 相對基準的全部活動程式、測試、計劃、catalogue、manifest、`package.json`、test runner 與 browser runner；沒有只看新增行，也沒有分拆領域。
- 直接閱讀活動所有 runtime 檔案與六個 `.test.js`，另核對共享 `SimScorm`／`SimActivityFlow` 介面及實際 failure／trust 行為。
- 沒有讀取同輪另外兩位審核者或第四位的報告；Root 的 browser regression 原始資料是測試證據，不作他人的審核結論。
- 未修改 runtime、tests、shared 或任何其他追蹤檔案；未 commit，未執行 whole-repo `npm test` 或 `package:all`。本報告是本輪唯一新增的審核文件。

## 獨立執行與實際產物

| 檢查 | 實際執行／結果 |
|---|---|
| 六個活動測試 | `for test_file in sim/motion-composition-stroboscopic-lab/*.test.js; do node "$test_file" \|\| exit; done`，exit 0；animation、lifecycle、model、persistence、scene、scoring 全部通過 |
| 指定獨立瀏覽器 smoke | `MOTION_ARTIFACT_SUFFIX=progressive-review-3 node tools/motion-composition-browser-regression.js --smoke`，使用獲准的本機 Chrome／localhost，exit 0 |
| 瀏覽器引擎 | `Chrome/155.0.8059.27`，CDP trusted touch；source／actual extracted SCORM 各 10 個通常 viewport、兩種 320×225 拓撲、36 個 short gesture rows；`errors=[]` |
| 額外權威答案／恢復檢查 | 一次性 Node 執行 192 個案例：四情境 × 三項分類的全部 8 種 null／非 null 組合 × 無位置／只有 x 正確的部分位置 × draft／review／pending；重算同分、執行合法續作、pending retry 與只讀導航均通過 |
| branch 空白檢查 | `git diff --check 0bb873c...d24b791d584b290db066b279b9f67b97f1f45301`，exit 0 |
| 實際 ZIP | `output/motion-composition-stroboscopic-lab-scorm.zip` 根部有 `imsmanifest.xml`；全部 14 個 entries 與 manifest 清單完全一致，逐 byte 與目前源碼相同，沒有 mismatch |
| 候選穩定性 | 開始及獨立驗證完成時 `git rev-parse HEAD` 均為 `d24b791d584b290db066b279b9f67b97f1f45301`；審核前 working tree 為乾淨 |

獨立 smoke 的完整資料：[smoke-report.json](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/smoke-report.json)。smoke 本身使用 production packager 重建、解壓及 serve actual ZIP；不是把源碼頁的通過結果套用到套件。

Root 已完成的最終完整矩陣：[report.json](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final/report.json)。直接核對其 source／package × 390／320 四組各 43 rows、兩路各 36 short rows、曝光與流程資料及 `errors=[]`；本報告沒有在矩陣完成前宣稱通過。

另從該 report 重新遍歷 **280 個實際 preview records**（正常 144、短版面 136），獨立重新計算吸附焦點、主圖／preview 球心、viewBox 中心、實際橫／豎 3× 比例、全框在 shell 內、16px 避指及 pointer-inert。全部通過；正常 preview 留在 stage，短兩欄 preview 使用可見的另一側 shell。

## 學科模型、文字與評分

核對 `model.js:7–34` 與計劃的四情境參數、世界坐標、共同時間及全部 16 個參考位置：

| 情境 | 水平／垂直模型 | 四個合運動位置，單位 m | 參考軌跡 |
|---|---|---|---|
| A | 勻速／勻速 | (0.8, −0.8)、(1.6, −1.6)、(2.4, −2.4)、(3.2, −3.2) | `y = −x`，直線 |
| B | 勻速／由靜止向下勻加速 | (0.8, −0.2)、(1.6, −0.8)、(2.4, −1.8)、(3.2, −3.2) | `y = −(5/16)x²`，平拋拋物線 |
| C | 由靜止向右勻加速／勻速 | (0.2, −0.8)、(0.8, −1.6)、(1.8, −2.4)、(3.2, −3.2) | `x = (5/16)y²`，`y ≤ 0` 分支 |
| D | 兩方向均由靜止勻加速 | (0.2, −0.2)、(0.8, −0.8)、(1.8, −1.8)、(3.2, −3.2) | `y = −x`，直線但球影間距增加 |

- 時刻為 0.20／0.40／0.60／0.80 s，兩方向同步。y 向上為正；向下模型保留負坐標，SVG 僅在畫面映射反向。
- 勻速相鄰位移大小為 0.80／0.80／0.80／0.80 m；由靜止勻加速為 0.20／0.60／1.00／1.40 m，相鄰增加量為 0.40 m。比較工具使用共同長度比例，沒有混用從 O 算起的總位移。
- learner copy 使用「模型符合」及「各段平均速率」的推論措辭，未把有限頻閃點宣稱為每一瞬間加速度的證明。B 說明 g = 10 m/s² 與忽略空氣阻力；C 不把水平加速稱為自由落體；D 的直線結論限制在本題固定、由靜止開始的模型。
- `scene.js:38–55` 只連相鄰且已存在的學生時間點，不跨未答時刻、不以分類答案替換學生連線。參考連續模型只在可信提交後顯示。
- `scoring.js:7–19` 每個 x／y 分量各 2 分、兩方向類型各 3 分、軌跡 3 分，每題 25、四題 100；達標門檻 60。位置、分類、不同題及時刻獨立保留部分分。
- 全空 0、全部類型 36、全部位置 64、全對 100 均實跑；每題／時刻／方向的 ±49／50／51 mm 邊界、錯 slot、重疊、只觀察但未答亦有直接測試。吸附 CSSpx 與評分 ±50 mm 沒有混用。
- learner-facing copy 為精簡繁體中文；t、x、y 與下標、單位、正負號在圖、面板、preview／feedback 一致，無 raw LaTeX。

## 漸進曝光、四球與實際畫面

核對 `animation.js:7–34`、`main.js:13–25,77–103,106–120,139–168` 及 `scene.js:10–37`：

- 模型 0.80 s 用 3.20 s 呈現，¼ 速連續更新移動球；每跨過模型 0.20 s 才取固定模型時刻留下兩個投影球影，不是把當前 frame 的位置當曝光位置。
- 正常與 reduced-motion 路徑均實際出現 0→1→2→3→4 次曝光；reduced-motion 依相同 800ms 節奏逐格呈現，沒有一次放出全部球影。
- 拍攝中 `observed=false`、四點仍 null、四個 tray 隱藏。第四次曝光完成後才保存 `observed=true`，立即同時提供四個獨立 44×44px t₁–t₄ 球入口。
- 任意非目前時刻的球可直接拖入，毋須先按時間。抓取時只暫態選時刻，合法放手才保存該 slot／activeTime；取消回復原有選擇與答案。
- 球使用局部徑向漸層與高光；兩個移動球、歷史球影、四個待放球及學生球的中心仍精確對齊模型坐標。畫面能辨認為球體，沒有用純色圓點代替新球外觀。
- 未完成拍攝離頁／切題後不杜撰觀察完成，Moodle 恢復可重新拍攝及合法放點；取消／舊 frame 不會完成其他題。重播保留已保存答案。

已用 image viewer 實際查看以下獨立產物，包含 source 與 package，而不是只讀 screenshot 檔名或測試名稱：

- [source 首次曝光前](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-capture-0.png)、[第二次曝光](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-capture-2.png)、[第四次曝光及四球](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-capture-4.png)。
- [package 第二次曝光](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/package-capture-2.png)、[完成後四球](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/package-capture-4.png)。
- [390px 情境 C](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-390-case-2.png)、[390px 情境 D](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-390-case-3.png)、[1280px 情境 B](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-1280-case-1.png)。
- [source 短版面 preview](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-short-standalone-preview-1.png)、[package 短 iframe preview](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/package-short-iframe-preview-3.png)、[短 iframe 最終提交控制](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/source-zoom-reflow-iframe-check.png)。
- [package 提交後參考軌跡](../../output/playwright/motion-composition-stroboscopic-lab/progressive-review-3/package-390-reference-2.png)。

## 布局、手勢與操作替代

- 使用 shared styles 與 header／stage／panel 三區；phone 直排，desktop 側欄，極短 CSS viewport 兩欄 reflow。panel 有獨立捲動範圍，activity document 沒有第三個垂直 owner／水平溢出。
- 正常及 compact 停泊區四球互不遮蓋，均有 44px 熱區；圖域和球入口沒有占據左右各 24px scroll strip。極短圖域收起 active target，以四球及面板替代修改，沒有以重疊熱區勉強提供入口。
- 完整證據涵蓋四情境／四時刻的 tray 和 active target、空白 stage、左右 strips、panel 中段與上下邊界及 review／frozen／committed 舊 target 區域；每列記錄 host／iframe、activity document、兩方 visual viewport、stage、panel、selection、完整權威答案。
- gestures 是 Chrome/CDP browser-level trusted touch，有 touch pointer／trusted、move／up／cancel 診斷；drag 的非 owner 固定，stage／strip 只捲 enclosing host，panel 只捲自己並保護邊界。
- 多指取消保留 owner 到全部 touch 結束，之後同頁仍可正常 host pan；pointercancel、lost capture、圖外放手、resize 取消工作值，保留最近已保存答案。
- 主圖、3× preview 與 release 使用同一 post-snap 世界坐標；錯誤的公開格點也可保存。overlay 不截取 input，完整可見並避指，結束／取消／導航／鎖定時清除。
- Tab／方向鍵／Shift 微調／Enter／Escape，以及面板開始、方向按鈕、確認、取消是實際 production handlers。非目前球 keyboard 操作先保存其時刻導航，面板命令不會誤改原先時刻；未確認工作點不計分。
- 通常 phone、landscape、短 iframe、320×225 CSS reflow 的最終控制可到達。visual scale 與 CSS reflow 的本機證據已區分；沒有把桌面截圖當真實手機驗收。

## 作答、快照與 SCORM

- 所有 edit 變體，包括未觀察、未訪問、只有分類、部分位置、由 check 返回，均可進 check；check 列已答／未答且允許提交空白／部分，只有明確 submit 建立 final。最後時刻／最後一題沒有自動提交。
- `persistence.js:11–25` 嚴格驗證版本、必要欄位、四情境／固定時間 tuple、毫米整數界限、enum、observed→points、kind→phase 及 returnToCheck。合法錯答、重疊、未觀察先答分類與未答狀態不會被當損壞。
- 512 次既有 production encode／decode／restore 皆重算同 score／passed 並執行合法下一步；另以 192 案例覆蓋分類組合及部分坐標的 draft／review／pending。最大 draft／review／pending 為 791／818／1061 UTF-8 bytes，低於 4000。
- 保存只在語義變更後進行；draft provider 永遠提供最新權威答案。Pointer、工作點、動畫曝光進度、preview、DOM 與比對工具是暫態，不混進 final snapshot。
- `ui-runtime.js:25–62,76–106` 使用 `loadAttempt()`＋`startup()` 與 `submitWithCallbacks()`＋`submission()`；startup 四 outcomes、submission 四 outcomes、retryable 兩類、committed finish retry、review mismatch／unknown status 皆由 production controller 與 shared fake-LMS 實跑。
- 深層 invalid pending 先 quarantine，不可透過 retry／BFCache pagehide 寫入；可信 final 比較分數、passed 與 canonical 權威答案，不能用同總分掩飾不同答案。
- frozen 成績未確認，不顯示可信分數／正解；committed 顯示成績已記錄、完成程序待重試。invalid／mismatch finished 只讀顯示可確認的 Moodle 摘要，未知 status 不冒稱未通過。
- submitted／pending 沒有 learner clear-results／restart 路徑；review 導航不改權威 payload。Standalone 使用 memory-only，partial／check／submitted refresh 回到空白；舊 storage 與 denied storage 不被讀寫、不鎖住 startup。Moodle-like 同 attempt 保留 draft、review、pending；不以新練習覆寫損壞資料。
- SCORM 是共享 reporting 層，活動沒有 raw LMS read/write、commit／finish／page-lifecycle 重複實作；形成性風險、可信服務端評分不在本版範圍的決策已記錄，learner bundle 沒有 secret／CDN dependency。

## Catalogue、manifest 與測試品質

- `sim/config.js:2–9` metadata 完整且 slug 與活動／manifest 相符；`active` 對應實際可啟動的活動。
- `index.html:6–8` 的全部 runtime JS／CSS 都在 manifest；新增 `animation.js` 已包含。根 manifest 與 config、三個 shared 檔案、全部 activity runtime 共 14 entries 已逐 byte 核對 actual ZIP。
- `tools/run-tests.js:9–15` 列入六個新測試及 focused browser runner；`package.json` 提供獨立 browser 指令。
- 測試核對實際模型數值、完整 rubric 邊界、production decoder／controller／shared lifecycle、合法續作與非法狀態；browser runner 對 source／actual package 使用相同 UI，記錄並斷言每個 owner／非 owner、逐次曝光、四球入口與 preview 真實幾何。沒有用 source 字串或 programmatic scroll 代替驗收手勢。

## Findings 與後續 gate

**無新 findings，沒有 runtime／test／包裝修正或 targeted 再驗條件。** 本輪審核沒有把假想風險或可選的文案偏好列為缺陷。

下列外部 gate 仍未通過；不能以本機 fake-LMS 或手機 emulation 代替：

- 真實 Moodle 學生 attempt 的空白／部分分數與 status、draft／pending／review 同 attempt 恢復、明確新 attempt、完成 attempt 不可重做，以及 teacher attempt policy。
- 實體手機在 current-window 及可用的 new-window Moodle player 的全部 gesture owners、四球直接拖入、preview／snap、左右 strips、最後控制、工具列及原生裝置 zoom。

本報告可交第四位 agent 彙總。整個 branch 的 repo gates 與最終文件完成紀錄由 Root 一併整合；本輪沒有重跑或聲稱重跑 whole-repo `npm test`／`package:all`。

## 2026-10-01 固定候選 951524c 的完整再審紀錄

歷史候選：`951524c36a4f78d1d1623756936c61fdba90f927`；基準仍為 `0bb873c`。本段未給出 final acceptance，因重審中獨立核對出下列 browser test coverage gap；後續固定修正測試的新候選與重跑結果見文末。

- 再次獨立執行六個 activity `.test.js`，全部 exit 0；512 round-trips／合法續作與 791／818／1061 bytes 仍通過。
- 獨立執行 `npm run check`，exit 0；JavaScript 及 SimLab SCORM 1.2 manifest profile checks 通過。
- 獨立執行 `git diff --check 0bb873c...951524c36a4f78d1d1623756936c61fdba90f927`，exit 0。
- 已重讀 model、scene、main、scoring、persistence、ui-runtime、animation、HTML／CSS、計劃修訂、manifest／catalogue 與 browser runner；共享 baseline／production contracts 及其餘未改 runtime 亦已與前候選核對。完整 branch 審核範圍維持物理、文字、UI／全部 gesture owners、partial credit、snap／preview、keyboard、schema、trust／refresh 與包裝，沒有只看 PF01–03。
- `MOTION_ARTIFACT_SUFFIX=progressive-recheck-3 node tools/motion-composition-browser-regression.js --smoke` 已獨立啟動並重建 actual ZIP；source layout／flows／short 完成後，在 package layout／flows 階段按 Root 提醒中止，**exit 130，不能記為完整 smoke 通過**。
- 直接查看此候選 source 的 `source-320x500-parking.png`、`source-390x500-parking.png`、`source-short-standalone-capture-readability.png`、`source-short-iframe-reference-readability.png`。新版 y／O 軸名可辨，normal 首球抓手在圖例之下；仍須以修正後完整矩陣關閉問題。

### R2-01 · [P2] readonly reference 四時刻迴圈實際點擊隱藏控制

位置：該候選 `tools/motion-composition-browser-regression.js:58–69,204`；依賴 `sim/motion-composition-stroboscopic-lab/main.js:38` 與 `index.html:30–38`。

此缺口由另一位審核者先發現，Root 傳達後本審核者獨立逐行核對並同意；未讀取其報告，也沒有把 discovery 歸為自己的首次發現。

- **重現：**提交進入 review，再切換參考作圖；runner 在四時刻迴圈 trusted-click `[data-time="1"]` 至 `[data-time="4"]`。
- **Expected：**每次實際選擇所需 readonly review 時刻，並記錄／驗證不同 `selection.time` 及對應球影、點標籤；所有四時刻都要有獨立 reference readability 證據。
- **Actual：**review 的 `editPanel` 被 `hidden`，`timeNav` 在該 panel 內，DOM 元素仍存在但無可見 box。`rect()` 只檢查 query 結果，沒有拒絕 `getClientRects().length=0`／width=height=0；trusted click 的坐標落在 (0,0)，未觸發時間按鈕。迴圈沒有 assertion 核對 selection，因此重複檢查原先 t₁。
- **影響：**`13 viewports × 四 reference 時刻` 的聲稱不成立。這是回歸測試的 acceptance coverage gap，不是已證明的 production 時刻資料錯誤；其餘已執行的 Node／check／diff 結果不受影響。
- **修正：**在 `rect()`／`click()` 拒絕隱藏或零面積 target；readonly 各時刻使用合法 `finishedData(activeCase, activeTime)` fixture 恢復，不操作隱藏 edit control，並明確 assertion selection 與所需時刻相同。
- **再驗條件：**固定新候選後重新獨立跑 smoke，source／actual ZIP 各 reference row 的四時刻 selection 必須確實 1／2／3／4；保留 native bounds、播放起點／首曝光、完整 owner／preview 矩陣與 14-entry parity。不能把 951524c 的舊 screenshot 或重複 t₁ 迴圈作 closure。

PF01／PF02／PF03 暫不在此段作正式 closed verdict；修正後的完整本機證據與外部未驗 gates 會在下一固定候選追加。

## 2026-10-01 固定候選 c32c470 的完整再審

候選：`c32c470edfa17226ea5fe4d894c257d6940fd70b`；基準仍為 `0bb873c`。本次重新核對整條 branch，涵蓋四情境模型與有限頻閃推論、繁體文案、全部 UI／gesture owners、keyboard／面板替代、分量部分分、blank／partial／check／明確提交、schema／phase／合法續作、SCORM trust／不可變 pending retry／只讀／Standalone refresh、catalogue／manifest／actual ZIP 及測試品質。沒有按領域分工，也沒有只驗前三個視覺問題。

`git diff 951524c...c32c470 -- sim` 為空；production 與六個活動測試完全相同 bytes。本次新候選只修 browser 驗證與 plan 的 reference 覆蓋說明，故明確沿用本審核者在 951524c **實際重新執行**六個純測試的 exit 0 證據，不冒稱另跑一次。先前額外 192 個權威答案／合法續作檢查所用相關 production 檔案同樣未變。

| 獨立檢查 | 命令／結果 |
|---|---|
| HEAD／production 穩定性 | `git rev-parse HEAD` 為完整 c32c470 SHA；951524c→c32c470 的 sim diff 為空 |
| static／manifest | `npm run check`，exit 0 |
| 完整 branch 空白檢查 | `git diff --check 0bb873c...c32c470edfa17226ea5fe4d894c257d6940fd70b`，exit 0 |
| source／actual rebuilt ZIP smoke | `MOTION_ARTIFACT_SUFFIX=progressive-final-recheck-3 node tools/motion-composition-browser-regression.js --smoke`，本機 Chrome／localhost，完整 exit 0；`errors=[]` |
| 13 viewport 的實際選擇 | source／package 各 416 diagrams，合計 832 個 case／time／reference 選擇；edit 與 readonly 每個 viewport 都確實遍歷四題 × t₁–t₄ |
| 原生圖面 bounds 再計算 | 從自己的原始 report 遞迴取 1114 組 native readability，重新計算 axis／sphere 含描邊、全部 SVG／HTML 文字對 rack 全框與球／時刻內容的交集及 stage clipping；全部通過 |
| 播放與逐次曝光 | 兩路各 40 capture／reference 播放 rows，含各題起點／首曝光、320×225 兩拓撲；另各 5 組 observation 的 stamps 0→1→2→3→4 與 observed false→false→false→false→true 通過 |
| 短版面 trusted touch／preview | 兩路各 36 short rows；自行重新計算合計 136 preview 的球心／viewBox 焦點、實際 3×、完整 shell 邊界、16px 避指及 pointer-inert，全部通過 |
| 流程與替代操作 | 兩路 mouse 100 分、任意次序直接拖球、blank／partial、review resume、pending retry、Standalone refresh、keyboard、非目前球 keyboard／面板命令、comparison、readonly hint、invalid enum 與 resize／replay 均通過；兩路各兩組 CSS reflow／最後控制通過 |
| actual ZIP／manifest parity | production packager 重建的 ZIP launch 為 `motion-composition-stroboscopic-lab/index.html`；根 manifest、14 entries 與 manifest 完全一致，逐 byte source parity；11 個 HTML runtime JS／CSS 引用全部存在，undeclared／mismatch 均空 |

獨立執行原始資料：[progressive-final-recheck-3/smoke-report.json](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/smoke-report.json)。引擎為 `Chrome/155.0.8059.27`。所有新 reference fixtures 都經 production restore；runner `tools/motion-composition-browser-regression.js:206` 另實際拒絕 hidden timeNav，`:208–209` 核對 reference、case、time 及提交答案完全不變。

直接用 image viewer 查看修正後的 source 手機／播放／參考，以及下列 **actual ZIP** 圖片，確認圖形與 native bounds 相符：

- [320×500 停放球架](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-320x500-parking.png)：y／O 與球影分開，首球入口低於 legend，m 在 rack 左側。
- [情境 C 的 readonly t₄](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-390-reference-2.png)：實際顯示 t₄／X₄／Y₄／P₄，符合該題曲線與位置。
- [第 2 次曝光播放中](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-capture-2.png)：2／4 次球影及兩個移動球，球具有漸層、高光與描邊。
- [短 standalone capture](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-short-standalone-capture-readability.png)及[短 iframe reference](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-short-iframe-reference-readability.png)：compact 軸名完整可辨，起點／首球影不遮軸名。
- [短版面 3× preview](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-3/package-short-standalone-preview-2.png)：主圖與預覽對應同一球心，四球與球體外觀可辨，preview 留在另一側可見 shell。

### 修正對照與 closure 範圍

| 問題 | 狀態 | c32c470 修正與獨立再驗證據 |
|---|---|---|
| PF01 軸名被球影遮擋 | Closed | `scene.js:22–24` compact／小圖將 y／O 移出球影範圍；13 viewport 全 case／time／reference 與播放起點／首曝光的 native bounds、實際圖片均通過 |
| PF02 首 rack 球遮圖例 | Closed | `model.js:40–44` compact 門檻 height<210、normal 首中心至少 54px；`scene.js:24` m 移離 rack；文字對完整 44px target 與實際球／時刻內容的 native bounds 無交集 |
| PF03 Scope 漏 animation | Closed | `plans/25-motion-composition-stroboscopic-lab.md:52–53` 明列漸進拍攝、四球直接拖放與 animation.js；manifest 及 actual ZIP 均有該檔案且 byte parity 通過 |
| R2-01 readonly reference 重複 t₁ | Closed | `tools/motion-composition-browser-regression.js:58–60,203,206–210` 拒絕隱藏／0×0 target，edit 明確核對選擇，readonly 合法 fixture 逐時刻 restore、reference assertion 與 immutable 答案比對；獨立 smoke 的 832 selections 與可見 t₄ 圖已證明修正 |
| R1-04 選中 P 標籤被後畫的球遮擋 | Open P2 | 下節記錄第一位審核者提供、此審核者核對後確認的 source／ZIP 反例；不在上述 axes／rack closure 範圍內 |

### Root 完整矩陣補證（與自己的獨立執行分開）

Root 已明確回報 c32c470 完整矩陣 exit 0；原始資料：[progressive-final-verified/report.json](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-verified/report.json)，`errors=[]`。source／package 各 13 viewport、40 playback rows、36 short rows；正常 source／package × 390／320 四組各 43 rows。兩路 flow 全 true、mouseScore=100。這項執行屬 Root，並非本審核者另跑完整 runner。

本審核者從此 **新完整原始 report** 再次獨立重新計算全部 280 preview（正常 144、短版面 136）的主圖／preview 球心、viewBox 中心、實際 3×、shell 邊界、16px 避指與 pointer-inert；全部通過。另直接再核 128 個正常 trusted drag 的 before／during／after、權威答案與非 owner 滾動固定，以及 48 個正常 pan rows 的 host／panel owner、非 owner、答案及 selection；全部通過。完整矩陣保留 multi-touch、cancel／lost capture／outside／resize、鎖定三種模式與 scroll strips 的實際紀錄。

上述通過只證明各命令與現有 assertions 的範圍。`diagramReadability()` 的球清單只有 stamp／live／origin，且只有 axis 名對球面做交集檢查；沒有包含 reference／answer 球對選中 P 標籤的覆蓋。832 selections 與 1114 native 記錄通過不能推論所有 P 字形可讀。951524c exit 130 的中止資料與舊 reference 重複 t₁ 不計為通過證據。

### R1-04 · [P2] Open：短 readonly reference 的 P₁ 被後續球覆蓋

確切 production 位置：`sim/motion-composition-stroboscopic-lab/scene.js:49–55`，特別是 `:50` 畫球、`:54` 在同一 foreach 內畫選中 P 標籤。相關測試缺口在 `tools/motion-composition-browser-regression.js:125,129`。

來源與獨立性：第一位審核者先在本候選做 targeted browser 重現，Root 傳達反例。本審核者沒有讀其審核報告、沒有執行該 targeted browser script；已直接查看其 source／actual ZIP 原始 screenshot 與 balls-hidden 對照，讀取其 32-state native artifact、自行重算 A／D t₁ 的文字／球 bounds 交集，並核對 scene 的繪製先後順序。下列證據因此標示為「他方執行，本審核者核對」，不冒稱首次獨立 discovery。

- **重現：**320×225 CSS viewport，以合法 finished fixture 恢復情境 A（index 0）或 D（index 3）、activeTime=1；進入只讀參考圖，四個合運動球均顯示。此 compact 圖域 size=40px。source 與 actual ZIP 都重現。
- **Expected：**選中的 P₁ 字形與下標清楚可辨，能與 t₁／X₁／Y₁ 對應；後續 t₂–t₄ 球不能蓋住選中標籤。
- **Actual：**foreach 在 t₁ 球後立即畫 P₁，接著 t₂／t₃／t₄ 球畫在同一 SVG 群組上層；A 的 P₁ 主要字形被蓋住，只剩局部下標。暫時隱藏合運動球後，原有 P₁ 字形完整出現。D 的 t₁ 同樣有後續球覆蓋。
- **原生證據：**A/t₁ 的 P₁ native text bounds 為 left=78.506、top=115.589、right=91.850、bottom=135.089px，與後續球 2／3／4 相交；D/t₁ 與後續球 3 相交。兩路數值一致，artifact 的實際 selection 均為對應 case／time=1／reference=true。bounds 相交只作定位，真正覆字由原始與 balls-hidden 圖片確認。
- **原始資料：**[32-state native artifact](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/short-reference-p-labels.json)；[source A 原圖](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1.png)／[隱藏球對照](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1-balls-hidden.png)；[ZIP A 原圖](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-0-t1.png)／[隱藏球對照](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-0-t1-balls-hidden.png)；[ZIP D 原圖](../../output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-3-t1.png)。
- **修正：**先畫所有球，再畫選中標籤；compact 圖另以避碰位置或可辨的留白／背景保護 P 字形，避免把文字壓在其他球內。補 guard 對 reference／answer 球、P 標籤與 draw order，不能只確認 `textContent` 或 plot 內 bounds。
- **再驗條件：**新固定候選在 source／actual ZIP 的 320×225 兩拓撲，逐四題 × 四 readonly 時刻，經 production restore 核對實際 selection 與答案不變；保留原生文字／全部球證據並看實際 A／D t₁ 字形。維持 13 viewport、播放起點／首曝光、全部 trusted gesture owners、280 preview 與 14-entry parity 回歸；修正後再交三位完整獨立審核。

本候選 **不給無問題或全部驗收完成結論**。本審核者目前沒有另列其他未解決問題，但上述可重現 P2 是正式 Open finding，必須修正後重驗。

外部 gate 維持未驗：真實 Moodle 學生 attempt／teacher attempt policy，以及實體手機 current-window／new-window player、全部 gesture owners 與原生 zoom。本機 source／actual ZIP／fake-LMS 結果僅支持本機 package-ready 技術證據，不能替代 Moodle-ready／實體手機驗收。

## 2026-10-01 固定候選 d89d44c 的完整獨立再審

> 歷史紀錄：以下當時的通過未覆蓋其後確認的 PF06。該問題在 8a8095d 節另列原始反例及直接再驗，不把 d89d44c 當成目前無問題候選。

候選：`d89d44c1bfa9df95b1cf4e446e7dfcce5694c2b8`，基準 `origin/main`／`0bb873c`。開始實跑時 HEAD 已核對完整 SHA；這輪重新審查整條 branch，不是 c32c470→d89d44c 的 partial／delta review。沒有讀取另外兩位本輪的報告。唯一編寫的文件仍是本報告，沒有 production／test／plan／shared edits、commit、whole-repo `npm test` 或 `package:all`。

重新閱讀 AGENTS、全部 shared style baseline、626 行 production guide、activity plan 的模型／布局／手勢／rubric／全部 saveable phase／快照／lifecycle／test 決策及修訂段落；重新閱讀活動所有七個 runtime JS、HTML／CSS、六個測試與 test-support，並核對 shared flow／SCORM 實際 checkpoint／retry／trust／page lifecycle。catalogue、manifest、package scripts、test registration 與整個 browser runner 均在範圍內。其他審核文件及舊勾選項只作歷史，不替代本輪實跑。

### 整條 branch 的重新判斷

| 範圍 | 本候選完整核對結論 |
|---|---|
| 四情境與頻閃推論 | A：vx=4、vy=−4；B：vx=4、ay=−10；C：ax=10、vy=−4；D：ax=10、ay=−10，加速分量均由靜止出發。16 個 (x,y)、0.20s 共用取樣與 0.80s 末點、0.80 等距及 0.20／0.60／1.00／1.40 間距均正確。A／D 為 y=−x、B／C 分別為兩方向的拋物線；SVG x／y 等比例、負 y 與單位正確。文字使用模型相符／各段平均速率，沒有用有限球影證明瞬時加速度，B g=10 與忽略阻力、C 非自由落體及 D 特定由靜止條件清楚 |
| ¼ 速逐次曝光與四球 | 0.80 模型秒用 3.20s 播放；normal 連續、reduced-motion 每 800ms 一格，0→1→2→3→4 個等時影像，不按當下 frame 取曝光位置。未完成不保存 observed，切題／離頁／resize 取消舊 token；第四次完成立即顯示四個獨立 44px 球入口，可不先選時刻而任意順序直接拖入。徑向漸層、高光／描邊與球心幾何保留 |
| 文案／設計／標籤 | 精簡繁體、header／stage／panel、shared tokens、主控件16px與真下標／math font／單位一致。normal P planner 在球全部產生後避球面、文字、rack 及實際 model／學生線段；compact 「所選 Pᵢ」留白 caption 以粗圈識別同時刻，沒有改坐標或答案。軸名、首 rack、m 位置及 stage 邊界仍正確；新 native P guard 包含 answer／reference／live／projection／origin 球面及描邊 |
| mobile／手勢／替代 | Bounded shell 沒有 activity document／stage 的第三個 scroll owner；panel contain、兩側24px strip、穩定 HTML target／pre-down none、同 host forwarding、多指保留 owner 至全部 touch 結束、取消／lost capture／圖外／blur／resize rollback 完整。主圖／preview／release 使用同 post-snap 位置、公開錯格仍可保存。3×／16px 避指／pointer-inert／cleanup 保留。Keyboard 方向／Shift／Enter／Escape 與面板確認／取消都作用於所選 slot，未確認工作點不計分 |
| 分量部分分／提交 | 每 x／y 各2、兩個類型各3、軌跡3；每題25、全卷100、達標60，±50mm 不混用 CSS snap。全空0、只分類36、只位置64、重複共同末點16、全對100正確。所有未觀察／只分類／部分／完整／由 check 返回都可檢查、返回及明確提交；沒有最後一題自動提交，preset 球不計分 |
| schema／phase／續作 | model／rubric／schema 仍為1，固定四題／四 slot、必要欄、strict enum／整數／範圍、observed→points、kind→phase／returnToCheck 維持權威驗證。合法空白、錯答、重疊、分類先答與部分 work 可 round-trip、同 score／passed 並有合法下一步；還原不重新吸附。512 次 production 恢復續作實跑；最長 draft／review／pending 791／818／1061 UTF-8 bytes |
| SCORM／trust／刷新 | loadAttempt＋startup 四 outcomes、submitWithCallbacks＋submission 四 outcomes、retryable 兩類、committed finish retry、canonical 不可變 pending、invalid quarantine／pagehide 無不安全寫入、review mismatch／unknown status 等皆重新核對及實跑。Technical／frozen 不冒稱已提交／通過；recorded review 永不解鎖。Standalone memory-only refresh 全新，舊／拒絕 storage 不讀寫；Moodle-like 同 attempt 保留 draft／review／pending。活動沒有 raw LMS、commit／finish 或自有 pagehide 實作，高風險評核／secret 不在 learner bundle |
| catalogue／包裝／測試可靠性 | metadata／active folder／SCORM1.2 launch 相符，六個新測試及 runner 已登記。manifest／ZIP 14檔、11 runtime JS／CSS 引用全部存在、無 test／CDN。修正的 hidden-target 守衛與 readonly production restore 分別斷言真 selection／reference／答案不變；56 short rows 不是重複 t₁，合法 dense／partial／wrong 與 P 字形原生驗證有實際資料 |

### 本審核者新執行的命令與實際證據

| 檢查 | d89d44c 實際結果 |
|---|---|
| 六套活動測試 | `for test_file in sim/motion-composition-stroboscopic-lab/*.test.js; do node "$test_file" \|\| exit; done`，全新執行 exit 0，六套均通過；不是沿用前候選的執行 |
| check／base diff | `npm run check && git diff --check 0bb873c...d89d44c1bfa9df95b1cf4e446e7dfcce5694c2b8`，exit 0 |
| source／actual ZIP smoke | `MOTION_ARTIFACT_SUFFIX=point-label-review-3 node tools/motion-composition-browser-regression.js --smoke`，獲准本機 Chrome／localhost，全新完整 exit 0；`errors=[]` |
| source／ZIP 實際選擇 | 兩路各13 viewport ×32 diagrams，再加各56 short reference／dense／partial／wrong states，合計944個實際 case／time／reference 選擇重新核對；應有 P 標籤存在，selected partial 空 slot 不杜撰標籤 |
| native 可讀性再計算 | 自己的原始 JSON 共有1226組 readability、1088個 P 標籤。另行重新計算 P 對全部球含描邊、軸對 origin／projection／live、文字 pair／rack 全框及內容、stage clipping；全部通過。軸名交集守衛範圍為 origin／projection／live；合法學生位置由 P 標籤守衛核對 |
| exposure／playback／流程 | 兩路各5組 0→4 normal／reduced exposures、40 playback起點／首曝光 rows、全部 flows true／mouse100、各兩拓撲 CSS reflow 最終控制通過；中斷恢復及合法拍攝／放點續作通過 |
| 自己的 trusted short touch | 兩路各36 rows，重新核對136個 preview 的同球心／viewBox焦點、實際3×、shell全框、16px避指與 pointer-inert；全部通過。`--smoke` 沒有再跑通常390／320的43-row矩陣，不冒稱有跑 |
| Actual rebuilt ZIP | 根 manifest 與 source manifest 完全相同；14 entries 與 manifest 清單一致並逐byte source parity，launch為`motion-composition-stroboscopic-lab/index.html`；全部11 runtime引用存在，undeclared／mismatch空、沒有test-support／test檔 |

獨立完整原始資料：[point-label-review-3/smoke-report.json](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/smoke-report.json)，引擎 `Chrome/155.0.8059.27`。其中每路56 short states包含：兩拓撲 × 四題 × 四合法 restored readonly時刻=32，再加兩拓撲 × 三種合法 dense／partial／wrong × 四時刻=24。

### 直接查看的新候選圖片與 PF05 closure

本審核者用 image viewer 實際看自己的 source 與 actual ZIP 圖片，沒有以 screenshot 名稱代替視覺核對：

- [Source A／standalone t₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-short-standalone-reference-0-t1.png)、[Source D／iframe t₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-short-iframe-reference-3-t1.png)、[ZIP A／standalone t₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/package-short-standalone-reference-0-t1.png)、[ZIP D／iframe t₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/package-short-iframe-reference-3-t1.png)：原反例的全部四球仍在，但「所選 P₁」字形及下標完全可見，selected 球粗圈保留。
- [正常手機 D／P₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-390-case-3.png)、[desktop B／P₁](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-1280-case-1.png)、[320×500 門檻圖](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/package-320x500-parking.png)、[C readonly t₄](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/package-390-reference-2.png)：P 標籤避開球／物理曲線及文字；圖例、rack、m、軸名與相鄰文字可辨。13 viewport 原生資料另涵蓋320×499、390×501、390×467等 compact切換前後。
- [Capture 第2次曝光](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-capture-2.png)、[short live reference](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-short-standalone-reference-readability.png)、[short 3× preview](../../output/playwright/motion-composition-stroboscopic-lab/point-label-review-3/source-short-standalone-preview-2.png)：移動球與等時球影區別清楚，live sphere 不蓋 P caption；preview 的主圖 caption／球心／讀數與另一側可見 shell 正確。

PF05（原 R1-04）**Closed**，直接再驗的理由：`scene.js:78–84` 在全部球畫完且關閉 plot clip 後才畫 P；`:14–31,33–34,47,53,56–58,71–76,83` 的 normal planner 收集球面、文字、rack及物理線段；compact `:83–84` 使用明確 caption。`tools/motion-composition-browser-regression.js:123–129` 以 native data-point-label 對所有 data-ball circle（含描邊）檢查，`:175–187` 實際執行56個短狀態。上述修正沒有改 model／score／schema、球心或學生答案。

自己的 A／D t₁ caption native bounds 均為 left=109.313、top=109.105、right=155.109、bottom=132.605px（stage寬160px）；source／ZIP一致，所有球面均無交集。不是把 label刪掉或隱藏球而令測試通過：圖中四個合運動球保留，P caption 有實際字形，reference=true／case／time=1皆明確核對。

### 同候選 Root 完整矩陣：已完成的補證

以下由 Root 執行，本審核者在其完成後讀取原始 JSON、自行重算關鍵 bounds／preview／gesture invariants，與上面的獨立 smoke 執行分開記錄。

- [point-label-final/report.json](../../output/playwright/motion-composition-stroboscopic-lab/point-label-final/report.json)：完整 run exit 0，`errors=[]`。source／actual ZIP 各13 viewport、40 playback rows、56 short label states、36 short touch rows；全部 flows true／mouse100。正常390／320 × source／ZIP 四組各43 rows。
- 本審核者從該原始 report 再計算280個 preview（144 normal＋136 short）的同球心／焦點、3×、shell完整留在可視範圍、16px避指及 pointer-inert；1226組 native readability／1088個 P 標籤對全部球面含描邊／stage／rack 均通過。另核對128筆 normal trusted drag：拖動期間答案及 scroll owners 固定，trusted touch／move／up 計數增長，放手只更新所選 slot／activeTime 並符合 preview 點；48筆 normal pan owner 保持答案及選擇，panel／host 的移動與各 owner 合約一致。
- Root 的 `npm run package:all` 已 exit 0；[原始 log](../../output/motion-composition-progressive-package-all.log) 以 `All SCORM packages verified` 完結。本審核者沒有執行該 whole-repo 命令。
- [package-parity.json](../../output/playwright/motion-composition-stroboscopic-lab/point-label-final/package-parity.json)：候選 d89d44c、14 entries、11 runtime references、manifest entries／all source bytes 相同、`errors=[]`。本審核者另直接讀最終 ZIP 重算得到36,628 bytes，SHA-256=`b39f17b68229b5fae51e67e2ed394d1d516398eb47b4efb2e9140bb58d6fbd38`，與 Root raw parity 一致；最終核對 HEAD 仍是本候選完整 SHA。

本候選獨立完整審核 **沒有新 findings 或未解決的可重現問題**。PF01 軸名、PF02 rack／圖例、PF03 Scope animation、PF04／R2-01 readonly時刻覆蓋，以及 PF05／R1-04 P 字形遮擋均直接核對新候選修正及相應證據後關閉。自己的新執行及 Root 同候選完整矩陣分別通過；舊 c32c470 的 Open 紀錄保留為歷史。

真實 Moodle 學生分數／status、同 attempt resume／pending retry／review/new attempt與 teacher policy，以及實體手機 current-window／new-window 全部 gesture owners／zoom 的外部 gate 仍未驗證。


## 2026-10-01 固定候選 8a8095d 的完整獨立再審

候選：`8a8095d877ac76a5a7ed1402efbe24f845c817a9`；完整比較基準 `origin/main`／`0bb873c`。開始、獨立實跑完成及最後核對的 HEAD 均為該完整 SHA。本輪重新閱讀及審查整條 branch，不只看 caption delta，沒有沿用 d89d44c 的 pass 作新候選證據，也沒有分拆領域或讀取其他審核者本輪報告。唯一編寫的追蹤文件是本報告；沒有修改 production／test／plan／shared、commit、whole-repo `npm test` 或 `package:all`。

重新閱讀 AGENTS、全部 shared style baseline、626行 production guide、plan template、433行活動 plan；重讀七個 activity runtime JS、HTML／CSS、六套 tests 與 test-support，核對 shared activity-flow／SCORM 的實際 startup、checkpoint、retry、trust及page lifecycle；並重新審查 catalogue、manifest、package scripts、test registration、完整 browser runner及其實際 packager／scrollable iframe host。

### 整條 branch 的判斷

| 範圍 | 新候選重新核對結論 |
|---|---|
| 四物理情境／有限頻閃推論 | A(vx=4,vy=−4)、B(vx=4,ay=−10)、C(ax=10,vy=−4)、D(ax=10,ay=−10)及由靜止加速條件正確；16個位置、0.20s共用時刻、0.80s末點、勻速四段0.80m及加速0.20／0.60／1.00／1.40m重新核對。A／D直線、B／C兩方向拋物線及相同橫豎比例正確；文案區分模型相符與有限資料、各段平均速率、1:3:5:7由靜止前提，沒有用球影證明每一瞬間加速度；B g=10／忽略阻力與C非自由落體清楚 |
| 漸進球影／四球／文案 | normal以¼速連續移動，reduced每800ms逐格，固定曝光0→4且只完成後保存observed；舊token／換題／離頁／resize取消與恢復續作重新執行。完成立即顯示四個44px入口，任意球直接拖入與任意順序mouse／touch通過；徑向漸層、高光、球心、真下標及簡潔繁體文案保留，未提前展示合運動答案 |
| UI／可讀性／手機 | header／stage／panel、shared tokens、主控件16px／44px、bounded shell與兩欄門檻保持；normal標籤在所有球後畫並避球、文字、rack及物理／學生線段，compact兩行或單行caption均直接看圖及核native。新225／250／275／300／301高度涵蓋短兩欄及回到單欄；13 normal viewport仍包含compact上下界。PF01軸名、PF02首rack／圖例／m、PF03 Scope animation、PF05描邊球與P字形守衛均保持 |
| Gesture owners／preview／替代 | 穩定HTML target在down前none，stage／左右24px strip只到host，panel自己捲且boundaries contain，activity document沒有第三owner；多指保留owner到全lift，取消／lost capture／圖外／blur／resize不保存工作值。放手重新解析且只改所選slot，wrong public格點仍保存。3×真場景、同post-snap球心／focus／讀數、16px避指、pointer-inert及全部cleanup再驗。鍵盤方向／Shift／Enter／Escape及面板命令作用於所選球，暫態不計分 |
| Scoring／空白部分提交 | x／y各2、兩方向類型各3、軌跡3，每題25／全卷100／達標60／±50mm世界容差正確；空白0、只分類36、只位置64、同末點重複16、全對100及分量／類型獨立部分分新實跑。所有editable variants都可check／返回／明確submit，不要求逐題觀察或點齊，最後情境不自動提交；預設／觀察／停泊球不加分 |
| State／persistence／續作 | schema／model／rubric仍為1；必要欄、四題／四slot、strict enum／tuple／整數範圍、observed→points、kind→phase及returnToCheck重新核對。空白／分類先答／錯答／重疊／部分皆合法，invalid fail closed；semantic索引及returnToCheck保留，pointer／動畫／曝光／preview不保存。512次production encode/decode/restore及合法續作重新執行、同score／passed；draft／review／pending791／818／1061 UTF-8 bytes，還原不重新吸附 |
| SCORM／lifecycle／trust | loadAttempt＋startup四 outcomes、submitWithCallbacks＋submission四 outcomes、retryable兩類、committed finish retry、immutable pending／canonical答案、invalid pending quarantine／pagehide無寫入、review mismatch／unknown status／invalid summary重新讀及跑production handler；未確認不冒稱已提交／通過，recorded與pending均無reset。Standalone刷新全新且不讀寫舊／拒絕storage；Moodle-like同attempt保留draft／review／pending。活動無raw LMS或自有commit／finish／pagehide，高風險／secret不在形成性learner bundle |
| Catalogue／包裝／測試可靠性 | catalogue active folder與SCORM1.2 launch、六測試及browser runner registration一致，source／ZIP 14檔與11個引用相符。hidden／0×0 target拒絕及negative case維持；readonly四case×四time由合法finished fixture經production restore，實際selection／reference／答案不變都有斷言。每height56個short states均實跑，含密集／部分／錯答及全native字形，不以字串存在或測試名稱代替可視 |

### 本審核者新執行的命令與原始證據

| 檢查 | 8a8095d 實際結果 |
|---|---|
| 六套活動 Node tests | `for test_file in sim/motion-composition-stroboscopic-lab/*.test.js; do node "$test_file" \|\| exit; done`；本輪全新exit0，animation／lifecycle／model／persistence／scene／scoring全部通過 |
| check／base diff | `npm run check && git diff --check 0bb873c...8a8095d877ac76a5a7ed1402efbe24f845c817a9`；exit0 |
| Fresh source／actual rebuilt ZIP smoke | `MOTION_ARTIFACT_SUFFIX=caption-review-3 node tools/motion-composition-browser-regression.js --smoke`，獲准本機Chrome／localhost，完整exit0；[smoke-report.json](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/smoke-report.json)，`Chrome/155.0.8059.27`、`errors=[]` |
| Actual selections／字形 | 兩路各13 normal viewport×32 diagrams＋280 short states，共1392個實際case／time／reference選擇另行逐筆重算。應有P都存在，partial選中null slot無虛構標籤。1674組native readability／1504個P標籤對stage、全部球面含描邊、axis的origin／projection／live、文字pair、rack整框及內容全部通過 |
| Playback／flows／short touch | 兩路各5組normal／reduced等時曝光、40 playback rows、全部flows true／mouse100、各兩拓撲CSS reflow及36 short gesture rows通過。自己重新計算136個actual short preview，同球心／post-snap focus、實際3×、shell全框、16px避指及pointer-inert均通過；`--smoke`沒有跑normal390／320的43-row矩陣 |
| Actual archive／manifest | 自己另用AdmZip與XMLParser直接讀`output/motion-composition-stroboscopic-lab-scorm.zip`，確認14個entries與manifest完全一致，根manifest及全部檔案逐byte等於source，11個JS／CSS引用全declared，launch正確、無test／test-support／CDN；exit0。此檢查沒有重建ZIP |

每路280個short states為5 heights ×（兩拓撲×四情境×四合法readonly時刻32＋兩拓撲×dense／partial／wrong×四時刻24）。另外重新比較原PF06八個條件，8a的model layout／stage／plot／trays與原native geometry完全相同，只有caption形狀改變。自己的browser／build work已全部完成，不再計劃ZIP rebuild。

### PF06：P2歷史反例與直接 closure

Discovery來源是Root，原候選d89d44c的`scene.js:83–84`單行caption沒有處理較窄留白；本審核者讀原始診斷JSON、自行重算八個clip，並實際看舊[source A](../../output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/source-300-standalone-case-0.png)及[ZIP D](../../output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/package-300-iframe-case-3.png)，沒有聲稱自己首次發現或執行那個targeted舊候選run。

- **重現：**CSS320×300，source／actual ZIP × standalone／fluid iframe × A／D，合法finished fixture activeTime=1後開reference，八個條件均有四球。stage=160×213.59375、plot=68，caption native right=169.021896px，超過stage右邊9.021896px。
- **Expected／Actual：**完整「所選 P₁」及真下標須在stage內可辨；舊圖只剩「所選」與截斷字形。原[diagnostic smoke-report.json](../../output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/smoke-report.json)的exit0只表示收集成功，不是驗證pass，也不能用d89舊成功矩陣推翻此P2。
- **修正：**8a的`scene.js:83–87`以剩餘寬度<50px決定兩行；「所選」在第一行，P及11px真下標在dy=18第二行、text-anchor=end、x=width−4；仍14px主字。`model.js:39–48`、input target／snap、score／schema與全部球／plot幾何未改。
- **直接再驗：**自己完整source／actual ZIP smoke通過新五height矩陣；八個原條件逐一核native並直接看新的[Source A／300 standalone](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-300-standalone-reference-0-t1.png)、[Source D／300 iframe](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-300-iframe-reference-3-t1.png)、[ZIP A／300 standalone](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-short-300-standalone-reference-0-t1.png)、[ZIP D／300 iframe](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-short-300-iframe-reference-3-t1.png)。完整字形／下標與四球保留，right全部155.024994px，stage內剩4.975006px；沒有刪label／球或縮小圖域。
- **分支與相鄰狀態：**直接看[source250](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-250-iframe-reference-0-t1.png)／[ZIP250](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-short-250-iframe-reference-0-t1.png)兩行，以及[source301](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-301-standalone-reference-3-t1.png)／[ZIP301](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-short-301-standalone-reference-3-t1.png)回單欄的單行；225也保持單行。250的native兩行bbox right155.024994、bottom152.915237px；301單行right241.528748／stage320px。全部height的edit dense／partial／wrong native對rack整框及內容亦無交集；沒有只驗readonly。
- **其他畫面：**直接看新的normal edit [D/P₁](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-390-case-3.png)、[desktop B](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-1280-case-1.png)、[ZIP C reference/P₄](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-390-reference-2.png)、[第2次capture](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-capture-2.png)、[live reference](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-standalone-reference-readability.png)、[source preview](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/source-short-standalone-preview-2.png)及[ZIP preview](../../output/playwright/motion-composition-stroboscopic-lab/caption-review-3/package-short-iframe-preview-2.png)；球、文字、影像、caption及3×對應清楚。

PF06 **Closed於8a8095d**。新runtime與正式runner沒有未解決failure；舊d89反例、c32 R1-04及readonly覆蓋缺口都保留為歷史。

### Root完整矩陣的獨立原始資料補證

Root已完成本候選完整run exit0；本審核者重新讀[caption-final/report.json](../../output/playwright/motion-composition-stroboscopic-lab/caption-final/report.json)，核對source／actual ZIP各13 normal viewports／416 edit-reference diagrams／40 playback／280 short caption states／36 short touch rows、四組normal390／320各43rows、全部flows true／mouse100、`errors=[]`。

自己再計算Root原始資料：280個actual preview（144normal＋136short）的同snap球心／focus、3×、全框／16px避指／pointer-inert通過；1674組native／1504個P labels仍全可讀。另逐筆核128個normal trusted drag的fixed owners／保存slot／preview release、48個normal host/panel pan、32個multi-touch取消及同頁recovery pan、16個cancel/lost/resize/outside rollback、12個locked-state host pan；全部通過。補證重算的首次輔助命令把有entrance欄的multi-touch誤當一般pan，後改按interruption優先分類再執行exit0；首次helper assertion不算pass，亦非activity finding。

Root另執行`npm run package:all` exit0，[原始log](../../output/motion-composition-caption-package-all.log)以`All SCORM packages verified`完結；本審核者沒有執行該whole-repo命令。[caption-final/package-parity.json](../../output/playwright/motion-composition-stroboscopic-lab/caption-final/package-parity.json)記錄正確完整候選、14exact entries／11runtime引用、36,713bytes、manifest與全部source bytes一致、280個preview及`errors=[]`。三位reviewers的build work完結後，Root已pin最終archive SHA-256=`d2ad73396f1e46984dfa4321fbdafc4f7a256cf31b9e13a41bf04ca4e94d74c0`。本審核者再次直接讀最終ZIP重算同SHA／36,713bytes，逐byte核14entries等於source及manifest，並核更新後parity，exit0。舊package-all archive hash另列`packageAllArchiveSha256`及`archiveMetadataNote`，與最終檔案分清；沒有把獨立重建的ZIP metadata差異當runtime mismatch。

本候選整條branch獨立審核 **沒有新findings或未解決的可重現問題**，PF01–PF06維持／完成closure。Own fresh runs與Root同候選完整矩陣明確分開；沒有宣稱自己重跑最後whole-repo npm test，也沒有把local技術證據當成外部部署驗收。

真實Moodle學生attempt的空白／部分／完整分數與status、同attempt refresh／離開再入／pending retry／review-only／new attempt及teacher policy，以及實體手機current-window／new-window player的完整gesture owners／native zoom／最後控制／回捲仍未驗證。
