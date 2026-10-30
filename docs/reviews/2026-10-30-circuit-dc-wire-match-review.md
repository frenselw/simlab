# 看圖接線分支審核（2026-10-30）

- Reviewer：用戶指定的 GPT-6 Astra，reasoning effort `xhigh`。
- 分支：`codex/circuit-dc-wire-match`。
- 基準：merge-base `0fc1d30922de42aeb7a9ad3ec3efdd24972c89c5`。
- 審核 HEAD：`a9a5cb4`；第二輪另包括本次未提交的活動外層修正與回歸測試。
- 兩輪均審核整個分支 diff 及相關呼叫端／共用核心；未達到第四輪才限制最新改動的條件。
- 本次沒有修改 `sim/circuit-workbench/` 或其他 shared runtime，也沒有發布 Sites。

## 第一輪：一項 P2，已修正

**恢復／切回已答題目後，第一次復原會清空整題並保存。**

活動 `main.js` 原先以空白文件 mount，再用 `loadDocument()` 載入答案。
共用 editor 的載入操作本來就是可復原的文件編輯，因此空白變成上一個歷史步驟。
Reviewer 用正式 model history 與 codec 重現：恢復兩條線後 `canUndo=true`，
一次 undo 後導線數為零，capture 亦保存零條線。清除此題也保留清除前的 history，
不符合[活動計劃](../../plans/41-circuit-dc-wire-match.md)的歷史起點要求。

最小修正留在活動外層：以經 canonical codec/profile 驗證的保存文件作
`initialDocument`，不再把恢復當成編輯；清除此題後重建 editor，連沒有導線但有
開關操作歷史的情況也建立新起點。保留其他四題、固定佈局與本題開關狀態。

既有 browser owner 新增桌面／手機、來源／解壓套件案例：恢復後無 undo/redo、
切題返回、正常取線 undo/redo、Moodle mock 重進、取消／確認清除、清除後重進，
以及空線題的開關歷史清除。新增斷言曾在修正前實際執行並失敗，確認能捕捉原缺陷。

## 第二輪：沒有新增 findings

Reviewer 重新審核整個分支與修正，確認原 P2 已解決，沒有放寬固定題面或答案權限。
獨立驗證 160 組 revision／佈局的恢復起點、編輯 undo/redo、固定位置拒絕及清除起點，
全部通過。第一輪亦獨立執行六個活動 Node 測試、shared SCORM、既有 assessed
activities、meters-and-math 與 registry，全部通過。

## 執行證據與限制

| 檢查 | 實際結果與證據 |
|---|---|
| 整個分支的 JavaScript／manifest | `npm run check` 通過；最終兩個 JavaScript 修改另以 `node --check` 通過 |
| 測試登記 | `npm run check:tests` 通過：286 entries（247 Node／39 browser）、48 helpers、2 manual；沿用既有 browser owner |
| 全部 Node entries | `npm run test:fast -- --report=output/astra-review-fast-tests.json`：246 通過，`tools/ci-prepare.test.js` 被 120 秒 watchdog 標記 timeout，實際 exit code 0、耗時約 161 秒；獨立延長時限重跑結果見下 |
| 來源／解壓 SCORM browser | `node tools/circuit-wire-match-browser-regression.js` 通過：146 個摘要案例、0 runtime exception；含新增 source/package × 390/1280 的全部歷史起點斷言。證據 `output/playwright/wire-match/evidence.json` |
| 六包打包／同源檢查 | 修正後 `npm run package:circuit-platform` 通過；`output/circuit-platform-build.json` 及六個 ZIP 已更新 |
| 變更及文件 | `git diff --check`、新增報告與活動計劃的 `tools/check-docs.js` 通過 |

全 Node suite 在 UI 修正前啟動；此次修改只涉及活動 UI、既有 browser owner 及文件，
其最終行為由修正後重跑的來源／解壓 browser 驗證。Node 測試所測的評分、codec、
共用核心及 SCORM 邏輯沒有再修改。第二輪最終結論為無待修正的已確認程式問題。

CI 準備測試以較長 watchdog 獨立重跑通過（1/1）：
`output/astra-review-ci-prepare-retry.json`。因此 247 個 Node entries 均有通過證據，
但原本完整 suite 的報告仍為 246 通過／1 timeout，沒有改寫成整次一次通過。

這些證據不能代替部署驗收。
真 Moodle 容量設定、實體手機及 T4 尚未驗證；未重跑全專案 39 個 browser entries，
不宣稱整個專案或本活動已達 Moodle-ready。
