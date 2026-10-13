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

7685a24 的 [P2 run 38423093499](https://github.com/frenselw/simlab/actions/runs/38423093499)
已完成 plan、checks 和四個 Node job，202 個 Node 入口及五個靜態／打包 checks 全部成功。
已下載核對 SHA、plan hash、預期／完成 ID 和 passed 狀態；Node 測試時間為
106／58／114／91 秒。從 plan job 開始至最後 Node job 結束約 153 秒，包含其前置安裝及上傳。
其後四個 browser、aggregate 及 check 全部成功。下載的九份報告完成 233 個
正式入口及五個靜態／打包 checks；八份 DC coverage 完成清單恰好覆蓋 74 區塊，
無缺失／重複。Receipt 的 SHA、plan hash 與九個來源相符。
P1／P2 的 sim runtime 檔案完全一致，browser 的 Ubuntu image 20261004.327.1、
Node／Chrome／CJK 字體指紋一致，滿足同應用版本／環境對照。
整個 run 從 15:33:31 至 16:22:21 UTC，共 48 分 50 秒；四片測試約
37.6／47.2／46.6／39.1 分鐘。較 P1 約 58 分鐘改善，仍未達全量 45 分鐘目標。

P2 的 GitHub 執行仍跑完整登記聯集，只輸出 selector 的 shadow plan。Node 與
browser 各最多四片，按基準成功耗時分配；每片只執行不可變 plan 指定的入口。
完整成功、case／mode 集合及環境對照已完成，允許啟用 P3 日常選跑與獨立 full-check。
時間尚未達標，P4 仍待量測及優化；人工、真手機及真 Moodle 驗收仍按生產指南。

## P3 首輪歷史失敗

bbab7fe 的 run 38434350961 已實際選擇 full，原因是 main 尚無同政策合格成功
基準。Plan、全部 202 Node 入口及五個 checks 成功，SHA／workflow revision／
plan hash 已從 artifacts 核對。Browser-4 的 package editing 成功；AC browser
在 ZIP、390px、L=1 的 protection budget 發現 113ms long task，超過原 100ms
上限；integration maxAdvance 約 25.2ms、可信輸入延遲約 25.3–52.5ms。
首次 report／log／畫面保留於 output/ci-tests/p3-first-failure-report 及
p3-first-failure-evidence。其他獨立入口繼續執行，未用重跑或放寬斷言掩蓋此失敗。
原因尚待分類，P3 不宣稱完成，不部署至 main。

該 run 其後已完成：其他三個 browser 分片全部成功；aggregate／check 正確失敗，
沒有用其他成功結果掩蓋 AC 的失敗。九份最終報告與 gate log 保留於
output/ci-tests/p3-complete-reports 及 p3-failed-gate.log。

測試碼另發現性能 observer 一直覆蓋到測試專用 captureSession／getAnalysis
診斷，混入了非播放／輸入工作。候選修正先 drain takeRecords 再停止觀察，
保留所有已完成的 live-window long task，然後才做 snapshot 凍結及診斷。
80ms integration／100ms input／100ms long-task 上限及物理斷言不變。
新增自檢證明：測試專用 150ms snapshot 不再污染窗口，而 live-window 113ms
仍被拒絕。這只證明測量邊界正確，尚未證明原 CI 113ms 的歸因；嚴格瀏覽器
專項排在本機校準程序結束後執行，避免本機競爭負載。

覆核補回原有暫停後 150ms 背景觀察：第一個 snapshot 前 drain／disconnect，
讀完 snapshot 後重新觀察 paused-background 150ms，再 drain／disconnect 才讀
第二個 snapshot。兩個實際觀察窗口與 snapshot 耗時分別記錄；暫停後真正
113ms 工作亦由自檢確認會失敗，已由 callback delivered 的 long task 和尚在
takeRecords queue 的 long task 都保留。失敗預算檢查前保存當時畫面。
開發分支將在固定 Linux 重跑完整候選，而本機校準及安靜專項維持原排隊；
兩者分開記錄，不能以候選通過反推原 113ms 的發生階段。

完成 run 的 API job 時間比較：P1 等待 3513 秒、180.35 runner 分鐘；P2 等待
2930 秒、181.65 runner 分鐘。等待減少 16.6%，用量增加約 0.7%。P2 的 browser
setup 約 25–37 秒，上傳及結束約 5–8 秒，主要成本仍在案例執行。

## 已驗證版本與實際啟用

33ebdd2 的 [run 38443342666](https://github.com/frenselw/simlab/actions/runs/38443342666)
完整成功，九個來源報告／receipt 核對 234 個正式入口及五個 checks，全部 passed。
整體 18:01:05–18:45:26 UTC，44 分 21 秒，達到首輪全量 45 分鐘目標。
此成功不抹除 bbab7fe 首次 113ms 失敗，也不能證明其發生階段。

main 已由 a8be3a5 正常 fast-forward 至相同 33ebdd2 並推送，沒有合併暫存
CSS fixture 或後續未提交診斷。正式 main push run 38450529982 和指定精確
33ebdd2 的 Quality Full workflow_dispatch run 38450808884 分開執行中；
完成後才會查證合格 main receipt 及 independent full-check。每日 03:30 Macau
workflow 已存在 default branch，實際 schedule 事件仍須另記錄。

四個單提交演練分支已於獨立 managed worktree 準備，本機 diff 及 selector 核對
文件 docs、單活動 affected（203 Node＋該活動 browser）、shared／unknown full。
其參考 base 為 33ebdd2，尚未推送；需先取得該 SHA 正式 main 成功來源。
Fixture 只改 README、兩個 CSS 註解或未知文字檔，驗證後清理，不能合併 main。

main push run 38450529982 與獨立 full-check run 38450808884 其後全數成功，
分別耗時 43 分 56 秒及 44 分 36 秒。正式 main receipt 的 repository、workflow ID、
push event、main ref、精確 SHA、同政策 hash 14910dc5…、plan hash 及九份完整
報告已核對合格；independent Full 自己完成完整 gates，未借用日常結果。

四個 probe 已推送：docs run 38457469392 僅 docs job（links＋diff format），
不需 browser 的 matrix 正確 skipped，aggregate／check 成功，總耗時 68 秒。
activity run 38457469887 選擇全部 203 Node、該活動一個完整 browser 入口及
該套件 checks，沒有選其他活動；全部成功，總耗時 5 分 4 秒。
shared run 38457468861、unknown run 38457468272 的真實 plan 均為 full／234
入口／兩類打包，正在完成。四份 plan 的基底來源均為已查證的 main 33ebdd2。
這是初輪代表樣本，長期 median／P95 仍按正常開發二十次觀察累積。

兩個全量 probe 其後全部成功：shared run 38457468861 耗時 2674 秒
（44 分 34 秒）、181.82 runner 分鐘；unknown run 38457468272 耗時
2677 秒（44 分 37 秒）、180.63 runner 分鐘。各自九份報告覆蓋 234 個
正式入口及五個 checks，plan hash、tested SHA、policy、實際 job ID 與
receipt 均已核對。證據保留於 output/ci-tests/p3-probe-shared-final 及
p3-probe-unknown-final，含 authoritative run metadata 與 verified-summary.json。
至此 P3 的四類實際演練、日常 check 與独立 full-check 完成，允許開始 P4。
Shared-core 15–25 分鐘仍未達標；排程 workflow 已部署，尚無實際 schedule 事件證據。
