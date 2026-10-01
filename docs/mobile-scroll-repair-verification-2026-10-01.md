# 手機滾動修復驗證記錄

日期：2026-10-01。分支：`codex/mobile-scroll-audit`。Main 起點：`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。Worktree：`/Users/hangwong/.codex/worktrees/mobile-scroll-audit/simlab`。

**首輪 R01–R12 已實作，另完成 R13/R14 的隱藏 document range 修復。全目錄本機可信輸入矩陣及逐活動回歸已執行；repo checks、19個新 ZIP／manifest 逐 byte 核對已完成。實際 Moodle／iPhone／Android 驗收仍待 T4。** R04控制面板的後續故障、追修及新增證據見下節。 本輪修復均在此 worktree 寫入，沒有在原 checkout 寫檔或切換分支。

核對時最新 main 已到 `6d50d4c149bed5d8d93d5d17833f5e6af7c4da85`，另新增 `motion-composition-stroboscopic-lab`；該並行新增活動不在本輪19活動驗收基準。整合到最新 main 後須重跑其 catalogue／package／registered tests。此記錄描述修復後程式；[原 main 審查](mobile-scroll-audit-2026-10-01.md)保留歷史故障證據，[執行計劃](../plans/mobile-scroll-repair-plan.md)與[製作指引](simulation-scorm-production-guide.md#selective-touch-gesture-ownership)記錄工作項目和共用契約。

## R04 控制面板追修（2026-10-02）

使用者再回報：手機 Moodle 內嵌播放器拖動摩擦力模擬的 control panel 會跳到模擬區，令面板無法操作。首輪 R04 只移除 stage forwarding，仍保留 panel 的外頁鎖定；首輪最後位置檢查及原摩擦力測試 host 的 panel-lock receiver 沒有捕捉這個連續操作故障。下方首輪記錄屬歷史證據，不能代替本段追修。

**可執行負面案例：** [追修前 T1 報告](../output/playwright/friction-panel-before-T1-source.json) 返回預期退出碼 1。四種一般 panel 手勢及連續拖動都改了包含頁的 html/body style；兩次 swipe 只相隔 100ms，下一次舞台空白 swipe 的 host 為 100→100，捲動被吞。Source hash 為 `9a93ba42a11eec64a156706afd1007260bb499d8499213af4bcccc2c0b1b8626`。已在 `output/playwright/friction-panel-before-source/` 保存完整14個 manifest/runtime來源檔並核對相同hash；未移除其正式 panel listeners。

`touchstart` 把 parent 的 overflow 改為 hidden、overscroll 改為 none，move 強制 parent.scrollTo，end 再用400ms timer恢復及100/300ms回捲。重複 touchstart 會讀到上一手已鎖定的值，restore把hidden當original，或與下一手共用可變欄位；即使最後Y沒變，外頁仍可被鎖死。真實 Moodle 的精確跳位過程未直接量測，不能把本機鎖死證據寫成已驗證所有手機症狀。

**修正：** 刪除整套 panel 外頁 style 寫入、強制回捲、延遲 timers 和沒有正式部署驗證的 panel-gesture message。保留 panel 自身 native overflow／overscroll containment 與所有真正操作 target。共用 embedded browser fixture 的 lock receiver亦刪除。Asset cache marker改為54，activity plan revision為56；物理、rubric及權威 snapshot versions不變。

維護中的共用 runner現在在touchstart取樣，panel手勢另外保留每frame／scroll-event位置與包含頁style mutation；恢復原值不會抹掉失敗。`--panel-sequence` 增加文字／按鈕起手、touchcancel、cancel後再捲、100ms間隔兩次swipe及下一次空白捲動。已登記的摩擦力完整 browser workflow亦加入連續touch／frame／style／背景可捲 assertions，`npm test`會執行；沒有用 host bridge 幫它通過。

以下矩陣均使用cache54的目前runtime，source與package的digest相同：`db6daad132e3860b06ab6bba9e7c00cbec85dd5ddd228d971fb731a6f4cc6c1a`，14 files。每個7-case組別包括initial、A、B、空白C、D、提交前檢查及有正式B trace的C；錄製後C由production encode/decode/startup restore及正式C按鈕續作，不把空白C代填有數據頁。

| Host／啟動 | 尺寸與scope | 結果 |
|---|---|---|
| T1 source | 390×844，iframe500；7 cases | 98 entries通過；[報告](../output/playwright/friction-panel-final-T1-source.json) |
| T2 extracted package | 320×500，iframe500；7 cases | 98 entries通過；[報告](../output/playwright/friction-panel-final-T2-package.json) |
| T3 source／element owner | 480×320，iframe320；7 cases | 98 entries通過；[報告](../output/playwright/friction-panel-final-T3-source-short.json) |
| T3 extracted package／element owner | 390×844，iframe500；7 cases | 98 entries通過；[報告](../output/playwright/friction-panel-final-T3-package.json) |
| T0 standalone | 320×500、390×844；initial | 2 cases／28 entries通過；[報告](../output/playwright/friction-panel-final-T0-standalone.json)。沒有enclosing range，背景host移動不適用，panel／state／root仍驗 |
| 兩個正常比較活動／T1 source | position-time及freefall，390×844／iframe500 | 2 cases／16 entries通過；[報告](../output/playwright/friction-panel-runner-controls-T1-source.json) |

[彙整](../output/playwright/friction-panel-followup-summary.json)核對32 cases／436 entries、所有errors/issues為空、每個panel的frame/event samples及styleChanges=0，以及目前source bytes。Entries包括取消及複合連續touch案例，不能稱為436次獨立swipe。另有cache53／相同修復main.js的T2 source兩尺寸14 cases／196 entries，全通過；[該記錄](../output/playwright/friction-panel-phases-T2-source.json)的較舊asset-query digest單獨保留。

已登記完整摩擦力source／package learner flow亦通過，包括桌面、320×500／390×600／600×390／768×800內嵌、真正拉力／分析／預測target、scoring、blank/partial、resume、pending／invalid states及新增連續panel案例；[log](../output/playwright/verification-logs/friction-panel-subject-workflow-final.log)。13個相關unit/helper tests及repo check已通過；[tests](../output/playwright/verification-logs/friction-panel-unit-checks.log)、[check](../output/playwright/verification-logs/friction-panel-check.log)。追修後完整 `npm test`、`npm run check`、`npm run package:all`及`git diff --check`均退出碼0；[完整tests log](../output/playwright/verification-logs/friction-panel-repo-test-final.log)、[完整check log](../output/playwright/verification-logs/friction-panel-repo-check-final.log)、[package-all log](../output/playwright/verification-logs/friction-panel-package-all-final.log)。重新建置19 ZIP／256 entries，181個唯一來源檔的manifest／runtime逐byte核對全部通過；[目前套件proof](../output/playwright/mobile-scroll-final-package-proof.json)，來源SHA256為 `63dd3a5dca3e7f7606b98d2e9451f50d722760fc2fcdb0dac167f39b1c9bff3f`。

[新版摩擦力SCORM ZIP](../output/static-kinetic-friction-investigation-lab-scorm.zip)包含14 entries，SHA256 `e363ff761fa084f0cf4b5a7f48a0727e1b90129dcc8c812b9516934c298ae314`。最末package-all的ZIP與已執行extracted-package測試為相同source bytes；stamp不同不代表不同runtime。追修前全19套件的proof與hash保存在[首輪proof](../output/playwright/mobile-scroll-package-proof-before-friction-panel-followup.json)，沒有覆寫歷史結果為新的pass。

這些是macOS Chrome 155／CDP可信觸控的本機證據；T4真實Moodle、iPhone及Android仍未執行。新ZIP須換上Moodle並重新開啟播放器作實機驗收，不能把首輪／本機pass當成部署後已修好。

可重跑：

```sh
npm run test:browser:mobile-scroll -- --host=T2 --mode=package --phases=all --panel-sequence --slugs=static-kinetic-friction-investigation-lab --viewports=320x500
npm run test:browser:static-kinetic-friction
# 預期nonzero；保留原正式handlers的追修前來源
npm run test:browser:mobile-scroll -- --host=T1 --mode=source --panel-sequence --slugs=static-kinetic-friction-investigation-lab --viewports=390x844 --scene-root=output/playwright/friction-panel-before-source --output=output/playwright/friction-panel-negative-recheck.json
```

## 已實作的行為

| 工作 | 活動 | Runtime 決策 |
|---|---|---|
| R01/R02/R04 | driving、orthogonal、friction | 移除空白舞台的 clientY／直接 parent 或 passive forwarding；正常空白使用 native pan，保留真正操作 target 與 panel containment |
| R05–R08 | 基本／進階平衡、Newton II／III | 正常單指空白／側帶使用 native；保留作圖取消與 panel-handoff。只有第二指取消已開始的 drawing gesture 後，才使用共用 `touch-scroll.js` 找真正 window／overflow-element owner；按其 scale 換算 screen travel |
| R03 | force-composition | 自由合力作圖由穩定 `#drawingSurface` 擁有；左右各 32 CSS px strip 保持 pan-y。SVG、overlay 及 pointer conversion 對齊中央區；camera aspect 取 SVG，desktop／compact 分界仍取外 stage |
| R09 | centre-of-mass | Three 實際 mesh/camera 投影與 Canvas 實際輪廓產生球體 ellipse／方體凸包，外加 8 CSS px halo。可聚焦 div orbit 元素用 clip 預先限定 touch owner，drag 中只同步 geometry、不卸載 target；鍵盤 focus 在輪廓內顯示；短橫向 renderer 為每個觀察角度保留 40px 物體外背景／8px halo |
| R10 | displacement-distance-map | 移除 stage-to-sibling-panel intent／capture／forwarding。Map 允許 pan-x／pan-y／pinch；person 與位移箭頭保持 target ownership；panel 獨立 bounded／contained |
| R11 | fbd-horizontal-block | 舊自然流遷移為 bounded app/grid、固定上方 stage／下方面板；SVG 世界座標不改。只讀 force footprint 釋放到 host |
| R12 | plane-mirror | 同樣遷移 bounded stage／panel。只有 active owned pointerup 保存；cancel／lostcapture／第二指／blur／resize 還原完整 bundles/image、清 preview/capture、不保存空 checkpoint。Submitted/frozen editing target 非 owning、aria-disabled、離開 tab order |
| R13/R14 | inertial-reference-frame、linear-motion | Panel 設 position:relative；sr-only 絕對定位內容不再把 activity root 撐出 499／477px 隱藏 range；短橫向另改 columns，linear calculation row 按窄 panel 重排 |

學科模型、rubric、scorer、權威答案 encoder／decoder、snapshot versions 及 SCORM attempt 政策未改。新增 `hit-geometry.js` 與 `touch-scroll.js` 已登記 consuming HTML／manifest；不加入新 npm runtime dependency。

## 方法與可信程度

引擎為 macOS 上 Chrome `155.0.8059.27`，CDP `Input.dispatchTouchEvent`。正式 runner 的 trusted touch / pointer type assertions、每 move 和放手後 20／100／400／1000ms samples 會拒絕反向跳、雙重捲動、錯 owner、非可信輸入、learner work 變動和缺少落點；console／runtime error 也使測試失敗。Host 不含 touch forwarding listener 或 panel-lock message bridge；沒有移除正式活動 listeners。

T0 為 bounded standalone；T1 為 scrollable outer Window 直接 iframe；T2 多一層 bounded wrapper；T3 的 outer Window 與 wrapper 均 bounded，只有 `#scrollOwner` overflow element 有 range。所有 embedded cases 從 owner 有上下 range 的位置開始；量度 panel、inner document、wrapper、iframe bounds、host/activity viewport 和 canonical production answers。Programmatic scroll 只用於 setup。連續物理演進先暫停或以停止／回放狀態建立 fixture。

Fixtures 使用 production encode/decode/startup restore，後接正式 UI 續作；restore canonical answer 會另外核對。作圖擁有者與取消操作另由原活動 browser flow 或 operations adapter 驗證。Blur/lostcapture 的個別 lifecycle 觸發為明列的程式測試，不能代替真手機切換 app。Protocol 測試不建立真手機放手慣性證據。

## 全目錄矩陣

下列檔案均在此 worktree 的 ignored `output/playwright/`；原失敗記錄保留，補測不覆寫成歷史 pass。

| 矩陣 | 覆蓋 | 結果／檔案 |
|---|---|---|
| T0 standalone | 全 19 活動，重心三頁分開；320×500、390×844，iframe 不適用 | 42 cases。原 quantitative panel 只有 3px range，runner 不能要求不可能的 3px travel；改為按 available travel + rounding assertion 後兩尺寸補測通過。`mobile-scroll-catalogue-T0-standalone.json` + `mobile-scroll-T0-small-range-source-final.json` |
| T1 source | 同上；activity iframe 500px 高 | 42 cases / 344 gesture entries 通過；`mobile-scroll-catalogue-T1-source.json` |
| T2 source | 同上 | 原矩陣發現 R13/R14 root range；修復後 4 cases / 32 entries 補測通過。`mobile-scroll-catalogue-T2-source.json` + `mobile-scroll-panel-live-region-T2-source.json`；原批次的 nonzero exit 保留 |
| T2 fresh package | 同上 | 42 cases / 344 entries 通過；`mobile-scroll-catalogue-T2-package.json` |
| T3 fresh package | 同上；element owner | 42 cases / 344 entries 通過；`mobile-scroll-catalogue-T3-package.json` |
| 短／橫向 T3 | 全 19 活動與重心三頁；640×390 / iframe390、480×320 / iframe320；source/package | 每個原矩陣21 cases；按精確 case keys 加入補測後，320高各59 cases／534 entries，390高各33 cases／316 entries。320高初次發現5活動 panel 太短／被推出 viewport；其後96px下限核對再發現重心三頁及基本／進階平衡面板偏短。共8活動改 columns。初次重心短橫向的兩個 rotated cube 背景落點仍誤觸；改可聚焦 div orbit／renderer fit 後另測所有立體。原390高19活動矩陣全通過；`mobile-scroll-short-390-T3-*.json`、`mobile-scroll-short-320-T3-*.json` + `mobile-scroll-short-five-{320,390}-T3-{source,package}-final.json`，再加 `mobile-scroll-short-three-320-T3-{source,package}-final.json` 與 `mobile-scroll-centre-short-{320,390}-T3-{source,package}-final.json` |

[最終覆蓋彙整](../output/playwright/mobile-scroll-final-coverage-summary.json)已通過：15個矩陣群組，707個 group-case records、6130 entries，其中56為明列舞台 N/A。群組間有重疊案例，這不是707個獨立 subject 狀態或6130次全部 swipe。彙整按 slug/profile/part/viewport 精確覆寫補測，只接受最終無 errors/issues 的 case，並核對 expected activities/case counts、每個 before/after panel bounds；舊失敗 artifact及其 runtime hashes保留。最後 centre target 修訂亦有 `mobile-scroll-centre-final-{T0-standalone,T1-source,T2-source,T2-package,T3-package}.json`，每份6 cases全通過。

原 main 的合力模式側帶負面案例 `mobile-scroll-baseline-resultant-final.json` 已以同一正式 runner返回預期nonzero，捕捉 learner state／checkpoint變動及host不捲；實際 sourceRoot及hash保留在彙整。修復版並未移除正式listeners或以診斷monkeypatch通過。

每個 normal case 獨立測左右空白上／下，以及 panel 中段上／下、頂／底邊界。三維新補測增加物體上／下背景。T0 沒有 enclosing range，只把 host movement expectation 標為不適用；panel、答案及 bounded-document assertions 照常執行。

Source/package 共用矩陣的等價理由是：manifest assets 在最終 ZIP 做逐 byte 核對，launch path 保留相同相對層級；native blank/panel ownership 沒有 build-specific branch。T1 source 加 T2/T3 fresh-package 驗證共同 code 路徑；每個實際改動 target 的活動再保留其 source/package 完整 interaction workflow。這不是 19 活動 × 每個 generator seed × 所有 phase × 每個 host 的完整笛卡兒積。

## Phase coverage

| 活動／phase 或 mode | 細分案例與操作證據 |
|---|---|
| Driving | 五級 terminal replay fixture 經正式已解鎖導航；graph-check、check、submitted/pending。原有完整 source/package learner flow 驗踏板、游標、scoring、resume/lock |
| Orthogonal | 三題 directions/perpendiculars/components/angle/formulas，check、submitted/pending。內嵌 source/package 完整作答與修改、short viewport 和 lifecycle checks 通過 |
| Composition | 五題正常及 resultant-drawing mode、check、submitted/pending；fixture 經 production restore 與 drawResultant 正式按鈕。完整 source/package 任意合法起點、所有首尾次序、邊緣吸附、guides/resultant/line-body/keyboard/preview、score100/blank0 及 lifecycle 回歸通過 |
| Friction | balance/experiment/analysis/predict/check/review；原有 source/package complete learner flow、target 操作、scoring、resume、pending、invalid states 回歸 |
| 基本／進階 equilibrium | 各五題 empty/partial、check、submitted/pending；所有 partial drawing 的 second-pointer handoff 在 T3 source／T2 package 各驗。原有完整 source/package target/cancel/score/restore 回歸 |
| Newton II | collect0/1、三組 plot、conclude、check、submitted/pending；production filled fixture。Plot target/handoff 另驗；原有 source/package 實驗、preview、fitting、scoring、restore/lock 回歸 |
| Newton III | 五題 empty/partial、check、submitted/pending、所有 partial second-pointer handoff；完整 source/package 與 edge target browser regression |
| Centre | 正式 1D/2D/3D tab；3D sphere/cube/cuboid × Three/Canvas × initial/rotated，共 12 geometry profiles。測左右12%舊失敗位置及上／下背景；原有完整 source/package 承托、平板／cutout／孔／draw／mark、orbit/candidate/threshold、context loss/restore/review；focus-visible source/package screenshot 另驗 |
| FBD | initial/partial/submitted blank/panel；完整 source/package 十個 force heads、trusted drag/cancel、partial scoring、same-page success/committed/frozen footprint、restore |
| Mirror | initial/incident/reflected/extension/image/submitted/pending；source320/390 與 fresh package390 另測真正 target 完成及 cancel/lostcapture/secondary/blur rollback、readonly footprint |
| Map / inertial / linear | 共同 initial ownership 矩陣，加既有四尺寸 source/package mobile-touch complete flow，驗真正 person/arrow 與 FBD/inertial/linear 控制。R13/R14 亦補短橫向 columns；linear 另測 uniform/variable captured form、instant/expanded/review 的 source/package short profiles |
| Position-time / qualitative / quantitative / freefall / Hooke | 共用初始 stage/panel/edge 矩陣；ownership 程式未改。保留原 repo model/scoring/persistence/lifecycle tests 與既有 browser flow。Hooke、position-time 的完整 browser entry 與 linear timing 結果另列 repo gate，不以僅初始頁代填其他 subject 功能 |

**正式沒有舞台的頁面：** Newton II conclude/check、基本／進階 equilibrium check、Newton III check 使用全高 panel；adapter 明列原因且量度 stage width/height 確認隱藏。G1/G4 為 N/A，四個 panel cases 仍執行。最初 runner 把它們當 missing blank 的失敗已保留；補測沒有刪除預期 target 或移除 listeners。

**主要細分 evidence：**

| Artifact | Case / entry 數 | 範圍 |
|---|---:|---|
| `mobile-scroll-complex-T3-source.json` | 102 / 816 | mirror、centre、composition、orthogonal；320/390 source |
| `mobile-scroll-complex-T3-package-final.json` | 55 / 514 | 同四活動 fresh package390，加三種立體與 mirror operations |
| `mobile-scroll-solid-backgrounds-T3-source-final.json` | 15 / 172 | 三種立體兩 renderer 兩角度及三頁；source320，四側背景 |
| `mobile-scroll-mirror-operations-T3-source-final.json` | 12 / 140 | 四種操作與兩鎖定狀態；source320/390 |
| `mobile-scroll-repaired-phases-T3-source.json` / `...T2-package.json` | 各47 / 384 | Newton II、FBD、driving、friction、基本平衡及第三定律空白題；原 run 有三個 no-stage assertion 和其後第三定律錯 selector，不能稱全批 pass |
| `mobile-scroll-summaries-T3-source-final.json` / `...T2-package-final.json` | 各3 / 24 | 上列三個 no-stage case 補測；各12舞台N/A、12 panel touch，通過 |
| `mobile-scroll-reaction-advanced-T3-source-final.json` / `...T2-package-final.json` | 各28 / 234 | 完整第三定律與進階平衡 profiles/partial handoff；各8舞台N/A，其餘通過 |
| `mobile-scroll-short-five-{320,390}-T3-{source,package}-final.json` | 各5 / 40 | 5個短畫面補修活動、兩尺寸、source/package；4 reports均完整通過 |
| `mobile-scroll-short-three-320-T3-{source,package}-final.json` | 各43 / 406 | centre及兩個equilibrium短畫面完整profiles；各有2個rotated-cube背景觸控失敗，其餘含equilibrium handoff/no-scene通過；保留失敗記錄 |
| `mobile-scroll-centre-short-{320,390}-T3-{source,package}-final.json` | 各15 / 172 | 最後div orbit／短畫面fit的三頁＋12立體 profiles；4份均全通過，精確替換上列centre案例 |
| `mobile-scroll-linear-phases-short-T3-{source,package}-final.json` | 各7 / 56 | 初始、uniform-captured、variable-ready/captured、instant、expanded、review；480×320/iframe320，source/package 全通過 |

Entries 包括明列 N/A 以及 interruption/operation assertions，不能把全部 entry 數稱為實際 swipe 數。只有沒有 errors/issues 並完成所需 case 的報告或明列補測才作通過證據。

## Repo、subject workflow 與新套件

| Gate | 實際結果 |
|---|---|
| `npm test` | 追修前完整一輪退出碼0（歷史證據）；含既有 model/scoring/persistence/lifecycle、Newton/equilibrium/friction/centre/graph/freefall browser workflows，以及新 trace/hit-geometry/touch-scroll unit tests。[simlab-full-regression-verified.log](../output/playwright/verification-logs/simlab-full-regression-verified.log)；其後 centre 的短畫面／旋轉元素改動另跑128個已登記 unit／wiring tests（全通過，[simlab-final-units.log](../output/playwright/verification-logs/simlab-final-units.log)）及該活動完整 source/package browser 回歸（全通過，[simlab-centre-browser-last.log](../output/playwright/verification-logs/simlab-centre-browser-last.log)） |
| `npm run check` | 最後修訂後已通過，退出碼0；[simlab-final-check.log](../output/playwright/verification-logs/simlab-final-check.log) |
| `npm run package:all` | 首輪19 ZIP／256 entries 全部驗證，退出碼0 |
| 最末控制可達 | 5個短畫面活動 source panel 180–226px 高；另外重心三頁與兩個 equilibrium 的 initial/check 在source/package各驗，panel227–233px高，底部在320px內；有操作 control的頁面末端44–48px control可見，1D/2D的末段說明可讀，root/horizontal range為0。`short-layout-*-initial.png` / `*-bottom.png` 已檢視代表畫面；source smoke通過 |
| Final ZIP byte parity | 全部通過；181個唯一 manifest／runtime source files，19 ZIP全部 root manifest、declared assets 及 exact entries核對。SHA256／逐包記錄見[首輪套件 proof](../output/playwright/mobile-scroll-package-proof-before-friction-panel-followup.json) |
| Composition complete browser | Source/package 通過；[simlab-composition-browser-final.log](../output/playwright/verification-logs/simlab-composition-browser-final.log) |
| Driving complete browser | Source/package 通過；[simlab-additional-browser.log](../output/playwright/verification-logs/simlab-additional-browser.log) 的 driving job |
| Mobile-touch complete browser | Map/FBD/inertial/linear，四尺寸 source/package 通過；同上 mobile-touch job |
| Orthogonal embedded / short / lifecycle | Bundled Playwright 原 workflows 通過；[simlab-orthogonal-embedded-playwright.log](../output/playwright/verification-logs/simlab-orthogonal-embedded-playwright.log)。額外 direct scope 的 headless native mouse-wheel assertion未通過，未把它算成 pass；可信手機 touch 與 embedded panel checks 通過 |
| Linear isolated timing browser | 首次及一次隔離 run 出現偶發 instant animation-gap assertion；原 main 對照、修復版完整隔離重跑與診斷重跑均通過，threshold／production 程式未調鬆。慢180ms LMS下沒有 running commits、handler<100ms、p95約16.8ms；完整作答／pagehide續作／六種提交結果通過。[simlab-linear-isolated-repeat.log](../output/playwright/verification-logs/simlab-linear-isolated-repeat.log)；先前失敗保留，不能聲稱沒有 timing flakiness |
| Focus screenshot | `centre-orbit-focus-source.png`、`centre-orbit-focus-package.png` 已檢視；最後旋轉元素改為 div 後 source/package 重測通過，keyboard focus-visible仍在實際 clip內可見 |


首輪套件來源 SHA256：`f4c180957a77e67d8c849c6a8b9fed50a3d52dd683e1c62918a50804fe4cab01`（181 files，包含19 manifests；scope與順序見proof）。打包的 runtime assets與standalone/SCORM啟動相對路徑相符。此數值標識控制面板追修前的建置；較早測試的hash仍按原執行版本記錄。

新版 runner CLI 已登記 `test:browser:mobile-scroll`。可重跑指定問題：

```sh
npm run test:browser:mobile-scroll -- --host=T3 --mode=package --phases=all --handoff --slugs=force-equilibrium-diagram-lab,force-equilibrium-advanced-diagram-lab,newtons-third-law-reaction-force-lab
npm run test:browser:mobile-scroll -- --host=T3 --mode=source --phases=all --slugs=force-composition-construction-lab,centre-of-mass-investigation-lab
npm run test:browser:mobile-scroll -- --host=T3 --mode=package --phases=all --operations --slugs=plane-mirror-pencil-ray-diagram
npm test
npm run check
npm run package:all
```

本機 worktree 重用原 checkout 的 installed devDependencies，命令前綴 `NODE_PATH=/Users/hangwong/Documents/Projects/simlab/node_modules`。Bundled Playwright wrapper 使用 app 提供的 runtime，不安裝套件。Final report 的 build digest 對 manifest-declared runtime bytes 取 SHA256；早期 reports 的較舊 digest 與最新 bytes 分開保留，不聲稱所有歷史測試在最後同一 hash 執行。

## 尚待實際環境驗收

T4 未執行：使用者回報的 Moodle 內嵌播放器、各手機瀏覽器都仍需要驗證真正 DOM/frame/overflow owner、origin/sandbox、iPhone/Safari 及 Android/Chrome 的放手慣性、工具列／軟鍵盤／200% zoom／方向變化，和實際 SCORM 草稿續作、pending retry、blank/partial submit、提交後只讀重入。若 Moodle 提供新視窗，也另驗該 player。Local fixed-height、short/landscape tests 和 synthetic lifecycle triggers 不代替這些環境。

本輪沒有部署、改 Moodle 活動／attempt、改評分或重設答案。交付新 runtime、指引、可重跑驗收工具與 packages；本機通過可支持已記錄範圍的修復，實際手機故障的驗收狀態維持待驗。
