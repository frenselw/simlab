# 漸進頻閃修訂：第二位完整獨立審核

審核日期：2026-10-01。最新固定候選：`8a8095d877ac76a5a7ed1402efbe24f845c817a9`，分支 `codex/motion-composition-stroboscopic-plan`；完整 base 為 `origin/main`（`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`）。歷史候選依序為 `d24b791d584b290db066b279b9f67b97f1f45301`、`951524c36a4f78d1d1623756936c61fdba90f927`、`c32c470edfa17226ea5fe4d894c257d6940fd70b`、`d89d44c1bfa9df95b1cf4e446e7dfcce5694c2b8`。每輪均審核完整 branch 及活動的最終狀態，未只看修訂 diff，未閱讀另外兩位本輪審核報告，未修改 production、tests 或 shared runtime，未 commit；只更新本報告。

**最新結論：8a8095d的整條branch獨立複審沒有新finding；R2-P01、R2-P02、R2-P03、R1-04／PF05及Root轉述的PF06全部已確認關閉。** 本輪六套活動純測試、check、base diff、獨立source／實際重建ZIP smoke及14檔byte parity均通過；另完成12組可信觸控targeted續作並實際看圖、核原生bounds。真實Moodle／實體手機部署gates獨立保留未驗。

## 最新完整複審及關閉證據

- 本輪再次完整核對AGENTS、共享baseline及production guide，讀整套activity的model、animation、scene、Controller、UI runtime、HTML／CSS、scoring、persistence及六套測試，並核shared flow／SCORM、rubric、全部phase／trust／retry、catalogue、manifest、packager、test wiring及browser runner。`origin/main...HEAD`為完整審核base。`d89d44c..8a8095d`雖只有caption排版、browser覆蓋及計劃決策變更，仍按完整最終行為重審，下方全範圍表為本候選結論。
- 六套Node tests在8a8095d**各自重新執行，全部exit 0**；`npm run check`及`git diff --check origin/main...HEAD`亦exit 0。persistence仍有512個production encode／decode／restore round-trip及合法Controller下一步，model／rubric／schema沒有改動。沒有執行whole-repo `npm test`或`package:all`。
- 獨立執行 `MOTION_ARTIFACT_SUFFIX=caption-review-2 node tools/motion-composition-browser-regression.js --smoke`，以獲准的Chrome／localhost權限完成，**exit 0**。[本輪smoke-report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/smoke-report.json)為Chrome/155.0.8059.27、`errors=[]`；source及production真正重建／解壓ZIP各13 viewport／416 diagrams、40 playback、280 short-label states、36 short trusted-touch rows、兩種zoom reflow，flow flags全部true、直接亂序mouse=100分。獨立再讀native report核每個viewport的edit／reference各16組唯一case／time，並核全部short states的實際selection及Pᵢ bounds，沒有只相信測試名稱。
- 最新[scene.js:84](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/scene.js:84)–87在compact右側留白<50px時，把「所選」與Pᵢ分兩行、dy=18、右端對齊stage width−4，維持14px及真正下標。普通P planner、全部球面先畫再畫標籤、被選球粗描邊，以及plot／target／snapping／物理幾何均保持原契約。[runner:177](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:177)–187實際跑225／250／275／300／301五種高度，每高兩拓撲×四題×四合法保存reference時刻=32，另dense／partial／wrong合法edit=24，合計**280 states／path**。每路160 readonly、120 edit、260非空Pᵢ；空slot不捏造P。原生標籤與所有含描邊球面、rack及其文字均無交集且完全在stage內，readonly答案不變。

下列為本輪source／ZIP、standalone／fluid iframe的A/t₁及D/t₁原生caption再驗；同高度四路一致。250／275／300使用兩行，225及301保留單行。

| CSS高度 | stage尺寸 | caption native bbox (x,y,w,h) | 右端／stage右端 |
|---|---|---|---|
| 225 | 160×138.59375 | (109.3125076,109.1049805,45.7968826,23.5) | 155.1093903／160 |
| 250 | 160×163.59375 | (127.1968765,111.5277328,27.8281174,41.3875046) | 155.0249939／160 |
| 275 | 160×188.59375 | (127.1968765,112.0437317,27.8281174,41.3875122) | 155.0249939／160 |
| 300 | 160×213.59375 | (127.1968765,112.1218567,27.8281174,41.3875122) | 155.0249939／160 |
| 301 | 320×152 | (195.7631378,109.8516464,45.7656097,23.4999924) | 241.5287476／320 |

- **PF06獨立closure：** 舊300px反例的caption超出stage右端9.0218964px；最新兩行caption右端155.0249939，在stage內餘4.9750061px。 source／ZIP、兩拓撲、A/D t₁均已實際看圖及核native，並擴至五高度全部四題／四時刻與dense／partial／wrong edit。PF05原有球面遮字closure亦維持；沒有以只改paint order當作新caption closure。
- 另獨立執行CDP可信觸控targeted補查，**exit 0**，[targeted-new-heights.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/targeted-new-heights.json)明確candidate=8a8095d，12 rows=source／實際新ZIP×兩拓撲×250／300／301。從合法D/t₄ edit抓非目前t₁至公開錯格點[2400,0]，preview、釋放值及cleanup一致；250px檢停泊球附近、300px檢兩行標籤與reference live／capture live至少一次曝光，capture尚未observed且無四停泊球。301px檢media切換後單行標籤、full-width stage及正常續作；所有caption與球面／rack無交集且未裁切。
- **301px提交補查的失敗與通過分開：** 第一個targeted命令在`scrollIntoView({block:'nearest'})`後要求整個submit bounds完全位於panel，**exit 1，不能算pass**。後續[301-submit-diagnostic.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/301-submit-diagnostic.json)只為diagnostic collection，exit 0也不是regression pass；其source／ZIP×兩拓撲四路都得到panel bottom=301、button bottom=301.0625、panelScroll=505。最新12-row成功補查以正常可信面板向上滑動24px，把scroll由505移至514；button native bounds=(16,248.0625,288,44)、font=16px，完整位於panel(0,238.40625,320,62.59375)內，頂／底餘9.65625／8.9375px。逐路assert document／view／stage／host、答案與selection不變，再直接可信touch按提交而不重跑定位helper，四路均完成空白0分review。這證明正常操作可達，不把helper的0.0625px定位差異列為production finding。
- 本輪獨立讀實際ZIP及再次只讀核最終archive，**14 entries全部逐byte對source一致**，包含root imsmanifest、config、3 shared及9 activity檔，11個本地HTML runtime references齊全，無test／開發檔。scene.js=8684 bytes、animation.js=2119 bytes、archive=36713 bytes。Root另外執行的package:all及完整常規owner矩陣，明確在下段補證列為Root執行。

本輪確實看圖包括：[source 225單行A/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-short-225-standalone-reference-0-t1.png)、[ZIP 225單行A/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-short-225-standalone-reference-0-t1.png)、[source 300兩行D/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-short-300-standalone-reference-3-t1.png)、[ZIP 300兩行D/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-short-300-iframe-reference-3-t1.png)、[source 250 edit／停泊列](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-250-standalone-edit.png)、[ZIP 250 edit／停泊列](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-250-iframe-edit.png)、[source 300 touch preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-300-iframe-preview.png)、[ZIP 300 touch preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-300-standalone-preview.png)、[ZIP 300 reference live](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-300-iframe-reference-live.png)、[source 300 capture live](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-300-standalone-capture-live.png)、[source 301 reference切換](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-short-301-iframe-reference-3-t1.png)、[ZIP 301完整提交掣](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-301-standalone-check.png)、[ZIP普通320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-320x500-parking.png)、[source曝光2](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-capture-2.png)、[ZIP曝光4](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-capture-4.png)。原有首球／圖例、compact cutoff、normal P planner、capture／reference起點及首曝光亦以新smoke native重新核對。

## d89d44c歷史完整複審及當時關閉證據

當時未自行發現新finding，R2-P01／P02／P03及PF05均關閉；Root其後另發現PF06，故以下d89d44c的通過結果只能作歷史，不能作最新完整caption verdict。

- 本輪再次完整讀activity的model、animation、scene、Controller、UI runtime、HTML／CSS、scoring及persistence，核共同baseline／production契約、活動計劃、rubric、保存／trust、catalogue／manifest／packager／test wiring與browser handler。`c32c470..d89d44c`的model／rubric／schema沒有修改，但仍按完整最終行為審核；本輪變更是scene的Pᵢ排版及其browser守衛／規格。
- 以下六套Node tests在d89d44c**各自重新執行，全部exit 0**；`npm run check`與`git diff --check origin/main...HEAD`亦exit 0。沒有執行whole-repo `npm test`或`package:all`。
- 獨立執行 `MOTION_ARTIFACT_SUFFIX=point-label-review-2 node tools/motion-composition-browser-regression.js --smoke`，以已獲准的本機Chrome／localhost權限完成，**exit 0**。[本輪smoke-report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/smoke-report.json)為Chrome/155.0.8059.27、`errors=[]`；source與production真正重建／解壓的ZIP各13 viewport／416 diagrams、40 playback、56 short-label states、36 short trusted-touch rows及兩種zoom reflow。直接亂序mouse=100分，其他flow flags全部true。又用獨立Node讀native資料，逐viewport驗edit／reference各16個唯一case／time，並逐Pᵢ對所有含描邊球面的bounds斷言無交集。
- R1-04／PF05的**獨立closure**：[scene.js:79](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/scene.js:79)先畫完全部答案／reference球，[scene.js:82](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/scene.js:82)再畫Pᵢ；普通模式的planner避開球、文字、axis、物理／學生曲線、rack與圖頂／底提示，compact使用圖旁留白的「所選 Pᵢ」，被選球加粗描邊。該輪[runner:129](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:129)把Pᵢ與**所有**球面比較，含學生／reference／live及描邊；當時178–185執行兩短拓撲×四題×四個合法保存只讀時刻的32 states，另在A題以dense／partial／wrong合法edit各四時刻×兩拓撲補24 states，合計每路56。readonly逐組assert實際case／time／reference及權威答案不變，edit亦assert實際time及權威不變，缺答slot不捏造Pᵢ。
- 舊A/t₁與D/t₁反例在source／ZIP、320×225 standalone／fluid iframe**四種路徑各自再驗**：實際selection為相應case／time=1／reference=true；「所選 P₁」native bbox=(109.3125076,109.1049805,45.7968826,23.5)，stage bbox=(0,86.40625,160,138.59375)，13個球面的描邊bounds均無交集，字形在stage右緣尚餘4.8906097 CSSpx。相關四題四時刻參考及密集／錯／缺答native資料全通過，實際圖片中標籤完整可讀。
- compact切換邊界實測source／ZIP一致：320×499 stage=209.578125、label「所選 P₁」；320×500及390×500 stage=210、普通P₁；390×501 stage=210.40625、普通P₁；390×467 stage=196.125、compact。全部viewport四題／四時刻、capture／reference起點與首曝光native可讀性均核對，正常首球／HTML圖例距離仍符合R2-P01修正。
- 本輪persistence測試含512個production encode／decode／restore的合法round-trip與續作；browser再次完成正常A–D及B reduced motion的0／1／2／3／4曝光、拍攝中斷／恢復／重拍後合法放點、空白／部分／滿分明確提交、pending retry／review及standalone刷新、非目前球鍵盤／面板命令、resize停止再播。取消／只讀權威資料和SCORM四結果分支的契約保持符合。
- 獨立讀當時新ZIP，**14 entries逐byte對source一致**，包含root imsmanifest、config、3 shared及9 activity檔；當時scene.js=8423 bytes、animation.js=2119 bytes，manifest與11個HTML runtime references齊全，無test／開發檔。R2-P02的Scope清單仍一致。這項獨立parity與Root另外執行的package:all補證分開。

本輪實際看圖包括：[source A短standalone/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/source-short-standalone-reference-0-t1.png)、[source D短iframe/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/source-short-iframe-reference-3-t1.png)、[ZIP A短iframe/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-short-iframe-reference-0-t1.png)、[ZIP D短standalone/t₁](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-short-standalone-reference-3-t1.png)、[source普通320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/source-320x500-parking.png)、[ZIP普通320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-320x500-parking.png)、[source D普通作圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/source-390-case-3.png)、[ZIP C reference/t₄](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-390-reference-2.png)、[ZIP短capture live](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-short-iframe-capture-readability.png)、[ZIP短reference live](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-short-iframe-reference-readability.png)、[ZIP短preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-review-2/package-short-standalone-preview-2.png)。亦實看source曝光0／2及ZIP曝光4，確認球在移動中逐次留下影像、未完成沒有停泊四球、完成出現四球。

## c32c470歷史完整複審及當時關閉證據

- c32c470當時先重新讀取完整activity runtime、rubric、schema、Controller／shared flow、manifest／catalogue及實際browser handler，而非只查修正diff。已核 `951524..c32c470` 的activity、manifest、catalogue及shared runtime diff為空；最後修訂只更正reference測試及計劃中的驗證決策。
- 在c32c470再次各自執行六套下列Node tests，全部exit 0；`npm run check`及`git diff --check origin/main...HEAD`亦exit 0。沒有執行whole-repo `npm test`或`package:all`。
- 獨立執行 `MOTION_ARTIFACT_SUFFIX=progressive-final-recheck-2 node tools/motion-composition-browser-regression.js --smoke`，以已獲准的本機Chrome／localhost權限完成，**exit 0**。該輪 [smoke-report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/smoke-report.json) 使用Chrome/155.0.8059.27，`errors=[]`。source與production真正重建／解壓的ZIP各13 viewport、416 diagrams，其中208 reference；另以Node讀取native report，逐viewport斷言edit及reference各16個唯一case／time，確實涵蓋4×4，不依賴報告名稱。
- 兩路各40組capture／reference播放起點與首曝光native bounds，含320×225 standalone／可捲host iframe；四題正常及B的reduced-motion均實際曝光0／1／2／3／4，並中斷／恢復／再拍後合法放點。兩路各36個短trusted-touch rows、兩種zoom reflow拓撲均通過；直接亂序mouse、0／部分／100分、只讀／pending retry／standalone刷新、非目前球鍵盤及面板命令、resize停止再播等flow flags全部為true。
- R2-P01：正常首球中心現在至少54px，compact邊界為stage高<210px；小圖O／x／y避開含描邊球面，m避開rack。source與ZIP的320×500 native ink bottom=118.390625、首target top=126.59375、首球top=125.703125；圖例距target **8.203125px**、距球面 **7.3125px**。所有13 viewport的SVG／HTML文字、球面、四rack及內部球／時刻bounds均通過；下列修正後source／ZIP手機與short播放／preview圖已實際檢視。
- R2-P02：[計劃:53](/Users/hangwong/Documents/Projects/simlab/plans/25-motion-composition-stroboscopic-lab.md:53) 已補 `animation.js`及用途，與HTML、manifest相符。獨立讀 actual `output/motion-composition-stroboscopic-lab-scorm.zip`，14 entries逐byte對原source一致：imsmanifest、config、3個shared及9個activity runtime檔；animation.js=2119 bytes，無test／開發檔。
- R2-P03：當時 [runner:59](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:59)–60拒絕hidden／0×0 target；206的negative test確實驗review中的hidden timeNav。207–209以合法finishedData(activeCase／activeTime)透過production restore逐組進入reference，再assert實際case／time／reference=true及提交答案不變。source／ZIP的native 4×4×13結果已核，不再把隱藏按鈕的無效click冒稱為時刻切換。

修正後實際看圖：[source 320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/source-320x500-parking.png)、[source 390×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/source-390x500-parking.png)、[ZIP 320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/package-320x500-parking.png)、[ZIP 390×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/package-390x500-parking.png)、[source短iframe capture](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/source-short-iframe-capture-readability.png)、[ZIP短iframe reference](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/package-short-iframe-reference-readability.png)、[ZIP短standalone reference](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/package-short-standalone-reference-readability.png)、[ZIP短iframe preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-2/package-short-iframe-preview-0.png)。另實看source及ZIP的0／2／4曝光、C reference t₄、D作圖／reference t₄及source C短preview。

951524上的 `MOTION_ARTIFACT_SUFFIX=progressive-recheck-2 ... --smoke` 在發現R2-P03後按Root指示中止，**exit 130，不是pass**。該輪六Node tests、check、base diff及14檔parity各自exit 0；部分產生的截圖只用作當時可視核對。c32c470及d89d44c完整結果也只作歷史；最新verdict以8a8095d的本輪獨立結果為準。

## Root轉述的歷史問題（他方實證，最新已獨立關閉）

**R1-04／PF05 · P2 · 320×225只讀reference的P₁被其後球面遮住：c32c470當時Open；d89d44c已獨立再驗Closed。** 這個原始反例由Root在本reviewer的c32c470獨立smoke完成後轉述，來源為第一位reviewer；未閱讀其審核報告。以下保留他方歷史重現，不冒稱為第二位自行執行的targeted實驗。本reviewer當時收到提示後實際看過source A及ZIP D的原圖／隱藏球面比較圖，並核對當時production paint order。最新獨立closure與native數據已列上段。

- 歷史位置：c32c470的 `scene.js:49`–54。當時迴圈先畫目前Pᵢ文字，再於下一slot畫球；小圖的後續球可以蓋住先前已畫的字形。
- 他方重現：320×225 CSS viewport、合法只讀reference、全部四個參考球，A/t₁及D/t₁在source與實際ZIP重現；其native記錄涵蓋32 states。
- Expected：被選時刻的P₁識別須完整可讀，且能與其他球面／球影區分。
- Actual：P₁部分字形被後畫的綠色reference球面遮住；隱藏這些球面後字形恢復，與上述paint order一致。
- 來源證據：[他方native記錄](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/short-reference-p-labels.json)、[source A原圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1.png)／[球面隱藏](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1-balls-hidden.png)、[ZIP D原圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-3-t1.png)／[球面隱藏](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-3-t1-balls-hidden.png)。比較圖已實際檢視；JSON仍明確標為他方執行證據。
- 修正再驗條件：小圖的Pᵢ字形放在球面之外並完整可視，避免只靠改paint order留下球面與文字碰撞；source／ZIP兩短拓撲逐四題／四時刻reference實際再驗，將Pᵢ對學生／reference球面及裁切加入native斷言，保留完整合法restore及只讀權威答案不變。

c32c470當時runner對球面只比較axis-name標籤，對全部文字則比較rack；沒有比較Pᵢ與學生／reference球面。因此本reviewer當時的832 diagrams、Root當時完整矩陣的`errors=[]`及原本沒有自行發現此問題，都不足以關閉反例。d89d44c新增完整Pᵢ對所有球面守衛及56短states後，最新獨立native與實際圖像才構成closure。

**PF06 · P2 · 320×300 compact caption被stage右端裁切：d89d44c當時Open；8a8095d已獨立再驗Closed。** 原始反例由Root在d89d44c複審後自行發現並提供；本reviewer沒有把他方collection說成自己的regression，也沒有閱讀其他reviewer報告。

- 歷史位置：d89d44c的`scene.js:83`–84，在compact一律單行「所選 Pᵢ」，沒有窄右側留白分支。CSS320×300時stage=160×213.59375、plot size=68，p.x=123.2250061。
- 重現：合法完成保存的readonly reference、A/t₁或D/t₁，source／實際ZIP各standalone及fluid iframe，合計8組。Expected為14px caption連真正下標完全位於stage內且可辨。
- Actual：native label bbox=(123.2250061,112.1218567,45.7968903,23.5)、right=169.0218964，超出stage right=160 **9.0218964 CSSpx**，P／下標被裁。Root的[diagnostic smoke-report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/smoke-report.json)為collection succeeded、非regression pass；其他欄位空集合及errors=[]不能推論此反例通過。
- 已實際檢視Root原始[source A iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/source-300-iframe-case-0.png)與[ZIP D standalone](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/package-300-standalone-case-3.png)，P／index裁切與native值一致。
- 修正再驗條件：窄compact留白內完整保留「所選」／Pᵢ及真下標，不改物理／target／snap幾何；source及重建ZIP於225／250／275／300／301兩短拓撲，逐四題／四合法review時刻與dense／partial／wrong edit核native全bounds、所有球面及rack；另驗capture／reference live、可信preview與301排版切換合法提交。最新280 states／path及12-row獨立targeted已滿足，PF05球面closure仍保持。

## Findings與歷史重現

### R2-P01 · P2 · 500px 高手機中首球遮住分運動圖例（已關閉）

以下為d24b791的原始重現及當時行號；修正再驗見上段。

- 主要位置：[model.js:43](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/model.js:43)–44 的普通停泊列；配合 [styles.css:18](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/styles.css:18) 的頂列及 23–25 的球／時刻排版。
- 重現：在 Chrome/CDP 將 CSS viewport 設為 **320×500 或 390×500**；由空白情境 1，使用可信 mouse 操作「拍攝頻閃圖」，待拍攝完成。無須先答題、縮放或開始拖動。在 source 及實際 ZIP 解壓頁均重現，四點仍為 null。
- Expected：四個 44×44px 停泊抓手完整可用，且必要的 `X₁ 水平 · Y₁ 垂直` 圖例可完整辨讀，不被待放球或時刻標籤壓住。
- Actual：stage 高 210px，非 compact；t₁ center y=39px，第一個球向上侵入頂列。320 寬遮住 `Y₁` 附近；390 寬遮住 `X₁` 附近。球的透明熱區還可正常操作，但球面與背景實際蓋住教學識別文字。
- 精確證據（source／ZIP 相同）：320 寬圖例 bounds=(184.578125,97.59375,107.421875,23.796875)，球 bounds=(225,110.703125,24,24)；390 寬圖例 bounds=(254.578125,97.59375,107.421875,23.796875)，球 bounds=(260,110.703125,24,24)。均垂直重疊 **10.6875 CSSpx**。
- 已實際檢視：[source 320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-source-320-500.png)、[source 390×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-source-390-500.png)、[ZIP 320×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-package-320-500.png)。[ZIP 390×500](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-package-390-500.png) 及 [ZIP DOM metrics](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-package-layout.json) 同樣保存。
- 測試缺口：[browser runner:118](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:118)–125 的 `diagramLabels()` 只比 `#stageSvg text`；160–165 的 viewports 包含這兩個尺寸，卻沒有比 HTML `#componentLegend` 與 `.point-tray-handle` 的球／時刻。其通過不能排除這個實際可見碰撞。
- 修正再驗條件：重新安排普通停泊列與頂列的空間，或在必要短尺寸採適當 reflow，維持四球直接任意次序拖放、44px target、兩側24px strip及圖域等比例。source／新 ZIP 於320×500、390×500及 compact 邊界上下重新拍攝並實際看圖；增加 HTML 圖例對全部球／時刻的遮擋斷言，並重跑受影響的 tray／active trusted-touch、preview及短viewport回歸。

### R2-P02 · P3 · Scope 的 runtime 清單漏列 animation.js（已關閉）

以下為d24b791的原始缺漏；現已直接核對Scope及actual ZIP。

- 位置：[活動計劃:53](/Users/hangwong/Documents/Projects/simlab/plans/25-motion-composition-stroboscopic-lab.md:53)。
- 重現：讀 Scope 的「Runtime files / libraries and justification」完整清單，再核 [index.html:8](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/index.html:8) 與 [manifest:24](/Users/hangwong/Documents/Projects/simlab/sim/manifests/motion-composition-stroboscopic-lab.xml:24)。
- Expected：活動規格的 runtime 清單列出本輪新增、實際載入及包裝的 `animation.js`。
- Actual：清單仍從 `model.js` 直接到 `scoring.js`，漏了 `animation.js`。HTML、manifest、ZIP均已正確包含，並非套件漏檔。
- 修正再驗條件：補齊該列後直接核對 HTML／manifest／runtime 清單；若只有文件修改，不必重跑已通過的程式測試。

### R2-P03 · P3 · reference四時刻測試誤點隱藏控件（已關閉）

- 原始位置：951524的 `tools/motion-composition-browser-regression.js:204` 及定位helper 58–68；production [main.js:38](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/main.js:38) 在review隱藏editPanel。這是驗證可信度缺口，沒有宣稱production評分失敗。
- 重現：以可信CDP mouse進入check→submit→review，切情境3並開reference，按舊runner對 `[data-time="2"]` 的bounds中心執行press／release，再讀實際selection。
- Expected：四時刻可視斷言須確實驗不同activeTime，無效或隱藏target須讓測試失敗；submitted權威答案保持不變。
- Actual：editPanel.hidden=true、timeNav target全部bounds=0、clientRects=0；舊helper仍送mouse(0,0)，操作前後selection均 `{case:2,time:1,reference:true,compareAxis:0}`，`timeChanged=false`。舊diagramLabels只將indices與當下selection比對，沒有assert requested slot，因此reference四次均仍t₁。
- 原生targeted重現命令exit 0，證據：[reference-time-navigation.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-recheck-2/reference-time-navigation.json)。Root確認並修正；本reviewer沒有閱讀其他reviewer報告。
- 修正再驗條件：對定位加入可見／非零守衛，直接negative驗證hidden target；reference以合法保存及production restore逐四題／四時刻實際載入，assert選擇與權威答案不變。c32c470的完整獨立smoke及native report已滿足並關閉。

## 六套活動測試及首次瀏覽器證據

下列六個命令在d24b791、951524、c32c470、d89d44c及最新8a8095d各自獨立執行，全部 exit 0：

| 命令 | 執行結果與核對重點 |
|---|---|
| `node sim/motion-composition-stroboscopic-lab/model.test.js` | 四題16個位置、曲線、同步間距、等比例坐標轉換、公開格點及四個獨立44px停泊target |
| `node sim/motion-composition-stroboscopic-lab/animation.test.js` | quarter-speed逐次0／1／2／3／4曝光、reduced-motion逐格、延遲frame及取消token |
| `node sim/motion-composition-stroboscopic-lab/scoring.test.js` | 空白0、全對100、分類36／位置64、獨立x／y／類型部分分、重疊與±50mm邊界 |
| `node sim/motion-composition-stroboscopic-lab/persistence.test.js` | 512個production encode／decode／restore及實際合法續作；最大draft／review／pending=791／818／1061 UTF-8 bytes；invalid欄位與型別拒絕 |
| `node sim/motion-composition-stroboscopic-lab/lifecycle.test.js` | 四startup／四submission分支、retryable兩種、committed finish retry、review mismatch／unknown、pending隔離、standalone refresh |
| `node sim/motion-composition-stroboscopic-lab/scene.test.js` | 不越過空slot連線、不提前顯示參考軌跡、每次兩分運動同時曝光、立體球gradient及preview獨立IDs |

另執行 `npm run check` 及 `git diff --check origin/main...HEAD`，均 exit 0。依任務要求未執行 whole-repo `npm test` 或 `package:all`。

以下瀏覽器段落是d24b791首次審核歷史，範圍較最新13 viewport少，不能替代上段8a8095d獨立再驗。首次命令：`MOTION_ARTIFACT_SUFFIX=progressive-review-2 node tools/motion-composition-browser-regression.js --smoke`。一般sandbox啟動Chrome逾時；以獲准的 `require_escalated` 重試後 **exit 0**。瀏覽器為 **Chrome/155.0.8059.27**，使用Chrome/CDP可信touch；[smoke-report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/smoke-report.json) `errors=[]`。初次環境失敗的 `failure.json` 不是目前runtime finding或通過證據。

source及真正由production packager重建／解壓的ZIP各完成：10個viewport布局，四題正常動態及B的reduced-motion共5組曝光（每組0–4次），未完成拍攝中斷／Moodle-like恢復及重新拍攝後合法放點，直接亂序mouse放t₃／t₁／t₄／t₂，滿分／空白／部分明確提交，review／pending resume及retry，standalone部分／check／submitted刷新全空且storage不被讀取，鍵盤Enter／Escape／Shift方向、非目前球的鍵盤／面板命令、間距工具及resize停止重播。

source／ZIP各兩個320×225短CSS拓撲（standalone與可捲host iframe），各36 rows。正常四題四時刻tray及同slot再拖、合法錯誤格點、touchCancel、preview／release一致性及cleanup通過；沒有把compact停泊入口冒稱為不存在的圖內active target。zoom reflow各兩個拓撲可捲至提交及參考圖，主要控件16px、≥44px，無第三個document scroll或水平overflow。

另外使用可信mouse對 source／ZIP 的320×500及390×500執行 targeted拍攝與DOM bbox／截圖，完成 R2-P01 的實際重現；ZIP targeted命令 exit 0。這個補查是現有smoke沒有覆蓋的視覺斷言。

## 全範圍核對

| 範圍 | 獨立審核結果 |
|---|---|
| 物理及教學假設 | 直接核公式與基準表：A、D為y=−x但等時分布不同；B為y=−5x²/16，C為x=5y²/16、y≤0；g=10教學近似及C水平加速非自由落體均正確。兩球為同一運動的正交投影，X／Y不是碰撞；間距等量增加與勻加速模型相符，未宣稱有限點證明每一瞬間加速度。 |
| 漸進頻閃及球體 | 動畫控制器3.20s呈現0.80s模型時間；曝光取精確0.20s固定模型位置。未完成observed=false，不可寫位置；完成才observed=true並同時出現四球。取消舊frame不能完成另一題。正常球連續移動、reduced motion逐格；歷史球影透明、live球實色，SVG與CSS以徑向gradient呈球面。 |
| 四球直接拖放 | 每個穩定HTMLtarget各有slot，抓任何非目前球即暫態選時刻，合法放手只改該slot及activeTime，取消回復原導航。mouse亂序、短可信touch、非目前球鍵盤／面板續作均執行；不要求先按時刻。 |
| 文字／共享風格／notation | 繁體精簡指令，三區布局、shared tokens及math下標／單位可辨；連線明示學生作圖，預設null無分數。R2-P01、R1-04／PF05及PF06均已以最新source／ZIP native bounds及實際看圖關閉；compact「所選 Pᵢ」按右留白換兩行，14px與真下標完整，被選球粗描邊可辨；普通Pᵢ避開所有球及必要圖文。 |
| 手機／短iframe／preview | 已讀gesture owner與capture取消handler、24px strips、bounded panel；獨立短touch metrics斷言所有非owner不變，lens實際3×、viewBox聚焦已吸附工作點、overlay inert及全框避指。五短高度每路280 native states及12組250／300／301可信touch補查通過；301正常panel pan後完整44px提交且doc／host／stage／答案不動。常規完整matrix另見下段Root完成證據；沒有以source或desktop截圖代替ZIP／trusted touch。 |
| 鍵盤／原生controls | 原生button／select／checkbox；Tab到四停泊球，方向鍵才開始暫態，Enter明確保存、Escape取消，Shift 0.01m；焦點及面板remove／next作用於所選slot，且未確認位置不混入權威答案。 |
| 評分及空白／部分提交 | 每題16位置＋6分運動＋3軌跡=25，四題100、60達標；50mm逐分量容差與screen snapping分開。分類／位置互相獨立，未答零；所有editable狀態可check，check可返回，最後須明確submit。觀察、停泊預設與未確認工作點不加分。 |
| phase／schema／續作 | v1固定case／slot索引作權威關係，edit／check／review與returnToCheck嚴格；observed依賴只限制points，未觀察但分類可答。錯答／重疊合法，restore不再次吸附／量化；未完成拍攝僅恢復未觀察再拍。512 round-trips含實際Controller合法下一步。 |
| SCORM／trust／retry | production只接shared loadAttempt／startup／submitWithCallbacks／submission／draft provider；無活動自己的raw LMS或page lifecycle。可信結果驗證權威review、rescore及shared metadata／Moodle比較；frozen不顯正解／確認分數，只重試固定payload；深層invalid pending先quarantine，pagehide亦不寫拒絕payload。committed只finish retry；未知完成狀態及損壞finished保持只讀摘要。 |
| standalone／Moodle resume | standalone使用shared memory fallback，不opt-in persistent storage，刷新三個phase均新空白；Moodle-like同attempt恢復draft／review／pending，新attempt空白。已記錄及pending均無restart／clear-results入口，0分亦鎖定。 |
| catalogue／manifest／ZIP | metadata齊全、slug一致；所有HTML scripts／styles與manifest相符，無CDN／secret。自行檢查實際新ZIP **14 entries**，含root imsmanifest、config、3個shared及9個activity檔；所有14檔逐byte對source相同，包含animation.js，無tests／開發檔。Scope清單R2-P02已同步。 |
| 測試可信度 | 六純tests確實執行production model／scoring／persistence／Controller／shared runtime，browser確實執行source與解壓ZIP。可信touch量測owner及全部non-owner，不用synthetic dispatch冒充gesture。分類select change採DOM setup；其分數／狀態斷言不冒稱native picker或真手機證據。舊HTML碰撞漏驗、reference隱藏誤點及Pᵢ對球面／窄留白缺口均已修正，並以native bounds／actual selection完整再驗；純scene test沒有單獨測P planner，最新executed browser逐Pᵢ測所有含描邊球面，另有五高度280短states、actual restore／只讀不變及12組續作。失敗helper及diagnostic collection明確不算regression pass。 |

Root於d24b791審核期間明確報告完整矩陣已exit 0；隨後才讀其已完成的 [progressive-final/report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final/report.json)，並核 `errors=[]`。這是歷史Root證據，沒有替代最新候選驗證。

Root另明確通知c32c470歷史完整矩陣已**exit 0**，才讀其 [progressive-final-verified/report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-verified/report.json) 精確資料：`errors=[]`；source／ZIP各13 viewport、40 playback rows、36 short rows、flow flags全部true且mouseScore=100。source／ZIP×390／320的4組常規touch各43rows涵蓋16題／時刻兩抓手、8多指取消及同頁host恢復、4其他取消、6stage／strips、6panel中段／邊界及3只讀pan。這是Root執行的歷史完整owner補證，沒有冒稱第二位另跑了4組常規matrix；第二位當時的獨立命令及native結果明確另列 `progressive-final-recheck-2`。當時完整矩陣通過仍不排除R1-04，因當時Pᵢ對球面斷言範圍有上述缺口。

**d89d44c歷史Root補證（與本reviewer獨立執行分開）：** Root通知d89d44c的完整source／實際ZIP矩陣已exit 0後，才讀 [point-label-final/report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-final/report.json)，另用Node斷言兩路各13 viewport、40 playback、56 short-label、36 short-touch、flow flags全true／mouseScore=100、4組常規390／320 trusted-touch各43 rows及`errors=[]`；並實際核native owner／preview／scroll before／after記錄。Root執行的package:all已exit 0，所提供 [package-parity.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-final/package-parity.json)明確candidate=d89d44c、14entries／11refs／所有source bytes相等、ZIP=36628 bytes、SHA-256=`b39f17b68229b5fae51e67e2ed394d1d516398eb47b4efb2e9140bb58d6fbd38`。以上均為歷史，不能排除後來PF06反例。

**8a8095d最新Root補證（與本reviewer獨立執行分開）：** Root明確通知完整矩陣**exit 0**後，才讀[caption-final/report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/report.json)，另用Node核兩路各13 viewports、40 playback、280 short-label、36 short-touch、4組source／ZIP×390／320常規trusted-touch各43 rows、flow全部true／mouseScore=100及`errors=[]`，並讀native owner／preview／panel／host before／after。Root的[package:all log](/Users/hangwong/Documents/Projects/simlab/output/motion-composition-caption-package-all.log)已完成exit 0；[package-parity.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-parity.json)明確candidate=8a8095d、14 exact entries／11 runtime refs／all source bytes equal、36713 bytes，280個preview records均真正3×、與main scene同snap且在app bounds內。未將Root的package:all或四組常規touch冒稱為第二位另跑；自己的smoke、14檔逐byte讀查、五高度280短states及12-row可信續作獨立列於最上段。最後一次本reviewer重建是成功targeted補查，其後只讀圖像／archive及寫本報告。全部review停止重建後，Root最終parity已exit 0並固定actual archive SHA-256=`d2ad73396f1e46984dfa4321fbdafc4f7a256cf31b9e13a41bf04ca4e94d74c0`，亦與本reviewer最後只讀核出的SHA相同；package:all當時archive SHA另存在`packageAllArchiveSha256`，重建ZIP的metadata差異已註明，全部14檔runtime／manifest bytes仍一致。

歷史及本輪實際看圖包含source手機／桌面的A–D學生作圖及C／D參考圖，source曝光0／2／4、ZIP曝光4，source與ZIP的短iframe／standalone預覽，以及上述targeted 500px手機source／ZIP截圖。短圖包括320×225 CSS reflow，deviceScaleFactor按閱讀／手勢情境為1／2；不把它說成真實OS／瀏覽器工具列縮放驗收。

## 外部部署 gates

- 真實Moodle學生attempt的分數／status、空白／部分提交、刷新／離開再入的draft／pending／只讀review、老師attempt policy與新attempt尚未在本輪驗證。
- 實體手機的current-window及可用new-window Moodle player完整owner矩陣、真host拓撲／跨origin、native picker、工具列變化與裝置zoom尚未驗證；Chrome/CDP emulation不能替代。
- 本活動記錄為形成性100分練習。瀏覽器可改分的trust限制已記錄，沒有高風險可信server評分的交付承諾。

最新8a8095d完整獨立審核沒有新finding，原有R2-P01／R2-P02／R2-P03、R1-04／PF05及Root轉述的PF06均已關閉。Moodle-ready仍由上述外部gate決定。
