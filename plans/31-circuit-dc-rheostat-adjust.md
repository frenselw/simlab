# DC 滑動變阻器調參（D4）

依循 [平台計劃](29-circuit-platform-dc-scorm.md)、[共用規則](00-shared-platform-and-style.md)及 [生產合約](../docs/simulation-scorm-production-guide.md)。低風險形成性活動，題目及 rubric revision 1；與 D3 以不同元件、庫存及操作驗證配置重用。

## 題目與評分

固定一個 6 V 理想電源、12 Ω 恆阻燈、40 Ω 四孔滑動變阻器（A–P 接法）、理想 A/V 電錶。固定六條零電阻導線；不能改接線、搬動、旋轉、刪除或新增元件，只有滑片位置可調。數值與表盤可讀，實物／符號可切換。

兩題各 50 分，獨立保存：第一題把電流調到 0.25 A（容差 ±0.005 A）30 分，選擇「相對初始 50% 減小接入電阻」20 分；第二題把燈泡電壓調到 1.8 V（容差 ±0.03 V）30 分，選擇「相對初始 50% 增大接入電阻」20 分。答案分別約 30% 及 70%。不碰滑片的 null 位置不視為作答，概念選項 null 零分；部分答案保留分數，合格線 80。使用共用 solver 讀取電流／電壓，不另寫 DC solver。容差兩端包含，不因畫面小數格式重新評分。

## 階段、保存與驗證

交付 slug `circuit-dc-rheostat-adjust`；題號按鈕在題目區，兩題獨立，無任何先答完／先看過才能前往的閘門。check 顯示兩題的「尚未調整／滑片百分比」及「尚未選擇／概念答案」中立摘要。editable 不設整份 reset；可手動調回或 undo。只有明確按正式提交才記錄成績。

| 模式／變式 | 權威 schema 與恢復 | 合法續作 |
|---|---|---|
| edit：題 0／1，null／部分／完整 | `revision,phase,question,answers[2]`；每答 `position,reason,view` | 調滑片、選概念、換題或 check |
| check：任一題號，未答／部分／完整 | 同一 schema，phase=check | 返回任一題修改或直接提交 |
| pending-final | 共用外封套、canonical review JSON 及 result | 只讀換題；重試原封不動的 payload |
| review／committed | 模板＋保存參數、重算評分及 LMS 信任核對 | 只讀換題／移圖／讀錶；committed 可 retry finish |
| invalid／不相容版本 | 不重建新 attempt，不寫壞資料 | 技術鎖或已完成 LMS 摘要 |

物理量採 A、V、Ω，題目指定讀數的大小；固定接孔使 A／V 均正向讀取。精確調參使用核心的滑片局部捕獲，preview 只顯示即時效果，放手才更新權威答案。觸控手指會遮住滑片／錶盤：百分比面板、即時讀數及觸控錶盤放大沿用核心；可用 inspector 數字／range 和快捷加減作鍵盤替代。其餘元件、導線端、線身不可拖改，公開 execute／loadDocument 同樣拒絕。題目及概念 radio 保持原生 pan-y；概念更新保留原 radio DOM 和焦點。

左右 32 px 捲頁把手及雙指導航沿用核心，沒有另寫 touch adapter。T0 活動 document、T1/T2 top document、T3 top `#owner` 的 source／ZIP 逐模式捲頁，與 D3 的 host 表相同；T4 真 Moodle／實體手機未提供環境，獨立保留待驗證。A/V 放大只讀可用，不產生分數或把 null 位置變成已答。

兩題無依賴，可直接前往任何一題及 check。edit/check/explicit submit/review、Moodle resume、standalone refresh、frozen/committed/retry/technical 與 D3 同一合約。活動自己的 schema 保存 revision、phase、當前題、兩題 position（null 或 0..1）、reason（null/-1/+1）與 view；固定電路由受信任題目模板重建。切換 view、載入題目、程式 restore 不會把初始位置誤標為已答。非法版本、參數、題號、phase、外加欄位鎖定；已完成不可信資料只顯示 LMS 記錄摘要。

每題 edit 及 check 的 encode/decode/restore 必須執行一次合法續作；review/frozen 只讀及 retry 都要執行。驗證精確值、容差邊界、概念部分分、全部未答零分、換題資料獨立、preview 未放手不提交、profile 禁止操作、公用 SCORM outcome、finished 信任核對、pending tamper quarantine、4000 bytes。兩活動的來源／ZIP 及 T0–T3 觸控/fullscreen 接合都要檢查。實際 Moodle 及實體手機是獨立外部驗收，證據缺失保留狀態，不虛稱完成。

## 執行結果（2026-10-08）

- [x] 活動 scoring／codec／共用 SCORM runtime round-trip、合法續作與錯誤路徑。
- [x] Source／ZIP 的 viewport、T0–T3 可信觸控／fullscreen、各模式及提交／resume；兩個活動合計 842 項。
- [x] JS／manifest、三包同源與依賴核對：package-ready。
- [ ] 真 Moodle／實體手機 T4：環境尚未提供，不標記 Moodle-ready。

完整範圍、容量與重建證據見[平台執行紀錄](29-circuit-platform-dc-scorm.md)。
