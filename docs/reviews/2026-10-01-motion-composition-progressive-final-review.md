# 漸進頻閃修訂：完整獨立審核彙整

日期：2026-10-01。第四位彙整者。固定runtime／tests候選：`8a8095d877ac76a5a7ed1402efbe24f845c817a9`；分支 `codex/motion-composition-stroboscopic-plan`；完整基準 `origin/main`／`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`。最終文件同步另核，不改此候選runtime或套件。

**最終本機 verdict：package-ready PASS，PF01–PF06全部Closed，零Open／新finding。** 三位正式完整獨立複審已全部完成；第四位另外核原始資料、反例／修正實圖及最終actual ZIP後同意closure。真實Moodle／實體手機仍 **UNVERIFIED**，未宣稱Moodle-ready。

## 範圍及證據來源

已讀`AGENTS.md`、[共享基線](/Users/hangwong/Documents/Projects/simlab/plans/00-shared-platform-and-style.md)、[製作指南](/Users/hangwong/Documents/Projects/simlab/docs/simulation-scorm-production-guide.md)、計劃範本、[活動計劃25](/Users/hangwong/Documents/Projects/simlab/plans/25-motion-composition-stroboscopic-lab.md)及三份報告全部歷史／最新更新。三位各自重審整條branch的physics、精簡文案、UI／mobile／全部gesture owners、評分／部分提交、schema／phase／保存續作、SCORM／trust／standalone、catalogue／manifest／actual ZIP與測試，沒有按領域分工。

| 獨立來源 | 8a實際執行與結論 |
|---|---|
| [審核1](/Users/hangwong/Documents/Projects/simlab/docs/reviews/2026-10-01-motion-composition-progressive-review-1.md) | 全branch、六Node tests／check／base diff、全新source＋actual ZIP smoke；原發現者再看A／D反例，另96 boundary native rows／16 preview-release／8組301 blank-partial提交；PF01–06 Closed，零新finding |
| [審核2](/Users/hangwong/Documents/Projects/simlab/docs/reviews/2026-10-01-motion-composition-progressive-review-2.md) | 全branch、六Node tests／check／base diff、全新source＋actual ZIP smoke；另12組250／300／301可信續作與正常pan後完整44px提交；PF01–06 Closed，零新finding |
| [審核3](/Users/hangwong/Documents/Projects/simlab/docs/reviews/2026-10-01-motion-composition-progressive-review-3.md) | 全branch、六Node tests／check／base diff、全新source＋actual ZIP smoke；另重算Root native／preview／owners與最終ZIP；PF01–06 Closed，零新finding |

第四位已完整讀activity runtime／HTML／CSS、catalogue／manifest及test registration，本輪再核完整base變更、model／rubric／schema及d89→8a差異；直接解析Root及三份8a原始report，重算native交集／clipping、真case-time、曝光球心、preview及owner／non-owner。另核原PF06八筆9.021896px裁切與八張反例、新300px八張source／ZIP×standalone／fluid iframe×A／D t₁，以及225原PF05、250rack、301單欄、normal、capture／live／reduced reference與preview實圖。不是只轉述三人一致結論。

本彙整只改此文件，未commit、未改production／tests／shared／plan，未再執行browser、Node／repo tests或packager。Root／三位的實跑、第四位的read-only再核及外部未驗gate分開記錄。

## 去重 findings 與最終 closure

| ID | 優先序 | 8a狀態 | 問題／原來源 |
|---|---|---|---|
| PF01 | P2 | Closed | y軸名被投影球影遮住；R1-01；c32修正，本輪再驗 |
| PF02 | P2 | Closed | 500px手機首停泊球遮Xᵢ／Yᵢ圖例；R1-02＋R2-P01；c32修正，本輪再驗 |
| PF03 | P3 | Closed | Scope漏列animation.js；R2-P02；c32文件修正，本輪核實 |
| PF04 | P2，驗證缺口 | Closed | hidden timeNav虛點使reference重複t₁；R2-P03＋R1-03＋第三位R2-01；c32修正，本輪真4×4再驗 |
| PF05 | P2，球面覆字 | Closed | c32的320×225 readonly reference後畫球覆P字形；R1-04；d89修正，本輪再驗 |
| PF06 | P2，stage裁切 | Closed | Root的d89反例：320×300 compact單行caption越stage右緣；8a修正及全高度再驗；與PF05分開 |

PF01小圖O／y已移出投影球面；PF02 compact門檻stage高<210px、normal首球中心至少54px，m亦避rack。8a的320×500圖例ink bottom=118.390625、首target top=126.59375，淨距8.203125 CSSpx；球面top=125.703125，淨距7.3125px。[最新ZIP parking實圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-320x500-parking.png)及全部新axis／rack守衛支持closure。PF03的[Scope](/Users/hangwong/Documents/Projects/simlab/plans/25-motion-composition-stroboscopic-lab.md:53)、HTML、manifest與actual ZIP均包含animation.js；原本不是套件漏檔。

PF04的[runner:58](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:58)拒絕hidden／0×0，另負測hidden review timeNav；readonly以合法finished fixture經production restore，assert真case／time／reference及權威答案不變。第四位核四份最新JSON每viewport的edit／reference各16個唯一case-time；五種短高度、兩拓撲也各完整4×4。951的(0,0)虛點、重複t₁及中止smoke exit130只留歷史。

### PF05：P標籤避所有球面，原反例已消失

[scene:78](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/scene.js:78)先畫全部answer／reference球，再於clip外畫P。Normal planner避球、文字、rack及線段；compact用圖旁「所選 Pᵢ」配正確球心粗圈。球心、比例、model／rubric／schema未改；[runner:123](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:123)將P對全部data-ball含描邊比較，合法null slot不杜撰P。

8a的原320×225 A／D t₁在source／ZIP及兩拓撲均保留四球、字形／真下標清晰：[source A](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-short-225-standalone-reference-0-t1.png)、[source D／iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-short-225-iframe-reference-3-t1.png)、[ZIP A／iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-225-iframe-reference-0-t1.png)、[ZIP D](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-225-standalone-reference-3-t1.png)。Caption右緣155.109390、stage右緣160，餘4.890610px；全部13個球面含stroke不交P。四份8a raw各1,504個P／18,936次全球面比較均通過，normal與live／reduced reference也核實，支持PF05 Closed。

### PF06：8a完整窄caption與media邊界驗收

**歷史expected／actual（d89）**：320×300合法finished A／D t₁ readonly，完整P／下標須在stage內，保持四球、14px字形與正確物理位置。舊`scene.js:83–84`單行caption配`model.js:40–44`與`styles.css:54–62`兩欄，stage=(0,86.40625)..(160,300)、plot68；native字形右緣169.021896，越界**9.021896 CSSpx**。[原診斷JSON](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/smoke-report.json)八筆source／actual ZIP×兩拓撲×A／D的selection及裁切逐筆已重算，八張圖已實看；代表[source A](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/source-300-standalone-case-0.png)與[ZIP D／iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/package-300-iframe-case-3.png)確有P／下標截斷。該collector exit0／errors=[]只表示成功收集，沒有readability assertion，**不是pass**。

**8a修正與實圖**：[scene:84](/Users/hangwong/Documents/Projects/simlab/sim/motion-composition-stroboscopic-lab/scene.js:84)於compact剩餘留白<50px時，以stageWidth−4右對齊兩行「所選」／「Pᵢ」、dy18；維持14px主字／11px下標，沒有縮圖、隱球或移正確位置。[short矩陣:175](/Users/hangwong/Documents/Projects/simlab/tools/motion-composition-browser-regression.js:175)擴225／250／275／300／301px，各source／ZIP每高度56狀態=32 readonly＋24 dense／partial／wrong，合280；實際selection、readonly權威不變及native stage／球面／文字／rack避碰均有assertion。

300px八張新圖全部實看，P₁及下標完整：[source A](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-short-300-standalone-reference-0-t1.png)、[source D／iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-short-300-iframe-reference-3-t1.png)、[ZIP A／iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-300-iframe-reference-0-t1.png)、[ZIP D](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-300-standalone-reference-3-t1.png)。最新A／D四路同native值如下；全部文字在stage內，不交任何含描邊球面／rack。

| CSS高度 | Stage尺寸 | Caption native右緣／下緣 | Stage右側餘量 |
|---|---|---|---|
| 225 | 160×138.59375 | 155.109390／132.604980，單行 | 4.890610px |
| 250 | 160×163.59375 | 155.024994／152.915237，兩行 | 4.975006px |
| 275 | 160×188.59375 | 155.024994／153.431244，兩行 | 4.975006px |
| 300 | 160×213.59375 | 155.024994／153.509369，兩行 | 4.975006px |
| 301 | 320×152 | 241.528748／133.351639，單行 | 78.471252px |

250px editable D／t₄的caption左緣127.196877、44px rack右緣124，淨距3.196877px，[source實圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-250-standalone-edit.png)／[ZIP iframe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-250-iframe-edit.png)已核。301px回單欄及[ZIP只讀圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-301-iframe-reference-3-t1.png)、[capture首曝光](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-300-standalone-capture-live.png)、[reference live](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-300-iframe-reference-live.png)、[reduced reference](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-1/package-boundary-300-iframe-reference-step1-t4.png)、[source preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/source-targeted-300-iframe-preview.png)／[ZIP preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/package-targeted-300-standalone-preview.png)均實看。新球面／caption native、全scope回歸、三位完整再審及最終package共同支持PF06 Closed。

## 8a實際驗證與可信度

| 證據／執行者 | 第四位直接核對結果 |
|---|---|
| 三人完整回歸 | 各於8a全新跑model／animation／scoring／persistence／lifecycle／scene六Node tests、check與base diff，全部exit0；Root亦完成最新受影響回歸。沒有引用c32沿用951純測試代替本輪 |
| 三份獨立smoke | [R1 raw](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-1/smoke-report.json)、[R2 raw](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/smoke-report.json)、[R3 raw](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-3/smoke-report.json)皆全新production packager→actual解壓ZIP，exit0／errors=[]。各路13viewport×32 diagrams、40playback、280short-label、36short touch、5曝光及2reflow，flows全true／mouse100；其normal `gestures`為空，不冒稱另外實跑43-row矩陣 |
| Root完整矩陣 | [caption-final/report.json](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/report.json)Root新執行完成exit0／errors=[]，Chrome155.0.8059.27／CDP trusted touch；source／ZIP各416 edit＋legal-restored-reference圖及上述新矩陣。另source／package×390／320四組各43 normal owner rows；flows全true／mouse100 |
| 第四位native／物理重算 | 四份8a JSON各1,674組readability、1,504個P、18,936次P對全部含描邊球面、42,678次axis對origin／投影／live；文字pair、rack／內容與stage clipping全部通過。真4×4 selection及各height的56狀態完整；五組normal／reduced曝光0→4、observed／tray時機核實，另按物理方程重算200個投影球心，吻合actual native |
| 第四位preview／owners重算 | Root280 preview的主圖／preview球心、viewBox中心、橫豎3×、shell全框、16px避指及inert均通過。128 normal drags逐trusted touch／move／up、只保存該slot／time、非owner固定；48 pans、32 multi-touch取消＋同頁recovery、16 cancel／lost capture／resize／outside、12 locked host pans核before／during／after。三smoke各136 short previews另核通過；均為再核raw，非第四位重跑手勢 |
| R1額外boundary | [96-row原始probe](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-1/caption-boundary-probe.json)：48 reduced readonly＋16 edit＋16 preview＋16 capture，225／250／300／301兩拓撲及source／ZIP。第四位核896次P／全部球面無交集、native字形在stage內、曝光0／.20／.40與16真3×preview；source／ZIP live實圖亦核 |
| Root package-all | [最新log](/Users/hangwong/Documents/Projects/simlab/output/motion-composition-caption-package-all.log)Root於8a執行exit0，以All SCORM packages verified完結；第四位直接讀log，未自行執行 |
| 最終actual ZIP | [parity artifact](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-parity.json)及第四位直接讀[ZIP](/Users/hangwong/Documents/Projects/simlab/output/motion-composition-stroboscopic-lab-scorm.zip)：**36,713 bytes／14 exact entries／11本地JS-CSS refs**，manifest／全部entry bytes逐一等於固定8a source，launch正確，無tests／CDN。SHA256=`d2ad73396f1e46984dfa4321fbdafc4f7a256cf31b9e13a41bf04ca4e94d74c0`。package-all當輪`84afad1622fef0ae75efdff656bcee4b0fb24e80ee6a440e785e2b58e59f07cd`及R1當輪`995ce67…`是歷史archive metadata；entry bytes一致，最終以d2ad733…為準，三人均已直接核pin且停止重建 |

**301px helper歷史與補查分開**：R2最初helper exit1是在`scrollIntoView(nearest)`後button bottom=301.0625、panel bottom=301；[診斷collector](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/301-submit-diagnostic.json)exit0只表示收集。第四位核後續[12-row可信補查](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-2/targeted-new-heights.json)：四路301正常panel pan由scroll505→514，selection／全答案／doc／stage／host固定，44px button=(16,248.0625)..(304,292.0625)完全在panel內，上／下餘9.65625／8.9375px，直接trusted tap→review零分。其250／300非目前球preview [2400,0]與release相等、只改指定slot／time、cleanup及live也核實。

R1另[8組blank／partial提交](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-review-1/submit-301-touch.json)的panel-only pan、文字完整可見、中心hit=submitButton及trusted tap→review 0／3分均確認；該資料**仍有0.0625px button border rounding**，不是完整44px內縮證據，後者由R2正常pan提供。兩種補查支持可達提交，沒有確認新runtime finding，也沒有宣稱實體手機驗收。

初版whole-repo `npm test` exit0僅在[歷史repo log](/Users/hangwong/Documents/Projects/simlab/output/motion-composition-repo-tests.log)與[初版彙整](/Users/hangwong/Documents/Projects/simlab/docs/reviews/2026-10-01-motion-composition-final-review.md)保留。本輪最新是全部六套受影響回歸＋check／browser＋package-all，沒有重跑全repo；不將初版pass移作8a實跑。

## 整個活動的標準核對

以下依三位完整審核及第四位source／原始資料核對，沒有只看P修正。8a全scope未確認新的可重現本機問題；d89→8a只有caption呈現與高度矩陣修正，其他runtime逐byte維持已完整核對的實作。

| 領域 | 本機核對／限制 |
|---|---|
| 物理／教學 | Δt=0.20s、末時刻0.80s、16位置、共同O、向上正y、橫豎等比例一致。A vx=4／vy=−4；B vx=4／ay=−10；C ax=10／vy=−4；D ax=10／ay=−10，加速分量由靜止起。A／D y=−x但間距不同；B y=−5x²/16，C x=5y²/16且y≤0。勻速間距0.80m；加速0.20／0.60／1.00／1.40m、增量0.40m。g=10近似／忽略阻力、C非自由落體、D特定條件、有限頻閃辨相符模型／各段平均速率均清楚 |
| 逐次曝光／球體 | 0.80模型秒以3.20s呈現；normal連續、reduced每800ms一格，兩分運動同步0→1→2→3→4並固定取tᵢ。中斷不保存observed、舊token不能完成另一題，恢復可重拍／合法放點。梯度／高光／描邊與獨立IDs、[曝光2](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-capture-2.png)／[完成4球](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-capture-4.png)已核 |
| 四球／替代操作 | 第四曝光才保存observed並同時提供四個穩定44px入口；任意次序不用先選時刻。抓取暫態選time，合法放手保存該slot／time、取消不改答案；normal active保留偏移、compact用停泊球／面板。非目前球keyboard／panel、Shift／Enter／Escape都有production流程證據 |
| 精簡繁體／共享UI | header／stage／panel、shared tokens、主要控件16px、14px圖字／真下標／math字體／正體單位一致。文案短且足以作答，學生只連相鄰存在點、不跨null，不提前展示正解。PF01／02／05的避碰及PF06全部高度caption均Closed，保持球心與14px字形 |
| mobile／owner／snap／preview | bounded shell、panel contain、24px strips、無第三個activity document owner。normal／short trusted-touch記錄host／frame／兩方visual viewport／stage／panel／selection／全答案；owner／non-owner、多指至全部touch結束、cancel／lost capture／outside／resize rollback及cleanup通過。公開錯格可保存，post-snap主圖／3×preview／release同值、避指／inert成立；[source短preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/source-short-standalone-preview-2.png)／[ZIP iframe preview](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/caption-final/package-short-iframe-preview-0.png)已實看。實體／真Moodle部署仍外部未驗 |
| 評分／提交 | 四題各25、位置64＋分類36、60達標；每x／y各2、方向類型各3、軌跡3，±50mm逐分量、不混CSS snap。空白0／分類36／位置64／全對100、部分分／錯slot／重疊／容差邊界有回歸。全部edit含未觀察／未訪問／部分／由check返回可check／返回／明確submit；觀察／預設不加分、最後題不自動提交，submitted／pending無clear／restart |
| schema／phase／續作 | 固定四case／四slot、毫米整數、必要欄／strict enum／version／範圍／observed→points／kind→phase嚴格；合法空白／錯答／重疊／先答分類不視corrupt。512production encode／decode／restore重算同score／passed並有實際合法下一步；max draft／review／pending=791／818／1061UTF-8bytes<4000。動畫／working／pointer／preview為transient，restore不重吸附 |
| SCORM／trust／standalone | shared loadAttempt＋startup四outcomes、submitWithCallbacks＋submission四outcomes、retryable兩類／committed finish retry／canonical不可變pending／invalid quarantine／pagehide不寫壞資料／review mismatch／unknown status皆核。technical／frozen不冒稱確認score／正解，recorded不解鎖。Standalone memory-only：partial／check／submitted刷新全新，舊／denied storage不讀寫；fake-LMS同attempt draft／review／pending保留。無raw LMS／local commit／finish／page-lifecycle重複實作；形成性client grading風險已記錄、無secret |
| catalogue／包裝／測試 | metadata／active folder／SCORM1.2launch相符；六新tests及browser runner已註冊、runtime引用全在manifest，本機Live Server及actual ZIP可啟動。14entry parity／package-all對8a成立；新280-row高度矩陣及全部受影響測試完成，不把舊repo-test通過移作最新重跑 |

## 歷史證據，不移作新候選通過

下列原始位置是各候選當時行號；目前狀態以PF01–PF06表為準。

| 候選／ID | 原expected／actual與證據 |
|---|---|
| 850eae6初版 | 舊F01–F08／V01／N01已Closed，whole-repo／package-ready結論是歷史；契約由本輪再核，不能代替漸進曝光／四球修訂驗收 |
| d24b791／PF01 | scene:22固定y、31–37後畫球。Expected軸名避球可讀；actual320×225 A–D及320×500 C／D遮字。原[20-state bounds](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/y-label-overlap.json)、[原圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/source-short-axis-occlusion-0.png)／[隱球對照](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/source-short-axis-horizontal-hidden-0.png)已核；原文字對文字守衛漏球面 |
| d24b791／PF02 | model:40–44在stage210採normal首中心39。Expected四44px入口與圖例分離；actual320／390×500首球／背景遮Y₁／X₁，source／ZIP一致。原[四路bounds](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/legend-overlap.json)、[ZIP原圖](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/package-320x500-legend-occlusion.png)／[隱抓手](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/package-320x500-legend-tray-hidden.png)、第二位[ZIP metrics](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-review-2/targeted-package-layout.json)確認同一問題，去重一項 |
| d24b791／PF03 | Expected Scope列全部runtime；actual plan:53漏animation.js，HTML／manifest／ZIP原本包含。純文件同步，未宣稱套件漏檔；原重現在三位報告保留 |
| 951524c／PF04 | runner:58–69,204誤點hidden timeNav。Expected四真reference時刻、權威不變；actual0×0→mouse(0,0)、selection重複[1,1,1,1]。[原重現](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-recheck-2/reference-time-navigation.json)及[hidden／合法restore對照](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/reference-hidden-target-repro.json)保存缺口；中止smoke exit130非pass，未宣稱production評分失敗 |
| c32c470／PF05 | scene:49–55先畫P₁後畫球。Expected字形避球可辨；actual320×225完整readonly A／D t₁覆字。A text=(78.506,115.589)..(91.850,135.089)交P₂／P₃／P₄；D text=(72.544,115.589)..(85.888,135.089)交後畫P₃。[32-state資料](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/short-reference-p-labels.json)、[source A](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1.png)／[隱球](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/source-short-reference-0-t1-balls-hidden.png)、[ZIP D](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-3-t1.png)／[隱球](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/package-short-reference-3-t1-balls-hidden.png)已實看。bbox定位、實圖證覆字；c32三smoke／Root矩陣漏P對answer球守衛，不足closure |
| c32既有通過 | [當時Root矩陣](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/progressive-final-verified/report.json)exit0／errors=[]、PF01–PF04Closed；ZIP35,619bytes、SHA=`02f43fd1c875bdb67469ce70bbfef7a4ca26b44b5a425d03766d771c073c020d`、14檔parity。當時PF05Open／package-all待完成是歷史；本輪以8a新實跑／bytes及全部closure判斷 |
| d89／PF05–06 | [當時Root矩陣](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-final/report.json)及三smoke／package-all已有exit0，PF05球面覆字Closed，但56個short states只驗225px，後續八筆300px反例使PF06 Open、package-ready未通過。[當時parity](/Users/hangwong/Documents/Projects/simlab/output/playwright/motion-composition-stroboscopic-lab/point-label-final/package-parity.json)為36,628bytes／14entries／SHA `b39f17b68229b5fae51e67e2ed394d1d516398eb47b4efb2e9140bb58d6fbd38`；只作歷史，不移作8a最新證據。 |

## 文件同步及外部 gate

Root在第四位raw／實圖／ZIP確認零Open後，docs-only同步[plan狀態](/Users/hangwong/Documents/Projects/simlab/plans/25-motion-composition-stroboscopic-lab.md:3)、package-ready checklist及文末「追加修訂及完整驗收（8a8095d）」；第四位已直接核最新範圍／矩陣／六tests／package-all／pin與whole-repo歷史區分，PF01–06 closure及本機PASS一致。三份正式報告均已完成且最終archive已pin；原R1「待pin」句已同步。讀取`git diff 8a -- sim tools package.json`為空，文件同步未改runtime／tests／catalogue／manifest或重建套件；所有當前本地Markdown證據連結另逐一核存在。

真實Moodle學生空白／部分score及status、同attempt離開／refresh／draft／pending retry／submitted只讀、零分鎖定、新attempt／teacher policy仍UNVERIFIED。實體手機current-window及提供時的new-window player、全部gesture owners、四球／snap／preview／strips、最後控制／回捲、真host／跨origin、toolbar／native picker／裝置zoom亦UNVERIFIED；fake-LMS、CDP touch、CSS reflow／visual zoom不能替代。高風險trusted server grading在本形成性活動為N/A。

**最終本機結論：8a的PF01–PF06全部Closed，零Open，本地package-ready PASS；文件同步closure完成。真實Moodle及實體手機gate未驗，Moodle-ready不作通過宣稱。**
