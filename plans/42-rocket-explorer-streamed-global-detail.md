# 全球按視野載入地形細節

使用者要求立即將較精細地形擴展至全球，解決480km區域邊緣後山谷紋理消失。沿用探索工具、原481檔保護、無SCORM／評分／提交／storage，rubric、assessment風險及snapshot N/A。遵循[共同風格](00-shared-platform-and-style.md)及[製作指南](../docs/simulation-scorm-production-guide.md)，前次[全球基礎及載入排序](42-rocket-explorer-global-terrain-and-night.md)是本輪基線，不冒稱已有全球117m資料。

## 實作決定

1. 下載NOAA ETOPO 2022 30-arc-second ice-surface官方GeoTIFF，校驗來源、長度、SHA、EPSG4326及像元中心。離線生成全部現有10度陸地cell的約1km連續坡面normal tiles（1027平方，包含一像元gutter），重複邊界用同一全球座標及中央差分，反經線循環、極點收斂。保留tile與來源hash，不將1.6GB原檔放入Site／Git；可由固定來源重建。
2. 真實全球細節是較密坡面資料，不是將既有5km格插值冒稱新資料。物理碰撞、主要山勢網格仍用原固定canonical格，區域117m及樣本保留；視覺坡面約1km，不代表全球117m碰撞精度。海面及低於海平面簡化維持。
3. global-terrain現有4 active／6 cached／2 pending為單一streaming owner；同一cell的mesh及normal依次載入，共用取消、預讀及eviction，圖片decode後關閉。normal僅保留一張3×2固定atlas及36×18 lookup，slot重用前先清除lookup，避免閃錯地區；每次只下載目前畫面和預讀範圍，不預載全星球。失敗保留原粗面與normal；stale回應不可覆寫新slot。
4. 原4K全球height GPU fallback改2K，以騰出約12.6MB給atlas；物理8K格不改。貼圖總預算目標低於100MB、DPR1.5／2K globe維持，沒有反射／shadow pass。normal atlas使用一般8-bit RGB法線，線性採樣、NoColorSpace、無mipmaps；圖像decode及Canvas alpha維持不透明。
5. shader以全球地理座標查cell／atlas，將East／North／Up法線轉到世界座標，與原光照合用。細節就緒後平順接替fallback，region邊緣按與物理相同的rounded footprint在175–239km間過渡，保留內區細節，外區由全球normal繼續。繼續以視錐／畫面地表焦點優先，軌道全景以實際像素尺寸決定是否需要細塊，低空離開區域不被localVisible閘門擋住。

## 影響範圍及驗證

新增offline tile builder、來源及runtime metadata／tiles、terrain detail cache及既有global-terrain／terrain shader／scene-art／scene，assets.json及既有Node／browser owners、README／活動計劃。所有runtime依賴入manifest，新增test owner入registry；不改原活動、物理模型或控制UI。

Node檢查來源／全land-cell覆蓋／PNG尺寸、hash及共用邊／反經線／極點；cache slot／取消／失敗／eviction／重用／opaque decode；normal GPU及lookup座標／context restore。Browser以145km高度跨原區域175–239km、離開後300／500／1000km、其他大洲及兩極／日夜／手機和iPad尺寸、慢回應／旋轉／速率邊界。截圖含normal layer及實際坡面，量外區細節variance，不能只檢查mesh active。source／ZIP／Site／實際tar closure、原481hash、check／registry／committed selection-preview。真iPad FPS、峰值driver記憶體及登入後live UI未驗證需明列。

完成後commit並部署原owner-private Site，權限不變。原下載及task scratch清理，保留必要來源sidecar、生成tiles、ZIP、Site checkout及證據。

## 實作及驗證完成

- NOAA 30s原檔1,585,813,987 bytes，SHA-256 `8630abc401cc6bdd30b507a68d3eb9eda5b65f5636f7199e4b1eefd476b5a9e2`。水平EPSG4326／PixelIsArea及世界範圍已驗證，GDAL辨認其compound CRS為EPSG9518。Rasterio1.4.4僅作離線小視窗讀取，GDAL cache64MiB；安裝在task scratch，沒有變更host NumPy或增加browser依賴。
- 已產生全部440個陸地cell，共144,835,824 bytes PNG及index；不會在瀏覽器一次下載全部。所有相鄰共用邊及反經線通過一LSB容差，極點坡度收斂。另選南極／反經線／美洲／亞洲／歐洲／北極6塊重新計算及PNG編碼，與交付檔逐byte一致；沒有第二次完整重建440塊。sidecar及每檔hash／強坡度probes保留。
- 已接通同一4 active mesh／6 cached／2 pending owner。影像decode後關閉、取消及stale decode不會領取slot、eviction先清lookup；typed atlas可在context restore重新上傳。600ms漸入不推進模擬時間。較低畫質保留normal細節，幾何改粗；world fallback2K不改8K CPU格。修正舊global shader東西向坡度基底方向，新normal透過真實地理基底轉換。
- 13個Node／package檔通過，新增cache測試另補跑延遲decode取消案例。涵蓋normal atlas slot重用、尺寸／不透明驗證／失敗／abort清理、全440檔hash及PNG schema／manifest、來源，既有物理／返航／音效／互動／森林／原樣本及ZIP contract。`npm run check`、registry305（262 Node／43 browser／49 helpers）、docs links及diff check通過；非全庫305項皆執行。
- 最後相同runtime hash下source／standalone共118 browser flows：20 surface／clock／context、20 landing、48 world（包括前向／反向載入、八區日夜、fallback GPU高度及iPad budget）、30 detail（24個145km高度跨原區域及外圍距離／兩種尺寸、4次真正shader方向GPU讀回、2次detail context restore）。模型及Storage／SCORM不變，runtime／HTTP／console錯誤0。GPU法線讀回與獨立地理基底計算在所測pixel逐值相同，不只檢查active count。
- 140／210／250／350／600／1000km離發射場參考點的畫面均有載入細節；350km以外啟用／停用新增normal的畫面RMS差約.0055–.0061，證明原區域外實際使用新資料。已目視跨區域／外圍與其他大洲照片；區域與全球資料仍有解析度差異，不冒稱全球117m，也沒有新增高精度碰撞或完整剛體地形。
- 實測software Chromium的貼圖估算95,853,308 bytes，最大atlas3081×2054；不含CPU／framebuffer／driver額外開銷。真iPad Safari FPS、峰值driver記憶體及長時間慢速網絡未驗證。Normal全部144.8MB是Site／ZIP總資產量，不是啟動下載量。

Runtime926檔，ordered SHA-256 `bf7f2aa5609b79fb5cae3aceb7d57802176d10226e02ba2a2f826845191cbe06`。ZIP189,700,975 bytes，SHA-256 `8047c995da9060b4eebd119083b3a2c0a3e9bfb529c029641805ad54a9aeea72`；source／ZIP逐檔一致，原活動481保護hash全不變。證據為`output/playwright/rocket-side-booster-lab/explorer-global-detail-final-report.json`及`output/reports/rocket-global-detail-{node-final,cache-final,build,check,registry,rebuild,closure}`。local preview以absolute root回傳HTTP200並開啟Codex交接；queued不是已觀察使用者UI。

## Commit及發布狀態（2026-11-09）

程式commit `9f153fb4769b0f086fc3b5016cc6ef6148818b71`。committed selection-preview以`c34c2c3`為base，README／build依賴觸發full305選擇；實際執行範圍仍為上列13個Node／package檔及118 browser flows，不將selection當作全庫通過證據。

原owner-private Site `appgprj_6aeca66555b481919803e437687c4fa8`權限不變（單一owner、無groups）。大型Git同步先遇403，保留未發布commit的backup branch `codex/global-detail-upload-fbd3d278`後分六批同步，最終source commit `439a43da84bf858bf573075be3917f8ff8ada770`。與原完整待發布tree `1d5df277421926d1a1ea052137ffb43549f324d5`一致；六個中途source commit均未發布。

helper產生Sites tar共189,645,859 bytes、929檔，SHA-256 `81d381b7fbd7fdf62ae073516ffaa625303a359fe9c573e5d842c7259f831894`。已逐檔核對tar／dist／canonical runtime，hosting metadata為同一project。原tar保留於`output/tmp/rocket-global-detail/site.tar.gz`供重試，保持bytes不變；下載原檔、Python暫存及task scripts可清除。證據：`output/reports/rocket-global-detail-{archive,publication}.json`。

**尚未發布成功。** Native `save_version_and_deploy_private`兩次均在OpenAI blob upload階段300秒逾時，未建立saved version或deployment。已查版本列表，live仍為v44／source `669cee6ca7f56153bc35bd0ca38114eb872b2682`，deployment `appgdep_6af075ddd260819180085e664f4bc255`，網址仍為https://simlab-rocket-side-booster.ieyp.chatgpt.site。另請求private publish-on-push，服務回覆`publish_on_push_accepted:false`，沒有以普通push冒稱已部署。這是傳輸／服務能力限制，不是自動審批拒絕；沒有改用缺少archive的save來繞過既有發布合約。後續應沿用已同步source和已驗證tar，待上傳服務可用後重試原private operation；如回覆saved_version_id則改為部署該版本，勿重存。
