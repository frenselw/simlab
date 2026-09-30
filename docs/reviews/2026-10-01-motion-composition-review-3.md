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
