# SimLab 測試與 GitHub CI 改善計劃

日期：2026-10-13。
狀態：P0–P4 實作與首輪自動驗收通過；正式採用以 main 的 check 及相同實作版本的獨立 full-check 結果為準。
規劃分支：codex/improve-ci-testing。
盤點基準：a8be3a5dc738421ea5824cb83dff597263434cfe。

規劃階段只交付本文件及審核記錄。使用者其後批准補入階段交接條件並開始 P0／P1，達標後連續推進 P2–P4，不逐階段再次詢問。實作範圍為測試、CI、打包驗證及文件；若需要修改模擬本身，先告知使用者。

## 2026-10-22：等待、失敗診斷與分片權重

使用者批准在 `codex/ci-stability` 處理檢視建議 1、3、4。範圍為測試工具與文件；物理、評分、學生 snapshot、活動輸入時序及工具搬檔不在本批範圍。

其後使用者批准追加第 2 項共用測試輸入。首次分支完整 run `39725697099` 的 262 項有 261 項通過；電路評量在滑片拖動後的 `#check` 收到可信 pointerdown／pointerup 與 touchstart／touchend，但沒有 click，保留首次失敗 artifact。本機修改前後各 100 次聚焦流程均通過，未能解釋固定 Linux／Chrome 的失敗。追加範圍為普通控制的定位、捲動／畫面就緒及原生點按完成證據；保留拖動／採樣／取消及活動狀態斷言，只有有證據的輸入校準才調整時序，不以重點一次、程式 click 或放寬斷言通過。驗證須包括共用 helper 的拒絕案例、source／ZIP、手機／桌面與宿主／fullscreen，最後提交再跑正式完整 CI。獨立 `codex/ci-touch-diagnostic` 只收集相同固定環境的原因與候選證據，不能提供正式 gate／receipt，也不合併其臨時 workflow。

根因證據：診斷 run `39729679249` 重現原輸入失敗。Chrome trace 在滑片放開後出現約 764 px/s 的水平 `GestureFlingStart`，下一個 `#check` 的 touchStart 觸發 `GestureFlingCancel`，tap 經過 suppression 後未派送 DOM click；當時文件已先發出 scrollend。單純改用 `synthesizeTapGesture` 亦失敗，未採用。修正讓此「停定的滑片拖動」在放開前停留 100ms。run `39730065097` 的兩個獨立候選（停定、停定加零位移採樣）各通過原 842 checks 與 source／ZIP 各 50 次原流程，共 1042 checks；選擇較小的停定版本。首次失敗 trace 完整保存於 `output/ci-tests/touch-diagnostic-original-39729679249/`；成功候選的 trace 匯出超時，只有完整斷言結果，不宣稱取得成功 trace。

普通控制共用 `clickControl`，先供電路評量及運動合成、力平衡兩版、牛頓第二／第三定律共六個 driver 使用；其契約見[生產指南](../docs/simulation-scorm-production-guide.md#browser-check-tooling)。既有 DC／AC 的已校準拖動、取消與採樣路徑不做全面遷移。既有 helper 自測補入遮擋／隱藏／停用、移動宿主 frame、錯誤目標／非可信／缺少 click、通訊失敗及 listener 清理；缺少 click 只會失敗，不會再次輸入。沒有新增依賴、測試入口或工具搬檔。

追加第 2 項的提交前驗證：固定 Linux／Chrome 診斷 run `39730913162` 使用最終共用 helper 與停定修正，通過 helper 自測及 1042 checks（原 842 加 source／ZIP 各 50 次聚焦操作）；結果保存於 `output/ci-tests/touch-diagnostic-shared-control-39730913162/`。本機電路評量完整 842 checks、helper／CI plan 自測、check／check:tests、文件連結與 diff 檢查通過。新增輸入失敗加次要清理失敗的注入驗證仍保留原錯誤、事件及截圖，見 `output/ci-tests/ci-stability-controls-injected-assessed-cleanup/`。運動合成完整本機回歸及最後提交的正式完整 CI 另行執行，以上聚焦結果不代替正式完整驗收。

- 將吞掉所有例外的初始化／條件輪詢改為有總截止時間的共用等待。只有已知導航 context 暫態可以重試；缺少尚未載入的 iframe 明確回傳未就緒，通訊超時、斷線與程式錯誤保留原錯誤。活動自己的就緒條件保持。
- 電路評量與 AC 在首次失敗時保存案例、最後操作、狀態、事件及截圖。診斷有獨立上限，不參與成功路徑的效能量測；診斷或清理失敗不能掩蓋原錯誤。
- 權重只取已核實完整成功的 main run `39719145504`（`4aa4d50680f9c757b932e7db08be118f80142950`）之入口耗時。保留全部入口、八個 browser 分片及既有 gate；回算改善不當作新 CI 實測。
- 驗證：補入現有工具自測，涵蓋等待成功／導航／致命錯誤／掛起、診斷部分失敗與超時、權重覆蓋完整清單；執行全部 Node、check／check:tests、committed selection preview，以及分支完整 CI。首次失敗照實保留，不以重跑綠燈取代修復證據。

提交前證據：共用工具自測、CI 分片自測、check／check:tests（222 Node＋35 browser）、文件及 diff 檢查通過。真實 Chrome 在電路評量及 AC 首次原生滑鼠操作後注入指定錯誤，兩個入口均拒絕並保留同一錯誤物件，保存 source／案例、最後操作座標、可信事件、實際狀態與截圖後清理完成；診斷本身掛起／部分失敗／無法寫檔亦有自測。證據為 `output/ci-tests/ci-stability-injected-assessed/`、`ci-stability-injected-ac/` 及對應 log。

分片回算：以該成功 run 的實測入口耗時，更新後八片估算為 1255／1238／1233／1237／1228／1240／1230／1235 秒；舊分配最慢約 1537 秒。這是相同資料的編排估計，沒有宣稱已取得約 4.7 分鐘的遠端提速。全部 Node 與電路評量 source／ZIP 本機完整驗證另存 `output/ci-tests/ci-stability-node/`、`ci-stability-assessed-full.log`；分支實際完整驗收與耗時以最後提交的 Actions 結果為準。

## 2026-10-20：活動測試變更的基線判定修正

- 本次僅修改CI工具／測試及其文件，物理、評分、學生snapshot與Sites為N/A，不發布學生活動。使用者已授權驗證後commit／push。
- 原policyHash涵蓋所有tools及sim測試內容，活動測試變動令既有main receipt失效。拆成核心policyHash及完整testInputsHash：只有既有登記、可由selector完整映射到活動browser scope的測試／helper可排除於核心指紋；workflow、選擇器／registry／runner／gate、共用或未知helper、shared測試、依賴與baseline JSON仍屬核心。
- 不放寬main receipt的repository／workflow／push／main／SHA／完整來源校驗、ancestry、精確比較基點、PR實際merge candidate及API失敗全量規則。完整testInputsHash仍納入不可變plan，rerun必須同SHA／policy／完整測試輸入，不能用未驗證基線或舊版receipt跳過本次核心變更。
- 本次CI核心修正及舊指紋遷移會全量；需新規則進入main並有成功receipt後，活動測試變更才選跑相關browser／套件，全部快速Node照常必跑。不同分支成功不能冒充main；不自行合併main或啟動額外遠端workflow。
- 先補既有ci-prepare測試：活動Node／browser／owned helper對核心指紋不變但完整指紋改變，實際prepare＋main receipt採用affected；核心／shared／未知變更仍full，失敗／缺失／偽造／不在ancestry／未驗證base維持拒絕，rerun更換活動測試即拒絕。沿用既有登記，跑CI工具測試、全部Node、check／check:tests、文件／diff及committed selection preview；不將preview或本機測試當新GitHub綠燈。

### 本次驗證及交付

- 全部213個Node入口通過，`output/ci-tests/baseline-policy-fix/report.json`為status=passed、213/213，沒有失敗；包含ci-prepare正式Git／mock GitHub main receipt流程、selector、不可變plan、rerun及aggregate gate檢查。四種活動Node／browser／helper修改均沿用相同核心policy，完整testInputsHash改變且實際prepare選affected；相關browser scope及套件保持，全部快速Node保留。15類核心／共用／未知輸入變更仍全量，缺失／錯policy／錯repository／不完整／API失敗／非ancestor的main證據亦拒絕。
- 實際建立plan後再次改動活動測試，core policy仍相同，但recoverPlan依完整輸入指紋拒絕；原SHA／run／plan內容、expired／duplicated artifact及PR merge／未驗證main base保護全部保留。指紋使用版本標識及逐檔路徑／內容digest紀錄，避免把不同檔案邊界混為相同輸入。舊receipt沒有自動遷移成新規則的成功基線。
- check、check:tests（246 entries／213 Node／33 browser／48 helpers／2 manual）、修改文件連結及工作區／完整分支diff通過；沿用既有ci-prepare測試登記，無新增測試入口、相依或workflow。Committed selection preview以62cf599與本輪提交比較，保存`output/selection-preview-ci-baseline-policy.json`；本次修改核心及生產契約，預期full，不代表本機重跑了33 browser或已取得遠端CI成功。
- 本輪不改sim runtime、不更新Sites、不合併main、不手動觸發其他workflow。新規則需合併main並完成一次新policy的main成功receipt後，後續活動測試改動才能沿用該基線；在此之前仍保守全量。新push CI狀態另記`output/ci-baseline-policy-push.json`，沒有以舊分支綠燈代替新policy驗收。

## 1. 決策摘要

採用「快速必跑、按影響選跑、完整回歸及發佈驗收」的執行方式。保留有價值的測試，減少無關重跑、固定等待、重複啟動和不均衡分片。先改善報告及基準，再改測試選擇，最後處理最慢的瀏覽器群組。

第一版沿用 Node、GitHub Actions 和現有 Chrome/CDP 工具，不全面遷移 Playwright Test，不新增測試服務、自架 runner、資料庫或大型依賴分析框架。這些選項只有在現有方案經量測仍不能達標時才另案評估。

使用者需要審閱的主要取捨：

| 建議決策 | 影響與補償 |
|---|---|
| 日常 CI 按改動選擇瀏覽器群組 | 未被選中的跨功能問題可能較晚發現；以保守依賴映射、未知變更全跑、定期全量及發佈 gate 補足 |
| 每次程式修改保留全部快速邏輯測試 | 保護物理、評分、持久化、SCORM 和 runner 本身，不以刪測試換速度 |
| 獨立瀏覽器群組失敗後繼續其他群組 | 首次結果能揭露更多問題；有界 timeout 限制故障成本，失敗情境內不繼續使用損壞的狀態 |
| 初期四個瀏覽器 job；P4 經使用者批准提高至八個 | 先減少工作量及等待，再驗證並行提速；同時比較總 runner 用量。Node 維持四片 |
| 日常通過與 package-ready 分開呈現 | 發佈必須有待發佈版本的完整證據，不能把日常綠燈當成全量或真機驗收 |

## 2. 適用契約與不降低的品質要求

共用規則仍由下列文件擁有，本計劃只定義測試編排及改善交付：

- [共享產品規則](00-shared-platform-and-style.md)。
- [生產指南與維護驗證原則](../docs/simulation-scorm-production-guide.md#verification-checklists)。
- [Package-ready](../docs/simulation-scorm-production-guide.md#package-ready-checks) 與 [Moodle-ready](../docs/simulation-scorm-production-guide.md#moodle-ready-checks)。
- [電路活動作者指引](../docs/circuit-activity-authoring.md)及[共用架構責任](../docs/circuit-workbench-architecture-review.md)。

這是工具及流程修改，沒有新的學生活動、rubric、權威答案或 learner snapshot；新活動模板中的這些欄位為 N/A。測試改造必須維持既有活動的權威資料及評量契約。

物理容差、部分分、空白提交、pending 凍結、recorded 唯讀、Moodle 同 attempt 恢復、standalone refresh、非法資料驗證、可信觸控、可讀性及可及性均按原契約驗證。除非另外證實規格本身有錯，不得為了綠燈放寬斷言。

source 與解壓套件是不同交付面，不能刪去其中一面。T0–T3 本地宿主與 T4 真 Moodle／真手機證據分開。夜間 CI 不能取代真機或真 Moodle。

## 3. 已核對的現況與證據界限

| 現況 | 證據／含義 |
|---|---|
| 正式 runner 登記 210 個入口 | [run-tests.js](../tools/run-tests.js)：191 個檔名以 .test.js 結尾、19 個其他瀏覽器入口；DC source／package 各算一個。這不是 assertion 數，也未把所有 .test.js 認定為純 Node 測試 |
| workflow 另外執行六個 browser 命令 | [quality.yml](../.github/workflows/quality.yml)：position-time、linear-motion、mobile-touch、driving、hookes-law、force-composition。現行 CI 的入口聯集為 216 項；後續仍須核對內部重疊 |
| 分片按清單位置取餘數 | 四片各約 52–53 項，沒有按實際耗時分配；大型 DC source／ZIP 腳本不可再細分 |
| 每片依序執行，第一個 child process 失敗即停止 | matrix 的 fail-fast: false 只保住其他 job，不能讓同一片後續入口繼續 |
| 每次 push 和 pull_request 均觸發 | 沒有 concurrency；相同提交 a8be3a5 推到 main 和新分支曾分別啟動完整 run |
| 沒有統一的 workflow artifact 上傳 | 部分腳本已有截圖／JSON，但缺少一致的失敗前置資訊、彙總及保留規則 |
| 電路 builder 可能改寫追蹤檔案 | [package-circuit-platform.js](../tools/package-circuit-platform.js) 的 build() 先執行 syncAssets() 更新資產清單及 manifests；CI 需防止默默測了修改後內容 |
| 電路普通點按也走拖動等待 | [DC browser runner](../tools/circuit-workbench-browser-regression.js) 的 touch() 即使位移為零仍送八次 move，固定等待 25 + 8×22 + 30 + 120 + 400 = 751 ms，未計通訊／取樣時間 |
| Linux 已加入 CJK 字體及 Xvfb | 這些修正需要保留；Node 22、ubuntu-latest、系統 Chrome 仍不是完整固定的可重現環境 |
| 維護規範已支持按改動驗證 | 生產指南容許維護時使用最小重現及受影響測試；新的／重大修改活動仍須完整驗收 |

歷史計時取自 [run 38366065338](https://github.com/frenselw/simlab/actions/runs/38366065338)，提交 1fc1629：

| Job | 結果 | 實際耗時 |
|---|---|---|
| suite (1) | 成功 | 23.9 分鐘 |
| suite (2) | 失敗，牛頓二 preview readable=false | 21.9 分鐘，非完整執行耗時 |
| suite (3) | 成功 | 51.7 分鐘 |
| suite (4) | 成功 | 58.2 分鐘 |
| browser | 成功 | 11.1 分鐘 |

以上為歷史瓶頸證據，不能宣稱目前 a8be3a5 全量通過。P0 必須記錄新基準的確切 SHA、環境及完整結果。近期問題包含環境差異、過時 fixture／操作及產品畫面缺陷；沒有證據把所有失敗都認定為 flaky。

## 4. 執行層次與預期時間

| 層次 | 何時執行 | 內容 | 初步目標 |
|---|---|---|---|
| 文件 | 變更全數落在已核准的純文件路徑 | 本地連結、空白格式、選擇結果及規範文件分類 | 1–2 分鐘 |
| 快速 | 每次程式／測試／設定修改；新分支無差異時也執行 | 全部已確認的非瀏覽器測試、JS 語法、manifest 語義、測試清單及依賴映射驗證 | 先量測；爭取 3 分鐘內 |
| 受影響回歸 | 日常 push／PR | 快速層＋受影響的既有 browser 群組、source／package 及套件檢查 | 單活動中位數 ≤10 分鐘、P95 ≤15 分鐘 |
| 共用核心回歸 | 共用引擎、樣式、觸控、SCORM 等修改 | 快速層＋所有消費者的相關完整群組；映射不足時升級全量 | 中位數 15–25 分鐘 |
| CI 全量 | 定期、手動、工具／依賴重大修改及發佈前 | npm run check、現有 216 入口的完整聯集及後續正式案例、全量 SCORM／電路平台打包、diff／覆蓋完整性檢查 | 優化後成功 run ≤45 分鐘為首輪目標 |
| 發佈驗收 | 新活動、重大修改、實際套件發佈 | CI 全量＋生產指南要求的完整活動矩陣及尚未納入 CI 的驗收；真機另列 | 品質 gate，不設縮減範圍的時間限額 |

時間是目標而非承諾或強制縮短 timeout 的依據。記錄 queue、setup、測試、打包及上傳時間，另列使用者從 push 到結果的總等待。總 runner 分鐘亦需比較，避免只靠更多機器改善牆鐘時間。

CI 全量的意思是「正式登記的自動化全量」，不能宣稱所有人工或真機要求已自動化。P0 需盤點 npm scripts、case modules、活動計劃及生產指南中的命令，特別是 mobile-scroll 的 host／phase／mode 矩陣；未自動化要求保留於發佈清單，不能因目前 workflow 沒有執行而刪去。

## 5. Workflow 與觸發規則

### 5.1 日常 Quality

沿用現有 workflow 名稱與最終 check 工作。保留 push 及 pull_request 事件；PR 驗證實際合併候選，與分支 head 驗證分開。

執行圖：

    plan → fast／docs
         → browser（按選中群組形成 matrix，P4 批准最多八個 job）
         → package（受影響套件）
         → check（彙總上述必要結果及完成清單）

plan 記錄 event、base/head/tested SHA、比較方法、選中項目與原因、預期的 job／entry IDs。不同分支之間不取消對方的 workflow；同一 workflow、同一 push ref 或 PR 編號有新執行時，取消其過時版本。手動完整驗收與日常執行使用不同 concurrency group。

第一版不建立跨分支／跨事件的成功結果快取。相同 commit 推到 main 與新分支時，main 按其未驗證差異執行；新分支若相對 main 沒有差異，只有能查證同 repository、正式 Quality workflow、push 到 main、同 SHA、同測試政策及固定環境設定下的完整預期結果成功，才只跑快速層。必須核對 workflow 身份、event、ref 及完成清單，不能只查名稱為 check 的成功。main 尚未完成、取消、失敗、查詢失敗或只有其他分支的輕量成功時，該分支升級全量。這是免測條件的來源驗證，不搬用另一個 run 的測試產物。

PR 合併候選不同，仍須執行其選中回歸。先避免過時 run、純文件及已驗證的無差異分支跑全量，不用複雜去重邏輯冒漏測風險。同名 check 的任意成功不足以證明基準合格；summary 必須標明 scope、tested SHA 及採用的 main run ID。

不要以整個 workflow 的 paths-ignore 跳過 required check。check 必須等待 plan、fast／docs、browser、package 的結果；只接受 plan 明確判定不需要的工作為 skipped，任何應執行工作的失敗、取消、缺少結果或覆蓋不足均失敗。plan 本身失敗時不能生成成功的 check。

空 matrix 必須有明確處理，不能建立非法 matrix；空選擇不能把應有的 Node／browser 工作悄悄省略。聚合檢查自身的測試要覆蓋成功、合法 skip、非預期 skip、failure、cancelled、缺失及部分 matrix 完成。

### 5.2 定期與手動 Quality Full

計劃新增獨立的 quality-full.yml，以不同的最終名稱 full-check 呈現。手動執行與定期執行共用同一個正式全量入口，避免兩套清單分叉。

full-check 是獨立可用的完整 gate，必須要求 npm run check（JS 語法及 manifest 語義）、npm test 的完整聯集、npm run package:all、npm run package:circuit-platform、已記錄比較範圍的 git diff --check、打包前後 tracked diff 及覆蓋完成清單全部成功。它不能假設同 SHA 的日常 check 已執行這些工作。套用第 5.1 節相同的結果聚合規則：必跑項被跳過、取消、缺少或部分完成都不能成功。

建議在澳門時間每日 03:30 對 main 執行；GitHub cron 用 UTC，對應前一日 19:30。P3 的 workflow 已加入此排程，部署到 default branch 後才會生效。GitHub 排程有延遲可能，不把它當作準時通知。

第一版每日執行，先取得連續穩定性資料；是否在完全相同 SHA、環境及測試政策且已有完整成功證據時略過，留待數據支持後另作小改動。沒有成功紀錄、上次失敗或環境更新時不能略過。

發佈由操作者指定精確 ref，執行開始後解析並記錄不可變的 SHA。發佈證據必須對應該 SHA、工具版本及實際產物。每日 full-check 失敗須在 Actions summary 清楚列出，修復前不得宣稱該版本 package-ready；不可把上一次其他 SHA 的成功用作通行證。

### 5.3 GitHub 保護規則

P0 先讀取現有 branch protection／ruleset，確認 required check 名稱與事件需求；不假設目前必須有 PR 才能 push。保留 check 的相容名稱，full-check 只代表全量，不以夜間 run 取代 PR 的必要檢查。

本計劃不加入新的強制 PR 工作方式，也不直接改 GitHub branch protection。若現有規則要求分支與 main 同步，PR 更新基底後須重新驗證新的合併候選。

## 6. 變更辨識與依賴選擇

### 6.1 比較範圍

| 情況 | 選擇範圍 |
|---|---|
| 開發分支 push | 對 main 的 merge-base 至新 head 的累積差異，另合併該次 push before→after 的差異；保住多提交、回退及被取消 run 中的修改 |
| 新分支、before 全零 | 以 main 的 merge-base 比較；無有效基底則全量。零差異另須通過第 5.1 節同 SHA 的 main 成功來源驗證，才免 browser／package，快速層仍執行 |
| main push | 從目前 ancestry 上最後成功且同測試政策的 main 日常 check 的 SHA 比較到新 head，來源同樣須符合第 5.1 節 repository／workflow／push event／main ref／完整預期結果條件；不能只看最後一次 push，否則會遺漏被取消的上一輪 |
| PR | 記錄事件的 base/head SHA；選擇包含 merge-base→head 及 base→實際 merge candidate 的聯集，實際測試官方 merge ref 對應內容 |
| 手動全量／定期 | 不依賴差異縮小範圍 |

查詢不到可信的 main 成功基底、API 失敗、fetch 不足、force-push 令基底不在 ancestry、差異解析錯誤或未知路徑時，一律全量。不能把錯誤當作空差異。PR 不能取得可用合併候選時應報錯，不能改測 head 後聲稱已測合併結果。

使用 Git 的 NUL 分隔資料及參數陣列，處理空白／Unicode 路徑、rename 兩端、刪除及多提交。刪除／搬移活動或測試時檢查 base 與 head 的登記及資產引用：不執行不存在的檔案，但必須交代移除的覆蓋及殘留引用。

### 6.2 第一版保守映射

| 變更位置 | 必須選中 |
|---|---|
| plans 中的普通活動計劃、一般說明文件 | 文件層；若混有程式檔案，按其他檔案一起升級 |
| AGENTS.md、共用生產契約、測試政策文件 | 快速驗證＋人工規範審閱提示；不得據此自動減少任何案例。規範變更要求新增覆蓋時按其影響升級 |
| sim/<一般活動>/ 的 runtime／assets | 全部快速測試＋該活動完整 browser 群組與 source／package 檢查 |
| sim/circuit-workbench/ 的共用 runtime | DC、AC、電路評量活動及 platform integration；第一版以整個電路家族回歸，待依賴證據充分才細分 |
| sim/circuit-ac-workbench/ | AC 完整群組及其套件；共用 assets 變動按資產消費者擴大 |
| sim/shared/ 的程式／CSS、共用字體與 vendor | 所有相關消費者；第一版採所有 browser 群組及全套打包 |
| sim/manifests/、standalone assets.json／runtime asset lists | 該套件及反向引用者的檢查、source／ZIP 群組；不能只測 XML 語法 |
| tools 中活動專用 browser entry／case／fixture | 執行消費該檔案的完整群組；無法唯一判定則全量 |
| position-time-browser-regression.js 等共用 browser helper | 所有 browser 消費者，不按檔名誤判為只有 position-time |
| .github/、package.json／lockfile、runner／selector／packager／共用 fixture | 全量 |
| 未登記路徑、無法確認依賴 | 全量，summary 列出升級原因 |

讀取已存在的 manifest 和 standalone asset lists 作交叉檢查，補充小型顯式映射；不要建立任意 JavaScript 靜態依賴分析器。新增 runtime 檔案若未被任何資產清單或規則識別，必須報錯或全量，不能選到零項。

每個正式 browser entry 需有 owner／scope、source／package 能力及案例群組；有多個消費者的 helper 要記錄反向關係。活動刪除或新增後，映射檢查必須提示更新。

## 7. Runner 與測試清單的最小修改

以 tools/run-tests.js 作單一正式入口，將目前 workflow 另列的六個命令納入同一清單。npm test 的預設仍表示完整正式回歸，未加篩選時不可悄悄變成快速測試；整合後包含既有 CI 的 216 入口聯集。

新增最低限度的明確 metadata：穩定 id、file／args、kind（node／browser）、scope。沒有必要的欄位不加入；瀏覽器案例識別及 entry mode 由現有 runner 暴露，避免維護第二份 assertion 清單。

命令介面：npm test／--list 已在 P1 提供，fast／affected 留待 P2：

    npm run test:fast
    npm run test:affected -- --base=<sha> --head=<sha>
    npm test
    npm test -- --list

test:affected 的本地指定 base/head 必須在輸出清楚標示；它只表明這段範圍的測試，不能聲稱等同 GitHub PR／main 的基底策略。Workflow 使用同一 selector 的正式計劃輸出。未知參數、缺失 SHA、未知群組必須非零結束。

保留既有活動 npm scripts 供精準重現，但 CI 不再額外重複呼叫已在清單的入口。現有 --shard=i/n 的相容性維持；內部可改為按明確分組和耗時配置分派。

每個 child process 記錄開始、結束、exit code、timeout 及未執行原因。單個入口失敗後先清理，再繼續其他獨立入口；最後有任何失敗或缺少預期結果便非零結束。重跑單一失敗群組是診斷證據，不能覆蓋同一 run 的其他失敗。

tools/run-tests.test.js 現時鎖定兩個 object entry 和檔案數均衡；改為驗證每個預期 entry／mode／group 恰好執行一次、沒有遺漏、沒有誤重複、未知選擇會失敗，不能只改 expected 數量。

## 8. 瀏覽器拆分、等待與資源隔離

### 8.1 優先拆 DC 大入口

沿用現有 case modules，將 DC 的大入口拆成可獨立選擇的群組，初步責任如下；P0 按實際案例歸屬確認，不能僅按檔名重命名：

| 群組 | 覆蓋 |
|---|---|
| 操作與接線 | 元件／導線拖動、連接與拆線、吸附、旋轉、相機、取消與中斷 |
| 儀表與顯示 | 標籤、數學字形、量程、指針、電流／能量顯示、320px 邊界 |
| 文件與狀態 | 匯入／匯出、非法狀態原子拒絕、undo／redo、恢復後合法續作 |
| 平台與宿主 | 多 instance、權限／唯讀、fullscreen、嵌套 iframe、側條與可信觸控 |

每組仍分 source／package。已是獨立入口的 connections、AC、assessed 等要先核對重疊；platform wrapper 與 DC 本體若確有重複，需逐案例證明等價後才能合併。

包含末尾無 flag 才執行的 host／fullscreen 等區段也要移入明確群組。不能依賴 process.argv.length 或「沒有任何 smoke flag」作隱性全量條件；既有專項命令需測試相容性。

AC 的大量專項 flag 先保留；只有計時確認仍是主要瓶頸時，才用相同方法拆 AC。所有案例有唯一 id，完整模式輸出預期與已完成集合；失敗中止造成的後續案例記為 blocked／not-run，不能算通過。

### 8.2 按時間分配

先從真實成功 run 記錄群組時間，與 setup／package／retry 分開；失敗提早退出的時間不能用來判定該群組很快。

P2 第一版用少量已量測的群組權重穩定分配到最多四個 job；P4 在工作量已有實測減少後，使用者批准 browser 上限八個，Node 保持四個。缺少紀錄的新增群組使用保守估算並明示。不要一開始建遠端歷史資料庫或動態自學排程。

每台 runner 先只有一個 browser worker。job 之間並行，job 裏的獨立群組依序執行。CI matrix 維持 fail-fast: false 以一次蒐集問題；前置安裝失敗的 job 不繼續案例。

### 8.3 等待與可信輸入

- 分離 tap 和 drag：普通 tap 只送必要 start／end，等待已知結果；drag 保留足夠 move、可信 pointer 證據及相應時序。
- 優先使用已有 until／bounded polling，等待可見、可點、狀態完成；逾時輸出最後觀察值。等待成功狀態不等於自動重做一次使用者操作。
- 動畫、慣性、long press、scroll handoff、held preview、實際 RAF／取樣窗等時間性案例保留校準時間；不得把真實觸控改成直接 dispatch 非可信事件。
- 點擊前檢查元素可見、rect 非零、目標命中正確；避免隱藏控制產生 (0,0) 點擊卻誤過。
- setup 可載入精準 fixture；正在驗證的操作必須走產品正式入口。評分／恢復仍用 production codec／flow。

### 8.4 隔離、打包及清理

各 job 天然使用獨立 checkout；同 job 先依序執行，沿用隨機本地 port、獨立 Chrome profile，新增群組不得同時寫入共用輸出。

artifact 路徑包含 run ID／run_attempt／job ID／group／mode；打包輸出以 SHA 與套件身份識別。初期允許各隔離 job 自建需要的 ZIP；只有計時證明重建成本可觀，才加入一次建置、同 run 下載重用。不得重用上一次提交的產物。

斷言失敗也要先取診斷再 finally 清理瀏覽器、server 及暫存目錄。cleanup 失敗獨立記錄，保留最先失敗原因；Windows 刪除只針對已解析、已驗證屬於本次 runner 的路徑。

## 9. 環境與打包策略

P0 記錄現有成功環境，P1 採用明確 Ubuntu runner 版本及明確 Node／Chrome 版本設定，沿用 lockfile 和 npm ci。選定版本以實際成功驗證為準，不在計劃裏猜一個未驗證版本。

共用 browser locator 使用一個明確的 CI browser 路徑／版本；CI 缺失或版本不符就報錯，不默默改用系統另一個 browser。本地可使用已安裝瀏覽器，但報告必須記錄實際版本。

保留 CJK 字體、等待 document.fonts.ready、相同 viewport／deviceScaleFactor、pointer capability 設定及需要 native fullscreen 的 Xvfb。固定 runner 名稱不等於完全固定 image；記錄 runner image、OS、Chrome、Node、字體與 DISPLAY，依賴更新作獨立可審閱變更。

只快取依賴下載，key 包含作業系統與 lockfile；安裝仍使用 npm ci。不快取 node_modules、測試成功結果或來路不明的 ZIP。字體與瀏覽器安裝要有版本紀錄，套件下載錯誤不能當作產品測試失敗。

Windows 本地保留既有開發方式；Playwright CLI 依 AGENTS 使用 Git Bash，不新增 WSL 前提。本地快速檢查與 GitHub 同環境結果分開報告；CI 特有問題用固定 Linux 的最小失敗群組重現，毋須每次重跑整套。

日常 package 工作核對受影響套件及資產引用；全量執行 npm run package:all 和 npm run package:circuit-platform。前者只處理 SCORM，不能當作已覆蓋 standalone DC／AC。source 與解壓套件須對應同一 SHA，驗證 manifest／資產清單、實際 ZIP 內容及 runtime 檔案指紋。

現有電路 builder 會同步受 Git 追蹤的資產及 manifest。CI 必須在每個會打包的 job 開始及結束時檢查 tracked diff，包括 browser 入口內部呼叫 build() 的情況。若產生追蹤檔案差異，保存 diff 並失敗，要求先把必要的生成檔更新正式提交；不能測完自動修正的內容卻把成功歸給原 SHA。本地不自動還原或覆蓋使用者修改。第一版沿用 builder 加上核對，只有確認需要才增加唯讀的驗證模式。

## 10. 失敗報告、重試與測試維護

每次結果包含：提交與 event、基底與選擇原因、環境、預期／完成 entry IDs、首次結果、分段耗時、exit code，以及可直接重現的命令。使用 GitHub job summary 和既有 output 目錄即可，不建立儀表板。

結果身份同時包含 run ID、run_attempt、穩定 job／matrix key、該次 job ID、tested SHA、環境／政策指紋、plan hash 及 artifact ID。plan hash 覆蓋選擇集合、測試政策與環境設定，不包含時間戳或 attempt，讓同一 run 的合法重跑可核對同一份不可變計劃。原始 plan 保存為不可變資料；局部重跑讀取原 plan，不能因 main 或歷史成功紀錄已改變而重新算出較小選擇。

GitHub「Re-run failed jobs」只重跑部分工作時，聚合器依 GitHub job 執行紀錄，為每個必要的穩定 job／matrix key 取該 job 最近一次實際執行的完整報告，不是取最近一份可下載的成功 artifact。未重跑的成功 job 可沿用同一 run 的該次成功紀錄，但其 tested SHA、plan hash、環境設定、實際版本指紋及完整 entry 集合必須一致，並在 summary 標明原 attempt／artifact ID。最近執行失敗、被取消或沒有完整報告時，不能退回更舊的成功；也不能拼合多個失敗 attempt 中各自成功的片段。跨 run 不沿用，缺少來源證據則失敗並提示補跑哪些 job，不一律要求重跑整套。首次失敗 artifact 不覆寫，重跑不能令其他 job 的失敗消失。

正式聚合仍遵守以下首次 assertion 失敗政策：未解釋的 assertion 失敗後重跑通過，標記 flaky，不能單靠新 attempt 當作穩定通過；明確在測試開始前發生的安裝／Chrome 啟動故障，可在有界重跑成功後完成技術驗證，保留首次故障。此區分不能依「重跑剛好過了」反推。

失敗 artifact 優先包含：畫面、console／runtime error、目前 URL／viewport／host／mode、最後操作、斷言 actual／expected、必要 DOM rect／字體度量、package hash。利用既有 CDP／JSON 證據；不承諾目前尚未採用的 Playwright trace 格式。

在失敗／正常結束前寫出增量結果；artifact 上傳放在可於失敗時執行的步驟。job timeout 比群組內部 timeout 留出清理和上傳餘量；被硬中斷時可能無最後截圖，報告須如實標示。成功 summary／timing 保存 14 天，失敗診斷保存 14 天，實際發佈證據另按 release 保存；配額不足時調整 retention，不刪掉失敗首次證據。

| 失敗類型 | 處理 |
|---|---|
| 可重現產品缺陷 | 修產品原因，在最接近責任層補／更新案例 |
| 過時規格／fixture／UI 操作 | 核對現行產品契約，再修測試；保留真正使用者流程 |
| 安裝／Chrome 啟動／runner 故障 | 與產品 assertion 分開；可作一次有界診斷重跑，保留首次錯誤 |
| 同 SHA、同環境、同案例結果不一致 | 標記 flaky，保存兩次證據及修復項目；重跑成功仍不能把首次失敗改寫成穩定通過 |

第一版不設自動 quarantine 或 assertion retry 綠燈機制，不使用 continue-on-error 掩蓋必要檢查。核心評分、保存、非法資料、提交及可信觸控案例不因不穩定被靜默移出 gate。

新增測試前先問它覆蓋甚麼風險、現有哪組可擴充、應放 Node 還是 browser。單一計算邊界以 Node 表達；真實互動、字體、畫面及瀏覽器所有權用 browser。刪除／合併重複測試要附原案例到替代案例的對照，不能只交出較少檔案數。

## 11. 分批修改範圍與完成條件

每批為可獨立 review／回退的變更；產品缺陷若在過程發現，獨立記錄或另批修復，不混入 CI 提速提交。

| 階段 | 預計觸及 | 交付及完成條件 |
|---|---|---|
| P0：基準與完整清單 | run-tests.js、workflow、package scripts 只盤點；輸出暫存證據，正式規範記錄連結 | 216 入口聯集、內部 case／mode／host 歸屬、純 Node 分類、manual gate 缺口、現有 required rules、完整命令的基準執行結果與耗時（可以失敗，未執行案例明列）；舊失敗有明確狀態 |
| P1：可觀察性與環境 | quality.yml、run-tests.js／test、必要的共用 browser helper、package.json／lockfile 僅在確需工具時 | 同分支過時 run 取消；分入口結果／timer／失敗 artifacts；環境版本可追溯；保留原全量 gate；一輪完整回歸證據 |
| P2：分組及選擇，先旁路比較 | run-tests.js／test、最小 selector 模組及其測試、DC runner／case modules、workflow | 先按新規則輸出「會選甚麼」但仍跑全量；完成案例映射及 DC 分組；所有 selector 邊界案例、舊／新全量覆蓋對等、相同 SHA 的結果核對通過 |
| P3：切換日常及全量流程 | quality.yml、擬新增 quality-full.yml、package 範圍選擇、必要 npm scripts、生產指南與 README | 有完整綠燈基準及 P2 證據後才啟用；日常 check／full-check 語義正確，文件／活動／共享核心／未知路徑實際 CI 演練通過；未知一律全量 |
| P4：按量測縮短等待／整理重複 | 主要 DC browser helper，必要時 AC，相關測試和證據 | tap／drag 校準、狀態等待、耗時均衡；易出錯案例的同環境重複檢查；對照正常開發數據，沒有遺漏原有覆蓋 |

P1 的報告／環境工作可先完成；P2 的 selector 與 DC 拆分可交不同工作者，但同一 runner 和 workflow 的整合由一人負責。這是實作時可用的分工，不要求增加 agent 數量，也不以 agent 數量作效能指標。

生產指南只在其 verification 段落定義正式 gate 和命令；README 放使用方法及連結，活動計劃只記個別驗收差異。本計劃保留設計和實施證據，不複製多份共用規則。

## 12. 必須驗證的改造案例

這些是未來實作必須有的最小有效測試，不是本輪已執行結果。

| 項目 | 驗收案例 |
|---|---|
| 清單完整性 | 現有 210＋六個額外入口全部有去向；同一 full 執行中預期 entry／mode／group 不漏、不誤重複；未登記新正式測試會失敗 |
| Node 分類 | 不以 .test.js 檔名直接判定；快速層不啟動瀏覽器，也不漏掉已登記邏輯測試 |
| 文件／空差異 | 純文件只文件層；混合程式正確升級；無差異新分支在 main 已驗證時跑快速，main pending／cancelled／failure／來源不明時跑全量；同名其他 workflow／event 的成功不可冒充；未知檔案不會得到空成功 |
| Git 範圍 | 多 commit push、before 全零、force-push、淺 clone、main 上次被取消、API 失敗、PR 基底更新、不同 merge candidate、rename／delete／Unicode 路徑 |
| 依賴 | 單活動、DC 共用核心、AC 外層、shared CSS／SCORM、字體、manifest、套件工具及共用 browser helper 各有預期選擇 |
| 分片 | 群組每次恰好分配一次；缺計時資料仍可執行；舊 --shard 及專項 smoke 命令仍合法；DC 尾部 host／fullscreen 不遺漏 |
| 結果 gate | check 與 full-check 分別驗證；plan 失敗、syntax／manifest 失敗、必要 job skipped、矩陣部分失敗／取消、零個預期 browser、缺 artifact／完成清單、timeout 皆按規則處理；必跑結果缺失不成功 |
| 隔離 | 前一群組失敗後下一群組用新狀態；沒有遺留 profile／server；source／package 證據與輸出不互相覆寫 |
| 等待修改 | 零位移 tap 不偷偷變 drag；拖動仍產生可信輸入與足夠採樣；動畫、scroll、preview 的故障仍會被斷言捕捉 |
| 打包 | 缺依賴、manifest 與 ZIP 不符、錯用其他 SHA 產物、builder 改寫 tracked assets／manifests 都會失敗；SCORM 與 standalone 分別驗證 |
| 報告 | 故意令一個小案例失敗可取得首次畫面／actual 值及命令；timeout 保留前序進度；重試不覆寫首次結果；rerun-all、rerun-failed、過期 artifact、plan hash 不同及新失敗覆蓋舊成功各有核對；包括第三個 attempt 沒重跑某 job、但該 job 第二次失敗／報告缺失的情況 |
| 工作方式 | Windows 快速／專項命令、固定 Linux CI、npm test 完整模式及文件連結均可用 |

覆蓋對等先以清單及 case IDs 驗證，再在同一應用程式 SHA／環境跑一次舊全量與新全量比較。只增加空 assertion 數或讓兩組各自通過不足以證明等價。測試編排變更有少量專用自檢；不為純文案改動增加 browser 測試。

## 13. 切換、量測及回退

### 階段交接條件（使用者已批准）

| 交接 | 必須具備的證據 | 下一步 |
|---|---|---|
| P0／P1 → P2 | 216 個原入口有清單與責任歸屬；記錄 exact SHA／環境、已執行入口耗時／失敗、未執行項及最慢腳本；首次失敗可取得診斷資料；P1 工具自檢通過 | 開始 DC 分組及選擇器，不要求舊產品全量已全綠 |
| P2 → P3 | 每個原案例／source／package 都有明確去向；舊新全量覆蓋對等；選擇器邊界與 gate 自檢通過；已取得同應用版本、可追溯環境的完整成功結果 | 啟用日常選跑及獨立全量 |
| P3 → P4 | 日常／全量與 required gate 演練通過；取得代表性修改的實際耗時，選擇原因可追溯 | 對仍超時的群組優化；已達標時 P4 只做必要驗證 |
| 完成 | 正式覆蓋及可靠性驗收通過；代表性時間達標，或有實測支持且使用者接受的剩餘限制；文件、證據及回退路徑齊備 | 完成改造；正常開發繼續累積統計 |

P0／P1 的失敗基準可以繼續 P2，P3 切換前才要求完整綠燈。初次推進使用必要代表案例，不等待二十次 CI；二十次是後續觀察。每批記錄已達標／未達標條件並連續推進；模擬 runtime 修改不屬於自動擴大範圍。

正式切換前，必須有一個完整成功基準、全部既有案例的去向、selector 邊界測試及 required check 演練。若仍有未分類的全量失敗，P1 可交付改善診斷，P3 保持未完成，不能靠移出日常流程把舊紅燈隱藏。

P2 先在幾個代表改動上比較選擇結果：文件、單活動、電路共用、shared、打包、CI 本身。使用暫存 Git fixtures 測選擇器，避免為測 CI 污染 main。首次正式演練只需必要樣本；以之後正常開發的 20 次非取消 run 累積中位數、P95、首次失敗率、診斷重試率及 runner 分鐘。

所有案例通過才算成功時間；失敗／取消的提早退出另列。已知不穩定群組可以在同 SHA／環境定向重跑少量次數以驗證修復，不為統計反覆跑二十套全量。

如夜間發現 selector 漏選，立即把該 scope 擴大至完整回歸，修映射並補邊界案例。不能以「夜間才會測到」合理化已知漏測。

回退順序：

1. 將日常 selector 切回全量，保留報告、環境及既有 assertions。
2. 群組拆分有缺陷時，恢復舊完整入口及 source／package 矩陣，暫停新的群組路由。
3. 環境更新失敗時回到最近已驗證版本並保留失敗證據。
4. 保留現有 check 名稱及純讀取權限；不關閉整套 Quality，也不改 branch protection 以繞過失敗。

回退後本地命令及 required gate 仍有可用的完整路徑。日常縮短的時間若未達目標，先根據最慢群組再調整；不放寬物理／可讀性／可信輸入標準。

## 14. 計劃及實作狀態

- [x] 核對目前分支、workflow、runner、命令及生產契約。
- [x] 撰寫完整修改計劃，區分歷史證據與未驗證目標。
- [x] 一個 sub-agent 完成第一輪獨立審核。
- [x] 主作者處理第一輪審核意見，記錄採納／不採納理由。
- [x] 同一位 reviewer 覆核修訂。
- [x] 使用者審閱並批准按交接條件連續實作。
- [x] P0–P4 實施及逐批首輪自動驗收；正式採用仍須遵守 main／獨立全量 gate。

實施證據見 [P0／P1 基準盤點](../docs/ci-test-baseline-2026-10-13.md)及 [P2 分組驗證](../docs/ci-test-split-2026-10-13.md)。P0 已完成；P1 固定 Ubuntu／Node／Chrome 的完整 GitHub run 38401477675（fd2e3d0）全部成功，218 個正式入口、語法／manifest 及兩類打包均通過。先前啟動與 unload 失敗及修復證據保留，未放寬 diagnostics gate。

P2 本機 DC 四個群組的 source／ZIP 共 74 區塊通過；GitHub run 38423093499（7685a24）亦完成 233 正式入口、五個 checks、74 個區塊及 aggregate／check，全數成功。原有 216 入口有去向；P1／P2 sim runtime 完全一致，固定 Ubuntu image、Node、Chrome 及 CJK 字體指紋一致，完整覆蓋及同環境對照已達標。整體 48 分 50 秒，仍未達 45 分鐘目標；新的分配採此成功 run 的實測權重。

P3 已切換 Quality 的 affected 選擇，新增獨立 Quality Full（手動精確 ref、每日 03:30 Macau），保持同一正式 executor／清單及不同 check／full-check。原始 plan 的重跑恢復、未知／未驗證 main base 全量退回、各 job 最新結果、實際 workflow revision、summary、格式比較範圍及操作文件均有自檢。33ebdd2 的 main push run 38450529982 完整成功，合格 receipt 已核對；獨立手動 Full run 38450808884 亦完整成功，分別耗時 43 分 56 秒及 44 分 36 秒。Workflow 已部署 default branch，實際 schedule 事件尚未觀察到，不能以 YAML 解析宣稱排程已執行。

代表性 CI 演練全部成功：文件 run 38457469392、68 秒；單活動 run 38457469887、5 分 4 秒；共享核心 run 38457468861、44 分 34 秒；未知路徑 run 38457468272、44 分 37 秒。後兩者完整 234 入口及五個 checks 的實際 job、報告、receipt 與不可變 plan 均已核對；四份 plan 的比較基底均為已核對的 main 33ebdd2。日常 check、獨立 full-check、代表選跑及未知全量演練滿足 P3 → P4 交接。

直線運動 unload 清理已先告知使用者並獨立提交 fd2e3d0，物理、評分及操作未改；本機完整 real-browser 和兩輪 GitHub 全量均通過。本批另外修正舊 phone smoke 的 CSS 隱藏按鈕 fixture 及選單操作，原等待的 source／ZIP 已通過，模擬未改。

P4 校準見 [量測記錄](../docs/ci-test-optimization-2026-10-13.md)。普通點按的 phone／rotation 校準通過，fullscreen 額外 native-event 探針未通過，保留首次證據及原時序。保守候選已提交為 6a5d395：頂層普通手勢改用狀態等待，sample／cancel／iframe／fullscreen 保留原等待。Source／ZIP 全部 74 個 case／mode 區塊本機通過（含完整中斷矩陣），另有 phone 定向重複。

固定 Linux run 38463646905 完整成功，234 入口＋五個 checks、九份報告及 receipt 的 SHA／plan／job 身份已核對。從 run 建立至最後 job 結束 41 分 51 秒、156.98 runner 分鐘；main 基準同口徑 43 分 55 秒、174.88 runner 分鐘。ZIP editing 減少 32.5%；四片測試 2156.85／2198.40／2187.39／1985.35 秒。已依成功報告準備新權重，重新分片的估算約 35.4–35.6 分鐘，仍須下一輪實際驗證。全平台 shared 改動須完整回歸，15–25 分鐘目標尚未達標，不能以估算或全量 45 分鐘目標達標代替。正式採用及剩餘限制驗收未完成。

權重版 f9f78ae 的 run 38469620322 在 AC ZIP／390px／L=2 的實際播放窗口出現 100ms long task，aggregate／check 正確失敗，首次證據保留。已先告知使用者後準備共用渲染修正：取消互動與重繪分開，控制操作完成後只重繪一次；空 scope 不再每幀讀取 surface 尺寸，有儀器時保留原路徑。物理、評分、保存及原性能上限不變。本機 source／ZIP 128 預算及控制 checks 兩輪通過；已有 scope 的 208 checks、AC live editing／rollback 724 checks、DC 中斷／合法續作 90 情境及相鄰 Node 檢查成功。固定 Linux 完整驗收仍待完成。

四片／八片的量測試算已交使用者選擇；31 browser 入口及總測試量相同，八片最慢純測試估算約 18.3 分鐘，增加前置工作用量。使用者其後批准提高至八片，驗證原時間目標；沒有接受四片約 40 分鐘作為完成限制。八片候選已在本機準備，仍須實際 GitHub 全量證據。

渲染修正 a1c7b51 的 run 38479817006 首次完整成功：234 正式入口及五個 checks、九份報告、最終 gate／receipt 的 SHA、plan、policy 與 job 身份均已核對；八份實際 ledger 的 74 個唯一 source／ZIP case／mode 全部成功，ID 集合與 P2 相同。原 AC 12 個預算窗口成功，最大 integration 18.5ms、可信輸入 46.4ms、long task 55ms，80／100ms 上限不變；32 個控制重繪 checks 亦成功。

該輪實測 2251 秒（37 分 31 秒）、151.28 runner 分鐘；main 同口徑基準為 2635 秒、174.88 runner 分鐘，分別減少 14.6% 及 13.5%。四片純 browser 工作合計 8482.49 秒，最慢一片 2173.07 秒；此結果達到首輪全量 45 分鐘目標，仍未達共享核心 15–25 分鐘目標。後續前景／三 RAF 的 fixture 補強尚須其自身 GitHub 驗收；P4 未標完成，亦未合併 main。

### 最終首輪驗收與正式採用規則

上述待驗證描述為當時狀態。前景／三 RAF 補強 a401848 的 run 38484137054 首次完整成功，239 項結果及 74 個實際 case／mode 核對通過，37 分 42 秒、154.23 runner 分鐘。使用者批准的八片版本 6a35bd4，run 38488012824 首次完整成功：四個 Node、八個 browser、一個 checks 共十三份報告，234 正式入口及五個 checks、receipt／SHA／plan／policy／actual job 身份均已核對。

八片實测 1172 秒（19 分 32 秒）、154.65 runner 分鐘；相較四片 a401848，等待減少 48.2%，用量增加 0.3%；相較 main 33ebdd2 基準，等待減少 55.5%，用量減少 11.6%。固定 Node／Chrome、Ubuntu image 與 CJK 字體指紋一致。八份實際 ledger 的 74 個 source／ZIP case／mode 與 P2 相同，全部成功；原 12 個 AC 預算窗口與 32 個控制 checks 成功，原 80／100ms 上限保留。全平台完整範圍的首輪 19 分 32 秒同時符合共享核心 15–25 分鐘及全量 45 分鐘目標。

文件、單活動及全量的首輪代表性證據已具備；正常開發二十次的 median／P95／首次失敗率仍按第 13 節累積，不把這些初輪樣本冒稱長期統計。T4 真機／真 Moodle 及未納入 CI 的人工矩陣維持獨立部署 gate。首次失敗、回退順序與完整命令全部保留。

正式採用將此已驗證實作及驗收文件一起 fast-forward 到 main，並以實際 main push 的合格完整 receipt 建立新政策基準；獨立 Quality Full 必須另對精確相同版本完成自己的 full-check。這兩個來源的實際 metadata／報告／receipt 另存於 output/ci-tests，不能用 feature branch 綠燈或 YAML 解析冒充。每日排程已配置，實際 schedule 事件尚未觀察到。

## 15. 獨立審核記錄

Reviewer：本次唯一審核 sub-agent「ci_plan_reviewer」。第一輪只讀核對計劃、現有 CI／runner／browser／打包入口及生產契約；未修改檔案，未執行測試或觸發 CI。

第一輪結論：方向可行，沒有需要推翻架構的 P1；提出三項 P2 及一項 P3。現有 source／ZIP、T0–T3／T4 分界、未知變更全跑、main 取消後累積比較、DC 尾部案例及時間採樣安排合理。

| 編號 | 審核意見 | 處理與位置 |
|---|---|---|
| R1／P2 | 零差異新分支的輕量同名 check 可能掩蓋 main 尚未通過 | 採納；第 5.1、6.1、12 節要求同 repository／正式 workflow／push main／同 SHA／同政策及完整結果的可信成功，否則全量 |
| R2／P2 | 獨立 full-check 可能遺漏 npm run check 的 syntax／manifest 語義 | 採納；第 4、5.2、12 節明列完整必要 gates，且共用缺失／取消／skip 失敗規則 |
| R3／P2 | run_attempt 及局部重跑可能混用舊失敗或誤判未重跑的成功 job 缺失 | 採納；第 8.4、10、12 節明列不可變 plan、各次報告身份、每 job 最近實際執行及同 run 合法成功沿用，不拼合失敗片段 |
| R4／P3 | P0 要求先取得成功基準，會阻擋先交付 P1 診斷改善 | 採納；第 11 節 P0 可記錄失敗基準，P3 正式切換前仍須成功全量 |
| A1／作者自查 | 電路 build() 可能先改寫 tracked assets／manifests 再測試 | 已補第 3、9、12 節 tracked-diff gate；reviewer 確認此項已處理 |

沒有拒絕第一輪實質建議。同一位 reviewer 已完成第二輪覆核：R1–R4 均可關閉，A1 保持完整，未發現新的實質矛盾，計劃可交使用者審閱。覆核確認仍可局部重跑，source／ZIP、可信輸入及正式驗收要求沒有被削減。

規劃／審核階段的文件檢查：10 個本地檔案／章節連結、空白格式及工作區變更範圍通過；當時只新增本計劃，未執行 runtime 測試、改 CI 或觸發新的 CI。其後實作及驗證見第 14 節與 P0／P1 基準盤點。計劃審核不構成 runtime、效能或 Moodle-ready 驗收。

## 16. 參考資料

- [GitHub workflow concurrency](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/control-workflow-concurrency)：同 group 的過時執行取消。
- [GitHub required status checks](https://docs.github.com/en/pull-requests/how-tos/merge-and-close-pull-requests/troubleshooting-required-status-checks)：workflow 跳過及 required check 的 Pending 問題。
- [GitHub 局部重跑](https://docs.github.com/en/actions/how-tos/manage-workflow-runs/re-run-workflows-and-jobs)及[官方 artifact action](https://github.com/actions/upload-artifact)：reviewer 核對的重跑／報告身份設計依據。
- [Playwright CI](https://playwright.dev/docs/ci)：有限 worker、跨 job sharding 及 timeout 的原則；本計劃沿用 CDP，並非宣稱專案已使用 Playwright Test。
- [Playwright best practices](https://playwright.dev/docs/best-practices)：以可觀察條件等待，減少沒有條件的固定等待。

外部資料於 2026-10-13 規劃討論時核對。具體 GitHub Action／瀏覽器版本在實施時重新核對官方來源，再選定驗證版本。

## 2026-10-15 GitHub image rollout 修正

家庭工作台 Quality Full run 38599832228 的 208 個 Node、32 個 browser 入口及 5 個 checks 全部成功，aggregate 因混用 `20261004.327.1`／`20261012.334.1` 而失敗；實際 OS、架構、Node、Chrome 及 CJK 字體指紋相同。依使用者要求修正環境判定，規則由[生產指南](../docs/simulation-scorm-production-guide.md#ci-gates-and-maintenance-commands)所在的 CI 契約維護：映像 build 標籤保留作來源紀錄，彙總比較實際測試 runtime。

`ci-results.test.js` 已覆蓋映像版本不同而 runtime 相同的正例、兩版本完整保留，以及 OS／架構／Node／Chrome／字體差異、缺失環境欄位、失敗／過期／不完整報告的拒絕。相關 CI collector／environment／prepare／worker 測試及 `check:tests` 通過。原 run 的 245 個完成項目以真實 reports／jobs 作診斷重播通過，輸出在 `output/ci-tests/env-rollout-replay/diagnostic.json`；此診斷不改寫原 run 的 failure，也不取代新版完整 CI。

### 同輪發現的 AC 控制重畫開銷

修正提交 `0491ceb` 的 run 38650843158 完成 208 個 Node、31 個 browser 及 5 個 checks；AC browser entry 的一次手機輸入延遲為 102.1 ms，超過原 100 ms 上限，整輪保留 failure。先前短 SHA 啟動的 run 38650719207 在 checkout 停止，沒有執行測試。

針對性診斷發現，共用 editor 每次控制重畫仍會重建已隱藏的電勢圖例；新增實際 DOM mutation 檢查在原碼錄得 28 次隱藏內容更新並失敗。最終只在圖例顯示時更新色階／數學標籤，保留原 10 ms 物理計算預算、求解精度、物理時間與 80／100 ms 門檻。新增正例驗證開啟圖例仍更新，顯示／隱藏後電路文件與權威狀態保留。

source／實際 ZIP 的 `--protection-budget-smoke` 通過 134 checks（12 個 L／尺寸預算窗口及控制重畫／圖例）；原碼與修正後數據在 `output/ci-tests/ac-budget-before.log`／`ac-budget-hidden-legend-fixed.log`。修正後最大 advance 31.5 ms、最大原生輸入延遲 77.3 ms、最大 long task 91 ms，全部在原界限內。共用平台及 budget helper 的拒絕測試通過；完整 CI 需用包含此次 runtime 修正的新提交重新執行，不以失敗 run 的局部重跑拼成通過。
