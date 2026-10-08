# DC 兩燈串聯搭建（D3）

依循 [平台計劃](29-circuit-platform-dc-scorm.md)、[共用規則](00-shared-platform-and-style.md)及 [生產合約](../docs/simulation-scorm-production-guide.md)。這是低風險形成性活動；瀏覽器評分，不適用於高風險考試。題目採用建議的首個工具箱案例，日後題目修訂只影響活動外層。

## 題目、評分與操作

空白畫布提供一個理想 6 V 電源、一個開關、兩個 12 Ω 恆阻燈、四條 600 單位零電阻導線。可取出、搬動、旋轉、刪除、接線、切換開關；參數及名稱固定。須搭建能亮起的兩燈串聯電路。

100 分獨立累加：兩燈串聯 30；開關與兩燈串聯 20；全部四個元件構成無分支、無短路的環路接線 30（開關未閉合也保留接線分）；兩燈在指定串聯電路中各有 0.25 A 電流 20。合格須達 80 分且兩燈有要求的電流；開路可保留 80 分接線分但未達成亮燈任務。只取出元件但不接線為零分。環路必須包含全部四個元件，每個電氣節點恰有兩個元件端；短接、額外分支不算。排列、導線方向及幾何位置不影響評分。

## 階段與權威資料

edit → check → explicit submit → review；check 可返回 edit；所有空白、部分接線均可提交。凍結提交不能改答案，只可重試同一份提交；成績已 commit 但 finish 失敗，只可重試 finish。完成後不能重開或清除結果。技術錯誤鎖定；不自動清除草稿。Standalone refresh 全新；Moodle draft/resume 保留同一次作答。

快照版本／題目模型／rubric 各以活動 revision 1 固定。保存 phase、精簡元件、接點、導線端點關係、線長、線形和實物／符號模式；還原 ID 依陣列次序重建，不保存可修改的權限或評分條件。座標使用 IEEE754 Float64 的標準 base64 無損保存；不量化保存座標。新活動把每條導線的中間點上限設為 8，超過時在編輯器預覽及正式歷史內以原路徑的取樣折線呈現，保持兩端及拓撲，折線長度不增加。教師預設維持原有 96 點。保存與畫面都是同一份文件，沒有只在保存時改線形。4 條導線、8 個自由接點及 4 元件的最壞 draft/review/實際 pending-final 必須不超過 4000 UTF-8 bytes。

精確 answer 欄位如下；外封套由 `SimScorm.makeSnapshot` 提供，pending 外封套由共享 runtime 產生。

| 欄位 | 編碼及合法範圍 |
|---|---|
| `revision,phase,view` | `1`；`edit/check`；`0=real,1=schematic`，沒有額外欄位 |
| `c`（最多 4） | 每件 `[type,x,y,angle,closed]`；type 為 battery=0/switch=1/lamp=2；angle 0/90/180/270；只有 switch 的 closed 是 bool，其他為 null；座標及庫存再經 model/profile 驗證 |
| `j` | 最多 8 接點的 x/y 扁平陣列，以 Float64 little endian 標準 base64；`j1...` 重建，不丟掉自由／共接節點 |
| `w`（最多 4） | `[from,to,shape,length,via]`；shape 0=auto/1=free/2=smooth；via 同一 Float64 編碼，最多 8 中間點；阻值固定 0，合法線長由 profile 驗證 |
| endpoint ref | 元件陣列索引 i 的 a/b 為 `2*i`／`2*i+1`；接點索引 j 為 `8+j`；不存在、非整數的端點均拒絕 |

產生及 decoder 都重建並套用相同 profile；review 必須 phase=check，score 0–100 整數及 passed bool，之後重算 rubric 核對。payload 分數或 canonical answer 不一致不能 retry。semantic epoch 包含 rubric／模板；修改時須更新 revision 並另定兼容政策。

## 依賴與驗證

交付 slug `circuit-dc-series-build`；單一獨立題，無上游依賴。edit 的清除／重建沿用元件刪除與 undo，不加整份重開按鈕。check 顯示元件／導線數的中立摘要，不把空白當成技術錯誤。正式結果顯示各項得分；完成及 pending 沒有重新作答入口。

| 模式／變式 | 保存的權威資料 | 恢復後實際續作 |
|---|---|---|
| edit：空白／部分／完整 | `revision,phase,c,j,w,view` | 取出可用導線／元件或改接線，再 check／submit |
| check：空白／部分／完整 | 相同 schema，phase=check | 返回修改或明確提交 |
| pending-final | 共用外封套＋不可變 review JSON、score/maxScore/passed | 驗證後重試同一 payload；不改答案 |
| review／committed | review schema＋rubric 重算及 LMS 信任核對 | 只讀移圖、縮放；committed 只重試 finish |
| invalid draft/pending；finished mismatch | 原資料保留 | technical 禁寫；finished 只讀 LMS 摘要 |

符號、實物、SI 單位及導線方向沿用核心；0.25 A 是電流大小，接受反向標定的等價接法。元件、接孔、線端、線身、彎線點、開關、工具箱及 undo 都使用核心的既有局部 hit／捕獲規則；周邊題目、頁面及工具面板保持原生捲動。自由畫布使用核心的雙指導航與左右 32 px 捲頁把手，不覆蓋它們。鍵盤可取物、選取及使用 inspector 的接線清單、開關和操作按鈕；snap 只幫忙對接實際接孔，不判斷正確答案。精確 hit/gesture 契約由[作者指南](../docs/circuit-activity-authoring.md)及 production guide 擁有，這個活動沒有另寫觸控 adapter。

| Host | 原生捲動的實際 owner | 本地 source／ZIP 與外部 gate |
|---|---|---|
| T0 | 活動 document | 左右把手；edit/check/review/frozen/technical |
| T1 | 直接 iframe 的 top document（另驗證短 iframe 的內頁操作） | 父頁留有上下內容；全螢幕允許／拒絕 |
| T2 | 兩層 iframe 外的 top document | 中間 wrapper 有界、無捲頁 adapter |
| T3 | top `#owner` 溢出容器 | 明確核對 `scrollTop` 變化，不以內頁捲動代替 |
| T4 | 真 Moodle player／實體手機 | 未提供測試環境，待外部驗收 |

使用 CircuitEditor 共用核心、共用 SCORM/activity-flow/fullscreen、兩個真實活動共用的生命周期／頁面外殼；scoring/persistence 保持活動專屬。中央 runtime 資產表供教師及兩份明列 manifest 核對，不复制核心。

Node 驗證空白零分、部分分、開關開路、完整環路、短路／並聯／斷線、座標及拓撲無損 round-trip、非法與不相容快照、最壞 4000 bytes、每個階段恢復後的合法操作及全部 SCORM outcome。Browser 驗證來源與解包 ZIP、桌面與觸控視窗、T0/T1/T2/T3 捲頁、fullscreen、restore、check、submit、review 和技術鎖。真正 Moodle、實體手機另列 Moodle-ready gate，未執行不得聲稱通過。

## 執行結果（2026-10-08）

- [x] 活動 scoring／codec／共用 SCORM runtime round-trip、合法續作與錯誤路徑。
- [x] Source／ZIP 的 viewport、T0–T3 可信觸控／fullscreen、各模式及提交／resume；兩個活動合計 842 項。
- [x] JS／manifest、三包同源與依賴核對：package-ready。
- [ ] 真 Moodle／實體手機 T4：環境尚未提供，不標記 Moodle-ready。

完整範圍、容量與重建證據見[平台執行紀錄](29-circuit-platform-dc-scorm.md)。
