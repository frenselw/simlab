# 位置—時間圖運動實驗室計劃

## 0. 文件狀態與現行規格關係

- 文件角色：第一代活動的基礎產品、教學、互動、評分及 SCORM 設計。
- 實作狀態：核心活動已完成，並經多輪 mobile UI、互動、持久化、提交安全及 browser regression 修訂。
- 現行題目版本：新 blank attempt 使用 generator version 2 及 persistence schema version 2。
- 後續規格：`plans/11-position-time-generated-question-randomization.md` 是本文件的第二代題目生成、
  數值 lattice、v2 persistence 及新 attempt 防重補充規格。
- 相容範圍：本文件定義的 version 1 `alpha`／`beta`／`gamma` 固定題庫仍保留，只用於恢復及
  檢討舊 draft／review；新 attempt 不再由三套固定題目中抽取。
- 驗收狀態：production、unit、persistence、SCORM package 及 extracted-package Chrome gates 已完成；
  真實 Moodle student 多 attempt 及 Windows 實機證據仍待完成。
- 對照日期：2026-07-20。

本文件正文保留第一代設計及其決策背景，不倒修改成好像一開始已採用第二代生成器。當本文件
與 Plan 11 在下列範圍有衝突時，以 Plan 11 為現行規格；沒有被取代的學習目標、五題任務語意、
評分、容差、phase 流程、回饋及 SCORM lifecycle 繼續以本文件為準。

| 本文件章節 | 現行狀態 |
|---|---|
| §1–§8.5 | 保持有效；後續 UI 修訂記錄於 §24 |
| §8.6 的 `scenarioSetId` 選取 | 只適用於 v1；v2 改為建立 128-bit seed 及完整 generated paper |
| §9.1 | 固定三套題目只作 v1 compatibility；新 attempt 由 Plan 11 有限候選池生成 |
| §9.2、§9.3、§9.5、§9.6 的固定數值 contract | 任務語意及評分保持；generated values 由 Plan 11 lattice 取代 |
| §9.4 任務 3 | 核心數值及評分保持；v2 另加入 category-first selection |
| §10.3 | v1 library validation 保留；v2 另用 generated mission／paper validators |
| §12 | learner-facing phase 不變；v2 semantic state 以 generator metadata、seed 及 paper 取代 `lv + sid` |
| §16 | 原檔案表是 v1 baseline；現行 runtime 另有 `generator.js` 及 `ui-runtime.js` |
| §17 | 原 compact schema 是 v1 contract；現行 v2 schema 由 Plan 11 §18 定義 |
| §20–§22 | 原 gates 保持；另加入 generator property sweep、v1/v2 compatibility 及 packaged browser gates |

## 1. 目的與定位

建立一個 SCORM 1.2 活動 `position-time-graph-motion-lab`，讓學生透過直接操作、
同步動畫、圖線繪製及數據量度，理解勻速直線運動的 x–t 圖（位置—時間圖）。

活動分成兩個清楚階段：

1. **自由探索**：學生任意設定起點與速度，觀察車的運動及 x–t 圖如何同步形成；
   探索不設問題、不要求比較、不計分，亦不設最低完成次數。
2. **操作評估**：學生完成五個操作任務，包括設定運動、畫圖、以探針量度斜率、
   建立特殊運動狀態及安排兩車相遇；總分 100，屬低風險小功課。

本活動不是選擇題播放器。核心學習證據來自學生最後提交的物理狀態、圖線、
量度點及計算答案，而不是按過多少次按鈕或試過多少次。

所有學生可見文字使用繁體中文。正式名稱採用「位置—時間圖（x–t 圖）」，
避免把非零初始位置的座標 `x` 誤稱為由起點量度的位移 `Δx`。

## 2. 範圍

- Slug：`position-time-graph-motion-lab`
- 學生可見標題：`位置—時間圖運動實驗室`
- 學科分類：力學
- 核心模型：一維勻速直線運動 `x = x₀ + vt`
- 主要操作：拖車設定初始位置、拖速度箭嘴設定速度、播放或逐步觀察、拖動時間游標、
  拖動圖線控制點、放置量度探針、輸入量度所得速度、設定兩車相遇
- 評估風險：`low-risk graded`
- 信任邊界：接受瀏覽器端計分只適合低風險小功課；不把答案、計分程式或 SCORM
  分數視為防篡改資料
- 第三方程式庫：無
- 網絡資源：無
- 數學顯示：簡短公式以語意化 HTML 顯示，不載入 MathJax
- 圖形方式：原生 SVG 繪製跑道、車、速度箭嘴、坐標軸、圖線、控制點及探針；
  DOM 顯示控制、數據及回饋

### 2.1 第一版明確不包括

- 加速度、變速運動及曲線 x–t 圖；
- v–t 圖或 a–t 圖；
- 二維運動；
- 路程與位移大小比較；
- 圖軸比例改變或「不同縮放下不可直接比較斜率」的正式考核；
- 教師自訂題庫；
- 多人合作、排行榜或遊戲化獎章；
- SCORM 2004、xAPI 或 LRS；
- 儲存逐幀動畫、完整拖動軌跡或探索歷史；
- 高風險考試用途。

## 3. Catalogue metadata (`sim/config.js`)

計劃中的登記資料如下：

- `title`：`位置—時間圖運動實驗室`
- `folder`：`position-time-graph-motion-lab`
- `categories`：`["Mechanics"]`
- `description`：`自由設定車的起點和速度，觀察、繪畫及量度位置—時間圖，再完成操作評估。`
- `tags`：`["physics", "mechanics", "kinematics", "position-time-graph", "motion", "scorm"]`
- `status`：完成全部 package-ready checks 後才設為 `active`

登記時必須確認：

- `folder` 與活動目錄及 manifest slug 完全一致；
- 不建立重複 entry；
- 未達 package-ready 前保持 `planned`；
- tags 不重複，並沿用現有 hub 的英文搜尋標籤慣例。

## 4. 學習目標

完成活動後，學生應能：

1. 說明 x–t 圖橫軸是時間 `t`、縱軸是位置 `x`；
2. 把圖線在 `t = 0` 的縱軸截距連結到初始位置 `x₀`；
3. 把直線斜率連結到速度 `v`；
4. 在相同坐標比例下，以斜率絕對值比較速度大小；
5. 以正斜率、零斜率及負斜率分辨正方向運動、靜止及負方向運動；
6. 從圖上兩點量度 `Δx`、`Δt`，再以 `v = Δx / Δt` 求速度；
7. 說明兩條 x–t 圖線的交點代表兩物體在同一時間位於同一位置；
8. 根據指定 x–t 圖建立相應運動，或根據運動畫出相應直線。

## 5. 針對的常見錯誤概念

活動及回饋必須直接處理以下錯誤：

- 認為圖線較高的物體一定較快；
- 只看線段長度，不看 `Δx / Δt`；
- 把負速度理解成「速度比較小」而不是相反方向；
- 認為水平線代表時間停止；
- 把 x–t 圖當成車實際行走的山坡或路徑形狀；
- 認為兩線相交代表兩車速度相同；
- 忽略初始位置，只從原點開始畫線；
- 計算速度時漏去正負號或混淆 `m` 與 `m/s`。

## 6. 整體學習流程

```text
啟動／恢復
→ 自由探索
→ 學生自行按「開始小功課」
→ 操作任務 1 至 5
→ 提交前檢視
→ 最後確認
→ SCORM 提交
→ 鎖定檢討
```

自由探索沒有完成門檻。學生第一次進入時直接看到可操作的模擬，不顯示 landing page、
比較題、必做 checklist 或「探索進度」。

正式評估採順序首次作答及提交前自由回看：

- 第一次進入任務時按 1 至 5 順序前進；
- 每個任務均可暫存未完成答案並選擇「稍後再做」；
- 五個任務都曾進入後，顯示提交前檢視；
- 檢視頁列出「已完整／未完整」，不顯示對錯；
- 學生可返回任何任務修改，再返回檢視；
- 最後提交前明確確認；
- 提交後只可檢討；不可再拖動答案控制、修改或重交同一次 attempt，但可使用不改答案的
  只讀回到 `t = 0` 及時間 scrub。

## 7. 畫面與資訊架構

### 7.1 共用主畫面

主畫面有一個連續的 responsive split-pane shell：

- **上方視覺區**：頁首、跑道及 x–t 圖組成同一捲動區，跑道在上、x–t 圖在下，
  兩者共用時間游標；在空間足夠時保持同屏，在矮屏或放大模式下整個上方區依次捲動到達，
  不再由主舞台建立內層捲動區；
- **操作面板**：模式、任務指示、數值、播放控制、答案狀態及主要行動；
- 桌面：操作面板在左、主舞台在右；
- 手機使用固定視窗版面：完整上方視覺區置頂並可整體捲動，控制面板在下方獨立捲動；
  手機頁首隱藏與面板重複的 phase badge，狀態仍由面板任務標題清楚顯示；
- 只有 viewport 高度足夠時才使用有 `max-height` 的 compact sticky 舞台，且不得遮擋
  操作面板、主要按鈕或鍵盤 focus target；
- 不使用多層 card-in-card；以分隔線劃分設定、播放、量度及提交區。

### 7.2 跑道區

- 顯示由 `−20 m` 至 `+20 m` 的水平位置軸；
- 明確標示正方向向右、負方向向左；
- 車的中心點代表其位置，避免用車頭或車尾造成讀數歧義；
- 起點拖動只在尚未播放或已重設時生效；
- 車旁速度箭嘴的方向代表速度正負，長度代表速度絕對值；
- 播放期間速度箭嘴跟隨車中心並保持可見，但鎖定為只讀，直至回到 `t = 0`；
- 車、速度箭嘴、讀數及相應圖線使用一致顏色；
- 雙車任務使用藍色 A 車及琥珀色 B 車，並附文字／圖案標籤，不能只靠顏色辨識。

### 7.3 x–t 圖區

- 橫軸：`時間 t / s`，固定 `0` 至 `6 s`；
- 縱軸：`位置 x / m`，固定 `−20` 至 `+20 m`；
- 所有探索及正式任務使用相同坐標比例，令斜率比較有一致意義；
- SVG 使用固定 logical viewBox 及固定 aspect ratio，不作非等比例 stretch；
- 實作前以手機寬度確認 `v = ±1 m/s` 與 `v = ±2 m/s` 的斜率清楚可辨；若不可辨，
  調整舞台尺寸而不是在不同任務任意改變坐標比例；
- 圖線由 `t = 0` 開始，播放時只畫到當前時間；
- 當前運動點與車同步；
- 時間游標同時穿過圖線並更新車的位置；
- 坐標格只作視覺參考；操作值可採固定步距，但不以視覺網格強迫不合理吸附；
- 學生畫線時顯示大型拖動手柄及數值標籤；
- 正式提交前不疊加正確答案線。

### 7.4 即時數據區

至少顯示：

- `t`：當前時間，單位 `s`；
- `x`：當前位置，單位 `m`；
- `x₀`：初始位置，單位 `m`；
- `v`：速度，單位 `m/s`，保留正負號；
- 探針 P、Q 的 `(t, x)`；
- `Δt`、`Δx`；
- 正式評估中的答案完整狀態。

## 8. 自由探索模式

### 8.1 操作目標

自由探索只讓學生「設定—播放—觀察—量度—再設定」，不出題、不要求比較、
不判定正誤、不計分。

### 8.2 可調物理量

- 初始位置 `x₀`：`−8 m` 至 `+8 m`，步距 `1 m`；
- 速度 `v`：`−2.0 m/s` 至 `+2.0 m/s`，步距 `0.5 m/s`；
- 播放時間固定 `0` 至 `6 s`；
- 上述範圍保證 `x = x₀ + vt` 在整段探索內留在 `−20 m` 至 `+20 m` 的舞台內。

學生可用三種等價方式調整：

1. 在跑道上拖車設定 `x₀`；
2. 拖速度箭嘴設定 `v`；
3. 用操作面板的滑桿及 `−／＋` 微調按鈕設定同一數值。

拖動與面板數值必須雙向同步。任何方式都不可建立隱藏或互相矛盾的第二套狀態。

### 8.3 快捷情境

提供非強制的快捷設定：

- `靜止`：`x₀ = 0 m, v = 0 m/s`
- `慢速向右`：`x₀ = −6 m, v = +1 m/s`
- `快速向右`：`x₀ = −6 m, v = +2 m/s`
- `慢速向左`：`x₀ = +6 m, v = −1 m/s`
- `快速向左`：`x₀ = +6 m, v = −2 m/s`
- `由非零位置出發`：`x₀ = +4 m, v = +1.5 m/s`

快捷設定只是方便入口，不顯示「完成」或「正確」。學生仍可在載入後修改所有數值。

### 8.4 播放及重設規則

- `播放`：由當前時間繼續；
- `暫停`：保留當前時間及圖線；
- `前進 0.5 s`：只在暫停時可用；
- `拖動時間游標`：暫停並重建由 `0` 至該時間的圖線；
- `回到 0 s`：回到 `t = 0`，保留 `x₀`、`v`，清除探針；
- 修改 `x₀` 或 `v`：自動回到 `t = 0` 並清除舊圖線及探針，避免把兩次運動混成一條線；
- 播放期間鎖定起點、速度箭嘴、快捷情境及數值控制；先暫停並重設才可改物理參數；
- 到 `6 s` 自動暫停，不循環播放。

### 8.5 量度探針

- 學生可在已形成的圖線上加入探針 P、Q；
- 每個探針沿圖線拖動，以 `0.5 s` 為時間步距；
- 圖線上的位置由物理模型計算，不讓探針離開圖線後仍顯示為有效量度；
- P、Q 顯示各自 `(t, x)`；介面、圖線標籤及無障礙名稱一律使用中性 P／Q，
  不以「初／末」暗示時間先後；
- 系統顯示帶正負號的 `Δx = xQ − xP` 及 `Δt = tQ − tP`；
- 探針順序不強制，但顯示公式時按實際 P、Q 次序計算，避免暗中改答案符號；
- 探索模式可另顯示 `v = Δx / Δt` 的代入結果，因為此區不評分；
- 當 `Δt = 0`，顯示「兩個探針時間相同，未能計算速度」，不顯示 Infinity 或 NaN。
- 若時間游標向後移到任何探針時間之前，清除 P、Q，避免探針顯示在尚未形成的圖段上。

### 8.6 進入評估

- `開始小功課` 始終可用，不以探索次數解鎖；
- 按下後顯示簡短說明：探索不計分，正式部分共五個操作任務，最後一次過提交；
- 學生確認後選定並凍結本次 `scenarioSetId`；
- 探索數值不會成為正式答案；
- 正式評估開始後不返回自由探索，以保持活動 phase、草稿與提交語意清楚；
- 每個正式任務仍提供播放、暫停、回到 `0 s` 及必要的量度工具。

## 9. 正式評估概覽

### 9.1 版本化情境庫

第一版不建立通用隨機題目產生器。使用一個小型、人工驗證、不可在同一版本內改寫的
情境庫：

- `scenarioLibraryVersion = 1`；
- 至少三個 scenario sets，每個 set 各有五個固定題型情境；
- 開始評估時隨機選一個 `scenarioSetId`，隨即保存並在該 attempt 內凍結；
- 同一次 attempt 的恢復及檢討以 `scenarioLibraryVersion + scenarioSetId` 重建完全相同情境；
- 新版本不得原地改寫已發布 set；要改數值就新增 library version，並保留舊版本讀取資料；
- 每個 set 均由測試及人工視覺檢查證明在固定坐標範圍內、數值清晰且容差不含糊；
- 三個 sets 合計必須覆蓋正、負、零速度、較高但較慢的圖線、兩車不同起點及不同相遇位置；
- 正確值使用情境庫精確值計分，顯示值必須能精確表達該值，不能以隱藏高精度值考學生；
- 學生第一次進入任務時所有答案控制維持未設定，不預填正確或中性答案。

### 9.2 任務 1：根據目標圖設定運動（20 分）

畫面顯示一條目標 x–t 直線，但不顯示其 `x₀`、`v` 公式值。學生要：

1. 讀取圖線截距及斜率；
2. 在跑道上拖車設定 `x₀`；
3. 拖速度箭嘴設定速度大小及方向；
4. 播放自己的車，讓學生圖線由左至右逐步形成；
5. 可重設及再試；
6. 保存目前設定作為答案。

情境規則：

- 每個 set 使用 `x₀ = −8..+8 m` 內的整數；
- `v` 使用 `−2, −1, +1, +2 m/s`；
- 全段位置必須留在 `−20..+20 m`；
- 目標線與學生線顏色、實線／虛線及圖例均不同，且不只靠顏色區分。

提交答案：學生設定的 `{x₀, v}`。

### 9.3 任務 2：根據運動畫出 x–t 圖（20 分）

系統提供一架已設定的車，顯示跑道動畫及 `t`、`x` 即時讀數，但不先畫出圖線。
跑道同時以隨車移動的垂直虛線、軸上三角標記及 `x = … m` 標籤投影車中心位置，
讓學生可直接對照跑道刻度；該輔助標記只提供當前位置，不顯示答案圖線或斜率。
學生要：

1. 任意播放、暫停、逐步前進及回到 `0 s`；
2. 在空白坐標圖上拖動起點手柄，設定 `t = 0` 時的位置；
3. 拖動終點手柄，設定 `t = 6 s` 時的位置；
4. 系統以兩個手柄畫出學生的直線；
5. 可再次播放車並自行比較時間讀數，但不顯示正確線；
6. 保存目前兩個控制點作為答案。

為降低手機操作難度，兩個手柄的時間座標固定為 `0 s` 及 `6 s`，學生只拖動其位置；
物理考核仍同時涵蓋截距與斜率。

情境規則：

- 每個 set 使用 `x₀ = −8..+8 m` 內的偶數；
- `v` 使用 `−2, −1, +1, +2 m/s`；
- 終點必須留在坐標範圍內；
- 不在此任務抽取 `v = 0`，靜止由任務 4 處理。

提交答案：`t = 0` 與 `t = 6 s` 兩個學生圖點的位置座標。

### 9.4 任務 3：量度兩車速度並比較斜率（20 分）

系統在同一固定坐標圖顯示 A、B 兩條未知速度的 x–t 直線，不顯示速度。兩線使用不同
起點，其中至少一個 scenario set 刻意令「圖線較高」的車反而較慢，以直接檢查學生是否
根據斜率而非圖線高度判斷速度。

學生要：

1. 選擇 A 線，把 P、Q 探針拖到兩個不同時間；
2. 讀取 A 的 `(tP, xP)`、`(tQ, xQ)`、`Δt`、`Δx`，計算並輸入帶符號的 `vA`；
3. 切換到 B 線，以另一組保存的 P、Q 重複量度並輸入 `vB`；
4. 把「速度大小較大」標記拖到 A、B 或「一樣快」目標區；
5. 保存兩組探針、兩個速度及比較標記。

有效量度要求：

- 探針沿所選圖線移動，時間以 `0.5 s` 步距；
- 每條線的兩探針均須存在且 `|Δt| ≥ 2.0 s`，才算完成該線量度；
- P、Q 可左右次序互換，只要 `Δx / Δt` 保留一致符號；
- 數值欄接受有限數字及一個小數位，單位固定顯示為 `m/s`；
- 同一答案可保存 `0/1/2` 個探針或不足時差，這些是合法未完整學生狀態，不是損壞資料；
- 正式 scorer 只在該線有有效量度時才給該線速度分，避免未操作探針直接輸入答案。

情境庫規則：

- A、B 的 `x₀` 使用 `−8..+8 m` 內不同偶數；
- `v` 使用 `−2, −1, +1, +2 m/s`；
- 每個 set 的 `|vA|`、`|vB|` 關係由 A 較快、B 較快或一樣快三類中選一；
- 三個 sets 合計覆蓋三類比較結果，並至少一組含負速度；
- 圖線全段在坐標範圍內，且清楚可用整數或半整數讀數量度。

提交答案：A、B 各自的 `0/1/2` 個探針時間、學生輸入 `vA`、`vB`，以及比較標記。
探針位置 `x` 由情境圖線及探針時間重算，不保存重複衍生值。

### 9.5 任務 4：建立特殊運動狀態（20 分）

每個 scenario set 使用下列其中一類文字指示：

- 靜止於指定位置；
- 由指定位置出發，經指定時間到達一個較小的位置；
- 由負位置出發，經指定時間到達一個較大的位置。

除靜止題外，題目不直接提供速度。學生要從兩個位置及時間差求出速度，再拖車設定起點、
拖速度箭嘴設定運動，最後播放驗證所形成的水平、下降或上升直線。

情境規則：

- 靜止：明示車在 `t = 0` 及 `t = 6 s` 均位於同一個指定位置；
- 負方向例：`t = 0` 位於 `+8 m`，`t = 4 s` 位於 `0 m`；
- 從負位置向正方向例：`t = 0` 位於 `−6 m`，`t = 4 s` 位於 `+2 m`；
- 所有 set 使用可精確算出 `v = 0, ±1, ±2 m/s` 的整數數據。

提交答案：學生設定的 `{x₀, v}`。

### 9.6 任務 5：兩車相遇挑戰（20 分）

A 車的 `x₀A`、`vA` 已固定，系統指定相遇時間 `t*`。學生可設定 B 車的起點與速度，
目標是令兩車在 `t*` 到達同一位置。

操作流程：

1. 播放 A 車及其固定圖線；
2. 拖 B 車設定 `x₀B`；
3. 拖 B 的速度箭嘴設定 `vB`；
4. 同步播放兩車及兩條圖線；
5. 拖動時間游標檢查 `t*` 時兩車是否重合；
6. 在 `t*` 放置相遇讀圖游標，輸入相遇位置 `x*`；
7. 保存 B 的設定及 `x*` 作為答案。

評分接受任何符合物理條件的解，不要求重現情境庫的示例解：

- `xA(t*) = xB(t*)`；
- 兩條線的交點時間為 `t*`；
- B 的整段運動留在舞台範圍；
- B 不可與 A 有完全相同的 `x₀` 及 `v`，避免兩線全程重合；
- `x₀B` 及 `vB` 必須在探索區同一可操作範圍內。

情境庫 contract：

- `x₀A` 使用 `−6, −4, −2, +2, +4, +6 m`；
- `vA` 使用 `−2, −1, +1, +2 m/s`；
- `t*` 使用可精確顯示的整數 `2, 3, 4, 5 s`，不使用端點 `0` 或 `6 s`；
- 每個 set 保存一組符合操作範圍的示例 B，只用來證明題目有解，不作唯一答案；
- 公開的 `t*` 與 scorer 使用值完全相同，不存在隱藏小數；
- 由 A 計出的 `x*` 必須是整數並位於 `−16..+16 m`，方便讀圖；
- validator 證明至少有一組不與 A 重合的合法 B 解。

提交答案：學生設定的 `{x₀B, vB, x*}`。正式 scorer 接受任何合法 B 解。

## 10. 物理及數學模型

### 10.1 基本模型

每架車均採一維勻速運動：

```text
x(t) = x₀ + vt
```

其中：

- `x`：位置，單位 `m`；
- `x₀`：`t = 0` 時的初始位置，單位 `m`；
- `v`：速度，單位 `m/s`；
- `t`：時間，單位 `s`。

圖線兩點的速度：

```text
v = Δx / Δt = (xQ − xP) / (tQ − tP)
```

雙車相遇條件：

```text
x₀A + vA t = x₀B + vB t
```

當 `vA = vB` 且 `x₀A ≠ x₀B`，兩車不會相遇；當 `vA = vB` 且 `x₀A = x₀B`，
兩線重合而不是單一交點，任務 5 不接受此退化情況。

### 10.2 顯示與計分精度

- 模型及 scorer 使用完整有限數值；
- 即時 `t`、`x`、`v` 顯示一個小數位；
- 目標情境優先使用整數或半整數，避免顯示四捨五入遮蔽概念；
- 不從 SVG 像素位置反推正式答案；拖動先轉成物理座標並夾在合法範圍；
- viewport 改變時以物理座標重畫，不把舊像素座標視為權威資料。

### 10.3 情境庫驗證

每個 versioned scenario set 發布前必須證明：

- 五個 mission key 齊全、唯一且題型正確；
- 任一車的整段運動均不超出位置軸；
- 目標值不落在評分容差的含糊邊界；
- 任務 3 的兩線清楚可讀，並有足夠圖段放置相隔至少 `2 s` 的探針；
- 任務 3 三個 sets 合計覆蓋 A 較快、B 較快、一樣快，以及「較高但較慢」陷阱；
- 任務 5 的 `t*`、A 參數及示例 B 全部落在指定有限集合；
- 任務 5 至少有一個不與 A 全程重合的合法學生解；
- library version 及 set ID 能穩定重建完全相同情境；
- 已發布 set 在同一 library version 內不可被改寫。

## 11. 直接操作規則

### 11.1 拖車設定初始位置

- 只接受跑道區內的 Pointer Events；
- 拖動開始時記錄手指與車中心偏移，避免車跳到手指中心；
- 垂直移動不改變物理位置，只取水平位置軸投影；
- 物理值以 `1 m` 步距調整；
- 拖動中顯示放大讀數 `x₀ = … m`；
- 手指遮擋時在圖區遠離手指的一角顯示穩定小型預覽；
- 放手後保存一次語意狀態，不在每個 pointermove 寫 SCORM。
- 若系統在移動後收到 `pointercancel` 或失去 pointer capture，先解除上方捲動鎖，再保存最後
  已顯示的語意狀態；不得留下只在畫面改變而未嘗試保存的答案。

### 11.2 拖速度箭嘴

- 箭尾固定在車中心；
- 水平向右為正、向左為負；
- 箭長映射 `|v|`，中心死區吸附至 `v = 0`；
- `v = 0` 時仍保留清楚可見的中性速度手柄、`v = 0` 標籤及完整 hit area，
  不讓直接操作入口隨零長箭嘴消失；
- 以 `0.5 m/s` 步距；
- 拖動中顯示 `v = … m/s`；
- 箭嘴方向及數值符號必須同步；
- 觸控 hit area 至少 `44 × 44 px`，視覺箭頭可較細；
- 放手後才觸發草稿保存。

### 11.3 拖圖線手柄

- 任務 2 的兩個手柄時間固定，只有位置可拖；
- 手柄移動限制於圖區及合法位置範圍；
- 以 `1 m` 步距；
- 顯示 `(t, x)` 標籤；
- 連線即時更新，但不得顯示「正確／錯誤」；
- 手柄具有不同形狀及 `P₀`、`P₆` 標籤，不能只以顏色區分。

### 11.4 鍵盤及非拖動替代

每個拖動操作均須有等價替代：

- 可聚焦的車、箭嘴、圖點及探針；
- 所有目標線及未知線提供可聚焦的讀圖游標，鍵盤以 `0.5 s` 步距移動並讀出 `(t, x)`；
- 坐標圖提供文字摘要，說明軸名稱、單位、範圍及目前讀圖游標值；這是視覺資料的
  等價輸出，不額外提供斜率或正確答案；
- 方向鍵按一步調整，Shift＋方向鍵按較大一步調整；
- 操作面板提供 `−／＋` 按鈕；
- 清楚的 focus ring、ARIA label、目前值及操作說明；
- 播放／暫停不只靠空白鍵，必須有可見按鈕；
- 狀態訊息以適度 `aria-live` 公布，不在每一動畫幀朗讀數值。

## 12. 活動 phase／state matrix

所有持久化狀態只使用 production UI 能渲染的 phase。動畫播放、拖動中或 modal 開關是
暫態，不成為額外持久化 phase；保存時一律恢復為暫停狀態。

| Phase | Variant／invariant | Current step | 必須存在的語意狀態 | 必須缺席／保持原始 | 合法下一步 |
|---|---|---:|---|---|---|
| `explore` | `free` | 無 | 合法探索 `x₀`、`v` | 情境庫選擇、任務答案、結果、探針 | 繼續探索或開始評估 |
| `mission` | `normal` 首題 | `0` | library version、set ID；任務 0 已 visited；任務 0 可 empty／partial／complete | 任務 1–4 未 visited 且答案原始 | 下一題或稍後再做 |
| `mission` | `normal` 中段 | `1..4` | library version、set ID；所有較早任務 visited；目前任務 visited；較早／目前答案可 empty／partial／complete | 所有未到任務未 visited 且答案原始 | 下一題；第 5 題後進檢視 |
| `final-review` | `ready` | 無 | library version、set ID；五題全部 visited；每題答案可 empty／partial／complete | editingStep、結果 | 編輯任一題或提交 |
| `mission` | `from-review` | `0..4` | library version、set ID；五題全部 visited；保留所有答案；editingStep 等於 current step | 結果 | 保存目前答案並返回檢視 |
| `submitted-review` | `complete` | 無 | review snapshot、情境庫選擇、權威學生答案、重算結果 | 所有答案編輯及重新提交動作 | 只讀檢討；可回到 `0 s` 及 scrub，不改權威答案 |

### 12.1 狀態轉移

```text
explore/free
  -> mission/normal step 0       確認開始小功課

mission/normal step N
  -> mission/normal step N+1     N < 4，按下一題或稍後再做
  -> final-review/ready          N = 4，按前往檢視

final-review/ready
  -> mission/from-review step N  選擇編輯第 N 題
  -> submitted-review/complete   最後確認且 SCORM submission 成功

mission/from-review step N
  -> final-review/ready          保存目前答案並返回檢視
```

`committed`、`frozen`、`retry` 等技術提交結果由共享 lifecycle 映射成鎖定或可重試 UI，
不偽裝成新的學科 phase。

### 12.2 任務答案完整狀態

每題由 production validator 根據權威字段計算：

- `empty`：未有任何學生設定；
- `partial`：有部分字段，但未滿足任務提交形狀；
- `complete`：所有必要字段有限、合法並通過形狀驗證。

不要把 `empty／partial／complete` 作權威字段持久化；恢復後由答案重建。學生可把 partial
答案帶到 final review，該缺失 component 最後得 0 分。

結構有效與答案正確必須分開：操作範圍內的空白、未完整、探針時差不足、速度錯誤、
相遇失敗或兩線全程重合，都是可恢復的學生答案，不是損壞 snapshot。只有 schema、類型、
有限性、操作範圍、關係鍵或 phase invariant 不可能時，validator 才拒絕 snapshot。

## 13. 評分規格

### 13.1 總則

- 總分：100
- 合格線：60
- 最低分：0
- 最高分：100
- 計分依據：最後提交狀態
- 探索次數、回到 `0 s` 次數、拖動次數、用時及嘗試次數：不計分、不扣分
- 缺少 component：該 component 得 0 分
- 非法或非有限值：按缺少處理，不容許污染其他 component
- 分數最後夾在 `0..100`
- 正式提交前不顯示 component 對錯或預計分數

### 13.2 任務 1（20 分）

- 初始位置在容差內：8 分
- 速度大小及正負號在容差內：12 分
- 起點正確但速度錯：保留 8 分
- 速度正確但起點錯：保留 12 分

### 13.3 任務 2（20 分）

- `t = 0` 圖點位置在容差內：8 分
- 由兩點計出的斜率在速度容差內：12 分
- 不直接以 `t = 6 s` 點獨立再給一份位置分，避免同一錯誤重複計分；終點透過斜率 component 評估

### 13.4 任務 3（20 分）

- A 線有完整有效量度，且 `vA` 在容差內並保留正負號：7 分
- B 線有完整有效量度，且 `vB` 在容差內並保留正負號：7 分
- A、B 均有完整有效量度，且「速度大小較大」標記符合 `|vA|`、`|vB|` 關係：6 分
- 只有機械性放置探針、不足 `2 s` 或沒有正確計算：不給該線速度分
- 探針次序反轉但計算一致：不扣分

### 13.5 任務 4（20 分）

- 指定初始位置在容差內：8 分
- 指定速度大小及方向在容差內：12 分
- 靜止題只有 `v = 0` 在零速度容差內才得速度分；極慢但非零不可當作靜止

### 13.6 任務 5（20 分）

先由學生 B 設定與固定 A 計算實際交點：

- B 設定形成非退化交點，且實際交點時間在 `t*` 容差內：12 分
- 學生提交的相遇位置 `x*` 在 A 車於 `t*` 的位置容差內：8 分
- 平行不相交、全程重合、交點在活動時間外或值非法：相遇設定 component 0 分；
  學生仍可憑正確讀取 A 在 `t*` 的位置取得讀圖 component
- 接受任何合法 B 解，不因與情境庫示例不同而扣分

## 14. 容差

所有容差集中於 `scoring.js` 的易改常數；計劃採以下初始值：

| 檢查量 | 容差 | 類型 | 剛在範圍內 | 剛超出範圍 |
|---|---:|---|---|---|
| 初始位置 | `±0.5 m` | 對稱絕對 | 目標 `4.0 m`，答案 `4.5 m` | `4.6 m` |
| 圖點位置 | `±0.5 m` | 對稱絕對 | 目標 `−6.0 m`，答案 `−5.5 m` | `−5.4 m` |
| 速度／斜率 | `±0.1 m/s` | 對稱絕對 | 目標 `−2.0`，答案 `−1.9 m/s` | `−1.8 m/s` |
| 靜止速度 | `|v| ≤ 0.05 m/s` | 對稱零區 | `+0.05 m/s` | `+0.06 m/s` |
| 最小探針時差 | `|Δt| ≥ 2.0 s` | 包含式下限 | `2.0 s` | `1.5 s` |
| 相遇位置讀數 | `±0.5 m` | 對稱絕對 | 目標 `6.0 m`，答案 `6.5 m` | `6.6 m` |
| 相遇時間 | `±0.2 s` | 對稱絕對 | 目標 `4.0 s`，交點 `4.2 s` | `4.3 s` |

比較前使用未顯示四捨五入的完整值。浮點邊界測試須包含剛好相等、剛內及剛外情況。

## 15. 學生回饋

提交後逐題顯示：

- 學生答案或學生圖線；
- 正確目標或所有可接受條件；
- 該題得分及 component 得分；
- 針對物理概念的文字回饋；
- 可回到 `0 s` 後再次播放的只讀動畫及可拖動的只讀時間游標。

回饋規則至少包括：

- **截距錯、斜率對**：`你的速度設定正確，但車在 t = 0 的起始位置不符合目標圖線。`
- **截距對、斜率大小錯**：`起點正確；圖線斜率不同，表示速度大小仍需調整。`
- **速度符號錯**：`速度大小接近，但方向相反；負斜率表示位置隨時間減少。`
- **水平線誤判**：`水平線表示時間繼續而位置不變，因此速度為零。`
- **量度計算錯**：顯示學生 P、Q、`Δx`、`Δt`，指出應以 `Δx / Δt` 並保留符號；
- **速度比較錯**：`請比較兩個速度的絕對值；圖線較高不一定代表速度較大。`
- **相遇設定錯、位置讀數對**：`你正確讀取了指定時間的位置，但 B 車仍未在該時間與 A 車相遇。`
- **相遇設定對、位置讀數錯**：`兩車已按時相遇；請用時間游標再讀取交點的位置。`
- **全程重合**：`兩條圖線全程重合，並沒有形成指定時間的單一相遇點。`
- **未作答**：`本部分沒有可評分答案。`

不得只顯示「正確／錯誤」或只顯示總分。

## 16. Runtime 檔案及責任

實作階段預計建立：

```text
sim/position-time-graph-motion-lab/
  index.html
  styles.css
  main.js
  scoring.js
  scoring.test.js
  persistence.js
  persistence.test.js
sim/manifests/position-time-graph-motion-lab.xml
```

並更新：

```text
sim/config.js
tools/run-tests.js
```

重用：

```text
sim/shared/styles.css
sim/shared/scorm.js
sim/shared/activity-flow.js
```

Manifest 必須精確列出以下 ZIP runtime entries：

```text
config.js
shared/styles.css
shared/scorm.js
shared/activity-flow.js
position-time-graph-motion-lab/index.html
position-time-graph-motion-lab/styles.css
position-time-graph-motion-lab/main.js
position-time-graph-motion-lab/scoring.js
position-time-graph-motion-lab/persistence.js
```

Manifest 及 ZIP 不得包含 `scoring.test.js`、`persistence.test.js`、計劃檔或 browser check 臨時檔。

責任分配：

- `index.html`：語意結構、SVG 舞台、控制及回饋容器；
- `styles.css`：活動 layout、SVG 樣式、觸控 hit area、responsive 行為及 review 狀態；
- `main.js`：中央 UI state、動畫、Pointer／keyboard 操作、phase 轉移、渲染及 shared lifecycle glue；
- `scoring.js`：不可變情境庫、純函數評分、容差、相遇計算及情境有效性規則；
- `persistence.js`：production encode／decode／validate／restore、狀態 matrix 驗證及 schema version；
- 測試檔：只測 production export，不另建測試專用 schema；
- manifest：列出所有活動及 shared runtime 依賴。

不建立 framework、bundler、component abstraction、通用圖表 library 或活動專用 SCORM wrapper。

## 17. Persistence contract

### 17.1 Draft snapshot 權威資料

為預留 SCORM 1.2 pending-final 包裝空間，production encoder 使用以下緊湊但有明確版本的
answer payload。文件中的長名稱與 compact key 對應不可在同一 schema version 改變：

```text
v   = schemaVersion
p   = phase: explore | mission | final-review
r   = variant: free | normal | from-review | ready
c   = currentStep: null | 0..4
e   = editingStep: null | 0..4
x   = exploration: { x0, v }
a   = assessment: null | {
        lv: scenarioLibraryVersion,
        sid: scenarioSetId,
        seen: five booleans,
        ans: { m1, m2, m3, m4, m5 }
      }
```

情境庫 version 與 set ID 是權威題目選擇。已發布 library version 必須在 production code 保持
不可變及可讀，否則舊 attempt 無法重建。由於第一版只使用人工驗證固定 sets，不在 snapshot
重複保存五份 scenario 參數。

各 `answers` 只保存任務所需權威學生資料：

- 任務 1：學生 `x₀`、`v`；
- 任務 2：兩個固定時間圖點的學生 `x`；
- 任務 3：A、B 各自 `0/1/2` 個探針時間、學生 `vA`、`vB`、比較標記；
- 任務 4：學生 `x₀`、`v`；
- 任務 5：學生 `x₀B`、`vB`、相遇位置讀數 `x*`。

部分答案以缺少字段表示，不以 NaN、空字串或神奇 sentinel 數字表示。
探索探針及當前播放時間不保存；探索恢復時保留 `x₀`、`v`，但回到 `t = 0` 並清除探針。

### 17.2 Review snapshot 權威資料

Review payload 包含：

```text
v     = schemaVersion
lv    = scenarioLibraryVersion
sid   = scenarioSetId
ans   = { m1, m2, m3, m4, m5 }
```

Review 必須足以：

1. 驗證題目及答案；
2. 重建五個任務畫面；
3. 由活動 scorer 重算每個 component 及總分；
4. 與 shared review envelope 保存的 score／passed metadata 及 Moodle 記錄比較；
5. 顯示可信只讀回饋。

Review answer payload 不重複保存 score／passed；直接使用 `SimScorm.makeSnapshot(..., result)`
建立的 shared envelope metadata。它仍然只是比較資料，不是恢復時的計分真相來源。

### 17.3 不持久化的暫態資料

- DOM 或 SVG element reference；
- 像素座標及 viewport 尺寸；
- pointer ID、拖動偏移、hover、focus；
- animation frame ID、上一幀時間、播放中狀態；
- modal 開關及 transition 動畫；
- 完整探索圖線點陣列；
- 探索探針及探索當前時間；
- 拖動事件歷史、回到 `0 s` 次數或用時；
- 預先計算的 component 分數、總分、按鈕 disabled 狀態；
- 任務探針 `x` 值（由 versioned scenario set 及探針時間重建）。

### 17.4 恢復後重建

- 所有 SVG／DOM；
- 物理至畫面座標映射；
- 圖線 path；
- 探針 `x`、`Δx`、`Δt`；
- 任務答案 `empty／partial／complete`；
- visited 導航狀態及按鈕狀態；
- component 分數及回饋；
- animation time 重設為 `0` 並保持暫停；
- final review 返回前的合法 continuation；
- 探索恢復時清除探針並回到 `t = 0`，保留 `x₀`、`v`。

### 17.5 關係鍵與驗證

- 任務以固定 semantic key `m1` 至 `m5` 關聯情境與答案；
- key 必須唯一、次序完整且類型匹配；
- 不接受重複、缺失、未知或錯配 mission key；
- generated SVG IDs 不保存，若舊 payload 含有則忽略並重建；
- 所有數值必須有限並落在 plan 定義的物理及操作範圍；
- library version 及 set ID 必須存在，且對應不可變、通過驗證的五題情境；
- visited 必須符合 phase matrix：normal 模式不可跳過較早任務，from-review 則五題均 visited；
- explore phase 不可夾帶 assessment 或 result；
- final-review 不可含 editingStep；from-review 必須含等於 currentStep 的 editingStep；
- future answers 在 normal 模式必須原始；review-edit 可合法保留五題答案；
- 不接受 production UI 無法渲染或無合法 continuation 的 phase／variant 組合。

學生答案 validator 分兩層：

1. **結構有效**：字段類型正確、數值有限並在操作域、enum 合法；可 round-trip 及恢復；
2. **完整／正確**：由 completeness 及 scorer 判斷，不影響 snapshot 是否可恢復。

因此下列狀態必須可保存及恢復：單一探針、兩探針同時刻、時差不足、錯誤速度、
錯誤比較標記、相遇失敗、平行線及與 A 全程重合的 B 設定。它們可得 0 分或顯示 partial，
但不是 corrupt snapshot。

### 17.6 Invalid snapshot policy

- 完成 attempt 的 review 無效：保持鎖定，只顯示可信 Moodle 分數／狀態摘要；
- pending-final：由 shared runtime 凍結並重試同一 payload，不重開作答；
- editable draft 無效：顯示技術載入錯誤並鎖定不安全動作；第一版不提供清除／覆寫壞草稿，
  避免在未證明 LMS 寫入成功前開啟一個與舊資料衝突的新 attempt；
- 舊 schema：只支援明確列出的 migration；未列版本直接拒絕，不能猜測轉換；
- 所有技術錯誤避免使用「已提交／合格／不合格」字眼。

### 17.7 大小限制

- 最大合法 draft 及 review shared snapshot 的 UTF-8 byte size 必須各自小於 `4000 bytes`；
- 最大合法 review 必須經實際 shared submission preflight／pending-final checkpoint 建立路徑測試，
  包含 JSON 再包裝及轉義後仍小於 `4000 bytes`；
- 不保存 SVG path、逐幀資料或重複衍生數值；
- 測試使用 production encoder 及 shared runtime 真實包裝邏輯作 byte assertion，不以手算估計。

## 18. Shared SCORM lifecycle

啟動必須使用：

```text
SimScorm.loadAttempt(activity)
→ SimActivityFlow.startup(attempt)
```

啟動 UI：

| Outcome | 可編輯 | 學生可見行為 |
|---|---:|---|
| `review` | 否 | 驗證 review、恢復權威答案、重算、顯示可信鎖定檢討 |
| `editable` | 是 | 建立或恢復 draft，登記最新 draft provider |
| `frozen` | 否 | 重試同一 pending payload；顯示未確認技術狀態 |
| `load-error` | 否 | 鎖定不安全操作；不顯示分數／合格／不合格結論 |

最終提交只使用 `SimScorm.submitWithCallbacks()`，兩個 callback 均交給
`SimActivityFlow.submission()` 處理：

| Outcome | 可編輯 | 學生可見行為 |
|---|---:|---|
| `success` | 否 | 顯示已提交只讀檢討 |
| `committed` | 否 | 結果已 commit，保持鎖定並提供 finish retry |
| `frozen` | 否 | 答案凍結等待重試，不宣稱分數或已提交 |
| `retry` retryable | 是 | 保留同一答案及 final review，容許再次提交 |
| `retry` non-retryable | 否 | 顯示技術錯誤，不承諾可重試或宣稱提交成功 |

完成恢復順序固定為：

```text
validate review
→ restore authoritative scenarios and answers
→ activity scorer
→ SimActivityFlow.reviewResult(computed, saved metadata, Moodle attempt)
```

保存草稿的語意時點：

- 探索設定拖動放手或按微調鍵後；
- 確認開始評估；
- 任務答案操作放手、數值輸入 blur／確認後；
- 前往下一題、稍後再做、進入 final review；
- review-edit 保存目前答案並返回 final review；
- 不在 pointermove 或每一動畫幀 commit。

## 19. Assessment risk 與 Moodle 建議

分類：`low-risk graded`。

理由：

- 是概念鞏固小功課，不是高風險考試；
- 學生可自由探索及回到 `0 s` 後再次播放，評估重點是應用而非監考；
- 瀏覽器端答案及 scorer 可被開發者工具修改；
- SCORM review 保存提高可檢討性，但不構成防篡改邊界。

建議 Moodle 設定：

- Attempts allowed：3；
- Attempts grading：Highest grade；
- 已完成 attempt 再進入時由活動維持 review-only；
- 正式使用時停用 preview mode；
- 顯示 attempt status；
- 若日後改作高風險評核，必須改用 Moodle question type、LTI 或 backend 重新驗證，
  不能靠混淆 JavaScript。

## 20. 測試計劃

### 20.1 Physics model tests

- `x = x₀ + vt`：正、負、零速度；
- `t = 0` 必定回傳 `x₀`；
- 探針次序反轉仍計出同一速度；
- `Δt = 0` 回傳「未能量度」而不是 Infinity／NaN；
- 相遇：正常交點、平行、不相交、全程重合、交點在時間外；
- 所有 versioned scenario sets 在 `0..6 s` 留在 `−20..20 m`；
- 每個 library version＋set ID 重建完全一致情境；
- 全部人工定義 sets 均滿足 mission-specific invariants，且舊 version lookup 保持可用。

### 20.2 Scoring tests

每個 component 至少測：

- 完全正確；
- 缺失；
- 非有限值；
- 剛好在容差；
- 剛在容差內；
- 剛超出容差；
- 相關 component 正確、另一 component 錯誤時只得應得部分分；
- 負速度符號錯誤不獲速度分；
- 水平線與極慢非零線分開；
- 任務 2 起點正確但斜率錯、斜率正確但起點錯；
- 任務 3 A／B 各自 `0/1/2` 探針、時差不足、P/Q 反轉、正負速度及三種速度大小比較；
- 任務 3 沒有有效量度時，即使直接輸入正確速度亦不得分；
- 任務 5 接受多個不同合法 B 解；
- 任務 5 全程重合、平行及錯誤交點時間的相遇設定得 0，但正確 `x*` 仍可獨立得分；
- 未完整五題仍可產生 `0..100` 最終分；
- 總分 floor 0、ceiling 100、合格線 60。

### 20.3 Persistence round-trip fixtures

每一行 phase matrix 都要有 production-shaped fixture：

1. `explore/free`：不同合法 `x₀`、`v`；恢復後 `t = 0` 且沒有探索探針；
2. `mission/normal step 0`：empty、partial、complete active answer；
3. `mission/normal step 1..4`：逐步覆蓋每個任務 shape，之前 visited 可為
   empty／partial／complete，未來 pristine；
4. `final-review/ready`：混合完整及部分答案；
5. `mission/from-review`：五個 editingStep 各一個，保留所有未編輯答案；
6. `submitted-review/complete`：完整及部分答案所產生的最終 review。

每個 assessment／review fixture 必須證明：

```text
score(original) = score(restore(decode(encode(original))))
```

`explore/free` 無分數，改為證明 `x₀`、`v` 保持不變，且恢復後按計劃清除探針、回到
`t = 0`，仍可合法繼續探索或開始評估。

並在恢復後執行一個合法 continuation：

- explore 開始評估；
- normal 任務前往下一題；
- final review 進入 edit；
- from-review 返回 final review；
- submitted review 保持鎖定並可切換只讀任務。

另加合法錯答 round-trip：任務 3 單一探針／同時刻／時差不足，以及任務 5 平行／全程重合；
恢復後必須保持可編輯或可檢討，由 completeness／scorer 給 0，而不是觸發 load-error。

### 20.4 Invalid-state matrix tests

- 未知 phase／variant；
- phase 與 currentStep 不匹配；
- normal step 跳過較早 visited；
- normal future 任務夾帶答案；
- from-review 未保留五題 visited；
- from-review editingStep 不等於 currentStep；
- final-review 含 editingStep；
- explore 夾帶 assessment 或 result；
- 缺失、重複、未知或錯配 mission key；
- library version／set ID 不存在或其固定五題與 mission type 不符；
- schema version、數值類型、操作範圍或 enum 非法；
- NaN、Infinity、負時間、超範圍位置／速度；
- 探針時間超出圖域或探針陣列超過兩個；同時刻及時差不足不得列為 corrupt；
- 任務 5 學生值超出操作域；全程重合不得列為 corrupt；
- generated SVG ID 存在時忽略並重建，而不是當學習答案拒絕；
- 未支援舊 schema 版本拒絕；若加入 migration，需另有 migration round-trip 測試；
- 最大 draft／review shared snapshot 小於 4000 UTF-8 bytes；
- 最大 review 經真實 pending-final checkpoint 再包裝及轉義後仍小於 4000 UTF-8 bytes。

### 20.5 Lifecycle tests

- startup：`review`、`editable`、`frozen`、`load-error`；
- submission：`success`、`committed`、`frozen`、retryable `retry`、non-retryable `retry`；
- review：計分及狀態吻合、分數不吻合、pass status 不吻合、Moodle status unknown；
- finished invalid review 保持鎖定，只顯示安全 Moodle 摘要；
- pending-final 不可回到探索或評估；
- 技術錯誤不顯示已提交／合格／不合格；
- 測試 production outcome/render functions，不以搜尋 source string 代替。

### 20.6 Interaction and browser checks

- Pointer、touch、pen 均可拖車、箭嘴、圖點及探針；
- 拖動不令物件跳離手指；
- 只有實際拖動可操作物件期間鎖定上方捲動，背景不得跟隨圖點、探針、車或箭嘴移動；
- 在非互動圖面開始的垂直手勢仍可捲動完整上方視覺區，且不帶動控制面板；
- 播放期間物理設定鎖定；
- 修改物理設定清除不相容舊圖線及探針；
- 時間游標與車、圖點及數值同步；
- viewport resize／手機 browser chrome／全屏後坐標原點及對齊正確；
- 鍵盤可完成所有正式任務；
- SVG 手柄每次按方向鍵重繪後恢復到同一語意 drag target，連續按鍵毋須重新 focus；
- focus 順序、focus ring、ARIA label、live region 不造成動畫幀轟炸；
- `prefers-reduced-motion` 下減少非必要過場，但物理時間仍可逐步查看；
- 320 px portrait、landscape、軟鍵盤開啟、200% zoom、常見 tablet 及 desktop 的舞台、
  操作及主要按鈕均可到達，且沒有必要的水平捲動；
- 390 × 500 Moodle-like 短 viewport 的上方視覺區及控制面板均可到達真實底部；
- 手機上方視覺區與控制面板各自獨立捲動；頁首、跑道與圖表一同移動，極矮視窗亦不遮擋 focus target；
- 固定 SVG aspect ratio 下，`v = ±1` 與 `±2 m/s` 的斜率在手機上可辨；
- 讀圖游標可由鍵盤逐步移動，螢幕閱讀器取得軸資料及 `(t,x)`，又不直接讀出答案斜率；
- submitted review 所有修改控制鎖定，時間游標及回到 `0 s` 只讀功能可用；
- Live Server 無 Moodle 時走相同 submission path 並顯示 local fallback。

### 20.7 Repository quality gates

實作完成時必須：

- 將每個新測試檔加入 `tools/run-tests.js`；
- 更新 `sim/config.js`，無重複 slug；
- manifest 列出 HTML 引用及程式載入的全部 runtime 檔；
- POSIX 執行 `npm run check`、`npm test`、`npm run package:all`；Windows 使用對應的
  `npm.cmd` 命令；
- 執行 `git diff --check <base>...HEAD`；
- 檢查 ZIP root 有 `imsmanifest.xml`，且不含測試或臨時檔；
- 以 build／解壓後 package 作 browser smoke，而不只測 `sim/` source。

## 21. 分階段實作順序

### Phase A：純模型、情境與 scorer

- 定義物理座標、範圍及所有 tolerance 常數；
- 建立三個人工驗證 scenario sets、immutable version lookup 及 set validation；
- 實作 component scorer 及 feedback keys；
- 先完成 model／scoring tests。

### Phase B：探索 UI

- 建立 shared shell、跑道、圖區及 responsive layout；
- 完成單車拖動、速度箭嘴、播放、時間游標、快捷情境及探針；
- 完成鍵盤替代及手機觸控行為；
- 驗證探索沒有評分、問題或完成門檻。

### Phase C：五個正式操作任務

- 逐一加入任務，不建立通用 task framework；
- 共用同一物理座標轉換、播放及可存取 drag primitives；
- 完成 normal flow、稍後再做、final review 及 review-edit；
- 完成學生答案與正確值 overlay 的 submitted review。

### Phase D：Persistence 與 SCORM

- 按 phase matrix 實作 production encoder／decoder／restore；
- 先通過全部 round-trip、continuation、invalid matrix 及 byte-size tests；
- 接入 shared startup／submission lifecycle；
- 完成所有技術 outcome UI。

### Phase E：Packaging 與 Moodle

- 註冊 config、test runner、manifest；
- 跑 quality gates 及 built-package smoke；
- 上傳 Moodle，以學生帳戶驗證三次 attempt、最高分、draft resume、pending retry 及 review-only；
- 本地測試不能代替 Moodle-ready evidence。

## 22. 驗收條件

### 22.1 教學與探索

- 開啟即進入自由探索，沒有 landing page；
- 探索沒有問題、比較要求、進度要求或分數；
- 學生可設定不同起點、正速度、零速度及負速度；
- 車的運動、即時數據、圖線及時間游標同步；
- 改速度或起點後舊圖線及探針不會殘留造成誤解；
- 學生可自行放 P、Q 探針並看到 `Δx`、`Δt` 及探索用速度結果；
- `開始小功課` 不受探索次數限制。

### 22.2 操作評估

- 五個任務均以操作產生學習證據，不以單選題作主要答案；
- 任務 1 可由目標圖設定車；
- 任務 2 可由運動畫出圖線；
- 任務 3 必須分別量度 A、B 兩線、提交兩個帶符號速度，並以 `|v|` 比較速度大小；
- 任務 3 至少一個 set 證明學生不能以圖線高度代替斜率；
- 任務 4 覆蓋靜止，或由兩個位置及時間差推算正／負速度後建立運動；
- 任務 5 接受多個合法相遇解，並獨立評估學生讀取的相遇位置 `x*`；
- 正式答案開始時不預選；
- 學生可稍後再做及在 final review 修改；
- 提交前不揭示正確答案；
- 部分答案按 component 得分，總分為 `0..100`，60 分合格；
- 回饋指出截距、斜率、方向、量度或相遇條件問題。

### 22.3 可靠性與交付

- 每個 saveable phase／variant 均可 production round-trip；
- 恢復後分數及合法下一步不變，且測試實際執行下一步；
- 合法錯答及未完整答案可恢復並由 scorer 處理，不會誤判成損壞 snapshot；
- 無效狀態 fail closed；
- 所有 startup／submission outcome 有誠實 UI；
- final attempt 鎖定為 review-only；
- phone、tablet、desktop、touch、pointer、keyboard 及非視覺讀圖方式可用；
- 最大 review 經 pending-final 真實包裝後仍符合 4000-byte ceiling；
- package-ready 及 Moodle-ready checklist 分開完成；
- 所有 runtime 依賴在 manifest，所有測試在 runner；
- 沒有新增第三方 dependency、build system 或活動專用 SCORM lifecycle。

## 23. 延後項目

只有在第一版驗證學生已掌握直線斜率後，才另開計劃考慮：

- 變速及曲線切線；
- x–t、v–t 圖同步；
- 不同坐標比例的斜率判讀；
- 教師自訂數值或題型；
- 學習分析或多 attempt 歷史。

這些功能不在目前 activity 內預留抽象 interface 或設定欄位。

## 24. 現行實作對照（as-built reconciliation）

本節記錄活動完成後已接受的設計演變、仍然有效的原始 contract，以及尚未完成或尚待產品決定
的項目。它不是另一份完整規格；詳細 generated-paper 規則仍只在 Plan 11 維護。

### 24.1 已由 Plan 11 正式取代的設計

1. **題目分配**：每個新 assessment 使用 Web Crypto 建立 128-bit seed，再以固定、可重現的
   generator version 2 產生五題，不再只抽 `alpha`／`beta`／`gamma`。
2. **數值範圍**：任務 1、2、4、5 可使用 UI 可達的 `0.5 m/s` 速度 lattice；任務 3 繼續使用
   整數速度，保持探針讀數清楚。
3. **任務 4 分布**：先等機率選 stationary／positive／negative category，再在該類候選池抽題。
4. **任務 5 可解性**：每個 generated scenario 至少有三個 UI 可建立、非重合、全段在 bounds
   的 B 車解；不保存或比較單一 `exampleB`。
5. **Paper-level 約束**：完整五題另驗證 motion 多樣性、正負速度覆蓋、UI lattice 可達性及
   graph bounds。
6. **Persistence**：v2 draft、pending-final 及 review 保存 generator version、seed、完整權威
   paper 及學生答案；seed 與 paper 必須 deterministic match，否則 fail closed。
7. **舊資料相容**：v1 fixed-set draft／review 不自動轉成 v2，繼續用原題恢復及檢討。

### 24.2 已接受的 UI／互動修訂

- 手機版經多輪調整，採頁首／跑道／圖表共用上方捲動區、操作面板獨立捲動、較緊湊
  graph height，及任務切換後兩區一併捲回頂部；物理座標及評分不因 viewport 改變。
- `重播`／`重設` 等容易誤解的名稱改為準確的 `回到 0 s`。
- 任務 2 以隨車位置投影、軸上讀數及 `P₀`／`P₆` 語意協助讀圖，但提交前仍不顯示正確線。
- 任務 3 不再要求先選 A 再切換 B；A、B 兩組探針控制同時顯示，答案 shape、有效量度要求及
  7／7／6 配分不變。
- 未作答任務可在圖上顯示帶 `?` 的中性位置預覽，方便學生理解可操作物件；權威答案仍保持
  empty，不會把預覽值保存或計分。
- 目標線與學生線使用不同顏色、虛實線、題目文字及非視覺圖表摘要辨識，不另設固定 legend。
- 提交前檢視只負責顯示五題完整狀態、進入修改及最後提交；播放、逐步、回到 `0 s` 及時間
  slider 在此 phase 全部 disabled。進入指定題修改後會恢復；正式提交後的只讀逐題檢討仍可播放
  及 scrub。
- 技術 save／load／pending-final 錯誤會鎖定不安全動作，並明確區分未儲存、未確認提交及已提交。

### 24.3 保持有效的核心 contract

- 自由探索不出題、不計分、沒有完成門檻；學生自行確認後才開始五題評估。
- 五個任務的學習目標、答案語意及 component 配分保持 §9 及 §13 所定義內容。
- 總分 100、合格線 60，按最後提交狀態計分；操作次數、用時及播放次數不計分。
- §14 的位置、圖點、速度、靜止、探針時差、相遇位置及相遇時間容差保持不變。
- 任務 5 一直接受任何合法 B 車設定；多解不是 generator v2 才新增的評分原則。
- phase 仍為 explore、mission、final-review 及 submitted-review；生成 seed 不新增 learner-facing phase。
- 最後提交仍經 shared `SimScorm.submitWithCallbacks()` 及 `SimActivityFlow`，並處理 success、
  committed、frozen 及 retry。
- 活動仍屬 browser-scored low-risk graded assessment；不得宣稱防篡改或用於高風險考試。

### 24.4 尚未完全符合原始 UI 細節

以下項目沒有影響答案、評分或恢復安全，但若日後要求逐字符合第一代 interaction spec，仍需
另行決定是否實作：

- §11.3 要求任務 2 兩個 graph handles 使用不同形狀；目前兩者均為圓形，以位置及 `P₀`／`P₆`
  標籤分辨。
- §11.1 要求手指遮擋時在圖區角落提供獨立固定 preview；目前使用 SVG 讀數、即時數據及操作
  面板同步更新，未另設固定角落 overlay。
- §11.4 描述每條目標／未知線各有可聚焦讀圖游標；目前以一個全局、鍵盤可操作的時間 slider
  同步讀出所有可見圖線，而不是每條線各自建立 focus target。

以上三項記錄為已知 as-built 差異，不應在沒有新產品決定及 interaction tests 的情況下被視為
緊急 defect 或靜默刪除原要求。

### 24.5 現行 runtime 及驗證證據

現行 activity runtime 包括：

```text
index.html
styles.css
main.js
scoring.js
generator.js
persistence.js
ui-runtime.js
```

相關 production tests 已登記於 `tools/run-tests.js`，涵蓋 scorer、generator、10,000 fixed-seed
property sweep、v1/v2 persistence、phase continuation、invalid-state matrix、lifecycle、production DOM
wiring、pending-final shared path 及 browser helper。SCORM browser regression 會重新建立 ZIP、解壓、
由 manifest 找出 SCO，再以真實 Chrome 檢查 packaged runtime、responsive geometry、generated paper
差異及 saved draft reload 穩定性。

本地 gate 不取代以下部署證據：

- 真實 Moodle student account 中途離開再入仍恢復同一 paper 及答案；
- 已完成 attempt 只讀鎖定；由 Moodle 開始新 attempt 才建立新 seed 及不同 paper；
- Moodle gradebook、Highest grade、pending-final 及 finish retry 行為；
- 正式 Windows 環境的對應 quality gates 及 browser checks。

Moodle production 建議仍採 §19 的三次 attempts 及 Highest grade；Plan 11 所稱「至少兩次」是驗證
新 attempt 會換題所需的最低測試條件，不是把 production recommendation 改成只允許兩次。
