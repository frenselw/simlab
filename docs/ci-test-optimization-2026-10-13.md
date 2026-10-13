# 點按等待的初步校準

此為 P4 的校準歷程；手勢候選已有完整 Linux 成功證據，最新共用渲染修正的 Linux 全量驗收仍待完成。
下列「尚未採用」描述是當時狀態，最新進度見文末，不能取代 P2 全量。
忽略的 runner 位於 output/ci-tests/tap-experiment.js；保留原斷言、drag、
sample 與 cancel 路徑，只有無位移／無採樣／非取消的普通 tap 改為 native
touchStart／touchEnd，再等待兩個 requestAnimationFrame。

## 舊手機 smoke fixture 的問題

原版與候選首次執行都在相同的 footer 邊界斷言失敗。實際五個可見按鈕
left/right 在 94–314、top/bottom 在 402–446，均在 320px viewport／footer 內；
第六個 CSS 隱藏按鈕 rect 為零。原測試只判斷 hidden attribute，並嘗試直接
點按已移入手機操作選單的 focusSelected。首次失敗畫面保留於
output/ci-tests/phone-reference-failure/source-phone-footer-failure.png。

只修 fixture：以 getClientRects() 篩選實際顯示按鈕，仍要求非空及原邊界；
定位操作走既有 selectionAction() 的手機選單。沒有修改模擬、CSS、物理或
評分，也沒有放寬可見按鈕的邊界／camera／44px hit target／pan 狀態斷言。
修正後原等待與候選等待的 source／ZIP phone smoke 都成功。

## 已取得的候選結果

phone source／ZIP 共八次普通 tap 全部取得 trusted touch pointerdown、pointerup
和 click。單次實測 0.0646–0.1317 秒，中位數約 0.0853 秒；原 helper 的固定
等待本身合計 0.751 秒，尚未計 CDP 通訊。這是 focused 的本機初測，不能
據此宣稱整套 CI 的改善比例或所有宿主都已驗證。

證據為 output/ci-tests/tap-calibration/phone-usability.json 與 tap-timings.json。
rotation source／ZIP 的 12 個觀察已通過，涵蓋可信旋轉、實際直線 SVG 導線、
固定讀數、undo／restore 及短線原子拒絕；證據為
output/ci-tests/tap-rotation-calibration/rotation-straight.json。
完整 editing／instruments／hosts、固定 Linux 與同環境重複檢查尚待驗證；
只有 P3 交接達標後才正式採用，drag／中斷採樣不能縮掉。

宿主校準未通過：iframe 及 standalone 的 fullscreen 按鈕只被探針捕捉到
trusted touch click，沒有預期的 touch pointerdown／pointerup；增加頁面／字體
ready 或前後 RAF 均未解決。失敗 ledger、actual JSON 與截圖保留於
output/ci-tests/tap-hosts-calibration、-v2、-v3、-v4、-root-only 各目錄。
候選尚未採用；不能以 phone／rotation 的成功宣稱 fullscreen 校準通過。

## 保守的手勢狀態等待候選

output/ci-tests/gesture-experiment.js 只在頂層、非 fullscreen 的一般控制，且沒有
sample／cancel 回調時改用狀態等待。Tap 不送零位移 move；drag 保留原 25ms
touch-down 及八次 22ms 移動。TouchEnd 後等待 dragging、touchCount、touchBlocked
清除，再等待字體及兩個 RAF；iframe／fullscreen／採樣／取消沿用原完整時間。
只改忽略的編譯副本，正式 helper 尚未採用。

此候選的 source／ZIP phone smoke 和完整 hosts 四區塊通過，保留原 viewport、
pan、scroll ownership、fullscreen blocked／unsupported、模型／歷史斷言。
證據為 output/ci-tests/gesture-calibration-phone/phone-usability.json 及
gesture-calibration-hosts/coverage.json。完整 editing／instruments、Linux 與重複
驗證仍待完成。獨立 header 最小診斷記錄了完整可信事件，完整宿主前序的探針
仍未定位；保留原時序以避免把未校準範圍納入提速。

候選 editing 的 source／ZIP 全部 38 個 case／mode 區塊已完成，與原本機
editing-both 的 ID 集合完全一致，所有原斷言通過。案例耗時總和由
3065.682 秒降至 2113.383 秒，約減少 31.1%；兩次均為同一電腦及同一 sim
runtime，不同執行時間，未包含 browser startup，不能當作 Linux 或 P95 證據。
新證據為 output/ci-tests/gesture-calibration-editing/coverage.json。
instruments source／ZIP 正在同一程序後續執行；完成後才會開始安靜的 AC 性能
專項。正式 helper 尚未採用。

其後 instruments source／ZIP 30 區塊全數通過，案例耗時共 2188.596 秒；
editing／instruments／hosts 完成 38＋30＋4 區塊，sample／cancel／iframe／
fullscreen 保留原等待。Formal helper 仍未採用，Linux 與重複驗證仍未完成。

安靜的原 AC protection-budget 專項仍出現真正 live-window 105ms；snapshot
只約 0.3ms。RMS 額外探針診斷成本約 0–1.4ms，後續 live-task 最高 122ms，
因此不能把失敗歸因為 snapshot／RMS 探針。CPU profile 及 browser timeline
分別保留於 output/ci-tests/ac-budget-cpu-profile 和 ac-budget-timeline。
Timeline 那一輪原 96 個 source／ZIP checks 通過，但不抹除前序失敗；
本機結果仍不一致。主要觀察包括 script、layout／repaint 及 GC，尚無足夠證據
指定一個模擬缺陷或修改 runtime；尚未改動模擬以追趕預算。

相同本機環境的 source／ZIP phone 候選校準再獨立執行兩輪，均通過所有原
stock、定位、pan、320px 控制與資料不變斷言。重複證據位於
output/ci-tests/gesture-repeat/gesture-repeat-1-phone 和 -2-phone。
這是功能／手勢的定向重複，不是 AC 性能重跑綠燈，Linux 及整體分片時間仍待驗收。

已將相同候選整理為正式 driver 的本機未提交改動，並直接執行其 source／ZIP
phone smoke 通過。原完整 sample／cancel／iframe／fullscreen 時序仍保留。
這是待審閱／驗證的 P4 準備，尚未推送或合併 main；P3 實際選跑交接尚未達標。

正式候選 driver 其後完成 interruptions source／ZIP：兩個區塊全部成功，
包含九種操作乘五種中斷、各 mode 45 個情境。證據為
output/playwright/circuit-workbench/interruptions-both/coverage.json 及 evidence.json。
與 editing／instruments／hosts ledger 合併核對，共 74 個唯一 case／mode ID，
全部 passed，無遺漏或重複。Linux 提速與正式採用仍待 P3 交接及全量驗證。

## 固定 Linux 的下一步量測

main run 38450529982 的四個 browser job 實際測試時間分別為
2490／2544／2487／2334 秒；independent Full 38450808884 為
2490／2550／2574／2547 秒。DC editing／instruments 每個 source 或 ZIP 入口
約 1236–1303 秒，是最主要的成本；AC 完整入口約 1045–1191 秒，motion
composition 約 915–939 秒。前置安裝和 artifact 成本只佔小部分。
P4 先驗證已校準 DC helper 的 Linux 效果，再以成功報告更新分片權重。
目前 shared-core 15–25 分鐘目標仍未達標，不以全量 45 分鐘達標代替它。

該 main run 四片合計 9855 秒（164.25 runner 分鐘），四片即使完全均衡，
測試本身亦約需 41 分 4 秒；此下界不包含 setup／上傳／gate。因此再次分片
分配不能單獨達到 15–25 分鐘。須量測真正減少等待的效果；同時記錄總
runner 分鐘，避免只用更多 runner 換取表面縮時。

正式候選的本機 `npm run test:fast` 已完成 203／203，包含選擇器、不可變
plan、部分重跑 gate、環境及 protection-budget 測量窗口自檢。報告為
output/ci-tests/local-1791922877006-134128/report.json；兩個修改的 browser
檔案語法、文件連結及 diff-format 亦通過。此批沒有 sim runtime 修改。

P3 shared／unknown 全量演練完成並核對後，已滿足 P4 開始條件。
本批將正式候選提交至開發分支供固定 Linux 全量驗證：DC 一般手勢採
狀態等待，原採樣／取消／宿主時序不變；AC 只增加 RMS 探針耗時診斷，
原預算及斷言不變。候選尚未合併 main，不以本機成功宣稱 Linux 提速完成。

後續盤點發現 selector 的 `docs/ci-*` 政策分類也包含三份純證據 Markdown，
使單純更新耗時／失敗記錄觸發全量。候選改為明列這三份記錄走文件層；
機器讀取的 baseline JSON、未知 CI 文件、正式計劃及生產契約仍保守全量。
混合程式改動和未驗證 main base 仍全量；selector、baseline／rerun 及 plan
自檢通過。此改動在本機準備，待現有 run 38463646905 完成後才與實測
分片權重一併提交，避免取消正在量測的首次完整 P4 run。

量測期間 GitHub 的 jobs endpoint 連續回傳 HTTP 502，CLI watcher 因而退出；
run endpoint 隨後確認相同 38463646905 仍在執行，沒有重啟 CI。共用 API
client 原本會立即退出，候選對唯讀 GET 的 502／503／504 保留首次診斷並
重試一次，第二次仍失敗即報錯。403、無效資料及 gate assertion 保持失敗。
此為已觀察到的服務故障處理，不增加產品 assertion 的重跑綠燈機制。

P4 run 38463646905 的第一份 browser-4 報告已核對通過：ZIP editing
從 main 同環境的 1236.355 秒降至 835.127 秒，減少約 32.5%；完整 AC
1097.596 秒（原 1045.434 秒），另外兩個活動入口亦成功。Node／Chrome、
Ubuntu image 20261004.327.1、CJK 字體指紋與 main 對照相同。
這是單入口實測，整體 wall time／runner 用量仍待其他三片及完整 gate；
證據為 output/ci-tests/p4-first-browser-report。

## 首輪 P4 固定 Linux 完整结果

run 38463646905（6a5d395）完成 234 個正式入口及五個 checks，全部成功。
九份報告、完整 job／entry 集合、receipt、SHA／plan／policy 均已核對。
證據為 output/ci-tests/p4-linux-final，含 run-metadata、verified-summary、
duration-analysis 及依完整成功入口產生的 proposed-test-durations.json。

統一按 run createdAt 至最後 job completedAt 計算：P4 2511 秒
（41 分 51 秒）、156.98 runner 分鐘；main 基準 2635 秒（43 分 55 秒）、
174.88 runner 分鐘。總等待減少 4.7%，runner 用量減少 10.2%。
四片純測試合計由 9855.21 秒降至 8527.99 秒，減少約 13.5%；
等待改善比純測試小，需同時記錄 setup／上傳／gate 的服務耗時。

全部 234 個權重依此成功 run 更新。使用同一 LPT 分配器的估算為
2125.84／2138.24／2135.38／2128.52 秒，較當輪最慢 2198.40 秒約減少
一分鐘；這是編排估算，尚未當作新 CI 成功耗時。
本批另包含純證據文檔分類及已觀察到的 API 伺服器故障重試修正；
下一次固定 Linux 全量會核對整批候選，模擬 runtime 沒有修改。

首輪 P4 的四份 browser evidence 亦已下載，八份實際 coverage ledger
恰好完成 source／ZIP 共 74 個唯一 case／mode，全部 passed；ID 集合
與 P2 的實際完整 ledger 相同，無缺失或重複。證據保留於
output/ci-tests/p4-ledger-evidence，核對結果為
output/ci-tests/p4-linux-final/circuit-ledger-verification.json。

## 權重版首次失敗及共用渲染修正候選

f9f78ae 的 run 38469620322 正確失敗：browser-1 的 AC ZIP、390px、L=2
在實際播放／輸入窗口出現 100ms long task；integration 24.7ms、可信輸入
約 33–36ms，snapshot 約 0.3ms、RMS 探針最多 0.5ms。其餘入口及三片
browser 成功，aggregate／check 保留紅燈。首次報告、log 及 evidence 保留於
output/ci-tests/p4-weighted-first-failure、p4-weighted-first-failure.log 及
p4-weighted-first-failure-evidence，未以重跑消除首次 assertion。

本機未改 runtime 的隔離 timeline 重現 100ms；取消／控制的重複重繪
修正單獨仍有 120ms，未據此宣稱修好。後續讀取診斷及 stack 定位到
空的 scope UI 每幀及在主場景重繪後讀取 surface，強制 layout 約 8–15ms。
在修改前已告知使用者：候選把互動取消狀態與立即重繪分開，暫停及
pan／probe／pickWire 完成後重繪一次；空儀器清單保留 stock／lastDraw
更新，跳過無用的文件／尺寸查詢。有儀器時沿用原繪製路徑。
物理、評分及保存沒有修改；共用 DC／AC 的操作與渲染須重新驗證。

原 source／ZIP budget 加新增控制／空 scope 檢查合共 128 assertions
通過，原 80ms／100ms 上限不變；integration 最大 34.1ms、可信輸入
最大 63.6ms、long task 最大 88ms。實際控制重繪及文件／權威 physics
快照檢查通過；已有儀器的 scope smoke source／ZIP 208 assertions 通過。
控制、AC 平台及電路評量／保存 Node 檢查通過；完整中斷矩陣及固定 Linux
尚待驗證。本機 log 為 ac-empty-scope-budget、ac-scope-after-empty-guard
及 dc-interruptions-after-single-paint；候選尚未提交或合併 main。

其後 DC interruptions source／ZIP 的九種操作乘五種中斷共 90 情境
全部通過，AC live drag/playback source／ZIP 共 724 focused checks 通過。
已有 scope 工具的 208 checks 保持成功，空 scope 的幾何讀取亦有實際
browser assertion。正在同版本／本機环境重複已修復的 budget 專項，
不是對原 f9f78ae assertion 做重跑綠燈；Linux 完整驗收仍未完成。

相同候選第二輪原 budget 加控制 checks source／ZIP 再次 128 全數通過，
原 80ms／100ms 不變；log 為 output/ci-tests/ac-empty-scope-budget-repeat.log。
此共用 runtime 修正獨立提交，固定 Linux 全量會重新驗證其全部消費者。
當時並行上限仍四片，八片方案尚待使用者選擇；後續決定見文末。

共用渲染修正已提交為 a1c7b51，固定 Linux run 38479817006 正在執行。
203 個 Node 入口及五個 checks 的報告與不可變 plan 已核對通過；四個
browser job 尚未結束，不能宣稱完整成功或採用該輪的成功耗時。

空 scope 回歸另補強為先確認頁面在前景，再明確等待三個 RAF，避免
背景頁面沒有執行動畫卻因固定 100ms 等待而誤判成功。隔離載入 f9f78ae
舊 scope 的 source 在三幀內讀取 surface 三次，原零讀取斷言正確失敗；
目前修正版 source／ZIP 的 32 個控制 checks 全部通過。證據為
output/ci-tests/ac-old-scope-visible-regression.log 及
output/ci-tests/ac-visible-scope-regression.log。此 fixture 補強屬於後續
測試修正，未納入 a1c7b51 的 GitHub 驗收結果，亦未放寬性能預算。

## 共用渲染修正的首次 Linux 完整結果

a1c7b51 的 run 38479817006 首次執行完整成功。234 正式入口加五個
checks、九份報告與最終 receipt 的 SHA、不可變 plan、policy、actual job
身份均已核對。證據為 output/ci-tests/p4-render-fix-final；四份 browser
evidence 保留於 output/ci-tests/p4-render-fix-evidence。八份實際 ledger
共 74 個唯一 source／ZIP case／mode，全部 passed，ID 集合與 P2 相同。

完整 AC source／ZIP 共 8202 checks 成功，包含原有 12 個性能預算窗口
及 32 個控制重繪 checks。最大 integration 18.5ms、可信輸入 46.4ms、
long task 55ms；原 80／100ms 上限不變。此為修正後新版本的首次結果，
不覆蓋 f9f78ae 的失敗。核對摘要為 render-and-ledger-verification.json。

按 run createdAt 至最後 job completedAt，實測 2251 秒（37 分 31 秒）、
151.28 runner 分鐘。Main 基準同口徑 2635 秒、174.88 runner 分鐘，
等待減少 14.6%、runner 用量減少 13.5%。四片純測試分別為
2004.58／2147.53／2173.07／2157.31 秒，合計 8482.49 秒。
此結果符合首輪全量不超過 45 分鐘，仍未達 shared 15–25 分鐘目標。
該輪保持四片；八片估算仍非實測，當時使用者尚未接受提高上限或剩餘時間限制。

本機前景／三 RAF fixture 補強已提交為 3814eb4，其 Linux 驗收尚待
後續 run，不能把 a1c7b51 的成功當作該修正已驗收。P4 尚未合併 main，
實際 schedule 事件亦仍未觀察到。

## 使用者批准八片候選及本機等待診斷

使用者已批准「提高至八片，驗證原時間目標」。候選只把 browser 分配
上限從四改為八，Node 維持四片；31 個 browser 入口及全部 239 項結果
保留，每台 runner 仍只執行一個 browser worker。完整／單活動／純文件
分配及結果、worker、部分重跑 gate 自檢通過。正式八片 run 尚待執行，
先保留四片 a401848 的首次完整結果；沒有接受 37–40 分鐘作為完成限制。

最新 a1c7b51 成功入口的理想四片下限約 35.3 分鐘；按該輪權重重新
分配八片的純測試估算約 17.8 分鐘。正式候選沿用已驗證的 6a5d395
權重，其八片編排估算約 18.3 分鐘；兩者都是估算，不是八片實際耗時。

忽略的診斷副本完整執行 motion composition source／ZIP，保留全部原
斷言，Windows 本機成功，耗時 1165.66 秒。17493 次明確等待／輪詢的
要求時間共 747.81 秒，實際共 870.74 秒；6680 次 touch CDP 命令共
117.43 秒。這包含動畫、取樣、宿主及合法續作的必要等待，不能全部
刪除；也不能將 Windows 排程成本直接當作 Linux 改善幅度。證據為
output/ci-tests/motion-command-profile/command-costs.json 及 report.json。
原 sandbox Chrome 啟動失敗發生在 CDP／案例開始前，首次 log／報告
另存，之後正常啟動的診斷成功；不是以重跑掩蓋產品 assertion。
