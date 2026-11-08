# 小小航天家：火箭升空與返航

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
