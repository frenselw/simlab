# 三工作台審核修正（2026-10-17）

審核及修正起點為 `91251dc7b784105e11a81ef3eb1377ebe95b4e00`，分支
`codex/circuit-audit-fixes`。範圍是使用者提供報告的九項 P2，加上只影響
`wires:false` 嵌入配置的一項 P2；沒有新增教學功能或依賴。

三個入口維持非評分工作台；rubric、SCORM attempt、作答 phase/variant
為 N/A。文件仍為 DC v6／AC v7／家庭 v8，session schema 不變。
共享修改亦影響兩個 DC 評量 consumer，須一併重建及跑其既有 Node 回歸。
不改評量的權威答案、rubric、保存或提交契約。

## 修正及驗收對應

| 報告編號 | 最終行為及回歸決定 |
|---|---|
| DC-01 | 按實際支路定律分開核對安培／伏特殘差；線搜尋必須改善殘差。低壓低阻熱燈可收斂；保留真正無平衡解的有界失敗。 |
| DC-02 | 使用相對尺度及線性求解的逐未知量浮點誤差估計，避免微電流提早收斂，也不把零電流支路的捨入噪音當故障。24 組獨立熱平衡求根核對電源／燈泡／導線電流及功率。 |
| AC-01 | 綁定驗證、電路更新的重新繪圖及取樣共用 `targetValid`；有限電阻線中段的電壓探頭解除綁定，取樣未知，原有波形保留缺口。有效端點可重新接上。 |
| AC-02 | 電容顯示尺度只用自己的初始／觀察峰值，以及同電氣區域或經變壓器耦合的電源。230 V 孤立源不會清掉另一電容的 0.01 V／200 μC／1 μJ。 |
| AC-03 | 延續判斷包括未受影響的儲能域。RC／RL／LC 新增或單端接入懸空線保留時間及儲能；真正受影響的儲能參數仍重建。production session 保存／恢復後執行續算。 |
| H-01 | 逐幀更新供電來源文字，只更新原有文字節點；RCD 跳掣後面板即時反映，輸入焦點保持。 |
| H-02 | 旋轉在副本先錨定插頭位置及角度，核對線長及完整文件才提交；八方向接觸及功率保持，可復原／重做／保存恢復；非法旋轉原子拒絕。 |
| H-03 | 不可編輯家庭線阻使用當前 `analysis.wires[id].resistance`，標示「導線等效電阻」0.001 Ω；文件佔位值仍為 0。 |
| H-04 | `wireEndpoints` 統一排除 hidden 端子，供接線選單、connect、attach 及文件驗證使用。內部求解／三腳接觸仍用完整 endpoints；隱藏插腳不能經命令或匯入繞過。 |
| 配置-01 | `wires:false` 比較幾何直接手部接觸，建立及解除接觸都拒絕；不改接觸關係的搬動仍可用。 |

匯入兼容界限：舊文件若曾利用漏洞把普通導線接到拖板隱藏插腳，現在會明確
拒絕匯入；不靜默刪線、改接或覆寫原檔。正常文件及現有版本保存格式保持。

## 測試擁有者與執行證據

- 新 Node 入口 `sim/circuit-workbench/audit-followup.test.js` 已登記於
  `tools/test-registry.js`；其餘沿用原核心、顯示、家庭、瞬態及評量回歸。
- AC browser owner 的 `--audit-followup-smoke` 接在原 audit helper，來源／
  解壓 ZIP、1280／390 px 共 88 checks 通過；涵蓋失效探頭、電容及 RC/RL/LC。
- 家庭 browser owner 的同名專項，來源／解壓 ZIP、1280／390 px 共四組通過；
  涵蓋 RCD 文字與焦點、可信 R 鍵旋轉／復原、線阻及接線選單。
- 另按使用者要求以 Git Bash 的 **Playwright CLI** wrapper 執行獨立操作
  回歸：來源／ZIP × 1280／390 px 四組全部通過，涵蓋九項標準工作台
  發現，`pageErrors: []`。手機面板實際顯示 0.001 Ω，已檢視截圖。
  完整腳本、`run.log` 及四張截圖在 `output/playwright/audit-cli/`。
- `npm run check`、`git diff --check` 通過。`check:tests`：241 入口，
  209 Node、32 browser、48 helpers、2 manual。
- 最終 `npm run test:fast` **209/209 通過**，含兩個 DC 評量 consumer，
  報告 `output/ci-tests/local-1792237297193-81756/report.json`，完整輸出
  `output/audit-fast-tests-final.log`。初次重跑發現零電流支路的尺度問題，
  補入求解器既有 roundoff 後完整重跑通過；沒有放寬微電流相對驗收。
- 修正提交 `97b5804`；`node tools/run-tests.js --affected
  --base=91251dc7b784105e11a81ef3eb1377ebe95b4e00 --head=97b5804 --plan`
  的 committed preview 為 `full`、241 入口、`packages: all`，原因是
  `tools/test-registry.js` 改動，包含 DC／AC／家庭／評量 browser owners。
  證據 `output/audit-selection-preview.json`。這是選測範圍，不宣稱全部
  32 browser entries 或遠端 GitHub CI 已通過。
- `npm run package:circuit-platform` 已重建 DC、AC、家庭三個 standalone ZIP
  及兩個 DC SCORM ZIP；建構證據 `output/circuit-platform-build.json`。

以上是本地專項回歸，不代表完整 browser／trusted-touch host matrix 已重新
驗收。真手機、真 Moodle、線上 Sites 或既有發布 ZIP 的更新均未執行；
不宣稱本輪已完成 Moodle-ready 或全套 package-ready 門檻。
