# 運動合成完整獨立審核 3

日期：2026-10-01（Asia/Shanghai）。審核 branch：`codex/motion-composition-stroboscopic-plan`；審核版本：`1c1815283c41420b09dfb6ce8e27bd8059073391`，相對 `origin/main` 的全部 20 個變更檔。這是整體審核，沒有分拆領域，也沒有參考其他審核者的報告。未修改活動、測試或其他人的報告。

結論：**需要修正兩項 P2 問題後才可通過本機 package-ready 審核。** 四個情境的物理模型、評分分量、正常手機布局及 SCORM 主流程未發現其他可重現缺陷。真實 Moodle／實體手機 gate 仍未驗證，不當作已確認的程式缺陷，也不宣稱部署就緒。

## 可重現問題

### R3-1 · P2：分類枚舉沒有檢查字串型別，非法 snapshot 可以繼續編輯及重試提交

- 位置：`sim/motion-composition-stroboscopic-lab/model.js:21`、`:23`；production decoder 經 `persistence.js:14` 使用這個驗證。
- `Object.hasOwn(MOTIONS, v)` / `Object.hasOwn(TRAJECTORIES, v)` 會先把 `v` 轉為 property key。因此 JSON 的 `['uniform']` / `['line']` 被接受為合法枚舉。這不是合法未答或物理錯答，而是 plan 的欄位型別違規。
- 實際重現：把第一題的 `motions[0]` 改成 `['uniform']`、`trajectory` 改成 `['line']`，用 production `makeSnapshot`、JSON round-trip、`P.decode` 及 `Controller.start` 恢復。沒有拋錯，mode 是 `edit`。瀏覽器的 select 又把陣列轉成字串，所以畫面顯示已選「勻速直線運動」及「直線」，權威答案仍是陣列。scorer 用 strict equality，這兩項得 0 分，造成顯示與評分不一致。
- 同一深層非法答案若放在結構合法、score=0 / passed=false 的 `pending-final`，controller 恢復為 `frozen`，`retryFinal()` 可以寫成 `review`／LMS `failed`，沒有 quarantine。這違反非法 pending 必須拒絕並保留原記錄的契約。
- 證據：`output/playwright/motion-composition-stroboscopic-lab/review-3/targeted-report.json` 的 `non-string enum accepted and coerced by UI`，及 `malformed-enum-ui.png`；另以 `test-support.environment` 執行了上述非法 pending 的 restore → retry，確實產生 `review` 和 `failed`。
- 修正：枚舉接受條件改成 `v === null || (typeof v === 'string' && Object.hasOwn(..., v))`；trajectory 同樣處理。加入陣列／物件型別的 invalid decode 測試，以及此深層非法 pending 的 quarantine／無寫入測試。不要把非法值轉成正常字串或 null。

### R3-2 · P2：短視窗的 200% reflow 把整個操作面板裁在畫面外

- 位置：`sim/motion-composition-stroboscopic-lab/styles.css:4`、`:47`；驗證缺口在 `tools/motion-composition-browser-regression.js:99`。
- 手機窄布局的 stage 固定最低 `9.5rem`（152 CSS px），再加約 85 CSS px header。相當於 640×450 視窗放大 200% 的 320×225 CSS viewport，兩者合計已超出 shell 高度。
- 實際 CDP 重現：`width:320, height:225, deviceScaleFactor:2, mobile:false`。header=85、stage=151；panel top=`238.40625`、height=`27.1875`，而 viewport 高度只有 225。shell／body 是 `overflow:hidden`、document scroll range=0，因此整個面板在可視區外。點 header「檢查作答」後，即使把 panel 捲到底也看不到「確認提交目前作答」。這是可操作性的程式缺陷，不只是缺少真實裝置證據。
- 證據：`review-3/targeted-report.json` 最後一列及 `review-3/zoom-short-check.png`。該 viewport 是 browser zoom 的 CSS reflow 等價測試；沒有把它寫成已完成真實桌面瀏覽器 UI zoom 或實體手機測試。
- 現有測試用 `Emulation.setPageScaleFactor(2)`，只 assert scale=2 及拍圖，沒有檢查 reflow 後 panel、最終控制的可視 bounds 或實際提交，所以不足以支持 plan 中「200% 縮放可操作」的 gate。
- 修正：短高度時 reflow header／stage，為 panel 留下可用的最小空間，避免其 top 落在 viewport 外；必要時減少非必要 stage 文字／使用更小的 stage track，但保留主要控制的字體及 44px target。加入有效 viewport 減半的 zoom reflow case，並實際捲到面板底、點擊提交及返回查看，源碼與 ZIP 都測。

## 物理與教學內容

- 獨立核對了四題 v、a、t 及 16 個位置：A `(0.8i,-0.8i)`；B `(0.8i,-0.2i²)`；C `(0.2i²,-0.8i)`；D `(0.2i²,-0.2i²)`（m）。共同 `Δt=0.20 s`，投影使用同一原點及時刻。
- A、D 都滿足 `y=-x`；B `y=-(5/16)x²`；C `x=(5/16)y²` 的 y≤0 分支正確。D 的直線只在指定由靜止及固定加速度條件下成立，文字沒有把它泛化成任意加速分運動。
- 每段距離 0.80 m 或 0.20、0.60、1.00、1.40 m 正確；後者相鄰增量 0.40 m。工具比較相鄰球影距離而非由 O 起的總位移。文字使用「符合模型」，並在結果說明球影疏密只表示各段平均速率增加，沒有聲稱有限頻閃點證明每瞬間加速度。
- B 提交後明示 g=10 m/s² 及忽略空氣阻力；C 沒有錯稱水平加速為自由落體。分運動球被說明為同一運動的分量示意，沒有呈現兩個真球融合。
- 橫豎坐標使用同一比例，世界 y 向上而 SVG y 反轉，負 y 刻度一致。參考曲線來自同一連續模型的細密取樣；學生折線只連相鄰已答 slot，不跨未答點，不擬合或補成正解。
- 學生用字為繁體中文，操作指示簡短，沒有把學科答案放在情境題名。比較工具的結论性提示屬 plan 明訂的教學輔助，未視為未授權洩露。結果回饋較長但集中在每題學科解釋、位置表與容差，沒有阻擋作答。
- 非阻擋改進：兩列頻閃球影只有當前時刻的大小強調，沒有 plan 所描述的逐影時間編號；可在 selected 影旁加簡短 `Xᵢ / Yᵢ`，讓同時刻配對更直觀。結果的 `t1` 參考串及 `y = −x` 普通文字亦可改成與其他位置相同的 `<var>`／真下標。這些目前不導致物理或評分錯誤。

## UI、手機、觸控及鍵盤

- 已讀完整共用規格、製作指南及活動 plan；三區布局、header 直接情境導航、白／淺灰底、共用藍色按鈕及 shared tokens 一致。無多餘封面或巢狀裝飾卡。
- 正常 viewports 320×500、390×500、390×600、390×844、768×900、1024×768、1280×900、740×360、320×400、640×450：獨立 source/package smoke 均通過，document range=0、無水平頁面 overflow、必要圖字 14 CSS px、導航 targets≥44px、panel≥65px。
- 檢閱 source／ZIP 手机、桌面、preview、比較工具及結果 screenshots。單一 active HTML 抓手避免多個 44px hit regions 遮蔽；軸／頻閃／非選定球為 pointer-inert。兩邊 24px strip 沒有被抓手蓋住。
- 完整 trusted-touch report 使用 Chrome 155.0.8059.12／CDP，source-390、source-320、package-390、package-320 各 31 項記錄：四題四時刻 tray／active 抓手、preview、兩側 strip／背景上下 host pan、panel 中段與兩端上下 pan、review／frozen／committed 舊 target pan。紀錄包括 host/frame/visual viewport、activity doc/visual viewport、panel、selection、權威答案與 pointer diagnostics；未只看 CSS 或程式 scrollTop。owner 變化、非owner不變皆符合表格。
- 獨立補測 production handler：preview 讀數與工作點 `(1.600,-1.600)` 一致，viewBox 圍繞同一 pixel focus；trusted touchCancel、多指打斷、resize 打斷，以及圖外最終 release 都保留舊 snapshot 並清 preview。
- 既有點用抓取偏移避免 pointerdown 跳到手指中心；up 重新解析最終位置；capture target 保留同 node。公開全格吸附，錯誤格同樣可吸附，threshold 用 CSS px，與 50mm grading tolerance 分離。未發現直接吸附隱藏答案。
- 鍵盤 source/package smoke 實際 focus tray，Arrow 移動、Enter 保存，Shift 微調後 Escape 取消；面板提供可達的原生按鈕及 selects，不依賴 hover。取消暫態後導航／檢查不保存未確認工作點。
- R3-2 是額外短視窗／200% reflow 的失敗；正常手機 checks 的通過不能消除它。真實軟鍵盤及真實裝置仍屬未驗 deployment evidence。

## 評分、狀態與依賴

- 每題 x/y 各時刻獨立 2 分、兩方向類型各 3 分、軌跡 3 分，四題 100、60 達標；50mm 對稱絕對容差與模型一致。空白=0，全位置=64，純分類=36，全對=100；錯 y 保留對 x 的分，重疊時刻各依本 slot 判分。
- P₀、停泊球、觀察／播放沒有分；預設全部分類和位置都是 null。一次操作不能「選全部」獲利。學生錯答案是合法資料，不因答錯而被技術鎖。
- 四題獨立切換保留 draft；唯一放點依賴是 observed=true，類型／軌跡無此依賴。header 檢查可從空白、分類部分、任一時刻進入；檢查不報答案對錯，明確提交才評分。
- 逐時刻／逐情境最後一步只進 check；不自動提交。可由 check 返回原 active case/time 保留答案，returnToCheck 保存。未答可提交。
- 刪一點／清本題 scope 清楚，清本題需確認且保留 observed 與其他題。成功／committed／frozen 不展示 reset 或編輯抓手；只讀切題不改 authoritative final answer。

## Persistence、SCORM 及信任邊界

- 512 個 production encode/decode/restore round-trip 含 edit、check、return、review、8 類狀態與全部 case/time selection，並執行合法續作；score/passed 保持。draft/review/pending-size fixtures 為 791/818/1061 bytes，遠低於 4000。authority 與 transient/derived 的分離符合 plan。
- 版本、phase、active index、tuple 數、觀察依賴、非整數／非有限坐標及未知 enum strings 有拒絕測試；R3-1 指出尚未拒絕非字串 enum。
- 實作沿用 `loadAttempt/startup`、`setDraftProvider`、`saveDraft`、`submitWithCallbacks/submission`；沒有 raw LMS 欄位存取或活動自有 commit/finish/page lifecycle。shared 只作 reporting；課堂風險明確 formative，未放 secrets。
- lifecycle production Controller 測試涵蓋四 startup、四 submit outcome、retryable true/false、committed finish retry、pending resume/retry、修改 final authority 防護、review score mismatch／unknown completed status、corrupt finished review locked fallback、read failure 無寫入及 deep-invalid pending quarantine/pagehide 防寫入。
- 技術及 frozen 狀態不顯示已通過、失敗或確認分數；finished mismatched review 只顯示可信 Moodle summary，不能重新編輯。過程中的成績／完成標籤使用 shared trust helpers。
- standalone fallback memory-only，source/ZIP 在 partial/check/submitted refresh 都回 fresh，可繼續作答；純測試及 browser deny-storage probes=0，舊 storage 沒有讀寫恢復路徑。Moodle-like fixtures 恢復 draft、review及pending；新 fixture 為新作答。這不等於真實 Moodle attempt 或 Moodle 新 attempt policy 已驗收。

## Catalogue、manifest、package 與測試質素

- catalogue metadata 完整，slug、title、description、tags、categories、planned status 一致；planned 是獨立審核前的合理狀態，通過修正及 gates 後才啟用。
- `index.html` 所有 script/link dependencies 都在 manifest；sourceParity 檢查與實際 ZIP source bytes 比對通過。ZIP 13 檔、根有 imsmanifest.xml、SCORM1.2、無 runtime CDN，沒有測試／截圖／開發腳本。共用三檔及所有活動 runtime 檔已包含。
- 全部五個純測試與 focused browser runner 已加入 `tools/run-tests.js`；package.json 有獨立 browser script，沿用已有工具依賴，無新增不必要 build system。
- 獨立執行的命令全部通過：model、scoring、persistence、lifecycle、scene 五個 Node tests；`MOTION_ARTIFACT_SUFFIX=review-3 node tools/motion-composition-browser-regression.js --smoke`（source及 rebuilt/extracted package）；source/ZIP bytes parity；`git diff --check origin/main...HEAD`；額外 `review-3/targeted.js`（其中 malformed/zoom 兩項是記錄已重現缺陷，非聲稱通過的 regression）。沒有重跑父 agent 正在執行的全 repo npm test。
- `review-3/smoke-report.json`、`targeted-report.json` 為本審核獨立 artifact；完整 gesture report 原檔也已逐組檢閱。根目錄舊 failure.json 顯示歷史 document scroll overflow，較新 report 與獨立 smoke 沒有此問題，未把舊 failure 當現存缺陷。
- 現有 regression 真正測試 authoritative restoration及 UI 路径，非只匹配 source strings；R3-1 的型別 tests、R3-2 的有效 zoom control reachability 是應補上的有意義缺口。blur/lostcapture 的清理實作已核查，實體瀏覽器差異需 deployment gate 另驗。

## 尚未驗的 deployment gates

真實 Moodle 學生 attempt 的 score/status、刷新／退出再入、pending retry、新 attempt，及實體手機 current-window／new-window player 的完整 owner matrix、軟鍵盤和工具列變化未執行。iframe same-origin host forwarding 的本機證據有效，但不推定真實 Moodle／cross-origin topology 可用。這些限制應保留未勾選，與上面兩項已確認缺陷分開處理。

## 2026-10-01 修正版完整複審：90a09cc

本次再審完整 branch，相對 `origin/main`，候選 HEAD=`90a09cc116a611bd963d6d19ce8edab93a106707`。保留以上首輪歷史報告；下列結論針對修正版。沒有讀其他人的首輪或複審報告，沒有修改活動、測試或其他人的報告。

結論：**首輪 R3-1、R3-2 已關閉；新增P2（R3-3）短 200% CSS viewport 的觸控預覽遮擋，以及P3（R3-4）近原點的selected標籤重疊，需修正後才能關閉本機審核。** 其餘物理、文字、評分、狀態、保存、SCORM 及包裝未發現新缺陷。

### R3-3 · P2：短布局仍把觸控預覽放在手指下面

- 位置：`sim/motion-composition-stroboscopic-lab/main.js:106–111`（固定124px寬、預估132px高、corner候選及fallback），與 `styles.css:48–55` 的短布局。
- 已修正的 320×225 CSS viewport 變成左右兩欄，stage 實際只有160×138.59375px。既有點從P₁拖至 `(1.600,-1.600) m` 時，trusted touch 的 cursor 在stage `(80,59.296875)`；預覽實際 bounds=`(28,2,124,137.796875)`，finger 在預覽內，也違反現有 `previewEvidence` 用16px margin驗的避指條件。預覽底端139.796875亦略超過stage高138.59375，會被stage的overflow裁切。
- corner候選仍沒有足夠空間避開這個finger；`options.find(clear)`失敗後回退`options[0]`，沒有提供短stage的替代預覽布局。實際高度亦因新增真下標超過程式假定的132px。
- 重現：source及重建／解壓SCORM均用Chrome/CDP `width=320,height=225,mobile=false`，可信touchStart／touchMove在active HTML handle上操作；不是DOM dispatch的模擬pointer，也不是僅推測CSS。兩路的 `fingerOverPreview=true` 與 bounds相同。證據在 `output/playwright/motion-composition-stroboscopic-lab/recheck-3/extra-report.json` 的 `short zoom viewport touch preview`，及 `source-zoom-preview.png`／`package-zoom-preview.png`。
- 短viewport的檢查／提交確已可操作，因此這不重開R3-2。問題只在同一所需viewport的精確觸控建構：可達最後控制，不足以證明拖放preview亦可用。
- 建議：短stage提供可避指的較小lens並把讀數留在panel，或把preview放在stage外的穩定可視位置；用實際overlay尺寸選位置。維持真實場景／post-snap focus及pointer-inert，並補320×225 source/ZIP的tray與active拖放，assert實際bounds、避指、讀數、release一致及cleanup。不要只隱藏預覽或縮小主要控制。

### R3-4 · P3：近原點的X₁標籤與y軸名重疊

- 位置：`sim/motion-composition-stroboscopic-lab/scene.js:19,30`。
- 在獨立smoke的390×600 screenshot，情境C／D的selected t₁水平位移只有0.20m。plot約164px，所以X₁的中心僅在origin右8.2px；y軸名在origin右8px。X₁ baseline為origin.y−9，與y軸名的top+9只差約1.6px，文字直接疊在一起。
- 證據：`output/playwright/motion-composition-stroboscopic-lab/recheck-3/source-390-case-3.png`（以及相同layout的package圖）。本次檢圖已發現此重疊，未讀其他審核報告。
- 這不改變物理或評分，但違反必要diagram labels應清楚且不互相覆蓋的共用規則。建議對近原點實施標籤碰撞避讓，或在這種密度使用現有Xᵢ／Yᵢ圖例，不只按整個plot.size判斷是否加字；修正後覆核C／D的t₁及normal手機圖。

### 首輪修正及其餘修正核對

| 範圍 | 本次核對及結果 |
|---|---|
| R3-1 strict enums | `model.js:21,23` 先檢查 `typeof === 'string'`；production draft／review拒絕[]、合法字串單元素陣列、object、boolean、number。score-zero malformed pending對水平、垂直、trajectory均進technical；retry及pagehide無新增寫入且durable原文不變。原缺陷關閉。 |
| R3-2 短reflow | 本次獨立smoke在source及ZIP、standalone及fluid iframe的320×225實際點檢查、捲至提交、點提交及參考；button完整可視、≥44px、16px字，panel有可用高度、無橫向／document scroll。原提交不可達缺陷關閉。 |
| 多指owner | `blockedTouchSequence`在第二指時取消未保存工作點，阻止host forwarding及重新啟動point，直到全部touchEnd／Cancel才清除。四組完整報告各8個tray／active×background／left／right／target案例都保留原答案及各scroll／viewport；同頁後續host pan正常。 |
| 只讀提示／stop label | 未觀察的blank／classification review顯示「你的作圖」，reference顯示參考軌跡；frozen顯示凍結，不再要求不能按的觀察操作。`stop()`同步playback label，actual resize後可重新播放；獨立smoke包括這些actual DOM路徑。 |
| 完整target／preview證據 | 四組source／ZIP×390／320各43rows。16個題時row各保留tray及active的before／during／after，合共128次正常抓手拖放；工作點、preview／主圖球心、viewBox、約3×比例、讀數、避指、release與cleanup分別斷言，未再覆寫tray資料。正常500px高矩陣通過，R3-3列出額外短viewport例外。 |
| 標記與數學排版 | selected Xᵢ／Yᵢ及圖例對應同時刻；較小圖域使用legend配面板時刻，避免全部影像加字。feedback／preview改用var、真下標及sup，參考模式即使observed=false亦顯示兩列投影，但不改權威答案或observed。圖域上緣移8px，映射仍等比例。 |

### 完整範圍複審結果

- **物理及文字**：重新核對全部四題 model constants、16點、連續直線／拋物線方程、等時位移及相鄰增加量。模型未改；C不稱自由落體、D固定由靜止條件、B的g近似及忽略阻力、有限資料只支持模型的用字仍正確。比較工具保持同一尺度，不把總位移當單段距離；沒有新長篇操作說明或洩露pre-submit正解。繁體 learner copy及不用raw LaTeX保持。
- **UI及手機**：重新讀完整main、scene、CSS及HTML，檢視正常手機、D近原點、320px preview、桌面review及短reflow screenshots。十種正常布局無overflow，shared三區／header導航／44px controls／14px圖字／bounded panel符合規則。手勢完整報告包含兩側strip、背景、panel中段及兩端、只讀／frozen／committed舊target、取消／lostcapture／resize／圖外放手。沒有以CSS或programmatic scroll替代可信gesture。短layout新增R3-3，真實裝置仍未驗。
- **實際blur／visibility**：本次獨立source及ZIP用新瀏覽器分頁 `Page.bringToFront` 切走活動，捕捉到瀏覽器發出的 `blur(isTrusted=true)` 與 `visibilitychange(isTrusted=true,hidden=true)`。正在拖動的工作點及preview清除，已保存state完全不變，play label是「播放分運動」；切回、結束原touch後，同頁新touch可正常操作及取消。沒有dispatch偽造lifecycle事件。證據為 `recheck-3/extra-report.json`。這補充清理驗證，不代表真實手機系統切換的deployment evidence。
- **評分及任意進度提交**：重新讀scoring、controller及persistence，重跑0/100、64/36、分量獨立部分分、50mm界內外、重疊slot及觀察不計分。分類依賴與位置依賴未改，任意edit／分類先答／blank可進check；check返回、returnToCheck續作、清除scope、提交後review-only與pending凍結仍成立。
- **保存及續作**：production版本／phase／slot／null語義未變；512個round-trip及合法續作再次通過。字串型別漏洞已補；沒有把學科錯答當schema錯誤。draft/review/pending bytes仍791/818/1061，沒有把pointer、DOM、preview或animation存入authority。
- **SCORM及信任**：重新讀controller全四startup／四submit outcome、retry兩類、review rescore/trust、committed finish retry、深層pending quarantine。shared檔案未改；沒有raw LMS或activity lifecycle新增。finished損壞review仍只顯示Moodle可信摘要、無reset；pending不報confirmed score。standalone memory-only及源碼／ZIP partial/check/submitted refresh／deny-storage probes通過；fake-LMS同attempt draft/review/pending及fresh fixture保持。瀏覽器評分風險仍明示formative，無secret。
- **目錄及包裝**：active metadata完整，description更精確為水平與垂直；slug／manifest／SCO launch一致。再次比對index全部runtime refs與manifest及實際ZIP，13檔逐byte一致（包含active config），沒有test、CDN或screenshots。新純tests及focused runner仍在repo test runner；shared／其他活動沒有修改。
- **測試與歷史證據**：本次重新執行五個純tests、獨立source／ZIP smoke與manifest/source byte parity，全部exit0；完整最新report為43rows／組、errors=[]，歷史driver failure已歸檔，未當現存產品失敗。已查父agent整套npm test log尾段的shared SCORM及production-flow通過紀錄；整套repo exit0由父agent執行及記錄，本次沒有另跑一套。R3-3是額外有意義的viewport×manipulation組合，現有zoom submit測試沒有覆蓋。

### 本次實際命令及未解事項

再次執行並通過：`node sim/motion-composition-stroboscopic-lab/{model,scoring,persistence,lifecycle,scene}.test.js`（五個獨立命令）、`MOTION_ARTIFACT_SUFFIX=recheck-3 node tools/motion-composition-browser-regression.js --smoke`、ZIP source bytes檢查及`git diff --check origin/main...HEAD`。另外執行 `node output/playwright/motion-composition-stroboscopic-lab/recheck-3/extra.js`；actual blur／visibility rollback通過，短viewport preview的失敗是報告中的R3-3，不聲稱這項通過。

本機未解事項為R3-3及R3-4。真實Moodle學生attempt、實體手機current-window／new-window host topology／soft keyboard／toolbar及真實browser UI zoom等原deployment gates仍未驗，不能用本機CDP替代；它們與上述已確認本機缺陷分開列示。

## 2026-10-01 第三輪完整再審：850eae6

獨立再審完整 branch 相對 `origin/main`，HEAD=`850eae68c1b5232346699cf41ce0dbd36d51bcf5`。未讀其他兩人的第三輪報告，未修改產品、測試或其他報告。**R3-1至R3-4全部關閉；F06／F07修正通過，沒有新增可重現缺陷。本機 package-ready 審核通過；真實 Moodle／實體手機部署驗收仍未執行。**

### 原 finding 及 F06／F07 closure

| Finding | 本次獨立證據及結論 |
|---|---|
| R3-1：非字串 enum／invalid pending | strict string guards及三類 enum invalid pending quarantine仍在；重跑model、persistence、lifecycle及source／ZIP malformedEnums browser路徑，拒絕非字串，沒有retry／pagehide寫回損壞authority。關閉。 |
| R3-2：320×225提交不可達 | source／ZIP各在standalone及fluid iframe實際進check、捲panel、提交及開reference；完整控制可視、無document橫向overflow，兩欄panel有138.59px可用高度。關閉。 |
| R3-3／F06：短畫面preview遮指及裁切 | `main.js:106–121`先render讀數、量實際overlay／lens，stage無安全corner時選app shell另一欄；`index.html`中的preview已是pointer-inert absolute sibling。獨立short trusted-touch每路68次拖放（64個case×time×tray／active＋4個公開錯grid）及8個cancel通過；before／during authority與所有nonowners固定，預覽完整在shell可視範圍、離finger≥16px、實際兩軸3×、post-snap focus／讀數／release一致、所有exit清除。本次逐筆解析證據再核查，正常stage仍用stage corner。關閉。 |
| R3-4／F07：近原點字重疊 | `scene.js:26–30`移除軸旁重複selected X／Y文字，保留selected粗圈及真下標圖例／time controls；`:45–47`另避開P標籤與y軸名並限制plot內。獨立檢看390×600情境D及短iframe預覽；所有diagram文字bbox gate通過（source／ZIP各66個正常scene，含C／D每時刻及reference，另有短scene）。沒有X₁／y或P₁／y重疊。關閉。 |

### 全範圍結論

- **物理、有限證據與精簡繁體文字**：重新核對完整model／scene／feedback及四題16點、等時位移與差值。A、D直線；B、C拋物線；D兩方向同時由靜止勻加速，固定比例才能直線。Δt=0.2s、g≈10m/s²、同尺度投影、y向上正號正確；有限頻閃只「符合」模型、平均速度不等同瞬時速度，1:3:5:7限制仍正確。學生界面沒有新增冗長說明，繁體、真下標及sup保持，提交前不展示正解。
- **UI、手機、觸控及keyboard**：完整HTML／CSS／main／scene重新核查，共用三區、header流程、≥44px控制、14px圖字及bounded panel符合規則。獨立source／ZIP十種普通viewport和320×225 standalone／iframe操作通過。最新完整正常矩陣四組各43rows的tray／active、背景、雙strip、panel中段／兩端、只讀／frozen／committed、multi-touch直到全部end、取消／lostcapture／resize／圖外放手均核查通過；新增短矩陣source／ZIP各36rows通過。HTML stable capture、公開grid吸附／hysteresis、keyboard coarse／fine／Enter／Escape與pointer release保存相同authority。實際blur／visibility的第二輪可信瀏覽器證據仍適用：相關cleanup未改，不把dispatch事件當真實lifecycle。
- **評分、空白／部分及依賴**：重新讀scoring與controller，重跑空白0、位置64、分類36、全對100、每axis獨立部分分、±50mm及重疊slot。四題獨立；只有放點依賴observed，分類先答、任意edit及空白皆可check／明確submit。check返回／returnToCheck、清除scope、最後next只進check、submitted review-only及pending frozen保持；stop label及readonly hints修正沒有回歸。
- **production保存與合法續作**：重跑512個production encode/decode/restore及執行合法continuation，覆蓋所有phase／variant／case／time，draft／review／pending fixtures為791／818／1061 bytes。版本、phase、整數mm、null、strict enum、observation依賴及deep-invalid states fail closed；未答與錯答仍是合法資料。preview、animation、pointer及只讀切題沒有進authority。
- **SCORM lifecycle／trust／quarantine／retry及standalone refresh**：完整controller及shared呼叫核查，四startup、四submission outcome、committed finish retry、immutable pending、retryable true／false、review rescore／trust、corrupt finished fallback／無寫入通過。只用shared loadAttempt／startup／submitWithCallbacks，沒有raw LMS欄位或新增活動自有commit／finish／page lifecycle。技術失敗不報confirmed score，無成績重設入口。source／ZIP partial／check／submitted refresh回fresh、deny-storage probes=0；fake-LMS同attempt draft／review／pending及fresh fixture通過。shared／其他活動檔案相對base未改。
- **Catalogue、manifest、ZIP及測試**：active metadata、slug／title／launch及runtime refs一致，13個ZIP entry逐byte與final source／active config／manifest匹配；root有imsmanifest，沒有CDN、測試或screenshots。五個有意義pure suites及focused runner仍列入repo測試。最新父agent完整`report.json`為errors=[]、normal四組各43rows及short兩組各36rows；獨立smoke亦errors=[]。既有driver診斷屬歷史，沒有當目前產品失敗。

### 本次實際驗證及未驗部署 gate

本次獨立執行五個命令 `node sim/motion-composition-stroboscopic-lab/{model,scoring,persistence,lifecycle,scene}.test.js`（各別執行）及 `MOTION_ARTIFACT_SUFFIX=final-recheck-3 node tools/motion-composition-browser-regression.js --smoke`，全部exit0。獨立結果在 `output/playwright/motion-composition-stroboscopic-lab/final-recheck-3/smoke-report.json`；新增short trusted touch全矩陣確有執行，並非只讀父agent報告。另執行ZIP逐byte比對、逐筆preview／nonowner／release證據核查及`git diff --check origin/main...HEAD`，通過。沒有重跑全repo／完整normal矩陣；初版全repo `npm test` exit0的範圍保留，final受影響活動的五套pure及source／ZIP browser已重跑。

**本機未解finding：無。** 真實Moodle學生attempt的score／status、刷新及退出再入、pending retry與新attempt，以及實體手機current-window／new-window host topology／soft keyboard／toolbar仍是未驗deployment gates。320×225是640×450在200%時的CSS viewport等效檢查，不能聲稱已操作真實browser UI zoom，也不推定真實Moodle或cross-origin host已驗收。
