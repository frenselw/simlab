# 電路分支獨立審核與跟進（2026-10-08）

本報告固定於 D1／D2 的歷史受審版本 `88be7c2`；下文「沒有新 finding」及「此後只更新紀錄」只描述該輪審核。後續 D3–D5 實作及其執行驗證另見[平台計劃](../plans/29-circuit-platform-dc-scorm.md)，不把本報告冒稱為新增活動已經兩位獨立 reviewer 審核的證據。

範圍：`codex/circuit-platform-dc-scorm-plan`，base `5851d91`；首輪固定 head `3d64620`。兩位 reviewer 各自完整審核全部 28 個變更檔及直接消費者，首輪互不參照。第三位只在兩份報告完成後核對及整理，主審依整理結果修正，再交回原 reviewer 複核。**修正 runtime `88be7c2` 已完成兩位完整獨立複核及第三位最終整合：三項 finding 均已解決，沒有新或未解決 finding。** 此後只更新完成紀錄，沒有改動受審 runtime；不代表正式 SCORM／Moodle 驗收。

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
- `npm run check` 及修改檔語法／diff 通過；最終獨立複核及 runtime／ZIP 身分如下。

## 第二輪完整獨立複核與結案

兩位各自重新評估 base `5851d91` 起的全部 29 個變更檔與直接消費者，不只驗指定反例，亦沒有閱讀另一位的第二輪結果。原始報告為 `output/circuit-review/reviewer-a-round2.md`、`reviewer-b-round2.md`；第三位核對的結案報告為 `consolidated-final.md`。

- A：全部 22 個 circuit Node 檔、12 組 switch 權限及 locked／editable／byType／byId 相鄰檢查、14 預設及 relay contacts 的 base 對照；source／實際 ZIP 各 **40** 個 browser records。原 F1 collector 已改成會失敗的 assertions，首次 touch、新 mouse／pen／keyboard、交錯新 touch 與舊指標 release、公開 load 原子拒絕與合法續作均通過。
- B：全部 22 個 Node 檔、**53** 組有效權限、**7** 組舊版／修後對照、**84** 組 analysis／全端點 voltage／hazards 物理比較；source／ZIP 各 **180** 個 browser observations，另各 **27** 個 sequence／relay records。27 中兩筆 no-pointerId 是注入分支診斷，沒有觀察到舊 legacy tail，不能當作真 legacy／Safari／硬件驗收。
- B 最初兩份合併測試在 slider 段失敗，未算全套通過；私有 harness 對齊 production 的 fresh-tab／load 100ms settle，保留原 assertions 後，完整 source／ZIP 各180通過。不斷言兩项 setup 差異哪一個是唯一成因；失敗及最後原始 JSON 均在 B 報告分列。
- 第三位自行核對兩份最終報告、JSON records／mode／runtime errors、私有實際解壓入口、有效權限／click 分支及檔案 hash，確認 **F1／C1／C2 全部閉環，兩位無新或未解決 finding，不需再一輪 runtime 修正**。沒有把同源 hash 當成功能正確性證明。

最終受審 runtime commit：`88be7c2dd6c540734041ad79377806e2df939438`。

| 身分 | 值 |
|---|---|
| Source／package | 29 個 runtime 檔逐 byte 完全相同 |
| Runtime SHA-256 | `f5773b1169da0ba7ef3524c74ed9f6300b2bc1916e59309bced8c362d3a9d6ee` |
| Runtime 算法 | 檔名依 `localeCompare(...,'en')` 排序，依序 UTF-8 filename＋NUL＋file bytes，沒有末尾 NUL |
| ZIP SHA-256 | `8f6b37a4e2a31c81c9db69a135fdaeff8ce36386e6672251c76a8c69bc712f3c` |

原始身分核對在 `output/circuit-review/fix-snapshot.json` 及第三位最終核對檔。個別 reviewer 用不同分隔字元所得的 runtime hash 不與此值混用；直接檔案 byte 比較一致。最後文件提交的 HEAD 不冒稱 browser 重新執行版本。

## 驗收界限

原有 pen hover 並行筆／指及無 hover 硬件、relay JSON 不保存機械瞬間／只讀不凍結時間、靜態 checks 非動態 rubric 的邊界保持。真筆／真手機／Safari／真 Moodle 未驗收；協定事件不能替代硬件證據。

全站 `npm test` 未在本輪重跑；先前未修改 Newton3 的 `stage >= 195` 失敗已有 baseline 重現，本輪不修正或宣稱全站全綠。舊4692筆完整 browser 與其他歷史矩陣不是本輪新執行。D3／D4 題目、rubric、codec、SCORM lifecycle／manifest、D5 及家庭／交流／高壓方向繼續待討論。
