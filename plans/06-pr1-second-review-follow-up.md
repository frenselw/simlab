# PR #1 第二次審核跟進計劃

## 目的

本計劃跟進 PR #1 在 head `e957b47` 仍然存在的 review findings。

完成目標：

- 修正 partial-final submission 可能產生的 final status／draft 混合狀態。
- 修正各活動的 draft restore 狀態錯誤。
- 區分 LMS 空值與讀取失敗。
- 以可執行狀態測試取代字串搜尋。
- 確保提交、刷新、離頁、重入及重新評分結果一致。
- 修正文件與實際行為的落差。

本輪不改變既有產品定位：SimLab 繼續用作低風險、無限次作答的 Moodle 練習活動。

## 實作狀態（2026-07-13）

- [x] 第一至第三階段的本地程式修改及自動測試已完成。
- [x] 共用 runtime 已實作 durable pending-final 兩階段提交、結構化讀取及 `loadAttempt()` startup gate。
- [x] 四個活動已改用共同 startup gate，read-error／inconsistent 不會建立或保存 attempt。
- [x] 雙層 fake LMS、跨 launch pending-final、finish retry 及狀態矩陣測試已通過。
- [x] FBD、參考系、地圖精度及平面鏡鍵盤保存修正已完成。
- [x] 原本只搜尋 source 字串的 submission test 已移除；提交狀態由可執行 fake LMS 行為測試覆蓋。
- [x] `npm run check`、`npm test`、`npm run package:all` 及 `git diff --check` 已通過。
- [x] 兩個獨立 reviewer 已完成多輪覆核，兩條路線最終均為 no findings。
- [ ] 真實 Moodle 學生帳戶驗收仍未進行，不在本輪自動驗證中聲稱完成。

## 執行原則

- [x] 保持 SCORM runtime 為薄層，不把活動 scoring 移入 runtime。
- [x] 優先修正共用狀態根因，不在四個活動重複加入不同 workaround。
- [x] 不引入大型測試框架；先抽取最小、可執行的狀態轉換 seam。
- [x] 所有 snapshot 繼續受 4000-byte 上限保護。
- [x] 保持舊 draft／review snapshot 的安全 fallback。
- [x] 所有啟動讀取採 fail-closed：讀取錯誤時不建立、編輯、提交或保存 attempt。
- [x] Fake LMS 明確區分 session buffer、durable store 和新 launch session。
- [x] 每一階段完成後執行相關測試，全部完成後重建四個 SCORM ZIP。

## 第一階段：合併前阻塞問題

### 1. Partial-final submission 狀態機

問題：final review、score、status 和 exit 已寫入 session 後，commit 仍可能失敗。現時 runtime 會讓活動繼續編輯及保存普通 draft，可能形成：

```text
lesson_status = passed / failed
score.raw = final score
suspend_data = draft
exit = suspend
```

修改：

- [x] 在任何 final `LMSSetValue()` 前，先完成 result、review snapshot、score、status 和 exit 的序列化、schema 及容量 preflight。
- [x] Preflight 完成後建立不可變的 pending-final payload；保存序列化字串及 primitive copy，不保留可被活動修改的物件引用。
- [x] 第一個 final `LMSSetValue()` 執行前，把 pending-final checkpoint 寫入 `suspend_data`，保持 incomplete／`exit = suspend`，並先 commit 到 durable store。
- [x] Pending checkpoint commit 成功後，才進入 final write：把 snapshot marker 由 pending 改成正式 review，寫 score、status、`exit = logout`，再作 final commit。
- [x] 只有 init／preflight 在任何 final write 前失敗時，活動才可保持 editable draft。
- [x] Pending checkpoint 或任何 final snapshot、score、status、exit、commit 寫入失敗後，都保持不可變 pending-final 並禁止普通 `saveDraft()`。
- [x] Commit 失敗時，活動凍結當前答案，顯示「提交狀態未確認，請重試」。
- [x] 重試時使用同一份 pending-final payload，不重新讀取已修改的活動狀態。
- [x] `pagehide` 遇到 pending-final 時，先重寫／確認同一 final payload，再 commit；不另存 draft。
- [x] Pending-final commit 仍失敗時不得呼叫 `LMSFinish()`，避免終止一個未確認 session。
- [x] 只有 final commit 成功後才設定 `finalCommitted = true` 並呼叫 finish。
- [x] Finish 失敗時只重試 finish，不重寫 final payload。
- [x] `closeSession()` 不可只憑本次 session 內剛寫入的 `lesson_status` 判斷 final 已確認。
- [x] 在本次 session 作任何寫入前保存 launch status，分開辨識 LMS 載入的 finished attempt 與本次 pending-final。
- [x] Final commit 成功後保留現有行為：鎖定答案；finish 失敗只重試 session termination。

跨 reload 狀態協議：

| Durable status | Snapshot marker | 啟動行為 |
|---|---|---|
| incomplete | draft | 正常恢復 editable draft |
| incomplete | pending-final | 鎖定答案，重試同一 final payload |
| passed／failed | review | 正常 finished review |
| passed／failed | pending-final／draft | Inconsistent，禁止編輯及覆蓋，顯示安全錯誤 |
| passed／failed | missing／corrupt | 保持 locked，顯示 Moodle score-only fallback |
| incomplete | review | Inconsistent；不可盲目當 finished 或開新 attempt |
| 任何 | LMS read error | Load-error，禁止所有寫入 |

測試：

- [x] Status 寫入成功、commit 失敗，不會保存普通 draft。
- [x] Snapshot、score、status、exit 各階段 SetValue failure 都保留同一 pending-final。
- [x] Commit 失敗後嘗試編輯及 `saveDraft()`，final review snapshot 不變。
- [x] Commit 失敗後 `pagehide`，會重試相同 final payload。
- [x] Exit 寫入失敗後 `pagehide`，不會產生 final status／draft 混合狀態。
- [x] SetValue failure 後 `pagehide` 重試仍失敗，不會呼叫 finish。
- [x] Commit 失敗後解除 fake LMS failure，再重試可成功完成。
- [x] Finish 失敗時 final 已 commit、答案鎖定，之後可重試 finish。
- [x] 預先由 LMS 載入的 passed／failed attempt 仍可正常只讀重看。
- [x] Pending checkpoint → final commit → reload 的 durable round-trip。
- [x] Pending checkpoint 成功、final commit 失敗 → reload 後可從 durable pending payload 重試。

完成條件：

- [x] 不存在 score／status 已 final 但 `suspend_data` 是 editable draft 的可重現路徑。
- [x] Partial write／commit failure 一律顯示「提交狀態未確認」；只有 final commit 成功、finish 失敗才顯示「成績已保存，正在完成連線」。
- [x] 每個 SetValue／commit／finish 邊界都有明確的 durable reload 預期狀態。

### 1.1 雙層 Fake LMS

- [x] `LMSSetValue()` 只更新 session buffer。
- [x] `LMSGetValue()` 在同一 session 讀 session buffer；新 launch 只從 durable store 初始化。
- [x] `LMSCommit()` 成功才把 session buffer 複製到 durable store。
- [x] Commit failure 不改變 durable store。
- [x] `LMSFinish()` 可配置為不保存或隱含保存，用兩種模式驗證保守行為。
- [x] Reload 測試建立全新的 API/runtime instance，不沿用頁面記憶體變數。
- [x] Fake LMS 可分別注入 initialize、get、set、commit 和 finish failure。

### 2. FBD draft restore 的 ID 與 derived state

問題：unfinished draft restore 會重建箭頭 `id: 1..n`，但沒有更新 `nextId`，刷新後新增箭頭會重複使用 `id = 1`。

修改：

- [x] 讓 `restoreArrows()` 統一重建 arrows、`nextId` 和 slots。
- [x] Submitted review 和 unfinished draft 使用同一條 restore 路徑。
- [x] Corrupt unfinished draft 可安全回到空白 editable attempt，不留下部分 derived state。
- [x] Finished status 的 submitted review 損壞時必須保持 locked，顯示 Moodle score 及安全摘要，不可回到空白 editable attempt。

測試：

- [x] Restore 三支箭頭後新增一支，IDs 為 `[1, 2, 3, 4]`。
- [x] Restore 後新增並拖曳，只改變新箭頭。
- [x] Restore 後刪除新箭頭，原有箭頭仍保留。
- [x] Restore 後 slots 保持連續及與顯示一致。
- [x] Corrupt draft 不會產生重複 ID 或半恢復狀態。
- [x] Finished status + corrupt review 保持 locked；unfinished + corrupt draft 才可回到空白。

完成條件：

- [x] 所有 FBD restore 路徑均由同一函式建立完整 derived state。

## 第二階段：重要可靠性問題

### 3. 結構化 LMSGetValue 結果

問題：`LMSGetValue()` 回傳空字串時，runtime 沒有檢查 `LMSGetLastError()`，無法分辨空欄位與讀取失敗。

修改：

- [x] 新增結構化讀取 helper，例如 `{ ok, value, error }`。
- [x] 每次 LMS 讀取後檢查 `LMSGetLastError()`。
- [x] Error code `0` 的空字串視為合法空值。
- [x] 非零 error code 或 exception 視為讀取失敗。
- [x] `lesson_status` 讀取失敗時，不可自行開始新 attempt。
- [x] `suspend_data` 讀取失敗時，不可建立新狀態並覆蓋 LMS 資料。
- [x] 活動顯示「未能從 Moodle 載入本次作答，請重新開啟活動」。
- [x] Local fallback 保持現有簡單字串讀取行為。
- [x] 建立一次性的 `loadAttempt(activity)` startup gate，一次產生 `finished`、`draft`、`new`、`pending-final`、`read-error` 或 `inconsistent` outcome。
- [x] `readSnapshot()` 必須傳播 LMS read error，不可再把 read error 降級成「沒有 snapshot」。
- [x] 四個活動啟動流程全部改用 startup gate，不再自行串接 boolean `isAttemptFinished()` 和 nullable `readSnapshot()`。
- [x] `read-error`／`inconsistent` 時不建立新 attempt、不啟用編輯／提交，也不註冊會在 `pagehide` 保存的 draft provider。
- [x] 審核所有現有 `getValue()` consumers：遷移至結構化 outcome，或明確保留只供非關鍵顯示的相容 wrapper。

測試：

- [x] `LMSGetValue` 回傳空字串且 LastError 為 `0`。
- [x] `LMSGetValue` 回傳空字串且 LastError 非 `0`。
- [x] `LMSGetValue` 拋出 exception。
- [x] Lesson status 讀取失敗不會開始新 attempt。
- [x] Suspend data 讀取失敗不會保存新 draft。
- [x] 失敗提示不會把活動誤標為 finished。
- [x] 四個活動在 lesson status read failure 時均進入 locked load-error。
- [x] 四個活動在 suspend data read failure 時均不會 create attempt、commit 或註冊 draft provider。
- [x] `passed/failed + draft`、`incomplete + review` 等不一致組合遵守上方狀態矩陣。

完成條件：

- [x] 所有關鍵 LMS 讀取都能區分 empty 和 error，且 caller 不會把 error 當作 new attempt。

### 4. 參考系 review-edit draft 恢復

問題：由提交前 review 返回修改某題時，draft 沒有保存 `fromReview`；刷新後記錄答案會錯誤前往下一題。單次 observation 狀態亦沒有保存。

修改：

- [x] Draft 保存及驗證 `fromReview` boolean。
- [x] Restore 後保持 review-edit 的返回目的地。
- [x] 保存目前 selected candidate。
- [x] 保存已完成的 `observedCandidates`。
- [x] 動畫完成一輪觀察時立即保存 draft。
- [x] Restore 時將 playback 設為安全的非播放狀態，但保留已完成觀察資格。
- [x] Guide、正常 task、review-edit 三種模式分開驗證。
- [x] `selected` 必須為合法 candidate 或 `null`；`observedCandidates` 必須為去重的合法 candidate 子集。
- [x] 如 restore 後可立即記錄，`selected` 必須已存在於 `observedCandidates`。
- [x] `fromReview = true` 只可出現在 task mode、對應題目已有答案且整個 attempt 已進入過完整 review 流程。
- [x] Guide、task、review 分別限制合法的 activeIndex、selected、observedCandidates 和 fromReview 組合。
- [x] 舊 draft 缺少新欄位時使用安全預設值，不因 schema 演進直接丟棄整份合法舊 draft。
- [x] 最壞情況 reference-frame draft snapshot 實測小於 4000 bytes。

測試：

- [x] 完成五題 → review → 修改第 2 題 → refresh → 記錄 → 返回 review。
- [x] 正常作答 refresh 後仍前往下一題。
- [x] Observation 完成後 refresh，仍可記錄該 candidate。
- [x] 播放途中 refresh，不會錯誤標記為已觀察完成。
- [x] Corrupt `fromReview`、selected 或 observedCandidates 被安全拒絕。
- [x] 非法 candidate、重複 observed、selected 未 observed、review-edit 關聯不成立均被拒絕或安全降級。
- [x] 舊格式 draft 沒有 fromReview／selected／observedCandidates 時可安全恢復。

完成條件：

- [x] Refresh 不會改變學生原本所在的 guide／task／review-edit 流程。

### 5. 以行為測試取代 activity 字串搜尋

問題：`activity-submission.test.js` 只搜尋 source text，不能證明活動狀態真的正確轉換。

修改：

- [x] 移除或降級現有字串搜尋測試，不再把它視為 submission 行為證據。
- [x] 抽取共用 submission outcome → activity state 的最小可測 seam。
- [x] 為四個活動實際執行 success、uncommitted failure、committed finish failure callback。
- [x] 為 FBD restore → add／drag／remove 建立可執行狀態測試。
- [x] 為參考系 review-edit → restore → record 建立狀態測試。
- [x] 保留地圖 persistence production round-trip tests。

最低行為測試：

- [x] Uncommitted failure 不進入 submitted／review-only。
- [x] Pending-final failure 凍結答案並保留 final payload。
- [x] Committed finish failure 鎖定答案並只重試 finish。
- [x] Success 進入 submitted／review-only。
- [x] Finished attempt restore 後保持 locked。
- [x] Unfinished draft restore 後保持 editable。

完成條件：

- [x] 刪除關鍵狀態轉換程式碼會令測試失敗，而不只是仍能找到相關文字。

## 第三階段：一致性及低風險問題

### 6. 地圖路程完整精度 round-trip

問題：首次提交用完整精度評分，但 snapshot 把 `routeDistance` 四捨五入至一位小數，restore 重新評分可能跨越容差邊界。

修改：

- [x] Snapshot 保存完整 `routeDistance` number，不再使用 `round1()`。
- [x] UI 顯示仍可保持一位小數。
- [x] Draft、review、首次 scoring 和 restore scoring 使用同一精度模型。
- [x] 確認增加的兩個 number 不會令 snapshot 超過 4000 bytes。

測試：

- [x] `30.04 m` 對 `29.0 m` round-trip 前後判分相同。
- [x] 容差內、邊界及容差外 property cases round-trip 分數不變。
- [x] `score(original) === score(decode(encode(original)))`。

完成條件：

- [x] 所有合法地圖 snapshot 重新評分結果與首次提交一致。

### 7. 平面鏡鍵盤修改保存

問題：Pointer 操作會保存 draft，但方向鍵移動像或光線後只 render，不會即時保存。

修改：

- [x] 鍵盤修改後觸發 draft 保存。
- [x] 使用短 debounce，避免長按方向鍵造成過多 `LMSCommit()`。
- [x] Debounce 結束或 `pagehide` 時保存最新狀態。
- [x] Pointer 操作保持現有立即保存行為。

測試：

- [x] 鍵盤移動 image 後 draft 包含最新位置。
- [x] 鍵盤移動 incident／reflected／extension 後 draft 包含最新端點。
- [x] 連續 keydown 只產生合理數量 commit。
- [x] `pagehide` 在 debounce 未執行時仍保存最新 state。

完成條件：

- [x] 鍵盤及 pointer 的最後可見狀態均能恢復。

### 8. Checklist 與實際行為同步

修改：

- [x] 將「FBD 空白或明顯未完成」改成實際行為，或擴充確認至缺少必要力的明顯未完成答案。
- [x] 參考系 observation 保存完成後，才保留「完成一輪觀察時保存」的已勾狀態。
- [x] 把本計劃所有完成項目同步回 `05-project-review-follow-up.md`。
- [x] 不把 Moodle 人工驗收標記為完成，直至實際以學生帳戶測試。

完成條件：

- [x] Checklist 的每個 `[x]` 都有對應程式碼或人工驗收證據。

## 第四階段：完整驗證與 Review

### 自動檢查

- [x] `npm run check`
- [x] `npm test`
- [x] `npm run package:all`
- [x] `git diff --check`
- [x] 四個 ZIP 的 manifest 與 package entries 完全一致。
- [x] 四個 ZIP 不包含 tests、screenshots 或暫存檔。

### 獨立 Review

- [x] Reviewer A：SCORM pending-final、讀取錯誤、pagehide、retry 和 finished restore。
- [x] Reviewer B：四活動 draft restore、狀態測試、精度和文件一致性。
- [x] 跟進所有 actionable findings。
- [x] 重複 review，直至兩條 review 路線均為 no findings。

### Moodle 人工驗收

- [ ] 用學生帳戶進入四個活動。
- [ ] 未完成進度離開及重入。
- [ ] 正常提交、分數及 lesson status。
- [ ] 使用可控的 debug LMS adapter／fake SCORM harness 注入指定 `SetValue`、commit 和 finish failure；不依賴一般 Moodle UI 隨機製造錯誤。
- [ ] 每個 failure case 記錄 session buffer 與 durable store 的 status、score、exit、`suspend_data.kind/marker`。
- [ ] 關閉並建立新 launch，驗證畫面狀態及 durable 欄位符合狀態矩陣。
- [ ] 在真實 Moodle 另做正常提交、離頁、重入及新 attempt 驗收；不聲稱 Moodle UI 已直接模擬 API failure。
- [ ] 已提交 attempt 重看。
- [ ] 返回入口開始新 attempt。
- [ ] 無限次作答及最高分設定。

## 建議提交次序

1. `Fix pending final SCORM submissions`
2. `Restore FBD and reference-frame draft state`
3. `Replace source-string checks with state tests`
4. `Preserve scoring precision and keyboard drafts`
5. `Address final review findings`

PR 只有在兩個 P1、重要 P2、自動檢查及雙 reviewer 收斂完成後才建議合併。Moodle 人工驗收仍應在正式部署前完成。
