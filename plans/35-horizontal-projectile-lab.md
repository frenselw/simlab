# 平拋運動：軌跡量度與擬合實驗

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

狀態：**2026-10-18 新版近似選項、自動描點、選公式批次估速及同站部署已完成，現行證據見上節。** 下文保留原規格及歷史驗證供追溯；與本節衝突時以本節為準。真Moodle／實體手機及全專案browser總閘未宣稱通過。

- 分支：`codex/horizontal-projectile-lab`。
- 起點：本機 `main`，`f7ab989ca59b72ebe6a7691129320c4768f6fcf8`；未宣稱已同步遠端。
- 由[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)複製及填寫；遵循[共用風格](00-shared-platform-and-style.md)與[製作指南](../docs/simulation-scorm-production-guide.md)。
- 使用者指定：固定高度放鋼珠、水平出口、上下移動接球槽、覆印紙留痕、用尺量度 x／y、逐點求初速度再求平均、約1%的輕微實驗差異、研究分運動、畫軌跡及二次函數擬合。
- 本稿首版建議：六個取樣位置、形成性評分，以及後段揭示每次投球的獨立計時。這些仍是設計預設；逐點估速、平均及輕微差異已由使用者明確要求。

## 建議的學生體驗

1. **設置與取點**：直接進入實驗裝置。學生上下拖動接球槽，按「釋放鋼珠」；球由斜槽同一標記靜止釋放，經水平出口飛出、撞槽留下接觸痕跡。模擬再將該印記按球心基準轉記至共同記錄紙，呈現為一個固定的深色小圓點 P₁；以短提示「將本次印記轉記到記錄紙」說明這是模擬提供的轉記功能。每次只留下撞擊的一點，投球階段不自動畫出完整軌跡。
2. **重複實驗**：改變槽高，最多記錄六點。舊印記不隨槽移動；可以選一個點重做。每次投球的出口速率圍繞同一參考值約±1%波動，同高重做可見輕微落點散布，並非每次完全重疊。提示分散高低取點，不代學生安排正確位置。
3. **量度**：記錄紙近景以出口球心 O 為原點，向右為 x、向下為 y。拖動水平／豎直尺身，量度O至每個圓點中心的水平距離x及向下距離y；對齊所選印記時吸附垂直於尺的方向，只在畫布的測量點旁顯示放大尺面及四選項，放手後點選記入表格。沿尺方向的零刻度靠近原點基準線時亦吸附；對零時僅一項正確，遠離零線的錯位可使四項皆錯，不自動改讀數。
4. **作圖與擬合**：根據自己的表格逐點放到 x–y 圖，可顯示資料點折線，再比較一般直線及一般二次函數擬合。所有曲線只用學生已放置的點，不用理想答案修正錯點。
5. **逐點估速及平均**：先明示「暫採用豎直自由落體模型」，表格每個印記各填tᵢ及初速度估值v₀ᵢ；六點齊備時取得六個速度，再由學生計算平均初速度 v̄₀ = (v₀₁ + ⋯ + v₀ₙ)/n。畫面列出本次納入的點與n；另用受限模型 y = kx² 的擬合係數估一個代表速度，與平均比較。
6. **獨立計時對照**：按「顯示計時記錄」，揭示離軌至撞槽的模擬時鐘讀數。以自己的量度配對時間，觀察 x–t 直線及 y–t 二次擬合，研究水平勻速、豎直自由落體並估計 g。
7. **檢查及提交**：任何進度均可檢查、返回修改或明確提交空白／部分／完整答案；提交後展示分項評分、自己的圖、參考軌跡及解釋。

只有 y ∝ x² 不能獨立決定 x(t)、y(t)。用 y = ½gt² 反推時間再驗證自由落體會循環論證，因此第 5 步屬**模型假設下估速**，第 6 步使用**不由學生 y 反算的計時觀測**。時間來自模擬離軌／撞槽事件，不是慢放動畫的牆鐘時間。有限數據的結論寫作「與模型相符」，不宣稱證明每個瞬間，亦不把模擬本身當成真實世界的獨立實驗驗證。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `horizontal-projectile-lab`；量度及重建平拋軌跡、估算 v₀、比較擬合及分運動證據 |
| Delivery scope / package | Assessed SCORM 1.2；`sim/manifests/horizontal-projectile-lab.xml`；`npm run package -- horizontal-projectile-lab` |
| Learner task / main interactions | 調槽、投球、六點記錄、拖尺／換向、畫布四選一讀數、描點、擬合、估速、計時對照及提交 |
| Shared subject core / activity outer layer | 本活動擁有平拋模型、答案、rubric、保存；重用既有純數學擬合，不建立通用實驗編輯器 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JS、SVG、Pointer Events；`index.html`、`styles.css`、`main.js`、`model.js`、`scoring.js`、`persistence.js`、`ui-runtime.js`、`presentation.js`；ui-runtime集中真正的啟動／提交邏輯，供瀏覽器及 Node 測試共用；依賴下表共用檔；按使用者要求重用現成本地MathJax及CircuitMath作TeX→SVG，不加npm依賴、不用CDN |
| Assessment risk / trusted validation | `formative`，100 分、60 分達標；瀏覽器端評分不防竄改。本版不作高風險考試，server validation N/A，不包含秘密 |
| Out of scope | 斜拋、可變 g／釋放高度、飛行阻力、反彈、自轉顯示、隨機題庫、額外座標／計時噪聲、完整不確定度傳播、跨 attempt 歷史、匯出及另一套教師工作台；本版只加入下述約±1%出口速率波動 |

「畫軌跡」採學生**親自描點＋折線觀察＋擬合曲線**，不另建自由筆畫評分；沒有一鍵代放正確點。

### 實作接觸範圍

| 路徑 | 計劃改動／依賴 |
|---|---|
| `sim/horizontal-projectile-lab/` | 上述八個 runtime 檔、model／scoring／persistence／lifecycle 測試及共用測試 fixture `test-support.js` |
| `sim/shared/styles.css`、`scorm.js`、`activity-flow.js`、`fullscreen.js` | 現成依賴，沿用 API／樣式 |
| `sim/newtons-second-law-investigation-lab/fitting.js` | 直接相對載入 `NewtonFitting.fit/predict`；已有直線、二次、過原點擬合。平方模型將 x 轉成 x² 再用 `origin`，不複製 QR 解法或搬動原 callers |
| `sim/circuit-workbench/circuit-math.js`、`mathjax-tex-svg.js`、`mathjax-license.txt` | 只重用現成TeX→SVG排版API及本地bundle，沒有修改電路功能；全部入manifest與ZIP |
| `sim/config.js`、`sim/manifests/horizontal-projectile-lab.xml` | 已新增 metadata／全部 runtime 資產；不打包開發測試檔 |
| `tools/horizontal-projectile-browser-regression.js` | 正式入口同時覆蓋 source 及實際解壓 ZIP |
| `tools/mobile-scroll-cases.js`、`mobile-scroll-operations.js`、`mobile-scroll-browser-regression.js` | 加入本活動合法 fixtures、每種目標及狀態觀測，重用 T0–T3 hosts |
| `tools/test-registry.js` | 登記每個新 test／browser owner；manifest 提供擬合檔的反向消費關係 |

已查閱自由落體量尺、運動合成頻閃及牛頓第二定律擬合的實作／計劃，只取相關做法；其歷史驗收不代表本活動通過。若需修改既有 fitting，須一併檢查其 `graph.js`、`interpretation.js`、`scoring.js`、`main.js`、`fitting.test.js`、HTML／manifest 及兩個活動套件。

## Catalogue metadata (`sim/config.js`)

```js
{
  title: "平拋運動：軌跡量度與擬合實驗",
  folder: "horizontal-projectile-lab",
  categories: ["Mechanics"],
  description: "調整接球槽留下鋼珠印記，量度與描出軌跡，逐點估算初速度及平均，再以擬合與計時研究分運動。",
  tags: ["physics", "mechanics", "projectile-motion", "measurement", "curve-fitting", "scorm"],
  status: "active"
}
```

folder 與活動／manifest slug 相同，可部署才登記 `active`。

## Physics or subject model

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 釋放 H／參考出口速率 | 實心球理想純滾動上限v理想 = √(10gH/7)，I = 2mr²/5；以小量平均耗散取v參考 = 0.99v理想 | m、m/s | H = 0.200m；g = 9.80m/s²；v理想 ≈ 1.67332m/s，v參考 ≈ 1.65659m/s；參考速度提交後才揭示 |
| 各次出口速率 vᵢ | vᵢ = v參考(1 + εᵢ)，εᵢ = speedOffsetPpm/1000000；每次投球抽一次均勻整數speedOffsetPpm ∈ [-10000,10000] | m/s、無量綱 | 約±1%表示有界波動幅度，不是每次剛好差1%或標準差1%；最高0.99×1.01=0.9999倍理想上限，不憑空增加能量 |
| 飛行 x、y、t | 第i次用固定vᵢ，x = vᵢt，y = ½gt²，vx = vᵢ，vy = gt | m、s | 每次出口仍水平、vy(0)=0，無飛行阻力；飛行中不逐幀重抽速率或擾動g |
| 接球深度 d | 球心到達 y=d 時記錄撞擊；一幀內跨過事件須解析定位／插值，不能用下一幀時間當讀數 | m | d=0.050–0.800m，5mm 步距，初始0.200m；未投球沒有觀測 |
| 球心及槽面 | 印記表示球心位置；槽承托面畫在碰撞球心平面下 r，痕跡按球心基準轉記到共同紙面 | m | r=0.010m；不能把槽表面高度當球心下落距離 |
| 計時器 | 記錄離軌至撞槽的飛行時鐘，不使用學生讀數反算 | s | 顯示到0.001s；斜槽時間不計；預設4倍慢放不改物理時間 |
| 量尺／讀數 | 面板 cm，最小輸入0.1cm；內部整數mm；主尺cm刻度，局部放大能辨1mm | cm、mm | 六個記錄，建議跨至少50cm；每次印記以該次vᵢ產生，刷新不重抽已記錄差異 |
| 逐點估速／平均 | 在自由落體假設下tᵢ=√(2yᵢ/g)，v₀ᵢ=xᵢ/tᵢ；平均為所有已填速度的算術平均 | SI | y≤0、t≤0顯示無法計算；平均至少兩個已填速度，建議完成全部六點，空白／部分提交仍合法 |
| 軌跡模型 | 探索y=Ax²+Bx+C；受限擬合y=kx²，代表速度=√(g/(2k)) | A、k：m⁻¹；B：無量綱；C：m | 各次真實kᵢ=g/(2vᵢ²)，中心k參考≈1.78553m⁻¹；多次資料只近似共同拋物線，不要求完全落在同一條曲線 |
| 計時對照 | x=ut+x₀；y=αt²+βt+γ；g估=2α | u、β：m/s；α：m/s²；x₀、γ：m | 顯示截距、一次項；不能先強制β=0再稱驗證初始豎直速度為零 |

斜槽表現鋼珠「滾動」，不使用無轉動滑塊的 √(2gH) 當真值。同高釋放代表初速度大致相同；細微波動用於模擬滾動接觸／耗散差異，學生另有量度與描點誤差。接球槽只顯示位置及上／下微調，不顯數字深度；印記及預設值不能成為量度答案提示。可用不同slot保留同高重複的印記；「重做這一點」只取代該slot，不暗存無限歷史。解析度內仍可能出現相同落點，不強迫每次一定不同。

speedOffsetPpm在一次新的「釋放」開始時抽取，該次動畫、撞擊印記、真值及評分都共用同一值；撞槽完成後與觀測一起保存。已記錄點在重繪、換頁、擬合、Moodle恢復及提交重試時不得重抽；新投球／確認重做才重新抽。中途取消的飛行不留下半個觀測，刷新不自動生成新球或新印記。只需保存各次實際偏移值即可重建，首版不另設seed／事件歷史系統。

約1%的規格指初速及相同接球深度下水平落點的相對波動；不在x、y各自任意加1%或在最後表格才修改數字。球的動畫撞擊、圓點中心、計時、真值評分一致，g、水平出口及紙尺比例保持所定校準。若縮圖看不清毫米級散布，可用既有局部放大觀察，不能放大誤差改變物理座標。

各次飛行本身仍水平勻速；不同投球的vᵢ略異，因此合併x–t圖會有約1%散布，擬合描述代表速率。平均有助減少隨機波動的影響，但不保證六次誤差完全抵消；不能用多次投球的散點宣稱獨立證明某一次全程每瞬間的速度。

### 擬合與探究回饋

- 軌跡選項為 `linear`、`quadratic`、`square`，預設未選；先比較一般直線／二次，再介紹平方模型估速。
- 直線需兩個不同 x，二次需三個，平方亦需兩個且 ∑x⁴>0；提示六個分散點更有判斷力。低於要求或秩不足是數學失敗，仍可提交。
- 只用學生已放點；未放點不補，重複 x 不暗中刪除，錯點不修正。顯示方程、參與點數及 RMSE；二次參數較多，RMSE 較小本身不是充分物理證據，不以 R² 自動選答案。
- 平方 k>0 才可換算代表速度，與逐點速度平均比較；有微小投球差異，兩者不必完全相等，不能要求零RMSE。一般二次的 B／C 需解讀，不能默認為零；曲線裁切於圖域。
- 折線按學生點 x 排序，標示「資料點連線」，不聲稱球走折線。改點／換模型後撤下舊擬合，須重新按擬合。
- 計時對照直接用各方向非空讀數配對其時鐘，產生 x–t／y–t 圖及擬合，無須重複手工作兩幅圖；列出使用／缺少數據的筆數，不能補理想值。
- 自己的圖、方程、RMSE、量尺預覽及揭示後時鐘屬提交前探究工具；正確座標、隱藏速度、分數／正誤及參考軌跡在可信提交後才顯示。

## Responsive layout contract

Apply [layout](00-shared-platform-and-style.md#layout) and [mobile interaction](00-shared-platform-and-style.md#mobile-interaction).

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：緊湊標題、進度、檢查及fullscreen；stage：裝置／記錄紙／圖；panel：操作、表格、計算／結論 |
| Fullscreen (mandatory) | 外層main標記 `data-sim-fullscreen-target`、header標記 `data-sim-fullscreen`，manifest列shared/fullscreen.js；右上44px目標與標題／進度不重疊 |
| Desktop / tablet | ≥900 CSS px 並排，panel 25–30rem；主文21px、圖上標籤24px；較窄直向上下排列 |
| Control-panel classification | `bounded split-panel`，拖尺、作圖、填表需要同時看見舞台 |
| Phone stage and controls | 一般手機畫布取62dvh與畫面寬度加56px之較小者；預覽／四選項永遠在畫布內，按空間改並排／直排，維持44px選項。panel至少96px且可到最後控制；極短窄iframe的量度步用雙欄，預覽仍在畫布，不增加舞台scroller。 |
| Phone text | 主文／控制18px、圖標16px實際顯示；細尺刻度透過4–8倍預覽辨識 |
| Viewports | 320×500、390×500、390×600、390×844、桌面／平板、320×400及320×225短iframe、橫向、工具列／鍵盤、200% zoom |
| Scroll topology | 活動document有界、無競爭縱向range；panel獨立捲動且邊界不轉host；T0–T4 owner逐項記錄，未實測不宣稱通過 |

裝置及x–y圖維持兩軸相同物理比例，向下y為正；計時圖以時間為橫軸、位移值向上增加，明示「位移大小—時間」。作圖固定0–100cm，所有合法錯點保留；不隨答案調相機。

## Navigation, submission and reset

Apply [navigation](00-shared-platform-and-style.md#navigation) and [submission/reset](00-shared-platform-and-style.md#submission-and-reset).

| Decision | Activity specification |
|---|---|
| Navigation | `dependent`；取點→量度→軌跡→估速→計時，前後步可走，不以填完／答對作門檻；header為進度標籤，check可返回指定步驟 |
| Final check access | 所有editable view均可check；進行中的動畫／拖動取消回復最後完成狀態，不阻擋空白提交 |
| Incomplete submission | 只列已取／量／畫／答數與缺項，不透露正誤；明確「提交目前答案」 |
| Editable reset | 重做這個印記、清本圖、清本次實驗；已有資料時說明影響並確認，取消完全保留 |
| Scored / pending attempt | 無清結果／restart；只讀、fullscreen及shared允許的重試；standalone刷新另按共用契約 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| collect | 無上游；選空slot或重做點 | 六點滿時不能默默覆寫最舊點 | 調槽、釋放、下一步、check |
| measure | 該slot有撞槽記錄 | 無點留空；x／y可各自未答 | 拖尺、點選讀數、清除某讀數、返回／下一步、check |
| plot | 該點兩讀數都非空才可放點 | 不補缺數，不修錯點 | 放／拖點、擬合、返回／下一步、check |
| speed | 每個記錄slot對應自己的tᵢ／v₀ᵢ，需該點讀數完整；平均需至少兩個已填速度 | y=0合法但不可反算；缺依賴不製造答案，不可挑選性排除已填速度 | 逐行填t、v，再填全組平均／擬合估速，或check |
| motion | 揭示記錄後才有時間圖；各擬合需足夠秩 | 無／少資料留空；概念題仍可答 | 顯示時間、查看圖、填g／答題、check |
| check | 不需完成任何步 | 空白／部分同樣合法 | 返回指定view或明確submit |

## Diagrams, notation and assistance

Apply [diagrams/notation](00-shared-platform-and-style.md#diagrams-and-notation), [snapping](00-shared-platform-and-style.md#snapping) and [touch preview](00-shared-platform-and-style.md#touch-preview).

| Decision | Activity specification and reason |
|---|---|
| Notation | x、y、t、g、v₀為約定方向的標量；cm表格／圖軸、SI公式，數值擬合式旁明示位置以m、時間以s表示；k／A／α避免與加速度a混淆；所有物理量、點標籤、數學符號、刻度數值及單位均使用LaTeX經現成本地MathJax轉成SVG；面板／舞台／放大鏡／回饋一致 |
| Arrow graphics | x向右、y向下軸箭頭，從初頁明顯標示紅色O(0,0)在出口球心；無學生矢量作圖。若有出口箭頭只表方向、不顯示未知速度大小 |
| Snap | 槽5mm步距；已選有效印記時尺才吸附可見O／該點投影，未選點可自由移尺；圖點只吸公開1cm格。mouse8px、touch/pen12px CSS門檻，不吸答案／理想軌跡；與評分容差分開 |
| Snap release | mouse移3px、touch/pen6px才開始拖，輕觸保留原值；用最近可見對齊線／公開格點，預覽與放手同一幾何。實作沒有加入初稿建議的1.5倍黏附遲滯：窄屏1cm格距遠小於12px，避免圖點被黏住而難以移動 |
| Touch preview | 拖尺／拖圖點保留角落128×112px真實自動放大鏡，至少4 CSS px/mm，取消／放手清除。按「放大尺上讀數」或讀數卡的「放大」時，在讀數點附近的同一卡中顯示真實尺面Preview Window（桌面高150px、手機120px），可收起，不顯示額外答案、不改作答；空間不足移入panel。預覽不接管手勢，零位把手44px透明目標位於零字左上方。 |

尺以按鈕切水平／豎直，不加任意旋轉；拖動預覽在release、cancel、lost capture、blur、導航及鎖定時清除，拖動相機固定。學生主動開啟的靜態讀數放大可在換尺時保留，blur／resize／導航／鎖定時關閉，不保存或評分。

## Touch gesture ownership contract

依[完整手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)驗收；以下selector已實作，像素及 owner 的已執行證據見文末。

| Target type / modes | Visible footprint, selector, hit area/halo and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 接球槽／collect | `#catcherHandle`，槽側44×44px HTML握柄，不覆蓋整槽／背景 | 持續掛載，`touch-action:none` | 方向鍵5mm、Shift25mm，面板±按鈕 |
| 水平／豎直尺／measure | `#rulerBodyTarget`，透明操作面完全覆蓋實際尺身；尺外讓host捲 | 持續掛載，`none`；對所選點方向及沿尺方向零線吸附，僅對齊印記才在畫布自動預覽 | 方向鍵1mm、Shift10mm；換向按鈕 |
| 新／舊圖點／plot | `[data-point-slot]`，可見14px點／選取18px，局部44×44px hit；相近點可面板選P編號 | 持續掛載HTML目標，`none` | 「放置此點」在可見中央起始，再方向鍵1cm、Shift1mm；也可數字微調同一圖域 |
| 首次點選放點／plot | `#plotInputSurface`，只在「放置所選點」模式開啟中央有邊界圖域，放下即退出 | 固定面，操作前已有`none` | 同上；不是自動放到量度答案 |
| 按鈕／讀數／選項 | 原生control，≥44px，面板適合小數的輸入鍵盤 | 原生操作；panel `pan-y`，不全域鎖host | Tab／Enter／原生輸入 |

雖然沒有自由筆畫，放點模式仍擁有中央表面，故兩側各留**至少32 CSS px**可用捲動條（320px寬時各32px）；預覽、點halo及透明overlay不可侵入。

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 非互動裝置／紙面／圖空白 | Enclosing host | `pan-y`；沒有整面不可見攔截 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| panel文字／按鈕／頂中底 | Panel only，包括邊界 | 原生overflow、contain；不改host style／scroll | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| 中央圖域，僅放點模式 | Simulation | 只操作所選slot，有明示邊界 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| 圖空白，非放點／check／review | Enclosing host | overlay關閉，局部合法hit以外可捲 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| 左捲動條 | Enclosing host | ≥32px及足夠高度，每模式均可達 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| 右捲動條 | Enclosing host | ≥32px及足夠高度，每模式均可達 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |
| 槽、尺、圖點各握柄 | Simulation | 只有目標改變；scroll、viewport、iframe位置不變 | T1–T3兩來源、兩尺寸18 profiles均通過，詳見文末 |

先驗原生路徑及有界document；若不通，辨認真正owner並依指南驗證必要adapter，不盲目寫parent/top捲動或發送無receiver訊息。來源及解壓套件都留trusted touch、engine、逐move/release、非owner不動、canonical state及runner非零失敗退出證據。

| Host case | Frame chain and actual owner selector/window | Origin/sandbox / native path or verified adapter | Source/extracted evidence; deployment/device evidence separately |
|---|---|---|---|
| T0 standalone | 直接頁面有界，panel自捲 | 真正無外層range才可將host movement記N/A | 直接頁面兩來源通過，詳見文末 |
| T1 direct iframe | 外document → 活動iframe；owner外document.scrollingElement | same-origin中性host，無隱藏轉交 | 兩來源各36 cases通過，詳見文末 |
| T2 nested player | 外document → 不捲wrapper → 活動；owner外document | wrapper不能當owner | 兩來源各36 cases通過，詳見文末 |
| T3 overflowing element | 有界外window → `#scrollOwner`溢出元素 → wrapper／活動 | 只元素動、所有window不動 | 兩來源各36 cases通過，詳見文末 |
| T4 Moodle | 實際current-window及有提供的新視窗player | 記實際owner、origin、sandbox及overflow；不可由本機推定 | 待實機部署 |

| Phase / page / scenario / mode | Legal production fixture and UI continuation | Blank points, drawing/orbit bounds, side strips and every target | Host cases / viewports / source-package evidence |
|---|---|---|---|
| collect空白／部分／滿／重做及動畫 | 正式startup後調槽／釋放／取消 | 空白、槽握柄、panel，動畫時間另外觀測 | T0–T3×source/package待測 |
| measure空白／單讀數／完整 | 恢復後選點、換向／量尺 | 兩方向尺、預覽、紙空白、panel | 同上，兩尺方向分開 |
| plot未放／部分／完整／放點模式／擬合失敗／成功 | 恢復後放點、拖點或擬合 | 新舊點、中央面、兩側條、退出模式後空白 | 同上，各模式分開 |
| speed空白／單行／部分／六行／零讀數／平均已答 | 恢復後填某行或平均 | 只讀圖、六行表格、鍵盤及panel | 同上 |
| motion未揭示／揭示但不足秩／可擬合 | 恢復後顯示時間／答題 | x–t、y–t各圖、panel；不殘留點hit層 | 同上 |
| check及返回各view | 正式check返回並完成合法動作 | 與首次進入分開，保留原答案 | 同上 |
| submitted／committed／frozen／technical | 正式outcome或validated snapshot | 移除編輯hit，保留host空白／fullscreen／合法retry | 同上 |

無第二套Canvas/WebGL renderer，fallback為N/A；runtime缺失顯示technical。依[完整驗收](../docs/simulation-scorm-production-guide.md#coverage-and-observable-acceptance)測上下方向、quick flick、panel頂中底／100ms連續手勢、cancel、secondary touch、blur、導航及鎖定。可見空白不能因碰到透明overlay而略過；source/DOM檢查及初頁通過不能替代此矩陣。

## Scoring and tolerance

| Decision | Activity specification |
|---|---|
| Rubric | 形成性100分、60達標、最低0；分項見下表 |
| Granularity | 評最終記錄及答案，不評拖動次數／速度；讀數、轉繪、計算及概念獨立；預設裝置不是學生答案 |
| Unanswered / null | 所有未答數字／選項為null，空slot／point為null；未答項0，untouched=0 |
| Extras / duplicates / penalties | 無負分；六slot上限，同高不刷取樣分；各slot最多一份逐點計算，平均納入全部已填速度、不另選子集；單選不准全選 |
| Tolerances | 全部對稱且含邊界，以物理量計；集中為常數，不混同CSS吸附，內部參考不先四捨五入 |

| Component | 分數 | 規則 |
|---|---:|---|
| 取樣 | 10 | 深度排序後與上一計分點至少20mm算新點，每點1分最多6；跨度≥500mm得4、250–499得2、其餘0 |
| 量度 | 24 | 六點每個x、y各2分，對照包含該次速率波動的實際印記；另一方向錯不影響，不把內建差異當學生量錯 |
| 作圖／軌跡 | 16 | 六點各x、y1分，對照學生自己的讀數（量錯但轉繪對仍有分）；軌跡選拋物線4分獨立 |
| 初速度 | 20 | 六點各t計算1、v計算1，合12；全組平均5（運算2、接近同組真實平均3）；平方擬合估速3（由自己的k換算1、接近參考速度2） |
| 分運動 | 30 | 水平類型6、支持證據6、豎直類型6、支持證據6；由獨立時鐘二次擬合估g6（換算3、接近真值3） |

計算採follow-through：各t對自己的y，v對自己的x及所填正t；平均對所有非null的已填v（包括0及錯值），缺值列不補0、不自動挑走離群值，n直接由目前答案重建。至少兩個v才可填平均，完整目標仍是六個點全算；畫面／check列出納入的P編號、n及未算列。擬合換算對自己的k／α。物理真值準確度另給分，不因上游錯將所有後續運算清零，缺真實依賴只有該項0。

平均的運算2分比較學生填的v平均，真值3分比較**同一批納入slot的實際vᵢ平均**；平方估速真值分比較v參考，既有10%容差保留，約1%波動不另扣分。參考值均由保存的speedOffsetPpm重建，不能每次評分重抽。平均運算採避免中間求和溢出的等價算法；有限結果不因錯誤求和次序變成Infinity。

證據題問「哪種數據特徵可支持這個運動模型」：水平為x–t近直線且斜率穩定；豎直為y–t二次項對應g/2、一次項近零且出口水平。類型題亦明示「在本活動水平拋出、只有重力作用的理想模型下」。兩者評一般物理知識，不預設學生自己的錯誤／不足數據已支持結論，不能寫成「你的數據顯示……」。概念題可在資料不足時回答，不依完成數鎖住。平方換算須已成功square fit且k>0；g換算須已揭示時鐘且三個不同t的y讀數。

由自己的二次擬合算出負的g估值，表示這組量度不支持所假設的自由落體模型，不代表真實重力加速度變成負值。允許輸入並按2α給運算部分分；接近正9.80的真值分另計。合法但很大的速度／加速度估值同樣保留，不為符合真值而截斷結果。

| Quantity / constant | 容差 | 內／外邊界例 |
|---|---|---|
| `READING_ABS_MM` | 對真實座標≤5mm | 差5通過、6不通過 |
| `PLOT_ABS_MM` | 對自己的讀數，各軸≤5mm | 讀300，點305通過、306不通過 |
| `CALC_TIME_ABS_S/REL` | ≤max(0.002s,2%×參考) | 參考0.200，0.204通過、0.205不通過 |
| `CALC_SPEED_ABS_MPS/REL` | ≤max(0.02m/s,2%×參考) | 參考1.50，1.53通過、1.54不通過 |
| `SPEED_TRUTH_REL` | 平均對同組真實vᵢ平均、平方估速對v參考，各≤10% | 對應真值×1.100通過、×1.101不通過；不能以無波動理想印記評讀數 |
| `G_CALC_ABS/REL` | 對自己的2α，≤max(0.10m/s²,2%×絕對參考) | 參考10，10.20通過、10.21不通過 |
| `G_TRUTH_REL` | 對9.80≤10% | 10.780通過、10.781不通過 |

## Phase/state matrix

Draft只有`edit`、`check`；五步由`view`表示。submitted／pending／committed／technical由shared lifecycle決定，不是可編輯draft phase。每列空白／部分／完整等變體以獨立fixture或參數化逐項覆蓋，check返回須與五個view交叉測。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| edit／零觀測：全新、已調深度，或曾在其他步作答後返回 | collect | 六null slot、合法setup | 全新時答案空；其他步的合法概念答案、軌跡選項、模型選擇／資料不足擬合操作及clockShown可保留 | 釋放並保留獨立答案，或check空白／部分提交 |
| edit／部分、滿六點、待重做 | collect | 1–6記錄及下一slot／深度 | 保留其他已答內容；未撞槽不先刪舊點 | 調槽／釋放或check |
| edit／無點、未量、x-only、y-only、完整 | measure | selectedSlot合法或null | 缺讀數明確null，不強制未來答案空白 | 選點／讀數／回取點或check |
| edit／無可放點、未放、部分、完整 | plot | 每個point依賴完整read | 未擬合；錯點可保留 | 放點／回量度或check |
| edit／選模型未執行 | plot | model非null、attempted=false | points可空／部分 | 嘗試擬合或check |
| edit／擬合失敗 | plot | attempted=true；不足點／秩／退化 | 保存所有錯點，不存failure cache | 改點／換模型或check |
| edit／擬合成功 | plot | attempted=true且可重算 | 係數由點派生 | 改點／換模型或check |
| edit／估速空白、單行、部分、六行、平均已答、不可算 | speed | 六行按固定slot對應；有計算值的行需完整read，平均需至少兩個已填v | y=0／所填0仍合法，不刪錯值或補未填行 | 填一行／平均／回量度或check |
| edit／計時未揭示 | motion | clockShown=false | gFromClock=null；概念可答 | 顯示時間／答題或check |
| edit／揭示，無資料／不足秩／可擬合（正、零或負α） | motion | clockShown=true | 不補缺的read；保留已有答案，負或大估值亦可保存 | 回量度／答題／填g或check |
| edit／check返回，套用以上每種invariant | 任一view | returnToCheck=true | 完整保留合法舊答案 | 改一次再返回check |
| check／空白、部分、完整 | 保留來源view | returnToCheck=false | 不要求任何上游完成 | edit指定view或submit |
| review／空白、部分、完整 | 只讀 | validated、rescored review | 無編輯／reset | 檢視圖／答案或fullscreen |
| frozen／validated | 等待頁 | canonical review及結果已驗證 | 未確認分數--，不透露解答 | shared同payload retry |
| committed | 已記錄頁 | 已commit未finish，同答案 | 鎖定 | shared finish retry |
| technical | 技術頁 | load-error或已quarantine不可信pending | 無捏造分數／重開 | 技術訊息、fullscreen；環境修復後重載 |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 調槽／選slot | editable | 只影響下一次投球，舊印記不動 |
| 撞槽完成 | 目標slot合法；覆寫已確認 | 原子寫depth／speedOffsetPpm／clock，清該read／point及同slot計算；若既有v被清則同步清meanV；清fit.attempted／fitV／gFromClock，其他點及計算／概念保留 |
| 動畫中取消／離開／check | 未完成撞槽 | 回到投球前保存狀態，沒有半個印記 |
| 改讀數 | row存在 | 保留原point供核對；清同slot的t/v，若v被清同步清meanV；清fit.attempted／fitV，改y清gFromClock。清空read另清該point，不刪其他行 |
| 放／改／刪圖點 | 完整read | 存mm座標／null；清fit.attempted／fitV，不改讀數／逐點估速或其平均 |
| 換模型／按擬合 | editable | 換模型清attempted／fitV；按擬合置attempted=true，成功／失敗重算 |
| 改逐點計算 | 該slot完整read；六行不可互換引用 | 改／清t原子清同列v，若原有v則清meanV；新增／改／清v皆同步清meanV並重建納入集合／n；其他行保留 |
| 顯示時間 | editable，零記錄亦可 | clockShown=true；新記錄亦可查看，不改量度／估速 |
| 清本圖 | editable、確認 | 清points、fit、fitV、trajectory；保留觀測、讀數、逐點估速／平均、分運動 |
| 清本次實驗 | editable、確認 | 回新edit/collect，所有答案及觀測清空 |
| check→edit→check | 可編輯 | 正確保存view／returnToCheck，不生成完成或得分旗標 |
| submit | check及明確操作 | 清暫態、canonical review重算後交shared；結果鎖定依outcome |

依賴清除直接更新同一份權威狀態，不依靠input/change事件連鎖。任何新增／改變／清除一行v的動作，都在同次更新清meanV；原本為null且仍為null的v不算來源改變。例如新增尚未計速的印記，可保留以原有速度計算的平均；填新速度時才使舊平均失效。

## Persistence contract

沿用[快照契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)及[恢復測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)。以 `SimScorm.makeSnapshot(ACTIVITY,"draft",answer)`／`"review"` envelope保存；以下欄位缺失不能當null。

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| 共用版本 | ACTIVITY=`horizontal-projectile-lab`；`schemaVersion:1,modelVersion:1,rubricVersion:1` |
| `rows` | 長度恆6，每格null或`{depthMm,speedOffsetPpm,clockMs,read:[xMmOrNull,yMmOrNull],point:nullOr[xMm,yMm]}` |
| 觀測域 | depthMm整數50–800且5的倍數；speedOffsetPpm整數-10000..10000，依其重建該次vᵢ／印記；clockMs整數，等於modelVersion1撞槽事件秒數×1000捨入值，不用學生y重建。新偏移只在釋放抽取，restore不呼叫random |
| 讀數／點域 | read各值null或整數0–1000mm；point null或兩個0–1000整數。point非null需read兩值非null，但不要求答對 |
| `fit` | `{model:nullOrEnum,attempted:boolean}`；enum=`linear\|quadratic\|square`；model=null必須attempted=false |
| `trajectory` | `null\|line\|parabola\|circle\|other` |
| `calculations` | 長度恆6的`{t:nullOrNumber,v:nullOrNumber}`陣列，與rows同index對應，不另存slot引用；任何t/v非null需該row存在且read完整，row空或read未完整時該行t/v都null |
| 計算number域 | t=0–10s；v、meanV、fitV為有限非負m/s數字，gFromClock為可正可負的有限m/s²數字；結果欄不設100或其他任意幅值上限。原生number欄用step=any，保留有限數值，不強行截成三位小數；亦接受有限科學記數法。0是合法錯答，不是未答；非有限運算不截斷或偽造答案 |
| `meanV`／`fitV` | null或上述number；meanV非null需至少兩行v非null，納入全部非null速度，集合／n只由該陣列重建；fitV非null需attempted=true且成功square fit、k>0，是否算對由scorer判斷 |
| `clockShown`／`gFromClock` | boolean／nullOrNumber；gFromClock非null需已揭示且可由現有y/time重建二次擬合；不因α負而拒絕學生錯讀數 |
| `conclusions` | `{horizontal,hEvidence,vertical,vEvidence}`，各null或所屬enum，見下列 |
| 選項enum | horizontal=`uniform\|accelerating\|decelerating\|insufficient`；hEvidence=`linear-x-time\|quadratic-path\|equal-y\|same-release-only`；vertical=`free-fall\|uniform\|nonzero-initial-speed\|insufficient`；vEvidence=`quadratic-y-time-zero-initial\|y-derived-time\|curved-path-only\|equal-x-only` |
| Draft額外 | `phase:edit\|check,view:collect\|measure\|plot\|speed\|motion,returnToCheck:boolean,setup:{depthMm,slot},selectedSlot:nullOrInteger0to5,ruler:{axis:x\|y,zero:[xMm,yMm]},connectPoints:boolean` |
| Draft額外域 | setup.depthMm同上述、slot=0..5；selectedSlot非null須指現有row；ruler.zero兩值整數-100..1000mm、不計分；check時returnToCheck=false。edit允許舊答案保留，不以未去過之步應空白來拒絕 |
| Review | 所有共用版本及rows／fit／trajectory／calculations／meanV／fitV／clockShown／gFromClock／conclusions，不含draft導航／尺；shared result僅比較metadata |
| Unanswered | row／point／數字／選項皆明確null；read可單軸null；空輸入轉null，不轉0；boolean按操作true/false |

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 觀測含每次speedOffsetPpm、read、point、fit選擇與執行、六行計算／平均、計時揭示、概念答案；draft另有設定及續作狀態。rows及calculations以固定index對應，覆寫只清同列依賴 |
| Transient | 動畫／RAF、pointer／capture、拖動中preview、hover、confirmation、camera及fullscreen；不保存。拖動完成才save，取消回復 |
| Derived | 真實位置、刻度、P₁–P₆／DOM id、擬合係數／RMSE／成敗、計時圖、完成數及分數；從權威資料重建，不信任cache |
| Version compatibility | 尚未發布，直接更新預定schema/model/rubric v1，沒有已部署舊快照需要遷移；實作只接受本版完整shape。發布後再改須先定migration及保留rubric，不靜默改評 |
| Size | 最多六觀測／點／計算、短enum；保存六個偏移整數，不加完整隨機歷史；不存截圖／筆畫／係數cache或原始數字輸入字串。最大draft、review及shared pending envelope實測UTF-8 **≤4000 bytes**，含極大有限數字JSON；目前未實測 |
| Invalid finished review | 鎖定，只顯示可信LMS summary，不能重開空白 |
| Invalid pending-final | 深層decoder、rescorer或canonical answer不符時`quarantinePending()`；不retry／clear／reopen |
| Invalid editable draft | 首版採technical load lock，保留資料供排查，不自動清除 |

Finished restore依序validate→restore→scorer→`SimActivityFlow.reviewResult()`。輸入超域／非數字顯示錯誤並保留上次可保存值，check可提交目前保存答案；合法但錯誤的0／讀數／擬合失敗不能當壞快照。保存精度與正式UI允許精度一致，不能為壓大小再刪點或降低精度。

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

Apply all relevant [verification checks](../docs/simulation-scorm-production-guide.md#verification-checklists), including the minimum phone/short-iframe viewport matrix.

本活動另外必測：

- [x] 鋼珠理想滾動上限、v參考及±1%速率邊界、vy(0)=0、各深度碰撞、球心／槽面差、cm/mm/m、動畫跨幀及慢放不改時鐘。
- [x] 偏移只在每次釋放抽一次；以可注入的測試random驗最小／中央／最大及非有限／越界拒絕。相同depth配不同offset有預期水平散布，最大速率不超理想能量上限；每次飛行vx固定、時鐘和y不受速率波動影響。
- [x] 每個有偏移的記錄production round-trip後動畫重播／印記／真值／分數完全相同，restore、重繪、擬合、retry不抽random；新投球／重做才換偏移，舊點不變；量度完全對準帶差異印記不得被扣讀數分。
- [x] 純數學已知y=1.75x²的三種擬合，以及新v參考／含微散布資料的代表曲線；錯點、最少點、重複x、退化、全y相同、零／負k、非有限數。含誤差不要求零RMSE；不能把少點精確插值當證明。
- [x] 改學生y只改推算時間／擬合、不改clockMs；改深度影響新觀測。未揭示不顯時間，揭示但零資料仍合法。
- [x] 滿分／untouched／單讀數／單概念、取樣跨度、duplicates、容差邊界、follow-through及所有依賴修改／清除。
- [x] 六行逐點計算的空白／單行／2–5行／六行狀態，平均的n及納入編號正確；包含0／錯值、不排離群值，未填不補0。平均運算分對全部已填v，準確度分對同組真實vᵢ平均；部分提交只失未答項。
- [x] 已答meanV後新增／改／清一行v、改／清t、改read及重做已有速度的印記，原子清相依meanV，production round-trip後可再填並提交；其他行保留。僅新增尚未計速的印記，不清仍有效的舊平均。
- [x] 零觀測前進motion、揭示時鐘並答概念／前進plot嘗試資料不足擬合，再返回collect；production round-trip後釋放第一球，獨立概念答案與合法操作仍保留。
- [x] 派生答案域：x=500mm、所填t=0.001s可填v=500m/s；square點(1,1)、(1000,0)mm可填約70000m/s；α<0時可填同樣為負值的2α、正確換算得部分分而真值分為0；很大正／負g亦不截斷。每例均涵蓋輸入、scoring、保存及恢復，非有限值另拒絕。
- [x] 正式UI走完取點→量度→描點→擬合→估速→計時→提交，並測重做／reset取消及確認；source與真實ZIP同樣執行。

- [x] Scoring covers blank/partial answers, component independence, extras, penalties and tolerance boundaries.
- [x] Every editable phase can reach final check and submit blank/partial work; scored/pending states have no erase/restart route.
- [x] Production encode/decode/restore round-trip covers **every** matrix row with production-shaped fixtures, equal score and execution of one legal continuation.
- [x] Invalid matrix combinations, numbers, enums, dependencies and authoritative keys fail closed; derived IDs rebuild; version policy and 4000-byte ceiling are tested.
- [x] Production startup/submission/render logic covers all outcomes above, invalid finished review, pending retry and trust mismatch/unknown status; source checks alone are insufficient.
- [x] Source and extracted SCORM standalone refresh clears partial/check/submitted work and permits redraw/submission, including old draft/review/pending/corrupt checkpoints and denied browser storage; separate Moodle cases retain same-attempt work.
- [ ] Phone typography, arrow/label geometry, snap and required previews work in the planned viewport/zoom matrix.
- [x] Shared fullscreen button enters/exits with trusted click/tap on source and extracted SCORM, synchronizes external exits, remains reachable in review/pending, preserves answers/SCORM state, and visibly handles unsupported/denied requests; header text/navigation stay unobstructed.
- [ ] Every phase/mode's applicable gesture rows pass with trusted input on **source and extracted SCORM** in T0–T3; record every owner's metrics, move/release samples, visual blank/overlay geometry, panel boundaries and unchanged learner work. Missing or failed acceptance cases fail the runner.
- [x] Every new test and browser owner is registered in `tools/test-registry.js`; runtime dependencies are in the manifest or registered standalone asset list, and metadata is in `sim/config.js`.

### Test registration and CI selection evidence

Follow the production guide's [registration procedure](../docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations); record this activity's decisions and actual evidence here.

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | `sim/manifests/horizontal-projectile-lab.xml`列八活動檔、四shared檔、既有fitting.js、本地CircuitMath／MathJax及授權，共16個 runtime 資產；ZIP另有root `imsmanifest.xml`，沒有引用catalogue或外部CDN |
| Logical test entries | `sim/horizontal-projectile-lab/model.test.js`、`scoring.test.js`、`persistence.test.js`、`lifecycle.test.js`；kind=node，scope繼承slug，涵蓋上述非平凡邏輯 |
| Browser entries / owner | `{file:'tools/horizontal-projectile-browser-regression.js',kind:'browser',scope:'horizontal-projectile-lab'}`；一入口含source/package，無args變體 |
| Case helpers | 先擴充上述現有mobile-scroll helpers；若實作確需新`*-browser-cases.js`，登記literal consumer及scope，不把helper冒充已跑test |
| Separate manual gates | 保留既有mobile-scroll-browser-regression manual gate及理由，加入活動profiles／operations；完整T0–T3不能由CI省略，T4另外記真實證據 |
| Registration check | 實作後`npm.cmd run check:tests`通過：246 entries（213 node、33 browser）、48 helpers、2 manual；沿用既有mobile-scroll manual gate，沒有新增未登記的正式入口 |
| CI selection preview | 實作commit後記實際base/head、`npm run test:affected -- --base=<sha> --head=<sha> --plan`結果及browser/packages；registry/catalogue新增預期full coverage |
| Actual GitHub verification | 未執行、無run link；實作首次registry/catalogue變更需要完整驗證，不把文件分支當活動CI通過 |

- [x] Registration validation passes; every new formal entry/helper is accounted for, and any separate manual gate has a reason.
- [x] The committed selection preview includes the owning browser suite and all asset consumers, or records the expected full scope for registry/catalogue/shared changes.
- [x] Required source/package scenarios were executed; CI selection evidence does not replace real-phone or Moodle acceptance.

## 實作次序

1. 先完成物理／觀測與數據模型、每次固定約±1%偏移、三種軌跡擬合、六行估速與平均、獨立時鐘及rubric，驗已知數據、邊界及部分分。
2. 打通取點、近景直尺、描點、估速及計時對照的完整桌面／窄屏主線，再調整標籤及精細操作。
3. 依schema／phase表接shared SCORM，完成空白／部分提交、恢復、review／pending及依賴失效。
4. 完成鍵盤、預覽、fullscreen、host手勢；加入catalogue／manifest／registry，重測source及真實ZIP，記package-ready證據。
5. 於真實Moodle學生attempt及實體手機完成T4、成績／恢復／重試後，才宣稱Moodle-ready。

## Package-ready checklist

- [x] Above decisions, state matrix and test evidence are complete; required keyboard alternatives work.
- [ ] Phone, tablet and desktop layouts, short iframe, toolbar/keyboard changes and 200% zoom preserve readable content and reachable actions.
- [ ] `npm run check`, `npm test` and `npm run package:all` pass; record commands, results and artifact paths.
- [x] `git diff --check` and the PR diff against its actual base pass.
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
- 六份touch報告17檔digest皆為`ede5a63c6f0674a86a4f47c2968596c317fc5b3b0bf62e9d5cb07932922e4438`，最終SCORM17檔與來源逐byte相同。全部213個Node入口通過（`output/ci-tests/projectile-auto-target-node-{1,2,3}/report.json`）；測試helper修正後亦重跑mobile-scroll契約及全部上述觸控檢查。`check:tests`為246 entries／48 helpers／2 manual；`check`、`package:all`、文件連結及diff空白檢查通過。已提交選擇預覽base `f0c0d8c`／head `90706f6`為full、246 entries、packages=all，存於`selection-preview-auto-target.json`；其他活動操作函數未變。沒有重跑其他32個browser、GitHub CI、真手機、OS縮放或Moodle，原總閘維持未通過。
- 已更新[原有私人Sites](https://simlab-horizontal-projectile-lab.ieyp.chatgpt.site)，保留owner-private權限。官方helper已推送Sites source `83e9d9507a0ffa5a596ca09759931901274ee74f`；saved version `appgprj_6ad49418111c819198d79e88cab3e78e~appgver_e800af4493088191a5610a437476f0f8`，deployment `appgdep_6ad4a47815bc8191b822fdbda9ddb89e`原生回傳`succeeded`。Archive `output/sites/horizontal-projectile-lab-auto-target-c451ccf.tar.gz`共18檔，含與已測來源相同的16個runtime資產、根入口及hosting metadata；SHA-256 `a278508009157e1a0b98d6143308bbe70a369da3ca0de59dbfb4fa17420c4e70`，資產證據`output/sites/projectile-auto-target-assets.json`。後續文件提交不改runtime。

