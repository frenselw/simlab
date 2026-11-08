# 全球自然地形與日夜光照

使用者指出480km區域以外地形仍差，夜面亦發白；本輪擴展至整個星球並修正夜面。沿用已接受的USGS細區及40km樣本，原活動481檔保護不變，仍是無評分／提交／SCORM／持久化的探索工具。rubric、評核風險與snapshot schema均N/A。

## 根因及範圍

- 全球仍是721×361的示意高程／人工山脈，只有發射場周邊有真實DEM及連續片段法線。全球碰撞、網格、法線及森林需要同用新高程。
- 海洋球面的密集環只在發射點附近，其他地點近看是粗面；近景密集網格應跟隨受控飛船，而不旋轉地理座標或改變模型位置。
- 天空按高度決定日間天色／太空，沒有地面太陽高度；物件環境光一直是日間值，雲及大氣邊緣亦保留亮底。日夜需由同一固定世界的太陽方向決定，軌道飛船另考慮地球遮蔽。

## 實作決定

1. NOAA ETOPO 2022全球真實高程，離線降採樣成8193×4097、整米＋land bit，海面固定0m、低於海平面陸地在簡化模型維持0m；反經線及兩極連續。上限9000m一致更新。大原始TIFF僅task cache，保留可重建的衍生高程及來源／原檔hash，不將數百MB檔案寫入Git或Site。
2. 全球gzip高度一次載入供同步物理查詢；解碼直接使用Uint16 backing buffer，避免重複全格。保留原USGS區域117m資料及平順過渡，不把全球約5km取樣冒稱117m。全球normals使用同資料生成4096×2049 RG8 texture（約16.8MB GPU、無mipmaps），不另外下載一份圖。coarse-pointer保留2K globe及1.5 pixel ratio。
3. 既有10°全球分塊、4 active／6 cache／2 pending繼續使用；所有mesh高度及biome重建。先核對灰模及自然顯示，若仍見規則面才更換內部取樣，沿用海岸／共用邊界及適應誤差方式。禁止只抖動規則格便宣稱自然。
4. 近景海洋密集環重新定向至受控飛船的地面方向；地理貼圖仍按實際世界方向取樣，碰撞及飛船state不變。必要時分開海洋顏色與遮擋深度，避免陸地三角弦跌入海面而露出藍色格。
5. 日間風格保留；黃昏平順轉暗，夜間天空／地面／海面／雲／大氣／樹木／飛船一致變暗，保留微弱可辨認輪廓。太空飛船按太陽光線有否被地球遮蔽決定直射光，不將地面夜晚等同所有高度完全無光。無新增動態陰影、反射pass或評分流程。

## 影響與驗證

surface／baker／geography metadata／terrain shader／scene-art／scene／contact／forest（若需接縫或根部銜接）、assets.json、原有Node及browser owner、相關測試與文檔。沿用已註冊owner；新case需更新case selection contract，不改無關活動。

世界位置包含美洲、歐洲、非洲、亞洲、澳洲、南北極及反經線，海面／平原／山地，各日間、黃昏、夜面及軌道地影；原USGS細區及其過渡另查。低空、着陸、鏡頭切換、context restore、body switch、倍速及固定地面不漂移；模型／Storage／SCORM不受渲染改變。量夜面像素亮度而非只查uniform，另做太陽光遮擋純函數檢查。

Source／ZIP／Site／實際tar byte closure、原481保護hash、離線重建一致性、check／registry／committed selection-preview。記錄下載量、解碼／GPU估算、calls及triangles；Chromium不代表實體iPad Safari FPS。完成後commit並更新同一owner-private Site，權限不變。

## 實作與資源

- NOAA原檔SHA-256 `9d27d4b8ea8e76977e2988bca667d7c8fa68b927355feffcddd6b4875a7fd08e`；衍生PNG約10.1MB，來源及處理固定於`tools/rocket-art/sources/explorer-world-terrain/`。Runtime row-delta gzip 10,625,207 bytes，解碼67,133,442 bytes，儲存格最高6698m；9000m為驗證上限，沒有把所有山峰削成固定高度。
- 4096×2049 RG8、無mipmaps，省略重複經線端點並用repeat接合，適合4096貼圖寬度限制。高度與物理共用資料，但片段法線約10km取樣、全球網格亦有簡化，不代表全球都有USGS細區精度。保留共用海岸及cell拓撲，未增加每塊頂點預算。
- 海面顏色與depth-only遮擋分開；地面正常遮擋遠方物件，海面不再蓋掉球面三角弦內的陸地。海面密集環隨受控物體換位置，但地理及模型state不移動。接地裙邊在裁切內接到實際顯示面，森林中景根部沿同一面過渡，避免浮空。
- 天空／雲／大氣／海陸共用固定太陽。`lighting.js`保留材質原有compile hook及cache key，實例樹與兩艘飛船各按地影受光，發光材質不被一併熄掉；不添加動態shadow map或反射pass。coarse-pointer仍2K atlas及1.5 DPR，GPU貼圖估算約83.12MB；global格、regional格及其他CPU／driver開銷另計，不能以下載量代表峰值記憶體。
- 低於海平面陸地及海面仍用0m；植被／氣候色差為示意，並非實測land-cover。固定世界／地球不自轉的現有模型保持不變。

## 驗證完成

12個Node／package檔通過；最後調整4096貼圖寬度後，再跑art／lighting及package contract、三份JS syntax、registry304 entries（261 Node／43 browser／49 helpers）及docs links。`npm run check`先前通過，未聲稱執行全庫304項。

候選runtime `18b3dd7fa1b93eeebb7f3b027abf006e580ebba0869fa968ce408be0bc437354` 的source／standalone共174 flows通過：26 camera、20 surface／context restore、20 landing、86 visual scale／framing／anchoring及22 world。其後僅將重複的全球經線端點移除，貼圖由4097改4096寬並repeat；最後runtime另跑source／ZIP world共24 flows，加入GPU讀回5個高度與CPU逐值一致、山脈自然／法線層、八區日夜、iPad DPR及記憶體預算。沒有將174候選flows冒稱最後hash的一次完整執行。兩份報告為`output/playwright/rocket-side-booster-lab/explorer-world-{broad,release}-report.json`；原始地形／森林case另於開發候選檢查過，未在最後hash重跑整套。

最後source／ZIP讀數一致：day sky .499982882、twilight .188607221、night .009163554（約1.83%日間）；夜空亮像素比例0。喜馬拉雅、阿爾卑斯、安第斯、撒哈拉、澳洲、南極、北極、反經線八區night均低於day 25%，亮像素低於2%。GPU shader runnable、模型／Storage／SCORM不變；最後兩份runtime／HTTP／console錯誤0。已目視山地自然／法線、夜空及冰雪夜面畫面；全球地形仍比USGS細區概化，沒有完整全球高精度陰影或地形遮蔽求解。

NOAA gzip離線重建逐byte一致；再次完整baker重建後484個runtime檔逐byte一致。Source→ZIP逐檔相同，原活動481保護hash全不變。最後ordered runtime SHA-256 `aa1d5c5a1c3d7b9fe0ff158fc961bfa9f29d09cefe8b42b1879cdf887e621187`；ZIP45,715,292 bytes，SHA-256 `9094edb3d5e946ecb42ffd3be150549f15f03754b4a2c5236be07c8ede7d6882`。真iPad Safari FPS／峰值記憶體、登入後live UI尚未驗證；Chromium用軟件GPU，不能作裝置效能證據。
