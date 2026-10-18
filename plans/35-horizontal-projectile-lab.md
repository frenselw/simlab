# 平拋運動：軌跡量度與擬合實驗

狀態：**2026-10-18 計劃稿；尚未實作。** 本次只建立專用分支及計劃。

- 分支：`codex/horizontal-projectile-lab`。
- 起點：本機 `main`，`f7ab989ca59b72ebe6a7691129320c4768f6fcf8`；未宣稱已同步遠端。
- 由[新活動範本](NEW-SIMULATION-PLAN-TEMPLATE.md)複製及填寫；遵循[共用風格](00-shared-platform-and-style.md)與[製作指南](../docs/simulation-scorm-production-guide.md)。
- 使用者指定：固定高度放鋼珠、水平出口、上下移動接球槽、覆印紙留痕、用尺量度 x／y、求初速度、研究分運動、畫軌跡及二次函數擬合。
- 本稿首版建議：六個取樣位置、無額外隨機噪聲、形成性評分，以及後段揭示每次投球的獨立計時。這些是設計預設，並非使用者已逐項確認的要求。

## 建議的學生體驗

1. **設置與取點**：直接進入實驗裝置。學生上下拖動接球槽，按「釋放鋼珠」；球由斜槽同一標記靜止釋放，經水平出口飛出，撞槽後在共同記錄紙上留下 P₁。
2. **重複實驗**：改變槽高，最多記錄六點。舊印記不隨槽移動；可以選一個點重做。提示分散高低取點，不代學生安排正確位置。
3. **量度**：記錄紙近景以出口球心 O 為原點，向右為 x、向下為 y。拖動可切換水平／豎直的直尺，讀取並填寫各點座標；印記不直接顯示正確數值。
4. **作圖與擬合**：根據自己的表格逐點放到 x–y 圖，可顯示資料點折線，再比較一般直線及一般二次函數擬合。所有曲線只用學生已放置的點，不用理想答案修正錯點。
5. **估算初速度**：先明示「暫採用豎直自由落體模型」，選兩個不同印記算 t、v，再估計共同初速度；另用受限模型 y = kx² 的擬合係數估速。
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
| Out of scope | 斜拋、可變 g／釋放高度、阻力、反彈、自轉顯示、隨機題庫／噪聲、完整不確定度傳播、跨 attempt 歷史、匯出及另一套教師工作台 |

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
  description: "調整接球槽留下鋼珠印記，量度及描出軌跡，透過擬合與計時估算初速度並研究分運動。",
  tags: ["physics", "mechanics", "projectile-motion", "measurement", "curve-fitting", "scorm"],
  status: "planned"
}
```

folder 與活動／manifest slug 相同，可部署才登記 `active`。

## Physics or subject model

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 釋放 H／出口 v₀ | 理想實心球純滾動、無耗散：mgH = ½mv₀² + ½Iω²，I = 2mr²/5，v₀ = √(10gH/7) | m、m/s | H = 0.200m；g = 9.80m/s²；v₀ ≈ 1.67332m/s，參考速度提交後才揭示 |
| 飛行 x、y、t | 出口球心為 O，向右／下為正；x = v₀t，y = ½gt²，vx = v₀，vy = gt | m、s | 出口切線水平，vy(0)=0，無空氣阻力 |
| 接球深度 d | 球心到達 y=d 時記錄撞擊；一幀內跨過事件須解析定位／插值，不能用下一幀時間當讀數 | m | d=0.050–0.800m，5mm 步距，初始0.200m；未投球沒有觀測 |
| 球心及槽面 | 印記表示球心位置；槽承托面畫在碰撞球心平面下 r，痕跡按球心基準轉記到共同紙面 | m | r=0.010m；不能把槽表面高度當球心下落距離 |
| 計時器 | 記錄離軌至撞槽的飛行時鐘，不使用學生讀數反算 | s | 顯示到0.001s；斜槽時間不計；預設4倍慢放不改物理時間 |
| 量尺／讀數 | 面板 cm，最小輸入0.1cm；內部整數mm；主尺cm刻度，局部放大能辨1mm | cm、mm | 六個記錄，建議跨至少50cm；不加刷新即改變的噪聲 |
| 兩點估速 | 在自由落體假設下 t=√(2y/g)，v=x/t | SI | y≤0、t≤0 顯示無法計算，保留合法錯答 |
| 軌跡模型 | 探索 y=Ax²+Bx+C；物理受限模型 y=kx²，v₀=√(g/(2k)) | A、k：m⁻¹；B：無量綱；C：m | 理想k=1.75m⁻¹；受限模型須明示原點、水平初始切線及理想無阻力條件 |
| 計時對照 | x=ut+x₀；y=αt²+βt+γ；g估=2α | u、β：m/s；α：m/s²；x₀、γ：m | 顯示截距、一次項；不能先強制β=0再稱驗證初始豎直速度為零 |

斜槽表現鋼珠「滾動」，不使用無轉動滑塊的 √(2gH) 當真值。重複同條件會重現同一落點，量度／作圖誤差來自學生操作及儀器讀數精度。接球槽顯示位置與上／下微調，不直接顯示數字深度；深度、印記座標及預設值不能成為量度答案提示。

### 擬合與探究回饋

- 軌跡選項為 `linear`、`quadratic`、`square`，預設未選；先比較一般直線／二次，再介紹平方模型估速。
- 直線需兩個不同 x，二次需三個，平方亦需兩個且 ∑x⁴>0；提示六個分散點更有判斷力。低於要求或秩不足是數學失敗，仍可提交。
- 只用學生已放點；未放點不補，重複 x 不暗中刪除，錯點不修正。顯示方程、參與點數及 RMSE；二次參數較多，RMSE 較小本身不是充分物理證據，不以 R² 自動選答案。
- 平方 k>0 才可換算速度。一般二次的 B／C 需解讀，不能默認為零；曲線裁切於圖域。
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
| speed | 兩卡各選不同且讀數完整的slot | y=0合法但不可反算；缺依賴不製造答案 | 選點／填t、v、平均／擬合估速、check |
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
| speed空白／部分／可算／零讀數 | 恢復後選點／填值 | 只讀圖、表格、鍵盤及panel | 同上 |
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
| Extras / duplicates / penalties | 無負分；六slot上限，同高不刷取樣分；兩估速卡不能引用同slot；單選不准全選 |
| Tolerances | 全部對稱且含邊界，以物理量計；集中為常數，不混同CSS吸附，內部參考不先四捨五入 |

| Component | 分數 | 規則 |
|---|---:|---|
| 取樣 | 10 | 深度排序後與上一計分點至少20mm算新點，每點1分最多6；跨度≥500mm得4、250–499得2、其餘0 |
| 量度 | 24 | 六點每個x、y各2分，對照該次理想印記；另一方向錯不影響 |
| 作圖／軌跡 | 16 | 六點各x、y1分，對照學生自己的讀數（量錯但轉繪對仍有分）；軌跡選拋物線4分獨立 |
| 初速度 | 20 | 兩點各t計算2、v計算3，合10；平均估速5（運算2、接近真值3）；平方擬合估速5（由自己的k換算2、接近真值3） |
| 分運動 | 30 | 水平類型6、支持證據6、豎直類型6、支持證據6；由獨立時鐘二次擬合估g6（換算3、接近真值3） |

計算採follow-through：t對自己的y，v對自己的x及所填正t，平均對兩個所填v；擬合換算對自己的k／α。物理真值準確度另給分，不因上游錯將所有後續運算清零。缺真實依賴則只有該項0。

證據題問「哪種數據證據支持模型」：水平為x–t近直線且斜率穩定；豎直為y–t二次項對應g/2、一次項近零且出口水平。概念題可在資料不足時回答，不依完成數鎖住。平方換算須已成功square fit且k>0；g換算須已揭示時鐘且三個不同t的y讀數。

| Quantity / constant | 容差 | 內／外邊界例 |
|---|---|---|
| `READING_ABS_MM` | 對真實座標≤5mm | 差5通過、6不通過 |
| `PLOT_ABS_MM` | 對自己的讀數，各軸≤5mm | 讀300，點305通過、306不通過 |
| `CALC_TIME_ABS_S/REL` | ≤max(0.002s,2%×參考) | 參考0.200，0.204通過、0.205不通過 |
| `CALC_SPEED_ABS_MPS/REL` | ≤max(0.02m/s,2%×參考) | 參考1.50，1.53通過、1.54不通過 |
| `SPEED_TRUTH_REL` | 對隱藏v₀≤10% | 真值×1.100通過、×1.101不通過 |
| `G_CALC_ABS/REL` | 對自己的2α，≤max(0.10m/s²,2%×絕對參考) | 參考10，10.20通過、10.21不通過 |
| `G_TRUTH_REL` | 對9.80≤10% | 10.780通過、10.781不通過 |

## Phase/state matrix

Draft只有`edit`、`check`；五步由`view`表示。submitted／pending／committed／technical由shared lifecycle決定，不是可編輯draft phase。每列空白／部分／完整等變體以獨立fixture或參數化逐項覆蓋，check返回須與五個view交叉測。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| edit／全新、已調深度未投球 | collect | 六null slot、預設或已調setup | 無觀測及答案 | 釋放或check空白提交 |
| edit／部分、滿六點、待重做 | collect | 1–6記錄及下一slot／深度 | 保留其他已答內容；未撞槽不先刪舊點 | 調槽／釋放或check |
| edit／無點、未量、x-only、y-only、完整 | measure | selectedSlot合法或null | 缺讀數明確null，不強制未來答案空白 | 選點／讀數／回取點或check |
| edit／無可放點、未放、部分、完整 | plot | 每個point依賴完整read | 未擬合；錯點可保留 | 放點／回量度或check |
| edit／選模型未執行 | plot | model非null、attempted=false | points可空／部分 | 嘗試擬合或check |
| edit／擬合失敗 | plot | attempted=true；不足點／秩／退化 | 保存所有錯點，不存failure cache | 改點／換模型或check |
| edit／擬合成功 | plot | attempted=true且可重算 | 係數由點派生 | 改點／換模型或check |
| edit／估速空白、單卡、部分、全答、不可算 | speed | 卡引用完整read的不同slot或null | y=0／所填0仍合法 | 選點／填值／回量度或check |
| edit／計時未揭示 | motion | clockShown=false | gFromClock=null；概念可答 | 顯示時間／答題或check |
| edit／揭示，無資料／不足秩／可擬合 | motion | clockShown=true | 不補缺的read；保留已有答案 | 回量度／答題／填g或check |
| edit／check返回，套用以上每種invariant | 任一view | returnToCheck=true | 完整保留合法舊答案 | 改一次再返回check |
| check／空白、部分、完整 | 保留來源view | returnToCheck=false | 不要求任何上游完成 | edit指定view或submit |
| review／空白、部分、完整 | 只讀 | validated、rescored review | 無編輯／reset | 檢視圖／答案或fullscreen |
| frozen／validated | 等待頁 | canonical review及結果已驗證 | 未確認分數--，不透露解答 | shared同payload retry |
| committed | 已記錄頁 | 已commit未finish，同答案 | 鎖定 | shared finish retry |
| technical | 技術頁 | load-error或已quarantine不可信pending | 無捏造分數／重開 | 技術訊息、fullscreen；環境修復後重載 |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 調槽／選slot | editable | 只影響下一次投球，舊印記不動 |
| 撞槽完成 | 目標slot合法；覆寫已確認 | 原子寫depth／clock，清該read／point；清引用卡及meanV；清fit.attempted／fitV／gFromClock，其他點及概念保留 |
| 動畫中取消／離開／check | 未完成撞槽 | 回到投球前保存狀態，沒有半個印記 |
| 改讀數 | row存在 | 保留原point供核對；清引用卡t/v及meanV、fit.attempted／fitV；改y清gFromClock。清空read另清該point及引用卡slot |
| 放／改／刪圖點 | 完整read | 存mm座標／null；清fit.attempted／fitV，不改讀數／兩點估速 |
| 換模型／按擬合 | editable | 換模型清attempted／fitV；按擬合置attempted=true，成功／失敗重算 |
| 換估速slot／改計算 | 合法不同slot | 換slot清卡t/v；改t清該v；改v清meanV；另一卡保留 |
| 顯示時間 | editable，零記錄亦可 | clockShown=true；新記錄亦可查看，不改量度／估速 |
| 清本圖 | editable、確認 | 清points、fit、fitV、trajectory；保留觀測、讀數、兩點估速、分運動 |
| 清本次實驗 | editable、確認 | 回新edit/collect，所有答案及觀測清空 |
| check→edit→check | 可編輯 | 正確保存view／returnToCheck，不生成完成或得分旗標 |
| submit | check及明確操作 | 清暫態、canonical review重算後交shared；結果鎖定依outcome |

## Persistence contract

沿用[快照契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)及[恢復測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)。以 `SimScorm.makeSnapshot(ACTIVITY,"draft",answer)`／`"review"` envelope保存；以下欄位缺失不能當null。

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| 共用版本 | ACTIVITY=`horizontal-projectile-lab`；`schemaVersion:1,modelVersion:1,rubricVersion:1` |
| `rows` | 長度恆6，每格null或`{depthMm,clockMs,read:[xMmOrNull,yMmOrNull],point:nullOr[xMm,yMm]}` |
| 觀測域 | depthMm整數50–800且5的倍數；clockMs整數，等於modelVersion1撞槽事件秒數×1000的捨入值；不用學生y重建觀測 |
| 讀數／點域 | read各值null或整數0–1000mm；point null或兩個0–1000整數。point非null需read兩值非null，但不要求答對 |
| `fit` | `{model:nullOrEnum,attempted:boolean}`；enum=`linear\|quadratic\|square`；model=null必須attempted=false |
| `trajectory` | `null\|line\|parabola\|circle\|other` |
| `calculations` | 恆兩個`{slot:nullOrInteger0to5,t:nullOrNumber,v:nullOrNumber}`；slot非null需指向完整read，兩卡引用不重複；slot=null時t/v皆null |
| 計算number域 | t=0–10s；v、meanV、fitV=0–100m/s；gFromClock=0–100m/s²；最多3位小數，全部finite。0是合法錯答，不是未答 |
| `meanV`／`fitV` | null或上述number；meanV非null需兩卡v非null；fitV非null需attempted=true且成功square fit、k>0，是否算對由scorer判斷 |
| `clockShown`／`gFromClock` | boolean／nullOrNumber；gFromClock非null需已揭示且可由現有y/time重建二次擬合；不因α負而拒絕學生錯讀數 |
| `conclusions` | `{horizontal,hEvidence,vertical,vEvidence}`，各null或所屬enum，見下列 |
| 選項enum | horizontal=`uniform\|accelerating\|decelerating\|insufficient`；hEvidence=`linear-x-time\|quadratic-path\|equal-y\|same-release-only`；vertical=`free-fall\|uniform\|nonzero-initial-speed\|insufficient`；vEvidence=`quadratic-y-time-zero-initial\|y-derived-time\|curved-path-only\|equal-x-only` |
| Draft額外 | `phase:edit\|check,view:collect\|measure\|plot\|speed\|motion,returnToCheck:boolean,setup:{depthMm,slot},selectedSlot:nullOrInteger0to5,ruler:{axis:x\|y,zero:[xMm,yMm]},connectPoints:boolean` |
| Draft額外域 | setup.depthMm同上述、slot=0..5；selectedSlot非null須指現有row；ruler.zero兩值整數-100..1000mm、不計分；check時returnToCheck=false。edit允許舊答案保留，不以未去過之步應空白來拒絕 |
| Review | 所有共用版本及rows／fit／trajectory／calculations／meanV／fitV／clockShown／gFromClock／conclusions，不含draft導航／尺；shared result僅比較metadata |
| Unanswered | row／point／數字／選項皆明確null；read可單軸null；空輸入轉null，不轉0；boolean按操作true/false |

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 觀測、read、point、fit選擇與執行、計算引用／數值、計時揭示、概念答案；draft另有設定及續作狀態。固定slot index是權威關係，覆寫時按轉移表清依賴 |
| Transient | 動畫／RAF、pointer／capture、拖動中preview、hover、confirmation、camera及fullscreen；不保存。拖動完成才save，取消回復 |
| Derived | 真實位置、刻度、P₁–P₆／DOM id、擬合係數／RMSE／成敗、計時圖、完成數及分數；從權威資料重建，不信任cache |
| Version compatibility | 首版僅v1，其他版本明確拒絕；未來變更先定migration及保留rubric，不靜默改評 |
| Size | 最多六觀測／點、兩計算、短enum；不存歷史／截圖／筆畫／係數cache。最大draft、review及shared pending envelope實測UTF-8 **≤4000 bytes**，目前未實測 |
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

- [ ] 鋼珠滾動出口速度、vy(0)=0、各深度碰撞、球心／槽面差、cm/mm/m、動畫跨幀及慢放不改時鐘。
- [ ] 已知y=1.75x²的三種擬合、錯點、最少點、重複x、退化、全y相同、零／負k、非有限數；不能把少點精確插值當證明。
- [ ] 改學生y只改推算時間／擬合、不改clockMs；改深度影響新觀測。未揭示不顯時間，揭示但零資料仍合法。
- [ ] 滿分／untouched／單讀數／單概念、取樣跨度、duplicates、容差邊界、follow-through及所有依賴修改／清除。
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

1. 先完成物理／觀測與數據模型、三種軌跡擬合、獨立時鐘及rubric，驗已知數據、邊界及部分分。
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
