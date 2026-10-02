# 牛頓第三定律：全螢幕測試版

依 [新活動計劃範本](NEW-SIMULATION-PLAN-TEMPLATE.md)記錄本次複製活動的差異；
沿用 [共用風格](00-shared-platform-and-style.md)及
[製作指引](../docs/simulation-scorm-production-guide.md)。
使用者要求先複製一個活動供 Moodle 試驗，不向原有活動加入全螢幕功能。

## Scope

| Decision | Activity specification |
|---|---|
| Branch / base | `codex/scorm-fullscreen-test`，從 `main` 的 `3622f86` 建立 |
| Slug / learning objective | `newtons-third-law-fullscreen-test`；原牛頓第三定律五情境、八個反作用力配對 |
| Learner task / main interactions | 完整複製原活動；新增標題右上角進入／退出全螢幕按鈕 |
| Runtime files / libraries and justification | 複製原活動所有本地 runtime；新增活動內 `fullscreen.js`；沿用 shared styles、SCORM、activity-flow、touch-scroll，無新增套件 |
| Assessment risk / trusted validation | `formative`，沿用原活動瀏覽器評分；高風險評分 N/A |
| Out of scope | 原有活動及共用 runtime 的功能修改、修改 Moodle、強制 iPhone 網頁全螢幕、開啟原始 SCO 分頁、CSS 偽全螢幕 |

## Catalogue metadata (`sim/config.js`)

- title：`牛頓第三定律：反作用力作圖挑戰（全螢幕測試版）`
- folder：`newtons-third-law-fullscreen-test`
- categories：`Mechanics`
- description：`獨立測試版：在牛頓第三定律作圖活動中測試 Moodle SCORM 全螢幕切換。`
- tags：`physics`、`mechanics`、`newtons-third-law`、`fullscreen`、`test`、`scorm`
- status：`active`，表示可獨立打包試驗，並非已通過真實 Moodle 驗收。

## Physics or subject model

全部複製 [原活動模型](24-newtons-third-law-reaction-force-lab.md#physics-or-subject-model)，
保持 generator v1/v2、seed、五情境及公開作圖刻度。
全螢幕是暫態顯示狀態，不參與物理模型、答案或評分。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | 原 header、stage、control panel；按鈕在 header，不覆蓋作圖區／側帶 |
| Desktop / tablet | 沿用原左右布局與 panel 寬度；請求整個 `#app` 全螢幕，包含 header、stage、panel及所有狀態訊息 |
| Control-panel classification | 沿用 `bounded split-panel`，panel 原生獨立捲動 |
| Phone stage and controls | 沿用原垂直布局及短橫向重排；新增按鈕佔 44×44 CSS px；必要時依實測調整測試版短畫面布局 |
| Phone text | 圖示 20px；按鈕有繁中可存取名稱、焦點樣式；失敗訊息可見且由 status 宣告 |
| Viewports | 320×500、390×500/600/844、480×320、740×360、768×900、1280×900，另查 320×400及200% zoom |
| Scroll topology | 普通模式保留原活動 host/panel/drag ownership；全螢幕模式 activity viewport 佔屏，panel仍獨立捲動；不改外層 Moodle DOM 或 scroll styles |

## Navigation, submission and reset

依 [原活動導航契約](24-newtons-third-law-reaction-force-lab.md#navigation-submission-and-reset)。
五題獨立導航、每題配對下一步、每個 editable 階段可直接檢查空白／部分答案並明確提交。
全螢幕按鈕在 edit/check/review/pending/technical 都屬顯示控制，不能清除答案或解除技術鎖。
切換不導航、不刷新、不開新 attempt，並沿用既有 standalone refresh／Moodle resume 契約。

## Diagrams, notation and assistance

沿用 [原活動圖像、比例尺、snapping 及 touch preview](24-newtons-third-law-reaction-force-lab.md#responsive-layout-contract)。
全螢幕改變視窗後由原 `ResizeObserver` 重繪 SVG／抓手；未完成拖曳依原契約 rollback。
全螢幕圖示是介面按鈕，不需要 magnifier 或 snapping。

## Touch gesture ownership contract

沿用 [製作指引](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)
及原活動每個題型／phase 的可見空白、左右 32px strips、anchor/head/offscale targets。

| Touch starts on | Owner / intended behavior |
|---|---|
| Fullscreen button | 按鈕；trusted click/tap 直接請求 API，不延後到失去 user activation |
| Control panel | 原 panel，含頂／底邊界；不移動 host/stage、不改答案 |
| Anchor/head/offscale | 原 simulation target，44px hit area；穩定 capture、preview、release |
| Blank / left and right strips | 普通嵌入模式仍為原 host 原生 panning；全螢幕沒有可見 host range 時記錄 N/A，不能轉成作圖 |

| Host case | Frame / policy and evidence |
|---|---|
| T0 | standalone；source/extracted；fullscreen 和退出；普通 refresh 新作答 |
| T1 | 同源直接 iframe，允許 fullscreen；另測明確 `allow="fullscreen 'none'"` 拒絕 |
| T2 | 同源 wrapper → activity iframe，各層允許 fullscreen；另測上層拒絕 |
| T3 | 原 overflowing player element → activity；保留原 gesture matrix |
| T4 | 使用者稍後在真實 Moodle 測試；記錄版本、browser/device及權限，不以本機結果代替 |

## Scoring and tolerance

沿用 [原評分契約](24-newtons-third-law-reaction-force-lab.md#scoring-and-tolerance)：
五題各20分，同題 K 格均分；受力物體45%、起點／作用線5%、方向20%、大小20%、種類10%。
方向／作用線容差10°，大小相對誤差10%；0–100分，60分達標。
空白0分，合法部分／錯誤答案保留獨立得分；起點項真實依賴物體正確。
全螢幕不新增觀察證據、得分、處罰或生成器變化。

## Phase/state matrix

完整沿用 [原 phase/variant matrix](24-newtons-third-law-reaction-force-lab.md#phasestate-matrix)。

| Phase / variant | Retained authoritative state / legal continuation |
|---|---|
| edit：空白／只選種類／只選物體或起點／箭頭未標種類／完整或錯誤 | 同一 schema 的合法 null/答案；選物體、作圖、修改或直接 check |
| edit：從 check 返回 | `returnToCheck=true`及其餘答案；改完可返回 check |
| check：空白／部分／完整 | 所有答案及合法索引；返回 edit 或明確 submit |
| review：已完成 | 權威答案及重算結果；只讀切題／參考圖 |
| pending-final | shared review 封套；驗證後重試相同 payload，保持凍結 |
| committed | 只讀結果；只重試 finish |
| technical | 不可信狀態保持鎖定；只允許原已確認未提交 draft 恢復 |

任何上述狀態皆可與普通／全螢幕顯示組合。新增顯示狀態只有：普通、請求中、全螢幕、退出中；
`fullscreenchange`/prefixed event 以瀏覽器實際狀態同步；不把 fulfilled Promise 當作成功證據。
API缺失、policy拒絕及request/exit rejection顯示技術提示，解除按鈕busy，可重試。

## Persistence contract

活動封套 ID 改為 `newtons-third-law-fullscreen-test`，避免與原活動混淆。
authoritative answer schema 保持：

```text
{
 schemaVersion:1, generatorVersion:1|2, rubricVersion:1, seed:uint32,
 phase:"edit"|"check"|"review", question:0..4, target:0..K-1,
 returnToCheck:boolean, answers:[A[2],B[2],C[2],D[1],E[1]]
}
record=[recipientBodyId|null,anchorId|null,kindId|null,angle10|null,force100|null]
```

沿用原 body/anchor/vector 依賴、版本拒絕、合法未答及4000-byte ceiling。
標準答案／幾何／分數仍由 seed+generatorVersion 重建。
fullscreen、busy、錯誤訊息及 DOM 都為 transient，不寫入 draft/review/pending。
每個原 saveable variant 由複製的 production round-trip tests 執行合法 continuation。
完成的錯 review 保持鎖定；錯 pending quarantine；不新增恢復路徑。

## Shared SCORM lifecycle

保留原 loadAttempt/startup、draft provider、submitWithCallbacks 及所有四個 outcomes。
不改 shared runtime 或增加本地 commit/finish/pagehide；fullscreen handler 不呼叫 SCORM。
普通／全螢幕皆須保留 same-attempt draft/check/review/pending payload。
standalone refresh 仍開始全新作答；不保存 fullscreen 狀態，不自動全螢幕。

## Test plan

- [x] 複製原七組 generator/model/scoring/scene/feedback/persistence/lifecycle tests 並登記 runner。
- [x] Fullscreen controller：標準 API、prefixed API、實際 state sync、外部退出、unsupported、policy拒絕、request/exit rejection、busy防重複。
- [x] Source / extracted ZIP 的 trusted click/tap 進入、退出；keyboard啟動及外部退出同步。
- [x] 直接／巢狀 iframe 允許及拒絕；拒絕不影響作答、busy可恢復，不偽稱全螢幕。
- [x] 切換前後 seed、答案、phase及snapshot一致；全螢幕中部分提交、只讀review、pending retry仍可用；拒絕全螢幕後可提交空白答案。
- [x] 手機／短畫面、panel末端可達、drag/preview/strips與全螢幕 resize 行為；source及extracted artifact，實際範圍見 Evidence。
- [x] 本地 runtime refs 與 manifest / ZIP 一致；只有測試版載入 fullscreen.js。

## Package-ready checklist

- [x] Before-coding 決策完成；physics/rubric/schema按上文固定，原活動不改。
- [x] `npm run check`、`npm test`、`npm run package:all`、whitespace checks。
- [x] Source / extracted ZIP 的活動及新增功能 browser checks；記錄實際覆蓋，未執行項不能勾選。
- [x] 獨立 ZIP root manifest、全部 runtime 宣告、不包含測試檔。
- [ ] 正式 production 的完整 gesture/viewport gate；本次先交付使用者要求的獨立 Moodle 試驗版，未涵蓋項保持開放。

## Moodle-ready checklist

- [ ] 真實 Moodle 進入／退出、score/status、same attempt resume及pending retry。
- [ ] iPhone Safari／Android Chrome／iPad實機，包含橫直切換及操作手勢。
- [ ] 不支援／被player policy拒絕時提示正確；保留 Moodle 連線。

## Evidence

2026-10-02，本次複本已執行的證據如下。原活動歷史通過不當作本複本的通過證據。

| Check | Actual evidence |
|---|---|
| Controller | `fullscreen.test.js` 通過標準／WebKit mock、API缺失、拒絕、request/exit rejection、busy、外部退出及 fulfilled Promise 未改實際狀態；真實 WebKit 裝置仍未測 |
| Native fullscreen | `output/playwright/scorm-fullscreen/report.json`：可見 Chrome 155.0.8059.27，source及extracted ZIP各12個 cases，completed=true、errors=[]；T0 390×844/1280×900、T1 390×844/1280×900、T2 320×500/1280×900，trusted click/tap、Enter、按鈕退出及外部 API 退出 |
| Fullscreen touch | 上述 T0/T1/T2 手機尺寸：trusted drag、正確縮放後的答案、preview出現／清除、原生 panel swipe；stage／host／答案／snapshot invariants 通過 |
| Policy / lifecycle | 直接 frame拒絕、上層 frame拒絕、HTTP Permissions-Policy拒絕、API缺失均有可見提示；不阻礙空白提交。全螢幕中部分提交、review lock、pending同一payload重試及same-attempt review resume通過 |
| Copied activity | `tools/newtons-third-law-fullscreen-activity-regression.js`：source/extracted layout、五情境全部配對、評分、partial／blank／pending／committed、restore／standalone refresh、touch cancel／lost capture／secondary touch、feedback及可存取圖說通過；320×400及200% zoom在此 runner |
| Normal nested touch | `touch-T2-source.json`：14 profiles × 320×500/390×844，28 cases、completed=true、errors=[]；此 source report 是 controller 最後調整前的普通模式證據。`touch-T2-package.json`：最終 runtime的14 profiles × 320×500，completed=true、errors=[]；最新全螢幕切換另由上列 report 覆蓋 |
| Normal element-owner touch | `touch-T3-source.json`及`touch-T3-package.json`：最終 runtime各14 profiles × 320×500，completed=true、errors=[]；trusted native blanks／side strips、panel sequence、secondary handoff |
| Manifest / ZIP | root `imsmanifest.xml`，18個檔案；runtime refs與manifest相符，無test-support／test檔；活動及manifest ID獨立 |
| Isolation | 原 `sim/newtons-third-law-reaction-force-lab/`及`sim/shared/`無差異；複本原檔只有index、styles及persistence的activity ID有差異，另加fullscreen controller |
| Repository checks | `npm run check`、完整`npm test`、`npm run package:all`均exit 0；記錄於`output/fullscreen-check.log`、`output/fullscreen-full-test.log`及`output/fullscreen-packages.log`。Staged whitespace check通過 |

最終試驗 ZIP：`output/newtons-third-law-fullscreen-test-scorm.zip`，47,358 bytes，
SHA-256 `56958c6e491634d7a6c0ae359d025d7821ee7f87a91f4068f927514b48b3d4bf`。
打包後18個entries再核對，除root manifest外，所有內容與最終source逐byte相同。

最終 T2 extracted／T3 source及extracted reports的manifest＋runtime digest均為
`f276bd812ad979b89a1d9e4de2a34344a72a3e5a042dceae96fe9cac5c5aefff`（18個檔案）。
新增 controller tests、fullscreen browser runner及複本activity browser runner已登記在
`tools/run-tests.js`；額外普通觸控矩陣使用
`tools/mobile-scroll-browser-regression.js --phases=all --panel-sequence --handoff`，
只選`--slugs=newtons-third-law-fullscreen-test`。

本機 headless Chrome 的 fullscreen panel swipe沒有移動，記錄於
`output/fullscreen-browser.log`；相同 trusted gesture 在可見 Chrome 通過。
因此新 fullscreen runner預設開啟可見 Chrome；`--headless`保留為診斷，失敗仍回傳非零。
這個差異不作為真實手機通過的證據。實際電腦按 Esc 的瀏覽器快捷鍵亦留待 Moodle 測試，
本機自動化覆蓋的是按鈕退出及瀏覽器 API 發起的外部退出。

本次是獨立試驗包，尚未宣告正式 production package-ready 或 Moodle-ready。
普通模式已記錄上列矩陣，完整 T0–T3各phase的剩餘組合、軟鍵盤及真實手機動量仍待正式驗收。

## 使用者的 Moodle 試驗

1. 新增一個獨立 SCORM 活動，上載 `output/newtons-third-law-fullscreen-test-scorm.zip`。
2. 普通模式先作一部分答案，按右上角全螢幕圖示；確認Moodle外框消失、圖及控制面板可用。
3. 在全螢幕作圖、捲到面板末端，再按同一圖示退出；確認答案保留及可正常提交。
4. 電腦另試 Esc，手機另試橫直切換；若顯示不支援／權限提示，記錄Moodle版本、瀏覽器及裝置，以便決定後續方案。
