# P2 分組與選擇驗證

此記錄只證明已實際核對的範圍；日常選跑尚未啟用。

## 完整成功基準

[Quality run 38401477675](https://github.com/frenselw/simlab/actions/runs/38401477675)
驗證 fd2e3d096d3c234b4b3dd289d1152155b15d4435。四個 suite、extra browser、
語法／manifest 和兩類打包均成功。正式入口 218 項為原 216 加兩個 P1 工具自檢。
固定 Ubuntu 24.04、image 20261004.327.1、Node 22.23.3、Chrome 154.0.8037.92。
四片測試約 29／26／53／58 分鐘；extra 約 10 分鐘。報告保存於
output/ci-tests/p1-green-reference，成功計時摘要為 tools/test-durations.json。

## DC 舊區段與新群組對照

保持原 case 函數、inline 斷言及操作順序；新增明確群組守衛與逐區段完成記錄。
未移除 scoring、狀態恢復、可信觸控或 source／ZIP 驗證。

| 群組 | 原完整入口的區段 | 每 mode 區塊 |
|---|---|---|
| editing | startup、inline-editing（含 review）、camera、presets、cableHandling、quickControls、relay、componentSnapping、activity、foundation、textbook、refinements、bends、teaching、discard、paletteDrag、wireGrip、rotation、settings | 19 |
| instruments | labels、meterMath、meterSnapping、feedback、flow、flowScale、flowDrag、wireInspector、wireResistance、wireCurrent、help、microFlow、componentFlow、needle、displayMirror | 15 |
| interruptions | 九種操作 × 五種中斷的 rollback／合法續作矩陣 | 1（45 情境） |
| hosts | host-ownership（T1–T3 與原生捲動）、fullscreen-policy（嵌套／拒絕／不支援） | 2 |

四組 × source／ZIP 合計 74 區塊，interruption 合計 90 情境。群組清單自檢拒絕
重複及未完成；runner 自檢以凍結的 P0 清單確認另外 214 個原入口全部保留。
原無參數完整模式及專項 smoke 命令仍可用。

本機已實際通過 editing-both（38）、instruments-both（30）、
interruptions-source／package（各 1）、hosts-source／package（各 2）。
證據位於 output/playwright/circuit-workbench 各同名目錄。
ZIP interruption 首次被 Windows sandbox 阻止 Chrome 啟動，授權後成功；
這是啟動故障，不是 assertion retry。舊 Linux 完整成功與新 Windows 分組成功
不能單獨證明同環境對等；P2 推送後仍須固定 Linux 的新完整結果。

## 選擇與 gate 自檢

全部 202 個 Node 入口本機通過（493.655 秒），report 位於
output/ci-tests/p2-node/report.json。語法／manifest、文件連結及 diff 格式檢查通過。
本機版本與 GitHub 固定版本分開記錄，不能以本機時間宣稱 CI 快速層已達標。

選擇器測試涵蓋普通文件／混合改動、單活動、共用核心、反向資產消費者、
manifest、未知 runtime／helper、空差異、多提交、Unicode rename 兩端及刪除。
CI 比較以真實暫存 Git repository 驗證新分支、被取消 push 後的累積改動、
force-push、PR 基底更新及合併候選；不能改測 PR head 後聲稱已測 merge。
未知基底／API／依賴一律全量，非法 PR candidate 則失敗。

不可變 plan、四個 browser job 上限、按成功耗時分配、完整打包 gates、
缺失／最新失敗／部分重跑的彙總工具自檢通過。報告要求同 SHA、run、attempt、
job、plan、固定版本及字體指紋；後續成功不能消除未解釋的 assertion 失敗。
P2 將這些工具接上完整 Quality gate，尚待真實 workflow 演練，不能以自檢代替。

## 下一個交接

P2 的 GitHub 執行仍跑完整登記聯集，只輸出 selector 的 shadow plan。Node 與
browser 各最多四片，按基準成功耗時分配；每片只執行不可變 plan 指定的入口。
完整成功、case／mode 集合及環境對照完成後，才啟用 P3 日常選跑與獨立 full-check。
時間尚未達標，P4 仍待量測及優化；人工、真手機及真 Moodle 驗收仍按生產指南。
