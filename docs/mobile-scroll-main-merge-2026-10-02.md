# 手機滾動修復與更新 main 的合併記錄

日期：2026-10-02。使用者要求將修復 worktree 合併回原 checkout 的 main，並保留 main 新增的模擬。

整合驗證全部通過。交付採原 checkout 的 main fast-forward 到已包含更新 main 的修復 branch，保留原 main 與修復 branch 的全部 commit history；新建置20個SCORM套件與驗證 artifacts一併複製回原 checkout。

## 合併基準與衝突

| 項目 | Commit／處理 |
|---|---|
| 原 main | `6d50d4c149bed5d8d93d5d17833f5e6af7c4da85` |
| 共同起點 | `0bb873c8d7eb53ae2714fd100f453f8666ba2a94` |
| 19活動修復及摩擦力面板追修 | `49525fe2b7388a5b5e747497db325eaa6a7dd4aa` |
| 將更新 main 合入修復 branch | `b4ec1d223d865ae759db75b4fa2752069b7a73ea` |
| 共同 runner 新增活動 state invariant | `41d4841`；加入 `__motionComposition.getState()`，沒有改 learner runtime |
| `package.json` conflict | 同時保留 `test:browser:mobile-scroll` 及 `test:browser:motion-composition` |
| `tools/run-tests.js` conflict | 保留兩邊全部登記，145個唯一存在的測試檔案；沒有跳過或刪除新活動測試 |

其餘檔案沒有文字衝突。Main 新增的33個非衝突檔案及設定逐 byte 保留，包括完整 `motion-composition-stroboscopic-lab`、manifest、catalogue、活動計劃、browser runner 及審核記錄。修復 commit 的70個非衝突／非 runner-adaptation檔案亦原樣保留；後續只為兩份修復文件加上本記錄連結並保存歷史套件連結。[保存及登記核對 proof](../output/playwright/mobile-scroll-main-merge-preservation-proof.json)標識實際核對版本。

新增活動的模型、評分、保存schema、SCORM lifecycle、手勢 adapter與24px留白保持原 main版本。共同矩陣加入其 production state hook，避免只測DOM而漏掉答案變動。

## 整合後驗證

測試來源 commit：`41d4841`。後續記錄修訂只改 Markdown，不改 runtime、測試、manifest或catalogue。

| Gate／範圍 | 執行結果及證據 |
|---|---|
| 完整 `npm test` | 通過，exit0，全部145個登記檔案成功執行；[log](../output/playwright/verification-logs/mobile-scroll-main-merge-test.log) |
| 新增運動合成完整 source／extracted-package browser | 通過；完整四題作答、空白／部分／正確評分、round-trip／resume、pending／review、touch／cancel、短畫面／zoom、回饋可讀性及 enclosing host topologies；[report](../output/playwright/motion-composition-stroboscopic-lab/main-merge/report.json)的errors為空 |
| 更新 catalogue 共同滾動矩陣 | 通過，exit0；T3為有界外頁中的overflow element → 有界wrapper iframe → activity。全部20活動，320×500、activity iframe500px；22 cases／180 gesture entries，errors及issues為空；[JSON](../output/playwright/mobile-scroll-main-merge-T3-source-all-20.json)、[log](../output/playwright/verification-logs/mobile-scroll-main-merge-T3-source-all-20.log) |
| `npm run check` | 通過，exit0；JavaScript及SCORM 1.2 manifest profile；[log](../output/playwright/verification-logs/mobile-scroll-main-merge-check.log) |
| `npm run package:all` | 通過，exit0；20 ZIP／271 entries；[log](../output/playwright/verification-logs/mobile-scroll-main-merge-package-all.log) |
| Final ZIP exact entries／source byte parity | 通過，exit0；每包root manifest、exact declarations及runtime逐byte一致，全部20包；[proof](../output/playwright/mobile-scroll-main-merge-package-proof.json)、[log](../output/playwright/verification-logs/mobile-scroll-main-merge-package-proof.log) |
| `git diff --check`／新活動與 main byte parity | 全部通過；沒有unmerged entries，main新增活動與其測試／計劃／review records及catalogue逐byte保留 |

共同矩陣為初始畫面及重心1D／2D／3D：每案stage兩側上下掃、panel中段兩方向及頂／底邊界，3D另驗上／下背景。保留per-move／release samples、host／intermediate document／iframe位置、panel及production learner state；沒有移除正式listener或加入host鎖定receiver。這是新增catalogue整合檢查，不能稱為全部phase／renderer完整coverage；19活動的細分歷史矩陣及R04連續panel追修另見[修復驗證](mobile-scroll-repair-verification-2026-10-01.md)，新增活動的完整coverage在其browser report。

上述共同矩陣的manifest/runtime來源為192個唯一檔案，SHA256 `f512e167171704574183f3bdc5446a3bb08a074b8c8a6d72679c04a247c3838c`。Final packages已核對完全相同來源digest；合併前19套件proof保存在[歷史proof](../output/playwright/mobile-scroll-package-proof-before-main-merge.json)，未覆寫為20活動結果。

本機使用macOS Chrome 155及CDP可信touch；實際Moodle／iPhone／Android的T4狀態仍待驗。本次為本機branch合併；沒有push遠端或修改Moodle活動／attempt。Main的新套件位於`output/<slug>-scorm.zip`；合併前套件及被更新的本機artifacts備份位於`output/mobile-scroll-before-main-merge-2026-10-02/`。
