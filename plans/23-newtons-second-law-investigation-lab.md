# 牛頓第二定律：公平測試與數據作圖實驗室

> **本輪短播放器補修：** 480px 闊／320px 高等短橫向畫面採 stage／panel 左右排列，避免舞台最小高度把 controls 擠出 viewport；保留字體與 touch target 尺寸，並核對最後控制可達。Summary/check 沒有舞台的頁面維持全高 panel。實際適用斷點及結果見[驗證記錄](../docs/mobile-scroll-repair-verification-2026-10-01.md)。

> **2026-10-01 手機滾動修復：** 已把空白／側帶交回 native，保留資料點、超出範圍點、force slider、preview 及取消交接。collect、三組 plot、conclude、check、submitted、pending 已驗；conclude／check 的正式版面沒有舞台，明列舞台手勢 N/A，仍驗面板。
> 實作位於 `codex/mobile-scroll-audit`；逐模式、host、尺寸及證據範圍見[修復驗證記錄](../docs/mobile-scroll-repair-verification-2026-10-01.md)，工作項目為[修復計劃](mobile-scroll-repair-plan.md) R07。共用規則由[製作指引](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)擁有。
> 以下較早的測試記錄保留為歷史證據；本輪本機 Chrome／可信輸入結果不代表已通過真實 Moodle、iPhone 或 Android 驗收。

狀態：**使用者已批准，已完成實作與 package-ready 驗收。** 2026-09-27 授權完成活動並 commit；所有改動在專用分支進行。

- 分支：`codex/newtons-second-law-investigation-lab`
- 規劃基準：`main`，`ab157da`。
- 依 `NEW-SIMULATION-PLAN-TEMPLATE.md` 建立；遵循[共同風格](00-shared-platform-and-style.md)及[製作指南](../docs/simulation-scorm-production-guide.md)。以下參數及分數為已批准的實作規格。

## 學生流程

本活動的主線是「設計公平測試 → 親自改變條件並量測 → 整理兩組數據 → 拖點作三幅圖 → 比較擬合及解讀係數 → 歸納有條件的關係」。

| 部分 | 學生要做的事 | 形成的學習證據 |
|---|---|---|
| 1. 設計與量測 | A 組探究加速度與合外力的關係；B 組探究加速度與總質量的關係。每組自行選擇改變量、控制量及量度量，手動設定小車總質量與合外力，逐次啟動及記錄 | 兩組各建議 6 筆記錄；至少 5 個不同自變量水平，數值有足夠跨度 |
| 2. 拖點作圖 | 用 A 組畫 a–F合，用 B 組畫 a–m，再用同一 B 組畫 a–1/m | 三幅各最多 6 點的學生作圖；每筆觀測與其圖點有固定對應 |
| 3. 擬合與比較 | 自選模型並擬合，回答係數的物理意義，將自己的係數換算結果與記錄比較 | 根據學生實際點位計算的曲線、方程、偏差及物理量解讀，不代換為正確點 |
| 4. 歸納與提交 | 判斷控制條件、正比／反比、圖線通過原點的意義，最後組合關係式 | 明確回答、檢查及提交；可交空白或部分作答 |

**首版設計**：以理想化水平小車及「可調恆力裝置」作具體場景；採用無摩擦模型與有限讀數精度，暫不加入隨機測量誤差。量測由虛擬感應器完成，把時間留給公平測試、作圖和擬合。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `newtons-second-law-investigation-lab`；以控制變量法探究 a、F合、m，分辨下降趨勢與反比例，理解以 1/m 線性化 |
| Learner task / main interactions | 兩組實驗的變量選擇、質量配重／力設定、啟動與記錄；三圖拖點、改點、局部吸附與觸控放大；四種模型擬合；結論與提交 |
| Runtime files / libraries and justification | 使用 HTML/CSS/JS、SVG、Pointer Events；檔案包括 `index.html`、`styles.css`、`main.js`、`model.js`、`experiment.js`、`graph.js`、`fitting.js`、`interpretation.js`、`scoring.js`、`persistence.js`、`ui-runtime.js`。沿用三個 shared 檔案，不增外部函式庫 |
| Assessment risk / trusted validation | `formative`，100 分、60 分達標；評核最終保留的實驗資料和答案，不按拖動次數或操作速度給分；不作高風險評核 |
| Out of scope | 滑輪實物安裝、摩擦補償、繩／滑輪慣性、碰撞或衝量、學生手工由 v–t 求 a、誤差棒／統計推論、自由匯入數據、教師題庫編輯、三維畫面 |

本版是一個按物理模型運作的理想化實驗環境，讓學生重現及分析關係；不能把模擬資料宣稱為獨立驗證自然定律的真實實驗證據。

## Catalogue metadata (`sim/config.js`)

已加入目錄及獨立 manifest；以下為實際 metadata。

```js
{
  title: "牛頓第二定律：公平測試與數據作圖",
  folder: "newtons-second-law-investigation-lab",
  categories: ["Mechanics"],
  description: "自行設計兩組公平測試、量測小車加速度，拖點繪製三幅圖並比較擬合，探究合外力、總質量與加速度的關係。",
  tags: ["physics", "mechanics", "newtons-second-law", "fair-test", "graph", "curve-fitting", "scorm"],
  status: "active"
}
```

## Physics or subject model

### 裝置、研究系統與量測

- 舞台顯示水平軌道、小車、配重、向右的恆力箭頭及虛擬感應器的速度讀數。裝置採概念化外觀，不複製特定品牌介面。
- 研究系統為「小車＋車上配重」；m 始終指這個系統的**總質量**。基本小車為 0.50 kg，每塊配重 0.25 kg。
- 本版忽略摩擦及空氣阻力；豎直方向的支持力與重力平衡，裝置提供的水平力就是水平合外力 F合。學生控制的是以 N 標示的力，不能把裝置功率檔位當作相同的力。
- 每次量測期間持續施加固定大小、向右的力；質量及力只可在量測間調整，初速度一律為零。
- 小車行進約 1 m 且首 1 s 採樣完成後便顯示 a 讀數，可立即加入本組資料；小車仍在同一恆力下繼續加速。最快的設定會在行進 1.2 m 時顯示，避免使用尚未發生的速度資料。虛擬感應器取首 1 s 的 v–t 斜率，量化為 0.001 m/s²；不在量測前顯示 F合/m 代入計算。
- 原始位置及速度由物理模型生成。可展開一小幅唯讀 v–t 圖說明 a 的來源；這幅圖不列作第四項作圖練習，也不評分。
- 軌道延伸至畫面右邊，小車行進至 x=2.80 m，整輛車離開畫面才結束動畫；量測期間不突然停車。動畫採真實時間，行程約 1.5–7.35 s；可記錄的時刻約 1–4.48 s。行進時不能改質量或力，已取得讀數可記錄一次或直接切到作圖；結束動畫不再產生讀數。重播不新增量測。減少動態偏好直接顯示行程完成及同一讀數。
- 行程、已顯示讀數的動畫標記與完成姿態只屬暫態；首 1 s 的觀測 tuple、評分及 model/schema/rubric 版本維持不變。中途離開保留已取得的 candidate 或已記錄行，重新載入不重播未完動畫，也不新增重複記錄。

| State variables | Update rules / formulas | Units | Calibration constants |
|---|---|---|---|
| 總質量 m | m = 0.50 + 0.25 i，i ∈ {0,…,6} | kg | 範圍 0.50–2.00 kg，包含基本車重 |
| 水平合外力 F合 | F合 = 0.20(j+1)，j ∈ {0,…,5} | N | 範圍 0.20–1.20 N；首版採正向非零力 |
| 真實 a、x、v | a = F合/m；v(t)=at；x(t)=x₀+at²/2 | m/s²、m、m/s | x₀=0.10 m，v₀=0；可記錄時刻 max(1, √(2×1/a)) s，離畫時刻 √(2×2.7/a) s；0–2 m 可見刻度，軌道延伸至畫外 |
| 感應器 a讀 | 以 t=0,0.1,…,1.0 s 的理想 v 值作帶截距直線最小平方斜率，再四捨五入至 0.001 | m/s² | 機械模型與視覺 frame rate 分離；a讀∈[0.100,2.400] |
| 質量倒數 u | u = round(1/m, 3 位小數)，顯示「1/m」 | kg⁻¹ | 作圖按表中已顯示的 u 值；理論比較另計未捨入值，計入讀數量化差異 |

同一設定重做會得到同一讀數；本版不偽造隨機噪聲。若將來加入測量誤差，另定 seed、儀器模型、重複量測與容差，不能每次刷新擬合時重新抽樣。

### 公平測試由學生負責

- A 題幹與導航明確寫「探究加速度與合外力的關係」，B 寫「探究加速度與總質量的關係」；不預選控制量。
- 每組各有「我要改變」「保持不變」「量度」三項，原生選單用中文量名，旁邊顯示所選量的數學符號 m、F合、a。錯誤或重複選擇是可保存的學生答案，不是壞資料。
- 兩組各自保留質量／力設定。新作答各組初始質量獨立等機會抽取0.50、0.75、1.25、1.50、1.75或2.00 kg，初始合外力仍為0.60 N，角色全未答；學生可以自行調到1.00 kg。沒有鎖定／防誤改控制，公平測試依保留記錄是否控制一致評分。
- 每次「啟動量測 → 看到讀數 → 加入本組資料」才增加一行。每組最多 6 行，不自動填下一行、不自動調下一級。
- 每組建議 6 行、至少 5 個不同自變量水平，跨度達可用範圍的 60%；可有一個重複測試。重複同一條件不能充當多個不同水平。
- 即使學生同時改了 m 和 F合，仍讓他記錄、作圖及擬合。提交前表格只呈現實際數值與操作狀態，不替他修正成公平測試。
- 原始讀數列不可任意輸入改寫；可刪除一筆後重新量測。更改控制器設定本身不改舊記錄。

### 示範資料（只供設計審查，不預填學生答案）

| 組別 | 保持不變 | 學生可自行取的水平 | 對應 a讀 / m/s² |
|---|---|---|---|
| A | m=1.00 kg | F合=0.20、0.40、0.60、0.80、1.00、1.20 N | 0.200、0.400、0.600、0.800、1.000、1.200 |
| B | F合=0.60 N | m=0.50、0.75、1.00、1.25、1.50、2.00 kg | 1.200、0.800、0.600、0.480、0.400、0.300 |

### 為何選這個裝置表示法

合外力與總質量必須對應同一研究系統。[OpenStax 的牛頓第二定律章節](https://openstax.org/books/college-physics-2e/pages/4-3-newtons-second-law-of-motion-concept-of-a-system)明確以系統的合外力、質量及加速度表述關係。

[PASCO 的實驗目錄](https://www.pasco.com/resources/lab-experiments/collection/88)同時列出風扇小車及懸掛物經滑輪拉車的做法；這支持保留核心探究流程而不綁定某一器材。此處的恆力裝置是本模擬的理想化設計，不宣稱重現某產品的實際性能。

若日後另做滑輪版本，對「車」的拉力是繩張力 T；對加速下降的懸掛物，理想情況 T=m懸(g−a)，不直接等於 m懸g。選擇整個車—懸掛物系統時，慣性質量亦包括懸掛物。這些器材及系統邊界問題適合另作進階內容。

## Responsive layout contract

沿用[三區排版](00-shared-platform-and-style.md#layout)及[手機操作契約](00-shared-platform-and-style.md#mobile-interaction)。

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header 放活動名、實驗 A/B 或三圖切換、檢查入口；stage 放小車或目前圖；panel 放變量設定、資料表、擬合及結論 |
| Desktop / tablet | ≥900px 左右排列，panel 建議 20–24rem；桌面投影用圖點／軸標籤約 18–22px，主要數值約 22px；不能只把手機 SVG 拉大 |
| Control-panel classification | `bounded split-panel`；記錄、選資料及擬合時需一直看見小車／圖表 |
| Phone stage and controls | 建議 stage 約 46dvh，採短高 reflow 保留可用 panel；一次只看一幅圖，三圖不並排縮小；選中的資料卡固定在 stage 內，無需拖過長表格 |
| Phone text | 控制及表格主要文字 16px，圖表必要刻度／座標至少 14px，target ≥44px；完整座標標籤只在拖動或尚未確認的鍵盤操作期間顯示，放手／確認／取消後隱藏 |
| Viewports | 320×500、390×500、390×600、390×844、橫向 740×360、桌面、短 iframe、toolbar 改變、200% zoom；無數字輸入框，軟鍵盤 N/A；有硬體鍵盤替代 |
| Scroll topology | stage 空白／左右各≥32px區域歸 host，panel 只捲自身；activity document 無第三個垂直捲動層；圖框範圍縮排確保點的 hit target 不侵佔側邊區域 |

## Navigation, submission and reset

採[依賴式導航及明確提交](00-shared-platform-and-style.md#submission-and-reset)，不以做齊為檢查入口的條件。

| Decision | Activity specification |
|---|---|
| Navigation | `mixed`：A/B 兩組互不依賴，可直接切換；每幅圖依其來源資料；三圖及結論可自由查看，空白狀態如實表示。建議順序呈現量測→作圖→歸納 |
| Final check access | 每個 editable 畫面均可進入檢查，包括量測未開始、未放點、未擬合；量測／drag 未完成時取消該暫態，保留已記錄資料 |
| Incomplete submission | 檢查表只列記錄／放點／擬合／回答數量，說明未答項不計分；明確「提交目前答案」，空白為 0 |
| Editable reset | 可清本圖作答、清本組資料或清全部；有資料時確認範圍。清本圖包含點位、擬合及解讀，不刪原始資料；僅答解讀亦可清本圖。清 B 資料影響 a–m 及 a–1/m 兩圖；清全部回初始設定及空白答案 |
| Scored / pending attempt | 同頁只讀，沒有清結果／重開；凍結提交只可重試原資料；獨立刷新／Moodle 續作依共用契約 |

| Step / question | Required upstream data and why | If missing or changed | Legal next actions / final-check route |
|---|---|---|---|
| A/B 設計與量測 | 本組設定在合法範圍；角色選擇可以未答或錯誤 | 不阻止量測；兩組不互相改值 | 改設定、量測、切組、看圖或檢查 |
| a–F合 | A 組已記錄行，才能產生對應資料卡 | 無行時顯示空圖／返回量測入口，不造假數據 | 放已有點、選模型、返回量測或檢查 |
| a–m、a–1/m | 同一 B 組已記錄行；1/m 欄由 m 計算 | 不以另一幅圖放完／擬合成功為條件；兩幅各自保留學生點位 | 自由切圖、作圖、擬合或檢查 |
| 修改資料 | 改滑桿不影響記錄；增加／刪除已記錄行會影響對應圖 | 新行增加待放點；刪除只移除該行所對應點，其餘點保留；相關圖擬合結果失效，模型選擇保留 | 重新作受影響的圖／擬合；另一組不改 |
| 歸納 | 可以無資料或部分資料，答案獨立保存 | 改資料後保留文字選擇，提示需自行重看依據；不自動改答案 | 回看兩組／三圖、改答案或檢查 |

## Diagrams, notation and assistance

### 三幅圖及拖點

| 圖 | 資料來源 | 橫軸 | 縱軸 | 課程上的預期觀察（非預畫答案） |
|---|---|---|---|---|
| a–F合 | A | F合 / N | a / (m/s²) | m 保持不變時，直線接近通過原點 |
| a–m | B | m / kg | a / (m/s²) | F合 保持不變時，a 隨 m 增大而下降，曲線彎曲 |
| a–1/m | 同一 B | 1/m / kg⁻¹ | a / (m/s²) | 同一資料經橫軸轉換，可得到接近過原點的直線 |

- 軸及單位預先印好，不另考畫座標軸。F合 的「合」用真正下標，a、m 用一致數學字體；圖名一律先列縱軸。
- 舞台 t、v、感應器圖及面板公式沿用同一 math serif 字體、斜體變量及正體數字／單位。原生 select 保留中文名稱與原生鍵盤／手機操作；變量符號在選單旁、擬合公式在選單下方以 HTML var/sub/sup 顯示，不在 option 內嵌 LaTeX。
- B 表格顯示 m、a，打開倒數圖時增加可讀的 1/m 欄。這是已知資料的數值轉換，不自動替學生放點。
- 在資料表選取一行後，stage 顯示可拖的資料卡，例如「B3｜m=1.00 kg｜a=0.600 m/s²」；拖動卡片手柄進入圖框即建立圖點。卡片在窄手機亦一直可見。
- 圖內保留淡網格、較清楚的主格線和足夠刻度。拖動時顯示即時座標、對軸投影虛線及資料行標記；不顯示「答對」顏色。
- 已放點可反覆拖動，也可在列表選點後鍵盤移動；重疊點以列表逐一選取並將選中 target 置頂。每個資料行在每幅圖只對應一個點，不能複製成額外證據。
- 鍵盤新增點先把尚未確認的游標放在圖框中央，不能直接定位到本行正確座標；方向鍵每次移該軸小格的1/10，Shift+方向鍵移一小格，不套用滑鼠／觸控的近距吸附，避免小步被吞掉。起始已超框的點沿真實座標微調，縱座標保留快照合法的0–3範圍，不一下夾回顯示軸上限；邊緣抓手的即時座標標籤顯示真正數值。正常框內點仍在目前圖框內步進。Enter才保存，Escape、Tab及離開原操作元件的焦點均取消未確認位置；操作綁定原來的點及元件，不能在另一點上誤存。
- 放手時按最終指標座標解析落點及既有吸附；若座標沒有再移動，沿用目前預覽。既有點由按下位置量度拖動啟動距離：mouse需3 CSS px，touch/pen需6 CSS px；未達門檻的點按或輕微抖動保留原點（包括超框座標）及擬合，超過後即使回到起點附近仍按拖動處理。資料卡可直接拖放，不受此點按門檻限制。首次放手在圖外取消；已放點拖出圖外則回復原位置。沒有「一鍵自動放好全部點」。
- x 軸範圍：F合 圖 [0,1.4]，m 圖及 1/m 圖 [0,2.25]。y 上限依來源 a讀最大值的 1.1 倍，向上選 {0.2,0.25,0.3,0.4,0.5,0.6,0.8,1,1.2,1.5,2,2.5,3}；空表用 1。B 兩圖共用 y 範圍。
- 點位以數據座標保存，改版面及尺度不改學生答案。刪資料導致 y 尺度縮小時，原有錯點若超框，顯示帶真實座標的邊緣抓手供再拖／刪除；計分及擬合仍用原始座標，不能暗中夾回正確範圍。

| Decision | Activity specification and reason |
|---|---|
| Notation | F合、a 是一維正向的大小，m 為總質量；除最終歸納外不預示 F合=ma；1/m 單位 kg⁻¹；擬合係數不用 a 命名，以免混淆加速度 |
| Arrow graphics | 裝置箭頭只表達正在施加的水平力，圖例和 F合 讀數一致；沿用單一填色箭頭、尖端精確；圖點用圓點，不畫成力矢量 |
| Snap | 使用者要求的「靠近正確位置才吸附」：只對已在資料卡公開的座標做局部吸附，不查理論直線／F合/m 生成另一答案。touch/pen 入 10 CSS px、離 14px；mouse 入 6px、離 9px。一般可見網格交點亦用同一規則；若公開資料座標與網格都在範圍內，優先該資料座標。範圍外保留錯點，沒有遠距拉點 |
| Touch preview | 資料卡放點、既有點修改及超框抓手必需；提供2×真實圖表裁切的網格、目前點及準星，旁邊獨立顯示吸附後座標、物理量與單位，不放大裁切文字；穩定角落避手指、不攔截輸入；完成／取消／切圖／提交後即消失。粗調力滑桿與加減配重不需要 preview |

已知數據座標是讀圖任務的輸入，局部吸附只減少手指精度要求。若日後新增未知數據預測題，不可沿用「吸附至答案」的做法。

### 擬合與解讀

| 選項 | 模型 | 最少數據／定義域 |
|---|---|---|
| 直線 | y=kx+b | 至少 2 個已放點，x 不全相同 |
| 過原點直線 | y=kx | 至少 2 個已放點，至少 2 個不同 x，Σx²>0 |
| 二次曲線 | y=px²+qx+r | 至少 3 個不同 x，設計矩陣滿秩 |
| 反比例 | y=k/x | 至少 2 個不同 x，所有參與點 x>0 |

1. 只用**學生當下已放置的點位**作最小平方擬合，所有已放點一同納入；未放點不偷偷用原始資料補入。顯示「本次使用 n 個已放點」。
2. 重複 x 本身不刪除；秩不足或反比例遇到 x=0 時，說明數學原因，保留學生點和模型選擇；不能為了成功擬合暗中略過問題點。仍可檢查、提交。
3. 顯示擬合曲線、方程、參與點數及 RMSE；直線另顯示截距 b。首版不以 R² 排名或自動選「最好」模型。
4. 學生可輪流選模型比較。提交前這些擬合結果屬明確批准的探究工具；不額外展示正確曲線、正確點位、正確控制量或評分。
5. 改點／增刪資料後，舊曲線隱藏並標示需重新擬合。方法選擇留下，只有按「擬合」才產生新結果。
6. 不把「是直線」直接解釋成正比；還要看截距是否接近零。a–m 向下彎亦不足以單憑形狀宣稱反比，要結合 a–1/m 或 ma 近似固定的證據。
7. 二次式能在 p≈0 時退化成直線，不能只因選了二次就宣稱物理錯誤；回饋會指出有無必要使用額外項，以及哪個模型更簡潔。精確穿過少量點亦不是證明某定律。
8. 算法採縮放／中心化與 QR 最小平方求解；正比及反比例用其單參數解析最小平方式。秩判定相對最大 QR 對角量為 1e−10；有限點也須檢查係數／預測值有限，失敗不儲存 NaN。
9. 顯示精度不降低內部擬合精度。反比例曲線只畫 x>0 的圖框內部分，遇到漸近線須裁切，不能連線穿過 x=0。

### 2026-09-27 修訂：把擬合接回物理量

使用者要求每幅圖直接詢問係數的物理意義，不把解讀只放在最後歸納。本修訂採用以下契約；下文首版 rubric/schema 及已完成證據屬歷史版本。

- 每幅圖在擬合結果下提供「解讀這幅圖」：a–F合 的直線斜率對應 1/m；a–m 的反比例係數對應 F合（不是這條曲線的斜率）；a–1/m 的直線斜率對應 F合。題幹明確以正確控制變量及相應模型為條件，四個選項為 m、1/m、F合、1/F合。
- 顯示學生實際點位所得的係數、單位及截距，方程使用 a、F合、m 軸量。選擇意義後，按該選擇計算 k 或 1/k，**保留運算真正產生的單位**，再列出學生記錄中的相應質量或力作比較；不把錯選的單位改成正確單位，也不宣稱這個選擇已答對。此項明確批准的探究工具不替學生選答案、放點或改數據。
- 未擬合、擬合失敗或模型不提供相應係數時，不捏造斜率或質量；零／負係數不拿來宣稱本實驗的正質量／正向力。僅有貼合曲線不足以證明物理關係：仍須核對控制量、圖點、單位及直線截距。a–m 的反比例參數 k 單位為 N，不能把曲線某點的切線斜率當成 k。
- 每個 meaning 答案是獨立概念判斷。改點、換模型、增刪記錄會使擬合失效及隱藏換算，但保留 meaning 供重看；清本圖／清來源組則連同該圖 meaning 清空。任何空白／部分狀態仍可檢查及提交，未答為零。
- 新 attempt 用 schemaVersion=2、modelVersion=1、rubricVersion=2。三個 plot 各新增 `meaning:null|mass|inverse-mass|force|inverse-force`；其他權威欄位不變。新 rubric：公平測試30、放點30、擬合15、三圖解讀15（每題5）、五項歸納10（每題2），仍共100分。概念分獨立於作圖／擬合分，不重複扣同一錯點。
- 嚴格支援版本組合 (schema,rubric)=(1,1),(2,1),(2,2)，model 均為1。有效的 v1 草稿在 decode 後升至 schema2、新 meaning 全 null，**保留 rubric1 原計分**；新增解讀為不計分練習，保留已完成部分的原分數。v1 review／pending 不升級，仍按原 rubric 重算及重試；不更動已提交分數。新 schema 缺 meaning 或未知版本組合均拒絕，不能當成未答。舊 attempt 清全部仍保留原 rubric。
- 所有新 meaning 狀態（未答、正確、錯誤、無有效擬合、改圖後待重擬合）在各 graph 及 review-edit 返回路徑均要 production encode/decode/restore 後執行合法續作；另測 v1 draft 升級後作答、v1 review 只讀及 nested pending 重試、版本混配拒絕、部分分及 4000-byte 上限。
- 角色設定的鎖定改名「防誤改／解除防誤改」，一句說明其可選用途；不使用仍可量測，不自動選控制量，亦不按防誤改按鈕評分。桌面／手機以滑鼠與手指提示為主，移除可見的鍵盤放點按鈕及鍵盤說明，保留資料卡／圖點的原生焦點及快捷鍵，輔助說明只供輔助技術讀取。
- 歸納題、選項、圖表解讀及回饋使用相同 math serif／斜體變量／正體單位與描述下標，不增加外部排版依賴。新增純 `interpretation.js` 與單元測試，列入 manifest、HTML 及 test runner；執行本機 source／extracted ZIP 的完整互動、touch、舊新快照及 repository gates。

### 2026-09-28 修訂：自由設定與隨機初始質量

- 依使用者要求刪除質量／力的鎖定按鈕、說明、事件及阻擋邏輯。量測動畫中保持既有不可改條件的規則，確保單次觀測仍對應恆力及固定質量；量測之間可以直接調整兩者。評核風險、rubric及容差不變，不因錯誤控制量再重複扣忠實作圖的分數。
- 新作答使用上述六個初始質量（排除1 kg），A/B獨立抽取；僅隨機化起始器材設定，不加入讀數噪聲。新Moodle attempt、獨立刷新、未提交時明確清全部及可恢復損壞草稿的重設會重新抽取；一般導航、繼續量測及同attempt恢復不抽取。隨機結果直接保存於既有settings，不需seed或額外隱藏參數。
- schemaVersion升3、modelVersion維持1、rubricVersion維持原值（新作答2）。新draft的setup恰好為`{settings:[massIndex,forceIndex],candidate:null|tuple}`；schema1/2仍嚴格驗證原有locks欄位。有效舊draft驗證後轉為schema3並刪除locks；原settings、candidate、角色、記錄、點位、解讀、導航及分數完整保留，schema1補meaning=null。舊review/pending維持原版本與原答案，不能重抽或改分；未知版本／欄位混配仍拒絕。
- 新variant矩陣涵蓋六個初始質量×兩組的空白／已量測待加入／已記錄狀態，經production encode/decode/restore後執行調整或記錄及提交；另測36種A/B初值組合、手動選1 kg、改控制量會失去控制一致分、schema1/2所有locks組合的續作、各舊review/pending重試。既有全部phase與partial/blank/frozen契約繼續適用。
- A/B導航及面板標題使用完整關係名稱；窄畫面允許導航標題換行，維持44px可按尺寸及三區域布局。source/extracted SCORM需驗證320px手機與短iframe的可讀性、觸控調節、隨機新作答、保存續作與完整提交；全項目gates照製作指南執行。

### 2026-09-28 reviewer 修訂：作圖落點與鍵盤微調

- GPT-6 Luna（Max）與 GPT-6 Sol（Max）各自審查整個活動的物理、介面、用字及邏輯；核實後針對最終放手座標、鍵盤細步吸附及切換焦點的未完成操作修正。複審再加入既有點按／拖動門檻，避免自然抖動觸發吸附或把超框點改回框內，並保留超框點的鍵盤小步編輯真值。物理模型、權威答案、schema、rubric、吸附半徑及觸控預覽契約不變。
- 新增 production UI 回歸：最後 move 與 up 不同時按放手座標保存，沒有 move 的有效放手仍可放點，圖外放手取消，單純點按及門檻內有／無move抖動保留原點及擬合（含超框點），mouse/touch/pen跨門檻後可正常改點；桌面及320px短畫面從正確點／任意錯點作單步及Shift步進，超框點另核對單步、可見真實座標、Enter保存、Moodle草稿恢復、反向步進及Escape取消，Tab／focusout不保存上一點也不改錯點。
- 上述測試在source及實際extracted ZIP執行並納入既有browser runner；修正後交兩位reviewer複審，驗證結果另記於文末。

### 2026-09-28 使用者修訂：預覽座標與下一步

- 手機及筆輸入的預覽窗使用獨立、固定位置的座標讀數，依目前圖的橫／縱物理量及單位顯示吸附後的實際工作座標；不能用資料卡的預期座標代替。讀數不在放大裁切區內，旁邊保留2×同一場景的網格、點及十字準星，移除裁切場景內的文字，避免半截標籤。預覽高度隨stage短高調整，角落須避開手指；結束、取消、切頁及失焦時清空讀數及預覽。
- 主圖的座標文字及對軸投影線只在實際拖動／鍵盤工作座標存在時顯示；放手、Enter確認、Escape／失焦取消後立即消失。原始資料卡保留題目數據，已放點的選中狀態、超框標記及輔助技術座標仍保留；不改已存座標或評分。
- 導航按鈕顯示未開始／作答中／已作答及總進度，當前頁維持獨立的選中框。完成標色只指填答狀態，不表示正確。組別的完成條件為3個角色已選及6筆記錄；圖表為至少1筆來源、全部來源點已放、已按擬合及已答可見的解讀題；歸納為5題已答。錯誤角色／錯點／失敗擬合／錯誤解讀仍按相同行為計完成度，不預先評分。
- 面板底部提供可見進度及一個主要「下一步」：A量測→a–F合作圖→B量測→a–m→a–1/m→歸納→檢查；若B組已填齊，可由a–F合直接去a–m。未完成亦可往下，既有直接導航及空白／部分檢查提交保留。提交後及待確認狀態隱藏此編輯流程提示。
- 評核風險、物理、rubric、schema、權威答案及phase矩陣不變；完成度與下一步全部由現有答案及目前phase推導，不持久化任何新旗標。刪點、換模型、增刪數據及清除後進度同步回退；production草稿還原後重建同一進度並可經下一步合法續作，舊schema無解讀題不憑空要求答案。
- 測試決策：擴充現有graph純測試及browser runner，驗證拖動時有座標／放手和取消後無殘留；source及extracted的320／390px、短iframe、三種圖與觸控／pen預覽有清楚且不裁切的真實座標及單位（包括錯點及吸附點）。覆蓋全空／部分／已填齊的按鈕狀態、下一步完整鏈、clear與依賴變更回退、還原續作、review／pending不出現下一步，以及新介面下完整trusted-touch矩陣與原計分流程。

## Touch gesture ownership contract

依[完整觸控契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)實作；本機來源與解壓包的驗收證據見文末；實機 Moodle 另驗。

| Target type | Selector / hit area and size | Stable capture target / pre-pointerdown touch-action | Keyboard alternative |
|---|---|---|---|
| 力設定滑桿 | `.force-range`，高≥44px | native range 穩定節點；操控區在 pointerdown 前設 none | 方向鍵及 ±0.20 N 按鈕 |
| 待放資料卡手柄 | `.data-point-source`，≥44×44px | stage 中穩定 HTML target、none；drag 中不重建 | 聚焦資料卡後 Enter 開始，方向鍵微調、Enter 確定、Escape 取消；無可見鍵盤專用按鈕 |
| 已放點 | `.plot-point-hit`，≥44×44px | 依圖及行建立穩定 HTML target、none | 表格選點、方向鍵、Enter；Delete 移回待放 |
| 超框點邊緣抓手 | `.offscale-point-hit`，≥44×44px | 只改顯示位置，不改儲存座標；穩定 target、none | 列表選取後重新放點／刪除 |

配重、記錄及擬合按鈕是普通點按，按鈕外 panel 保持正常捲動；不把整張資料表設成拖曳區。

| Touch starts on | Owner | Activity strategy / region dimensions | Source and packaged evidence |
|---|---|---|---|
| 非互動小車場景／圖框空白／坐標軸 | Host | pan-y；點選開始放點模式也不建立全圖 touch-action:none 層 | source/package、320/390px，上下 trusted swipe 通過 |
| Panel 中段及上下邊界 | Panel | 只捲自己；邊界不連鎖捲 host | source/package、320/390px 通過 |
| 左 stage strip | Host | ≥32px，點 target／preview 不覆蓋 | source/package、320/390px，獨立上下 swipe 通過 |
| 右 stage strip | Host | ≥32px，同左 | source/package、320/390px，獨立上下 swipe 通過 |
| 力滑桿 | Simulation | 只有力設定改變，其他幾何及所有捲動位置固定 | source/package、320/390px 通過 |
| 資料卡→圖 | Simulation | pointermove/up、預覽、吸附；拖出界取消；固定全部非 owner | source/package、320/390px，三幅圖各通過 |
| 已放點／重疊點／超框抓手 | Simulation | 修改指定行；drag 時同一 target 維持 capture | source/package、320/390px 通過 |
| 已提交／pending 舊 target 處 | Host | 不可改答案，移除 drag ownership | source/package、320/390px 通過 |
| 自由繪線 surface | N/A | 本版只放資料點及計算曲線，不設全圖自由繪線層 | N/A |

- 同源 Moodle-like iframe 優先沿用已驗證的 host forwarding；只轉送到 enclosing host，不轉送給 sibling panel；記錄這是 forwarding。跨來源 Moodle 另驗收，不先宣稱可行。
- 驗收 source／extracted package 全矩陣，記錄 trusted pointer、前後座標、host、iframe bounds、activity document、panel、雙方 visual viewport。量測動畫使用可控制時鐘，避免與手勢副作用混淆。
- 多指／cancel／lost capture／viewport 改變要取消未完成圖點修改，復原已保存座標並清 preview；pointermove 不保存草稿。

## Scoring and tolerance

以下為首版 rubric；顯示給老師與審查者，不在提交前逐點報正誤。

| Decision | Activity specification |
|---|---|
| Rubric | 公平測試 30；三圖放點 30；模型選擇與擬合 15；五項歸納 25；總分 100，達標 60，最低 0 |
| Granularity | 分開判斷原始實驗設計、忠實繪點、擬合方法及物理結論。資料控制錯誤不抹去正確讀取自己數據的作圖分；錯放點仍可取得正確方法／概念的獨立分 |
| Unanswered / null | 角色及結論未答為 null；記錄空陣列；每行未放點為 null；模型未選為 null；未按擬合為 false。所有 default 設定及示範動畫不給分，完全未操作為 0 |
| Extras / duplicates / penalties | 每組最多 6 行，一行一圖點；重複量測保留但不算新的自變量水平。不另扣負分，不評點拖得快慢、次數或整潔 |
| Tolerances | 放點 x、y 分別以該圖數據座標軸跨度的 0.5% 作對稱誤差上限，且不小於 0.001；包含邊界。例如 F合 軸跨度1.4，x容差0.007 N。評分容差依來源表決定，與螢幕 px 吸附半徑分開 |

### 分項可重算規則

- **公平測試每組 15 分**：三個角色選擇各 1 分；實際控制一致性 6 分；取樣 6 分。設 n 為保留行數、h 為正確控制量取相同值的最大子集行數，n<2 時控制分為 0，否則為 `6(h−1)/(n−1)`。h 同票時先取自變量不同值最多，再取跨度最大，最後按控制值數字最小者，確保重算唯一。
- **取樣**：在上述子集內，u 為自變量不同值數，d 為最大減最小，D 為可設定全範圍（F合 為1.0 N，m為1.5 kg）。分數 `6×min(u/5,1)×min(d/(0.6D),1)`；無資料為0。學生介面事先說明需有不同水平及足夠跨度，但不自動代選。
- **每圖 10 分**：固定以 6 個記錄名額計；每個存在的已放點，x及y符合本行顯示讀數各得 `10/12` 分，缺行／未放座標得0。用 a讀 和已顯示的 1/m 作對照，不拿未捨入理論值扣分。
- **每圖擬合 5 分**：模型選擇3分、本人按擬合且求解有效2分。a–F合／a–1/m 的直線或過原點直線得模型3分；a–m 的反比例得3分。前兩圖若選二次、實際二次項在已放 x 範圍內的最大貢獻≤y軸跨度1%，得模型2分並解釋可簡化；其餘不適合模型0分。求解有效的操作分不以點位是否正確為條件，不重複扣作圖錯誤。
- **歸納每題5分**：①固定m時a與F合正比；②固定F合時a與m反比；③直線須接近過原點才支持正比；④僅見a–m下降不足以確認反比，a–1/m近過原點直線提供進一步證據；⑤在本活動SI單位及一維情境組合為F合=ma。全為明確選項，初始不預選；答對仍保留概念分，但回饋可指出其自身數據尚不足以支持。
- 最終回饋依次指出控制條件、表格→點位、學生點位→擬合、擬合→結論的問題。參考點／參考曲線只在提交確認後以明確開關顯示，不覆寫「我的圖」。
- 容差邊界測試須用全精度：例如0.007剛好接受、0.0071拒絕；視窗縮放、資料列順序與擬合顯示位數不能改分數。

## Phase/state matrix

`phase` 只有 `collect`、`plot`、`conclude`、`check`；review/frozen 等由 shared outcome 決定。量測中和拖點中是未提交的暫態，不持久化半次操作。

| Phase / variant | Current step | Required semantic state | Absent / retained data | Legal continuation / final-check route |
|---|---|---|---|---|
| collect／新開或空表 | group 0/1 | 合法控制器設定、空記錄；角色可全 null | 兩組其餘資料按各自狀態保留 | 改角色、開始量測、切組、看圖或check |
| collect／讀數就緒待加入 | group 0/1 | candidate為完整觀測；來源設定匹配該次量測；小車可以仍在行進 | 既有表格、圖點不變；動畫時鐘不保存 | 立即加入或check；行程完成後亦可捨棄／重測 |
| collect／部分記錄 | group 0/1 | 1–5行；角色可對可錯、設定可自行改變 | candidate可有／無；已有下游圖點合法 | 再測、刪行、作圖或check |
| collect／六行 | group 0/1 | 6行，可能重複／控制不一 | 不自動刪舊行以加入第7行 | 刪指定行再測、作圖或check |
| plot／無來源 | graph 0/1/2 | 對應空記錄、空點陣列 | 可已有模型選擇；不憑空造點 | 回量測、換圖、歸納或check |
| plot／全部待放 | graph 0/1/2 | 點陣列與來源行等長，項全null | 原始資料保留 | 選資料放點、選模型或check |
| plot／部分或全部已放 | graph 0/1/2 | null／合法座標混合；錯點及重疊合法 | 三圖獨立保存 | 拖點、清本圖、擬合或check |
| plot／擬合有效 | graph 0/1/2 | 非null模型、fitAttempted=true，派生求解成功 | 曲線係數不存 | 換模型、改點、換圖或check |
| plot／擬合失敗 | graph 0/1/2 | 非null模型、fitAttempted=true；不足點／秩不足／定義域問題 | 保留錯點，不把合法作答當損壞 | 改點／模型、回量測或check |
| plot／改動後未重擬合 | graph 0/1/2 | 模型保留，fitAttempted=false | 舊曲線不顯示；目前點位是權威 | 重新擬合或check |
| conclude／空白或部分或全答 | group/graph為null | 五個答案，每項為null或合法選項 | 資料、圖、擬合可空可部分 | 答題、回看／修改或check |
| check／空白或部分或全答 | group/graph為null | 所有權威作答，無偽造完成標記 | 待加入candidate不當成已記錄數據 | 明確提交或返回任一可編輯頁 |
| editable／從check返回 | 合法group或graph | returnToCheck=true，其餘對應上述任一合法variant | 全部獨立工作保持 | 編輯、切頁或返回check |
| review／空白、部分、完成 | review選圖為transient | 已驗證review答案及可信結果 | 無candidate、控制器暫態、returnToCheck | 只讀切圖、看回饋及參考 |
| frozen／上述三種提交 | shared state | 已驗證同一nested review及結果 | 不開改答、清除、重跑 | 重試同一提交；不合法則quarantine |

測試按 group×graph×內容變式×returnToCheck 做對應組合；不要只測「全空」及「滿分」兩條路。

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 改角色／設定 | editable且不是正在量測 | 保存語意選擇；改設定會清目前candidate，舊記錄不改 |
| 開始／取消量測 | editable、未滿6行 | 固定這次設定；切頁／離開取消未完動畫，保留已取得candidate或已記錄行，不新增行 |
| 讀數就緒 | 首1s採樣及約1m行程均已完成 | 建立candidate並保存；小車繼續行進；重播不重新取樣 |
| 加入記錄 | 讀數就緒且有candidate、少於6行 | candidate移入本組records；對應圖增加null、fitAttempted=false；不停止動畫，另一組不改 |
| 小車離開畫面 | 到達本次行程結束時刻 | 結束動畫並解除行進期間的操作限制；不建立candidate或重複記錄 |
| 刪行 | 指定行存在；有對應作圖時確認影響 | 只刪該行及相關圖同索引點，後續索引同步；清相關fitAttempted，保留其他點與選法 |
| pointerup／鍵盤確認 | 有working point | 一次atomic座標修改；相關fitAttempted=false；保存一次 |
| cancel／lost capture／viewport change | 有working operation | 回復原點／null、清preview；不保存半途位置 |
| 選模型／按擬合 | editable；方法合法 | 選模型置attempted=false；按擬合置true，派生結果可成功或數學失敗 |
| 清本圖／本組／全部 | editable，有資料時確認 | 分別清對應點及fit、該組records/candidate及相關圖、或全體初始空白；不清已提交／pending |
| check／submit | 任一合法editable／check | check只改導航；submit評分最終保留的內容，走shared四outcomes |

## Persistence contract

採[快照與恢復契約](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)。以下表格保留首版schema1的歷史定義；現行schema3及相容政策見上文2026-09-28修訂。隨機初始質量以實際settings保存，讀數無隨機項，不需seed。日後噪聲版要升modelVersion，不重新解讀舊資料。

| Snapshot | Exact schema / field types / allowed values |
|---|---|
| Common answers | `schemaVersion:1, modelVersion:1, rubricVersion:1, groups:[gA,gB], plots:[pAF,pAM,pAU], conclusions:[c0,…,c4]`；長度固定，不接受缺欄冒充未答 |
| Group answer | `roles:[changed,controlled,measured]`，每項null或`mass/force/acceleration`；`records`為0–6個觀測tuple；角色重複是合法錯答 |
| Observation tuple | `[massIndex,forceIndex,aMilli]`；index分別整數0–6、0–5；aMilli整數100–2400且等於該modelVersion的量測結果。學生不可直接改讀數，矛盾觀測為無效資料 |
| Plot answer | `{points, model, fitAttempted}`；points與對應records等長，每項null或`[x10000,y10000]`；x界限圖0為0–14000，圖1/2為0–22500；y為0–30000。model為null或`linear/origin/quadratic/inverse`；fitAttempted為boolean，model為null時必須false |
| Conclusions | 固定5項，各null或該題已登記的4個選項enum之一；映射由rubricVersion固定，不以UI選項位置代表語意 |
| Draft-only | `phase, group, graph, returnToCheck, setups`；setups恰好2項`{settings:[massIndex,forceIndex], locks:[boolean,boolean], candidate:null或完整觀測tuple}`。candidate存在時須匹配該組目前settings；6行時不允許新的candidate |
| Navigation | collect:group∈{0,1},graph=null；plot:group=null,graph∈{0,1,2}；conclude/check:兩者null；check的returnToCheck=false，其餘boolean |
| Review | 只存Common answers；不包含Draft-only。結果與passed只放shared比較metadata，曲線／分數由權威答案重算 |
| Unanswered encoding | 依上表null／[]／false；模型選擇、錯點、數學失敗及非公平測試是合法學生答案，不因錯誤而quarantine |

五題結論的v1選項enum依次為：`direct/inverse/quadratic/independent`；`inverse/direct/inverse-square/independent`；`near-origin/any-line/positive-slope/negative-slope`；`linear-reciprocal/decrease-only/few-points/curved-only`；`f-ma/f-m-div-a/f-a-div-m/f-m-plus-a`。每列首項是評分鍵，學生介面不預選；文字依上文五項歸納完整呈現，尤其第四題的`linear-reciprocal`要明寫a–1/m近似通過原點的直線。

| State category | Activity fields and treatment |
|---|---|
| Authoritative | 已記錄觀測、角色選擇、每行圖點、模型選擇及擬合操作、結論；draft另有設定、鎖、candidate及導航 |
| Transient | 時間動畫、未完成量測樣本、drag/preview/capture、當前選中行、hover、展開說明及undo history；不存 |
| Derived | DOM IDs、資料行顯示編號、1/m欄、座標軸上限、fit係數／RMSE／錯誤、score、完整回饋；每次重建 |
| Version compatibility | 初版只接受v1；將來明示遷移或技術鎖定，不換模型重判舊attempt |
| Size | 上限12行、18個點、3模型、5結論；代表上限配置的draft/review/shared pending實測為1122/959/1196 UTF-8 bytes，均≤4000；測試見persistence.test.js |
| Invalid finished review | 保持只讀，僅顯示可信LMS摘要，不新開練習 |
| Invalid pending-final | 深層decode或rescore失敗先quarantine；不retry、clear或重新編輯 |
| Invalid editable draft | 技術鎖定；只有shared證明未提交時，可經確認覆寫新空draft；保存成功才恢復，未知或完成狀態不可清 |

points的array索引是與本組records的語意對應；追加、刪行必須在同一操作維護兩者長度，B會同時維護兩圖。未知多餘行、錯長度、非有限數、越界索引、dangling對應須拒絕，不能默默裁掉。

## Shared SCORM lifecycle

使用`SimScorm.loadAttempt()`、`SimActivityFlow.startup()`、draft provider及`SimScorm.submitWithCallbacks()`；不寫活動自己的raw LMS欄位或pagehide/commit/finish流程。

| Outcome / policy | Activity handler, controls and learner-facing message |
|---|---|
| Startup editable | 空白或完整還原，包括已量測待加入、錯點、擬合數學失敗及原來步驟；未完成動畫回到可重新量測 |
| Startup review / frozen / load-error | review重建並重算比對；frozen驗證nested review才允許原payload retry；load-error技術鎖定，不假稱交卷成功 |
| Submit success / committed | success只讀結果；committed保持答案凍結，清楚說明成績已記錄但結束程序未完成，只重試結束程序 |
| Submit frozen / retry | frozen不顯示已確認分數、保留同payload重試；retry依shared的retryable返回check或技術鎖定 |
| Review trust | 用`reviewResult()`比對重算／保存／LMS資料；mismatch/unknown不打開通用空白活動 |
| Standalone refresh | 記憶體練習；partial/check/submitted刷新全部重新開始。忽略舊storage，storage被拒仍可操作，不加使用者已拒絕的刷新提示句 |
| Moodle resume / recovery | 同一attempt保留設計、兩組數據、三圖、擬合及結果；只有Moodle供應新attempt才開空白。保存失敗提示重試，不冒稱已保存 |

## Test plan

2026-09-27 首版已執行以下測試，詳見文末命令與產物；其後修改的驗證另記於 follow-up evidence。

- [x] 42種m/F設定：N、kg及a單位一致，總質量包含車重，固定t窗口、無撞端；sensor斜率及0.001量化與解析解一致，frame rate／reduced motion不改結果。
- [x] 公平測試：A/B正確設計、互換控制量、同時變兩量、只一筆、重複值、樣本跨度、子集同票規則；不按鎖按鈕或操作次數給分。
- [x] 三圖資料依賴、1/m單位與捨入、每行唯一點、錯點保留、增刪同步、不自動改其他圖、超框抓手。
- [x] 最小平方已知解、錯點擬合、2點直線、3點二次、直線退化二次、重複x、秩不足、全y相同、反比例x=0、接近奇異、係數finite、曲線裁切。
- [x] Scoring covers blank/partial answers, independent credit, all tolerances and fit-selection degeneracy；plot分用顯示讀數、fit用學生點、原始物理讀數及三者不混淆。
- [x] 每個editable variant都可check/submit；全空0分；成功／committed／frozen沒有clear/restart。
- [x] 每個matrix row及所需group/graph/returnToCheck組合，用production encode/decode/restore round-trip、相同分數並執行一個合法續作。
- [x] 錯角色／錯點／不公平資料／求解失敗與真正損壞快照分開測；tuple、長度、enum、phase依賴、candidate及版本失敗封閉處理。
- [x] 最大draft/review/pending實測≤4000 UTF-8 bytes；setup/candidate不進review，權威圖點精度不損失。
- [x] 正式Controller與shared四outcomes、保存／commit／finish失敗、重試、pending quarantine、review trust、同attempt與LMS新attempt。
- [x] Source及extracted獨立partial/check/submitted刷新清空並可重做；舊draft/review/pending/corrupt及拒絕storage不誤恢復；Moodle fixture另驗保留。
- [x] 手機／桌面刻度、網格、點重疊、即時座標、snap entry/exit與2× preview、鍵盤、短高與200% zoom。
- [x] 所有touch target與host/panel/左右strip矩陣以trusted input在source及extracted執行；不以DOM dispatch或桌面滑鼠代替。
- [x] 新tests登記tools/run-tests.js，runtime依賴完整入manifest，metadata及slug一致。

## Package-ready checklist

- [x] 使用者批准計劃，學科模型、rubric、依賴、schema及觸控決策完整。
- [x] 上述模型、評分、擬合、persistence、lifecycle及瀏覽器驗收通過並記錄證據。
- [x] `npm run check`、`npm test`、`npm run package:all`、`git diff --check <base>...HEAD`通過。
- [x] ZIP根有imsmanifest.xml、runtime全部包含、不含測試／工具，逐檔與source核對。
- [x] built/extracted launch及全touch矩陣通過。

## Moodle-ready checklist

- [ ] 真實學生帳戶完成記錄、作圖、提交score/status。
- [ ] 同attempt刷新／離開重入保留草稿及已提交review，pending重試及Moodle新attempt政策正確。
- [ ] 實體手機current-window及可用new-window player完整手勢、scroll、preview及可達性驗收。
- [ ] 真實Moodle、跨來源iframe及實機證據與本機證據分開記錄。
- N/A：本版formative，不提供高風險評核的server-side validation。

## 已完成的實作次序

1. 先完成純物理、量測、資料模型與四種擬合的Node測試，確保公平／不公平及退化資料都能處理。
2. 建兩組實驗頁及候選讀數→記錄流程，再接三幅圖、資料卡拖放、錯點保留與手機preview。
3. 加入模型比較、結論、部分分、檢查及shared SCORM恢復／提交。
4. 完成source與extracted的響應式、trusted-touch和lifecycle驗收，再產生SCORM包。

**批准範圍**：理想恆力裝置、感應器提供a讀數、兩組各最多6筆、三幅圖、有限精度且無隨機誤差，以及30/30/15/25的評分比例，均已實作。結論選項的顯示次序固定分散；不按schema評分鍵的第一項順序排列。


## 2026-09-27 implementation evidence

以下記錄首版 `4aebd5d` 的驗證；1 秒後定格的舊動畫已由上文的「約 1 m 可記錄、繼續行至離畫」取代。

- 純測試：`node --test sim/newtons-second-law-investigation-lab/*.test.js` 通過6個檔案。包括42組實驗設定、已知最小平方解及病態／錯點資料、部分分與界線、資料增刪、100個production snapshot還原後合法續作、shared SCORM成功／committed／frozen／retry、quarantine及standalone無storage。
- 瀏覽器：`node tools/newtons-second-law-browser-regression.js` 在 **Chrome 154.0.8037.57 / CDP trusted touch** 通過。source及manifest實際打包後解壓的頁面逐檔一致；兩者皆由介面收集12筆數據、放18點、擬合及提交100分，亦驗證空白、錯點、數學失敗、鍵盤、clear取消／確認、續作、pending重試及standalone刷新。
- 版面：source/package各36個phase×viewport檢查（9個尺寸×4個階段），另驗200% visual viewport zoom；尺寸為320×500、390×500、390×600、390×844、768×900、1024×768、1280×900、740×360及320×400。
- 手勢：source/package各測320px及390px scrollable iframe，每組17類證據，涵蓋host空白、左右strip上下、panel中段／兩端、三圖資料卡及點位、重疊超框點、native力滑桿、multi-touch panel handoff、review／pending舊target歸host，以及圖外放手／blur／resize／lost capture回復。量度雙方viewport、host、iframe、panel及完整答案前後值；所有drag有trusted touch、move/up且正常完成不cancel。
- 短畫面補測：`node tools/newtons-second-law-browser-regression.js --short`於縱軸刻度修正後通過；source/package各再跑36項版面與320×400 fluid iframe的13類trusted-touch證據，見`output/newton-short-browser.log`及`short-report.json`。相同短畫面矩陣亦已納入預設browser runner。
- Preview：2× SVG裁切與目前點及網格一致，focus與已解析點重合、不遮手指、不攔截輸入、沒有重複ID；放手和中斷後清空。
- 修正過的實測問題：隱藏label造成額外document捲動、資料卡短暫hidden令鍵盤失焦、手機密網格的hysteresis搶走讀數吸附、320×400畫面的縱軸刻度過密；目前均有回歸檢查。短畫面依可用高度減少主刻度，保持14px字體；點位未改變時保留原擬合。
- 產物：`output/newtons-second-law-investigation-lab-scorm.zip`；本機測試記錄在`output/newton-unit-tests.log`、`output/newton-final-browser.log`、`output/playwright/newtons-second-law/report.json`，screenshots同目錄。這些是本機產物，依repo規則不提交Git。
- 全項目命令：`npm run check`、`npm test`、`npm run package:all`通過；`git diff --cached --check`通過，並在commit後執行`git diff --check ab157da...HEAD`確認。全項目test之後的短畫面刻度改動另完成6個單元測試及上述source/package短畫面驗收。
- 限制：以上是本機package-ready證據；**尚未使用真實Moodle學生attempt或實體手機**，不將同源測試iframe宣稱為跨來源Moodle或真實裝置驗收。

## 2026-09-27 follow-up evidence: early reading and complete cart travel

以下記錄 `25a6e80` 的驗證；其 schema/rubric 及 ZIP 已由下一節的圖像解讀修訂更新。

- 依使用者追加要求，約行進 1 m 後即可記錄；車繼續加速至完全離畫。首 1 s 感應器資料、觀測 tuple、schema/model/rubric version 1 及評分保持相容。t/v、感應器軸、選單旁符號、擬合公式與方程均採一致數學排版；原生選單只保留中文量名／方法名。
- 6 個純測試檔通過，新增 42 組設定的讀數時刻／首秒採樣先後、約 1–1.2 m 的可記錄行程、離畫位置及持續加速檢查；5 組舞台尺寸均驗證整輛車離畫，含 320px 窄畫面。日誌：`output/newton-followup-unit.log`。
- source 及實際 extracted ZIP 的完整瀏覽器測試通過（Chrome 154.0.8037.57 / CDP）：早期記錄不停止或重設小車，行程結束不產生重複讀數；首秒採樣未完成不提前顯示；讀數就緒時保存／還原後可重播及記錄，取消動畫無延遲讀數，reduced motion 的讀數一致。兩者各從介面記錄 12 筆、作 18 個點並完成 100 分流程，SCORM fixture 的 draft/review/pending/committed 及獨立刷新測試仍通過。
- source/package 各 36 個 phase×viewport、200% zoom、390/320px 各 17 類觸控證據與 320×400 短 iframe 的 13 類手勢均通過；`report.json` 無瀏覽器例外。證據：`output/playwright/newtons-second-law/report.json`、`motion-report.json`、`source-reading-while-moving.png`、`package-reading-while-moving.png`、`package-cart-exited.png`。
- 全專案 `npm run check`、`npm test`、`npm run package:all` 及工作區 `git diff --check` 均通過。完整日誌：`output/newton-followup-check.log`、`output/newton-followup-npm-test.log`、`output/newton-followup-package-all.log`。
- 最終 `output/newtons-second-law-investigation-lab-scorm.zip` 共 15 個檔案、44,034 bytes；逐檔與目前 source 相符。SHA-256：`6b492d509228e8296fc8a7bc9d187a3dbc6b6a2cc6a1b9aa4dee1c58cd1ea260`。真實 Moodle／實體手機的驗收仍未執行。

## 2026-09-27 follow-up evidence: graph interpretation and notation

以下記錄 `7e2e806` 的狀態；當時的防誤改控制及schema2新作答已由2026-09-28修訂取代。

- 三圖新增可保存／清除／提交的係數意義答案與真實擬合換算；新 attempt 的概念分分配改為圖像解讀15分、歸納10分，總分仍100。舊 draft 升 schema2 並保留 rubric1，舊 review／pending 以原版本重算／重試，部分分不改變。
- 7 個純測試檔通過：含各圖正誤選項的實際係數／單位、錯點導出的錯誤質量、零／負斜率、錯誤模型、控制量不一致、獨立部分分、190 個 production round-trip 還原後合法續作及舊新版本提交流程。最長 draft/review/pending 為 1200/1037/1286 bytes。日誌：`output/newton-interpretation-unit.log`；目前完整版本亦由 `output/newton-interpretation-npm-test.log` 執行。
- 完整 source／extracted ZIP browser regression 通過（Chrome 154.0.8037.57 / CDP trusted touch）：每幅圖的係數／單位與原始記錄比較、未答及錯答、模型變更後隱藏過時換算、從檢查返回後保存續作、僅答解讀亦可取消／確認清本圖、舊 draft/review/pending、提交後只讀，以及兩者各自從介面量測12筆、放18點並提交100分。
- source/package 各36個 phase×viewport、200% zoom、320/390px 各17類手勢及320×400短iframe的13類手勢通過；新增320/390px的解讀選項使用 trusted touch，確認答案保存、其他捲動位置不變。`output/playwright/newtons-second-law/report.json` 無瀏覽器例外，包含 interpretation、motion、flows 及 gestures 證據。
- 桌面三圖及歸納第4、5題的數學字體／下標已視覺檢查；手機解讀選項可操作。「防誤改」是可選控制；移除可見鍵盤按鈕／提示後仍通過鍵盤放點測試。畫面證據：`source-interpretation-0.png`、`source-interpretation-1.png`、`source-interpretation-2.png`、`source-conclusion-math.png` 及對應 package／touch 截圖，均在上述目錄。
- 最後核對時修正二次模型提示：二次項近乎零時可以近似直線，不宣稱所有二次模型都沒有固定斜率。此文字及其中 k 的數學排版修改後，另跑7個純測試、`npm run check`、`node tools/newtons-second-law-browser-regression.js --interpretation`；source/extracted 的三圖解讀、320/390px觸控、舊作答兼容及完整作答流程均重驗通過。日誌：`output/newton-interpretation-browser.log`，報告：`output/playwright/newtons-second-law/interpretation-report.json`。
- Repository gates：`npm run check`、完整 `npm test`、`npm run package:all` 及 `git diff --check` 通過；最後提示詞修改另按上列範圍重驗。日誌：`output/newton-interpretation-check.log`、`output/newton-interpretation-npm-test.log`、`output/newton-interpretation-package-all.log`。
- 最終 `output/newtons-second-law-investigation-lab-scorm.zip` 共16個檔案、47,191 bytes；manifest及每個runtime檔均與source逐檔相符，無測試檔。SHA-256：`94687e5e2aa7836e7b5835184c459cd4d49fc0aee858d0305efa2bb721240f2f`。
- 真實 Moodle 學生 attempt、跨來源 player 及實體手機仍未驗收；本機模擬 LMS 與 CDP 觸控證據不取代這些檢查。

## 2026-09-28 follow-up evidence: free controls and randomized starting mass

- 移除質量／力的防誤改介面與操作；A/B導航及面板均清楚指出加速度與合外力／總質量的關係。每組新起始質量等機會抽取六個非1 kg設定，學生仍可自行選1 kg。隨機值只在明確的新作答／重設時產生，Moodle同attempt恢復保留原值。
- 7個純測試檔通過：36種A/B初始質量組合、42種物理設定、226個production snapshot還原後合法續作、48種舊schema/rubric/locks組合升級後續作及保存、舊review/pending原版本重試與原分數比對。最長draft/review/pending為1156/1037/1286 bytes。日誌：`output/newton-initial-settings-unit.log`及`output/newton-initial-settings-npm-test.log`。
- `node tools/newtons-second-law-browser-regression.js --settings` 在source及實際extracted ZIP通過：逐個覆蓋六個初值、A/B換頁不重抽、手動調到1 kg、保存候選讀數後恢復不重抽、舊已鎖定draft可直接改值、同時改質量及力失去控制一致分、每邊12筆量測／18點／100分完整流程。六個初值以CDP測試頁注入可控制的亂數來源，產品沒有測試參數入口。
- 兩者各36個phase×viewport與200%縮放檢查、320/390px對新質量控制的trusted touch均通過；桌面、320px手機及320×400短畫面的完整關係標題已視覺檢查。證據：`output/newton-initial-settings-browser.log`、`output/playwright/newtons-second-law/settings-report.json`、`package-free-settings-desktop.png`、`package-free-settings-touch-320.png`及`package-collect-320x400.png`。
- 完整browser runner亦於source/extracted通過（Chrome154.0.8037.57）：320/390px各17類手勢及320×400短iframe的13類手勢，連同完整解讀、連續行車、舊新版草稿／review／pending／committed、standalone刷新及新attempt檢查；`output/playwright/newtons-second-law/report.json`沒有瀏覽器例外。
- Repository gates：`npm run check`、完整`npm test`、`npm run package:all`及`git diff --check`均通過。日誌：`output/newton-initial-settings-check.log`、`output/newton-initial-settings-npm-test.log`及`output/newton-initial-settings-package-all.log`。
- 最終`output/newtons-second-law-investigation-lab-scorm.zip`共16個檔案、47,102 bytes；manifest及runtime均逐檔與source一致，沒有測試檔。SHA-256：`2a706ab904914f8cf6ced349dbd055257f7cd75e83ba11fff0979886d6d8fbbd`。
- 尚未執行真實Moodle學生attempt、跨來源player及實體手機驗收；本機瀏覽器及模擬LMS的結果不代替這些證據。

## 2026-09-28 independent review and final verification

- GPT-6 Luna（Max thinking effort）及 GPT-6 Sol（Max thinking effort）分別獨立審查整條開發branch；兩位均涵蓋物理、介面、用字與數學排版、實驗／擬合／評分邏輯、保存恢復與SCORM。經多輪核實、修正及再次覆核，兩位最終均回報沒有未解決的可操作問題。物理模型、係數意義、題目文字及評分未有確認需要修改的缺陷。
- 合併兩位意見後處理的具體行為如下；全部已有對應production UI回歸：

| 已確認問題 | 最終行為 |
|---|---|
| 最後放手位置與最後move不同時仍保存舊位置 | 按有效pointerup位置及既有吸附規則保存；圖外放手仍取消 |
| 鍵盤小步被近距吸附吞掉 | 每鍵直接移動資料座標，保留Shift整格步進 |
| 切換焦點後可能沿用上一個點的工作位置 | 操作綁定原元件；Tab／focusout取消未提交位置 |
| 既有點的自然抖動可能誤吸附，甚至把超框點夾回框內 | mouse 3px、touch/pen 6px啟動距離內保留原值及擬合 |
| 超框點的一次鍵盤微調會跳到可見軸上限 | 按真實座標逐小步編輯，顯示實際標籤；保存、恢復及取消均保留真值 |

- 全專案`npm test`通過，日誌`output/newton-review-npm-test.log`。其後對複審新增的抖動／超框鍵盤修正，再執行全部7個活動純測試檔及完整Newton browser runner，均通過；最後`npm run check`、兩個改動JS的語法檢查、`npm run package:all`及branch diff whitespace檢查亦通過。日誌分別為`output/newton-review-unit.log`、`output/newton-review-final-browser.log`、`output/newton-review-check.log`及`output/newton-review-package-all.log`。
- 最終Chrome 154.0.8037.57／CDP報告`output/playwright/newtons-second-law/report.json`的`errors=[]`。source及實際extracted ZIP各通過36項版面場景、320／390px各17類trusted-touch手勢及320×400短iframe的13類手勢；兩者均從介面量測12筆、放18點、解讀及提交100分，並保留空白／部分作答、錯點擬合、草稿／review／pending／committed、獨立刷新及新attempt檢查。
- 新互動回歸在source及package各有8項落點／焦點證據、24項mouse／pen／touch抖動案例及2項超框鍵盤案例。超框y=3在1280px單步至2.995、320px單步至2.99，保存並production restore後可反向回3；Escape及失焦取消不改已存答案。實際座標標籤在兩種尺寸均完整位於stage內，已檢視source／package截圖；細節見`interaction-report.json`及`*-offscale-keyboard-{320,1280}.png`。
- 所有SCORM ZIP已於最後完整瀏覽器驗證後重新產生。最新Newton ZIP有16個檔案、47,436 bytes，逐檔binary核對當前source及根manifest一致；SHA-256：`37b4a67b830429991328b1fcb8cabcc0197f3a42cb03b83b0fe14b60e00bdb0b`。最終`main.js` SHA-256為`d9921bac57eaf235e3bcdcc9bdcf5181a16cd53cabec3b7103c4658e680c8ca9`。
- 此結論限於本機程式／瀏覽器／模擬LMS覆核；CDP觸控與筆輸入不代替實體裝置。真實Moodle學生attempt、跨來源player及實體手機的Moodle-ready驗收仍未執行。

## 2026-09-28 follow-up evidence: readable coordinates and next-step guidance

- 依使用者的實際手機截圖修正預覽：固定讀數區用16／18px粗體顯示目前落點的兩個數值、物理量及單位，旁邊保留2×局部網格與準星；裁切場景內不再複製文字。短stage使用較矮的預覽，保留避開手指的角落；放手／取消後清空讀數、浮動座標及對軸投影，原始資料卡仍保留題目數據。
- 導航新增未開始／作答中／已作答及總進度；目前頁以藍色框辨識。面板底部顯示放點／擬合／解讀進度與下一步按鈕，已作答時變色；進度標示不改答案或給分。完成度完全派生自原快照，沒有新增持久化欄位。作答中的標記使用不影響版面尺寸的內陰影，避免狀態變更令舞台跳位。
- graph純測試及完整Newton source／extracted browser runner通過，Chrome 154.0.8037.57；最終`output/playwright/newtons-second-law/report.json`的`errors=[]`。每個版本各有36項版面場景、320／390px各17類手勢、320×400短iframe的13類手勢，並完成12筆資料、18個點、100分提交及既有SCORM／獨立刷新流程。
- 新增`experience`測試在source及package各驗證12組預覽（320×400／390×600、三圖、touch／pen）：顯示真正工作座標而非資料卡答案、單位、文字邊界、2×比例、暫態不存檔及放手後清除。既有iframe touch矩陣另驗證吸附後讀數與落點一致、沒有被裁半截的SVG文字。Chrome會合併move事件，預覽與放手一致性測試在指標停留80ms後讀取已顯示座標。
- 各版本另有兩種手機尺寸的完整「下一步」鏈及進度案例：空白亦能到檢查但不自動提交、錯誤解讀仍標已答、草稿還原後可續作、刪資料／換模型／清本圖／清全部同步回退，以及舊schema review和pending不顯示編輯下一步。原有鍵盤超框真值測試更新為確認／取消後隱藏視覺標籤，保留已存座標及可存取名稱。
- 已檢視`source-coordinate-preview-320.png`、`source-coordinate-preview-390.png`與兩種尺寸的`source-progress-complete-*.png`，數值清晰、完成色與當前框可辨識，下一步可由面板捲到；package執行同一組幾何及文字驗證並保存對應截圖。
- 最後視覺覆核發現合外力下標及倒數質量符號接近數值，將讀數的符號欄由30px加闊至40px。此純排版修正後，重新執行`--experience`：source／extracted package各36項版面檢查及上述12組預覽均通過，新增文字區間不重疊的`separated`斷言；已再檢視`source-coordinate-preview-320-graph0.png`及`package-coordinate-preview-390-graph2.png`。最終報告為`experience-report.json`，日誌為`output/newton-coordinate-spacing.log`。
- Repository gates：`npm run check`、完整`npm test`、`npm run package:all`及工作區`git diff --check`通過。完整Newton矩陣在最後符號欄加闊前執行；該最後調整由上述source／package `--experience`重驗，之後再執行check及全部打包。日誌為`output/newton-coordinate-progress-check.log`、`output/newton-coordinate-progress-npm-test.log`及`output/newton-coordinate-progress-package-all.log`。
- 最新Newton SCORM ZIP共16個檔案、49,122 bytes，根manifest及runtime均與目前source逐檔binary一致。SHA-256：`47c84412be356671c3827c974831a7d1f2771d553a225114008efcee5dc2e935`。所有活動的ZIP亦已重新產生並由打包驗證器通過。
- 真實Moodle及實體手機仍未作本輪驗收；以上為本機Chrome/CDP、實際解壓套件及模擬LMS證據。
