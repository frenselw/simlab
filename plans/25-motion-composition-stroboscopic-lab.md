# 運動合成：頻閃軌跡建構

狀態：**2026-10-01 按使用者追加要求修訂漸進頻閃、四球直接拖放及球體外觀；正在執行修訂版驗收。下文三輪舊審核及勾選項記錄850eae6的歷史證據，不能代替修訂版驗證。真實Moodle／實體手機另待部署驗收。**

- 專用分支：`codex/motion-composition-stroboscopic-plan`。
- 起點：`main`，`0bb873c`。
- 由[新活動計劃範本](NEW-SIMULATION-PLAN-TEMPLATE.md)複製及填寫，遵循[共用風格](00-shared-platform-and-style.md)與[製作指南](../docs/simulation-scorm-production-guide.md)。
- [自由落體頻閃活動](15-free-fall-stroboscopic-measurement-lab.md)只作頻閃呈現參考；其歷史操作／提交限制不作本活動的例外。
- 本次交付包括完整活動、SCORM包裝、本機驗證，以及三份完整獨立審核與第四位agent匯總；真實Moodle／實體手機證據另列。

## 建議的學生體驗

學生觀察同一運動在兩個互相垂直方向上的分運動，根據**同一時刻**的兩個位置，親手擺出合運動的位置。畫面中的兩個分運動球是投影示意，不是兩個真實小球相撞或融合。

1. 選擇情境。畫面先顯示共同原點 O、水平及垂直方向；可按「播放分運動」看兩個示意球同步由 O 出發。
2. 按「拍攝頻閃圖」，兩個分運動球同步移動，每隔0.20 s逐次留下球影；以4倍慢速呈現。起點為共同O，另有t₁–t₄四個時刻。
3. 可按「比較間距」查看兩方向各段距離，判斷水平與垂直各屬勻速、勻加速、勻減速或非勻變速直線運動；此項與放點／軌跡判斷獨立，沒有正確才能繼續的限制。
4. 拍攝完成後圖旁同時出現t₁–t₄四個球。直接拖任何一個入圖，系統強調對應球影；毋須先按時刻按鈕。時刻按鈕仍可用於檢視及微調。
5. 任意次序擺放四個位置；可再拖所屬球以修改，或選時刻後刪除。系統依時間順序自動連接**學生自己的位置**，幫助觀察其作圖結果。
6. 回答「合運動的軌跡是哪一類？」：直線、拋物線、圓弧或其他曲線；預設不選任何答案。
7. 隨時按「檢查作答」，查看四題的已答／未答項目，再明確「提交作答」。提交後才顯示評分、正確位置、參考軌跡及物理解釋。

連線與軌跡判斷都保留：連線呈現學生建構，選擇題記錄其概念判斷。提交前不把錯點拉回正解、不根據選擇題美化連線，也不顯示「答對」提示。

## 四個情境與教學重點

第一版固定四題，按以下建議次序呈現，但可直接切換。導航只寫「情境 1–4」，不在題名透露合成後的軌跡。

| 情境 | 水平分運動 | 垂直分運動 | 合成後的參考結果（只供設計／提交後） | 教學重點 |
|---|---|---|---|---|
| A 兩方向勻速 | 向右勻速，等時球影等距 | 向下勻速，等時球影等距；本題兩方向速率相同 | 向右下的直線；合運動也是勻速 | 把同一時刻的 x、y 位置配成一個點；45°只是本題速率相同的結果 |
| B 平拋 | 向右勻速，等時球影等距 | 由靜止自由落體，向下間距逐段增大 | 向下彎的拋物線 | 水平勻速與垂直自由落體相互獨立；不能把兩列球影首尾接駁 |
| C 加速度改在水平 | 由靜止向右勻加速，間距逐段增大 | 向下勻速，等時球影等距 | 向右彎的拋物線 | 把加速方向轉90°仍可逐時刻合成；本題水平加速不稱為自由落體 |
| D 兩方向都加速 | 由靜止向右勻加速 | 由靜止向下勻加速；本題加速度大小相同 | 向右下的直線，球影間距增大 | 軌跡形狀與速率變化是不同概念；兩方向同時加速不必然形成曲線 |

A、D故意具有同一條參考直線，但頻閃分布不同。這是第四題的比較目標，而不是重複出題。D只歸納本題「兩方向由靜止開始、加速度固定」的條件，不宣稱任意兩個加速運動都合成直線。

## 新增：分運動判斷與間距工具

- 四題水平／垂直各一個類型答案，預設null；選項為勻速、勻加速、勻減速、非勻變速直線運動。題目用「哪一種運動模型符合這組頻閃資料？」；理想模型、不折返、等時間間隔的條件明確。
- 「比較間距」按方向切換，把相鄰球影距離以同一基準、同一比例的四條橫條與數字呈現；可再查看相鄰間距增加量。不另加可拖量尺或大量數值輸入，工具操作不計分。
- 每段均0.20s；勻速距離0.80、0.80、0.80、0.80m，增加量0；勻加速距離0.20、0.60、1.00、1.40m，增加量均0.40m。比較的是相鄰間距，不是由O量的總位移。
- 間距逐漸變大只表明各段平均速率增加；等量增加與勻加速模型相符，不宣稱有限頻閃點能證明每一瞬間的加速度。1:3:5:7另要求由靜止開始，不能當作所有勻加速運動的必然比例。
- 比較工具與方向切換是暫態視圖；Moodle恢復時仍可由observed及固定model重建。類型答案是權威資料，與位置／軌跡互相獨立；分類不正確或未答都可繼續放點及提交。
- 新增variants：edit中只答一個分運動類型、只答兩方向類型、分運動與軌跡部分作答，全部納入「只有分類」列；各null／非null組合及restore後合法續作都須測。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `motion-composition-stroboscopic-lab`；以同一時刻的兩個分運動位置建構合運動位置，辨認直線／拋物線，區分軌跡與速率變化 |
| Learner task / main interactions | 四題，各判斷兩個分運動類型、放置四個球及選一個軌跡類型；同步播放、漸進拍攝頻閃、四球直接拖放、按時刻檢視／微調、刪除、重置本題、檢查、提交、提交後只讀比較 |
| Runtime files / libraries and justification | 原生 HTML/CSS/JS、SVG、Pointer Events；`index.html`、`styles.css`、`main.js`、`model.js`、`animation.js`、`scoring.js`、`persistence.js`、`ui-runtime.js`、`scene.js`；animation 負責同步移動與等時曝光，沿用三個 shared 檔案，無額外 runtime library 或建置系統需求 |
| Assessment risk / trusted validation | `formative`，100分、60分達標；瀏覽器評分供形成性練習，高風險考試及可信服務端驗證不在本版範圍 |
| Out of scope | 學生設定任意速度／加速度、隨機題庫、斜拋與折返、阻力、碰撞、三維運動、非正交分解、速度／加速度向量作圖、自由手繪曲線、量尺及公式計算題、操作次數／速度評分 |

四種變化本身就是學習目標，故第一版包含四題；每題仍只有相同的一個建構任務。播放及顯示頻閃不計分，只評明確保存的最終位置、兩個分運動類型及軌跡選擇。

## Catalogue metadata (`sim/config.js`)

以下為目錄登記規格；初版使用 `planned`，本機實作及技術回歸後已登記 `active`。完整審核與 package-ready 結論按文末實際證據更新；真實 Moodle／實體手機 gate 另行驗收。

```js
{
  title: "運動合成：頻閃軌跡建構",
  folder: "motion-composition-stroboscopic-lab",
  categories: ["Mechanics"],
  description: "比較水平與垂直的等時頻閃，判斷分運動類型，拖放合運動位置並辨認軌跡。",
  tags: ["physics", "mechanics", "kinematics", "motion-composition", "stroboscopic-motion", "projectile-motion", "drag-and-drop", "scorm"],
  status: "active"
}
```

## Physics or subject model

### 坐標、時間與固定參數

使用世界坐標 x 向右、y 向上，O=(0,0)；向下的位置及速度用負 y。畫面雖然向下顯示，不把模型 y 值改成正值。兩方向使用相同原點、比例尺、起始時刻及頻閃時間。

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| tᵢ | tᵢ=iΔt，i=0..4 | s | Δt=0.20 s，最後時刻0.80 s；等效頻率5 Hz |
| 水平位置 x(t) | x=vₓ₀t+½aₓt² | m；v用m/s，a用m/s² | 起點x₀=0 |
| 垂直位置 y(t) | y=vᵧ₀t+½aᵧt² | 同上 | 起點y₀=0 |
| 分運動球影 Xᵢ、Yᵢ | Xᵢ=(x(tᵢ),0)，Yᵢ=(0,y(tᵢ)) | m | 只作同一物體的分運動示意 |
| 合運動位置 Pᵢ | Pᵢ=(x(tᵢ),y(tᵢ)) | m | 原點P₀是題目提供的已知點，不計分 |
| 畫面映射 | 同一比例把世界x、y換成CSS像素，y繪圖時反向 | CSS px/m | 圖域x=-0.4..3.6 m，y=-3.6..0.4 m；四題相同，橫豎等比例 |
| 公開方格與學生坐標 | 方格每0.20 m；放手後保存為整數毫米 | m／內部mm | 每0.80 m畫主格；保存精度1 mm，不在restore時再量化 |

| 情境 | vₓ₀ (m/s) | aₓ (m/s²) | vᵧ₀ (m/s) | aᵧ (m/s²) | 精確參考軌跡 |
|---|---:|---:|---:|---:|---|
| A | 4 | 0 | -4 | 0 | y=-x |
| B | 4 | 0 | 0 | -10 | y=-(5/16)x² |
| C | 0 | 10 | -4 | 0 | x=(5/16)y²，取y≤0分支 |
| D | 0 | 10 | 0 | -10 | y=-x；x、-y均與t²成正比 |

B取g=10 m/s²，忽略空氣阻力；這是明確的教學近似。A、C、D是指定的理想分運動，不套用「所有向下運動都只受重力」的前提；C的垂直速度保持不變，D的加速度向量同時有水平、垂直分量。

以下是開發及評分的基準，提交前不直接顯示答案表。各格為(x,y)，單位m：

| 情境 | t₁=0.20 s | t₂=0.40 s | t₃=0.60 s | t₄=0.80 s |
|---|---|---|---|---|
| A | (0.80,-0.80) | (1.60,-1.60) | (2.40,-2.40) | (3.20,-3.20) |
| B | (0.80,-0.20) | (1.60,-0.80) | (2.40,-1.80) | (3.20,-3.20) |
| C | (0.20,-0.80) | (0.80,-1.60) | (1.80,-2.40) | (3.20,-3.20) |
| D | (0.20,-0.20) | (0.80,-0.80) | (1.80,-1.80) | (3.20,-3.20) |

A兩方向每段位移都是0.80 m；B垂直、C水平、D兩方向的相鄰位移大小都是0.20、0.60、1.00、1.40 m，即1:3:5:7。四題都用相同視野，不能為個別坐標軸拉伸而把曲線或角度畫錯。

### 播放、頻閃與連線

- 初始不自動播放；「播放分運動」由t=0同步播到0.80 s，動畫放慢供觀察，時鐘仍標模型時間。停止後可重播，切題、檢查或拖放時停播；減少動態偏好時改用逐時刻呈現。
- 「拍攝頻閃圖」由同一模型連續移動兩個分運動球，每經過0.20 s才留下相應球影；0.80 s拍攝以4倍慢速播放，共3.20 s。球影取固定曝光時刻，不取按掣或畫面更新瞬間的位置。減少動態效果時以相同節奏逐格曝光，不一次展示全部球影。拍攝完成後立即提供四個待放球；重播保留所有答案。
- 選時刻只強調對應的Xᵢ、Yᵢ，不自動畫延長到正確交點的投影線、不放合運動示範球。兩列重疊的t₀以共同O表示，避免看成兩個不同起點。
- 學生位置依t₀→t₁→…→t₄畫淡色折線；只連兩個相鄰且已存在的時間點，不跨過未答時刻、不作曲線擬合。這條線標「你的連線」，不宣稱就是光滑的真實軌跡。
- 提交後可切換「你的作圖／參考作圖」：參考圖依上述連續模型畫精確直線或拋物線，並疊加等時頻閃位置；可重播參考合運動，始終只讀。
- A與D回饋比較同一直線上均勻／逐漸增大的間距；B與C回饋說明彎曲方向跟加速分運動有關。水平與垂直的分運動類型另行獨立計分。

## Responsive layout contract

套用[三區布局](00-shared-platform-and-style.md#layout)及[手機互動](00-shared-platform-and-style.md#mobile-interaction)，白／淺灰底、共用字體、邊框、圓角及藍色主要操作；無獨立封面頁或裝飾動畫。

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：標題、四題直接導航、目前題目／作答狀態；stage：共同坐標、分運動頻閃、學生位置、待放球；panel：播放／頻閃、相鄰間距比較、兩方向類型、時間選擇、位置微調、軌跡單選、刪除／重置、檢查 |
| Desktop / tablet | 寬度≥880px時stage在左、panel在右；panel寬clamp(16rem,28vw,20rem)，讓正方形坐標圖有足夠空間 |
| Control-panel classification | `bounded split-panel`；學生反覆選時刻及軌跡時須看見頻閃圖，panel獨立捲動，stage保持可見 |
| Phone stage and controls | Header約88–104px；stage以minmax(11rem,42vh)及42dvh為起點，panel取餘下高度且min-height:0。一般圖域右側放四個44×44px球抓手，首球中心距頂部至少54px以避開圖例；stage寬<260px或高<210px時改為圖下2×2停泊區，收起stage頂列及密集數字刻度。小圖域將軸名放在球影以外，球心與等比例映射不變。≤300px高的窄CSS viewport仍採stage／panel各半欄，panel保留16px主要字體及44px控件，不加stage捲軸 |
| Phone text | 本文／按鈕16px、標題20–24px、次要文字14px；圖上必要時間／刻度標籤以實際CSS 14px為目標，減少標籤密度而不隨SVG縮成小字；單位放軸名，數字只標主刻度 |
| Viewports | 320×500、390×500、390×600、390×844、手機橫向、短Moodle iframe、工具列變化、軟鍵盤及200% zoom；圖域橫豎比例始終一致 |
| Scroll topology | Standalone及iframe使用100vh→100dvh有界shell；html/body/shell無額外可用垂直捲動。panel自己捲；空白stage及兩側留白捲enclosing page／Moodle host；沒有第三個scroll owner |

四個t₁–t₄球抓手同時可直接拖入圖域，毋須先按時刻按鈕。停泊抓手是所屬時刻的操作入口，放置後保留並標示已放置，可直接再拖以修改該時刻。圖內一般只提供目前時刻的既有球抓手，避免密集球影的44px熱區互相遮蓋；極短stage只用四個停泊抓手及微調面板修改，避免圖內抓手侵入2×2停泊區。按住球只暫態選取該時刻，合法放手才保存activeTime及該點；取消回復原有選擇。選定分運動配合粗圈、Xᵢ／Yᵢ圖例及面板時刻識別。

選中位置以較粗球圈及Pᵢ識別。普通圖域把Pᵢ放在附近可讀位置，避開全部球面、軸名、其他文字、球架及物理軌跡；所有球先畫，標籤後畫且不受plot裁切。compact圖域改在圖旁留白寫「所選 Pᵢ」，以所選時刻及球圈對應，避免密集球影遮住字形。保持14px主字及真下標，不改球心、比例、學生答案或評分。

## Navigation, submission and reset

依[資料依賴導航](00-shared-platform-and-style.md#navigation)及[檢查／提交契約](00-shared-platform-and-style.md#submission-and-reset)。

| Decision | Activity specification |
|---|---|
| Navigation | `mixed`：四個情境互不依賴，header直接切換並保留各自答案；每題先顯示頻閃才可放點，四個時刻可任意次序作答，所有分類不依賴放點完整性 |
| Final check access | 所有editable狀態均有「檢查作答」，包括未播放、未顯示頻閃、未訪問題目及未放點；不要求逐題完成或跳過 |
| Incomplete submission | 只列已放位置n/4、分類已選／未選及未答項得0；不顯示提交前分數／對錯；「提交目前作答」仍可用 |
| Editable reset | 「刪除此時刻位置」只清一點；「清除軌跡選擇」只清分類。「重置本題作答」清本題四點、兩個分運動類型與軌跡分類，保留頻閃及其他題；已有答案時先清楚提示範圍及確認，不換題 |
| Scored / pending attempt | 已記錄或pending凍結後無清除／重做控制；只提供允許的技術重試與只讀檢討。Standalone刷新／Moodle續作按共用契約處理 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| 四題的播放／觀察 | 固定模型與共同時間，無其他題依賴 | 未觀察是合法空白，不算錯誤狀態 | 顯示頻閃、選分類、切題、檢查 |
| 放置任一時刻 | 本題observed=true；activeTime為1..4 | 未顯示頻閃只提示先顯示，不替學生生成答案；仍可檢查 | 任意放點次序、修改、刪除、分類、檢查 |
| 軌跡單選 | 無放點或觀察先決條件 | 選了分類但沒放點仍是有效部分作答 | 放點或直接檢查／提交，分類分獨立保留 |
| 修改／刪除一點 | 該時刻答案或明確的新放置操作 | 只重建相鄰學生連線，不清分類或其他時刻／題目 | 繼續編輯或檢查 |
| 由檢查返回編輯 | 保留全部答案、activeCase、activeTime；returnToCheck=true | 不補未答、不重播／重置、不製造visited門檻 | 修改後「返回檢查」，也可換題 |

header的未開始／觀察中／部分作答／已作答由observed與非null答案派生；完整但錯誤的答案亦顯示已作答，不能以進度顏色洩露正確性。完成第四題不自動提交。

## Diagrams, notation and assistance

依[圖與數學排版](00-shared-platform-and-style.md#diagrams-and-notation)、[吸附](00-shared-platform-and-style.md#snapping)及[觸控預覽](00-shared-platform-and-style.md#touch-preview)。

| Decision | Activity specification and reason |
|---|---|
| Notation | x、y、t是標量坐標／時間，Pᵢ是位置點；本版不要求畫向量，解釋由O出發的位移時用r⃗=(x,y)，與大小∣r⃗∣區分。變量math serif斜體，數字／單位正體、真下標；不向學生顯示raw LaTeX或t_1 |
| Diagram colors | 水平分運動藍、垂直分運動橙、學生合運動深紫；球使用本地SVG徑向漸層及高光呈現球體，球心仍精確對齊物理坐標。歷史球影半透明、移動球實色；選中分運動以粗圈、真下標Xᵢ／Yᵢ圖例識別。密集軸旁不再加重複文字；Pᵢ避開軸名。每個場景／預覽使用獨立gradient及clip ID。正確性顏色只在提交後使用 |
| Arrow graphics | 僅坐標軸有小方向箭頭，表示+x／+y，無可編輯向量箭頭；軸約1.5 CSSpx、箭頭約7px，方向標籤不壓在球影上。學生連線無箭頭，以時間編號表示次序 |
| Snap | 必需：吸附到全部可見0.20 m方格交點，包括錯誤候選位置；touch最近點≤10 CSSpx、mouse/pen≤6px。保持時採14／9px退出距離，競爭交點須較原點近2／1px才轉換；參數須在不同縮放驗證無跳格。拖動及放手使用同一解析位置，不對正解設磁吸 |
| Touch preview | 拖待放球及既有位置都必需：早期頻閃點很近，手指會遮住球心／方格。提供3×、124px外框寬／70px高的真實局部場景及獨立讀數「t、你的x、你的y」，聚焦目前吸附後的學生位置；按實際lens尺寸計算viewBox，不以預估overlay高度定位。普通按鈕／單選／微調不需預覽 |

預覽只顯示局部方格、可見分運動與學生球，不補正確交點或正確坐標。正常放在stage穩定角落，必要時才移開手指；短兩欄stage無可避指位置時，使用同一bounded shell另一側。預覽是shell內的pointer-inert sibling，按render後實際外框尺寸確保全框可視，不能被stage裁切或攔截事件。完成、取消、失去capture、失焦、換題、檢查、resize及鎖定均清除。拖動期間相機固定；resize中斷操作並保留先前已保存的答案。

待放球停泊區不屬世界坐標，初始四點都是null。只是選時刻或點一下待放球不建立答案；有效拖動跨越4 CSSpx並在圖域內放手才保存。可以刻意放在任何合法位置，包括軸上、錯誤象限及重疊處；圖外放手取消，沒有隱藏的答案修正。

既有球由pointerdown時的世界坐標及抓取偏移開始，不能一按就跳到手指中心。pointerup須解析最終位置；cancel／lostcapture／多指／blur等中斷回復最近已保存值。刪除、重置不把停泊球當作有分答案。

位置微調提供面板方向控制，普通步長0.20 m、微調0.01 m，均不使用正解吸附。Tab至任一停泊球後以方向鍵開始編輯時，明確選取並保存其時刻導航，位置仍是暫態；焦點移到面板不會誤改原先時刻。空白時以「開始放置」建立暫態工作點，再以方向控制及「放置此位置」／Enter明確保存；Escape取消位置調整。既有位置亦可用相同方式修改。任何檢查或導航先取消未保存工作點。工作值、放手讀數及提交後差異顯示至0.001 m，與保存精度一致；主坐標軸仍只標簡短主刻度。

## Touch gesture ownership contract

遵守製作指南的[完整手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。以下selector與production DOM一致；執行證據另列於文末。

| Target type | Selector / hit area and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 四個時刻球抓手 | `.point-tray-handle[data-slot]`，各44×44px，四個互不重疊，位於圖域外 | 四個穩定HTML target，none；可任意順序直接拖動，全程保持同node | Tab至所需球，方向鍵移動，Enter保存／Escape取消；亦可用面板 |
| 已選時刻的既有球抓手 | `.active-point-handle`，44×44px，球心對齊；compact停泊布局不設此target | 穩定HTML target，none；只此時刻具抓手，其他球不攔截手勢 | 所屬停泊球或面板仍可修改；Shift+方向鍵微調 |
| 播放、頻閃、時間、方向、刪除／重置、分類、檢查／提交 | 原生button／select／checkbox；button／select≥44px，checkbox配44px高label熱區 | 使用原生操作及panel的pan-y，不建立拖動capture | Tab、Enter／Space及原生選單的方向鍵操作 |
| 頻閃球影／未選學生球／連線／軸／預覽 | 唯讀SVG或pointer-inert overlay | 不攔截pan；preview用pointer-events:none | 面板時間選擇及文字場景描述可達 |

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 空白stage、軸、頻閃及未選球 | Enclosing page/Moodle host | pan-y，不能在空白處點一下自動放球；保留可觸及背景 | source／ZIP 390／320寬兩方向trusted swipe通過 |
| panel中段／上下邊界 | Panel only | overflow-y:auto與overscroll-behavior:contain；不傳給host或stage | source／ZIP中段與兩端兩方向通過 |
| 待放球 | Simulation | none；拖入圖域後放手保存所選時間的位置，所有非owner幾何固定 | source／ZIP四題四時刻、常規與320×225短layout通過 |
| 既有active球 | Simulation | none；只改該時刻，其他答案及全部scroll／viewport／iframe位置固定 | 兩路四題四時刻、近原點／邊緣、抓取偏移與取消通過 |
| Left scroll strip | Enclosing page/Moodle host | stage左側保留至少24 CSSpx，不被抓手／tray覆蓋 | source／ZIP 390／320寬兩向swipe通過 |
| Right scroll strip | Enclosing page/Moodle host | stage右側同樣至少24 CSSpx，獨立驗證 | source／ZIP 390／320寬兩向swipe通過 |
| Free drawing surface | N/A | 本版只有獨立抓手，無全stage自由繪圖／放置overlay | N/A，若日後加入須重訂契約 |
| review／frozen／committed舊抓手位置 | Enclosing page/Moodle host | 移除編輯ownership與none，圖仍可檢討 | source／ZIP三模式舊target區域trusted pan通過 |

- 優先使用native host pan；若iframe拓撲需要same-host forwarding，只forward到enclosing host並測試防double scroll，不能轉送panel。兩側留白雖非自由畫圖必需，仍保留作穩定捲動入口。
- 圖域在兩條24px strip內側另留22px抓手容納空間，讓44px抓手在圖域邊緣也不侵入strip；縮放／letterboxing只調呈現，不改合法世界坐標範圍。
- Source與實際ZIP解壓頁各放在可捲動Moodle-like iframe，使用browser-level trusted touch，記錄engine／device、pointerType及isTrusted；不以DOM dispatch或programmatic scroll當驗收。
- 每列記錄前後host scroll／visual viewport、iframe bounds、activity document scroll／viewport、panel scroll、phase／selection／全部答案；確認只有該owner改變。stage與strip測上下兩向，panel測兩端，每種抓手保持move／up且無pointercancel。
- 手勢驗證先停播；preview、吸附、pointerup一致性另驗。Source／package證據保存在`output/playwright/motion-composition-stroboscopic-lab/`；以文末記錄的修正版report為準。
- Simulation起始的多指打斷只取消暫態，ownership保留至全部touch結束，不轉交host；第二指從stage、左右strip或抓手開始均測，結束後同一頁的正常host pan仍可用。

## Scoring and tolerance

每題25分，四題100分，60分達標。每題四個位置共16分，兩個分運動類型共6分，軌跡類型3分；水平與垂直分量獨立評分，不因一個坐標錯誤抹去另一個的有效作答。

| Decision | Activity specification |
|---|---|
| Rubric | 每個P₁–P₄：x正確2分、y正確2分；四點合共16分。水平／垂直類型各正確3分，軌跡單選正確3分；全卷0..100，maxScore=100，passed由score≥60派生 |
| Granularity | 單一坐標、單一時刻、不同題及分類互不扣連帶分；分類可在未放點時得分，位置也可在未選分類時得分 |
| Unanswered / null | `point=null`時該點兩項均0；motions各null時該方向類型0，trajectory=null時軌跡分類0；observed／播放／P₀／停泊球均不計分。完全未操作為0 |
| Extras / duplicates / penalties | 每時刻只有一個slot、分類只能單選；重放取代該slot，不新增點／不靠選全部碰答案。不額外扣分；同一位置可屬不同時間，但各自跟所屬時間評分 |
| Tolerances | x及y各採對稱絕對誤差≤0.05 m，即50 mm；以世界坐標計算，不用像素或徑向距離；與吸附10／6 CSSpx分開設定 |

判分常數：`POSITION_TOLERANCE_MM=50`、`COORDINATE_POINTS=2`、`MOTION_POINTS=3`、`TRAJECTORY_POINTS=3`、`PASS_SCORE=60`。答案保存整數毫米；例：目標x=0.800 m，0.750及0.850接受，0.749及0.851不接受；y的負值使用同一對稱規則。x、y同時各差50 mm仍可得該點滿分，不另作徑向否決。

部分分例：B的P₂目標(1.60,-0.80)，學生放在(1.60,-1.60)時保留x的2分；其餘未答不影響這2分。只選對全部類型及軌跡得36分；所有位置正確但全部分類未答得64分。把四題t₄都放在共同末點只得這四個時刻的16分，不能代替前面時刻。

提交後才逐點顯示學生位置、參考位置及兩分量差異，解釋常見錯誤：混用不同時刻、把水平位移與垂直位移當相加成一個數、誤把分運動球影直接連接、或只憑間距增大就斷言曲線。未確認結果時不顯示這些評分／正解。

## Phase/state matrix

`N`為全卷已放點數0..16，`K`為兩方向類型加軌跡的已答數0..12；正確與否不影響合法性。觀察狀態與答案分開，已觀察但未放球仍屬合法空白。

| Phase / variant | Current step / required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|
| edit／未觀察全空 | activeCase=0..3，activeTime=1..4；全observed=false，N=K=0，returnToCheck=false | 不預填答案，未訪問不等於無效 | 顯示頻閃、選分類、切題或檢查 |
| edit／已觀察全空 | 至少一題observed=true，N=K=0，returnToCheck=false | 四題答案仍null | 放任一點、選分類或檢查 |
| edit／只有分類 | N=0，K=1..12；observed可true或false | 位置保持null，不杜撰已觀察 | 顯示頻閃／放點／改分類或檢查 |
| edit／部分位置 | N=1..15，K=0..12；有位置的題observed=true | 未答位置保留null，其他題保留 | 改／補任一點、分類或檢查 |
| edit／點齊分類未齊 | N=16，K=0..11，全部observed=true | 未答分類仍null | 改點／補分類或檢查 |
| edit／全部已答 | N=16，K=12，全部observed=true | 合法錯誤及重疊位置均保留 | 修改、刪除、重置本題或檢查 |
| edit／由檢查返回：空白 | N=K=0，returnToCheck=true；observed任合法組合 | 保留檢查前的題目／時間及觀察 | 作答、換題或返回檢查 |
| edit／由檢查返回：部分 | 0<N+K<28，returnToCheck=true；保留真實答案及依賴 | 不限制activeTime是否已有點 | 改現有／空白slot或返回檢查 |
| edit／由檢查返回：完整 | N=16，K=12，returnToCheck=true | 原答案可全錯，不自動修正 | 修改／刪除或返回檢查 |
| check／空白 | N=K=0，phase=check，returnToCheck=false | 保留observed與返回索引 | 明確提交0分attempt或返回編輯 |
| check／部分 | 0<N+K<28，phase=check，returnToCheck=false | 所有null及已答項都保留 | 提交目前作答或返回編輯 |
| check／完整 | N=16，K=12，phase=check，returnToCheck=false | 不預先保存score作真值 | 提交或返回編輯 |
| review／空白 | phase=review，N=K=0，returnToCheck=false | 全空權威答案仍可驗證／重算 | 只讀切題檢討，不可重設 |
| review／部分 | phase=review，0<N+K<28，returnToCheck=false | 保留所有已答及null | 只讀切題檢討 |
| review／完整 | phase=review，N=16，K=12，returnToCheck=false | 保存合法錯誤答案，不美化 | 只讀比較參考圖／播放 |
| pending-final／空白、部分、完整 | Shared pending封套含phase=review的相同答案及結果；三類都測 | 答案凍結，未確認成功不洩露分數／參考答案 | 深層驗證後只重試同payload |
| committed／finish待完成 | Shared已確認commit，保留review答案及結果 | 只讀，無清除／再提交 | 使用shared重試finish |

播放進度、尚未放手的拖動及尚未確認的微調不是saveable phase。檢查／切題時取消暫態、保留最近已保存答案；提交前生成的review payload固定，不把指標工作值混入。

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 切題／選時刻 | edit或只讀檢討 | 取消拖動／微調／播放，保留四題答案。edit更新並保存語義索引；只讀檢討只改暫態瀏覽索引，不改已提交／pending權威payload |
| 拍攝頻閃完成 | edit，同題有效拍攝到t₄ | 本題observed=true；拍攝期間仍false且無位置可寫。中斷或離頁不杜撰完成；再次開啟可重新拍攝。已完成圖由模型重建，重播不清點；不直接加分 |
| 合法放手／確認微調 | edit，本題observed=true，坐標在圖域 | 只寫activeTime的mm坐標，重建相鄰連線，保存draft |
| 選／清分類、刪點、重置本題 | edit | 只改指定答案，保留其他題；隨即保存draft |
| 檢查／返回編輯 | 任意edit／check | edit→check設returnToCheck=false；check→edit設true，保留全部答案及索引 |
| 明確提交 | check，包括空白／部分 | 取消暫態，從最終答案重算；review副本phase=review，returnToCheck=false，交shared流程 |
| 技術失敗或成功 | Shared outcome | 依下表決定editable、只讀、凍結或技術鎖，不自行推斷LMS完成 |

## Persistence contract

依[權威快照](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)及[恢復測試](../docs/simulation-scorm-production-guide.md#required-persistence-tests)。外層由`SimScorm.makeSnapshot(ACTIVITY,kind,answer,result)`建立；`ACTIVITY`為上述slug，外層version=1。

```text
answer = {
  schemaVersion: 1, modelVersion: 1, rubricVersion: 1,
  phase: "edit" | "check" | "review",
  activeCase: integer 0..3,
  activeTime: integer 1..4,
  returnToCheck: boolean,
  cases: [A, B, C, D]                 // 固定四項，順序即權威情境關係
}
case = {
  observed: boolean,
  motions: [horizontal, vertical],   // 每項null或uniform/accelerating/decelerating/nonuniform
  points: [P1, P2, P3, P4],          // 固定四項，順序即權威時間關係
  trajectory: null | "line" | "parabola" | "circular" | "other"
}
point = null | [xMm, yMm]
xMm, yMm = integer -400..3600（x）／-3600..400（y）
```

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Draft | Shared kind=draft，answer.phase只許edit／check；完整保存四題、索引、版本及returnToCheck |
| Review | Shared kind=review，answer.phase=review及returnToCheck=false；相同四題權威答案足夠重算及重畫；外層score／passed只作比較metadata |
| Unanswered encoding | 每題四個point、兩個motions與trajectory均可null；observed=false要求該題所有point=null，但motions與trajectory仍可有合法選擇。缺欄位、錯陣列長度、非法數字不當作未答 |

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 三個版本、phase、activeCase／activeTime、returnToCheck、每題observed／四個毫米坐標／兩個motions／trajectory；slot索引決定所屬題及時間，不接受隨意對換 |
| Transient | Pointer、所抓時刻、抓取偏移、吸附hysteresis、未保存工作點、preview位置、拍攝／重播時間及已曝光數、focus、DOM；不persist。未完成拍攝恢復為未觀察並可重新拍攝，完成拍攝恢復完整圖；schema／model／rubric仍為1 |
| Derived | 固定模型／正解、Xᵢ／Yᵢ、P₀、camera／像素位置、抓手ID、進度、折線、分數及達標狀態；按modelVersion與權威答案重建，不信snapshot夾帶的快取 |
| Version compatibility | 首版只接受schemaVersion/modelVersion/rubricVersion=1；未知版本拒絕，不默默改答案。日後換模型／rubric須版本化並測試舊review處理 |
| Size | 實作前後都測最長合法draft、review與shared pending-final完整封套，含reviewJson跳脫後大小；每個≤4000 UTF-8 bytes，不存影像、動畫／長日誌或完整feedback |
| Invalid finished review | 保持只讀，只顯示可信Moodle摘要；不以空白新題覆蓋既有結果 |
| Invalid pending-final | 深層decode／rescore／權威答案比對失敗時先`SimScorm.quarantinePending()`，技術鎖；不重試、清除或解凍該payload |
| Invalid editable draft | 首版採技術load lock及重新載入讀取，不自動清除；尚不提供損壞draft清除功能。未知／已完成／pending亦保持鎖定 |

嚴格驗證所有必要欄位、tuple長度、整數範圍、枚舉、observed→point依賴、kind→phase及returnToCheck限制。坐標錯誤、時間位置混用、重疊、未觀察卻已選分類、未完成的檢查與0分review均可合法保存；不能把物理答錯當作schema損壞。

只在放手／微調確認、分類、觀察、導航或phase改變後保存，並register最新draft provider。還原不重新吸附、不捨入、不補球；完成restore依序驗證→還原權威答案→重算→`SimActivityFlow.reviewResult()`，比對computed、saved及Moodle。每個矩陣variant都要保持相同分數／達標狀態及可執行下一步。

## Shared SCORM lifecycle

使用`SimScorm.loadAttempt()`＋`SimActivityFlow.startup()`、`SimScorm.setDraftProvider()`及`SimScorm.submitWithCallbacks()`＋`SimActivityFlow.submission()`。不加入活動自己的raw LMS欄位讀寫、commit／finish／page-lifecycle流程。

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 新題從A、t₁、全部null開始；合法draft恢復原題／時間／phase／答案；保存失敗提示「暫未保存成功」，保留記憶體答案，不顯示已提交 |
| Startup review | 驗證、還原、重算及reviewResult比對後只讀；可信時顯示結果及參考圖 |
| Startup frozen | 驗證shared內層review、重算score／passed並比對canonical權威答案；合法才開「重試此提交」，保持凍結、不先顯示正解 |
| Startup load-error | 鎖定不安全操作，顯示「未能安全讀取作答」及技術原因；嵌入LMS故障不假裝Standalone新練習 |
| Submit success | 顯示「已提交」及只讀結果；Standalone改用「練習結果」，不宣稱已交Moodle |
| Submit committed | 「成績已記錄，完成程序待重試」；只讀，可由shared重試finish，不能改答案或重做 |
| Submit frozen | 「提交尚未確認，作答已保留待重試」；分數顯示--，不稱已通過／未通過或已提交；只重試相同有效payload |
| Submit retry，retryable=true | 沒有durable final；提示「尚未提交成功」，保留原check及可返回編輯，再明確重試 |
| Submit retry，retryable=false | 顯示技術錯誤並依shared禁止不安全寫入；不承諾重試成功、不生成新attempt |
| Review trust | 一致才顯示可信詳細結果；mismatch／unknown status只顯示可確認的Moodle摘要及技術說明。passed=null使用completionLabel，不冒稱未通過 |
| Standalone refresh | 必須memory-only；刷新清空部分／check／submitted作答並回初始導航；固定四題不變。忽略舊local/session/IndexedDB checkpoint，拒絕storage仍可練習；不opt-in standalone persistence |
| Moodle resume / recovery | 同attempt保留draft、已提交review及pending；只有Moodle提供新attempt才重開。技術讀取錯誤不覆寫舊資料；正式Moodle／實體手機證據另驗 |

## Test plan

以下依[完整驗證清單](../docs/simulation-scorm-production-guide.md#verification-checklists)記錄本機實跑結果；純測試、Chrome/CDP source／ZIP證據見文末，外部部署gate另列。

修訂版追加決策：`animation.test.js`用可控時鐘驗0／1／2／3／4次等時曝光、減少動態逐格、延遲frame及取消後舊frame不能完成新題；browser兩路實際逐次驗曝光數／球心、未完成拍攝Moodle恢復後重新拍攝及合法放點。四球trusted-touch由activeTime=1直接抓任何slot，驗暫態時刻、合法放手僅更新所屬點與activeTime、取消不改權威資料。短viewport驗四球2×2完整熱區、同slot再拖及面板替代，不再要求已移除的圖內短抓手。新增animation.js須列入manifest並與實際ZIP逐byte比對；舊schema及512恢復矩陣仍適用。

修訂版遮擋再驗決策：以實際DOM文字、球面含描邊、HTML抓手及其內容bounds檢查軸名、圖例、時鐘及文字可讀性；不以字串存在代替可視。普通13種viewport逐四情境／四時刻及submitted reference檢查，含compact門檻上下；320×225兩種拓撲在capture及reference播放的起點／首曝光另留實際bounds與截圖。保留完整source／實際ZIP的正常及短trusted-touch矩陣。

只讀時刻驗證由合法finished fixture保存activeCase／activeTime、透過production restore逐一載入，再明確核對實際selection與答案不變；不點隱藏於editPanel內的timeNav。所有browser target定位拒絕隱藏或零範圍元素，另以review隱藏timeNav驗守衛，防止0×0誤點造成虛假的覆蓋。

P標籤的native可讀性守衛涵蓋全部answer／reference／live／投影球面與描邊、其他文字及stage邊界。320×225 standalone／fluid iframe逐四情境及四個合法保存的只讀時刻核對；另逐四時刻測密集、部分及錯誤的合法作圖，每一路共56個短畫面狀態。普通13種viewport亦逐四情境／四時刻核對P標籤，不以字串或選取值正確代替實際可視。

- [x] `model.test.js`核對四題每一時刻的x／y、同步時間、上述基準表及1:3:5:7；A、D直線但間距不同，B、C精確拋物線及分支，等比例camera轉換可逆。
- [x] `scoring.test.js`涵蓋全空0、全對100、只答全部分類36、只答位置64、x對y錯及兩方向類型獨立的部分分、每個50mm邊界內／外、重疊及錯slot；不給觀察／預設球分。
- [x] 每個edit variant都可進check並提交空白／部分，且可返回保留答案；未觀察、未訪問、錯答案、分類先答均不阻擋。已提交／pending沒有清除或重做路徑。
- [x] `persistence.test.js`使用production encode/decode/restore，覆蓋矩陣每列及各A–D／P₁–P₄ slot；恢復後同分同passed，再實際執行一個合法續作。返回check時active slot可null或已答。
- [x] 分開測合法錯答／未答與invalid：缺欄、錯tuple／case數、NaN／Infinity／小數mm／越界、非法enum、observed=false卻有點、錯phase／kind／returnToCheck／索引、未知版本；derived ID重建。
- [x] 最大draft／review／pending完整封套≤4000 UTF-8 bytes；更長／錯payload被拒；deep-invalid pending先quarantine，不能透過BFCache／pagehide重試。
- [x] `ui-runtime.test.js`或等價production handler測試覆蓋四startup outcomes、四submission outcomes（含retryable兩類）、committed finish retry、review mismatch／unknown／invalid finished。若調shared runtime，再跑shared fake-LMS failure tests。
- [x] Source及extracted SCORM以實際UI驗Standalone部分／check／submitted刷新後全空，可重新放點及提交；production lifecycle含舊corrupt storage及讀寫拒絕fixture，確認完全不讀寫；browser另驗storage-denied不鎖住。另驗Moodle-like同attempt繼續原draft／review／pending及新attempt。
- [x] 每種抓手trusted touch、每題／每時刻、重疊與近原點、圖外放手、pointercancel／lostcapture／多指／blur／resize rollback；最終up異於move另用trusted mouse驗同一解析handler。micro調／Enter／Escape及焦點可達。
- [x] 吸附只針對公開grid，錯交點同樣可吸附；主圖／preview／release一致，finger遮擋時可辨球心／方格；預覽不洩露正解、不攔截pan，所有清理時機有效。
- [x] 本機emulated手機／短iframe／橫向／200% CSS reflow及CDP visual zoom下圖文字可讀、兩軸等比例、44px抓手不重疊阻擋選時刻、最後控制可達；按[完整touch矩陣](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)在source及ZIP兩路驗host／panel／全部target及左右24px strip，記錄所有owner／非owner metrics。
- [x] 所有新純測試加入`tools/run-tests.js`；focused browser flow建於`tools/motion-composition-browser-regression.js`。manifest包含config、全部activity runtime及三個shared檔案，無CDN／secret／test檔；目錄metadata完整。

## Package-ready checklist

- [x] 使用者審閱本計劃；實作前確認四題、四點、連線及rubric的活動規格。
- [x] 上述純測試、phase／restore續作、lifecycle與source／package UI／trusted-touch均通過，證據填回本文件。
- [x] 本機手機／平板／桌面／短iframe viewports及200% CSS reflow可讀可操作；keyboard替代有效。真實工具列、native picker及裝置zoom另列部署gate；活動沒有文字輸入，無正常軟鍵盤操作。
- [x] `npm run check`、`npm test`、`npm run package:all`、`git diff --check`及相對actual base的diff檢查通過；記錄實際命令及結果。
- [x] production packager（package-all及browser runner）產物根含`imsmanifest.xml`；逐一比對runtime引用、manifest及ZIP，無開發檔案／遺漏依賴。
- [x] Serve實際ZIP解壓頁完成launch／空白／部分／滿分提交smoke與完整touch矩陣；源碼頁成功不能替代。
- [x] 形成性風險已記錄；未完成的真實Moodle及裝置gate保留未勾選。

- [x] 第二輪修正候選完成三位全範圍獨立再審及第四位最終closure，無未處理本機問題。

## Moodle-ready checklist

- [ ] Package-ready通過；真實Moodle學生attempt確實記錄分數／status，含空白及部分提交。
- [ ] 同attempt刷新／離開再入保留draft、pending retry及已提交只讀；零分attempt亦不可重做。
- [ ] Moodle提供新attempt才清空答案；teacher attempt policy及正式評核preview設定符合製作指南。
- [ ] 實體手機於current-window及提供時的new-window player驗全手勢矩陣、preview、side strips、最後控制及回捲，含實際host拓撲。
- [ ] 真實Moodle／裝置證據獨立記錄；不以本機fake-LMS或手機emulation替代。

高風險可信服務端評分：N/A，本版定位為形成性練習。

## 審閱後的實作次序

1. 先實作四題固定model與唯讀分運動／頻閃圖，確認共同時間、比例尺及學科用字。
2. 完成A一題的拖放、時間選擇、grid吸附及手機preview及間距比較；先做短iframe trusted-touch，再套用其餘三題。
3. 加入學生連線、分類、分量部分分、直接切題及任意進度檢查／提交。
4. 接合production snapshots、shared SCORM／flow及所有恢復／錯誤分支；登記tests、catalogue及manifest。
5. 執行並記錄package-ready gates，產生SCORM ZIP；真實Moodle／實體手機另行驗收。

## 實作前規劃核對（歷史證據）

- 已閱讀共用風格、製作指南、計劃範本及相關活動參考；已建立專用分支。
- 文件中的手機尺寸、熱區、吸附、rubric及schema是設計決定，未宣稱已有程式或驗收證據。
- 已以一次性Python核對文件內四題共16個位置、等時間間隔的位移系列、直線／拋物線方程及100分rubric；數值與基準表一致，未新增活動測試程式。
- 已核對範本14個必要章節及16個本地文件連結／anchor，未勾選任何尚未執行的活動驗收。
- 人工按設計schema建立最長欄位的合法樣本：draft 639、review 667、shared pending形狀887 UTF-8 bytes，低於4000上限。這是規劃試算，production serializer／decode／restore仍須另測。
- 新文件以`git diff --no-index --check /dev/null plans/25-motion-composition-stroboscopic-lab.md`核對無空白格式錯誤；尚未實作，未執行活動browser、package或Moodle驗收。

## 審核契約（2026-10-01）

完成本機實作後，三位sub-agents各自完整審核整條branch（包括physics、文字、UI／mobile、評分、保存、SCORM、測試與包裝），不分拆領域。第四位另外閱讀三份報告並匯總成最終報告；主agent修正、執行回歸，必要時再請原審核者檢查，直至無未處理的可重現問題。實體手機／真實Moodle未驗證的部署gate不得宣稱通過。

## 2026-10-01 初步實作證據（獨立審核前）

- 已實作四題固定模型、兩方向類型、相鄰間距比較、四時刻拖放、公開grid吸附、3×preview、微調／鍵盤、獨立部分分、檢查、SCORM及只讀結果。
- 模型／scoring／scene／lifecycle純測試通過；512個production encode/decode/restore及合法續作通過；最大樣本draft/review/pending為791/818/1061 UTF-8 bytes。
- `npm run check`及`npm run package:all`通過；新ZIP為`output/motion-composition-stroboscopic-lab-scorm.zip`（13檔）。目錄仍planned，完整驗證／審核完成才啟用。
- Source／實際ZIP的320×500、390×500、390×600、390×844、768×900、1024×768、1280×900、740×360、320×400、640×450布局，以及滿分／空白／部分／pending／review／Standalone刷新／鍵盤／比較工具UI檢查通過。初版200%只驗visual scale及截圖；首輪額外CSS reflow重現面板不可達，不能將初版截圖當作可操作性通過。
- 初版Chrome/CDP trusted-touch完成source／ZIP的390／320寬、500高Moodle-like iframe四題四時刻兩種抓手、preview／取消及host／panel／只讀pan斷言。首輪審核發現tray metrics被active覆寫，以及preview一致性未驗齊；初版report不能當完整兩種target證據，修正版另補。
- 瀏覽器在sandbox內無法啟動，已使用獲准本機Chrome與臨時server；實體手機／真實Moodle gate尚未執行。本機證據不代表真實部署驗收。
- 上述證據為初版；新增完整repo回歸及獨立審核的結果將另記，修正後重跑受影響檢查。

## 2026-10-01 首輪修正及複審候選版本

- 依[第四位彙整報告](../docs/reviews/2026-10-01-motion-composition-final-review.md)修正F01–F05及V01：分類嚴格字串型別／非法pending鎖定、短CSS viewport兩欄重排、多指取消保留owner至全部touch結束、只讀提示及播放停止文字同步，以及兩抓手完整metrics／preview一致性驗證。
- N01對齊：只標selected Xᵢ／Yᵢ，較小圖域使用圖例與面板時刻；回饋／預覽使用真下標、math變量及正體單位。參考模式補顯示兩列分運動，不改submitted observed或答案。圖域上緣增加8px，避免O與stage時鐘重疊。
- Preview先用內側頂角，必要時使用靠邊／底角避指；維持124×70px局部場景及3×比例。整個overlay為pointer-inert，正常pan入口不被截取；取消／結束時清除。完整矩陣實測所有待放／既有球均避開手指。
- 五套activity純測試通過，包含512 round-trips／合法續作及新增兩方向／軌跡非字串拒絕、score-zero非法pending的quarantine／retry／pagehide無寫入。
- `npm test`初版全repo退出碼0，證據`output/motion-composition-repo-tests.log`。修正沒有改shared或其他活動；其後重跑本活動全部純測試與完整source／ZIP browser regression。
- 修正版`npm run test:browser:motion-composition`退出碼0。四組source／ZIP×390／320各43 rows：16題時row各保存tray／active before／during／after與preview，8個多指案例、4種取消、15個host／panel／只讀pan；共128次正常拖放、32次多指打斷及同頁pan續作、16次touchCancel／lost capture／resize／圖外取消。report errors=[]。
- Preview取樣先等production cursor處理最後move，再核對工作點、主圖與preview球心、viewBox中心、約3×實際比例、讀數、避指、release保存位置及cleanup。兩種target分別留下所有owner／非owner metrics。
- 多指案例使用獨立Chrome target作新attempt，避免CDP在替換多指文件後停止送PointerEvents；每個案例都在同一活動頁完成取消後的正常host pan，未用新頁面代替owner解除的驗證。lost capture以release後下一個可信pointer event觸發，而非等待尚未派發的lost事件。
- Source／ZIP各在standalone及fluid iframe的320×225 CSS reflow（640×450的200%等價）實際檢查、捲至末端、提交並開參考圖。panel bounds=(160,86.40625,160,138.59375)，提交button全在視窗內、60.375px高、16px字，document／panel水平overflow=0。
- 新增actual DOM回歸涵蓋未觀察空白／分類先答review與reference、frozen／committed提示、非法draft技術鎖及actual viewport resize停止後再播放。普通十組布局及visual zoom保留；這些本機證據不代表真實browser UI zoom／實體手機驗收。
- 目錄啟用active；修正版`npm run check`、五套純測試、`npm run package:all`及working diff check皆退出碼0。新ZIP根manifest及全部13檔逐byte與目前source相同，包含active config。三位完整複審及第四位closure另補；真實Moodle／實體手機gate仍未執行。

## 2026-10-01 第二輪修正及最終複審候選

- 第二輪三位完整再審及第四位彙整關閉F01–F05／V01，另確認F06短viewport preview遮指／裁切及F07近原點文字碰撞；本段記錄依報告完成的修正。首輪段落的500px高矩陣成功不能代表短layout已通過。
- F06：magnifier移成app shell內的absolute、pointer-inert sibling。正常保持stage角落，短兩欄無可避指位置時放shell另一側；先render讀數，再量外框與lens實際尺寸選位置及精確3× viewBox，避免固定132px估算及stage裁切。
- F07：移除密集軸旁重複Xᵢ／Yᵢ文字，保留真下標圖例、選中粗圈、時刻controls。新增DOM文字bbox檢查亦發現P₁／y軸名接近，已將近軸名的Pᵢ放到可讀位置並限在plot內。正常十種viewport與C／D各時刻、submitted reference及短圖的必要文字均無bbox重疊。
- 本活動五套純tests通過；scene修正後另重跑其純test。512 production round-trips／合法續作、791／818／1061 bytes及所有rubric、enum、quarantine／lifecycle驗證不變。共享及其他活動無修改，沿用初版whole-repo npm test退出碼0，最終重跑本活動全部受影響回歸。
- 完整browser regression退出碼0，source／ZIP普通390／320寬四組各43rows仍通過；新增320×225 CSS viewport在非iframe及可捲動fluid iframe逐四題四時刻的tray／active拖放。兩路各36個short rows，合共128次正常short拖放、8次公開錯誤格點拖放及16次touchCancel；所有before／during／after owner、非owner、preview／release、真實scene／focus／3×、全框可視／16px避指及cleanup斷言通過，errors=[]。
- 短viewport全部136個正常／錯格preview完整位於shell、避開手指；lens橫豎實際倍率皆3。錯誤公開格點[2400,0]及[1600,0]照常保存，沒有正解磁吸。普通preview全部仍在stage內。照片與數據位於output/playwright/motion-composition-stroboscopic-lab/；舊失敗證據留作歷史，不作目前verdict。
- 最終npm run check、npm run package:all及working／base diff check退出碼0；根manifest及全部13個ZIP entries逐byte與最終source一致。此候選將交三位完整再審及第四位最終closure。真實Moodle／實體手機部署gate尚未執行。

## 2026-10-01 第三輪完整審核及文件同步

- 三位各自審核`850eae6`相對`origin/main`的完整branch，均覆蓋物理、精簡繁體文字、UI／手機、全部owner、評分／部分提交、phase／state、保存續作、SCORM／trust、standalone刷新、目錄／manifest／ZIP及測試。沒有分拆領域，也沒有新runtime finding。
- 三人獨立五套純tests及source／ZIP smoke（含完整短viewport可信touch）通過，核對Root普通完整矩陣與13檔ZIP source byte parity。各report保留首兩輪歷史及實際命令；第四位另行彙整，F01–F07、V01及N01均關閉。
- F08僅為文檔舊句：本文件布局段落已統一粗圈＋真下標圖例＋時刻識別；手勢表已統一實際button／select／checkbox與原生鍵盤操作。修正沒有改runtime、model／rubric／schema或套件，無需重跑已通過的程式測試；最終文件closure按第四位直接核對記錄。
- 本機證據及最終審核見[完整彙整報告](../docs/reviews/2026-10-01-motion-composition-final-review.md)。初版whole-repo`npm test`退出碼0，最終本活動全部受影響回歸、check／package-all／diff及ZIP一致性通過；沒有宣稱最終再次執行整repo。真實Moodle及實體手機gates保持未勾選。
- 原發現者及第四位已直接核對F08文件修正並關閉；第四位最終verdict為package-ready通過，所有本機findings清零。最終完成紀錄為docs-only，runtime／tests及13檔套件維持已審核的`850eae6`。
