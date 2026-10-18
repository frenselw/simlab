# 平拋運動：軌跡量度與擬合實驗

狀態：**2026-10-18 計劃稿；已按使用者追加要求加入逐點估速、全組平均及約±1%投球差異，尚未實作。** 初稿的兩份獨立審查為歷史紀錄，未代表本次追加規格已重新雙人審查。

- 分支：`codex/horizontal-projectile-lab`。
- 起點：本機 `main`，`f7ab989ca59b72ebe6a7691129320c4768f6fcf8`；未宣稱已同步遠端。
- 由[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)複製及填寫；遵循[共用風格](00-shared-platform-and-style.md)與[製作指南](../docs/simulation-scorm-production-guide.md)。
- 使用者指定：固定高度放鋼珠、水平出口、上下移動接球槽、覆印紙留痕、用尺量度 x／y、逐點求初速度再求平均、約1%的輕微實驗差異、研究分運動、畫軌跡及二次函數擬合。
- 本稿首版建議：六個取樣位置、形成性評分，以及後段揭示每次投球的獨立計時。這些仍是設計預設；逐點估速、平均及輕微差異已由使用者明確要求。

## 建議的學生體驗

1. **設置與取點**：直接進入實驗裝置。學生上下拖動接球槽，按「釋放鋼珠」；球由斜槽同一標記靜止釋放，經水平出口飛出、撞槽留下接觸痕跡。模擬再將該印記按球心基準轉記至共同記錄紙，呈現為一個固定的深色小圓點 P₁；以短提示「將本次印記轉記到記錄紙」說明這是模擬提供的轉記功能。每次只留下撞擊的一點，投球階段不自動畫出完整軌跡。
2. **重複實驗**：改變槽高，最多記錄六點。舊印記不隨槽移動；可以選一個點重做。每次投球的出口速率圍繞同一參考值約±1%波動，同高重做可見輕微落點散布，並非每次完全重疊。提示分散高低取點，不代學生安排正確位置。
3. **量度**：記錄紙近景以出口球心 O 為原點，向右為 x、向下為 y。拖動水平／豎直直尺，量度O至每個圓點中心的水平距離x及向下距離y，填入表格；紙上的投影輔助線只協助對齊，不直接顯示正確數值。
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
| Learner task / main interactions | 調槽、投球、六點記錄、拖尺／換向、讀數輸入、描點、擬合、估速、計時對照及提交 |
| Shared subject core / activity outer layer | 本活動擁有平拋模型、答案、rubric、保存；重用既有純數學擬合，不建立通用實驗編輯器 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JS、SVG、Pointer Events；`index.html`、`styles.css`、`main.js`、`model.js`、`scoring.js`、`persistence.js`；依賴下表共用檔，不加 runtime library |
| Assessment risk / trusted validation | `formative`，100 分、60 分達標；瀏覽器端評分不防竄改。本版不作高風險考試，server validation N/A，不包含秘密 |
| Out of scope | 斜拋、可變 g／釋放高度、飛行阻力、反彈、自轉顯示、隨機題庫、額外座標／計時噪聲、完整不確定度傳播、跨 attempt 歷史、匯出及另一套教師工作台；本版只加入下述約±1%出口速率波動 |

「畫軌跡」採學生**親自描點＋折線觀察＋擬合曲線**，不另建自由筆畫評分；沒有一鍵代放正確點。

### 實作接觸範圍

| 路徑 | 計劃改動／依賴 |
|---|---|
| `sim/horizontal-projectile-lab/` | 上述六個 runtime 檔及 model／scoring／persistence／lifecycle 測試 |
| `sim/shared/styles.css`、`scorm.js`、`activity-flow.js`、`fullscreen.js` | 現成依賴，沿用 API／樣式 |
| `sim/newtons-second-law-investigation-lab/fitting.js` | 直接相對載入 `NewtonFitting.fit/predict`；已有直線、二次、過原點擬合。平方模型將 x 轉成 x² 再用 `origin`，不複製 QR 解法或搬動原 callers |
| `sim/config.js`、`sim/manifests/horizontal-projectile-lab.xml` | 實作時新增 metadata／全部 runtime 資產；本次只在文件記錄 |
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
  status: "planned"
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
| Desktop / tablet | ≥900 CSS px 並排，panel 20–24rem；較窄直向上下排列 |
| Control-panel classification | `bounded split-panel`，拖尺、作圖、填表需要同時看見舞台 |
| Phone stage and controls | 舞台約44dvh，按header及可用高度調整；panel至少96px且可到最後控制；短橫向可雙欄，不能縮字或增加舞台scroller |
| Phone text | 主文／控制16px，次要／圖標至少14px實際顯示；細尺刻度透過4–8倍預覽辨識 |
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
| measure | 該slot有撞槽記錄 | 無點留空；x／y可各自未答 | 拖尺、輸入、返回／下一步、check |
| plot | 該點兩讀數都非空才可放點 | 不補缺數，不修錯點 | 放／拖點、擬合、返回／下一步、check |
| speed | 每個記錄slot對應自己的tᵢ／v₀ᵢ，需該點讀數完整；平均需至少兩個已填速度 | y=0合法但不可反算；缺依賴不製造答案，不可挑選性排除已填速度 | 逐行填t、v，再填全組平均／擬合估速，或check |
| motion | 揭示記錄後才有時間圖；各擬合需足夠秩 | 無／少資料留空；概念題仍可答 | 顯示時間、查看圖、填g／答題、check |
| check | 不需完成任何步 | 空白／部分同樣合法 | 返回指定view或明確submit |

## Diagrams, notation and assistance

Apply [diagrams/notation](00-shared-platform-and-style.md#diagrams-and-notation), [snapping](00-shared-platform-and-style.md#snapping) and [touch preview](00-shared-platform-and-style.md#touch-preview).

| Decision | Activity specification and reason |
|---|---|
| Notation | x、y、t、g、v₀為約定方向的標量；cm表格、SI公式；k／A／α避免與加速度a混淆；共用math字體、斜體變量、正體單位、真正上下標 |
| Arrow graphics | x向右、y向下軸箭頭，O在出口球心；無學生矢量作圖。若有出口箭頭只表方向、不顯示未知速度大小 |
| Snap | 槽5mm步距；尺可對齊可見O／所選印記投影；圖點只吸公開1cm格。mouse8px、touch/pen12px CSS門檻，不吸答案／理想軌跡；與評分容差分開 |
| Snap release | mouse移3px、touch/pen6px才開始拖，輕觸保留原值；離目標超過進入門檻1.5倍才解除；預覽與放手同一幾何 |
| Touch preview | 尺零線／讀數、圖點會被手指遮住，需角落約128×112px、4–8倍真實局部放大；不顯答案、不攔輸入。粗調槽及按鈕無精細遮蔽，不需預覽 |

尺以按鈕切水平／豎直，不加任意旋轉；預覽在release、cancel、lost capture、blur、導航及鎖定時清除，拖動相機固定。

## Touch gesture ownership contract

依[完整手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)驗收；以下selector為實作約定，像素及owner尚未實測。

| Target type / modes | Visible footprint, selector, hit area/halo and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 接球槽／collect | `#catcherHandle`，槽側44×44px HTML握柄，不覆蓋整槽／背景 | 持續掛載，`touch-action:none` | 方向鍵5mm、Shift25mm，面板±按鈕 |
| 水平／豎直尺／measure | `#rulerHandle`，44×44px局部握柄；尺其餘部分讓host捲 | 持續掛載，`none` | 方向鍵1mm、Shift10mm；換向按鈕 |
| 新／舊圖點／plot | `[data-point-slot]`，可見10px點、局部44×44px hit；相近點可面板選P編號 | 持續掛載HTML目標，`none` | 「放置此點」在可見中央起始，再方向鍵1cm、Shift1mm；也可數字微調同一圖域 |
| 首次點選放點／plot | `#plotInputSurface`，只在「放置所選點」模式開啟中央有邊界圖域，放下即退出 | 固定面，操作前已有`none` | 同上；不是自動放到量度答案 |
| 按鈕／讀數／選項 | 原生control，≥44px，面板適合小數的輸入鍵盤 | 原生操作；panel `pan-y`，不全域鎖host | Tab／Enter／原生輸入 |

雖然沒有自由筆畫，放點模式仍擁有中央表面，故兩側各留**至少32 CSS px**可用捲動條（320px寬時各32px）；預覽、點halo及透明overlay不可侵入。

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 非互動裝置／紙面／圖空白 | Enclosing host | `pan-y`；沒有整面不可見攔截 | 待測 |
| panel文字／按鈕／頂中底 | Panel only，包括邊界 | 原生overflow、contain；不改host style／scroll | 待測 |
| 中央圖域，僅放點模式 | Simulation | 只操作所選slot，有明示邊界 | 待測 |
| 圖空白，非放點／check／review | Enclosing host | overlay關閉，局部合法hit以外可捲 | 待測 |
| 左捲動條 | Enclosing host | ≥32px及足夠高度，每模式均可達 | 待測 |
| 右捲動條 | Enclosing host | ≥32px及足夠高度，每模式均可達 | 待測 |
| 槽、尺、圖點各握柄 | Simulation | 只有目標改變；scroll、viewport、iframe位置不變 | 待測 |

先驗原生路徑及有界document；若不通，辨認真正owner並依指南驗證必要adapter，不盲目寫parent/top捲動或發送無receiver訊息。來源及解壓套件都留trusted touch、engine、逐move/release、非owner不動、canonical state及runner非零失敗退出證據。

| Host case | Frame chain and actual owner selector/window | Origin/sandbox / native path or verified adapter | Source/extracted evidence; deployment/device evidence separately |
|---|---|---|---|
| T0 standalone | 直接頁面有界，panel自捲 | 真正無外層range才可將host movement記N/A | 待source/package |
| T1 direct iframe | 外document → 活動iframe；owner外document.scrollingElement | same-origin中性host，無隱藏轉交 | 待兩種來源 |
| T2 nested player | 外document → 不捲wrapper → 活動；owner外document | wrapper不能當owner | 待兩種來源 |
| T3 overflowing element | 有界外window → `#scrollOwner`溢出元素 → wrapper／活動 | 只元素動、所有window不動 | 待兩種來源 |
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
| 計算number域 | t=0–10s；v、meanV、fitV為有限非負m/s數字，gFromClock為可正可負的有限m/s²數字；結果欄不設100或其他任意幅值上限。一般小數輸入最多3位，亦接受等價有限科學記數法。0是合法錯答，不是未答；非有限運算顯示無法計算，不截斷或偽造答案 |
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

- [ ] 鋼珠理想滾動上限、v參考及±1%速率邊界、vy(0)=0、各深度碰撞、球心／槽面差、cm/mm/m、動畫跨幀及慢放不改時鐘。
- [ ] 偏移只在每次釋放抽一次；以可注入的測試random驗最小／中央／最大及非有限／越界拒絕。相同depth配不同offset有預期水平散布，最大速率不超理想能量上限；每次飛行vx固定、時鐘和y不受速率波動影響。
- [ ] 每個有偏移的記錄production round-trip後動畫重播／印記／真值／分數完全相同，restore、重繪、擬合、retry不抽random；新投球／重做才換偏移，舊點不變；量度完全對準帶差異印記不得被扣讀數分。
- [ ] 純數學已知y=1.75x²的三種擬合，以及新v參考／含微散布資料的代表曲線；錯點、最少點、重複x、退化、全y相同、零／負k、非有限數。含誤差不要求零RMSE；不能把少點精確插值當證明。
- [ ] 改學生y只改推算時間／擬合、不改clockMs；改深度影響新觀測。未揭示不顯時間，揭示但零資料仍合法。
- [ ] 滿分／untouched／單讀數／單概念、取樣跨度、duplicates、容差邊界、follow-through及所有依賴修改／清除。
- [ ] 六行逐點計算的空白／單行／2–5行／六行狀態，平均的n及納入編號正確；包含0／錯值、不排離群值，未填不補0。平均運算分對全部已填v，準確度分對同組真實vᵢ平均；部分提交只失未答項。
- [ ] 已答meanV後新增／改／清一行v、改／清t、改read及重做已有速度的印記，原子清相依meanV，production round-trip後可再填並提交；其他行保留。僅新增尚未計速的印記，不清仍有效的舊平均。
- [ ] 零觀測前進motion、揭示時鐘並答概念／前進plot嘗試資料不足擬合，再返回collect；production round-trip後釋放第一球，獨立概念答案與合法操作仍保留。
- [ ] 派生答案域：x=500mm、所填t=0.001s可填v=500m/s；square點(1,1)、(1000,0)mm可填約70000m/s；α<0時可填同樣為負值的2α、正確換算得部分分而真值分為0；很大正／負g亦不截斷。每例均涵蓋輸入、scoring、保存及恢復，非有限值另拒絕。
- [ ] 正式UI走完取點→量度→描點→擬合→估速→計時→提交，並測重做／reset取消及確認；source與真實ZIP同樣執行。

- [ ] Scoring covers blank/partial answers, component independence, extras, penalties and tolerance boundaries.
- [ ] Every editable phase can reach final check and submit blank/partial work; scored/pending states have no erase/restart route.
- [ ] Production encode/decode/restore round-trip covers **every** matrix row with production-shaped fixtures, equal score and execution of one legal continuation.
- [ ] Invalid matrix combinations, numbers, enums, dependencies and authoritative keys fail closed; derived IDs rebuild; version policy and 4000-byte ceiling are tested.
- [ ] Production startup/submission/render logic covers all outcomes above, invalid finished review, pending retry and trust mismatch/unknown status; source checks alone are insufficient.
- [ ] Source and extracted SCORM standalone refresh clears partial/check/submitted work and permits redraw/submission, including old draft/review/pending/corrupt checkpoints and denied browser storage; separate Moodle cases retain same-attempt work.
- [ ] Phone typography, arrow/label geometry, snap and required previews work in the planned viewport/zoom matrix.
- [ ] Shared fullscreen button enters/exits with trusted click/tap on source and extracted SCORM, synchronizes external exits, remains reachable in review/pending, preserves answers/SCORM state, and visibly handles unsupported/denied requests; header text/navigation stay unobstructed.
- [ ] Every phase/mode's applicable gesture rows pass with trusted input on **source and extracted SCORM** in T0–T3; record every owner's metrics, move/release samples, visual blank/overlay geometry, panel boundaries and unchanged learner work. Missing or failed acceptance cases fail the runner.
- [ ] Every new test and browser owner is registered in `tools/test-registry.js`; runtime dependencies are in the manifest or registered standalone asset list, and metadata is in `sim/config.js`.

### Test registration and CI selection evidence

Follow the production guide's [registration procedure](../docs/simulation-scorm-production-guide.md#test-registration-for-new-simulations); record this activity's decisions and actual evidence here.

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | `sim/manifests/horizontal-projectile-lab.xml`列六活動檔、四shared檔及既有fitting.js；若實際HTML引用config或其他資產亦明列 |
| Logical test entries | `sim/horizontal-projectile-lab/model.test.js`、`scoring.test.js`、`persistence.test.js`、`lifecycle.test.js`；kind=node，scope繼承slug，涵蓋上述非平凡邏輯 |
| Browser entries / owner | `{file:'tools/horizontal-projectile-browser-regression.js',kind:'browser',scope:'horizontal-projectile-lab'}`；一入口含source/package，無args變體 |
| Case helpers | 先擴充上述現有mobile-scroll helpers；若實作確需新`*-browser-cases.js`，登記literal consumer及scope，不把helper冒充已跑test |
| Separate manual gates | 保留既有mobile-scroll-browser-regression manual gate及理由，加入活動profiles／operations；完整T0–T3不能由CI省略，T4另外記真實證據 |
| Registration check | 本次文件階段證據在文末；實作新registry後須重新跑`npm run check:tests` |
| CI selection preview | 實作commit後記實際base/head、`npm run test:affected -- --base=<sha> --head=<sha> --plan`結果及browser/packages；registry/catalogue新增預期full coverage |
| Actual GitHub verification | 未執行、無run link；實作首次registry/catalogue變更需要完整驗證，不把文件分支當活動CI通過 |

- [ ] Registration validation passes; every new formal entry/helper is accounted for, and any separate manual gate has a reason.
- [ ] The committed selection preview includes the owning browser suite and all asset consumers, or records the expected full scope for registry/catalogue/shared changes.
- [ ] Required source/package scenarios were executed; CI selection evidence does not replace real-phone or Moodle acceptance.

## 實作次序

1. 先完成物理／觀測與數據模型、每次固定約±1%偏移、三種軌跡擬合、六行估速與平均、獨立時鐘及rubric，驗已知數據、邊界及部分分。
2. 打通取點、近景直尺、描點、估速及計時對照的完整桌面／窄屏主線，再調整標籤及精細操作。
3. 依schema／phase表接shared SCORM，完成空白／部分提交、恢復、review／pending及依賴失效。
4. 完成鍵盤、預覽、fullscreen、host手勢；加入catalogue／manifest／registry，重測source及真實ZIP，記package-ready證據。
5. 於真實Moodle學生attempt及實體手機完成T4、成績／恢復／重試後，才宣稱Moodle-ready。

## Package-ready checklist

- [ ] Above decisions, state matrix and test evidence are complete; required keyboard alternatives work.
- [ ] Phone, tablet and desktop layouts, short iframe, toolbar/keyboard changes and 200% zoom preserve readable content and reachable actions.
- [ ] `npm run check`, `npm test` and `npm run package:all` pass; record commands, results and artifact paths.
- [ ] `git diff --check` and the PR diff against its actual base pass.
- [ ] ZIP has root `imsmanifest.xml`, every runtime asset is declared and no development-only files ship.
- [ ] Built/extracted launch smoke and the full applicable trusted-touch matrix pass; use the documented Git Bash route on Windows.
- [ ] Assessment risk and any trusted validation requirement are recorded.

## Moodle-ready checklist

- [ ] Package-ready gates pass; real Moodle student-account submission records score/status.
- [ ] Draft resume, pending retry, immutable scored review and LMS new-attempt policy work.
- [ ] T4 real-phone complete phase/mode gesture matrix passes in current-window and offered new-window Moodle players, including quick-flick/release behavior and actual window/element owner.
- Server-side validation：N/A，本版僅形成性評核，不作高風險用途。
- [ ] Moodle and physical-device evidence is recorded separately from local checks; list any unverified item explicitly.

## 本次計劃工作記錄

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
