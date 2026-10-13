# CI 測試基準盤點（2026-10-13）

本文件是 [改善計劃](../plans/34-ci-test-improvement-plan.md) P0 的證據，不修改活動驗收契約。
應用版本基準：a8be3a5；完整成功歷史：2235858。兩者不能當作同一版本已通過。

## 正式入口與責任

[機讀清單](ci-test-baseline-2026-10-13.json) 保存原 210 個 runner 入口加六個 workflow 額外 browser 入口，共 216 項，包含 file、args、kind、owner、case modules 和既有專項旗標。DC source／package 分開記錄。

191 個原 .test.js 均為 Node 邏輯或工具契約檢查；其中引用 browser helper 的測試驗證函式／字串／mock，不啟動真實 browser。此分類只描述入口執行成本，不能把 browser wiring 的 Node 字串檢查當作真實互動證據。

19 個原 browser 入口加六個額外入口保留於同一 runner；P1 新增的 runner／環境自檢另計，不改寫歷史 216 數字。npm test 預設跑完整聯集；CI 暫時仍分 registered 四片及 extra 一片，保持原覆蓋並先量測。

電路 browser 由既有 case modules 和入口的 inline 區段共同組成。DC 須保留其主迴圈、refinements、cable handling 及結尾 T1–T3／fullscreen／unsupported 流程；不能用所有 smoke 旗標聯集假設等於完整入口。P2 用 case／mode 清單逐區段核對後才拆分。

| 家族 | 主責入口／邊界 |
|---|---|
| 電路 DC | circuit-workbench-browser-regression，source 與 package；case module 名稱與 inline／尾段共同盤點 |
| 電路 AC | circuit-ac-browser-regression，物理顯示、保護、preview、播放、儀器、宿主與套件 |
| 電路整合 | connections、platform、assessed；共用 editor 改動包含三者 |
| 共用顯示與宿主 | scorm-fullscreen、fullscreen-rollout、mobile-touch；不能按單一活動名稱縮減共用依賴 |
| 一般活動 | 各活動 browser 的 owner 見機讀清單；活動 runtime、manifest 及共用 helper 合併選擇 |
| 真機／Moodle | T4，尚須實機及實帳戶驗收，CI 不提供此證據 |

## GitHub 的已取得結果

- [成功 run 38373114857](https://github.com/frenselw/simlab/actions/runs/38373114857)，2235858：所有既有 Quality jobs 成功。
- 該 run 四片約 28.4／26.6／54.0／58.0 分鐘，額外 browser 約 10.3 分鐘。成功最大／最小分片時間約 2.18 倍，適合先拆分大入口。
- runner image：ubuntu-24.04，20261004.327.1；Node 22.23.3，npm 10.9.9。該 image 的官方軟體清單為 Chrome 154.0.8037.97。
- [後續 run 38374651986](https://github.com/frenselw/simlab/actions/runs/38374651986)，8d24804：兩片失敗，另外兩片及 extra browser 成功。未跑後續入口不能算通過。
- main 基準 run 38375682732 與新分支 run 38375730194 同為 a8be3a5；main 後續已完成且失敗，suite 1／2 失敗，suite 3／4 及 extra browser 成功，符合上述兩個測試失敗。此基準不被移出 gate。
- 讀取 GitHub：main 沒有 branch protection（API 404：Branch not protected），repository rulesets 回傳空陣列；沒有新增強制 PR 或修改保護規則。

## 已定位的失敗

| 問題 | 證據／處理 |
|---|---|
| 恢復後合法續作的動態值使用 deepEqual | ac-dependency-audit.test.js 的 0.3016362366057599 與 0.30163623660575994 差約 5.6e-17。只對重求解動態 i／v 使用四倍 machine epsilon，其他 schema／state 仍精確相等；用 1e-8 反例證明不能接受物理偏差 |
| slider preview 在移動門檻前被當成已開始 | scope 的 touch sample 在尚未跨過 6px 時記錄 authoritative snapshot；新版允許未成為參數 preview 的拖動繼續播放。改為已跨門檻後核對多次凍結、畫面持續變化及實際提交 |
| 本機 Chrome sandbox 拒絕啟動 | 首次 focused scope 執行 exit 4294930433；授權執行可啟動。此錯誤不代表產品 assertion 失敗 |

以上兩個規格／比較修正只觸及測試，不改求解器、editor 或 learner runtime。驗證結果另依實际執行報告記錄。

## 尚未自動涵蓋的驗收

mobile-scroll-browser-regression.js 不在原 216 入口；原 mobile-scroll-browser-regression.test.js 只驗證工具契約。生產指南要求的 host／phase／mode／operation 矩陣不可因此省略：T0–T3、source／解壓套件、可信觸控、恢復後續作及全部可保存狀態仍屬發佈驗收。force-orthogonal 的 shell／Playwright 執行入口亦須另記真實執行證據，其 .test.js 並不能替代。

日常綠燈、CI 全量與 package-ready／Moodle-ready 的差別仍以生產指南為準。P2 機讀選擇器須保守識別共用 helper 的反向消費者；沒有映射一律全量。

## P1 的環境及量測

P1 固定 Ubuntu 24.04／Node 22.23.3。官方 Chrome for Testing catalogue 沒有 image 的 154.0.8037.97，但有 154.0.8037.92；選擇可下載的 154.0.8037.92 作待驗證的固定版本，不能把舊 image 成功直接移用為新版成功。

每入口分開記錄 stdout／stderr、開始／結束、耗時、exit code、timeout 和未執行狀態。GitHub 保存環境、增量 report、summary、首次失敗 log 和既有 screenshots／JSON；run_attempt 及 job key 分開命名。

本機 Node 是 26.2.0；其結果作本機證據，GitHub 仍要在固定 Node 22.23.3／Chrome 上驗證。原生動畫性能檢查應在一個 browser job 內執行，不與其他本機重負載測試的耗時混為同環境結果。

## P1 已執行的本地驗收

- 新 runner／CLI／環境自檢：通過。包括第一個入口失敗後後續仍執行、timeout、模式身份、報告保存、暫時 Windows 檔案鎖及版本不符。
- 全部 193 個 Node 入口通過，449.31 秒。報告位於 output/ci-tests/p1-node-verified/report.json；這是本機新工具驗證，未提交狀態不能充當 GitHub exact-SHA 綠燈。
- npm run check 通過；Quality YAML 可成功解析；git diff --check 通過。
- 23 個 SCORM 套件與電路平台四個套件建置、內容及指紋核對通過；打包前後 git diff --binary 完全一致，沒有生成 tracked source 差異。
- AC scope 專項：閒置本機、source＋ZIP，208 個觀察通過，保留 50Hz 速度下限及完整 snapshot 凍結斷言。先前與重 Node 基準同時執行的一輪，ZIP 最後速度檢查失敗；首次失敗留存為負載差異證據，不當作首次穩定通過。

P1 推送後需檢查固定 Linux／Chrome／Node 的完整執行與 artifacts；完整成功仍是 P3 切換條件。P2 可以在診斷及自檢達標後繼續，不以尚未完成的新 CI run 宣稱全量通過。
