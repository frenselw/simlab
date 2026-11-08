# 小小航天家：自然地貌重新設計

狀態：2026-11-08，使用者指出上一版地形呈橫直交叉、格仔及條帶，要求重新設計。已按使用者指示實作獨立40km預覽樣本，主模擬全區等待使用者確認後才擴展；實作／驗證紀錄見末尾。

沿用[探索工作台主計劃](42-rocket-explorer-workbench.md)、[共用設計](00-shared-platform-and-style.md)及[production guide](../docs/simulation-scorm-production-guide.md)。本工具仍是非評核workbench，SCORM／rubric／attempt／答案snapshot全部N/A；原rocket-space-mission-lab保持不變。[上一版計劃及數值證據](42-rocket-explorer-terrain-vegetation.md)保留作歷史紀錄，不能作自然觀感已通過的證明。

## 已查到的結構性問題

使用者本次沒有附新的問題截圖；已讀現行原碼及上一輪實際ridge畫面。下列規律確實存在，但尚未以同一鏡頭逐層開關，不能宣稱已量出每項對所見線紋的貢獻。

| 位置 | 現行做法及風險 |
|---|---|
| 全球高程再放大 | 全球721×361高程約0.5°一格，區域base直接從這個粗格雙線性取樣；區域增至1025×1025仍會繼承粗格的坡度轉折，細格數量不能補回原本沒有的地貌 |
| 網格幾何 | triangulate-terrain.py先建立規則meshgrid；套用Delaunay後頂點仍然成行成列，三角面方向及長邊易形成規律。現行海岸／chunk邊界另有固定1500m線段 |
| 山勢與谷線 | 主脊、兩條谷線及丘陵由少數sin／cos及固定方向公式建立；plateau由x／z範圍相乘，區域細節以max(abs(x),abs(z))沿正方形淡出，會留下條帶及方形構圖 |
| 光照 | terrainNormal把兩向坡度乘2，頂點法線再在稀疏面內插值，可能強化取樣格及三角面折痕。法線也不是陰影，不能把深色線當成真實谷形已成功 |
| 植被與地色 | 每個規則格最多放一棵／一組，位置雖有抖動，仍可能看出行列；乾濕分區亦沿用週期波紋。中景相同三團樹冠重複，容易像散落綠色塊 |

方格用於儲存高度本身合理。目標是隱藏資料取樣和分塊的規律，保留真正山脊、谷地及坡面的連貫結構；不以一層更濃噪音、霧或模糊掩蓋問題。

## 新方向：真實高程作底，柔和自然的教學場景

優先採用發射場所在區域的真實bare-earth DEM作山形來源，保留真實支脊、河谷分流、山腳沖積地及平原比例；藝術處理集中在配色、有限的發射場整理及低成本植被。停止以現行幾條週期公式決定主要地貌。地表採略簡化、柔和的自然風格，維持與火箭模型相容。

候選來源為[USGS 3DEP](https://www.usgs.gov/3d-elevation-program/about-3dep-products-services)：官方提供約30m的1 arc-second無縫DEM，涵蓋美國本土，免費且無使用限制。30m是離線來源解析度，並不表示把整個30m網格送到iPad。先試讀一塊來源，記錄URL、版本、覆蓋、座標／高度基準、NoData及SHA-256，再決定實際裁切範圍。尚未確認特定下載檔案／處理時間。

現有環境未裝rasterio／tifffile／pyproj。先驗證既有Python/Pillow能否讀取選定資料及地理標記；有具體格式需要才增建置端工具。瀏覽器不新增GIS依賴、不即時下載地形服務，不把自然輪廓交給每幀運算。

## 五項設計改動

1. **共用自然高程。** 離線裁切、處理NoData及降採樣，先在現有約470m區域高程預算內測自然輪廓。資料過濾保留山脊／谷底，海岸水位固定；全球銜接帶使用相容的低解析基底，避免粗格假細化。取樣解析度若不足，按誤差實測增加，不能直接承諾全球高密度。渲染、contact、HUD及碰撞始終取同一份處理後的高程。先核對來源是否超過既有3500m上限；有需要就一致更新物理／顯示契約，禁止硬截峰頂變平台。
2. **誤差控制的不規則網格。** 以高度及輪廓誤差決定哪裡加點，山脊、轉坡及谷岸保留，平原合併。不能只把原行列頂點隨機移一點便宣稱完成。保留少量必要的共用chunk邊界點／接縫約束，內部三角面不沿大片橫直線延伸；三個LOD沿用相同地貌和邊界。實際接縫必須從斜角及移動畫面檢查。
3. **正常坡度、平滑受光。** 撤去統一兩倍坡度放大，法線從共用高程在合適尺度計算並平滑內插。用灰色無地色地形確認輪廓和受光已自然，再加顏色；不用每面平塗明暗，不烘焙方向陰影後再重複打光。近／中／遠的法線濾波及地色都平順接替。
4. **連片森林。** 以坡度、谷地及固定的不規則密度圖決定林地，配合有最小間距的散點候選／拒絕取樣，取消每格固定一棵或一團的構圖。林緣、空地及疏林可跨chunk連接；不同尺寸／方向的林冠共享少量原型。中景與近樹共用分布，遠景底色仍在。固定seed、邊界鄰域和cache回復後的位置必須一致。
5. **小範圍整理發射場。** 發射台及道路保持平整，外圍按原地貌緩接；移除目前3–5km同心圓式整片壓平的設計。首輪保留現有發射高度／海平面契約，只在必要設施範圍做局部修整，檢查是否形成不自然坑／圓環；若必須抬高整個場地，需連同初始飛行state、場景定位及HUD一併設計，不能只移動模型。

## 先做一小段，再擴展

第一步先做同一鏡頭的拆層診斷：灰色地形、法線顏色、純地色、線框、森林開／關各一份。確認交叉線出自幾何、受光、分區或樹群，必要時也檢查LOD／浮點深度，避免只換資料仍留下顯示問題。

第二步選發射場附近約30–50km、同時含山脊／分支谷地／平原／林地的樣本，先製作靜態低空斜視與俯視，再重播同一段飛行。這是風格及管線原型，不作獨立的新功能或對外第二個站點。

第三步在自然觀感、碰撞及預算達標後，擴展到現有480km區域及其全球過渡，才重建正式素材、commit及更新同一Sites。原地形保持可回溯，不在未看過實際原型前便再整區發佈。

## 驗收與資源限制

- 地貌：低空50／500m、3／10／30km及軌道俯視；至少兩個太陽方向、兩個相反觀察方向與連續移動畫面。應看得到長短不一的支脊、谷線、山腳和低地；不應出現長距離直角交叉、重複波紋、棋盤林地、圓形發射場坑或山谷被平滑成圓包。
- 顯示：灰色無地色時也成立；關閉森林後線紋不能仍被誤認為森林問題。法線／地色／mesh／canonical高程互相比對；LOD／chunk邊界不閃線、不跳高度。高程格存在不等於畫面必須露出格。
- 物理：保留水面0m與既有着陸穩定性；海岸、坡地、谷底、山頂及發射場逐點檢查穿地／浮起。重新跑發射、分離、入軌、再入、1000×、雙飛船、陸／海着陸；其他控制及聲音維持原有行為。
- 資源：先維持上一版森林最多10追加calls、9 active／12 cached、無新陰影／反射pass的界限；地形以可見三角面及投影誤差調整，首輪追加總量沿用6–10萬triangle方向。數值為候選上限，不能犧牲自然外觀去追規則格，也不能宣稱已驗證真機FPS。
- 資料：列出下載／封裝大小、CPU陣列、GPU buffers及解碼峰值；避免同一高程重複保留多份全解析資料。原始DEM保留在建置來源／快取而非runtime；實際來源檔保留政策待下載大小確認，來源及hash必須可追溯。
- 交付：沿用assets.json、現有browser owner／registry及Source→ZIP→Site closure；原活動481個保護hash不變。真iPad Safari橫直及長時間飛行需另記實機證據；本機軟件GPU不代替真機校準。

影響範圍：workbench專用地形生成入口、共用三角化的可選取樣方式、surface高程與biome資料、terrain／global-terrain法線與LOD、forest分布、contact銜接、相關art／forest／model／browser測試及manifest；改共用生成器時保留原活動預設路徑及輸出。未新增計分、持久化、地理搜尋或地圖操作介面。

原規劃階段僅完成研究；下方紀錄後續獲授權的40km樣本實作。


## 40km樣本實作（2026-11-08）

- 使用者指定先看30–50km樣本，確認自然觀感後才擴展。本輪只新增同一Site內的 `terrain-sample.html`，不替換主入口或修改主模擬地形／飛行物理。地貌飛行預覽只是鏡頭沿路移動，沒有另造火箭控制／任務或新站點。
- 真實來源為USGS 3DEP Bare Earth DEM Dynamic Service，服務說明資料截至2026-10-26；2026-11-08裁出EPSG:4326、1536² Float32 GeoTIFF，bbox[-120.40,34.48,-119.86,34.92]。原檔9,439,142 bytes、SHA `17f8c61c3608f4a6ae6f61461883ca208245acbe298a04aaf815f644363d700e`，已保留原檔及完整request／georeferencing sidecar，不經瀏覽器下載。這是多解析度服務輸出，不冒稱固定30m來源tile。
- 選發射參考點東面28km為中心，投影40×40km，513²共用高度（78.125m取樣），範圍64.3–1422.2m；裁切無缺值，未硬截高或抬高山峰。Pillow／NumPy／SciPy沿用現有環境，沒有安裝GIS或runtime依賴。
- 以Poisson初始點、Sobol候選點及分區最大高度誤差逐輪加點；保留三個候選mesh，遠／中／細各4,878／13,678／33,678 triangles。細mesh的獨立probe 95%誤差16.692m、最大79.707m，8m是目標而非達成的硬上限。內部近橫／直邊比例約0.043%只指不規則遠景mesh；近景另有細格。
- 實際視覺檢查捉到遠景過早降級的三角面、近樹的矩形載入邊界、低空細節不足及接縫漏天；均先修正再交付。樣本保留細mesh顯示，連續片段受光取自16-bit高程PNG，地色用lossless WebP；不再放大兩倍坡度或把光影當成谷形。約6.65MB貼圖GPU估算（含albedo mipmaps）；不以下載大小當記憶體，也不把動態shader取樣說成零成本。
- 低空新增81²、12,800 triangles的鏡頭局部細地形，與canonical格點對齊；內部約2.2km採原高程，外圍銜接遠景mesh，2800–3000m的覆蓋重疊防漏縫。近樹根取同一格內三角插值，避免簡化面與高度表不同而浮起。這是樣本的顯示處理，未宣稱已完成全球球面／主飛行碰撞整合。
- 森林使用固定不規則密度、谷地及坡度分布；植被是示意而非真實land-cover。近樹最多1690、中景512組，兩個GPU batches；CPU候選點cache上限32格。距離alpha hashing接替近／中景，取消矩形顯示邊界。與舊候選9 active／12 cache不同，但GPU draw calls更少，仍有明確記憶體上限。全樣本最高99,938 submitted triangles、4 draws（含局部細地形），不新增陰影／反射pass，pixel ratio上限1.5。
- 預覽提供低空山谷、全景、俯視及沿路飛行；可暫停，拖動／雙指縮放，切灰模、法線、遠景網格及兩個光向，開關樹木。遠景網格檢查只展示不規則簡化層，灰模／法線則包含近景細地形；沒有聲稱局部細格不存在。沿用shared fullscreen，沒有SCORM／Storage／評分流程。

最後驗證、封裝與Site收據記於下方。即使本機檢查通過，仍等使用者確認山勢／森林觀感後才擴展480km；真iPad Safari尚未實測。


## 樣本最後驗證

- Source與解壓ZIP共10個完整瀏覽器flows通過：320×568、390×844、1024×768、768×1024、844×390各一輪。每輪包含四個視角、自然／灰模／法線／遠景網格、第二光向、樹木開關、飛行暫停及繼續；320／390有trusted drag和雙指縮放，visualViewport未被放大；1024有shared fullscreen與WebGL context恢復。Runtime及HTTP錯誤均0。
- 最後runtime hash `0541dff1810792334b1f413480f3868e1496de056d57dd0c1f751fee18a10470`；瀏覽器報告 `output/playwright/rocket-side-booster-lab/explorer-natural-sample-final-report.json`。本機逐張看過自然／灰模／俯視及飛行畫面；使用者是否接受自然觀感仍是下一步的必要確認，沒有把自動測試當視覺接受。
- 目前全樣本上限99,938 submitted triangles、4 calls；近景patch有12,800 triangles，兩個樹木batches最多1690近樹／512中景組。貼圖RGBA估算6,645,081 bytes，另計geometry／typed arrays／driver；未量iPad峰值、GPU frame time及長時間耗電，不宣稱真機FPS。
- `terrain-sample.test.js`驗證真實來源hash、格式／截斷拒絕、索引、法線、朝向、mesh contact、固定樹位及格內間距、貼圖hash、近景三角插值及manifest。全11個Node測試檔（含既有發射／返航／聲音及package contract）通過；registry303 entries、`npm run check`、doc links、diff checks通過。沒有執行全庫303項。
- 離線重建後480個runtime檔完全一致，原活動481個保護檔hash相同，證據 `output/reports/rocket-natural-sample-rebuild.json`。主模擬原有472個runtime檔逐byte不變，其hash仍是 `af559f0d6b5536afdc194ea00942a9780c3968c9aa0273d8348477b0a33d32d2`；僅standalone manifest新增樣本依賴。
- 正式保留畫面 `source-natural-sample-low-1024.png`、`source-natural-sample-overview-1024.png`、`source-natural-sample-top-1024.png` 等在 `output/playwright/rocket-side-booster-lab/`；另有實際canvas錄影 `natural-terrain-flight.webm`。Source初版視覺不合格的自動通過紀錄只作歷史參考，不作最後接受證據。
- 最後受光使用opaque RGB PNG的RG兩色存16-bit高度，片段內取鄰近高度計算法線；不使用低精度8-bit法線或有損地色壓縮，以免緩坡出現假等高條帶。相鄰高低位元採線性取樣、禁用height mipmaps，來源PNG及高度格逐值round-trip通過。
- 尚未將真實DEM、樹群或局部細地形移入主模擬全區。下一階段先收使用者對本樣本的山勢、林帶及動態觀感回饋，再決定調整／擴展。


## 樣本Sites交付收據

- Runtime commit `e2533553a202a0d9dafcb8bc914409d0d7ef2eab`；Site source commit `65347e5b2c9158998ea0f55951e6ffe61d067ada`。480個source／ZIP／Site dist／實際發佈tar內runtime逐byte一致；Site dist共482檔，另兩檔為root入口及build-info。Standalone ZIP 20,029,625 bytes，SHA `0e2b9bd38bc966916d14b48ffa605e6038f81fcad31ae7f0acd84fd6bbb02214`，不包含原始GeoTIFF。
- 原owner-private project `appgprj_6aeca66555b481919803e437687c4fa8`，audience保持不變。Native deployment `appgdep_6af03fd80fac8191a29d48006ca332a0`，version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_3fe59ca31cf88191bf1c9df1fa043f87`，2026-11-08T09:24:48.451567Z 回報 `succeeded`。
- 樣本網址：https://simlab-rocket-side-booster.ieyp.chatgpt.site/rocket-side-booster-lab/terrain-sample.html 。Codex browser opening回報queued，沒有把它當真機或live UI驗收。
- Committed selection preview `output/reports/rocket-natural-sample-selection.json`，比較 `065eefc9f85cd7b58a73f9315eb711f0aed21409`至runtime commit；README dependency未識別，保守選出303項。這是選測預覽，實際執行仍為上述11個Node檔及10個source／ZIP flows。
- 所有source／package／build／registry／rebuild／deployment證據在 `output/reports/rocket-natural-sample-*`，瀏覽器畫面及canvas錄影在 `output/playwright/rocket-side-booster-lab/`。生成cache、發佈tar及本機預覽server於交付時清除／停止；原始DEM是固定build source，刻意保留。
- **歷史狀態：40km樣本已上線；其後使用者回覆「看上去挺自然的」，接受自然觀感並進入原定全區擴展。** 真iPad Safari效能與長時間飛行仍待實機測試。

## 全區擴展（2026-11-08，已完成及部署）

使用者已接受樣本。擴展現有480×480km區域，保留樣本入口供比較；全球其他地貌仍為示意。採USGS同一服務的4096²區域輸出，重投影成4097²、117.1875m canonical高程；gzip只負責傳輸，飛行開始前一次解碼，CPU約33.6MB。海面維持0m，低於海平面陸地在本簡化模型視作0m；NoData以最近有效來源填補並記錄比例，不把異常Float32當山峰。

範圍包含surface／全球與區域mesh／contact／森林／材質／manifest／原有測試及生成腳本。區域用誤差加點的不規則網格；連續片段法線由16-bit高度貼圖產生，保留輕微海面波光。iPad等coarse pointer裝置固定2K地球底圖抵銷新增貼圖成本。小範圍發射設施整地、超過3500m山峰上限、海岸及區域邊緣會一併處理。採原有Node及browser owner；檢查發射、分離、再入、warp、陸海着陸、兩個交付版本及保護hash。評分／rubric／SCORM／snapshot persistence均N/A（探索工具）。不新增任務、GIS依賴或額外陰影pass。最後記錄實測預算及未驗證實機項目。

### 全區實作與最後驗證

- 原始USGS GeoTIFF 31,269,670 bytes，SHA `6653cc68d871559cae89467ad9e78215fca374eea4573c9187d6f20f9856a8d8`，bbox[-123.2,32.4,-117.6,37.0]，EPSG:4326 PixelIsArea。來源無效值約1.275%，先最近有效值填補、再套Natural Earth海岸；原檔及request sidecar保留為build source，不進ZIP／Site。
- 主模擬已使用4097² canonical field、三角插值及5000m一致物理上限；儲存高程最大4346.2m，非硬切3500m。117.1875m是本地取樣距離，來源仍是多解析度服務輸出。原40km樣本不變；441個重疊測點95%高度差13.04m，這是兩份處理資料的比較，並非地面測量精度。
- 傳輸gzip 11,654,445 bytes，解碼Uint16 33,570,818 bytes；257²啟動fallback加全球格約0.65MB，執行飛行前等待fine ready，失敗顯示原有載入錯誤。網格取消重複4.2MB高度陣列，三層共50,104 triangles、1,832,508 bytes；共用1500m chunk邊界仍保留，內部以Poisson／Sobol候選及高度誤差加點。遠景4,776個陸地probes的中位誤差11.36m、95%約100.09m、最大441.90m；25m是細層加點目標，不是達成的硬上限。這是遠景簡化面誤差，不是近景接地誤差或DEM真實精度。
- 2049² RGBA高度／密度PNG 4,149,257 bytes，GPU RGBA估算16,793,604 bytes、不產生height mipmaps；片段法線不再放大兩倍坡度。近景81²、12,800 triangles與canonical格及對角線對齊，2.2km內保留原高程，2.2–3.8km裙邊接到當前顯示LOD；LOD改變即使飛船靜止亦重建。Node檢查912個近景頂點，最大canonical差約0.000057m。這是頂點一致性，沒有宣稱球面三角面所有內點均零誤差。
- 森林仍最多9 active／12 cached near batches、1296近樹及256中景九冠組，固定亂數、最小間距候選及連續value noise取代小格排樹／周期濕度條紋。距離alpha hashing接替；中景根部及LOD改變共用實際顯示三角面。植被及設施仍是示意，不是實測land-cover。250–650m發射場整地取代3–5km整片壓平，設施以canonical地面定位。
- 開發中候選source／ZIP執行216 flows，包含飛行、返航、分離效果、鏡頭、倍速、材質、着陸、座標穩定及地形。其後修正LOD裙邊及森林根部，最後同一runtime hash重跑source／ZIP的surface、landing、terrain共96 flows；三種地形viewport、兩種材質viewport、陸／海接地、cache繞行及0→1→2→0畫質均通過，runtime／HTTP錯誤0。未將候選的hash當最後closure證據，也沒有重跑所有無關UI測項。
- 最後另有自然／灰模／法線／第二光向／相反視角各source及ZIP畫面，已逐張目視；實際Canvas與模型低空滑行錄影 `natural-region-flight.webm` 7秒、348,983 bytes。沒有在正式UI新增診斷選項。樣本78m細節仍保留在原review頁，主區的117m碰撞及234m片段法線是不同資源預算，未聲稱全480km均維持樣本mesh密度。
- 測試畫面最高95,213 submitted triangles、89 draws（整個主場景）；coarse-pointer使用2K globe，貼圖RGBA估算最高約66.34MB。森林獨立上限10 calls，cache繞行不超過12；這些是Chromium觸控尺寸／軟件GPU數值，沒有真iPad FPS、峰值driver memory或長時間耗電證據。fine解碼及影像／geometry／索引另有CPU開銷，不以下載大小當記憶體。
- 最後11個Node／package檔全部通過；browser height拒絕截斷／超高／404，近景接地、靜止LOD更新、原三角化list呼叫三個案例逐值與`e2139b4`一致。`npm run check`、registry303 entries、docs links及diff checks通過；並非全庫303項已執行。
- 重新建置482個runtime檔逐byte相同，原活動481個保護hash相同。最後ordered runtime SHA `1b10de912f5a50a480f599479a131fb8333c142a3ff03b3ca657a3c4c2f5a2b9`；standalone ZIP 35,167,013 bytes，SHA `67fc4a1c8327b260970a009b6f1d4eeb43898c68126f9fc71189fc5988bd26ba`。主區以外的全球高度仍為示意；沒有SCORM、評分、提交或持久化。

證據：`output/reports/rocket-natural-region-{build,validation,mesh-error,builder-parity}.json`、Node／check／registry／rebuild文字報告；最後瀏覽器報告 `output/playwright/rocket-side-booster-lab/explorer-natural-region-final-report.json`，候選報告另存並標明非最後closure。Sites收據於部署成功後補記。

### 全區Sites交付收據

- Runtime commit `5f51c8fae5a2aebdd5218ed5367b011e6785f091`；Site source commit `31a37e6dc7d6988353c99178928e3d47227888e1`。482個source／ZIP／Site dist／實際部署tar內runtime逐byte一致；Site dist484檔，tar另含hosting metadata共485檔。Archive 35,158,023 bytes，SHA `a9501d824db4218c8b31fbc70fe2f8c03edd1550b24c876055691cc513224c8b`。
- 原owner-private project `appgprj_6aeca66555b481919803e437687c4fa8`，audience未變。Native deployment `appgdep_6af053320ef88191b02308f9378b4947`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_78bdb1de11d48191b104aef0cc7128ee`，`2026-11-08T10:47:32.248555+00:00` 回報 `succeeded`。網址：https://simlab-rocket-side-booster.ieyp.chatgpt.site 。
- Committed selection-preview比較`e2139b4`至runtime commit，`output/reports/rocket-natural-region-selection.json`。README／建置依賴未識別而保守選出303項；這是選測預覽，實際執行為上列11個Node檔及分開記錄的候選216／最後96 flows。
- 匿名live asset請求回傳401，符合現有private存取限制；沒有把它當成已驗證線上檔案內容，亦沒有宣稱已在登入後live UI或真iPad Safari驗收。部署成功依Native terminal收據，檔案內容依source→ZIP→dist→實際tar closure。
- 收據：`output/reports/rocket-natural-region-{deployment,archive,site-copy,live-asset}.json`。固定DEM build source、standalone ZIP、Site checkout及驗證證據保留；生成cache、scratch及部署tar於交付後清理。
