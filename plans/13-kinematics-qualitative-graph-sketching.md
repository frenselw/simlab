# 勻速與勻變速：三圖定性手繪挑戰計劃

## 0. 文件狀態

- 文件角色：新 SimLab 活動的產品、教學、互動、作圖模型、評分、持久化、SCORM 及測試規格。
- 計劃狀態：production implementation 已完成；自動 unit、SCORM package 及 source／packaged trusted-touch browser regression 已通過。真實學生筆跡 calibration／holdout 與 Moodle 實機驗收仍屬獨立 release gate。
- 計劃檔案：`plans/13-kinematics-qualitative-graph-sketching.md`
- 建議 slug：`kinematics-qualitative-graph-sketching`
- 學生可見標題：`勻速與勻變速：三圖手繪挑戰`
- 前置／相關活動：
  - `kinematics-driving-challenge`：以駕駛操作建立勻速、勻加速及勻減速的直覺；
  - `position-time-graph-motion-lab`：處理勻速直線運動的定量 `x–t` 圖、斜率及量度；
  - 本活動：把運動文字描述轉換成定性的 `x–t`、`v–t`、`a–t` 圖；
  - 未來活動：加入數值、斜率、面積及勻變速公式的定量作圖。
- 參考規格：
  - `AGENTS.md`
  - `plans/00-shared-platform-and-style.md`
  - `docs/simulation-scorm-production-guide.md`
  - `plans/NEW-SIMULATION-PLAN-TEMPLATE.md`
  - `plans/12-kinematics-driving-challenge.md`
- 題目語意、作圖資料模型、評分特徵、snapshot schema、測試及 packaging 均以本文件為基準。任何改變學習目標、題目集合、評分、容差或持久化契約的修訂，必須先更新本文件。

### 0.1 本次修訂已鎖定的改進

相對初稿，本版作出以下必要修訂：

1. 有效但不完整的圖不再因單一最差 readability 指標而整幅變成零分；
2. 合格條件加入 `x–t`、`v–t`、`a–t` 三個圖類別的最低分；
3. 明確定義 coverage、gap、roughness、oscillation、path length、局部斜率、端點及邊界計算；
4. 起始／終止斜率使用窗口回歸，不使用單一端點差分；
5. 校準資料預先分成 calibration 與 holdout，不能用同一資料調參及報告準確率；
6. 第一版 invalid editable draft 採 fail-closed；除非 shared runtime 另有正式、已測試的 recovery API；
7. 加入跨圖矛盾診斷，但不為「彼此一致但全部答錯」另加分；
8. 加入 primary-pointer／multi-touch 規則及測試；
9. 建議完成時間修訂為 20–30 分鐘，並以學生 pilot 再校準。

---

## 1. 目的與定位

建立一個手機優先的 SCORM 1.2 活動，要求學生根據直線運動的文字描述，親手畫出定性的：

- 位置—時間圖 `x–t`；
- 速度—時間圖 `v–t`；
- 加速度—時間圖 `a–t`。

本活動只考核圖像的物理特徵，不要求學生按指定數值作圖。系統檢查：

- 圖線位於正區、負區或零軸；
- 圖線整體增加、減少或保持不變；
- 圖線大致為直線、愈來愈斜或愈來愈平；
- `v–t`／`a–t` 圖是否大致水平或具有固定斜率；
- 分段運動的先後次序、連續性及停止條件；
- 同一情境三幅圖之間有沒有明顯定性矛盾；
- 圖線是否形成一個可判讀的運動圖，而不是空白、極短線段或無規律亂畫。

本活動不是選擇題播放器，亦不是一般畫圖程式。核心學習證據是學生最後提交的圖線本身。

### 1.1 教學定位

建議學習路線：

```text
駕駛控制挑戰
→ 本活動：定性三圖手繪
→ 定量圖像、斜率、面積與公式活動
```

本活動建立以下橋樑：

```text
實際運動／文字描述
→ 圖線的方向與形狀
→ x–t、v–t、a–t 三圖之間的關係
```

### 1.2 核心教學原則

1. 不提供速度、加速度、時間或位置的指定數值。
2. 不要求學生畫出數學上精確的拋物線。
3. 「勻加速的 `x–t` 圖」只要求明顯表現斜率逐漸增加。
4. 「勻減速的 `x–t` 圖」只要求位置繼續增加，而斜率逐漸減少至零。
5. 線性及二次擬合只作隱藏分析證據，不能成為唯一裁判。
6. 主要判斷依據是局部斜率、斜率趨勢、正負區域、水平程度、連續性及有效覆蓋。
7. 學生畫出的線不會被自動拉直、吸附到正確答案或改成標準拋物線。
8. 評分以最後提交狀態為準；重試、復原、擦除及查看質性提示不扣分。
9. 三圖關係以定性矛盾診斷補強，但每幅圖仍按題目物理特徵評分。

---

## 2. Scope

- Slug：`kinematics-qualitative-graph-sketching`
- 學生可見標題：`勻速與勻變速：三圖手繪挑戰`
- 學科分類：力學
- 建議完成時間：20–30 分鐘；以首次學生 pilot 的中位數及第 90 百分位再修訂
- 學生可見語言：繁體中文
- Libraries：無
- 技術：原生 HTML、CSS、JavaScript、SVG 及 Pointer Events
- Assessment risk：`formative`
- Trusted validation：不適用。瀏覽器端答案、分析器及 SCORM 分數可被修改，不作高風險考試或秘密驗證。
- 網絡資源：無
- 數學顯示：簡短符號以語意化 HTML／SVG 顯示，不載入 MathJax
- 核心作圖資料：固定寬度的單值函數 trace，不保存 Canvas 截圖或原始 pointer event 歷史

### 2.1 學習目標

完成活動後，學生應能：

1. 辨認 `x–t`、`v–t`、`a–t` 圖的橫軸都是時間；
2. 辨認三幅圖的縱軸分別代表位置、速度及加速度；
3. 用圖像表達正方向勻速運動的：
   - 向上直線 `x–t` 圖；
   - 正值水平 `v–t` 圖；
   - 零加速度 `a–t` 圖；
4. 用圖像表達正方向勻加速運動的：
   - 愈來愈斜的 `x–t` 圖；
   - 向上直線 `v–t` 圖；
   - 正值水平 `a–t` 圖；
5. 用圖像表達正方向勻減速至停止的：
   - 愈來愈平、最後斜率為零的 `x–t` 圖；
   - 向下直線並在最後到達零的 `v–t` 圖；
   - 負值水平 `a–t` 圖；
6. 在作圖時運用「`x–t` 圖的斜率代表速度」；
7. 在作圖時運用「`v–t` 圖的斜率代表加速度」；
8. 在作圖時運用「勻變速時 `a–t` 圖為水平線」；
9. 把「勻加速 → 勻速 → 勻減速至停止 → 靜止」轉換成三幅描述同一過程的分段圖；
10. 分辨「速度正在改變」與「速度以固定比率改變」。

### 2.2 學生任務

學生需要：

1. 完成一個不計分的畫板操作練習；
2. 完成四個情境、共十二幅定性圖：
   - 關卡 1：正方向勻速；
   - 關卡 2：已有正速度的勻加速；
   - 關卡 3：正方向勻減速至停止；
   - 關卡 4：四階段綜合運動；
3. 在同一情境內以 `v–t`、`a–t`、`x–t` 分頁切換，題目情境保持可見；
4. 使用畫筆、橡皮擦、復原、重做及清除；
5. 可按「檢查圖線」取得最多兩項質性提示；
6. 在提交前回到任何一幅圖修改；
7. 最後一次過提交十二幅圖，取得總分、逐圖物理回饋及跨圖矛盾提示。

### 2.3 第一版明確不包括

- 指定 `m`、`s`、`m/s` 或 `m/s²` 數值；
- 要求圖線穿過指定數值坐標；
- 由圖像計算斜率、面積、位移、速度或加速度；
- 勻變速公式及公式推導；
- 負方向勻速；
- 負速度下的加速／減速；
- 停止後反向運動；
- 非勻變速的任意曲線作圖；
- 分段加速度大小的比較；
- 多物體或多條圖線；
- 兩物體相遇；
- 教師自訂題庫；
- 任意改變階段長度；
- AI／機器學習筆跡分類；
- 逐像素與標準答案圖片比較；
- Canvas 截圖保存；
- 原始 pointer event 全歷史保存；
- 排行榜、限時排名、徽章或裝飾獎勵；
- 高風險考試、SCORM 2004、xAPI 或 LRS。

---

## 3. Catalogue metadata (`sim/config.js`)

```js
{
  title: "勻速與勻變速：三圖手繪挑戰",
  folder: "kinematics-qualitative-graph-sketching",
  categories: ["Mechanics"],
  description: "根據直線運動描述，親手畫出定性的 x–t、v–t 及 a–t 圖，並完成由加速到停止的分段綜合挑戰。",
  tags: [
    "physics",
    "mechanics",
    "kinematics",
    "motion-graphs",
    "position-time",
    "velocity-time",
    "acceleration-time",
    "drawing",
    "scorm"
  ],
  status: "planned"
}
```

登記要求：

- `folder`、活動目錄、manifest slug、snapshot activity identifier 完全一致；
- 未完成 package-ready checks 前保持 `planned`；
- 完成 package-ready checks 後才改為 `active`；
- tags 不重複；
- 不建立與現有活動重複的 catalogue entry。

---

## 4. 核心物理及圖像模型

### 4.1 第一版運動範圍

第一版只處理：

```text
v >= 0
```

物體可以：

- 保持正速度；
- 由正速度增加；
- 由正速度減少至零；
- 在零速度保持靜止。

物體不會反向，所以：

- `x–t` 圖不應向下；
- `v–t` 圖不應落到零軸以下；
- `a–t` 圖可以位於零軸上方、零軸或零軸下方。

### 4.2 三圖關係

活動以以下定性關係為準：

```text
x–t 圖的斜率 = 速度
v–t 圖的斜率 = 加速度
勻變速時，a–t 圖為水平線
```

| 運動 | `x–t` | `v–t` | `a–t` |
|---|---|---|---|
| 正方向勻速 | 向上直線 | 正值水平線 | 零軸 |
| 正方向勻加速 | 位置增加，斜率逐漸增加 | 向上直線 | 正值水平線 |
| 正方向勻減速 | 位置增加，斜率逐漸減少 | 向下直線 | 負值水平線 |
| 靜止 | 水平線 | 零軸 | 零軸 |

### 4.3 「類似拋物線」的教學界線

本活動不要求學生證明或精確畫出二次函數。對 `x–t` 圖只檢查：

- 位置是否按題意增加或不變；
- 局部斜率是否保持穩定、逐漸增加或逐漸減少；
- 停止時斜率是否接近零；
- 分段之間位置及速度是否合理連接。

回饋可以說：

> 圖線應愈來愈斜。

不可把回饋寫成：

> 你沒有畫出精確拋物線。

### 4.4 分段運動的連續性

在關卡 4：

- `x–t` 圖必須位置連續；
- `x–t` 圖的斜率在階段邊界應大致連續，因為速度不會瞬間跳變；
- `v–t` 圖必須數值連續，但斜率可以在邊界改變；
- `a–t` 圖可以在邊界跳變；
- `a–t` 圖不要求學生在邊界畫出精確垂直連接線；
- `a–t` 圖每個邊界左右各兩個 draw bins 為 transition gutter，不納入水平及正負評分。

### 4.5 三圖一致性的第一版邊界

第一版各圖仍以題目要求作權威評分，不為「三幅圖彼此一致但全部偏離題意」另加分。

完成同一情境三幅圖後，系統另作不計分的定性矛盾檢查：

- `a > 0`，但 `v–t` 斜率明顯為負；
- `a = 0`，但 `v–t` 明顯上升或下降；
- `v` 增加，但 `x–t` 斜率明顯減少；
- `v = 0` 的整段，`x–t` 仍明顯上升；
- `v` 到零後保持零，但 `x–t` 未接成水平；
- 分段先後次序不一致。

這些矛盾只產生診斷回饋，不改變已由各圖 rubric 計算的分數，避免同一錯誤被重複扣分。

第一版不比較：

- `v–t` 的斜率數值與 `a–t` 的高度；
- `x–t` 的切線斜率數值與 `v–t` 的高度；
- `v–t` 面積與 `x–t` 位置改變；
- 正、負加速度的大小比例。

### 4.6 勻減速至停止的時間邊界

關卡 3 的作圖時間在物體「剛好停止的一刻」結束：

- `v–t` 在最右端到達零；
- `x–t` 在最右端形成近乎水平切線；
- `a–t` 在整個已描述時間區間保持負值；
- 題目不描述停止後繼續施加負加速度；
- 停止後保持靜止只在關卡 4 明確呈現。

---

## 5. 針對的常見錯誤概念

活動及回饋必須直接處理：

- 把 `x–t` 圖當成物體實際行走的道路形狀；
- 認為勻速的 `x–t` 圖是水平線；
- 認為圖線愈高就代表物體愈快；
- 認為只要速度增加就是勻加速；
- 認為只要速度減少就是勻減速；
- 把勻加速的 `v–t` 圖畫成彎線；
- 把勻加速的 `a–t` 圖畫成向上斜線；
- 把勻減速的 `a–t` 圖畫在零軸上方；
- 認為速度為零時加速度一定為零；
- 認為負加速度代表負速度；
- 認為所有勻加速都必須由靜止開始；
- 在減速至停止後令 `v–t` 圖穿越零軸；
- 在物體停止後仍令 `x–t` 圖繼續上升；
- 在分段邊界令位置或速度突然跳變；
- 只看整幅圖的首尾，不看中間斜率是否有規律改變。

---

## 6. 整體學習流程

```text
共享 SCORM 啟動／恢復
→ 畫板操作練習（不計分）
→ 關卡 1：勻速三圖
→ 關卡 2：勻加速三圖
→ 關卡 3：勻減速至停止三圖
→ 關卡 4：四階段綜合三圖
→ 提交前檢視
→ 最後確認
→ SCORM 提交
→ 鎖定檢討
```

### 6.1 同一情境的三圖安排

- 每個情境保持一個固定題目標題；
- 圖像順序為 `v–t`、`a–t`、`x–t`；
- 手機及桌面都只顯示一個足夠大的 active plot；
- 三個圖類型以清楚標籤切換，不同圖不縮小成難以手繪的三欄；
- 已完成圖以縮圖及完成狀態顯示；
- 首次作答按固定順序；
- 學生可使用「稍後再做」留下空白答案；
- 十二幅圖均曾開啟後才進入提交前檢視；
- 檢視頁可返回任何圖修改；
- 提交前顯示空白／不可判讀圖會取得零分的警告；
- 學生仍可明確確認提交未完成答案。

### 6.2 「檢查圖線」

每幅圖提供「檢查圖線」：

- 不鎖定答案；
- 不顯示分數；
- 不顯示標準圖線；
- 最多顯示兩項最高優先級質性提示；
- 可以重複使用；
- 不扣分；
- 檢查結果由現時 trace 即時計算，不另存為權威答案。

完成同一情境三幅圖後，可另顯示最多一項跨圖矛盾提示。

### 6.3 提交後

提交後：

- 顯示學生的最終圖線；
- 顯示「一個可接受例子」的虛線示範，不稱為唯一答案；
- 顯示逐圖得分及物理回饋；
- 顯示跨圖矛盾提示及三圖關係總結；
- 同一 attempt 只讀，不可修改或再次提交。

---

## 7. 關卡及題目設計

共十二幅圖，固定 task IDs，不隨機化。

### 7.1 畫板操作練習（不計分）

提示：

> 試畫一條由左向右的線，再使用橡皮擦、復原及重做。這部分不計分。

要求：

- 不包含物理正確答案；
- 練習 trace 不保存到正式 answers；
- 可以直接按「開始挑戰」；
- 不設最低畫線長度或必做工具次數；
- 只用來確認學生懂得操作。

### 7.2 關卡 1：正方向勻速（15 分）

情境：

> 一個物體一直向正方向作勻速直線運動。

| Task | 圖 | 正確特徵 | 分值 |
|---|---|---|---:|
| `uniform-vt` | `v–t` | 零軸上方；大致水平；主要時間均有圖線 | 5 |
| `uniform-at` | `a–t` | 沿零軸；大致水平；主要時間均有圖線 | 5 |
| `uniform-xt` | `x–t` | 由起始標記附近開始；位置增加；非水平直線；斜率大致不變 | 5 |

細分：

- `uniform-vt`：正值區域 2；水平程度 3；
- `uniform-at`：接近零軸 3；水平及完整 2；
- `uniform-xt`：起始位置 1；位置增加 1；直線／固定斜率 3。

### 7.3 關卡 2：已有正速度的勻加速（25 分）

情境：

> 一個物體開始時已向正方向運動，其後作勻加速直線運動。

這個情境特意不由靜止開始，避免學生形成「所有勻加速圖都由原點開始」的錯誤規則。

| Task | 圖 | 正確特徵 | 分值 |
|---|---|---|---:|
| `accelerating-vt` | `v–t` | 正初速度；速度持續增加；向上直線 | 8 |
| `accelerating-at` | `a–t` | 零軸上方；大致水平 | 8 |
| `accelerating-xt` | `x–t` | 起點正斜率；位置增加；局部斜率逐漸增加 | 9 |

細分：

- `accelerating-vt`：正初速度 1；速度增加且保持正值 2；向上直線／固定斜率 5；
- `accelerating-at`：正加速度區域 3；水平程度 5；
- `accelerating-xt`：起始位置 1；初始正斜率 1；位置增加 1；愈來愈斜 6。

### 7.4 關卡 3：勻減速至停止（25 分）

情境：

> 一個物體開始時向正方向運動，其後作勻減速直線運動；作圖時間在物體剛好停止的一刻結束，物體沒有反向。

| Task | 圖 | 正確特徵 | 分值 |
|---|---|---|---:|
| `decelerating-vt` | `v–t` | 正初速度；向下直線；最右端到零；不穿越零軸 | 8 |
| `decelerating-at` | `a–t` | 零軸下方；大致水平 | 8 |
| `decelerating-xt` | `x–t` | 位置增加；不向下；斜率逐漸減少；末段接近水平 | 9 |

細分：

- `decelerating-vt`：正初速度 1；向下直線 4；最後到零且不反向 3；
- `decelerating-at`：負加速度區域 3；水平程度 5；
- `decelerating-xt`：起始位置 1；位置增加且不反向 2；愈來愈平 4；末段斜率接近零 2。

### 7.5 關卡 4：四階段綜合運動（35 分）

情境：

> 物體由靜止開始，先勻加速，再保持勻速，之後勻減速至停止，最後保持靜止。

圖面預先分成四個等寬階段：

```text
A 勻加速 | B 勻速 | C 勻減速至停止 | D 靜止
```

#### Task `composite-vt`（11 分）

- A：由零開始向上直線，2 分；
- B：正值水平線，2 分；
- C：向下直線並在段末到零，2 分；
- D：沿零軸，1 分；
- A/B、B/C、C/D 數值連續及次序正確，4 分。

#### Task `composite-at`（11 分）

- A：正值水平線，2 分；
- B：零軸，2 分；
- C：負值水平線，2 分；
- D：零軸，2 分；
- 各段覆蓋、次序及可判讀性，3 分；
- 不要求在邊界畫精確垂直連接線。

#### Task `composite-xt`（13 分）

- 起始位置，1 分；
- A：由近乎水平開始，愈來愈斜，3 分；
- B：接成斜率固定的向上直線，2 分；
- C：仍然上升但愈來愈平，段末斜率為零，3 分；
- D：水平線，1 分；
- 位置連續及 A/B、B/C、C/D 斜率大致連接，3 分。

---

## 8. 作圖器設計

### 8.1 單值函數 trace

作圖器保存：

```text
每一個時間位置 t，只能有一個主要縱座標 y。
```

每幅圖使用：

```text
DRAW_BINS = 96
0..254  已量化縱座標
255     空白
```

優點：

- 符合 `x(t)`、`v(t)`、`a(t)` 的函數意義；
- 手機及桌面使用相同評分方法；
- 可以精確恢復及重畫；
- 十二幅圖可安全放入 SCORM snapshot；
- 不需要圖片辨識。

### 8.2 畫筆行為

- `.graph-input-surface` 是固定 HTML overlay；
- `pointerdown` 建立 working operation；
- 只接受 `isPrimary === true` 的 active pointer；
- active drag 期間忽略所有其他 pointer；
- 相鄰事件跨過的 x bins 以線性插值填入；
- 同一時間 bin 的新值取代舊值；
- 可以由左向右或由右向左；
- 可以分多筆完成；
- 不自動吸附、拉直、補空白或改成 spline；
- 視覺線忠實連接相鄰有效 bins。

### 8.3 橡皮擦、復原及清除

- 橡皮擦只清除命中的時間 bins；
- 手機起始半徑約 12 CSS px，桌面約 9 CSS px；須經實機測試；
- 每次完整 pointer drag 是一個 undo operation；
- 最多保留 24 個 in-memory undo steps；
- redo 在新操作後清除；
- clear 要二次確認，並可作為一個 undo operation；
- undo／redo history 不寫入 SCORM；
- restore 後 trace 完全恢復，但 undo history 重新開始。

### 8.4 Pointer cancel／失焦

每次 drag 使用：

- committed trace；
- working trace；
- drag 開始前 backup。

正常 `pointerup`：

- working trace 成為 committed；
- 建立 undo step；
- 保存 draft。

`pointercancel`、window blur、visibility hidden 或技術鎖定：

- 回復 drag 前 committed trace；
- 不保存半完成筆劃；
- 解除 pointer capture；
- 顯示技術性回復提示。

### 8.5 手指遮擋

手機可顯示小型局部放大預覽：

- 固定於距離手指較遠的圖角；
- 顯示附近坐標軸、現有圖線及筆尖；
- 不改變輸入坐標；
- pointerup 後隱藏；
- 由集中常數開關，但不影響評分。

### 8.6 空白及稍後再做

- 空白圖可選「稍後再做」；
- 不自動放置預設答案；
- 空白提交得零分；
- 進入一幅圖不代表已回答。

---

## 9. 圖面與坐標設計

### 9.1 共用元素

每幅圖顯示：

- 情境文字；
- active 圖類型；
- 橫軸 `t`；
- 縱軸 `x`、`v` 或 `a`；
- 無數字、等距的淡色時間參考線；
- 工具列；
- 情境及圖像進度；
- 「稍後再做」及 navigation。

### 9.2 `x–t`

- 只顯示非負位置區；
- 左側提供無數字起始位置標記；
- 起始標記只規定起始高度，不代表實際米數；
- 不顯示數字刻度或答案容許區。

### 9.3 `v–t`／`a–t`

- 零軸位於圖面中間；
- 上方及下方標示 `+`、`0`、`−`；
- 學生線為實線，零軸為較薄灰線；
- 學生 trace 繪在坐標軸之上。

### 9.4 綜合圖

- 四段邊界由系統提供且不可移動；
- 邊界用淡色虛線；
- 階段名稱置於 plot 上方；
- `a–t` 邊界左右各 2 draw bins 為 transition gutter。

### 9.5 提交後示範

- 使用虛線並標示「一個可接受例子」；
- 不顯示像素級容許帶；
- 學生原線保持實線；
- 不暗示正確答案只有一條固定高度或斜率。

---

## 10. 圖線分析策略

### 10.1 正式流程

```text
96-bin 權威 trace
→ 結構及 gross attempt 檢查
→ 24-bin robust analysis trace
→ 完整度及可判讀性
→ 局部斜率、端點窗口及邊界窗口
→ 線性／二次擬合作輔助
→ 題目 feature 分
→ 跨圖矛盾診斷
```

### 10.2 24-bin analysis trace

```text
ANALYSIS_BINS = 24
```

處理：

1. 每四個 draw bins 取有效 y 中位數；
2. 全空保持空白；
3. 只為分析填補單一 analysis-bin 小空隙；
4. 在同一連續區段內作三點中位數濾波；
5. 再作最多五點的中心移動平均；
6. 不跨越長空隙、phase boundary 或 `a–t` transition gutter 平滑；
7. 不外推端點；
8. 分析結果不回寫顯示 trace。

Normalized y：

- `x–t`：底部 `0`，頂部 `1`；
- `v–t`／`a–t`：零軸 `0`，底部 `−0.5`，頂部 `+0.5`。

完整單題使用全圖 normalized time `t ∈ [0,1]`。

綜合題：

- 每段的形狀分析以該段局部時間 `u ∈ [0,1]` 計算；
- 跨邊界 slope continuity 以全圖時間 `t ∈ [0,1]` 計算；
- 容差不可混用兩種時間標準。

### 10.3 完整度及空隙

對指定分析範圍內的 `N` 個 bins：

```text
validCount       = 有效 analysis bins 數
coverage         = validCount / N
maxGapFraction   = 最長連續空白 bins / N
edgeStart        = 最早有效 bin 的 normalized time
edgeEnd          = 最後有效 bin 的 normalized time
edgeCoverage     = 0..1，兩端均接近指定範圍時為 1
```

`edgeCoverage`：

- 最早有效點 `<= 0.08` 且最後有效點 `>= 0.92`：1；
- 最早有效點 `>= 0.20` 或最後有效點 `<= 0.80`：0；
- 中間線性淡出；
- phase analysis 使用相同規則但以局部 `u` 計。

### 10.4 一階變化及區域

```text
startY = 起始 12.5% 窗口內最早三個有效 y 的中位數
endY   = 終止 12.5% 窗口內最後三個有效 y 的中位數
overallChange = endY - startY
```

若窗口內不足兩個有效點，相關 endpoint feature 為 0，不外推。

區域：

```text
ZERO_BAND = 0.08
y > +0.08  正區
|y| <= .08 零區
y < -0.08  負區
```

```text
positiveRegionRatio = 正區有效點 / 全部有效點
negativeRegionRatio = 負區有效點 / 全部有效點
zeroRegionRatio     = 零區有效點 / 全部有效點
```

完整 region score 由 ratio `0.65 → 0` 線性增加至 `0.85 → 1`。

零軸另使用 `P80(abs(y))`：

```text
<= 0.08  滿分
>= 0.18  0 分
中間線性淡出
```

### 10.5 局部斜率

每個完整範圍使用六個重疊窗口：

```text
[0.00,0.28]
[0.14,0.42]
[0.28,0.56]
[0.44,0.72]
[0.58,0.86]
[0.72,1.00]
```

- 每窗口至少三個有效點才計線性回歸；
- 少於四個有效 local slopes，趨勢 feature 不得分；
- `earlySlope`：最早兩個有效 local slopes 的中位數；
- `lateSlope`：最後兩個有效 local slopes 的中位數；
- `slopeDelta = lateSlope - earlySlope`；
- `slopeTrendRho`：窗口中心次序與 slope 的 Spearman correlation；
- Spearman ties 使用 average rank；
- 正負 slope ratio 忽略 `|slope| < 0.04` 的微小手震。

起始／終止 slope 不使用單一差分：

- `startSlope`：局部時間 `[0.00,0.22]` 內至少四點回歸；
- `endSlope`：局部時間 `[0.78,1.00]` 內至少四點回歸；
- 最外側單一落筆／收筆 bin 不會獨自決定端點斜率。

### 10.6 Roughness、oscillation 及 path length

全部使用已建立的 24-bin analysis trace，且只在連續有效區段計算。

一階差分：

```text
d_i = y_(i+1) - y_i
```

局部線性殘差：

```text
r_i = y_i - (y_(i-1) + y_(i+1)) / 2
```

定義：

```text
roughness = P80(abs(r_i))
```

`oscillationCount`：

- 先忽略 `|d_i| < 0.025` 的微小差分；
- 計算剩餘相鄰差分的符號改變次數；
- 不跨空隙或 phase boundary 計。

`pathLengthRatio`：

```text
pathLength =
  Σ sqrt((Δt)^2 + (Δy)^2)

pathLengthRatio =
  pathLength / horizontalSpan
```

- 只加總連續有效點；
- `horizontalSpan` 是首尾有效點的時間距離；
- horizontalSpan 為零時結構無效。

### 10.7 線性及二次擬合

使用相同有效點分別擬合：

```text
linear:    y = b0 + b1 t
quadratic: y = c0 + c1 t + c2 t²
```

```text
RMSE = sqrt(SSE / n)
BIC = n ln(max(SSE / n, 1e-8)) + k ln(n)
deltaBIC = BIC_linear - BIC_quadratic
```

- y 已按完整 plot 高度 normalized，因此 RMSE 不再除另一個 range；
- linear `k=2`，quadratic `k=3`；
- 兩個模型必須使用完全相同的點；
- `n < 6` 時不提供 quadratic support；
- `deltaBIC <= 2`：無明顯曲線證據；
- `deltaBIC >= 6`：較強曲線證據；
- 中間線性淡出；
- 擬合不修正學生圖線，亦不單獨決定直線／曲線。

### 10.8 邊界連續性

每個 phase boundary：

- `yLeft`：gutter 前最後兩個有效點中位數；
- `yRight`：gutter 後最早兩個有效點中位數；
- `boundaryYJump = abs(yRight - yLeft)`；
- 相鄰一側資料不足時，該 continuity feature 為 0。

Slope continuity：

- 左段最後 22% 以全圖 `t` 回歸；
- 右段最初 22% 以全圖 `t` 回歸；
- 每側至少四點；
- `boundarySlopeJump = abs(slopeRight - slopeLeft)`。

`a–t` 只評每段區域與水平，不評 y 或 slope continuity。

### 10.9 Gross attempt gate

以下結構情況整幅圖直接 0 分：

- 沒有有效 draw bin；
- trace decode 非 canonical、長度錯誤或含非法值；
- coverage `< 0.20`；
- 有效 analysis bins `< 6`；
- 任何衍生數值非 finite；
- `horizontalSpan = 0`；
- 以下三個 scribble signals 中至少兩個成立：
  - `pathLengthRatio > 6.0`
  - `oscillationCount > 10`
  - `roughness > 0.14`

只有 gross gate 可把整幅圖直接歸零。正常手震、單一空隙或一次修正不能獨自觸發 gross zero。

### 10.10 有效圖的 readability

Helpers：

```text
fadeUp(value, zero, full)
fullThenFade(value, full, zero)
```

```text
coverageScore =
  fadeUp(coverage, 0.50, 0.75)

gapScore =
  fullThenFade(maxGapFraction, 0.08, 0.16)

edgeScore =
  edgeCoverage

roughnessScore =
  fullThenFade(roughness, 0.045, 0.100)

oscillationScore =
  fullThenFade(oscillationCount, 3, 5)

readabilityFactor =
  0.45 * coverageScore
+ 0.20 * gapScore
+ 0.15 * edgeScore
+ 0.12 * roughnessScore
+ 0.08 * oscillationScore
```

重要：

- 不使用 `min(...)`；
- 單一弱項不會清除全部物理證據；
- feature 分仍乘以 `readabilityFactor`，因此只畫一小段不能取高分；
- endpoint、phase、boundary 等需要缺失區域的 feature 另直接為 0；
- 綜合題每段另計 `phaseReadabilityFactor`；
- 整幅綜合圖再乘：

```text
overallCompositeCoverageScore =
  fadeUp(overallCoverage, 0.60, 0.80)
```

### 10.11 直線、水平及曲率 feature

初始常數：

```text
linearityScore =
  fullThenFade(linearRMSE, 0.045, 0.110)

horizontalScore =
  fullThenFade(abs(lineSlope), 0.10, 0.24)

quadraticSupport =
  fadeUp(deltaBIC, 2, 6)

slopeIncreaseScore =
  0.55 * fadeUp(slopeDelta, 0.12, 0.35)
+ 0.30 * fadeUp(slopeTrendRho, 0.25, 0.60)
+ 0.15 * quadraticSupport

slopeDecreaseScore =
  0.55 * fadeUp(-slopeDelta, 0.12, 0.35)
+ 0.30 * fadeUp(-slopeTrendRho, 0.25, 0.60)
+ 0.15 * quadraticSupport
```

曲率分必須再乘題目所需的單調性／方向分，防止亂彎線只靠 quadratic support 取分。

若 straight 與 curve evidence 相差 `< 0.10`：

- 分數仍按連續 features 計；
- 回饋使用「特徵未夠清楚」；
- 不武斷標籤成另一種運動。

### 10.12 初始容差

所有常數集中於 `scoring.js` 的 `TOLERANCE`：

```js
const TOLERANCE = {
  drawBins: 96,
  analysisBins: 24,
  zeroBand: 0.08,
  grossMinCoverage: 0.20,
  minCoverage: 0.75,
  minCompositeCoverage: 0.80,
  minPhaseCoverage: 0.60,
  maxGapFraction: 0.16,
  grossMaxLengthRatio: 6.0,
  grossMaxOscillations: 10,
  grossMaxRoughness: 0.14,
  maxNormalOscillations: 5,
  roughnessFull: 0.045,
  roughnessZero: 0.100,
  lineRmseFull: 0.045,
  lineRmseZero: 0.110,
  horizontalSlopeFull: 0.10,
  horizontalSlopeZero: 0.24,
  slopeDeltaZero: 0.12,
  slopeDeltaFull: 0.35,
  slopeTrendRhoZero: 0.25,
  slopeTrendRhoFull: 0.60,
  bicSupportZero: 2,
  bicSupportFull: 6,
  regionRatioZero: 0.65,
  regionRatioFull: 0.85,
  startWindowEnd: 0.22,
  endWindowStart: 0.78,
  startAnchorFull: 0.08,
  startAnchorZero: 0.20,
  endZeroFull: 0.10,
  endZeroZero: 0.22,
  endFlatFull: 0.12,
  endFlatZero: 0.28,
  boundaryYJumpFull: 0.08,
  boundaryYJumpZero: 0.22,
  boundarySlopeJumpFull: 0.20,
  boundarySlopeJumpZero: 0.55,
  classificationAmbiguity: 0.10
};
```

以上只屬 calibration 起始值，必須通過 §19.4 holdout gate 才可定稿。

---

## 11. Scoring

### 11.1 Compact contract

```text
Total: 100
Passing threshold:
  total >= 65
  composite >= 18/35
  x–t >= 18/36
  v–t >= 16/32
  a–t >= 16/32
Penalties:
  無重試／工具使用扣分
  gross-invalid 圖為 0
  其餘按連續 feature 分
Lowest score: 0
Highest score: 100
```

### 11.2 分布

按關卡：

```text
關卡 1：15
關卡 2：25
關卡 3：25
關卡 4：35
```

按圖類別：

```text
x–t：36
v–t：32
a–t：32
```

圖類別底線防止學生完全不掌握 `v–t` 或 `a–t` 仍靠其他圖合格。

### 11.3 分數處理

- 每個 feature 保留 full precision；
- 十二幅圖加總後才四捨五入成整數；
- 圖類別及 composite mastery checks 使用未四捨五入分數；
- 最終 clamp 到 `0..100`；
- 不因重試、擦除、復原、檢查或跳題扣分；
- 空白／gross invalid 圖為 0；
- 不另加隱藏 bonus；
- 跨圖矛盾不重複扣分；
- 不保存 cached score 作權威資料。

### 11.4 Borderline 必測例子

- coverage `0.76`：coverage feature 滿分；
- coverage `0.74`：開始連續失分，但不整幅歸零；
- coverage `0.19`：gross zero；
- max gap `0.16`：gap feature 為 0，但其他物理 feature 不因 `min()` 被全部清除；
- 一條少量手震直線，即使 quadratic SSE 較低，仍獲 straight 高分；
- 首尾相同但中間大幅波動不能靠首尾值取高分；
- 勻減速 `v–t` 最右端到零取得 endpoint 滿分；
- 穿越零軸失去 no-reversal 分；
- 綜合 `a–t` 不畫垂直邊界線仍可滿分；
- 綜合 `x–t` 位置連續但斜率明顯跳變，失去 slope-continuity 分；
- 所有 `v–t` 或所有 `a–t` 為零分時不得合格；
- total `64.99`、composite `17.99`、各圖類別底線 just-inside／just-outside 全部測試。

---

## 12. 回饋設計

### 12.1 優先級

每次「檢查圖線」最多顯示兩項：

1. 空白／不可判讀；
2. 圖畫錯區域或穿越不應穿越的零軸；
3. 整體方向錯誤；
4. 直／彎特徵錯誤；
5. 起點、終點或停止條件；
6. 分段次序或連續性；
7. 覆蓋不足；
8. 輕微線形改善。

跨圖完成後最多另顯示一項最重要矛盾。

### 12.2 回饋例子

- 勻速 `x–t`：「位置在增加，但後段明顯更斜，表示速度仍在增加。」
- 勻加速 `x–t`：「圖線大致向上，但前後斜率接近，較像速度保持不變。」
- 勻加速 `v–t`：「速度正在增加，但圖線明顯彎曲；勻加速要求斜率大致固定。」
- 勻加速 `a–t`：「你把加速度畫成逐漸增加；題目要求固定的正加速度。」
- 勻減速 `v–t`：「圖線向下是正確方向，但最後穿過零軸，代表物體已反向。」
- 勻減速 `x–t`：「位置應繼續增加，只是圖線逐漸變平。」
- 跨圖：「你的 `a–t` 圖表示正加速度，但同一階段的 `v–t` 圖正在下降。」
- 不可判讀：「目前圖線未形成一條可判讀的運動曲線。請擦除多餘轉折，再表達整段運動。」

### 12.3 提交前不顯示

- 數值分數；
- 容差常數；
- 回歸係數；
- BIC、RMSE 或內部分類；
- 標準答案線；
- 正確答案區域；
- 像素修正提示。

---

## 13. Responsive layout contract

- Control-panel classification：`short natural flow`
- 原因：
  - 每次主要互動是一個大圖板；
  - 工具列、題目及 navigation 均短；
  - 不需要獨立捲動控制面板；
  - natural flow 避免 activity document 成為第三個 scroll owner。
- Non-interactive stage swipe owner：enclosing page／Moodle host
- Natural-flow controls-region swipe owner：enclosing page／Moodle host
- Activity document：正常自然 flow；不建立另一個獨立 panel scroll
- Desktop／tablet：情境／進度與 active graph 可並排；graph 仍保持主要空間
- Phone：情境 → 圖類型 tabs → 圖板 → 工具列 → 回饋 → navigation
- 不設橫向捲動。

圖板：

- width：`min(100%, 48rem)`；
- aspect ratio 起始值 `4 / 3`；
- 320 px viewport 的 plot 目標不少於約 `288 × 216` CSS px；
- 工具按鈕最少 `44 × 44` CSS px；
- 200% zoom 可換行但主要操作仍可達。

由於 graph overlay 會接管整個 plot gesture，plot 上方保留至少 44 px 高、全寬、非互動的情境／圖類型 header band，使用 `touch-action: pan-y`，讓學生在 Moodle iframe 內有清楚可用的 host-scroll 起始區域。

---

## 14. Touch gesture ownership contract

### 14.1 Draggable target inventory

| Target type | Selector／hit target | Capture target | Drag 中可否替換 |
|---|---|---|---:|
| 畫筆／橡皮擦圖板 | 固定 HTML overlay `.graph-input-surface` | overlay 自身 | 否 |

### 14.2 Gesture matrix

| Touch starts on | Owner | Expected result |
|---|---|---|
| 非互動 graph header、題目、圖板外空白 | Enclosing host | host 有 range 時 scroll；iframe 同步移動；activity document 不自行捲動；答案不變 |
| `.graph-input-surface` | Simulation | trace 改變；所有 host/document/viewport/iframe scroll delta 為 0；有 `pointermove`、`pointerup`；無 `pointercancel` |
| 工具按鈕 | Native tap | 只執行一次；不因 tap 捲動 |
| 第二個同時 touch pointer | 無新 owner | 忽略；不改 trace、不 commit、不建立 undo；primary pointer 繼續或安全完成 |

### 14.3 Technical decision

- 非互動 stage surface：`touch-action: pan-y`
- `.graph-input-surface`：在 `pointerdown` 前已是 `touch-action: none`
- 只接受 primary active pointer；
- active drag 期間 capture target 保持 mounted；
- SVG graphics `pointer-events:none`，不作 gesture boundary；
- render 可更新 SVG path，但不可替換 overlay；
- 不把 graph gesture 轉送 sibling controls；
- development source 及 built／extracted package 均以 trusted touch input 測試；
- Moodle current-window 及可用時 new-window 以實機手機重複。

---

## 15. Keyboard 及無障礙替代

### 15.1 鍵盤作圖

`.graph-input-surface` 可聚焦：

- `Space`：畫筆落下／抬起；
- `Left`／`Right`：沿 24 個 keyboard cursor positions 移動；
- `Up`／`Down`：以 plot 高度 1/24 移動；
- `Shift + Up/Down`：以 4/24 移動；
- pen-down 時左右移動會插值；
- `Delete`：擦除目前位置附近；
- `Ctrl/Cmd + Z`：復原；
- `Ctrl/Cmd + Shift + Z` 或 `Ctrl/Cmd + Y`：重做；
- `Escape`：取消未 commit keyboard operation。

鍵盤模式使用同一 96-bin trace。

### 15.2 可讀狀態

畫板提供不直接揭示答案的狀態文字：

- active 圖類型；
- 已覆蓋少量／約一半／大部分時間；
- 圖線整體上升／下降／接近水平／特徵未清楚；
- 位於正區／零附近／負區；
- 資料不足。

其他：

- 顏色不是唯一資訊；
- phase bands 有字母及文字；
- feedback 用節流的 `aria-live="polite"`；
- 不在每個 pointermove 朗讀；
- reduced motion 移除非必要動畫；
- 技術狀態不稱為已提交、合格或不合格。

---

## 16. Runtime files and responsibilities

```text
sim/kinematics-qualitative-graph-sketching/
  index.html
  styles.css
  main.js
  task-definitions.js
  task-definitions.test.js
  graph-model.js
  graph-model.test.js
  graph-analysis.js
  graph-analysis.test.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
  ui-policy.js
  ui-runtime.test.js
  accessibility.test.js

sim/manifests/kinematics-qualitative-graph-sketching.xml
tools/kinematics-qualitative-graph-browser-regression.js
tools/kinematics-qualitative-graph-calibration.js
```

重用：

```text
sim/shared/styles.css
sim/shared/scorm.js
sim/shared/activity-flow.js
```

責任：

- `task-definitions.js`：固定 task IDs、順序、文字、graph type、phase、anchor、expected features、分值、exemplar。
- `graph-model.js`：96-bin trace、pointer mapping、插值、pen／eraser、working／committed、undo／redo、canonical encoding。
- `graph-analysis.js`：24-bin analysis、coverage、roughness、fits、local slopes、endpoint／boundary features；不知道題目分值。
- `scoring.js`：gross gate、feature helpers、rubric、mastery floors、feedback classification、tolerances、final result。
- `persistence.js`：schema、answers encoding、phase validation、draft/review restore、size guard。
- `ui-policy.js`：shared lifecycle outcomes 到 learner-facing UI。
- `main.js`：DOM wiring、Pointer Events、keyboard、SVG render、transitions、draft save、SCORM glue。

---

## 17. Phase/state matrix

Production phases：

```text
practice
task
review
```

完成後由 finished review snapshot 及 shared lifecycle 呈現，不新增 editable `submitted` phase。

| Phase | Variant | Current step | Required semantic state | Must be absent／pristine | Allowed next action |
|---|---|---:|---|---|---|
| `practice` | new／restored | none | `visitedMask=0`；12 answers null | `taskIndex`、`returnToReview` | 開始 task 0 |
| `task` | first-pass | `0..11` | bits `0..taskIndex` visited；目前及過去 answer 可 null／trace | future visited bits；`returnToReview=true` | 下一圖／進 review |
| `task` | review-edit | `0..11` | `visitedMask=0xFFF`；answers 可 null／trace；`returnToReview=true` | 無 future restriction | 返回 review |
| `review` | incomplete | none | 全 visited；至少一圖 null、gross invalid 或 evidence incomplete | task fields | 編輯；警告後提交 |
| `review` | ready | none | 全 visited；12 圖均非 gross invalid | task fields | 編輯或提交 |

Transitions：

```text
practice -> task(first-pass, 0)
task(first-pass, i) -> task(first-pass, i+1)
task(first-pass, 11) -> review
review -> task(review-edit, i)
task(review-edit, i) -> review
review -> shared submission after explicit confirmation
success/committed -> locked review
frozen -> locked retry of identical payload
retryable retry -> editable review with same answers
non-retryable retry -> technical lock
```

Invariants：

- active answer 只存在於 `answers[taskIndex]`；
- working drag 是 transient；
- first-pass future answers 必須 null；
- review-edit 可保留所有 future answers；
- review 可包含 null，因為明確警告後容許 incomplete submission。

---

## 18. Persistence contract

### 18.1 Draft answer

```js
{
  v: 1,
  taskSetVersion: 1,
  phase: "practice" | "task" | "review",
  taskIndex: 0, // task only
  variant: "first-pass" | "review-edit", // task only
  visitedMask: 0,
  answers: [null, "canonical-base64url-96-byte-trace"] // length 12
}
```

### 18.2 Review answer

```js
{
  v: 1,
  locked: 1,
  taskSetVersion: 1,
  answers: [null, "canonical-base64url-96-byte-trace"] // length 12
}
```

Review 必須足以：

- validate；
- redraw；
- rerun analysis；
- rescore；
- regenerate feedback。

不保存：

- score／pass；
- cached features；
- fits；
- exemplar；
- SVG path／bitmap；
- undo history；
- feedback text。

### 18.3 Shared envelopes

```js
SimScorm.makeSnapshot(ACTIVITY, "draft", draftAnswer)
SimScorm.makeSnapshot(ACTIVITY, "review", reviewAnswer, result)
```

Authoritative：

- schema／task-set version；
- phase／variant／task；
- visited mask；
- 12 個 trace。

Derived：

- SVG；
- analysis features；
- scores／pass；
- feedback；
- readiness；
- controls；
- exemplar；
- progress。

Transient：

- pointer ID／capture；
- working trace／backup；
- hover／focus；
- magnifier；
- undo／redo；
- keyboard pen-down；
- open panels；
- DOM refs。

### 18.4 Size budgets

```text
activity draft answer                  <= 2400 bytes
activity review answer                 <= 2200 bytes
shared review snapshot envelope        <= 2800 bytes
full pending-final checkpoint          <= 3600 bytes
project absolute ceiling               < 4000 bytes
```

代表性最大值必須用 production encoder 實測。

### 18.5 Restore invariants

- supported schema／task version；
- legal phase／variant／task index；
- visited prefix valid；
- first-pass future answers null；
- review-edit／review visited mask 全滿；
- answers length 12；
- 每個 trace canonical 且 decode 為 96 bytes；
- no unknown enum／non-finite field；
- review `locked=1`；
- re-encode canonical；
- score、pass及legal continuation round-trip 不變；
- 每個 matrix fixture restore 後執行一個合法 continuation。

### 18.6 Invalid snapshot policy

- Invalid editable draft：
  - 第一版一律 fail closed；
  - 顯示 technical load error；
  - 不在 activity 內嘗試覆寫；
  - 不自行建立 Moodle new attempt；
  - 只有 shared runtime 日後提供正式、已測試 recovery API，才可另行更新計劃加入 reset。
- Invalid pending-final：
  - decode、validate、rescore、比對 canonical authoritative review；
  - deeper validation 失敗先呼叫 `SimScorm.quarantinePending()`；
  - 不 retry 不可信 payload；
  - technical lock。
- Invalid finished review：
  - 保持 locked；
  - 只顯示可信 Moodle summary；
  - 不重開作答。
- Unsupported version：
  - fail closed；
  - 不隱式 migration。

### 18.7 Save boundaries

保存：

- pointerup／keyboard commit；
- undo／redo／clear；
- navigation；
- phase change；
- 進入 review；
- shared lifecycle flush。

不在每個 pointermove 保存。

pagehide 若 active drag：

- rollback working trace；
- 保存上一個 committed trace；
- restore 後無 active pointer，工具回到畫筆。

---

## 19. 校準及驗收資料集

### 19.1 資料組成

最少覆蓋：

- 手機與滑鼠的向上／向下直線；
- 手機與滑鼠的正值／負值／零軸水平；
- 手機與滑鼠的愈來愈斜／愈來愈平；
- 三種 composite graph；
- endpoint、boundary、coverage、gap borderline；
- 物理上錯誤但畫得整齊的 distractors；
- 故意亂畫／不可判讀。

目標至少 240 個獨立 traces，核心類別及 input mode 不得只得單一裝置樣本。

至少兩位物理教師獨立標記：

```text
正確
可接受
錯誤
亂畫／不可判讀
```

### 19.2 Calibration／holdout 分離

- 收集完成後，以固定 seed 作 stratified split；
- 70% calibration set；
- 30% holdout set；
- 同一學生對同一題的近似重畫不得分到兩邊；
- holdout labels 在容差定稿前不可用來調參；
- 門檻定稿後只可運行一次正式 holdout report；
- 若再調參，必須另收新 holdout 或把報告標示為 exploratory。

### 19.3 Calibration harness

`tools/kinematics-qualitative-graph-calibration.js` 輸出：

- feature summary；
- rubric score；
- confusion matrix；
- per-class及per-device false zero／false full credit；
- straight／curve ambiguity；
- mastery pass outcomes；
- calibration與holdout分開報告；
- 不進 SCORM ZIP。

### 19.4 Package-ready gate

Holdout：

- 教師共識正確／可接受而被 gross zero `< 5%`；
- 教師共識亂畫而取得該圖 50% 以上 `< 5%`；
- 非 borderline straight／steepening／flattening 各類 recall `>= 85%`，整體 accuracy `>= 90%`；
- 每個 graph family 不得有單一類別 recall `< 80%`；
- 手機及滑鼠平均分差不系統性超過 5 percentage points；
- 可接受答案分布不能因單一 gap 或端點手震出現大量零分；
- 不達標時只調整集中常數或透明 feature combination，不使用黑盒 ML。

---

## 20. Shared SCORM lifecycle

Startup：

```js
const attempt = SimScorm.loadAttempt(ACTIVITY);
const startupState = SimActivityFlow.startup(attempt);
```

| Outcome | Editable | Behavior |
|---|---:|---|
| `review` | 否 | validate、restore、rescore、locked review或安全 Moodle summary |
| `editable` | 是 | create／restore draft，register provider |
| `frozen` | 否 | validate immutable pending payload，再 retry；不聲稱已提交或有可信分數 |
| `load-error` | 否 | technical lock；不顯示 pass／fail |

Submission：

```js
SimScorm.submitWithCallbacks(result, reviewSnapshot, callbacks)
SimActivityFlow.submission(outcome, handlers)
```

| Outcome | Editable | Behavior |
|---|---:|---|
| `success` | 否 | submitted locked review |
| `committed` | 否 | committed；以 `SimScorm.finish()` retry finish |
| `frozen` | 否 | pending／unconfirmed；retry identical payload；不顯示可信結果結論 |
| `retry` retryable | 是 | 返回 review；保留答案；可重新提交 |
| `retry` non-retryable | 否 | technical lock；不稱為 submitted |

Finished restore：

```text
validate review
→ restore 12 traces
→ run activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

- Moodle trust mismatch 時以 Moodle 記錄為優先並抑制不可信詳細回饋；
- unknown completion 不顯示「不合格」；
- submitted attempt 始終鎖定；
- Live Server 使用同一 submission path 及 local fallback；
- 不建立 activity-local pagehide、commit 或 finish logic。

---

## 21. Test plan

所有新 tests 加入 `tools/run-tests.js`。

### 21.1 Task definitions

- 12 IDs unique；
- points 按 level 15／25／25／35；
- graph-family points 36／32／32；
- task set version；
- prompt 不洩漏數值答案；
- exemplar 符合 expected features；
- composite phases 合法。

### 21.2 Graph model

- pointer mapping及插值；
- forward／backward draw；
- overwrite；
- eraser；
- multi-stroke；
- primary pointer only；
- second pointer ignored；
- undo／redo／clear；
- pointerup commit；
- pointercancel／blur／hidden rollback；
- keyboard commit／cancel；
- 96-byte exact canonical encode／decode；
- redraw exact。

### 21.3 Graph analysis

- horizontal／up line／down line；
- acceptable hand jitter；
- steepening／flattening；
- linear SSE與quadratic SSE edge cases；
- missing bins；
- endpoint windows；
- local phase time versus global boundary time；
- Spearman ties及不足四 slopes；
- roughness公式；
- oscillation dead band；
- path length；
- gross gate two-of-three scribble rule；
- positive／negative／zero；
- `a–t` gutter；
- deterministic repeated analysis；
- all tolerance boundaries。

### 21.4 Scoring

- 每題滿分／主要錯誤／partial；
- gross invalid zero；
- valid gap不會令全圖因 `min()` 歸零；
- category totals；
- total、composite及三個 graph-family mastery floors；
- just-inside／outside；
- final rounding only；
- feedback priority最多兩項；
- cross-graph contradiction不重複扣分。

### 21.5 Persistence

每個 matrix row：

- encode／decode／restore；
- `score(original) === score(restored)`；
- 執行一個合法 continuation；
- invalid phase／variant／task／visited prefix；
- future answer in first-pass；
- answers length；
- canonical trace；
- maximum size；
- invalid editable draft fail closed；
- invalid finished review locked；
- pending deeper reject calls quarantine。

### 21.6 Lifecycle UI

- startup review／editable／frozen／load-error；
- submission success／committed／frozen／retryable retry／non-retryable retry；
- trusted review；
- score／pass mismatch；
- unknown Moodle status；
- technical states使用誠實文字；
- production render logic，不以 source-string 搜尋代替。

### 21.7 Browser、touch 及 responsive

Development source及built／extracted package：

- `320×500`、`390×500`、`390×600`；
- normal portrait、landscape、tablet、desktop、200% zoom；
- browser toolbar、software keyboard；
- no horizontal scroll；
- primary actions reachable；
- trusted swipe from graph header scrolls host and does not change answer；
- trusted graph drag changes trace only；
- all host/document/viewport/iframe deltas 0 during draw；
- pointermove／pointerup；no pointercancel；
- eraser；
- backward／edge／long diagonal；
- second simultaneous touch ignored；
- tool tap once；
- keyboard mode；
- magnifier；
- zero-axis trace visible；
- review trace與exemplar可分。

### 21.8 Accessibility

- focus order；
- labels；
- active tool非只靠顏色；
- keyboard drawing；
- live-region throttling；
- axis names；
- phase text；
- reduced motion；
- technical wording；
- warnings screen-reader readable。

### 21.9 Package

- manifest列出全部 runtime dependencies；
- tests／fixtures／calibration data不進 ZIP；
- root `imsmanifest.xml`；
- `npm run check`；
- `npm test`；
- `npm run package:all`；
- `git diff --check origin/main...HEAD`；
- extracted package browser smoke；
- extracted package trusted touch matrix。

在 Windows 環境按 production guide 使用 `npm.cmd` 及指定 Git Bash／Playwright 路徑。

---

## 22. Acceptance checks

### 22.1 教學

- 每幅圖需要直接作圖或鍵盤作圖；
- 無具體數值要求；
- 不同合理斜率及高度可得高分；
- `x–t` 曲率按斜率趨勢而非精確拋物線；
- 三個 graph family 都要達 mastery floor；
- composite 表達同一四階段過程；
- 跨圖矛盾有診斷；
- 亂畫／空白不能取得有利分數；
- 正常手震及單一 gap 不會意外清除整幅分數。

### 22.2 技術

- phone、tablet、desktop usable；
- pointer trace 所見即所得；
- no snapping；
- exact restore／rescore；
- snapshot size pass；
- scoring pure及 Node-testable；
- no activity-local raw LMS calls；
- all lifecycle outcomes honest；
- source及built artifact都通過 browser／touch gate。

### 22.3 Moodle-ready

- real student account records score／status；
- draft resume；
- pending retry；
- finished attempt review-only；
- new attempt policy；
- current-window real phone matrix；
- offered 時 new-window matrix；
- evidence 獨立記錄。

---

## 23. 實作次序

### Phase A：規格、graph prototype 及 touch spike

1. 批准本計劃；
2. 建立固定 HTML graph overlay；
3. 驗證 primary／secondary pointer；
4. 在 scrollable Moodle-like iframe 測 trusted touch ownership；
5. 確認 natural flow、host-scroll header 及 scroll topology；
6. 未通過不得開始完整 UI。

### Phase B：作圖模型

1. 96-bin trace；
2. pen／eraser；
3. undo／redo；
4. encode／decode；
5. pointercancel rollback；
6. keyboard mode；
7. graph-model tests。

### Phase C：分析器

1. 24-bin trace；
2. 明確 feature formulas；
3. local slopes及endpoint windows；
4. fits及BIC；
5. readability及gross gate；
6. synthetic production-shaped fixtures。

### Phase D：題目、UI及初步評分

1. task definitions；
2. grouped three-graph flow；
3. 12幅圖；
4. feedback及cross-graph diagnostic；
5. review；
6. accessibility；
7. scoring及browser tests。

### Phase E：真實筆跡校準

1. 收集及雙教師標記；
2. 固定 stratified split；
3. calibration set 調參；
4. 凍結 constants；
5. 正式 holdout report；
6. 通過 §19.4 gate。

### Phase F：Persistence及SCORM

1. phase matrix；
2. schemas；
3. size guards；
4. shared lifecycle；
5. invalid-state tests；
6. manifest。

### Phase G：Artifact及Moodle

1. package-ready gates；
2. extracted ZIP smoke；
3. built artifact trusted touch；
4. real Moodle student；
5. real phone current／new-window；
6. Moodle-ready evidence。

---

## 24. Package-ready checklist

- [ ] 本計劃已批准。
- [ ] Slug、folder、manifest、snapshot activity ID 一致。
- [ ] 12 tasks及100分rubric完成。
- [ ] Graph-family mastery floors完成。
- [ ] 無數值作圖要求。
- [ ] Graph editor不吸附答案。
- [ ] Gross invalid及partial evidence分開。
- [ ] Readability不用單一最差值清除全部分數。
- [ ] Straight／curve不只靠fit error。
- [ ] Feature formulas及時間 normalization 完整實作。
- [ ] Calibration／holdout gate通過。
- [ ] Phase matrix每個 row可restore及continue。
- [ ] Review可由authoritative traces重畫及rescore。
- [ ] Snapshot及pending payload低於budget。
- [ ] Invalid editable draft fail closed。
- [ ] Startup及submission全部 outcomes 有誠實 UI。
- [ ] Source及built artifact trusted touch matrix通過。
- [ ] Multi-touch規則通過。
- [ ] Phone、landscape、zoom、keyboard可用。
- [ ] `npm run check`通過。
- [ ] `npm test`通過。
- [ ] `npm run package:all`通過。
- [ ] `git diff --check origin/main...HEAD`通過。
- [ ] ZIP root有`imsmanifest.xml`。
- [ ] Runtime dependencies全部在manifest。
- [ ] Tests、fixtures及calibration data不進ZIP。
- [ ] Built／extracted launch browser smoke通過。
- [ ] Assessment risk為formative。

---

## 25. Moodle-ready checklist

- [ ] Package-ready完成。
- [ ] Moodle以SCORM 1.2上載。
- [ ] Student account測試。
- [ ] Score、pass及completion正確記錄。
- [ ] Draft resume。
- [ ] Pending retry。
- [ ] Finished attempt只讀。
- [ ] New attempt policy正確。
- [ ] Real phone current-window gesture matrix通過。
- [ ] Offered時new-window gesture matrix通過。
- [ ] Moodle evidence獨立記錄。
- [ ] 不把local／package tests當作Moodle-ready證據。
