# 小小航天家：視覺座標、升空鏡頭與着陸一致性修正計劃

狀態：2026-11-08 已完成實作、source／standalone 驗證及原 Sites 部署；實際證據及限制見文末。

本文件是[探索工作台主計劃](42-rocket-explorer-workbench.md)的專項實作藍圖，沿用[共用樣式](00-shared-platform-and-style.md)、[production guide](../docs/simulation-scorm-production-guide.md)及[計劃模板](NEW-SIMULATION-PLAN-TEMPLATE.md)的適用契約。已發佈的歷史測試不能代替本次跨時間、跨地景層的驗證。

## 1. 範圍與目標

| 決定 | 規格 |
|---|---|
| 對象 | `sim/rocket-side-booster-lab/`；小小航天家：火箭升空與返航 |
| 學習目的 | 用一致的視覺比例理解離地、轉彎、入軌、再入及接地；畫面運動應與讀數一致 |
| 交付 | 現有 standalone ZIP、同一 Sites 專案；實作驗證完成才 commit／部署 |
| 評核風險、rubric、submission、答案 snapshot、LMS resume | N/A：非評核探索工具，不恢復 SCORM／評分／提交 |
| 互動與版面 | 保留緊湊頂欄、油門及方向盤優先、44px 觸控、header fullscreen、iPad 橫屏鏡頭掣 |
| 技術 | 沿用 Three.js、本地地形與既有 controller；不加新 library、反射 pass、完整剛體／流體求解器 |
| 不在範圍 | 真實三維地球自轉／緯度發射、風場、可滑行地面車輛、新控制模式、原 SCORM 火箭活動 |

成功準則：零地速且已穩定着陸，固定樹／道路／海岸不會滑走；上升時地面按真實距離遠離；相同位置與鏡頭下，加裝助推器不會改變火箭與地球的比例。

## 2. 已核對的根因與證據

檢查基線：root `0c0ffdb`（runtime `b0b6560`）。只讀原始碼及本機 Chromium current-source 受控 fixtures；測試沒有修改 runtime。報告：`output/reports/rocket-explorer-visual-audit.json`。

| 問題 | 已確認行為 | 影響 |
|---|---|---|
| 高度同時控制鏡頭及模型比例 | `scene.draw()` 未分級無助推器分支用約 `3 × 離地高度 + 35m` 的鏡頭距離，又按距離放大模型 | 上升似地面縮走，火箭／建築比例失真 |
| 配置影響比例規則 | 有助推器、分級後或有另一飛船時走不同的 close／scale 分支 | 不同配置、分離前後視覺尺度不一致 |
| 地形隨時間旋轉，飛行模型並未相應處理自轉 | `surface.direction(q,t)`、地球、regional／global／contact 地景含時間旋轉；主飛行為二維、初始地面速度零、阻力使用現有速度 | 地形可在零速度的飛船下移動；不是完整的地球自轉模型 |
| terminal 不代表全任務時間停止 | `recovery.stepCapsule()` terminal 仍增加 `t`；二級存活時可以繼續；`settle()` 速度清零但按新的 `t` 再查地形半徑 | 太空艙讀數 0，樹仍滑走，接地高度也可能被改動 |
| 着陸姿態直接推動鏡頭焦點 | 鏡頭 target 由旋轉後的模型 bounds 中心計算；側倒／hull 支撐修正亦帶動 target | 飛行時間已停，地面仍因鏡頭橫移而滑動 |
| 地景旋轉順序不同 | 地球／contact 為 ZYX；landscape／regional relief 為 XYZ | 有角位移及時間旋轉時，近遠地景不一定對齊 |
| 防穿地改寫使用者鏡頭角度 | `draw()` 直接寫回 `this.pitch` | 低空一次自動抬鏡頭，可改變之後的使用者構圖 |

量測例子：

- 同一 8.8m 火箭、1024×768：無助推器在 100m／1km／10km 高度，畫面模型等效高度分別約 53.6m／485.6m／4805.6m；鏡頭距離約 335m／3035m／30035m。有助推器三處模型仍是 8.8m、鏡頭距離 35m。
- 着陸 fixture 的 `t=1000→1001`、二級仍飛行、HUD 水平 0.0、速度向量 `[0,0,0]`：追蹤同一 contact 樹 instance 的 world position 移動約 **8.069m**。該樹在這次預設構圖外；這項量測證明地景座標移動，不聲稱是使用者畫面中的同一棵樹。
- 同一着陸 fixture 的時間及飛行 state 完全不變，側倒視覺 age 由 0→6s，鏡頭位置移動約 **1.489m**。
- 暫停、着陸姿態 age 固定、不推進時間，鏡頭及追蹤樹位置不變；不是隨機的持續渲染漂移。
- Browser report completed=true、Runtime exception 為零。沒有執行本次尚未實作的驗收，沒有實體 Safari／iPad 證據。

使用者那次沒有錄影及完整 flight state，尚不能斷言上述哪個路徑佔主要比例；兩種已重現的滑動路徑都必須處理。

## 3. 基礎決定：採用一致的固定地球模型

本版建議保留現有「球形地球＋二維軌道」物理，地形固定於此模型，取消目前與物理不配套的每日時間旋轉。地圖朝向仍可有固定的素材對位角度；相機跟隨局部垂直所需的座標轉換照常存在。

理由：現有模擬沒有一套完整的發射緯度初速度、共轉大氣、三維慣性速度及地面錨定。只在着陸後凍結地圖，會使着陸前後及另一飛船的世界不一致。把接地艙硬綁到現有旋轉表面，也會需要超出二維飛行平面的速度，不能只補一個視覺 offset。

這是一項明確的教學簡化：本版不呈現地球自轉。若將來要加入，應獨立設計完整自轉模型，一起修改初速、氣動、地速、軌道及接地共轉；不可再次只令地景自轉。

一致性規則：

1. 同一 flight position 對應固定的地形方向、高度及水陸類型，不隨任務 `t` 改變。
2. `t` 是全任務模擬時間，二級未結束時可繼續；停止在地面的艙不會被時間帶走。
3. 接地、HUD、地形 mesh、樹／建築、海面著色都使用同一座標與高度來源。
4. 近景保持原 floating-origin 做法，先在高精度物理座標相減，再交給 renderer；不直接把數百萬米的世界位置當近距離 Float32 模型頂點。
5. 素材對位角、局部垂直轉換及工廠預覽比例分清用途；沿用現有模組內少量共用轉換，不建立新的 scene framework。

## 4. 比例與跟隨鏡頭

### 4.1 三種畫面各有固定規則

| 畫面 | 比例與鏡頭 |
|---|---|
| 工廠 | 保持現有米制裝配預覽，不參與飛行尺度 |
| 跟隨 | 1m 對應固定的 .001 renderer unit；火箭、太空艙、另一飛船、樹及地形同尺度 |
| 全景／軌道 | 保留示意圖，飛船可放大為 marker；清楚標示「飛船圖示非同比例」 |

跟隨模式刪除按高度放大模型的規則，以及因有無助推器而改變尺度的分支。分離物、推進焰、RCS、傘、再入光效、碰撞／hull／箭頭不能各自殘留舊倍率。圖示用的屏幕大小箭頭可維持，但不當作真實物體尺寸。

### 4.2 相機距離由物體大小決定

- 用目前受控物體的 bounds、相機 40° FOV、stage 的橫直比例，計算容納物體所需距離；預留約 15–25% 邊界作初始調校值。
- 目標是一般飛船高度約佔畫面 25–40%，不是硬套所有機型同一個佔比；大型火箭與小艙均不裁切。
- 高度本身不再要求相機遠離火箭。地面按物理位置自然變遠，發射台漸小、附近物件產生視差，地平線逐漸展開。
- 有／無助推器可因真實橫向尺寸改變 framing，不能改變 model scale。不能同時要求不同寬度火箭距離相同與永不裁切；驗收比較世界比例，另驗收 bounds fitting。
- 分級後鏡頭只包住受控物體，不因掉落的一級／二級越飛越遠而拉遠。另一物體正常離開畫面，可用全景／軌道查看。
- 開傘時逐步納入傘的實際範圍；保留約 1.2s 的連續構圖過渡，不突然換成遠鏡。

### 4.3 相機方向、過渡及防穿地

- 跟隨時維持局部地平線；火箭可傾斜，鏡頭不跟住艙身翻滾。
- 初始取略高於飛船、可見少量地面的側後視角；不在某個高度突然轉為俯視／軌道。使用者手動轉動及縮放後保留意圖。
- 硬性地面安全間距用獨立的實際 camera pose 約束，不覆寫使用者的 yaw／pitch；高空不殘留低空自動抬頭。
- 構圖距離／focus 的平滑使用 wall-clock、與 FPS 無關的阻尼，初值約 .4–.8s，再按錄影調整；1000× 不會把鏡頭補間乘上 1000。
- 平滑 framing，物體本身仍跟當前物理 state；不讓相機 lag 大到飛船離開畫面，也不為平滑而穿地。
- 暫停不自行巡航；既有開傘／觸地視覺收尾可繼續。背景停止、reduced-motion 採短過渡。縮放、resize、fullscreen 不改 flight state。

## 5. 返航接地：固定位置與被動動作分開

### 5.1 地面

- 安全接地確立固定的接地點／表面法線；沿用現有 touchdown 有號側速與坡度，記錄接觸前運動。
- 速度停止後，固定該接地位置。二級仍在飛、倍速改變、重新按繼續，均不重選地面位置／高度。
- 保留已有按側速搖晃／側倒及 hull 支撐；它只改艙身姿態和支撐高度，不讓地面或接地錨點跟住漂移。
- 相機轉為以接地點上方固定參考高度作焦點，平滑銜接，不再每幀追住旋轉後的 bounds 中心。
- 物體橫躺後仍在畫面內；安全 bounds 檢查可緩慢微調距離，不能產生持續橫向追蹤。
- 不新增一套地面滑行物理。現有安全着陸閾值、硬撞及二級爆炸維持；高速接地不變成慢慢側躺的安全着陸。

### 5.2 水面

- 水陸判定及着水錨點穩定，水面視覺波紋不改物理地形高度。
- 保留輕微浸水、浮沉及小幅搖擺；不加沒有物理來源的持續水平海流。
- 相機焦點固定於水面附近，不逐次追蹤小幅浮沉；海岸／遠處樹木不隨艙身浮沉滑走。
- 塌傘、繩、波圈均用同一接地平面與座標；保留首幀連續、布繩不穿地及 reduced-motion 行為。

### 5.3 HUD

- 把水平速度的含義固定為相對模型地面的局部水平分量；本版固定地球下，與既有球面切向速度一致。
- terminal 速度應由模型實際歸零；HUD 不另用強制顯示零掩蓋位置仍在改動。
- 着陸後的視覺傾側／浮沉是局部姿態效果，不把它誤算為飛行速度。既有說明可註明簡化的接地收尾，不新增常駐長段教學文字。

## 6. 地景層銜接與精度

先完成座標及比例，再調畫面細節；保留已改善的海面波紋／反光及陸地色差。

- local props、regional relief、global terrain、contact patch、地球及 cloud 的地理對位共用一致的基底與旋轉次序；樹及建築貼住同一位置的地形。
- 地形解析度按投影尺寸與畫質預算決定；樹／建築細節按像素大小漸淡，避免所有物件只因跨過單一高度就成批消失。
- LOD／contact patch 更新只改細節，不改海岸輪廓、接地高度及固定地物座標。保留既有 tile cache 與地理 seed，不讓 100m patch 重建產生整片樹木跳位。
- 近遠地面只留一套有效接地面；檢查 cutout、clip 半徑及接縫，避免方形色塊、重疊閃爍、洞及可見直邊。
- 既有行星深度 bias（例如 `R-5`）只作繪製避衝突，不能混入物理高度；先量測再決定如何保留／補償，不能直接刪掉而引入 z-fighting。
- 地球曲率自然保留。天空、星空及再入效果跟同一座標，不額外自動轉鏡頭；不藉加濃霧遮掩錯位。

## 7. 時間、狀態與畫質矩陣

| 狀態 | 物理及地面 | 鏡頭／局部效果 |
|---|---|---|
| 發射台 | 地面固定、初速零 | 可手動轉／縮放；點火不突然改比例 |
| 上升／下降 | 位置更新；地景只因相對位置而移動 | 近距離跟隨；同一倍率規則 |
| 真空軌道 | 正常軌道位置 | 地平線及地球按幾何變化；跟隨與示意圖規則分明 |
| 分級／分艙 | 各自連續繼承位置與速度 | 當前飛船 framing 平滑過渡，另一飛船不拉遠相機 |
| 開傘 | 保留既有氣動與所有可用倍速 | 順滑擴大構圖，無高度觸發跳鏡 |
| 艙已落地、二級仍飛 | `t` 可繼續、艙接地點固定 | 艙被動收尾，相機固定參考；另一物體正常推進 |
| 兩件均結束 | 物理停止 | 正常完成傘／撞擊／側倒收尾；水面可低頻輕微浮沉 |
| 暫停／背景 | 不推進物理 | 暫停保留有限收尾；背景停止所有動態 |
| 低畫質／reduced-motion | 物理／座標完全相同 | 只減細節／縮短動態，不切換到另一種幾何比例 |

## 8. 實作影響範圍

實作前搜尋所有 caller，不在孤立分支補 offset。

| 檔案 | 預期工作 |
|---|---|
| `surface.js` | 固定地形方向／高度／水陸的模型契約；二維主體與三維 booster 採一致對應 |
| `model.js`、`recovery.js` | 核對 terrain sampling、接地／terminal 安置；避免已停物體再被 `t` 搬動；保留碰撞與安全閾值 |
| `orbit.js` | 原軌道公式預期不改；檢查速度定義與任何新 helper 的契約 |
| `scene.js` | 同比例、framing、使用者角度與安全 pose 分離、地景轉換、着陸焦點及另一飛船位置 |
| `scene-art.js`、`terrain.js`、`global-terrain.js`、`contact-ground.js` | 固定地景基底／旋轉順序、LOD／patch、視覺高度 bias；僅改實際涉及處 |
| `impact-effects.js`／傘及再入效果 | 檢查 world／local transform、支撐與顯示尺寸；避免主體修正而效果殘留舊比例 |
| `main.js`、`ui-runtime.js` | HUD 語義、scale note、暫停／繼續及倍速；不為停止艙而凍結仍飛的二級 |
| Node 測試及 browser regression | 增加座標／比例／地景相對運動斷言，更新依賴舊放大規則的 fixtures |
| `assets.json`／package／Sites | 預期不新增 runtime 依賴；改檔仍驗證完整 closure。若新增檔才更新資產清單 |
| 計劃及 registry | 本專項驗證寫回主計劃；新測試按現有 ownership 註冊，記錄 committed selection-preview |

原 `sim/rocket-space-mission-lab/` 的 481 個 protected files 不得改動。沒有需要保存的 learner answer schema；鏡頭是 transient，不引入 localStorage／attempt 持久化。

## 9. 修正順序與完成關卡

1. **先處理座標／接地滑動**：固定地球契約，對齊所有地景基底；terminal 艙與任務時鐘解耦。完成「二級繼續飛，着陸艙及固定地物不漂」測試才進下一步。
2. **統一實際比例**：刪掉高度／助推器特例放大，連帶修正 effects、另一飛船及接地尺度，確認不同配置同比例。
3. **重做構圖及接地焦點**：按 bounds／FOV 平滑 framing；landing 用固定焦點；保留手動控制、防穿地、開傘過渡。
4. **檢查地景銜接**：近地→高空→再入的 LOD、海岸／樹／接地精度，僅修正實際暴露的接縫和跳變。
5. **完整針對性驗證與交付**：source＋ZIP、手機／tablet、前後連續錄影及數值 report；通過後同一 Site 發佈。這份計劃本身不代表已修好。

每個關卡獨立驗證，但避免把座標已改、鏡頭仍舊的半成品部署給使用者。

## 10. 驗收與證據

### 自動數值／畫面檢查

- **地形時間不變性**：同一 position 在 t=0／600／3600／86400 的地形方向、高度、水陸一致；主體與 booster 的方向映射一致。
- **接地穩定性**：有二級仍飛時，按繼續及 1×／20×／可合法使用的 100×／1000×，已落地艙的物理接地點／地形取樣不變，實際速度及 HUD 為零；不只比較一幀或只暫停測試。
- **固定地物**：追蹤至少 3 個在畫面內且有不同深度的固定地理點／樹。使用者不操作、姿態收尾後，陸地上 10 秒屏幕漂移 ≤0.5 CSS px、world 相對位移 ≤1cm；在 1×及高倍速均檢查。World 數值與截圖／錄影一併保留，避免 offscreen point 充當可見視覺證據。
- **接地收尾**：左右側速、坡地、直立／斜姿態、海上，首幀連續、hull／傘不穿地；不因姿態收尾帶動背景橫向漂移。水面只保留局部浮沉及波紋，無持續水平位移。
- **配置比例**：無／一對／兩對 booster、一／二級、分艙，在同位置及指定相同 camera pose 下，同一零件世界尺寸一致；不能把合法 bounds fitting 距離變化誤報為模型縮放。
- **上升連續掃描**：垂直及轉彎各一段，由 0→50→200→1000→10000→60000→120000→200000m；固定地標投影隨路徑連續，不在分支門檻跳位。簡單垂直向下觀察 fixture 的地標尺寸隨遠離縮小；一般斜視構圖不強行要求所有點單調縮小。
- **切換連續性**：分級、分艙、燃盡、開傘、body select、視角切換、低畫質降級、fullscreen／resize；畫面不能因隱藏分支突然改尺度。分離的物理位置與速度另行保留原測試。
- **時間**：30／60FPS 的 0.5／1／2s wall-clock camera 過渡近似一致；高 warp 不快轉補間，frame budget 維持；暫停／背景不產生無來源的鏡頭運動。
- **安全及模型完整**：防穿地不永久改手動角度；相機／畫質操作前後 flight state 不變；軌道、熱防護、RCS、傘／撞地及二級自動離軌原測試通過。

### 尺寸、裝置及效能

- source 與解壓 standalone 都跑：390×844、844×390、1024×768、768×1024、1194×834；另測 iPad browser chrome 縮短可見高度與 fullscreen。
- 可信觸控轉鏡頭／縮放、操控切換與倍率；主控制、全景／軌道仍可觸及，不增一行操作列。
- 正常／reduced-motion、畫質 0／1／2、WebGL context 恢復；不添加反射 pass／貼圖負擔。記錄 draw calls、triangles、暫存與 frame time，避免用 SwiftShader 或 CPU-only 中間幀聲稱 iPad FPS。
- 保留連續升空、落地後繼續及水面浮沉的短錄影，不能只靠靜態 screenshot 判斷運動自然度。若本機無法可靠錄影，保留逐幀序列及軌跡，明說限制。
- 實體 iPad Safari 必須另列待測；本機 Chromium 通過不等於真 iPad／Safari 通過。

### 交付閘門

- [x] 上述跨時間地景／接地問題先重現，再修正通過。
- [x] 針對性 Node、browser、package contract、`check:tests` 及 committed selection-preview。
- [x] Source／ZIP／Sites runtime 檔案一致，原 481 檔 hash 不變，沒有 SCORM／評分回流。
- [x] 更新主計劃，列明實際已跑／未跑範圍及固定地球假設。
- [x] Commit、同一 Sites project 部署至 terminal success，再提供網址。

## 11. 已知取捨

固定地球符合現有二維模型，會移除目前可見的每日地景旋轉；這是本次建議的模型收斂，不是完整自轉地球的實作。固定地圖後，同一時刻／位置的地形高度可能與舊版時間旋轉取樣不同，舊的時間依賴 fixtures 及返航路徑要重新驗證；不能只更新 screenshot。

保持真實尺度後，跟隨視角會看到較小範圍的地面，而全景／軌道負責全航程觀察。鏡頭參數及地形銜接需要連續畫面調校；數值完全正確也不能保證已符合使用者的視覺感受。

## 12. 實作紀錄

`surface.direction` 現按同一個物理位置提供固定的東／上／北方向，主體及三維分離 booster 共用，不再按 `t` 自轉；hull clearance 的局部軸同步修正。地球保留固定的 .7 素材對位角，regional／local／global／contact 都用一致的 ZYX 基底。原物理常數、軌道方程、氣動、安全接地門檻及原活動沒有改動。

跟隨飛船固定 .001 scale；構圖用 40° FOV、約 36% 畫面佔比、物體高度／寬度與 stage aspect 計算，距離下限 25m。分離物維持相同比例；掉落一級刪除近地縮小，改為在可見 hull 接觸局部地面平面時使用既有撞擊效果池。這仍是簡化接觸，沒有加入完整剛體／碎片求解。既有 terrain LOD／tile cache／接縫及海面材質預算沿用，沒有新增 pass 或 runtime 檔。

構圖距離按 wall-clock 指數阻尼（time constant .25s，reduced-motion .06s）；原開傘 1.2s／reduced .25s、分級 .6s 構圖銜接保留。防穿地只修正實際相機位置，不再寫回使用者 pitch。着陸焦點取視覺側倒／浮沉之前的固定參考，另一飛船亦用此參考，避免整個場景跟着局部姿態收尾橫移。原搖晃／浮沉、傘與繩接地保留。

一般火箭撞地時亦真正歸零速度，HUD 改讀模型值；不再只強制顯示 terminal 零。已着陸艙仍可讓任務時鐘及存活二級繼續，固定地形及接地點不被搬走。

驗證中的兩項測試工具修正：全螢幕後等兩個 animation frames 再點選選單，避免讀到 fullscreenElement 已設、fullscreenchange 尚未處理完成的過渡；大型 water fixture 截圖期間停止背景動畫，避免 SwiftShader 持續畫圖拖延 screenshot。這不是 iPad 即時 FPS 證據；中間姿態採 CPU 更新、關鍵階段真正 render／截圖。

## 13. 完成證據與部署

Runtime commit `880585a80738cdf82d29bf8469d0ad193d3d00ca`。八個 app Node 檔及 browser/package contract 共九檔通過；更新的 case／delivery selector 另有正常與非法參數斷言。`npm run check`、`check:tests` 通過（301 entries）。Committed selection-preview 比較 `0c0ffdb` → `880585a`，`output/reports/rocket-explorer-visual-selection.json` 列259個CI候選；沒有宣稱執行全部候選／全庫Node。

Source、解壓 standalone 各102 flows，合計204。涵蓋既有layout／assembly／controls／flight／return／effects／parachute／cameras／warp／surface／landing，以及新 visual：兩交付各30組配置（1／2級、0／2／4 boosters、五 viewport）共480個高度樣本，同比例 .001；兩交付各10組 land／water 的接地後繼續及1／20／100／1000×；30／60FPS構圖過渡、低空一級原尺寸及撞地；原生觸控、fullscreen、context restore、畫質及reduced-motion。地標world及screen、側倒／浮沉收尾時鏡頭及另一飛船的最大位移均為0。

這是**續跑後的組合驗證**，不是一次完整命令全通過：首輪完成全部source及standalone前八組，standalone的舊warp等待條件在正常提早着陸後仍要求時間推進而逾時；改為每倍率獨立fixture、接受着陸且要求實際時間曾推進，再完成standalone warp／surface／landing／visual。原報告 `explorer-visual-core-report.json` 保留completed=false；續跑 `explorer-visual-standalone-report.json` 為completed=true。`output/playwright/rocket-side-booster-lab/explorer-visual-report.json` 按label/case替換完整續跑組、驗證source／standalone各組數目一致後彙整204 flows，全部相同runtime hash，runtime／HTTP／console errors為0。

補拍source及standalone、390／1024尺寸、0／200／2000／120000m共16張畫面，核對實際高度、HUD讀數與 .001 scale；報告 `explorer-visual-photos-report.json`。這是render-only高度取樣，不是連續實飛錄影；着陸有24點姿態／相機時間軌跡。已目視升空近遠、地面側倒、落水及塌傘畫面。實體iPad Safari、裝置FPS及全剛體／流體物理未驗證。

原481 protected hashes不變；source／standalone ZIP／Site 471個runtime檔逐檔一致。Ordered SHA-256 `4387ae26a52fabd5e8d6fb4ddfca4015002f4975d0e72636211482373dbec290`。ZIP471 entries／15985549 bytes，SHA-256 `70f6e196e5fb3047a8487ce565c18499684a205b4faf0138e61a00e4cb312677`。Build、Node、package、registry、check及selection證據在 `output/reports/rocket-explorer-visual-*`。

已部署原owner-private Site，沒有更改訪客權限。Site source commit `d91ea7b9d2af2df8b3f0864754f78295c36d71ec`；deployment `appgdep_6af0016cd8788191bc82890f396ff15b`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_665cf8fdb8048191a51ed9ec624fa271`，server回傳 succeeded（2026-11-08T04:58:27.402379+00:00）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。
