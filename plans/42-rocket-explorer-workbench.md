# 小小航天家：火箭升空與返航

地貌重新設計：[自然地貌重新設計方案](42-rocket-explorer-natural-terrain-redesign.md)。2026-11-08 使用者指出首版有格仔及橫直交叉紋，視覺品質需重做；本輪獲授權先實作40km獨立預覽，主模擬全區等待使用者視覺確認後才擴展；樣本驗證及發佈記於專項。首版實作與發佈紀錄保留於[原地貌計劃](42-rocket-explorer-terrain-vegetation.md)。

目前專項：[視覺座標、升空鏡頭與着陸一致性修正計劃](42-rocket-explorer-visual-consistency.md)。2026-11-08 已重現並實作修正高度／配置依賴的模型放大、已着陸零速度仍隨時間移動的地景，以及着陸姿態帶動鏡頭；專項文件記錄根因、固定地球決定、修正次序及跨時間驗收。實際驗證與部署結果記於專項及本文件末尾，下方舊證據只代表各次歷史變更。

本計劃取代此slug先前SCORM活動及評核計劃。使用者明確要求改為純探索、兒童及學生可反覆遊玩，移除全部評分、提交、成果紀錄與Moodle流程。原rocket-space-mission-lab保持不變；原Site project／網址保留。

依共用設計plans/00-shared-platform-and-style.md與docs/simulation-scorm-production-guide.md的scope-and-shared-cores契約：本次是非評核workbench。風險／rubric／正式提交／答案snapshot／LMS resume／分數信任：全部N/A；不再建立attempt或SCORM套件。重新整理回空白工廠，沒有localStorage／LMS自動還原；不新增匯入匯出。保留物理、音效、鏡頭、助推器／分級／太空艙與返航、10°／10%與±1%油門、fullscreen。

## 產品與狀態

完整主題「小小航天家：火箭升空與返航」。單行約49px頂欄只放品牌／短副題、音效及fullscreen；刪除任務tabs與狀態列。控制區不再放評核目標，閉合飛行指南放下方，飛行設定不再重複標題；返航標題與動作同一行。手機320／390短屏及844橫屏均保留44px按鈕、獨立控制面板捲動與原手勢所有權。

只保留workshop→pad→ascent／coast→ended；variant固定0，模型只持有設計及當前flight，無records／check／schema／result。返回工廠可保留設計反覆試飛，清空設計只在工廠可用；頁面refresh fresh。Orbit提示僅描述物理及提供指引，不以分數或過關判定限制探索。Technical failure顯示載入／操作提示，不聲稱已保存或已提交。

## 範圍與依賴

替換ui-runtime為純記憶體play controller，main／index移除評核UI與分支；model移除評核phase/actions。移除本slug的scoring／persistence／legacy／lifecycle測試及SCORM manifest；shared scorm／activity-flow保留供其他活動但本工具不載入。assets.json成為唯一standalone執行檔宣告，tools/package-rocket-explorer.js產生standalone ZIP、無imsmanifest.xml。更新catalogue、Site標題與dist，不改原活動或其他workbench。

## 驗證決策

保留並遷移物理Node測試（發射、軌道、solid／staging、返航、熱防護、傘、撞地、聲音、互動／素材），刪除已失效評分／LMS codec測試，以workbench controller測試覆蓋新啟動／reset／pause／非法command及frame budget。Browser由SCORM attempt fixtures改為source與解壓standalone；檢查API存在也零讀寫、無評分提交DOM／scripts、refresh fresh、反覆試飛，手機緊湊頂欄及trusted touch／fullscreen／dial-fader、助推器／二級／太空艙轉向與分離、開傘平滑鏡頭及安全返航，保留WebGL錯誤／遺漏資產檢查。registry與selection-preview隨刪除的assessed owners更新，不假稱舊58 cases仍完整執行；與assets一致的ZIP／Site closure及原481檔hash驗證。真手機未驗證；真Moodle readiness對本工具N/A。

## 已執行驗證

- 8 個模擬 Node 測試檔及 standalone browser/package contract 共 9 項通過；registry／selection 另 2 項通過。`npm run check` 與 `npm run check:tests` 通過（301 entries：258 Node、43 browser；48 helpers、2 manual）。
- source 與解壓 standalone 各 14 個 browser flows，共 28 個通過：六種 viewport layout、trusted assembly、四 viewport 10°／10%／±1% controls、fullscreen popup、雙飛船控制／分離、完整再入及兩級降落傘返航、平滑開傘鏡頭和二級觸地。Runtime errors／HTTP 資產錯誤均為零。
- 最後標題置中及刪除舊計分說明後，額外重新跑 source／standalone 各六 viewport layout；API／Storage trap 零讀寫。純網頁 refresh fresh、保留設計重新試飛、無舊評核 DOM／scripts。
- 瀏覽器報告：`output/playwright/rocket-side-booster-lab/explorer-full-report.json`（完整流程）及 `explorer-report.json`（最後 layout）。Node／registry／layout console 在 `output/reports/rocket-explorer-*.txt`。
- 原活動 481 個 protected files SHA-256 全部一致。實體手機尚未驗證；本工具無 Moodle readiness gate。

## 本次交付

- Runtime commit：`cc4dc9d3908db08f5fa1c6ee7c93fe810d3e28fd`。Committed selection-preview：`output/reports/rocket-explorer-selection.json`（base `f7bef6047641f8193253db1528699dfbdb08885c`）；此為選測預覽，不宣稱全庫套件已執行。
- 手機及桌面六種尺寸最終 header 實測52px；主題及音效／fullscreen同一行。
- Standalone ZIP：`output/packages/rocket-explorer-standalone.zip`，471 entries、15,980,471 bytes；無 imsmanifest.xml、scoring／persistence／shared SCORM runtime。SHA-256 `d4155347b08038b482c918ecaab4328b845f02ae330d96485bcee600bc10965f`。
- Final ordered runtime SHA-256：`920c639e8e2b1e1195a2b1f4282470910506db8df2504a29e277ef30d31ff495`；source／解壓standalone與Site dist 471檔一致；Site另有root entry及build-info，共473靜態檔。
- 同一private Site：`appgprj_6aeca66555b481919803e437687c4fa8`；網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Owner-private audience保持，Site顯示標題已更新。
- 官方helper將目前新檔建立並推送 Site commit `885c82d53d564d3f841382ff37b1376756d5dfb4`；其後部署該SHA之archive。Version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_1bb256bdf8dc8191a104480bab71204f`；deployment `appgdep_6aef50aa080081919338f94c53557513`，server回傳 succeeded（2026-11-08 00:24 +08）。
- 部署前自動審核曾因opening receipt為舊SHA而拒絕helper input；核對helper先commit／push current source的流程與471檔一致證據後，同一官方helper重試通過。沒有部署舊SHA或回退。

## Subagent 審查跟進

本次限定審查探索版模擬，不改原火箭活動。已重現：太空艙燒毀後，仍存活二級可用1000×，但frame loop錯用已終止太空艙的下落速度限縮步長，導致實際約0.8×。修正邊界限速只檢查仍飛行本體；驗證已終止太空艙＋存活二級、原有正常再入及frame budget。狀態／rubric／SCORM仍N/A，無新功能。審查其餘結論及執行證據於完成後補錄。

Subagent確認兩項P2，均已修正：

1. 太空艙在65 km再入燒毀、二級仍在200 km手動滑行時，原1000×實際只達0.8×；frame邊界檢查排除已終止本體。
2. 太空艙離開100,000 km模型界線、二級仍在200 km時，原每次繼續只運行2模擬秒便暫停；radius-stop亦只對仍飛行太空艙生效，保留七日上限與全部結束停止。

修正前regression已失敗；修正後Node/package九檔通過。Chrome在source及解壓standalone各執行雙飛船控制、沿軸分離、RCS和兩種終止太空艙＋存活二級1000×操作；均通過、無runtime／HTTP errors。證據`output/reports/rocket-explorer-audit-node.txt`、`rocket-explorer-audit-browser.txt`及browser report。

另以真實Web Audio native-click啟動，確認穩定軌道音樂有非零RMS訊號，真空飛行音效為零；暫停、實際繼續按鈕恢復及靜音通過。證據`output/reports/rocket-explorer-audit-audio.json`（驗證音訊圖訊號，沒有量測揚聲器）。Subagent未再重現組裝、分離動量、自動離軌、開傘、熱防護或套件重大缺陷；不宣稱無bug。原二維及簡化姿控／熱劑量限制保留；實體手機仍未驗證。

審查修正交付：runtime commit `a00456f760694f112cb08901100515f0917d48ab`，Site新source commit `1561a7a20ef302cd82bfd1c5c320338682ddc5b8`。部署 `appgdep_6aef52fb41e48191ad73d187f6e5532d`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_0c9aacf4c7348191b8c9066a8559b25c`，server回傳 succeeded（2026-11-08 00:34 +08），同一owner-private網址。

`npm run check`／`check:tests`通過，registry仍301 entries；committed selection-preview `output/reports/rocket-explorer-audit-selection.json`（base `8b0dbb64ace3b746d4fb491b714382097577e200`），不宣稱全庫測試執行。審查browser報告 `output/playwright/rocket-side-booster-lab/explorer-audit-report.json`。本次ordered runtime SHA-256 `dc58f21698ef8366bae97ec1cf58fe1b6f2aab541691e126f2c6b65e186cb50b`；ZIP471 entries／15,980,482 bytes，SHA-256 `268223e281b06cd62cb74e7980ed5f2c518743e5bc5c1f0a25e041f106e30ab5`，source／解壓standalone／Site471檔一致。原481檔hash不變。

## 飛行操作重新分區

依使用者要求：油門與360°轉向盤必須是flightPanel第一個可見內容；將操控對象、繼續／暫停、點火、分離、降落傘待命與時間倍率移至header同一固定toolbar。至少960px的主題及toolbar採一行；720–959px將主題行保留、toolbar另排一行；低於720px的toolbar用三欄兩行：操控／繼續／倍速，以及點火／分離／降落傘；44px目標、不橫向藏掣。降落傘位置固定，分艙前／操控二級時禁用，維持原有待命及安全自動開傘物理。近／遠地點及T+保留成controls-pane頂部的小型讀數列，狀態說明與返航細節移至主操控之後。

本次不改物理、聲音、倍速規則或探索狀態；評分／SCORM仍N/A。驗證source與standalone的workshop／flight／detached／ended header排版、六viewport無重疊及所有按鈕可見、panel首項位置與捲動、trusted touch／fullscreen兩個popup、native點火分離及開傘流程。既有Node／package、registry及原481檔hash需保持。

操作列重排驗證：9個Node／package測試檔通過；`npm run check`及`check:tests`通過，registry仍301 entries。source及解壓standalone完整瀏覽器共40 flows通過（每邊12個workshop／detached layout、native assembly、4尺寸controls／fullscreen、兩飛船／終止狀態、完整返航與effects）；runtime／HTTP錯誤零。24 layout flows確認六尺寸全部8個header按鈕（6飛行操作＋聲音／fullscreen）至少44px且無重疊、toolbar在panel捲動時不移動、flightControls是flightPanel第一項、native切換操控與降落傘待命成功。Pad／ended亦由真實發射與安全着陸流程覆蓋。

Header實測：workshop各尺寸52px；flight桌面1280為52px、844橫屏99px、320／375／390手機147px。手機兩排操作列沒有橫向藏掣；390×460短屏仍有167px場景及109px可捲控制面板，390×844有373px場景及288px面板。報告`output/playwright/rocket-side-booster-lab/explorer-toolbar-report.json`，console／build／selection在`output/reports/rocket-explorer-toolbar-*`。Committed選測預覽 base `a0d51df39611bba0e79230e7b4058e49627aeca8` → runtime commit `331f315c371d34936592c10eed0ac710d45501f6`；這是選測預覽，不是全庫測試執行。

Runtime ordered SHA-256 `d8cbb2964a17b0bc8d3d3a75da4a9cc627e1ed9b5d82085a3e9df5777addc3dd`；standalone ZIP471 entries／15,980,584 bytes、SHA-256 `af5a155f37b9f2119e3c53a3de2b129faca482bf9b3ce0f9c30d157d1994226e`；source／解壓ZIP／Site471檔一致。舊火箭活動481個hash不變。實體手機仍未驗證。

重排版本已發佈至同一owner-private Site，官方helper新source commit `1c65ee5a0e14f633d071e7109d5fafb5facd844c`；deployment `appgdep_6aef56db6a4c8191a024490501890ab8`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_4a3475379e748191ae0adf395de2013b`，server回傳 succeeded（2026-11-08 00:50 +08）。原網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。

## 降落傘觸地連續動畫

使用者指出下降及觸地塌傘過渡生硬。確認現行landed分支會以零速度重新計風向、強制flow=1，scene亦將艙身瞬間擺正。改為捕捉最後空中傘形／風向／繩長，在觸地首幀保持幾何及艙身朝向；其後用約5.5秒獨立視覺時間分段鬆繩、失壓、側傾下沉、接觸地面及皺摺阻尼收尾。保留紅白花紋、24繩、現有開傘條件／阻力／安全落地物理，不改snapshot或探索狀態。Reduced-motion採0.45秒淡出／淡入、無快速側移或飄動；背景不推進，物理暫停時容許觸地視覺收尾；同一任務切換操控保留正在塌落的傘，不重新跳到終點。布及繩以艙身朝向及地面法線投影，避免穿地。

驗證production Three幾何首幀差異、鬆繩／洩氣／接地／收尾中間幀、無模型狀態變動、30/60FPS一致、reduced-motion、斜艙／斜坡接地、操控切換連續，以及實際完整返航（包括20×下降）的source及standalone。新增於既有browser owner的parachute case；不新增依賴／部件／物理模組。既有9個Node/package測試、registry及protected481檔維持。

視覺驗證另修正：最後接地採漸進法線貼地，避免斜坡上高側懸空；洩氣過程傘瓣逐步摺曲，並避開艙身外形，避免硬碟般翻倒或穿過太空艙。

觸地動畫驗證：9個Node/package檔案、`npm run check`及`check:tests`通過（仍301 registry entries）。最終source與解壓standalone共14個針對性browser flows：8個parachute（1280桌面60／30FPS、390手機60FPS、reduced-motion）及各2個完整20×返航、effects／鏡頭、雙飛船／終止狀態。全部報告runtime hash一致、runtime／HTTP錯誤為零；沒有重跑本次不涉及的其餘完整layout／assembly／controls cases，不宣稱全庫測試。

所有觸地首幀布／繩幾何最大差為0，艙身角度不跳；正常60FPS每幀最大傘面位移約0.152m、30FPS約0.305m，最後幾何30／60FPS一致。普通塌落5.5秒，坡面布／繩不穿近似接地面，最後布面最高約0.368m；兩次native切換操控後仍同一canopy／相同landingAge。視覺收尾前後模型JSON不變。Reduced-motion .45秒以低透明度切換形狀，首幀亦無跳變、沒有快速可見側移。Normal及reduced-motion截圖已目視；背景凍結沿用既有document.hidden guard，未新增實體手機背景測試。

報告`output/playwright/rocket-side-booster-lab/explorer-chute-report.json`、同前綴`return/effects/flight-report.json`；console及build／committed selection-preview在`output/reports/rocket-explorer-chute-*`。Runtime commit `36a867982d65e004fff03b12f92016a955370654`，selection base `611d56d`；預覽不是全庫執行證據。Ordered runtime SHA-256 `0318987830cfef1bf95061954bd51440a117a0743eade2dc5fd834edae965321`。Standalone ZIP471 entries／15981844 bytes，SHA-256 `98406dcb986647b450190bb28fe453d684f8cbc0f6458c7a95ef6e89026ac18a`；source／解壓ZIP／Site471檔一致，舊火箭481檔hash不變。實體手機未驗證。

觸地動畫更新已發佈至原owner-private Site：source commit `690a180168f9b47a55d03cdafe0dea5d0aebc749`；deployment `appgdep_6aef604f77d48191afe9dab99327e0f9`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_85f3f60571748191b7f9089932a2f832`，server回傳 succeeded（2026-11-08 01:31 +08）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。發佈前source credential過期，更新同一Site憑證後官方helper正常完成；沒有更改audience或原火箭活動。

## 手機標題列再縮一行

使用者圖片指出主題下方空白及六掣三排佔位。低於720px的flight header改為兩排：第一排主題＋操控對象／繼續／倍速＋音效／fullscreen；第二排只放點火／分離／降落傘，三等欄。保留全部44px觸控目標，不橫向藏掣；飛行手機副題／操控前綴收起，320px用13px主題及12px操控標籤。Workshop及720px以上現有版面保持；dropdown與fullscreen marker沿用原元件，只有HTML分組及CSS重排，不改物理／動畫／模型狀態。驗證六viewport header減至約100px內、首排對齊、全部按鈕無重疊／截字、1000×長標籤、切換操控／開傘、pad轉場、可信觸控及fullscreen。

縮排驗證：source及解壓standalone共26個針對性browser flows通過（24 layout及2組裝／點火／助推器和級間分離／回工廠）；runtime／HTTP errors為零。新版layout另檢查手機首排五個次要／系統操作與標題對齊、三個主要動作同第二排、1000×不截字、shared fullscreen row marker切換不改高度、390手機及1280桌面真實fullscreen內選倍率及切換操控。所有按鈕至少44px、無重疊，Control Panel首項仍為flightControls。

Header實測：320px為97px、375／390手機為98px（原147px），844橫屏仍99px、1280桌面仍52px，workshop保持52px；並已目視320及390截圖。Package contract、JS syntax及check:tests通過，registry仍301 entries；本次純HTML/CSS重排，沒有重跑無關物理／音效／塌傘整套測試。原481 protected files hash不變。實體Safari／手機未驗證。報告`output/playwright/rocket-side-booster-lab/explorer-compact-header-layout-report.json`及`assembly-report.json`；console在`output/reports/rocket-explorer-compact-header-*`。

手機縮排已發佈至同一owner-private Site：runtime commit `abdfe295f2eabb74d9839b8597df528f5b5848e3`，Site source commit `de7aa550c2f5450a1895b494378c376d639d5345`；deployment `appgdep_6aefd2f9369481919f9b81189d0d4466`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_2241ab41141c8191902366d997a03e87`，server回傳 succeeded（2026-11-08T01:40:16.197079+00:00）。原網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。

Committed selection-preview base `4956bfe7431e816bf3ac966ea93aee03bfb6bafc` → `abdfe295f2eabb74d9839b8597df528f5b5848e3`，在`output/reports/rocket-explorer-compact-header-selection.json`。Ordered runtime SHA-256 `b384b50af23ab741e73b0c1887ae8ca7948bd58def039183a7aaf60f2bdd75ed`；standalone ZIP471 entries／15,982,090 bytes，SHA-256 `d199b38498c8636f605123e7755f7bc78950874c8ecb4868f387799d701fd0df`。source／解壓ZIP／Site471檔一致。實際browser報告為`output/playwright/rocket-side-booster-lab/explorer-compact-header-layout-report.json`及`explorer-compact-header-assembly-report.json`。

## iPad Safari 橫屏鏡頭控制

使用者回報iPad Safari橫屏看不到左下角全景／軌道，直屏可見。先補iPad 1024／1194／1366橫直轉向、觸控hit-test及可視範圍短於layout viewport的遮擋fixture；本機無實體iPad／Safari，不把Chromium尺寸測試當作實機重現。Apple viewport文件亦指出layout與visible area可不同，作為相容性設計依據。

範圍：以未縮放的visualViewport／window尺寸約束app實際高度，監聽轉向／resize／fullscreen；保留pinch zoom時原layout尺寸。將鏡頭footer放回實際stage內的定位層，清楚在canvas上方及safe-area之內，不新增操作列高度、不更改頂欄或主控制。全景／軌道持續顯示可觸控；原模型／音效／降落傘／探索狀態及SCORM N/A維持。測試原生觸控切換、orientation同頁resize、viewport縮短／恢復、放大不重排、全螢幕、source與standalone及package／registry，保護原481檔。

根因及修正：shared/styles.css 的 `.sim-app{min-height:100vh}` 令app即使設定較小的可見高度也仍被撐到layout viewport底部；本模擬覆寫min-height為0。可見viewport fixture在修正前的全景掣y=715–759，而可見下界640；這是受控重現，不能確認使用者裝置的唯一成因。App高度與visualViewport同步，pinch-only縮放不重排；真正layout尺寸改變時仍更新。Footer改放stage內並保留44px觸控及safe-area。相容性依據：[Apple viewport文件](https://developer.apple.com/library/archive/documentation/AppleApplications/Reference/SafariWebContent/UsingtheViewport/UsingtheViewport.html)。

驗證完成：source及解壓standalone共50 browser flows通過（26 cameras＋24 layout）。鏡頭檢查涵蓋1024×768、1194×834、1366×1024、1024×600及各自直屏、同頁轉向、真實fullscreen進出、640／700／768可見高度變更、pinch不重排及zoom時layout轉向更新；全景／軌道／跟隨全部44px或以上且通過elementFromPoint與原生touch切換，模型JSON不變。640px可見下界時全景掣移至y=587–631。既有手機緊湊頂欄、切換操控、開傘、倍率及fullscreen選單layout仍通過，console／HTTP errors為零。已目視1024×768可見640及1194×834截圖。Package contract、兩份JS syntax、check:tests通過（301 entries）；原481 protected hashes不變。沒有重跑無關物理／音效套件，實體iPad Safari未驗證。報告在output/playwright/rocket-side-booster-lab/explorer-ipad-cameras-report.json、explorer-ipad-layout-report.json；console及registry／package證據為output/reports/rocket-explorer-ipad-*。

已部署至同一owner-private Site，runtime commit `3a77d236eb11cbfcba01796a5f62ecef3db4d06d`，Site source commit `52a51b99406c0cb2922c85592743cc3459e32915`；deployment `appgdep_6aefd808ad3c8191927807760efc7c69`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_e8e53a45ac748191ae9dbfae7722b850`，server回傳 succeeded（2026-11-08T02:01:51.816376+00:00）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Ordered runtime SHA-256 `65b7a1332e665afd70db2f3f9f79963d41dd875dafaaba5999c1963b08a27167`；ZIP471 entries／15982463 bytes，SHA-256 `3311bca268561972f514f64e4c372eeea51c45ec4db2ae933cc3694aa84d90e7`。source／解壓ZIP／Site471檔一致。Committed selection-preview base `2fd61952f3d75db20ccc955431f04c2bbf22d14d` → `3a77d236eb11cbfcba01796a5f62ecef3db4d06d`，在output/reports/rocket-explorer-ipad-selection.json；預覽不是全庫執行證據。實體iPad Safari仍待使用者驗證。

## 開傘後開放全部倍率

使用者要求降落傘打開後所有既有倍率1／5／10／20／100／1000×均可用。從drogue-opening到main四種實際展傘階段開放1000×上限；只待命而未開傘維持原一般飛行20×限制。修正共用warpLimit及advanceFrame的大氣邊界限步，UI沿用同一規則並更新選單說明／狀態文字；不改積分器精度、每frame800步預算、觸地判定或傘動畫。測試各傘階段／倍率、未開傘／大氣邊界原限制、正常速率對照、高倍率觸地停止，以及手機／桌面原生選倍率與實際下降、source／standalone closure、原481檔。純探索的rubric／LMS／submission仍N/A。

開傘倍率驗證：runtime測試24種phase／rate組合（四種傘階段×六倍率），以同等細步1×積分作對照；只待命仍20×，另一級燃燒／自動離軌不阻止已開傘的1000×。800步預算仍生效，100／1000×觸地後速度零、貼地、停止計時。原一般發射／真空／120km下降邊界與terminal-capsule/live-upper測試保留通過。Runtime、recovery、expansion、browser/package contract四個Node檔通過，JS syntax及check:tests通過（301 entries）。

Source／解壓standalone共4 browser flows（390×844及1024×768），可信觸控選六倍率、四傘階段全部可選；100×及1000×實際t推進，選定值不被重設，1000×下降至landed並停止，速度0／surface clearance約0。無runtime／HTTP errors。已目視390px的1000×下降截圖。報告output/playwright/rocket-side-booster-lab/explorer-chute-warp-report.json，console在output/reports/rocket-explorer-chute-warp-*；原481 protected hashes不變。沒有重跑無關排版／音效／鏡頭套件，實體iPad Safari未驗證。

已發佈至同一owner-private Site，runtime commit `da339e5e54fcf0ee2d9e1ca1a465e02e1a2fd864`；Site source commit `927c0d4c2d6679ca2873fe6482f1b66e5c0a31e2`。Deployment `appgdep_6aefd9d7ffc4819198ccd372e2d62c7a`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_076a48dcb4bc819197ebcdb8faef9d9f`，server回傳 succeeded（2026-11-08T02:09:35.662838+00:00）。原網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Ordered runtime SHA-256 `d18f1df004891c2ca89f294d5bfcd057b1e35cae667ad9ca1de0a41a3e2ae614`，ZIP471 entries／15982524 bytes，SHA-256 `f475f9e1ee72441224e0256d08b4a1883debbe1b8c90872255d154207123dd75`。Source／解壓ZIP／Site471檔一致。Committed selection-preview base `1c17610d1e28e2e5c6518e55c615fc65c0705fc4` → `da339e5e54fcf0ee2d9e1ca1a465e02e1a2fd864`，在output/reports/rocket-explorer-chute-warp-selection.json；預覽不是全庫執行證據。

## 輕量海面與陸地材質

依使用者要求實作輕微自然波紋／柔和反光及陸地色差，完成commit及原Sites部署。沿用現有groundLight／terrainLighting，單一128px可平鋪程式生成法線／色差貼圖供地球海面、regional、global、contact共用；以統一地表座標、旋轉與光源維持接縫一致。只改受光及色彩，不改幾何高度／物理水面／碰撞／貼地。波紋按實際秒推進，暫停／背景／reduced-motion時停止；不隨倍速加快。像素足跡淡出遠處細節，既有quality降級減少／關閉細節。無反射場景額外pass、無shadow map／後處理／新依賴；貼圖含mipmaps約86KiB。陸地保留既有坡面光照，低對比色差以地表座標平滑分布。

驗證決策：source及standalone渲染shader編譯、海岸／近地contact與regional／global切換、全景／軌道、iPad橫直尺寸；可信鏡頭觸控、畫質降級、暫停／減少動態／倍速時鐘、context恢復、模型JSON不變；同視角效果開關對照與draw calls／triangles／texture預算。CPU／GPU耗時只記本機Chromium觀察，不聲稱真實iPad效能。Package／registry／原481檔保護；評核／SCORM及rubric N/A。

材質驗證完成：source及解壓standalone共20 flows（1024×768／768×1024各海面20m、海岸1500m、陸地1200m、高空200km共16；4組時鐘／品質／鏡頭檢查）。Shader均編譯成功，runtime／HTTP／console errors為零。160×120離屏對照中海面有約4000 pixels隨8秒時間變化，高空movingPixels=0；contact海面開關平均RGB差約3.7–3.9/255，沒有大面積硬邊色塊。效果開關draw calls／triangles完全一致，沒有額外reflection pass；128²RGBA貼圖65536 bytes，連mip約87381 bytes，另有每vertex4bytes的水陸遮罩。

波紋實秒時鐘0.5秒測試、pause／document.hidden／reduced-motion停止、quality2細節0及停止時鐘、1000秒無縫週期wrap通過；物理JSON不變。原生觸控全景／軌道／跟隨，以及兩次真實WebGL context loss／restore後重編譯均通過。已目視橫屏海面前後對照及陸地／海岸截圖；色差及反光採低對比，沒有改幾何／水面碰撞。Art／package contract兩個Node檔、六個JS syntax及check:tests通過（301 entries）；原481 protected hashes不變。

報告output/playwright/rocket-side-booster-lab/explorer-surface-report.json，截圖同目錄surface前綴；console／Node／registry在output/reports/rocket-explorer-surface-*。renderReadbackMs包括首次shader編譯及SwiftShader讀回，並非穩態FPS或iPad效能benchmark；實體iPad Safari未驗證，無關物理／音效套件未重跑。

材質更新已部署至原owner-private Site。Runtime commit `19b90bd3ed2904dbbbc17d786ae2ab6e80e6941b`，Site source commit `eb12758a26cb621bfaef27e1efd0e529bfbaf8b5`；deployment `appgdep_6aefe13a5664819190ca43041c9cc880`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_4b569972305c8191872e80733d3ec719`，server回傳 succeeded（2026-11-08T02:41:05.297500+00:00）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Ordered runtime SHA-256 `1304813e64f5b0f96be1c1c6056633a327139c5c4b34ce8e460383ec02ae459a`，standalone ZIP471 entries／15984009 bytes，SHA-256 `e2d1c98168f34e7a8839467b5392da9be1148b6c912752770953b452cb69895f`。Source／解壓ZIP／Site471檔一致。Committed selection-preview base `0b7f3eab9b92d4d9faa3a4992ecc5f489b18991b` → `19b90bd3ed2904dbbbc17d786ae2ab6e80e6941b`，在output/reports/rocket-explorer-surface-selection.json；非全庫執行證據。

## 太空艙觸地傾側與水面浮沉

使用者要求按觸地運動呈現傾側／翻側及落水浮沉。保留現有安全着陸normal≤6／tangent≤5與高速撞毀；觸地資料增加有號橫向速度及局部坡度。共用recovery提供解析、阻尼式着陸姿態：低側速搖晃回穩，較高側速及坡度可向慣性方向側倒；水面先入水下沉再小幅浮沉／搖擺。此為觸地後簡化被動姿態收尾，飛行位置／速度仍按現有終止契約停止，不增加通用剛體／流體求解器。

Scene沿用既有hull支撐及降落傘landing wall-clock：首幀連續、陸地不穿地、水面允許合理浸水；降落傘反向補償艙身旋轉並用實際地表平面夾限，水波圈保持水平及漸淡。切換操控攜帶着陸動畫狀態；reduced-motion縮短收尾並關閉持續浮沉，背景不推進；海上穩定後只近景且最多30Hz重畫。純探索，SCORM／rubric／submission N/A。驗證解析姿態方向／幅度／時間連續、真實接觸資料、左右側速／坡地／落水、30／60FPS、切換操控、降落傘／地面接觸、撞毀維持、source／standalone／package／registry及原481檔；實體iPad性能不作已驗證聲稱。

觸地姿態驗證完成：recovery／runtime／browser-package contract三個Node檔、三份JS syntax及check:tests通過（301 entries）。解析姿態覆蓋正負側速0／0.3／4.5m/s、逐幀連續、陸地回穩／翻側、坡面法線、水面浸水及持續小幅浮沉、reduced-motion靜止；模型JSON不變。真實觸地保存有號lateral／slope，normal及tangent的安全判定原值不變。

Source／解壓standalone共28 browser flows：20 landing（390×844／30FPS及1024×768／60FPS，每個低側速、左／右側速、海上及高速撞毀）＋8既有parachute。首幀附加angle／heave為0；landed hull不穿接觸平面，左右方向正確；海上約0.48m浸水並繼續浮沉。切換操控保存同一motion物件／age，降落傘cloth／rope維持地表上方，30／60FPS及source／standalone最終pose一致。高速側速仍impact及一次爆炸，沒有floating motion。持續浮沉不超過30次draw／秒，reduced-motion .45秒後不再重畫；原有5.5秒塌傘、reduced-motion淡出、30／60FPS幾何一致及首幀連續檢查通過。

Runtime／HTTP／console errors為零。已目視390px左右側倒及海上收傘截圖。測試中間幀保留CPU姿態／布面更新、暫停GPU提交，關鍵階段真正render與截圖；不能用這些測試推論實體iPad幀率。報告output/playwright/rocket-side-booster-lab/explorer-landing-report.json、explorer-landing-parachute-report.json；console及Node／registry為output/reports/rocket-explorer-landing-*。原481 protected hashes不變，無新增依賴／runtime檔，standalone仍471檔。未跑無關海面／音效全套，實體iPad Safari未驗證；本次是基於觸地條件的輕量姿態／浮沉收尾，不是完整剛體／流體求解。

着陸姿態更新已部署至原owner-private Site。Runtime commit `b0b6560ec8538d18548c29214ff13bb8af719fcd`，Site source commit `76fdd4f6b25fa0c74b7b1c69e3c7a61776e8cbf9`；deployment `appgdep_6aefebdbb5fc8191b52831d726535bd9`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_a7c10a7b4d48819188bd5349c03436e5`，server回傳 succeeded（2026-11-08T03:26:26.106560+00:00）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Ordered runtime SHA-256 `19560152a64e1ddcd0b74c90fbf4e92baa86bb9e5660e6dec4004b6d3c90f6d6`，standalone ZIP471 entries／15985396 bytes，SHA-256 `d258b6c836c5d96af291446c01d3481ddf98a7836fa277eb52108ad3104ff661`。Source／解壓ZIP／Site471檔一致。Committed selection-preview base `09788d35bc59db81b39c8b57e93172e001ca686c` → `b0b6560ec8538d18548c29214ff13bb8af719fcd`，在output/reports/rocket-explorer-landing-selection.json；非全庫執行證據。

## 視覺座標、比例及接地穩定性修正

依[專項計劃](42-rocket-explorer-visual-consistency.md)修正：固定地球／二維物理的地形方向一致，取消未配套的時間自轉；所有跟隨飛船及分離一級同尺度，鏡頭按物體尺寸／FOV／aspect平滑構圖；接地焦點獨立於艙身側倒／浮沉，另一飛船亦不跟着漂移；防穿地不改用戶pitch。撞地速度真正歸零，HUD讀模型值。保留原傘、返航、熱防護、海面材質、版面及原481檔；不加入SCORM／評分。

Runtime commit `880585a80738cdf82d29bf8469d0ad193d3d00ca`。9個Node/package檔、check／registry通過；source及standalone各102、合計204 flows以續跑組合報告完成，不是一條完整命令一次通過。舊warp等待條件曾把提早安全着陸判成逾時，修正fixture／等待後重跑及完成其餘打包版檢查。相同runtime hash下覆蓋480個高度／配置樣本、20組陸地／海上接地後各倍率及原完整飛行／返航／鏡頭／材質／觸控檢查；地標、接地鏡頭及另一飛船位移最大0。另16張高度／HUD畫面核對通過。報告 `output/playwright/rocket-side-booster-lab/explorer-visual-report.json` 及 `explorer-visual-photos-report.json`，明列partial與續跑來源。實體iPad Safari、裝置FPS及完整剛體物理未驗證，沒有全庫測試聲稱。

原Site已部署成功，權限不變。Site source `d91ea7b9d2af2df8b3f0864754f78295c36d71ec`，deployment `appgdep_6af0016cd8788191bc82890f396ff15b`，version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_665cf8fdb8048191a51ed9ec624fa271`，succeeded於2026-11-08T04:58:27.402379+00:00。Ordered runtime SHA-256 `4387ae26a52fabd5e8d6fb4ddfca4015002f4975d0e72636211482373dbec290`；471檔、ZIP15985549 bytes，SHA-256 `70f6e196e5fb3047a8487ce565c18499684a205b4faf0138e61a00e4cb312677`。Source／ZIP／Site檔案一致，原481 hashes不變。Committed selection-preview `0c0ffdb`→`880585a` 在output/reports/rocket-explorer-visual-selection.json。

## 軌道畫面及單行軌道讀數

使用者要求移除重疊飛船的太空艙／二級名稱標籤，保留模型、軌道路徑及操控選單。刪除marker DOM、定位更新及專用CSS。近／遠地點各為固定位置的單行色框，名稱11px、數值預設14px；時間獨立固定寬度，避免長數字擠走軌道框。以實際文字寬度只縮小溢出的數值，內容／框寬未變不重測，ResizeObserver覆蓋轉向／fullscreen尺寸變更；完整數字保留，不用省略號或改變物理值。範圍僅index／styles／main及既有browser owner；SCORM、rubric、snapshot N/A。驗證source／ZIP六種viewport的單行、一般／極長／着陸／非束縛讀數、縮小後恢復、orbit／plane與body切換無marker、resize／fullscreen；原471 runtime closure及481 protected files不變。

Source／解壓standalone各6、共12 flows通過：320×568、390×844、844×390、768×1024、1024×768、1280×800。一般、極長apo／604800秒、負近地點、非束縛、着陸及恢復正常讀數均不換行／截字，色框左右位置及寬度固定；縮字後恢復、兩種軌道視角、body切換、同頁resize往返及390／1024 fullscreen通過。Readout fitting按目前字形與浮點框寬計算，不先重設字號，框尺寸觀察器涵蓋細分像素變更；browser驗收等候ResizeObserver排版完成。Bar最高33px；runtime／HTTP／console errors為0。已目視390正常及320極長讀數。報告output/playwright/rocket-side-booster-lab/explorer-readouts-report.json，console／package／registry在output/reports/rocket-explorer-readouts-*。Package contract、JS syntax及check:tests（301 entries）通過，原481檔不變。沒有重跑無關飛行物理全套，實體iPad Safari未驗證。

已commit及部署原owner-private Site，權限不變。Runtime commit `d44da3918792b0384a2cc5fb1dc3f9c492ee9657`，Site source `a4eb598187a39d62bcb519f9e4acd75b7d1512fd`；deployment `appgdep_6af00dcc79408191a0507b9db7c9a585`／version `appgprj_6aeca66555b481919803e437687c4fa8~appgver_a3465cacbfbc819188bee5b8beafdf90`，server回傳 succeeded（2026-11-08T05:51:16.260663+00:00）。網址 https://simlab-rocket-side-booster.ieyp.chatgpt.site 。Source／ZIP／Site471 runtime檔一致；ordered SHA-256 `8abdde58b36e0db7ffdb7473e3687566af9be7515f70836c4ae623fdc105f145`。ZIP471 entries／15985686 bytes，SHA-256 `ad26964872915a91f4965f0dac7915ae9d8e8302f34cfafcab082cc6aff2e5ec`。Committed selection-preview `2a864b3`→`d44da39` 在output/reports/rocket-explorer-readouts-selection.json；非全庫測試證據。
