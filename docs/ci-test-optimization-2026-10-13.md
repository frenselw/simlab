# 點按等待的初步校準

此為 P4 候選的獨立校準，尚未修改正式 touch helper，不能取代 P2 全量。
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
