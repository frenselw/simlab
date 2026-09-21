# 力的正交分解完整版：管理者工作單

日期：2026-09-18。使用者授權完成整個活動；由目前任務管理一個 Luna Max 工作階段，每 30 分鐘檢查進度。未經使用者批准，不得新增其他工作階段或子代理。

管理紀錄：worker task `01a0b293-9171-7323-b15a-9ba308252240`，模型 `gpt-5.6-luna`、reasoning `max`，host `local`，工作樹 `C:/Users/frens/.codex/worktrees/4253/simlab`。已確認工作者 active 並完成最新來源複製；heartbeat `mvp-luna` 已改為本完整版任務、每 30 分鐘檢查。即使 list_threads 未列出此工作樹任務，仍可直接以此 canonical ID 呼叫 wait_threads。原 MVP worker 已結束，不再分配工作。

## 交付範圍與決策

沿用目前已獲認可的活動，完整保留作圖 → θ → 公式，以及拖動修改、局部吸附、方向／箭頭控制點可達性、數學排版、舞台步驟導覽。不得另起一個簡化版本代替。

1. **獨立面板滾動**：桌面左右分區、手機上下分區；bounded split-panel，舞台與面板均不隨對方內容增長。面板內捲動不移動畫面，面板頂底不把手勢傳給 host。html／body 無第三個捲動區。空白舞台的手勢屬 enclosing page／Moodle host，不能轉給面板；真正 draggable 的手勢只操作模擬。遵守 production guide 全部 touch matrix。
2. **三個情境**：水平／垂直；斜面物體受外力 F，沿平行／垂直斜面分解；斜面重力 G 沿下坡／向內法線分解。場景需清楚畫出有厚度或斜線紋的斜面及物體，力起點對齊物體。原力固定於該題，避免零分量與近退化角。使用小型題目設定與共同幾何，勿寫龐大通用繪圖引擎。
3. **角與表達式**：前兩類自由定義 θ，保留可行的 O／P 銳角、等值角與互餘角語意；第三類先採題目給定斜面傾角 θ，要求標出同一角度，不能接受互餘角作同一 θ。G 的平行分量為 Gₓ = G sin θ、向內法線分量為 Gᵧ = G cos θ。第三類固定以 Gₓ／Gᵧ 表示軸向，不容許因學生畫箭頭的先後而對調。公式表達大小，箭嘴表達方向。
4. **完整練習**：先交付固定三題、每情境一題，可切換並保留各題草稿；不額外擴張隨機題庫、任意原力拖動或完整 undo。可反覆檢查／修改，檢查回饋不等於最終提交；換角／改图保留嘗試答案、清除過時判定。提供最後總覽及明確的最終提交按鈕。
5. **保存及提交**：formative／low-risk browser scoring，非高風險評核。用 final-state scoring，三题等權，每題方向、垂線、分力、θ、公式五組各等權，組內兩項可給部分分數；無操作次數懲罰，無任意 pass/fail 門檻。未完成項於最終提交得 0，但必須清楚確認遺漏。提交前可從總覽返回修改，正式成功後鎖定 review。使用共享 SCORM startup、draft、submission、finish 路徑，涵蓋四種提交結果。standalone 同樣可保存／恢復本地草稿及重設，但不可冒稱已提交到 Moodle。shared runtime 若已有 standalone 支援則沿用，不另複製一套。
6. **正式產物**：完整 production plan、state matrix、snapshot schema、scoring rubric、round-trip／非法狀態／restore continuation／lifecycle 測試，catalogue 與 manifest，SCORM 1.2 ZIP 及 extracted launch 驗證。包內只列實際 runtime dependencies。三題資料須符合 suspend_data 大小限制。

真實 Moodle 的帳戶／環境若未提供，先完成本機、LMS mock 及 packaged 檢查；不得聲稱已做真實 Moodle 或實機手機驗收，也不可自行發布到未知課程。

## 工作段與管理者審查

- M0：從 `NEW-SIMULATION-PLAN-TEMPLATE.md` 建立完整 production plan，先寫明狀態矩陣、權威快照、回饋／分數、gesture inventory，再編寫保存程式。
- M1：bounded split-panel，加上 source 的完整三區 touch matrix，維持既有操作；管理者審查版面和操作回歸。
- M2：完成三情境幾何、場景、θ 語意與公式；管理者重點審查物理正確性、建立次序交換、錯圖修復及小畫面控制點。
- M3：三題導覽、final review／review-edit、保存／恢復／提交及 scoring；管理者審查矩陣和 production-shaped round trips。
- M4：登記、打包及 source + extracted SCORM 全部 trusted-touch／responsive／lifecycle 驗收。管理者再整合並交付原專案。

Luna 不必逐段停工等許可。每達里程碑，把變更、證據、風險、下一段記在本文件的進度表，然後繼續下一段；只有無法合理假設的方向性阻礙才提出問題。管理者定時查看並可隨時發送修正工作單。不可將「已寫計劃／已產出 ZIP」視為已驗收完成。

## 協作與整合

來源基線是 `C:/Users/frens/Documents/Projects/simlab` 的目前未提交內容。新工作樹必須先取得該活動、MVP／roadmap／本文件及既有專項 runner；不得回退到舊 MVP 任務的內容。工作者只改自己的工作樹；不要修改來源基線或其他活動，必要共享修正須有針對性證據。

所有新增測試登記 `tools/run-tests.js`。實際跑 `npm.cmd run check`、相關 tests、package 及 browser matrix。完整 repo tests 若遇到已知 position-time Chrome/CDP blocker，記錄本輪證據並分離活動測試，不可假裝全通過，亦不要漫無邊際重寫無關 harness。

| 段落 | 狀態 | 證據／待辦 |
|---|---|---|
| M0 | 已審查 | production plan、可達狀態矩陣及權威快照已落實；見本文件下方生產計劃 |
| M1 | 已驗收（本機） | bounded layout、source/extracted trusted touch；管理者整合後重跑通過 |
| M2 | 已審查 | 三情境、重力等角、斜面已知角、分力建立次序與公式 |
| M3 | 已審查 | 保存／review／提交／rubric；8921d64 修正連續 finish 失敗及 review 切題 |
| M4 | 已交付（本機驗證） | 27 個已審查檔已整合；原專案八組測試、npm check、完整 browser/lifecycle 重跑與 ZIP source parity 全部通過 |

## 管理者最終交付：2026-09-18 16:51（澳門時間）

已將 Luna commits `0db3590`、`8921d64` 的 27 個已審查活動相關檔案整合至原專案 `codex/force-orthogonal-decomposition`；保留本文件的管理歷程，並更新 roadmap 最新狀態。未修改無關活動。來源原有檔案備份在 `output/force-orthogonal-before-full-integration/`，runtime／test 檔案逐位元組比對 worker 最後 commit 一致。

管理者在原專案獨立執行八個 model／scoring／persistence／lifecycle／UI／accessibility／shared-SCORM／browser-contract 測試檔全部通過，`npm.cmd run check` 通過。完整 `tools/force-orthogonal-decomposition-browser-regression.sh` exit 0：source／extracted responsive 與 trusted touch，以及 production LMS mock lifecycle 均通過，含重複 finish 失敗、切題後保留 finish-only retry。記錄：`output/force-orthogonal-manager-browser-verified.log`。首次 restricted run 因 npm cache/network EACCES 未能啟動；獲准使用既有 runtime 後重跑成功，沒有把失敗 run 計為通過。

交付：`sim/force-orthogonal-decomposition/index.html` 及 `output/force-orthogonal-decomposition-scorm.zip`。ZIP 有 11 個檔案、51241 bytes；manifest 位於根目錄，每個 runtime 檔均與原專案一致。最終重建 ZIP SHA-256：`05a21fd99b820332f34e1a31cb361abb6bf79bbde641a0121d67d8199444a66e`。管理 heartbeat 已設 PAUSED。

驗證界限：完整 repo runner 的既有 position-time Chrome/CDP blocker 仍未解決；不宣稱全 repo green。未有真實 Moodle／實機手機驗證，亦未部署到課程。獨立 in-app file preview 受 URL policy 阻擋，未嘗試繞過；正式 regression 的 localhost source/package 測試不等同該預覽。此次交付完成，可停止每 30 分鐘管理 heartbeat。

## 管理者巡查：2026-09-18 16:10（澳門時間）

Luna 前一 turn 已 completed/idle，worker commit `0db3590`，完整 activity、shared opt-in persistence、manifest、catalogue、runner 已提交在隔離工作樹。worker final verification 記錄 owned-server source/extracted trusted touch、320×500 gravity 作圖及 production LMS lifecycle 均通過；全 repo 仍有既有 position-time CDP blocker。管理者獨立 `npm.cmd run check` 通過。

最後程式覆核發現 bounded lifecycle defect：committed handler 中 retryFinish 再失敗時被映射到 frozen，之後按鈕改呼 retryPending；review question navigation 亦會清掉尚待 finish 的 action。已喚醒同一 Luna 任務作小幅修正：保持 committed review／finish-only retry，mock 連敗兩次且中間切換 review 題目再成功，確認不重寫已提交 payload。最新游標 `cf4f2c82-716f-4fcc-acc6-7bb74ca0bfcc:4`，任務 active。

來源確認為 `b2d8215` / `codex/force-orthogonal-decomposition`，未有其他 shared/config 修改；已把目前 16 個來源 baseline 檔備份到 `output/force-orthogonal-before-full-integration/`，尚未覆盖活動或整合 worker。其完成後才進行 final integration。一次可選 in-app browser file URL 視覺預覽被 URL policy 拒絕；未以替代 URL、surface 或底層命令繞過。現有正式 runner 證據與 source 審查不冒稱 manager 已作該視覺預覽。

Heartbeat 保持 active；未到交付完成，未暫停。

## 管理者巡查：2026-09-18 15:38（澳門時間）

compact status 仍 active，游標 `cf4f2c82-716f-4fcc-acc6-7bb74ca0bfcc:2` 無新 turn items；但 main.js、lifecycle harness、ZIP 的修改時間持續更新（15:32–15:38），確認工作仍進行，不能僅因 telemetry 未更新判定停工。

已加入 gravity scene framing、物體貼斜面、320×500 重力作圖檢查；lifecycle harness 改用通過 decoder 的三題完整草稿，seed 改成 deterministic sessionStorage。管理者獨立執行五個 model/scoring/persistence/UI/accessibility 測試檔均通過。尚無本輪完整 browser/lifecycle 完成證據。

查得新 fixed givenTheta 仍呼叫 learner thetaCandidates，因此預先畫在 mg／normal 的答案位置。已向同一 worker 提供具體 slope vertex + 水平 ray + 0 至 plane.angle arc 的修正段落，要求固定已知角只在實際斜面，學生分解角待自行放置。其餘工作方向一致，不新增任務，heartbeat active。

## 使用者要求「繼續」後恢復：2026-09-18

查得唯一 Luna 任務前一 turn interrupted、notLoaded，並非完成。已向同一 canonical task 發送續作段落，確認重新 active；最新游標 `cf4f2c82-716f-4fcc-acc6-7bb74ca0bfcc:2`。未新增 task 或子代理，30 分鐘 heartbeat 仍 ACTIVE。來源 branch 為 `codex/force-orthogonal-decomposition`，尚未整合未驗收內容。

優先完成 production LMS lifecycle harness、deterministic seed、最後 package/checks/證據。管理者同步查閱教學視覺，發現 gravity 題宣稱給定斜面 θ 卻未畫 physical slope 已知角弧／水平參考；phasePrompt 亦仍混淆學生應標的等值分解角。共用 origin 貼近底邊，gravity -72 world head 的 52px 控制點在窄屏有裁切風險，而既有三情境完整作圖測試在 desktop 執行。已要求小幅 per-scene framing、窄屏重力作圖驗證、給定角標示，以及把目前浮起的物體底面與斜面對齊。保持同一工作者處理，沒有新功能擴張。

## 管理者巡查：2026-09-18 14:50（澳門時間）

唯一任務 active，游標 `35943112-862a-4da0-97b2-f9ba6663e99b:7`。owned server 已使用 OS 分配 port、身分 health check 及 source/packaged route readiness。worker 最新 run 的完整 source/extracted responsive + trusted-touch runner 已回 ok；本輪 read-only 檢查確認 drag helpers 已包完整非 owner 位置指標與 trusted pointer 事件。此為 worker 執行證據，尚待完成後 manager 最終重跑。

新增 production main.js/shared SCORM + LMS mock lifecycle harness 已接入同一 shell；目前失敗在作圖後 theta-choice 隱藏。已給同一 worker 聚焦指引：先檢查實際幾何／phase／hidden ancestor，或以 validated draft 經 mock LMS 裝載，避免重複已通過的觸控作圖；不要 force-click 繞過真實 UI。各場景 init scripts 必須 deterministic，不能假設重複 addInitScript 有執行先後保證。

仍待 lifecycle 各結果與 final checks／證據／交付，尚未整合。沒有使用者方向問題，heartbeat active。

## 管理者巡查：2026-09-18 14:19（澳門時間）

任務 active，游標 `35943112-862a-4da0-97b2-f9ba6663e99b:6`。管理者獨立重跑 shared SCORM tests 通過，並故障注入確認同頁 retry 及 read-only reload retry 均繼續 frozen，不再冒稱已 committed；上輪該問題已修正。

最新 browser run 在 extracted 啟動 timeout；worker 查到 4173 由舊 node listener 佔用，packaged URL 回 404。已發具体工作段：先用獨立 port，runner 改成 OS 分配埠或有身分驗證的 owned port；readiness 必須核對此 worktree/server 與 source/packaged 路徑，不能接受其他 listener 的 200。不得殺未知 PID。之後重跑完整觸控及 production LMS lifecycle，保留可重現證據。

尚未驗收 M1/M3/M4 或整合；既有 claimed browser success 不足以代替 server identity 正確的新一輪證據。沒有使用者方向問題，heartbeat 繼續。

## 管理者巡查：2026-09-18 13:46（澳門時間）

唯一 worker active，游標 `35943112-862a-4da0-97b2-f9ba6663e99b:5`。shared standalone 已改 staging + commit 一次保存 bundle，新增 nth-write／reload／retry 測試；browser runner 已增 θ、公式卡、六個 edit targets、trusted pointer 事件及 320／390 iframe 流程，目前正在驗證。尚未整合。

管理者額外故障注入仍重現同頁重試漏洞：final commit 儲存失敗後，storage 狀態變 unavailable；同頁 retryPending 在 storage 仍失敗時回 ok/committed/finished，但 durable checkpoint 仍是 pending-final，reload 亦回 pending-final。已要求保持失敗後的 durable transaction 鎖定，不能降級 memory-only 而報成功；補同頁 repeated retry、pagehide、read-only pending retry。

另提醒 drag helpers 本身須包覆完整 before/after 位置指標；目前全指標只圍住 stage/panel gesture，拖動 helper 只檢查 pointer 事件。M1/M3/M4 仍待全部 evidence，production LMS lifecycle coverage 仍須完成。沒有新方向問題，維持同一任務與 heartbeat。

## 管理者巡查：2026-09-18 13:13（澳門時間）

任務仍 active，游標 `35943112-862a-4da0-97b2-f9ba6663e99b:4`。上輪幾何保存／垂線評分修正已加入；獨立執行七個 model、scoring、persistence、lifecycle、UI、accessibility、shared-scorm 測試檔通過。已有 SCORM ZIP 及 extracted 目錄。工作者聲稱本機 M1–M4 完成，但管理者尚不接受該完成標記。

實際 browser runner 只在 iframe trusted touch 拖動 originHit 畫方向，其餘目標僅檢查存在／CSS，未驗 θ／公式卡拖動、各已畫目標直接編輯、pointermove/up/cancel、全部 owner 位置指標及面板上界。fixture 為 390×500 iframe，但仍需補其他窄屏／橫屏／縮放及完整矩陣。lifecycle.test 仍主要測 helper，缺 main.js 與真 shared runtime 的 mock-LMS 多結果流程。已發同一 worker 修正段落，要求證據與完成標記一致。

另獨立故障注入證實 standalone bundle 仍逐欄持久寫入，並非整個 checkpoint transaction 原子提交：pending 三次寫入成功、review snapshot 寫入成功、下一欄失敗後，submitResult 回 frozen/score-min；重新載入變 `inconsistent: unfinished-with-review`，無法恢复本應保留的 pending。已要求在 commit 邊界原子保存及測試中途欄位失敗／重載。

不需新代理或使用者決策；繼續同一 Luna 任務補測修正。全 repo 無關 browser runner 應有界等待並誠實記錄 timeout，不影響本活動剩餘驗證。尚未整合或交付，heartbeat 保持 active。

## 管理者巡查：2026-09-18 12:40（澳門時間）

唯一 Luna 任務仍 active，進度游標 `35943112-862a-4da0-97b2-f9ba6663e99b:3`。M0 matrix 與本地保存契約已擴充；重力 θ 已改到 mg 與向內法線之間。bounded CSS、三題、scoring／persistence／lifecycle、manifest 已有實作；工作者正在改寫 source／extracted browser checks，尚未驗收 M1–M4。

管理者獨立執行 model、scoring、persistence、lifecycle、shared-scorm 共五個測試檔，全通過；但額外實際 model continuation 重現兩個未覆蓋問題：

1. formulas 步驟把分力移錯再移回後，幾何正確但 θ 尚未重標；decoder 拒絕為 `formula-without-theta-0`。須支援此合法修復中草稿。
2. 垂線延長穿過垂足後，model 接受完整幾何，scoring 卻因終點不在垂足而扣分。須按「抵達或穿過」一致評分。

另由 production glue 審查發現：invalid pending 沒有 quarantine，仍可重試；缺失 LMS 分數被 Number 空字串變成零；standalone 儲存失敗訊息會被 render 覆蓋，讀失敗被視為空白草稿，且缺少本地完成後重新開始入口。已把具體修正／測試段落發到同一 worker。既有 lifecycle tests 主要驗證 helper，不能代替 main.js 與 shared runtime 的實際協作測試。

本輪不整合未完成程式，不宣稱 browser／Moodle／實機驗收。heartbeat 繼續。

## 管理者巡查：2026-09-18 12:06（澳門時間）

已直接查閱唯一 Luna 任務的 compact progress、工作樹 production plan 及正在修改的 model。任務仍 active；尚未宣稱 M1–M4 通過，也未整合未完成程式。進度游標 `35943112-862a-4da0-97b2-f9ba6663e99b:2`。

已向同一工作者發送修正段落：

- M0 matrix 必須涵蓋任何題目的空白入口、各步驟零項入口、一般返回前步但保留下游作圖／公式、失效幾何及 review-edit，並逐項 round-trip + legal continuation。
- shared SCORM 的 standalone localLog 只有記憶體；須落實可跨 reload 的本地草稿，不能把 in-memory log 當作保存／恢復完成。負座標合法，不得一律拒絕。θ 評分為單項 20 分，修正表述。
- 重力題目前候選弧畫成 O 點水平與斜面夾角；須改為分解三角形中與已知斜面角相等的銳角，例如 mg 與向內法線分力之間。題目所給斜面角與學生標示目標需清楚區分；互餘角不可冒充同一 θ。
- 儘早完成 M1 bounded panel 與來源 trusted-touch 證據；自主續做，不需等待例行批准。M0 修正前只屬初稿，尚未驗收。

本輪只作規格及實作中程式審查，未執行或宣稱最終測試／Moodle／實機驗收。30 分鐘 heartbeat 繼續。


# 生產計劃（由 `NEW-SIMULATION-PLAN-TEMPLATE.md` 完整展開）

## Scope

- Slug：`force-orthogonal-decomposition`
- 學習目標：學生能把一個力按兩條互相垂直的指定方向分解，理解投影、箭頭方向、θ 的幾何語意，以及由鄰邊／對邊判斷 `sin θ`／`cos θ`。
- 學生任務：在三個固定情境中，依序畫兩條分解方向、從原力作兩條垂線、畫兩個分力、標示 θ，再以三角函數表示兩個分力大小；可檢查、返回修改，最後在總覽提交。
- 主互動：Pointer Events 拖曳及鍵盤替代操作；局部 snap 只修正目前端點，直接編輯保留其他作圖；三題可切換並各自保留草稿。
- Runtime files：`index.html`、`styles.css`、`model.js`、`scoring.js`、`persistence.js`、`main.js`，以及 `../shared/styles.css`、`../shared/scorm.js`、`../shared/activity-flow.js`。
- Libraries：`none`；只使用原生 SVG、DOM、Pointer Events 及共享 SCORM runtime，不使用 MathJax 或外部字體／繪圖引擎。
- Assessment risk：`formative`（瀏覽器端分數可被 learner tools 修改，不作高風險成績邊界）。
- Trusted validation：不適用；若日後變成正式高風險評核，須把答案驗證移到 Moodle／後端，不把秘密放入 learner JavaScript。
- Out of scope：隨機題庫、數值計算器、任意拖動原力、完整 undo stack、真實 Moodle／實體手機驗收（本工作樹無該環境）、外部發布。

## Catalogue metadata

```js
{
  title: "力的正交分解作圖練習",
  folder: "force-orthogonal-decomposition",
  categories: ["Mechanics"],
  description: "在水平、斜面外力及斜面重力三個情境中畫出正交分力並以 sin θ／cos θ 表示大小。",
  tags: ["physics", "mechanics", "forces", "vectors", "orthogonal-decomposition", "components", "scorm"],
  status: "active"
}
```

## Subject model and fixed scenarios

使用一個小型幾何模型：原點 `O`、固定原力箭頭端點 `P`、兩條通過 `O` 的無箭嘴方向線、從 `P` 出發的垂線段，以及從 `O` 指向兩個可見交點的分力。情境只提供不同的 scene data，不建立任意座標編輯器。

1. `horizontal-vertical`：`F = OP`，方向軸為水平／垂直；θ 可由學生在 `O` 或 `P` 選四個銳角，互餘角用相應 `sin`／`cos`。
2. `inclined-external-force`：物體在傾角 28° 的有厚度斜面上，受固定斜向外力 `F`；方向軸為平行／垂直斜面；θ 仍由學生自由選兩個銳角，不接受僅由按鈕文字推斷的角度。
3. `inclined-gravity`：物體在同一類斜面上，固定原力為豎直向下 `G`；題目已給斜面與水平的傾角 θ，學生須在分解圖標出同一個 θ，不接受互餘角冒充同一 θ。第三題固定命名為 `Gₓ`＝平行斜面分量、`Gᵧ`＝垂直斜面／向內法線分量；學生不可把兩者對調，對調時分力評分項目不成立。大小關係為 `Gₓ = G sin θ`、`Gᵧ = G cos θ`。

每題的原力、斜面角及幾何在題目設定中固定，避免零分量及近退化角。分力名稱依實際建立次序為 `F₁`、`F₂`；公式只表達大小，箭嘴表達方向。

## Responsive layout contract

- Control-panel classification：`bounded split-panel`。
- 原因：三題、五步作圖、公式答案、回饋及提交控制需要反覆操作；舞台在操作控制時必須固定可見。
- Phone stage track：`minmax(13rem, 44vh)`，在支援時使用 `44dvh` 上限；控制區是剩餘高度，`overflow-y:auto`，`overscroll-behavior:contain`。
- Desktop/tablet：舞台固定在左側、操作面板在右側且獨立捲動；窄屏改為舞台上方、面板下方，兩者不因對方內容自然撐高。
- Non-interactive stage swipe owner：enclosing page／Moodle host；`touch-action: pan-y`。
- Independently scrolling control-panel swipe owner：control panel only；面板頂／底 boundary 也不把手勢傳給 host。
- Activity-document scroll invariant：bounded activity 的 `html`、`body`、fixed app shell 及 stage chain 沒有可用的垂直 scroll range，不成為第三個 scroll owner。
- Extreme height/zoom：縮放 stage SVG 及文字、讓 controls 保留最小可用高度；不新增 stage 垂直 scroller；主要按鈕在 panel 內可達。

## Touch gesture ownership contract

### Draggable target inventory

| Target type | Stable hit target | Pointer capture | Rendering replacement |
|---|---|---|---|
| 方向線起筆／方向線控制點（每題兩個） | 固定 HTML `.stage-hit` button | 原 button | No |
| 垂線起筆／垂線終點（每題兩個） | 固定 HTML `.stage-hit` button | 原 button | No |
| 分力起筆／分力箭頭（每題兩個） | 固定 HTML `.stage-hit` button | 原 button | No |
| θ 標籤座／已放置 θ | 固定 HTML `.theta-hit` button | 原 button | No |
| `sin θ`、`cos θ` 公式卡片 | 固定 HTML `[data-formula-token]` button | 原 button | No |

### Complete matrix

| Touch starts on | Expected owner | Expected scroll delta | Required result |
|---|---|---|---|
| Known non-interactive stage blank | enclosing page／Moodle host | host and iframe move together; activity document、activity visual viewport、panel all 0 | no learner-state change |
| Independently scrolling control panel | control panel only | panel non-zero when range exists; host、iframe、both visual viewports、activity document 0 | stage stays fixed; no learner-state change; top/bottom repeated |
| Every target type above | simulation | all host/activity/panel/viewport/iframe deltas 0 | trusted `pointermove` + `pointerup`, no `pointercancel`, intended answer changes |

The source page and extracted SCORM launch page use the same topology. The
activity never forwards stage gestures to the sibling panel. Stable targets
have `touch-action:none` before `pointerdown`; visual SVG is `pointer-events:none`.

## Scoring

- Total：100，三題等權（內部以 100/3 的有理權重後四捨五入至整數）。
- 每題五組各 20 分：方向線、垂線、分力、θ、公式；方向線、垂線、分力及公式四組各含兩個 10 分條件，θ 是一個 20 分條件。
- 方向線：兩條軸各匹配該情境的 `parallel/normal`（水平題為 horizontal/vertical）。
- 垂線：兩條均垂直於不同方向線，且線段抵達或穿過相應垂足；每條 10 分。
- 分力：兩支箭頭端點與兩個可見垂足交點一致，且方向線各一支；每支 10 分。
- θ：這一組是一個 20 分條件（有合法 θ 語意鍵並標在本題可接受的角弧）；錯誤／缺少得 0 分。自由角接受合法 O／P 的等值或互餘候選；已知斜面題只接受分解三角形內、等於題目斜面傾角的指定 `theta-incline`。
- 公式：兩個分力函數各 10 分；缺填及錯填只影響相應的 10 分項。公式卡只收集學生答案，練習期間沒有公式檢查按鈕或即時對錯提示。
- 未完成題於 final-state score 中按已完成的觀察給部分分，不另加操作次數懲罰；最低 0，最高 100。第三題的分力項目另外要求 `F1` 對應 `Gₓ`（平行斜面）、`F2` 對應 `Gᵧ`（垂直斜面／向內法線）；倒轉位置時相應分力項目得 0 分。練習及提交前檢查只顯示保存／待評核狀態，不顯示數字分數、公式對錯或錯誤分組；三題最終提交並鎖定後，review 才列出每題五組的已得／待修項。

## Tolerance

- 方向 snap：滑鼠 14 CSS px、觸控 20 CSS px、鍵盤 12 CSS px；方向角 ≤10°；同軸重複以 12° 拒絕。
- 垂足／交點 snap：同上 pointer threshold；已吸附 target 在 1.3 倍 exit radius 內保持；線段必須實際抵達或穿過，不補長。
- θ snap：24 CSS px，1.3 倍 sticky exit；必須落在候選銳角扇區。
- 幾何驗證：單位向量正交誤差 `1e-5`，端點誤差 `1e-5`；所有 persisted numbers 必須 finite 且在 scene world bounds 內。
- Just-inside/outside：19.9/20.1 CSS px、9.9°/10.1°、24/24.1 CSS px；constants 集中於 `model.js`。

## Phase/state matrix

本活動只有 production UI 能 render 的 `practice`、`summary`，以及 shared runtime 擁有的 `review`／`pending-final` lifecycle states。每一題的 construction phase 仍是答案內的 semantic phase。

| Activity phase | Variant/invariant | Current step | Required semantic state | Must be absent/pristine | Allowed next action |
|---|---|---:|---|---|---|
| `practice` | fresh question | 0 | `questions[0]` 是 `directions` 且空白；三題 scene id 固定 | 該題垂線、分力、θ、公式均空；後兩題可有 pristine state | 畫第一條方向、換題、保存 draft |
| `practice` | in-progress directions | 0 | 本題 1–2 條方向，順序及 axis keys 權威 | 若方向少於 2 條，後續垂線／分力／θ／公式必須 pristine；若由後步返回，已完成的下游資料可保留 | 畫第二條、編輯、重畫、換題、返回後續 |
| `practice` | directions from back-navigation | 0 | 兩條方向及可驗證的已保留下游幾何；phase 只表示目前工具，不表示刪除了後步 | 不得有 dangling target 或不符合矩陣的跳步資料 | 編輯方向、下一步回到原工具、換題 |
| `practice` | in-progress perpendiculars | 1 | 兩條方向已存在；垂線 1–2 條及 target keys | 若垂線少於 2 條，後續分力／θ／公式必須 pristine；由後步返回時可保留完整下游資料 | 畫第二條、編輯、返回方向 |
| `practice` | perpendiculars from back-navigation | 1 | 方向、垂線及可驗證的已保留分力／θ／公式 | 關係鍵必須仍能由現有線段解析 | 編輯垂線、下一步、返回方向 |
| `practice` | in-progress components | 2 | 方向及垂線已存在；分力 1–2 條，target 可為 null；已有的 F1/F2 均可直接編輯 | 若分力少於 2 條，θ／公式必須 pristine；由後步返回時可保留既有 θ／公式 | 畫下一支、編輯已有分力、返回 |
| `practice` | components from back-navigation | 2 | 完整分力及可保留的 θ／公式；可直接修復上游 | 關係鍵及 θ 必須可解析，失效 θ 必須為 null | 編輯分力、下一步、返回 |
| `practice` | angle geometry-valid | 3 | 兩支分力及完整可驗證幾何；θ 可為已吸附 key，或以 `thetaPoint` 保存未吸附的放手座標 | 無 θ 時不得進公式；公式 null 或既有 answer | 放／移 θ、改圖、返回 |
| `practice` | angle/formulas theta released | 3–4 | `theta:null` 且 `thetaPoint` 是有效世界座標；θ 仍可由該位置拖近角弧重新吸附 | 不得把未吸附 θ 當成合法公式角度 | 拖近角弧重新吸附、改圖、返回 |
| `practice` | formulas geometry-valid | 4 | 完整幾何、合法 θ、`thetaPoint:null`、`F1/F2` 可 null/sin/cos | 練習期間不顯示公式對錯 | 填／清公式、編輯分力、返回；三題最終提交後由 review 評核 |
| `practice` | formulas geometry-invalid continuation | 4 | 兩支分力仍存在但上游直接編輯使幾何失效；既有公式可保留 | 不得把失效幾何當作已完成；θ 清除 | 修復線／箭頭，或返回；不可得到成功公式 feedback |
| `practice` | formulas repaired-geometry-awaiting-theta | 4 | 直接編輯先使幾何失效、再修復至正確；θ 已清除；原有公式嘗試仍保留 | 不得把未重標 θ 當作可用公式；不可丟棄合法下游答案 | 返回 angle、重新放 θ、再進公式；保存／重載／繼續 |
| `practice` | from-summary review-edit | 0–4 | `fromReview:true`；目前題答案與原 summary 完整保留，可編輯任何已完成題 | 不可清除未選中的其他題；不把 summary 當成 final review | 修改、返回 summary、保存 draft |
| `summary` | editable overview | n/a | 三題答案均存在且各自通過 decoder；currentQuestion 指向最後操作題 | 無新增幾何；不修改答案；不顯示分數／分組回饋 | 返回任一題、提交；保存 draft |
| `review` | finished/review-only | n/a | review snapshot 三題 authoritative answers；shared result 驗證後顯示 | 不得建立新 draft；所有作圖、公式、提交按鈕鎖定 | 閱覽題目及可信 summary |
| `pending-final` | frozen retry | n/a | shared runtime 保存 immutable review payload | 不得改答案或重算另一 payload | retry 同一 payload；只顯示未確認 technical state |

Transitions：`practice -> summary` when learner opens pre-submit overview；`practice` phases may move backward without clearing downstream semantic data；`summary -> practice` when editing a selected question and sets `fromReview:true`；`summary -> review` only after shared `success/committed`；`summary -> frozen` on pending-final／frozen；`review` never returns to editable practice。

## Versioned persistence contract

`persistence.js` 是唯一 activity decoder；使用 `SimScorm.makeSnapshot()` envelope semantics，但由 activity 先驗證內層。`SCHEMA_VERSION=1`、`ACTIVITY="force-orthogonal-decomposition"`、三題 scene IDs 是 authoritative enum。

### Canonical draft answer

```js
{
  schemaVersion: 1,
  phase: "practice" | "summary",
  currentQuestion: 0 | 1 | 2,
  fromReview: boolean,
  questions: [{
    scenarioId: "horizontal-vertical" | "inclined-external-force" | "inclined-gravity",
    phase: "directions" | "perpendiculars" | "components" | "angle" | "formulas",
    directions: [{ key: "D1" | "D2", unit: {x:number,y:number}, axisKey:string|null }],
    perpendiculars: [{ key: "P1" | "P2", end:{x:number,y:number}, targetKey:string|null }],
    components: [{ key: "F1" | "F2", end:{x:number,y:number}, targetKey:string|null }],
    theta: string|null,
    thetaPoint: {x:number,y:number}|null, // only when theta is unsnapped
    formulas: { F1: null | "sin" | "cos", F2: null | "sin" | "cos" }
  }]
}
```

### Canonical review answer

```js
{
  schemaVersion: 1,
  questions: [/* the same three authoritative question objects */]
}
```

The activity answer is sufficient to redraw scenes, rescore, and continue an
editable draft. Saved score/pass metadata is comparison data only; finished
restore always validates -> decodes -> recomputes score -> calls
`SimActivityFlow.reviewResult(computed, saved, MoodleAttempt)`.

Authoritative：scenario id, direction units/axis roles, endpoint geometry,
target relationship keys, θ semantic key, formula answers, activity phase/current
question/fromReview。Derived：DOM ids, hit-target positions, SVG paths, cached
feedback, selected formula, pointer coordinates/capture, hover/animation state,
cached score totals。Relationship keys are authoritative and validated for
uniqueness/references；generated DOM ids are rebuilt deterministically as
`D1/D2`、`P1/P2`、`F1/F2`。

Invalid snapshot policy：editable corrupt/inconsistent draft produces a technical
load lock (no silent meaningful reset)；the technical lock also provides an
explicit, confirmed recovery action that clears the standalone checkpoint or
overwrites the LMS draft with a fresh validated draft, and only reloads after
that durable operation succeeds。finished invalid review remains locked and
shows only trustworthy Moodle score/status fallback；pending-final is owned by
shared runtime，activity first validates the nested review and immutable result
metadata against the payload, and calls `SimScorm.quarantinePending()` immediately
when that validation fails。Quarantined pending data keeps the durable checkpoint
for diagnosis but exposes no retry／edit／automatic unload retry action。Standalone
先由 activity 呼叫 `SimScorm.enableStandalonePersistence(ACTIVITY)`；shared runtime
以同一個 validated checkpoint bundle 原子保存 `cmi.suspend_data`、score/status
欄位到 browser `localStorage`，再走 `loadAttempt()`／`startup()`。probe 後的讀取失敗、寫入／quota 失敗
均轉成明確的 unavailable／read-only 狀態；activity 可繼續本頁 memory-only，
但不得宣稱 durable save 或把新舊欄位混寫，並會在 reload 顯示實際可恢復範圍。
不在 activity 內直接讀 raw LMS fields。

## Shared SCORM lifecycle

Startup calls `SimScorm.enableStandalonePersistence(ACTIVITY)` then
`SimScorm.loadAttempt(ACTIVITY)` and `SimActivityFlow.startup(attempt)`。`new/draft`
restores editable state and registers a draft provider；`finished` restores review；
`pending-final` is frozen；read/inconsistent errors lock technical UI. Draft saves
occur after semantic changes and on page lifecycle through
`SimScorm.setDraftProvider()`；LMS mode 不改變，standalone 只是 shared runtime 的
durable adapter。

Submission creates a validated review snapshot and final-state result, then calls `SimScorm.submitWithCallbacks(result, reviewSnapshot, callbacks)`。Handlers route `success`、`committed`、`frozen`、`retry` through `SimActivityFlow.submission()`；technical pending／retry UI never says submitted、passed or failed until the shared result is confirmed. Standalone local mode may retain an in-memory/local shared-runtime draft log but only describes it as local draft, never as Moodle submission。完成的本機 review 提供明確的「清除本機紀錄並重新開始」路徑；這不是 Moodle submission，且只有清除成功後才重新建立空白 local attempt。

## Test plan and evidence targets

- `scoring.test.js`：all five groups, partial credit, all three scenarios, formula mapping, 0–100 floor/ceiling。
- `persistence.test.js`：production-shaped round trip for every matrix row（包括零垂線／零分力、普通返回保留下游、錯圖 angle、formulas invalid continuation 及 summary review-edit），one legal continuation per row, max draft/review byte assertion, invalid enum／NaN／Infinity／越界／dangling keys／phase skips／old alias rejection, score equality；負座標及負方向分量是 gravity 的合法資料，不可一概拒絕。
- `sim/shared/scorm.test.js` 的 activity-specific durable standalone case：實際 reload 恢復三題 authoritative snapshot；probe 成功後 read failure、write／quota failure、reload 後舊 checkpoint atomicity、storage unavailable／read-only 時只回報實際狀態，且不污染另一個 activity。
- `lifecycle.test.js`：production render glue for startup review/editable/frozen/load-error and submission success/committed/frozen/retryable/non-retryable retry plus trusted/untrusted finished result。
- `ui-runtime.test.js` / `accessibility.test.js`：manifest scripts, no MathJax, math typography, locked review, keyboard labels, three question metadata。
- `tools/force-orthogonal-decomposition-browser-regression.test.js`：static contracts updated for bounded panel, manifest/runtime dependencies, stable target inventory and touch matrix。
- `tools/force-orthogonal-decomposition-playwright-check.js`：trusted mouse/keyboard and all three scenario paths；320×500、390×500/600、landscape、toolbar/zoom、panel top/bottom；embedded host metrics for blank stage/panel/each target；invalid pending quarantine、finished reload、local reset route；source launch and extracted package launch。
- Package checks：`npm.cmd run check`、activity tests、`npm.cmd run package:all`、ZIP root/exact manifest entries、extracted launch；full repo `npm.cmd test` result recorded separately if the existing position-time Chrome/CDP blocker reproduces。
- No claim of Moodle or physical-device acceptance without external evidence; final handoff lists that validation as remaining。

## M0 evidence

- 2026-09-18：已讀 `AGENTS.md`、shared style／SCORM production guide、template、MVP、roadmap；已由 `C:/Users/frens/Documents/Projects/simlab` 複製 approved activity、三份計劃及四個專項 runner 到本工作樹，未修改來源。
- 2026-09-18：本完整 production plan、phase/state matrix、versioned snapshot、scoring、touch inventory 先於 `persistence.js` 建立；M0 文件基線完成並已進入 implementation。

## Milestone evidence log

| 段落 | 狀態 | 證據／風險／下一步 |
|---|---|---|
| M0 | 修訂完成 | 補上 ordinary back-navigation variants、repaired-geometry-awaiting-theta、pending quarantine 及 standalone failure contract；已由 production decoder／runtime tests 覆蓋 |
| M1 | 已完成（本機證據） | source + extracted trusted touch matrix：blank stage host、panel range／top-bottom boundary、每類 stable target drag；最後完整 browser command 通過 source／extracted direct、embedded source／packaged 390×500／320×500；仍未宣稱實機 Moodle／手機 |
| M2 | 已完成（本機證據） | 三情境 scene geometry、fixed slope θ glyph（實斜面 vertex + horizontal reference ray）、gravity body-plane contact、F1/F2 creation-order formula mapping、past/exact/crossing-foot scoring；activity tests 與 final trusted browser command 通過 |
| M3 | 已完成（本機證據） | production round-trip、repair→re-angle continuation、invalid pending quarantine、review reload、local reset、final lifecycle；`node sim/shared/scorm.test.js`、activity lifecycle tests 及 production browser routes 通過 |
| M4 | 已完成（本機證據） | `npm.cmd run check`、`npm.cmd run package:all`、11-file `force-orthogonal-decomposition-scorm.zip`、extracted launch、source + packaged responsive/trusted-touch/lifecycle checks 通過；完整 repo `npm.cmd test` 仍在既有 `position-time-browser-regression.js:307` Chrome DevTools WebSocket blocker 中停止，非本活動失敗 |

## Final verification record

- 2026-09-18：`node sim/force-orthogonal-decomposition/model.test.js`、`scoring.test.js`、`persistence.test.js`、`lifecycle.test.js`、`ui-runtime.test.js`、`accessibility.test.js`、`node sim/shared/scorm.test.js` 及 `node tools/force-orthogonal-decomposition-browser-regression.test.js` 全部通過。
- 2026-09-18：`npm.cmd run check` 通過；`npm.cmd run package:all` 通過，force package 為 11 files。
- 2026-09-18：`tools/force-orthogonal-decomposition-browser-regression.sh` 通過。這一輪使用 owned ephemeral static server，驗證 source／extracted direct（390×600、320×500、landscape desktop、三題 reload、review lock、local reset）、source／packaged embedded host（390×500、320×500；blank-stage host owner、panel range／top-bottom、direction／perpendicular／component／docked θ／P-angle θ／formula token target gestures；trusted pointerdown/move/up、無 pointercancel、host／iframe／activity／visualViewport／stage／panel metrics 不變），以及 gravity 320×500 full construction、fixed slope θ surface marker、body-plane contact。
- 2026-09-18：同一 shell 的 production lifecycle leg 通過 success、committed finish retry、frozen final commit/reload/retry、retryable precommit、nonretryable preflight、invalid nested pending quarantine、finished missing-score fallback、finished mismatch fallback、review lock。
- 2026-09-18：`npm.cmd test` 已跑至既有無關的 `tools/position-time-browser-regression.js:307`，因 Chrome DevTools WebSocket failed 退出；在該 blocker 前已通過本輪前置 repo tests，不能把此結果宣稱為完整 repo green。
