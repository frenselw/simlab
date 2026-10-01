# 運動合成：回饋及手機捲動 — 獨立完整分支審核 1

日期：2026-10-01。審核者：`feedback_full_review_1`。

**結論：本次審核 PASS，沒有未解決的可重現問題。** 定稿時發現的 P3 最大快照 fixture／文字證據缺口（R1-F01）已由 Root 修正，並經本審核者獨立重驗關閉。Production 與全部本機執行檢查通過；真實 Moodle 學生 attempt 及實體手機仍須部署驗收，沒有冒稱已完成。

## 審核對象與方法

- 分支：`codex/motion-composition-stroboscopic-plan`。
- 實際基準：`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。
- 候選：`4a62315946bcbaaca0f4ad327f1cdae62bc634ec`。
- 最終 test-only closure：`cc85a611b9963538146a1b44d0c92bb953a0c706`。直接核對該 commit 僅改容量測試，production、model、rubric、schema 及 ZIP entry bytes 沒有改變。
- 完整閱讀基準至候選的變更清單、所有活動 production 檔案、七套活動 tests、browser runner、manifest、catalogue／package scripts、活動計劃、共用風格及 SCORM 製作契約。另核對共用 `activity-flow.js` 和 `scorm.js` 的實際 API 與信任／提交流程。
- 審核範圍沒有按領域分工；本審核獨立涵蓋物理、評分、保存恢復、SCORM、文字、桌面／手機 UI、鍵盤、可信觸控及包裝。
- 舊審核報告只作歷史脈絡，本次結論依自己的讀碼、命令、source／實際 ZIP 執行及截圖。沒有修改 production、其他審核報告或再開 agent。

## 物理與教學

四模型使用相同原點、模型時間與比例尺；`x` 向右為正，`y` 向上為正，向下位置保持負值。根據固定參數獨立消去時間，結果與模型、權威位置、圖及回饋一致：

| 情境 | 位置關係 | 軌跡及速率判斷 |
|---|---|---|
| A | `x=4t`，`y=−4t` | `y=−x`，合運動勻速直線 |
| B | `x=4t`，`y=−5t²` | `y=−(5/16)x²`，由靜止下落與水平勻速合成平拋 |
| C | `x=5t²`，`y=−4t` | `x=(5/16)y²`，`y≤0`，向右彎的拋物線；水平加速沒有誤稱自由落體 |
| D | `x=5t²`，`y=−5t²` | `y=−x`，速率隨時間增加；直線不等於勻速 |

- B 明確採 `g=10 m/s²` 並忽略空氣阻力，符合本活動的教學近似。
- 每段 `0.20 s`；勻速間距為 `0.80 m`，由靜止勻加速間距為 `0.20、0.60、1.00、1.40 m`。增加量 `0.40 m=aΔt²` 正確，工具量的是相鄰距離，沒有把總位移當間距。
- 題目問「哪種運動模型符合這組頻閃資料」，提示用「符合勻加速模型」，沒有宣稱有限頻閃點能證明每一瞬間的加速度，也沒有將 `1:3:5:7` 推廣到任意初速。
- 兩個球是同一運動的投影示意；頻閃每次同步留下兩個投影。四個學生球各按同一時刻的兩個坐標評分。
- 畫圖、拖動與 preview 使用同一等比例映射。兩條播放虛線分別從水平／垂直球出發，垂直於各自坐標軸，交於同一模型時間的位置；只在四點已放置且正在播放時顯示。
- 學生球沒有連線。提交後的參考軌跡由連續模型重建，不信任學生球的擬合結果，也不修正學生答案。

## 評分、保存與 SCORM

- 每點水平、垂直各 2 分；各分運動類型 3 分，軌跡 3 分；每題 25、全卷 100，60 分通過。`±50 mm` 包含邊界，`51 mm` 不接受。
- 空白 0 分；只答分類 36 分；只答位置 64 分。一個坐標錯誤不抹去另一個坐標的有效部分，重疊或錯 slot 不會多得分；觀察、起點與停泊球不計分。
- 所有 editable 狀態都能到 check，再由明確提交按鈕提交空白／部分答案；最後一題「檢查作答」不會自動提交。
- Production encode／decode／Controller restore 的 512 個 round-trips 保持答案、分數及合格狀態，並執行合法續作；最終最長合法 enum fixture 的 draft／review／pending 為 **807／835／1079 UTF-8 bytes**，均低於 4000。791／818／1061 是修正前 fixture 的歷史數值，不能當作最終最大樣本。
- 枚舉、整數坐標、tuple 長度、phase／kind／returnToCheck、版本及 observed→points 依賴有嚴格驗證；合法未答和物理錯答沒有誤當成資料損壞。
- 已提交、committed 或 pending 不能重設或改答。只讀導航不改權威答案；pending 保持相同 payload，深層無效資料先 quarantine 再技術鎖。未知／不一致成績沒有冒稱可確認的詳細評分。
- 活動使用 shared startup／save／draft-provider／四種 submission outcome／retry API，沒有活動自己的 raw LMS 欄位、commit／finish 或 page lifecycle 流程。
- Standalone 刷新重新開始，拒絕 browser storage 仍可練習；同一 Moodle-like attempt 恢復 draft／review／pending。Browser scoring 的形成性風險已記錄，沒有 secrets。

## 回饋、文字與 UI

- 新表頭「時刻／你的位置／位置檢查」取代「分量」。逐方向寫出「水平／垂直：正確、需修正、未放置」，不再依賴 `✓ x ✓ y`。
- 類型或軌跡選錯時分列「你的答案」與「正確答案」；未答寫「未作答」，沒有用錯誤色混淆缺漏與錯答。只在有誤或缺漏的時刻補參考位置，正確作答沒有重複整串答案。
- 坐標分行，單位、每方向 2 分、`0.050 m` 容差與未放置 0 分寫明。目視桌面、一般手機及極短窄屏截圖，文字可讀，表／panel／document 無水平溢出。
- 桌面標題 20 px、控件 16 px、header 61 px；圖上主要字 22 px，球體使用本地漸層／高光。手機圖字 14 px、必要抓手至少 44 px；保持三區布局與緊湊面板。
- 「分運動」播放沒有球影；「頻閃」逐次曝光。已有球影在連續播放期間暫藏，停止後恢復，答案保持。面板「下一題」存在，第四題轉為 check，沒有「下一個時刻」按鈕。
- 四個球可直接任意次序拖動，已放 `t₄` 後直接抓 `t₃` 不需先按 panel。重疊時取最近球心，完全重合取畫面上層；停泊入口仍可指定時刻。
- 鍵盤／微調提供明確開始、保存、取消及焦點選擇；公開 grid 吸附包含錯誤候選，preview、主圖與放手保持一致，沒有正解磁吸。

## 手勢擁有者與嵌入捲動

讀碼確認 host 轉交只沿 embedding frame 的祖先尋找真正有垂直捲動範圍的容器或 document。固定中間 frame 不會因直接 parent 無捲動能力而吞掉手勢；不能選到兄弟 Control Panel。只有實際消耗位移才阻止原生事件，跨來源／沒有可轉交目標時保留原生處理。

自己的 source 與 extracted ZIP 各執行 6 組 host fixtures：390／320 px 寬 × document／外層容器／固定巢狀 iframe。各路 84 次 browser-level trusted gestures，涵蓋：

- stage 空白、左／右 24 px strips 的上下兩向 pan：實際 enclosing host 移動，兄弟 panel、答案與 local viewport 保持。
- panel 中段及上／下邊界的雙向 pan：只捲 panel，邊界也不轉交 host。
- 直接 `t₄` 停泊球與既有 `t₃` 拖放：只改所抓答案／時刻，host、panel、document、viewport、frame 幾何保持固定，trusted touch 診斷增加。

每次驗證完整答案、selection、activity document、stage、panel、各層 host scroll／visual viewport／iframe bounds；沒有用 DOM dispatch 或程式設定 scrollTop 冒充驗收手勢。程式捲動只作 fixture 定位。另通過兩路各 36 個短 trusted-touch rows，涵蓋每題／每時刻兩種拖放入口、錯誤公開格點、3× preview、取消與清理。

## 本次實際執行證據

| 命令／資料 | 結果 |
|---|---|
| 七套活動 Node tests：model、animation、scoring、feedback、persistence、lifecycle、scene | 全部 exit 0 |
| closure 後獨立重跑 `node sim/motion-composition-stroboscopic-lab/persistence.test.js` | exit 0；512 round-trips／合法續作、807／835／1079 bytes 及 invalid states 通過 |
| `node tools/check.js` | exit 0，JavaScript 與 SimLab SCORM profile 通過 |
| `git diff --check 0bb873c8d7eb53ae2714fd100f453f8666ba2a94..HEAD` | exit 0 |
| `MOTION_ARTIFACT_SUFFIX=feedback-review-1 node tools/motion-composition-browser-regression.js --smoke` | exit 0，Chrome `155.0.8059.27`，`errors=[]` |
| 獨立 focused playback／layout script | exit 0，三路 source desktop／source trusted-touch phone／實際 ZIP；`errors=[]` |
| 當時 ZIP 逐 entry byte parity | 包括根 manifest 共 15 個 entries 與候選 source 一致；39,301 bytes |

自己的 smoke **每一路**包含 13 種 viewport、416 個普通圖狀態、40 個 capture／reference 播放可讀性狀態、280 個短圖狀態、5 組正常／reduced 曝光、36 個短 trusted-touch rows、9 個空白／部分／全對回饋狀態、84 次三種 host 拓撲手勢，以及 UI 提交／恢復／keyboard／200% reflow。`--smoke` 沒有再跑 runner 的常規 390／320 各 43 rows 完整矩陣；不把 Root 的完整矩陣冒稱為自己的執行。

證據：

- [本次獨立 browser smoke 原始資料](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/smoke-report.json)
- [最新播放／下一題／緊湊布局的追加檢查](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/focused/report.json)
- [當時 ZIP entry-byte 一致性](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/package-parity.json)
- [桌面新回饋截圖](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/source-feedback-1024-768.png)
- [手機新回饋截圖](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/source-feedback-390-600.png)
- [短窄畫面新回饋截圖](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-1/source-feedback-320-225.png)

## Findings 與驗收邊界

**R1-F01 — P3，Closed：最大快照 fixture 沒有使用最長合法枚舉。** 原 `sim/motion-composition-stroboscopic-lab/persistence.test.js:25` 的 `max` 使用 `nonuniform`（10 字元），但合法 `accelerating`／`decelerating` 各 12 字元。保持同一合法坐標／軌跡，用兩個 `accelerating` 後，production draft／review／pending bytes 為 **807／835／1079**，因此原 791／818／1061 不能稱為最大值。影響是驗證及文件的精度，沒有 SCORM 超限或 runtime 故障。

Root 於 `cc85a61` 改從 `M.MOTIONS`／`M.TRAJECTORIES` 挑最長合法 key，而非寫死較短 enum。本審核者直接閱讀該 commit diff 並獨立重跑 production persistence test，exit 0，512 round-trips／合法續作、invalid states 與新容量數值均通過；base 至新 HEAD 的 diff check 亦 exit 0。只改 test，無需重跑 browser 或 rebuild ZIP。**R1-F01 已關閉。**

本次沒有可重現的物理、UI、操作、評分、保存、SCORM 或包裝 runtime finding；未解決 findings 為 **0**。上述候選及 test-only closure 的獨立審核可關閉。

沒有再次執行 whole-repository `npm test` 或 `package:all`；此報告明確區分自己的活動檢查與 Root 的整體 gate 統整。真實 Moodle player 拓撲／學生 attempt、跨來源部署、Safari／其他手機引擎、實體手機、native picker／工具列／裝置 zoom，仍屬外部部署 gate；未驗不能視為已確認代碼 bug，也不能被本機 fake-LMS／CDP 替代。

所有本審核的 browser／server／temp profiles 已清理。此後不再 rebuild ZIP，最終 archive hash 交 Root 在全部獨立 build 停止後固定；本報告的 parity 只證明核對當時的 entry bytes。
