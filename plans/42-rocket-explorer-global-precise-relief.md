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

## 2026-11-11 夜面格線與遠區近地細節

從跟隨鏡頭約 300 km 的夜面重現亮格。關閉精細地形區塊後亮格消失。自訂混合曾對色彩和 Alpha 通道共用來源 Alpha，邊緣重疊因此令原本不透明的畫面透出底色。Alpha 現使用正確的來源覆蓋係數，軌道視距和黑暗地表改用連續的全球地球材質。瀏覽器讀回比較的畫面最低 Alpha 由 191／255 恢復到 255／255。

低空繼續用 Copernicus 高程和水體。坡度及局部高差直接影響地表顏色，世界座標固定的細紋理在低空出現，遠景按畫面尺度淡出。可見中心區塊先排入，飛行方向另預載最多三塊。飛行碰撞沿用既有地面基準。低空實測為亞利桑那、新墨西哥及約 1.4 km 離地高度的連續移動航段。該航段初速約 360 m/s，實際前進逾三秒後仍顯示 16 塊約 108.6 m 間距的網格。細紋理是地表材質模擬。

「望天空」首次切換時從跟隨位置向上望約 57°，並顯示原地轉頭提示。Chrome 確認兩個模式的相機位置相同，跟隨向下望、觀測向上望。

海岸水面交界比較值 8.196 超過既有 8.0 門檻，使用第 49 版原有執行檔重跑得到同一數值。本輪另有真實資料畫面及不透明度讀回，實體手機與全球逐區的畫質未驗證。

第 50 版於 2026-11-11（UTC+8）發佈至原址。從正式站根網址進入 Chrome，重測 300 km 夜面、亞利桑那離地 2.1 km 的真實高程區塊和望天空。無 JavaScript 或 HTTP 錯誤。源碼及解壓版通過 14 個天空瀏覽器流程。 [發佈與驗證記錄](../output/reports/rocket-explorer-relief-and-sky-publication.json) · [夜面畫面](../output/playwright/rocket-side-booster-lab/live-night-orbit-300km.png) · [移動航段畫面](../output/playwright/rocket-side-booster-lab/moving-remote-mountain-continued.png)

## 分支審查跟進

- 暫停時，精細地形在 30 秒冷卻結束後會自動重試。當新視野需要尚未載入的區塊，Worker 中止已離開需求範圍的請求，待回覆後處理新區塊。取消不計入網路失敗，保留已解碼的高程快取。Node 測試涵蓋重試、轉鏡及 GeoTIFF 分段讀取。Chrome 實際中止兩個受控的本機 HTTP 檔案目錄請求，同一 Worker 隨即解碼下一塊的 4,489 個高程及水體樣本。 [Worker 驗證](../output/reports/rocket-branch-review-worker.json)
- 修正遠離發射台時貼地網格朝向地心的三角形，使正面朝外。以發射區和北緯 47° 的網格驗證方向。近海面的藍色邊緣光隨軌道視距淡入，貼地網格切換的平均 RGB 差由 8.196 降至約 0.145–0.155，通過原有門檻。
- `npm run check`、`npm run check:tests`（307 項登記）及探索版 18 項 Node／套件測試通過。以 `assets.json` 核對獨立版 ZIP 的 935 個檔案與源碼逐檔一致。 [獨立版 ZIP](../output/packages/rocket-explorer-standalone.zip)
- Chrome 在最終源碼與解壓獨立版完成 `surface,world,detail,sky`，合計 120 個流程，無 JavaScript 或 HTTP 資產錯誤。實體手機及正式站未覆驗。 [瀏覽器驗證](../output/playwright/rocket-side-booster-lab/explorer-branch-review-targeted.json)
- 全清單首輪在源碼完成 85 個流程後，着陸視覺案例的截圖逾時。沿用既有測試做法，在推進 200 個模擬幀時暫停 WebGL 繪製，再繪製最後一幀供截圖。源碼重跑該案例的 43 個流程全通過。整份雙交付清單未重跑。 [首輪紀錄](../output/playwright/rocket-side-booster-lab/explorer-branch-review-full-partial.json) · [視覺重跑](../output/playwright/rocket-side-booster-lab/explorer-branch-review-visual.json)
- 第 51 版於 2026-11-11 14:19（UTC+8）發佈至原私人站。正式站首頁與模擬入口回傳 HTTP 200，確認首頁指向模擬入口，入口含舞台和啟動程式。四個修正檔與發佈包逐一核對雜湊。Copernicus 高程代理回傳 HTTP 206，範圍與內容長度相符。 [正式站](https://simlab-rocket-side-booster.ieyp.chatgpt.site) · [發佈收據](../output/reports/rocket-branch-review-sites-publication.json)
