# SimLab 測試與 GitHub CI 改善計劃

日期：2026-10-13。
狀態：P0–P3 完成；P4 已開始，Linux 提速及最終時間驗收待完成。
規劃分支：codex/improve-ci-testing。
盤點基準：a8be3a5dc738421ea5824cb83dff597263434cfe。

規劃階段只交付本文件及審核記錄。使用者其後批准補入階段交接條件並開始 P0／P1，達標後連續推進 P2–P4，不逐階段再次詢問。實作範圍為測試、CI、打包驗證及文件；若需要修改模擬本身，先告知使用者。

## 1. 決策摘要

採用「快速必跑、按影響選跑、完整回歸及發佈驗收」的執行方式。保留有價值的測試，減少無關重跑、固定等待、重複啟動和不均衡分片。先改善報告及基準，再改測試選擇，最後處理最慢的瀏覽器群組。

第一版沿用 Node、GitHub Actions 和現有 Chrome/CDP 工具，不全面遷移 Playwright Test，不新增測試服務、自架 runner、資料庫或大型依賴分析框架。這些選項只有在現有方案經量測仍不能達標時才另案評估。

使用者需要審閱的主要取捨：

| 建議決策 | 影響與補償 |
|---|---|
| 日常 CI 按改動選擇瀏覽器群組 | 未被選中的跨功能問題可能較晚發現；以保守依賴映射、未知變更全跑、定期全量及發佈 gate 補足 |
| 每次程式修改保留全部快速邏輯測試 | 保護物理、評分、持久化、SCORM 和 runner 本身，不以刪測試換速度 |
| 獨立瀏覽器群組失敗後繼續其他群組 | 首次結果能揭露更多問題；有界 timeout 限制故障成本，失敗情境內不繼續使用損壞的狀態 |
| 先維持四個瀏覽器 job 上限 | 先處理工作量及等待；避免單純增加 runner 用量而沒有減少總工作 |
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
         → browser（按選中群組形成 matrix，最多四個 job）
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

第一版用少量已量測的群組權重穩定分配到最多四個 job；缺少紀錄的新增群組使用保守估算並明示。不要一開始建遠端歷史資料庫或動態自學排程。

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
- [ ] P0–P4 實施及逐批驗收。

實施證據見 [P0／P1 基準盤點](../docs/ci-test-baseline-2026-10-13.md)及 [P2 分組驗證](../docs/ci-test-split-2026-10-13.md)。P0 已完成；P1 固定 Ubuntu／Node／Chrome 的完整 GitHub run 38401477675（fd2e3d0）全部成功，218 個正式入口、語法／manifest 及兩類打包均通過。先前啟動與 unload 失敗及修復證據保留，未放寬 diagnostics gate。

P2 本機 DC 四個群組的 source／ZIP 共 74 區塊通過；GitHub run 38423093499（7685a24）亦完成 233 正式入口、五個 checks、74 個區塊及 aggregate／check，全數成功。原有 216 入口有去向；P1／P2 sim runtime 完全一致，固定 Ubuntu image、Node、Chrome 及 CJK 字體指紋一致，完整覆蓋及同環境對照已達標。整體 48 分 50 秒，仍未達 45 分鐘目標；新的分配採此成功 run 的實測權重。

P3 已切換 Quality 的 affected 選擇，新增獨立 Quality Full（手動精確 ref、每日 03:30 Macau），保持同一正式 executor／清單及不同 check／full-check。原始 plan 的重跑恢復、未知／未驗證 main base 全量退回、各 job 最新結果、實際 workflow revision、summary、格式比較範圍及操作文件均有自檢。33ebdd2 的 main push run 38450529982 完整成功，合格 receipt 已核對；獨立手動 Full run 38450808884 亦完整成功，分別耗時 43 分 56 秒及 44 分 36 秒。Workflow 已部署 default branch，實際 schedule 事件尚未觀察到，不能以 YAML 解析宣稱排程已執行。

代表性 CI 演練全部成功：文件 run 38457469392、68 秒；單活動 run 38457469887、5 分 4 秒；共享核心 run 38457468861、44 分 34 秒；未知路徑 run 38457468272、44 分 37 秒。後兩者完整 234 入口及五個 checks 的實際 job、報告、receipt 與不可變 plan 均已核對；四份 plan 的比較基底均為已核對的 main 33ebdd2。日常 check、獨立 full-check、代表選跑及未知全量演練滿足 P3 → P4 交接。

直線運動 unload 清理已先告知使用者並獨立提交 fd2e3d0，物理、評分及操作未改；本機完整 real-browser 和兩輪 GitHub 全量均通過。本批另外修正舊 phone smoke 的 CSS 隱藏按鈕 fixture 及選單操作，原等待的 source／ZIP 已通過，模擬未改。

P4 候選校準見 [量測記錄](../docs/ci-test-optimization-2026-10-13.md)。普通點按的 phone／rotation 校準通過，fullscreen 額外 native-event 探針未通過，保留首次證據及原時序。保守候選已整理成未提交的正式 helper 改動：頂層普通手勢改用狀態等待，sample／cancel／iframe／fullscreen 保留原等待。Source／ZIP 全部 74 個 case／mode 區塊本機通過（含完整中斷矩陣），另有 phone 定向重複；Linux 提速驗收及正式採用尚未完成。Shared-core 15–25 分鐘目標仍未達標。

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
