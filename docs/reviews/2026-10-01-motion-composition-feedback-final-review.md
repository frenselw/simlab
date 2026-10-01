# 運動合成：回饋與手機捲動審核匯總

日期：2026-10-01。分支：`codex/motion-composition-stroboscopic-plan`。
完整branch基準：`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。
Runtime候選：`4a62315`；最後容量測試修正：`cc85a61`。後者只改test fixture，沒有改部署檔案。

本次由主agent先完成修正，再安排兩位subagents各自完整審核同一條branch，沒有按範疇分工。此報告由主agent匯總；先前三位／第四位審核屬歷史證據。

**最終結論：本機package-ready PASS，兩份完整獨立審核通過，唯一P3 finding已由兩位獨立復核關閉，未解決問題為0。真實Moodle／實體手機gate仍未驗。**

## 本次修正

- 位置回饋以「水平／垂直：正確、需修正、未放置」取代「分量」「✓ x ✓ y」。類型或軌跡選錯時分開列「你的答案」和「正確答案」；未答清楚標示。只有缺漏或有誤的時刻才重列參考位置。坐標分開評分、每方向2分、50 mm容差及未放置0分均明確說明。
- Stage空白及兩側24 px留白的手勢，沿同源iframe祖先尋找真正可捲動的host容器／document；不再無條件對固定的直接parent呼叫scrollBy並阻止原生事件。Panel維持原生獨立捲動，邊界不轉交；抓手維持固定capture與touch-action:none。
- 四個物理模型、評分、保存schema、SCORM生命週期及shared runtime未改。分運動不留球影、頻閃逐次重播、四點後動態核對虛線、學生球不連線、直接拖所有已放球、緊湊header／panel及下一題保持。

## 獨立完整審核

| 審核者 | 報告 | 狀態 |
|---|---|---|
| 1 | [完整審核1](2026-10-01-motion-composition-feedback-review-1.md) | PASS；R1-F01 Closed，未解決問題0 |
| 2 | [完整審核2](2026-10-01-motion-composition-feedback-review-2.md) | PASS；獨立重驗最後test-only修正，未解決問題0 |

兩位各自覆蓋物理、評分／保存／提交、動畫及作圖、文字／UI、手機手勢、鍵盤、manifest及source／actual ZIP。兩位各自重跑七套Node tests、check、全新browser source／actual ZIP smoke，errors=[]；每路包含13種viewport、416個普通圖狀態、40個播放可讀性狀態、280個短圖狀態、36個短可信拖放、9個回饋狀態及84次host手勢。第一位另驗三路播放／緊湊布局／下一題；第二位另用平拋方程核對DOM虛線、連續兩次曝光及panel起手跨入stage仍由panel負責。主agent直接核對兩份報告、raw資料及實圖，沒有把共用runner的同一份結果算作兩份獨立執行。

## Finding與跟進

| Finding | 影響 | 跟進與證據 |
|---|---|---|
| R1-F01 · P3 最大保存樣本未用最長enum | 原791／818／1061 bytes只是較短代表樣本，稱為最大不精確；無runtime或容量超標問題 | **Closed**。cc85a61由合法enum挑最長key；root及兩位審核者各自重跑512 round-trips及續作通過，最長選項fixture draft／review／pending為807／835／1079 bytes，均小於4000。兩位均直接核test-only diff並在各自報告確認closure |

原始feedback難明及直接parent無捲動能力的兩項問題在4a62315審核前已修正。除R1-F01外，本輪沒有其他新runtime／物理／UI finding；歷史審核數字留在歷史段，不冒稱是本次最大fixture。

## 主agent實際證據

- 七套活動Node tests通過，含四模型／等時距離、漸進曝光、坐標部分分／容差、清楚回饋、512組保存round-trip及合法續作、startup／submission四結果、只讀／凍結及standalone刷新；`node tools/check.js`通過。R1-F01修正後只重跑受影響的persistence test，結果807／835／1079 bytes；runtime未改，既有完整browser證據保持適用。
- [回饋及host可信觸控原始報告](../../output/playwright/motion-composition-stroboscopic-lab/feedback-scroll-root/feedback-scroll-report.json)通過，Chrome 155.0.8059.27，errors=[]。Source及actual ZIP各9個回饋狀態：1024×768、390×600、320×225的空白／部分／全對；panel、table及document無水平溢出。
- 同一報告source／actual ZIP各84次可信touchStart／Move／End，涵蓋390／320寬、document／外層容器／固定巢狀iframe三種host，空白及左右留白雙向pan、panel中段與兩端雙向pan、t₄後直接拖t₃。完整答案、選題／時刻、activity document、local stage、panel、各層host／frame／visual viewport均有前後metrics及斷言。空白區以轉交host實現捲動；panel是原生捲動，不把host轉交冒稱原生。
- 主agent完整命令`MOTION_ARTIFACT_SUFFIX=feedback-full-root node tools/motion-composition-browser-regression.js`完成exit0，[原始report](../../output/playwright/motion-composition-stroboscopic-lab/feedback-full-root/report.json)的errors=[]。每路13個viewport／416個普通圖、40個播放、280個短圖、正常／reduced曝光、空白／部分／完整提交及resume／技術狀態、keyboard及200% reflow通過。每路另有36個短可信拖放；source／ZIP × 390／320的四組完整矩陣各43 rows，包括全部時刻兩入口、host／panel／strips、多指／圖外／lostcapture／resize回復及已提交／凍結舊球區域pan。最後再跑每路9個回饋及84次三種host手勢。

## 最終產物及部署界線

全部獨立build停止後只重建此活動一次。最終[SCORM包](../../output/motion-composition-stroboscopic-lab-scorm.zip)39,301 bytes、15 entries；根manifest、12個HTML JS／CSS引用、catalogue及全部runtime entries與候選source逐byte一致。SHA-256為`c5c9fda7f547b790130e99a89dde4114bb8a0bbbd398d735220fe524ed47b6b8`，見[parity紀錄](../../output/playwright/motion-composition-stroboscopic-lab/feedback-full-root/package-parity.json)。主agent另直接核所有host pan原始metrics，iframe位移與其host捲動等量反向；test-only修正沒有改這些entry bytes。

本機fake-LMS／Chrome可信觸控及手機emulation不能代替真實Moodle學生attempt、正式player拓撲、實體手機／工具列／native picker及裝置zoom驗收。跨來源host不能由本活動存取，其原生行為也須在部署環境另驗。本輪尚未宣稱Moodle-ready。
