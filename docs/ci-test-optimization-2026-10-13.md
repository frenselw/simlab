# 點按等待的初步校準

此為 P4 候選的校準歷程；正式 touch helper 已有未提交候選，Linux 全量驗收尚未完成。
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
