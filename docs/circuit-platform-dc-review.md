# 電路分支獨立審核與跟進（2026-10-08）

範圍：`codex/circuit-platform-dc-scorm-plan`，base `5851d91`；首輪固定 head `3d64620`。兩位 reviewer 各自完整審核全部 28 個變更檔及直接消費者，首輪互不參照。第三位只在兩份報告完成後核對及整理，主審依整理結果修正，再交回原 reviewer 複核。**本紀錄目前仍待修正版本的獨立複核，不代表正式 SCORM／Moodle 驗收。**

## 首輪結果與修正

| ID | 分類 | 已證明的問題 | 共用修正及回歸 |
|---|---|---|---|
| F1 | 新增 P2 | palette／取線的 pen drag 取消並釋放後，新的首次 finger tap 被 `suppressAddClick` 殘留吞掉。source／ZIP 的 1280／390／320 px 重現，base 正常，與已記錄 pen hover 限制不同 | 取物綁定以 pointer sequence 記錄待抑制 click；新的 pointerdown 只清自己的紀錄，尾隨 click 只消耗同一 pointer。保留鍵盤及 legacy click fallback，兩個工具用同一判斷。補 Escape／blur／失去捕獲／只讀／載入後的第一次 touch，以及取消筆仍按住時的新 touch＋原筆放手交錯測試 |
| C1 | 新增 P2 | `params:true` 或 `['closed']`、`switch:false` 時，閉合狀態實際固定，D2 新 guard 卻拒絕固定 open／closed 兩款 | 學生庫存辨識統一採有效權限：closed 由 switch 與 model 的 allowSwitch 判定；普通參數亦尊重文檔 locked／editable／policy。初始候選保留對應 component，新元件候選不借用 byId。教師原有匹配語義保留 |
| C2 | 相關既有 P2 | 單供應 closed:true 時，新 closed:false snapshot 可載入，雖然 switch 操作不開放；base／head 均有。`allowSwitch:false`＋profile switch:true 亦有同一漏洞 | 與 C1 同一次修正，讓 compiler、matches／stock 與實際操作權限一致。補非法 snapshot／transition、公開 loadDocument 原子拒絕，以及合法 production restore／續作；沒有改 v6 schema |

主審沒有將 B 的「沒有新 finding」視為否定 A 的具體反例。第三位另行重跑主審提供的 profile 反例及候選，確認新增錯拒與既有恢復缺口是同一根因，屬 D1／D2 已授權範圍。沒有因此實作延期的 D3–D5 或另三版。

## 證據與實際驗證

- 原始獨立報告：`output/circuit-review/reviewer-a-round1.md`、`reviewer-b-round1.md`；整理報告：`consolidated-round1.md`。這些 ignored 診斷資料只在本地保留；本文件保存可追溯結論及維護中的重現入口。
- A、B 各自執行全部 22 個 circuit Node test 檔，並追蹤 profile、editor、renderer、solver、checks、兩入口、依賴、文件與修改的 fixtures。A 有14預設／relay contacts 的 base 對照；B 有84 preset/workpoint 的 analysis、全端點對 voltage、hazards 精確對照。相應數值一致，不宣稱所有可能電路都經證明。
- A 的 F1 collector 刻意記錄錯誤，exit 0 不是驗收通過；修正後已把首次 touch 必須新增一件寫進 production palette browser assertions。
- 修正後 `platform-core.test.js` **8 groups**、`activity-core.test.js` **19 groups** 通過。新增 switch 固定狀態／兩款庫存、params true／array、document allowSwitch、byType／byId、locked 初始元件、非法恢復及教師相容測試。
- `node tools/circuit-workbench-browser-regression.js --palette-drag-smoke` source／實際解壓 ZIP **148 observations** 通過；`node tools/circuit-platform-browser-regression.js` source／ZIP **66 observations** 通過，含原嵌入／fullscreens／多 instance／T1–T3，以及新的非法 load 原子拒絕與合法恢復續作。紀錄 `output/circuit-review/root-palette-round2.log`、`root-platform-round2.log`，詳細 JSON 在維護中的 runner output。
- `npm run check` 及修改檔語法／diff 通過；最後 runtime／ZIP 指紋與 reviewer 複核結果於完成後補記。

## 驗收界限

原有 pen hover 並行筆／指及無 hover 硬件、relay JSON 不保存機械瞬間／只讀不凍結時間、静態 checks 非動態 rubric 的邊界保持。真筆／真手機／Safari／真 Moodle 未驗收；協定事件不能替代硬件證據。

全站 `npm test` 未在本輪重跑；先前未修改 Newton3 的 `stage >= 195` 失敗已有 baseline 重現，本輪不修正或宣稱全站全綠。舊4692筆完整 browser 與其他歷史矩陣不是本輪新執行。D3／D4 題目、rubric、codec、SCORM lifecycle／manifest、D5 及家庭／交流／高壓方向繼續待討論。
