# 運動合成修訂版完整獨立審核 1

日期：2026-10-01。目前完整再審固定候選：`8a8095d877ac76a5a7ed1402efbe24f845c817a9`，分支 `codex/motion-composition-stroboscopic-plan`，實際 base 為 `origin/main`／`0bb873c`。工作目錄為 `/Users/hangwong/Documents/Projects/simlab`。本報告保留 d24b791、951524、c32c470 及 `d89d44c1bfa9df95b1cf4e446e7dfcce5694c2b8` 的歷史 finding／證據，與本次 8a 完整再審分開記錄。

## 結論

本次對 8a 的整條 branch 獨立再審，**沒有尚未修正或新增的可重現 finding**。R1-01／R1-02 的軸名／圖例、R1-03 的 reference 四時刻驗證缺口、R1-04／PF05 的球面遮字均維持關閉；Root 在 d89 追加的 PF06／本報告 R1-05（300px 高度 caption 裁切）在 8a 關閉。原 A／D、t₁ 的八個 source／實際 ZIP、standalone／fluid iframe 新畫面已直接查看，兩行「所選／P₁」及真下標完整可讀。250px 的停泊區間距、301px 的單欄與單行 caption、播放及 preview 亦已核對；物理、四球直接操作、部分分、保存／凍結、SCORM、目錄及 ZIP 契約未見額外問題。

六套活動 Node 測試、`npm run check`、base diff whitespace、獨立 source／實際 rebuilt ZIP smoke，以及額外 boundary／reduced-motion／可信 preview probe 均 exit0。Smoke 逐路280個225／250／275／300／301px短畫面狀態；獨立分析1,602個readability states、18,216次P／含描邊球面比較，遮蔽／裁切／文字互撞／文字對停泊區交集全部0。另有96個專用 native states、16組可信preview／放手流程及301px八組blank／partial可信提交通過。Root 同候選完整 owner raw矩陣已直接檢讀，已確認exit0並與自身執行分開記錄。真實 Moodle／實體手機 gate 維持未驗。

各輪均自行審核整條 branch，沒有按領域分工，也未閱讀另兩位此次的審核報告。首輪 Root 提示 `y` 遮蔽後，我另開 target 讀實際幾何並保存正常／診斷對比圖；圖例問題由獨立畫面檢查發現。951／c32 輪 Root 轉述 hidden timeNav 缺口，我另開 target 證實原迴圈得到 `[1,1,1,1]`。R1-04 由本審核在 c32 完整參考圖 target 發現。PF06 由 Root 在 d89 發現；本輪獨立檢讀八個舊 native rows及代表截圖，另自行完成8a嚴格source／ZIP再驗。只更新此報告與ignored診斷產物，沒有修改production、tests、shared或plan。

## 審核範圍與依據

已閱讀 `AGENTS.md`、`plans/00-shared-platform-and-style.md`、`docs/simulation-scorm-production-guide.md`、`plans/NEW-SIMULATION-PLAN-TEMPLATE.md`、`plans/25-motion-composition-stroboscopic-lab.md`，並檢查完整活動的 HTML、CSS、model、animation、scene、main、scoring、persistence、ui-runtime、六套測試、test-support，以及 catalogue、manifest、package/test runner 的 branch 變更。亦核對共享 SCORM／activity-flow 的實際 API、信任比較及 lifecycle 行為。

| 領域 | 審核結果 |
|---|---|
| 物理模型 | 四題 t₁–t₄ 全部參考位置與 Δt=0.20 s 一致。A／D 的 y=−x、B 的 y=−(5/16)x²、C 的 x=(5/16)y² 且 y≤0 均正確；共同原點、y 向上及等比例映射一致。B 的 g=10 m/s²／忽略阻力與其他理想分運動的區別有記錄。有限頻閃只用來辨認相符模型，沒有宣稱證明每一瞬間加速度。 |
| 逐次曝光／外觀 | 正常 ¼ 速同步移動，模型時間每經過0.20 s 才增加兩個投影球影；reduced-motion 維持同節奏逐格。曝光固定取模型 tᵢ，取消的舊 frame 不能完成另一題。截圖實際看見 0、2、4 次曝光；球體有本地 radial gradient／高光，主圖及 preview 的 IDs 分離。 |
| 四球／鍵盤／導航 | 四個 t₁–t₄ 入口同時存在且互不重疊，可直接任意次序拖入；只在合法放手保存所屬點與 activeTime。取消保留原答案／選擇。既有球保留抓取偏移；compact 以所屬停泊球再拖及面板替代。非目前時刻的鍵盤選取、微調、Enter／Escape、焦點離開後的刪點／下一步均有 production UI 回歸。四情境互不依賴；每種 editable／blank／partial 都可檢查及明確提交。 |
| 文字／設計／手機 | 繁體操作文案簡短，沒有提交前正解／得分提示；三區、短畫面 reflow、44px 抓手、方格吸附、3× preview 及 bounded panel 已驗。軸名／圖例及 R1-04 的 P 標籤遮擋均已修。normal P 標籤避全部球面、圖中文字、實際曲線及停泊區；compact 明示「所選 Pᵢ」且選中球描邊加粗，窄margin分兩行向stage內對齊。模型球心、等比例映射、score／schema 均不因排字改動。 |
| 評分 | 全空0、全對100、分類36／位置64、兩個座標各2分、兩方向類型及軌跡各3分正確。每個50mm內／外邊界、重疊與錯時刻均測；observed、播放、停泊球與預設原點不加分。合法錯答不被當作 corrupt。 |
| 保存／狀態 | production encode/decode/restore 實跑512個 phase／variant／case／slot 組合並執行合法續作。權威毫米答案及語義索引不被重新吸附；未完成拍攝是 transient，Moodle 恢復後可重新拍攝。範例完整 draft／review／pending 封套分別791／818／1061 UTF-8 bytes，低於4000。非法型別、數字、enum、依賴及 phase fail closed。 |
| SCORM／trust／refresh | 四種 startup 與四種 submission outcome、retryable 兩類、finish retry、未知／不一致／非法 finished review 都保持正確鎖定。deep-invalid pending 先 quarantine，pagehide 不寫回拒絕的結果；未確認不顯示分數／正解。Standalone memory-only，partial／check／submitted 刷新全空、舊／拒絕 storage 不阻止新練習；同 Moodle-like attempt 恢復 draft／review／pending。 |
| 手勢／包裝 | 8a source 與實際 ZIP 的可信 short touch 矩陣由本審核獨立執行；另獨立補225／250／300／301px兩拓撲的可信preview／release，Root 同候選常規四組全 owner raw補證已直接檢讀。方格錯位置仍可保存；preview 實際焦點、球心、3× 倍率、避指、cleanup 和非 owner 固定都有斷言。manifest／所有14個 ZIP entries 逐 byte 與目前候選 source 相同，沒有 test／CDN／額外 runtime 遺漏；Scope 已列 animation。 |

## Findings、修正及 closure

### R1-01 — [P2] 水平球影遮住 `y` 軸名

**狀態：已關閉於 c32c470，在 d89／8a 再驗維持關閉。** 下列重現及舊行號屬 d24b791 的歷史證據。d89 `scene.js:45–48` 在 compact／小圖將軸名移到投影球域之外。本審核 source／ZIP 各13 viewport×四情境×四時刻×edit／reference 的實際 DOM、40個播放 rows（各有起點及首曝光）、新增56個短 reference／密集／部分／錯答 rows 均通過。獨立讀取 d89 native 資料，軸名對投影／live 球面（含描邊）的相交為0；另看過短 capture／reference、reduced-motion reference 及手機正常圖。R1-04 有獨立 closure，不以本 finding 推定。

- **位置**：`sim/motion-composition-stroboscopic-lab/scene.js:22` 固定把軸名放在 `origin.x+8`、`top+9`；同檔31–35行在文字之後繪製實心頻閃球。`tools/motion-composition-browser-regression.js:118–124` 的標籤驗證只比較 SVG 文字彼此的 bbox，沒有檢查文字與球影的遮擋。
- **重現**：以320×225 CSS viewport 開啟 source 或實際 ZIP，於情境1／2按「拍攝頻閃圖」，等拍攝完成，保持 t₁。此時 compact plot size=40，軸名與 t₁ 水平球影占用同一區域。另在320×500的情境3／4完成拍攝，size=122時也遮住 `y` 字形下端。
- **Expected**：必要軸名在完成頻閃、選各時刻及放點／參考模式仍可讀，並避開球影與其他文字；等比例映射及球心保持模型位置。
- **Actual**：320×225情境1／2的實心 X₁ 明顯蓋住 `y`，X₂亦重疊其 bbox；只在診斷 DOM 暫時隱藏水平球影後，原本被蓋住的字完整出現。320×500情境3／4的首個藍球遮住字形下端。source／ZIP結果相同。
- **數據**：320×225的 `y` bbox 為 x=70.8649、y=92.7331、w=9.1876、h=14.2689；與 X₁ 圓 bbox 的相交約5.6538×9.9375 CSS px。320×500 C／D 的相交約3.7713×5.0650 px。390×600 C／D僅有較小 bbox 接觸，本 finding 的字形結論以320×225及320×500的實際對比圖為依據。
- **證據**：`output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/y-label-overlap.json` 包含20個實際 DOM 狀態；`source-short-axis-occlusion-0.png`／`source-short-axis-horizontal-hidden-0.png`、`package-short-axis-occlusion-0.png`／`package-short-axis-horizontal-hidden-0.png`；正常手機比較為 `source-320x500-axis-occlusion-2.png`／`source-320x500-axis-horizontal-hidden-2.png`。這些暫態診斷只改瀏覽器 DOM，沒有改產品檔案。
- **修正建議**：依圖域大小將軸名放到有空間且避開球影的區域，保留14px文字、球心、模型及手機 side strips；補驗非文字物件遮擋文字的情況。
- **再驗條件**：source／新 rebuilt ZIP 的320×225兩種拓撲、320×500、390×500／600，逐四情境／四時刻／已提交 reference 與播放檢查 `y`、O、Pᵢ、stage 時鐘無遮擋或裁切；重跑受影響 scene／model／browser regression，確認 preview／方格／score 不變。

### R1-02 — [P2] 第一個球抓手蓋住分運動圖例下標

**狀態：已關閉於 c32c470，在 d89／8a 再驗維持關閉。** 下列重現及舊行號屬 d24b791。`model.js:40–44` 把 compact 門檻設為stage高<210px，normal 第一中心至少54px。c32 source／ZIP 的320×500原生 bounds：第一抓手頂126.59375、圖例底118.390625，垂直淨距8.203125 CSS px；d89 重跑所有13 viewport四情境四時刻、門檻兩側、short兩拓撲、44px入口／可命中／不重疊、direct out-of-order mouse及short trusted touch，均通過。單位 `m` 亦已移離停泊區；d89 native 文字對抓手／其內容交集為0，source／ZIP parking、cutoff及compact圖都實際看過。

- **位置**：`sim/motion-composition-stroboscopic-lab/model.js:40–44` 在stage高210px時仍採 noncompact，第一個 tray 中心y=39、44px外框頂端為stage+17。`sim/motion-composition-stroboscopic-lab/styles.css:18` 將stage-top置於上方3px；21行抓手z-index=5高於圖例z-index=2，27行的選中背景會畫在圖例之上。`tools/motion-composition-browser-regression.js:119–120` 只驗圖例文字／下標存在，未驗實際可視。
- **重現**：以320×500 CSS viewport 開 source 或實際 ZIP，在任一情境完成拍攝並保留 t₁。四個球停泊在圖右側；第一個 t₁ 抓手的淡紫選中背景與球體侵入上方 X₁／Y₁ 圖例。這不需要開始拖動或打開 preview。
- **Expected**：四個球完整可抓且互不重疊，同時圖例的 Xᵢ／Yᵢ 與真下標完整可讀；抓手與圖例各有足夠區域。
- **Actual**：`Y₁ 垂直` 的下標被第一個球抓手背景蓋住；只在診斷 DOM hidden `trayHandle1` 後，下標完整出現。source與ZIP兩路一致。390×500另有同類幾何交集，須一併納入修正驗證。
- **數據**：320×500的Y圖例bounds為x245.1719..292、y98.5938..118.3906；第一抓手bounds為x215..259、y111.5938..155.5938，相交13.8281×6.7969px。球體bounds為x225..249、y110.7031..134.7031，亦與圖例相交。390×500第一抓手與X圖例bounds相交39.4219×6.7969px。
- **證據**：`output/playwright/motion-composition-stroboscopic-lab/progressive-review-1/legend-overlap.json`（source／ZIP×320／390×500）；`source-320x500-legend-occlusion.png`／`source-320x500-legend-tray-hidden.png`、`package-320x500-legend-occlusion.png`／`package-320x500-legend-tray-hidden.png`。可從兩張正常／隱藏抓手的截圖直接比較Y下標。
- **修正建議**：tray排列預留stage頂列所需高度；空間不足時及早採compact／改圖例位置。維持四球44px熱區、下方控件、side strips與任意順序操作；補圖例及sub對抓手／sphere的可視斷言。
- **再驗條件**：source／新ZIP在320×500、390×500、390×600、stage高196px附近、320×225、橫向及200% reflow逐 t₁–t₄ 檢查圖例完整；確認四個球全框可達、互不重疊且不侵入scroll strips。重跑model geometry、direct out-of-order pointer／keyboard、source／ZIP可信touch及short matrix。

### R1-03 — [P2] 只讀 reference 四時刻迴圈實際重複 t₁

**狀態：已關閉於 c32c470，在 d89／8a 再驗維持關閉；屬驗證缺口，非新增 production 行為錯誤。** d89 的 `rect:58–60` 仍拒絕hidden／0×0，`visual:220–223` 保留負測及合法finished fixture／actual selection／submitted不變斷言。獨立 d89 raw 資料確認每個普通viewport及兩種短拓撲都有16組唯一 reference case／time，沒有重複 t₁ 冒充四時刻。

- **位置／根因**：951524 的 `tools/motion-composition-browser-regression.js:58–65` 定位不檢查可見性；200–206行 reference 迴圈點擊 `[data-time]`。`main.js:38,47` 把 timeNav 留在已隱藏的 editPanel，review 中該button native rect為0×0；舊 `click` 於(0,0)送出 trusted mouse。原迴圈未斷言所要求的case／time，故t₁可以重複通過四次。
- **Expected／Actual**：宣稱檢查四時刻必須實際載入或選到1／2／3／4。另開 target 以目前相同 production 重現舊定位：四次target `clientRects=0`、center均`[0,0]`，trusted click後實際time均1，而非所要求的1／2／3／4。
- **修正及再驗**：c32 `rect:58–60` 拒絕hidden／0×0；`visual:203` 驗edit實際case／time；206行以review hidden target負測守衛，207–209行逐合法finished fixture保存索引、由production restore還原，再核對reference=true、case／time及submitted答案未變。本審核 source／ZIP各13 viewport、每個viewport16個reference的實際selection確有16組唯一case/time；沒有沿用951的reference覆蓋宣稱。
- **證據**：`progressive-final-recheck-1/reference-hidden-target-repro.json` 含原native hidden rect與trusted click結果 `[1,1,1,1]`，及合法production restore後 `[1,2,3,4]`；`smoke-report.json`／`review-closure.json` 有完整每四題四時刻的實際選擇。此短重現及完整smoke均exit0。Referencebutton的專用restore示例以DOM click開圖；正式smoke用trusted定位並核對readonly不變。

### R1-04 — [P2] 短畫面完整參考球蓋住 selected `Pᵢ` 字形

**狀態：已關閉於 d89d44c，在8a球面遮字再驗維持關閉；對應第四位彙整的 PF05。** d89修正 `scene.js:78–84` 先繪全部球，再在 clip 外統一畫 selected 文字；normal 的 `labelPosition:23–32` 及37、47、53、56–58、70–76行障礙／實際曲線集合避全球面、文字、rack及路徑。compact 以圖旁「所選 Pᵢ」明示對應，所選球仍用6px半徑／2.2px描邊。模型、參考球心、答案、rubric／schema 沒有改動。

下列數據屬d89歷史再驗：本審核 source／實際 rebuilt ZIP smoke、專用24個 reduced-motion reference／cutoff rows 均 exit0。320×225 standalone／fluid iframe 各四case×四saved time 的完整readonly圖（兩路共64個）確實載入所要求 case／time，reference=true且提交資料未變。另有各拓撲密集／partial／合法錯答×四time，每路合計56 short label rows。已直接看 source／ZIP 的 A／D t₁ 正常圖，無須 hidden 球面即可完整讀字。兩路兩拓撲的「所選 P₁」bounds都是 `[109.3125,109.1050]..[155.1094,132.6050]` CSS px，stage右邊160，13個含描邊球面最右100.6719：球面淨距8.6406px、stage右淨距4.8906px。

新 `tools/motion-composition-browser-regression.js:118–132` 讀全部 `circle[data-ball]` 的native bounds及描邊，129行將P標籤與所有球比較；175–188行補完整短reference及合法密集／partial／wrong。從自身完成的 raw smoke 獨立重算1,154個 readability states、12,872次P／sphere比較，交集0；軸名對投影／live球面、SVG文字彼此、SVG／HTML文字對rack及其內容的交集、文字clip均0。`point-label-review-1/review-closure.json`保存摘要及原A／D反例的實際bounds；新圖為同目錄 `source-short-standalone-reference-0-t1.png`、`source-short-iframe-reference-3-t1.png`及其另一拓撲／package對應檔。普通／cutoff／compact／short reduced-reference的live狀態及source／ZIP preview亦已實際查看。以下原因、舊行號與重現均屬 c32 的歷史證據。

- **位置**：`sim/motion-composition-stroboscopic-lab/scene.js:49–55` 在answer迴圈中畫每一球及selected標籤；selected slot之後的球繼續畫在此文字上。52–54行的label placement只避原點／軸名／plot邊界，沒有避其他球。`tools/motion-composition-browser-regression.js:119–134` 的sphere守衛只套 `data-axis-name`，球集也不含answer／reference球，故未涵蓋 `Pᵢ`；普通13viewport reference矩陣沒有320×225的完整四球參考圖。
- **重現**：以合法已提交完整答案（`finishedData(filled())`保存activeCase=0、activeTime=1）於320×225 CSS viewport載入source／實際ZIP，按「顯示參考作圖」。或完成四題、回情境1選t₁後提交，再縮至此CSS viewport。Plot為40px，四個reference球均存在。情境4／t₁、t₂亦可重現。診斷只hidden reference球，保留文字、curve、投影球及全部已提交資料。
- **Expected**：selected `Pᵢ` 字形及真下標可直接閱讀，與軸名、球面、停泊區及plot clip避開；圖內球心及權威坐標不能為了排字而改動。
- **Actual**：A／t₁的 `P₁` 大部分字形被後續P₂／P₃／P₄球面蓋住；診斷hidden球面後完整 `P₁` 才出現。D／t₁亦遮P字形；D／t₂的標籤同樣受到後續球遮蔽。source／ZIP正常／hidden圖一致。Bounds交集不一概當作字形遮蔽：本finding的可見字形結論以上述實際對比圖為準。
- **數據**：A／t₁文字bbox `[78.50625,115.58936]..[91.85001,135.08936]` CSS px；其與P₃球bbox `[82.97813,118.14248]..[91.92188,127.08623]` 大幅相交，P₂及P₄亦有交集。D／t₁文字bbox `[72.54375,115.58936]..[85.88750,135.08936]` 與後畫的P₃球相交。專用target逐source／ZIP×四題×四時刻共32個合法readonly狀態，全部actual selection核對；未將幾何交集數目誤報成同等數目的可見bug。
- **證據**：`output/playwright/motion-composition-stroboscopic-lab/progressive-final-recheck-1/short-reference-p-labels.json`；`source-short-reference-0-t1.png`／`source-short-reference-0-t1-balls-hidden.png`，`package-short-reference-0-t1.png`／`package-short-reference-0-t1-balls-hidden.png`；D／t₁及t₂為同目錄 `source-short-reference-3-t1*.png`／`source-short-reference-3-t2*.png`及package同名。專用target exit0，截圖已實際看過。
- **修正建議**：讓selected label避開其他答案／reference球，compact可使用有空間的圖外區域並保留清楚對應；最後統一畫文字避免後續球覆寫，但僅改繪製順序不能代替可讀位置。保持模型、等比例映射、原資料、四球44px入口、score／schema與只讀契約。擴native守衛至 `Pᵢ`及其他球面含描邊，加入短readonly四case×四slot及合法密集／部分／錯答布局。
- **再驗條件**：source／rebuilt ZIP在320×225兩種拓撲逐四情境四時刻的完整reference，連同播放起點／首曝光及普通／compact門檻附近驗selected字形無覆蓋或clip。以actual selection、native bounds及代表截圖確認，而非只驗文字存在。原軸名／圖例closure、合法錯答、preview、任意次序拖放、scoring及read-only資料不變均須保持；受影響scene/model及browser回歸重跑。

### R1-05 — [P2] 300px 高度 compact caption 右端裁切（Root PF06）

**狀態：已關閉於8a8095d；Root新增、本審核獨立核對與再驗。** PF05的球面遮字修正仍有效；這是其後在另一個受支援高度發現的stage邊界問題。

- **歷史位置／原因**：d89 `scene.js:83–84` 只以plot右緣+10px開始整行「所選 Pᵢ」，未量剩餘margin。`styles.css:54` 支援高≤300px的stage／panel各半欄；`tools/motion-composition-browser-regression.js:175–186` 當時只驗225px的56個short label states，未包括兩欄上界及切回單欄的301px。
- **重現**：d89於CSS320×300載入合法已提交完整答案，activeCase=0或3、activeTime=1，經production restore後按「顯示參考作圖」。Source／actual ZIP及standalone／fluid iframe皆相同；stage160×213.59375、plot68、caption為一行。
- **Expected／Actual**：應完整讀到所選P及下標，且不改球心／等比例或縮小字。舊caption native bounds為x123.2250..169.0219，stage右邊160，超出9.0219px；實際圖看得到「所選」而P／下標被切去。
- **舊證據歸屬**：`output/playwright/motion-composition-stroboscopic-lab/label-height-300-repro/smoke-report.json`為Root的診斷收集，兩路各四rows共8個clipped=true，本審核直接檢讀；亦直接看 `source-300-standalone-case-0.png`及`package-300-iframe-case-3.png`。該run exit0／errors=[]只表示診斷收集完成，不能視為驗證passed；d89的原結論與56-row守衛均屬歷史，沒有因此關閉PF06。
- **修正／本審核closure**：8a `scene.js:84–87` 在compact剩餘<50px時以stage右邊−4px為右對齊，將「所選」及Pᵢ分兩行、dy=18；其餘full／normal保留既有格式。14px主字、11px真下標、所選球描邊、plot／sphere／target／model／rubric／schema都不變。自行完整source／actualZIP smoke通過，177行五高度各56個strict states，每路280，確有四case×四saved time的actual selection／reference及submitted不變。
- **新原生證據**：8a原300px A／D、t₁八個新圖與舊圖相同geometry，caption bounds全部 `[127.1969,112.1219]..[155.0250,153.5094]`，stage右淨距4.9750px，全部字形已直接看過。250px editable D／t₄的caption最左127.1969，右側44px抓手最右124，水平淨距3.1969px且實際圖未覆蓋；225px full caption仍完整，301px回單欄stage320×152，full caption最右241.5287、右淨距78.4713px。
- **再驗條件完成**：`caption-review-1/review-closure.json`記錄1,602個原生states、18,216次P／所有含描邊球面比較，交集／clip／文字／rack問題各0；`caption-boundary-probe.json`／`caption-boundary-summary.json`另有96個native rows，涵蓋兩路四高度兩拓撲的48 reduced-reference steps、16 edit、16可信preview／放手、16 capture首曝光。其P／sphere896次比較為0，已提交資料及非owner固定、模型0／.20／.40秒與0／1／2曝光、3×真實preview及cleanup均通過。八個原反例新截圖、250px rack及301px full／preview的source／ZIP圖皆已實際查看。

## 8a目前候選的實際執行與證據來源

### 本審核獨立執行於8a8095d

以下命令均在固定8a候選完成，退出碼0：

```text
node sim/motion-composition-stroboscopic-lab/model.test.js
node sim/motion-composition-stroboscopic-lab/animation.test.js
node sim/motion-composition-stroboscopic-lab/scoring.test.js
node sim/motion-composition-stroboscopic-lab/persistence.test.js
node sim/motion-composition-stroboscopic-lab/lifecycle.test.js
node sim/motion-composition-stroboscopic-lab/scene.test.js
npm run check
git diff --check origin/main...HEAD
MOTION_ARTIFACT_SUFFIX=caption-review-1 node tools/motion-composition-browser-regression.js --smoke
MOTION_ARTIFACT_SUFFIX=caption-review-1 node output/playwright/motion-composition-stroboscopic-lab/caption-review-1/caption-boundary-probe.js
```

本輪再次讀完整活動／基準與guide／計劃／六套tests及support／catalogue／manifest／runner，亦核對shared flow、loadAttempt、saveDraft、pending、trust、retry及lifecycle。不按領域分工，沒有只看caption delta。四情境參數／曲線、同步Δt=.20s及4倍慢速、reduced-motion逐格、四球直接任意順序拖放／取消／keyboard／panel、100分座標／分類獨立部分分、所有blank／partial進check後明確submit、512 production round-trips與合法續作及4000byte契約維持。合法錯點／null未答不被當作corrupt；SCORM所有結果／pending凍結與summary-only信任限制、standalone刷新全空及Moodle同attempt恢復維持。沒有local LMS／finish／page-lifecycle或外部runtime依賴。

`output/playwright/motion-composition-stroboscopic-lab/caption-review-1/smoke-report.json`使用Chrome155.0.8059.27／CDP。Runner本次重新建包、啟動實際解壓ZIP；source／package各13 viewport（208 edit＋208合法restored-reference）、5 normal／reduced曝光場景及中斷恢復續作、40 capture／reference playback rows（各起點及首曝光）、280 short label rows（160 readonly＋120 dense／partial／wrong）、36可信short touch rows、兩個200%CSS reflow拓撲。全部flows true、mouse100、errors=[]。常規全owner `gestures` 為空；Root四組完整owner補證另列，沒有冒稱自己跑完整常規版。

獨立額外probe共96 native rows及16組可信drag preview／release，使用當輪source及實際ZIP，先逐byte比對套件，再按合法saved fixture經production restore。225／250／300／301×standalone／fluid iframe各驗D／t₄ readonly reduced播放0／.20／.40秒，confirmed答案不變；edit caption與working caption，以及capture first exposure後中斷不杜撰observed。每個preview再核對真實主圖／lens球心、3×比例、讀數、避指、全框可視、pointer-inert、release及cleanup，非owner document／stage／host／panel固定。圖域／球心等於原模型；probe退出後自行關閉browser／server／owned暫存目錄。代表新capture／reference/live／edit／preview畫面已直接查看。

另於CSS320×301自主補source／actual ZIP×standalone／fluid iframe×blank／partial共8個可信觸控流程，保存`caption-review-1/submit-301-touch.json`。從check以可信pan捲動panel，再核submit文字完全在panel內、中心hit為submitButton，可信tap後review分數依序為0或3。pan只改panel，document／stage／host／viewport／權威答案／case-time選擇均固定；最下方44px按鈕bottom=301.0625、panel bottom=301的0.0625px border rounding未裁字或阻礙實際命中。八個完整record再以獨立assert命令核對exit0；source／ZIP的301提交與300 capture首曝光圖亦已直接查看。所有專用browser／server完成並清理，沒有再重建套件。

獨立以AdmZip核對當輪ZIP全部14 entries逐byte對source一致，36,713 bytes；SHA256 `995ce67b549be08fe4cfcc442f3c2a41a34b89ae31d020ee3db42a00cfcf9429`。`caption-review-1/zip-parity.json`留每檔bytes／SHA。Root manifest、config、9個activity runtime及3個shared完整，HTML11個本地JS/CSS引用與manifest匹配，無test／CDN／secret／遺漏；Scope及catalogue active metadata完整。自身沒有跑whole-repo npm test或package:all。

### Root執行、本審核檢讀的8a完整owner補證

本審核直接讀 `output/playwright/motion-composition-stroboscopic-lab/caption-final/report.json`：Chrome155.0.8059.27、errors=[]，兩路13viewport／5曝光／40playback／280short label／36short touch／兩reflow、全部flows true及mouse100。source-390、source-320、package-390、package-320四組各43 rows。逐組另外再斷言16case/slot兩入口共32個drag有before／during／after／preview、trustedTouch至少增加1、moves／ups增加、cancels不增加、preview pointer-intercept='none'，document／stage／host／panel固定。另每組8 multi-touch、4 cancel／lost-capture／resize／outside及12 host／panel pan＋3 review／frozen／committed lockedpan，均有原生owner／非owner metrics。本節是Root執行、本審核讀raw及再核對的補證；Root已確認caption-final session11320完成exit0，與上述raw結果一致，沒有把其JSON存在當作自身執行。

Root亦確認package:all session2701完成exit0；本審核檢讀`output/motion-composition-caption-package-all.log`，末行為所有SCORM packages verified。直接檢讀`caption-final/package-parity.json`，同候選14 entries／11 runtime refs、manifest完整、source entry bytes全部相同、36,713 bytes及280個真實3×preview records一致。這是Root執行的全包補證；自身沒有跑package:all。全部browser／build停止後，Root已固定最終actual ZIP；本審核另直接讀最新parity及實際archive，再以SHA／bytes／AdmZip核對，exit0：36,713 bytes，最終SHA256 `d2ad73396f1e46984dfa4321fbdafc4f7a256cf31b9e13a41bf04ca4e94d74c0`，14 entries逐byte與固定8a source／manifest一致。自身當輪 `995ce67…` 與Root package-all歷史 `84afad…` 為不同建包metadata雜湊；最新parity另保留後者欄位，沒有混作最終archive。此次只讀並更新本報告，未重建或重跑browser／tests。

## d89的歷史實際執行與證據來源

當輪結論與56個short label rows未含300px；Root其後發現PF06，現由上節8a重新驗證關閉。下列歷史pass仍支持當時已執行的viewports／手勢／PF05遮蔽closure，不能代替新高度再驗或據此聲稱d89沒有PF06。

### 本審核獨立執行於 d89d44c

以下命令均在固定 d89 候選完成，退出碼0：

```text
node sim/motion-composition-stroboscopic-lab/model.test.js
node sim/motion-composition-stroboscopic-lab/animation.test.js
node sim/motion-composition-stroboscopic-lab/scoring.test.js
node sim/motion-composition-stroboscopic-lab/persistence.test.js
node sim/motion-composition-stroboscopic-lab/lifecycle.test.js
node sim/motion-composition-stroboscopic-lab/scene.test.js
npm run check
git diff --check origin/main...HEAD
MOTION_ARTIFACT_SUFFIX=point-label-review-1 node tools/motion-composition-browser-regression.js --smoke
```

本輪重新閱讀整條 branch 的完整活動／契約／manifest／catalogue／tests，沒有只看 scene 修正。四題25分、位置64／分類36、±50mm每座標部分分、blank／partial提交、schema/model/rubric版本及512種production保存／恢復／合法續作維持；新排字不改Moodle信任／凍結與standalone fresh契約。活動SCORM用shared startup／submit四outcomes，沒有新增raw LMS／local lifecycle或外部依賴。

`output/playwright/motion-composition-stroboscopic-lab/point-label-review-1/smoke-report.json`：Chrome155.0.8059.27／CDP，runner本次重新建包並啟動實際解壓ZIP。source／package各13 viewport、208 edit及208合法restored-reference狀態、5個normal／reduced曝光場景及中斷恢復合法續作、40個capture／reference播放readability rows（每row有起點／首曝光）、新增56 short label rows（32完整readonly＋24 dense／partial／wrong）、36可信short touch rows、兩種200%CSS reflow拓撲。全部flows true、mouse100、`errors=[]`；smoke的常規全owner `gestures` 為空，並未冒稱本審核自己跑了Root完整版。

另外獨立開 source／實際ZIP Chrome targets，在390×600、320×499、390×467、320×225四種 normal／cutoff／compact／short viewport，以合法 D／t₁ finished fixture經production restore、可信mouse開reference，再於reduced-motion播放逐驗0／0.20／0.40秒、0／1／2 exposure、所選case／time及submitted資料不變，共24 rows，exit0。`reduced-reference-cutoff.json`保存模型時間、實際球心、native label／ball bounds；保守再將球bounds擴1.1px亦與P文字交集0。此專用run的24張step截圖與still圖，已實際查看兩路的normal／cutoff首曝光、compact二次曝光及short首曝光；normal球體、軸名及P的字形清楚，compact標籤在margin且live不遮字。

獨立以AdmZip逐byte核對實際ZIP全部14 entries、36,628 bytes，含root manifest、config、9個活動runtime與3個shared；`zip-parity.json`保存每檔bytes／SHA256，source parity全部true。HTML的11個本地runtime refs均在manifest，Scope含animation。本審核只更新此報告與ignored診斷產物，沒有改production／tests／plan或提交commit，亦未跑whole-repo `npm test`／`package:all`。

### Root執行、本審核檢讀的 d89 補充完整矩陣

Root完成 `output/playwright/motion-composition-stroboscopic-lab/point-label-final/report.json`，exit0。本審核直接讀raw JSON：Chrome155.0.8059.27、`errors=[]`；兩路各13 viewport／40 playback／56 short label／36 short touch／兩reflow，全部flows true、mouse100。source-390、source-320、package-390、package-320四組常規trusted touch各43 rows。逐組獨立檢讀並再斷言16case/slot兩入口共32個drag都有before／during／after／preview，trustedTouch至少增加1，document、stage、host及panel不被drag捲動，preview pointer-intercept='none'。另記8多指、4cancel／lost-capture／resize／outside及15host strip／background／panel各端／lockedpan rows；review／frozen／committed均有原生owner metrics。

Root的 `point-label-final/package-parity.json` 指向同一d89，14 entries／11 runtime refs、manifestEntriesMatch及allEntrySourceBytesMatch=true，ZIP36,628 bytes／SHA256 `b39f17b68229b5fae51e67e2ed394d1d516398eb47b4efb2e9140bb58d6fbd38`。Root亦完成 `npm run package:all` exit0；本審核讀其 `output/motion-composition-progressive-package-all.log`，活動ZIP列14 files且末行為全部SCORM packages verified。這些是Root執行、本審核檢讀的補證，沒有冒稱自己再跑常規全owner或whole-repo包裝。

## c32c470 的歷史實際執行與證據來源

### 本審核獨立執行於 c32c470

以下命令均退出碼0；六套Node於951亦曾完成，c32再全部重跑：

```text
node sim/motion-composition-stroboscopic-lab/model.test.js
node sim/motion-composition-stroboscopic-lab/animation.test.js
node sim/motion-composition-stroboscopic-lab/scoring.test.js
node sim/motion-composition-stroboscopic-lab/persistence.test.js
node sim/motion-composition-stroboscopic-lab/lifecycle.test.js
node sim/motion-composition-stroboscopic-lab/scene.test.js
npm run check
git diff --check origin/main...HEAD
MOTION_ARTIFACT_SUFFIX=progressive-final-recheck-1 node tools/motion-composition-browser-regression.js --smoke
```

`progressive-final-recheck-1/smoke-report.json`使用Chrome155.0.8059.27／CDP，runner重新建包、啟動實際解壓ZIP。兩路各13 viewport（原10加320×499、390×501、390×467），各208 edit及208合法restored-reference圖，reference每viewport確有四case×四slot。各5個逐次曝光場景（四題normal＋B reduced-motion，並驗中斷恢復續作）、40個capture／reference播放readability rows（每row起點與首曝光）、36 short gesture rows、兩個200%CSS reflow拓撲與全部flows。滿分100、blank／partial、pending retry、Moodle-like review restore、Standalone刷新、非目前slot鍵盤／面板、比較工具及resize／replay均true，`errors=[]`。

本審核另外以保存的raw native資料獨立分析，軸名／球面及所有文字／停泊抓手與其內容交集各0；摘要與closure樣本為`review-closure.json`。這個sphere集合不包含reference答案球，所以R1-04專用反例另列。原生14px文字／球面高光／下標／44px入口、修正後source／ZIP手機parking、short兩拓撲capture／reference首曝光、t₄ reference、strobe0／2／4及preview畫面均已實際查看。

當時獨立以AdmZip逐byte核對 c32 ZIP所有14 entries（包括root `imsmanifest.xml`、config、animation與全部活動／共享依賴），35,619 bytes；`zip-parity.json`保存每檔bytes與SHA256，全部source parity=true。c32相對951只改plan／browser tests，production相同；沒有因此略過該輪完整branch／六套測試／source與ZIP的獨立驗證。此節全部結果為 c32 歷史證據，不作 d89 的當輪執行宣稱。

`MOTION_ARTIFACT_SUFFIX=progressive-recheck-1 ... --smoke`在951發現hidden target覆蓋缺口後依Root指示中止，exit130。該部分產物屬歷史，不作目前smoke pass；正式完成證據只用本節c32的完整run。

### Root執行、本審核檢讀的 c32 補充矩陣

Root完成`output/playwright/motion-composition-stroboscopic-lab/progressive-final-verified/report.json`，exit0；本審核直接讀取該JSON，Chrome155.0.8059.27，`errors=[]`。source／ZIP各13普通viewport、40 playback rows、36 short rows；source-390／source-320／package-390／package-320四個常規owner矩陣各43 rows，含16case/slot兩入口、8多指、4取消及15host／panel／locked pan rows。每一兩抓手有before／during／after、trusted touch、preview及owner／非ownermetrics，首row兩入口trustedTouch都增加1；全部flows true、mouse100。

這是Root執行、本審核檢讀的補證，沒有冒稱本審核再跑常規全owner版。此結果可支持c32的手勢／scoring／state覆蓋；其舊 `Pᵢ` 守衛同樣沒有驗R1-04，不能因此關閉新反例。依指示沒有跑whole-repo `npm test` 或`package:all`。

## 首輪 d24b791 的歷史執行證據

### 本審核獨立執行

以下命令均退出碼0：

```text
node sim/motion-composition-stroboscopic-lab/model.test.js
node sim/motion-composition-stroboscopic-lab/animation.test.js
node sim/motion-composition-stroboscopic-lab/scoring.test.js
node sim/motion-composition-stroboscopic-lab/persistence.test.js
node sim/motion-composition-stroboscopic-lab/lifecycle.test.js
node sim/motion-composition-stroboscopic-lab/scene.test.js
npm run check
git diff --check origin/main...HEAD
MOTION_ARTIFACT_SUFFIX=progressive-review-1 node tools/motion-composition-browser-regression.js --smoke
```

Browser使用Chrome 155／CDP，經授權使用本機Chrome及localhost；runner重新建包並啟動實際解壓ZIP。`progressive-review-1/smoke-report.json`：source／package各10組普通viewport、各5個逐次曝光場景（四情境正常＋B reduced-motion）、各36個short gesture rows、兩個reflow拓撲與全部flows，`errors=[]`。普通viewport含320×500、390×500／600／844、768×900、1024×768、1280×900、740×360、320×400、640×450；另320×225為CSS reflow／短layout。

獨立以AdmZip讀取實際生成 `output/motion-composition-stroboscopic-lab-scorm.zip`：35,551 bytes、14 entries，root `imsmanifest.xml`、config、所有runtime和共享依賴逐byte與候選source一致。HTML所有script／style依賴與manifest完整匹配。

實際看過source及package曝光0／2／4、四情境手機及桌面、間距比較、reference、短iframe preview、200% reflow提交畫面，以及上述正常／診斷hidden對比圖。兩個finding的專用target均退出碼0，沒有只依賴測試的「通過」文字。

### Root執行、本審核檢讀的補充矩陣

Root提供並確認同一 `d24b791` 的完整 `output/playwright/motion-composition-stroboscopic-lab/progressive-final/report.json`；本審核直接檢讀該JSON。`errors=[]`，source／package普通viewports各10、曝光各5場景、short各36 rows；source-390、source-320、package-390、package-320四組常規gesture各43 rows。涵蓋全部case／slot、兩抓手、預覽及放手、multi-touch四種第二指入口、cancel／lost capture／resize／圖外取消、左右strip／背景上下pan、panel中段及兩端、review／frozen／committed舊target區域pan，均記錄owner與非owner。

這是補充的執行證據，沒有冒稱本審核另外跑了完整版。依Root指示沒有重跑whole-repo `npm test` 或 `package:all`；既有全repo歷史結果依計劃標為歷史，不作修訂版獨立執行證據。

## 尚未完成的外部gate

本次沒有真實Moodle學生帳戶、實體手機或Moodle current-window／new-window玩家的驗收。真實host拓撲、工具列／native picker／裝置zoom、實際SCORM分數與status、離開再入／新attempt、實體touch與preview仍屬外部Moodle-ready gate。local fake-LMS、CDP trusted touch與本機emulation不代表該gate通過。

目前8a的R1-01／R1-02／R1-03／R1-04（PF05）維持關閉；Root追加的PF06／R1-05已修正並完成獨立再驗，未發現新問題。三份完整獨立報告仍由第四位彙整；本報告的本機證據不代表未執行的外部Moodle-ready gate已完成。沒有提交或修改其他tracked檔案。
