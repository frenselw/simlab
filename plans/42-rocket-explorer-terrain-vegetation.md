# 小小航天家：山地、峽谷及森林的低成本顯示計劃

狀態：首版已實作並發佈，但2026-11-08使用者指出地貌呈格仔／橫直交叉，視覺品質需重做。後續採用[自然地貌重新設計方案](42-rocket-explorer-natural-terrain-redesign.md)。以下保留原設計、數值驗證及部署的歷史紀錄，不代表自然觀感已通過。

沿用[探索工作台主計劃](42-rocket-explorer-workbench.md)、[共用設計](00-shared-platform-and-style.md)及[production guide](../docs/simulation-scorm-production-guide.md)；評核、rubric、SCORM、attempt／snapshot均N/A。目標是飛行途中有可辨認、連貫的山系、谷地、平原及森林變化，沿用現有WebGL／Three.js，保留固定地球、同尺度及接地穩定性。

## 目前為何看起來平

- `terrain.bin` 區域範圍480×480km，高程257×257，間距1875m；資料最高1368m。這能表示大起伏，但幾百米至一兩公里寬的谷地容易被平滑掉。地域網格的細級亦以數公里為基礎，不是高解析DEM。
- 區域高度主要由緩和的正弦起伏與36組示意山脊組成，沒有廣泛的分支峽谷網絡；全球細級以約0.2°格距為基礎，適合大地貌，無法表達窄谷。
- 區域高程靠近邊緣會逐漸壓低；全球高度另在發射區附近被抑制、240–400km間逐漸恢復。這種避接縫的安排須重新整合，否則單加細節仍可能留下寬闊的低起伏過渡帶。
- 隨飛船的contact層樹木預留81個instance，另有發射場樹木；區域樹冠群最多240組。Contact樹／岩在離地約1.2–2km淡出，區域樹冠亦受範圍／畫質限制；欠缺連貫的中遠景森林表現。
- 既有批次繪製、地形三級LOD、全球tile cache已存在。問題包含地貌內容、解析度及植被接替，而不是缺一個全新的render engine。
- 全球地形為避免球面粗網格沉入海面，現採 `depthTest:false` 配合解析裁剪。新增明顯山脊前，需檢查前後坡及地平線遮擋；不能只加高頂點便視作完成。

以上是原碼／二進位資料核對，並非新畫面的視覺驗收；尚未做裝置效能測試。現有來源是教學示意地形，並非實測地形資料。

## 建議地貌與覆蓋範圍

全球基礎同步補足山系／高原／盆地及森林色帶；較細山谷第一輪優先覆蓋整個發射區域、實際飛行走廊及常見返航區，並記錄覆蓋邊界。不是承諾第一輪便有全球米級地形。

| 地貌 | 首輪內容與作用 |
|---|---|
| 發射場周邊丘陵 | 保留發射台／設施的必要平整區，較外圍加入200–600m丘陵；不要在設施腳下突然長山 |
| 連續山系 | 沿通常向東飛行的走廊安排800–2500m主脊、支脊及鞍部，有長輪廓而不是孤立圓包 |
| 峽谷／山谷 | 沿固定谷線與支流削出谷地；先做約2–5km寬、相對兩側低150–500m的可辨識谷形，靠岸線／崖線加密網格 |
| 高原與盆地 | 平頂、陡邊、寬谷與低地交錯，令不同航段有辨識度 |
| 全球遠景 | 用山系的受光、岩土色及森林分布表現洲內變化；森林顏色不依賴近景樹仍在繪製 |

海岸沿用現有地理輪廓；上述山谷是示意設計，不能冒稱真實位置的準確地形。高度首輪維持現有0–3500m契約，海水0、發射點0。不做洞穴、懸挑或地下隧道。

## 共用高程先行

1. 以同一份canonical高程作為地形網格、地面法線、HUD離地高度、碰撞及着陸的依據。網格烘焙必須取樣這份高程，不能一邊直接用生成函數、一邊查較粗的另一份高度表。
2. 全球大地貌與區域細節採「共用基底＋逐漸淡出的細節差值」，避免把整段高度壓至海平面來銜接。邊界的高度、坡向及顏色要連續。
3. 區域canonical網格可先試1025×1025：480km範圍約469m一格，16-bit原始高度約2MiB；實際下載、JS字串及解碼峰值另量度。這是候選預算，尚未採用或實測。
4. 渲染用現有烘焙／分塊／三級LOD，優先加密山脊、崖邊及谷線，平原保持疏網格；不把整個地球改成相同高密度。
5. 高程、法線、地表分區及植被密度盡量離線烘焙。保留現有sun lighting，以坡度／高度／植被決定岩石、土色及綠色；避免把方向性陰影烘進albedo後再重複打光。
6. 深度及海岸遮罩一併驗證。若要恢復全球地形深度測試，先解決粗球面弦面／海陸覆蓋，不能讓陸地沉入海水。沿用必要繪製bias，但不得混入物理高度。

不採用單獨把顯示山高乘倍數的做法，確保飛船撞擊與畫面仍相符。

## 森林採近、中、遠三種表現

距離是構想，實際依投影像素、視野及畫質決定，而不是只看飛船高度。

| 層次 | 看見甚麼 | 低成本做法 |
|---|---|---|
| 近景，約數百米至2–3km | 分辨到單棵樹、樹幹及樹冠輪廓 | 沿用InstancedMesh，少量共用的低面數樹原型、頂點顏色、大小／方向變化；按地理chunk整批繪製 |
| 中景，約2–20km | 連成片的林冠、林緣、林間空地 | 以少量不規則低面數樹冠群接替逐棵樹；貼合山坡，避免巨大綠色球體漂在地面上 |
| 遠景／太空 | 森林色帶、裸岩、草地、乾地及海岸 | 優先烘進既有地面顏色；不繪製看不清的個別樹木，原本的地面pass即可表現大面積森林 |

森林要有成片密度及自然空隙，分布同時考慮水陸、坡度、高度及乾濕分區，保留設施／道路禁植區。樹種首輪少量即可，不做幾十種獨立材質。

所有樹木的位置由固定地理格網與seed決定；切換鏡頭、飛船、倍速及chunk cache後仍在同一位置。只更新可見批次，不讓樹跟相機移動，也不每幀重新抽樣。

每塊forest chunk維持少量instance batches，建立後計算bounds以供裁剪。只更新跨區後需要的資料，重用buffer並有cache上限；evict只釋放該chunk資源，共用樹geometry／material在整個forest系統結束才釋放。不要每棵樹建立一個LOD controller。

地面森林底色一直存在，近樹與中景林冠在很小的投影尺寸下接替，減少整片消失。首輪以不透明低面數樹為主，減少大量交叉透明樹葉卡片的像素重疊，不加動態樹影、逐葉風動或逐棵剛體碰撞。

技術依據：同geometry／material的多個物件可用[Three.js InstancedMesh](https://threejs.org/docs/pages/InstancedMesh.html)減少draw calls；[LOD概念](https://threejs.org/docs/pages/LOD.html)支持遠近不同模型。本項沿用現有chunk／投影尺寸機制，不引入新的框架。Instancing仍有頂點及像素成本，不能無限制增加樹量。

## 首輪預算與降級

以下是待prototype驗證的上限方向，不是已測FPS：

- 近景可見個別樹約1000–2000棵，原型約12–20 triangles；中景約100–300組低面數林冠。
- 追加地形與植被合計先控制在約6–10萬可見triangles內；forest batches追加約6–10個draw calls內，再按實測調整。
- 可見細節塊、cache、同時載入／建置數量均有硬上限；維持現有全球tile「最多4 active／6 cached／2 pending」作參考，不一次載入全部細景。
- 密度mask優先小型單通道資料或重用既有顏色；新增原始資料、解碼峰值及GPU buffers分別列帳，不把壓縮檔大小當成顯示記憶體。
- 低畫質先減樹密度、縮短單樹距離及減林冠複雜度，保留山形與森林底色；物理高程不跟着降級。
- 不增加即時陰影、反射pass或高解像後製。只有實測發現建置阻塞，才考慮worker／分幀建置。

[MDN WebGL best practices](https://developer.mozilla.org/en-US/docs/Web/API/WebGL_API/WebGL_best_practices)建議批次繪製、保守記憶體預算及及時釋放資源。iPad Safari仍需真機測量；不能用本機軟件GPU截圖推斷裝置FPS。

## 實作順序與影響範圍

1. **先做可辨識地貌**：選定主脊、谷地、高原地標，重整共用高程／銜接；全球遠景及區域網格、法線／地色一併烘焙。先看預設飛行路線與俯視是否確實看得出變化。
2. **先鋪遠景森林分布**：讓整個飛行區域與全球遠景有一致地表分區；不依賴近樹填補遠處畫面。
3. **再加中近景森林**：復用批次、分塊、cache及畫質級別；先小規模測量，再逐步提高密度。
4. **最後調校及交付**：全航段、tile接縫及着陸一致性確認後，才決定密度與品質預設，再commit／同一Sites部署。

涉及：`tools/rocket-art/`生成／三角化／高程烘焙、workbench的`assets/geography.json`／terrain binaries／`surface-data.js`／`surface.js`、`terrain.js`／`global-terrain.js`／`contact-ground.js`／`scene-art.js`及必要的`scene.js`銜接；更新manifest、資產hash／版本、Node與既有browser owner。

**生成器目前多處硬寫原`sim/rocket-space-mission-lab/`輸出路徑。** 實作先讓整個生成鏈支援明確的workbench輸出目標，確認各階段讀寫同一target；不能直接執行舊預設生成命令。原活動481 protected files保持不變，scratch放output/tmp，交付ZIP放output/packages。不新增評核、持久化答案或活動入口。

## 驗收

- 0／3／10／30／80／200km及再入下降，預設鏡頭、俯視、全景／軌道都有對應層級；地標在整段路線可辨認，不是只有一塊展示區。
- 山脊／谷線真有輪廓與前後遮擋；海岸沒有裂縫／方形色塊；LOD切換不改高度、不跳接縫。
- 記錄山脊、谷底、陡坡、高原、平原與海面取樣；渲染與canonical高程一致，發射地0、海水0、最高不超3500m。重新跑原碰撞／返航／坡地／海上着陸。
- 森林不長入海水、設施或不合適的陡崖；chunk切換／body切換／1000×後固定地物不漂移，cache不持續增長；站定後樹不移動。
- 原近地點／遠地點、緊湊header、fullscreen、方向及油門保持。Source及解壓ZIP、320／390手機、iPad橫直尺寸，正常／低畫質／reduced-motion及context恢復。
- 基準／新地貌／新森林分別量度draw calls、triangles、CPU建置／查高程耗時、frame time分位數、texture／buffer bytes、下載與解碼峰值；真iPad Safari校準密度。
- 記錄原有及新飛行連續畫面，特別留意接地不穿地／懸空與地景固定；package／registry／selection-preview及481檔保護通過後才發佈。

原規劃階段沒有跑render原型或修改現行模擬；下方為後續實作紀錄。

## 實作紀錄（2026-11-08）

- 新增有明確 `--target sim/rocket-side-booster-lab` 且拒絕原活動的離線入口；重用原海岸解析、既有全球mesh topology及SciPy三角化。全部生成讀寫指向workbench，沒有執行舊原活動的生成命令。重建兩次後472個runtime檔逐byte相同，原活動481個保護hash一致。證據：`output/reports/rocket-explorer-terrain-rebuild.json`。
- 地區canonical高程採1025×1025／468.75m間距，最高2491m；保留海水及發射點0m。連續主脊／支脊、兩條彎曲谷線、高原及低地沿東向走廊分布；在主脊及谷底／兩岸補取樣點。地形16 chunks／3 LOD共47,420 triangles；terrain.bin 5,949,208 bytes。高程JS 3,496,124 bytes，gzip 639,204 bytes；local Uint16解碼陣列2,101,250 bytes，另有既有region Float32高度表，沒有把壓縮大小當記憶體。
- 移除全球240–400km壓平帶，採共用全球基底加區域細節，175–211.2km淡出細節；沿用211.2–239.5km地區／全球查詢銜接。區域不再加原先10m視覺抬高；分塊共同邊線插值保留以防LOD裂縫。2,624個區域內部頂點與canonical查詢最大差0.000457m；7,681個全球頂點最大差0.283m（Float32球面量化）。細級全球山面啟用depth test，遠景coarse保留球面弦面／海水深度補償，非全地球高密度地形。
- 遠景森林／乾地／岩地／寒地顏色離線烘進既有mesh；contact ground共用同一分區函數。近景按約600m地理格批次生成，每塊最多144棵、最多9 active／12 cached，總可見上限1296棵；每樹22 triangles。中景用一個最多256 instances的三團不規則低面數林冠batch，按當地坡向對齊並避水／陡坡；每組60 triangles。理論forest最多10 calls、1296×22+256×60=43,872 triangles，instance buffers最高126,976 bytes；未計driver overhead。共用geometry／material不隨chunk eviction釋放。
- 最低畫質及投影太小時不建新森林；近樹與林冠各依投影尺寸裁剪，地面森林色仍保留。沒有新增陰影／反射pass、透明葉片、逐棵物理或新runtime依賴。樹幹和林冠使用不透明Lambert批次。
- 實測捉到「林冠以中心緯度重算鄰行格距」造成跨格偏移，已改為每一地理行固定格距；新 `forest.test.js` 先重現失敗，再驗證重疊位置、40次跨區／eviction、共用素材不被釋放及畫質恢復一致。已登記於test registry，既有browser owner新增terrain case（共14 cases）；registry目前302 entries。
- 共10個Node測試檔（含package contract）通過；包含完整升空、入軌、再入、降落傘、陸／海／坡地接觸、兩飛船及聲音。`npm run check`、`check:tests`、doc links及diff checks通過。Node log：`output/reports/rocket-explorer-terrain-node.txt`。不宣稱全庫302項全部執行。
- 較廣UI回歸在最後林冠／全球細級遮擋調整前完成：source＋ZIP共122 flows，layout／controls／flight／return／cameras／readouts／terrain均過，runtime及HTTP errors為0；其hash為 `1e3b89584fececd530f69a742b1ee4ef0f653efdf3f0864a9d2deb4570c49dc3`。報告：`output/playwright/rocket-side-booster-lab/explorer-terrain-broad-report.json`。最後圖形調整另跑source＋ZIP的surface／landing／terrain，結果於交付節記錄。

限制：山谷為教學示意，細節範圍仍是480km發射區；全球保留廣域地貌，沒有全球米級DEM。森林沒有個別碰撞／風動，林冠依坡面近似放置；不做懸崖樹根剛體。實體iPad Safari尚未測試，Windows Chromium／軟件GPU不能證明iPad FPS或峰值記憶體。原型建置CPU時間只作本機參考，不作硬體效能保證。


## 最後驗證及交付

- 最後runtime hash：`af559f0d6b5536afdc194ea00942a9780c3968c9aa0273d8348477b0a33d32d2`。source＋解壓ZIP共94 flows通過（surface／landing／terrain）；390×844、1024×768、768×1024、0／3／10／30／80／200km及區域外1000km航程細級地貌。包含graphics context恢復、低畫質、reduced-motion、ground／water／slope touchdown、森林cache跨區、固定地物、全球細級depth test。Runtime／HTTP errors均0；報告`output/playwright/rocket-side-booster-lab/explorer-terrain-final-report.json`。
- 代表性森林場景在六個source／ZIP viewport中一致：1064近樹、242林冠；58–60 calls、71,283–84,083 triangles（全場景），instance buffers 99,328 bytes。森林初次9 chunks建置累計6.5–11ms是本機參考，並非iPad校準。
- 額外固定鏡頭開／關森林量度：51→57 calls、52,480→80,024 triangles，即追加6 calls／27,544 triangles；沒有追加貼圖。12次warm samples的軟件GPU finish中位數1.4／0.9ms，順序／warmup差異明顯，不能據此宣稱開森林反而更快或換算裝置FPS。10,000次高程查詢約4.2ms。證據`output/reports/rocket-explorer-terrain-render-budget.json`；真機frame time／decode peak仍未量度。
- Standalone ZIP：472 entries、16,979,304 bytes，無imsmanifest.xml；SHA-256 `97c9b873bdc9edcba501a05933d1e4b9588773e50596a01dd0c681413a5d06fb`。最後package contract、10個Node測試檔、registry 302 entries、`npm run check`及doc links全部通過。區域／全球biome顏色誤差不超過Uint8量化半階，避免近景與遠景使用不同林色。
- 已清除此任務的生成scratch與Python cache；保留ZIP、必要報告及瀏覽器畫面。Sites使用原owner-private project／網址，發佈收據於下方補記。


### Sites 發佈收據

- Runtime commit：`c8d2cfcf3241b5e1c5de83b45678ee9d225d1271`；Site source commit：`057f3aff8c822d10225ff0ced2f708705603ed7e`。472個source／ZIP／Site執行檔逐byte一致；Site dist共474檔（另有root入口及build-info）。ZIP在最後package contract重封裝後的SHA以本節上方及build-info為準，runtime內容不變。
- 原owner-private project `appgprj_6aeca66555b481919803e437687c4fa8`，保留原audience。Native deployment `appgdep_6af02370e060819197e555f8ef3ae57e`，version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_b79ca1bbb5e08191aa205d93fe64454f`，2026-11-08T07:23:42.588491Z 回報 `succeeded`。
- 網址：https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Native成功回執驗證部署；Codex opening只作交付入口，不等於真機操作證據。
- Committed selection preview：`output/reports/rocket-explorer-terrain-selection.json`，比較 `cc95b788061b613aed23286fcffbfc3ef2447171`→runtime commit；README dependency未識別而保守選出全302項。這只是選測預覽，實際執行範圍仍是上述10個Node檔及瀏覽器流程。
