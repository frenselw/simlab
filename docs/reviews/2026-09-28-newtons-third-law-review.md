# 牛頓第三定律活動：獨立分支審核

## 範圍與方法

- 分支：`codex/newtons-third-law-reaction-force-lab`；基準 `main` 為 `9fea6f1`，初審版本為 `9139a12`。
- Reviewer 1：GPT-6 Luna，Max thinking effort。
- Reviewer 2：GPT-6 Sol，Max thinking effort。
- 兩位各自獨立審核整個分支，均涵蓋五類題目的物理、用字、介面、操作、評分、保存／SCORM、測試及打包；沒有按領域分工。初審完成前沒有交換彼此結論。
- 初審閱讀程式、共用規範、活動計劃及既有 source／解壓 ZIP 瀏覽器報告和截圖。兩位沒有修改產品程式或重跑共用 browser runner；主代理另以實際瀏覽器重現、修正及執行回歸測試。

## 合併發現與跟進

| 問題 | 提出者 | 重現／影響 | 修正 |
|---|---|---|---|
| P2：拖回起筆點仍記錄途中力值 | Sol | 新畫及修改箭尖都可觸發：移開後拉回起筆點放手，畫面位置與保存值不符。主代理實際重現空白變成 5.5 N、既有 5.5 N 變成 11 N | 回到最小半徑內清除暫時向量及預覽；最終放手取消此次修改，保留拖動前的答案，不保存途中力值或新增復原記錄 |
| P2：選項重建後鍵盤焦點消失 | Luna | 主代理以實際 Enter 啟動題目、配對、物體及起點按鈕，四者均掉回頁面 BODY | 按穩定選項 ID 還原焦點，使用 `preventScroll` 保留面板捲動位置；鍵盤完成作圖後聚焦新箭尖 |
| P2：無障礙資訊缺少已知力方向 | 兩位 | 圖只有通用名稱，文字只提供大小；讀屏使用者不能確定擺球及地球題的反向角度。Sol 亦指出鍵盤暫時向量缺少即時讀數 | 為圖加入場景位置、已知力施受力者、大小、方向及角度描述；抓手和即時通知報讀工作向量。只描述已知題目，不預先透露正解，不增加主要介面的鍵盤提示 |
| P2：提交後解說未針對錯誤概念 | Sol | 舊版主要列出對錯項目，沒有充分解釋錯誤受力者、繩與固定架、重力與支持力等選擇 | 新增 `feedback.js`，按已提交答案及評分項目解釋受力者、起點、作用線、反向、等大及同類相互作用；只在可信提交結果顯示 |

本輪沒有發現已確認的物理模型、評分算術、權威快照或 SCORM 生命週期缺陷。沒有更動生成器版本、題目數值、評分準則或舊作答相容性。使用者已批准的支持力顯示偏移、F／F′ 符號、公開大小刻度及面板保留位置繼續保留。

## 驗證證據

- 初審原文：`output/reviews/third-law-luna-initial.md`、`output/reviews/third-law-sol-initial.md`；本文件保存合併後的完整可執行發現。
- 修正前實測：`output/reviews/parent-focus-probe.json`、`output/reviews/parent-anchor-probe.json`。
- `feedback.test.js` 已通過兩個 generator version、各 75 種變化的描述及解說檢查，包含空白／部分作答、方向、大小、受力者與特殊錯誤概念；並已加入 `tools/run-tests.js`。
- `node tools/newtons-third-law-browser-regression.js --review` 已通過 source 及實際解壓 ZIP：320／390px trusted touch、1280px mouse、新畫／修改、最終 pointerup 回到起點、原草稿及 undo 不變、四類按鈕焦點、鍵盤工作值及保存、提交前不洩漏解說及提交後特定解說。
- Chrome 154 accessibility tree 實測讀到擺球及地球場景描述；已知大小與角度完整。這是瀏覽器無障礙樹證據，不等同實際讀屏軟件驗收。
- 本輪 focused 紀錄：`output/third-law-review-focused.log`、`output/playwright/newtons-third-law/review-report.json`；browser errors 為空。
- 完整活動 browser runner 亦已通過：source／ZIP 各 9 種 viewport、8 個實際滑鼠配對得 100 分，320／390px 及短 iframe 各 18 類觸控檢查；新增 review 矩陣亦全部通過，`errors=[]`。紀錄：`output/playwright/newtons-third-law/report.json`。
- 已目視核對新解說在 390px 及 1280px 的畫面；面板文字正常換行，寬度檢查沒有橫向溢出。截圖為同目錄 `source-390-review-explanations.png`、`source-1280-review-explanations.png`，ZIP 亦有對應截圖。

## 覆核及完整驗收

兩位完成各自的整體覆核後，均確認四項已修正，沒有剩餘的已確認可執行程式問題。

| Reviewer | 覆核結論與獨立檢查 | 原始報告 |
|---|---|---|
| GPT-6 Luna Max | 未發現未解決缺陷；獨立跑 `feedback.test.js` 通過，核對完整及 focused source／ZIP 報告、四項修正、manifest／測試註冊及原有物理／評分／保存邊界 | `output/reviews/third-law-luna-followup.md` |
| GPT-6 Sol Max | 未發現未解決缺陷；獨立跑七個活動純測試、manifest 對照、`node tools/check.js` 及 diff 檢查全部通過，核對 focused 瀏覽器報告及手機／桌面解說截圖 | `output/reviews/third-law-sol-followup.md` |

兩位均未重跑共用 browser runner，避免與主代理的完整回歸測試互相干擾。覆核不等同保證軟件沒有任何潛在問題；結論限定於已檢查的分支及上述證據。

本輪全專案驗收已完成：

| 檢查 | 結果 | 紀錄 |
|---|---|---|
| `npm run check` | 通過，exit 0 | `output/third-law-review-check.log` |
| 完整 `npm test` | 通過，exit 0；包含本活動及其他活動、共用 SCORM／activity-flow 回歸 | `output/third-law-review-full-test.log` |
| `npm run package:all` | 通過，exit 0；全部 SCORM ZIP 重新產生及驗證 | `output/third-law-review-packages.log` |
| 最新第三定律 ZIP 逐檔核對 | 16 個檔案，43,952 bytes；根目錄 manifest 及全部檔案均與目前 source 一致 | `output/third-law-review-package-parity.json` |
| `git diff --check main` | 通過 | 相對合併基準的完整 working-tree diff |

最新套件：`output/newtons-third-law-reaction-force-lab-scorm.zip`。SHA-256：`24c6b0ea8ab89e034f68ffd6b1db1440c13c22157db8029a20f9680d11d89049`。

## 尚未驗證的部署範圍

真實 Moodle 學生 attempt 的提交、續作及新 attempt、實體手機的現視窗／新視窗手勢與跨來源 player、實際讀屏軟件操作仍需部署驗收。本機 fake-LMS、CDP trusted touch 及 accessibility tree 不代表上述驗收已完成。
