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
