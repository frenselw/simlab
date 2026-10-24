# 火箭模擬初版：審核及跟進報告

日期：2026-10-25。審核基線：`3fc12d9`，當時部署的功能版本為 `8210d29`。本活動讓學生裝配、試飛、入軌及實際執行變軌；預期負載是單一學生使用手機或桌面，不涉及多人共用狀態。

使用者要求兩個獨立subagents審核並跟進。互動／狀態代理完整追查main、interaction、model、orbit、ui-runtime、persistence、scoring及相關測試；場景／效能代理追查scene、scene-art、HTML/CSS、manifest、呼叫者及既有browser owner。主代理合併重複問題、覆核證據，統一修改及驗證。以下只列能具體重現的問題。初輪四項，修正覆核再確認一項圖層問題，共五項。

**結果：** 兩個代理共確認1項P1及4項P2，五項均已修正並通過覆核。六個Node套件、94個source／ZIP流程及20個排版檢查通過。

## 確認問題

| 編號 | 優先度 | 問題 | 跟進狀態 |
| --- | --- | --- | --- |
| R1 | P1，先修 | 短逆向節點燃燒反而加速 | 已修正及驗證 |
| R2 | P2 | 長等待預覽截斷，誤報上次燃燒數據 | 已修正及驗證 |
| R3 | P2 | 遠離發射場後的低空跟隨缺少地球 | 已修正及驗證 |
| R4 | P2 | 動態視窗／螢幕DPR上限沒有更新 | 已修正及驗證 |
| R5 | P2 | 跟隨視角星點穿透地球表面 | 已修正及驗證 |

### R1：短逆向變軌反而加速

- **原本用途：** 學生選沿速度或反速度方向，系統協助定向並在節點點火。相關函數為[model.js的beginBurn／advance／step](../sim/rocket-space-mission-lab/model.js)，基線第27、31及17行；原計劃明訂自動定向，12°/s是手動俯仰限制。
- **觸發及證據：** 練習飛船 → 自由位置選當前位置 → 逆向65m/s → 執行。純production API及有效codec狀態的Node重現：初速7729.891847m/s，完成後7793.847164m/s，遠地點由300km升至525.625km。不是手動注入不合法狀態。
- **原因及影響：** 只切換controls.mode就立即點火，約1.53秒燃燒先完成，姿態仍未用12°/s轉身；結果與逆向減速的教學相反。舊快照若已在burning，單改beginBurn亦不會修好續做。
- **最小修法：** B的自動燃燒每個積分步先對準選定速度方向，涵蓋新燃燒及active burn還原；A的手動限速及已保留紀錄不變。測三個載荷、逆向及錯向順行、能量／角動量、preview與actual、active burn codec續做。

### R2：長等待的預覽顯示舊結果

- **原本用途：** [model.js的preview](../sim/rocket-space-mission-lab/model.js)應預估本次完整節點燃燒，[main.js的updatePreview](../sim/rocket-space-mission-lab/main.js)直接把結果顯示給學生。基線第90及44行。
- **觸發及證據：** 練習飛船當前位置先順行2000m/s，完成後選近地點，再規劃100m/s。有效production操作鏈等待20217.578秒；preview只走到20000秒、仍未點火，卻顯示上次的2000m/s。實際完整執行新燃燒為100m/s。另有效19000km圓軌道等待38541.974秒亦被截斷。
- **原因及影響：** 每輪固定加100而非累計真實積分步，預覽有隱含20000秒截斷；未確認新burn已發生，直接取舊burn。學生因此看到錯誤變速量及軌道，甚至被誤導為燃料不足。
- **最小修法：** 複製後清除舊burn，以實際step budget推進至新燃燒終態；遇模型時間／計算上限而未完成則返回不可預估，不顯示舊軌道或燃料不足結論。驗證第二次燃燒、高軌道長等待及模型邊界。

### R3：低空遠離發射場後沒有地球

- **原本用途：** [scene.js的draw](../sim/rocket-space-mission-lab/scene.js)，基線第28及41行，以發射場附近詳細地形取代近景全球底圖，減少重複繪圖。
- **觸發及證據：** 練習飛船 → 自由位置π/4 → 逆向65m/s → 執行及繼續飛行。純production序列到t2699秒、高度109930.02m、地心角−3.119683；跟隨畫面只餘火箭、星點及背景。地球visible=false，詳細地形仍在遠方發射點。截圖／數據保存在ignored `output/audit-scene-low-downrange.png`及`output/audit-scene-report.json`。
- **原因及影響：** 地球是否顯示只看120km高度，沒有檢查火箭是否仍在固定半徑的發射場地形上；合法降軌時看不到接近的地面。
- **最小修法：** 只在確知當地詳細地形足以覆蓋的近發射區省略底圖，遠離後保留地球；檢查實際降軌、不同地心角、鏡頭與繪圖上限。

### R4：動態視窗與螢幕比例沒有更新畫質上限

- **原本用途：** [scene.js的constructor／resize](../sim/rocket-space-mission-lab/scene.js)，基線第7及16行，限制手機pixel ratio為1.5、桌面2，避免過多繪製像素。
- **觸發及證據：** DPR3的1280×800開啟後，不reload縮到390×844。ratio維持2，canvas780×800；應為ratio1.5、約585×600。獨立CDP報告的dprResize記錄已確認。修正覆核再測得：CSS尺寸維持1280但DPR3→1時亦停留ratio2，因ResizeObserver沒有CSS變更可觀察。
- **原因及影響：** 上限只在constructor設定，resize只更新大小。手機布局像素量比既定上限多約78%，增加GPU負載；原測試每次重開頁面所以漏掉。
- **最小修法：** resize按當前viewport及DPR重算上限，在既有RAF比較快取DPR數值，變更才resize以處理DPR-only事件（實測resolution change事件沒有可靠觸發）；補不reload往返大小及DPR變化測試，確認不改答案、暫停狀態及鏡頭。

### R5：星點透過地球表面

- **原本用途：** follow的地球是背景，詳細發射地形負責depth，星點按高度漸現；相關[scene.js的draw](../sim/rocket-space-mission-lab/scene.js)。
- **觸發及證據：** R3合法降軌後的多視角截圖，地表有白色星點。隱藏stars後白點同步消失，獨立代理確認不是NASA圖上的地表亮點；證據為ignored `output/audit-scene-fixed-low-downrange-2.9.png`及no-stars對照。高於120km的follow原本已可達，R3亦令低空遠距可見。
- **原因及影響：** earth.material.depthWrite=false，透明stars在它之後繪製，沒有球面depth可遮蔽；星點穿過地球，削弱畫面正確性。
- **最小修法：** 星點shader依地球世界座標及半徑，遮蔽被球面擋住的方向；不改原星點漸現／近景地形深度，也不增加球面或繪圖次數。以實際GPU像素比較stars開／關，在球面內結果應一致，另驗shader runnable及原效能上限。

## 初步結論與驗證範圍

先修R1，再修R2–R5。未找到新的裝配丟件、提交／重試／唯讀或資產交付問題；這不等於已證明沒有其他bug。互動代理已跑現有六個Node測試及100組燃燒中間狀態codec驗證，原測試仍全綠，顯示上述邊界確實缺測。

本輪保留修前重現與修後結果，已執行完整source及extracted SCORM browser owner；網站發佈紀錄見下方。無rubric、權威snapshot欄位、schema或共享SCORM改動；地球視覺自轉的既有物理簡化仍然保留。

未驗證真手機持續幀率、真Moodle及本輪未改動的獨立T1–T3 scroll矩陣。報告與修正不代表Moodle-ready或真手機性能驗收。


## 修正後結果

五項已確認問題均已修正。兩個原審核代理再次只讀覆核：互動代理關閉R1／R2，場景代理關閉R3／R4／R5，沒有留下本輪已確認而未處理的bug。這不是「沒有其他bug」的保證。

- **R1：** 三載荷的短逆向燃燒均降低能量及角動量；順行／逆行切換正確，A手動12°/s保持。保留一份P18真實active retrograde快照，production codec還原後正確續做，再儲存／還原／完成。互動代理另驗0.001／0.1／1／10s步長及燃燒中跨模型邊界。
- **R2：** 先順行2000m/s再等待逾20000s的新100m/s，preview與actual新結果一致，沒有取用上次burn；另測19000km圓軌道逾38000s等待。不可在模型時間範圍內完成時，preview為null並明示「未能完成」，不改原state、不誤報燃料不足。
- **R3：** 合法降軌至地球另一側、高度約109.9km的桌面及手機跟隨已顯示地球。代理另外檢視五組視角，對照隱藏遠方launch terrain前後，沒有地形穿透或額外遮擋。
- **R4：** 不reload往返桌面／手機及DPR-only變化，依序ratio1.5→2→1→2→1.5；真實canvas尺寸對應585×600、1884×1494、942×747等。DPR3→1時resolution media query值會改但change事件實測未可靠觸發，已刪除該無效watcher。採既有RAF比較一個快取DPR數值、變更才resize，沒有每幀DOM尺寸輪詢。獨立代理另驗paused快照完全不變，playing保持running且t前進。
- **R5：** 桌面／手機在球面內原星點位置的GPU像素，stars開／關完全一致；shader均runnable。獨立全圖對照球面內0像素差異、天空仍有42像素差異，證明星空保留、只遮住穿透部分；context lost／restore後畫面、shader及state正常。沒有新增mesh或draw call。

R1同一variant1重現修後：速率7729.891847→7664.893453m/s，實際變速量65.000000m/s；修前為7729.891847→7793.847164m/s。

## 已執行驗證

- 六個活動Node套件全過；新增逆向及舊燃燒續做測試已先在修前失敗，再在修後通過。
- 最終source及extracted SCORM合共94 flows、20 layouts，completed=true、errors=[]；manifest每個檔案逐byte比對相同。新增auditFixes覆蓋桌面／手機UI、舊快照續做／reload、長等待／模型邊界、合法低空遠距地面、星點GPU遮蔽、live resize及DPR-only。
- 原裝配／中間插入／分離器、手機捲動／桌面整卡、飛行不中斷控制／鏡頭、向量／全速率及兩級燃料、任務／評分／提交重試／恢復／唯讀、全屏及WebGL故障回歸通過。
- npm run check、check:tests（278 entries）、本報告及計劃的文件檢查、diff檢查通過。沿用existing registered owner，沒有新增漏註冊測試。
- runtime SHA-256：`b4fa613a935560a1e3840f4ff74eddb62505b7764caece30dc4b76274700732a`。ZIP SHA-256：`ab621f5cb5d857116837ab0251c0943b9e47811e0454dd8113d4fc2533678e76`；ZIP 680689 bytes。
- 正式報告／截圖：ignored `output/playwright/rocket-space-mission-lab/report.json`及相鄰`*-audit-*`圖片。兩代理獨立證據：`output/audit-scene-report.json`、`audit-scene-close-report.json`、`audit-scene-state-report.json`及相應圖片；不把較早未完成或固定時間等待失敗的報告當最終證據。

**結論：** 初版可繼續試用，已完成本輪五項除錯；真手機持續幀率、真Moodle及未改動的獨立T1–T3 scroll矩陣仍未在本輪驗證。
