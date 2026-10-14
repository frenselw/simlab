# 交流電路工作台

## 播放完成後的浮點時間餘數（2026-10-14）

正常播放完成後，`duration - advanced` 可能留下浮點餘數；下一幀時間相同時，
這個餘數可誤觸 `time-resolution`。只在 `CircuitEditor` 的播放累積器按正式
`advance().complete` 清除已完成請求；預算不足的未完成請求保留待算時間。
不修改求解器的最小步長、真正快速暫態／無法表示時間的診斷或保存格式。
教師非評量修正，assessment risk／rubric／SCORM attempt 為 N/A；沒有新
依賴或權威狀態，正常／重複幀、未完成／續算、暫停／恢復沿用既有 session。

驗證決定：在已登記的 `circuit-drag-playback-browser-cases.js` 加入正式
`CircuitEditor.mount` 的可控 RAF 回歸，涵蓋正常完成的餘數、重複時間戳、
真實 `budget: 0` 未完成後的續算，以及生產 encode/decode/restore 續作。
用同一 AC browser 入口驗 source／解壓 ZIP，再跑相鄰 transient／audit／
保護／保存及核心回歸、`check:tests`、syntax／manifest，重建共用四包。
測試入口及 helper ownership 沿用 `tools/test-registry.js`；提交後記錄
`9ccc42f..HEAD` 的 affected selection preview。真手機／Moodle／Sites 發布
另計；實際證據於完成後補記。

執行證據：新增正式 mounted-editor 回歸在修正前因可靠狀態變 false 而失敗；
修正後 `node tools/circuit-ac-browser-regression.js --drag-playback-smoke`
最終 source／ZIP 各459項、合共918項通過，含可控重複時間戳、已完成餘數、
真實零預算未完成續算、session encode/decode/restore 及原有1280／390px
可信滑鼠／觸控拖動、暫停、唯讀及滑塊。可控幀的非耗盡預算呼叫解除牆鐘
時限，避免 CI 負載影響本回歸；日常播放的10ms預算沒有改動。
transient、AC audit20組、AC dependency audit及DC core全部通過；真正極快
RC及無法表示時間仍觸發既有診斷。`check:tests` 通過（235入口、204 node、
31 browser、48 helpers、2 manual），syntax／manifest及diff檢查通過。
四包已重建，逐檔／共用資產核對一致；證據於
`output/circuit-platform-build.json` 及 `output/playwright/circuit-ac/*live-drag*`。
未跑全倉庫完整CI、真手機或Moodle，未發布Sites。

已提交選測證據：修正提交 `7a94dc7`，base `9ccc42f`。
`node tools/run-tests.js --affected --base=9ccc42f --head=7a94dc7 --plan`
（當時 checkout 為該 head）回傳 `affected`，選204個 node及12個 circuit
browser入口，含AC、DC source／package四組、接線、評量活動及platform。
四個套件consumer全部選入；既有registry及CI排程沒有改動。
原始preview在 `output/ac-playback-time-selection.json`；這是選測證據，
不是全選測範圍已執行通過的聲明。

## 拖動期間持續運行及接線預覽（2026-10-13）

元件／導線幾何、移圖、縮放及接孔吸附預覽不暫停播放。預覽用已接受電路的
即時物理讀值，只在放手時提交接線；取消不倒退已流逝的時間。參數滑塊保持
獨立 session 連續預覽。真正改接仍沿用受影響域重建／無關域保留，不新增物理
模型、文件或保存格式。懸空線單端接入須保留相位、C/L 儲能及燈泡短窗。
教師工作台，rubric／評分／SCORM attempt 為 N/A；共享核心仍重建四包。

驗證決定：正式核心核對幾何、單端接入、儲能／相位／亮度及保存恢復續作，
真正斷路仍重建；source／解壓 ZIP 用可信滑鼠／觸控驗證元件、線身、線端、
吸附後停手等待、取消、放手、移圖、雙指導航、手動暫停／唯讀及原有滑塊。
核對拖動預覽不提交文件、時間持續、畫面亮度／電荷與正常續算一致、取消只
回復幾何。真手機／Moodle 仍為獨立未驗門檻；執行證據於完成後補記。

實際證據：`node tools/circuit-ac-browser-regression.js --drag-playback-smoke`
source／ZIP 合共724 checks通過，含1280／390px可信滑鼠／觸控、四種拖動
的取消及放手、停手吸附、電容電荷、放手同事件內燈泡亮度、雙指導航、暫停、
唯讀、真正斷路及原生滑塊獨立預覽。快捷參數 `--quick-response-smoke`
source／ZIP 672 checks通過。截圖於 `output/playwright/circuit-ac/*live-drag*`。
transient、AC依賴／audit／平台／能量／保護／CW-20重啟／顯示及DC評量核心
回歸通過；syntax／manifest及diff核對通過，四包重建並核對共用資產雜湊。
新cases接入 `tools/run-tests.js` 已註冊的AC browser入口；未跑完整全倉庫
`npm test`、真手機或Moodle，未發布線上Sites。

## CW-21／CW-22：儀表讀值條及電壓端標示（2026-10-13）

已以正式registry／model及Readouts重現未接線G的雙重µ前綴例外；功率表量測與面板的瞬時電壓來源亦不同。只改顯示：G電流與量程統一傳SI A，末層按工程單位顯示；功率表瞬時電壓使用sensedVoltage，與V₊−V₋的RMS來源一致。求解、實測回饋保護、快照及依賴不改。教師非評量工具，rubric／SCORM N/A。精準驗G零／未知／±0.1、±10、±1000µA、量程修改及元件切換、播放／暫停，W正接／反接的瞬時V與P反號而RMS不變；source／ZIP桌面／手機模擬驗證後重建四包，提交push並更新兩個原Sites。不重跑無關物理、保存全套、CI或真手機。

新增正式模型／讀值核心回歸、readout-math及meters-and-math（96 fixtures）通過。G面板保留原始微小值，指針的既有量程精度與物理讀值不改；參考量程亦用SI。完整工作台及ZIP320項通過，另16項只核對可見讀值區與溢出並補拍截圖；涵蓋1280／390 px、正常新增未接線G、互感初始零值、有效文件造成的求解未知、七個有號電流、原生量程修改／播放／暫停及W反接。V₊／V₋以既有LaTeX字形標示。四包重建並核對runtime雜湊；證據在 `output/ac-instrument-review-2026-10-13/`。不宣稱完整CI、真手機或Moodle驗收。

## CW-20 排程重啟及讀值動畫（2026-10-12）

真正重設時間的update重排正常/限流源reviewAt，新時間加原檢查間隔；
保留倍率，重新收集時不沿用舊超限提示。時間連續的區塊保留原排程；
已跳掣維持鎖定。restore嚴格排程驗證不放寬；新增/移除未接線R/C/V後
立即保存、恢復及續作，正常/限流/鎖定及有/無閉合peer均驗證。

AC所有元件用同一彩色讀值條，數字維持5Hz，條形及未知/正負/量尺屬
呈現狀態，RAF更新既有DOM、不改物理。數字/全圖重畫以200ms節奏，
磁場密度為離散圖形，只有密度/方向/未知或元件參數改變才重建遮罩路徑，
其餘只更新強度；場面板亦保留讀值節點。驗證DOM保留、更新幀率及數字
節奏，不能把RAF呼叫當成60fps保證。其餘見[DC計劃](28-circuit-workbench.md)。

本輪實際證據：CW-20 54核心情況（含限流/鎖定與閉合peer）即時往返續作
通過；正式儲存/原生檔案開啟完成後/續作，與CW-19合共756 checks通過。
條形/各元件/DOM保留/暫停隔離180 checks，RMS錶讀值unsigned及微小讀值
保留原科學記數；實際條形更新隨rendered frames，量測約13–18Hz，不能
稱60fps已達成；原10Hz上限已移除，畫布繪製仍限制整體幀率。變壓器場
126、讀值工程單位134 checks及相鄰transient/CW-17 25組/保護/場/顯示
core通過。check和四包通過。未驗完整CI/真手機/Moodle。

## 現行決定：實測回饋電子保護器（2026-10-12）

按使用者取捨移除完整波形預測、相量需求及候選波幅搜尋。正常物理解算、
變壓器／儲能及能量核證保留。保護源使用至少0.05 Ω的實際串聯內阻，
介面明示，輸入較大內阻則沿用；設定電壓為電動勢而非補償後端電壓。

每min(0.02秒,量測窗/32)模擬時間讀取最近實際RMS及平均端口输出功率，
共用量測模組的單週期／共同週期／10秒時間窗。起動採已接受數據的暫估，
不能宣稱完整窗。超限逐步降波幅，低於85%才慢恢復，其餘保持；真正短路
開路鎖定及手動重設保留。教學模型明確容許短暫超限／反應延遲；其他
電源驅動令降壓仍超限時明示超限，不假裝normal或清空歷史。

session v5/modelRevision 2保存控制倍率、下次固定檢查時刻及完整有界歷史，
無候選工作。舊v3/v4先以舊物理模型嚴格驗證，再保留電荷、電流、相位、
能量帳及鎖定，轉入有內阻模型並重建導數；載入提示模型更新。無保護v2
及學生固定codec不變。CW-19緊湊JSON及共用8 MiB教師session限額覆蓋
80元件×514格完整精度數據；純文件仍256 KiB、評量codec不變。

驗證：實際負載減輕／加重、波形／混頻／相位、C儲能、零／非零耦合、
RL及coupled 2/1/0.5H，一次／各分段／budget／保存續作；核對事件及軌跡，
不延用已取消的所有完整窗絕對上限要求。完整工作台source／ZIP量度播放
長任務、拖動、暫停；AC／DC旋轉接點；1–4組各狀態窗口前後及長運行
保存開啟續作，80來源容量及非法输入。四包重建、衝突核對、提交push，
保留兩個Sites私有權限發布。教師非評量工具，rubric／提交N/A。

實際證據：新回饋核心、C啟用五時刻、波形／相位／共同窗、0/非零互感、
過載／減輕负載、短路鎖定及v4驗證遷移通過；25組分段／budget／0.9秒
保存續作，控制事件時刻與軌跡在既定數值誤差內一致。原能量／依賴／
AC平台及DC核心／評量通過。2/1/0.5H完整工作台source/ZIP共96效能
checks，advance最高約44ms、可信輸入最高約98ms，這輪觀察無>=100ms
長任務；仍有50–94ms繪圖任務，不能稱所有工作都嚴格10ms。保護UI456、
混頻及零耦合188、播放暫停續作132、變壓器四錶110 checks通過。
1–4組各狀態36核心往返通過，三/四正常源約144/191 KiB；80来源約2.1 MiB。
正式儲存→原生檔案開啟→續作390 checks，另含六組normal高於舊256KiB。
AC/DC source/ZIP八方向與連接位24組桌面/可信觸控通過，check及四包重建通過。
完整npm test在一般sandbox啟動Chrome中止，已改用授權的聚焦瀏覽器及
相關正式模組核證；不能宣稱完整全倉庫/CI通過。真手機及真Moodle未驗。

以下前瞻保護記錄是歷史證據，已由上述決定取代。

## 本輪實作決定：45°／連接位及 CW-17（2026-10-12）

共用核心每次旋轉45°，原有四方向座標保持精確；中心20單位網格及
接孔24 CSS px吸附不變，支援八方向接孔／操作範圍／標籤／導線出口。
單擊接孔或共接點顯示「拆開全部」44px操作，保留相關導線優先；沒有
選相關導線時拖接孔搬元件、拖共接點搬整組，選相關導線則拔單端。
全部拆線保留各線及長度、解除共接、一次復原；量測／唯讀／權限不變。

CW-17前向預測包含接受歷史與新輸出組成的過渡滾動窗；每個接受內部步
檢查保底，外層advance／播放幀率不決定檢查時機。保護歷史以有界積分
納入session v4權威快照，DC文件v6及AC文件v7不變；舊session仍能載入，
無法復原的歷史不虛構，完成新窗前保守限制恢復輸出。非評量工作台，
評分／rubric／提交 N/A。覆蓋normal／limited／tripped、八方向、單／多
線接孔／共接點、取消／復原、保存恢復及合法續作；拒絕非法角度／歷史。

驗證決定：正式模組重現CW-17普通RL與coupled預設L=2／1／0.5H；
一次、1／0.1／1/60秒、有限budget、暫停及0.9秒保存續作比較保護事件
與物理軌跡，逐步核對完整窗。AC／DC source及ZIP做滑鼠與可信觸控
驗收；既有核心、權限、量測、保護及包驗證，重建四包、commit／push，
同步兩個Sites並保留原有私有權限。實機及真Moodle為獨立未驗門檻。

實際證據：25組一次／分段／budget／0.9秒保存恢復續作通過，每個接受
完整窗均檢查；普通RL及coupled 1／0.5H的最高RMS約0.9980／0.9981／
0.9981 A，2H約0.7158 A；3秒普通RL／1H恢復normal，0.5H維持limited，
所有流程無fault且事件時刻／狀態及軌跡在指定數值誤差內一致。
v4保護歷史往返完全相同，缺欄／時間／端點／積分／覆蓋改動均拒絕，
fork／reset隔離通過。原CW-12～16、transient、量測、能量、平台及DC
評量套件通過。source／ZIP CW-17實際播放／暫停／恢復132 checks，
既有保護456、CW-15／16 188 checks通過。互動及八方向範圍另見
[DC計劃](28-circuit-workbench.md)。check／四包重建通過，未驗完整CI、
全套工作台browser或真手機／Moodle；有界預測超預算仍明示unresolved。

## CW-15／16 複核跟進（2026-10-12）

依使用者新報告，保護時間預測改用現有 measurementWindow／量測policy的
可核證共同週期，沒有有限共同週期時沿用明確10秒時間窗並持續複核；不以
最慢電源週期代替混頻共同週期。預測跨方波／三角波轉角分段積分，保留
4096步預算，完整窗超出預算則停機診斷。normal的暫態／時間窗及非正弦
預測亦安排複核。保護子電路以支路ID投影，k=0只留下相關繞組，非零互感
及理想變壓器保留真正耦合的兩側及端接；不清除副側電流／儲能。
非評量工作台：沿用doc v7／session v3，評分／提交 N/A；normal可保存
複核時間，舊快照缺少必要排程時恢復後補驗，保留原有鎖定及物理狀態。

驗證決定：正式M文件／Session重現CW-15方波／三角波／正弦於5.2及10.2s，
不同相位及啟用時間、多個共同週期、10秒時間窗及預算拒絕；CW-16副側
初值0／1A、雙側源、k=0及非零／理想耦合、真過載／短路、儲能衰減及
保存恢復續作。沿用既有source-protection／transient／量測／能量suites，
source／ZIP真實UI核對，重建四包、check／diff、commit／push及同步Sites。
完整CI、真手機／Moodle仍為獨立未驗門檻。

實際證據：正式M／Session重現原方波／三角波normal倍率1且完整窗0.7071 A，
及副側初值1 A令原側false trip；修正後兩波形約0.6 A，正弦對照0.599743 A，
倍率均約0.663325。兩種相位、兩個啟用時刻、5.2／10.2及恢復後15.4秒的
多週期皆通過。副側0／1 A原側RMS約0.717995／0.718032 A，正常數值差異
約3.7e-5 A；副側按0.5H／12.25Ω指數衰減，沒有清零。另驗雙側50Hz源／
鎖定、零／非零／理想耦合、真過載／短路、共接點宿主及舊v3排程補驗。
沒有共同週期的案例採10秒窗，持續前向複核及接受物理積分保底，無可靠
維持上限時停機診斷；100秒共同窗超4096步時明示unresolved，不縮短窗。

10份相關Node suites通過；`--mixed-protection-smoke` source／ZIP、1280／
390px共188 checks（可信checkbox、正式文件、完整窗與保存續作）通過；
原有`--source-protection-smoke`456 checks仍通過。新browser亦納入預設全套
runner，Node沿用已登記suite。截圖及最新browser紀錄在
`output/playwright/circuit-ac/`；evidence.json依最後執行專項解讀。check／
manifest、四包重建及diff通過，未執行完整CI／工作台browser或實機門檻。

## CW-12／13／14 複核跟進及變壓器比值標示（2026-10-12）

依使用者複核報告，修正保護啟用時候選波幅失敗誤判、無關鎖定阻止局部
拓撲初始化，以及多電源非單調電流的限幅搜尋。先驗現行輸出／儲能相容性；
不相容候選只拒絕該候選，不能清零電容、改時間或撤掉保護。線性正弦負載
用電流平方／平均功率的二次關係分割可行區間；一般負載有界找出可行段再
求最大合法共同倍率，無可靠候選時保留儲能並給停機診斷。同一區塊的多個
保護源採共同倍率，逐源複核電流及平均輸出功率，不假設各源可獨立單調降壓。
拓撲更新按修改區塊重建相位／儲能／觀察歷史；故障區塊保留鎖定及儲能，
其他區塊按既有規則重啟。變壓器只顯示一行 N₁:N₂ = 比值，加大可讀字級，
同步標示占用邊界。非評量工作台，評分／提交 N/A，沿用文件及 session 格式。

驗證決定：既有 source-protection suite 補五個啟用時刻／能量連續、三種
獨立區塊狀態、新建電容及鎖定續存；限流驗同向／反向／相位差、多保護源、
無解及短路，保存／恢復後合法續作，保留上輪電容／電感故障證據。執行相鄰
transient／AC平台／能量／量測及變壓器標示測試，source／ZIP 真實工作台的
保護 UI／滑鼠／觸控、桌面及手機字形與避讓；重建四包、check／diff、
commit／push並同步AC／DC Sites。完整CI、真手機及Moodle仍為獨立未驗門檻。

實際證據：先以正式M／Session重現三項報告，再由既有registered suites
補驗。CW-12五個時刻均正常、RMS約0.754 A且電容電壓／時間／能量帳連續；
CW-13三種獨立區塊狀態及後續參數重啟／鎖定儲能保持通過；CW-14反向
案例輸出5 V／1 A，另驗同向、相位差、窄於取樣網格的可行區間、功率上限、
多保護源共同倍率、無解及短路。14份相關Node suites通過，包含前輪CW-10／
11／09-R1、能量R2及DC core／layout／labels。舊AC平台卡片寬度fixture在
Git基準亦失敗；明確採其原有很小字級（xs），保留原145px斷言後全suite通過。

source／ZIP source-protection browser合共456 checks，使用真checkbox觸控、
原生鍵盤、production add／attach／setParam命令及session恢复續作；
transformer-design合共126 checks，含比值screen font18px、旋轉、隱藏場線、
390／320px聚焦及短手機標示避讓。最新截圖／browser紀錄在
`output/playwright/circuit-ac/`；該runner的evidence.json只保留最後一個專項，
兩項實際執行數按上述已完成log解讀。未執行完整工作台browser或完整CI。
`npm run check`及`package:circuit-platform`通過，四包重建並核對來源；diff
及未合併項目檢查通過。網站版本另由Sites部署文件記錄，不把打包當成部署。


## 目前狀態與維護入口（2026-10-11）

非評量AC教師工作台及兩個教學示例已實作；目前規格以本分支程式、下方Scope／模型／狀態契約及[AC作者與維護指引](../docs/circuit-ac-workbench.md)為準。本文逐次記錄保留當時版本及證據，不能把舊圖像、舊介面或歷史全套結果當作最新版契約。

| 項目 | 現行決定 |
|---|---|
| 共用架構 | DC／AC同一editor／renderer／Math／接線及指針；`analysis:'transient'`選時間後端，沒有第二份操作框架 |
| 教師介面 | 無電路概覽、實驗操作、內建單步／reset按鈕；空白檢視器收起，元件／導線設定、兩點量測及診斷保留；¼速在共用工具列 |
| 預設與波形 | 四組14個主題＋空白；波形由源參數選正弦／方波／三角波；浮動儀器及探頭、軸拖動／鍵盤、圓點及有界歷史，沒有舊游標／固定波形區 |
| 圖形與讀值 | 連續SVG發電機、固定範圍場線疏密、C/L歸零顯示、固定單位5Hz數字＋bar、數學字形、緊湊電表、上方變壓器匝數比及鐵芯內磁通 |
| 方向配色 | 常規電流及靜態電流箭頭紅色，電子藍色；電勢方向／場線另有自己的語義，不全域取代藍色 |
| 保存 | DC doc v6／AC doc v7，無保護session v2、啟用保護session v3／modelRevision 1，技術示例codec v6（相容 v5）；觀察與顯示非權威，正式ACrubric／SCORM另定 |
| 驗證狀態 | CW-03-R2／CW-06已修正：10個相關Node套件、716項source／ZIP audit及206項scope通過（詳見最新記錄）。CW-01–04及R1歷史：13個受影響Node套件（含20組audit回歸與1771項獨立公式）、source／ZIP audit 244、scope 206項通過；presets 618及PhET歷史實測見下文。完整browser及ZIP宿主T3仍依歷史限制解讀；真Moodle／真手機T4未驗收 |

維護先分清共用、時間模型、顯示及活動外層，按[精準驗證表](../docs/circuit-ac-workbench.md#精準驗證與維護)選必要項目。純文件修訂只核對來源、版本、指令與連結，不重跑物理／browser。核心改動交付時統一重建相應ZIP；目錄active不代表全部package-ready／Moodle-ready gate通過。

## 近期決策與驗證記錄

### 可選交流電源保護（2026-10-12；已完成精準驗證）

範圍僅 AC source 及教師理想／非理想變壓器預設；DC、發電機及固定學生模板維持原模型。非評量工作台，assessment risk、rubric、submission、SCORM N/A。沿用既有共用UI／求解器／資產，無外部依賴；進階設定預設收起，最大電流按RMS、最大輸出功率按平均端口有功功率。正常／限制可自動互轉，短路停機鎖定至本元件手動重設。保護降低源波幅後重解，停機源開路而不清除C/L儲能，缺乏續流路徑仍診斷。

權威schema：AC doc v7可選參數 protectionEnabled / maxCurrent / maxPower，缺省補 false / 1 A / 6 W；有啟用保護的session v3保存逐源status / scale / reason / reviewAt，無保護維持v2，相容v1／v2。相位、C/L及分域能量仍由原schema保存，量測／波形不作保護輸入。參數及接線編輯保留既有停機鎖定；重設只影響所選電源。

狀態矩陣：關閉→理想源；正常→目標電壓；限流／限功率→降低波幅；短路→源開路；移除故障→仍停機；手動重設→重評估。每一狀態做document及session round-trip、恢復後合法續作，另驗無效保護參數／狀態。兩教師預設6 V／1 A／6 W，200:100／200／400及12 Ω驗四錶3／6／6 V，原側6／6／3 V與0.125／0.5／1 A。另驗純無功負載、低頻、瞬時功率峰值、單源隔離、放電及其他預設回歸。UI驗桌面／320及390 px手機、trusted touch展開／輸入／重設、權限／只讀；source與解壓ZIP一致。共用核心交付重建四包；不把本地證據當真Moodle／真手機驗收。

實作採支路相量＋獨立時間預測，內阻在保護模式由理想調節器補償但耗散仍入帳；預測失效／超出4096步則明示停機。儲能暫態以完整下一週期估計，限制中每一自身週期重評估，保存reviewAt以保持恢復續作。未新增runtime檔案或依賴，指引集中在[可選交流電源保護](../docs/circuit-ac-workbench.md#可選交流電源保護)。

`ac-source-protection`專項通過：三組四錶讀數、0.1／1／50 Hz、平均功率而非峰值／VA、三種波形、短路反映／單源隔離／手動重設、有限內阻調節與能量、C/L保留及放電、暫態限流自動恢復、舊檔／每狀態JSON及session往返、其他AC預設及固定codec。相鄰transient、transformer-design、scope、energy-r2及review-r3／audit／dependency-audit套件通過。source／ZIP `--source-protection-smoke` **132項**、`--transformer-comparison-smoke` **110項**通過；320／390／1280 px、trusted touch／原生鍵盤／只讀／載入v3涵蓋，320 px圖已目視。證據為 `output/playwright/circuit-ac/*source-protection*.png` 及兩個精準browser入口。

`ac-platform.test.js`的既有固定字寬<145px斷言失敗，已以修改前HEAD的隔離副本重現；其前面的預設續作、固定codec及容量測試通過。本輪未宣稱完整CI、真手機或真Moodle通過。其他並行DC示例修改不屬此保護功能的驗證範圍。

最終DC `core.test.js`回歸通過（含7299個導線軌跡幀及各量程／匯入）；`npm run package:circuit-platform`四包重建通過，每包21個共用檔及所有宣告資產與來源一致，指紋存於 `output/circuit-platform-build.json`。新Node專項已登記 `tools/run-tests.js`，browser專項已納入既有AC runner。

### 複核CW-07／08／09（2026-10-11；已完成）

CW-07為只讀數值更新遺漏；以固定reading-host容納導線／端子／接點／兩點探頭，播放只替換數值，保留輸入／選項DOM、草稿與焦點，失效顯示未知。CW-08移除battery-type/island判斷，使用直流等效解判斷理想繞組兩端非零直流電壓（交流源平均值0、C開路、L保留線阻），實際激勵仍診斷。CW-09以未合併零壓降支路的區塊／割點路徑判斷信號依賴，電壓、電流、功率分別取範圍；真正磁耦合加入依賴，跨區電壓／功率取聯集，理想源所固定的電壓取直接約束。

增加／移除無關共同參考子電路時，保留未受影響交流區塊的相位、量測歷史及能量帳；受影響部分重新初始化，不將舊帳移入新儲能容差。教師／非評量核心，assessment／rubric／SCORM N/A；不新增權威schema／依賴。先寫三項原重現與反例，驗真直流、混頻、跨區探頭／W表、零／非零耦合及無關編輯的收集保留。精準browser驗播放／單步／失效、草稿與焦點、source／ZIP；執行相鄰transient／audit／energy-r2／platform／scope，重建四包並更新原Sites；不重跑無關模擬或真手機／Moodle。

原CW-08共同參考案例在未修正Session重現dc-transformer；新原案例均通過，真正直流（含1e−12 V）仍拒絕。CW-09維持5.882353 s及約6 V；新增／改頻／刪除另一側不重置既有讀數，跨區V及W功率仍採100 s共同窗，W的V/I/P分開收集。新增核心回歸及5個相鄰套件通過（transient、audit20組、energy-r2 12組、platform、scope）。CW-07完整source／ZIP **124項**通過，含1280／390 px、±I／V、播放／單步、DOM／草稿／焦點及真實求解失效路徑。四包重建及runtime雜湊一致；證據在 `output/ac-dependency-audit/`，没有重跑其他模擬／完整CI、真手機或Moodle。


### 發電機外引線對稱（2026-10-11；已完成）

圈住的是發電機外引線：兩條線的器材內折返高度分別為30.5及35，旋轉90°後側邊縮進不一致。統一折返高度30.5，保留±60接孔、±43入口與原碳刷接點；磁極／转子／相位及求解不改。純圖形修訂，assessment／rubric／SCORM N/A，無新依賴／快照。只核對四向外引線對稱及碳刷接合、桌面／手機source／ZIP；更新原Sites，不重跑其他物理套件。

原generator-graphics套件（361轉子姿態）及新增引線／碳刷接合斷言通過；`--generator-leads-smoke` source／ZIP **128項**通過，涵蓋1280／390 px、0/90/180/270°、固定接孔及相位前後引線不變。四包重建且runtime雜湊一致；手機近景已目視，證據在 `output/generator-lead-symmetry/`。沒有重跑無關物理套件、CI、真手機或Moodle。

### 滑鼠桌面隱藏捲頁把手（2026-10-11；已完成）

以輸入能力判斷：hover＋fine pointer的滑鼠環境隱藏左右scroll-strip；任何coarse pointer的觸控裝置（包括混合式電腦）保留，不能只按視窗寬度隱藏。隱藏把手亦不佔文字避讓區。顯示修訂，assessment／rubric／SCORM N/A，手勢、物理、保存及依賴不改。只驗AC/DC的滑鼠／觸控、寬窄視窗及能力切換，重建四包及發布原Sites；不重跑物理或手勢全套。

`--scroll-grip-visibility-smoke` source／ZIP **80項**通過：AC/DC、1280／390 px、瀏覽器實際fine／coarse能力切換，純滑鼠不顯示、觸控保留32px／pan-y及文件不變。混合能力按CSS的any-pointer:coarse規則保留；Chromium的media override不能模擬primary fine同時any coarse，未冒充混合硬件實测。四包重建及runtime雜湊一致，證據在 `output/scroll-grip-visibility/`；没有重跑無關物理／手勢／CI或真手機／Moodle。

### 電感磁場按相對電流疏密（2026-10-11；已完成）

取消13條內部場線下限；每個線圈以本次初始／已觀察最大電流作固定向上擴展的相對量尺，場線數近似正比於電流大小，弱場可只有1條，零／未知收起。小電流的新實驗自行校準；放電時不縮小量尺，不用無關線圈的峰值；新實驗／恢復重新校準，preview不污染正式量尺。外部返回線亦減少，保留既有方向、內密外疏及有限框場線幾何。

教師顯示修訂，assessment／rubric／SCORM N/A，無新依賴或權威schema；不改I/U/能量求解。只驗比例與微小初值、單調放電、反向／零／未知、獨立線圈、preview及重新校準，並以source／ZIP桌面／手機確認畫布／面板／放大一致。使用相關field-graphics、ac-display及flow套件，不重跑其他物理全套；更新兩個原Sites。

3個直接相關Node套件通過；新比例回歸核對0.5 A／1 mA初始放電、半／十分一／百分一、獨立線圈及preview隔離。`--inductor-density-smoke` source／ZIP **208項**通過，涵蓋1280／390 px、三處一致及恢復，權威Session保持。14個有界線數級別（0及1–25奇數）保留中央線；外側返回線隨強弱降至0／2／4條。四包重建並核對runtime雜湊，手機強／弱圖已目視；證據在 `output/inductor-field-density/`。沒有重跑完整CI／無關物理套件、真手機或Moodle。

### 低縮放概覽儀表名稱（2026-10-11；已完成）

使用者35%概覽出現「undefined：0.19 A」。概覽只硬編碼DC的A/V/W/G，漏了AC儀表type；改用registry的儀表icon。純顯示修訂，assessment／rubric／SCORM N/A，低縮放收起元件文字、讀數／求解／保存及依賴不改。只核對概覽的AC A/V/W及DC A/V/W/G、值隱藏／未知與放大還原；source／ZIP桌面及手機低縮放專項，不重跑物理／手勢全套，更新兩個原Sites。

`--overview-smoke`來源／ZIP共108項通過（AC A/V/W ×390／1280 px ×縮小／放大），原meters-and-math套件96 fixtures通過；縮放前後權威Session不變。四包已重建並核對當前runtime雜湊，圖片與證據在 `output/overview-meter-labels/`。本輪沒有重跑完整CI／物理套件或真手機／Moodle。

### CW-10／CW-11／CW-09-R1複核（2026-10-12）

先以完整Session重現：直接理想源／C在非零相位改C且有獨立AC時停機；四孔變阻器A-B接法的平均功率只計第一段；理想變壓器副側已受原側理想源約束，仍混入副側負載電源頻率。修正範圍：重啟整個受影響區塊的源相位、儲能、量測及能量帳；只對變阻器積分全部支路功率，保留變壓器／功率表語義；沿理想比例及極性約束推導電壓來源，非理想依賴保留。非評量，assessment／rubric／SCORM N/A，既有doc／Session／codec格式及依賴不改。精準驗證三個原始案例、三個變更時刻及數字／滑塊、五個滑片位置、A-P及分壓負載、理想／有限內阻／耦合模型，並檢查未受影響歷史與保存續作；source／ZIP專項後重建四包，更新原Sites。

三項原始案例已用完整Session確認及修正。新增ac-review-r3與原ac-dependency-audit、transient、ac-audit-regressions、ac-energy-r2及scope通過；數字／滑塊的source／ZIP桌面／手機專項536項通過。滑塊改用隔離的Session記憶體副本，保留未受影響觀察歷史，預覽不修改原狀態。四包重建核對來源；證據在 `output/ac-review-r3/`。未驗完整CI、真手機或Moodle。

### 五級畫布字體大小（2026-10-11）

依使用者要求，以「字體大小」五級選單（很小／小／中／大／特大）取代投影字體勾選。預設中：名稱20px、讀值18px，較原14／12px大；各級亦調整導線電流及方向標籤。字級保持畫面像素大小，不跟隨zoom縮細。可復原、匯出／載入及切換示例保留；舊projection欄位僅作相容，無該選單用詞。fontSize為可選显示欄位，未新增者不改文件形狀、技術codec或活動固定顯示權限。非評量，assessment／rubric／SCORM N/A；只驗五級字形、布局、舊文件、往返、物理狀態不變及source／ZIP桌面手機，重建四包更新原Sites。

display-and-mirror115及document-import8組通過；source／ZIP五級顯示專項258項通過（AC／DC ×1280／390px），驗字級實際畫面像素、保存／載入／復原／重做、舊projection與模擬狀態不變，特大手機概覽無溢出。labels及wire-current-labels相鄰幾何／導線讀數套件通過；舊72個清晰幾何fixture明確用很小字級，五級的實際顯示由本次browser專項核對。四包重建核對來源；證據在 `output/font-sizes/`。未驗完整CI、真手機或Moodle。

### 互感示例的清晰接線（2026-10-11）

依使用者要求，原側供電支路放上方，放電電阻放中間獨立直支路，線圈與副側負載／電流計各佔清楚區域；導線僅在顯式接點相會，不交叉、重疊或穿過元件。只調位置及路徑，保留元件ID、參數與端子拓撲及合／斷時的感應方向。非評量，assessment／rubric／SCORM N/A。沿用preset幾何檢查及互感專項source／ZIP桌面、手機、通斷讀值，不擴大到無關測試；重建四包並更新原Sites。

最終source／ZIP互感專項40項通過（1280／390px、實物／符號、通電／穩定／斷電反向）。ac-platform既有導線無交叉／重疊、元件間距及避讓檢查通過；與修改前模板比對，ID、端子拓撲、參數及通斷讀值保持。四包重建並核對來源；證據在 `output/mutual-layout/`。未验完整CI、真手機或Moodle。

### 理想變壓器示例的兩側量測（2026-10-11）

教師示例原／副側各放交流電壓表及電流表，左右相同位置、清楚命名；電流表串聯，電壓表跨繞組並聯，理想儀表不改負載。預設6V、200:100匝及12Ω，副側100／200／400匝展示降壓／等壓／升壓及相應電流，調負載則電壓保持、電流改變。技術學生示例保留原模板及codec相容性。非評量，assessment／rubric／SCORM N/A；只驗量測接法、三種匝數及負載、source／ZIP桌面／手機布局，重建四包更新原Sites。

最終source／ZIP示例專項110項通過，100／200／400匝及24Ω負載的四錶值符合解析關係；1280／390px布局通過。ac-platform既有preset接線／間距及技術codec往返、transformer-design核心場套件通過。四包重建並核對來源；證據在 `output/transformer-comparison/`。未驗完整CI、真手機或Moodle。

### 復原／重做共用圖示（2026-10-11）

依使用者要求，以共用24×24 SVG圓弧箭頭取代字元↶／↷，復原／重做互為鏡像；沿用工具列圖示線寬、置中及44px按鈕。純外觀，assessment／rubric／SCORM N/A，操作及快照不改。只核對AC／DC桌面及手機圖示置中、enabled／disabled狀態及一次復原／重做，source／ZIP重建後更新原Sites。

`--history-icons-smoke` source／ZIP共56項通過（AC／DC ×1280／390 px），SVG中心與按鈕中心一致、兩方向圓弧尺寸一致，停用狀態及實際復原／重做文件一致。四包重建並核對來源；沒有重跑物理、完整CI、真手機或Moodle。證據在 `output/history-icons/`。

### 發電機磁通量用詞及說明排版（2026-10-11）

依使用者要求，場的觀察面板及放大觀察改用「單匝磁通量 Φ」及「總磁通量 NΦ」，不用磁通鏈；說明中的磁極、法線、角度、磁場及磁通量公式沿用共用LaTeX向量字形。純文案／排版，assessment／rubric／SCORM N/A，物理值及快照不改。只更新既有readout-math專項的用詞及數學符號斷言，核對source／ZIP桌面及手機，重建四包並更新原Sites。

readout-math Node套件及source／ZIP共134項針對性顯示檢查通過，包括面板、放大觀察、手機LaTeX字形及總磁通量仍使用原NΦ數值；四包已重建並核對來源。證據在 `output/generator-flux-copy/`；沒有重跑物理全套、CI、真手機或Moodle。

### 徹底移除示例提示（2026-10-11）

依使用者最新要求，AC／DC所有尺寸均不提供示例提示、展開入口或載入示例的說明通知。示例選單及電路載入保留；移除相關DOM、事件及CSS，而非只隱藏。教師非評量，assessment／rubric／SCORM N/A；模型、快照及依賴不改。只更新既有example-hint專項，核對source／ZIP桌面、手機的提示不存在、示例可切換及一般操作通知保留，重建四包並更新原Sites。

`--example-hint-smoke` source／ZIP共90項針對性檢查通過，涵蓋1280／390／844 px、AC及DC空白／示例切換、提示不存在及一般操作通知保留。四包重建並核對來源雜湊；沒有重跑物理、完整CI、真手機或Moodle。證據在 `output/example-hint-removal/`。

### 手機不顯示示例說明（2026-10-11；歷史記錄，已由徹底移除取代）

手機直向（≤759 px）及窄橫向（≤959 px、≤450 px高）隱藏AC示例提示整塊，連收起入口亦不佔位；DC載入示例的操作說明通知亦隱藏。桌面保留現有提示及展開／收起。這是顯示修訂，assessment／rubric／SCORM N/A，物理、快照及依賴不改。只驗source／ZIP的手機直向／橫向、桌面及resize返回、DC示例通知和正常通知，更新既有hint案例而不重跑繞線／求解套件；更新原Sites。

`--example-hint-smoke` source／ZIP的64項相關顯示檢查通過；桌面44px展開／收起與鍵盤、手機整塊無佔位、resize返回及DC一般通知保留。四包已重建，當前runtime雜湊一致；證據在 `output/mobile-example-hints/`。未重跑求解／繞線／CI或真手機／Moodle。

### 能量複核 CW-03-R2／CW-06（2026-10-11；已修正）

正式最新 Session 重現：100 μF／0.01 V、10 H 無線阻及10 μΩ並聯放電，只有本體／額外電容完全懸空均約5.000071 nJ（122步），0.2 F／24 V電容只接一端則242.548659 μJ（4步）仍 reliable。從git提交1837039的正式Session產生0.49999 s v1理想源／C快照，舊容差1.02943e−10 J接受1.00995e−10 J殘差，最新restore卻套2.95344e−12 J容差而停機。

決定：理想導線及恆為零壓降的非儲能支路合併後，以多重支路圖的雙連通區塊分開能量帳，橋接／懸空邊自成區塊；只合併真正非零互感及理想變壓器的相關區塊。局部及累計均採各區塊帳，不截斷耗散。C的快速RC估計按高頻L開路，另檢查其他C導通／開路，避免並聯L的假短路掩蓋快模態；L/R與LC尺度及事件的實際激發判斷保留。

v1先按相容歷史容差、供能／耗散可行性及正式電路約束驗證；可核證單區塊歷史保留總量於energyOrigin，新帳由恢復狀態開始，throughput從0累計，不能以abs(netWork)假冒歷史流量。Session v2的欄位及數值語義不變；舊v2的域成員鍵可識別舊連通分組，只有可唯一分配的歷史才遷移到新區塊；不可核證者明示energy-history，當前v2容差不放寬。教師非評量，assessment／rubric／SCORM N/A，無新依賴；doc v7/modelRevision1及技術codec v6保留，須測codec與容量。

驗證矩陣：無／懸空／一端／不同共接節點／共享單節點的閉合子電路、電壓與元件次序、RC/RLC快衰減解析值及縮步收斂、串並聯C/L與真正磁耦合、事件分裂／合併與未受影響帳。正式舊版產生半／整週期v1固定fixture，合法恢復／續算、修改歷史或電路約束拒絕、舊v2粗分組的可核證遷移與拒絕、codec5/6續作與容量。source／ZIP完整browser再核證能量數字、可靠狀態及恢復，執行相鄰解析參考／平台／觀察／保存回歸並重建四包；完成後原AC/DC Sites發布。真手機、Moodle及完整CI另計。


最終結果：無／懸空／一端、0／1／24 V及不同共接端的組合，首步估計均為62.5 ps（1 ns／16），1 ns後約0.01/e V、完成放電均約5.00007125 nJ；L剩餘儲能約5e−24 J。只共享一點的實際慢迴路，以及經零壓降開關／電流表／零電源的參考連接，均不放寬快區塊。強制繞過首步估計後，局部能量接受仍攔截原四步虛假耗散；改動累計帳亦正常失效。保留串／並聯C/L、磁耦合、事件帳及縮步收斂。

v1固定資料包含0.24999／0.25／0.49999／0.5／0.99999／1 s，合法歷史及原總量保留，恢復後throughput從0開始、可續算及v2往返；修改淨供能、耗散、電壓或可知導數均拒絕。舊v2粗分組可唯一分配時遷移，兩個活躍區塊的非零混合歷史及掩蓋242.548659 μJ錯誤者以energy-history拒絕，既有畫面原子不變。舊codec v5／v6變壓器及LC充電／自由振盪亦經正式受限profile恢復與續算。

10個相關Node套件通過（新12組R2回歸、原20組audit、獨立公式1771項）；source／ZIP完整工作台audit716項及scope206項通過，涵蓋桌面／390 px、能量數字、正常／失效／恢復及原子拒絕。Codec各phase／variant容量通過；最大compact session608／828 bytes，pending-envelope995／1047 bytes，低於1500界限。四包重建、來源與雜湊核對，check／diff通過。證據及圖片在 `output/ac-review-r2/`。Sites更新另記[部署文件](../docs/circuit-workbench-sites.md)；未宣稱完整CI、Moodle或真手機驗收。

### 手機快捷調參點擊回應（2026-10-11；已完成）

播放重畫不能把普通 footer 單指接觸當成畫布操作並停用原生按鈕。只在畫布拖動、導航、中央觸控及已取消的多指操作期間凍結快捷欄，保留原生 click／取消、鍵盤、參數上下限及 profile／只讀限制。不得改成 pointerdown 提交，避免滑走／取消仍改參數或一次點擊提交兩次。

此輪是共用 editor 操作修正；assessment／rubric／SCORM phase N/A，物理、權威快照與依賴不改。先以可信 touchStart → 按住跨過重畫 → touchEnd 重現，再驗 source／解壓 ZIP，AC 播放／暫停、0.1／1.3 Hz、320／390 px、連續加減、取消、上下限、輸入草稿及畫布拖動取消；相鄰 DC footer、權限及活動回歸。完成後重建四包、推送分支及更新原 AC／DC Sites；實體手機與 Moodle 另計。

基準在320 px播放、0.1 Hz及按住350 ms時重現按鈕disabled=true而模擬時間仍前進。修正只縮窄renderQuickParameters的手勢判定：畫布接觸／拖動／導航／touchBlocked仍凍結，普通footer接觸不停用。`--quick-response-smoke`來源／ZIP **672項**通過；DC `--quick-controls-smoke` **72項**，包括學生profile／只讀、拖動取消及兩行footer，亦通過。quick-controls **6組**、activity-core **19組**及ac-platform套件、check／語法／diff通過；四包已重建及核對當前runtime雜湊。圖片與證據在 `output/circuit-quick-response/`及`output/playwright/circuit-ac/*quick-response*`。沒有執行真手機、Moodle或完整CI。

### 螺線管磁感線參考圖修訂（2026-10-11；已完成）

使用者提供螺線管場線圖，要求中央最密、兩端散開及外部較疏；有限顯示範圍不必把每條線閉合。取代舊「密集內部虛線＋獨立外部小閉環」：以有限長圓形電流環疊加的方向場產生連續磁感線，內部近乎平行，兩端彎曲外散，超出固定觀察框時截去；幾何只作教學示意，不作 B 值定量求解。場線穿過繞組的遮擋段留在前景透視虛線，外部實線疏開；同一圖用於畫布、面板及放大觀察。電流反向只反轉箭頭與 N／S，零／未知及關閉場圖仍抑制。

非評量教師顯示修訂，assessment／rubric／SCORM N/A，沒有新權威狀態、依賴或資料版本；保留 L／R、匝數示意、電路求解及能量。只快取有界靜態圖形，不在播放逐幀積分場線。驗證場線不相交、端點確實延伸至觀察邊界、線圈內近乎平行、外部間距顯著較大及方向連續；弱／強場在相同範圍變密，正／負與旋轉、零／未知、場圖開關、畫布／面板／放大一致。source／ZIP 做桌面與390 px可信觸控及視覺檢查，重建四包；真手機／Moodle另計。


最終結果：中央 13–25 條密集場線穿過線圈，兩端沿同一路徑展開至 x=±84／y=±58；外部另保留四條自然回繞線。核對各級強弱下路徑不交叉、中央近乎平行、外側間距超過中央兩倍、回繞間距超過中央四倍；正負、零／未知、能量歸零抑制與狀態不變均通過。七級幾何及三方向內容快取，路徑以0.04圖形單位簡化；觀察窗疏密未變時保留SVG節點，避免播放反覆建構。

8個相關Node套件及source／ZIP場觀察214項通過，包括畫布／面板／放大同步、實際播放、正反極性、320／390 px排版及可信觸控面板捲動。四包重建，來源雜湊核對、check／diff通過；預覽及證據在 `output/solenoid-field-refinement/`。此輪未驗真手機、完整CI或Moodle gate。

### 低頻交流電表即時回應（2026-10-11；已完成）

完整 Session 已重現：0.1 Hz 電容示例的串聯 A 表在 0.05 s 已有約 0.020 A 瞬時電流，但完整 RMS 欄位須等 10 s；¼速令實際等待約 40 s。另每小格十分之一的數字精度會把小於 0.005 A 的訊號抹成零。

決定：保留按實際依賴域完整時間窗的正式 RMS／平均功率，另提供有清楚「暫估」標記的已取得樣本 RMS／平均功率；第一個有效時間段後即更新數字及指針，完整窗取得後移除暫估。每量分開檢查連續有效資料；未知、故障、未接妥不能產生暫估。小於一個原顯示步長的 AC 數字改用三位有效數字，指針按真實量程比例；DC／G 精度不改，不偽造分流、零或穩態估計。改頻率／接線／恢復按既有政策重新收集，暫停保持讀值。

教師非評量，assessment／rubric／SCORM N/A；Session v2、modelRevision 1、doc v7、codec v6 不改，新欄位為衍生觀察、不進權威快照；無新依賴。驗證完整 Session 低頻／微小量、未知與不連續資料、故障及未接妥、完整窗與暫估切換、改頻率／恢復／暫停，及 source／ZIP 桌面、手機的實際播放、¼速、數字／指針／說明。執行相鄰求解、audit、指針、讀值及保存回歸，重建共用核心四包；真手機／Moodle 另計。


最終驗證：0.1 Hz／100 μF 電容示例的 A 表在 0.05 s 已提供非零暫估；完整穩態窗約 0.000377 A。A／V／W 的啟動積分另按正弦解析式核對；未知量、樣本缺段、故障、未接妥、已知零、改頻率及恢復均保持正確狀態，正式 RMS 未提前標記 ready。實際正常／¼速按鈕播放、桌面／390 px、微小 A／V、暫停、放大觀察狀態切換、隱藏名稱／讀值及 G 原讀值，source／ZIP 共400項通過。14個相關 Node 套件（新啟動6組、原audit20組、獨立公式1771項）及完整工作台 source／ZIP audit244項通過；四包重建並核對來源／雜湊，check／diff 通過。證據在 `output/ac-meter-response/`；手機畫面在 `output/playwright/circuit-ac/*meter-response-canvas-390*`。此輪不宣稱完整 CI、真手機或 Moodle gate。

### 示例提示、繞線電流及線圈磁場（2026-10-11；已完成）

依使用者四項要求：AC 示例提示改成可直接展開／收起的持續入口，採中學程度操作文字；電感、變壓器及共用 DC／AC 變阻器共用可見繞線與電流路徑，背面不畫穿透箭嘴，密集時只取部分圈；變壓器用有界示意圈數及固定線徑，最大值填滿繞組高度；螺線管內部較密、近乎平行而端部微彎，外部稀疏回繞，避免機械鏡像及同密度。

教師非評量，assessment／rubric／SCORM／snapshot 新欄位 N/A；只改表現、提示及非權威流動幾何，保留元件端子、原始匝數／L／R、Session v2、codec v6、方向與暫停／衰減／未知抑制。使用既有 registry hook、renderer 及 native SVG，無新依賴。DC 共用變阻器及學生滑片權限要核對；提示不截取畫布拖動，44 px 操作可用，手機／短畫面不溢出。驗證以實際 SVG 銅線距離、切向、遮擋、電流反向及電子模式、原副獨立電流、匝數邊界／固定線徑、磁場不交叉／疏密及相位反轉、提示收起再開及關鍵術語檢查；執行 source／ZIP 及相鄰物理／狀態回歸，重建四包。真手機／Moodle 另計。


### 分支複核 CW-03-R1／CW-01-R1／CW-05（2026-10-11；已修正）

基準 1837039 的三項均以正式模型及完整 Session 重現：串聯 200 μF、各 0.01 V、10 μΩ 導線放電，新增未接線 0.2 F／24 V 電容後耗散由約 20 nJ 變成 509.188 μJ；零互感副側改變原側週期；相同並聯理想源的已知端電壓亦因電流不唯一而丟失 RMS。

決定：能量按電氣連通及非零磁耦合的實際交換域各自檢查，首步包含多 C／L 的保守時間尺度；k＝0 的原副側分別建立政策；U／I／P 分別保存有效積分時間及狀態，理想電源 EMF 直接取模型。教師工作台 assessment／rubric／SCORM N/A，不新增模型依賴。Session v2 保存分域能量帳及事件基準，v1 單域歷史可遷移；多域的非零舊總供能／耗散無法唯一分配時明示歷史不可核證，不能冒充可靠。技術示例 codec 隨之版本化。

驗證先重現後修復：無關電容增刪／電壓／次序、多 C／L 波形及能量收斂、零／非零耦合兩側窗、部分量測、完整 source／ZIP 介面、v2 保存恢復續作／損壞帳／v1 相容及容量；執行相鄰 transient／reference／platform／energy／scope／顯示回歸，重建四包。真手機及 Moodle 另計。

最終結果：無關電容為未加入／0／1／24 V 時，兩個串聯 C 在一個時間常數後均約 0.01/e V，完成放電約 20.00027 nJ；額外儲能不能放寬此域的局部或累計容差。串／並聯 C、L 的解析衰減、縮步收斂、無關開關不清除既有域能量帳、v2 round-trip／續作及錯誤歷史拒絕均通過。k＝0 原側保持 1/0.17≈5.882 s、自身週期 ready 及約 6 V；非零互感仍合併依賴。並聯理想源在 2.25 s 電壓 RMS 約 5.99805 V、EMF 約 8.48528 V，個別電流與功率保留 null；桌面／390 px 介面保留電壓並明示未知量，不再無限顯示收集中。已重新變成可確定的量，若尚未累積足夠有效樣本，獨立標示 collecting。

13個受影響 Node 套件通過，audit 共20組、reference 1771項；source／ZIP audit 244項及 scope 206項通過。技術示例 codec v5 正向遷移、v6 相容續作及各 phase／variant 的共享 draft/review/pending 容量測試通過；最大 compact session 551／672 bytes，低於1500 bytes界限。四包重建，逐檔核對來源／依賴及雜湊。check／diff 通過；證據在 `output/ac-review-r1/`，手機讀值圖在 `output/playwright/circuit-ac/*partial-source-readings*`。此輪不宣稱完整 GitHub CI、完整 browser 宿主矩陣、真手機或 Moodle gate 通過。

### Main 審核報告 CW-01–04 核證及修正（2026-10-11；已修正）

報告基準 a83747e3 與本分支 HEAD 相同；保留正在進行的視覺／手機工具列修改。
完整 Session 已重現 CW-01 的 1 Hz／0.1 Hz 獨立 6 V 電路錯窗，以及 CW-04 的
0／−6 pA 導線方向依賴。CW-03 普通電阻元件不容許 10 μΩ，但有限電阻導線
容許；合法的 100 μF、6 V 無源放電實測初始 0.0018 J，累計耗散 878.906250 J，
沒有 fault。CW-02 的 render 覆寫機制仍在，另以完整工作台驗證焦點草稿。

修正決定：量測按獨立電路及磁耦合依賴分域；單頻用自身週期，多頻只有可核對
且有界的共同週期才稱共同週期，其他情況採明示時間窗。峰值／平均功率／理想
磁通使用同一域的政策，頻率或電路改變後重新收集相應觀察資料。
快速暫態首步以實際被動網絡的 RC／L/R 時間尺度限制；功率積分配合求解步，
以能量殘差參與接受／縮步及明確失效，禁止截斷耗散冒充守恆。
設定數字保留未提交草稿，change／Enter 驗證提交，Escape／關閉放棄未提交輸入。
導線 cut 共用 DC 的雙側低誤差選擇，保留 nullspace 與原誤差尺度。

非評量教師工作台；assessment risk、rubric、SCORM phase／variant N/A。模型
仍為線性 RLC／既有 LED，不新增權威保存欄位或依賴；document v7、session v1
保持，新增量測窗與能量可靠性只作派生觀察。測試先重現再修復，登記新增
獨立域／混頻／能量平衡／6 pA 回歸；包括元件重排、無關域增刪、頻率事件、
source-free RC／RL、縮步收斂、restore 合法續作、過度僵硬明確失效、探頭一致性。
執行受影響的 transient／reference／energy／scope／DC cut 與 UI 權限回歸，
完整 source／ZIP 工作台設定草稿及物理觀察，重建四包；真手機／Moodle另計。

最終實證：13個受影響Node套件全部通過；新增 `ac-audit-regressions.test.js`
14組涵蓋分域／混頻／重排、磁通、獨立DC過載、快速RC／RL、收斂、事件、
可靠性失效、並聯理想源、約束導數、波形轉角、被動平衡與6 pA。既有
`ac-reference.test.js` 1771項、24組帶表正弦電路及容量／restore續作保持通過。

合法10 μΩ導線放電的完整Session由 `878.906250 J` 改為約 `0.001800023 J`，
相對初始0.0018 J的平衡誤差約0.00128%；沒有裁剪耗散。1 Hz／0.1 Hz兩域
完成各自窗後約5.99803／5.99997 V；交換導線端序為+6／−6 pA。
`--audit-smoke` source／ZIP共132項，含1280／390／320px播放中的一秒以上
輸入草稿、刪除重打、Enter、Escape、關閉及錯誤輸入；DC `--settings-smoke`
390px source／ZIP共8 observations通過。AC相鄰 `--preset-smoke` 618項及
`--scope-smoke` 206項通過，確認全部範例、開關、波形、探頭、手勢與續作。
check／diff通過；四包重建並逐檔核對依賴及來源。證據彙總與Node完整輸出在
`output/ac-review/`，實際瀏覽器畫面在 `output/playwright/circuit-ac/`。
這是本輪受影響範圍的驗證，不宣稱重跑完整站點、完整browser宿主矩陣或
真手機／Moodle gate；原T3限制保留。

### 共用手機底部工具列（2026-10-11）

DC／AC 一併採用兩行排版及「更多」元件操作，實作決定與驗證證據集中於
[DC／AC 共用計劃](28-circuit-workbench.md)。
AC 沿用相同 CSS、快捷參數及命令；沒有修改瞬態模型、物理參數或 session。

### 變壓器繞線與鐵芯比例修訂（2026-10-11；已套用）

依使用者對灰色厚塊與繞線關係的回饋，擴大鐵芯內窗、收窄兩柱及上下橫軛，
縮短疊片的透視深度；移除遮蓋鐵芯的整塊灰色線圈底座。銅線前半圈跨過柱面，
後半圈由鐵芯遮擋，兩端露出同一根鐵柱，明確表示線圈繞住鐵芯。
開啟磁場時銅線保持實色，鐵芯內的閉合磁路以實線／遮擋虛線表示，
場線位置與較窄鐵芯一起調整。

本輪只改非評量教師工作台的 SVG 呈現；assessment risk、rubric、phase／variant、
權威 snapshot 新欄位均 N/A，無新依賴。四端子、匝數、電學模型與 v7／session v1
保持。沿用 transformer Node 測試及 source／ZIP 精準 browser 流程，檢查連續繞線、
磁路落在鐵芯內、四向標註、場線開關、1／2000 匝、320／390 px trusted touch
觀察視窗及接線預覽；重建四包並檢視實際截圖，真手機及 Moodle gate 另計。

`transformer-design.test.js`、`field-graphics.test.js`、`ac-platform.test.js`、
`npm run check` 及 `git diff --check` 通過。
`--transformer-design-smoke` source／ZIP 各 60 項，共 120 項通過，瀏覽器例外為空；
包括對實際 SVG 磁路逐點抽樣，確認閉合路徑位於鐵芯內。播放時分別收集 27／32
個正負磁通同步 RAF 樣本。四包已重建並逐檔核對來源；桌面實色、磁場放大圖、
1／2000 匝及 320 px 放大畫面已目視確認。證據位於
`output/playwright/circuit-ac/`，這是本輪精準驗證，不覆蓋先前記錄的完整 ZIP
宿主 T3 未完成或真手機／Moodle gate。

### AC 儀器數值及 PhET 對照驗證（2026-10-11；結果及限制）

依使用者要求，核對 AC 工作台全部儀器、電源、R／C／L、開關、LED、
發電機及兩種變壓器。既有 Node 與 source／ZIP browser 驗證之外，加入
獨立解析式的同參數矩陣，並實際操作 PhET Circuit Construction Kit: AC；
Faraday's Electromagnetic Lab 僅在模型及參數可對應時比較。
先統一峰值／有效值、頻率、方向、初始條件、串聯內阻及量測窗口，
每筆結果標明實測、解析核對或不具可比性，不把 PhET 當作無條件真值。

本輪是非評量驗證；rubric／phase／snapshot 新增欄位均 N/A，無新 runtime
依賴，現有 v7／session v1 契約保持。若發現程式錯誤，先加入能重現的
測試再修正；新測試登記到既有 runner，保留原物理精度斷言。

**PhET 實際操作與讀值。** 使用官方 Circuit Construction Kit: AC 1.0.23
（About 顯示建置時間 2026-08-02 05:44:12 UTC），手動接線、設定參數並暫停讀表。
正弦源為峰值 9 V、0.5 Hz，對應本工作台的有效值 `9/√2 = 6.363961 V`。
下表電流是同相位的瞬時電流大小；PhET 使用非接觸電流表，本工作台使用
求解／探頭的瞬時電流，不能直接拿本工作台 A 表的有效值比較。
相位由 PhET 顯示的源電壓及下一步上升／下降方向估算，因此受 0.01 V
讀值精度限制；PhET 表格電流精度為 0.01 A。PhET 內置的極小寄生電阻保留，
本工作台採理想源與導線；沒有把所有內部數值設定宣稱為完全相同。

| 電路（R／C／L） | PhET 源電壓／趨勢 | PhET 電流大小 | SimLab 同相位電流大小 |
|---|---|---:|---:|
| R = 10 Ω | 8.40 V | 0.84 A | 0.84000 A |
| R = 16 Ω | 8.40 V | 0.53 A | 0.52500 A |
| R = 40 Ω | 8.40 V | 0.21 A | 0.21000 A |
| R = 10 Ω，C = 0.1 F | −1.87 V／下降 | 0.42 A | 0.42424 A |
| R = 10 Ω，C = 0.1 F | −4.50 V／下降 | 0.63 A | 0.63387 A |
| R = 10 Ω，L = 5 H | −6.98 V／上升 | 0.46 A | 0.45867 A |
| R = 10 Ω，L = 5 H | −4.89 V／上升 | 0.48 A | 0.48330 A |
| R = 10 Ω，C = 0.1 F，L = 5 H | −3.73 V／下降 | 0.25 A | 0.25417 A |
| R = 10 Ω，C = 0.1 F，L = 5 H | −6.08 V／下降 | 0.08 A | 0.08687 A |

前八筆在 PhET 半個末位顯示單位內相符；最後一筆相差 0.00687 A，不能
宣稱兩者完全一致。該點獨立正弦穩態解析式為 0.0868613 A，SimLab 為
0.0868720 A。檢視實際 1.0.23 公開發行檔，PhET 以每幀 1/60 秒更新源，
C／L 使用梯形伴隨模型與自適應子步，再用子步末端電流作時間加權平均。
另以獨立串聯 RLC 方程重現這套步進規則，後兩點分別得到 0.25075 A、
0.08313 A，取兩位小數正好是 PhET 的 0.25 A、0.08 A。這是支持數值
步進／讀值平均解釋的診斷重算，並非額外的瀏覽器實測；沒有為迎合 PhET
最後一位而改動 SimLab 求解器。

**獨立物理基準。** 新增並登記 `ac-reference.test.js`，1771 項檢查通過。
24 組帶 A／V／W 的正弦電路包含 R／RC／RL／RLC、0.1／0.5／1／2／50 Hz、
40 Ω 負載、5 H PhET 對照組及電表串聯內阻。預期值獨立使用
`X = ωL − 1/(ωC)`、`I_rms = V_rms/√(R²+X²)`、`P = I_rms²R`，並逐相位
核對帶符號瞬時電流及電流探頭；初始儲能按穩態解析式設定。
24 組 A／V／W 的最大相對誤差為 0.16051%（50 Hz 純電阻平均功率）；
這個上限只代表此矩陣，並非任意拓撲／參數的全域精度保證。

| 儀器／模型 | 本輪核對及結果 |
|---|---|
| AC A／V／W | 有效值、實功率、相位差及串聯負載；獨立解析式通過。6.363961 V RMS、10 Ω、0.5 Hz 時，A = 0.636344 A、V = 6.363438 V、W = 4.049334 W，解析值分別為 0.636396 A、6.363961 V、4.05 W |
| 電壓表負載 | 理想輸入及 100 Ω 有限輸入，包含 10 Ω 源內阻的分壓公式通過 |
| 靈敏電流計 G | 100 Ω 內阻、正負半週及反接極性；瞬時帶符號電流通過 |
| 浮動電壓／電流探頭 | 瞬時訊號、方向、跨隔離端未知值；既有 Scope 及新增電流解析式通過 |
| C／L／開關 | RC／RL 指數響應、LC 能量、充放電方向、狀態連續性及保存後續作；新增與既有物理測試通過 |
| 理想變壓器 | 匝數比 0.25／0.5／2 的電壓、兩側電流、負載功率及電氣隔離通過 |
| 耦合變壓器 | 0.5／2／50 Hz、k = 0.8／0.99，按兩個複數阻抗方程核對兩側電流及負載功率通過 |
| 發電機 | 0.5／1／2 Hz，B = 0.2 T、A = 0.02 m²、N = 200；法拉第定律、磁通及內阻分壓通過 |
| 燈泡／LED／波形 | 既有正弦／方波／三角波有效值、功率、亮度、LED 導通方向及儲能放電測試通過；亮度是教學映射，沒有作實際燈具光度校準 |

官方 Faraday's Electromagnetic Lab 的變壓器是可移動的分離線圈，匝數、
面積及電源使用不同控制；發電機則是水輪驅動旋轉磁鐵。本工作台是理想／
線性耦合變壓器與均勻磁場中的定速旋轉線圈，不能聲稱已作同參數數值對照。
PhET CCK 此介面亦沒有本工作台的四端功率表或靈敏 G 對應物；這些項目
以解析式和生產模型／顯示測試驗證。

**已執行證據與入口。** 13 組既有 Node suite 全部 exit 0：transient、
AC platform／display、energy sync、Scope、generator／field／transformer
graphics、readout math、AC meter design、meters and math、meter motion、
wire resistance。數值原始結果及手動讀值記錄在
`output/ac-phet-verification/analytic-reference.log`、`node-checks.json`、
`phet-observations.json`、`phet-step-diagnostic.json`；可重跑的獨立基準為
`node sim/circuit-workbench/ac-reference.test.js --json`。

完整 browser 的前幾輪暴露三項測試問題：field readout 把 dt 標題字形當
dd 值取框；微小 C／L 電流已按現行零顯示契約隱藏箭頭，舊測試仍要求
歷史峰值窗口期間畫箭頭；慢幀環境中穩態讀值取樣 1.2 秒不足 31 幀。
分別改成實際 dt／dd 容器、同時保留原始電流／峰值與零顯示斷言，以及
最多等 4 秒但仍要求超過 30 幀且數字唯一。沒有放寬物理精度或免除失敗項；
中止輪次的未執行後段不記為通過。

最後完整執行中，source 全段通過；ZIP 已通過變壓器、電表、場線、發電機、
全部預設、探頭、2／50 Hz 時鐘／燈泡、A／V／W／G 指針及手機儀器操作，
後段因 `CDP Runtime.evaluate` 超過 30 秒而中止。紀錄在
`output/ac-phet-verification/browser-full-final.log`，不能引用舊的
`output/playwright/circuit-ac/evidence.json` 當作本輪完整成功證據。

從原測試逐字抽取 palette 操作以後的尾段，在新瀏覽器補驗，source 再次
通過；接續 ZIP 在嵌入頁觸控遇到 `Input.dispatchTouchEvent` 逾時。
再將 ZIP 單獨放入新瀏覽器，開關、還原、範例、DC／AC 共存及 T1／T2
宿主觸控／全螢幕均通過，T3 期間 Chrome 停止回應，連偵錯 HTTP 頁面
亦在 3 秒內無回覆，遂停止該輪專用測試進程。未確認卡住根因，T3 及其
後續 fullscreen 降級項不能記為 ZIP 通過；沒有用增加逾時或略過斷言
冒充完整 gate。保留 `completion-browser.log`、`completion-package-fresh.log`
及 `run-completion-check.cjs` 作診斷。主入口現會附上失敗的 evaluation
內容，且就緒輪詢遇到 CDP 傳輸逾時立即失敗，避免反覆吞掉通訊逾時。

`npm run check`、修改後的 browser 腳本語法及 `git diff --check` 通過；
四個 standalone ZIP 已重建。本輪沒有改動物理求解或儀器數值算法。
結論限於已執行的數值及儀器檢查：沒有發現計算錯誤；完整 ZIP browser、
真手機及真 Moodle 驗收仍不能標成通過。

參考：[PhET CCK AC 1.0.23](https://phet.colorado.edu/sims/html/circuit-construction-kit-ac/1.0.23/circuit-construction-kit-ac_en.html)、
[官方 ACVoltage 模型](https://github.com/phetsims/circuit-construction-kit-common/blob/main/js/model/ACVoltage.ts)、
[官方暫態分析](https://github.com/phetsims/circuit-construction-kit-common/blob/main/js/model/analysis/LinearTransientAnalysis.ts)、
[PhET Faraday 模擬](https://phet.colorado.edu/en/simulations/faradays-electromagnetic-lab)。
main 分支連結供閱讀；版本特定的數值診斷依據是本輪保存的 1.0.23 發行檔。

### AC 電表字標與 G 排版修正（2026-10-11）

依使用者指出的邊框重疊，為 AC A／V／W 上方單位留出內框及刻度的間距；
錶面保持直立，旋轉時其中心跟隨內框中心，避免 90／180 度時偏向邊框。
功率表 I₊／I₋、V₊／V₋ 保留語義及接孔，縮小或旋轉後仍在外殼外側。
共用靈敏電流計將底部普通 G 移到頂部標題列，與 μA 並排，實物／符號／
觸控預覽／放大錶盤均使用共用 MathJax 向量字形。

本輪是非評量顯示修正，assessment risk／rubric／phase／authoritative snapshot
新增欄位均 N/A；DC v6、AC v7、session v1 及求解、端子、刻度、指針機械幾何
保持。共用 G 同時改善 DC，沿用原拖動／吸附／全螢幕與手機手勢，無新依賴。
精準驗證沿用既有 AC meter design、meters-and-math、meter-motion Node，
及 source／ZIP `--meter-design-smoke`：四向旋轉、不同縮放、字形與外框／刻度
不相交、功率表端子標記、G 共用視圖、320／390px 可信觸控及暫停 session。
重建四包，記錄實際證據；不把本機手機模擬當真手機或 Moodle gate。

已執行 AC meter design、meters-and-math（96 個 fixture）、meter-motion
（25 項）、`npm run check` 及 `git diff --check`，全部通過。
`--meter-design-smoke` source／ZIP 各 88 項，共 176 項通過，errors 為空；
涵蓋 A／V／W／G 四向字標留白、縮小時功率表端子避讓、G 實物與符號字形、
320／390px 可信觸控選取及持續預覽、放大錶盤、物理 session 不變。
四個 standalone ZIP 已重建；桌面比較及 320px W／G 放大圖已目視確認。

### 變壓器外觀第二版套用（2026-10-11；使用者已確認）

以下為前版歷史記錄；繞組透明度及鐵芯比例已由上方最新修訂取代。

使用者看圖後要求先套用，查看實際工作台效果。本輪將疊片圓角鐵芯、連續
前後繞線及透視磁場整合至原 AC 圖形；畫布／側欄／放大視窗共用同一圖形。
場線開關切換完整／透視繞組，方向與近零／未知沿用既有 `coreFlux`，
不用預覽頁的正弦動畫。匝數代表圈數維持每 10 匝約一圈，上方比值沿用既有
直立註記與避讓；端子和文件幾何不改。

- Assessment risk、rubric、提交 phase：N/A，非評量教師工作台。
  沿用 v7 document／session v1／modelRevision 1；無新增權威保存欄位或依賴。
- 圖形的漸層與遮罩 ID 必須按 editor、畫布／場面板／放大視窗及元件分域，
  不可令多 instance 或多個變壓器互相引用錯誤圖形。
- 精準驗證：既有 transformer-design、AC platform 圖形／接線、field-graphics
  及相關 Node；變壓器 source／ZIP browser 專項（磁通正負／零／未知、
  匝數 1–2000、前後連續繞線、四向旋轉、場線開關、實物／符號、多 instance、
  手機可信選取／放大）。測試加入現有已登記的入口，四包重建後檢查實際 ZIP。
  沒有新增拖動類型，沿用原命中／吸附／手勢；真手機與 Moodle gate 仍獨立。

本輪已執行 `transformer-design.test.js`、`field-graphics.test.js`、
`ac-platform.test.js`、`npm run check` 及 `git diff --check`，全部通過。
第一輪 `--transformer-design-smoke` 的 source／ZIP 共 110 項通過，
兩邊各有 32 個 RAF 同步樣本，無瀏覽器例外；桌面、320／390px 放大圖已目視。
四個 circuit standalone 包由同一入口重建，仍使用本地依賴。
實際 AC 工作台已在本機開啟並切到變壓器放大觀察。

追加可信場線開關及接線預覽檢查時，本機先後遇到 Chrome 啟動、DevTools
請求、截圖逾時，以及半秒不足 12 幀。測試入口把通訊與同一瀏覽器的啟動
等待上限放寬至約 30 秒，並明確關閉 CDP socket；同步取樣最多等待 4 秒，
仍要求至少 12 幀、正負磁通及每幀畫布／面板與分析值一致，沒有放寬數值斷言。

最後追加驗證已通過：source 59 項／15 幀、ZIP 59 項／12 幀，共 118 項，
`output/playwright/circuit-ac/evidence.json` 的 errors 為空。
320／390px 可信 touch 均成功開關放大觀察、拖動線端顯示接線預覽、
驗證預覽內 SVG 引用，取消後權威 session 完整相同；多 editor／多變壓器及
畫布／面板／對話框的漸層與遮罩亦無重複 ID。這仍是本機模擬證據，
沒有把真手機或 Moodle gate 標成通過。

以下為套用前的預覽記錄。

### 變壓器外觀第二版預覽（2026-10-11；歷史提案）

- 先製作獨立 HTML／SVG 預覽及圖片，放在 `output/playwright/circuit-design-review/`；
  使用者看圖確認後才整合正式 renderer。此記錄是設計提案，不是已套用功能。
- 鐵芯正面、內窗及厚度共用一致圓角輪廓；繞組分前／後半圈，兩側連續引線
  從外側接既有四端子。預覽匝數以代表圈數展示，明示不等於逐匝實物模型。
- 磁場觀察使用高對比青綠色閉合線及明確箭頭；被線圈遮住的鐵芯段以透視
  虛線表示。固定範圍內疏密表示相對強弱，近零／未知收起；有關閉場線、
  暫停及反向預覽。正弦時間只供設計示範，未接正式 physics。
- 非評量設計稿：assessment risk、rubric、提交／保存 phase 及權威 snapshot
  均 N/A；正式整合仍沿用既有 coreFlux 觀察量、v7／session v1，沒有新依賴。
  本輪只驗證 SVG、正／負／零方向、桌面／手機及縮小圖可讀性，不宣稱 solver
  或正式變壓器 browser 全套通過。沒有新增拖動／吸附手勢，原端子座標保留。

預覽實際驗證：1320px 對照圖及 390／320px 版面已目視；兩種模式、正負磁通、
過零收起及播放反向通過，手機模擬以可信 touch 操作，按鈕至少 44px、無水平
溢出。方向箭頭落在磁感線上。證據／截圖及可操作 HTML 均在上述目錄，正式
AC renderer／場圖／solver 沒有套用此提案，仍待使用者看圖確認。

以下記錄只證明其日期／當時提交的實際範圍。被後續取代的方案與舊全套結果保留為歷史；目前功能或通過狀態不得由舊段落推定。


### 兩位獨立完整審核及匯總跟進（2026-10-11；修正ba19ba5）

依使用者要求，兩位reviewer各自審核完整現有AC項目，第三位去重核實後跟進。
修正Scope還原ID首次新增失敗、互感caption被接線遮擋、作者觀察通道缺能力
驗證；更新兩處文案及舊browser的MathJax／場線契約。2 Hz燈泡逐幀數值與
20 ms功率解析積分吻合，改用解析oracle取代受幀相位影響的最低值／階數；
沒有改產品亮度映射或求解精度。兩位獨立複查後均明確APPROVED
`ba19ba5993f1d0996a498766eca2b38b499098f8`，完整已審範圍無剩餘實據問題。

精準證據：AC platform完整幾何／有限線路／240次切換續作、Scope能力及
shared activity-core19組通過；主agent另核對DC core及syntax／manifest。
source／ZIP realtime140、Scope206、reactive-art276及互感actualSVG桌面／
320px布局21項通過，四包重建並核對runtime指紋。初輪未改模組證據沿用原
版本，不重跑全站；真Moodle／真手機T4仍未驗收。詳細發現、兩位審核範圍、
結案及證據界限見[正式審核報告](../docs/circuit-ac-workbench-audit-2026-10-11.md)。

### 指導文件對照整理（2026-10-11；程式基準4aba013）

本輪只更新計劃、AC作者／維護指引、共用架構與作者說明。同步現行預設值、
浮動儀器／無游標介面、移除概覽與實驗區、bar／符號／場／電表／變壓器規格，
補10個AC依賴、模組責任、15個預設名稱、版本與精準測試入口；修正架構中
「尚未有AC」及AC只讀播放說明。歷史驗證保留但不冒稱最新全套通過。

實際文件檢查：50個本地連結／錨點（含入站引用）、10個runtime檔、測試檔／
flag／npm腳本存在；JS示例語法、最小mount的生產profile及離線示例c2接點
核對通過，diff通過。未修改runtime或重跑模擬／browser；既有2 Hz完整suite
記錄及真Moodle／實機待驗收狀態沒有以文書整理宣告解除。

### 電流箭頭改紅色（2026-10-11）

與DC共用renderer修改：常規電流箭頭及靜態導線方向箭頭紅色，電子圓點保持
藍色。決定與精準證據見[共用配色](28-circuit-workbench.md#共用電流方向配色2026-10-11)。

### 共用檢視器移除概覽（2026-10-11）

DC／AC同時移除未選取時的「電路概覽」，在共用editor處理而非各自隱藏。
保留選取物件的設定／讀值、兩點量測及實際診斷；空白區塊不佔位置。
決定與48項source／獨立ZIP精準證據見[DC共用計劃](28-circuit-workbench.md#共用檢視器移除電路概覽2026-10-11)。

### 變壓器鐵芯、匝數比與共同磁通（2026-10-11）

- 鐵芯改為實心有厚度的疊片環形鐵芯，以頂面／右側／窗口內壁及細疊片邊線
  表示厚度，保留兩側連續繞組及所有端子座標。上方單獨顯示LaTeX原副匝數比
  N₁:N₂（約分）；移除底部兩個匝數及共用label的裸副匝數，數值仍在參數欄。
- 共同磁感線只在鐵芯的小範圍內閉合，2–4條等間距，隨磁通強弱改疏密，固定
  範圍；線圈遮住的部分較暗虛線，箭頭隨磁通反向。未知／近零收起，場線開關
  不影響比例或繞組。實物／符號、場面板／放大同一資料，播放按RAF更新。
- 線性線圈共同磁通為 kL₁(I₁+N₂I₂/N₁)/N₁，忽略漏磁圖像但保留原模型。
  理想變壓器沒有磁化電流狀態，從U₁/N₁的時間積分推導交變磁通，一個週期
  收集後扣除平均積分值；不能由負載電流或瞬時電壓冒充磁通。觀察器每週期保留512個時間格
  及少量邊界格，不加進權威snapshot；restore／改參數後重收集，未知不冒充零。
  理想模式不顯示不存在的磁化儲能數字，並說明磁通為交變示意。
- 不改solver、接線、波形、得分、依賴或snapshot版本。精準測試選變壓器幾何／
  比例、電壓積分相位、空載、耦合抵銷／零、restore合法續作，以及source／ZIP
  桌面／320px場示意與觸控。觀察器改動另跑scope Node；不跑無關活動全套。


實際證據：transformer-design Node（電壓積分與相位、正弦／方波／三角波、
空載、安匝抵銷、零／未知、比例／旋轉／開關及restore合法續作）、scope Node、
既有場圖及共用Math96 fixtures通過。source／ZIP專項各41項、共82項通過，
各31／32個RAF樣本的磁通方向同步；桌面及320／390px可信tap／放大通過，截圖已
目視確認。只跑相關項目，未重跑無關活動；本機證據非實機／Moodle驗收。

### 精簡交流錶盤及整理示例（2026-10-11）

依使用者要求對照 DC 電表：AC A／V／W 使用緊湊白色錶面及灰藍外殼，
由106×134收至92×78；移除錶盤下方數字／未接妥狀態區。狀態仍在檢視器及
放大觀察說明顯示。刻度、單位、交流符號、符號視圖及功率表端子均用共用
MathJax向量字形，沒有裝飾接孔；A／V兩個無極性接線孔不畫A／B標記。
功率表保留I+/I−、V+/V−兩組（電流串聯、電壓並聯），只反接一組會改功率
符號，兩組同時反接則讀值不變。端子ID／座標、求解、量測窗及snapshot不改；
只更新視覺bounds、刻度幾何、預覽與放大viewBox，保留每量程30格及指針慣性。

預設名稱統一為「主題：觀察內容」，選單分交流基礎、電容與電感、變壓器與互感、
振盪電路，配置示例標題寫明教學內容；內部key及初始電路不變。本次不新增評分、
依賴或保存欄位。精準驗證選AC錶盤／接線極性與RMS、DC符號字形、指針幾何
Node，以及source／ZIP錶盤專項（實物／符號、旋轉、放大、可信手機觸控、預設名稱）。
不重跑整套RC／RL、評分或手勢矩陣。完成後連同本聊天既有修改commit並push。

實際驗證：AC meter design Node、指針25 cases、DC／共用Math字形96 fixtures及
readout-math Node通過；`--meter-design-smoke` source／ZIP各58項，共116項通過，
含有效值反接不變、功率反號、四向旋轉後physics不變、端子字形、可信手機tap／
放大錶盤及320px教學示例頂欄。已目視實物／符號對照DC、接線及320px錶盤
截圖。未重跑整套測試；本機手機模擬不代表實機／Moodle驗收。

### 移除實驗操作區塊（2026-10-11）

依使用者要求移除 Control Panel 的「實驗操作」、單步及回到初始條件按鈕。
刪除區塊建立及按鈕狀態更新；底層 API 保留。此決定取代下方歷史記錄的
摺疊操作區配置。只核對受影響檔案的語法及差異，不重跑物理或全套測試。

### 發電機bar及交流數學排版審核（2026-10-11）

- 發電機θ用0–360°循環條，Φ、NΦ、e用中心零點的雙向bar；磁場B保持
  靜態數值。同時套用選取讀值，變壓器場觀察動態值亦一致。量尺依B、S、N、f
  的理論峰值設定，數字固定單位及兩位小數、播放5Hz／暫停即時，物理時間不改。
- 共用Math建立受控symbol／formula／label／prose接口，補θ、Φ、NΦ、e、
  C/L/R/f、RMS、原副線圈下標、能量及法線。物理量斜體、數字／單位／
  sin cos正體，法線用單位向量hat n；極名N/S、器材圖示及使用者元件名稱
  保持普通標誌。bar數值維持tabular文字，單位轉MathJax，避免逐幀typeset數字。
- 示波器標題／時間量尺／軸單位及刻度、參數與讀值標籤、場說明、預設說明
  和配置示例保存時間統一排版；自包含向量字形可在Canvas重用。靜態幫助公式
  明確受控，不將使用者名稱當TeX或HTML執行。零／未知、歸零規則不變。
- 依使用者要求只跑精準測試：受影響Math／Readouts Node，以及新專用
  readout-math source／ZIP檢查（發電機bar、相位同步、單位／符號、手機及
  受影響scope／配置示例）。不重跑無關RC/RL、接線、評分或全套測試。

實際驗證：`readout-math.test.js`、既有 `meters-and-math.test.js` 及
`ac-display.test.js` 通過；專用 `--readout-math-smoke` source／ZIP 各40項、
共80項通過（單步／暫停檢視器與場觀察同步、播放相位／讀值、正負bar、物理峰值量尺、固定單位、獨立向量
字形、參數／示例保存時間、320px不溢出）。已目視桌面／320px發電機觀察
及示波器截圖；未跑全套測試或無關活動。此為本機瀏覽器證據，非實機／Moodle證據。

### 儲能首次歸零的電流／場同步（2026-10-10）

- 重現 RC、RL 首次顯示儲能0 J時，仍分別有約6.93 μA、19.71 μA及場線。
  增加共用電氣島可見性判斷：同島有C/L、所有可知儲能均已低於原顯示
  門檻、觀察窗完整、無供電中的源、無跨島變壓器或仍可讀的小量程量測時，
  同步將島內電流、場、分布電荷及器材讀值顯示為零。灰色極性參考保留。
- 判斷限renderer純顯示，flow／導線讀值／元件／場圖／panel共用；不改
  原始分析、積分、波形、scoring或snapshot，不持久化隱藏鎖，重新供電可恢復。
- 單一元件顯示儲能0時，其場線／active極性標誌收起；電流則判斷同島
  的能量與供電，避免把能量交換當成放電完成。
- 正常LC某一種能量為零而另一種非零、充電起始、AC供電及小量程仍可讀
  信號不強行抹掉。未知／未完整觀察不宣告已放完，DC照舊。
- Node及source／ZIP測「首次電場／磁場儲能0 J」的當刻（RC/RL正負），
  核對上一點有場、當刻電流／箭頭／場／電荷／active極性標誌一起歸零，
  raw能量電流仍非零、capture不變，並驗證重新供電及LC能量交換例外。

驗證：30個 circuit Node 測試檔通過；新增 energy-sync 測 RC/RL 正負極性、
保存恢復續算、重新供電、LC交換、獨立電氣島、100 pA仍可讀量測及未知
讀值不假零。source／ZIP **212** 項通過：RC總t=27.25s首次0 J，raw
E≈9.60×10⁻¹⁰ J、I≈−6.93 μA；RL總t=24.5s首次0 J，raw
E≈9.72×10⁻¹⁰ J、I≈19.71 μA。前一點場與電流仍可見，當刻全導線0 mA、
無流動／方向箭頭，主圖／panel／大圖相關值零、場線收起、極性標誌灰色；
snapshot及波形raw值不變。browser亦執行正常LC電場儲能0但磁能／電流
非零的例外。scope **194** 項、DC共用操作 **70** 項及syntax／manifest／diff
通過，四個 circuit ZIP與全站SCORM包重建核對。證據：
`output/ac-baseline/ac-energy-sync-*.log`、`dc-energy-sync-regression.log`、
`output/playwright/circuit-ac/source-{rc,rl}-first-zero-energy-sync.png`。
全站既有2 Hz測試阻塞與真手機／Moodle gate維持歷史記錄。

### 電容放電尾段同步歸零（2026-10-10；以下為舊電流觸發版本的證據）

- 使用者重現導線顯示 0 mA 後仍有電容電場的時間差。電容顯示副本在電流
  已按完整窗顯示為零，且當刻／全窗電壓均低於參考電壓×10⁻⁴時，同步將
  U、q、電場與電場儲能顯示為零，不再另等 1 μV 門檻。參考電壓沿用 bar
  的初始／電源量尺（最低 1 V），電流判斷與畫布使用同一 references。
- 保留有明顯電壓的零電流電容、未知／未完成窗口、小量程儀表及正常振盪；
  不持久化歸零、不停止積分，原始 state、波形、q/E 與續算保留。
- 儲能區合計使用相同元件顯示副本，避免電場消失後仍列出尾值。
  灰色極性參考標誌維持。充電或接線改變後可重新顯示，沒有單向隱藏鎖。
- Node／source／ZIP 必須測試「首次顯示零電流」的當刻，而不只驗證40秒後；
  前一刻仍有可見電流／場，首次歸零後場線／電荷／U/q/E同步，raw U>1 μV
  且 raw I≠0、capture及合法續算不變。另保留零電流帶電與大阻值慢放電。

驗證：29個 circuit Node 測試檔及新增顯示邊界測試通過；兩種放電極性都
在首次電流顯示零時同步歸零，保存／恢復後執行合法續算並比對原始電壓。
0.5 V電容經1 MΩ慢放電及6 V零電流帶電電容仍保留電場。source／ZIP
場觀察 **186** 項通過：充電6秒後放電24秒（總t=30s）首次全部導線為
0 mA，前一點t=29.875s場仍可見；當刻 raw U≈35.03 μV、I≈−1.751 μA
仍非零，但主畫布／面板／大圖 U/q/E、場線與分布電荷都同步收起。快照
保持不變，灰色極性參考保留。syntax／manifest／diff通過；四個 circuit ZIP
重建核對。證據：`output/ac-baseline/ac-capacitor-sync-*.log`、
`output/playwright/circuit-ac/source-rc-first-zero-synchronized.png`。
全站既有測試阻塞、真手機／Moodle gate維持歷史記錄。

### 場觀察條形讀值與衰減顯示（2026-10-10）

- 電容／電感場觀察及選取讀值改用條形指示：帶符號量以中心零點表示，儲能
  從零向右；固定工程單位、兩位小數及穩定量尺，播放時數字最多每秒五次，
  bar 跟當刻值更新；暫停立即顯示當刻值。靜態 L 保留普通數字。
- 統一純顯示副本供器材、場觀察及讀值使用。電流用既有完整觀察窗近零
  判斷；電容電壓另用全窗 voltagePeak 與 1 μV 門檻，不以 I=0 判定電场為零。
  observation tracker 增加只讀電壓峰值，不改物理積分／保存格式；未知不冒充零。
  場線另在當刻 |I|<1 μA／|U|<1 μV 時收起，正常過零後可再出現；不將
  瞬時過零當成衰減完畢，不改全窗近零判斷、原始值或總儲能。
- 電荷符號／N、S 標誌獨立於場線開關。有場時按真實極性，場已不可見時
  用灰色方向參考；分布電荷隨可見電壓歸零收起。場線／箭嘴不能讀原始尾值
  繞過顯示副本；原始 analysis、波形、儲能、session 保留完整數值。
- 新共用 AC display 模組列入 runtime／兩入口，bar 狀態限 editor 實例、不保存。
  Node 驗證近零／振盪／小量程電流、零電流帶電電容、窗口峰值、量尺及單位、
  RC實際τ=2s的解析衰減；source／ZIP驗證bar、反向、開關標誌、RC／RL尾段、
  波形與快照不變、手機及既有場／發電機操作。

驗證：29 個 circuit Node 測試檔通過；新 display 測試執行實際 RC 充電6秒後
切換放電，2／6／10／20／40秒 U/I 與解析解一致（電壓誤差 <10⁻⁶ V）。
RC 40秒原始 U≈1.175×10⁻⁸ V、I≈−5.876×10⁻¹⁰ A 仍保留，顯示副本
U/I/q/E 為零。source／ZIP 場／bar **170** 項、scope **194** 項、DC共用操作
**70** 項通過；包含 N/S／電荷不受開關影響、RC/RL尾段無場線／流動箭頭、
近零後恢復、I=0帶電電容仍有場、快照與波形不變。已檢視桌面、手機及
尾段截圖。syntax／manifest／diff 通過；四個 circuit ZIP 與全站 SCORM 包
重建核對。證據：`output/ac-baseline/ac-field-bars-*.log`、
`dc-field-bars-regression.log`，以及 `output/playwright/circuit-ac/*bars-tail.png`
及 `source-field-inductor-large.png`。未重跑已記錄的全站 2 Hz 燈泡阻塞；
真手機／Moodle gate 維持未驗收。

### 固定範圍的場線疏密（2026-10-10）

- 使用者指出前版場線組收密時整個場亦縮小；最新要求以固定場範圍為準。
  保持電容 y=±20、發電機極間 y=±16，以及電感內部 y=±16、外部 y=±45。
  強弱只改範圍內均勻場線間距；最外位置／器材尺寸不變。均勻間距與固定
  範圍意味可見線數會隨疏密調整，取代前版的固定線數約束，不再聚束到中央。
- 電容／發電機用整段等分，電感用相同外圍曲線包絡內的嵌套閉合線族。
  間距按原相對場強分級，所有可見線色深與粗幼一致；零／未知隱藏，反向
  只改方向。圖仍為定性相對場強，不改權威求解器、快照、依賴或評分。
- 發電機預建足量 SVG 節點，B 改變時更新位置及可見狀態，不重新建轉子。
  原相位、固定端子及遮擋層次維持；線圈旋轉不改極間場疏密。
- Node 驗證弱／強场線包絡完全相同、均勻間距變小、電感不相交與入口、
  零／未知／反向；source／ZIP 驗證實際 path bounding boxes 固定、主畫布
  與觀察同步、播放時密度變化、B 更新、手機操作及對照 SVG／PNG。

驗證：28 個 circuit Node 測試檔通過；固定範圍場觀察 source／ZIP **128** 項、
發電機回歸 **72** 項通過；syntax／manifest 及 diff 通過。Node 對全組曲線
取樣驗證相同包絡；browser 用實際 getBBox 比對，容許 10⁻⁴ SVG 單位的
float32 捨入誤差。動態取樣由播放前開始，覆蓋初始弱場及後續密度級別。
已檢視新的弱／強場 SVG／PNG；四個 circuit ZIP 統一重建核對。證據：
`output/ac-baseline/ac-field-coverage-*.log`、
`output/playwright/circuit-ac/source-field-coverage-comparison.svg` 及同名 PNG。
全站既有 2 Hz 燈泡阻塞與真手機／Moodle gate 維持下方歷史記錄。

### 固定場線組的動態間距（2026-10-10；已由固定範圍版取代）

- 使用者要求保持線數，以場線間距表示強弱。取代上一輪以 opacity 表示強弱
  的方式：電容固定五條、電感固定六條閉合線、發電機固定七條極間線；非零
  已知場保持相同色深／線寬。零或未知場隱藏，反向只改箭頭／極性。
- 採連續有界間距，強場收密、弱場拉開，不量化角度或跳換線數。電容按 U
  表示相對電場（極板間距仍是定性畫法）；電感按 |I|√L 表示固定磁路的相對
  磁場，發電機按設定 B。固定場線組為局部取樣，未畫線處不代表無場；不把
  聚束圖當成完整截面場強分布或聲稱精確 SI 場強。
- 電感外部與內部間距共同變化；仍穿過 x=±40 的筒身中央，路徑不相交，
  內部保留固定較暗虛線表示遮擋。發電機保持 N→S 及僅極間場，更新 B
  必須更新靜態場線座標與深度次序，線圈角度不改極間場強。
- 範圍為繪圖／觀察層；評分、依賴、持久化、權威快照與求解器均無新欄位。
  Node 驗證固定數量、間距單調／連續／有界、同強弱下色深相同、反向、
  極間範圍及各強度閉合線不相交；source／ZIP 驗證主畫布和觀察同步、
  播放時間距逐幀變化、同角度改 B 生效及既有手機／觀察操作。

驗證：28 個 circuit Node 測試檔通過；間距／場觀察 source／ZIP **128** 項、
發電機回歸 **72** 項通過，syntax／manifest 及 diff 檢查通過。四個 circuit
成品由統一 builder 重建核對；比較 SVG／PNG 已輸出並檢視，電感閉合線
在各強度下不相交，所有發電機場線及箭頭均留在相向兩極高度內。證據：
`output/ac-baseline/ac-field-spacing-*.log`、
`output/playwright/circuit-ac/source-field-spacing-comparison.svg` 及同名 PNG。
本輪只跑相關 gates；下方已記錄的全站 2 Hz 燈泡阻塞及真手機／Moodle gate
狀態維持，沒有放寬斷言。

### 電場／磁場觀察重設計（2026-10-10；以下為疏密改版前證據）

- 修正 `.ac-field svg` 誤套數值 MathJax SVG 的寬高，圖形只用具名 diagram
  class；數值沿用共享量綱排版，以正常大小的讀值列呈現。
- 畫布場線開關保留，面板的重複圖形／解釋改為預設收起的觀察區。按「放大
  觀察」打開可關閉的原生 dialog；手機內容自然捲動，44px 關閉／播放控制。
- 電容：依使用者最後要求，只畫兩板之間正→負的均勻電場，以五條等距平行
  場線表示，不畫邊緣彎線。放大圖使用剖面，保留原圓極板、C 對應畫面間距
  及 q=CU 的原始電荷模型；反向電壓同步反向。
- 電感：如通電螺線管／條形磁鐵的六條閉合磁場線，左端穿入筒身中央；場線
  不依可見繞線跨度提早折返。外部實線放在器材後方，內部用較暗虛線表示
  遮擋。按右手規則判定 N／S，過零時減弱，反向時對調。Node 取樣檢查
  閉合路徑不相交、入口及虛線；另列 `−(u−Ri)` 自感電動勢。
- 發電機：只畫 N、S 極間的平行磁場；不畫外圍場線或外側磁極。保留線圈
  法線及面積投影，永磁場方向固定 N→S，B=0 不畫場線；旋轉、磁通及
  電動勢用同一 analysis。放大視窗桌面圖文並排、手機上下排列。
- 場圖為定性方向／相對強弱示意；不把 lumped C／L 或 SVG 尺寸當成已求解的
  三維場強。沒有新增物理狀態、時間、評分、快照或手勢；renderer／觀察層負責。
- 新 field-graphics 共用模組列入 AC runtime／兩入口及 ZIP。Node 驗證正負／零／
  未知、場線方向／閉合及數據不變；source／ZIP 驗證正常讀值尺寸、收起／展開、
  dialog、320px 手機捲動、場線開關、可信操作和反向／逐幀同步。

本輪驗證：28 個 circuit Node 測試檔通過；source／解壓 ZIP 場觀察 **88** 項、
發電機 **72** 項通過。場圖包含極性反轉、零／未知場、左端中央入口、內部
虛線、無電容邊緣線／發電機外圍線、solver 同步、數字尺寸、320px／390px
原生 dialog 及可信觸控捲動，並檢視三種器材大圖與手機截圖。先前同輪的元件
回歸 **270** 項及示波器 **194** 項亦通過。syntax／manifest 及 diff 檢查通過。
證據：`output/ac-baseline/ac-field-gap-bore-*.log`、`ac-field-reactive.log`、
`ac-field-scope.log`。全套 `npm test` 已重跑，仍在基準既有的 2 Hz 燈泡亮度
測試失敗（最暗值／亮度階數未達原門檻；未改鬆斷言），記錄於
`ac-field-npm-test-final.log`。真手機及 Moodle gate 未驗收。

### 發電機圖形重設計（2026-10-10；基準 26ad63d）

- 使用者批准將 SVG 預覽整合進工作台，要求 N／S 對齊。固定斜投影採
  `x=x₃+0.38z₃, y=−y₃+0.28z₃−8`，不以 x₃ 改變畫面高度；兩極
  尺寸／深度／高度完全相同，整件旋轉後亦沿同一軸對齊。
- 元件沿用 bounds ±48／±42、a=(-60,0)、b=(60,0)。兩條固定導線分別
  連接電刷／完整滑環；轉子是剛性圓角矩形繞組，少量可見匝數僅作示意。
- 法線 `n=(cosθ,sinθ,0)` 採繞組 B→A 定向；可見旋轉與 source 的 a−b
  電動勢同號。以兩個正／負半週的 `(v×B)·dl` 獨立積分校對端子方向。
- `circuit-generator-graphics.js` 共用純幾何／SVG 與局部 DOM 更新；畫布和場
  面板共用。新增檔案在兩個 AC HTML 入口先於 AC components 載入，列入
  ac-runtime-assets 及 standalone assets。DC 及評分／快照契約不變。
- 每個 RAF 讀當前權威 analysis.phase（參數預覽則讀既有獨立副本），不另推進
  角度、不插入假時間。全場景仍按既有節流更新，只局部更新發電機繞組及場圖。
  暫停／只讀／拖移凍結、¼速、重設及 restore 沿用既有 session。
- 驗證決策：純幾何完整角度掃描、磁極實際投影對齊、有限值及匝間／引線連續；
  production source／解壓 ZIP 檢查逐幀角度與 analysis 同步、固定端子、暫停、
  ¼速、參數預覽、符號／實物、場圖、元件旋轉及手機可信操作。重建四個電路包。
  真 Moodle／實機及全站既有阻塞另外記錄，不以本地證據代替。

#### 本次實作與驗證

- branch 由 4f7c039 fast-forward 至 GitHub 的 26ad63d，再實作本次圖形；
  最新 commit 的觀察峰值／能源顯示保留。
- 最終 27 個 circuit Node 測試檔通過；新 geometry test 掃描 361 個角度，
  驗證剛性、磁極對齊、連續匝間／引線、完整滑環、固定端子及兩半週端子相位。
- source／解壓 AC ZIP 專項 72 observations 通過。1.1 秒取樣各 67 個 RAF
  畫面，畫布／場圖角度均等於權威 analysis.phase，端子座標只有一組；暫停、
  ¼速、restore、只讀、四方向旋轉、實物／符號、場開關、參數預覽／取消，以及
  390×844／320×500 的可信觸控與排版通過。已檢視實際工作台截圖。
- 課堂預設 source／ZIP 618 observations、DC 共用操作 70 observations 通過。
  四個 circuit 包與 `package:all` 重建／逐檔驗證，`npm run check`、diff check 通過。
- 總 runner 發現上一 commit 的舊 tiny-current fixture 只按瞬時值斷言歸零；
  原始 26ad63d 在同一行失敗。測試改為先驗證觀察窗仍有峰值時保留呈現，再
  前進完整 period 驗證隱去且原始電流仍非零，沒有放寬產品的整窗規則。
- 修正後 `npm test` 在原有 2 Hz 燈亮度斷言停止：minimum 約 0.1068，
  既有門檻要求 <0.08，兩位小數的亮度種類為 10、門檻要求至少 12。
  原始 26ad63d 的 `--realtime-smoke` 同樣失敗；未修改燈光模型或降低門檻。
  **總 suite 未全過，不宣稱全站綠燈或本次完成所有 package-ready gates。**
- 證據：`output/ac-baseline/ac-generator-node-final.log`、
  `ac-generator-browser-final.log`、`ac-generator-preset-browser.log`、
  `ac-generator-dc-browser.log`、`ac-generator-npm-test-final.log`、
  `ac-generator-head-browser.log`、`ac-generator-head-realtime.log`、
  `ac-generator-package-all-final.log`、`ac-generator-check-final.log`。
  真 Moodle／實機未重新驗證。

2026-10-09：使用者批准 A0–A6 實作。沿用 `codex/circuit-platform-dc-scorm-plan`，基準 `f7912e2`。
依 [共用產品規則](00-shared-platform-and-style.md)、[production guide](../docs/simulation-scorm-production-guide.md)、[活動作者指南](../docs/circuit-activity-authoring.md)及[架構說明](../docs/circuit-workbench-architecture-review.md)實作。本計劃由 [activity template](NEW-SIMULATION-PLAN-TEMPLATE.md)各決策節點填寫；共用契約不在此另訂例外。

## Scope

| 決策 | 規格 |
|---|---|
| Slug／目標 | `circuit-ac-workbench`；中學交流、有效值、電容／電感、自感／互感、變壓器及 LC 振盪 |
| 交付 | 非評量教師工作台、可配置核心、兩個無評分嵌入示例、standalone ZIP；正式 AC SCORM 題目及 rubric 另議 |
| 教材 | 人教版高中選擇性必修第二冊，印刷頁 40–43、49–62、71–75；本地 Textbooks 原 PDF 已讀 |
| 操作 | 自由取物、接線、調參、播放／暫停／¼速、瞬時與窗內量測、浮動波形／探頭、能量及場示意；單步／reset僅保留API |
| 共用核心 | `CircuitEditor.mount`；不複製 DC editor。共用接線、拖放、吸附、權限、有限導線、實物／符號及 renderer |
| 依賴 | 原生 HTML/CSS/JS/SVG/Canvas；沿用本地 MathJax、styles、fullscreen，不引入新 runtime library |
| Assessment risk | N/A：本次沒有學生評分；後續活動需自己的 assessment risk／rubric／codec／SCORM manifest |
| 不包含 | 家庭、高壓輸電、整流／濾波、完整相量、三相、調諧、磁芯飽和／磁滯／鐵損、火花及燒毀 |

## Catalogue metadata

以 [`sim/config.js`](../sim/config.js)的實際條目為準：`title:'交流電路工作台'`、`folder:'circuit-ac-workbench'`、`categories:['Electricity']`、`description:'搭建交流、電容電感與變壓器電路，觀察波形、有效值及能量交換。'`、`tags:['physics','electricity','ac','capacitor','inductor','transformer','workbench']`、`status:'active'`。active為目錄入口狀態；發布驗收另依實際gate及版本證據判斷。

## Architecture and public interfaces

- `analysis:'dc'|'transient'` 是可信 mount 配置，預設 dc。所有讀值、check、probe、renderer、hazards 路徑使用選定後端；DC 方程及預設不重寫。
- v1–v6 繼續遷移至 v6／匯出 v6。AC v7 帶 `analysis:'transient'`、`modelRevision:1`；初始 C 電壓及 L 電流是元件參數，目前時間／狀態另存。
- DC 拒絕 AC 文件。AC 顯式將支援的 v6 文件轉為 v7；不支援元件完整拒絕，不能自動刪除。無全域分析模式。
- `getAnalysis()` 不推進時間。提供播放／暫停／倍率及受權限控制的單步／reset API（不再有內建實驗操作區）、`captureSession()`／`restoreSession()`、獨立分析訂閱與活動 panel 插槽。
- 時間求解器同時提供 instance session 與確定性離線 events/until 運算，兩者共用積分程式。
- AC 配置覆蓋模型／款式／數量／參數／操作、播放及量測通道；UI、命令、鍵盤、匯入與 restore 共用驗證。
- 保留近期 DC 改進：滑片數字即時更新、滑鼠／筆 palette／取線拖放、未接物件回 panel／垃圾桶、符號名稱。
- renderer 使用後端 hazards；DC series／sliderEffect 保持 DC 範圍，純導線連接檢查可用於 AC。

## Physics or subject model

| 元件／狀態 | 方程／規格 | 單位／預設 |
|---|---|---|
| AC source | 正弦、對稱方波、對稱三角波；輸入有效值換算各波形峰值；可調初相位及內阻 | 6 V rms、1 Hz、0°；工作台 f 0.1–2 Hz 或 50 Hz，數值核心仍保留 0.1–1000 Hz |
| Generator | θ 隨時間；Φ=BS cosθ 為單匝磁通量；e=NBSω sinθ；轉速同時影響振幅及頻率 | SI；原生 SVG，外界保持轉速 |
| R／rheostat／wire | 沿用阻值及端子語義；幾何不是物理電阻 | Ω；不變更 DC schema |
| Lamp | 恆阻燈，功率驅動亮度；不拿 DC 熱平衡當熱瞬態 | 額定參數沿用現有 |
| Capacitor | i=C du/dt；q=Cu；W_C=½Cu²；狀態u；繪圖不是物理板距 | 0.02 F，初始u=0；教師常用0.01–0.2 F，數字欄最低0.0001 F |
| Inductor | u=L di/dt+Ri；W_L=½Li²；狀態i；R=0支援理想LC | 1 H，初始i=0；教師常用0.5–10 H，數字欄最低0.05 H |
| Switch／SPDT | 離散事件，SPDT 不能同時接通兩邊 | boolean／兩個接點選擇 |
| Ideal transformer | 電壓比等於匝數比、電流反比、功率守恆；隔離／純交流；交變磁通由U₁/N₁時間積分及零平均週期重建 | N₁:N₂=200:100；不計磁化電流／儲能 |
| Coupled transformer | M=k√(L₁L₂)，L₂=L₁(N₂/N₁)²；k<1；共同磁通kL₁(I₁+N₂I₂/N₁)/N₁，漏磁圖省略 | L1=2 H、k=.999、R1=1 Ω、R2=.25 Ω |
| LED | 正向壓降＋有限導通電阻，反向截止；反向並聯顯示方向 | 教學近似，沒有擊穿模型 |
| AC A/V/W meters | 有效電流／有效電壓／平均有功功率，數字與指針目標同一統計；A/V換孔不改RMS，W反接一組改功率符號 | 30格；W正負各30；正常不顯示窗起止，未接／收集中不假零 |
| G meter | 有方向的瞬時電流，指針平滑只作呈現 | A，介面 μA |

線性線圈不模擬飽和、磁滯及鐵損；不把效率直接乘電壓。互感斷電預設含可見放電支路。理想變壓器遇直流激勵明確停止並提示改模型。

### Integrator and failure policy

修正節點分析；平滑處梯形法，事件後短暫 backward Euler 再回梯形。自適應步長／step doubling，週期及自然變化尺度限步，波形跳變與操作事件為 breakpoint。拓撲編譯只在電氣變更時重建。初始條件明確，不把零初始瞬態當穩態。

物理時間與 RAF 分開；單幀運算設 budget，忙時放慢時間而非跳步。未知／浮接／不唯一保留 null。矛盾理想源、帶電 C 理想短接、帶電流 L 無通路及數值失敗保留文件、凍結事件時間並診斷；不暗加電阻、清能量、裁剪電流。無損受迫共振可增長，不能用假耗散壓平。

### Editing and time transitions

| 操作 | 物理處理 |
|---|---|
| 暫停／只讀 AC | 物理時間凍結，仍可移圖／縮放／量測 |
| 倍率 | 只改牆鐘對模擬時間比例，不改 f |
| switch／R／振幅／f | 事件時保留 C voltage／L current；改 f 保留相位連續 |
| C／L／N／k／初始值 | 新實驗，回 t=0 並提示 |
| 新增／刪除／重接 | 新電路回初始條件；移動／旋轉／彎線不重設 |
| preview | 主狀態停步；副本計算與即時數字；取消還原，release 才 onChange |
| undo／redo | 編輯事件對應 document＋physics snapshot，還原後暫停；不逐時間步入 history |
| 背景／恢復 | 不補追離開時間；恢復保存瞬間後暫停 |

### Measurement and visual observations

接受時間步的取樣積分∫u²dt、∫i²dt、∫uidt，產生RMS、平均功率及完整窗峰值，不能由RAF抽樣。峰值/√2只適用正弦。正常面板不顯示窗起止時間，資料不足標收集中；改條件／restore重新收集。相位運算保留在底層，沒有常駐相位或游標介面。

最多四部浮動儀器（教師預設兩部），依元件能力／可信通道選voltage、current、charge、energy或發電機flux；兩端電壓探頭須在同一電氣島。共用時間窗、各自單位與Y量尺；軸及探頭有方向鍵／Home／Enter替代，沒有兩游標。Trace保留1000秒／8192歷史格及1025顯示格，保留峰值／缺口，未收集區空白；UI配置與歷史不進session。變壓器coreFlux另為只讀觀察量，不自動新增flux波形通道。場、電流及發電機角度同一物理時間；電子不穿過C介質。

## Responsive layout contract

| 決策 | 規格 |
|---|---|
| 三區 | Header：title/presets/fullscreen；stage：電路／波形；panel：工具、參數、量測、外層插槽 |
| 桌面 | ≥760 px；stage左、panel 252px右（短橫向230px）；波形為可移動小圖，不預留固定1/3區域 |
| Phone | 上stage、下bounded panel；電路與浮動圖框共存，小圖可收起或開大圖。共通控制沿用 DC 的位置與窄畫面排列；stage 保留至少 75px 畫布，短畫面讓獨立捲動 panel 讓出高度，按鈕仍為 44px |
| Bounded shell | 100dvh，min-height:0；html/body 沒有競爭 scroll；panel overflow-y:auto/overscroll contain |
| Fullscreen | 整個活動唯一 target/header、shared script；外層有 header 時內層 ui.header=false |
| 文字／按鈕 | Traditional Chinese、主控制 16px、圖形放大可讀、44px target；狀態亦有文字 |
| Viewports | 1280×800、768×1024、390×844、320×500、844×390、500px iframe、200% zoom |

## Navigation, submission and reset

教師主題預設分組並可獨立切換，保留手動播放／顯示選項，載入新電路重建初始狀態；reset API保留搭建但回初始值，沒有內建reset按鈕。Standalone refresh fresh。check/submit/rubric/recorded lifecycle **N/A：非評量工作台**。活動插槽不提供分數；正式活動後續自己的計劃決定 blank／partial／check／review／pending。

## Diagrams, notation and assistance

SI內部數值，方程u/i/q為有號瞬時量；UI的U/I依標籤指當刻量，有效值明示U_rms/I_rms。W_C/W_L為儲能，Φ與NΦ分開；變壓器N₁:N₂上方比例、coreFlux為共同磁通。正方向端子 a→b；耦合線圈同名端明示，跨隔離任意 reference 的電壓未知。使用共享數學字型與格式。

接孔吸附沿用現有 24 CSS px、component snap 既有幾何；不是評分容差。手指 wire-end 精準接孔需放大預覽；粗元件搬動／按鈕／range 不需放大；波形探頭、圖框及軸操作提供keyboard替代，沒有舊游標控制。不新增旋轉線圈自由 3D 手勢。

## Touch gesture ownership contract

| Target／mode | 規格／owner | Keyboard alternative |
|---|---|---|
| component／wire end／wire body／rheostat | 現有 stable hit capture、none；操作 owns gesture，viewport fixed | 現有選取／方向鍵／commands |
| palette／take wire | 滑鼠／筆 drag；touch click／panel pan-y | button click |
| SPDT | local button hit、44px；event only一次 | Enter／Space |
| 波形探頭／圖框／軸 | 44px命中及stable capture、操作面none；其餘canvas／框pan-y | 方向鍵、Home、Enter／雙擊合法測點 |
| panel | panel only，兩端不串到 host | tab／原生 scroll |
| left/right strips | 各≥32 CSS px，不被 graph 蓋住；native host pan-y | N/A |
| blank stage outside manipulation | native enclosing owner | N/A |

| Host | 實際owner／strategy | Evidence |
|---|---|---|
| T0 | bounded workbench；無host range時N/A，不偽造捲動 | 歷史A2–A5有本機證據，最新未全矩陣重跑 |
| T1 | scrollable outer window → iframe | 歷史A2–A5有本機證據，最新未全矩陣重跑 |
| T2 | outer window → fixed wrapper → iframe | 歷史A2–A5有本機證據，最新未全矩陣重跑 |
| T3 | bounded windows，overflowing owner element → iframe | 歷史A2–A5有本機證據，最新未全矩陣重跑 |
| T4 | 真 Moodle 及真手機 owner 實測 | 待外部環境，不能用本地替代 |

running/paused/preview/diagnostic/readonly，real/symbol、儀器開／關／收起／放大 均要 legal fixture，操作後記錄時間狀態及 scroll owner。所有 targets、strip兩方向、panel邊界、快速滑動、取消及 resize 依 production guide。

## Scoring and tolerance

Rubric/pass/分數／提交 **N/A：教師工具及無評分教學示例**。物理解析誤差≤0.5%（近零絕對電壓1e-6 V／電流1e-9 A）；理想 LC 100周期能量漂移≤0.5%；與未來評分容差分開。

## Phase/state matrix

| State | 必須保留 | 合法續作 |
|---|---|---|
| blank／partial wiring | v7 doc，初始 states，未知讀值 | 取物／接線／保存／load |
| running／paused RC/RL | t、source phase、C u／L i／數值歷史 | 改 R／switch／advance |
| LC quarter／SPDT前後 | q/i polarity、energy、switch contact | 續算／切換，unsupported保留diagnostic |
| mutual transient | both winding i、phase、coupled history | 有放電支路的 switch event |
| preview | authoritative snapshot 不改 | cancel／release |
| diagnostic | 合法 doc、事件時間、last continuous states、診斷 | 修正參數／接線／reset，不能假零讀值 |
| embedded readonly | frozen doc＋time | 縮放／view／probe，不推進 |
| restored | 同一 doc＋t＋physics，暫停，measure collection fresh | 同 production command 合法續作 |

## Persistence contract

教師 document 256KiB 限制，manual import/export，無 localStorage 答案。Session envelope `{kind:'simlab-circuit-session',version:1,modelRevision:1,document,physics}`；physics exact keys 為 `time,step,sources,dynamic,work,dissipated,event`；sources 是 ID→目前弧度，dynamic 是支路 key→`{i,v}`（C u/i、L i/電感電壓、coupled winding i/u）。keys 與當前 doc 的元件完全一致；finite、range、數值及歷史相容、model revision、doc 及 profile 全驗證，原子 restore。preview／camera／DOM／particle／full ring buffer不保存；統計恢復後收集中；理想coreFlux觀察器亦重收集一個週期，耦合共同磁通從保存的線圈狀態重建。

**未來 SCORM**：活動自己定definition/model epoch、精簡固定模板 codec、null answers、snapshot three byte gates與 rubric。動態時間評分用固定初始條件／事件／窗口重算。核心 session不是任意電路≤4000bytes承諾；兩技術示例量測 compact必要動態欄位以證明可做活動。Pending/review時間必須凍結；演示playback另用副本。

## Shared SCORM lifecycle

N/A：AC工作台及兩個示例沒有已評分SCO或raw LMS handling。後續正式AC活動沿用SimScorm／SimActivityFlow全outcome；DC串聯／滑片評量已在自己的外層及rubric實作，AC不改其題目、分數或保存。

## Implementation stages

| 階段 | 出口 |
|---|---|
| A0 基準／接口 | 保存DC presets document/analysis/hazards/SVG及23測試；v6維持，analysis guard |
| A1 時間核心 | R/C/L、SPDT、adaptive integration、events、energy、snapshot、離線運算，解析驗證通過 |
| A2 交流工作台 | editor、AC meters、waveform、time、panel slot、bounded layout |
| A3 變壓器 | ideal＋coupled、isolation、load、DC通斷互感 |
| A4 教材預設 | 四組14主題＋空白，穩定key／清楚名稱；generator/LED/field/energy聯動 |
| A5 嵌入／恢復 | fixed transformer params＋fixed LC SPDT兩個無分數示例；權限／合法續作／多instance／只讀 |
| A6 發布 | 中央assets、AC standalone ZIP、三DC包重建、source/package、文檔及catalogue |

## Test plan and evidence

下列勾選是已記錄階段的歷史執行證據，對應日期／基準及下面日誌；不表示最新版全套重新通過。最近專項及未完成gate以本文件開頭和[精準驗證指引](../docs/circuit-ac-workbench.md#精準驗證與維護)為準。

- [x] RC/RL解析及switch連續性；R/RLC正弦、相位、三種RMS與平均功率。
- [x] LC100周期能量；damped/critical/overdamped；離線與分段、不同幀率／倍率同t狀態一致。
- [x] ideal transformer ratios/power/load；coupled directions/DC steady/energy/isolation。
- [x] generator phase/N/B/S/f；LED polarity；unsupported impulses／contradictory sources／unknowns不假讀值。
- [x] 所有 state matrix row session round-trip後執行合法續作；壞 keys/numbers/revisions/profile 原子拒絕。
- [x] 原DC全部circuit單元、完整source/package teacher及兩DC活動相鄰回歸，與baseline同源比對。
- [x] AC source/package desktop/mobile/short iframe/200% zoom，T0–T3可信gesture／fullscreen／panel／strips。
- [x] check、runtime syntax、dependency manifest／assets完整、ZIP逐檔byte／hash。
- [ ] 真Moodle／實機（外部gate；尚無環境，不宣稱Moodle-ready）。

## Implementation record

本節為2026-10-09至10的歷史實作與驗證；有些UI、預設及codec已由近期記錄取代。原始數字與舊描述保留以交代當時驗證，不當作目前規格。基準／log在ignored `output/ac-baseline/`，近期圖像／專項在 `output/playwright/circuit-ac/`；ignored檔案不保證其他機器存在，記錄須註明實際版本及限制。

### A0／A1 核心驗證（2026-10-09）

- 變更前 23 個 circuit Node 測試通過；14 個 DC 預設的文件、分析、hazards 及完整 scene SVG hash 已保存。
- v7／analysis guard、交流元件及純時間 solver 加入後，14 個預設逐項比對不變，全部舊 circuit Node 加新 transient test 通過。
- production Session 驗證 RC/RL 指數、LC 四分之一週期／100週期能量、分段時間、阻尼／臨界／過阻尼、三種 RMS／平均功率、C/L相位、ideal/coupled transformer、隔離、通斷電互感方向、SPDT charging→LC、LED／generator、快照及不可靠解。
- 修正方波 breakpoint 的浮點相位歸零及來源內阻功率符號；不放寬解析容差。
- 此時僅核心及 Node gate；交流 UI、browser／package 及外部 gate 仍未完成。

### A2–A5 完成及修正（2026-10-09）

- 同一 editor 接入 transient session、控制／數值預覽、事件 history、原子 session restore、analysis 訂閱及 panelContent。已提供 16 個可編輯預設（五組主題及空白），兩個固定 student 配置示例、四通道波形／雙游標、RMS／平均功率、場及能量。
- 普通 AC source 可設 0–1000 V rms（包括課本 220 V 例子），f 0.1–1000 Hz。Source／C/L／coupled 的參數及動態模型仍明確與 v6 DC 分開。
- 燈的呈現採 20 ms 平均功率；AC 警示採完整週期平均，避免額定正弦峰值誤報。DC 自感的短時亮度仍能呈現。電容耐壓繼續按瞬時電壓。
- 恢復保留平行 C 等代數瞬間未唯一決定的導數歷史，以附加歷史約束重建讀值；加入平行 C／帶電流 L+LED 的 restore／續作測試，不把歷史清零。資料不足的游標不取未計算時間的假數值。
- 32px 波形左右區避開游標 halo；640×400／DPR2 作 200% 等效版面檢查。Headless CDP 退出 native fullscreen 後重設宣告 viewport，再進行座標触控驗證，避免 compositor 使用退出前的縮放；這是測試 fixture 處理，不是 app scroll bridge。
- 完整 AC source／實際解包 **604 observations** 通過：六 viewport、RMS、播放／暫停、實物／符號、游標、palette／C body 可信輸入、SPDT 正常與空斷診斷、range preview/Escape/release、restore／非法原子拒絕、readonly、兩配置、T1/T2/T3 canvas＋graph 原生 owner、running invariants、fullscreen 允許／拒絕／unsupported；runtime exception 為零。額外驗證同頁 DC＋AC 及兩個 AC 的獨立時間、文件、參數及 destroy；截圖已檢視。
- 全部 **25 circuit Node 檔**及 helper tests 通過；14 DC preset document／analysis／hazards／完整 SVG hash 再次對照 A0 完全一致。DC 全套 teacher source/ZIP **4986**、focused quick controls **70**、embedded core **66**、原兩個 SCORM source/ZIP **842** observations 通過。完整套後的 AC opt-in／range guard 變更另以最後 targeted suite 複核；不把早期大套證據當作未來變更自動通過。
- 可信輸入找到共有的 Escape 後 detached range 在 release 再提交問題；共用 input/change handler 拒絕失效／已取消預覽，DC 和 AC 同改一次。已有兩側 production browser assertion。
- Windows DevToolsActivePort 暫時 EBUSY 改為原 bounded startup loop retry；其它錯誤仍 throw，helper 單元驗證 EBUSY→success 與 EACCES→reject。
- 固定模板 production codec 已用實際 shared makeSnapshot／pending 封套形狀量測：transformer sample draft/review/pending **335/361/546**；LC **294/320/508** bytes。另執行 transformer 2／LC 6 個實際 phase variants（包括充電、切換、quarter／half），最長 compact session 分別 **256／344** bytes，decode/restore後合法續作。這些是技術容量證據，沒有產生評分活動。
- `npm run check`、34 個新文檔 local links、diff check 通過。`npm test` 已執行，新 AC／原 DC SCORM 等前段通過後進入重複的 teacher 大矩陣；該矩陣先前完整4986及最後70/66已獨立通過，本次主動停止這段重複 aggregation，沒有把取消記為通過或新產品失敗。
- 直接接續總 runner 在 circuit 後、已知 blocker 前的8個 Node groups（牛頓測試版及shared fullscreen）通過；`scorm-fullscreen-browser-regression.js` 的source/package native／iframe／policy／SCORM，以及全站 `fullscreen-rollout-browser-regression.js` source/package 均通過。
- 現版直接執行 `newtons-third-law-fullscreen-activity-regression.js --smoke`，仍在第132行 `assert.ok(r.stage>=195)` 失敗（exit1）。Newton兩入口、該runner及shared/styles與基準f7912e2無diff；原計劃29第17.2節已有更早修改前同一失敗證據。**總 suite 沒有完整跑完，不宣稱全站綠燈。** 記錄：`output/ac-baseline/npm-test-final.log`、`newton-final.log`、`shared-fullscreen-final.log`、`fullscreen-rollout-final.log`。

### A6 本地發布及外部 gate

- `npm run package:circuit-platform` 重建四包：DC teacher 29 檔、AC teacher 34 檔、兩 DC SCORM 各34檔。每包21共用檔及全體 runtime byte 與來源相同；AC 六個可選依賴另列，無核心副本。指紋在 `output/circuit-platform-build.json`。
- AC catalogue 已通過本地 package-ready 並設 active；README／production guide／作者指南已更新四包維護流程。
- AC ZIP 用 File resource、主檔 `circuit-ac-workbench/index.html`，沒有 assessment manifest。正式 AC rubric／SCORM activities 依使用者安排另議；D3/D4 prototype 教學版面完善亦不是本次新增範圍。
- 真 Moodle／真手機 T4 未有環境，未標記 Moodle-ready。完整外部 fullscreen／native scroll、低風險正式活動的記分／續作／pending／review仍須各自驗收。
- 此版按 A0/A1、A2–A5、A6 分階段提交並 push。最後 release verification 在 `output/ac-release-verification.json`：25個circuit Node、604個AC browser observations、四個套件、21共用及6個AC擴展檔案的SHA與source/ZIP逐檔byte核對；文檔提交不冒稱新的runtime執行。

### 共通控制欄位置修正（2026-10-09）

- 按使用者回饋，移除 AC 將共通按鈕搬入「更多」的 DOM 操作，以及頂欄／底部操作的獨立排列覆寫。DC／AC 直接使用同一 template 與容器寬度規則；旋轉、複製、刪除與相機在底部，復原與文件工具在頂欄，接線／手掌／播放在畫布上方。
- 波形開關放在交流量測面板；時間、波形及場／能量仍為 AC 額外工具。短畫面依可用高度分配畫布與 panel，不以隱藏共通操作或縮小觸控目標換取空間。
- 完整 AC source／ZIP 回歸 **688 observations** 通過，新增共通 DOM 位置及可信旋轉／縮放／復原斷言。其後補上波形「返回電路」，避免 panel 收起時無法切回；最後六 viewport 的 source／ZIP focused 回歸 **348 observations** 通過，包含 panel 隱藏後返回及動態狀態不變。
- `npm run check`、transient 解析測試及 AC profile／codec／合法恢復測試通過；四包已由統一 build 重建並逐檔核對。這次未改 DC 的 editor／template／CSS 或物理核心。證據：`output/ac-baseline/ac-toolbar-followup.log`、`ac-toolbar-final.log`；既有全站及外部 gate 狀態保持。

### 交流元件實物外觀修正（2026-10-09）

- 按使用者回饋，十種 AC 元件分開實物及符號繪圖：電源器材／正弦源、磁極轉子／發電機符號、無極性電容／平行板、繞線線圈／電感、雙擲器材／接點、鐵芯雙繞組／變壓器、LED 封裝／二極管，以及三種交流錶盤／儀表圓圈。
- 不移動元件端子，不改 transient 方程或時間狀態。AC 器材本體按已有 bounds 計算可點選範圍，轉向後仍可選取；DC 元件的命中規則保留。
- 燈光沿用已有平均功率顯示，新增實際求解驗證：3 V／6 V 對應不同亮度、功率約四倍；50 Hz 跨相位亮度穩定、1 Hz 過零／峰值亮度不同、零供電不亮。
- 完整 AC source／ZIP **796 observations** 通過，包含十種元件的兩視圖、本體可信點選、時間不自行演進及各預設的既有操作／恢復／多 instance／gesture regression；實物與符號 contact sheets 已逐一檢視。
- **25 circuit Node 檔**、`npm run check` 及 DC source／ZIP focused 快捷操作 **70 observations** 通過；四包已統一重建與來源逐檔核對。證據：`output/ac-baseline/ac-apparatus-browser.log`、`dc-apparatus-followup.log`，圖在 `output/playwright/circuit-ac/*-apparatus-{real,schematic}.png`。未改物理模型或文檔版本，全站／Moodle／實機 gate 狀態保持原記錄。

### 低頻、真實時間及面板打磨（2026-10-09）

- 使用者指定常用頻率 0.1–2 Hz、另設 50 Hz 真實交流。預設普通源 1 Hz、generator 2 Hz；頻率控制 metadata 統一滑塊、快捷步進及編輯 transition，非法 2–50 Hz 間值拒絕。原模型的 SI／離線數值範圍與已保存文件不做靜默改寫。
- 工作台設定倍率固定 1；移除原自動 1/100 速。求解時間按前台真實 elapsed 推進，仍限制每幀計算預算及防止背景追算。數值算不及時仍不跳過物理時間步，不承諾任意龐大電路在所有裝置必定即時。
- 燈泡每 RAF 更新，與较低頻的整體 label layout 分開；顯示保留 20 ms 平均功率，交流採連續亮度曲線，避免硬裁剪亮度的平頂。沒有改電路功率、儲能或燈絲熱模型；DC 顯示保留。
- Panel 回到 DC 寬度／breakpoint；移除時間與實驗、預設講解及課堂探索。波形保留配置允許的單步及回到初始條件；教師工作台不提供慢播／倍率。
- 交流 wire-current card 固定幅寬、固定 mA、預留箭嘴空間；過零或未知狀態亦不收縮。DC label 路徑保留。
- 50 Hz 的無儲能電路改用每週期至少 32 步（每步兩個半步取樣），避免對沒有儲能歷史的電路重做完整一步的狀態誤差估計；含 C/L 仍保留原 128 步上限與自適應誤差控制。解析有效值、功率、能量及事件測試保持原容差。
- 發現量測 bin 在浮點邊界會漏掉步進餘段；修正邊界捨入。修改前 120 次 50 Hz frame continuation 有 27 次 displayPower 未能確定，修正後全部穩定，沒有用零或上一個數字冒充未知。
- 實際測量 source／ZIP 的 2 Hz／50 Hz：1.602–1.611 s 實際時間對應約 1.619 s 物理時間；頻率、動態燈光及固定 card widths 的 focused 28 observations 通過。完整 AC source／ZIP **828 observations**、25 個 circuit Node、DC source／ZIP focused **70 observations**、`npm run check` 及四包 source byte 檢查通過。實物／手機／電流卡截圖已檢視。最後只有註解及未使用時間面板 CSS 清理，已重新打包；沒有用早期 ZIP 的 hash 冒稱後來來源相同。
- 日誌：`output/ac-baseline/ac-real-time-focus.log`、`ac-real-time-browser.log`、`ac-real-time-node-final.log`、`dc-real-time-followup.log`。固定 transformer 示例仍保持原 50 Hz 模板，舊 codec 不偷偷換成 1 Hz；正式活動／真 Moodle／實機 gate 仍按既有安排。

### 共用慢速按鈕及預設啟動更正（2026-10-09）

- 使用者澄清：只移除 1/10、1/100 等選單，保留 DC 共用的 ¼ 速慢動作按鈕。移除工作台 rate:false 設定及 AC 將按鈕移出 DOM 的操作；配置禁止倍率時仍保留 disabled 按鈕，不能越權。
- AC 初始播放條件與 DC 對齊，保留系統 reduced-motion 設定；沒有 play 權限的活動仍暫停。切換預設／載入文件保留手動播放狀態，回到初始條件亦保留。切換慢動作或新 session 清空前台排程餘量，避免以舊倍率／舊文件追算。
- 動態快照 restore、undo/redo checkpoint、單步及只讀仍依既有明確檢視／凍結合約暫停。
- 完整 AC source／ZIP **846 observations** 通過；其後重設操作補上排程清零及先 reset 再清波形，最後 focused **52 observations** 驗證自動啟動、¼ 速、無倍率選單、暫停保留、運行中重設及 2/50 Hz 效果。DC source／ZIP focused **70 observations**、AC profile／codec Node 及 check 通過。
- 日誌：`output/ac-baseline/ac-autoplay-browser.log`、`ac-autoplay-final.log`、`dc-autoplay-followup.log`。四包已按最新來源重建核對；原有全站與外部驗收狀態維持。

### 預設電路的緊湊佈局（2026-10-09）

- 依使用者要求，收緊全部非空 AC 預設的元件中心及導線外框，縮短單純串聯的空段，C/L 串聯使用转角、LC 以左側儲能／右側切換配置，變壓器與自感減少上下空白。沿用共用相機及自動適應；AC 自動放大上限由 120% 提高至 180%，DC 保留 120%。器材世界尺寸與工具不變，讓相同畫布能顯示較大的器材。
- 17 個預設對照修改前：元件 ID／種類／params、導線 ID／from／to／resistance，以及 t=0.1 的完整 physics snapshot 均完全一致。只是初始幾何，沒有更改電學或既有匯入文件。
- 固定嵌入示例的外層 codec 升至 version 2，拒絕舊固定模板，避免靜默重排；modelRevision、完整 document／session 格式不變。
- 完整 AC source／ZIP **854 observations** 通過（包含 desktop scale>150% 斷言）；最後再收緊三元件的上下空段，六 viewport source／ZIP focused **350 observations** 通過。Desktop default 180%／手機／LC／transformer／mutual 的截圖已逐一檢視；電容器內文字在倒轉排列仍保持正向。
- Node 驗證所有 preset 的 body bounds 不重疊、有限導線的實際兩端等於接孔及外框寬度；AC physics／profiles／codec、`npm run check`、DC source／ZIP focused **70 observations** 通過。最後幾何再次比對 17 個預設的 params／端點／t=0.1 physics 完全一致。
- 證據：`output/ac-baseline/ac-layout-before.json`、`ac-compact-final.log`、`ac-compact-controls.log`、`dc-compact-followup.log`。四包由统一 builder 重建核對；原全站與外部 gate 維持。

### 電流卡收窄（2026-10-09）

- 依使用者回饋，一般 AC 電流卡從約 178px 收至約 124px，依既有字體量度函數預留最長格式的固定文字欄及箭嘴空間，顯示字體不縮小。使用既有 CircuitMath 数值格式，極小／極大值緊湊科學記數，不另寫 formatter；mA 單位、瞬時數值及方向邏輯不變。
- Node 覆蓋零、極小／極大、正負及未知量，要求卡片寬度固定且小於145px；瀏覽器核對實時寬度不變、數字在框內且不碰箭嘴。DC 標籤的排法不變。
- AC source／ZIP focused **60 observations**、AC profile／codec／格式 Node、DC wire-current-label Node 及 `npm run check` 通過。實測卡寬 124.14px，2 Hz／50 Hz 各幀保持同寬；文字在框內且與箭嘴分開，截图已檢視。四包已由 builder 重建核對。
- 日誌：`output/ac-baseline/ac-current-card-narrow-final.log`。原全站／Moodle／實機 gate 狀態保持。

### 電容電荷與可變繞組（2026-10-09）

- 工具箱及新元件的名稱改為「變壓器」。既有教師自訂 label 不批量改寫。
- 實物電容改為兩塊平行、帶厚度與透視的金屬板；正紅、負藍，電荷組依 q=CU 等量異號，隨電壓反向交換。均勻網格與多子路徑集中成兩個 SVG charge paths，密集時允許重疊／壓縮，最多4096組/板保護繪圖資源；真實q與電路結果不裁剪。
- 電容電荷與燈光同樣逐 RAF 更新；未知/關閉場不畫假電荷。場面板重用元件 renderer，電容方向跟隨畫布旋轉。普通「讀值」開關與質性的電荷示意分開。
- 電感圈數依 L∝N² 的示意尺度調整；transformer 原、副圈數以同一10:1尺度跟隨实际匝數，繪圖標明实际N。兩視圖均更新，不修改 L/M/匝數求解或端子。
- 新 Node 驗證電荷平衡、增減、反向顏色、C 的影響、未知及 field 關閉，以及 L/N 兩視圖動態繞組；browser 验證即時 RC charging 和權限，不以私有 SVG 數量做活動評分。
- AC source／ZIP focused **32 observations** 及完整 **894 observations** 通過；DC source／ZIP focused **70 observations**、AC physics／profiles／codec Node、`npm run check` 通過。正負極板、電感與變壓器不同圈數、實際 RC charging 及 field 的 screenshot 已檢視。
- 日誌：`output/ac-baseline/ac-reactive-art-focus.log`、`ac-reactive-art-browser.log`、`dc-reactive-art-followup.log`。四包已按最新來源重建逐檔核對；外部 gate 狀態不變。

### DC／AC 共用緊湊電流標籤（2026-10-09）

- 使用者要求共通介面改進也套用 DC。renderer 的 current card 共用 28px 箭嘴欄及 4px 水平內邊距，由相同 layout 路徑計算；不按 analysis 選兩套留白。
- DC 自動單位／TeX 與適應文字寬度保留；AC 的固定欄及固定 mA 是時間變化所需的呈現策略。共同留白修改令 DC 非零 current card 比舊版收窄 6px，AC 亦按同一規則進一步收窄。
- DC source／ZIP 的 **26 viewport/view cases**（1280／390／320px、兩視圖、可信標籤操作）、AC source／ZIP focused **60 observations**、DC label／AC profile Node 及 `npm run check` 通過。DC 的 arrow/text 間距及卡寬有專項斷言，自動單位、零與未知語義保持。
- 日誌：`output/ac-baseline/shared-current-dc-browser.log`、`shared-current-ac-browser.log`。統一 builder 已更新四包並核對來源；外部 gate 狀態不變。

### C／L 範圍及電容板距（2026-10-09）

- 使用者選定工作台 C 100–2000 μF、L 0.05–5 H；C 每10 μF、L 每0.05 H步進。共用 components.byType/byId.ranges（SI）限定 min/max/step，UI、快捷、命令、palette、匯入及restore同一驗證；不授予本來未開放的參數權限。舊文件超出此profile則拒絕，不靜默裁剪，核心模型range／格式不變。
- 元件parameterSpec合併 byType/byId 範圍，quick controls與inspector使用同一份spec；個別活動可設另一range，限制也適用DC元件。
- 平行板的可見gap按 C 反向變化，採壓縮幾何比例避免極端參數使器材穿出接孔。透視斜升從11減至5，plate右側中點 y=-3，引線精確接到動態right edge；孔ID及座標仍固定±60。
- Node及browser覆蓋range設定、非法restore/load／命令、快捷上限、不同C板距與midpoint lead。AC source／ZIP focused **50** 及完整 **912 observations**、25 circuit Node、DC source／ZIP focused **70 observations**、check／diff 通過。1000／2000 μF 的板距及右引線截圖已檢視；四包已由 builder 重建逐檔核對。
- 證據：`output/ac-baseline/ac-ranges-plates-focus.log`、`ac-ranges-plates-browser.log`、`circuit-ranges-node.log`、`dc-ranges-followup.log`。舊模型 range／格式、全站已知 blocker 及外部 gate 維持。

### 電容引線與薄板更正（2026-10-09）

- 使用者明確要求水平直線及右板「板面中央」，而非邊緣／後方中點。兩引線去除全部轉折；右線終點為 front-face 幾何中心，極板位置平移0.5使中心 y=0，導線放在極板繪圖之後，保持板面上的線可見。
- 板側厚度從4降至1.5，outline略收細。板距／電荷／端子ID及±60座標、數值模型均保持。
- 新斷言覆蓋水平無轉折、板面中心、前景繪圖及薄板；AC profile／codec／圖形 Node、source／ZIP focused **50 observations**、`npm run check` 通過。正負電荷、動態板距及新引線截圖已檢視；四包已統一重建逐檔核對。
- 證據：`output/ac-baseline/ac-capacitor-straight-lead.log`。只改 AC 繪圖，既有電學及外部 gate 維持。


### 電感圓筒及連續引線（2026-10-09）

- 依使用者提供的少圈／多圈參考圖，實物電感改為白色圓筒線架；繞線前、後半圈連續接合，後半圈被筒身遮擋。左引線水平進入後向上接繞組，右引線從繞組下端接至端子中線。少圈集中中央，多圈鋪滿筒身，線寬隨密度調整。
- 沿用既有 L 對可見圈數關係、共用 renderer 及場面板，不改電感／線阻／初始電流、符號模式、端子 ID 或 ±60 接孔座標。器材命中 bounds 隨圓筒外框調整。
- Node 覆蓋白色筒身、連續引線接點及稀疏／密集跨度；source／ZIP focused **56 observations** 通過，少圈／多圈截圖已檢視。四包由統一 builder 重建逐檔核對來源。
- 證據：`output/ac-baseline/ac-inductor-former.log`、`output/playwright/circuit-ac/source-inductor-few-turns.png`、`source-inductor-many-turns.png`，以及對應 package 截圖。原全站已知阻塞及外部 gate 維持。


### 極板透視及電感引線／風格更正（2026-10-09）

- 使用者要求參考接線方法而非複製 PhET 外觀。電感改用本工作台既有的灰藍線架、銅色繞線及柔和邊線；減少繞線粗度，左引線與繞組以相同切線方向平滑接合，末半圈直接收至水平右引線，去除原先上下直角轉折。少圈中央／多圈鋪滿及 L 對圈數的示意關係保持。
- 電容板寬由26收至22，透視斜升由5降至1，薄邊由1.5降至1.2；電荷网格跟隨板面。兩條引線仍為水平直線，右端仍接前板面中心；可變板距、正負電荷及固定端子不變。
- AC Node、source／ZIP focused **56 observations**、`npm run check` 通過；已檢視少圈、多圈、正負極板及實際充電畫面。四包由統一 builder 重建及核對來源。僅修改器材繪圖及相應檢查，不改電學、文件或權限。
- 證據：`output/ac-baseline/ac-smooth-reactive-art.log` 及 `output/playwright/circuit-ac/` 的 source／package reactive-art、inductor-few-turns、inductor-many-turns、capacitor-charging 截圖。全站已知阻塞及外部 gate 維持。


### 密集繞組留白置中（2026-10-09）

- 修正繞組以 count 而非 count−1 個圈距計算起點而偏左的問題；按圓筒可見面的透視作小幅位置補償，使密集繞組兩側露出的筒身更均衡。圈數、疏密尺度、平滑接出曲線、接孔及電學保持。
- Node 與 source／ZIP 增加繞組置中斷言；AC focused **58 observations**、Node 及 syntax／manifest check 通過，密集繞組截圖已檢視。四包統一重建及核對來源。證據：`output/ac-baseline/ac-centred-winding.log`，原全站及外部 gate 保持。


### 圓板電容及明顯透視（2026-10-09）

- 使用者澄清需要更大的透視斜度，並指定採 PASCO 類圓板器材外觀；取代原矩形極板為兩塊同角度斜投影的圓板，加薄金屬後緣，使用工作台既有金屬及正紅／負藍配色。圓板從相同 circle 幾何投影，不改電學面積或 C 參數語義。
- 電荷改用等面積徑向取樣，再投影至圓板，均勻分佈且允許高密度重疊；原 q=CU、等量異號、反向、未知、顯示權限及資源上限保持。板距仍隨 C 變化。右水平引線接前圓板中央；左水平引線精確接後緣在 y=0 的交點，沒有懸空。
- Node 增加圓板／薄邊、端點交線及電荷筆劃在圓面內的驗證；AC source／ZIP focused **60 observations**、Node 及 syntax／manifest check 通過。圓板正負電荷、板距及充電截圖已檢視，四包統一重建並核對來源。
- 證據：`output/ac-baseline/ac-circular-capacitor.log` 及 source／package 的 reactive-art、capacitor-larger、capacitor-charging 截圖。符號模式、端子、文件／動態狀態、原全站及外部 gate 保持。


### 電感左引線由下方繞入（2026-10-09）

- 依使用者澄清，左引線先由端子中線平滑向下，再接筒身背面的半圈，由下方繞回第一圈上端；背面半圈隨筒身遮擋。右側末半圈及引線保持，不再左右同向從上方接出。圈數、置中、風格、端子及數值模型保持。
- Node 驗證下方接點／背面半圈的連續路徑及繪圖層次，source／ZIP 驗證實際 SVG 引線向下的幾何；focused **62 observations**、AC Node 及 syntax／manifest check 通過。少圈／多圈畫面已檢視，四包統一重建核對。證據：`output/ac-baseline/ac-inductor-lower-entry.log`。原全站及外部 gate 保持。


### 豎直圓板及窄縫（2026-10-09）

- 依使用者要求，圓板投影移除剪切斜度，兩塊板保持豎直；縮小 gap 公式至 2+4/(1+C/0.0005)，常用範圍只留約2.8–5.3世界單位的窄縫，仍隨 C 反向變化。圓板薄邊、正負電荷、直線引線及固定接孔保持。
- 電荷與左引線交點同步使用豎直投影；Node 驗證窄縫、接點及電荷在圓面內，source／ZIP 增加實際投影無傾斜斷言。focused **64 observations**、AC Node 及 syntax／manifest check 通過，2000 μF及充電截圖已檢視；四包統一重建核對來源。證據：`output/ac-baseline/ac-upright-close-plates.log`。原電學、全站及外部 gate 保持。


### 圓板投影重疊與分開（2026-10-09）

- 使用者以近／遠參考圖澄清：接近時兩板的投影應部分重疊。移除為防止重疊而額外加入的兩個14單位半板寬，改以板中心距離控制位置；常用 C 下中心距離約13.3–42.3，接近時重疊、分開時有可見空隙。豎直圓板、薄邊、電荷及水平引線保持。
- 幾何比例不改 C、q、儲能或權威文件；左引線交點及右板面中心同步更新。Node及browser新增近板重疊／遠板分離的斷言，使用實際圓板外框驗證，並檢視2000 μF／100 μF截圖。
- AC source／ZIP focused **68 observations**、Node及syntax／manifest check通過，四包統一重建核對來源。證據：`output/ac-baseline/ac-overlapping-plates.log`，source／package capacitor-larger及capacitor-separated截圖。原全站及外部 gate保持。


### LED 電流動畫、示例設定及電感放電（2026-10-09）

- LED 原先有求解電流及發光，但缺少 renderer 的元件導電動畫路徑。接上共用 componentFlowPaths：實物沿引脚與內部導體，符號沿支路；旋轉、正負方向、電子／常規電流及關閉共用既有邏輯，截止／未知不畫假電流。
- DC／AC 教師以選單切换示例時保留 display、policy及新導線預設；舊電勢參考端點清除，導線總數至少容納預設已有線。正常 loadDocument／文件恢復仍使用文件自己的設定；profile驗證及學生權限保持。
- 原 inductive 示例在非零電流時斷開單刀開關，沒有放電路徑，實測回報 inconsistent 並暫停；這是理想模型的約束診斷。改為可見供電／放電 SPDT：供電側保留原串聯 source／L／lamp 的參數與數值，放電側經原負載燈成閉路。切換保留電感電流、儲能依線阻及燈衰減；沒有改 solver、暗加電阻或清空能量。
- Node驗證 LED兩視圖及反向並聯半週導通、端點及 off，電感切換電流連續、耗散、保存恢復續算及再供電；DC flow／component-flow／platform、AC／transient通過。AC source／ZIP focused **94 observations**，含真滑鼠點擊切換後不暫停；DC source／ZIP五 viewport的設定檢查 **40 observations** 通過，另有syntax／manifest check。LED及新供電／放電示例截圖已檢視，四包統一重建核對。
- 證據：`output/ac-baseline/ac-led-settings-inductive.log`、`shared-preset-settings-dc.log`。原全站已知阻塞及外部 gate保持，舊匯入電路不自動重接。


### RL 放電、變壓器繞線及雙匝數滑塊（2026-10-09）

- 「通電自感 · 電流建立」沿用 inductive 的供電／放電 SPDT 接法；初始在放電側、零電流，切換至供電側才建立電流，斷電後經原負載燈衰減。保留直流源、1 H及原線阻／負載參數，切換不清儲能；solver與無通路診斷不改。
- 電感及變壓器重用一份連續螺旋繞線 SVG 計算；變壓器分別沿兩個鐵芯柱繞製，後半圈在疊片環形鐵芯之後，前半圈及平滑接線可見。圈數比例、端子／同名端與物理模型保持，原電感幾何保持。
- 原線圈沒滑塊是 inspector只接受主要參數；加入元件定義的 slider metadata，兩個匝數滑塊皆按模型全範圍1–2000顯示。原副預設 UI步距為1，解決原先偏好上限100及min=1／step=10導致終點不可達；快捷每10匝保持。活動範圍可覆蓋 UI步距，所有操作仍經profile驗證。
- Node核對 RL通斷電連續／衰減、繞組前後層次、兩側控制及活動步距覆蓋；AC／transient解析、能量、codec與既有圖形檢查通過。AC source／ZIP focused **110 observations**，含原副兩滑塊真滑鼠拖至1及2000、真點擊 RL通斷不暫停；DC source／ZIP快捷回歸 **70 observations**及syntax／manifest check通過。變壓器、雙滑塊及RL放電截圖已檢視。
- 四包統一重建核對來源；證據：`output/ac-baseline/ac-transformer-rl-controls.log`、`dc-transformer-controls-followup.log`。原全站及外部 gate保持。


### 變壓器外側出線及移除裝飾圓孔（2026-10-09）

- 移除貼近鐵芯的四個裝飾 socket 圓形，保留共用 renderer 的四個實際接線端子及原座標。
- 兩側繞組的可見半圈對稱朝外；變壓器末圈改為完整繞過鐵芯，後半圈回到外側再接出。四條引線只在鐵芯外側作短而平滑的轉接，切線接續繞組及水平接線端，不再横跨鐵芯正面／形成內部迴彎。電感仍使用原有半圈接出幾何，物理及符號不改。
- Node驗證無装飾circle、外側方向及引線起點；browser使用實際出線 path bounding box核對不進入鐵芯正面，source／ZIP focused **112 observations** 通過，原副滑塊端點及RL切換回歸保持。syntax／manifest check通過，最後變壓器畫面已檢視。四包統一重建核對來源。證據：`output/ac-baseline/ac-transformer-terminal-layout.log`。原全站及外部 gate保持。


### AC 電表依 DC 技術細節整理（2026-10-09）

- 參照 DC 計劃第938–941及1220節的機械針／未知值合約；AC A/V/W及AC工作台內的G/W重用同一解析欠阻尼模型，保留位置與速度、超越回擺、衰減及機械限位。原DC A/V算法／參數保持；每種表使用自己的零點、角度、支點及行程。指針不是數值答案，不進入權威快照。
- 原AC表沒接上共用動畫，而且未接線狀態混為collecting。編譯時快取接線狀態，未接妥始終reading=null，機械針回零；資料未足明示collecting，未知／非法接孔不画假讀值。修正AC內G的單位由器材代號G誤作單位，回到SI的A、介面μA；雙量程缺共用／雙正孔、低量程格值亦與DC對齊。
- 三種AC錶面放大及重新校準刻度，A/V30格、W正負各30格；數字依長度調整以避免擠壓。端子座標與電學保持，palette、命中bounds及手機預覽viewBox同步更新。放大錶盤與手機持續預覽重用同一針位，暫停／只讀凍結，減少動態直接定位。恢復新session清除舊机械速度。變壓器設計不改。
- Node慣性測試 **24 cases**，含原DC16及AC/G8；meter/math **96 fixtures**、AC物理／codec／指針未知值／單位及transient解析驗證通過。source／ZIP AC focused **232 observations**，以真實RAF核對四種電表超越、回零、暫停、實際開啟的放大錶盤同步、手機觸控預覽、只讀、減少動態及320/390×500短畫面；canvas/dialog同步誤差0，實際SVG角誤差小於0.000002°（沿用DC 0.0001°幾何容差）。
- 原DC source／ZIP指針回歸 **24 observations**及syntax／manifest check通過；已檢視未接針、大錶盤、手機及短畫面截圖。四包統一重建核對。證據：`output/ac-baseline/ac-meter-inertia.log`、`dc-meter-inertia-followup.log`。沒有把物理／量測誤差容差改鬆，原全站已知阻塞及外部 gate維持。


### 可移動波形儀器與可延伸量測線：實作決定（2026-10-09，驗證待補）

- 使用者要求參考PhET的電壓圖／電流圖工具，取代固定大波形區及控制板四通道／游標設定；預設無圖，取工具後才顯示，教師預設最多兩部，可信活動可配置0–4部並保持既有指定觀察通道。
- 圖框以畫布內CSS位置定位，不隨電路縮放縮小，能拖到邊緣；量尺＋／−只改資料縱軸，大小按鈕及44px角落把手只改框尺寸，另可摺起／放大。時間軸初始按實驗選取後固定，同時觀察的圖用同一時間窗，沒有改物理頻率／播放倍率。
- 電壓兩探頭讀同一電氣島內兩點差；電流探頭量測指定導線或支路，有號電流／不唯一量保留null。探頭線只作量測呈現，不加入求解器、不耗導線庫存、不套有限電路導線長度；探頭可拉遠、線身可拉出彎點，綁定後跟隨端子／導線。
- 圖／探頭／線的手勢捕獲與電路編輯分開，取消還原UI，不寫電路文件或時間快照；兩側32px捲頁區保持。鍵盤可移圖、改框、移探頭／選擇合法測點。活動限制在UI及公開接口同樣驗證。
- 公開觀察工具配置是獨立UI狀態，不自動持久化或冒充SCORM答案；captureSession仍只包含電路與物理。給外層取得／原子設定工具狀態的接口，指定通道限制、数量、失效ID及非法形狀需拒絕。正式評量／題目／Moodle gate仍N/A／另定。
- 重用CircuitObservation及Routing的量測／位置／走線能力；原生Canvas/SVG/DOM，新增一個可選scope UI檔案，登記到AC依賴和測試入口。顯示緩衝按固定時間bin保留首／末／最小／最大資料，容量有界，未知處斷線；有效值／功率的物理積分不變。
- 驗證：純模型的探頭讀值／隔離／不唯一／限制／峰值及工具狀態round-trip；source/ZIP真實mouse/pen/touch拖取、移圖框、resize、資料放縮、兩探頭電壓／導線電流、長線／彎線／取消、相機變動、只讀、多instance、320×500及原生捲動；既有DC／AC回歸與四包重建。


### 可移動波形儀器：完成及驗證（2026-10-09）

- 已用工具箱的電壓圖／電流圖取代常駐大圖、四下拉及游標選項。教師預設兩部，活動可配置0–4及指定元件通道；特殊charge/energy/flux能力仍供作者使用。兩種放大分開：量尺按鈕可在縱軸／時間切換，所有圖時間軸對齊；框可用44px角把手縮放，⤢開大框，雙擊標題摺起，窄畫面以摺起和大圖保持可用。
- 非侵入兩點電壓／導線電流已接上同一物理解，探頭吸附端點／理想導線及電流支路，綁定後跟隨相機及幾何。量測線不耗库存／不套電路線長，線身可拉出彎點、雙擊拉直、Escape／cancel還原；所有操作不改電路／權威物理。圖框互相可置頂，超出資料量尺明示。
- `getObservationTools/setObservationTools`提供獨立UI配置round-trip及原子驗證，`setObservationChannels`保留作者接口，數量及固定通道作用於UI與API。活動電壓探頭不得混合不同獲准通道，未知／跨島／不唯一電流不畫假零。顯示Trace保留取樣峰值、缺口及同時刻事件，RMS／功率積分不變。
- 新pure scope測試已登記run-tests，涵蓋量測truth、隔離、未知、snap、長線與資源、非法／越權／數量／配置restore及有界峰值／事件；AC／transient／原profile及codec Node通過。AC source／ZIP完整 **1212 observations**通過，正式入口包含新scope cases；獨立新儀器focused **88 observations**，涵蓋mouse/pen/touch、兩種縮放、時間對齊、長線／彎線／Escape、讀值、只讀、相機、鍵盤、手機與短畫面。
- 固定transformer/LC活動的工具配置、拒絕非法測點／通道及合法續作、DC+AC+多AC的工具／時間隔離及卸載均納入完整browser；T1–T3原生捲頁把手在儀器存在時保持。DC source／ZIP快捷回歸 **70 observations**、syntax／manifest及diff通過。桌面實際曲線、大框、390/320px及橫向截圖已檢視。
- `circuit-scope-ui.js`已登記AC資產與兩入口，七份AC核心依賴及四個成品由統一builder重建核對。證據：`output/ac-baseline/ac-floating-full.log`、`ac-floating-scope.log`、`dc-scope-followup.log`。全站已知阻塞及真Moodle／實機gate仍按原記錄，正式AC題目沒有自行建立。


### 波形儀器圖示、固定時間尺標及薄框（2026-10-09）

- 電壓／電流工具加入原生SVG小型示波器圖案，沿用工具箱尺寸、拖取及鍵盤名稱；兩種曲線使用各自顏色。沒有增加圖片或外部依賴。
- 移除滾動的絕對時間刻度，圖下方固定尺標由繪圖左端延伸至右端，全寬代表 `span`（例如1 s或2 s），只在時間量尺變更時更新；波形仍按權威模擬時間滾動。時間控制明示「時間窗」，所有圖仍同步。
- 移除正負跳動的瞬時數字及其獨立22px列；未接探頭、未知量及超出量尺保留簡短圖內提示。框改1px邊線及淺色／白色操作區，圖區增加可用高度；44px按鈕、大框／角落resize／資料縮放／摺起及長量測線維持。
- 探頭及Trace純模型測試、syntax／manifest check及diff通過；source／ZIP focused **100 observations**通過，新增實際Canvas字串檢查（只有縱軸刻度）、模擬时间前進而尺標穩定、時間縮放後所有尺標同步及薄框／44px命中範圍。桌面兩儀器、大框及320px手機截圖已檢視。
- source／ZIP完整AC回歸 **1224 observations**通過，包含短畫面、既有物理／電表／元件操作、活動配置、快照續作、多instance、原生捲頁及全螢幕。四個成品已統一重建核對來源；證據：`output/ac-baseline/ac-scope-ruler.log`、`ac-scope-ruler-full.log`、`ac-scope-ruler-check.log`。此次只改AC可選儀器UI，物理解、DC共用控制及正式活動評分不變；全站既有阻塞及真Moodle／實機gate仍按原記錄。


### 軸拖動、連續預覽與課堂示例整理（2026-10-10，完成）

- 使用者要求圖框上下極窄、無常駐量尺按鈕、兩軸均可mouse／touch直接拖縮放。移除footer列；標題16px、時間區18px，expand／close及resize放邊角，透明命中區保持44px。保留框／資料兩種縮放、Home／方向鍵、摺起及原生捲頁區。
- 時間標尺改1/2/5系列、不大於半窗，5 s窗標2 s（40%寬），1 s窗標0.5 s（50%寬），隨range伸縮而不是隨模擬時刻跳動。圖框UI取消還原量尺與曲線；波形和實際頻率不改。
- 電流探頭由Renderer既有導電路徑吸附至元件內部，component target可带fraction，完整驗證0–1，跟隨移動／旋轉／視圖。透明度約22%，selector覆蓋共用pressed／hover樣式，避免绑定又變不透明。
- 共用slider改用AC獨立動態副本；主要session及權威analysis訂閱不在預覽中前進。副本保留20 ms視覺積分而RMS重新收集，播放中波形／光／發熱即時更新；放手一次接受文件及續作時間，取消完整還原。C/L改變仍屬重設實驗。DC保持靜態預覽／原操作。強烈過載可在完整量測窗未滿時用保守三種波形峰值界提前提示，正常額定三波形不得誤報。
- 時間模式的flow新增顯示界（1 pA及電氣島觀察峰值的1e-5），極小電流不再被18px/s最低速度顯示；不改求解數值／波形，DC既有微／nano級電流維持。
- 整理所有教師示例接線：分支明確junction、正交路由，純幾何驗證所有不同wire只可在共享endpoint相交，无長度重疊；self儲能線圈／燈改平行直立兩支路，互感／LED／RC/RL/LC沒有重疊回線。仍核對bounds、端子、線長及物理方向。
- 方／三角波合併到既有源波形控制、舊create別名保留；交流電感0.2 Hz／5 H／12 Ω與直流RL 5 H／0.1 Ω／3 Ω分別呈現頻率效應及約1.61秒電流建立。電容交流2000 μF／120 Ω／0.5 Hz，RMS功率對應亮度在低／高頻約0.304／0.593；電感低／高頻約0.499／0.035。RC採有放電側的SPDT及約1秒時間常數。
- self 5 H在供電後3秒斷電，燈有清楚反向电流與短暫亮光；互感用5 H／20 Ω放電及50 μA量程，驗證通／斷方向相反且脈衝>30%滿量程，直流穩定趨零。LC採2000 μF／5 H（T≈0.628秒），衰減線阻8 Ω。現有範圍不足1–2秒LC：1秒需例如C≈5066 μF或L≈12.7 H；2秒約20264 μF或50.7 H。維持使用者選定範圍，明示限制，不用改慢播冒充物理參數。
- 固定LC技術示例模板已重排並改參數，外層codec升version 3，明確拒絕1／2；完整教師JSON/session及物理modelRevision不升版。正式SCORM題目仍另定。

- 驗證：Node AC/platform／transient／scope／flow／component-flow及DC platform core通過。幾何測試對所有預設無額外交叉／重疊，並避開元件指定bounds或通用器材中央區；新增RC初始放電不供電、解析充放電及保存後合法續作，避免SPDT共用端接錯造成斜線及常供電。
- 完整AC source／ZIP **1258 observations**通過；最後進一步收窄框、修正RC接線及補單指滑片／場示意後，最新 source／ZIP 儀器與連續預覽 **150 observations**、全示例兩視圖／RC/self續作／微小電流 **136 observations**通過。新preset cases也接入既有完整browser入口，沒有只放在臨時腳本。DC source／ZIP快捷參數、拖動／取消、history、權限與恢復 **70 observations**通過；syntax／manifest及diff通過。
- 已檢視最新超薄圖框、半透明探頭、大框／390/320px、按住源滑塊發熱、所有預設，以及RC正確接線／self反向放電／極小電流無箭頭截圖。測試以可見的控制命中區操作；浮動量測線若覆蓋中央，選未被覆蓋部分驗證原生單指控制。所有四包由統一builder重新核對來源／依賴指紋。
- 證據：`output/ac-baseline/ac-axis-preview-full.log`、`ac-axis-preview-final.log`、`ac-presets-final.log`、`dc-live-preview-followup.log`、`ac-axis-preview-check.log`。既有全站阻塞及真Moodle／實機gate仍分開記錄；正式AC SCORM题目沒有自行加入。


### 示例反覆切換不再暫停（2026-10-10）

- 全部示例以不同運行時間反覆切換排查；問題集中於LC／衰減LC在振盪側切回充電時，原接法把非零電流的電感空斷。舊browser把此診斷當成預期結果，沒有驗收示例能正常來回操作；本次改成所有示例都必須持續播放／無診斷的明確回歸。
- 只修改兩個LC示例：C/L始終串聯成閉路，SPDT選擇經原100 Ω電阻及直流源充電，或直接LC振盪。充電是RLC過程，原L/C及理想／衰減線阻保持，切換保存電容電壓與電感電流；沒有暗加電阻、清儲能或屏蔽求解器故障。外接線仍無交叉／重疊，元件中央區及端子／有限線長檢查通過。
- 固定LC配置同用新模板，技術示例codec升至version 4、明確拒絕1／2／3；教師完整文件與session仍保存原電路，不自動改接，modelRevision保持1。C/L範圍沿用已確認值，本次沒有套用尚在討論的擴大範圍。
- Node AC/platform及transient通過；新增 **240次**跨不同時刻、所有示例的反覆切換、储能連續及每次保存恢復後合法續作，允許浮點roundoff但不放寬物理驗證誤差。生產技術codec各phase的round-trip與byte gates通過。
- source／解壓ZIP browser **532 observations**通過，含全部示例兩視圖、12個有開關示例的真滑鼠反覆切換、實際paused=false／無診斷／模擬時間前進，以及LC與衰減LC恢復後真觸控切换。时间前進等待遵守每幀運算預算，不要求較慢互感在固定90ms內完成特定物理時間。最新LC兩模式截圖已檢視。
- 四成品由統一builder核對重建；syntax／manifest及diff通過。證據：`output/ac-baseline/ac-switch-node.log`、`ac-switch-presets.log`、`ac-switch-check.log`。自由搭建的理想空斷線圈等非法接法仍提供真實診斷，外部Moodle／實機及全站既有阻塞仍維持原記錄。


### 目前讀值圓點及橫軸擴展保留歷史（2026-10-10）

- 依使用者提供的PhET表達，在電壓／電流等波形末端畫實心圓點，直接讀當下物理解，距右邊界14px；未知／超出Y量尺不画假點。右側為小段未來留白，X軸全寬及時間間隔的比例仍一致，不把圖最右邊當作現在。
- 原Trace只保留正在觀看的時間窗，拖大時已丟掉舊波形。新增獨立1000秒／8192bin有界歷史，滿額逐步壓縮、保留峰值與缺口；顯示仍最多1025bin。setSpan从歷史及較細的近期資料重畫，不因時間縮小再放大丟資料；預覽複製完整歷史，取消不改權威曲線。未收集區間以淡色及文字說明，不偽造過去資料。
- 50 Hz帶兩圖驗證發現每次物理取樣都重複JSON複製電路文件；改用共用editor既有viewDocument唯讀視圖，對外onAnalysis仍提供獨立結果副本、權限及權威狀態合約保持。
- scope Node驗證舊窗擴至20／100秒、反覆縮放、獨立預覽copy、100000取樣的容量／尖峰／未知缺口、1000秒到期及時間重設；transient物理回歸通過。source／ZIP browser **194 observations**通過：實際Canvas圓點與模型U/I及14px間距、未接探頭不留點、收集30秒後真拖動X軸反覆擴至約20秒而左側保持波形、既有mouse/pen/touch／手機／只讀／動態預覽，以及兩圖50 Hz實際時間倍率0.85–1.15範圍。
- 已檢視圓點、20秒完整歷史及手機大框截圖；syntax／manifest及diff通過。四包統一重建核對，證據：`output/ac-baseline/ac-scope-current-history.log`、`ac-scope-current-history-check.log`。不改物理模型、評分或SCORM；既有全站及外部gate維持。

### 擴大電容／電感的常用範圍（2026-10-10）

- 依使用者確認，常用滑塊改為 C 0.01–0.2 F、L 0.5–10 H；電容預設0.02 F並直接以F顯示，步進0.001 F；電感預設1 H、步進0.1 H。教師數字欄仍接受C最低0.0001 F、L最低0.05 H，舊文件按實際SI值恢復，不偷偷改值。較小值會延伸滑塊下限並用連續步進，避免最大端點不可達。學生活動的自訂範圍仍完整生效，不套用教師常用下限。
- 板距隨新範圍反比縮放，電荷組量改2.5 mC，保持CU、極性及均勻分佈語義，避免大C直接填滿圖形上限。電感繞線沿用既有L比例及動態線寬。物理方程與modelRevision不變。
- RC改0.02 F／50 Ω，保留1秒時間常數；電容交流改0.02 F／12 Ω，維持可見頻率差異；LC改0.02 F／5 H及30 Ω充電支路，約2秒充電、週期約1.987秒。0.2 F配10 H可達約8.886秒週期，之前的小範圍限制記錄已由本段取代。示例仍保持合理放電路徑及連續切換。
- 固定模板技術codec升至5，明確拒絕1–4，避免用新LC參數續算舊模板快照；教師完整document/session保留原參數與幾何。正式AC評分活動仍未新增。
- transient解析測試包括最大C的RC時間常數、保存恢復續算及最大C/L的LC四分之一週期與能量；配置／codec／240次示例切換、scope Node均通過。source／ZIP browser：元件及真滑塊端點／舊值恢復246 observations、示例532、波形194；DC共用快捷操作70。已檢視0.2 F電容與LC示例截圖。syntax／manifest及diff通過；四包统一重建核對。證據：`output/ac-baseline/ac-expanded-ranges*.log`、`dc-expanded-ranges-followup.log`。全站既有阻塞、外部Moodle及實機gate維持原記錄，這些本地證據不代表外部通過。

### 縮小波形儀器探頭（2026-10-10）

- 電流／電壓探頭圓面由44px改28px、邊線由3px改2px；半透明、標記及吸附提示保持，透明拖動命中區仍44×44px，不改測點、接線、物理或保存格式。
- source／解壓ZIP的scope browser 194 observations通過，新增外觀28px／命中44px／中心對齊及半透明核對，既有滑鼠、筆、模擬觸控及鍵盤流程保持。已檢視雙儀器截圖；證據：`output/ac-baseline/ac-smaller-probes.log`。四包統一重建；外部Moodle與真手機未重新驗收。

### 以燈觀察儲能釋放及LED調查（2026-10-10）

- RC示例以20 Ω、6 V恆阻燈替換定值電阻，C改0.1 F，時間常數2秒。充電約6秒後切換，電源退出放電迴路；燈再次亮起並逐漸熄滅，電流方向反轉。開關接線與元件ID保持；教師保存的舊文件不改寫。
- 自感示例保留原有可見放電燈及無交叉接線，改10 H／1 Ω線阻、3 Ω／3 V燈，合上約8秒後斷開，放電時間常數2.5秒，避免原先快速過載閃光。RL已有燈而保持原接法；理想LC仍無損，未把燈加入振盪支路。
- Node解析與模型驗證通過：RC／RL／自感斷源後功率及儲能逐步下降、亮度由0.584／0.576／0.384逐步降至近零、無過載、方向與恢復續作正確；全部示例240次切換保持連續狀態。source／ZIP browser 610 observations核對實際SVG亮度序列、接線、滑鼠／模擬觸控切換及繼續播放；已檢視RC和自感亮燈截圖。syntax／manifest、diff及四包統一重建通過。
- LED另以現有solver及廠商資料調查，未新增預設或改LED畫法：C 0.02 F、6 V，串220 Ω與預設LED可得到約18.3 mA逐漸下降；反接截止，殘餘電壓接近正向壓降，Node解析測試已登記。L 10 H、20 mA放电在1.8 V LED上僅約0.1秒，加220 Ω後約0.055秒，因此不能直接替換原燈而期待幾秒漸暗。現有LED外觀只有亮／熄；若日後新增LED示例須補漸暗、限流、方向及必要反向保護，模型仍無永久損坏。
- 證據：`output/ac-baseline/ac-discharge-led-physics.log`、`ac-discharge-led-inductor.log`、`ac-discharge-lamps-node.log`、`ac-discharge-lamps-browser.log`、`ac-discharge-lamps-check.log`。LED參考來源及具體模型限制見[工作台文件](../docs/circuit-ac-workbench.md#led-放電的可行性)。未重跑全站既有阻塞或真Moodle／實機gate。

### 交流電表外殼精簡（2026-10-10）

- 按使用者要求，移除AC A／V／W實物外殼兩側的額外圓孔；共用socket繪圖仍供其他元件使用，實際接線孔由editor保留。端子、引線、物理、讀值及保存格式不變。
- source／解壓ZIP元件及電表browser 246 observations通過，涵蓋指針回零／慣性／放大錶盤同步、接線量測及手機預覽。已檢視精簡電流表截圖；四包統一重建。證據：`output/ac-baseline/ac-meter-clean-case.log`、`ac-meter-clean-case-check.log`；外部Moodle及實機未重驗。

### 統一DC／AC燈亮度及確認直流有效值（2026-10-10）

- 依使用者要求，移除共用renderer內依displayPower另用指數式的分支；兩後端統一用原DC的 `min(1,P/額定功率)^0.6`。DC既有畫法不變；時間後端仍提供20 ms平均功率以呈現低頻亮暗及50 Hz穩定。同一燈、相同顯示功率得到相同亮度，不改U／I／P或儲能方程，未知功率仍保持未知。
- 保留交流A／V表，不新增直流電表。穩定6 V／0.5 A直流及反接的Node驗證確認：有號瞬時量變號，總RMS大小仍為6 V／0.5 A。充放電時的窗RMS不等同當刻有號讀值，儀表仍為包含直流成分的教學有效值模型。
- 新增跨後端0／0.6／3／6／9 V的同燈U／I／P與亮度一致驗證、未知顯示功率處理及直流反接RMS回歸，登記於既有AC平台suite。transient解析、AC平台與240次切換、DC core及112項teaching驗證通過。
- source／解壓ZIP browser：同燈亮度比較、2 Hz及50 Hz實時84 observations；所有示例及儲能漸暗610；DC共用操作70。2 Hz亮暗測試只用已知功率幀，排除啟動收集時的假暗畫面；已檢視50 Hz截圖。充放電套用共同曲線後餘光下降較慢，延長觀察至足夠時間仍驗證單調漸暗與儲能耗散，不修改示例物理參數。
- 四包統一重建、syntax／manifest及diff通過；證據為 `output/ac-baseline/ac-unified-lamp-*.log`、`dc-unified-lamp-*.log`。未重跑全站既有阻塞或真Moodle／實機gate；不增加評分、SCORM題目或其他儀表模式。

### 精簡Control Panel量測說明（2026-10-10）

- 移除選取元件後正常讀值下的「量測窗起止秒數；資料來自時間積分」文字；等待提示改為「收集量測中」，電表未接妥提示保留。瞬時量、有效值、平均功率、內部時間積分及公開分析資料均不變。
- source／解壓ZIP browser 108 observations通過，包含0／3／6／9 V燈選取時的等待提示、完成後有效值保留與技術文字消失、同功率亮度及2／50 Hz實時呈現。驗證在離線前進後重新選取元件以刷新inspector，與使用者選取流程一致；已檢視Control Panel截圖。syntax／manifest及diff通過，四包統一重建；證據：`output/ac-baseline/ac-clean-readings.log`、`ac-clean-readings-check.log`。未重新驗證真Moodle或實機。

### 電表顯示精度與衰減尾值（2026-10-10）

- 原數字以四位有效數字顯示，會把數值積分波動及極小的衰減尾值持續列出，即使指針移動已不可辨。新增共用 `CircuitRegistry.meterDisplayReading`，AC A／V／W及共用G按每小格十分之一顯示，正負對稱取整、不留負零；指針目標、實物／符號數字、標籤／概覽及Control Panel共用同一精度。DC雙量程A／V原精度保留。
- 不改solver、量測積分、公開analysis、波形、能量或session，不裁剪權威电流。小量程仍可量微小電流，未知不冒充零，過量程仍按原讀值判斷。G為純電阻支路，低於顯示電流尺度時，其相應U／P尾值也不列出無意義極小數字。
- 理想變壓器穩態數字不再逐幀跳動；線性變壓器保留真實通電暫態，穩態測試先運算8秒，再觀察連續幀，不能把剛通電的正常变化強行凍結。互感通斷電脈衝仍顯著可見，之後低於量程精度時標籤、面板與指針目標為零。
- meter-motion新增範圍／正負／負零／邊界對稱／未知／合法微小量程及原始數據不變驗證，共25項通過；AC平台及240次示例切換、transient解析、DC teaching112項通過。source／解壓ZIP browser270 observations包含理想與線性變壓器穩態數字、互感顯著脈衝／零尾值／Control Panel、機械慣性與放大錶盤同步；DC共用操作70通過。已檢視線性變壓器與G零位截圖。
- 四包統一重建核對；syntax／manifest及diff通過，最後面板及browser新增行另以node --check核對。證據：`output/ac-baseline/ac-meter-display-*.log`、`dc-meter-display-*.log`。未重跑全站既有阻塞、真Moodle及實機gate。

### 導線及元件衰減尾值的近零顯示（2026-10-10）

- 使用者要求保留完整指數衰減求解，但不要無止境列出導線／元件電流的極小尾值。新增共用純顯示 `CircuitRenderer.displayCurrent`，沿用電氣島觀察峰值作動畫尺度，普通門檻為max(1 μA, 峰值×10⁻⁵)，同島電流計／G可按半個顯示步長降低門檻，以保留真正可讀的微小電流。導線卡片、元件瞬時／有效電流、變壓器次級電流及箭頭共同使用，未知不冒充零，DC原數字與動畫不變。
- Control Panel只操作元件／量測的顯示副本：電流顯示為0時，低於10⁻⁶ SI單位的相關U／P／儲能尾值亦顯示0；不把正常非零電壓或已充電電容儲能一併清除。getAnalysis、waveform signal、模型儲能、captureSession及下一步運算維持原始數值，不加到時停止或清空條件。重用現有flow尺度及preview副本，沒有新增求解器狀態或持久化欄位。
- 已按RL示例通電6秒後切換放電、離線前進至40秒尾段重現：原始電流仍為正且小於10⁻⁹ A，導線卡片0 mA、元件電流／有效值0 A，無導線方向箭頭或流動粒子。波形signal仍等於原電流；選取／顯示不改captureSession。另驗證1 nA量程G下的實際100 pA電流不被隱去。
- wire-current-labels新增權威數值不變、未知、小量程及DC精度回歸，既有flow30項、component-flow8組、標籤與AC平台／240次切換／transient解析均通過。source／解壓ZIP browser122 observations涵蓋RL尾值／面板無無意義極小數字／波形與session不變、同功率亮度、2／50 Hz實時；DC共用操作70通過。已檢視RL近零截圖。
- 四包統一重建；syntax／manifest及diff通過，最後面板及browser改動另作node --check。證據：`output/ac-baseline/ac-decay-display-*.log`、`dc-decay-display-browser.log`。未重新驗證全站既有阻塞、真Moodle或實機gate。

### 修正振盪近零判斷及補齊儲能顯示（2026-10-10）

- 上一版按當刻電流裁定尾值，在可見振盪過零附近會暫時隱去，再於反向半週出現。觀察Tracker新增同窗currentPeak（由接受時間步求峰值，bin邊界保守保留）；Session讀取只讀元件／導線峰值，變壓器另有次級峰值。Renderer只在完整窗峰值及當刻值皆低於顯示門檻時隱去，資料未足或分支峰值不明時不先宣告結束；新電流可重新出現，不使用不可逆鎖零。RMS／平均功率积分和數值solver／步長控制不改，快照不保存觀察峰值。
- 儲能區原先直接顯示原始E，未受選取元件的處理涵蓋；新增共用displayEnergy，低於10⁻⁹ J僅在顯示為0。選取元件電場／磁場儲能、獨立儲能區數字及條、場示意能量、累計耗散共用；不再以瞬時電流是否為0決定能源顯示。正常LC交換的瞬時零值保留，未知不冒充零，原始E／波形／state未清空。
- Node驗證可見振盪內的微小瞬時值不被當作衰減完畢，衰減後跨正／負半週保持顯示零、原始總E仍為正且captureSession不變；另驗證觀察窗峰值／脈衝／過期。wire-current-labels、scope、AC平台／240次切換、transient解析、flow30項、component-flow8組、meter-motion25項通過。
- source／解壓ZIP browser136 observations：衰減LC以公開單步連續取180點，首次整窗歸零後反向不再閃回；選取C／L及下方能量區數字0 J、條value=0，原始E>0、UI操作不改session；RL尾值、同功率亮度及2／50 Hz實時維持。波形browser194 observations通過，涵蓋探頭、軸、歷史、多工具及50 Hz兩圖真實時間。單次長流程超過工具5秒上限，改為12次單步一批，不放寬判定或時間預算。已檢視LC零能量截圖。
- 四包統一重建；syntax／manifest及diff通過。證據：`output/ac-baseline/ac-cycle-display-*.log`。新增測試仍在既有總runner內；未重新驗證真Moodle／實機或全站既有阻塞，不改評分與物理模型版本。
