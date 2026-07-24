# 勻速與勻變速：駕駛控制挑戰計劃

## 0. 文件狀態

- 文件角色：新 SimLab 活動的產品、教學、物理、互動、評分、持久化、SCORM 及測試規格。
- 計劃狀態：待用戶審查；未開始實作。
- 建議 slug：`kinematics-driving-challenge`
- 學生可見標題：`勻速與勻變速：駕駛控制挑戰`
- 參考活動：`linear-motion-velocity-lab`
- 參考規格：
  - `plans/00-shared-platform-and-style.md`
  - `docs/simulation-scorm-production-guide.md`
  - `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`
  - `plans/10-linear-motion-velocity-lab.md`
- 本文件一旦獲批，實作、評分、snapshot schema、測試及 packaging 均以本文件為基準；任何改變物理意義、關卡、評分或持久化契約的修訂，必須先更新本文件。

## 1. 目的與定位

建立一個手機優先的分關駕駛遊戲，讓學生用「按住／放開」油門及煞車控制一架沿一維道路前進的車，在不同路段製造：

- 勻速運動；
- 勻加速運動；
- 勻減速運動。

活動不要求學生達到指定數值的速度或加速度。關卡只要求運動的**類型與規律**：

- 勻速：速度保持不變；
- 勻加速：速度隨時間以穩定比率增加；
- 勻減速：速度隨時間以穩定比率減少。

學生主要依靠車輛的操作感、道路動態線索，以及角落的無數字 `x–t`／`v–t` 圖像預覽判斷表現。系統內部可以用數值及容差評分，但挑戰畫面不顯示位置、速度、加速度或圖軸刻度數字。

本活動是勻變速概念的操作入門，不取代現有：

- `position-time-graph-motion-lab`：正式處理勻速直線運動的 `x–t` 圖、斜率及直接建圖；
- `linear-motion-velocity-lab`：正式處理量度、平均速度及瞬時速度。

建議學習路線：

```text
本活動：用駕駛操作建立勻速／勻變速直覺
→ 位置—時間圖運動實驗室
→ 平均速度與瞬時速度實驗室
→ 未來的勻變速三圖及公式活動
```

## 2. Scope

- Slug：`kinematics-driving-challenge`
- 學習目標：
  - 透過操作分辨勻速、勻加速及勻減速；
  - 說明「一直變快」不一定是勻加速，速度必須以穩定比率改變；
  - 透過操作體會油門控制驅動作用，不直接指定速度或加速度；
  - 體會固定油門在真實感簡化模型中不一定產生固定加速度；
  - 比較平路、上斜及落斜時維持相同運動規律所需的控制策略；
  - 從無數字 `v–t` 圖辨認水平、向上傾斜及向下傾斜的直線；
  - 解釋 `v–t` 圖通常比 `x–t` 圖更直接判斷是否勻變速。
- 學生任務：
  - 完成一個不計分的操作練習；
  - 完成五個由簡至繁的駕駛關卡；
  - 在每個計分區間內控制車輛符合指定運動規律；
  - 使用角落預覽視窗切換 `x–t`、`v–t` 或隱藏圖像；
  - 完成一個佔少量分數的圖像證據 checkpoint；
  - 檢查已記錄的關卡表現並一次過提交。
- 主要互動：
  - 選擇輕／中／重操作力度；
  - 按住油門或煞車，放手解除；
  - 暫停、繼續及重開當前試車；
  - 切換 `x–t`／`v–t`／隱藏圖像；
  - 在回放分析中拖動只讀時間游標；
  - 接受當前表現或重新挑戰；
  - 在提交前回到任何關卡改進。
- 建議完成時間：12–18 分鐘。
- Libraries：無；使用原生 HTML、CSS、JavaScript 及 Canvas。
- Assessment risk：`formative`。
- Trusted validation：不適用。瀏覽器端模型、答案及 SCORM 分數均可被修改，不作高風險評核或秘密驗證。
- 學生可見語言：繁體中文。

### 2.1 第一版明確不包括

- 指定學生達到某個 `m/s` 或 `m/s²` 數值；
- 挑戰畫面的數字速度錶、加速度錶、位置讀數或圖軸數字；
- 由學生輸入公式或數值答案；
- `a–t` 圖；
- 勻變速公式推導；
- 從圖像計算斜率、面積、位移或加速度；
- 車輛倒後或速度為負；
- 停止後反向運動；
- 轉向、轉線、碰撞、交通規則或競速對手；
- 變速箱、引擎轉速、扭力曲線、輪胎打滑、油耗或熱衰退；
- 任意道路編輯器或教師自訂關卡；
- 聲音作為必要資訊；
- 排行榜、限時排名、虛擬貨幣、升級或裝飾獎勵；
- 儲存每一幀的畫面、完整高精度軌跡或所有歷史試車；
- 高風險考試、SCORM 2004、xAPI 或 LRS。

## 3. Catalogue metadata (`sim/config.js`)

```js
{
  title: "勻速與勻變速：駕駛控制挑戰",
  folder: "kinematics-driving-challenge",
  categories: ["Mechanics"],
  description: "按住油門與煞車，在平路和斜坡製造勻速、勻加速及勻減速，並用無數字運動圖像判斷表現。",
  tags: ["physics", "mechanics", "kinematics", "uniform-motion", "constant-acceleration", "driving", "scorm"],
  status: "planned"
}
```

- `folder`、活動目錄、manifest identifier、snapshot activity identifier 必須完全一致。
- 未完成全部 package-ready checks 前保持 `planned`。
- 完成 package-ready checks 後才改為 `active`。

## 4. 核心教學決策

### 4.1 不指定加速度大小

關卡提示只說：

- `保持勻速`
- `保持勻加速`
- `保持勻減速`

不顯示：

- `保持 +1.0 m/s²`
- `保持 −0.8 m/s²`
- 任何等價數值目標

任何方向正確而且足夠穩定的非零加速度，都屬於勻加速／勻減速證據。完整效果分要求圖線在無數字預覽中有可辨認的上升／下降，避免把數值雜訊或肉眼看似水平的線當成另一種運動；這個可辨認度只影響「效果是否清楚」，不會把一條斜率穩定的細斜線分類成「不是勻變速」。這個設計避免學生追逐儀表數字，將注意力放在運動規律。

### 4.2 圖像是判斷工具，不是數值工具

預覽視窗只顯示：

- 坐標軸；
- 軸名 `t`、`x` 或 `v`；
- 零速度基準線（`v–t` 圖）；
- 實際運動圖線；
- 當前時間游標；
- 計分區域開始及結束的無文字邊界。

預覽視窗不顯示：

- 數字刻度；
- 單位數值；
- 速度或加速度讀數；
- 方程式；
- 線性回歸線；
- 系統判定的「正確答案線」；
- 即時分數或容差範圍。

### 4.3 `v–t` 圖是判斷勻變速的主要證據

活動必須清楚建立：

| 運動 | 無數字 `v–t` 圖 |
|---|---|
| 勻速 | 水平直線 |
| 勻加速 | 向上傾斜直線 |
| 勻減速 | 向下傾斜直線 |
| 非勻變速 | 斜率明顯改變、彎曲或不規則 |

`x–t` 圖用來感受：

- 勻速是斜率固定的直線；
- 加速時圖線愈來愈斜；
- 減速時圖線愈來愈平。

活動不宣稱學生只靠肉眼見到一條彎線便能證明它是拋物線。回饋必須指出：

> `x–t` 圖的彎曲可以顯示速度正在改變，但要直接判斷速度是否以固定比率改變，`v–t` 圖更清楚。

### 4.4 操作是主要學習證據

最少 90% 分數來自學生實際駕駛產生的運動記錄。圖像 checkpoint 只佔 10%，不能靠回答一條選擇題取得合格。

### 4.5 立即回饋是遊戲循環的一部分

每次完成關卡後可以立即看到該次表現、圖線及改善方向。這是形成性活動，不隱藏所有正誤至最後提交。重試、查看圖像、暫停或改變策略不扣分。

## 5. 針對的常見錯誤概念

活動與回饋必須直接處理：

- 認為油門踏板直接設定速度；
- 認為按住同一油門一定是勻速；
- 認為按住同一油門一定是勻加速；
- 認為只要車愈來愈快便是勻加速；
- 認為只要車愈來愈慢便是勻減速；
- 認為勻速代表車完全不受力；
- 認為上斜保持勻速可沿用平路的相同控制；
- 認為落斜放開油門一定會保持原速；
- 認為任何彎曲的 `x–t` 圖都足以證明勻變速；
- 將 `x–t` 圖誤解成道路的實際山坡形狀；
- 將正加速度直接等同「踩油門」，負加速度直接等同「踩煞車」；
- 只看圖線高低，不看圖線斜率是否保持一致。

第一版車輛只向前，避免同時引入「負速度但速度大小增加」的進階符號問題。

## 6. 整體學習流程

```text
啟動／恢復
→ 操作練習（不計分）
→ 第 1 關：平路勻速
→ 第 2 關：平路勻加速
→ 第 3 關：平路勻減速
→ 圖像證據 checkpoint
→ 第 4 關：斜坡勻速
→ 第 5 關：混合道路
→ 提交前檢查
→ 最後確認
→ SCORM 提交
→ 鎖定回放與檢討
```

活動開啟後直接顯示可操作的練習場景，不設裝飾 landing page。學生可以隨時開始正式關卡，不以練習時間或按鍵次數解鎖。

每個正式關卡使用同一循環：

```text
短任務提示
→ 開始試車
→ 操作油門／煞車
→ 完成計分路段
→ 回放分析
→ 接受今次表現，或重新挑戰
```

## 7. 控制設計

### 7.1 核心控制

操作面板提供：

1. 力度選擇：`輕`／`中`／`重`
2. 大型按住控制：`油門`
3. 大型按住控制：`煞車`
4. `暫停`／`繼續`
5. `重新開始今次試車`
6. 圖像預覽：`x–t`／`v–t`／`隱藏`

學生先選力度，再按住油門或煞車：

- `pointerdown`／鍵盤按下：開始施加所選作用；
- 保持按住：持續作用；
- `pointerup`／鍵盤放開：立即回到空檔；
- `pointercancel`：必須安全解除控制並顯示操作中斷提示，不得留下「黏住油門」狀態；
- 視窗失焦、頁面隱藏、活動暫停或技術錯誤：立即解除油門／煞車。

油門與煞車互斥：

- 同一時間只接受一種踏板作用；
- 已按住一個踏板時，第二個觸控不會疊加作用；
- 系統忽略第二個按壓並透過可見狀態及非視覺文字說明目前有效控制；
- 不以同時踩油門和煞車作任何題目或評分。

### 7.2 鍵盤及替代操作

- `1`／`2`／`3`：輕／中／重力度；
- `ArrowUp` 或 `W`：按住油門；
- `ArrowDown` 或 `S`：按住煞車；
- `Space`：暫停／繼續；
- 所有功能亦有可聚焦按鈕；
- 重複 keydown 不建立重複控制事件；
- keyup、blur 及 visibility change 均解除踏板。

核心任務不要求多點觸控、精準拖曳或文字輸入。

### 7.3 不設即時「答案燈」

正式計分路段進行中不顯示：

- 「正確／錯誤」
- 即時百分比分數
- 即時加速度穩定度數字
- 目標數值帶

學生依靠車輛、環境及預覽圖自行修正。路段完成後才顯示分析。

## 8. 圖像預覽視窗

### 8.1 位置與尺寸

- 桌面／平板：舞台右上角，約舞台寬度的 `24%–30%`。
- 手機：舞台右上角，約舞台寬度的 `34%–42%`；實際 plot area 不得小於 `128×88` CSS pixels。
- 不遮蓋車輛、當前道路目標牌或主要坡度轉折。
- `隱藏` 時只保留一個 44 CSS-pixel 的「顯示圖像」按鈕。
- 預覽卡使用白色半透明底、細邊框及輕微陰影，沿用 Linear Motion 讀數卡的安靜視覺語言。
- 預覽卡不另設大型 `v–t`／`x–t` 標題；只在縱軸及橫軸末端分別顯示數學斜體 `v`／`x` 與 `t`。
- 若短／窄 viewport 無法同時容納最小 plot、車輛及目標牌，使用 compact preview；學生可一按暫停並在舞台內開啟較大圖像，關閉後由踏板已解除的 paused state 繼續。
- 圖中加入無數字、等間距的淡色時間參考線或時間脈衝點，讓學生有「相同時間間隔」的視覺依據；參考線不可形成可讀取的數值刻度。

### 8.2 圖像範圍

- 每個計分區域開始時重設該區的圖像時間原點。
- `x–t` 圖顯示「由本區入口起計的路線位置」。
- `v–t` 圖顯示同一區域的向前速度。
- 一次試車內每個區域的時間及縱軸比例固定，不隨數據自動縮放。
- 第一版所有區域共用 `12 s` 的水平時間跨度及 `20` 個內部速度單位的縱軸跨度；只完成部分區域時，圖線只畫到實際時間位置，不拉伸至整個圖窗。
- 當同一區域超過 `12 s`，圖窗保持原有比例並向右平移：目前回放游標固定留在右邊界，左邊顯示最近 `12 s`。這是 fixed-width sliding window，不是按資料長度自動縮放；相同物理斜率在任何時間仍有相同 pixel slope。
- window origin 只由該區首個樣本、目前游標時間及固定 `12 s` 跨度決定；回放、restore、max-ticks run 必須得到同一 origin。起點邊界可作線性插值，只用於裁切連線，不改變權威樣本或評分。
- 比例由已驗證的關卡定義決定，固定速度縱軸、滑動時間窗及 Canvas clipping 必須確保所有合法運動和目前游標留在圖內。
- 過渡區不混入相鄰計分區的圖線。
- 區域尚未完成時，圖線由左至右逐步形成；完成後凍結供回放。

### 8.3 圖線忠實性

- 圖線直接由權威固定時間步進模型的樣本產生。
- 不用曲線擬合美化學生答案。
- 不把近似直線自動拉直。
- 不把 `x–t` 數據自動擬合成拋物線。
- 可使用只影響顯示的抗鋸齒及相鄰點連線，不使用改變物理形狀的平滑濾波。

### 8.4 圖像使用記錄

只保存會改變 continuation 的教學語意：

- 最後選擇的顯示模式；
- graph checkpoint 對指定 source run 的 `x–t`／`v–t` 查看旗標。

普通關卡曾否查看某幅圖只屬 transient telemetry，不影響答案、回饋或 continuation，因此不寫入 `suspend_data`。不保存每次切換的時間線。查看或隱藏圖像不直接增加駕駛分數。

## 9. 道路與一維運動的概念邊界

活動準確定位為**沿指定道路路徑的一維運動**，不是全程沿同一空間直線。它以沿道路的累積位置 `x` 作一維坐標。道路畫面可以包含平路、固定斜度直路及短過渡段，但：

- 每一個計分區域本身必須是固定坡度的直線段；
- 坡度轉折只放在不計分的過渡區；
- 不在轉折區判斷勻速或勻變速；
- 圖像的 `x` 是沿道路量度的路線位置，不是畫面水平像素位置；
- 學生不控制轉向或換線；車身會跟隨道路方向，但運動自由度只有一個沿路坐標。

學生活動提示使用：

> 圖中的位置 `x` 沿道路方向量度；道路的上下形狀不是 `x–t` 圖。

這個說明用來防止學生把 `x–t` 圖當成山坡外形。

## 10. 關卡設計

### 10.1 操作練習（不計分）

道路：足夠長的平路。

學生可以：

- 試用三種油門力度；
- 放開油門觀察車輛減速；
- 試用三種煞車力度；
- 暫停及重開；
- 切換 `x–t`、`v–t` 及隱藏圖像。

練習區依次顯示三個短提示，但不強迫完成：

1. 試按住輕油門，再放手。
2. 試比較 `x–t` 與 `v–t` 圖。
3. 留意固定油門下的 `v–t` 圖未必保持完全筆直。

`開始第 1 關` 始終可用。

### 10.2 第 1 關：平路保持勻速（15 分）

目標：

> 在藍色路段保持勻速。

設計：

- 車以中等非零速度進入計分區；
- 道路為平地；
- 無指定目標速度；
- 學生可用輕油門脈衝、空檔或其他穩定策略抵消阻力；
- 車停止、倒退需求或極慢爬行不能當作勻速答案。

重點：

- 水平 `v–t` 圖；
- 斜率固定的直線 `x–t` 圖；
- 勻速需要合力接近零，不代表完全不施加作用。

### 10.3 第 2 關：平路保持勻加速（20 分）

目標：

> 在綠色路段令車明顯而穩定地勻加速。

設計：

- 車以低至中等速度進入；
- 道路為平地；
- 不指定加速度大小；
- 學生要令 `v–t` 圖形成明顯向上而且近似筆直的線；
- 只產生很小而不可辨認的速度增加不能取得方向分；
- 由於阻力隨速度增加，長時間固定油門不保證加速度不變，學生可能需要逐步改變力度或以有規律方式修正。

重點：

- 「變快」只是必要條件，不是充分條件；
- 勻加速要保持 `v–t` 圖斜率穩定。

### 10.4 第 3 關：平路保持勻減速（20 分）

目標：

> 在橙色路段令車明顯而穩定地勻減速。

設計：

- 車以較高但安全的速度進入；
- 道路為平地；
- 不指定減速度大小；
- 學生使用不同煞車力度及放開策略，令 `v–t` 圖形成明顯向下而且近似筆直的線；
- 車必須保持向前並完成整個區域；
- 在區域中過早停車不算成功的勻減速；
- 突然重煞後長時間慢速滑行不算勻減速。

重點：

- 減速是速度有規律下降，不是「最後停到」便成功；
- 勻減速的 `v–t` 圖為向下直線。

### 10.5 圖像證據 checkpoint（10 分）

解鎖條件：

- 已完成第 1 至第 3 關；
- 至少有一個已接受的勻加速或勻減速 run，並含足夠 scored samples；該 run 可以低分或方向錯誤，不要求先答對；
- 學生在 checkpoint 內查看同一段記錄的 `x–t` 及 `v–t` 圖。

畫面：

- 左右或上下並列同一段已接受 run 的無數字 `x–t`、`v–t` 圖；
- 不顯示數字、正確擬合線或分數；
- 可拖動共用時間游標，車的只讀回放與兩幅圖同步。

問題：

> 如果要直接判斷這段運動是否以固定比率改變速度，哪一幅圖提供較清楚的證據？

選項：

- `v–t 圖，因為勻變速時速度隨時間形成斜率固定的直線`（正確）
- `x–t 圖，因為曲線的彎曲程度可以直接當作加速度讀數`
- `兩幅圖同樣直接，只要看到圖線不是水平便足以判斷`
- `x–t 圖，因為它的斜率固定時代表加速度固定`

未查看兩幅圖時不可確認答案。學生可在提交前修改。

### 10.6 第 4 關：斜坡保持勻速（15 分）

目標：

> 分別在上斜及落斜路段保持勻速。

設計：

- 一次試車包含兩個計分區：
  1. 固定上斜直路；
  2. 固定落斜直路。
- 兩區之間有不計分過渡段；
- 每區分別評分，各佔 7.5 分；
- 兩區不要求保持相同速度，只要求各自速度穩定；
- 上斜通常需要較大驅動作用；
- 落斜通常需要減少油門或使用煞車。

重點：

- 同一運動規律在不同外界條件下需要不同操作；
- 同一踏板設定不是「勻速按鈕」。

### 10.7 第 5 關：混合道路（20 分）

一次試車依次包含：

1. 平路勻速；
2. 上斜勻加速；
3. 平路勻減速；
4. 落斜勻速。

規則：

- 每區開始前用大型路牌及文字清楚顯示目標；
- 過渡段不計分，讓學生調整操作；
- 每個計分區各佔 5 分；
- 每區預覽圖重設時間原點，但保留學生選擇的圖像模式；
- 完成整條路後顯示四區分析；
- 任何單一區失敗不會中止整條路，除非車停止、超出安全模型範圍或發生技術錯誤。

重點：

- 根據任務改變控制策略；
- 由圖形而不是數字判斷運動狀態；
- 綜合平路與坡度影響。

## 11. 固定關卡與變化政策

第一版使用固定、版本化、已驗證的關卡幾何及初始條件，不做任意隨機化。理由：

- 核心學習證據來自連續控制，學生答案已自然不同；
- 固定關卡較容易驗證每種踏板組合確實有可達策略；
- 方便教師比較學生在相同物理條件下的困難；
- 避免隨機坡度或初速令某些 attempt 明顯較難。

允許不影響物理的有限視覺變化：

- 遠景建築及樹木的 deterministic cell 變化；
- 道路標誌圖案；
- 天空雲層位置。

這些變化由活動版本及關卡 ID 決定，不使用學生身份資料，也不改變評分。

未來版本若加入關卡變化，必須保存具體定義、驗證可解性、版本化並加入 deterministic restore tests。

## 12. 物理模型

### 12.1 狀態

使用沿道路的一維位置：

```text
x       沿道路位置，m
v       向前速度，m/s，限制為 v >= 0
theta   當前固定路段坡角
u       控制狀態：空檔／油門輕中重／煞車輕中重
t       模擬時間，s
```

### 12.2 更新公式

每個固定時間步：

```text
F_net =
  F_drive(u)
  - F_brake(u)
  - F_rolling(v)
  - F_drag(v)
  - m g sin(theta)

a = F_net / m
v_next = max(0, v + a Δt)
x_next = x + (v + v_next) Δt / 2
```

當 `v = 0`：

- 先計算 `F0 = F_drive - F_brake - m g sin(theta)`，此時空氣阻力為零；
- 若 `F0 <= STATIC_HOLD_N`，車保持停止；負的 `F0` 亦不產生倒後；
- 若 `F0 > STATIC_HOLD_N`，車開始向前，首個 moving substep 使用 `F_rolling = ROLLING_RESISTANCE_N`；
- 煞車在靜止時增加保持作用，不產生負速度；
- 不允許負速度；
- 不把坡道上向後溜車加入第一版。

### 12.3 固定時間步

- 權威物理時間步：`PHYSICS_TICK_S = 0.05 s`。
- `requestAnimationFrame` 只負責視覺插值。
- 同一控制序列在不同 frame rate、DPR 或裝置上必須得到相同權威軌跡及分數。
- 每個 tick 將當前踏板狀態編碼為一個權威控制樣本。
- 暫停期間不增加 tick、時間、位置或圖線。
- Pointer／keyboard transition 以 monotonic timestamp 加 sequence number 進入 input queue；在第一個不早於事件 timestamp 的 tick boundary 生效，同 timestamp 依 sequence number 排序。
- 一個 render frame 需要補算多個 tick 時，每個 tick 依次套用當時已到期的 queued transition，不可把 frame 最後的踏板狀態倒套到較早 tick。
- 每 frame 最多補算 `MAX_CATCH_UP_TICKS = 8`；若 backlog 再大，模型停在最後完整 tick、解除踏板並進入可恢復的 technical pause，不跳過 tick 或控制樣本。
- 若一個 tick 橫跨 zone boundary，以同一控制及該 tick 的解析運動作 deterministic substep split；前後部分分別歸屬正確 zone，transition zone 不污染 scored samples。

### 12.4 初始校準常數

以下是實作起點，不是學生可見數值；視覺試玩及可解性驗證後可在本文件內調整：

```text
CAR_MASS_KG = 1200
GRAVITY_M_S2 = 9.81
ROLLING_RESISTANCE_N = 180
STATIC_HOLD_N = 220
DRAG_COEFFICIENT_N_PER_M_S_SQUARED = 8

THROTTLE_FORCE_N = [360, 1150, 2500]
BRAKE_FORCE_N = [400, 900, 1800]

UPHILL_ANGLE_DEG = +4
DOWNHILL_ANGLE_DEG = -4
MODEL_MAX_SPEED_M_S = 20
SCORABLE_MIN_SPEED_M_S = 3
```

這些常數的作用是：

- 固定油門下，速度提高會令阻力增加，避免把踏板直接等同加速度；
- 輕油門在代表性平路速度附近可用一段可感知的 hold 抵消阻力，不要求高頻短促點按；
- 中油門在代表性上斜速度附近提供接近平衡的控制選擇；
- 輕煞車在代表性落斜速度附近提供接近平衡的控制選擇；
- 上斜與落斜的影響明顯但仍可由三種力度控制；
- 每種關卡有多於一種可接受操作策略；
- 車輛動態在手機畫面上明顯而不過快。

### 12.5 可解性要求

每個關卡定義必須通過離線 deterministic control search：

- 最少找到三個可通過的控制序列；
- 可通過序列不應只靠每 tick 快速切換；
- 每一關最少一個高分策略主要使用 1–3 秒的人類可持續按住區段；
- 輕／中／重三種力度各自在整個活動至少有一個合理用途；
- 不能用全程空檔、全程重油門或全程重煞車通過所有關卡；
- 容差剛內／剛外的序列必須可人工構造並測試；
- 320 CSS-pixel 手機、60 Hz、120 Hz 及低 frame rate 的權威結果相同。

若驗證找不到合理策略，必須調整力、坡度、初速、區域長度或容差；不可保留一個只在理論上可解但人手無法操作的關卡。

## 13. 評分模型

### 13.1 總分

```text
第 1 關：15
第 2 關：20
第 3 關：20
圖像證據 checkpoint：10
第 4 關：15
第 5 關：20
總分：100
合格線：60
最低分：0
最高分：100
```

駕駛操作共 90 分；圖像問題 10 分。只答對圖像問題不能接近合格。

### 13.2 權威 run

- 每關可以重試，不限次數。
- 完成一次試車後，學生選擇：
  - `記錄今次表現`
  - `重新挑戰`
- 每關只有一個「已記錄 run」作最終評分來源。
- 重開新試車不立即刪除已記錄 run；學生完成並確認新 run 後才取代舊 run。
- 可記錄 run 必須到達一個合法 terminal outcome：完成路線、停止超時、達到安全速度上限或達到該關最大 tick；不要求先過關才可記錄及提交。
- 合法失敗 run 仍可 deterministic replay 及按已完成區域／距離取得 `0..levelMax` 分，確保活動保留真正的 0–100 評核範圍。
- 最終提交只評已記錄 run，不評按鍵次數、用時、重試次數或曾經失敗的 run。
- 這保持「提交最終狀態」原則，同時讓學生安全探索。

### 13.3 區域評估視窗

每個計分區：

- 入口後首 `ENTRY_GRACE_S = 0.75 s` 不計分，讓學生完成踏板轉換；
- 其後需要最少 `MIN_EVIDENCE_S = 1.50 s` 才足以判斷線形；
- 樣本來自固定 `0.05 s` tick；
- 每個 level definition 必須證明由任何合理、未超出模型安全範圍的恆定加速度策略通過該區時，均保留最少證據時間；
- 若一條正確斜直線因 level geometry 太短而沒有足夠證據，屬題目定義錯誤並 fail closed，不可把學生分類成「不是勻加速」；
- 車過早停止、達到 max speed 或 max ticks 可以成為合法 terminal run；學生仍可記錄及提交，未完成區域按進度取得部分或零分；
- 學生造成的 terminal run 若少於 `MIN_EVIDENCE_S`，該區 `D`／stability 為零，`C` 仍按實際 scored-distance progress 計算；
- 不計分過渡區的控制不直接影響分數，但會影響下一區入口狀態。

### 13.4 線形判斷

對評估視窗的 `v(t)` 作最小二乘直線摘要：

```text
v_hat(t) = intercept + slope × t
RMSE = sqrt(mean((v - v_hat)^2))
deltaV = v_end - v_start
speedRange = max(v) - min(v)
plotRise = abs(deltaV) / fixedGraphVelocitySpan
```

這個回歸只用於隱藏評分及回饋分類，不在預覽圖畫出擬合答案線。

### 13.5 共用 normalized helpers

所有 scorer 使用以下唯一 helper：

```text
clamp01(x) = min(1, max(0, x))

fullThenFade(value, fullLimit, zeroLimit) =
  1                                      if value <= fullLimit
  0                                      if value >= zeroLimit
  (zeroLimit - value) / (zeroLimit - fullLimit) otherwise

riseScore(plotRise) =
  0                                      if plotRise <= 0.02
  1                                      if plotRise >= 0.10
  (plotRise - 0.02) / 0.08               otherwise
```

`plotRise` 以關卡固定、無數字 graph scale 正規化，因此 full effect 代表在學生實際看到的圖中有清楚斜度，不代表指定某個 `m/s²`。`0.02` 以下只作顯示／數值雜訊 deadband；一條方向正確而斜率穩定的細斜線仍可取得 stability 分，只是「明顯效果」分較少。

共用 completion：

```text
C = clamp01(scoredDistanceCompleted / scoredZoneLength)
```

若整個 scored window 的平均速度低於 `SCORABLE_MIN_SPEED_M_S`，勻速區的 `C` 及 stability 均為零；勻減速只要求在有效 scored samples 內保持正速度，之後過早停止由 `C` 反映。

### 13.6 勻速區完整公式

```text
slopeScore = fullThenFade(abs(slope), 0.08, 0.16)
rangeScore = fullThenFade(speedRange, 0.90, 1.80)
rmseScore  = fullThenFade(RMSE, 0.25, 0.50)

S_uniform = 0.40 × slopeScore
          + 0.30 × rangeScore
          + 0.30 × rmseScore

zoneFraction = 0.40 × C + 0.60 × S_uniform
zonePoints = zoneMaxPoints × clamp01(zoneFraction)
```

靜止或極慢滑行不獲勻速分。

### 13.7 勻加速／勻減速完整公式

```text
desiredSign = +1 for accelerating, -1 for decelerating
signedSlope = desiredSign × slope
D = riseScore(plotRise) if signedSlope > SIGN_EPSILON else 0

normalizedRMSE = RMSE / fixedGraphVelocitySpan
S_linear = fullThenFade(normalizedRMSE, 0.003, 0.014)

zoneFraction = 0.25 × C
             + 0.25 × D
             + 0.50 × (signedSlope > SIGN_EPSILON ? S_linear : 0)

zonePoints = zoneMaxPoints × clamp01(zoneFraction)
```

`SIGN_EPSILON` 只排除浮點／顯示 deadband，初始值 `0.01 m/s²`。它不是 full-credit 加速度目標。方向正確但肉眼斜度很小的理想直線可取得 `C` 及 `S_linear`，但 `D` 較少；方向相反或接近水平的線不能靠低 RMSE 冒充完整勻加速／勻減速。過早停止由 `C` 扣分；突然重煞再長時間滑行會提高 normalized RMSE，不能取得滿分。

### 13.8 連續評分與邊界

- 除證據不足、非有限模型及方向 deadband 外，所有分數連續變化，避免輕微誤差造成大幅跳變。
- 第 4／5 關的 level score 是各 zone 的 `zonePoints` 直接相加；不再取平均或另加隱藏 bonus。
- checkpoint 是全有或全無 10 分。
- 各 zone 保留 full precision；全部 zone 加 checkpoint 後才四捨五入成整數。
- 所有比較使用 inclusive boundary 加中央 epsilon guard。
- 最終總分四捨五入至整數並 clamp 至 `0..100`。

### 13.9 容差例子

計劃批准後實作測試必須包括：

- 勻速 `abs(slope)` 剛好 `0.08`：滿足該 metric；
- 勻速 `abs(slope)` 剛高於 `0.08`：開始失去部分穩定度分；
- 勻加速 signed slope 剛高於／低於 `SIGN_EPSILON`；
- `plotRise = 0.02`、剛高於 `0.02`、`0.10` 及剛低於 `0.10`；
- 方向正確但斜度細的理想直線取得 stability 而不是被分類成非勻變速；
- 較大而穩定的加速度不因較快通過位置區而被錯判；
- 勻減速使用對稱方向規則；
- 同一條理想直線加入剛內／剛外波動；
- 車在評估最後一 tick 停止與保持最小正速度的邊界；
- 區域剛好達到最短評估時間與少一 tick。

所有容差常數集中於 `scoring.js`，不可散落 UI。

### 13.10 手算 aggregation 例子

一個 5 分的勻加速 zone，若：

```text
C = 1.00
D = 0.75
S_linear = 0.80
```

則：

```text
zoneFraction = 0.25(1.00) + 0.25(0.75) + 0.50(0.80)
             = 0.8375
zonePoints = 5 × 0.8375 = 4.1875
```

保留 `4.1875` 進入全活動總和，最後才四捨五入。任何 conforming implementation 都必須產生同一結果。

## 14. 關卡後分析與回饋

### 14.1 分析畫面

完成一個 run 後：

- 車輛停止在只讀回放狀態；
- 顯示每個計分區的目標及表現；
- 顯示該區無數字 `v–t` 圖；
- 可切換同一區的無數字 `x–t` 圖；
- 可拖動共用時間游標同步回放車輛及圖線；
- 顯示簡短質性分類：
  - `規律穩定`
  - `方向正確，但變化不夠穩定`
  - `速度變化太小`
  - `方向相反`
  - `過早停止`
  - `未完成路段`

回放不顯示隱藏數值、容差、回歸斜率或正確控制序列。

### 14.2 物理回饋例子

勻速：

> 這段 `v–t` 圖接近水平，表示速度大致保持不變。你用驅動作用抵消了道路阻力。

非勻速：

> 圖線持續向上，表示車仍在加速；按住同一油門不等於保持同一速度。

勻加速但不穩定：

> 車確實愈來愈快，但 `v–t` 圖的斜率不斷改變，所以未形成穩定的勻加速。

勻減速過早停車：

> 車速下降，但在計分路段結束前已停止。勻減速要求整段速度有規律地下降，不只是最後停下。

坡道：

> 上斜時重力沿斜坡的作用令車較易減速，所以維持勻速所需的控制與平路不同。

### 14.3 提交後回饋

提交後顯示：

- 每關已記錄 run 的分數；
- 每區質性結果；
- 學生的無數字圖線及只讀回放；
- 圖像 checkpoint 的學生選擇及正確解釋；
- 一段總結：

```text
勻速：v–t 圖是水平直線
勻加速：v–t 圖是向上直線
勻減速：v–t 圖是向下直線
x–t 圖可顯示速度正在改變，但 v–t 圖更直接顯示變化率是否固定
```

## 15. 美術與視覺方向

### 15.1 整體語言

直接參考 `linear-motion-velocity-lab`：

- 安靜、清晰的教學實驗工具；
- 側視二維場景；
- 簡化但容易辨認的車輛及街景；
- restrained palette；
- 不使用霓虹、競速 HUD、速度線、鏡頭震動或大型遊戲化特效；
- 不靠裝飾影響學生判斷運動。

### 15.2 沿用的視覺元素

建議沿用或衍生：

```text
車身：#e4554f
車身深色輪廓：#8f2d32
天空：#dbeafe
道路：#4b5563
路肩／草地：#a9c994
道路邊界：#64748b
主要圖線／操作 accent：#2563eb
目標／當前游標：#f59e0b
```

車輛：

- 保留 Linear Motion 的紅色車身、深色輪廓、清楚車頭、窗、車燈、輪胎及柔和地面陰影；
- 車身中心作權威位置參考；
- 車身按道路局部斜度旋轉；
- 車輪按沿道路距離轉動；
- 停止及暫停時輪胎停止；
- 不用速度線作必要證據。

環境：

- 遠景建築、商店、樹叢及近景路燈、標誌、灌木採 stable world-cell 生成；
- 保留 deliberate gaps，避免機械式重複；
- 使用輕微 parallax，但所有層在 `v = 0` 同時停止；
- 道路以單一行車線呈現，不畫中央分隔虛線，避免側視畫面被誤讀成雙線行車道；
- 道路坡度及目標區邊界比裝飾更清楚；
- 目標區使用顏色加文字／圖案，不能只靠顏色。

### 15.3 目標區視覺

每個區域入口有：

- 路旁目標牌；
- 大型繁體中文任務文字；
- 不同圖案：
  - 勻速：有細小 `v`、`t` 軸框住的水平線；
  - 勻加速：有細小 `v`、`t` 軸框住的向上直線；
  - 勻減速：有細小 `v`、`t` 軸框住的向下直線；
- 顏色只作輔助；
- 區域開始及結束在路面邊緣以低干擾標記表示。

圖案是 miniature `v–t` graph badge，不使用裸 `↗`／`↘` 箭嘴，也不畫在道路中央，避免學生把道路坡度與圖像斜率混淆。

## 16. Responsive layout contract

### 16.1 Classification

- Control-panel classification：`bounded split-panel`
- 原因：學生需要反覆按住控制，同時持續看到車輛、坡度、目標路段及預覽圖。

### 16.2 手機

- App 使用 `100vh` fallback 及 `100dvh`。
- `html`、`body`、app shell 沒有可用垂直捲動範圍。
- 上方舞台固定可見。
- 下方 operation panel 使用餘下高度並獨立捲動。
- 起始 stage track：`minmax(13rem, 44vh)`，並使用 `44dvh` enhancement。
- 低高度時先縮小遠景及預覽卡，不建立舞台內垂直 scroller。
- 駕駛中，力度選擇與兩個踏板組成 panel 內的 compact sticky control deck；
- sticky deck 不遮住 panel 的最後內容，加入等高 bottom padding；
- 分析及 review 畫面解除不需要的 sticky 狀態，確保所有按鈕可到達。

### 16.3 桌面／平板

沿用 Linear Motion：

- 左側 operation panel 約 `20rem–24rem`；
- 右側舞台保持視覺主導；
- 圖像預覽位於舞台右上；
- 車輛及當前道路區域保持在舞台中央偏左，避免被預覽卡遮擋。

### 16.4 極端 viewport

必須驗證：

- `320×500`
- `390×500`
- `390×600`
- 正常手機直向
- 手機橫向
- 200% zoom
- browser toolbar 高度變化
- 軟件鍵盤（雖然核心活動沒有文字輸入）

主要踏板、圖像切換、暫停、分析及提交均要可到達，沒有水平捲動或無法到達的 panel bottom。

## 17. Touch gesture ownership contract

### 17.1 Continuous-control target inventory

| Target type | Hit-target strategy | Pointer capture | Rendering replacement |
|---|---|---|---|
| 油門按住掣 | 固定 HTML button，最少 64 CSS-pixel 高 | button 自身 | active hold 期間不可替換 |
| 煞車按住掣 | 固定 HTML button，最少 64 CSS-pixel 高 | button 自身 | active hold 期間不可替換 |
| 分析時間游標 | 固定 HTML range overlay／控制 | 穩定 HTML input | drag 期間不可替換 |

圖像切換、力度選擇、暫停及 navigation 是普通 native tap controls，不是連續 drag target。

### 17.2 Gesture matrix

| Touch starts on | Owner | Required result |
|---|---|---|
| 非互動舞台／道路／預覽圖空白位置 | Moodle host／enclosing page | host 有 range 時移動 host 及完整 iframe；activity document 與 panel 不動；不改變控制、時間或答案 |
| operation panel 背景或普通內容 | operation panel | 只捲動 panel；host、iframe、舞台及 activity document 不動，包括 panel 頂／底邊界 |
| 油門或煞車按住掣 | simulation for active hold | 收到 pointerdown、持續 hold 及 pointerup；踏板狀態改變；所有 scroll owner 位置不變；靜止手指不強制產生 pointermove；正常操作沒有 pointercancel |
| 分析時間游標 | simulation for active drag | 游標及只讀回放改變；所有 host／panel／document／viewport／iframe scroll delta 為零；收到 pointerup，沒有 pointercancel |

### 17.3 Technical rules

- 舞台及 Canvas 預先使用 `touch-action: pan-y`。
- 不在整個舞台使用 `touch-action: none`。
- 油門、煞車及時間游標的有效 `touch-action` 在 `pointerdown` 前存在。
- pointer capture target 在整個 hold／drag 期間保持 mounted。
- panel 使用 `overscroll-behavior: contain`。
- 不把舞台 gesture 轉送到 sibling panel。
- active hold 期間每個 trusted touch gesture只屬一個 owner。
- 正常 press-and-hold 必須以 `pointerup` 結束；若收到 `pointercancel`，立即回空檔並不把取消後時間誤記為仍按住。

開發頁及 built／extracted SCORM launch page 均必須在 scrollable Moodle-like iframe host 用 browser-level trusted touch input 驗證完整 matrix。DOM `dispatchEvent`、source string 或 computed style 不算驗收。

### 17.4 Stage-to-host scroll topology gate

iframe 內的 native pan 不保證自動穿越 browsing-context boundary。實作主 UI 前先完成一個最小 real-touch spike，逐一記錄：

| Launch context | Required investigation |
|---|---|
| development Moodle-like host | same-origin iframe，測 native `pan-y` 及 same-owner host bridge |
| built／extracted package host | same-origin served artifact，重複相同測試 |
| Moodle current-window player | 確認 content／player 是否 same-origin、iframe sandbox、host 可捲動 owner |
| Moodle new-window player | 確認是否仍有 parent host range；沒有 range 時記錄真正 N/A |

決策順序：

1. 優先保留 stage `touch-action: pan-y`，測試 browser／Moodle topology 是否自然令同一 host owner 捲動。
2. 若 native 行為不能到達 host，但 child 可 same-origin 存取 host，允許明確標示為**程式化同 owner bridge**的方案：只把 blank-stage vertical delta 交給 enclosing host scroll owner；不改 panel，不改 learner state，不宣稱是 native scrolling。
3. bridge 必須限制在已驗證的 same-origin parent、只接受目前 activity 的 active trusted gesture、clamp 到 host range，並在 gesture 結束後清理；不可讀寫其他 parent 資料。
4. 不依賴一個 Moodle 未安裝 listener 的 `postMessage`。Cross-origin launch 只有在 Moodle host 提供並驗證專用 listener 時才可採 `postMessage` protocol。
5. 若 real Moodle topology 既不能 native 到達 host、又沒有安全同 owner bridge，正式活動必須在實作前改為經驗證的 natural-flow topology，更新本文件的 layout classification／matrix；不得把 stage gesture 錯交 sibling panel，也不得帶着未解決 topology 進入 package-ready。

每個採用的 context 都要記錄實際 owner、機制、same-origin 狀態及 fallback。這個 spike 是 Phase A gate，不是留到最後 browser test 才處理的風險。

## 18. Accessibility

- 所有核心操作支援 touch、mouse 及 keyboard。
- 踏板按鈕有可見 pressed state、文字及非顏色圖示。
- 力度選擇使用原生 radio／segmented controls，無預選答案概念；預設 `中` 只代表控制設定，不代表正確策略。
- 目前路段目標以文字、圖案及顏色共同表達。
- Canvas 外有持續更新但不過度頻繁的狀態文字：
  - 當前關卡；
  - 當前路段目標；
  - 車輛正在加快／減慢／大致穩定的質性描述；
  - 暫停、完成或技術錯誤。
- 質性狀態只在分類改變或最少間隔後更新，不每 frame 轟炸 live region。
- 預覽圖的非視覺等價文字只描述線形：
  - `接近水平`
  - `大致向上，但斜率有變化`
  - `接近向下直線`
  - `資料尚不足`
- 這些文字不在計分路段中直接說「正確／錯誤」，分析畫面才連結到任務結果。
- `prefers-reduced-motion`：
  - 移除裝飾 easing、雲層飄動及非必要 fades；
  - 學生主動控制的車輛運動保留，因為它是核心學習內容；
  - 提供清楚暫停；
  - 不使用鏡頭震動或 motion blur。
- 聲音不是必要資訊；第一版預設無聲。
- 焦點順序跟隨任務、力度、踏板、圖像、暫停及 navigation。
- 技術／pending 狀態鎖定不安全操作，且不稱為已提交、合格或不合格。

## 19. Runtime files and responsibilities

建議：

```text
plans/12-kinematics-driving-challenge.md
sim/kinematics-driving-challenge/
  index.html
  styles.css
  main.js
  driving-model.js
  driving-model.test.js
  level-definitions.js
  level-definitions.test.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
  scene-visuals.js
  scene-visuals.test.js
  ui-policy.js
  ui-runtime.test.js
  accessibility.test.js
sim/manifests/kinematics-driving-challenge.xml
tools/kinematics-driving-browser-regression.js
```

重用：

```text
sim/shared/styles.css
sim/shared/scorm.js
sim/shared/activity-flow.js
```

責任：

- `driving-model.js`
  - 固定 tick 物理；
  - 踏板力及阻力；
  - 道路坡度查詢；
  - deterministic replay；
  - 權威 sample 產生。
- `level-definitions.js`
  - 版本化關卡；
  - 道路區域、坡度、初始條件；
  - 目標類型；
  - 圖像固定比例；
  - 定義 validator。
- `scoring.js`
  - `v(t)` regression summary；
  - 方向、完成及穩定度分；
  - 圖像 checkpoint；
  - feedback classification；
  - 所有容差。
- `persistence.js`
  - packed control stream；
  - phase／variant validation；
  - draft／review encode/decode/restore；
  - snapshot size guards。
- `scene-visuals.js`
  - responsive road profile geometry；
  - 車輛、輪胎、街景 cell；
  - preview graph geometry；
  - 純視覺 deterministic helpers。
- `ui-policy.js`
  - shared lifecycle outcome 到 learner-facing view policy；
  - disabled／locked states；
  - 不含物理。
- `main.js`
  - DOM wiring；
  - Pointer／keyboard hold；
  - animation loop；
  - phase transitions；
  - Canvas render；
  - shared SCORM glue。

不要把全部物理、評分、persistence 及 Canvas geometry 堆在 `main.js`。

## 20. Authoritative control stream

### 20.1 編碼

每個 `0.05 s` tick 保存 3-bit control code：

```text
0 = 空檔
1 = 輕油門
2 = 中油門
3 = 重油門
4 = 輕煞車
5 = 中煞車
6 = 重煞車
7 = reserved / invalid
```

- codes bit-pack 後轉為 bounded base64 字串；
- 另存 tick count；
- code `7`、長度不符、padding 不符或超過關卡上限均拒絕；
- 同一關卡初始狀態＋關卡版本＋control stream 可 deterministic 重播完整 `x(t)`、`v(t)`、圖線及分數；
- 不保存每 frame 浮點座標；
- 不信任 snapshot 內的 cached score、graph points 或 regression summary。

### 20.2 長度

初始 hard caps：

```text
PRACTICE_MAX_TICKS = 600       # 30 s
LEVEL_1_MAX_TICKS = 400        # 20 s
LEVEL_2_MAX_TICKS = 400        # 20 s
LEVEL_3_MAX_TICKS = 400        # 20 s
LEVEL_4_MAX_TICKS = 700        # 35 s
LEVEL_5_MAX_TICKS = 1200       # 60 s
```

- candidate／replacement run 使用其 owner 的相同上限；
- 超過正常時間時以「今次試車未能完成」結束，不讓 snapshot 無限增長；
- 最大 editable draft（五個 selected runs 加一個 candidate）必須低於 `3600` UTF-8 bytes；
- activity review answer JSON 必須低於 `2200` bytes；
- `SimScorm.makeSnapshot(..., "review", ...)` 的完整 shared envelope 必須低於 `2800` bytes；
- shared runtime 建立、包含 escaped `reviewJson` 的完整 pending-final payload 必須低於 SCORM `4000`-byte ceiling；
- 若 production-shaped pending-final 超出預算，先縮短 hard caps／compact schema；不可只測 inner review 後宣稱安全；
- 測試要使用最差交替控制碼，不只測試容易壓縮的長按。

## 21. Phase/state matrix

`running` 是 in-memory 狀態。encode 或 lifecycle flush 時，先推進到當前完整 tick，再解除踏板並保存為相應 `paused` variant，避免關閉頁面期間繼續加速。

| Phase | Variant | Current item | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `practice` | `ready` | practice | supported definitions；graph mode | candidate run、result | start practice or enter level 1 |
| `practice` | `paused` | practice | valid bounded practice candidate prefix；paused model state derived by replay | active pedal | resume, reset, or enter level 1 |
| `level` | `briefing` | 0–4 | selected runs from other levels；valid level ID | candidate run | start run, navigate to completed item, or review incomplete state |
| `level` | `paused` | 0–4 | valid candidate prefix for current level；derived paused state can legally continue | active pedal；analysis result | resume or discard candidate |
| `level` | `analysis` | 0–4 | valid legal-terminal unaccepted candidate run；derived zones and score | active pedal | inspect graphs, accept run, or retry |
| `level` | `accepted` | 0–4 | valid selected legal-terminal run for current level | candidate run | next item, retry without deleting selected run, or review |
| `graph-check` | `exploring` | checkpoint | accepted eligible source run；matching source revision；view flags for x–t／v–t | confirmed checkpoint answer until both viewed | switch views, scrub, answer |
| `graph-check` | `answered` | checkpoint | both viewed；matching source revision；supported answer ID | result metadata | revise, continue to level 4, or review |
| `graph-check` | `review-edit-exploring` | checkpoint | `returnToReview = true`；valid matching source run／revision；view flags | answer until both viewed | switch views, scrub, answer, or return to incomplete review |
| `graph-check` | `review-edit-answered` | checkpoint | `returnToReview = true`；both viewed；matching revision；supported answer | result metadata | revise or return to review |
| `level` | `review-retry-briefing` | 0–4 | `returnToReview = true`；existing selected run retained | candidate replacement run | start replacement or return to review |
| `level` | `review-retry-paused` | 0–4 | retained selected run；valid candidate replacement prefix；`returnToReview = true` | active pedal | resume, discard replacement, or return to review |
| `level` | `review-retry-analysis` | 0–4 | retained selected run；legal-terminal candidate replacement；`returnToReview = true` | active pedal | accept replacement, retry, or keep previous and return |
| `review` | `incomplete` | review | any valid subset of selected runs／checkpoint work | result metadata | open missing or completed item |
| `review` | `complete` | review | five selected runs；checkpoint answer | result metadata | edit or final submit |
| `submitted` | `locked` | review | valid review snapshot sufficient to replay, rescore and redraw | editable controls | inspect locked replay and feedback |

Transitions:

```text
practice/ready -> practice/paused on persisted active practice
practice/* -> level/briefing[0] on start challenges

level/briefing -> level/paused when a candidate run is persisted
level/briefing|paused -> level/analysis when the run reaches its legal end
level/analysis -> level/accepted when learner records this run
level/analysis -> level/briefing when learner retries without an older selected run
level/accepted -> next required item

level/accepted[2] -> graph-check/exploring when levels 1–3 are accepted
graph-check/exploring -> graph-check/answered after both graphs are viewed and answer confirmed
graph-check/answered -> level/briefing[3]
review/* -> graph-check/review-edit-exploring|review-edit-answered when learner edits checkpoint
graph-check/review-edit-exploring -> graph-check/review-edit-answered after both graphs are viewed and answer confirmed
graph-check/review-edit-answered -> review/complete|incomplete on explicit return,
  according to the other selected-run requirements

any editable item -> review/incomplete on explicit review navigation when requirements are missing
all selected runs + checkpoint answer -> review/complete

review/* -> level/review-retry-briefing on retry selected level
review-retry-briefing -> review-retry-paused on persisted active replacement
review-retry-briefing|paused -> review-retry-analysis when replacement finishes
review-retry-analysis -> review/complete|incomplete after accepting replacement
review-retry-analysis -> review/complete|incomplete when keeping previous selected run
accepting a replacement for the checkpoint source run -> review/incomplete
  and atomically points sourceRunRevision to the new selected revision,
  then clears checkpoint view flags and answer
accepting a replacement for a non-source run -> preserves the checkpoint

review/complete -> submitted/locked after success or committed final outcome
```

Phase validation must distinguish:

- selected authoritative run；
- candidate run：paused prefix 或 legal-terminal unaccepted run；
- current transient pressed state；
- derived score／graph／vehicle state。

## 22. Persistence contract

### 22.1 Draft snapshot semantics

Production 可使用短 key，但語意必須包括：

```js
{
  v: 1,
  physicsVersion: 2,
  levelSetVersion: 2,
  phase,
  variant,
  currentItem,
  returnToReview,
  graphMode,
  selectedRuns: {
    level1: { revision, tickCount, packedControls },
    level2: { revision, tickCount, packedControls },
    level3: { revision, tickCount, packedControls },
    level4: { revision, tickCount, packedControls },
    level5: { revision, tickCount, packedControls }
  },
  candidateRun: {
    ownerId, // "practice" or a supported level ID
    tickCount,
    packedControls
  },
  graphCheckpoint: {
    sourceLevelId,
    sourceRunRevision,
    viewedXt,
    viewedVt,
    answerId
  }
}
```

Absent／partial fields follow the phase matrix；不以空 object 代替語意不存在。

### 22.2 Review snapshot

```js
{
  v: 1,
  locked: 1,
  physicsVersion: 2,
  levelSetVersion: 2,
  selectedRuns: {
    level1: { revision, tickCount, packedControls },
    level2: { revision, tickCount, packedControls },
    level3: { revision, tickCount, packedControls },
    level4: { revision, tickCount, packedControls },
    level5: { revision, tickCount, packedControls }
  },
  graphCheckpoint: {
    sourceLevelId,
    sourceRunRevision,
    viewedXt: true,
    viewedVt: true,
    answerId
  }
}
```

review snapshot 不保存：

- score；
- pass／fail；
- cached graph points；
- cached zone metrics；
- feedback text；
- Canvas pixels。

`physicsVersion = 2` 包含經人手長按可解性校準後的 force／drag 及 boundary replay 規則；`levelSetVersion = 2` 包含相應 graph scale 與 scoring calibration。早期 pre-release 的 version 1 snapshot 不作隱式遷移，decoder 必須 fail closed，測試亦要分別覆蓋舊 physics 及舊 level-set rejection。

shared envelope 的 result metadata 只作比較。完成 restore：

```text
validate versions and packed runs
→ deterministic replay each selected run
→ validate every run reaches a supported legal terminal outcome
→ validate checkpoint revision against its selected source run
→ activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

### 22.3 Authoritative state

- physics version；
- level set version；
- 每關 selected packed control stream；
- current candidate packed prefix／terminal candidate；
- phase、variant、current item、return-to-review；
- graph mode；
- checkpoint source level、selected-run revision、view flags and answer ID。

### 22.4 Derived state rebuilt on restore

- `x(t)`、`v(t)`、`a(t)`；
- 車輛畫面位置、角度及輪胎角度；
- 道路及街景位置；
- graph samples and pixels；
- zone regression metrics；
- scores、pass、feedback；
- pressed CSS state、enabled buttons and focus。

### 22.5 Transient state never persisted

- active pointer ID；
- currently pressed pedal；
- pointer capture；
- keyboard held keys；
- `requestAnimationFrame` ID；
- previous wall-clock timestamp；
- hover／focus／live region queue；
- analysis scrub pixel；
- Canvas bitmap；
- current visual interpolation fraction。

### 22.6 Restore invariants

- 版本、phase、variant、item 組合受支援；
- packed data 是 canonical base64、tick count 相符、codes 只在 `0..6`；
- stream 不超過對應關卡最大 tick；
- selected run 到達 route completion、stop timeout、max speed 或 max ticks 其中一個 supported legal terminal；不要求取得合格分；
- candidate run 只存在於 practice／level paused、level analysis、review-retry paused 或 review-retry analysis；
- paused candidate 是可繼續 prefix；analysis candidate 是 legal-terminal unaccepted run；
- accepted／briefing／graph-check／review／submitted 沒有 candidate run；
- replacement run 不會在確認前覆蓋 selected run；
- checkpoint source 是 level 2 或 3 的已接受 run；
- 每個 selected run 有該 level 內單調增加的正整數 `revision`；首次接受為 1，接受 replacement 才加 1，未接受 candidate 不加；
- checkpoint source revision 必須等於該 selected run 的 revision；
- 替換 source run 時原子式把 `sourceRunRevision` 更新至新 selected revision，並清除 checkpoint view flags 及 answer；替換其他 run 不清除；
- answer 不可在兩幅圖均查看前存在；
- review complete／submitted 必須有五個 legal-terminal selected runs 及有效 checkpoint answer；
- `returnToReview` 只出現在 review-retry 及 graph-check review-edit variants；
- snapshot re-encode canonical；
- representative maximum draft、review、shared review envelope 及 pending-final payload 分別符合 §20.2 預算；
- score 與 legal next action 經 round-trip 不變。

### 22.7 Invalid snapshot policy

- Invalid editable draft：若 shared runtime 能明確清除／覆寫並成功 commit 無效 draft，顯示通知後在同一個 editable Moodle attempt 內建立乾淨活動狀態；成功覆寫前保持 technical lock。活動本身不能建立 Moodle 新 attempt。
- Pending-final：保持 frozen，只可重試完全相同 payload。
- Invalid finished review：保持 locked，只顯示可信 Moodle summary，不開放重玩。
- Unsupported version：不默默遷移；只有明確、測試完整的 decoder／migration 才可支援。
- Score／status mismatch：Moodle 記錄優先，抑制不可信詳細回饋。

## 23. Draft checkpoint policy during motion

SCORM 1.2 同步 commit 不可干擾按住操作或動畫：

- 每 tick 更新 in-memory authoritative stream；
- 踏板按下／放開及 graph mode change 先更新 in-memory state，不立即 `LMSCommit`；
- 以下安全邊界 durable save：
  - 手動暫停；
  - run 完成；
  - run discard／reset；
  - 接受 run；
  - 關卡轉移；
  - checkpoint answer；
  - 進入 review；
  - lifecycle flush。
- `pagehide` draft provider 推進至當前完整 tick、解除踏板，並編碼成 paused variant；
- restore 後永遠以踏板放開的 paused state 開始，學生明確按 `繼續`；
- final submit 及 pending-final checkpoint 仍立即 durable。

突然瀏覽器 crash 可能回到上一個安全 durable boundary，但不可恢復成黏住油門、半個 tick 或無法繼續的狀態。

## 24. Shared SCORM lifecycle

Startup：

| Outcome | Editable | 學生畫面 |
|---|---:|---|
| `review` | 否 | validate、replay、rescore，顯示 locked review 或安全 Moodle summary |
| `editable` | 是 | 建立／恢復 draft，register draft provider |
| `frozen` | 否 | 重試相同 pending payload；不聲稱已提交或有分數 |
| `load-error` | 否 | technical lock；不顯示合格／不合格 |

Submission：

| Outcome | Editable | 學生畫面 |
|---|---:|---|
| `success` | 否 | submitted locked review |
| `committed` | 否 | 已 commit 的 locked result；只可 retry finish |
| `frozen` | 否 | pending／unconfirmed；不顯示分數結論 |
| `retry` | 視 `retryable` | 可重試時保留最終答案；不可重試時 technical error，不冒充提交成功 |

活動只使用：

```js
SimScorm.loadAttempt()
SimActivityFlow.startup()
SimScorm.makeSnapshot()
SimScorm.setDraftProvider()
SimScorm.submitWithCallbacks()
SimActivityFlow.submission()
SimActivityFlow.reviewResult()
```

不直接呼叫 raw LMS API，不加入 activity-local pagehide／finish 邏輯。

## 25. Test plan

所有新 test file 加入 `tools/run-tests.js`。

### 25.1 Driving model tests

- 空檔、三段油門、三段煞車的 force ordering；
- 平地、上斜、落斜的 net force ordering；
- 固定 tick 積分的代表值；
- `v >= 0`，停止後不倒後；
- `v = 0` 時 static hold、平路起步、上斜起步、落斜自行前進、靜止煞車的邊界；
- timestamped input queue 在 next-tick boundary 生效，同 timestamp sequence ordering 穩定；
- 一 frame 多 tick 時逐 tick 套用正確控制；
- zone crossing substep 分配正確；
- 超過 catch-up cap 進入 neutral technical pause，不漏 tick；
- max-speed 及 non-finite guard；
- frame rate／render cadence 不改變權威軌跡；
- pause 不增加 tick；
- 相同關卡及 control stream 完全 deterministic；
- 車輪角度由權威路程產生；
- 過渡區不被誤當固定坡度計分區；
- 每個計分區保持固定坡度。

### 25.2 Level definition and solvability tests

- level IDs、zone IDs、次序、坡度、長度、初始條件合法；
- graph fixed ranges 包含所有可接受軌跡；
- 每區在最短可評時間後仍有足夠距離；
- 每關 deterministic control search 找到最少三個人類可操作策略；
- 每一關最少一個高分策略以 1–3 秒 hold segments 為主；
- 所有合理恆定加速度策略均有足夠證據時間，不因位置區太短被錯判；
- trivial all-neutral／all-heavy inputs 不能通過所有關；
- 入口 grace 及過渡區不計分；
- 視覺變化不改變物理。

### 25.3 Scoring tests

- 理想勻速滿分；
- 靜止不能當勻速；
- 接近水平但速度過低不能滿分；
- 理想正斜直線勻加速滿分；
- 速度增加但曲線斜率改變失去穩定分；
- 方向正確但視覺升幅細的直線保留 completion／linearity 分，只減少 effect 分；
- 近水平或方向相反不能取得完整 effect 分；
- 理想負斜直線勻減速滿分；
- 過早停止失去完成／方向分；
- 突然重煞再滑行不等於勻減速滿分；
- slope、plotRise、normalized RMSE、duration、speed floor 的剛內／剛外邊界；
- §13.10 worked example 精確得到相同分數；
- 第 4 關兩區各自計分；
- 第 5 關四區各自計分；
- checkpoint correct／wrong／missing／未看兩圖；
- 完美總分 100；
- 全錯 0；
- 60 分 pass boundary；
- score clamp；
- graph mode、重試次數、完成時間及按鍵次數不直接影響分數。

### 25.4 Packed stream tests

- 所有 codes `0..6` pack／unpack round-trip；
- 跨 byte boundary；
- odd tick counts and padding；
- reserved code 7 拒絕；
- malformed／non-canonical base64 拒絕；
- tick count mismatch 拒絕；
- overlong stream 拒絕；
- worst-case alternating inputs 的最大 snapshot size；
- unpack/replay/repack canonical equality；
- bit corruption fail closed 或重播後因 route invariant 被拒絕。

### 25.5 Persistence phase matrix tests

每一個 phase／variant：

- production-shaped encode／decode／restore；
- score meaning 不變；
- graph choice／view flags 不變；
- 執行一個 legal continuation；
- running in-memory state encode 成踏板解除的 paused variant；
- selected run 在 replacement 未接受前不變；
- accepting replacement atomically replaces selected run；
- keeping old run discards replacement；
- review restore deterministic replay and rescore。

Invalid cases：

- impossible phase／variant／item；
- missing previous selected run dependency；
- analysis without legal-terminal candidate run；
- accepted without selected run；
- candidate run in briefing／accepted／graph-check／review；
- paused candidate 已 terminal 或 analysis candidate 未 terminal；
- practice candidate owner 不是 `practice`，或 level candidate owner 與 current item 不符；
- stray `returnToReview`；
- checkpoint answer before both graph views；
- checkpoint source level missing；
- checkpoint source revision mismatch；
- 替換 source run 清除 checkpoint 並令 review incomplete；
- 替換 non-source run 保留 checkpoint；
- graph-check review-edit exploring／answered 各自 round-trip 並合法返回 review；
- complete review missing a level；
- `NaN`／Infinity or unsafe decoded model state；
- unsupported physics／level version；
- invalid finished review remains locked；
- pending final remains frozen；
- worst-case draft、inner review、shared review envelope、escaped pending-final payload 各自符合 §20.2 budget。

### 25.6 Lifecycle UI tests

直接測 production outcome/render logic：

- startup `review`、`editable`、`frozen`、`load-error`；
- submission `success`、`committed`、`frozen`、retryable `retry`、non-retryable `retry`；
- trusted review、score mismatch、unknown Moodle status；
- technical／pending states 鎖定踏板及提交，不聲稱分數或成功。

### 25.7 Interaction tests

- touch press-and-hold oil／brake starts and releases correctly；
- pointer leaving button under capture still releases on pointerup；
- pointercancel immediately neutralizes；
- visibility change／blur neutralizes；
- simultaneous second pedal ignored；
- keyboard keyup and blur neutralize；
- repeated keydown 不重複；
- pause while holding neutralizes and freezes exact tick；
- resume starts neutral；
- graph toggle during run changes view only；
- graph fixed scale 不自動縮放；
- compact graph 可暫停放大，關閉後由 neutral paused state 繼續；
- 128×88 minimum plot 及無數字等時間參考線在真機可辨；
- preview raw line equals replay samples；
- analysis scrub changes only read-only view；
- accepting and replacing runs use explicit actions。

### 25.8 Accessibility and visual checks

- 320 CSS-pixel phone；
- short phone、landscape、tablet、desktop；
- 200% zoom；
- DPR 1／2／3；
- keyboard-only completion；
- reduced motion；
- long Traditional Chinese feedback；
- color-blind-safe target labels；
- car, target sign and preview never overlap critically；
- uphill／downhill visually clear；
- road shape cannot be confused with graph；
- preview contains no numeric text or ticks；
- all controls at least 44 CSS pixels，pedals at least 64；
- screen-reader qualitative graph alternative；
- no live-region frame spam。

### 25.9 Trusted touch gesture matrix

在 scrollable Moodle-like iframe host，development 及 built artifact 各測：

1. 舞台空白 vertical swipe：
   - host delta non-zero；
   - iframe 相應移動；
   - activity document／panel delta zero；
   - control stream、tick、phase 不因 gesture 改變。
   - 上下兩個方向各測一次；
2. panel swipe：
   - panel delta non-zero when range；
   - host／iframe／document／viewport／stage delta zero；
   - panel top／bottom boundary 不傳到 host。
3. 油門／煞車 trusted hold：
   - control stream 改變；
   - 所有 scroll delta zero；
   - pointerdown、可量度 hold duration、pointerup，無 pointercancel；靜止手指不要求 pointermove。
4. 分析 scrub trusted drag：
   - scrub position 改變；
   - 所有 scroll delta zero；
   - pointerup，無 pointercancel。

每次測試確認 event `isTrusted = true`、touch pointer type，並記錄 browser engine／device。測試時使用 fake clock 或 paused model，將正常物理演進與 gesture side effect 分開。

### 25.10 Slow-LMS and performance checks

- 模擬每次 `LMSCommit` 阻塞至少 180 ms；
- running／pedal transitions／graph toggles 不立即 commit；
- 下一 animation frame 不出現 commit-sized gap；
- pause／run complete／accept／review 安全 checkpoint durable；
- lifecycle flush 保存最新完整 tick 及 paused continuation；
- Canvas 在 320 CSS-pixel、DPR 2 的中階手機維持可操作 frame rate；
- 權威物理在掉 frame 時追上有限 tick，超出 safety cap 時 technical pause，不跳過控制樣本。

### 25.11 Real Moodle gates

- student account；
- current-window player 的完整四列 trusted-touch matrix；
- new-window player 如有提供，重複完整 matrix；若 host 真正無 scroll range，只可把 blank-stage non-zero delta 記錄為 N/A，其餘 zero-delta／state assertions 保留；
- 記錄 browser engine、phone model、same-origin／bridge topology；
- draft resume；
- pending-final retry；
- completed attempt review-only re-entry；
- score／lesson status；
- Moodle 建立新 attempt 後才可改答案及分數；
- current/new-window 的 panel bottom、sticky pedals 及主要 action 均可到達。

### 25.12 Repository and package gates

- JavaScript syntax checks；
- `npm run check`；
- `npm test`；
- `npm run package:all`；
- `git diff --check origin/main...HEAD`；
- manifest 包含所有 runtime dependencies；
- ZIP root 有 `imsmanifest.xml`；
- ZIP 不含 tests／screenshots／temporary files；
- extracted package browser smoke；
- built artifact 完整 trusted touch matrix。

## 26. Acceptance criteria

### 26.1 教學

- 開啟即進入可操作練習，無 landing page。
- 正式關卡不要求任何指定速度或加速度數值。
- 挑戰畫面不顯示位置、速度、加速度或圖軸數字。
- 學生必須以按住／放開控制產生運動證據。
- 勻速、勻加速及勻減速各有獨立操作關卡。
- 平路、上斜及落斜均出現在正式挑戰。
- 學生可以選擇 `x–t`、`v–t` 或隱藏圖像。
- `v–t` 圖能清楚呈現水平、向上或向下直線。
- `x–t` 圖不被描述為只憑彎曲即可證明拋物線。
- checkpoint 要求學生比較同一 run 的兩幅圖。
- 90% 分數來自駕駛操作。

### 26.2 遊戲操作

- 油門／煞車按住、放手、pointercancel、blur 及 pause 都不會黏住。
- 三段力度各有合理用途。
- 油門與煞車不能同時疊加。
- 每關有多於一種可通過策略。
- 重試不扣分，不會在確認前刪除已記錄 run。
- 每關後有無數字回放、質性回饋及改善選擇。
- 固定油門不被模型直接翻譯成固定加速度。
- 車停止後不倒後，第一版沒有負速度。

### 26.3 視覺

- 整體風格與 Linear Motion 一致：紅色側視車、安靜街景、淺藍天空、灰色道路、簡潔 panel。
- 道路坡度、路段目標及圖像預覽清楚但不互相混淆。
- 預覽圖沒有任何數字刻度或數值。
- 車輪、道路、街景及圖線由同一權威運動同步。
- 零速度或 pause 時所有運動線索同時停止。
- 不使用 motion blur、震動或速度線作必要證據。

### 26.4 技術與交付

- 固定 tick 在不同 frame rate 得到同一軌跡及分數。
- packed control stream 足以 deterministic replay、rescore 及 redraw。
- 每個 phase／variant 可 round-trip 並完成一個 legal continuation。
- draft、inner review、shared review envelope 及 pending-final 分別符合 §20.2 byte budgets。
- invalid states fail closed。
- startup／submission 所有 shared outcomes 有誠實 UI。
- submitted attempt locked review-only。
- development 及 built artifact 通過完整 trusted touch matrix。
- package-ready 及 Moodle-ready gates 依 production guide 完成。

## 27. 分階段實作順序

### Phase A：純物理、關卡及 scorer

- 實作固定 tick model；
- 實作坡度、阻力、踏板力；
- 定義五關及區域；
- 實作 regression scoring；
- 建立 deterministic control search；
- 校準可解性及容差；
- 完成 model／level／scoring tests。

### Phase B：核心駕駛及美術

- 建立 Linear Motion 風格 Canvas；
- 實作紅色車、坡道、背景、目標牌；
- 實作 hold controls、keyboard、pause；
- 實作手機／桌面 bounded split layout；
- 完成 pointer safety 及基本 visual QA。

### Phase C：預覽圖及關卡流程

- 實作無數字 `x–t`／`v–t`；
- 固定比例及忠實 raw trace；
- 五關、過渡區、分析及 retry／accept；
- 圖像 checkpoint；
- accessibility equivalents。

### Phase D：Persistence and SCORM

- packed stream；
- phase matrix encode／decode／restore；
- draft provider and safe checkpoint policy；
- shared startup／submission outcomes；
- locked deterministic review；
- snapshot byte-size gates。

### Phase E：Browser, packaging and Moodle

- trusted touch matrix；
- slow-LMS harness；
- responsive／zoom／reduced-motion QA；
- manifest、config、test runner；
- package and extracted smoke；
- real Moodle student attempt and phone evidence。

## 28. 需要用戶審查的主要決策

實作前請確認：

1. 活動名稱 `勻速與勻變速：駕駛控制挑戰` 是否合適。
2. 第一版是否接受五個正式關卡加一個不計分練習。
3. 是否接受駕駛 90 分、圖像 checkpoint 10 分。
4. 是否接受「輕／中／重力度＋按住油門／煞車」控制。
5. 是否接受每關可以無限重試，最終只評學生明確記錄的 run。
6. 是否接受第一版只向前，停止後不倒後。
7. 是否接受固定關卡而非每次隨機道路。
8. 是否接受 checkpoint 使用一條短選擇題，但主要分數仍來自操作。
9. 是否接受挑戰期間完全不顯示速度、加速度及位置數字。
10. 是否接受沿道路位置 `x` 作一維坐標，而所有坡度轉折均放在不計分過渡區。
