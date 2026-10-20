# 平拋運動：軌跡量度與擬合

## 活動改名（2026-10-20；本節優先）

- 使用者選定「平拋運動：軌跡量度與擬合」，直接在main修改。統一catalogue、HTML title及SCORM organization/item title；頁首沿用兩行：主標「平拋運動」、正常狀態副標「軌跡量度與擬合」，h1 accessible name保留完整活動名稱。提交／pending等既有狀態提示照常呈現。
- 僅改顯示名稱及本計畫；slug、manifest／organization／item／resource identifiers、權威snapshot、物理、rubric、依賴、字體及排版規則不變。評分風險與phase/schema契約無新增項。
- 名稱屬低風險文字修改，不新增測試入口；驗證check／check:tests、重新打包及來源／解壓SCORM名稱一致，並以現有browser helper檢查手機、短iframe及桌面頁首／fullscreen／檢查控制未溢出。文件及完整本輪diff通過後commit/push main；不以本輪文字驗證重述舊完整活動測試為新通過。

- 本輪驗證：check、check:tests（246 entries）、活動17檔SCORM打包、文件連結及`git diff --check`通過；source＋真正解壓SCORM在320×225／500、390×844、1280×800、1920×1000的edit／check／review，共30組名稱、accessible name、既有狀態、0分提交及頁首邊界檢查全部通過（`output/playwright/horizontal-projectile-lab/rename-check.json`）。目視390px手機及1280px桌面截圖；ZIP兩個SCORM title正確，16 runtime與來源逐byte相同。沒有新增永久測試、重跑完整活動browser或宣稱新的真Moodle／實體手機驗收。

## 桌面畫布及控制欄修訂（2026-10-20；本節優先）

- 分支 `codex/projectile-desktop-layout`，基線 `899ffe4`。只調整本活動桌面（寬度≥900 CSS px）排版：控制欄限制320–368px，圖域按實際斜槽／座標範圍與文字邊界等比例置中，減少固定空白。窄桌面按需要重排取點按鈕，維持文字大小及44px以上操作目標。手機及寬度<900px短iframe原排版維持。
- 四個編輯步驟、檢查頁、回顧與pending仍沿用原流程；不加控制面板說明、不恢復測試模式。物理／讀數／評分／schema／manifest及依賴不變；評估風險仍為既有formative／low-risk，無新保存狀態或rubric變動。
- 沿用已登記的活動browser入口，新增900–1920px桌面四步的實際圖域利用率、文字／尺邊界、控制欄寬度與內部溢位檢查；保留真實取點／移尺／吸附及手機回歸，在來源及真正解壓SCORM驗證。重跑四活動Node、check／check:tests、打包、文件及完整分支diff檢查，記錄實際結果。這輪不據此宣稱真Moodle、實體手機或OS縮放驗收。

### 桌面修訂驗證

- 新斷言先在基線runtime於1920×1000重現控制欄480px過寬並失敗；截圖`output/playwright/horizontal-projectile-lab/desktop-before.png`。最終桌面控制欄320–368px；1920×1000取點座標邊長由約608增至698px（約15%），兩軸保持同一比例；收窄面板的方向按鈕分組及既有高度提示換行，沒有增加說明文字。
- 四活動Node入口及mobile-scroll acceptance／reading probes通過，包含1128組保存／合法續作；check、check:tests（246 entries／213 Node／33 browser／48 helpers／2 manual）、活動17檔SCORM及文件檢查通過。16個runtime與ZIP逐byte相同，hash `6e7954f167c5254cd90eb23d3e077883886a2b12ffd64242e4d3afb00a0e829e`。
- 中途一次完整回歸在來源版pending頁的原有panel swipe斷言失敗，未完成報告另存`desktop-touch-incomplete.json`，不計作通過。以同一最終runtime、原有嚴格斷言隔離重跑全部八phase，source/package各連續三次全部通過：48 cases／228 gestures、completed=true/errors=[]，報告`desktop-touch-repro/report.json`。未重現固定活動故障；正式helper補上觸控前兩frame的layout／programmatic scroll readiness等待及失敗上下文，不增加重試或放寬捲動／可信事件／state斷言。首輪較早runtime的完整通過報告另存`desktop-intermediate.json`，不冒充最終版本。

- 最終正式完整source＋真正解壓SCORM回歸通過：212個版面、52組流程、360組操作／幾何觀測，completed=true/errors=[]；其中新增72個桌面版面（9尺寸×4步×2版本），含1920×1000／600／400、1440×900、1280×800／667、1024×768、900×650／400。原未離焦輸入、preview連續拖尺／鍵盤、六點100分、空白／部分、review／pending／committed、fullscreen及手機可信觸控仍全部通過。報告`output/playwright/horizontal-projectile-lab/report.json`於commit前執行，git metadata為899ffe4；以上runtime hash與最終提交內容一致。未執行其餘活動browser、全部213 Node、T1–T3完整矩陣、真手機／Moodle／Safari／OS實際縮放，沒有擴張發布聲明。

- 已提交選擇預覽base `899ffe48749bd4b4efe3074f144e78dee353f8f2`／runtime head `4443a7743b74702c9d1300fa265ac42c3d069333`為affected、214 entries（213 Node＋本活動一個browser）、僅本活動SCORM；報告`output/selection-preview-projectile-desktop-4443a77.json`。工作區及`main...HEAD`完整diff空白檢查通過；其後僅補本驗證記錄，不改已測runtime。

## 放大尺鍵盤焦點連續性（2026-10-19；本節優先）

- 先以可信Tab及連續兩次方向鍵重現放大尺離開對齊後失焦，再局部修正：若即將隱藏的放大尺target仍持有焦點，且可編輯量度頁的主尺可用，在隱藏前以focus({preventScroll:true})交回主尺。不得重設尺位、吸附、答案或捲動；指標capture中的既有target仍保留至手勢完成。
- 不修改物理／讀數／評分／snapshot及提交契約，測試模式維持徹底移除。現行主表清除殘留示例／預填及一般模式例外字眼，歷史驗證不改寫成新證據。
- 沿用活動browser入口，在source＋真正解壓SCORM以Tab進入放大尺、兩方向尺連續兩次跨尺方向鍵、反向返回對齊、Shift步距及主尺對照；檢查焦點、尺位、其他答案及scroll不變。重跑四活動Node、完整活動browser、check／check:tests、打包、文件與完整diff；未新增真手機／Moodle驗收。完成後commit、push及更新原私人Sites。

### 鍵盤修正驗證與發布

- 先在f232c0d的runtime加入真實Tab／方向鍵回歸，第一個來源版案例於第一次微調後失去預期尺控制焦點而失敗；`keyboard-before-fix.json`保留該次未完成報告，不作通過證據。修正只延後設定preview target.hidden，仍聚焦且主尺可用時在隱藏前focus({preventScroll:true})；pointer capture中的target保持原有行為。
- 最終source＋真正解壓SCORM browser完成140版面、52流程、360組操作／幾何觀測，completed=true/errors=[]；其中12組新鍵盤測例為兩版本×390×844／320×225／1280×800×兩尺。真實Tab進放大尺，第一次跨尺方向微調交回主尺，第二次照常再移1mm；Shift反向10mm、返回對齊後不搶焦點、主尺連續方向鍵均通過，既有答案／平均及document／panel捲動不變。原三項反例、連續觸控、取消／鎖定及正常空白入口回歸仍通過。報告`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `6ea19f2b9d05cbfb052eeaa33f4f42e2e5ea82a830e11528348f3089cd079341`。
- 四活動Node（含1128組保存／續作）、check、check:tests（246 entries／213 Node／33 browser／48 helpers／2 manual）、24個SCORM打包、文件及工作區／main...HEAD／f7ab989..HEAD完整diff通過。除main焦點處理外runtime逐byte等同f232c0d，不改物理、rubric、snapshot或頁面文字。沿用既有browser登記；committed selection preview以f232c0d與本輪提交比較，保存`output/selection-preview-keyboard-focus.json`，不代替未重跑的其他Node／browser或實體手機／Moodle／Safari／OS縮放驗收。
- 原私人Sites更新成功，owner-only保持；source `1de4a2491257c6dde9790903fcb8738fd4b19923`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_5953de2e93cc8191bf105e98a701621c`，deployment `appgdep_6ad635f181f08191a36ee0faf77afc50`原生succeeded。18檔archive `output/sites/horizontal-projectile-lab-keyboard-focus.tar.gz` SHA-256 `856ff473284b56d6abfe746e9a1908c611dba8d5726cf99bddf4c1446354351f`，16 runtime與來源／17檔SCORM逐byte核對，摘要`output/sites/projectile-keyboard-focus-assets.json`。已核對前一提交f232c0d的Quality run 39244833256為completed/success；本輪新CI另記`output/projectile-keyboard-focus-ci.json`，不預先聲稱綠燈。

## 正式移除暫時測試模式（2026-10-19；本節優先）

- 依使用者最新要求徹底刪除暫時測試模式：移除預填啟動、query入口、切換控制／文案／樣式，以及runtime model的practice函式、export與action。所有standalone入口（含舊test=1／0連結、根redirect、刷新及清除）正常由collect空白開始，不存在重新開啟測試模式的產品入口。以下歷史「暫時保留」及舊連結記錄只記當時版本，均已失效。
- 測試資料僅由未打包的test-support建構，沿用合法record/read操作；測試fixture不成為學生活動runtime。物理、讀數、rubric4／schema3／model1與正式評分不改；Moodle同attempt草稿／回顧／pending仍按原snapshot還原，不清除學生已有答案。
- 沿用四活動Node及source＋解壓SCORM browser入口，新增預設／舊參數無入口、刷新／清除不預填、空白0分及正常取點驗證；原保存、連續拖尺、四提交結果及手機版面回歸照跑。核對manifest及Site archive沒有test-support或模式代碼，check／check:tests／打包／文件／全分支diff後commit、push並更新原私人Sites，不添加控制面板說明。

### 正式版驗證與發布

- 四活動Node通過，1128組保存／續作與舊rubric分數保持；新增斷言runtime沒有practice export，舊practice action拒絕。六點測試fixture移至未發布的test-support，model只刪專用預填函式／action／export；scoring、persistence、ui-runtime逐byte等同b6de036。
- source＋真正解壓SCORM正式browser通過140版面、40流程、360組操作／幾何觀測，completed=true/errors=[]。預設、test=1、test=0、test=true&mode=test都由collect空白0分開始，無模式DOM／字樣／practice export；每個入口提交空白後刷新仍全新空白。正常釋放鋼珠可取點，清除抽新base但不預填，刷新清空standalone；同attempt Moodle續作、未離焦平均保存、連續讀尺、提交四結果、pending及只讀回顧仍通過。目視`source-normal-entry-empty.png`，報告`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `c7c5e00e031022fb308ec00590dde0ee8dee0627f6f318f2721ba2f02d7573d3`。
- check、check:tests（246 entries／213 Node／33 browser／48 helpers／2 manual）、全部24個SCORM打包、文件連結及工作區／main...HEAD／f7ab989..HEAD完整diff通過。本輪實際重跑四活動Node與本活動browser；不將登記／selection當作其餘209 Node或32 browser通過。Committed selection preview以b6de036與本輪提交比較，保存`output/selection-preview-normal.json`。未新增真Moodle／實體手機／OS200%驗收。
- 原私人Sites更新成功，owner-only保持；根redirect指向同一正式入口，保留的舊query亦不能啟動預填。官方helper source `3410262ce9f7e91e26efae67a29dc594e718e785`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_7ea9d4b387a08191b8eb3940f9f5d4f2`，deployment `appgdep_6ad5fe9be9c481919e14742b6a8b80d0`原生succeeded。18檔archive `output/sites/horizontal-projectile-lab-normal.tar.gz` SHA-256 `805131ad20c5586b77be73a52fe1fb2306bb500eb5420341298554632c2b092f`；16 runtime與來源／17檔SCORM逐byte相同，archive無test-support／測試模式文案及程式入口，根redirect及hosting metadata核對，摘要`output/sites/projectile-normal-assets.json`。前一提交b6de036的GitHub Quality run 39212403854已核對completed/success，本輪CI另記`output/projectile-normal-ci.json`，不預先宣稱綠燈。

## 檢查頁排版整理（2026-10-19；本節優先）

- 僅整理檢查頁：完成情況改為對齊的名稱／數值清單，返回各步採固定兩欄，提交使用獨立全寬主按鈕；桌面限制閱讀寬度，短屏保留面板捲動。檢查時收起重複檢查鈕及模式切換區，頁首仍標示測試模式；返回編輯後模式切換照常可用。不增加操作說明文字。
- 不改物理、讀數、評分、rubric4／schema3／model1、權威snapshot、提交／重試生命週期及standalone／Moodle保存契約。暫時預填測試模式保留；共用runtime及manifest相依不變。
- 沿用既有browser入口核對source及解壓SCORM的空白／部分／完整檢查、返回編輯與提交、窄長／短屏／桌面邊界及可觸控按鈕；重跑活動Node、check／check:tests、打包／文件／完整分支diff，並目視手機截圖。既有未離焦保存與連續讀尺回歸照跑，完成後commit／push並更新原私人Sites。

### 檢查頁驗證與發布

- source＋真正解壓SCORM正式browser通過140個版面、40組流程、360組操作／幾何觀測，completed=true/errors=[]；其中新增36組檢查頁（六尺寸×空白／部分／完整×兩版本）。涵蓋320×225／400、390×600／844、596×1280及1280×800；實際返回四步並保存答案、可信點選提交後核對原評分、短屏可信touch只捲面板且提交鈕可達。原未離焦平均重載、連續讀尺、只讀／pending／重試回歸仍通過。報告沿用`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `6ef6b308599c31824e200ba15faaaa63cfd93637b55ae88a8103805a9b29b74e`。
- 已目視`source-check-partial-390x844.png`及`source-check-complete-390x844.png`。四個活動Node通過（含1128組保存／續作）；check、check:tests（246 entries／213 node／33 browser／48 helpers／2 manual）、全部24個SCORM打包、文件及工作區／完整分支diff通過。model/scoring/persistence/ui-runtime逐byte等同a34feda；本輪只改活動呈現及既有browser入口，未重跑其餘209 Node或其他32 browser，亦不宣稱真手機／OS200%／Moodle驗收。Committed selection preview以a34feda與本輪提交比較，保存於`output/selection-preview-check-layout.json`；僅代表選擇範圍。
- 原私人Sites更新成功，owner-private、暫時預填模式保持。官方helper推送source `6e5064dee24173240b5b8a282dcd6e4038eec0e8`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_94bcadb1b6688191bcb1b75f89e6450e`，deployment `appgdep_6ad5bdebd8a08191a40ae78ea2ec00be`原生回傳succeeded。18檔archive `output/sites/horizontal-projectile-lab-check-layout.tar.gz` SHA-256 `e1464b79d207e9ee7586ee670b75adc9a56f71c69992b1c72dd64d6833e041a6`，16 runtime與來源／17檔SCORM逐byte相同，根redirect及hosting identity核對，摘要`output/sites/projectile-check-layout-assets.json`。前一提交a34feda的GitHub Quality run 39200849082已核對completed/success；本輪push的CI另核對，不預先聲稱綠燈。

## 未離焦保存、短屏續量與取樣回饋（2026-10-19；本節優先）

- F1：平均欄有效input即經既有controller command更新state及共享SCORM保存；清空記null，badInput／非有限／負值不覆寫上一有效答案，change保留原有確認／錯誤處理。不新增活動離頁保存，不改standalone刷新全新或Moodle同attempt續作。
- F2：主尺仍可拖；放大窗內可見尺身增加同一ruler操作的透明本地target（至少44px），只覆蓋實際放大尺身、不遮四選項、無新說明文字。沿用主圖座標位移及既有吸附、capture、取消／第二指／blur回復，拖動中不保存；從預覽讀完可直接拖往下一印記，不必歸原點。target位於stage而非會隱藏的卡片子樹，預覽暫時失去對齊仍保持原pointer capture至完成／取消。
- F3：兩個取樣detail補上實際有效高度數及cm跨度，僅補回饋，不改任何分數或rubric。新snapshot shape／schema3/model1/rubric4、舊版分數及版本兼容保持；新target為瞬態，不加入保存欄。
- 驗證：真實輸入1.657且不離焦→立即Moodle重載，與先檢查對照；0／清空／invalid、失敗保存及只讀保護；短屏320×225／400、390×400、500×400及較大對照，六點×兩尺，選讀數後不歸零直接拖向另一點；檢查新target對準可見放大尺身、44px選項及可信touch全owner／取消路徑。source＋解壓SCORM皆驗，既有Node／browser／manual owner沿用，不新增依賴。保留暫時測試模式，不加控制面板提示；完成後commit/push並更新原私人Sites。

### 三項反例修正驗證與發布

- 最終runtime head `e6e66e53d706a14f09dfa894e3ceaf9cf4edfe79`。四個活動Node及全部213個Node入口通過，報告`output/ci-tests/projectile-continuous-final-node/report.json`；1128組保存／續作及舊版分數仍通過。F3只新增detail.answer（6個有效高度、75cm），沒有修改得分條件、版本或權威snapshot欄。
- 正式source＋真正解壓SCORM browser在此head通過104個版面、40組流程、360組操作／幾何觀測，errors=[]。新增可信Input.insertText→維持meanV聚焦→立即重載，同LMS attempt仍保留1.657及100分；先檢查作對照亦相同。另驗0／清空／負值不覆寫、失敗保存及重試後重載、只讀鎖定。保留原standalone刷新／Moodle續作分流。mock LMS在測試專用sessionStorage模擬後端durability，沒有將standalone持久化加進runtime。
- 168組source/package×七尺寸×六點×兩尺，實際點選讀數後不按歸原點，從可見放大尺身可信touch移到相鄰印記；控制尺寸含320×225/400/500、390×400/600/844及500×400。均核對target在真正放大尺身範圍且至少44×44、四選項≥44px、卡片在畫布內、放手才改尺位、讀數不變、捲動不變及新目標紅黑點重合。短屏主尺可能仍在卡片下方，修正提供的是直接可拖的可見放大尺身，沒有冒稱主尺已不遮擋。已目視`source-continuous-preview-320x225.png`；F3實際100分回饋DOM顯示有效高度數及75cm數學標記，沒有「你的作答：未答」。
- T1/T2/T3×source/package×實際iframe高度225/400（外層亦320×225/400），兩尺preview共24 cases／312 gesture checks通過。12份`repair-T{1,2,3}-{225,400}-{source,package}.json`均completed=true/status=passed、errors及每個issues空；`repair-touch-summary.json`記錄head及計數。包含完成、cancel、lostcapture、blur、第二指及每move/release owner／canonical state。初輪中斷測試沿用上一條完成後已移走的尺位而失敗；helper現經production command將每條還原同一合法起點，未移除capture／可信／取消不保存斷言，active target亦固定至手勢結束。中間失敗報告不當本輪通過證據。
- `check:tests`仍246 entries／48 helpers／2 manual；`check`、全部24個SCORM打包、文件連結、工作區及main...e6e66e5／f7ab989..e6e66e5全範圍diff通過。17檔本活動ZIP及Site archive runtime逐byte核對。Committed selection preview base `cca930f`／head `e6e66e5`為full、246 entries、packages=all，存於`output/selection-preview-continuous-final.json`；不當其餘32 browser或全phase手勢／OS縮放／真手機／Moodle T4通過證據。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)更新成功，owner-private及暫時測試模式保持。官方helper推送source `06bb64eafa4107896d9e5ed24c6b0a6fcde351e2`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_433850f9c9e881918adcad5cd02db4ad`，deployment `appgdep_6ad59f58ba308191a3c027b7b7b3fc10`原生回傳succeeded。Archive `output/sites/horizontal-projectile-lab-continuous-e6e66e5.tar.gz`共18檔，SHA-256 `20d58a4bb9d7aff36d9b30d492bb466bc1d16f35a42278842f531da469cf12f7`；16 runtime、根redirect及hosting metadata核對，證據`output/sites/projectile-continuous-assets.json`。runtime hash `52e6325ddc8acafcf45583aa534f13a41df0dc2adde7aa4bf4bf689ac47709a9`。後續文件提交不改runtime，GitHub新run結果另記交付回覆／`output/projectile-continuous-ci.json`。

## 審核四項跟進（2026-10-19；現行主表優先）

- 清除EOF額外空行，更正歷史全分支diff聲明及GitHub CI紀錄；工作區、main...HEAD與原合併基範圍分別驗證。
- 手機helper改用實際小數落點，比較主圖及preview紅黑點；活動browser重用同一probe，mobile-preview fixtures沿尺移動以覆蓋保持對齊的可信touch路徑。
- 現行評分／容差、四步state及transition、schema／authority／舊版策略及測試主表已整併；平均容差、未評分但嚴格校驗的clockMs亦明列。歷史驗證摘要不冒稱本輪結果。
- 僅在v1/v2鎖定回顧為square補回既有模型名稱；新選單仍只有linear/quadratic，不修改答案、物理、讀數、rubric或保存契約。使用者要求保留暫時測試模式，控制面板不加提示段落。
- 依舊有四活動Node、mobile-scroll契約測試、source＋解壓SCORM完整browser及相關T1–T3可信touch驗證；helper改動按登記選擇預覽記實際scope，無關browser／真手機／Moodle不冒稱已驗。最後commit/push及更新原私人Sites。

### 本輪驗證與發布

- Runtime head `3b09f71e6bbf1fd0d9f2a3b0db97cb19e6f179e0`。全套213個Node入口通過，包含四活動入口／1128組round-trip續作、mobile-scroll probe正確小數／舊rounded／偏移／錯slot／無目標檢查；報告`output/ci-tests/projectile-audit-node/report.json`。正式source及真正解壓SCORM browser通過104個版面、34組流程及192組操作／幾何觀測；兩版v1/v2回顧均實際核對disabled選單值square、名稱及公式、原100分保留。兩尺主圖／preview同一probe亦逐次在拖動中及放手後核對。報告`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `8e42d8183d32a0b627ce79ad1ef56c292ac86f056dae28679100ff96ca777546`。
- T1/T2/T3×source/package×320×500及390×844，兩尺preview沿尺移動及submitted三個profiles全部通過，共36 cases／408 gesture checks；六份`audit-T{1,2,3}-{source,package}.json`均completed=true/status=passed、errors及每個issues為空，摘要`audit-touch-summary.json`同browser目錄。可信touch完成、cancel、lostcapture、blur、第二指、host/panel及canonical答案逐move/release均核對。這是本輪所選三個profiles，未冒稱全phase／OS縮放／真手機或Moodle T4通過。
- `check:tests`為246 entries／48 helpers／2 manual，`check`、全部SCORM打包、文件連結及工作區diff通過；17檔本活動ZIP及18檔Site archive的16個runtime逐byte核對來源。已執行`git diff --check main...3b09f71`、`f7ab989..3b09f71`及`345b580..3b09f71`全範圍，均exit0；不再用最後增量代替完整分支。頁面index/styles、model/scoring/persistence逐byte等同345b580，測試模式保留且無新控制面板說明段落。
- Committed selection preview base `345b580`／head `3b09f71`為full、246 entries、packages=all（既有mobile-scroll-cases helper的保守fallback）；存於`output/selection-preview-audit-fixes.json`。本輪實際重跑全部213 Node、本活動browser、上述manual範圍及所有SCORM打包；未把預覽當其餘32 browser已通過。新GitHub push的run及checks結果另記交付回覆／`output/projectile-audit-ci.json`，此處不預先聲稱完整CI綠燈。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)更新成功、owner-private保持。官方helper推送source `694b829ab2836766ab463e2771b2aaf61cf2e810`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_0d85844b460481918403dc5688640a31`，deployment `appgdep_6ad4f6cc9b8481919c1c7a7e27f93843`原生回傳succeeded。Archive `output/sites/horizontal-projectile-lab-audit-fixes-3b09f71.tar.gz` SHA-256 `f08f70f2d6ee54247232ae0575f9e70b9a9b0d920638bb0f6cd95a59994956d1`，runtime／根redirect／hosting metadata逐byte或JSON核對，證據`output/sites/projectile-audit-fixes-assets.json`。後續文件提交不改runtime。

## 控制面板精簡（2026-10-18；本節優先）

- 各步只保留學生任務：六點取樣、對零讀取x/y、選模型及分類、選公式求平均。移除方向鍵／Shift操作說明、吸附機制／錯零選項解釋、重複stage提示、逐點轉記清單及冗長運算說明；保留必要物理條件、5cm取樣限制、進度、暫時測試模式標示及技術／提交狀態。
- 文字調整不改操作、物理或讀數；評分依下節使用者選定規則。沿用既有測試入口，檢查source及解壓SCORM各尺寸／流程，記錄check:tests、committed selection preview、check/package及文件／diff，再更新原私人Sites及commit/push；真手機／Moodle另驗。

## 六點平均準確度評分（2026-10-18；本節優先）

- 使用者選定：保留計平均的運算分；量齊六點先可取得準確度分。新實驗rubricVersion=4，schemaVersion/modelVersion仍3/1。運算4分沿用至少兩個有限派生速度、與自己的有效速度平均一致及原容差；準確度4分另要求六列均有完整讀數並產生有限速度，以及原10%準確度容差。六點完整但平均錯誤不給準確度分；僅留下六個印記、缺單軸讀數或零時間均不算完成六點。2至5點仍可填平均、檢查及提交，其他獨立分數保留，不封鎖部分作答。
- 版本策略：權威schema不新增欄位，以既有rubricVersion保存評分契約。validator僅接受schema3配rubric3/4，舊schema1/2仍須對應原rubric。既有rubric3的draft續作／review／pending保持原分，不自動升級；新實驗與明確清除後重做用rubric4。四個view、edit/check/return、review/pending沿用現行矩陣；增加兩種rubric的production round-trip、合法續作／提交／frozen重試及錯版拒絕。
- 測試0至6有效點、六印記未讀齊、零時間、錯公式follow-through、錯平均、四點新82分／舊86分、完整100分、空白0分及新舊review／pending。範圍為現有model fresh版本、scoring、persistence validator、既有四Node及browser入口；依賴／manifest／手勢及量尺幾何不改。執行source＋解壓SCORM完整browser（含可信touch），不重跑T1–T3全矩陣或無關活動；真手機／Moodle仍未實測。

### 精簡面板及六點平均驗證與發布

- Runtime head `ae62bf57cdcfeafeb1f0a40e8d76cab686fe742a`已commit/push。四個Node入口通過：0至6有效點、缺單軸／零時間／錯平均、錯公式follow-through、rubric3/4各phase共1128組production draft round-trip及合法續作；舊draft續作／review與新舊部分作答四提交結果及frozen重試通過。正式source＋真正解壓SCORM browser通過104個版面、34組流程及192組操作／幾何觀測；兩版均實際提交新兩點68分／四點82分／六點100分，平均兩分項分別4/0、4/0、4/4；舊rubric3四點86分及重新載入後可信review不變。保留可信touch、空白／部分提交、紅黑點重合及舊版回顧。報告`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `88514aa3fa9e9233a58a245b01dd81f7ec1906d065ee0630fb5e0f9dc2533def`；已目視手機`source-average-concise-panel.png`，沒有重複操作提示。
- `check:tests`為246 entries／48 helpers／2 manual，`check`、17檔活動SCORM、文件連結及diff檢查通過；ZIP與來源runtime逐byte相同。Committed selection preview base `a08f3e8`／head `ae62bf5`為affected、214 entries、單一活動package，存於`output/selection-preview-concise-six-point.json`。本輪只實際重跑四個相關Node及本活動browser，未冒稱其餘209 Node／32 browser、T1–T3全矩陣、GitHub CI、真手機或Moodle通過。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private保持。官方helper已推送Site source `4dbdaa4e59d345ef4809b650fe8dae2f9b408593`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_7bb431abad14819185f79eeab23f331d`，deployment `appgdep_6ad4eb7595ac8191aeddf32061ba86f2`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-concise-six-point-ae62bf5.tar.gz`共18檔，16個runtime及根redirect逐byte核對，hosting metadata等同來源JSON；SHA-256 `a31dca3058bddc00814dc3e12c73cc28420ef0be8e47c896125ff8696703f13f`，證據`output/sites/projectile-concise-six-point-assets.json`。後續文件提交不改runtime。

## 吸附後讀尺紅黑點重合（2026-10-18；本節優先）

- 修正整毫米吸附與帶小數實際落點在放大窗中的橫向偏移。只在已對齊印記時，將尺邊的垂直於量度方向之顯示座標對準實際落點；主圖及放大窗共用相同幾何，紅點與黑點中心完全重合。沿尺方向零位及刻度位置不變，不修改實際落點。
- 形成性評量、100分rubric、依賴、四步／phase／variant矩陣及權威snapshot沿用現行版本（schema/model/rubric 3/1/3）。整毫米ruler.zero、讀數選項、答案、物理模型及評分不變；顯示校正屬瞬態派生資料，不持久化，不遷移舊答案。
- 範圍限main繪圖、既有browser入口及本計劃，不新增依賴或測試入口。驗證兩尺方向、六點含小數兩側、正／錯沿尺零位、主圖與preview中心重合、尺邊一致、拖動中及放手後；對照原選項、權威狀態及分數。沿用四個Node入口檢查評分／production round-trip及合法續作，執行source＋真正解壓SCORM browser含可信touch、check:tests、check／package、committed selection preview及diff，再commit/push並更新原有私人Sites。未改手勢流程或觸控surface尺寸，不重跑無關活動或T1–T3全矩陣；真手機／Moodle仍須另驗。

### 重合修正驗證與發布

- Runtime head `24f775a0a03add53328dce3c619cd6389211ce1a`已commit/push。四個活動Node入口通過，包括564組draft round-trip／合法續作、空白／部分／100分及舊版分數；model、scoring及persistence逐byte等同base `5ceb8b8`。正式source＋真正解壓SCORM browser通過104個版面、28組流程及192組操作／幾何觀測；新增144組（三尺寸×六點×兩尺×正／錯零位×source/package）主圖與preview紅黑中心精確相等、尺邊一致、resize前後權威狀態／分數／選項不變，既有拖尺中與放手後亦逐次核對重合，原有可信touch及提交流程通過。報告`output/playwright/horizontal-projectile-lab/report.json`，runtime hash `9e5d08a3495c00feedc4fcefc4298322cd74bc1f7e84002dbcb23b2923c87c8f`；已目視手機`source-reading-centres-aligned.png`。
- `check:tests`為246 entries／48 helpers／2 manual，`check`、17檔活動SCORM、文件連結及diff檢查通過；ZIP與來源runtime逐byte相同。Committed selection preview base `5ceb8b8`／head `24f775a`為affected、214 entries、單一活動package，存於`output/selection-preview-ruler-alignment.json`。本輪只實際重跑四個相關Node及本活動browser；未將選擇預覽冒稱其餘209 Node／32 browser、T1–T3全矩陣、GitHub CI、真手機或Moodle通過。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private維持。官方helper已推送Site source `71d1f02bd8d0130789715e2403217eb0db862702`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_929db6c907088191bc6469d59188a362`，deployment `appgdep_6ad4e93a525c8191b8d3f93b9d44a7c3`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-ruler-alignment-24f775a.tar.gz`共18檔，16個runtime及根redirect逐byte核對，hosting metadata等同來源JSON，無macOS附加檔；SHA-256 `5c899d193e2538d3a3a3796b1453607804a7b578a18d492244787d7778e58e0b`，證據`output/sites/projectile-ruler-alignment-assets.json`。後續文件提交不改runtime。

## 讀尺選項稍為拉開（2026-10-18；本節優先）

- 干擾值以目前尺面讀數為基準，由相隔1mm改為3mm（0.3cm），一般四項跨度9mm；錯零位須排除真正位移時可略為加闊，邊界向尺域內補足四項。仍只用整mm、四個互異及0–1000mm尺域，正零位唯一正確、錯零位四項全錯；不回到1–2cm的大間隔。例26.7cm可顯示26.1／26.4／26.7／27.0cm，順序仍按幾何輪換。
- 只改活動model.rulerChoices()生成距離及相關既有model／browser斷言；尺面放大比例、吸附、拖動／touch、物理波動、正確整mm讀數、rubric與schema（3/1/3）不改。舊draft/read保持原值，還原時重建新選項，不把舊答案改成新選項。共用程式／manifest無改動。
- 驗證3mm最小間隔、一般9mm跨度、26.7cm實例、水平／豎直與正零／錯零／邊界四選項及唯一正解，並保留production round-trip／舊分數。執行四個活動Node、source＋解壓SCORM browser含手機可信touch讀尺及新版截圖、check:tests／committed selection preview、check／活動package／文件與diff，再更新同一私人Sites、commit/push。觸控surface與幾何無變，不重跑T1–T3全矩陣或無關活動；真機／Moodle限制保留。

### 3mm選項驗證與發布

- Runtime head `042b1301301079c20c92913e93bb39e8eb873d73`已推送；四個活動Node入口通過，包含水平／豎直、正零／錯零／尺端四項互異及至少3mm間隔、正常9mm跨度、26.7cm實例，並保留564組draft round-trip／續作及舊版分數。正式source＋真正解壓SCORM通過104個版面、28組流程、48組操作觀測；兩版均於390×844顯示261/264/267/270mm並成功點選267mm，原有四尺寸正零唯一正解／錯零全錯／可信touch選項／還原／只讀均通過。已目視`source-three-mm-reading-options.png`：手機放大窗內選項清楚，無新增幾何或拖動surface。報告`output/playwright/horizontal-projectile-lab/report.json`。
- `check:tests`仍246 entries／48 helpers／2 manual，`check`、17檔活動SCORM、文件及diff檢查通過；ZIP runtime逐byte等於來源，16資產hash為`64dcf8beece93abd2cfff43b23384f7752cb36f67ea7d6b94bd972297d43b0e6`。Committed selection preview base `1bb9a8e`／head `042b130`為affected、214 entries、單一活動package，存於`selection-preview-three-mm.json`；僅四個相關Node與本活動browser實際重跑，其他209 Node／32 browser、T1–T3完整矩陣、真手機及Moodle未重驗。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private維持。官方helper推送Site source `03cc60899e7ba4537db902f3c2650203f0c7e1fa`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_b99da65f3fc8819184205c805ef884f7`，deployment `appgdep_6ad4d4a689948191af6cd794a3039a01`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-three-mm-042b130.tar.gz`共18檔，16 runtime與根redirect逐byte核對、hosting metadata等同來源JSON，SHA-256 `826969a8e93d09c038ba5d5d1a7da0fd8130848416b98dac783f2fb978a2df7f`；資產證據`output/sites/projectile-three-mm-assets.json`。後續文件提交不改runtime。

## 平均初速度不提供解法提示（2026-10-18；本節優先）

- 移除速度表下方的納入點名／n、缺列不補零／錯公式有限結果保留說明，以及平均公式。只保留平均初速度名稱、TeX符號／單位與一次輸入；檢查頁不另提示平均所用n。其他公式選擇、四步、測試預填及量尺不改。
- 本次只刪提示，不改model、rubric或schema（仍3/1/3）。維持至少兩個有限派生速度才可填平均，以實際有效列數作分母；少於六列不按比例扣平均分，平均運算4及準確4仍可全得。缺印記每列少取樣1及兩讀數6，另依原跨度規則計分；例如四個正確完整點且跨度至少50cm、其餘正確，總分86。已記錄但未讀完整的列只按各讀數是否正確給分，不將它誤算成缺印記。既有draft/review/pending不變。
- 範圍限index/main、相應scoring測例／browser斷言及本計劃；新增兩至五列有效速度仍可得平均8分、零／一列平均0分，以及四點86分實際提交測例。沿用既有登記，執行四個活動Node、source＋解壓SCORM含手機可信touch、check:tests／committed selection preview、check／活動打包／文件與diff，再更新同一私人Sites、commit/push。刪除靜態提示不改拖動或捲動契約，不重跑T1–T3全矩陣或無關活動；真機及Moodle仍未實測。

### 無平均提示版驗證與發布

- Runtime head `0ce7b60e6cd5caa7d45da9de3f1166def700cbbd`已推送；四個活動Node入口通過，新增0至6有效列的平均評分及review round-trip斷言，2至6列平均均8分，分散四點總86分。正式source＋真正解壓SCORM通過104個版面、26組流程、48組操作觀測；兩版均實際輸入四點平均、提交86分，平均兩項各4分，檢查頁沒有「納入」提示。平均輸入及單位保留、formula與included區域移除；報告`output/playwright/horizontal-projectile-lab/report.json`，截圖`source-average-without-hints.png`／`package-average-without-hints.png`。
- `check:tests`仍246 entries／48 helpers／2 manual，`check`、活動17檔SCORM、文件與diff檢查通過；ZIP runtime逐byte等於來源，16資產hash為`9ca11d1740823ffd9fd47d74d5653e2251e66330543a91e84c284b545535bdd1`。Committed selection preview base `09a02bf`／head `0ce7b60`為affected、214 entries、單一活動package，存於`selection-preview-mean-no-hints.json`；本次只執行相關四個Node與本活動browser，不將選擇預覽當其他209 Node／32 browser通過證據。T1–T3完整矩陣、真機及Moodle未重驗。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private維持。官方helper推送Site source `486bcbab8422549ffa7f7130a77e97ff00e8ff46`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_4653b92343f48191a3a0752f05390c53`，deployment `appgdep_6ad4d2f55e9c8191aba4538e034c57e0`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-mean-no-hints-0ce7b60.tar.gz`共18檔，16 runtime與根redirect逐byte核對，hosting metadata等同來源JSON；SHA-256 `7c67ba93c79c7b8b408b10f1348d6353fdc9e882eb30d9b4d7311eb115e8daed`，資產證據`output/sites/projectile-mean-no-hints-assets.json`。後續文件提交不改runtime。

## 移除反比例選項（2026-10-18；本節優先）

- 依最新要求，新作答只提供一次函數與二次函數，兩者繼續將原點納入擬合。其餘四步、100分rubric、公式／平均、隨機速率及測試模式不改，不新增依賴或manifest資產。
- schemaVersion/modelVersion/rubricVersion仍3/1/3，權威欄與phase矩陣沿用四步版。為保留已保存v3反比例作答及原分數，decoder與既有失敗擬合結果仍接受inverse；不將它默認為另一模型、不清空紀錄。還原時顯示選項已移除，學生可改選一次／二次或清除；原review／pending維持只讀及同payload重試。新model動作拒絕inverse，舊inverse狀態不提供再擬合按鈕；檢查及部分提交仍可用。
- 範圍只及活動index/main/model、相關既有測試／browser入口及本計劃。執行四個活動Node入口、source＋解壓SCORM瀏覽器（包括手機可信touch、舊inverse還原後重選及原review分數）、check:tests、committed selection preview、check／活動打包／文件與diff檢查，再更新同一私人Sites及commit/push。此選單刪項不改拖動／捲動／其他phase；不額外重跑上一版T1–T3全矩陣或其他活動測試，實機／Moodle限制保留。

### 兩模型版驗證與發布

- Runtime head `6f057360a34da4683a4b2b5b6b7ee83dfe3e102e`已推送。四個活動Node入口通過（564組draft round-trip／續作及v3舊inverse的四提交結果／pending同payload重試）；新model動作拒絕inverse，舊答案保留。正式source＋真正解壓SCORM通過104個版面、24組流程、48組操作觀測；新增舊inverse未擬合／已嘗試兩種draft逐一還原、改選二次後100分提交、保留原作答80分及刷新只讀review。手機可信touch仍由正式browser執行；報告`output/playwright/horizontal-projectile-lab/report.json`。目視桌面擬合畫面正常，無新增版面元件。
- `check:tests`仍246 entries／48 helpers／2 manual，`check`、活動17檔SCORM及文件／diff檢查通過；最終ZIP的16 runtime資產逐byte等於來源，資產hash為`83b7861419480ec3205cb8d1e3bd837331d67247a82eed4ceca7ea5289ecc89f`。Committed selection preview base `a19260a`／head `6f05736`為affected、214 entries、單一活動package，存於`selection-preview-no-inverse.json`；這是選擇證據，不代表本次執行其他209 Node或32 browser。T1–T3完整矩陣、OS縮放、真手機及Moodle均未重驗。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private維持。官方helper推送Site source `c084b6840306571921bfd7bd1a8c881381b8df67`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_7315646cef6081919fef7ed2cd7c40a6`，deployment `appgdep_6ad4d15027f88191812aedb197f86de3`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-no-inverse-6f05736.tar.gz`共18檔；16 runtime及根redirect逐byte核對、hosting metadata等同來源JSON，SHA-256 `eeb66b3d2fea99fc0f8750c8af1d688ae1053a402bdcead78b68a788b61e8c36`。資產證據`output/sites/projectile-no-inverse-assets.json`；後續文件提交不改runtime。

## 四步簡化及原點擬合（2026-10-18；本節優先）

- 四步依次取點、量度、擬合、公式與平均；刪除第五步、獨立計時概念題及由擬合估速比較。保留兩個公式各選一次、自動套用六列讀數，以及一次平均初速度輸入。暫不新增方程解讀問題。測試模式仍只預填前兩步，隨機速率、量尺及點名避讓不改。
- 只提供一次函數、二次函數、反比例函數。新擬合資料為學生完整read（mm轉m）加已知原點一次；若已有[0,0]仍只保留一次原點。一次／二次均為一般最小二乘，加入原點是一筆已知觀測，並非另設強制零截距模型。反比例在x=0沒有定義，顯示不適合這組包含原點的資料，不刪除原點或產生虛構曲線。明確按擬合才顯示結果；只顯示方程及座標單位，不再解釋係數、RMSE或模型複雜性。
- 風險仍為formative／low-risk，無秘密或可信伺服器評核。新版100分：分散取樣10、十二讀數各3分共36、二次模型選擇10、成功執行擬合10、拋物線分類10、兩公式各8共16、平均運算4及接近實際平均4。空白0分、部分獨立得分、錯公式平均運算follow-through；及格60，不新增作答門檻。
- schemaVersion=3、modelVersion=1、rubricVersion=3；權威欄為launchOffsetPpm（可選舊缺省0）、rows、fit、trajectory、formulas、meanV。刪除fitV／clockShown／gFromClock／conclusions；draft另含phase/view/returnToCheck/setup/ruler。view只collect/measure/plot/speed；fit.model為null/linear/quadratic/inverse；review不含暫存phase。外層SCORM envelope維持version1。既有v1/v2已提交與pending保留原validator、擬合和評分供只讀回顧／同payload重試；舊未完成draft不遷移及不覆寫，顯示需原版或教師開新attempt。

| 可保存狀態 | 必要／可空資料 | 合法續作 |
|---|---|---|
| edit × 四view | 空白、單軸、少點、正誤公式、有效／失敗擬合均合法；平均需兩個有限速度 | 修改本步、前後步或檢查 |
| edit × 返回檢查 | 原答案可保留，returnToCheck=true | 修改或返回檢查 |
| check × 四view | 保留部分答案，returnToCheck=false | 返回任一步或明確提交 |
| review v1/v2/v3 | 版本對應的權威答案及原rubric，無可編輯欄 | 只讀四步／分項回饋 |
| pending v1/v2/v3 | 同一合法review及原分數，凍結 | 驗證後重試同份payload |

- 資料依賴：讀數／投球改動清平均及擬合attempted；改模型清擬合attempted；改公式清平均；未量好的列不補零。origin為派生已知基準，不存入rows或增加速度計算列。新版拒絕刪除欄混入權威答案及motion view；舊review不改解讀。保存／還原上限4000 bytes，無standalone持久答案。
- 範圍：活動model/scoring/persistence/main/index、必要styles、四個既有Node入口／test-support、正式browser與mobile fixtures、catalogue文字及本計劃。沿用共用fitting/SCORM/flow/TeX及16項manifest，不加依賴。驗證原點影響擬合、反比失敗、四步末步導航、空白／部分／100分、所有phase round-trip及續作、舊v1/v2 review和pending不改分、手機source與解壓SCORM。執行check:tests、committed selection preview、相關Node/browser、package/check及文件檢查，再更新同一私人Sites、commit/push。未實測真手機／Moodle的限制另列。

### 四步版驗證與發布

- 已推送runtime head `558688f75ff5f20299687b8771a89612aa701d18`。四個活動Node入口通過：原點只加入一次、一般直線／二次擬合與含原點的共用fitting結果相同、反比不得略去原點、新100分／空白0分／錯公式平均follow-through、四步空白提交、564組draft round-trip及實際公式續作。v1/v2原100分review、pending同payload重試及未完成draft不覆寫均通過；v3拒絕已刪欄位及motion view。最大測例draft/review/pending為853／752／993 bytes。全部213 Node入口三批各71項通過，報告`output/ci-tests/projectile-four-stages-node-{1,2,3}/report.json`。
- 正式browser於同一head的source及真正解壓SCORM通過104個版面、22組流程、48組操作觀測，報告`output/playwright/horizontal-projectile-lab/report.json`。新增三種選單／原點參與兩種有效擬合／反比原點失敗、移除第五步與fitV控制、第四步直接檢查、完整100分流程；保留量尺／輕微波動／暫時預填、blank/partial、四提交結果及兩個舊版review的實際渲染與舊draft不覆寫。已目視`source-trajectory.png`及`source-mobile-space-plot-320.png`：原點、六點及曲線清楚，四步進度及簡短方程正常。
- 本次觸控範圍為第三／四步已答與未答、擬合失敗、check、submitted、pending、committed九個profiles；T1/T2/T3×source/package×320×500及390×844通過108 cases／1500 gesture checks。六份`four-stages-T{1,2,3}-{source,package}.json`均completed=true／status=passed、errors與每個issues皆空；摘要`four-stages-acceptance-summary.json`。首兩步兩種拖動的中斷路徑由正式browser及上一輪完整touch證據覆蓋，本次不冒稱重跑這兩步的全部iframe profiles。
- 六份touch報告17檔digest皆`19e38a54b51541ea53d7165e771827894d747f81980d21c21afe25f36e25d32f`，正式browser16資產hash為`f3d0034394439ba4dc014619fbcab2154e06c3fe87f1f3dbd7208debef61f91a`；最終SCORM17檔逐byte等於來源。`check:tests`為246 entries／48 helpers／2 manual，`check`、全部24個package、文件及diff檢查通過。Committed selection preview base `9f05e10`／head `558688f`為full、246 entries、packages=all，存於`selection-preview-four-stages.json`。未重跑其他32 browser、GitHub CI、OS縮放、實體手機或真Moodle，不改稱其總閘通過。
- [原有私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，owner-private權限保持。官方helper推送Site source `1749e7d7d25282122dc8df872fa63d2f64e16db4`，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_1d5f29a9762c8191b22ce5a22d861ace`，deployment `appgdep_6ad4bb9bf9f48191af490e2bfdaa54aa`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-four-stages-558688f.tar.gz`共18檔，16個runtime資產及根redirect逐byte核對，生成hosting metadata與來源JSON相同；SHA-256 `fa59d44e7bae5f6d9d096f98429ee94d8ce46ed5aea9f36427ac8575676bad27`，資產證據`output/sites/projectile-four-stages-assets.json`。預設仍暫時測試模式，只完成首兩步；一般模式與Moodle仍從空白開始。後續文件提交不改runtime。

## 橫軸避讓、每輪隨機初速度及暫時測試模式（2026-10-18；本節優先）

- 點名候選先左上，再左邊／上方；排除與橫軸及其數字區域相交的文字框。靠近橫軸時左方候選下移至軸下安全位置，不再強行放左上。原有畫布邊界及尺身避讓維持，沒有新拖動目標。
- 保留同一輪每球約±1%速率波動，另在新實驗／清除重做時抽一次launchOffsetPpm∈[-300000,0]，基準速率為既有SPEED×(1+launchOffsetPpm/1e6)，約1.16–1.66m/s；每球總offset=round(base+(1+base/1e6)×jitter)，jitter∈[-10000,10000]。同一輪base不再抽，實際速率仍低於固定斜槽的理想能量上限；新增差異視為新一輪虛擬裝置的出口速率設定。時間／重力不改。投球動畫、印記、量尺、評分及參考曲線全用同一實際offset／本輪base，不向學生預先揭示速度答案。
- schemaVersion=2／modelVersion=1／rubricVersion=2維持，增加可選權威欄launchOffsetPpm（draft及review均保存）。缺少此欄的既有v2一律base=0，原資料及分數保持；v1保持原範圍及rubric。新版每列speedOffsetPpm必須落在本輪base對應±1%範圍，M.change(record)同樣驗證；不改row shape、時間或read單位。測試正常／極端／缺欄舊v2的round-trip、平均及擬合真值、resume不重抽、pending重試及4000-byte上限。
- 使用者要求暫時預填第一、二部分：獨立網站預設測試模式，網址test=0可回一般模式，頁面亦有切換按鈕並說明重新開始。測試模式只在SimScorm.isStandalone()且全新空白edit狀態自動產生六個分散高度、各自約±1%波動印記及整mm正確read，然後進入plot。formulas、fit、trajectory、平均、計時揭示及概念題全部保持未答。清除重做後再預填並抽新base，重新整理亦為新一輪；不保存測試模式或舊standalone作答。
- 自動預填是使用者明確要求的暫時開發示例，不代表學生已完成量度。頁面標示「測試模式」，切換一般模式即正常空白練習；正式LMS連線完全不自動預填、沒有模式切換控制，仍可空白0分提交。已提交／pending狀態不提供切換或重做按鈕。之後移除預填可關閉main中的暫時default，再刪除專用practice動作／提示；不將測試答案硬寫入正式fresh()。
- 範圍：model/main/index/styles/scoring/persistence/ui-runtime、既有四個Node入口及browser入口、必要fixtures和本計劃；shared SCORM／activity-flow、題目評分分配、依賴及manifest資產數不改。驗證橫軸避讓（桌面／手機／短iframe／兩尺）、隨機上下界／同輪與跨輪、一般空白與測試預填／重做／切換、Moodle無預填、source與解壓SCORM及適用觸控。沿用既有測試登記，執行check:tests、committed selection preview、相關Node／browser、check/package及文件檢查；再更新同一私人Sites、commit及push。實體手機／Moodle實機另列未驗。

### 本次最終證據及測試入口

- Runtime head `2f512c2d7b760aa75d2d7233be90c8046fbdb956`已推送。四個活動Node入口通過：隨機上下界、同輪±1%相對波動及能量上限、快慢射程差、測試模式只產生六列印記/read、後續答案保持未答、平均／擬合評分使用本輪真值、720組draft round-trip及實際續作、舊v2缺base保留100分、無效base／混輪offset拒絕，以及resume／pending retry不重抽base。最大數字測例draft/review/pending為1070／969／1234 bytes，全部測例仍在4000-byte內；本次沒有重跑其他209個Node入口。
- 正式browser同一head的source及真正解壓SCORM通過124個版面、22組流程、50組操作觀測；`output/playwright/horizontal-projectile-lab/report.json`。新增四尺寸×collect/measure/plot的低點名稱實際字框檢查，排除橫軸及刻度數字帶；量度版另逐一斷言名稱不與尺身相交。窄畫面必要時使用畫布最左可見空間，仍保留整個字框。已視察`source-label-beside-axis.png`及`source-test-mode-third-stage.png`：第一點名稱位於軸下左方／尺外，測試模式直接顯示六個自動圖點及模式提示。
- Browser驗證standalone預設測試模式、最慢／最快兩次基準射程相差超過150mm、清除重做抽新base且重新預填、切換一般模式為空白0分、切回預填、提交後不顯示模式／清除按鈕、刷新後重新開始測試資料，以及test=1在LMS下仍空白0分且隱藏模式控制。測試模式面板亦以可信touch滑動，答案及外層scroll不變。後續formulas／fit／mean／clockShown／conclusions未自動作答；保留既有空白／部分、四提交結果及舊review測例。
- 最終T1／T2／T3×source/package×320×500及390×844，四個相關profiles（initial、measure-preview-x/y、plot-answered）通過48 cases／852 gesture checks，completed=true／status=passed，errors及issues皆空。每move／release後核對host/panel/iframe、答案及suspend；接球槽及兩尺方向包含完成、cancel、lost capture、blur、第二指。報告`preview-final-T{1,2,3}-{source,package}.json`，摘要`preview-acceptance-summary.json`同browser目錄。這是本次變更的觸控範圍；其他phase的完整19-profile紀錄仍屬上一版，沒有冒稱本次重跑。
- 六份touch報告17檔digest皆為`f1526de2073e37ec21d3a85a0e8757fd5bb44004d467f6eae55829ec0107cc03`；正式browser16資產hash為`9c230b414fea751b4c2f62d0bb2cd0bb0c575dee9e17cd4042a1db42f364bef2`。最終SCORM17檔與來源逐byte相同。`check:tests`為246 entries／48 helpers／2 manual，`check`、`package:all`、文件及diff檢查通過。Committed selection preview base `8ca5618`／head `2f512c2`為affected、214 entries、單一活動package，存於`selection-preview-final-preview.json`。沒有宣稱全部213 Node、其他32 browser、GitHub CI、OS縮放、真手機或Moodle實機通過；先前總閘維持。
- [原有私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新，現在根入口預設進入測試模式。一般模式可用頁面切換，或活動入口帶test=0；切換會重新開始。移除暫時預填時先將main的`TEMPORARY_TEST_DEFAULT`設false，正式刪除時再移除practice動作及modeControls；不要將示例當學生答案遷移。
- Sites source `7fc95823cfa4eb852517df6332f1f0f7a2c2afd4`由官方helper推送，saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_8522723bd79c8191b85ca20be11d059c`，deployment `appgdep_6ad4b4da1b988191b063912e1fb245d7`原生回傳`succeeded`；owner-private權限保持。Archive `output/sites/horizontal-projectile-lab-test-preview-2f512c2.tar.gz`共18檔，16個runtime資產逐byte核對已測版本，根入口及hosting identity不改；SHA-256 `6950c7377213a7ca39d562a56f6a97025f65d82868dfb226f9ee2270da345d54`，資產證據`output/sites/projectile-test-preview-assets.json`。後續文件提交不改runtime。

## 減少重複操作的新版工作流程（2026-10-18；本節取代下文相關舊規格）

- 讀尺選項以目前尺上讀數為中心，相距1–2mm（四項通常跨度3mm；邊界或錯零位時略移），不再相隔1–2cm。對正零線時唯一正確答案為四捨五入至整mm的讀數，恰半格向上；最大捨入差0.5mm，以唯一整mm值評分。錯零位仍顯示四個不等於正確整mm讀數的選項。±1%投球波動及實際印記不改。
- 印記及資料點名稱優先左上，若超出畫布則左方或上方；保持TeX與清晰字體。新圖域只根據學生read的完整兩軸配對自動描點，不使用物理真值修正；單軸讀數不補0。取消手動放點、拖點及相關surface，整個非互動畫布可供host捲動，沒有作圖精細拖動或放大鏡的需求。
- 第3步仍由學生選直線／一般二次／過原點平方模型並明確執行擬合，之後判斷軌跡類型。重讀或重投會即時更新資料點並使擬合及擬合速度失效；不改其餘概念答案。空白、少點、退化資料可照常檢查提交，擬合失敗保持明確未成立。
- 第4步各選一次時間公式及水平初速度公式（各四選一，TeX radio）；已選公式直接套用所有完整讀數，錯公式照算且不預先揭示正誤。時間選項sqrt(2y/g)、sqrt(y/g)、sqrt(4y/g)、sqrt(2x/g)；速度選項x/t、y/t、2x/t、x/(2t)。公式未選、缺軸或時間非正時顯示未有結果，不顯示Infinity。結果只由read及公式推導，不保存派生數字。保留平均初速度只填一次、由擬合係數估速及獨立計時對照；採用錯公式的平均運算分仍可follow-through。
- 評分風險維持formative／low-risk，瀏覽器不含秘密，無高風險正式評核聲稱。新版100分：取樣10、12個讀數24、選擇二次類模型6及成功執行擬合6、兩個正確公式各6、軌跡4、平均運算2及準確3、擬合估速3、四個物理概念24、時間擬合加速度6。取消手動轉繪及逐點運算分；未答為0，公式及概念可獨立得分，明確提交／凍結／只讀契約保留。
- 新答案schemaVersion=2、modelVersion=1、rubricVersion=2：rows六列null或{depthMm,speedOffsetPpm,clockMs,read:[mm|null,mm|null]}；fit、trajectory、meanV、fitV、clockShown、gFromClock、conclusions維持；新增formulas:{time:null|四個合法ID,speed:null|四個合法ID}；不再保存point、calculations、selectedSlot或connectPoints。draft保留phase/view/returnToCheck/setup/ruler，review只留權威答案。公式變更清平均，讀數／投球變更清相關平均、擬合／fitV，豎讀數變更另清gFromClock；重選同值不清。meanV需至少兩個有限派生速度；fitV、gFromClock繼續依其有效擬合。
- 版本策略：已提交或pending的v1保留原validator與rubric，回顧及重試不改分；v1未完成draft拒絕以v2續作，不覆寫原紀錄，顯示需舊版活動或教師開新attempt，避免將手動答案冒認成公式選擇。Sites standalone刷新本來就開始新練習，無舊draft遷移。全部新版phase×view、空白／單軸／少點／全部公式及零時間／錯公式／有效和失敗擬合／check返回／review／pending要production round-trip並執行合法續作；非法版本、欄位、依賴、數值另驗，payload<=4000 bytes。
- 範圍包括model/scoring/persistence/main/index/styles、既有test-support及四個Node入口、正式browser入口、mobile-scroll本活動fixtures／操作契約、catalogue說明及本計劃；shared SCORM／activity-flow、fitting與本地TeX依賴不改，不新增依賴。登記沿用既有入口；執行check:tests、committed selection preview、適當Node／source+ZIP browser、T0–T3手機各階段與兩種剩餘拖動及中斷、package、diff及文件檢查，再更新原私人Sites並commit/push。真Moodle／實體手機維持獨立未驗收。

### 新版最終驗證及發布

- 已推送runtime head `c51b4dd5c9b92ac4a9ea9800a07a54ffd1622ac2`。新model/scoring/persistence/lifecycle入口通過：完整100分、空白0分、近似讀數唯一正解、16種公式配對及未選／零時間、錯公式平均follow-through、取點／讀數／公式變更的失效關係，以及660組新版draft round-trip與實際公式續作。新draft/review/pending最大測例為1050／949／1212 bytes。v1已提交回顧保留100分及原容差，v1 pending可驗證重試；v1 draft保持技術鎖定且未有任何save覆寫。
- 全部213個Node入口三批各71項通過：`output/ci-tests/projectile-workflow-node-{1,2,3}/report.json`。正式browser同一committed head的source及真正解壓SCORM通過100個版面、20組流程及50組操作／幾何觀測，報告`output/playwright/horizontal-projectile-lab/report.json`。包括六點量度至100分提交、沒有手動圖點或逐點輸入、錯讀數[100,300]照樣畫在該位置、錯公式照算、清公式後結果變空、blank/partial、resume、四提交結果、舊review實際渲染及未完成舊draft不覆寫。已視察手機近似讀數／左上點名與自動曲線／公式版面截圖。
- T1／T2／T3×source/package×320×500及390×844，完整19 profiles（初始、五步各已答／未答、豎尺、兩方向預覽、退化擬合、check、submitted、pending、committed）通過228 cases／3540 gesture checks；六份報告均completed=true、status=passed且errors／issues皆空。報告`workflow-T{1,2,3}-{source,package}.json`，摘要`workflow-acceptance-summary.json`同browser目錄。非互動圖域／面板、尺身及接球槽的可信完成、cancel、lost capture、blur、第二指均核對每move及release後owner、答案及suspend；新自動圖點沒有舊放點surface或拖點target。其他活動操作函數未變。
- 六份touch報告17檔digest皆為`5ed8a9898a56181f942e6c1d24978879b387ba66a1a80d529cdb0cb2b64997cd`；正式browser16資產hash為`dc39dc4b18008347b835f62b15732cc1b92f6d228f32fa420c8372da052799c8`。最終SCORM17檔與來源逐byte相同。`check:tests`仍246 entries／48 helpers／2 manual；`check`、`package:all`、文件連結及diff空白檢查通過。已提交選擇預覽base `bcb0006`／head `c51b4dd`為full、246 entries、packages=all，存於`selection-preview-workflow.json`。未重跑其他32個browser、GitHub CI、OS縮放、真Moodle或實體手機；舊全專案／Moodle總閘不改稱通過。
- [原私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已發布成功，owner-private權限保持。官方helper已推送Sites source `7e9a667710839d692e3c0f1cdd48a1d23904cf2d`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_f211fa2e441881918b6fd5244f171b7a`，deployment `appgdep_6ad4ab87b2248191820b408ef5d69f1a`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-workflow-c51b4dd.tar.gz`共18檔，16個runtime資產逐byte核對已測來源，根入口及hosting identity不變；SHA-256 `6e12a9a892037cb0b19f51dad5000751818252a8c698053c858c63743902dcd5`，資產證據`output/sites/projectile-workflow-assets.json`。後續文件提交不改runtime。

狀態：2026-10-19已將下列Scope至Moodle-ready主表更新為現行四步／schema3／rubric4規格。前面的2026-10-18摘要及後面的歷史紀錄只記錄演變；舊規格不能覆蓋現行主表。真Moodle／實體手機及全專案browser總閘未宣稱通過。

- 分支：`codex/horizontal-projectile-lab`。
- 起點：本機 `main`，`f7ab989ca59b72ebe6a7691129320c4768f6fcf8`；未宣稱已同步遠端。
- 由[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)複製及填寫；遵循[共用風格](00-shared-platform-and-style.md)與[製作指南](../docs/simulation-scorm-production-guide.md)。
- 使用者指定：固定高度放鋼珠、水平出口、上下移動接球槽、覆印紙留痕、用尺量度 x／y、逐點求初速度再求平均、約1%的輕微實驗差異、研究分運動、畫軌跡及二次函數擬合。
- 本稿首版建議：六個取樣位置、形成性評分，以及後段揭示每次投球的獨立計時。這些仍是設計預設；逐點估速、平均及輕微差異已由使用者明確要求。

## Scope

本節至Moodle-ready清單為現行驗收規格；2026-10-18的修訂摘要及其後歷史紀錄只記錄當時決定／證據，不能覆蓋本組主表。活動遵循[共用基線](00-shared-platform-and-style.md)、[製作契約](../docs/simulation-scorm-production-guide.md)及[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)。

| Decision | Current specification |
|---|---|
| Branch / activity | `codex/horizontal-projectile-lab`；slug=`horizontal-projectile-lab`；起點`f7ab989` |
| Delivery / risk | 獨立靜態頁及SCORM 1.2；形成性100分、60分達標。瀏覽器評分不作高風險考試的可信邊界；無秘密或server評分 |
| Learner task | 四步：調槽取六點→拖尺選取x/y讀數→自動描點、選模型及軌跡→選公式、填平均初速度→明確檢查及提交 |
| Runtime / dependencies | 活動八檔：index、styles、main、model、scoring、persistence、ui-runtime、presentation；shared styles/scorm/activity-flow/fullscreen；既有fitting及本地CircuitMath/MathJax/授權。16 runtime資產由manifest宣告；ZIP另有根`imsmanifest.xml` |
| Catalogue / package | [catalogue](../sim/config.js)為metadata權威來源；[manifest](../sim/manifests/horizontal-projectile-lab.xml)；`npm run package -- horizontal-projectile-lab` |
| 正式啟動 | standalone所有入口由collect空白開始，沒有模式切換／預填或test參數入口。Moodle同attempt草稿／回顧／pending按既有snapshot還原；空白0分 |
| Out of scope | 手動描／拖圖點、獨立計時探究頁、逐行手填t/v、平方模型新作答、擬合換算速度及分運動概念題均已移除；舊版回顧／重試另保留原資料與rubric |

## Physics or subject model

| Quantity | Current definition / domain |
|---|---|
| Constants | H=0.200m，g=9.80m/s²；理想實心球滾動出口速率√(10gH/7)，SPEED=0.99倍理想值 |
| Across / within experiment | 新實驗抽launchOffsetPpm整數[-300000,0]；每球jitter整數[-10000,10000]。實際speedOffsetPpm=round(base+(1+base/1e6)×jitter)，v=SPEED×(1+speedOffsetPpm/1e6)。每球飛行中固定，不因重繪／還原／提交而重抽；最高速率低於理想能量上限 |
| Impact | t=√(2d/g)，x=vt，y=d；水平出口、vy(0)=0、無阻力。槽面畫在碰撞球心下10mm，印記以球心為準。動畫慢放不改撞擊時刻 |
| Sampling | depthMm=50–800的5mm倍數；槽微調5mm。新印記與其他slot至少相隔50mm；重做只覆寫該slot，沒有隱藏歷史 |
| Ruler / readings | 權威尺零位整mm；按滑鼠8／觸控12 CSS px吸附到沿尺零線或最近印記的整mm橫向位置。已對齊時只在顯示上將垂直於量度方向的尺邊對準實際小數落點，主圖及preview紅黑點中心重合；不改讀數、答案或評分。放大至少8倍及4 CSS px/mm，四個讀數選項一般相隔3mm；正零位唯一正確，錯沿尺零位排除正確位移 |
| Automatic plotting / fit | 只繪read兩軸完整的點，完全依學生讀數；未讀齊不補零。schema3擬合把[0,0]加一次，linear需包含原點後至少兩個不同x，quadratic需三個；退化／資料不足可保存為合法嘗試。新作答只選一次／二次函數；舊inverse可保存、但因原點無定義而擬合失敗，須重新選有效模型才能新擬合 |
| Formula calculations | 時間及水平初速度公式各四選一（正確為√(2y/g)、x/t），以自己的完整讀數先換SI單位，再按所選公式派生各列t/v；錯公式照算。非有限結果及不能除以零的速度顯示空值，不儲存派生計算 |
| Mean | 至少兩個有限速度可填meanV，全部有效列均納入，不補零、不選子集；計算採避免中間溢位的等價平均。運算及準確度各自評分，六點準確度規則見下表 |

不同投球的速率有輕微散布，軌跡擬合只描述一組近似關係。以y反算t屬自由落體假設下估速，不能以同一公式反算再稱為獨立實驗證明。clockMs仍按真實depth及g重建／驗證，現行四步不顯示獨立計時探究頁。

## Responsive layout contract

| Area | Current contract / evidence limit |
|---|---|
| Desktop panel | 寬度≥900px採左右雙欄，控制欄clamp(20rem,26vw,23rem)，正常根字體下320–368px；不受短屏44%欄寬覆蓋。取點及量尺兩個方向按鈕並排，釋放／歸原點獨立全欄。圖域按實際裝置／座標範圍與固定文字邊界等比例放大；手機及窄短iframe維持既有配置 |
| Three regions | 全寬header含四步進度、檢查及共享fullscreen；stage及獨立捲動panel。手機上下、桌面左右；短窄measure使用雙欄容納preview及44px選項。panel至少96px可用，最後控制可達 |
| Diagram / text | x向右、y向下，同一物理比例及固定0–100cm範圍；手機主文18px、圖標16px，TeX由本地bundle呈現。每步保留精煉任務，不新增控制面板說明 |
| Manipulations | 接球槽44px握柄；主尺及放大尺身透明操作面與各自可見尺身一致，均只用同一ruler操作。其他stage區域原生pan-y；panel自行捲且不轉交host。現行沒有自由繪畫／拖點surface，兩側自由畫圖捲動條N/A，尺外空白仍須讓host捲動 |
| Keyboard / preview | 槽與尺可方向鍵微調，Shift加大步距；鍵盤維持整mm精確位移，不強制吸附。量尺靠近印記自動在畫布顯示真實放大窗與四選項，拖動中禁選、放手才可選；取消不保存暫態尺位 |
| Fullscreen | `data-sim-fullscreen-target`及shared fullscreen；所有模式可用，保持同一頁／答案／LMS連線，不保存fullscreen狀態；失敗顯示技術訊息 |
| Verification | source及真正解壓SCORM覆蓋320×225、320×400/500、390×500/600/844、640×400、667×375、900×650、1280×800；OS實際200%縮放及實體手機不由模擬viewport代替 |

## Navigation, submission and reset

collect→measure→plot→speed為依資料操作順序；每步均可直接檢查空白或部分答案，再明確提交，也可返回指定步修改。check不強制完成六點。已記錄或pending結果只讀，沒有清除／重開；合法retry由共享SCORM同payload處理。Standalone刷新清空；Moodle同attempt還原。新attempt由空白開始，沒有預填或模式例外。

## Gesture ownership matrix

| Region / manipulation | Owner / observable result | Current coverage and remaining gate |
|---|---|---|
| Stage空白、非互動圖與尺外區域 | T1/T2外document或T3實際`#scrollOwner`；panel、活動document及答案不變 | 依[手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)；歷史全矩陣不冒稱本輪重跑 |
| Panel頂／中／底及連續滑動 | 只panel動，host／iframe／stage／答案不動，無host樣式鎖 | T0直接頁及T1–T3中性host，source/package分開 |
| 槽／兩方向主尺及放大尺身 | 只有該目標動，所有scroll不動；可信touch pointerup完成，cancel／lostcapture／blur／第二指回復原狀 | 本輪至少重跑measure空白、兩尺preview及只讀回顧；沿尺移動仍對齊時須保持preview及紅黑點重合 |
| plot／speed／review | 沒有拖點或繪圖層；只讀圖讓host捲，控制按鈕保留各自作用 | source/package舊v1/v2 square唯讀回顧顯示正確模型名、公式及原分；新作答不增加舊模型 |
| Moodle T4 | 需實測current-window及提供的新視窗、origin/sandbox/frame chain及實際scroll owner | 未驗收；本機T1–T3不能取代真Moodle／真手機 |

## Scoring and tolerance

現行為schema3/model1/rubric4，100分、60達標、無負分。評最終答案；未答0分，獨立部分分保留，完全空白作答0分。舊rubric1/2/3仍使用原規則，不能靜默重評。

| Component | 分數 | Current rule |
|---|---:|---|
| 不同高度取樣 | 6 | 深度排序後與上一計分點至少50mm，每點1分，最多6 |
| 取樣跨度 | 4 | 至少500mm得4；250–499mm得2；其餘0 |
| x/y量度 | 36 | 六點各軸3分，必須等於該實際落點四捨五入至整mm；x/y獨立計分 |
| 時間公式 | 8 | 選fall（√(2y/g)） |
| 水平初速度公式 | 8 | 選horizontal（x/t） |
| 二次函數模型 | 10 | fit.model=quadratic；不依擬合成功給分 |
| 執行有效擬合 | 10 | attempted=true，含原點及自己的完整讀數，重算成功；有效linear亦可得此項 |
| 軌跡類型 | 10 | 選parabola |
| 平均初速度運算 | 4 | 至少兩個有限速度，meanV與所有有效列的所選公式結果平均相符；錯公式follow-through仍可得分 |
| 平均初速度準確度 | 4 | rubric4須六列均有完整讀數及有限速度，meanV接近同六列實際初速度平均；不足六列此項0，不鎖平均輸入／提交 |

| Quantity | Current tolerance / boundary |
|---|---|
| schema3讀數 | 精確整mm相等，無額外±5mm容差；尺面顯示cm，讀數由四個選項記錄 |
| 平均運算 | ≤max(0.02m/s,2%×參考平均)；含邊界及near()的1e-10數值餘量。例如參考1.50時1.53可得分，1.54不可 |
| 平均準確度 | 與同批實際v平均相差≤10%，含邊界；rubric4另須六有效列。參考由保存的speedOffsetPpm重建，不重抽 |
| 舊rubric | v1讀／轉繪±5mm、逐行計算、計時及舊分運動評分；v2/v3原分配和平均規則保持。這些只供舊review/pending及rubric3 draft續作，不是新作答規格 |

完整正確六點100分；新兩點／四點完整且其他項正確為68／82分，平均運算4、準確度0；舊rubric3同四點仍86分。只留六印記但未讀齊，或零時間造成速度空值，均不算六有效列。錯讀數仍如實描點，錯公式的有限結果保留；只扣對應項，不將合法錯答當損壞快照。

## Phase/state matrix

Draft只保存edit/check；四個view為collect/measure/plot/speed，沒有現行motion。每個view與空白／部分／完整、check返回及rubric3/4交叉驗production round-trip，還原後執行一次合法續作；只讀／提交狀態由共享生命週期決定。

| Phase / variant | Required semantic state / retained data | Legal continuation / check route |
|---|---|---|
| edit collect：空白／部分／六點／重做／動畫前後 | 六slot，合法setup；飛行中不先覆寫觀測，已記錄點保持 | 調槽、選slot、釋放、取消或check |
| edit measure：無記錄／未讀／x-only／y-only／完整／兩尺／錯零位 | read每軸明確null或整mm；ruler位置不評分；最近目標由尺位派生，沒有selectedSlot | 換尺、拖尺、選讀數、清單軸或check |
| edit plot：無點／部分／完整／未選／未執行／成功／退化 | points由完整read派生，fit僅model/attempted；coefficients不保存；舊inverse可還原但新選單不提供 | 選linear/quadratic、擬合、分類、清擬合或check |
| edit speed：未選／單公式／錯公式／零時間／2–5列／六列／平均已答 | 六列由read及formulas派生；meanV非null需至少兩個有限速度，不要求正確 | 選／清公式、填平均、返回量度或check |
| edit after check | 任一view，returnToCheck=true，原有合法答案保持 | 一次語義修改再返回check |
| check blank/partial/full | phase=check，returnToCheck=false，保留來源view | 返回任一view或明確submit，不自動提交 |
| review／committed | 驗證、重算、metadata核對後鎖定；舊v1/v2 square模型只讀名稱可見，新選單無square | 回顧各頁、fullscreen；committed只供shared finish retry |
| frozen validated pending | canonical review及payload重算相符，分數未確認、不公開解答 | shared同payload retry；不能clear/reopen |
| technical／mismatch | 損壞、未知或不一致結果保持鎖定，不能顯示捏造確認分數 | 技術訊息、fullscreen；環境修復後重載 |

| Transition | Authoritative changes / invalidation |
|---|---|
| setup或ruler | 只改下一球設定或尺位，不改觀測／答案；拖動完成才save，取消回復 |
| record完成 | 同slot寫depthMm/speedOffsetPpm/clockMs/read=[null,null]；清meanV及fit.attempted，保留其他列、公式、模型及分類；有空slot時選下一空slot |
| read改／清 | 改指定軸，清meanV及fit.attempted；其他列讀數、模型、分類及公式保留。重選同值無失效 |
| formula改／清 | 改該公式並清meanV；不改讀數／fit；重選同值無失效 |
| model／fit／clearPlot | 換model清attempted；fit置attempted並重算；clearPlot只清fit及trajectory，不清read／meanV |
| meanV／trajectory | 僅保存該答案；合法有限錯值不截成正解 |
| clear whole experiment | 只在editable且確認後new fresh，重抽launchOffsetPpm及使用rubric4；回到collect空白作答 |
| check／submit | check保留權威答案；submit建立canonical review並交共享四回調，不自己commit/finish |

## Persistence contract

依[快照契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)及[恢復測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)，使用`SimScorm.makeSnapshot()` envelope（version1/activity/kind/answer；review另有score/passed）；pending保存經驗證的canonical review及結果。缺失必要欄不能當null。

| Field / snapshot | Current exact schema / domain |
|---|---|
| Versions | activity=`horizontal-projectile-lab`；schemaVersion=3/modelVersion=1；新rubricVersion=4，舊schema3亦接受rubric3。schema1/2只接受各自原rubric，舊draft入口明確拒絕 |
| launchOffsetPpm | 新snapshot必有[-300000,0]整數；兼容舊schema2/3缺欄時視基準0。有欄則嚴格驗域，restore不抽random |
| rows | 長度6，每格null或{depthMm,speedOffsetPpm,clockMs,read:[xMmOrNull,yMmOrNull]}；schema3禁止point |
| Observation domains | depthMm為50–800且5的倍數；speedOffsetPpm為依base及±1%重建bounds內的整數；clockMs必等於round(√(2depthMm/1000/g)×1000)。clockMs現行不評分／不顯示，但仍屬保存並嚴格校驗的觀測欄 |
| read | 每軸null或0–1000整mm；單軸空白、0及錯數均合法；schema3沒有手動point／calculations |
| fit / trajectory | fit={model:null/linear/quadratic/inverse,attempted:boolean}；null model不得attempted。inverse只供保留舊schema3記錄，不可新選。trajectory=null/line/parabola/circle/other |
| formulas / meanV | formulas={time:null/fall/half/double/horizontal,speed:null/vertical/double/horizontal/half}；meanV=null或有限非負number，非null需至少兩個有限派生速度，不另設任意幅值上限 |
| Draft extras | phase=edit/check，view=collect/measure/plot/speed，returnToCheck:boolean；setup={depthMm,slot:0..5}；ruler={axis:x/y,zero:[整mm,整mm]}，每座標-100..1000；check時returnToCheck=false |
| Review | 只含version欄、launchOffsetPpm（若原有）、rows、fit、trajectory、formulas、meanV；沒有導航／尺位。suspend不存在selectedSlot、clockShown、fitV、gFromClock、conclusions等現行答案欄 |
| Authority / derived / transient | 權威為上述觀測、選項、meanV及draft續作；由此重建物理位置、圖點、各列t/v、目標、係數／成敗、分數；動畫、capture、preview、相機及fullscreen不保存 |
| Version preservation | rubric3 draft可續作且保留舊評分；v1/v2 review／pending按原schema和rubric核對，square模型／公式可讀。不能將舊稿改標新rubric；新實驗才用4 |
| Invalid / size | 任何無效draft load lock，不覆寫；finished失敗保持只讀可信summary；invalid pending quarantine且禁retry／重開。所有UTF-8 draft/review/pending envelope≤4000 bytes，包含最大有限meanV測例 |

Finished restore依序validate→restore→score→shared reviewResult；frozen retry再次核對canonical答案與原分。合法空白／部分／錯公式／擬合失敗與損壞狀態分開測；保存不降低答案精度。Standalone不持久化答案，Moodle同attempt保持同一版本契約。

## Shared SCORM lifecycle

Use `SimScorm.loadAttempt()` with `SimActivityFlow.startup()`, register `SimScorm.setDraftProvider()`, and route `submitWithCallbacks()` through `SimActivityFlow.submission()` as specified in the [shared lifecycle flow](../docs/simulation-scorm-production-guide.md#mandatory-shared-lifecycle-flow).

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 還原合法draft或新空白；動畫中斷回最後完整記錄，可以重新釋放 |
| Startup review | 驗證、重畫、重算及比較結果；只讀 |
| Startup frozen | 驗nested review及canonical答案，合法才同payload retry；未確認結果-- |
| Startup load-error | 「未能安全載入本次作答」，無清除／覆寫，不能聲稱提交或達標 |
| Submit success | 「已提交」，可信分數及只讀回顧 |
| Submit committed | 「結果已記錄，結束連線尚未完成」，鎖定並只供shared finish retry |
| Submit frozen | 「提交尚未確認，請重試傳送」，凍結；不顯示分數、達標／不達標或正確解答 |
| Submit retry | retryable=true回check可修改並重試；false顯示技術原因、不承諾重試能解決；皆不稱已提交 |
| Review trust | match顯可信結果，mismatch顯不一致且鎖定；unknown用`completionLabel(null)`，不可默認不達標 |
| Standalone refresh | 僅記憶體，draft/check/submitted刷新都全新；不讀舊local/sessionStorage或IndexedDB，storage拒絕仍可用 |
| Moodle resume / recovery | 同attempt保留draft/review/pending，只有LMS新attempt才空白；save失敗提示未確認保存並保留記憶體工作 |

semantic edit經`saveDraft`，最新狀態由draft provider提供；不新增活動local commit／finish／pagehide／pageshow。

## Test plan

依[驗證契約](../docs/simulation-scorm-production-guide.md#verification-checklists)；以下列出現行測試決策，執行證據以本輪摘要的commit／hash／scope為準，不以舊勾選表示所有新head已跑。

| Area | Required coverage / registered owner |
|---|---|
| Model / scoring | 物理及random上下界、50mm間距、兩尺3mm選項／錯零位、原點一次參與linear/quadratic、inverse拒絕；空白0／部分分／完整100、0–6有效速度、六印記未讀齊、零時間、錯公式及mean容差；rubric3四點86／rubric4四點82不混用 |
| Persistence / lifecycle | rubric3/4每view×edit/check/return×空白/部分/完整，production encode/decode/startup後執行合法續作；1128組測例；舊v1/v2 review/pending、四提交結果、失敗save、frozen重試及quarantine；無效version/enum/依賴/非有限及4000-byte邊界另驗 |
| Browser source + ZIP | 各尺寸／fullscreen、可信拖尺及取消、紅黑點精確重合、錯零位、選讀數／自動描點／選公式／提交；正常空白啟動／舊test參數不預填／Moodle續作、刷新、舊square模型名稱與原100分、舊rubric3部分分回顧 |
| Mobile helper | 既有mobile-scroll入口及其Node契約測試；精確小數主圖／preview點位，接受正確對齊並拒絕舊rounded位置、偏移／錯slot／無目標；沿尺拖動仍對齊時保持preview，中斷後所有owner及canonical答案不變 |
| Registration / packaging | check:tests、check、文件連結、committed selection preview、activity ZIP runtime逐byte比較；git diff --check必核對工作區及main...HEAD／原合併基...HEAD全範圍，不能只用最後增量代替 |
| Independent gates | T1–T3全phase矩陣、OS實際200%縮放、真手機及Moodle T4僅按實際執行紀錄宣稱；歷史output缺檔不當可重驗證據，需從相同來源重跑或標歷史摘要 |

### Test registration and CI selection evidence

Follow the production guide's [registration procedure](../docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations); record this activity's decisions and actual evidence here.

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | `sim/manifests/horizontal-projectile-lab.xml`列八活動檔、四shared檔、既有fitting.js、本地CircuitMath／MathJax及授權，共16個 runtime 資產；ZIP另有root `imsmanifest.xml`，沒有引用catalogue或外部CDN |
| Logical test entries | `sim/horizontal-projectile-lab/model.test.js`、`scoring.test.js`、`persistence.test.js`、`lifecycle.test.js`；kind=node，scope繼承slug，涵蓋上述非平凡邏輯 |
| Browser entries / owner | `{file:'tools/horizontal-projectile-browser-regression.js',kind:'browser',scope:'horizontal-projectile-lab'}`；一入口含source/package，無args變體 |
| Case helpers | 現有mobile-scroll-cases.js及mobile-scroll-operations.js；活動browser直接重用projectileReadingGeometry()，共享同一座標檢查。沿用既有owner，不新增正式入口 |
| Separate manual gates | 保留既有mobile-scroll-browser-regression manual gate及理由，加入活動profiles／operations；完整T0–T3不能由CI省略，T4另外記真實證據 |
| Registration check | 實作後`npm.cmd run check:tests`通過：246 entries（213 node、33 browser）、48 helpers、2 manual；沿用既有mobile-scroll manual gate，沒有新增未登記的正式入口 |
| CI selection preview | 實作commit後記實際base/head、`npm run test:affected -- --base=<sha> --head=<sha> --plan`結果及browser/packages；registry/catalogue新增預期full coverage |
| Actual GitHub verification | HEAD 345b580已執行[Quality](https://github.com/frenselw/simlab/actions/runs/39142561035)，checks因EOF空行失敗；其他job不等於整體綠燈。本輪新head及實際結果另記，不再聲稱從未執行 |

- [x] Registration validation passes; every new formal entry/helper is accounted for, and any separate manual gate has a reason.
- [x] The committed selection preview includes the owning browser suite and all asset consumers, or records the expected full scope for registry/catalogue/shared changes.
- [x] Required source/package scenarios were executed; CI selection evidence does not replace real-phone or Moodle acceptance.

## Verification order

先驗純邏輯／舊版兼容，再驗source與解壓SCORM及適用可信touch，核對完整branch diff、committed selection及CI；最後發布同一私人Sites。真Moodle與實體手機另有獨立驗收，不以發布成功代替。

## Package-ready checklist

- [x] 現行四步、rubric4及schema3主表已對照runtime整理；本輪及歷史證據分列，鍵盤操作保留。
- [ ] Phone, tablet and desktop layouts, short iframe, toolbar/keyboard changes and 200% zoom preserve readable content and reachable actions.
- [ ] `npm run check`, `npm test` and `npm run package:all` pass; record commands, results and artifact paths.
- [x] 完整branch `git diff --check main...3b09f71`、`f7ab989..3b09f71`及工作區通過；本輪文件提交後再驗HEAD。歷史舊勾選只查增量，已明確更正。
- [x] ZIP has root `imsmanifest.xml`, every runtime asset is declared and no development-only files ship.
- [ ] Built/extracted launch smoke and the full applicable trusted-touch matrix pass; use the documented Git Bash route on Windows.
- [x] Assessment risk and any trusted validation requirement are recorded.

## Moodle-ready checklist

- [ ] Package-ready gates pass; real Moodle student-account submission records score/status.
- [ ] Draft resume, pending retry, immutable scored review and LMS new-attempt policy work.
- [ ] T4 real-phone complete phase/mode gesture matrix passes in current-window and offered new-window Moodle players, including quick-flick/release behavior and actual window/element owner.
- Server-side validation：N/A，本版僅形成性評核，不作高風險用途。
- [ ] Moodle and physical-device evidence is recorded separately from local checks; list any unverified item explicitly.

## 歷史：計劃階段工作記錄（非實作驗收）

- 已建立專用分支，只新增本計劃；runtime、catalogue、manifest及registry尚未修改。
- 2026-10-18 文件檢查：17個本地Markdown連結及fragment皆可解析；20個表格欄數一致、無未填範本欄或行尾空白。
- `npm.cmd run check:tests` 通過：241 entries（209 node、32 browser）、48 helpers、2 manual。這是既有registry有效性檢查，沒有執行新活動測試。
- 物理常數、rubric、schema容量、瀏覽器、SCORM套件、Moodle及實體手機均是待實作／待驗收，不表示已有通過證據。

## 2026-10-18 兩份獨立完整計劃審查及跟進

歷史範圍：本節審查及數值證據對應`6810777`的兩點估速／無額外隨機波動初稿；其後使用者追加的六行估速／平均及約1%投球差異以本文現行主文為準，沒有重新雙人審查或活動驗收證據。

兩位sub-agents各自審查完整計劃，涵蓋需求、物理／教學、操作、評分、保存／SCORM、手機與測試／包裝；兩位均未提出P0／P1，獨立指出相同兩項P2一致性問題。子代理的檔案工具未載入，因此由主agent提供全部章節及規範內容，主agent再對照實際文件核實引文與數值；不是子代理執行過程式測試的證據。

| 項目 | 核實及最小跟進 | 狀態 |
|---|---|---|
| R1：平均速度相依資料失效 | 完整meanV後改slot／t會清v卻可能留meanV；明訂所有v變動都原子清meanV，不依input事件連鎖，補round-trip續作測例 | 已修訂計劃 |
| R2：派生答案範圍與follow-through衝突 | 以現有fitting核算出約70000m/s、負g及大幅值g；移除結果欄任意100上限，g估值可帶符號，物理準確度仍獨立評分，補輸入／保存測例 | 已修訂計劃 |
| R3：零觀測但已有獨立答案 | 主agent補核、第一位覆核：零記錄仍可先答概念／嘗試擬合再返回collect；擴充該列及合法續作fixture | 已修訂計劃 |
| C1：印記轉記呈現 | 採納第二位可選建議，用一句提示區分接球槽接觸痕跡及球心位置轉記，不增加新工具 | 已修訂計劃 |
| C2：一般判據與自己的資料 | 採納第二位可選建議，題幹明示理想模型／哪種特徵可支持，不宣稱學生錯誤數據支持正解 | 已修訂計劃 |

修訂後兩位均覆核R1、R2、R3已解決，C1／C2合適，未發現仍須在實作前修正的問題。覆核針對所提供的修訂內容及先前完整計劃，不表示活動已通過測試。

主agent本次驗證：17個本地連結／fragment、21個表格欄數及行尾空白檢查通過，`git diff --check`通過；以實際既有fitting.js及合法深度事件時間核算，兩點法可得500m/s、平方擬合約70000m/s、負g約−3.921m/s²、近時間錯讀數可得約±1000000m/s²，數值assertions通過。這些核算確認原規格矛盾，不等同新活動的輸入、評分、保存或瀏覽器驗收；新增測例仍保持未勾選。

## 2026-10-18 使用者追加：印記、逐點平均與輕微誤差

- 明確以固定深色小圓點表示每次撞擊轉記，學生量O至圓點中心的水平x及向下y；取點階段不自動畫完整軌跡。
- 由兩張選點卡改成與六個slot一一對應的計算行；每點求t／v，再由全部已填速度求算術平均並明列n。初速度項保持20分，分配改12分逐點、5分平均、3分擬合估速，總分仍100。
- 每次出口速率約±1%波動，帶動落點小散布，該次偏移保存於觀測；同次飛行仍水平勻速。加入很小的平均耗散，使整個波動區間不超理想滾動能量上限。
- 同步更新物理、評分真值、依賴清除、phase、尚未發布的v1 schema及測試決定；不新增runtime程式或額外誤差設定選項。
- 本次文件檢查通過：17個連結／fragment、21個表格欄數、行尾空白及`git diff --check`；主文已無兩卡／固定同一落點舊規格。公式核算確認v參考≈1.65659m/s、±1%範圍≈1.64002–1.67315m/s且不超理想上限，同深度水平落點比例同為±1%；固定對稱偏移樣本的六點平均及既有擬合模組換算均通過assertions，rubric仍100分。這是文件／公式核對，沒有執行新活動或重新雙人審查。

## 2026-10-18 實作、獨立審查及本地證據

已在本分支新增完整靜態活動及SCORM 1.2 manifest。七個runtime檔重用shared SCORM、activity-flow、fullscreen及既有數學fitting，不新增npm或CDN依賴。`784ddcc`保存首次完整實作，`2ef1f95`保存審查跟進的單位修正；其後提交補驗收記錄及測例。

### 一位sub-agent的實作審查

依使用者要求，只開一位實作審查agent。由於其環境不能讀檔，由主agent提供model、scoring、persistence、ui-runtime完整正文及main核心邏輯；HTML/CSS、模板、shared runtime及測試／包裝工具提供摘要。子代理未執行測試，也沒有宣稱逐行審查摘要所涵蓋的檔案；主agent另外讀取實際檔案並執行下列驗證。

| 發現／跟進 | 修正及覆核 |
|---|---|
| P2：圖軸cm與數值擬合式m的單位未充分區分 | 在`fitText()`的方程旁統一明示x/y用m、t用s，圖軸位移用cm；所有五種擬合共用。來源及套件流程assert位置／時間單位說明。子代理覆核此P2已關閉，未見衍生矛盾。 |
| P2：極大有限答案顯示成Infinity | 格式化先驗證五位有效數的轉換；若會溢出，保留有效的指數字串。加入MAX_VALUE平均、恢復及負MAX_VALUE的g回饋測例；子代理覆核修正合理。 |
| P2：首次放點在pointerdown寫入，取消仍留點 | 改用持續掛載的surface及pointer capture，按下只預覽，pointerup才提交；touchcancel、失去capture、blur、第二指均保留完整答案及suspend資料。來源／套件及嵌入測例補齊；子代理覆核此問題已關閉。 |
| 主agent自查：投球中仍可按鈕／鍵盤改槽 | 同時鎖槽位置／記錄slot／握柄及鍵盤，開始、完成及取消投球時render解鎖；保留導航取消。測試包含check取消、resize取消、正常慢放完成及時鐘不變。審查agent另確認修法完整。 |
| 主agent自查：未改圖點卻清擬合、取消清除後介面不同步 | 相同座標只更新選取、不使fitV失效；取消清除／拖動、鍵盤聚焦既有點亦重畫，拒絕清除時恢復已取消投球的控制項。子代理覆核確切修訂描述未見衍生缺陷；model及source/package browser驗證。 |
| 手機量尺讀數可用性 | 增加主動放大尺上讀數，顯示所選印記在目前尺上的真實投影；每mm至少4CSSpx，不顯示正確數值、不改作答。另補座標方向箭頭及正常尺標間距。 |

除上述已關閉項，子代理在所讀核心中未提出其他可重現P1/P2。這是文字審查，不取代瀏覽器、Moodle或實體電話證據。

### 已完成的活動驗證

- `model.test.js`：理想滾動能量上限、±1%邊界／抽樣拒絕、撞槽位置與獨立時鐘、相依答案原子失效；另驗已知y=1.75x²的平方／二次正確係數及直線殘差。
- `scoring.test.js`：100／空白0／部分分、容差邊界、以自己錯讀數轉繪及後續運算、全組平均、500m/s／約70000m/s／負g合法跟進計算。
- `persistence.test.js`：270個draft變體production round-trip、等分與實際合法續作，review還原、非法shape／數值／版本／相依拒絕。含極端有限數的draft/review/pending分別1487/1347/1638 UTF-8 bytes，均低於4000。
- `lifecycle.test.js`：new/draft/review/pending及技術狀態；success/committed/frozen/retry四結果，可信度不符保持只讀，pending驗證失敗quarantine，保存失敗保留作答並阻止未保存提交。
- 正式browser入口同時執行source及真正build/extracted ZIP，逐asset byte比較，保存runtime SHA-256及Chrome版本。十個viewport各五view共100個版面：320×500、390×500、390×600、390×844、900×650、1280×800、640×400、667×375、320×400、320×225；面板最尾可達、document無競爭range。640×400是1280×800在200%時的等效CSS可用域，並非OS瀏覽器縮放或實體裝置證據。
- 來源／套件正式UI各走六次投球→讀數→親自描點→直線／二次／平方擬合→六行估速／平均→獨立計時／概念→100分提交；各步空白提交0、pending及finish重試、draft／review恢復、standalone拒絕storage下partial/check/submitted刷新全新。包括大速度／負g輸入、確認取消／清除、零觀測先答概念再投球。
- 同入口驗真CDP touch放點、槽／尺／點完整拖放及取消、右鍵不放點、鍵盤、兩側≥32px、短iframe的fullscreen blocked/unsupported可見訊息及面板可達；T0直接頁面各view/check/review/frozen/committed的面板／邊界／空白觸控及鎖定狀態fullscreen不改答案。
- 活動browser正式報告：`output/playwright/horizontal-projectile-lab/report.json`；裝置／軌跡／時間圖／手機／放大尺截圖在同目錄。

### 本地完整回歸與觸控矩陣

`npm.cmd run check:tests`、`npm.cmd run check`、`npm.cmd run package:all`及`git diff --check`已通過；所有SCORM ZIP已成功建立，新活動ZIP含root imsmanifest及12個runtime資產，共13檔，開發測試不入包。套件：`output/horizontal-projectile-lab-scorm.zip`。

已提交selection preview：base `f7ab989ca59b72ebe6a7691129320c4768f6fcf8`，head `784ddcc9933ac894460a5139bb6c1906b0e4a990`；`npm.cmd run test:affected -- --base=<base> --head=<head> --plan`回傳full、246 entries、packages=all（catalogue變更），含本活動四個Node及一個browser入口。報告：`output/playwright/horizontal-projectile-lab/selection-preview-784ddcc.json`。最終程式head的預覽見下一段。

完成程式及目錄的head `728695b9409546575877425070bcf424b2e3b64f`亦執行相同base/head選擇預覽，結果仍為full、246 entries、packages=all，含全部五個本活動入口；報告`output/playwright/horizontal-projectile-lab/selection-preview-728695b.json`。後續純文件提交不改runtime。正式browser報告記錄啟動當刻的舊HEAD，因此另實算目前12資產的SHA-256 `f428bc62f106fa89a7564647f0dc59bf3f1119f0abd533f77758270ccbfb0485`與報告一致，並逐byte核對最終ZIP一致，未把舊HEAD字樣當成當前commit的CI。

完整本地回歸的初次Node執行212/213通過；既有force-composition persistence長測例在120秒期限附近逾時，300秒單項重跑以118.1秒通過。完整213項Node重跑全部通過（每項300秒，未修改測例或runner），報告`output/ci-tests/projectile-all-node-final/report.json`；最後圖點修改另重跑本活動四個Node入口及mobile-scroll契約測試，全部通過。

全部33個browser入口分批執行；原始大分批在完成電路組後中止重複排隊，其餘19項另分三批，不能把中止報告當CI全綠。家庭電路保護掣closed/tripped、交流電路效能budget、來源電路relay過渡狀態及駕駛活動嵌入恢復的Persistence.decode檢查失敗；相關活動／shared runtime沒有本分支改動，尚未判定根因，不能宣稱全專案回歸或CI通過。原始報告保留於`output/ci-tests/projectile-browser-{1,2}`及`projectile-other-browser-{1,2,3}`。

依入口合併本地報告是29項通過、4項失敗，詳見`output/playwright/horizontal-projectile-lab/global-browser-summary.json`，不是單次完整CI。再執行來源relay小範圍檢查通過19 observations；交流protection-budget小範圍source/ZIP檢查通過134 observations。這兩個針對性通過不抹去原完整組失敗。駕駛完整入口重跑在package面板頂邊range穩定性斷言失敗（662 vs 564），報告`output/ci-tests/projectile-driving-retry/report.json`。不擴張本次範圍去修改其他活動。

最後可信觸控驗證：`c6f6e31`程式版本、兩個viewport（320×500、390×844）、T1／T2／T3各source與真正解壓ZIP，每組18 profiles×2尺寸=36 cases，六組共216 cases全部通過；T0兩來源各2 cases，共220 cases、3448 gesture checks，所有issues／errors皆空，八個報告completed=true及status=passed。18 profiles包括initial、五view各answered/unanswered、直尺豎向、中央放點、擬合失敗、check、submitted、pending與committed。T0更深入的各view及鎖定狀態另由正式browser入口驗證。所有報告13檔runtime digest同為`2cf8b2ad7bf0fc1aa09e9a08b6f6ebf459bb5a45a6eb5c400e5b4f31537d3b6f`；後續只改catalogue／文件，未改runtime。

報告：`output/playwright/horizontal-projectile-lab/touch-T{0,1,2,3}-{source,package}.json`；合併assert摘要`final-acceptance-summary.json`同目錄。逐move及release後20／100／400ms保留owner、host/document/panel、frame、viewport、trusted event、答案及suspend資料；操作含完成、cancel、lostcapture、blur、secondary touch。這是所列18種狀態的本地證據；technical/mismatch的控制器測試不冒充其逐host觸控實測。完整手勢及package-ready總閘因此仍保留未勾選，亦受全專案browser失敗及實際zoom待驗影響。

真Moodle學生帳戶、實體手機T4、OS實際200%縮放及GitHub CI尚未驗收；保持Moodle-ready未勾選。

## 2026-10-18 使用者修訂：LaTeX、大字、原點及四選一讀尺

本節以後的驗證才對應本次程式；上述220 cases等結果屬上一版歷史，不能沿用宣稱本次通過。

- 四選一只使用目前尺上讀數的整mm值及相隔10–30mm的干擾值，四項互異且順序由目前幾何決定；不抽新的投球random、不使用答案補選項。讀數超出0–1000mm尺域時不顯選項，學生須移尺。
- 零位對準時只有一項落在原讀數5mm評分容差；錯位50mm／100mm等情況可以四項全錯。選項本身不標正誤；記錄只有原有read欄位，既有評分及schema v1不改，舊attempt能恢復。移尺保留已選讀數；再選新值沿用原子失效邏輯，清除讀數可保留未答。
- 四按鈕保持同一DOM且不在pointerdown寫答案；拖動時隱藏，mouseup／touchend後重算。鍵盤可Tab選值、方向鍵移尺；錯位不會獲自動修正。零位把手48px（桌面52px），舞台保留兩側32px捲動條，讀數卡只攔自己的可見區域。
- 桌面21px主文、24px圖標；手機18px主文、16px圖標。極短iframe的選項移入面板，普通手機在印記尺上投影附近顯示。原點固定於水平出口球心，以紅點及LaTeX O(0,0)表示。
- 影響範圍：活動HTML/CSS/main/model/presentation、manifest、既有model及browser測試；共用SCORM、MathJax及電路runtime不改。manifest共16資產（含本地MathJax授權），ZIP另有root manifest，共17檔。
- 測試決定：既有model入口增加對零／錯位／四值互異／尺端／超尺／有限極值TeX檢查；browser主線改走畫布選讀數，新增滑鼠／touch選值、錯位不補真值、原點／大字／TeX幾何／短屏fallback／保存及只讀檢查；重跑來源與解壓ZIP、既有生命週期及受影響觸控profiles。不新增正式test入口，registry無新增項目。

### 本次已完成的來源／套件證據

- 程式commit：`d98ffab27f1c05c14091c3c785605ad541021929`；沒有改既有SCORM、MathJax及電路runtime。`check:tests`仍為246 entries（213 Node、33 browser）；本次沒有新增正式入口。
- 四個活動Node入口及既有mobile-scroll契約測試通過；包含四個選項互異、對零時唯一正確、錯位50／100mm時全部錯、尺兩端／超尺、巨量有限數TeX與原有270個保存變體。
- 正式browser入口source／build+extracted ZIP全部通過：100個版面、14組流程、44組操作／T0手勢觀測。新增四個viewport（1280×800、390×600、320×500、320×225）的四選一：先錯選、錯位不補真值、重新對零、真實滑鼠／touch選值、重新載入保留、提交後禁止編輯；亦assert公式轉成SVG、字體、原點、44px按鈕、短iframe面板fallback。
- 六個T1／T2／T3×source/package報告，每個含水平尺已答、空白、豎直尺三profiles×兩尺寸（320×500、390×844），合共36 cases、624 gesture checks，completed=true、status=passed、issues/errors皆空。完整拖動、取消、失焦、第二指及lost capture的逐move／release觀測均保留。報告為`output/playwright/horizontal-projectile-lab/latex-complete-T{1,2,3}-{source,package}.json`，摘要`latex-touch-summary.json`。
- 六份可信觸控報告的17檔digest皆為`2f9c547ec8380e0d8f035119c8c03b673df2b0bf5d54a51de860b60b14dead06`；正式browser的16資產內容hash為`7ebba7a208163525d2137b0e189f2fa5326e114a9e77eaa3f8fdb9734b1b0dd5`，另逐byte核對目前ZIP與來源一致，含17檔。本次先前因文字避讓／提示排版尚有修改而中止的中間測試，不列為最終通過證據。
- `npm.cmd run check`、`npm.cmd run package:all`、`git diff --check`及文件連結檢查通過。已視察實際桌面／手機／讀數／裝置截圖；一般viewport的讀數卡在舞台，320×225移到panel，沒有以縮小按鈕處理。
- 已提交的影響選擇預覽：base `bd1b978`、head `d98ffab`，mode=affected、packages=[horizontal-projectile-lab]、214 entries（全部213 Node及本活動browser）；報告`selection-preview-latex.json`。本地Node按原登記入口分三批、每批71項執行，每項300秒期限，合計213個互異入口全部通過，未修改測例或runner。報告`output/ci-tests/projectile-latex-node-{1,2,3}/report.json`，三份status皆passed；選擇預覽不是GitHub CI。

本次沒有重跑其餘32個browser入口、整個220 cases歷史矩陣、GitHub CI、OS實際200%縮放或實體手機／Moodle；上一版全專案4項browser失敗未在本次宣稱修復，原package-ready／Moodle-ready總閘仍未通過。

## 2026-10-18 再修訂：取樣距離與尺面可讀性

- 移除畫布的「固定釋放標記」文字。新增取樣須與其他已記錄slot的深度相隔至少50mm；正好50mm可接受，不足50mm禁止釋放，model再次驗證；重做自己slot不算新增同高資料。保留舊v1 draft/review（可能有近距離點）的恢復及既有評分，不回溯破壞舊attempt。
- 水平／豎直尺只有已選有效印記才吸附O及該點投影；未選點仍可自由移尺，不自動吸附。
- 零位把手保持44px觸控區，但只畫小型透明圖示，放在零刻度左上方，與零數字／尺面分離。尺身加厚及兩端留邊，讓所有數字完全在尺身內，避免豎尺的100及0突邊。
- 原有放大按鈕及讀數卡新增同一放大開關；靜態Preview Window嵌在讀數點附近的卡內，使用真實尺面、同一零位及所選點投影，至少4 CSS px/mm。可收起；不給額外正確讀數、不改答案。拖動時仍用原有自動放大鏡，放手／取消清除。小畫面若卡放不下則沿用panel fallback，保留44px選項。
- 範圍：活動model/main/HTML/CSS及既有model／browser測例、活動計劃；共用SCORM、擬合、MathJax、保存schema及manifest資產數不變。測試包含50mm邊界／重做／非法record拒絕、未選點不吸附、兩尺方向零字與把手不重疊、尺數字在尺身內、Preview可見／對應所選點／不改答案及source/package與受影響touch cases。完成後commit及push。

### 本次最終驗證與跟進

- 核心程式`46d73c7`：高度距離及選點後吸附測例通過；保留舊重複高度snapshot恢復、原v1評分及自己slot重做。全部213個Node入口分三批（各71項，每項300秒），全數passed：`output/ci-tests/projectile-ruler-node-{1,2,3}/report.json`。其後兩項main畫面修正不改Node所測model／scoring／persistence／controller，既有mobile-scroll契約另重跑通過。
- UI跟進`b6b79af`修正只讀回顧沒有setup時的高度提示；`cd62011`修正放大預覽不能把離開視窗的原點標籤強拉入畫面，保留真實幾何，加入相應斷言。這兩項由本次完整UI／截圖測試發現並完成跟進。
- `cd62011`來源及真正解壓SCORM的正式browser全部通過：100個版面、16組流程、56組操作／幾何觀測；包含5cm邊界／disabled及程式觸發都不能多取點、兩尺所有數字在尺身內、零字與把手不相交、透明背景、真實就近放大／收起不改答案、四結果／review及既有完整100分作答。報告`output/playwright/horizontal-projectile-lab/report.json`，桌面／手機兩方向Preview截圖同目錄。
- `09c6bc2`只新增本活動水平／豎直靜態預覽兩個合法touch profiles，沒有新增正式test入口。T1／T2／T3×source/package×兩尺寸（320×500、390×844）×四profiles（水平尺、豎直尺、兩方向開啟Preview），48 cases、912 gesture checks全數通過，completed=true、status=passed，issues/errors皆空。報告`ruler-final-T{1,2,3}-{source,package}.json`；摘要`ruler-touch-summary.json`同目錄。
- 六個touch報告17檔digest同為`33c00269b965c9f9429d7cba4b3f7405bd9efc3da37fd59488c3b8ff6a552e44`；正式browser16資產內容hash `e674879def2906737410274990babdef7877e3f21be2fa4e85c4ec4f0932b3f0`，與最終來源／ZIP逐byte核對一致。ZIP仍17檔，新增零個依賴。
- `check:tests`仍246 entries／48 helpers／2 manual；`npm.cmd run check`、`package:all`、文件連結及`git diff --check`通過。保存的首輪失敗／中止報告不列為最終通過；上述最後固定版本報告才是本次證據。
- 原純活動改動選擇預覽：base `9aa8da5`、head `46d73c7`為affected、214 entries、單一package。加入中央mobile-scroll案例後，head `09c6bc2`的保守選擇為full、246 entries、packages=all；報告`selection-preview-ruler-final.json`同目錄。另用git base載入舊helper並逐JSON比較，確認26個其他catalogue活動的fixtures完全不變；本次只執行全部Node、本活動browser與相關manual cases，其餘32個browser未重跑，不宣稱全專案／GitHub CI通過。

Moodle、實體手機、OS實際200%縮放及全專案browser總閘仍未驗收。完成後依使用者常設指示commit並push至同一分支，保留本機附件不入版控。

## 2026-10-18 使用者釐清：尺身拖動及自動預覽

本節取代上兩節的把手、手動放大及雙軸吸附設計；其驗證屬歷史。

- 整個可見尺身可拖動，移除獨立把手及放大按鈕。保留方向鍵操作及尺身以外的捲動區。
- 已選印記時，水平尺只吸附其高度、豎直尺只吸附其水平位置；不自動改正沿尺方向的零位。對齊即自動出現真實尺面放大及四選項，拖動期間亦可見，放手後才可選答案；離開對齊位置則隱藏。小畫面放不下時沿用面板預覽。
- 零位沿量度方向為0時只有一項正確；其他位置四項均須避開既有5mm評分容差。候選值以目前尺上讀數為中心，限制0–1000mm，保留四個不同值；不因錯位補入正確位移。這只改選項生成，不改既有評分、schema或舊attempt。
- 槽拖動逐move在面板顯示可取樣／高度不足；pointerup才保存位置，取消恢復原位置及提示。增大鋼珠及所有資料點，物理中心及判分保持不變。
- 影響範圍：活動model/main/HTML/CSS及既有model/browser測例、中央mobile-scroll內本活動的fixtures／操作預覽斷言；無新依賴、資產或正式test入口。驗證零位錯1／10／50mm及尺端、兩方向吸附與預覽、尺身多處真實拖動、拖槽放手前提示及取消、來源／解壓ZIP、可信touch中斷、生命週期及套件檢查。完成後commit及push。

### 自動預覽版本的最終驗證

- 程式head `6e3cc5b`：新模型測試驗證零位錯1／10／20／50／100mm、正負偏移及尺端，四項不同且全部避開原5mm容差；對零只有一項正確。兩方向吸附只改垂直於尺的座標，未選點不吸附；既有v1保存、評分及270個round-trip變體不變。
- 全部213個Node入口分三批通過（各71項，每項300秒，未改runner或既有長測試）：`output/ci-tests/projectile-auto-ruler-node-{1,2,3}/report.json`。本活動四入口及mobile-scroll契約亦單獨通過。
- 正式browser的來源／真正解壓ZIP均通過：100個版面、16組流程、68組操作／幾何觀測。包括六點到100分提交、空白／部分及只讀／重試、原點與LaTeX；尺身兩個不同位置的真實拖動、拖動中自動預覽且四項暫停選取、放手才保存尺位、錯位仍吸附且全部錯、離開對齊則隱藏。拖槽在pointerup前依序顯示不足／可用／不足，答案及suspend不變，blur取消還原。鋼珠最少7 CSS px半徑、印記／圖點6px半徑，僅增大圖示，不改物理中心。
- T1／T2／T3×source/package×兩尺寸（320×500、390×844）×四讀尺profiles共48 cases、912 gesture checks，全數completed=true、status=passed，errors／issues皆空。涵蓋水平／豎直、已自動顯示預覽的兩方向，以及完成、cancel、lost capture、blur、第二指；面板與host位置、答案及suspend逐move及放手後皆核對。報告`output/playwright/horizontal-projectile-lab/auto-final-T{1,2,3}-{source,package}.json`。
- 另補T2 source的collect-answered兩尺寸：2 cases／38 gesture checks通過，拖槽提示出現／取消不令面板或host跳位；同樣核對五種完成／中斷及保存不變。報告`auto-live-catcher-T2-source.json`同目錄，runtime digest與上述一致；這不冒充其餘host或真手機的collect實測。
- 六份touch報告17檔digest同為`d3367138ac766b175e6fc8be97bb1e553a859e729cbef67ff0628f36ac885fa5`；正式browser16資產hash為`f2e74f863a952d3974b06285da44c1a23036985bb7e1f1b03e761a3c9019a69d`。最終來源／ZIP逐byte相同，仍17檔；摘要`auto-ruler-acceptance-summary.json`同目錄。已視察桌面／手機自動預覽及錯零位豎尺截圖；短屏沿用panel fallback。
- `check:tests`仍246 entries／48 helpers／2 manual；`check`、`package:all`、文件連結與`git diff --check`通過。已提交選擇預覽base `77aee64`／head `6e3cc5b`為full、246 entries、packages=all，報告`selection-preview-auto-ruler.json`。中央helper的改動只涉及本活動分支；另與base逐JSON比較26個其他活動的fixtures完全不變。

本次沒有重跑其他32個browser入口、GitHub CI、OS實際200%縮放、實體電話或Moodle。保留原package-ready／Moodle-ready總閘未通過，不以本地成功取代外部驗收；先前未完成／失敗的中間報告不計入上述證據。後續文件提交不改runtime。

## Sites 部署（2026-10-18）

依使用者要求，新建本活動的獨立 Site：[平拋運動實驗](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)。新站保留擁有者私人存取，需用擁有者帳戶登入，並非公開學生入口。根目錄原有 hosting identity 屬靜摩擦活動，保持原樣。

| 項目 | 已確認結果 |
|---|---|
| Site project ID | `appgprj_6ad49418111c819198d79e88cab3e78e` |
| SimLab 來源 | 已推送 `2ad600906f20d4e79740457a27ddb106a955726b` |
| 已推送 Sites source commit | `cf196624910d4238bf6e4f3beb95a8aa42407b66` |
| saved version | `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_5155c5cbd7c08191af027a7141bb96a2` |
| deployment | `appgdep_6ad494742a888191af26cc793f08b171`，原生發布回傳 `succeeded` |
| 本機獨立 checkout | `output/sites/horizontal-projectile-lab/`；內含自己的 `.openai/hosting.json` |
| archive | `output/sites/horizontal-projectile-lab-2ad6009.tar.gz` |

直接複製已測試版本的16個 manifest runtime 資產，逐byte／SHA-256核對來源；保留原活動及共用檔的相對路徑。根 `index.html` 只跳往活動入口並保留 query/hash，已用執行斷言驗證。官方 Sites source helper 負責獨立 Git commit／push及封裝，再由私人發布工具確認成功；tar內18檔含上述16資產、根入口及hosting metadata，已逐byte檢查。資產證據為`output/sites/projectile-assets.json`。

Sites 版使用既有 standalone 行為，刷新開始新作答；Moodle成績及同一次作答恢復須使用SCORM包。本次純部署沿用上一節的來源／解壓ZIP與觸控驗證，沒有更改runtime或重跑完整browser、真手機及Moodle。

## 手機畫布空間修訂（2026-10-18）

- 手機畫布按裝置的實際範圍（含斜槽）或完整0–100cm座標範圍等比例放大，減少固定留白；橫／豎比例保持相同，不改物理、尺位或學生資料。桌面維持原配置。
- 一般手機直向畫布改為視窗高度62%與畫面寬度加56px之較小者，保留至少96px可捲動面板；短iframe維持既有重排。手機提示移到面板，讓畫布不再為提示預留底部大段空間。
- 移除手機header對全螢幕按鈕的重複右側預留，沿用共用header既有空間，避免320px寬標題換行擠壓畫布；文字大小維持。
- 作圖區兩側保留至少32 CSS px的捲動條。所有指標轉換、吸附、尺面及放大預覽繼續共用同一geometry；拖動時camera固定，resize取消拖動。
- 範圍僅main的排版／geometry、活動CSS、既有browser入口的空間利用及邊界斷言、計劃與同一Sites部署。模型、評分、保存schema、manifest及依賴不變。驗證手機各步的圖域大小、字／軸／斜槽未截斷、讀尺／取點／作圖、來源及解壓ZIP、可信觸控與中斷，再更新既有私人Sites，commit及push。

### 手機版最終證據及 Sites 更新

- 已推送程式head `1c8be34f8fcad868dc957d28685e2f88e409698e`。390×844的座標圖為318px闊（約82%畫面），含斜槽的裝置範圍約342px闊（約88%）；320×500的座標圖為211px、裝置圖的座標部分約207px。文字未縮小，原點、軸標、刻度、鋼珠及印記實際SVG範圍均在畫布內；一般手機各步的geometry比舊公式在同一畫布至少大20%。來源／SCORM截圖為`output/playwright/horizontal-projectile-lab/{source,package}-mobile-space-<view>-{320,390}.png`，已視察兩尺寸。
- 正式browser完整來源及真正解壓ZIP通過：100個版面、16組流程、68組操作／幾何觀測，含空白／部分、六點到100分、四結果／只讀／重試、手機新圖域邊界、原有自動預覽及fullscreen；報告`output/playwright/horizontal-projectile-lab/report.json`。新增40個一般手機view的放大比例、標籤及鋼珠邊界檢查，未新增正式入口。
- T1／T2／T3×source/package×320×500及390×844×八profiles，96 cases／1764 gesture checks全數completed=true、status=passed，errors／issues皆空。八profiles為取點、量尺、豎尺、兩方向自動預覽、已描點、首次放點及計時；逐move及放手後核對host／panel／viewport、可信事件、答案及suspend，含完成、cancel、lost capture、blur、第二指。報告`mobile-space-T{1,2,3}-{source,package}.json`同目錄；摘要`mobile-space-acceptance-summary.json`。
- 六份touch報告的17檔digest皆為`cbbfb8efa238d9a50a42be788deb6b6e2ec29f4cd410d5d19b96490cd7a3fc2f`；正式browser16資產hash為`1a7348d247bf2459582fd3d7c0210c151e6fcab283451f4a7e196328f3948b1c`。最終SCORM17檔與來源逐byte相同。
- 四個活動Node入口及mobile-scroll契約、`check:tests`、`check`、文件連結及`git diff --check`通過。已提交選擇預覽base `8325eec`／head `1c8be34`為affected、214 entries、單一活動package，報告`selection-preview-mobile-space.json`。本次沒有重跑全部213個Node、其餘32個browser、GitHub CI、實際OS縮放、實體電話或Moodle；先前213項通過屬上一版證據，不以選擇預覽冒充本次完整CI。原總閘維持未勾選。
- 同一Site `appgprj_6ad49418111c819198d79e88cab3e78e`保留owner-private權限及[原網址](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)。官方helper已推送Sites source `3061193b8b8cb2194a451a477421d598cbc360a7`；saved version為`appgprj_6ad49418111c819198d79e88cab3e78e~appgver_d2ae63133c2881919e36bb7b19c0b27e`，deployment `appgdep_6ad498f36f7881919328ae2a8589aef1`由原生發布確認`succeeded`。
- Sites archive `output/sites/horizontal-projectile-lab-mobile-space-1c8be34.tar.gz`共18檔；16個runtime資產與上述已測版本逐byte／SHA-256一致，根入口及hosting identity保持。Archive SHA-256為`beb250213f39a328841633332f73adc1569f20605b9d9c294c91d6f95ea2d7cb`；資產證據`output/sites/projectile-mobile-space-assets.json`。後續文件提交不改runtime。

## 使用者釐清：預覽只在畫布，零線亦吸附（2026-10-18）

- 取消所有panel fallback；預覽及四選項只放在畫布內，水平／豎直尺對齊所選印記才自動顯示，移開隱藏。尺未對齊時不再出現拖尺角落放大鏡；作圖的精細拖點預覽保留。
- 小畫布使用並排的放大尺面／四選項，豎尺旁有空間時改直排卡；依測量點選左右／上下位置並限制在畫布內。極短窄iframe的量度步改雙欄，使預覽留在畫布，維持44px選項。這項使用者指示取代先前小畫面移到面板的設計。
- 沿量度方向的尺零刻度靠近原點基準線時亦吸附；即水平尺對x=0、豎直尺對y=0。零線吸附不依賴選點；對印記方向的吸附仍須選點。零位離開吸附範圍時仍可錯置，預覽仍顯示四個錯誤位移，不代為記錄或改讀數。
- 範圍：活動model/main/HTML/CSS及既有model/browser測例、既有mobile-scroll操作預覽契約、本計劃與同站更新。評分、schema、模型物理及資產數保持。驗證零線／印記兩方向吸附、未選點、閾值邊界、Canvas內預覽及四選項、移開即隱藏、錯零位、手機及極短iframe、可信拖放／取消、source／SCORM，再commit/push及更新既有私人Sites。

### 畫布預覽及零線吸附的最終驗證

- 程式head `005657d0029690c69d355b95f2b7f235e78a8535`已推送。Model測試驗證水平／豎直的零線、正負閾值邊界、未選印記時僅對零線吸附、兩方向同時吸附及遠離零線仍可錯置；四選項／原評分及保存相容性保留。全部213個Node入口三批各71項通過，每項300秒，報告`output/ci-tests/projectile-canvas-preview-node-{1,2,3}/report.json`；沒有改長測試或runner。
- 正式browser的來源及真正解壓SCORM通過100個版面、16組流程及68組操作／幾何觀測。實際滑鼠拖動以零位偏5mm接近零線，放手後核對吸附至0；保留錯位50mm的四項皆錯。預覽四選項在1280×800、390×600、320×500及320×225均assert為stage子元素且完全在畫布內，選項≥44px，SVG放大尺刻度可見；移開時預覽及尺的角落放大鏡皆隱藏。包含完整100分、空白／部分／review／重試及既有手機放大圖域檢查。已視察`{source,package}-canvas-reading-<width>x<height>.png`及兩方向手機預覽；極短iframe使用雙欄與精簡卡，沒有把卡移入panel。
- T1／T2／T3×source/package×320×500及390×844×四讀尺profiles：48 cases／912 gesture checks全數completed=true、status=passed，errors／issues皆空。新契約用實際SVG尺邊與印記座標獨立判斷對齊，只在對齊時要求畫布預覽；未對齊時不得出現預覽。完成、取消、lost capture、blur及第二指均核對host／panel、答案及suspend。報告`output/playwright/horizontal-projectile-lab/canvas-preview-T{1,2,3}-{source,package}.json`，摘要`canvas-preview-acceptance-summary.json`同目錄。
- 六份touch報告17檔digest皆為`2905fa93c3c2871a123ab2397e5da0a59ebf9123a959ea1168ec0a35913284e7`；正式browser16資產hash為`c0e380a7de102d3294faed9db85b0cdcec6b2d7a354a073ad9723fc69fb4fd2d`。最終SCORM仍17檔，與來源逐byte相同。
- `check:tests`仍246 entries／48 helpers／2 manual；`check`、`package:all`、文件連結及`git diff --check`通過。已提交選擇預覽base `577b3da`／head `005657d`為full、246 entries、packages=all；報告`selection-preview-canvas-preview.json`。中央mobile-scroll helper只改本活動操作契約；其他兩個活動的操作函數與base在正規化換行後完全相同。沒有重跑其他32個browser、GitHub CI、真手機、OS縮放或Moodle，保留原總閘未通過。
- 同一私人Site及[原網址](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)已更新。官方helper推送Sites source `b5ecd9a635fc98ab26138045a8c4661e32ab7a0d`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_664e3df435ac81918095e9dea42f660d`，deployment `appgdep_6ad4a071ca148191b06ae8b687f9079f`由原生發布確認`succeeded`。
- Sites archive `output/sites/horizontal-projectile-lab-canvas-preview-005657d.tar.gz`共18檔，16個runtime資產與已測來源逐byte／SHA-256一致；archive SHA-256為`7c45366d2bb4fcad4fe703b7d3138216ae4d4ed77d5c5a5208b7c1d414ec4241`。資產證據`output/sites/projectile-canvas-preview-assets.json`；後續文件提交不改runtime。
## 量尺自動辨認印記修訂（2026-10-18）

使用者釐清：量度不先選點。取消量度選單，水平／豎尺按垂直於尺面的距離，自動吸附最近的已記錄印記；距離相同時採用較前的資料列。Canvas預覽、印記名稱及四選項跟隨尺位，點選直接記入對應列。尺零線吸附、錯零位四項全錯、作圖選點及既有評分維持。

目標從當前尺位推導，不改schema或保存選點；拖動只預覽，放手才保存尺位，取消恢復原狀。修改範圍涵蓋model/main/HTML、model及browser測例、mobile-scroll本活動操作契約與fixtures。本次驗證未選點／舊選點不影響兩方向最近吸附、切換印記、對應列讀數、錯零位、觸控取消及來源／SCORM，完成後commit/push及更新原私人Sites。

### 自動辨認印記的最終證據

- Runtime commit `c451ccf02bf9f4a24b5e22d539f025469788d4f5`及觸控測試修訂 `90706f6c6b27f86e18aaa1c2d3fe1722a5b1bdb6`均已推送。量度完全不讀取selectedSlot，原作圖選點及draft/review schema維持。Model斷言涵蓋最近點、兩方向、未選點／舊選點、閾值外、等距及舊重疊印記的穩定選擇，並核對操作不修改傳入狀態。
- 正式browser來源及真正解壓SCORM通過100個版面、16組流程及68組操作／幾何觀測；六點完整作答直接移尺、選項記入對應列後可得100分，沒有量度選單。未選點及舊選點下的兩方向吸附／放大、錯零位、手機／極短iframe、resume、review及原有提交四結果通過。報告`output/playwright/horizontal-projectile-lab/report.json`於commit前啟動，git metadata仍為`f0c0d8c`，實測16資產hash `45e7b0fd1f76122502fd5d5ebf34ca96428ba547b018ca5a18bd48d7f33f5f28`與最後runtime逐byte相同；不以舊git metadata冒充舊版測試。已視察390×600畫布內自動豎尺預覽截圖。
- 首輪觸控測試在自動切換印記後，固定尺身中央落手被移動後的選項遮擋，導致Missing capture。測試改為在可見尺身內找實際命中尺身的位置，無外露尺身即失敗；沒有放寬捕捉、可信事件或取消保存斷言。單獨320×500豎尺預覽復測通過，完整T1／T2／T3×source/package×320×500及390×844×四量尺profiles重新通過48 cases／912 gesture checks，全部completed=true、status=passed，errors／issues皆空。報告`auto-target-T{1,2,3}-{source,package}.json`及`auto-target-focus-vertical.json`均在同一browser輸出目錄；摘要`auto-target-acceptance-summary.json`。
- 六份touch報告17檔digest皆為`ede5a63c6f0674a86a4f47c2968596c317fc5b3b0bf62e9d5cb07932922e4438`，最終SCORM17檔與來源逐byte相同。全部213個Node入口通過（`output/ci-tests/projectile-auto-target-node-{1,2,3}/report.json`）；測試helper修正後亦重跑mobile-scroll契約及全部上述觸控檢查。`check:tests`為246 entries／48 helpers／2 manual；`check`、`package:all`及文件連結當時記錄為通過；該輪diff空白檢查原通過聲明不正確：2026-10-19重驗`f0c0d8c..90706f6`在檔尾空行失敗，不能以增量／工作區檢查代替全分支。已提交選擇預覽base `f0c0d8c`／head `90706f6`為full、246 entries、packages=all，存於`selection-preview-auto-target.json`；其他活動操作函數未變。沒有重跑其他32個browser、GitHub CI、真手機、OS縮放或Moodle，原總閘維持未通過。
- 已更新[原有私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)，保留owner-private權限。官方helper已推送Sites source `83e9d9507a0ffa5a596ca09759931901274ee74f`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_e800af4493088191a5610a437476f0f8`，deployment `appgdep_6ad4a47815bc8191b822fdbda9ddb89e`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-auto-target-c451ccf.tar.gz`共18檔，含與已測來源相同的16個runtime資產、根入口及hosting metadata；SHA-256 `a278508009157e1a0b98d6143308bbe70a369da3ca0de59dbfb4fa17420c4e70`，資產證據`output/sites/projectile-auto-target-assets.json`。後續文件提交不改runtime。
