# 全球精細地表

使用者要求全球可見地形達發射區約117米取樣品質。延續[探索版](42-rocket-explorer-workbench.md)及[全球地形](42-rocket-explorer-streamed-global-detail.md)，非評核、無提交或持久化。Rubric、評核風險、attempt snapshot均不適用。覆蓋以資料源可用的地表為準。海洋保持水面，湖泊及河流用同源水體遮罩。遠景按畫面像素降LOD。原USGS區域仍用現有實測資料及既有發射台道具。

- 由Copernicus GLO-90公開COG讀取高程及WBM，沿用官方1°檔案索引，包括極地。沿海及下陷陸地按遮罩分類；不以高度正負推斷海岸。相同樣本供立體網格及片段坡面光照。最低LOD格距約109m南北向，其他LOD隨實際像素大小變化。
- 只按可見地面採樣，最多兩個傳輸解碼工作，固定渲染及快取預算。按原飛行座標定位並處理反經線。下載失敗保留原全球網格及地圖，之後有限頻率重試。原模型高度不因異步下載而改動；近着陸區用同一個既有接地面及過渡。
- Copernicus AWS不開放瀏覽器CORS，以同源relay轉送限定公開GeoTIFF及必要Range。Sites沿用原project及受眾，本機由同一relay服務，普通靜態伺服器使用現有備用地形。離線只留備用地形。
- 影響範圍是資料relay、瀏覽器解碼、精細地形群組、場景接入、manifest、測試及部署。檢查真實高程／水體（海岸、遠方山地、極地、反經線）、LOD、相鄰邊、失敗回退、圖形資源限制及現有飛行行為。原活動保持不動。

## 實作與驗證

- 來源： [Copernicus GLO-90](https://registry.opendata.aws/copernicus-dem/) 2021 COG，索引26475個有資料的1°格，原索引 SHA-256 `e5a5efe088e70506bc1007d22006bdcb09b0ec03177b62f9652363c13f49ed97`。以 `python tools/rocket-art/build-precise-terrain-index.py <tileList.txt>` 重建。GeoTIFF.js 3.0.5 MIT 隨包，精細格採1/32度／32間隔，約108.6米。GPU片段以同來源較密高程查坡度及真實水體分類。畫面採樣避開以裸球面選取高山後方區塊的錯誤。
- 真實資料瀏覽器證據：智利海岸、喜馬拉雅、南極、反經線均實際繪製約108.6米網格；以開關網格的像素讀回確認畫面有改變。喜馬拉雅被繪製網格的海拔約4369–6665米，智利測得海洋及約123米陸地。無網路載入／執行錯誤；所測貼圖估算最高約96.1MB。原始TIFF僅驗證用暫存，未加入Git。實體iPad效能、每條海岸與山脈的藝術品質未逐一實測。
- 本機聯網入口 `node tools/rocket-terrain-server.mjs`，開啟其列出的網址。一般靜態伺服器可用同一個模擬器及已封裝的備用地形。Sites發布須同時交付同源relay和瀏覽器資產。

程式 commit `f83d9e9`。`npm run check`、registry 306、4個Node測試和29個既有source瀏覽器流程通過，新增四區真實資料測試另記於 `output/reports/rocket-precise-terrain-browser.json`。實際本機轉送回應 HTTP 206，範圍與內容長度符合上游。原活動未在改動範圍內。選擇預覽 `c4ab199` 到 `f83d9e9` 見 `output/reports/rocket-precise-terrain-selection.txt`。

Sites 使用原專案與受眾。因改為Worker建置須移入 `dist/client`，原單次Git同步超出64 MiB，保存完整source branch `codex/precise-terrain-upload-b521db2`後分五批成功同步。最終source `33656e264efbfbda943c39303b42eb596c4daec5` 與完整tree `2911a31335d93250c5127d4cf365099f0a494c44` 一致。937檔tar逐檔核對。Native blob上傳300秒逾時，直接源碼發布未獲接受，線上仍為v45。已驗證的發布包保留於 `output/tmp/rocket-precise-terrain/site.tar.gz`，見 `output/reports/rocket-precise-terrain-publication.json`。
