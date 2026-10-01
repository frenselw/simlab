# 手機滾動問題修復計劃

日期：2026-10-01；R04 控制面板追修完成於2026-10-02。狀態：**R01–R12 已實作；另完成 R13/R14 隱藏 document range 修復。本機可信輸入及學科回歸已執行，repo checks、19新packages及逐byte核對已完成；2026-10-02 R04追加追修、32個本機案例及追修後全repo gates亦通過；實際 Moodle／手機 T4 待驗。**

本計劃在 `codex/mobile-scroll-audit` 執行，worktree 為 `/Users/hangwong/.codex/worktrees/mobile-scroll-audit/simlab`，起點為本機 `main` 的 `0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。本輪所有修復都在此 worktree。核對時 main 已到 `6d50d4c149bed5d8d93d5d17833f5e6af7c4da85` 並加入 motion-composition 活動；本計劃覆蓋起點的19個活動，整合最新 main 後再跑 catalogue／package／registered tests。

[審查報告](../docs/mobile-scroll-audit-2026-10-01.md)保存症狀、原碼位置及已執行的 source／SCORM 證據。[製作指引的手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)是共用規則的唯一來源；本計劃記錄修復範圍、活動差異、執行順序及驗收案例。各活動原有學科模型、assessment risk、rubric、依賴、權威 snapshot schema 及版本政策繼續由其原活動計劃擁有。

## 問題範圍與證據界線

使用者在 Moodle 內嵌播放器、不同手機瀏覽器遇到問題。首輪確認 10 個活動有具體手勢故障，另 2 個舊版活動需要版面調整。正式驗收再發現 2 個比較活動的 sr-only 絕對定位內容造成隱藏 document range，列為 R13/R14。全 19 活動均保留回歸範圍，不能把本機結果推定成所有模式／實機正常。

- 已完成首輪 19 活動、兩個尺寸、source／extracted SCORM 的 456 筆單層 iframe 手勢記錄。
- 補測全部 19 活動的巢狀 iframe，共 228 筆；重心三頁兩個尺寸，共 72 筆。
- 暫停 forwarding listeners 的對照實驗證明原生路徑在已測 Chrome host 可用；它不是 production 修復。三維 WebGL／Canvas fallback 均重現空白區旋轉。
- 最新正式 runner 已覆蓋 T0–T3、source／新建 SCORM 及下列分階段矩陣，不再移除 listeners。T3 直接量度 outer overflow element，且 outer Window 與 bounded wrapper 均為零 delta。真實 Moodle DOM／origin／sandbox、手機快掃放手慣性仍待 T4。
- 修復後的結果必須來自未經診斷 monkeypatch 的正式程式和新建置套件；舊 pass、catalogue 的 `active` 狀態及資料收集工具的退出碼都不能代替新版驗收。

## 共用修復決策

1. 以原生 `pan-y`、bounded activity document、獨立且 contained 的 panel 為預設。移除冗餘舞台轉送；真正拖曳／作圖 target 保留穩定 capture 及預先設定的 gesture ownership。
2. 共用 host fixtures、可信輸入、取樣和 invariant assertions 由 `tools/mobile-scroll-browser-regression.js` 擁有；合法狀態與操作 adapters 分置 `mobile-scroll-cases.js`／`mobile-scroll-operations.js`。正常空白完全 native。只有第二指取消已開始的 `touch-action:none` 作圖後使用 `sim/shared/touch-scroll.js`，沿 frame／overflow ancestry 找真正 owner，按其 scale 換算 screen delta；單指空白不進入 helper。
3. 原生路徑的修復不能縮成「把 `clientY` 換成 `screenY`」。直接 parent、真正 window／element owner、單一移動機制及縮放轉換都須符合製作指引。
4. 空白區按可見場景和任務判斷，保留命中透明 target 的證據。作圖中央可按任務擁有空白；立體外背景、圖形 cutout、左右捲動帶不能因大型透明 overlay 而被擷取。
5. 版面／hit geometry 修正須保留已有答案的學科座標、吸附、評分及 encode/decode 意義。新增 runtime helper 才需更新各 manifest；不新增非必要套件。

## 逐活動修復工作

下列檔案定位以本計劃基準 commit 為準；實作時用所列函數／selector 重新定位，不依賴固定行號。

### R01 kinematics-driving-challenge

- **問題位置：** [`main.js`](../sim/kinematics-driving-challenge/main.js) 的 `stageTouchY`／舞台 touch handlers，約 1409–1425 行。iframe-local `clientY` → `parent.scrollBy()` → `preventDefault()`，單向上掃每步會反向跳；巢狀 host 完全不捲動。
- **修復：** 移除這組 blank-stage 手動轉送，以 native 接手。保留踏板、時間游標等真正操作 target 的 ownership；保留 panel 邊界 containment，移除 forwarding 專用的 transient state／cleanup。
- **特別驗收：** 空白 swipe 逐步同向；踏板按住仍到合法 `pointerup`，取消立即回空檔；三個時間游標、已提交只讀回放游標不帶動 host。暫停／控制連續模型時間後比較 learner work，另驗 running 模式只出現原定時間演進。
- **短播放器補修：** 480–819px 闊、≤450px 高時，stage／panel 改為左右 columns；不讓 13rem stage minimum 把 controls 推到 iframe 外。
- **原計劃：** [駕駛挑戰](12-kinematics-driving-challenge.md)。

### R02 force-orthogonal-decomposition

- **問題位置：** [`main.js`](../sim/force-orthogonal-decomposition/main.js) 的 `startStageHostTouch`／`moveStageHostTouch`／`endStageHostTouch`，約 1693–1714 行；與 R01 相同的座標回饋與直接 parent 問題。
- **修復：** 移除 stage forwarding，以 native host path 接手；保留 `.stage-hit`、`.theta-hit`、stage navigation 的操作邊界。檢查圖形重畫時 capture target 保持 mounted。
- **特別驗收：** 三個情境的方向虛線、垂線、分力、θ／角弧、公式及 check／review-edit 路徑；不同旋轉／方向的 handle 不覆蓋可見空白。修復不能改變 sin／cos 作答、既有 v1／v2 review 評分及 pending retry。
- **原計劃：** [完整版交付](20-force-orthogonal-decomposition-full-delivery.md)。

### R03 force-composition-construction-lab

- **問題 A：** [`main.js`](../sim/force-composition-construction-lab/main.js) 的 `bindHostForwarding()`，約 1834–1861 行；被動 touch listener 手動推 parent，同時讓 native 捲動，並使用會受 iframe 位移影響的 `clientY`。
- **問題 B：** [`styles.css`](../sim/force-composition-construction-lab/styles.css) 的 `.stage.resultant-draw-ready { touch-action: none; }` 及 stage 自由起筆 handler；整幅舞台被當成畫板，距左右邊緣 16px swipe 亦起筆並保存 `FREE` 合力。
- **修復：** 移除 blank-stage forwarding。將自由作圖 owner 改成中央、有明確邊界的穩定 drawing layer；在窄屏保留製作指引要求的左右捲動帶。作圖座標和合法學科工作區須與新 layer 對齊，保留任意合法起點、端點、線身移動、guide／resultant snapping 及鍵盤入口。
- **特別驗收：** 平行四邊形、首尾相接及三力題；未畫合力、作圖中、已有合力後繼續作圖／修改、返回已答題及 review。用 production model 建立合法 H1 fixture，經 encode→decode→startup restore，再按已解鎖的正式按鈕進入合力模式；兩邊 swipe 不起筆、不改 canonical snapshot，中央空白仍可完成合力。單改座標或只修初始畫面不算完成 R03。
- **原計劃：** [力的合成](19-force-composition-construction-lab.md)；舊 §8.3 direct-parent／clientY 決策已撤銷為修復指示，§8.4 舊 spike 只保留歷史範圍證據。

### R04 static-kinetic-friction-investigation-lab

- **問題位置：** [`main.js`](../sim/static-kinetic-friction-investigation-lab/main.js) 的 stage touch handlers，約 1634–1636 行，以及 `hostSwipe()`，約 1966 行；passive 手動轉送與 native 同時作用，出現反向跳動。
- **修復：** 移除冗餘 stage forwarding／相關 transient state，以 native 滾動。保留 `.drag-target` 的精確操作及 panel 現有獨立捲動；逐一確認 helper 是否另有呼叫者後才刪除。
- **特別驗收：** A 水平受力、B 實驗、C 分析、check／review；滑塊及作圖 target 有效，stage 空白不觸發操作。固定 recorder／動畫時間或明確扣除原定演進，不把連續實驗資料變化誤算成 swipe 副作用。
- **控制面板追修（2026-10-02，使用者再回報）：** R04 舊修復保留了 panel 的外頁鎖定。`touchstart` 改 parent html/body 的 overflow／overscroll，`touchmove` 強制 parent.scrollTo，touchend 的 400ms timer 再排 100／300ms 回捲；下一次 touchstart 沒有取消上一個 restore，會把 `hidden` 當作 original，令 host 永久不能 native 捲。這亦會干擾播放器的佈局／捲動。
- **追修方式：** 刪除 panel 外頁 style 寫入、所有回捲 timers 與未部署的 panel-gesture message；panel 沿用自己的 native overflow／overscroll containment，真正拖曳 target 保留。共用 browser fixture 刪除其 panel-lock receiver，避免測試 host 幫 activity 遮掩故障。
- **新增驗收：** source／extracted SCORM 的 T0–T3 矩陣；記錄按下、逐 frame／scroll event、放手後 20／100／400／1000ms 及所有包含頁 style mutation。兩次 panel swipe 間隔 100ms，之後立即驗空白舞台 native scrolling；加按鈕／文字起點及 cancel 後繼續操作，確認 native panel、host／iframe 位置、答案／snapshot 和後續操作。舊版須返回 nonzero，不能用只看最終 scrollY 的檢查宣稱已修好。
- **原計劃：** [摩擦力](18-static-kinetic-friction-investigation-lab.md)。

### R05 force-equilibrium-diagram-lab

- **問題位置：** [`main.js`](../sim/force-equilibrium-diagram-lab/main.js) 約 305 行的 `touchOwners`／document `touchmove`。使用 `screenY` 仍只推直接 parent，無論其能否捲動都設 `handled = true`、取消 native；T2 兩方向 host delta 都為 0。
- **修復：** 將 blank-stage `host` 分支交回 native。保留 origin／force-head 的真正作圖 ownership，分開處理已有拖曳被第二指取消及 panel-handoff，不能整組刪除而破壞取消／rollback。若報告中的實際 Moodle owner仍不可達，再依共用指引解決拓撲或 verified adapter。
- **特別驗收：** 五種題目、未畫／部分／已畫力、check 返回、submitted／pending。左右捲動區及物體周圍空白均可捲外頁；origin／force head 作圖、取消、第二指交接及背景 motion 仍正確。
- **短播放器補修：** 480–599px 闊、≤450px 高時改為左右 stage／panel；no-scene check 維持全高 panel。
- **原計劃：** [基本平衡作圖](21-force-equilibrium-diagram-lab.md)。

### R06 force-equilibrium-advanced-diagram-lab

- **問題位置：** [`main.js`](../sim/force-equilibrium-advanced-diagram-lab/main.js) 約 310 行；與 R05 相同的 document host forwarding。
- **修復：** 沿用 R05 的已驗證原生策略與 assertions，按本活動 DOM／模型落實；不以「繼承基本版」代替本活動 source／package 測試。
- **特別驗收：** 五個進階情境各自的圖形、origin／force-head、側帶、check／review-edit／locked 狀態；物件及標籤差異不能令 blank 落點全被透明 target 吃掉。
- **短播放器補修：** 同 R05 的短橫向 columns；本活動 source／package 五題 empty／partial 與 no-scene check 分開驗證。
- **原計劃：** [進階平衡作圖](22-force-equilibrium-advanced-diagram-lab.md)。

### R07 newtons-second-law-investigation-lab

- **問題位置：** [`main.js`](../sim/newtons-second-law-investigation-lab/main.js) 約 378 行的 `owners`／document `touchmove`；同 R05 的直接 parent 吞手勢問題。
- **修復：** 把 blank-stage host 分支改為 native，保留 `.data-point-source`、`.plot-point-hit`、`.offscale-point-hit`、`.force-range` 的操作及必要取消交接。移除未再使用的 host delta 記錄，保留 panel-handoff 所需狀態。
- **特別驗收：** collect、兩組 plot、conclude、check／review；圖上點、超出範圍點、force slider 及觸控 preview。控制實驗時間後確認空白 swipe 不改收集資料、擬合、答案或評分；已有答案的 restored continuation 仍合法。
- **短播放器補修：** 480–599px 闊、≤450px 高時改為左右 stage／panel；no-scene summary 保留全高 panel，不承襲作圖 columns。
- **原計劃：** [牛頓第二定律](23-newtons-second-law-investigation-lab.md)。

### R08 newtons-third-law-reaction-force-lab

- **問題位置：** [`main.js`](../sim/newtons-third-law-reaction-force-lab/main.js) 約 152 行的 `touchOwners`；同 R05 的 host 分支。
- **修復：** 讓 blank stage／側帶 native 捲到真正 owner，保留 anchor、reaction-head、offscale-head 的操作與 cancellation，檢查 readonly footprint 的 ownership。
- **特別驗收：** 所有配對情境、不同鏡像／物件佈局、未答／部分／已答、check／review-edit、pending／submitted；reaction 力仍從正確物體起筆，背景加速／視覺狀態不掩蓋答案副作用。
- **短播放器補修：** 480–599px 闊、≤450px 高時改為左右 stage／panel；no-scene check 保留全高 panel。
- **原計劃：** [作用反作用](24-newtons-third-law-reaction-force-lab.md)。

### R09 centre-of-mass-investigation-lab

- **問題位置：** [`styles.css`](../sim/centre-of-mass-investigation-lab/styles.css) 約 13 行的 `.orbit-target`（寬／高 86%，舞台外緣只留 7%），以及 [`main.js`](../sim/centre-of-mass-investigation-lab/main.js) 的 `renderPart3()`／`beginOrbit()`，約 347／381 行。三維立體旁視覺空白被透明矩形攔截，上／下掃各新增一筆觀察而 host 不動。一維、二維在本輪正常。
- **修復：** 將三維 orbit hit geometry 對齊物體投影及有限 local margin。球體採投影圓形邊界；方體採投影外輪廓，從 renderer 的實際 camera／transform 得到邊界，不能拿五個候選點的包圍盒代替物體。WebGL renderer與Canvas fallback都提供等價的預先命中範圍；使用穩定、可裁切的 hit layer，更新 visual／clip 而不在 drag 中卸載 capture target。候選點仍按投影距離選取，鍵盤旋轉保留。
- **禁止簡化：** 在整片 `touch-action:none` 的 Canvas 上等 `pointerdown` 後 raycast 才放行，不能恢復已被封鎖的原生 gesture。只加兩條窄邊而留下大片 invisible orbit 背景，也不能解決可見空白問題。
- **特別驗收：** 一維、二維、三維分頁執行；三維球／方體、多個觀察角度、WebGL、Canvas fallback及context loss→restore。距左邊約 12% 的既有失敗落點、右邊對稱空白、物體上／下背景及兩側 strips 都不旋轉、不記錄 observation、不改草稿；拖物體仍可完成兩次合法觀察、tap／orbit threshold及候選點選擇。一維承托、二維物料／孔／cutout／畫線／重心標註保持原有正確行為。
- **短播放器補修：** 480–819px 闊、≤450px 高時使用左右欄；renderer 在每個角度為物體保留 40 CSS px 背景，再扣除 8px halo 後有至少 32px 可捲區。使用可聚焦 div orbit 元素，避免 native button 鄰近觸控選取把旁邊背景判成旋轉操作。
- **原計劃：** [重心](16-centre-of-mass-investigation-lab.md)。原有通用 pointer forwarding約 101–104 行另納入 invariant 檢查；只有出現重複／錯誤 owner 或本次幾何修正需要時才一併移除，不把三維故障推定為一維／二維故障。

### R10 displacement-distance-map-journey

- **問題位置：** [`main.js`](../sim/displacement-distance-map-journey/main.js) 的 `forwardGesture`／`onPointerMove()`，約 1374–1431 行，把 stage 垂直 swipe 分派到 `owner: "panel"`；[`styles.css`](../sim/displacement-distance-map-journey/styles.css) 的 `.journey-map` 阻止垂直 native pan，panel 邊界另會帶動 host。
- **修復：** 移除 stage-to-panel forwarding、capture 及專用 intent state；讓空白 map使用垂直 native panning，保留原本所需 pinch 行為。只有 person／displacement arrow 的穩定 target 擁有拖曳；panel 加明確 bounded scroll／overscroll containment並驗證實際邊界。
- **特別驗收：** 選起點／walking route、位移箭頭及作答／review相關模式；空白上下 swipe只動host，panel上下及邊界只屬panel，person與arrow拖曳仍沿合法路徑／座標更新。保存路程／位移、route coverage、preview及scoring的既有意義。
- **測試修訂：** `tools/mobile-touch-scroll.test.js` 目前肯定 `.journey-map` 的 `pan-x pinch-zoom`；修復時改為新契約的必要檢查，並同步修改 `tools/mobile-touch-browser-regression.js` 內對 map forwarding 的舊期待。CSS 字串通過仍須有可信輸入 ownership 證據。
- **原計劃：** [路程與位移](03-displacement-distance-map-journey.md)。

### R11 fbd-horizontal-block

- **問題／分類：** 舊 plan 明訂 natural document scroll，panel沒有獨立range；iframe初始可捲472px。與新要求的固定stage／獨立panel不同，列為版面遷移，不當成clientY bug。
- **修復：** 先在[活動計劃](01-fbd-horizontal-block-mvp.md)把目標分類更新為bounded split-panel；調整 [`index.html`](../sim/fbd-horizontal-block/index.html)／[`styles.css`](../sim/fbd-horizontal-block/styles.css)的header、stage、panel及min-height／overflow鏈，使activity document沒有range。保留SVG學科座標與force HTML target，按新可用尺寸處理letterboxing／preview。
- **特別驗收：** stage空白只捲真正host、panel自身及兩邊界不串流、最末控制可達。方塊上所有力target仍可拖，capture／cancel、部分分、check／submitted鎖定與Moodle草稿round-trip不退化。

### R12 plane-mirror-pencil-ray-diagram

- **問題／分類：** 舊自然流內頁初始可捲329px、panel沒有獨立range；空白 swipe 的取消路徑另有空白 draft 寫入。先比較 canonical learner work，分辨只是相同草稿的 flush，還是多建筆劃／語意 checkpoint；不能只憑 envelope 寫入便斷言答案改變。版面與取消／checkpoint 路徑分開驗收。
- **修復：** 先在[活動計劃](02-plane-mirror-pencil-ray-diagram.md)記錄bounded split-panel目標，調整 [`index.html`](../sim/plane-mirror-pencil-ray-diagram/index.html)／[`styles.css`](../sim/plane-mirror-pencil-ray-diagram/styles.css)。檢查 [`main.js`](../sim/plane-mirror-pencil-ray-diagram/main.js) SVG pointer handlers（約654–756、937–940行）的空白／作圖起點與`pointercancel`路由：取消空白gesture只清transient狀態，不建立空筆劃或新semantic checkpoint；合法完成的線段仍正常保存。
- **特別驗收：** 每個作圖階段及修改／review路徑；真正自由作圖時中央可畫、兩側可捲。驗證線段與鏡面／鉛筆位置、吸附與preview、取消rollback、部分分及snapshot仍正確；不得為阻止空白草稿寫入而停用有效學科答案保存。

### R13 inertial-reference-frame-road-observer / R14 linear-motion-velocity-lab

- **新增發現：** 正式 bounded-document assertion 量到 root range 分別約 499／477px。它們的 `.sr-only` 絕對定位內容沒有 panel containing block，雖不可見，仍把 root 撐高。
- **已實作：** `.reference-panel`／`.motion-panel` 設 `position:relative`，把隱藏內容限制在本面板。短橫向播放器另改 stage／panel columns，確保面板至少 96px 且在 viewport 內；linear calculation rows 隨窄 panel 重排，不靠縮字或隱藏 controls。不改學科模型、答案 schema、捲動 handlers 或動畫。
- **驗收：** 320／390 的 T2 source 補測四個案例沒有 root range；T1 source、T2/T3 新 package 及四尺寸完整 mobile-touch source／package 回歸通過。
- **原計劃：** [慣性參考系](04-inertial-reference-frame-road-observer.md)、[直線運動](10-linear-motion-velocity-lab.md)。

## 共用測試設計

### Host、尺寸及 phase coverage

T0–T4的定義與owner判準直接使用[製作指引](../docs/simulation-scorm-production-guide.md#required-host-cases)，不在此另訂一套。T1/T2/T3均有上下range，從遠離邊界的位置開始；每個host先跑兩個正常對照活動。

最低尺寸沿用製作指引：320×500、390×500、390×600、一般手機直向、橫向、短iframe、工具列／鍵盤變化、200% zoom；保留既有390×844／360×640故障重現尺寸。活動iframe與outer viewport尺寸分開記錄。動態viewport變化另列case，不能混入固定viewport的swipe判讀。

實作每個R項目前，從該活動production phase matrix整理**手勢phase/mode覆蓋表**：

| Activity / phase / scenario / mode | 合法fixture與UI進入步驟 | 可見空白、strip及操作target | T0–T3 × source/package | 結果與evidence |
|---|---|---|---|---|
| R01–R14 的實際 phase / mode | Production encode→decode→startup restore；執行合法續作 | Target selector、預先 touch-action、32px strips／8px 3D halo | 全目錄 T0–T3 初始 + 已改 ownership 類型的細分 phase + 原活動完整操作 | 詳見[逐活動覆蓋及等價範圍](../docs/mobile-scroll-repair-verification-2026-10-01.md#phase-coverage)；沒有舞台的正式 summary phase 明列 N/A，並量度版面確認 |

submitted、pending與技術鎖定需證明disabled editing footprint釋放到正確owner；保留明確授權的只讀回放操作。若某phase沒有獨立target／panel，標N/A並寫原因。

### 驗收案例編號

| Case | 輸入與觀察 | 通過條件 |
|---|---|---|
| G1 可見空白 | 左／中／右及物體外背景，可信上／下慢掃、長掃 | 真正host按方向移動；中介iframe／內頁／panel不捲；無答案／觀察／canonical snapshot改變 |
| G2 滾動品質 | 每move、release及放手後取樣；快掃、連續上下／反向 | 依共用rounding tolerance無反向跳動、吞手勢、double scroll或殘留capture；實機放手效果與同host正常對照比較 |
| G3 控制面板 | 中段上／下、頂端向下、底端向上；含文字／普通按鈕起點 | 只panel擁有捲動；host／iframe／stage／內頁／learner work每步固定，邊界同樣固定 |
| G4 中央作圖與側帶 | 左／右strip各獨立上下掃；中央起筆、完成／修改 | Strip無起筆／旋轉；中央作圖合法；操作preview、snap及capture正確 |
| G5 真正操作target | 每類target可信drag/tap，含重疊與邊緣佈局 | 意圖target更新、pointermove＋pointerup、無意外cancel；所有scroll owner固定 |
| G6 中斷與鎖定 | touchcancel、lostcapture、第二指、blur、換頁、submitted／pending lock | 合法rollback／handoff；無殘留owner，無空筆劃或空checkpoint；既有答案保留 |
| G7 狀態回歸 | 新／部分／已完成draft、check返回、review／pending restore | 原rubric／snapshot／scorer不變；每saveable invariant row完成round-trip及合法續作 |
| G8 版面回歸 | Short iframe、各斷點、zoom／方向／工具列／鍵盤變化 | Header導航與最末控制可達、文字可讀、target對齊、panel獨立，bounded document無第三scroll owner |

測試記錄實際owner window／element、每層frame／document、panel、host/activity visual viewport、iframe bounds、trusted pointer events與canonical learner work。連續動畫／模型時間須固定或分開量度。完整共同assertions由製作指引擁有。

### 測試工具與執行方式

1. 已建立可版本控制的 `tools/mobile-scroll-browser-regression.js`、cases／operations adapters 及 `npm run test:browser:mobile-scroll`。原 ignored collector 只保留歷史診斷用途。正式 runner 沒有 host touch listeners、panel-lock bridge 或 activity listener omission。
2. Runner對failedassertion、missingphase、不可達預期落點或非trustedtouch返回nonzero；保存JSON取樣與失敗screenshot。先對未修版本證明G1/G2/G4確實失敗，再對正式修復版本執行；不得透過跳過點、移除正式listener的preload或加未部署host helper取得pass。
3. 保留既有activity browser regression，重用其合法fixture、scoring／lifecycle及target操作；每批只擴充相關缺漏。新test files登記`tools/run-tests.js`，browser入口／操作方式登記`package.json`與製作指引。若新增runtime共用資產，各受影響manifest及package依賴一併更新。
4. 每批執行相關Node tests、`npm run check`、改動檔syntax及該批source／extractedpackage的可信矩陣。最後完整執行`npm test`、`npm run package:all`、19活動回歸及diff／manifest／ZIP核對，產生新的evidence；`npm test`通過本身不等於browser或手機驗收。
5. 7個比較／回歸活動為：`position-time-graph-motion-lab`、`free-fall-stroboscopic-measurement-lab`、`kinematics-qualitative-graph-sketching`、`kinematics-quantitative-graph-builder`、`hookes-law-spring-investigation-lab`、`inertial-reference-frame-road-observer`、`linear-motion-velocity-lab`。前兩者有使用者正常回報；其餘只持有限本機證據。其 ownership 未改的 phase 由共同 blank/panel 矩陣加原有完整 subject／lifecycle browser flow 作等價回歸；若新 phase 改 target／panel／layout，須增加獨立格。R13/R14 只修量度證實的 containing block 問題。

## 執行順序與交付物

| 批次 | 工作 | 完成條件／交付 |
|---|---|---|
| A 指引與計劃 | 更新製作指引、範本及14活動決策／歷史證據 | 已完成；執行結果另連 verification record |
| B 能抓到故障的驗收 | 共用 T0–T3、逐步取樣、真實空白與合法 phase adapters | 已完成；原 main 合力模式側帶負面案例失敗，正常對照與正式修復案例通過；unit assertion 亦拒絕反跳、錯 owner、答案變動及非可信輸入 |
| C Host手勢修復 | R05–R08優先，接R01/R02/R04及R03的forwarding | 本機 source／package 正常空白、panel、逐步方向與交接通過；原有完整操作／scoring／lifecycle 回歸保留，T4／實體 viewport 特性另驗 |
| D 操作區與錯誤owner | 完成R03中央畫板／側帶、R09三維、R10地圖／panel | 本機中央／側帶、三維三種形狀與兩個 renderer、map owner 及完整 subject regression 通過；重心1D/2D與已有答案不退化 |
| E 舊版版面 | R11、R12更新活動布局決策後遷移；R12取消／checkpoint修復 | 本機 bounded split-panel、十個 force targets、mirror 有效完成／取消 rollback／readonly footprint 及 scoring/persistence 回歸通過 |
| F 全目錄及套件 | 全19活動的共同矩陣、變更 ownership 的細分 phase 與原有完整 flow；repo／package gates | 本機共同／細分矩陣、完整 npm test、128個最後unit／wiring補測、centre完整回歸、npm check及19 ZIP byte parity全通過。Coverage／等價理由及未執行範圍在 verification record 明列 |
| G 實際Moodle／手機 | 量度部署T4；iPhone/Safari與Android/Chrome的內嵌播放器，另測提供的新視窗 | 實際frame/owner、每phase手勢、放手效果、SCORM提交／續作／鎖定證據；逐活動Moodle-ready |

每批完成後更新其原活動計劃中的實際決策、coverage與證據，保留舊記錄的歷史標示。批次G的環境／帳戶／實體手機可用性另記，不阻止先完成本地production修復及packagegate；未執行的G格維持Pending。

## 狀態、相容性及風險控制

- Runtime 修復保持原 subject model、rubric、scorer、答案 encoder／decoder 與 snapshot versions；新 runtime 資產已登記 manifest。沒有因 scroll 修復 reset 既有 Moodle 答案。若日後需要 schema 變更，先記錄 migration／舊 attempt 政策。
- 主動避免刪除整個document touch block而丟掉simulation cancellation或panel交接；移除的是錯誤host分支，保留有意義的互動處理。
- 改drawing／orbit邊界會影響座標、候選點和capture；對最大／最小模型、不同視角與zoom驗證。3D hit outline由同一render transform導出，capture target不能在拖曳中重建。
- Layout遷移保留世界／SVG座標與既有scorer；補齊preview／snap與short-viewport可用性，不靠縮小文字或隱藏提交按鈕。
- SCORM只繼續使用`SimScorm`／`SimActivityFlow`；success、committed、frozen、retry、standalonefresh與Moodle同attemptresume、4000-byte上限、readonly／pending不可清結果等原契約不變。

## 完成追蹤

- [x] 共用指引、範本及已知活動文件完成本次修訂；問題／修復／測試與批次已列出。
- [x] T0–T3 共用 runner、合法 phase adapters、逐步取樣及負面基線；覆蓋與等價範圍已列出。
- [x] R01–R10 正式修復與本機 source／extracted package 回歸完成。
- [x] R11/R12 版面、取消／checkpoint 及只讀 footprint 修復；R13/R14 隱藏 range 修復。
- [x] 基準19活動共同矩陣、repo checks、scoring／persistence／lifecycle 及最終新 packages 全部核對完成；[覆蓋／SHA256與完整紀錄](../docs/mobile-scroll-repair-verification-2026-10-01.md)。
- [ ] 真實Moodle與手機T4、快掃／放手及SCORM流程逐活動驗收通過。

完成一項就附commit、case IDs、commands、engine/device、build及artifact位置。本機 checks、package-ready 與 Moodle-ready 分開記錄。T4／手機尚未執行，不能因本機修復項已勾選而聲稱實際 Moodle-ready。
