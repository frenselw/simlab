# 2026-10-27 iPad 全螢幕倍速選單維護

## 後續：觸控失焦修正（本輪）

- 使用者要求提交及推送後，實作／回歸／共用防回彈與驗證記錄已commit `c911515d0a25b7ff28caa38b110ad4b0e6073ff8`。committed selection-preview：`output/rocket/selection-ipad-touch-fix.json`，base `0fc1d30922de42aeb7a9ad3ec3efdd24972c89c5` → 該commit，full／packages=all／279 entries；這只是選取預覽，不表示全庫已執行或CI已通過。使用者指定交付檔名繼續為`output/rocket-space-mission-lab-scorm.zip`，其內容與下列最終hash一致。以下「未commit」字樣記錄的是當時執行驗證的歷史狀態。
- 後續實機回報：桌面可選倍率，iPad完全揀唔到，上一版不能視為iPad成功。新風險：選項開啟時無條件focus目前倍率，而focusout的relatedTarget=null即關閉；WebKit點按button可先清焦、再click，會隱藏尚待點擊的選項。修正決定：只於鍵盤開啟時移焦、null目標不當成已離開選項；保留明確外點、外部焦點、Esc、blur／resize／模式切換關閉。不攔截整頁觸控、不在pointerdown即提交倍率。
- 補驗決定：沿用rocket browser owner，加入可重現的null-relatedTarget／touch下清焦序列、普通及fullscreen下paused／running選倍率、鍵盤離開／外點與鎖定；另外用已安裝的Playwright WebKit作source／extracted ZIP引擎診斷。WebKit桌面測試仍不取代真iPad複驗。評分／物理／phase／snapshot／SCORM及runtime依賴沿用下列範圍，無新runtime檔案。
- 已在實際WebKit引擎、hasTouch/mobile／1024×768下，用production組裝及發射台UI重現：tap 5×的pointerdown之後，1×先focusout（relatedTarget=null），原handler關閉選項，最後click目標變成controlsPane，值保持1。修正後同樣操作click正確落在5×，值為5。before／after：`output/rocket/ipad-warp-focus-before.json`、`output/rocket/ipad-warp-focus-after.json`。
- WebKit source／真解壓ZIP、390×844／1024×768／1280×800共6 cases通過：全部五種倍率的重複可信tap、真實null焦點事件、暫停state／LMS不變、運行中1／5×續飛、鍵盤焦點與外點關閉；報告`output/rocket/ipad-warp-webkit-touch-report.json`，completed=true／errors=[]。使用預裝webkit-2336，UA Version/26.6 Safari；此自動化context沒有fullscreen API，因此只代表WebKit普通顯示觸控成功，未冒充WebKit原生fullscreen／真iPad驗收。Playwright CLI預設要求未安裝的2368，改用公開config指定已裝2336，無下載或新增repo依賴；CLI及兩個自建server已關閉。
- 已註冊rocket owner的`--warp-fullscreen-only`重跑source／ZIP共10 flows、0 JS errors：四尺寸原生Chrome fullscreen，補null-relatedTarget及pointerdown清焦後click的合法續做，仍覆蓋倍率限制、slow-frame、running／paused、review／pending、鍵盤外移及外點；`output/rocket/ipad-warp-focus-chrome-report.json`。lifecycle Node、check、279-entry registry、syntax、文件連結及diff通過；沒有全庫或大型owner全跑。WebKit診斷為補充證據，永久回歸留在既有registered owner。未commit，無committed selection-preview。
- 最終ZIP 15,817,440 bytes、474 entries逐byte等於來源，SHA-256 `87ef1a04a9a30a74db66da2b7a26763032d362f3ba1a37697f9ec096dc1651ff`，runtimeHash `70109a446d28e02531c97d9278c2f928d5801fcce607678899635b90d06cd7ff`。canonical包及方便分辨的新檔`output/rocket-space-mission-lab-ipad-touch-fix-scorm.zip`完全相同，核對報告`output/rocket/ipad-warp-focus-package-verification.json`。沒有更新Moodle／Sites。
- 本輪修的是倍速選項觸控回歸；iPad下拉退出原生全螢幕仍未解決，亦未新增播放器嵌入模式。真iPad的新ZIP仍待使用者複驗。

## 第一輪：頁內按鈕取代原生選單（歷史證據）

- 使用者回報全螢幕點選1×／5×即退出。既有原生select可能喚起系統picker；上輪共用overscroll防護不涵蓋此路徑，不能宣稱已解決。
- 將火箭倍速換為fullscreen target內的普通button及非模態選項區，沒有原生select／dialog／另開視窗。保留1／5／20／100／1000×、低空／燃燒最多5×、下降跨門檻及實際倍率顯示；不自動重新要求fullscreen。
- 本次只改顯示／輸入層；低風險評核、rubric、physics、phase/variant、權威snapshot schema4、保存／重試與SCORM契約全部沿用。倍率仍為非持續的顯示控制；無新增依賴或manifest項目。
- 選項觸控區至少44px；目前倍率可讀，支援鍵盤Tab／Enter／Escape、選定狀態與disabled理由。選項必須在320×500、390×844、1024×768與desktop內可見，不因展開而壓縮面板；選取、點外面、模式切換及resize會關閉。
- 沿用rocket browser owner，加入source／extracted ZIP真fullscreen trusted touch選取1×／5×及真空高倍率、選項邊界、取消、readonly鎖定／切換；保留原slow-frame／高倍率限制回歸及lifecycle Node。靜態check／registry／diff，重建火箭ZIP並核對來源。未驗真iPad／Moodle不得宣稱已治癒其原生fullscreen問題。
- 驗證完成：`node tools/rocket-space-mission-browser-regression.js --warp-fullscreen-only` 在Chrome156／SwiftShader、source及真解壓ZIP通過10 flows、0 JS errors。其中8 cases涵蓋320×500、390×844、1024×768、1280×800：可信觸控開啟／選1×及5×、飛行中轉倍率維持running及fullscreen、合法真空草稿選20／100／1000×、選項全在viewport及≥44px／未被遮擋、鍵盤Enter／Escape、外點／resize關閉、review／pending鎖定及明確退出。暫停選倍率時state／stage／LMS逐項不變。其餘2 flows重驗slow-frame實際倍率、點火自動降至5×、停機重開高倍率、低空禁用高倍率及控制欄尺寸。
- 測試整修記錄：最初CDP 5s transport timeout，改用與其他runner一致的15s並加入operation診斷；其後兩個測試自身問題為動態selector引號及在四次tap後錯要求六個click，均修正至正確語法／四個可信tap及明確目標集合，沒有放寬產品行為斷言。最後上述10 flows完整重跑成功。既有camera/warp修訂測試也改從production按鈕選取，不再派發舊select input/change。
- 七組rocket Node全部通過；`npm run check`、279-entry registry、main／browser語法及diff通過。沿用既有registered owner，未新增入口，未跑全庫或完整大型rocket owner。尚未commit／無committed selection-preview。
- 最後SCORM ZIP 15,817,324 bytes、474 entries與現行source逐byte相符；SHA-256 `382db0316bf1005b252a15496785eccc7e63dc71fe3d96506f854d073ebeae63`。包含本輪UI及上輪共用防回彈的未提交修正；報告基準HEAD不是已提交的最後runtime。證據：`output/rocket/ipad-warp-browser-report.json`、`output/rocket/ipad-warp-package-verification.json`；包為`output/rocket-space-mission-lab-scorm.zip`。
- 只替換火箭倍速；其他活動的native selects未改。Moodle／Sites未更新，真iPad原回報仍待實機確認。共用回彈修正的獨立失敗／限制沿用[維護紀錄](ipad-fullscreen-scroll-maintenance.md)，不以本輪火箭成功冒充全庫或真機通過。

# 2026-10-27 P57 兩位獨立branch reviewer覆核及修正

- 使用者明確要求兩個subagents獨立平行審核整個branch並跟進；安全著陸/傾倒繼續擱置。Round1基準1ef4bdf4fd696b4a12c37f7c1bedfe6d6f96849d，目標79976bf967fcae241495129411833ae170b3bed7。兩位各自審閱完整新增/改動與相連呼叫點，無共享初次結論，無修改來源。
- 兩位均確認同兩項P2：R1高倍速一幀跨入120km以下仍用原高倍速，合法下落會由120.4km在0.2s前景幀直撞地；R2共用手機scroll profiles依賴已刪T.raised/T.escaped、變軌phase、第二record、舊activity ID與不存在按鈕。
- 基準七組rocket Node+279-entry registry全通過，顯示兩項邊界缺測。修正只限ui-runtime分步倍速與lifecycle test，共用mobile-scroll profiles/operations及其既有Node/browser owner；保留總800積分步、剩餘真實時間與actual rate，來源profile使用現行P.ACTIVITY與合法單record草稿，standalone改真實組裝/發射按鈕。
- 補R1真production高空下落跨門檻及總預算回歸；R2每份profile production codec roundtrip與合法check/return續做，實際source/package宿主還原及standalone當前按鈕/中央camera ownership。只跑關聯測試，不跑全部大型rocket browser owner。
- 審核輪次上限規則：Round1完整；後續可集中修正與相連範圍，若超過三輪，Round4起僅審上輪後改動及其直接影響。沒有以新輪名重設計數。

- 審核完成三輪：Round2兩位確認R1/R2關閉，B再發現P3未點火fixture phase誤留ascent；36a1e8d兩行修正及phase/status/unlit斷言，Round3兩位獨立核對delta、codec/check-return/點火升空續做並關閉P3，無未處理已確認事項。完整紀錄見[branch審核與跟進](../docs/rocket-branch-review-2026-10-27.md)。
- 必要驗證：修正後lifecycle、shared mobile Node及279-entry registry通過；390×844 source/package camera操作、package pad、standalone pad/ascent/submitted共6個browser cases通過且0 JS errors。未跑無關全套browser；真手機/實際Moodle未驗。
- 修正已commit/push cad160a、36a1e8d；已提交版本selection-preview output/rocket/selection-p57.json。實測runtimeHash=7765f8fce670ab66f96c657ad148a1127a3f2a188c7ef9d9eb76bf1ddb5b0c25，ZIP=dec9720ab0196889475809257e73a5f24b894d55346dc280afba2c0f0470655e，474 entries逐一符合dist，保留schema4/150kg。
- 原Site來源92d243612defa344642e8d0902fed47c963f73ea，版本55，deployment appgdep_6ae0802d6c8c8191a1d4176065c09ba6 native succeeded於18:43 UTC+08。受眾保持owner-private 1 user/0 groups/0 external；線上8份關鍵檔案符合實測dist，output/rocket/p57-live-verification.json completed=true。安全著陸/傾倒仍擱置。

# 2026-10-27 P56 刪除示意河道及釐清觸地規則

- 使用者要求刪除發射場示意河，另詢問低速觸地是否爆炸。只刪河道shader/2KB路徑查表與供應端、離線示意河筆觸及相關測試預期；保留槽口裁切。觸地規則只讀取/小型assert確認，不改physics、碰撞、rubric、schema4或SCORM。
- 現行model飛行再觸地直接impact且關機，無速度門檻；status=pad例外。scene由flying→impact觸發特效，無安全落地或碰撞後傾倒模擬，歷史impact還原不重播。
- 必要驗收僅--no-river-only：source/實際SCORM桌面與手機、0/3800m地面shader無河道/查表、原河位固定鏡頭無藍帶及河岸；槽口仍啟用、無shader errors及預算。Node只自檢接近零速/零速觸地與pad例外，不跑無關全套；沿用registry及committed selection-preview。原網站同受眾發布，真手機/Moodle未驗。

- --no-river-only source/實際SCORM desktop1280×800及phone390×844共4 flows、0 JS errors，output/rocket/p56-browser-report.json completed=true；runtimeHash=dfecb6f894702451813f2f7dd69e46c481b791c93e9ac58f0439c46b7e3e2b2e。原河位固定鏡頭blue pixels均0，river=false且無River查表；排焰槽uLaunchCut仍1，shader無錯。已檢視封裝手機截圖。43 calls/48771–61571 triangles，維持預算。
- 小型Node assert確認：flying在地面初速0/.01m/s，step後status均impact（實際接觸速度約2.3e-11/.01000000002m/s）；原pad靜止step仍pad。沒有修改model或爆炸/傾倒邏輯，現行無安全著陸/傾倒狀態。279-entry registry通過，不跑無關全套。

- 實作已commit/push 534b8220dec147684378fa3c8002d4646166b30b；affected預覽output/rocket/selection-p56.json（99d8510→534b822，僅預覽）。實測ZIP的474 entries/runtime核對dist，SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=ce223896bac460de76f5ccc0b9425c35ab4b51d5d5024d7ed50979dcc4d2a578。
- 官方Sites來源187c86b29f84c2bd3426b28dec98adafc399968c，archive output/rocket/rocket-no-river-p56.tar.gz。原網站版本54，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_536b539317dc8191a1f93544de093e24，deployment=appgdep_6ae06b2c305c8191b256217d53db058a，native succeeded於2026-10-27 17:13:23 UTC+08。原網址與owner-private受眾保持，1 user/0 groups/0 external。
- output/rocket/p56-live-verification.json核對scene/scene-art/contact-ground、入口、main及build-info共7份線上檔案，符合實測dist；原網站已開啟，測試瀏覽器及preview已關閉。真手機GPU/實際Moodle未驗，觸地規則維持原樣。

# 2026-10-27 P55 收臂、下沉排焰通道、蒸氣與連續河道

- 使用者批准四項修正並沿用必要測試。範圍scene/scene-art/contact-ground及既有browser owner專項；沿用現有依賴、renderer/動畫循環。無飛行physics、rubric、schema4、150kg或SCORM格式修改。
- 收臂使用短效視覺時間及ease-out，不由pad/flying硬切；暫停/失焦/圖像故障不推進，還原途中飛行直接收起，重新試飛復位。固定32個軟邊billboard煙團池，沿槽入口/出口產生並消散，不跟火箭走。
- 排焰通道有底、側壁、斜板與出口；所有會覆蓋該局部的地面與平台共用槽口裁切，保持中央支承面及既有接地基準。視為發射台內部設施，不改全球地形碰撞。
- 河道先以隱藏河岸/地面的固定鏡頭對照確認干涉；移除重疊短帶，改由各地面層共用同一細小路徑查表直接著色河水與兩側河岸，無共面水面爭深度，延續至上下游。保留3D地形；不新增大貼圖或逐像素長路徑迴圈。
- 必要驗收僅收臂起/中/末、暫停/倍速/還原/重開，槽口正斜視及封底、煙生成/消散/資源不增長、河道對照/連續/跨地面層、desktop/phone source+SCORM shader與<=100 calls/100000 triangles；沿用已註冊owner及selection-preview，不跑無關評分/飛行全套。真手機/Moodle另列未驗。

- 修改前固定鏡頭對照output/rocket/p55-river-before.json：all藍色像素792、隱藏bank後1550、只留water及照明1544；確認河岸重疊為主要缺口來源。新河水/岸直接共用地面shader，2KB 512×1 RGBA查表，按單調北向點接續原路徑，範圍-9200至39895m；無重疊短帶。
- 最終--launch-site-only source/實際SCORM各desktop1280×800及phone390×844，共4 flows、0 JS errors，output/rocket/p55-browser-report.json completed=true；runtimeHash=a8574738f6a3b5c8b8ce6fd8a23baaf3cbc60dd46373b2730e69247a7527b838。收臂角度逐幀單調0→90°，20s物理時間跳進不改視覺角度，暫停角度/煙團不變；還原飛行直接收起、返工廠復位。32池內實測24煙團，停止後0。
- 槽底深2.7m；同一鏡頭把槽底暫標紅，開裁切見754 pixels、關裁切0，確認底板真正露出；槽中央0露底magenta、shader無錯。煙霧貼圖軟邊及密度經畫面檢視調整，已檢視手機/桌面煙霧、槽及連續河道。河道3張同姿態畫面0差異、743藍色pixels，重疊strip數0。
- 測試未一次排隊數十張SwiftShader全畫面：動畫數值階段暫停GPU render，只繪驗收幀，避免5s screenshot timeout。最終85 calls、60817–73617 triangles，保持100/100000內；279-entry registry通過。不跑無關計分/物理全套，真手機GPU/Moodle未驗。

- 實作已commit/push cab62a0c02d8374da7dfc74c9f19e1c0b25c69b2；affected預覽output/rocket/selection-p55.json（41ed9e3→cab62a0，僅預覽）。實測ZIP的474 entries/runtime核對dist，SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=2f208763c256267a8db38aac655d7935c65836ed6bf2f62b8bac8b3b4f555583。
- 官方Sites來源61d4dd22c3f40d8aba33e4155df2920ae8c83e06，archive output/rocket/rocket-launch-effects-p55.tar.gz。原網站版本53，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_38638eb9486881919edb3909744a2f27，deployment=appgdep_6ae05ed02f1881919129464048701b83，native succeeded於2026-10-27 16:20:40 UTC+08。原網址與owner-private受眾保持，1 user/0 groups/0 external。
- output/rocket/p55-live-verification.json核對scene/scene-art/contact-ground、入口、main及build-info共7份線上檔案，符合實測dist。原網站已開啟，測試瀏覽器及preview已關閉；真手機GPU/實際Moodle未驗。槽口為視覺設施，不改全域碰撞地形。

# 2026-10-27 P54 工廠裝配區與航天基地

- 使用者批准基地美術方案並要求測試不過量。範圍scene-art的既有pad/landscape及scene顯示條件、既有browser owner基地專項；沿用Canvas/Three批次模型，無新檔案/依賴/圖片，無physics、rubric、schema4、150kg、存檔改動。
- 工廠為開放裝配區，外圍框架、工作枱、架及推車；發射場有可配合火箭高度的服務塔、側方支臂、水塔/泵房及排焰通道。外圍重複24棟改為4組用途分明設施，連接道路、儲罐區與地形底座。中央保留組裝淨空，場景設施不加入零件拾取。
- 沿用太陽/天空補光與獨立factory照明；模型共用材質及InstancedMesh，簡單接觸陰影，不加動態shadow/postprocessing。factory裝配設施與launch設施分開顯示，依既有像素細節/高度淡出。
- 必要驗收僅--base-art-only：source與實際SCORM各桌面/手機，工廠/發射台/剛離地固定畫面、組裝拾取與縮放/返工廠、底座及道路有限高度/淨空、shader、draw calls<=100與triangles<=100000；遠處隱藏細節。沿用registry owner及committed selection-preview，不重跑無關物理/計分全套。真手機/Moodle未驗。

- 最終--base-art-only source/實際SCORM桌面1280×800及手機390×844共4 flows、0 JS errors，output/rocket/p54-browser-report.json completed=true；runtimeHash=d37c24932cc64b408849622ffbc9d87199300c6d4ddd424cd4ac0144f7bd6dd2。工廠45–55 calls/10510–17470 triangles，待發射82 calls/61907–74707 triangles，剛離地84 calls/61959–74759 triangles；保持100 calls/100000 triangles內。未將SwiftShader量度當真機FPS。
- 已檢視空工廠、手機待發射/升空與基地道路畫面。工廠封閉轉盤及四柱框架、排焰槽只在發射場顯示；服務塔依完整火箭高度設定，升空支臂收向側方。道路頂點有限且法線向上、4組建築底座跨地形角點、6條連接路；樹木避開設施/道路後255棵，建築最近約680m。真零件拾取/取消、縮放旋轉不改設計，60km隱藏本地設施，返回工廠顯示模式正確。
- 只重跑同一基地專項一次以驗收人工檢視修正；沒有跑無關物理/評分全套。279-entry registry通過，沿用browser owner且無新增正式test file或runtime依賴。

- 實作已commit/push dc79b43e32de40791dc5be1b683936ad66dea8ff；affected預覽output/rocket/selection-p54.json（2656801→dc79b43，僅預覽）。實測ZIP的474 entries與runtime核對dist，SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=c90b54ff7faa9a2b4ff934583d483da1e20a3d7c45559fcfd09b22c521c432d8。
- 官方Sites來源e9ffa5afc471ae827a3cc2f5a7b422cdd2d1bb99，archive output/rocket/rocket-base-art-p54.tar.gz。原網站版本52，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_4bd3b3ddf6bc819194616e22586e5550，deployment=appgdep_6ae04a59baac8191978ffcd192250930，native succeeded於2026-10-27 14:53:21 UTC+08。原網址與owner-private受眾保持，1 user/0 groups/0 external。
- output/rocket/p54-live-verification.json核對scene/scene-art、入口、main及build-info共6份線上檔案，符合實測dist。原網站已開啟，測試瀏覽器及preview已關閉。未驗真手機GPU及實際Moodle，設施為教學示意模型而非工程配置標準。

# 2026-10-27 P53 重新開始試飛與拆除全部元件

- 使用者批准修改返工廠文案並新增一按拆除。範圍index/main/styles、model單一clear-craft命令、既有interaction test及browser owner專項；不改飛行physics、rubric/schema4/150kg/SCORM流程或新增依賴。
- 重新開始試飛沿用workshop命令：清除當次飛行並返回設計，保留craft及records。新增拆除全部元件只限workshop，回復emptyCraft，保留records；空設計禁用，重設選取與焦點，沿用controller存檔/唯讀防護。這不是清除已提交結果或重開attempt。
- 必要驗收：interaction命令保留成果/不可變輸入、非法phase拒絕、production draft encode/decode與合法繼續；既有browser owner --workshop-actions-only在source/實際SCORM驗桌面/手機按鈕、空設計禁用、保存內容、還原後重砌/發射、空中與撞擊重新開始、唯讀拒絕及按鈕版面。無重跑無關飛行/美術/評分全套。
- 沿用已註冊test owner並保存registry/committed selection-preview；原網站同受眾發布。真手機/Moodle另列未驗。

- interaction.test.js與279-entry registry通過；browser --workshop-actions-only source/實際SCORM共4 flows、0 JS errors，output/rocket/p53-browser-report.json completed=true。1280×800可信mouse、320×568可信touch；拆除掣100×44px且與標題不重疊，已檢視封裝手機截圖。空中/墜毀重開保留設計及records，清空全部零件保留records，檢查production draft保存、還原重砌/發射及flight/review拒絕清空。
- runtimeHash=c58b57d9b0e8746e7e11bcf41beecb2e21a63451f9959276890838b968f0b57e。只跑本次操作專項，未重跑飛行物理、美術或計分全套。未新增依賴/正式測試檔。

- 實作已commit/push 20317d1af14e68c344238685ca4d6bfc942876dc；affected預覽output/rocket/selection-p53.json（1792f36→20317d1，僅預覽）。實測ZIP的474 entries核對dist，runtime逐檔一致；SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip，packageSha256=fe742702ee0c7e1dcc6259fda1c8e0bf3f9e0f8939f6f0524930731d196e20ec。
- 官方Sites來源841e70e1c48ccd49ec850cf61a7aed89147f9803，archive output/rocket/rocket-workshop-actions-p53.tar.gz。原網站版本51，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_09b2a8d2ae048191811141153a6d42e6，deployment=appgdep_6ae0337aa2fc8191bd282a2a04f290af，native succeeded於2026-10-27 13:15:46 UTC+08。原網址與owner-private受眾保持，1 user/0 groups/0 external。
- output/rocket/p53-live-verification.json核對入口、build-info、main/model/styles共6份線上檔案，與已驗收dist一致；憑證限same-origin且只經隱藏stdin。測試瀏覽器及preview已關閉；真手機/Moodle未驗。

# 2026-10-27 P52 全球雲系與日夜光照

- 使用者批准立即修改並限定必要測試；本次只改全球雲圖生成器、clouds.webp及資產hash、雲層shader、既有browser owner雲層專項與本文。近景立體雲、地形、鏡頭、physics、rubric、schema4、150kg及SCORM流程保持；無新依賴。
- 以離線連續密度/尺度不同的噪聲及座標扭曲取代重疊橢圓；沿用1024×512 RGBA與單一球殼，控制覆蓋率及經度接縫。雲層背光亮度隨同一太陽方向下降，保留柔和卡通輪廓。
- 必要驗收僅：生成器覆蓋率/接縫/尺寸/資產hash；既有art資產合約；既有browser owner --clouds-only於source及實際解壓SCORM驗桌面/手機全景日夜/地平線，像素檢查背光雲明顯變暗、shader及draw/triangle預算。檢查畫面後即提交/封裝/原網站發布，不重跑分離、撞擊、計分或提交流程。
- 風險為雲圖觀感與shader編譯；雲層固定一張貼圖/一個mesh，無即時噪聲或額外pass。未驗真手機GPU與Moodle；發布保持原受眾，保存committed selection-preview，無新test file。

- 最終必要驗收：生成器覆蓋率20.73%，四經度區13.41/18.22/28.11/23.19%，精確接縫與連續厚薄自檢通過；1024×512雲圖89004→45714 bytes。metadata解析比較只改clouds.webp條目，地形等資產保持。
- art.test.js及279-entry registry通過；--clouds-only於source/實際解壓SCORM共4 flows、0 JS errors，output/rocket/p52-browser-report.json completed=true。桌面1280×800/手機390×844，日面/夜面/交界/地平線共16張截圖；已檢視桌面日面與封裝手機交界。隔離雲層實際像素night/day約0.0291–0.0292，shader無錯，仍為1 mesh/1024×512；全景42 calls、86903–92023 triangles，地平線50–52 calls、30402–49913 triangles。未將SwiftShader當真機FPS證據。
- runtimeHash=0bc6d065cf38bb66bfa961f770df6c994d80fa3718754e24d06425d1d408e547。生成器初始雲系過度集中單一經度區，被原覆蓋率assert攔下；以不同空間尺度校準後才生成最終資產。最終報告只取新資產的完整成功執行，沒有採納生成前的舊圖檢查。

- 實作已commit/push 1cddfa6d3086af00a43d2b45d419c0e61fb4a8d7；affected預覽output/rocket/selection-p52.json（feb1758→1cddfa6，僅預覽）。473份runtime及474份ZIP entries核對dist，SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=59acaebf24f6e4035cfd0b55a08f2409d299f83ca1d12ba4324cd6435044e3a6。
- 官方Sites來源9511e6009dd4f7cdd22afb49a440ea7f5397939a，archive output/rocket/rocket-clouds-p52.tar.gz；原網站版本50，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_7152e9b3a6d08191b5da722b527f95a0，deployment=appgdep_6ae01dacbd208191a6e6b47986998778，native succeeded於2026-10-27 11:42:46 UTC+08。原網址與owner-private受眾保持，1 user/0 groups/0 external。
- 線上核對output/rocket/p52-live-verification.json針對入口、build-info、scene-art.js、clouds.webp及geography.json共6份；保留same-origin限制及逐byte比對。測試瀏覽器與本機preview已關閉。近景立體雲未改，真手機GPU/Moodle未驗。

# 2026-10-27 P51 跟隨鏡頭對準實際機身中心

- 使用者批准修正二級傾斜時偏離畫面中心；沿用原網站發布。範圍僅scene.js的follow目標點、既有browser owner與本計劃；不新增依賴或UI，不改評分、physics、schema4、150kg及存檔格式。
- 目標取既有partBounds（只含實體零件，不含尾焰），經實際縮放、姿態及最終平移轉換；發射台接地補償後亦共用同一公式。組裝及地球視角構圖保持原規則。
- 分離0.6秒沿用原有smoothstep，從完整機身中心平滑過渡至上級中心；不取下級飛行位置作鏡頭依據。保留各視角yaw/pitch/zoom與地表避碰。
- 驗收：既有browser owner加入--follow-center，source與實際解壓SCORM皆驗完整/短/分離火箭、多角度與縮放、手機直橫及桌面置中；以舊固定目標作負對照，驗分離起止/連續性、下級獨立性、wheel與context恢復，並回歸true-scale分離、地表接觸、天空、向量與提交生命週期。保留實際畫面截圖人工檢視。
- 測試沿用註冊owner，無新增正式測試檔；提交後保留affected selection-preview。發布從實測ZIP核對所有runtime並保留同一owner-private受眾。實機Samsung/iPhone、實體touchpad與真Moodle另列未驗。

- 分組驗收避免重跑：--sky已完成source/實際SCORM的天空正負對照及submission lifecycle，output/rocket/p51-sky-report.json。舊天空負對照原本依賴follow目標與避地結果，改用P50已記錄的完整鏡頭姿態/near作固定歷史fixture；同一姿態下新shader要求0露底、舊shader要求露底，production天空與near/far規則均未改。其餘置中/分離/接地/向量由--follow-center組完成。
- Node art、interaction、lifecycle及全域check.js、279-entry test registry通過；未新增正式test file或依賴。

- 最終兩組均completed=true，output/rocket/p51-browser-report.json合併28 flows、0 JS errors；source與實際解壓SCORM各14。四尺寸1920×1000、1280×800、390×844、844×390，共4608組姿態/縮放/高度/地表方位檢查；最大投影中心誤差4.14e-11 CSS px，舊固定目標負對照偏移51.2–154.0px。分離起始鏡頭誤差0、結束對準上級、改下級軌跡不移鏡頭；wheel及圖像恢復後保留資料/zoom與置中。已檢視桌面、手機與封裝縮放截圖。
- runtimeHash=4688be2970d5345ffa0fee68d55ed110d44a1dc8c9b86634542381e757af1d81。相鄰回歸含32個true-scale分離情境、288組向量、發射台/異地山坡/海面撞擊、天空0露底（舊shader歷史fixture露底593389 pixels）、0/100分與舊分數、readonly/pending/retry、standalone fresh/fullscreen/context recovery。分組原報告p51-center-report.json與p51-sky-report.json均保留；沒有採用未完成報告。

- 實作已commit/push 7d8abe89d1b22d5495efa5a071a9ef79b6bf88e1；committed affected預覽output/rocket/selection-p51.json（75a03af→7d8abe8，僅預覽，未宣稱整批全跑）。473份runtime及474份ZIP entries核對dist，SCORM同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=1105fbf204f8689d1770359946c17242d671123c0695424c8525805542c78881，build-info.sourceCommit=7d8abe8、schema4及payload150kg。
- 官方Sites helper已push來源b0c24fd8428902378ed28d2f2d2d59e747f478ac並建立output/rocket/rocket-follow-center-p51.tar.gz。原網站版本49，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_9037ad58bca08191a5a5cecbf639127b，deployment=appgdep_6ae00d0612d88191a649e6fc6c182fe0，native succeeded於2026-10-27 10:31:44 UTC+08；同一網址及owner-private受眾保持（1 user、0 groups、0 external）。
- output/rocket/p51-live-verification.json completed=true：16份線上檔案核對實測dist，非HTML逐byte hash，HTML只扣既知平台注入script；same-origin canonical redirect限制保留。原網站已重新開啟，本機preview及測試瀏覽器均已關閉。真Samsung/iPhone、實體touchpad及實際Moodle未驗。

# 2026-10-27 P50 手勢縮放與鏡頭操作

- 使用者已批准按[詳細工作計劃](40-rocket-gesture-zoom-plan.md)實作並沿用原網站發布。基準25e245d；範圍interaction/scene/main/index/styles、既有interaction test及browser owner，無新依賴、評分、physics、schema4或固定150kg修改。
- 正常構圖先計算模型顯示比例及分離過渡，再只在最終鏡頭距離套用手動zoom；避免跟隨模式的模型尺寸同步縮小。四視角記憶沿用既有cameraViews，回正只影響當前視角。
- 中央雙指接管取消未提交零件預覽；一指放開後等待全部放開，第三指、失焦、取消、尺寸/視角/頁面及圖像失效均清理。元件箱、側帶與面板起點不轉為縮放；滾輪、touchpad、聚焦鍵盤及空白雙點回正共用倍率。Safari形狀事件為相容分支，實機事件序列另列未驗。
- 移除鏡頭設定區與三按鈕；保留四視角及fullscreen。鏡頭輸入合併至既有動畫幀，更新投影與接點，不經模型命令、存檔或完整面板render。保留P49故障恢復及明確繼續規則。
- 最終分組驗收彙整為output/rocket/p50-browser-report.json：source＋實際解壓SCORM共114 flows（各57）、0 JS errors；runtimeHash=c711ba4d2775406e75b2485aae9e5e8985e6342144a0441625278894d3579bfd。四份實測ZIP的所有非目錄entry資料雜湊一致，entryHash=1d21b0d66b3ca23ac8f635fcd20297589f74d56d6175e455d8d52bf2f3dd5853，發布前仍須重算runtime與核對dist。
- 六尺寸1280×800、390×844、844×390、320×568、430×932、390×460，source/package共12組手勢案例；主要三尺寸驗四視角，另外三尺寸驗組裝縮放/操作/佈局，因同一鏡頭公式而分組。30個實際framebuffer配對採0.5→1倍未裁切構圖，像素高度比1.857–2.273，返回誤差最多1px，model world scale與position不變；完整火箭1→2倍可局部裁切，屬用戶主動放大。
- 驗兩指接管、不旋轉、部分放手/第三指/取消/失焦/Escape/真pointer ID失去capture、上下限反向、元件箱起點排除、四類已裝零件實際拾取與取消、放大後取出並裝回太空艙。Safari形狀事件為合成分支驗證，wheel在該分支不重複縮放；不代表真Safari已驗。
- 反覆30次縮放暖機後再30次：studio保持33 geometries/7 textures/9 programs。60個同步wheel事件合併至幀繪圖；等cameraDirty與terrain pending清空及兩個RAF後，閒置不再重畫。readonly100分、frozen原bytes及合法retry、running/paused語義、鏡頭/成果往返均通過。
- 原生Chrome 200%使用臨時profile的settingsPrivate設定，source/package各一例：1280×800變640×400 CSS px、DPR2、visualViewport scale1，無水平/垂直溢出；鍵盤縮放/回正不改答案，最後說明控制項可到達。已檢視200%及手機縮放對照截圖。未使用使用者瀏覽器profile。
- T1直接iframe、T2非捲動wrapper、T3 overflow元素宿主；五種factory/follow/review/pending/lost狀態，source/package共6組，180次可信側帶/面板滑動及24次兩個正常活動對照。另記錄30筆panelRange，20筆無範圍，其餘132/422/721/844px；無範圍明示N/A，有範圍要求實際/單調移動。每move/release驗owner/non-owner、viewport、stage、styles、state與zoom；沒有鎖html/body或競爭捲動。對照活動從source提供，沒有放入SCO。
- 相鄰回歸含32個分離情境（0.4/2.5手動zoom不改上下級世界尺寸/位置/時間）、288組向量、地表接觸/effects/depth、天空、組裝與卡片捲動、儀表、圖像恢復60個正向內容檢查及兩個舊黑畫面負對照、0/100分及舊25分/60分、readonly/pending/finish retry、standalone refresh/storage denied/fullscreen。
- 驗收沿用既有owner分組，避免無關重跑：初次相鄰source前段33 flows已完成，遇到舊short fixture未裝艙而停止；補齊合法capsule後以--gesture-regressions-only --source-vectors-onward完成source尾段及完整package。彙整保留前段原completed=false與失敗排除原因，僅採納已完成33 flows；其後組別及--gesture-core-hosts、補跑--gesture-hosts-only均completed=true。來源/封裝情境數相同且所有ZIP entry逐一吻合，沒有將初次整組誤報成功。
- 原directCamera測試改讀現行太空艙卡，flightVectors短火箭先裝艙再發射；production validation不變。七組Node測試、全域check.js/279-entry registry及最新runner node --check通過，證據p50-node-codes.json、p50-static-final-codes.json。無新依賴/正式test file。
- 真Samsung Internet/iPhone Safari、實體touchpad與實際Moodle T4未驗；本機SwiftShader不代表真機FPS。
- 實作已commit/push 18af35fdc7e0ce2981359b467ef3bccd4932f9a0；committed selection-preview output/rocket/selection-p50.json（25e245d→18af35f，affected預覽，未宣稱整批全跑）。473份manifest runtime與dist逐byte核對，474份ZIP entries吻合，SCORM同步output/rocket-launch-orbit-lab-v2-scorm.zip；packageSha256=a5e45b969758a546e88f3376caf79066361a4129c7b64450d0ea9b39501515eb，build-info保留schema4及payload150kg。
- Sites helper已建立並push來源7884bc67ab2f08eb5a905717290c7d08df2c57da，archive output/rocket/rocket-gesture-zoom-p50.tar.gz。Sites與實作是兩個Git倉庫；前者commit包含build-info.sourceCommit=18af35f，不能把兩者SHA混用。原opening的723616f僅為先前網站HEAD；經核對官方helper saveSource流程、ZIP hash與473份runtime一致後，審查准予準備新來源。正式發布只使用helper新返回的7884bc6及對應archive。
- 網站版本48 appgprj_6adc62579ab88191aba299bcb282ce95~appgver_cf13bd48aa1481918d2fe3729f500cef，deployment appgdep_6adff001a7308191b445e6cc27ff43df，native succeeded，2026-10-27T00:27:54.618307+00:00。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留（1 user/0 groups/0 external）。
- output/rocket/p50-live-verification.json completed=true：16份線上入口/runtime/manifest/build-info與測試dist一致，包括本輪5份runtime；sourceCommit=18af35fdc7e0ce2981359b467ef3bccd4932f9a0，packageSha256=a5e45b969758a546e88f3376caf79066361a4129c7b64450d0ea9b39501515eb。非HTML逐byte hash，HTML只扣既有平台注入script；憑證僅隨same-origin canonical index redirect。
- 已交Codex開啟活動原網址（queued）；來源與封裝的手機/200%畫面已檢視。所有本輪browser/probe/helper/verifier及8769 preview server已結束，既有附件未改。實體手機/touchpad及實際Moodle T4仍未驗，沒有宣稱真機FPS或Moodle-ready。

---

# 2026-10-26 P49：WebGL／Canvas 資源失效後完整恢復

- 使用者已批准按P48診斷修正。範圍scene-art的生成貼圖cache、scene恢復handler、既有browser owner與計劃；沿用原shared SCORM/flow與main onFault暫停/提示。無新依賴、素材、評分、physics、schema4或150kg修改（formative/low-risk）。
- 資源策略：保留deterministic paint callback／尺寸／seed，恢復時重畫現有Canvas並標記texture.needsUpdate；不保存額外完整pixel備份，不在正常每幀讀GPU或重建。Canvas2D lost/restored事件亦納入等待；WebGL仍lost或Canvas未ready期間維持paused/fault狀態。瀏覽器2D恢復使用預設行為，不preventDefault；WebGL lost仍preventDefault以允許恢復。
- 顯示策略：共用renderer設定初始化與恢復的背景dbece2、sRGB、ACES曝光1.15；失敗維持fault、資料不動，畫面恢復後仍由學生明確繼續。沿用現有鏡頭記憶與設計／飛行／紀錄資料，不自動reload或重啟attempt。
- 狀態／phase矩陣：workshop空白/完整/drag、pad、ascent/coast、night impact→workshop、check/review/frozen的權威資料不因恢復修改；只改顯示資源及running=false。既有persist encode/decode與rubric未變；以原lifecycle驗0/100、review/pending/finish retry及standalone refresh。
- 驗證決定：已登記browser新增--graphics-recovery，source＋實際SCORM於desktop/mobile portrait/landscape，以P48可重現的bitmap reset＋真WEBGL_lose_context做pixel/CPU貼圖hash對照；保留舊恢復負對照證明可捉黑畫面。驗夜面impact及return、Canvas2D事件多資源先後恢復、重複故障、repaint失敗不報成功、資料/成績/鏡頭不變、保持paused且可legal continuation；idle無重畫及資源數不成長。check.js/check:tests、原art/lifecycle與committed selection；真Samsung仍須實機驗證。
- 實測Canvas在context reset後會切換GPU/CPU raster path，原圖與同seed重畫可有局部抗鋸齒/噪點差異：mobile最大texture平均byte差2.42、frame平均RGB差0.575，>=16差異像素1.50%。desktop正式對照CPU RGB平均差4.37/255；驗證採CPU RGB平均差<6/255、alpha平均差<.25，frame平均差<2/255且>=16差異像素<5%，另有>80%黑畫面舊handler負對照；不為強求hash一致而更改正常渲染路徑。
- 最終 --graphics-recovery source＋實際SCORM共14 flows、0 JS errors；desktop1280×800、portrait390×844、landscape844×390共6個版本/視窗組合，60個正向pixel/CPU內容檢查通過。兩個舊handler負對照各94.34%黑畫面；新恢復最大frame平均RGB差0.639/255、>=16差異像素1.287%、CPU RGB平均差4.375/255、alpha平均差0。證據output/rocket/p49-browser-report.json；runtimeHash=d74b18fc8f6a092779d3142737cd4667b44785ab5f4942d4e8e4f0fe5c9de92e。
- 驗Canvas-only、多canvas等待、Canvas先於/後於WebGL恢復、repaint拋錯保持fault並可重試、三次重複失效資源數穩定、12次idle draw texture/source version與資源不變。夜面coast運行中失效保持資料及paused，手動按繼續才前進；夜面impact模型隱藏時失效後返回完整工廠，既有100分成果及鏡頭保留。frozen pending的原payload bytes不變，可legal retry為review100；空白workshop恢復後可繼續裝引擎。
- 既有skyCoverage及lifecycle source/package通過：0/100分、readonly/pending/finish retry、standalone refresh/storage denied、fullscreen/context恢復；Node art/lifecycle、check.js、test-registry通過（279 entries），沒有新dependency/test file。已檢視實際SCORM手機夜面墜毀返回工廠截圖。真Samsung與實際Moodle未驗，受控故障驗證不能證明原真機自然觸發原因。
- 實作已commit/push 860a204d83b31b2aa19faa4383b3734c9e3c7f08；committed selection-preview output/rocket/selection-p49.json（24657c0→860a204，affected預覽，未宣稱整批全跑）。發布前重算manifest runtimeHash吻合上述測試，474份ZIP entries逐份核對dist，SCO同步output/rocket-launch-orbit-lab-v2-scorm.zip。packageSha256=ecdd86c517df9b64341ca5dcb52d805ec2d45bcbf336e66c158a0196dcc9976a；build-info保留schema4、payload150kg。
- Sites helper來源723616f3c600ebfb8c051d15b4a85a924d54f862已push/打包output/rocket/rocket-graphics-recovery-p49.tar.gz。網站版本47 appgprj_6adc62579ab88191aba299bcb282ce95~appgver_6dbd321e51088191af2ba54c3745800d，deployment appgdep_6adf713f6f748191b3305898f491a316，native succeeded，2026-10-26T15:27:07.661255+00:00。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- output/rocket/p49-live-verification.json completed=true：16份線上檔案與測試dist一致，包括本輪scene.js、scene-art.js，sourceCommit與packageSha256吻合。非HTML逐byte hash，HTML只扣平台注入script；憑證只隨same-origin canonical index redirect。已交Codex開啟活動原網址（queued），本輪browser/probe/helper/verifier及本機preview server均已結束，既有附件未改。真Samsung Internet與實際Moodle未驗；受控故障類型已修復，未宣稱原真機自然觸發原因已被證實。

---

# 2026-10-26 P48：元件卡對齊與夜面返回工廠黑畫面調查

- 使用者要求修正太空艙/分離器文字及drag handle對齊；黑畫面部分要求分析。確認手機Samsung Internet，refresh恢復。此輪只改卡片文字/CSS及既有browser owner，繪圖程式維持以隔離診斷，physics/rubric/150kg/schema4/SCORM不變。
- 卡片：太空艙質量改與分離器同樣簡短的kg標示（固定150kg仍由題目說明）；handle靠卡片底部對齊，保留44px與native scroll/drag ownership。不增加固定卡片高度或新依賴。
- 驗證：已登記browser新增--cards，source/實際SCORM手機320/375/390/430與橫向/桌面，量度兩卡title/mass/handle對齊及44px；加大字級與overflow、既有onboarding及paletteScrolling。check.js/check:tests及committed selection；真Samsung Internet未直接測試。
- 繪圖唯讀調查：desktop及390×844正常day/night impact-return亮度完全相同，工廠lights=1.65/2.4/.6。強制context loss/restore可重現黑色背景、clearColor由dbece2變000000；貼圖仍正常，不能把使用者完整症狀全部歸因於同一原因。繼續比較夜面隱藏模型/分離後restore及in-memory還原，診斷輸出output/rocket/p48-*，不改繪圖runtime。
- 額外受控驗證：夜面impact時強制WebGL loss/restore，再返工廠，可重現clearColor=000000／42.40%黑背景，僅在memory重設clearColor即可還原。Canvas2D bitmap reset＋WebGL restore得到94.34%黑畫面，箭身/地台黑、白艙頂和有色色環保留；補回同一批原像素＋背景色降至0.00062%黑，lights全程1.65/2.4/.6。這是人工失效機制對照，不是已捕捉使用者Samsung原生故障事件；不得把因果推斷寫成真機已證實。資料 output/rocket/p48-night-context-diagnosis/、p48-canvas-loss-diagnosis/。
- 依MDN CanvasRenderingContext2D.isContextLost／HTMLCanvasElement.contextlost，GPU/記憶體故障可令Canvas backing store失效，預設恢復等同reset，需重新繪畫。目前canvasMap cache只保留texture，沒有重繪callback；WebGL恢復亦未重設clear color。建議後續恢復原背景、重畫cached Canvas貼圖並重新上傳，保持答案及paused狀態；本輪未改scene/scene-art或其他renderer程式。參考 https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/isContextLost 。
- 卡片最終 --cards source＋實際SCORM共24 flows、20 layouts、0 JS errors；報告 output/rocket/p48-browser-report.json，runtimeHash 5707363e42e85863ec0b3ec62191d2672412f256f4d08e0683e77226bf5ae54e。320/375/390/430/844/1280六尺寸、14/18px字級共24組對照，title/mass/可見handle最大Y差均0px，44px及overflow/手機scroll/drag/keyboard onboarding通過；已檢視390px實際封裝截圖。check.js/test-registry通過，無新依賴或test file。
- 實作已commit/push 659ebd3c38b93c2545f0adebdaa6e4c8aab4911b；committed selection-preview output/rocket/selection-p48.json（02715a9→659ebd3，affected預覽，未宣稱整批全跑）。發布時重算manifest runtimeHash吻合測試、474份ZIP entries逐份核對dist，SCORM同步output/rocket-launch-orbit-lab-v2-scorm.zip。packageSha256=7d68415464a39d7837c73be9b4219538341bb7f7f1bb095597f142dc124d07a9。
- Sites helper來源df15da42d92e40087bf8f802b0457e2dee325755已push/打包output/rocket/rocket-card-alignment-p48.tar.gz。網站版本46 appgprj_6adc62579ab88191aba299bcb282ce95~appgver_e45faad533dc8191a4053a5d322ec12e，deployment appgdep_6adf595d43d481918397610efb0a0a43，native succeeded，2026-10-26 21:45:19 UTC+08。原網址與owner-private audience保留。
- output/rocket/p48-live-verification.json completed=true，16份線上檔案與測試dist一致（含本輪index/styles，renderer維持上一版）。非HTML逐byte hash，HTML只扣平台注入script；token只跟same-origin canonical index redirect。已交Codex開啟原網址（queued），受控browser/probe/helper/verifier及preview server已結束；既有附件未改。黑畫面維持分析結果，未聲稱已修復或已捕捉真Samsung故障；真機及實際Moodle未驗。

---

# 2026-10-26 P47：由下向上組裝及最後安裝太空艙

- 使用者已批准按方案實作。流程：下級引擎→燃料箱→（可選分離器→上級引擎→燃料箱）→太空艙；分離器向上新增stage[1]，stage[0]身份不變。太空艙只一件、最後裝，固定載荷150kg；已裝後先取下才可增加箱/級，既有引擎更換及箱內重排可保留艙。
- Scope：parts/model/scene-art/scene/main/index、persistence與既有測試/fixture/說明。沿用SVG卡、Three模型、touch/click/keyboard/ghost與shared SCORM/fullscreen，無新依賴。風險集中上下級身份、末端吸附/拆件、part bounds/落地、舊pending canonical bytes及手機camera/scroll；不改physics與10/15/45/30 rubric（formative/low-risk browser grading）。
- 狀態：新draft/review schema4、modelVersion2。craft.capsule=false代表未裝；已裝沿用既有craft（省略欄位），由P.hasCapsule統一解讀。compact craft可多第三個false；schema2/3仍按舊兩欄格式讀取，舊review保持版本與bytes，舊draft轉schema4，未完成舊workshop補未裝艙；飛行/紀錄視為已裝，固定150kg只計一次。
- Phase矩陣：workshop空白/引擎/箱/分離器空上級/完整無艙/有艙/拆艙可存並可check-submit；pad/ascent/coast/ended及record必須完整且有艙；check原樣返回；review/committed/frozen不改分或凍結payload。既有合法partial送出0分，沒有額外組裝分。
- 驗證決定：現有model/persistence/runtime/scoring/interaction tests補規則與所有新組裝階段round-trip+legal continuation；舊schema2/3 review/pending重試保持canonical。原入軌recipe/分離質量與推力維持。已登記browser新增--assembly，source+實際SCORM桌面/320/390/短橫向，click/touch/keyboard/取消drag/艙ghost/取出與補裝/接點/bottom anchor/camera、scroll/fullscreen/context、life cycle；相關碰撞/分離畫面驗證與manifest閉包。check.js/check:tests/committed selection，真機Safari及實際Moodle另列未驗。
- 實作：保留bottom=0，不再加未安裝的假燃料箱/自動艙；太空艙成為可raycast/選取/取出/ghost的獨立group，分離後隨上級。工廠按已裝尺寸預留下一件4.4m空間，只於實際尺寸需要時擴大構圖；drag preview不移鏡頭/接點。空級按鈕移到模型旁及避開手機底部相機掣。
- 七組既有Node測試（model/orbit/scoring/persistence/interaction/lifecycle/art）通過，包括新組裝階段/check的encode/decode/restore與legal continuation、舊schema3 frozen retry payload不變，以及原手動入軌recipe滿分並滑行一圈。check.js與test-registry最終檢查通過；證據 output/rocket/p47-node-codes.json、p47-static-final-codes.json。沒有新test file或依賴。
- 舊separationTrueScale fixture在直接切換高空狀態時補回相同maxHeight，未放寬production snapshot validation。新capsule browser reload以timeOrigin變更確認真reload，preview頂點投影必須在畫面內。
- 最終 `--assembly` source＋實際SCORM共50 flows（各25）、20 layouts、0 JS errors；runtimeHash `a3ea147a70951574bc2b6f3c62d7b0f6c363dff28beeb1c574974abeb26c60ed`，報告 `output/rocket/p47-browser-report.json`。四尺寸1280×800、390×844、320×568、844×390的source/package共8組bottom-up/capsule cases：底部幾何固定、頂部接點、完整preview在畫面內、cancel不改答案/存檔、raycast/鍵盤/取出/拖回元件箱、缺艙禁止發射、duplicate拒絕、150kg只計一次、真reload恢復及艙隨上級均通過。已檢視手機完成模型及桌面完整preview截圖。
- 沿用trusted touch/mouse組裝、ordinal重排/跨級搬移、錯位/滿箱拒絕、44px handles與card內容native scroll、fullscreen/context recovery、0/100分/readonly/pending/finish retry/standalone refresh/storage denied。32組高度/箱數/油門分離情境保持true-scale和同步；source/package各兩尺寸的launch/hill/sea落地與effects通過。真機Safari與實際Moodle未驗；本機Chrome受控軟件渲染不代表真機FPS或Moodle-ready。
- 實作已commit/push `48107643339c6f570f04b3d9f258a29a00a1d7a0`；committed selection-preview `output/rocket/selection-p47.json`（9fcff9d→4810764，affected預覽，未宣稱整批全跑）。browser啟動時HEAD仍為9fcff9d，測試的是已實作working tree；發布時重算所有manifest runtime bytes，與上述runtimeHash完全相同，排除測試後換檔。
- 474份ZIP entries與Site dist逐份核對，SCO同步 `output/rocket-launch-orbit-lab-v2-scorm.zip`；build-info sourceCommit=48107643339c6f570f04b3d9f258a29a00a1d7a0、answerSchema=4、payloadKg=150、packageSha256=becd880e8ceb739adf496e9649fc6d85e92f167157fc07fd1ea87499e4ef65fb。
- Sites helper來源 `b2c25e1f1af326effb74f8c570838e704dc152b2` 已push/打包 `output/rocket/rocket-bottom-up-capsule-p47.tar.gz`。網站版本45 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_f7b252bf2f8c819198e0c8021f87007d`，deployment `appgdep_6adf50a673a08191b5210fce40baeae1`，native succeeded，2026-10-26 21:08:03 UTC+08。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- `output/rocket/p47-live-verification.json` completed=true：16份線上入口/runtime/manifest/build-info與測試dist一致，涵蓋全部7份改動runtime。非HTML逐byte hash，HTML只扣平台注入script，憑證只跟隨same-origin canonical index redirect。網址已交Codex開啟（queued）；受控browser/server/helper/verifier及本機preview均已結束，既有附件未改。

---

# 2026-10-26 P46：近地地形清晰度與交接

- 使用者已批准根據重複A/B/A與反向診斷修正：120km opaque / 160km contact patch以疏遠環遮住regional，5km硬關造成跳變。診斷紀錄 `output/rocket/ground-handoff-confirmation/report.json`；同高度切換/回復逐像素相同，4999→5000m原33.65%像素顯著變化，固定同層僅0.10–0.12%。
- 實作範圍：contact-ground.js 與 scene.js 共用遮罩接線；保留近地精確高度及既有terrain lighting、color source和props，以有限近地網格取代遠距覆蓋。採用2km核心/4km外緣，600–2400m AGL連續收窄至零，消除5km開關。遮罩和patch coverage共用半徑；外緣需保留底層覆蓋，沒有整片透明洞。
- 風險：發射台深度/接地、remote hill/sea底層差異、移動後mask與geometry中心對齊、透明層排序、下降及視角來回。必須先看畫面及像素/接觸證據，不只驗visible旗標。原物理/評分/載荷150kg/schema3/SCORM生命周期不變，無新runtime依賴或素材。
- 驗證：沿用已登記rocket browser，新增ground handoff案例，source/實際SCORM桌面/手機；2.9km與接觸層停用對照遠處不再大幅差異、4999/5000連續性、消退區上升下降、近地pad遮擋、remote hill/sea碰撞與effects、shader/資源預算、暫停/反覆切換無資源成長、原sky修正及lifecycle。Node art/model/persistence相關既有檢查、check.js/check:tests與committed selection。實測採受控Chrome，不能代表真機Safari或實際Moodle。
- 原910 vertices/1664 triangles重新集中至4km內；兩個mesh合成一個，移除landFade attribute，以共用radius在fragment漸淡外緣。100m位置快取內，clip center與mesh origin一起更新，避免遮罩先移、幾何未移。
- Node art/model/persistence、`node tools/check.js`、`node tools/test-registry.js`（279 entries）已通過；本機紀錄 `output/rocket/p46-check-codes.json`。舊groundReadability的160km光照範圍門檻改成坡度法線對受光的實際貢獻；保留並加跑原轉動光源像素測試，沒有改變production光照公式。
- 最終 `--ground-handoff` source＋實際SCORM共30 flows、0 JS errors；runtimeHash `db9eb431b93b1e375ff34111fea37aace6fdcaa2cfa4ecc55732e1d3a14be2d0`，報告 `output/rocket/p46-browser-report.json`。桌面1280×800、直向390×844、橫向844×390：2.9km啟停contact對照0差異，600/1200/2000/2400/5000m每1m交接均<1%顯著像素差，4999→5000m為0.13–0.17%；下降返回逐像素相同。
- 發射台/海岸/山坡共18個視窗及版本組合，接縫取樣0穿洞；mask/mesh中心在100m快取移動內一致。910 vertices/1664 triangles保持；暫停12次繪圖0重建、geometry/texture/program沒有成長，交接穩定畫面實測最多61 draw calls/71975 triangles。已檢視2.9km清晰地面、手機海岸/山坡邊界及近地發射台截圖。
- 既有ground readability、轉動光源/全球法線連續、terrain depth、異地山坡/海面/發射台碰撞與一次性effects、天空coverage及lifecycle通過。舊terrainDepth fixture的5km狀態補上flying（此前錯標pad）；未放寬production驗證。評分100/0分、review/pending/retry、standalone refresh、fullscreen/context recovery維持。
- 真機Safari與實際Moodle未驗；本機Chrome使用受控軟件渲染，預算/資源檢查不代表真機FPS。
- 實作已commit/push `d4a9dfa601e120d31415947dd469bf113eb5bb6a`；committed selection-preview `output/rocket/selection-p46.json`（2af282c→d4a9dfa，affected預覽，未宣稱整批全跑）。
- Sites helper來源 `12672664fe9168a3d852334dac9d210b27f8cb6a` 已push/打包 `output/rocket/rocket-ground-handoff-p46.tar.gz`。版本44 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_ef6fd067540c8191bd2f3dcadb93510e`，deployment `appgdep_6adf3c16eb20819197f052c94490d42a`，native succeeded，2026-10-26 19:40:17 UTC+08。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- `output/rocket/p46-live-verification.json` completed=true：16份線上檔案（包括contact-ground.js、scene.js與原sky修正）符合測試dist；非HTML逐byte hash，HTML只扣平台注入script，憑證只跟隨same-origin canonical index redirect。sourceCommit=d4a9dfa601e120d31415947dd469bf113eb5bb6a，packageSha256=086e87e29f549a31bb534aca4173decb74fc9cad60f0a06214094fcd4bb068cf。474份ZIP entries已核對dist，SCO同步 `output/rocket-launch-orbit-lab-v2-scorm.zip`。
- 受控browser/server/helper/live verifier已結束；既有附件未改。

---

# 2026-10-26 P45：向上望時天空多邊形露底修正

- 使用者批准立即修正。診斷已確認：天空球在極遠處以一般投影深度繪製，近地鏡頭的near/far比例達數千萬，部分天空面被裁走；改底色後缺口跟隨變色，sky-only仍可重現。
- 最小範圍：createSky頂點shader把背景z固定在有效遠深度；保留x/y/w、天空漸層/星圖、BackSide、depthTest/depthWrite=false及renderOrder。唯一caller為RocketScene；不改鏡頭near/far、地形、物理、箭號、評分/150kg/schema3/SCORM狀態。
- 沿用現有已登記browser owner，加sky coverage回歸及--sky選項，包含source/實際SCORM：桌面1280×800、直向390×844、橫向844×390；8.4452km低鏡頭八方向與起飛/高空/全景/plane，鮮紫clear color檢測露底。保留一次舊shader負對照確認測試能捉到原bug；驗切換視角、狀態不變/無shader錯誤，沿用lifecycle/fullscreen/context recovery。無新依賴或未登記測試檔。
- 未改其他活動或地形模糊問題。真機Safari與實際Moodle不能以本機替代。本輪驗證證據：
- `node tools/check.js`、`node tools/test-registry.js`（279 entries）及原art.test.js通過。沒有新依賴或新測試檔。
- 最終 `--sky` source＋實際SCORM共8 flows、0 JS errors，6個尺寸/版本組合各13案例，共78個天空視角全部0露底像素。source及package桌面負對照原shader各593389露底像素，證明能重現原bug。起飛/8.4452km/80km/全景/plane與八方向均通過，飛行狀態不變、深度設定保留，無shader錯誤。
- 沿用lifecycle：100/0分、review/resume/唯讀、frozen/committed重試、standalone refresh/storage denied、fullscreen/context loss/restore、舊60分保持。報告 `output/rocket/p45-browser-report.json`，runtimeHash `d236c96e19eca9ee472b11d1b528ed4a38c1a310dc0c5a132146385644859842`；已檢視向上望截圖。
- Source與SCORM逐manifest檔案閉包一致。此修正只改一行sky vertex depth與原因註解，頂點/貼圖/依賴及鏡頭near/far未改；不重跑無關全球藝術效能套件，原art Node資產/預算檢查通過。真機Safari與實際Moodle仍未驗。
- 已commit/push實作 `1a952de14dd480952b603b3295cc4ec4b53459b7`；committed selection-preview `output/rocket/selection-p45.json`（29efafa→1a952de，affected預覽，未宣稱整批全跑）。
- Sites helper來源 `8f8fd4fc289248f6c76337fd1c9c11699889166b` 已push/打包 `output/rocket/rocket-sky-depth-p45.tar.gz`。版本 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_3ac90b5caca481919ae7e71d3e039550`，deployment `appgdep_6adf2a4c48a48191b9ce58fedf1fe9ac`，native succeeded，2026-10-26 18:24:21 UTC+08。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- `output/rocket/p45-live-verification.json` completed=true：15份線上檔案（包括實際改動的scene-art.js）與測試dist一致；非HTML逐byte hash，HTML只扣平台注入script；憑證僅隨同origin canonical index redirect。sourceCommit=1a952de14dd480952b603b3295cc4ec4b53459b7，packageSha256=078e7661741402b7ad6ce597d81751bb2f90f754f6c9fe279b85593152635f9b；474份ZIP entries核對dist，SCO同步 `output/rocket-launch-orbit-lab-v2-scorm.zip`。
- 已交Codex開啟活動原網址（queued）。本輪browser/server/helper/live verifier均已結束，既有附件未改。

---

# 2026-10-26 P44：全景箭號與飛行儀表美化

使用者批准三項修改；保持既有物理、評分、作答與鏡頭記憶。

- 全景/軌道正視箭號採原屏幕比例的一半（600kN/8km/s基準最多45px）；跟隨比例不變。兩種箭號維持線性推力/速度比例、方向、零值隱藏及火箭外側偏移。
- timeValue移回固定列，與近/遠地點同一行，T+時間標籤具完整可讀標籤；不增加固定列列數。固定列目標<=80px，維持44px操作及手機可捲動空間。
- 左上角以單一窄儀表卡統一邊框/圓角/細分隔線、22px主要數字與13px速度分量，數字/單位對齊；右側燃料卡使用相同視覺。保持畫布原尺寸和中間走廊。超過10000km高度固定讀數改為整公里避免過長，詳細軌道數值仍保留。
- Scope: scene/index/styles/main、原登記browser與計劃。沒有新依賴、schema或新測試檔；shared styles/scorm/fullscreen不變。
- 驗證：source/SCORM桌面及窄/矮手機，固定時間可見/更新/暫停不跳/捲動不消失、固定列<=80px/44px/scroll panel、左HUD沒有值或單位重疊及過寬空白。全景/plane與follow實際投影長度比較、油門線性、兩引擎比例、零值隱藏與render不改物理。沿用既有向量外側/方向與完整遙測檢查。真機及實際Moodle不以本機代替。

本輪已執行證據：

- `node tools/check.js`、`node tools/test-registry.js` 通過（279 entries）。最終 `--instruments` source＋實際SCORM共28 flows、0 JS errors；runtimeHash `c1af61f727c29c46790f2e7ec0f47274023bed9fb3859ffc83972f4458a8c229`，報告 `output/rocket/p44-browser-report.json`。
- 320×568、375×600、390×460/844、844×390、1280×800驗T+時間更新/暫停/捲動固定、固定列<=80px、44px操作、卡片字級/單位/邊界；全景/plane投影箭號為follow一半、推力線性及零值隱藏。沿用完整遙測、144組向量旋轉/視角組合及生命周期檢查（100/0分、舊摘要不改分、review/pending/retry、refresh/fullscreen/context recovery）。既有vector fixture補回與新高度一致的maxHeight，未放寬production validation。
- 已檢視320px手機實際SCORM儀表截圖。390×460縮短卡片padding，保留22px主字並與底部相機工具留位。評分/物理/存檔未改，本輪不重跑無關藝術效能browser；真機Safari及實際Moodle未驗。
- 已commit/push實作 `5f224df8a19667405a22204a3f55848f8cb6c35b`；committed selection-preview `output/rocket/selection-p44.json`（f65298d→5f224df，affected預覽，未宣稱整批全跑）。實測各尺寸固定列79px，未增加列數。
- Sites helper來源 `52928a487493ced49d315a077ac6893f235f4300` 已push/打包 `output/rocket/rocket-instruments-p44.tar.gz`。版本 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_66678a466aa48191814de8f5d1dca3c7`，deployment `appgdep_6adf0c05d7b88191b8fb453bedb0fbea`，native succeeded，2026-10-26 16:15:13 UTC+08；原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- `output/rocket/p44-live-verification.json` completed=true：14份線上入口/runtime/manifest/build-info與測試dist一致；非HTML逐byte hash，HTML只扣平台注入script，憑證只隨同origin canonical index redirect。sourceCommit=5f224df8a19667405a22204a3f55848f8cb6c35b，packageSha256=aa4f5fa079dbfb16a29bd4deb8d33c30e3f6b135009611d821b7ac8e430b841b。474份ZIP entries已核對dist閉包；SCO同步 `output/rocket-launch-orbit-lab-v2-scorm.zip`。
- 網址已交Codex開啟（queued）。受控helper/瀏覽器與診斷程序均結束；既有附件未改。今輪發布只包含儀表/箭號，地形覆蓋問題保留上述調查，未以未測修正混入。

同輪新增唯讀地形調查（未修改地形runtime）：

- 使用者2.9km模糊、5.5km突然清晰；`scene.js` 明確在AGL<5000m才啟用contactGround。contact-ground.js以910 vertices/1664 triangles覆蓋120km不透明核心、160km外緣，同時裁走內部的regional/global地形；遠環稀疏三角形插值海陸顏色/坡度，造成大範圍模糊。
- 固定同一2.9km狀態/鏡頭，僅診斷時停用contact層，海岸/山坡即清晰；4999m有contact，5000/5001m關閉，mask由120km直接歸零。regional已全opacity1/最高LOD，globalPending=0，確認主因為表面交接而非等待下載。報告/對照圖 `output/rocket/ground-handoff-diagnosis/`。
- 建議把contact縮至真正近地範圍、重新集中原頂點預算，外圍持續顯示regional；高度/顏色/法線與遮罩同步平滑交接，避免透明洞/重疊；驗上升下降、海陸與4999/5000m連續性。不能只把5km硬開關改成另一高度，也不需增加全球網格。此處是調查方案，未實作。

---

# 2026-10-26 P43：手機兩行固定操作列

使用者已批准立即實作前一輪分析；本節調整固定列及可捲動內容，評分/物理/存檔格式不變。

- 固定列只保留近/遠地點一行，以及暫停、點火/關機、分離、倍率一行；目標高度72–80px，按鈕保持至少44px。倍率與其他按鈕連排。
- 級別/飛行狀態、倍率提示、時間與完整入軌狀態移至預設展開的軌道詳細數據；recordA原有關機/保留語義與id保留，移回捲動區。
- 題目以原生details呈現：進入工廠預設完整展開，進入飛行預設縮成一行可展開目標；只在工廠/飛行切換時設定預設，操作時不反覆覆蓋使用者開合選擇。進成果頁/返回不重設飛行已選開合。
- 保留現有控制區總高度，將節省的固定高度交給下方scroll panel；不把空間再轉給畫布。既有scroll strips、44px targets、viewport與相機狀態保留。
- 影響僅index/styles/main與同一owning browser、計劃/說明；沒有新依賴、新schema或新測試檔案。舊成績與pending維持現行兼容規則。
- 測試：source及SCORM於320/375/390等手機（含460px短視窗）、橫向與桌面檢查固定高度/可捲動高度/44px/無橫向溢出；原生觸控捲動不改飛行，固定關機及分離/點火不受捲動影響；題目預設及手動展開、資料預設展開、保存/提交仍可到達。沿用登記browser的生命周期檢查與package closure。真機及實際Moodle不以本機代替。

本輪已執行證據：

- `node tools/check.js` 與 `node tools/test-registry.js` 通過（279 entries，無新增未登記檔案）。
- 最終 `--compact-deck` browser source＋實際SCORM通過，16 flows、0 JS errors。320×568、375×600、390×460/664/844、844×390、1280×800驗固定兩行、每掣至少44px、近遠地點不溢出、沒有橫向頁面捲動、題目預設/手動開合不被render覆寫、詳細數據預設展開、關機/保存/檢查可達、捲到最底仍可分離/上級原位點火。
- 實測固定列 72.84–74.19px；390×460 scroll panel 149.81px。原生觸控在油門掣上捲動不改飛行狀態。沿用lifecycle檢查100/0分、review lock/resume、pending/finish重試、fullscreen/context recovery、standalone refresh與舊摘要保留。未改評分/物理/存檔，本輪不重跑無關3D art/performance browser。
- 報告 `output/rocket/p43-browser-report.json`，runtimeHash `974eaa004e386c09f1f32d4c50f962d81b66dbfae02b9ca70350586242115633`；已檢視320px控制區截圖。真機Safari及實際Moodle仍未驗收。
- 已commit/push實作 `05eaf25f6c98ecb7d5fdc2d798b7f69fcc81573f`。committed selection-preview `output/rocket/selection-p43.json`：3c2bd8f→05eaf25，affected / 242 entries；只作選擇預覽，未宣稱全242項已跑。
- Sites helper來源 `b635e4493846348ed6d3737cfadd1d49a7923f1c` 已push/打包 `output/rocket/rocket-compact-deck-p43.tar.gz`。版本 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_2832089d0a5c8191b3478e94c3247db2`，deployment `appgdep_6adefe68039c8191915893757e163078`，native succeeded，2026-10-26 15:17:04 UTC+08。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 與owner-private audience保留。
- `output/rocket/p43-live-verification.json` completed=true：14份線上入口/runtime/manifest/build-info與測試dist一致；非HTML逐byte hash，HTML只扣除平台注入script，憑證僅隨同origin canonical index redirect。sourceCommit=05eaf25f6c98ecb7d5fdc2d798b7f69fcc81573f，packageSha256=05b5fdc0e4becc6d38f7ae5bbc9c37fc0d2efe4304a9e91e7d34ae1180ece42e。
- 新SCO已同步 `output/rocket-launch-orbit-lab-v2-scorm.zip`；網址已交Codex開啟（queued）。本輪Chrome/HTTP server/helper/核對程序均已結束，既有附件未動。

---

# 2026-10-26 P42：寬鬆部分分、導航與題目提示修訂

使用者已明確批准七項修改；本節優先於 P41 配分邊界，舊文字保留作歷史。

- 固定150 kg、形成性低風險評分、四項10/15/45/30與70分合格保留。入軌45分按關機後仍 flying 且 bound 的近地點進度：clamp((R+hp)/(R+150km),0,1) ×45取整；hp未達150km最多44，達標45；墜毀/逃逸/未關機不計此項。安全軌道不再設遠地點上限。圓化仍須安全入軌，e<=.03滿30、.03至.06逐步給分；未達近圓最多29。
- 例：140×300km=69；200×1500km=70；安全近圓100；到太空後墜毀25。未操作0；保留單次成果，不拼接不同試飛。
- 新作答 answer schema3；原 schema2 草稿保留所有答案/狀態，恢復為schema3；schema2已提交及pending review維持原舊配分與canonical內容，不能重新計分或解鎖。shared envelope version1、activity ID及modelVersion2不變。
- 回到組裝/發射時：工廠恢復factory，有飛行則恢復檢查前視角（預設follow）。各視角分別保留 yaw/pitch/zoom；只有明確按「視角回正」才重設。鏡頭屬本次頁面暫態，不寫入作答。
- 移除導航與工廠標籤01；預設展開軌道詳細數據，使用者仍可收合。
- 控制區加入預設可見活動題目（固定載荷、目標、滿分條件、建議高度及保留/提交流程）。航天提示改成淺白步驟、近/遠地點解釋及兩條公式。用既有mathjax-full開發依賴產生內嵌靜態SVG，保留LaTeX來源與可讀標籤，不載入額外runtime library；小手機檢查根號/分數完整。
- 測試決定：新增同一登記檔案內的分數單調性/邊界、schema2 draft migration/review/pending維持、各視角來回與reset、pad/flying/check導航、目標與提示與數學在320/390/844/1280尺寸、source/SCORM同版。既有物理/碰撞/提交流程保留。仍不以本機取代真機或實際Moodle驗收。
- 影響：model/scoring/orbit/persistence、main/index/styles/scene、相關Node與原owning browser、計劃與README/manifest版本；沒有新runtime依賴或新測試檔案。

本輪已執行證據：

- `node tools/check.js` / `node tools/test-registry.js` 通過；279 registered entries，沒有新增未登記測試檔。
- 7 個 rocket Node 檔案通過（model/orbit/scoring/persistence/interaction/lifecycle/art）。140×300 km=69、200×1500 km=70、入軌進度單調；schema2 已交/待確認25分仍是25；schema2草稿保留state/fuel/records並可按新schema3繼續操作。
- 最終 `--feedback-fixes` browser通過：source＋實際SCORM，12 flows、0 JS errors。320×568、390×844、844×390、1280×800驗題目可見/無01/數據預設展開、pad與飛行回到follow、三個飛行視角四尺寸及factory桌面分別記憶旋轉縮放、僅明確reset回正、公式SVG字形在viewBox內且不造成橫向捲動、新69/70分；另驗舊review/pending保持25及舊draft恢復後可操作，以及所有既有提交結果/readonly/refresh/fullscreen/context recovery。
- 報告 `output/rocket/p42-browser-report.json`，runtimeHash `5a961d771ebc0a2fbb247447230bc08ed3be2b0567b0f0243e1968f1902b3493`；檢視320px題目與根號分數截圖。公式以既有mathjax-full產生，SVG viewBox額外48 font units邊距保留字形外緣，沒有新增runtime JS/字型依賴。
- 舊P41嚴格配分ZIP另存 `output/rocket-launch-orbit-lab-p41-strict-scorm.zip`。本輪不重跑完整3D藝術/效能browser；資產未改，art Node/閉包與物理回歸仍通過。真機與實際Moodle尚未驗收。
- 已commit/push實作 `fa31c5c2bf89cc6185968b744e28621d0cae7e62`。committed selection-preview `output/rocket/selection-p42.json`：1dc2667→fa31c5c，affected / 242 entries；只作選擇預覽，不宣稱全242項已執行。
- Sites helper來源 `6c83e5646a0fb6a470e267129a40204a8419e583` 已push/打包 `output/rocket/rocket-feedback-fixes-p42.tar.gz`；來源憑證到期時按helper要求更新後續作，沒有另建Site或改分享權限。版本 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_ee6a621785c881918dcf8c6bec4319c9`，deployment `appgdep_6adef6bcb0388191a4e3794bc2ee768f`，native succeeded，2026-10-26 14:44:22 UTC+08。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 保留owner-private。
- `output/rocket/p42-live-verification.json` completed=true：14份線上入口/修改程式/manifest/build-info與測試dist一致；非HTML逐byte hash，HTML只扣除平台注入script，憑證僅隨同origin canonical index redirect。sourceCommit=fa31c5c2bf89cc6185968b744e28621d0cae7e62；packageSha256=37d12dd1033ab0f2e28b46648a66ee07351017c3121528e93151d5b7a2a01362。未改素材不重跑逐檔線上核對；source/SCORM閉包完整檢查。
- 網址已交Codex開啟（queued）。本輪Chrome/HTTP server/helper/核對程序已結束；既有附件未動。

---

# 2026-10-26 現行範圍修訂：固定載荷、只評發射入軌

使用者已批准實作本節；以下舊版 A/B 雙任務文件屬歷史記錄，本節優先。

- 所有人固定 150 kg 載荷；新作答不抽籤，不按載荷分變體。
- formative / low-risk 瀏覽器評分；沿用 shared SCORM/activity-flow/fullscreen；沒有新依賴。
- 100 分：實際升空至 10 m 10 分；該次最高海拔 100 km 15 分；關機且 flying、安全束縛軌道（近地點 >=150 km、遠地點 <=1000 km）45 分；安全後圓化 0–30 分，e<=0.03 滿分，e>=0.06 零分，中間線性取整，未達 e<=0.03 時最多 29 分，避免四捨五入提早滿分。合格 >=70。200–400 km 只作練習建議。
- 單次紀錄保存最高海拔與是否已關機；不拼接不同試飛。起飛和太空高度的部分分數在墜毀後保留。暫停、提示、重試、時間與燃料均不扣分。
- 刪除 B 任務、練習飛船、節點與自動變軌；保留手動再點火圓化、軌道鏡頭與關機後路徑。
- header 只有組裝與發射 / 成果與提交；固定飛行操作列加入近/遠地點、文字狀態及 44px 關機/保留按鈕，無須捲動控制區。保留單一成果，提供關機並保留，提交前顯示四項分數及原因。
- Assessment ID 改為 rocket-launch-orbit-lab-v2；answer schema 2（shared snapshot envelope version 1）。這是新 Moodle 活動版本，須新增活動，不能覆蓋有既有作答的舊 SCO。舊 ZIP/原始提交保留，舊 activity ID 不被新 decode 接受，也不重新計分。
- authoritative draft: schema, modelVersion, phase/backPhase, fixed craft payload index 0, flight（state/fuel/active/separated/t/attitude/controls/status/maxHeight）, records[一份或 null]；review: schema/modelVersion/records。紀錄包含 state、craft、fuel、active、separated、t、status、maxHeight、engineOff。不保存衍生分數作權威答案。
- phase matrix: workshop -> 組裝/檢查；pad -> 點火/檢查；ascent -> 控制/關機/分離/檢查；coast -> 點火/控制/保留/檢查；ended -> 保留部分成果/工廠/檢查；check -> 返回/提交；review/pending -> 唯讀/同一份重試。
- 每個可保存 phase（包括 check 的每個 backPhase）都做 encode/decode/restore 與合法延續；另驗空白、部分、墜毀、安全/近圓、非法數值及舊 ID 拒收、4000-byte 限額、四種提交結果與 frozen canonical。
- 測試沿用 tools/test-registry.js 的 rocket 檔案與 browser owner；刪除舊變軌 fixtures，保留物理/碰撞/分離/鏡頭/觸控回歸。實際真機與 Moodle readiness 不以本機瀏覽器代替。
- 交付：更新 catalogue/manifest/測試/版本資訊，跑 check:tests、選擇預覽、相關 Node/browser、SCORM 打包；commit/push，再部署現有同一個 owner-private Site。

本輪已執行證據：

- `node tools/check.js` 通過；`node tools/test-registry.js` 通過（279 entries / 241 Node / 38 browser）。
- 7 個已登記 rocket Node 檔案通過：art、model、orbit、scoring、persistence、interaction、lifecycle。包括真實垂直試飛最高海拔約 483 km 後墜毀保留 25 分；18t 手動預設角度/油門方案得 100 分並完整滑行一圈；e=0.03001 不會因取整而提前滿分。
- `--launch-only` browser：來源＋SCORM 均通過，20 個工廠版面、34 flows、0 JS errors，涵蓋原生觸控安裝/拖曳/捲動、油門/角度、分離/點火、暫停、倍率、四項計分、空白/部分提交、pending/finish 重試、readonly/resume、fullscreen/context recovery、standalone refresh/storage denied。報告 `output/rocket/p41-cockpit-browser-report.json`。之後補上固定關機/保留按鈕和舊成績摘要，最終版另跑 `--smoke`。
- 舊版雙任務 SCO 已獨立保留 `output/rocket-space-mission-lab-legacy-p40-scorm.zip`，取 c574a7b 的 runtime/manifest 與相同未改資產；新版下載名為 `output/rocket-launch-orbit-lab-v2-scorm.zip`。
- 本輪未重跑完整 3D browser art/performance suite；3D 與資產未修改，Node 閉包/地形/物理/分離/碰撞檢查仍通過。真機 Safari / 真實 Moodle 尚未驗收。
- 最終 `--smoke` browser 通過：來源＋重新打包 SCO，20 layouts、14 flows、0 JS errors；六個飛行尺寸各驗固定近/遠地點與 44px 關機/保留、100/25 分、四項預覽、明確提交、舊 60 分摘要仍可見且不改原 snapshot。報告 `output/rocket/p41-final-browser-report.json`，runtimeHash `84464a9cbd56ded79778ad9552bf3a6c7ecc8d746278810e109349d8c89a40c6`。
- 已 commit/push 實作 `5f019e397709b28bad9a518369f52312466a78fa`。committed selection-preview `output/rocket/selection-p41.json`：c574a7b→5f019e3，full / 279 entries（受 catalogue/README 變更影響）；只作選擇預覽，未宣稱全 279 項已跑。
- Sites helper 開啟並推送同一個既有 owner-private Site，來源 commit `dcbbfa7690e7f3ba24f3fe740308d0641b672bab`，archive `output/rocket/rocket-launch-only-p41.tar.gz`。版本 `appgprj_6adc62579ab88191aba299bcb282ce95~appgver_52ce34ca3dc8819180fe0b6d8b12b1c5`；deployment `appgdep_6adeeaacf3888191a83e21da63f8ee25`，native succeeded，2026-10-26 13:52:52 UTC+08。網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site 保留；get_site 確認 owner、1 allowed user、0 groups/external。
- `output/rocket/p41-live-verification.json` completed=true：線上 12 份已修改入口/runtime/manifest/build-info 一致，非 HTML 逐 byte hash、HTML 只移除平台注入 script，認證只跟隨同 origin canonical index redirect。sourceCommit=5f019e397709b28bad9a518369f52312466a78fa、packageSha256=70026a54ba922d2f70829e5061a3d49427fd9d823ea497494dec3cc9aea958de。未改 3D 素材不重作線上逐檔驗證；本機 source/SCORM manifest 閉包完整驗證。
- 網址已交 Codex 開啟（queued）；本輪 Chrome / HTTP server / Site helper / 線上核對程序已結束，既有 `.codex-remote-attachments` 未動。

---

# 火箭工廠與太空任務：3D SCORM 實施計劃

狀態：**使用者已批准實作；P1–P3 功能已接通，P4 驗證中，P5 待實際環境驗收。** 日期：2026-10-24。
本文件從 [新活動計劃模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 複製並填寫；遵循 [共同產品與風格](00-shared-platform-and-style.md) 及 [製作與驗證契約](../docs/simulation-scorm-production-guide.md)。下列數值、配分和效能預算是具體設計決定／待驗證目標，不能當成已通過的證據。

## 已確認需求與本輪範圍

- 本 worktree 專門開發「火箭工廠與太空任務」，採真正 3D 場景，風格可愛、易上手，保留合理的發射與軌道物理。
- 借鑑 Kerbal Space Program 的組裝、試飛、失敗後修改、入軌及變軌循環；美術和介面自行製作。
- 學生要親手砌火箭、控制發射、嘗試入軌，並在軌道上改變速度。探索與任務成果是主體，公式與填答是輔助。
- 使用者已審查本計劃並明確指示立即開發，授權 runtime、測試、manifest、catalogue 和網站實作。
- 延續既有要求：標題不帶教材章號；繁體中文；數學符號採 LaTeX 樣式；讀數固定位置；不用重設／空白提交彈窗；手機舞台和控制 panel 均須可用。
- 教材參照：先前已讀的高中物理必修第二冊，第七章印刷頁 59–64。原 PDF 只作參考，不打包。
- 卡文迪許實驗及天體質量活動不在本活動範圍。

## 分支、工作範圍與交付節奏

| 項目 | 決定 |
|---|---|
| Worktree | C:/Users/frens/.codex/worktrees/bb0b/simlab |
| 專用分支 | codex/rocket-space-mission-lab |
| 建立起點 | main 的 1ef4bdf4fd696b4a12c37f7c1bedfe6d6f96849d |
| Remote | origin，https://github.com/frenselw/simlab.git |
| 本輪文件 | plans/40-rocket-space-mission-lab.md |
| 活動目錄 | sim/rocket-space-mission-lab/ |
| 共用編輯位置 | sim/config.js、sim/manifests/rocket-space-mission-lab.xml、tools/test-registry.js、tools/mobile-scroll-cases.js、tools/mobile-scroll-browser-regression.js 的活動 CLI 登記如有需要、README.md |
| 現有未追蹤內容 | .codex-remote-attachments/ 保留；不納入本活動提交 |
| 開發埠／瀏覽器 session | 預定 4383／rocket-space-mission；衝突時另選空閒埠，不終止其他工作服務 |
| 每輪完成 | 相應檢查 → 只提交本輪變更 → push 本分支 → 有可試用版本時部署獨立 Sites → 核對部署版本和網址 |
| 回報 | 按使用者要求不用等待 CI 才交付；清楚標示 CI 待跑、失敗或通過及對應 SHA |
| 合併 | 完成驗收後才處理 main 整合；本輪不合併，不覆蓋其他活動 |

## 學生實際體驗

### 一次完整體驗

1. 進入裝配間，看到衛星載荷、兩種燃料箱、兩種引擎及分離器。點零件直接裝到目前選中的級，或拖零件到接點；可轉動鏡頭檢查成品。
2. 到發射台，由自己控制點火、油門、漸漸轉向、關機、分級。姿態穩定由系統協助，學生不需要處理翻滾。
3. 隨時切換跟隨鏡頭與地球軌道圖。軌道圖顯示「現在關機後」的預測路徑，讓學生看出飛得高仍可能落回地球。
4. 遇到問題可暫停，看具體原因，再回工廠改裝或重試。已保留的任務紀錄不因一次重試被清除。
5. 入軌後把變軌標記放到近地點或遠地點，調整沿運動方向／反向的變速量；預覽後親自確認執行。
6. 令衛星到達較高的目標圓軌道，保留成果，最後到「任務紀錄」檢查並明確提交。

建議課堂體驗 20–30 分鐘，可分兩次完成；不是計時競賽，不因多次試飛扣分。

### 任務 A：把自己的衛星送入軌道

- 起始裝配是空白的可裝配槽，只有待安裝的載荷提示；預設展示不構成學生答案。
- 任務描述：「組裝火箭，把衛星送到離地 200–400 km 的接近圓形軌道。」
- 先讓學生試飛，再依情況給一行可行動的提示，例如「目前路徑仍穿過地面；可以檢查沿地面方向的速度」。
- 提示按需展開；不自動換引擎、補燃料、選點火時機或修正軌道。
- 成功建立安全軌道後可繼續調整，也可保留現有部分成果。不用成功才可進入檢查頁。

### 任務 B：把軌道升高

- 任務描述：「讓衛星到達指定的較高圓軌道。」
- 可帶入任務 A 的安全入軌快照，或明確選「使用練習飛船」從 300 km 圓軌道開始。兩者都可做任務 B，練習飛船不補發任務 A 分數。
- 目標高度每次 attempt 從 600、800、1000 km 三種變體選一個；P1 須先驗證每種可完成，同一 attempt 保持不變。初期教學預覽可固定 800 km。
- 以近／遠地點標記選點火位置，選方向並調整預計 Δv。提供小幅增減按鈕，拖曳不是唯一輸入方法。
- 虛線預覽由同一物理模型生成，表示目前計劃與剩餘燃料下的結果。
- 「執行計劃」只執行學生已選定的節點／方向／變速量，協助定向和準時點火；不自動求最優解、不自動完成第二次圓化。
- 第一輪抬高遠地點，第二輪由學生再安排點火抬高近地點。隨時可取消尚未開始的計劃。
- 燃燒中可緊急關機，保留已消耗燃料及已發生的變速；不回滾物理時間。

### 如何保持有趣與容易操作

- 火箭、燃料箱、發射台採圓潤低多邊形造型；白／暖灰機身、藍綠和橙色區分部件；衛星可有簡單面孔標記，不引入角色對話系統。
- 工廠亮色、發射時天空漸暗、太空深藍。頁面 header／controls 仍遵循共用淺色與高對比風格。
- 推進火焰、分級和地球曲面提供清楚的操作回應。煙霧只作表現，不影響物理或遮擋讀數。
- 失敗以停機、落地標記和一行診斷呈現；保留返回工廠的直接入口，不彈 modal，不以爆炸動畫拖延重試。
- 自由探索可暫停、重試、改裝；正式提交後遵循 review-only 契約。任務完成徽章屬遊戲內形成性回饋，不表示已向 Moodle 提交。
- 展開公式為可選說明；主要操作不用學生輸入科學記數法或先計火箭方程。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | rocket-space-mission-lab；理解載荷、推力、燃料和分級的取捨；分辨升空與入軌；利用點火位置／方向改變軌道 |
| Delivery scope / package | 一個形成性 SCORM 1.2 SCO；同一 runtime 的 Sites 練習版；ZIP 為 output/rocket-space-mission-lab-scorm.zip |
| Learner task / main interactions | 裝配、控制油門與俯仰、分級、觀察關機後軌道、配置並執行變軌、選擇保留任務紀錄 |
| Shared subject core / activity outer layer | 目前無可直接套用的火箭核心；物理與軌道邏輯留在本活動。重用 shared styles/scorm/activity-flow/fullscreen，不提早抽象成跨活動航天框架 |
| Assessment risk / trusted validation | formative；瀏覽器評分不能防篡改，不作高風險考試；不放秘密。若將來高風險評量，另需可信端驗證 |
| Out of scope | 月球／多天體引力、登陸／回收／對接、完整六自由度剛體、結構破壞、燃料管路、熱損傷、氣動升力、多人模式、登入、雲端存檔、整段飛行錄影匯出 |
| 可用平台 | 現代桌面、平板及支援 WebGL 2 的手機；實際最低裝置以 P1／P5 實測界定 |
| 首版 3D 範圍 | 真正透視投影、可旋轉鏡頭、立體零件和球形地球；飛行位置／速度以三維向量計算，但推力與運動受限於固定平面，沒有首版傾角任務 |

### 技術選型

**採 Three.js 0.185.1 + 原生 JavaScript + HTML/CSS 控制介面；物理採獨立可測試的 JavaScript 數值模型。**

| 選項 | 判斷 |
|---|---|
| Three.js | 採用。現有重心活動已有 0.185.1、本地 ES modules 與 LICENSE；適合少量模型、鏡頭、軌道曲線及自行控制的物理 |
| Babylon.js | 能勝任，但本活動不需要整套引擎附帶的編輯器／碰撞物理整合；改用它會加入第二套 3D 依賴 |
| 通用剛體物理庫 | 首版不採用。核心是中心引力、可變質量推進、分級和軌道計算；不靠碰撞引擎代替這些模型 |
| 原生 WebGL | 能做到，但需自行處理過多繪圖細節，沒有本活動的具體收益 |
| WebGPU | 不作首版必要條件；使用 Three.js WebGLRenderer 的 WebGL 2 路線 |
| React／建置框架 | 不新增；保留靜態頁、Live Server、相對路徑和既有打包方式 |

- 依賴固定採已在 repo 的版本，不在本輪升級。實作時將同一發行檔及 LICENSE 複製到本活動 vendor/three-0.185.1/，核對 hash，維持本活動可獨立打包；不重構另一活動的 vendor 路徑。
- 現有兩個 minified JS 合計約 751 kB（未壓縮檔案長度），不是整個 ZIP 大小承諾。
- 沿用現有 ES module 匯入方式；Three.js 不負責飛行積分、評分或答案儲存。
- 首版模型用 Three.js 幾何體組裝；不引入遠端材質、模型 CDN、大型 HDR、角色動畫或 glTF 載入器。後續只有確認需要時才加資產。
- 介面文字、按鈕、量表用 DOM；舞台數學標籤用可縮放的 DOM/SVG overlay，保持中文和數學可讀性。
- 使用局部投影命中區、既有 pointer/capture 模式與簡單相機控制；不為少數固定視角引入額外控制插件。

### 預定 runtime 文件與影響範圍

| 文件 | 責任 |
|---|---|
| index.html、styles.css | 三區版面、可存取控制、舞台／panel／fullscreen markers |
| parts.js | 教學零件參數、裝配相容規則、載荷與目標變體；不含使用者答案 |
| model.js | 位置、速度、質量、引力、推進、阻力、分級、時間積分 |
| orbit.js | 軌道參數、撞地判斷、節點定位、預覽；與 model 共用物理常數 |
| scene.js | Three.js 場景、模型、相機、縮放、資源釋放及 context recovery |
| interaction.js | 命中區、拖放、姿態／節點控制、手勢暫態 |
| scoring.js | 只從已保留且合法的紀錄重算 100 分 rubric |
| persistence.js | schema、語義驗證、快照、還原及 4000-byte 檢查 |
| main.js | 任務狀態、UI 串接、shared lifecycle glue；不另寫 commit/finish |
| vendor/three-0.185.1/ | three.module.min.js、three.core.min.js、LICENSE |
| tools/rocket-space-mission-browser-regression.js | 一個有明確 owner 的 source／package 瀏覽器回歸 |
| 既有 registry／catalogue／manifest／README | 登記資源、測試、可用活動與操作說明；不修改其他活動答案 |

上述是責任邊界，實作時小型邏輯可合併；避免為每個視覺部件建立新架構。

## Catalogue metadata (`sim/config.js`)

| 欄位 | 預定值 |
|---|---|
| title | 火箭工廠與太空任務 |
| folder | rocket-space-mission-lab |
| categories | Mechanics |
| description | 組裝立體火箭，控制發射與分級，把衛星送入軌道，再親手規劃變軌任務。 |
| tags | physics、mechanics、gravity、rocket、orbital-motion、3d、scorm |
| status | 初次 runtime 登記 planned；有可部署並驗證的活動才改 active |

本輪只有計劃，不新增 catalogue 空入口。

## Physics or subject model

### 世界與簡化邊界

- 採球形、固定、首版不自轉的地球：R = 6.371 × 10^6 m，μ = GM = 3.986004418 × 10^14 m³/s²；比衝換算 g₀ = 9.80665 m/s²。這是教學常數，不宣稱含地球自轉／非球形擾動。
- 物理一律 SI、JavaScript double。位置原點在地心；初始發射台 r = (R, 0, 0)，初始相對地球速度為零；初始順行切向為 +y。
- 真實尺度決定重力與速度；只加快模擬時間，不偷偷縮小地球、降低入軌速度或補推力。
- 火箭在跟隨視角按米級顯示；軌道視角用放大的標記代表飛船，標示「飛船圖示非同比例」。不把渲染尺寸帶入碰撞／引力。
- 發射／燃燒限制於 xy 平面。相機可在三維繞看；學生明白「觀察角度」與「飛行方向」是兩個控制。
- 所有物體的中心引力持續存在；入軌不關掉重力，關機不把速度歸零。
- 大氣採平滑教學模型：ρ(h) = 1.225 exp(-h/8500) kg/m³，80–120 km 用連續 taper 降到零，120 km 以上真空。不是精密標準大氣。
- 阻力為 -½ρ C_d A |v|v，C_d = 0.35、A = 3.14 m² 作固定教學值，無風、不計升力／熱損傷；UI 明確列為簡化。主線不要求辨認氣動細節。

### 零件與裝配

以下為教學火箭的初始參數，P1 必須以實際積分證明有多種可成功設計，才凍結 modelVersion。

| 零件 | 乾質量 | 推進劑／能力 | 學生會感受到的差異 |
|---|---:|---|---|
| 衛星載荷 | 120／150／180 kg | attempt 變體固定其中一種 | 載荷影響整體加速；三變體都必須可完成 |
| 小燃料箱 | 100 kg | 1500 kg 推進劑 | 較輕、續航較短 |
| 大燃料箱 | 400 kg | 6000 kg 推進劑 | 可燃燒更久，也增加起飛質量 |
| 大推力引擎 | 500 kg | 600 kN、I_sp = 300 s | 較適合起飛，較重 |
| 高效率引擎 | 150 kg | 80 kN、I_sp = 340 s | 較省推進劑、推力較低 |
| 級間分離器 | 60 kg | 分開上下級 | 去掉耗盡級的乾質量；剩餘燃料亦隨棄級失去 |

- UI 可簡稱「燃料」，說明其包括燃料與氧化劑，不需要從空氣吸氧。
- 最多兩級，每級一個引擎及 1–4 個燃料箱。上下順序：衛星 → 上級箱／引擎 → 分離器 → 下級箱／引擎；單級亦可嘗試。
- 以明確接點／槽組裝，支援加入、替換、移除及小／大箱數量。不是任意物件堆疊的結構模擬。
- 缺引擎／缺箱是合法未完成設計；可保留及提交，但不能點火。弱推重比設計可嘗試點火，火箭留在發射台並消耗燃料，不由 UI 禁止探索。
- 首版不提供一鍵載入完整火箭；用接點提示引導組裝，避免預設成品代替學生設計。
- 分級只棄掉下級；上級繼承同一位置與速度，不憑空加速。分離瞬間油門歸零，學生再點火；上級推進劑不被下級引擎使用。

解析可行性初查：150 kg 載荷、下級大推力引擎＋4 大箱、上級高效率引擎＋1 大箱及分離器，起飛總質量 32,860 kg，推重比約 1.86，理想總 Δv 約 11.39 km/s。**這只是忽略重力／阻力損失的預算，不是成功入軌證據。** P1 須找出實際可飛控制序列、另一成功設計與失敗對照，不能用加分或隱藏加速補救不足設計。

### 更新規則

| State variables | Update rules / formulas | Units / bounds |
|---|---|---|
| r、v | dr/dt = v；dv/dt = -μr/‖r‖³ + F_thrust/m + F_drag/m | m、m/s；三維有限數，平面約束 z、v_z = 0 |
| 推進劑 p_i、總質量 m | m = 衛星＋仍連接乾質量＋剩餘推進劑；dp_active/dt = -u F_max/(I_sp g₀) | kg；0 ≤ p_i ≤ 該級容量 |
| 油門 u | 0–1；無燃料／未點火時推力為零 | 無量綱；顯示 % |
| 俯仰 β | 由當地向外徑向朝順行切向轉；β = 0° 向上，90° 沿當地水平；允許 0–180° | 控制目標角，限速追蹤 12°/s，不把飛行速度旋到機身方向 |
| 姿態輔助 | 對準當地俯仰／沿速度／反速度；只改推力方向，不直接修改位置、速度或軌道 | 操作簡化，不宣稱剛體姿態動力學 |
| 分級 | 移除下級與分離器質量、保留 r/v；棄級純視覺，碰撞計算只追蹤主飛船 | 防止重複分離、負質量 |
| 落地 | 已離地的主飛船穿越 ‖r‖ = R 時定位接觸事件，停止該次飛行 | 不穿過地球；低推力未離地以台面支承約束 |
| 逃逸／遠離 | 比能 ε ≥ 0、徑向向外且離地高度達 100,000 km，標示離開本任務區域並停下 | 不把橢圓遠地點判成逃逸 |

軌道參數從 r/v 重算：ε = |v|²/2 - μ/|r|；a = -μ/(2ε)（只對束縛軌道）；h_vec = r × v；e_vec = (v × h_vec)/μ - r/|r|；e = |e_vec|；r_p = a(1-e)、r_a = a(1+e)。安全性用離地高度 h_p = r_p-R、h_a = r_a-R。近徑向、近圓、拋物線邊界均定義可顯示分支，不能除零或顯示 NaN。

### 積分、預覽與時間

- 主模型用 RK4；燃燒或大氣中最大子步 0.1 s；真空滑行最大子步 2 s。燃料耗盡、分級、接觸地面與開始／終止燃燒切在事件邊界，不跨過後再補值。
- 物理步長與畫面 fps 無關。時間快轉只增加子步數，不把 dt 乘成巨大的步長。每幀有運算上限，追不上時放慢時間快轉並顯示實際倍率，不丟物理步。
- 可選 1×、5×；真空關機後另開 20×、100×、1000×。開始燃燒或接近大氣／地面時自動降至 ≤5×。可在暫停時修改控制，按繼續才影響後續運動。
- 變軌預覽採同一模型的有限推力燃燒。學生設定 Δv 是累積推力加速度積分 ∫F/m dt 的目標，非飛船速率的直接增量；方向可隨速度更新。
- 節點選「下一次近地點／遠地點」，在明顯圓軌道可選任意軌道相位；近圓時不顯示不穩定的遠近點標籤。
- 預覽包含燃燒時間與耗油，燃料不足要顯示可達結果；不畫出實際無法達成的完整理想軌道。執行前若初態改變，重新預覽。
- 虛線「現在關機後路徑」在大氣中用含阻力模型；「變軌後預覽」只在任務 B 的安全真空軌道可編輯。
- 預覽重算節流至最多 5 Hz，拖放結束補算精確版本；單次阻塞目標 <80 ms，必要時拆批讓出主執行緒，先不加 Worker。
- 背景／失焦及 WebGL context loss 暫停飛行，回來要明確繼續。以 visibilitychange／blur 處理模擬暫態，不另寫 pagehide／pageshow 或 LMS 關閉邏輯。
- 成果軌道可由保存的物理狀態重建；本頁可提供最近一次試飛的有限採樣回放，最多 600 點，只存記憶體，不把完整時間線塞進 SCORM。重新進入 Moodle 保留任務快照，不能宣稱保留完整試飛影片。

### 校準與物理驗收目標

- 200 km 圓軌道，依本計劃 R/μ 算得 v 約 7.79 km/s、周期約 88.4 min；以解析值驗證實作。
- 真空關機圓軌道積分 10 圈：相對能量與角動量漂移各 <10^-5；將 dt 減半後任務判定一致。
- 真空無重力引擎 fixture 的 Δv 與 I_sp g₀ ln(m₀/m₁) 差 <0.1%；燃料消耗、質量減少與推力一致。
- 理想短時近／遠地點變速用解析式交叉檢查；正式有限燃燒的預覽／執行差以收斂測試判定，不強求瞬時公式完全相同。
- 三個指定配對變體（120 kg／600 km、150 kg／800 km、180 kg／1000 km）全部有可完成路徑；學生不必知道開發測試的控制序列。
- 60/30/15 fps、不同快轉倍率、暫停／恢復下，同一控制序列的終態在數值容差內一致。

## Responsive layout contract

| Decision | Activity specification and reason |
|---|---|
| Three regions | Header：標題、任務 A／B／紀錄導航、共享全屏。Stage：3D、簡潔讀數、鏡頭控制。Panel：部件或當前飛行控制、單一主要動作 |
| Fullscreen | 整個活動根節點 data-sim-fullscreen-target，header data-sim-fullscreen；shared/fullscreen.js，44 px 可按區，20 px 圖示 |
| Desktop / tablet | ≥960 px：stage＋約 320 px panel；stage 至少約 65% 可用寬；橫向短畫面 ≥640 px 且高 <520 px 採兩欄，panel 約 40% 寬 |
| Control-panel classification | bounded split-panel；飛行中需要同時看舞台與操作，panel 獨立捲動 |
| Phone stage and controls | P27：直向控制區 clamp(240px, 42dvh, 360px)，包含固定飛行操作列；剩餘空間給 stage。低於520px的窄視窗控制區clamp(172px,calc(100dvh - 275px),220px)，優先保留約200px舞台以避開角落儀表／鏡頭列；panel獨立捲動，不依賴fullscreen。 |
| 數字例子 | P27設計預算：390×664、header約74px，stage約311px、controls約279px，其中可捲內容約206px；390×460，stage約200px、controls185px，其中可捲內容約112px。實測證據見P27；較早P22/P23高度為歷史。 |
| Phone text | 主字／控制 16 px；次要字≥14 px；關鍵舞台讀數≥16 px；固定寬度 tabular numerals，符號不隨數值位數移動 |
| Viewports | 320×568、375×667、390×844、430×932、768×1024、1280×800、1920×1080、844×390、640×360、390×460 iframe、200% zoom、鍵盤／工具列變動 |
| Scroll topology | 活動根無競爭捲動範圍；panel overflow-y:auto＋contain；舞台空白／側條原生捲動 enclosing owner；T0–T4 實測 |
| 相機 | 工廠斜視／發射跟隨／全地球軌道／軌道正視四個 preset；每種有回正。手機 zoom 用＋／−，不要求雙指精準操作 |
| 讀數 | 初期只顯示 h、沿地面方向速率、燃料；展開才看 h_p、h_a、總速率等。單位固定；飛船後方不掛大面積文字 |
| 動畫敏感／無障礙 | 支援減少動態、關掉鏡頭自動轉場；暫停與鍵盤替代可用；重要結果以文字可讀，不只靠顏色 |

### 3D 效能與故障

- 單一 WebGL canvas，切換場景共享 renderer；dispose 舊幾何／材質，不反覆建立 context。
- 目標首包 ZIP ≤5 MB、無外部請求；畫面約 ≤100 draw calls、≤100k 三角形，手機 pixel ratio 上限 1.5、桌面 2。
- 真機目標持續 ≥30 fps、操作回應 ≤100 ms；首次可操作在測試中階裝置及正常校內網路 ≤5 s。必須記錄裝置／瀏覽器／網路，不能用桌面數字代替。
- 用較低陰影／粒子／地球細節作自動視覺降級，不改物理模型或答案。
- 無 WebGL 2 時展示可讀的技術訊息、已存紀錄和允許的提交／回看入口；不把靜態圖稱為完成的 3D 模擬。
- context lost 暫停並保存可用模型快照；恢復後重建 scene，不扣燃料、不自動點火。恢復失敗仍可保留／檢查已完成部分；pending／review 保持鎖定。
- 本活動的 3D 驗收要求真 WebGL 2；故障狀態的無障礙／scroll／SCORM 路徑另測，不作功能替代。

## Navigation, submission and reset

| Decision | Activity specification |
|---|---|
| Navigation | mixed：A、B、紀錄可直接選；A 的裝配→發射→保留紀錄有資料依賴；B 可用 A 快照或明確選練習初態 |
| Final check access | 所有可編輯階段都有「任務紀錄／檢查並提交」，包括空白工廠、飛行中、未設定節點、失敗後 |
| Incomplete submission | 顯示未保留成果及其零分影響，保留獨立部分分數，允許空白提交；不彈警告視窗 |
| Editable reset | 「回工廠」停止目前試飛並保留裝配；「重新試飛」用當前設計起飛；兩者保留已選任務紀錄。「移除這份紀錄」才清除該份，提供頁內撤銷直到下一次實質編輯 |
| Scored / pending | 無改裝、點火、重試、清紀錄；可旋轉觀察已交成果、改鏡頭及全屏；pending 只開合法同一 payload retry |
| 變更依賴 | 修改裝配只影響下一次飛行，不能改寫已保存紀錄；替換 A 紀錄不改寫正在做的 B 初態，B 明確重新帶入時才更新 |
| 形成性回饋 | 試飛期間允許顯示物理結果、任務目標達成及原因；不顯示正式總分／Moodle 結果，提交後才給正式分數 |

同時只運行一艘飛船。切換 A／B／紀錄頁籤只暫停並切換畫面，不替換目前 flight；另一任務以頁內明確按鈕「結束目前試飛並開始任務 B／重新試飛 A」啟動。按鈕旁說明會替換未保留的飛行狀態，並提供先保留紀錄的入口，不彈確認窗。既有 A／B records 和工廠草稿始終保留；僅觀看另一任務不丟進度。

| Step / question | Required upstream data | If missing or changed | Legal next actions |
|---|---|---|---|
| 裝配 | 載荷變體和槽位 | 部分配置合法 | 編輯、去紀錄、提交 |
| 發射 | 可點火拓撲；推重比不足不是拓撲錯誤 | 缺引擎／箱顯示對應接點；不造設計 | 返回裝配、去紀錄 |
| 保留 A | 學生發起的自建火箭試飛快照 | 未試飛為 null；進行中先暫停 | 保留／替換、繼續、檢查 |
| B 初態 | 可用 A 安全軌道，或學生選練習飛船 | 無初態為合法空白 | 帶入／選練習、檢查 |
| B 節點 | 安全束縛真空軌道、可用燃料 | 無燃料仍可看預覽限制；不補油 | 改計劃、換初態、檢查 |
| 保留 B | 學生確認並已執行至少一段點火 | 初始練習飛船不計分 | 保留結果、再變軌、檢查 |

## Diagrams, notation and assistance

| Decision | Activity specification |
|---|---|
| Notation | h 為離地高度、r 為地心距離；v 用速率讀數，箭頭另標 v 向量；Δv 表示計劃推進變速量；m、F、T、h_p、h_a 的數學字體遵循 baseline |
| 箭頭與路徑 | 推力、速度箭頭與真方向一致；火焰沿推力反向。實際路徑實線、關機路徑短虛線、變軌預覽另一色長虛線＋圖例，不能只靠顏色 |
| 地球／飛船比例 | 軌道位置按同一地心尺度；飛船圖示可放大並標示。局部跟隨視角採浮動渲染原點，model 仍用地心座標 |
| 接點 snap | 手指／滑鼠均 30 CSS px；限可相容可見槽，拖曳期間預覽，釋放用同一解。不要自動選最有利零件 |
| 節點 snap | 手指 24 px、滑鼠 14 px 對可見近／遠地點；一般圓軌道允許自由相位，按鈕同等可用 |
| 油門／姿態 | 油門 5% 操作格、俯仰 2° 操作格，皆可按鈕細調；這是輸入解析度，不是得分容差 |
| Touch preview | 接點附近顯示穩定上角放大實景預覽，因指尖會遮槽；節點顯示軌道局部與已 snap 節點。油門／視角旋轉無須放大，數字旁置即可 |
| 教學輔助 | 自動姿態穩定、暫停、時間快轉、節點執行；不自動替學生安排完整起飛曲線或圓化答案 |

## Touch gesture ownership contract

採 [製作指南手勢契約](../docs/simulation-scorm-production-guide.md#selective-touch-gesture-ownership)。首版不以整個透明 canvas 攔截觸控。相機以明確「轉動視角」模式啟動中央有可見邊界的 orbit surface；普通模式空白仍可捲動 host。

| Target type / modes | Visible footprint / hit area | Capture / touch-action before down | Keyboard alternative |
|---|---|---|---|
| 零件／接點 | 投影到畫面、局部 44 px target；空隙不覆蓋 | 穩定 HTML target，none | 選裝配級＋點零件直接加入、數量增減按鈕 |
| 油門把手 | 44×44 px，位於 panel | none，只把手拖動；panel 其他區正常捲動 | range／±5% |
| 俯仰把手 | 舞台局部圓弧與44 px把手 | none，camera 固定 | ±2°、向上／水平 |
| 變軌節點 | 軌道上局部44 px target | none，camera 固定 | 近地點／遠地點／相位增減 |
| Δv 控制 | panel 中原生 range＋±按鈕 | none 於 range 實際互動區 | 原生鍵盤 |
| 相機 orbit 模式 | 明確可見中央區；兩側各≥32 CSS px | none，穩定 capture；模式離開即移除攔截 | 方向鍵、preset、zoom ± |
| 回放時間把手 | panel 內可見44 px範圍；review只改觀看 | none | 左右鍵 |
| 普通文字、圖例、空白 | 無透明互動蓋層 | pan-y | 不適用 |

| Touch starts on | Owner | Activity strategy | Evidence |
|---|---|---|---|
| 舞台空白／零件間空隙 | enclosing host | pan-y、保持根無捲動 | P4 待跑 |
| panel 中間／頂底 | panel only | contained native scroll，不改 parent styles | P4 待跑 |
| 宣告相機旋轉區 | simulation | 只改相機，不卡主題控制 | P4 待跑 |
| 左／右側條 | enclosing host | 320 px 寬各32 px，其他尺寸至少同寬，overlay不得蓋住 | P4 待跑 |
| 每種拖把手／接點 | simulation | 捕捉穩定，pointermove/up；非 owner 座標固定 | P4 待跑 |
| review／pending 空白 | enclosing host | 移除編輯 targets；允許明確相機控制 | P4 待跑 |

優先原生捲動。若某 Moodle topology 不通，先確認真 owner，再按指南設計及驗證 adapter；不盲目呼叫 parent/top.scrollBy，不改 enclosing overflow 掩蓋問題。

| Host case | Frame chain / actual owner | Origin / mechanism | Evidence |
|---|---|---|---|
| T0 | standalone bounded activity；無外部範圍 | host movement N/A，panel／gesture仍測 | source＋extracted 待跑 |
| T1 | outer document → activity iframe；outer window 為 owner | 中性 same-origin fixture，原生 pan | source＋extracted 待跑 |
| T2 | outer document → bounded wrapper → activity；最外 window | wrapper 不得變 owner | source＋extracted 待跑 |
| T3 | outer document bounded → #player-scroll overflow element → activity | #player-scroll 為 owner，所有 windows 固定 | source＋extracted 待跑 |
| T4 | 實際 Moodle current-window／offered new-window | 記錄實際 origin、sandbox、元素／window owner；未有環境不得猜 | 真手機／Moodle 待驗 |

| Phase / mode | Legal fixture / continuation | Touch coverage |
|---|---|---|
| 空白／部分／完整工廠 | production 加零件、返回修改 | 接點、零件、旋轉模式、空白、側條、panel |
| pad／升空／分級後／滑行 | production launch 和分級 | 油門、俯仰、鏡頭模式、空白、panel |
| impact／escaped／暫停 | 真模型事件或合法還原後繼續 | 非法控制不存在，重試可用、空白可捲 |
| B 未選／選初態／node preview／burn | production 選擇、配置、執行 | 節點、Δv、旋轉、取消、panel |
| check→返回 A／B | 正常導航 | 保存依賴、每種重編輯手勢 |
| review／committed／frozen | shared startup fixtures | 只有觀看／retry，沒有改答案 |
| WebGL unavailable／lost／restored | 真初始化故障／context extension | 技術資訊、保留紀錄、全屏、panel／host |
| 200% zoom／方向切換 | 上述每種不同命中幾何 | target 重新投影、preview無遮擋、最後控制可達 |

所有行在 source 和 extracted package 測 T0–T3、兩方向、快速 flick、panel 邊界、取消、失焦、第二指及 pointer capture。記錄每次 move／release 的 owner、所有非 owner 與 canonical 答案；連續飛行時間另列，不能用它掩蓋手勢改答案。T4 驗收與桌面可信觸控分開記錄。

## Scoring and tolerance

採 **100 分形成性任務成果評量，60 分達標**；不是競速或「一次成功」測驗。評分只讀學生按「保留為任務紀錄」選定的快照；展示／練習預設不自動給分。

| Rubric component | Points | Exact condition |
|---|---:|---|
| A：可起飛設計 | 10 | 已保留自建／學生發起試飛紀錄；合法裝配，當時完整初始配置的滿油門起飛推重比 >1.05 |
| A：到達太空高度 | 10 | 同份紀錄的當前高度 h ≥100 km；在該高度可隨時暫停保留，不必完成整圈 |
| A：安全束縛軌道 | 20 | ε<0、h_p≥150 km、h_a≤1000 km，該快照未 impact/escaped |
| A：目標接近圓軌道 | 20 | h_p及h_a都在200–400 km，e≤0.03；由 r/v 重算 |
| B：遠地點到目標 | 15 | 已保留學生實際執行點火後紀錄；束縛軌道，h_a在目標高度±10% |
| B：近地點到目標 | 15 | 同類合法點火後紀錄；束縛軌道，h_p在目標高度±10% |
| B：完成圓化 | 10 | h_p、h_a均在目標帶且e≤0.03、安全；不要求使用固定兩次點火方法 |

- A 的四項分開判定；B 可用練習初態獨立取得分數。不同合法設計／點火策略都按結果評分。
- 自建配置與保留飛行狀態來源必須一致。修改工廠草稿不改已保存 record。
- 空白 record = null，該任務零分；完全 untouched attempt =0。沒有「已按過幾次」分數，不因失敗次數或耗時扣分。
- 練習初態 B 必須真的開始燃燒、推進劑減少，才有可保留的 B 證據；載入練習飛船本身零分。
- 真正任務成果會即時顯示，符合探索取向；正式分項得分只在提交後給出。
- 保存全精度，畫面才四捨五入。高度界線包含端點；數值比對 epsilon =1 m，e epsilon=10^-6；TWR epsilon=10^-6，ε束縛要求嚴格為負。
- 例：h_p=149,998 m 不得算安全，150,000 m 可；800 km 目標帶720–880 km，719,998 m 不通過；e=0.03001不通過。
- 拖放 snap 容差獨立於上述評分容差；模型積分誤差必須比評分帶窄得多。
- 重試保留上一份紀錄；學生選擇新紀錄後才替換，不自動挑歷來最高分。

## Phase/state matrix

以下是 activity 的語義 phase；running／paused 是模擬暫態。Moodle 恢復一律停在同一物理時刻等待繼續，不自動扣燃料。

| Phase / variant | Required semantic state | Absent / retained | Legal continuation / check |
|---|---|---|---|
| workshop：空白／部分／完整 | variant、editable craft；部分件允許null | flight可null，兩份records可null | 組裝；合法後到pad；任意檢查 |
| pad：可點火／推重比不足 | 不可變flight craft、滿箱、r/v初態、t=0 | 沒有node/burn | 點火、回工廠、檢查 |
| ascent：燃燒／關機／一級耗盡 | flight物理狀態、控制、燃料 | node=null | 繼續、關機、分級、保留、檢查 |
| ascent：分離後 | active=1、下級已移除、上級燃料合法 | 不可再分級 | 再點火、保留、檢查 |
| coast：束縛／未安全／非束縛 | 無推力、可重算軌道或無束縛標記 | records保留 | 繼續、點火、停下保留、檢查 |
| ended：impact／escaped | 終止事件狀態、t>0 | 目前run不可繼續飛 | 回工廠／重試、看紀錄、檢查 |
| mission：B尚未選初態 | flight=null、node=null | A與B已選records可保留 | 明確帶入A／選練習、檢查 |
| mission：B初態／滑行 | source=own或practice，合法安全軌道 | B零操作也合法，record仍null | 放node、繼續、檢查 |
| planning：未完整／有效／燃料不足 | B flight＋node；node量值可0 | 不足可顯示但不能宣稱成功 | 改node、取消、可執行時確認、檢查 |
| armed：等節點 | B flight、已確認node且事件未到 | 上一次burn可保留，開始新燃燒才替換 | 滑行至點火、取消、檢查 |
| burning：進行／中途關機 | burn含初態、已消耗量及累積Δv | node仍保存作審查依據 | 繼續／關機、保留已完成部分、檢查 |
| check：空白／部分／完整 | records可null、backPhase有效 | 飛行暫停但完整保留 | 明確submit、回原工作繼續 |
| review：成功／committed | canonical review answer；無可編輯flight | 已交record可部分／空白 | 觀察／全屏；committed只finish retry |
| frozen：合法／無效pending | shared envelope；合法者可重算 | 不可改records | 同payload retry；無效者quarantine |
| technical：load/render error | 可判可信資料及錯誤種類 | 不能創造成功狀態 | renderer可恢復／已知可編輯者檢查；LMS不明者技術鎖 |

| Transition / trigger | Preconditions | State changes / downstream effects |
|---|---|---|
| 換零件 | workshop且editable | 只改下一次craft；不改records／舊flight |
| 開始試飛 | 完整拓撲、學生確認 | 新flight不可變配置；records不清 |
| 保留A／B | 合法自建試飛／已執行B點火 | B若仍燃燒先暫停並關機，標記interrupted；克隆該狀態與來源，替換對應record |
| 檢查 | 任一editable phase | 暫停，不丟flight／node，記backPhase |
| 從check返回 | 尚未提交 | 還原phase、保持暫停，讓學生明確繼續 |
| 提交／pending | shared outcome | 清所有拖曳、停止積分；按合法結果鎖／恢復編輯 |
| context loss | 任意phase | 相同語義phase＋暫態render fault；不把它變成新attempt |

## Persistence contract

採 [snapshot/restore contract](../docs/simulation-scorm-production-guide.md#snapshot-and-restore-contract)。以下為精確語義欄位；序列化短鍵／tuple 由 schema v1 固定映射，不在不同phase改變意思。

### 權威型別

| Type | Exact schema / validation |
|---|---|
| Craft | {payload:0或1或2, stages:[Stage或Stage,Stage], separator:boolean}；workshop的stage engine可null、箱數可0，最多兩級；flight必須完整。stage次序由下至上 |
| Stage | {engine:null或0或1, small:0..4整數, large:0..4整數}；0=大推力、1=高效率；small+large≤4，flight時≥1；不保存計算所得重量 |
| VectorState | [x,y,z,vx,vy,vz] 六個finite number；z/vz必須0；空間半徑與速度設定合理上限，impact狀態允許邊界接觸 |
| Controls | {mode:tilt或prograde或retrograde, angle:0..180, throttle:0..1, lit:boolean}；angle單位degree，模型姿態另保存 |
| Flight | {source:own或practice, craft:Craft, t:finite≥0, state:VectorState, fuel:[p0,p1或null], active:0或1, separated:boolean, attitude:0..2π, controls:Controls, status:pad或flying或impact或escaped}；attitude為xy平面從+x計的慣性姿態rad，與當地俯仰不同 |
| Node | null 或 {at:periapsis或apoapsis或phase, angle:0..2π, direction:prograde或retrograde, dv:0..2000, confirmed:boolean, fireAt:null或finite≥0}；angle採同一地心平面；近圓採phase；確認時求出模擬時刻fireAt，恢復不延至下一圈 |
| Burn | null 或 {status:active或completed或interrupted, before:VectorState, beforeFuel:[p0,p1或null], startTime:finite≥0, achievedDv:finite≥0, targetDv:0..2000, direction:prograde或retrograde}；實際減燃料且時間增加才構成已執行；燃燒結束後保留到下次點火或新試飛 |
| ARecord | null 或 {craft:完整Craft, state:VectorState, fuel:[p0,p1或null], active:0或1, separated:boolean, t:finite>0, status:flying或impact或escaped}；只能由own run的保留動作產生 |
| BRecord | null 或 {source:own或practice, craft:完整Craft, before:VectorState, after:VectorState, fuelBefore:[p0,p1或null], fuelAfter:[p0,p1或null], active:0或1, separated:boolean, elapsed:finite>0, direction:prograde或retrograde, achievedDv:finite>0}；保留最後一次已完成／中止點火及其後滑行狀態 |
| Draft answer | {schema:1, modelVersion:1, variant:0..2, phase:editable枚舉, backPhase:null或editable枚舉, craft:Craft, task:A或B, flight:Flight或null, node:Node, burn:Burn, records:[ARecord,BRecord]} |
| Review answer | {schema:1, modelVersion:1, variant:0..2, records:[ARecord,BRecord]}；無flight/node/camera，足夠重算／重畫已選成果 |

- 三種 variant 固定映射載荷120/150/180 kg及B目標600/800/1000 km，避免不必要的任意連續隨機值；同一attempt不得重抽。
- 無回答用明確 null／空配置；欄位缺失、非法enum、負燃料、重複分級、craft/fuel容量不符、stage倒置是無效資料。
- flight craft是當次出發設計，與workshop草稿可以不同；records是獨立凍結選擇，不能以「與最新草稿不同」為由丟棄。
- B帶入A時克隆已保留安全軌道的配置、r/v、燃料和級狀態，油門／點火歸零，B時鐘從0開始。練習飛船固定單級高效率引擎＋1小箱（1500 kg推進劑）＋variant載荷，無分離器；初始r=(R+300000,0,0)、v=(0,√(μ/‖r‖),0)、t=0。不提供自訂初始速度輸入；record來源驗證不等於防篡改。
- 首版B不分級；不改飛行配置。單級active=0、separated=false；兩級分離後active=1、separated=true，下級fuel欄固定0，不以null冒充仍可用級。
- 未確認node的fireAt=null；armed的fireAt≥flight.t，開始燃燒時startTime=fireAt且burn.status=active；中斷／完成轉為滑行並保存burn。重開Moodle先暫停，明確繼續後才接續原燃燒。
- task指出目前試飛所屬A或B；頁籤viewTab是暫態，還原預設回目前任務。只切頁籤不改task、phase或flight；check才以backPhase保存返回點。
- before/after必須是同一stage／配置，燃料減少、時間正向，無非有限值；重新計算軌道和質量，不信任保存的成功旗標、分數、h_p/h_a、TWR。
- 數值邊界：t≤604800 s；|r|在R附近至R+10^8 m；|v|≤30000 m/s；燃料≤各級容量；超出UI可產生範圍拒絕，不能偷偷clamp成另一個合法答案。
- 長時間運行到界線前自動暫停並提示本次任務範圍；不可先寫入無法還原的值。
- 精確的能力／相依驗證用production constructor和mutation路徑建立fixtures；不能由測試捏造另一套state。

| State category | Treatment |
|---|---|
| Authoritative | 上述configuration、當前物理狀態、控制、node/burn、選定records和phase |
| Transient | pointer、hover、snap preview、DOM、Three物件、renderer錯誤狀態、running、viewTab、快轉倍率、相機及600點試飛回放；還原為暫停／預設可讀鏡頭 |
| Derived | 總質量、推重比、軌道參數、HUD文字、所有網格／軌道line、得分與過關徽章 |
| Version compatibility | schema=1/modelVersion=1；未知版本不重新解釋。參數調整在發佈前完成；已發佈更動需明確新版本與遷移或舊版本支援 |
| Size | Draft目標≤3200 UTF-8 bytes；review目標≤2200；包含shared pending-final的轉義reviewJson後仍≤4000。P1先用最大兩級／兩份records／active burn狀態量測 |
| 超出大小 | 禁止交付超標方案；先縮短固定鍵和省去derived，不降精度、不刪已選成果、不用外部儲存繞過限制 |
| Invalid editable | 只有shared狀態確認未提交才提供頁內「重新載入空白草稿」並清理覆寫；預設不自動丟答案 |
| Invalid finished | 持續鎖定，只顯示可信LMS摘要，不偽造可回看的3D成果 |
| Invalid pending | quarantinePending後技術鎖；不retry受污染內容，不開放重設 |

saveDraft在裝配完成動作、點火／關機／分級、暫停、node確認／取消、保留紀錄及導航時發生；不在pointermove或每幀commit。setDraftProvider回傳最新完整物理狀態，shared lifecycle負責離開頁面時的保存。保存／恢復不得額外消耗燃料。

## Shared SCORM lifecycle

使用 shared/scorm.js、shared/activity-flow.js；startup用loadAttempt＋startup，submission用submitWithCallbacks＋submission，四個outcome共用同一路由。

| Outcome / policy | Handler |
|---|---|
| editable | 新建或合法還原draft，註冊provider，飛行暫停待繼續 |
| review | decode→rescore→reviewResult比較；可信時重畫records及得分，全部已交操作鎖定 |
| frozen | 驗證nested review及canonical answer，合法才retry同payload；無效quarantine |
| load-error | 技術鎖，保留錯誤與可信摘要，不標示已交／不合格 |
| success | 已確認提交，read-only |
| committed | 已commit但finish失敗，成果保持鎖定，只提供finish retry |
| frozen submission | 不能確定完成，凍結答案，顯示待確認，不顯示確定分數 |
| retry | retryable=true可回到編輯／重試；false顯示技術失敗，不聲稱已交；飛行保持暫停 |
| trust mismatch／unknown | 不用本地旗標覆寫LMS結果；unknown用不確定標籤 |
| Standalone refresh | memory-only，刷新空白新練習；不讀／寫持久答案，storage denied也可用 |
| Moodle resume | 同attempt保留草稿、已交或pending；新attempt只能由LMS建立 |
| Render failure | 物理／答案仍在記憶體及合法草稿；renderer可復原。LMS技術失敗不得當standalone繼續 |

## Test plan

### 有意義的測試與檔案

| Test | Required executed evidence |
|---|---|
| model.test.js | 質量／耗油、推力、pad支承、分級守恆、撞地、RK4收斂、快轉與fps無關、三變體可完成及失敗對照 |
| orbit.test.js | 圓／橢圓／徑向／逃逸邊界；r與h區分；短時變速解析對照；finite-burn preview與實際執行一致 |
| scoring.test.js | 空白0、所有獨立部分分數、練習初態零分、practice不給A分、合法不同策略、所有容差just-inside/outside |
| persistence.test.js | 每個phase/variant真encode/decode/restore並執行一個合法下一步；最大draft/review/pending≤4000；無效欄位／依賴／版本測試 |
| interaction.test.js | 接點選擇、capture/cancel、相機與物理控制分開、node修改／取消、check返回、record替換不污染另一任務 |
| lifecycle.test.js | 實際production outcome/render，startup四態、submit四態、retryable真假、invalid final/pending、trust mismatch、unknown |
| tools/rocket-space-mission-browser-regression.js | source與extracted ZIP：組裝→試飛→保留→B變軌→提交→還原；可信touch、全屏、WebGL初始化／丟失／恢復、console與request錯誤 |
| 既有mobile-scroll runner | 登記本活動完整phase/mode表，T0–T3 source/package；T4手動部署證據獨立 |

固定回歸序列只作開發驗證；不將一組答案寫成學生必須照做的流程。圖形檢查實際看見火箭、地球、軌道、數學標籤，不只檢查canvas存在。

### Test registration and CI selection evidence

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resource declaration | sim/manifests/rocket-space-mission-lab.xml列全部runtime、Three兩個module、LICENSE和四個shared檔；scope由manifest反向依賴 |
| Logical entries | sim/rocket-space-mission-lab/model.test.js、orbit.test.js、scoring.test.js、persistence.test.js、interaction.test.js、lifecycle.test.js；全入registeredTests |
| Browser owner | file=tools/rocket-space-mission-browser-regression.js，kind=browser，scope=rocket-space-mission-lab；同entry跑source與package，不重複登記 |
| Case helpers | 首版盡量使用現有helper。新增專屬helper須依 *-browser-cases.js命名，登記helpers及真實import consumer |
| Manual gates | 沿用已登記mobile-scroll矩陣作部署檢查；若新增獨立runner須列manualBrowserTests、scope及原因。真手機／Moodle不是免測理由 |
| check:tests | P0無新測試／runtime；實作後每新增entry執行並記結果，現階段待執行 |
| committed selection | 實作commit後跑 npm run test:affected -- --base=<已驗證main SHA> --head=HEAD --plan；記錄確切SHA、owner browser及package |
| full verification | 初次registry/catalogue變更預期全範圍；dependency／shared變更亦全範圍，不繞過CI選擇 |
| GitHub evidence | 實作後記錄run URL／SHA／狀態；不等CI才給試用連結，但不得將pending當passed |

- [ ] 空白／部分／不同策略和容差邊界評分已通過。
- [ ] 每個可編輯phase可進檢查並提交；recorded/pending無清除／重啟。
- [ ] phase/state matrix所有行以production schema round-trip並執行合法continuation。
- [ ] invalid-state矩陣及含轉義pending的4000-byte上限已執行。
- [ ] source及extracted standalone刷新清空，Moodle同attempt恢復；舊checkpoint／storage denied不污染新standalone。
- [ ] 所有3D故障／低畫質／手機尺寸／文字／snap／preview路徑已驗證。
- [ ] shared fullscreen在editable/review/pending及denied狀態均通過。
- [ ] source與extracted全部T0–T3可信手勢、release、邊界及不變量通過。
- [ ] registration和committed selection證據完整。
- [ ] 實測效能及物理校準達標，或明確調整並重新審查交付限制。

## 實作分期與審查點

| Phase | 具體交付 | 驗收及提交節奏 |
|---|---|---|
| P0 本輪 | 本分支＋完整計劃 | 文件連結／模板章節／diff檢查；commit＋push計劃，等待使用者審查 |
| P1 風險驗證 | Three場景基礎、可測physics／orbit、最大snapshot草模；一組真正可入軌及變軌序列 | 核對WebGL手機候選、物理收斂、燃料可行性、SCORM容量。只稱技術預覽；測試後commit＋push，有可見版本才部署Sites |
| P2 工廠與發射 | 完整拖放／點選組裝、飛行控制、分級、相機、診斷及A紀錄 | 手機操作＋A實際成功／失敗路徑；commit＋push＋Sites試用 |
| P3 軌道任務 | B獨立初態、節點預覽、有限燃燒、圓化、紀錄與最終rubric | 所有變體／邊界、兩種不同策略；commit＋push＋Sites |
| P4 整合與package-ready | 完整SCORM lifecycle／restore、manifest/catalogue/registry、全屏、故障恢復、README | package-ready全套、source/package矩陣、完整必需測試；commit＋push＋部署並報CI狀態 |
| P5 Moodle-ready | 真Moodle學生attempt及真手機驗收紀錄 | 真實提交／續做／pending／review及T4；只有證據具備才標Moodle-ready |

每輪更新此計劃的實際證據。Sites使用本活動獨立站點，封裝當前commit的完整相對路徑資產；部署後核對build標識、network、實際入口及手機布局。第一次有runtime時才建立站點，不部署只有計劃的空頁。部署操作屆時遵循Sites skill與工具契約。

### 需在P1消除的風險

| 風險 | 具體處理／停止聲稱完成的條件 |
|---|---|
| 3D手機效能或WebGL不支援 | 實機量測、降視覺成本；未通過前不聲稱手機ready，不用靜態替代冒充3D完成 |
| 火箭看似合理但無法入軌 | 先證明動力與控制可行，再裝飾；校準零件參數須更新modelVersion決定和所有相關fixture |
| 1000×引起穿地或漏事件 | 步長不放大、定位事件、限制每幀步數；同控制序列結果一致 |
| 座標尺度使近景抖動 | 地心double model＋camera-relative render；軌道／近景轉換測試 |
| 節點預覽與實際不一致 | 同有限燃燒模型、重算初態、驗證耗油與停止條件，禁止理想圖冒充可執行結果 |
| SCORM裝不下飛行草稿 | 最大shape及pending-first驗證；不存路徑／Three物件；不犧牲恢復或精度 |
| 太多控制使學生只忙操作 | 初期平面飛行、姿態穩定、暫停、分情境panel；P2用手機完成整條流程再定稿 |

## Package-ready checklist

- [ ] 決策、phase/variant、rubric、snapshot和所有證據齊全。
- [ ] 小手機、短iframe、橫向、200% zoom保持可讀、控制可達，符合本計劃panel預算。
- [ ] npm run check、npm test、npm run package:all通過；記命令、版本、報告與ZIP位置。
- [ ] npm run package -- rocket-space-mission-lab產生獨立ZIP；根有imsmanifest.xml。
- [ ] 每個runtime資產宣告完整，無CDN、測試fixture或開發檔進包；斷網仍可載入既有本地資產。
- [ ] git diff --check及實際base差異檢查通過。
- [ ] built/extracted啟動、完整任務、SCORM、可信手勢與全屏通過。
- [ ] Windows瀏覽器檢查遵循製作指南Git Bash路線；CLI即使exit 0但含「### Error」也視為失敗。
- [ ] Sites部署與提交SHA一致，試用入口經驗證；CI狀態如實回報。

## Moodle-ready checklist

- [ ] package-ready已達成；真Moodle學生帳號提交分數／status成功。
- [ ] 未完成flight草稿恢復到相同時刻並暫停，燃料／裝配／node／records一致。
- [ ] pending重試、committed finish retry、完成後review-only及LMS新attempt符合契約。
- [ ] T4真手機完整phase/mode手勢矩陣，在current-window及提供的new-window player執行，記實際owner與origin。
- [ ] WebGL初始化及context復原在目標手機／Moodle iframe可用。
- [ ] 高風險server驗證：N/A，本活動僅形成性；不可把此項解讀為可用於高風險考試。
- [ ] 真Moodle、真手機及尚未驗證限制與本地證據分開列明。

## 參考與P0證據

- [Three.js WebGLRenderer官方文件](https://threejs.org/docs/pages/WebGLRenderer.html)：WebGL 2需求；查閱2026-10-24。
- [Babylon.js Havok整合文件](https://doc.babylonjs.com/features/featuresDeepDive/physics/havokPlugin/)：一般剛體引擎與WASM整合；用於技術比較，不是本活動依賴。
- [NASA Rocket Thrust Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/rocket-thrust-equation/) 與 [Specific Impulse](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/specific-impulse/)：推進與耗油關係。
- [NASA Ideal Rocket Equation](https://www1.grc.nasa.gov/beginners-guide-to-aeronautics/ideal-rocket-equation/)：僅作理想Δv預算與模型測試。
- [NASA Gravity & Mechanics](https://science.nasa.gov/learn/basics-of-space-flight/chapter3-4/)：入軌和近／遠地點變速的教學物理。
- 現有 [重心3D renderer](../sim/centre-of-mass-investigation-lab/part3-renderer.js) 與 [其manifest](../sim/manifests/centre-of-mass-investigation-lab.xml)：確認本地Three版本／資源打包模式；不把舊活動手機證據套用到本活動。
- P0文件檢查（2026-10-24）：node tools/check-docs.js plans/40-rocket-space-mission-lab.md 通過；模板全部14個二級章節齊全；Markdown表格欄數一致。提交前另以git diff --cached --check檢查實際新文件差異。
- P0只提交本計劃至codex/rocket-space-mission-lab；commit SHA及push結果以Git紀錄和本輪交付回覆為準，不在文件內預先宣稱遠端成功。
- 上述為P0設計紀錄；實作證據及與初始規劃的差異如下，不將預算當成已通過結果。

## 實作紀錄與驗證證據

### P1–P3：模型與可操作版本（2026-10-24）

- 已完成本地Three.js 3D工廠、跟隨／地球／正視鏡頭、點選與拖放組裝、發射／油門／俯仰／分級、任務B節點與有限推力預覽及執行、任務紀錄及共用SCORM流程。
- 已執行六個活動Node測試：model、orbit、scoring、persistence、interaction、lifecycle均通過。三載荷均由真實推進、阻力及重力積分入軌，三目標均由兩次有限燃燒達到40分；合併A/B成果為100分，未操作／練習初態為0分。
- 第二種設計亦已驗證：下級3大箱／大推力引擎，上級1大箱／高效率引擎，150 kg載荷，約202–217 km軌道且剩餘推進劑；與4大箱方案採不同轉向控制序列。
- 真空10圈能量／角動量漂移、火箭方程、分級、低推重比台面支承、撞地與逃逸邊界已測。逃逸fixture由兩次實際2000 m/s推進產生，並在100,000 km範圍邊界停止。
- 草稿／review採固定tuple codec，保留原始double精度、恢復固定平面零分量；包含最大草稿、active burn、兩份成果及轉義pending的容量測試通過。tuple欄位由persistence.js固定，與上方語義schema對應。
- 續做會暫停；已確認節點保存fireAt，燃燒保存active／completed／interrupted；pending另保存不可變canonical比較字串，防止同分但不同答案的重試。
- 任務B的可操作安全界線為近地點≥150 km、遠地點≤20,000 km，與A評分界線分開，容許1000 km目標附近的有限燃燒誤差及探索；超出總範圍的束縛軌道只暫停，不錯稱逃逸。
- 此版提供本頁600點最近實際路徑，未加入時間軸回放控制；Moodle保留權威飛行快照。
- npm ci --no-audit --no-fund使用既有lockfile，未新增／升級依賴。三維vendor與既有來源hash相同。
- npm run check:tests：278 entries（240 Node、38 browser、48 helpers、2 manual）；npm run check通過。
- 第一輪source／extracted ZIP browser已通過20個桌面／手機布局、可信零件／節點拖動、操作、提交、續做、pending／finish retry、standalone刷新、全屏與真WebGL context loss／restore。後續改動須以P4最終報告runtimeHash重新核對。
- 真手機效能、校內網路首載與真Moodle尚未執行，不能稱Moodle-ready。
- Sites已建立獨立private項目appgprj_6adc62579ab88191aba299bcb282ce95；身份亦即時保存在本地專用Sites checkout的.openai/hosting.json，避免重建同一站點。發布結果待P4補記。

### P4：試用版交付證據（2026-10-24）

- 最終程式提交：00d37e065670c78e60f5c6361e0818c2cad1cc38；專用分支已push。其後文件提交不改runtime。
- 最終活動browser報告：output/playwright/rocket-space-mission-lab/report.json，completed=true、errors=[]；runtime SHA-256為69a1b513de4f5c5d333be2f85012ff07ac1477e3460db6c56c7436852a04f00d。source及extracted ZIP的20個布局、桌面／橫向手機變軌、可信拖放、放大預覽避讓、空白／100分提交、續做、pending／finish retry、全屏、context loss／restore及繪圖例外後保留答案並提交均通過。
- 完整觸控矩陣：source及package的T1/T2/T3各40 cases，standalone source／package的T0各14 cases；共268 cases、2304 gestures、0 issues。證據位於同目錄scroll-source-T1/T2/T3.json、scroll-package-T1/T2/T3.json、scroll-standalone-T0.json、scroll-standalone-T0-package.json。相機／節點包含完成、取消、第二指、失焦及lost capture；真手機T4仍未執行。
- 全項目Node回歸：240/240通過，output/tests/rocket-full-node.json；後續新增即時節點與最大兩級active-burn草稿測試亦已專項重跑通過。
- npm run check、npm run check:tests及npm run package:all通過，證據為output/rocket/check-final.log、registry-final.log、package-all-final.log。所有SCORM包均已驗證；本活動ZIP為output/rocket-space-mission-lab-scorm.zip。
- 已提交選擇預覽記錄於output/rocket/committed-selection.log；新增catalogue／registry選取全量檢查。GitHub Quality未等待完成；額外全項目browser回歸已停止以免拖延交付及繼續佔用本機資源，其不完整報告不作通過證據。活動專項browser及上述觸控矩陣均已完成。
- 試用站：https://simlab-rocket-space-missions.ieyp.chatgpt.site （owner-private）；最後觸控修正已成功部署並保持同一網址；Sites來源提交e1aaa059b9788dfaed8c8adbf0ea55d82d289857，deployment appgdep_6adc6ed5d6308191be8351d28324a509，native結果succeeded。站點build-info.json記錄來源commit及ZIP hash。
- 交付定位：可操作的形成性SCORM試用版。package-ready的全量回歸gate仍待確認；Moodle-ready未達成，真Moodle／真手機／校內網路效能尚未驗收。沒有聲稱完整飛行影片、三維自由軌道傾角或多天體任務。

### P5：首次操作回饋修正（2026-10-24）

- 使用者回報按「下級」、控制區按鈕及拖放看似無反應。本機可信滑鼠事件未重現全部失效；確認舊流程中零件按鈕只選取、未選零件按接點會無聲返回，且拖曳沒有隨指標移動的零件標示。
- 改為預設裝配主級，點一下零件即加入；兩級時先選目前裝配級。舞台接點改為選級，與控制區同步標示；相同引擎、箱數上限及放錯位置均有頁內回饋。新增滑鼠／觸控共用的拖動標籤與30 CSS px接點容差；release先清除active，避免lostcapture重入。拖動標籤位於fullscreen目標內，不攔截輸入。
- 保留原配色與三區布局；手機先展示級數及零件，載荷資訊移至其後。「拖動視角／結束轉動」明示相機模式。快照schema、評分、物理模型及已保存答案未改。
- 六個活動Node測試通過；npm run check:tests通過（278 entries）。最終活動browser source及extracted ZIP完成20種布局；各有桌面可信滑鼠、手機可信觸控從空白裝配開始，Enter鍵加入、編輯區移除、兩級選擇、箱數上限、滑鼠／觸控拖放與取消、點火推進、任務B、提交／鎖定／續做／重試及全屏／WebGL故障恢復通過。報告completed=true、errors=[]，runtime SHA-256：0f8beeeea84963e700e859908b6196cf85f7820e4cfa94f6f6d1434639c75d46。
- 舊P4全觸控矩陣屬當時版本；本次僅重跑本活動專項，沒有重跑全庫Node／browser或完整觸控矩陣。真手機與真Moodle仍未驗證，不宣稱已重現並排除使用者裝置的所有失效。
- 修正版已commit／push：8f726c809e6e42f3a263165280e0593c73a0cc83；Sites來源ca5be107437f45aaafb6b054430bf38c6920f87b，deployment appgdep_6adc7313a6688191bbc2bccb7dd4ac5a native結果succeeded，保持原owner-private網址。ZIP SHA-256：1622b3af9a07b25c497b226487bf54e922beb3d301ec1d3bb8049db628b57d40。未等待CI。

### P6：拖入／拖回及連續升空環境（實作決策，2026-10-24）

- 依使用者指定參考Circuit Workbench的palette preview、有效snap、release提交、取消復位及panel discard。只參考手勢，不改電路共用核心。變更範圍為本活動parts/model、interaction、scene、main、HTML/CSS、既有Node／browser測試及本計劃；不新增依賴。
- 元件箱拖入：引擎只可入空的引擎位，燃料箱只可入未滿四箱的燃料位；拖錯位置不修改答案。保留點選／鍵盤加入及數量控制作替代操作。舞台上的已裝引擎或燃料箱可直接拖走，放回元件箱（控制區）才移除，亦可移至另一個相容級；未放到有效位置、取消、失焦或失去capture均回原位。衛星載荷與兩級分離器由任務／級數決定，不能作散件移除。
- 已裝零件採實際3D幾何raycast；單一穩定HTML grip貼合可拖零件的畫面投影及局部touch halo，不攔截周圍空白或側條。元件箱及安裝拖動均有實際零件外觀預覽；相機在拖動中固定。只在有效release執行一次model change及共用保存，預覽不改答案。
- 沿用權威craft的每級engine／small／large計數，不新增持久id或改snapshot版本；同類燃料箱可互換。新增原子transfer action，同時驗證來源存在與目的相容後才搬移或移除；不污染既有flight／records。評分／SCORM／phase/variant matrix均沿用現行契約；workshop可改，check／pending／review均不可改。
- 飛行在同一局部地平座標顯示發射台、地面、道路、樹木／建築及雲層；場景位置隨實際飛船位置連續改變，不再以是否剛離地切掉地面。依高度連續變暗的天空、漸現星空及高空地球曲面建立高度參照。跟隨鏡頭逐漸拉遠，火箭圖示適度放大並明示，物理計算仍用原本真實尺度。背景只是教學視覺，並非地理重建或大氣光學模型。
- 驗證：既有六個Node測試加入相容性、原子移除／搬移、失效目的不動及保存往返；本活動source＋extracted ZIP browser驗證可信mouse/touch拖入／拖回／搬移／錯位／取消，原有提交鎖定及手機布局，並檢查點火前後地面連續、不同高度天空漸暗與圖像預算。真手機／Moodle及全庫回歸不以本次本地證據代替。

- P6完成證據：六個活動Node測試通過（含相容性、原子搬移／取出、check不可改、保留已有A紀錄、移除後codec往返）。npm run check、npm run check:tests、文件及diff檢查通過。
- 最終source／extracted ZIP專項report.json為completed=true、errors=[]；runtime SHA-256：290f0f03e1f33294605287b911412b4decd0c60108b1739b835e8c68cefc0ace。兩份產物各驗證1280×800可信mouse及390×844可信touch的完整拖入／拖出／移級／錯接／已有引擎拒絕／取消復位；直接拖到實體接合處亦可吸附。記錄實際pointerdown目標，拖動期間panel／stage／visualViewport／相機保持固定；點選已裝零件同步目前裝配級。共用check／submit／pending／review、全屏與WebGL故障測試仍通過。
- 同一真實模型的直上飛行在1 m、約100 m、1 km、20 km、50 km、69 km、71 km、100 km、140 km採樣；地面／發射台位置隨高度連續，天空fraction單調由0至1，70 km附近無跳色。實際畫面人工檢視1 m／1 km／20 km／71 km／140 km及手機組裝截圖；高空globe作背景、詳細地面負責depth，避免兩個表面相交閃爍。採樣最高77262 triangles、58 draw calls，在原圖像預算內。
- ZIP：output/rocket-space-mission-lab-scorm.zip；圖像及報告：output/playwright/rocket-space-mission-lab/；靜態檢查：output/rocket/check-p6.log。此證據限本地Chrome及模擬觸控，未重跑全庫browser／完整iframe觸控矩陣，未驗真手機／真Moodle／校內效能。未等待CI。
- P6已commit／push：e14d77ae1440c3a15cba496a176982780e4ad18b；提交選擇預覽output/rocket/selection-p6.log已產生。Sites來源1374c85b32d126f3c66127e5571e105f11572a2d，deployment appgdep_6adc8303394881918f0cfdafb5f2b0ca，native結果succeeded，維持原owner-private網址。ZIP SHA-256：3023b99e881620bc8d11a517778071b8e76073b75d8bd8dbd076eb80d4f549fa。


### P7：手機滾動、獨立手柄及原位裝配預覽（2026-10-24）

- 元件卡圖片／名稱／資料使用原生縱向滾動；只有明示「⠿ 拖動」的44 × 44 CSS px以上手柄攔截拖動。卡片輕點及鍵盤Enter／Space仍可加入零件；手柄輕點不安裝。保留舞台已裝零件拖出／移級。
- 組裝不再開獨立放大視窗。有效接點以同一production model action計算臨時craft，在原舞台顯示整枚火箭安裝後的排列，固定相機及原接點幾何；pointerup才提交及保存。離開接點／取消／失焦／第二指／lost capture恢復原模型。變軌標記的既有放大預覽不變。
- 錯位／已有引擎／四箱上限不改答案，舞台顯示短暫「無法安裝」警告。正常拖動中顯示放手安裝提示。評分、快照、SCORM schema、phase/variant及manifest依賴不變。
- 驗證決策：沿用已登記活動browser owner及六個Node測試；擴充可信touch的卡片上掃／下掃、各手柄、原位整體預覽／草稿不變、有效release、無效drop警告、取消及跨級搬移；source與extracted ZIP均執行。真手機／Moodle另列，未驗證前不宣稱通過。

- P7執行證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）及diff檢查通過。沿用既有browser owner，source與extracted ZIP各通過10種布局；各在320×568、390×844及844×390以可信touch從元件圖／名稱／資料開始掃動，面板滾動而答案／LMS草稿／舞台／根視窗／visualViewport不變，沒有開始元件拖動；四手柄均≥44×44 CSS px。
- source及package各有1280×800可信mouse與390×844可信touch驗證：手柄起手、無獨立組裝preview window、原位預覽不改答案／保存、release後craft與預覽完全相同、錯位／已有引擎拒絕、拖回元件箱及跨級搬移。有效接點上的取消、blur及lost capture亦恢復原模型；錯位顯示舞台「無法安裝」警告。保留點選及Enter鍵加入；原有變軌預覽、提交／鎖定／續做／重試、全屏及WebGL故障恢復仍通過。
- report.json：completed=true、errors=[]；runtime SHA-256：dda32d54749e3fab8c4eace101e02fa9b63502a78c9071ae4bd1cafa81a60a97。報告及手機原位／錯位截圖位於output/playwright/rocket-space-mission-lab/。SCORM包：output/rocket-space-mission-lab-scorm.zip；ZIP SHA-256：c83909ad60ee42e8d085addd5ad782c7a8401db7ff5ec091bb3476331c18fab8。未重跑全庫Node／browser及完整iframe觸控矩陣；真手機、真Moodle、校內效能仍未驗證，未宣稱Moodle-ready。
- P7已commit／push：d20e220f1a74c7affa370817197ca16055587fcd；提交選擇預覽output/rocket/selection-p7.log已產生。使用者明確要求再部署後，Sites來源6c3639cc35f8d3bce20a14c29bc11a85e268239a、deployment appgdep_6adc965cbbf08191819b2917fb168408，native結果succeeded，維持原owner-private網址https://simlab-rocket-space-missions.ieyp.chatgpt.site。此輪僅部署已驗證產物，未重跑測試或等待CI。


### P8：拖動中即時失效提示及緊湊頂欄（2026-10-24）

- 修正P7只在放手後提示的缺口：零件在舞台內未對準相容接點時立即顯示「無法安裝」，持續按住不逾時；移至有效接點、離開舞台、取消或返回元件箱即清除。從palette拖回控制區視為取消，不顯示安裝錯誤；已裝零件拖回元件箱仍為正常取出。invalid release保留短暫提示。
- 頂欄移除英文品牌／標語，狀態移入操作面板；桌面短標題與導航同列，手機只保留同列三個導航與共享全屏控制。保持按鈕≥44 CSS px、不遮擋、不橫溢。標題仍可供輔助技術讀取；不改共享樣式。
- 變更限本活動HTML/CSS、interaction/main、既有browser owner及本計劃；物理、rubric、phase/snapshot、SCORM與manifest依賴不變。測試沿用六個Node測試及source/extracted ZIP owner，新增未放手即提示、超過2.6秒仍顯示、同手勢失效→有效清除、返回元件箱無錯誤、頂欄高度／導航與全屏可達性。

- P8完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件及diff檢查通過。source與extracted ZIP的20種布局，頂欄均53 CSS px，三導航及共享全屏掣均≥44 CSS px高、不重疊、無橫溢；390×844手機截圖人工檢視通過。
- source/package各以1280×800可信mouse及390×844可信touch驗證：零件仍按住時無效位置已有警告，保持2.8秒仍顯示，同一手勢移至空白／有效接點即時切換提示；palette拖回元件箱不改答案且放手後沒有安裝警告，已裝零件拖回仍正確取出。原位預覽／release一致、取消／blur／lost capture、原有滾動、任務、SCORM、全屏及WebGL故障恢復均通過。
- report.json：completed=true、errors=[]；runtime SHA-256：7b2c7be1dedf0ebd1394179d1074dcd0985388eb930440c441bd9efa5fec531c；ZIP SHA-256：d24702cad2eedf7c20fa8f4119dbb6a3560827e0d79e93459fecde8887f82cf4。報告及invalid-held手機／桌面截圖在output/playwright/rocket-space-mission-lab/；ZIP為output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser、完整iframe矩陣；真手機及真Moodle仍未驗證。
- 發布偏好（使用者2026-10-24明確指示）：已批准本活動網站發布，要求同一網站後續修改不要每次重新詢問。對既有appgprj_6adc62579ab88191aba299bcb282ce95、原私人讀者範圍及本活動範圍，完成必要測試後直接沿用授權部署；不增加聊天確認。工具審批層的拒絕仍須如實處理，不得繞過。
- P8已commit／push：ab8749f80e39eb0efbc44708f8f71acad0121918；選擇預覽output/rocket/selection-p8.log。使用者再次明確確認網站發布授權後，Sites來源267cfedf98fcbd60074242bd50655174c214ab5e、deployment appgdep_6adc9e673428819195fafbe48b830c2c，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；發布已測試產物，未重跑測試或等待CI。


### P9：燃料箱接縫插入與重排（2026-10-24）

- 新燃料箱可拖至引擎上方、任兩個燃料箱之間或最上方；同級及跨級的已裝燃料箱可直接拖到接縫重排。引擎仍只在每級底部，每級最多四箱；載荷／分離器沿用任務決定。保留手柄、原生滾動、原位完整預覽、release一次提交、錯位／取消還原與即時警告。
- 最小模型擴充：stage沿用engine/small/large作質量與容量，新增可選order字串（s/l，由下至上）。只在非舊有「大箱在下、小箱在上」順序時保存order；三欄舊stage按原排序讀取。所有改數量、插入、指定ordinal取出／同級移動／跨級搬移同步計數與次序，先驗證目的才原子修改。modelVersion不變，排列不改物理與rubric。
- Snapshot相容擴充：既有schema/envelope仍為1；stage tuple原[engine,small,large]照常讀取，可選第4欄order（最多4個s/l，數量必須相符，canonical次序不重複保存）。draft、flight、records、review與pending均用同一codec。未知欄位、錯誤順序／次數／插入索引均拒絕；4000-byte gate及舊快照回讀需執行驗證。
- UI以每級頂部接點加各接縫的可視標記提供30 CSS px snap；穩定原接點與相機，預覽不改答案。活動outer layer將flat snap target解為stage/at傳入production model；不靠renderer私藏次序。
- 測試：擴充既有model/persistence及browser owner，不新增依賴或test entry。Node檢查首／中／尾插入、重排、精確取出、容量／索引／鎖定、計數守恆、舊新codec及有序飛行／紀錄續做／容量。source/extracted ZIP各以可信mouse/touch在異種箱之間插入、取消、同級重排、跨級搬移，實際預覽與保存一致，並重跑原有回歸。真手機／Moodle仍獨立驗收。

- P9執行證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件與diff檢查通過。新增中間插入、同級／跨級／精確ordinal搬移、滿箱與非法索引拒絕、次序／質量／容量守恆、check鎖定測試；所有變體的舊／新codec、錯誤order拒絕及有序workshop/pad/ascent/active-burn/check/review往返與合法續做通過，含有序紀錄pending 4000-byte gate。
- source及extracted ZIP各有1280×800可信mouse與390×844可信touch：兩大箱中間插小箱成large/small/large、取消不變、同級重排、四箱滿時拒絕新增、精確選取第2大箱跨級插入及非拖放重排控制通過；預覽期間答案／LMS草稿／相機／scroll均不變，release與完整預覽一致。20種布局、原手柄／面板滾動／即時警告、任務／SCORM／全屏／WebGL故障回歸亦通過。桌面及手機middle-insert截圖已人工檢視。
- report.json：completed=true、errors=[]；runtime SHA-256：8977c59daa6e73af806da938c8620a31eae53063f4b0761bf39d5562ea672b1c；ZIP SHA-256：5a5aba9063391ac5bd6dd6a523f4c55075bd7446c2a6819db81f094629620995。報告及截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser及完整iframe矩陣，真手機／Moodle仍未驗證。
- P9已commit／push：643e59e887b637f9f8067817d9416f1683cb10f9；提交選擇預覽output/rocket/selection-p9.log。沿用使用者明確持續發布授權，Sites來源a7901506a168c3fee6ea6ae03dfe98bb5dc81147、deployment appgdep_6adcac65d5dc8191bbf9694b8ef5ba78，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P10：清晰標題／控制、空曠發射台與外圍景觀（2026-10-24）

- 頂部恢復常見可見標題，手機以20px標題列＋44px導航列呈現，總高≤80px；桌面同列。刪除舞台英文／大標語／副標，不讓文字遮火箭。導航改為組裝發射、軌道任務、成果提交；鏡頭只留有標籤選單與轉動開關，縮放／回正移到面板可展開的「鏡頭設定」。
- 保留既有明示相機模式及兩側≥32px捲動區。開／關相機模式、選鏡頭、縮放均不暫停或啟動物理；只改顯示。以實際running狀態標示「飛行中／已暫停／待發射」，暫停與繼續按鈕命名清楚；發射台只顯示「點火發射」，避免無效果的播放控制。
- 關機／分級是物理控制，不再暗中改running；運行中關機後滑行、分級後可點火上級，原本暫停時仍保持暫停。規劃／檢查／提交、失焦、技術故障及恢復仍遵守現有暫停契約；模型方程、評分及保存schema不變。
- 發射台周圍至少350m不設樹木／建築，保留清楚平台與混凝土底座；移除貼近火箭的裝飾燈柱。外圍添加河流／河岸、森林群及遠方建築／道路，全部本地低面數幾何、instancing，仍守100 draw calls／100,000 triangles預算與連續升空環境。
- 範圍：本活動HTML/CSS/main/scene/ui-runtime、既有lifecycle/browser測試與計劃。新測試覆蓋可見緊湊標題／無舞台標語／導航全屏可達、清空區及實際pad截圖、運行／暫停時相機mode可信touch、關機／分級後時間繼續。沿用owner重跑source/ZIP、手柄／接縫、SCORM／故障／高度採樣；真手機／Moodle仍獨立驗收。

- P10完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。新增Controller測試證明關機與分級保留running，原本暫停時操作不會偷偷恢復；check／提交／技術故障暫停契約沿用原有測試。
- source及extracted ZIP各以1280×800及390×844驗證可見頂欄標題、無畫面標語、鏡頭選單及開關；20布局頂欄高度集合為[53, 75] CSS px，導航及全屏按鈕可達、不重疊。縮放／回正收納面板，stage只留鏡頭／轉動視角。SVG裝配導線以真正hidden屬性切換，發射／飛行不再殘留接點導線；A任務恢復預設follow，避免在發射台卻見地球遠景。
- 發射平台空曠底座及兩個額外yaw角度、桌面／手機畫面已人工檢視；樹木中心最近450m，建築中心距離>650m，96棵樹與12座遠方建築、河流／河岸在場景內。原真實模型升空高度採樣及天空漸變通過，採樣最高80018 triangles／58 draw calls。
- 四組source/package可信mouse／touch流程證明：待發射只有明示點火、運行時開關／拖動相機仍繼續計時、原本暫停時開關相機不啟動、關機後滑行／分級繼續、暫停與繼續按鈕及狀態文字一致。原手柄／接縫插入／即時警告、任務／SCORM／續做／全屏／WebGL故障恢復仍通過。觸控測試等待實際pointer事件／回饋處理完成，不以固定20ms幀時限判失敗。
- report.json：completed=true、errors=[]；runtime SHA-256：baf97c1bce712e33b984daf89f72e652ce1eea06860c8b274df12157aee5f506；ZIP SHA-256：bd11c9113dd19f071b255b0770be7012ebecbfe4f03ee4587a859b62859d1b54。報告及clear-launch-pad／flight-controls／ascent截圖在output/playwright/rocket-space-mission-lab/，ZIP為output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser或完整iframe矩陣；真手機／Moodle與校內效能未驗證。
- P10已commit／push：9063559d77bec20cd066093782158f69ecf52d70；提交選擇預覽output/rocket/selection-p10.log。沿用使用者明確持續發布授權，Sites來源6ff0bb7d48cc7913e7b681ef3c142d1e1e7df21d、deployment appgdep_6adcb380f5188191a206e58b17929e91，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P11：直接操作火箭與可見頁面的相機失焦（2026-10-24）

- 使用者要求刪除重複的各級引擎選單／數量控制，以及無清楚作用的「＋上級／下級」。保留元件卡加入／手柄拖放、火箭實際零件點選／搬移，只有空級顯示與模型空位重合的「拖入零件」入口；已裝級直接按零件決定裝配級。點選零件才出現取出／上移／下移工具，鍵盤可從火箭本身逐件選取並操作，不再列兩份完整編輯器。
- 失焦只清理暫存手勢／預覽；真正document.hidden才暫停飛行且不自動恢復。原window.blur無條件pause是可見的手機／iframe操作仍可能停飛的路徑；不聲稱已重現使用者實機。規劃、提交、技術故障等既有暫停及鎖定仍保留。
- 範圍：本活動HTML/CSS/main及既有browser owner；不改物理、評分、snapshot schema、manifest或依賴。沿用原有低風險教學評分及所有階段／變體往返契約。測試更新所有舊選單caller、直接點零件／鍵盤取出重排、空級可達、容量拒絕，並加入相機可信touch期間失焦取消但時間繼續／背景事件暫停且不自動恢復的回歸；source與extracted ZIP同跑。真手機／Moodle仍需獨立驗收。

- P11完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source及extracted ZIP共20布局；1280×800 mouse、390×844與320×568 touch加入／點選取出、鍵盤裝配與移除最後零件後焦點返回空級均通過。兩級已裝零件直接點選、精確接縫插入／重排／跨級搬移、滿箱拒絕及鍵盤選取後調位通過；舊選單及常駐「＋上級／下級」均不存在。桌面及390px零件工具截圖已檢視，工具位於火箭旁、不遮火箭，且按鈕位於舞台內。
- source／ZIP各於1280×800及390×844在運行中可信touch轉鏡頭，再注入可見window.blur：取消手勢但running／飛行時間繼續；注入document.hidden／visibilitychange則暫停，恢復可見／focus亦不自動恢復。失焦來源以事件回歸覆蓋，並非使用者實機重現。原待發射／明示暫停繼續／關機滑行／分級、SCORM保存／提交重試／review恢復／全屏／WebGL故障回歸亦通過。已提交review無craft欄位，空級提示必須安全隱藏，不可影響確認成績。
- report.json：completed=true、errors=[]；runtime SHA-256：79ecf036a78aefa3e5897d7c32663c3440cb84c0589026bd107c9ba9e5af29cf；ZIP SHA-256：4f045f2c86da9cd96dcbbee36ef276b8d3325d297f162ca577910c8288a99e18。報告及part-tools／onboarding／flight-controls截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser或完整iframe矩陣；真手機／Moodle與校內效能仍未驗證。
- P11已commit／push：d4ee2fd0e2046e94cdacb2f63d4a1d5bd5eca5ab；提交選擇預覽output/rocket/selection-p11.log。沿用使用者明確持續發布授權，Sites來源1d9e34ad5fda3dbb2111ecb986be7f4aeed049ad、deployment appgdep_6adcca3e8bd88191962e7258617b60ca，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P12：預設直接旋轉、兩側捲頁把手與鏡頭按鈕（2026-10-24）

- 使用者明確要求將火箭以外背景改為預設orbit surface，取代P10/P11的先按轉動開關；中間舞台為宣告的相機操作區，左右各32 CSS px全高保留原生pan-y。沿用Circuit Workbench的小型32×64px可見捲頁把手圖案／原生捲動方式；不加host bridge、手動scrollBy或頁面樣式鎖。此要求取代先前背景一律host-owned的活動決定；面板仍獨立捲動。T0獨立全屏頁本身零捲動範圍；iframe T1/T2的外層document或T3的overflow owner才是兩側手勢的實際捲頁目的地。
- 中央背景mouse／touch直接旋轉，不顯示虛線框／提示框，不啟動或暫停物理、不保存答案；零件實際raycast／24px觸控局部容差仍為裝配拖放，grip內未命中零件則交相機。變軌標記保留自身手勢、鍵盤及preview。取消／失焦／第二指／lost capture只清理手勢，真正hidden才暫停，恢復可見不自動播放。
- 左下角改四個≥44px的近景／跟隨／地球／俯視按鈕，刪除選單和轉動開關；依上下文禁用不可用鏡頭並用aria-pressed標示。地球改明顯斜角，俯視沿軌道法線，實際投影／鏡頭位置需不同；相機切換不改答案或running。預覽／工具／鏡頭控制不能攔截兩側32px捲頁區。
- 範圍：本活動HTML/CSS/main/interaction/scene、既有rocket browser owner、mobile-scroll fixture/operations caller及本計劃。不改依賴、manifest、物理／評分／snapshot schema；沿用原有低風險評分及所有phase/variant保存契約。驗證source／extracted ZIP的mouse/touch直接轉動、旋轉及切鏡不中斷時間、paused不自啟、readonly不改答案、零件／節點原流程、20布局及320px把手可達；另跑中立iframe可信touch左右原生捲頁及面板隔離，記錄實際拓撲／覆蓋。真手機／真Moodle仍獨立驗收。

- P12完成證據：六個活動Node測試、npm run check、手機scroll acceptance單元測試、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP各1280×800 mouse及390×844、320×568、844×390 touch，無模式按鈕直接拖背景、方向鍵旋轉、兩側32px命中區及左下角≥44px鏡頭按鈕通過；原20布局及元件卡原生捲動／手柄拖放／即時預覽／中間插入／鍵盤調位／兩級搬移均通過。
- source／ZIP各以1280×800 mouse及390×844 touch在飛行中直接轉鏡頭、實際地球／俯視／跟隨切換，camera.position與active按鈕一致，running及時間繼續；原本paused不會自啟。組裝／唯讀旋轉不改答案或保存；失焦取消但續飛、hidden暫停及不自動恢復、關機滑行／分級、SCORM提交／恢復／鎖定／全屏／WebGL故障亦通過。手機與桌面direct-camera、三鏡頭截圖已人工檢視；未顯示相機虛線框。
- 中立host可信touch source及package各完成T1（單層iframe、390×844、camera-surface）、T2（有界中介iframe、320×568與390×844、camera-surface及planning）、T3（外層overflow元素owner、320×568、camera-surface），共12 cases；左右stage strip上下掃動實際外層owner，activity document／visual viewport／panel及答案不變；panel text／button starts、邊界／取消／連續掃動與之後stage掃動隔離通過，未寫host鎖樣式。相機／變軌操作的complete、cancel、secondary、blur、lostcapture通過，無遺留preview。報告scroll-p12-source/package-T1/T2/T3.json均completed=true、status=passed、errors=[]且全部gesture issues=[]；共同runtime digest ff32f69daeca8ff6de295d268be50aa9d2c6b3ed5b2b6b53e6601e347a40f4a3。T0獨立頁零外層捲動範圍，未主張把手可捲動不存在的頁面高度；真Moodle／跨origin receiver未測也未新增。
- 主report.json：completed=true、errors=[]、42 flows；runtime SHA-256：56cb098a2ee0bc4c9c67e97a86481a4bc86b92e73ef0f60894f3e1873a7910da；最後ZIP SHA-256：d130b7a5a8a368934fb99b762881a0225422a02ae7ce99ba8fcaba7fe2d1e6fa。報告／截圖在output/playwright/rocket-space-mission-lab/，ZIP在output/rocket-space-mission-lab-scorm.zip。未重跑全庫Node／browser、完整所有phase／變體iframe矩陣或200% zoom；真手機／Moodle與校內效能仍未驗證。
- P12已commit／push：6b560f1ce38977b374c71b6f111897eabedd7d1d；提交選擇預覽output/rocket/selection-p12.log（mobile-scroll共用fixture不在選擇器細分依賴內，保守列full；本次執行範圍以以上實測證據為準，未主張全庫測試）。沿用使用者明確持續發布授權，Sites來源2b2fd1df4c9176bcfb1a383cf4a37d3dcd25211d、deployment appgdep_6adcce007bc88191b7570bb7cf94996e，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P13：只有手機／觸控版顯示捲頁把手（2026-10-24）

- 使用者更正P12：桌面不需要捲頁把手。沿用Circuit Workbench的裝置能力media query：hover:hover且pointer:fine時隱藏；any-pointer:coarse保留，支援手機橫屏及觸控混合裝置，不以窄桌面視窗冒充手機。桌面相機操作區同時擴至兩邊，不留下無作用的32px區；觸控版仍保留兩側32px原生pan-y與小把手。
- 範圍只限CSS、既有browser owner及本計劃；不改依賴、manifest、物理／評分、phase／variant／snapshot或保存契約。更新實際CDP觸控能力，驗證1280px與窄390px滑鼠版無把手且背景可旋轉，320／390px及844px橫屏觸控仍有把手；重跑source／ZIP既有owner和聚焦T2觸控捲頁。沿用低風險評分及既有保存測試決策；真手機／Moodle仍獨立驗收。

- P13執行證據：npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP各20布局，1280×800及390×844 mouse使用實際fine-pointer能力：把手無尺寸／命中區、相機覆蓋舞台全闊；390×844、320×568及844×390 touch保留兩邊32px把手與原生pan-y。十組直接背景旋轉／方向鍵／鏡頭預設通過；桌面與手機截圖已檢視，桌面無把手、手機保留。原裝配／插入／調位／飛行／相機／評分提交／恢復／唯讀／全屏／故障回歸均通過。
- source與package T2各320×568 camera-surface profile通過：左右原生外層捲頁、面板內容／邊界／取消／連續掃動隔離、相機complete/cancel/secondary/blur/lostcapture；scroll-p13-source/package-T2.json皆completed=true、status=passed、errors=[]及全部gesture issues=[]。本次未重跑T1/T3、全phase矩陣或不受CSS影響的活動Node測試；P12證據保留為歷史，真手機／Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、44 flows；runtime SHA-256：9b1a762b63fb7b0db55a02f2eba2c01a7eb0f36291cbe2079308fa9f57fed4d0；ZIP SHA-256：928a9da23f04cc8b2944aeb0b588f363e8e043f2aed0ad1f569a793275f2e169。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P13已commit／push：f72d211b4ddfe4b9a7a29c638f910e7f9e0fa8bf；提交選擇預覽output/rocket/selection-p13.log。沿用使用者明確持續發布授權，Sites來源c06f90037af7a95afd0e10ac5de77ea7c2991976、deployment appgdep_6adcd03293048191afcd3b910503ceb1，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P14：桌面整卡拖放、簡潔元件面板及任務名稱（2026-10-24）

- 使用者要求桌面不顯示元件拖動把手、手機保留；桌面mouse整張元件卡可拖動，手機touch只有手柄開始拖動，卡片內容仍原生pan-y。仍可點卡片／Enter加入；一次drag/cancel後的合成click不得再加入一次；新觸控開始時清除上一手勢的click抑制，取消後首次點卡仍只加入一次。capture目標統一為穩定卡片button，更新所有既有測試caller及lostcapture。沿用P13裝置能力query，不加依賴／UA判斷。
- 刪除組裝標題下常駐掃動／拖動教學及初始提示佔位，實際操作只顯示精簡狀態；保留無法安裝、容量／技術錯誤、必要結束試飛及成績說明。衛星卡改成圖示／名稱及載荷質量標籤／數字與kg的一行排版，不再擠在公式文字裏；手機手柄文字維持單行，避免320px元件卡不必要增高。
- 面向學生的A/B改用「發射入軌／軌道變更」及發射／變軌紀錄，包含導航、保留／帶入按鈕、提示及成績明細；模型task A/B、record索引、評分與snapshot不變，成績標題只在UI轉譯，舊保存／pending／review繼續相容。
- 範圍：HTML/CSS/main/interaction、既有browser owner及本計劃。低風險評分、rubric、phase/variant保存矩陣與schema沿用。驗證source／ZIP的真實fine mouse整卡拖放（取消／無效落點／lost capture不額外新增）、touch掃卡不安裝／手柄拖放、鍵盤加入、衛星卡320px及桌面排版、無常駐操作教學／A/B copy；重跑既有裝配／任務／保存提交及聚焦iframe手機手勢隔離。真手機／真Moodle仍獨立驗收。

- P14完成證據：六個活動Node測試、npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。source／extracted ZIP共20布局；1280×800 fine mouse實際整卡拖入／插入／無效落點／取消／blur／lost capture不額外加入，390×844及320×568 touch掃卡仍捲面板、只由手柄拖入，取消後第一次普通點卡安裝一次通過；第二指只取消、不轉交新操作。卡片／Enter點選及已裝零件、同／跨級搬移、精確接縫重排、容量／即時警告／原位預覽保持通過。
- 十組source／ZIP的1280×800及窄390×844 mouse、390×844／320×568／844×390 touch排版通過：桌面無把手、手機手柄44px且單行；無常駐操作教學／初始佔位；衛星名稱與數值／kg不重疊，質量與模型一致。桌面及320pxcompact-panel截圖已檢視。按鈕／提示／導航／成績明細以發射入軌與軌道變更命名；原有A/B資料及評分不變，review及舊保存／pending相容。原相機／飛行／任務／提交重試／續做／鎖定／全屏／WebGL故障回歸通過。
- 最終source及package T2各320×568 camera-surface profile通過：左右原生外頁捲動、面板文字／按鈕／邊界／取消／連續掃動隔離、相機complete/cancel/secondary/blur/lostcapture；scroll-p14-source/package-T2.json皆completed=true、status=passed、errors=[]及全部gesture issues=[]。本次未重跑T1/T3、全phase矩陣或全庫Node／browser；真手機／Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、44 flows；runtime SHA-256：7e812ca238376c82cd8ce2006a6fbab4b8f20704e0495191b98379cc17641424（已與最終宣告runtime bytes核對）；ZIP SHA-256：1b1d8764720356706fe8e1b11410a6f58a00eb7b444434ddd73ead9f22e60354。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P14已commit／push：29e19683baa803c81958ca061a44b036c4f50d0c；提交選擇預覽output/rocket/selection-p14.log。沿用使用者明確持續發布授權，Sites來源c958ee594cdfd875af793c9b7a2a251f619f5109、deployment appgdep_6adcd5d2a330819199da084479f66c7d，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P15：飛行控制不中斷與按大小顯示的速度／推力箭嘴

- 使用者回報面板轉向等控制會突然暫停，及箭嘴固定長度／插入長火箭頂部。Controller已保留control的running，但tick把單一elapsed=0當作停止，合法零時間／小於積分容差的幀也會停飛。修正此停止判斷；只由明示暫停、規劃／檢查／提交、hidden、技術故障或已結束／模型界線停飛，不自動恢復原本暫停的飛行。用轉向微調／直上水平、姿態、油門與0-time-frame連續操作驗證；不聲稱已重現使用者實機事件。
- 速度長度以總速率m/s、推力長度以production M.thrust（包括引擎／油門／燃料）計算；固定viewport下採線性比例，不以固定箭長或當前高度冒充數值。0速率／0推力隱藏。以min(90px, viewport高×18%, viewport闊×25%)作8000m/s／600kN參考長度，world-per-pixel只跟鏡頭深度／縮放轉換，維持同一畫面速度加倍／力加倍箭長加倍。
- 起點以實際rocket.localToWorld中心、旋轉軸、剩餘級height及scale計算；在向量的鏡頭平面法線方向以火箭包絡cylinder的support距離加8px間隔置於機身兩側，不再從固定world-Y中點穿過火箭。箭身粗細與長度分開，向量以與圖例一致的深色unlit材質及圖示overlay保留日光／太空背景可見性；不把顯示位置／尺度帶入碰撞、力或評分。更新「只示方向」舊圖例，勿誤導箭長語意。
- 範圍：ui-runtime、scene、HTML圖例、既有lifecycle／browser owner及本計劃；沿用既有model／Three／manifest依賴，無新套件、無新增snapshot欄位或schema變更。低風險rubric、phase/variant矩陣、舊快照／pending／review及真正背景暫停契約不變。測試包含Node先重現0-time-frame停止、source／ZIP實際mouse/touch飛行控制與滑桿、paused不自啟、長短／傾斜／分級／不同高度縮放與三鏡頭箭嘴幾何、速度與油門倍數／零值及原有全回歸。真手機／Moodle仍獨立驗收。

- P15完成證據：六個活動Node測試、最終npm run check、npm run check:tests（278 entries）、文件／diff檢查通過。先以lifecycle測試重現control後tick(0)誤暫停，再驗證save true/false、0／1e-12／正常幀、手動paused保持paused。實際source／ZIP各1280×800 fine mouse及390×844 native touch的轉向±2°、直上／水平、油門±5%、原生滑桿與姿態選項皆保留running且時間前進；同一批按鈕在paused不自動恢復。
- source／ZIP各桌面及手機共288組production向量transform案例通過：最長八大燃料箱、最短單小燃料箱、分離後上級；1000m／150km、follow／orbit／plane、0°／90°與0.5×／2×鏡頭。向量沿實際方向且取樣線段全在機身保守cylinder外；速度／油門加倍箭長加倍，零速度／零油門／空燃料箱隱藏對應箭嘴，draw不改模型。密集矩陣暫停重複GPU出圖以免軟件GPU累積逾時，finally恢復production renderer；最後真實WebGL出圖及桌面／手機長火箭、上級截圖已檢視，深色加粗箭嘴位於機身外並可見。
- 原20布局、整卡／手柄拖放、原生面板捲動、已裝零件點選、插入／調位／跨級搬移、連續背景旋轉、三鏡頭、關機／分級續飛、hidden明示暫停、任務、提交重試／恢復／唯讀、全屏與WebGL故障回歸通過。本次未重跑獨立iframe scroll T1/T2/T3矩陣或全庫Node／browser；真手機與真Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、52 flows；runtime SHA-256：5171a82ed7e84411c8b321830a911a986168584d2d0ef05a45bc1476c195df45（已與最終宣告runtime bytes核對）；ZIP SHA-256：e00343cdc123481b60d4ead6c1701df3757c524128066eea06f69c1085c716b6。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P15已commit／push：59eecd76a65dea3718ad73c18375bf535729d076；提交選擇預覽output/rocket/selection-p15.log。沿用使用者明確持續發布授權，Sites來源333a564f746a47b660331c4fab68ba0b14da5148、deployment appgdep_6adcde0756748191916814518068e85f，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P16：完整速度讀數、分級燃料與由分離器向下加建

- 需求：補垂直及總速率，避免直上時水平0造成誤解；兩級各自顯示推進劑百分比；以分離器元件取代單級／兩級按鈕，原已完成的單級成為上級，在其引擎下加分離器／新下級，外殼包住上級噴嘴，飛行分離後再露出。
- 速度沿用O.elements的radial／tangential／speed，顯示垂直及水平分量的絕對值與總速率；低於1000m/s採m/s一位小數，否則km/s兩位，避免低速全部0.00。HUD保留緊湊三欄：高度、總速率及兩個分量、各級燃料。兩級依各自capacity顯示，active與未點火級不混合，分離後下級標示已分離而不是冒充已消耗；記錄／review使用selectedFlight同一套讀數。
- 兩級schema仍為lower-first stages[0]/[1]及separator boolean，最多兩級，mass／fuel／評分／snapshot schema不變。新增separator模型操作只在workshop且單級引擎與燃料完整時，原級原封移至index1、prepend空index0，增加既有60kg分離器。保留舊stages action供既有fixture／caller，刪除UI切換。移除分離器只在下級已空時恢復原上級，拒絕靜默丟失任何下級零件；check／review／pending保持鎖定。
- 分離器沿用元件卡mouse整卡／touch手柄、點選／鍵盤、舞台接點、原位預覽、直接點選取出與取消契約；只有原單級底部接點可裝，重複／未完成／第三級拒絕，拖放不改草稿直到釋放。引擎仍屬原上級，opaque interstage包覆噴嘴，不修改推力；分離器可取出且上級引擎仍可由可見安裝環／鍵盤選取。下級先點火，分離後切換原上級，所有元件及有序燃料箱保留。
- 範圍：parts／model／scene／main／HTML／CSS及既有model／persistence／browser owner／本計劃，無新依賴／資產。沿用既有低風險rubric、phase/variant、權威snapshot及提交／重試／信任契約。先加模型與codec往返／合法續做測試，再執行source／ZIP真實mouse/touch分離器拖放／取消／不合法／移除、兩級順序與外殼、讀數獨立／低速／下降／不同鏡頭／review、320px及橫向布局；六個Node、check／check:tests、文件及提交選擇預覽。真手機／Moodle另驗，不以本機模擬代替。

- P16完成證據：先用model測試重現separator不能建立下級，再通過六個活動Node測試、最終npm run check、npm run check:tests（278 entries）、文件／diff檢查。三變體保留有序上級、質量只增加60kg、未完成／重複／飛行／check拒絕、下級有件拒絕移除、空下級移除，以及下級600kN→原上級80kN順序通過。新建未完成下級／移除／launch／separated upper均有production codec往返與合法續做，舊快照／pending／唯讀契約不變。
- source／ZIP各1280×800 mouse及390×844、320×568、844×390 native touch分離器拖放／取消、原位預覽不更改答案、上級保留、空下級取出、鍵盤再加、第三級拒絕、下級有件不可靜默丟失、下級先點火及分離後原上級點火通過。實際shroud包住上級nozzle的bounds，安裝環仍可直接選取，分離後外殼消失；桌面／手機shell截圖已檢視。移除級數切換，新增元件沿用桌面整卡／手機手柄規則。
- source／ZIP各1280×800、390×844、320×568、844×390、390×460：總／垂直／水平速率300-400-500、1m/s直上及水平0、下降分量絕對值、3-4-5km/s換單位通過；兩級50%／25%獨立讀數、分離後下級「已分離」與上級25%、已提交review同一紀錄、切回單級僅主級100%通過。HUD數值及圖例不重疊／不越界；320px、橫向與短窗口截圖已檢視。HUD與圖例用flex自然換行，不擴充頁首標題或新增操作教學。
- 原20布局、裝配／中間插入／精確ordinal／跨級搬移／鍵盤調位、手機原生面板捲動／桌面整卡、不中斷飛行控制／背景旋轉／鏡頭、288組向量transform、任務、評分提交／恢復／pending重試／唯讀、全屏及WebGL故障回歸通過。本次未重跑獨立iframe scroll矩陣或全庫Node／browser；真手機與真Moodle仍未驗證。
- 主report.json：completed=true、errors=[]、70 flows；runtime SHA-256：7b53373adf8c4b7c5fe88eabda5dd1bfea042fb57ad8fb271a1bd4f120d87603（已與最終宣告runtime bytes核對）；ZIP SHA-256：39ecb9ed4895430d857c69a31dc1191e8b6fc18f86210494989d6dcad720b065。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P16已commit／push：e758fd5f109a7f36561481099b6b600c08b8a87a；提交選擇預覽output/rocket/selection-p16.log，mode=affected。沿用使用者明確持續發布授權，Sites來源154bbe01bfed1f800b9264fa00c3abebc15a1560、deployment appgdep_6adce3bbafbc8191beb6b85fd35287f0，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P17：清楚表達鏡頭方向的名稱

- 使用者認為「俯視」有誤導。將鏡頭「地球」改「地球全景」、「俯視」改「軌道正視」，同步title與aria-label，說明分別是斜角看地球／軌道，及正面看軌道平面；避免以不明確的上下方向命名。
- 僅改HTML用詞；維持factory／follow／orbit／plane鍵、鏡頭位置、手勢、running、資料／評分／SCORM與schema。低風險文字改動不新增鏡像測試，沿用既有layouts／directCamera／launchAndCamera做source及ZIP聚焦驗證，特別確認320px四個鏡頭按鈕仍在舞台內、≥44px且不遮捲頁把手。其餘phase／變體／rubric／snapshot／pending契約沿用，未重跑全活動或全庫。

- P17執行證據：npm run check、check:tests（278 entries）、文件與diff檢查通過。ignored output/rocket-p17-camera-check.cjs選取既有registered owner的layouts／directCamera／launchAndCamera，source及extracted ZIP共20布局、14 flows，completed=true、errors=[]、selection=camera-labels。桌面及窄320／390／橫向touch，原生背景轉動、鏡頭預設位置／active與running一致、關機滑行／分級／明示暫停／hidden契約通過；320px按鈕≥44px且在捲頁把手內側，ZIP截圖已檢視。未重跑無關裝配／任務／SCORM完整矩陣、活動Node或全庫測試；真手機／Moodle未驗證。
- runtime SHA-256：3355273bea88d3b4209c70ae307bebaf6f674a03830ff1ac65eabc542eab3348（與最終宣告runtime bytes核對）；ZIP SHA-256：7f1d27212328027a03e27dea70b37b02ae87d4506dc11f3c340dc1823a6105ee。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。
- P17已commit／push：54ee5322627f895a4d9e8a750246f2ac9d00b05b；提交選擇預覽output/rocket/selection-p17.log。沿用持續發布授權，Sites來源3afcacc60603fe79a06386d9bb23a7327ca2934e、deployment appgdep_6adce525ea348191986292407ffc3ac5，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P18：精細零件、發射環境、地球與模擬時間自轉

- 使用者要求整體美術大幅提升，同時保持流暢；地球目前完全不轉。保留可愛載荷及淺色介面，重做3D零件的板縫／鉚釘／維修口／管線／冷卻環／噴嘴／隔熱材質及對應元件SVG；發射底座加入排焰口／排焰槽／鋼架／固定座／混凝土板／安全標線。河岸、道路、森林群、工業建築與海岸地形更精細，維持發射場至少300m清空、樹≥450m、遠方建築≥650m，近景雲移至遠處並用柔邊透明貼圖，避免遮住火箭。
- 地球使用本地2048×1024 NASA Earth Observatory Blue Marble Next Generation（2004年6月）地表圖，另以本地NASA雲圖／大氣邊緣／明暗面表達層次。來源：https://science.nasa.gov/earth/earth-observatory/blue-marble-next-generation/base-map/ 及其credits；NASA影像使用規範：https://www.nasa.gov/nasa-brand-center/images-and-media/ 。只作科學教學呈現，非即時天氣，無NASA背書；記錄來源／縮圖處理／雜湊並在折疊說明署名，不載入遠端runtime資產。
- 自轉直接由selected flight的t決定，以NASA Earth Fact Sheet 23.9345h（86164.2s）為恆星日。前進／快轉跟實際積分t，paused／review／hidden不自動流逝，resume可重現相同地表角度。這一輪只補地表視覺自轉，不把它注入既有球對稱重力／初始地面速度／評分；無新snapshot欄位或schema改動。舊「首版不自轉」只描述歷史物理簡化，自此renderer有依t的地表動畫。
- 效能策略：表面細節烘入共用Canvas貼圖、重複鉚釘／環／管件／樹／建築用InstancedMesh，維持每個可選部件的part metadata／pick anchor／順序與1.6半徑包絡；引擎第一child仍為噴嘴，分離器外殼仍包住上級噴嘴。地球球面由256×128降低至128×64，以更細貼圖取代大量三角形；無動態陰影、後處理或新重型依賴，pixel ratio維持手機≤1.5／桌面≤2，≤100draw calls／≤100k triangles／ZIP≤5MB。重建／預覽釋放geometry、material及instancing buffers，快取貼圖不反覆建立，避免記憶體隨組裝增加。
- 範圍：scene／專用scene-art模組、元件SVG與少量CSS、本地影像及NOTICE、manifest、main必要的錯誤／載入接線、既有browser owner及本計劃。先保存同機baseline，再補自轉／快轉／暫停／還原、最大火箭／多高度與鏡頭、冷載本地貼圖、繪圖上限／RAF幀間隔／CPU draw與重建記憶體檢查；執行六個Node、完整source／ZIP既有互動／SCORM／故障回歸及檢查／提交選擇預覽。保留低風險rubric、phase／variant矩陣及權威snapshot／pending契約。軟件GPU與模擬觸控只作同機對照，不冒充真手機30fps／校內網路5秒／真Moodle驗收。

- P18首輪出圖／量度後調整：改用NASA真實雲層合成影像（1024×512本地JPEG），取代粗筆觸程序雲；近景仍用小型柔邊雲。微鉚釘改較低面數的實體頭，減少不可辨識的環／曲面分段；重複細節仍instancing，表面鉚釘／板縫保留貼圖。以輕量Phong材質表達金屬，大片地面／樹用Lambert，移除近景看不出的bump計算。追蹤視角在詳細地形足以覆蓋地球時不重繪全球球面／雲殼（120／300km門檻），軌道／正視保留完整全球層；持續檢查高度與天空連續性。森林256棵，仍多於原96棵，並守原清空距離。
- P18進一步優化：降低地面／雲圖的各向異性過濾，機身保留2×；近景按投影像素隱藏不足一像素的實體鉚釘／冷卻環，放大時恢復，貼圖細節一直保留。遠處樹／建築／地面雲在無法辨認時不送GPU；工廠大地板只在工廠顯示，發射時保留真實小範圍底座／apron，避免巨大貼圖地板蓋住草地與重複填色。

- P18地形出圖修正：高空寬三角形的vertex色曾把海岸拉成放射條紋；改由地面Lambert shader按每個fragment的本地座標算連續海岸／沙灘色，保留同一曲面與貼圖、無額外mesh或draw call。50／71／140km截圖再次檢視；修正前完整測試中止，不作最終通過證據。
- P18完成證據：六個活動Node測試、最終npm run check、check:tests（278 entries）、文件／diff檢查通過。既有registered browser owner加入本輪測試，最終source及extracted ZIP共20布局、88 flows，completed=true、errors=[]；所有manifest檔逐byte一致。真實mouse／native touch裝配、插入／跨級搬移、分離器遮罩與安裝環、全部速度及燃料讀數、不中斷控制／轉鏡、288組向量transform、任務／評分／提交重試／恢復／唯讀、全屏／WebGL失效恢復均回歸通過。
- P18新驗證：兩份交付各驗地表2048×1024／雲1024×512本地載入、runtime資源同origin及shader runnable；連續積分1秒及600秒後自轉角跟實際t一致，paused旋轉鏡頭不改時間／角度，Moodle fixture reload還原同角度，已提交review按紀錄t固定。封鎖地表圖片時明示載入失敗、保留成果且仍可檢查／提交，解除後正常啟動。
- P18負載驗證：每份以最長八箱火箭在0／20／119.999／120.001／179.999／180.001／299.999／300.001／1000km、follow／orbit／plane共27組實際GPU出圖，地表／雲／大氣門檻及<=100 calls／100k triangles通過；本矩陣最高68 calls／41550 triangles。微細節縮小隱藏／放大恢復、DPR3模擬下手機1.5／桌面2上限通過。每份12輪換引擎／燃料箱／原位preview再還原，暖機後geometries／textures／programs與WebGL live buffers固定（source {"geometries": 26, "textures": 7, "programs": 9, "buffers": 68}），模型不被renderer改動。
- P18同機對照：output/playwright/rocket-space-mission-lab/art-baseline.json保留P17原版，最終report.json保存本輪。Chrome SwiftShader、DPR1、paused場景每RAF單次draw、28幀捨首4幀；以下為source中位幀間隔／P95（ms），是軟件GPU短樣本而非真手機持續fps或網路載入測試。

| 尺寸／視角 | 原版中位／P95 | P18中位／P95 |
| --- | --- | --- |
| 1280／workshop | 33.4／33.5 | 33.4／33.5 |
| 1280／pad | 66.8／166.9 | 83.5／200.3 |
| 1280／ascent | 66.8／83.4 | 50.0／50.1 |
| 1280／orbit | 66.7／66.9 | 50.1／66.8 |
| 390／workshop | 16.7／16.7 | 16.7／16.8 |
| 390／pad | 16.7／33.4 | 16.8／33.4 |
| 390／ascent | 16.8／116.7 | 16.7／16.8 |
| 390／orbit | 33.4／50.0 | 16.7／66.7 |

- P18效能界限：整體global view減少球面幾何與高空層數，手機四視角中位接近一個refresh間隔；桌面軟件GPU發射台仍較重，不能聲稱所有視角都較原版快或保證真手機30fps。無陰影／後處理／遠端資產，新地球兩張影像合計439294 bytes，ZIP 679881 bytes；記錄實際數據而不作實機驗收。本次未重跑獨立iframe scroll矩陣或全庫Node／browser；真手機5秒／30fps與真Moodle仍待實際環境驗證。
- P18最終runtime SHA-256：f86e10fe0bffd9a2a61ae30c51c7fcd6de222d85acc3d0bd1ddfbeee9b4dcad9；ZIP SHA-256：582f9ad8033f1ee03e4f8280b6c6255f9880183c6e373c1720fb3bf8fe87ee61。報告／截圖：output/playwright/rocket-space-mission-lab/；ZIP：output/rocket-space-mission-lab-scorm.zip。桌面／手機零件近照、八箱整箭、清空發射區、升空／海岸、全球地球／雲層截圖已檢視。地球自轉只屬renderer，既有非自轉地面物理／評分與schema1不變。
- P18已commit／push：8210d290e901fc4b7bf5e7320b27501e08b2b57d；提交選擇預覽output/rocket/selection-p18.log，mode=affected。沿用使用者持續發布授權，Sites來源d4c03aa8cb21c3ba20f131a9cbd6cae9ecc79a74、deployment appgdep_6adcf48e8e70819186d912118f9caf2f，native結果succeeded。維持https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-private；未等待CI。


### P19：兩個獨立代理審核及初版除錯

- 使用者明確要求兩個subagents審核初版、匯總報告並跟進減少bug。審核基線3fc12d9（P18 runtime8210d29），代理audit_interaction_state負責互動／模型／持久化／提交，audit_scene_performance負責3D／鏡頭／資源／行動版效能；兩者只讀，root統一驗證及修正。報告：[初版審核及跟進](../docs/rocket-space-mission-lab-audit-2026-10-25.md)。負載為單一學生在本機或Moodle iframe使用。
- 確認四項：P1短逆向節點因12°/s未轉身就燒完而反向加速；P2長等待preview固定20000s截斷並回傳上一次burn；P2低高度遠離發射場時地球底圖與當地地形同時缺席；P2 live resize沿用桌面DPR2，超過手機1.5上限。先保留會失敗的重現，再修根因。手動A轉向限速不變，B自動燃燒每步先對準選定速度方向，亦涵蓋已儲存active burn續做；已保留／提交records不重算。
- preview隔離舊burn、依實際積分step budget推進至新燃燒終態；時間／計算上限或無進展時不冒充有效結果，UI明確表示未能完成預估。renderer在發射場附近且地形足以覆蓋時才省略全球底圖，遠離後保留地球；resize根據當前viewport重新套DPR上限。無新套件、runtime資產、snapshot欄位、schema、rubric或共享SCORM改動。
- 沿用既有assessment風險、rubric、phase／variant及權威snapshot契約。新Node覆蓋三載荷短逆向／錯向順行、自動active burn codec續做、A手動限速、長等待第二次燃燒preview與actual一致、模型邊界返回不可預估。既有registered browser owner加入合法降軌跨地心角跟隨、全viewport無reload DPR切換、UI預覽／自動方向／resume；完整source／ZIP、六個Node、check／check:tests、文件／diff及committed selection-preview。T0–T3手勢未改，獨立scroll矩陣不重跑；真手機及真Moodle另驗。

- P19場景覆核追加：R4亦涵蓋CSS尺寸不變時的DPR-only變化，resolution media query在CDP實測值已更新但change未觸發，改用既有RAF每幀比較一個已快取DPR數值，只有DPR變更才resize，不讀取每幀DOM尺寸。另確認R5：follow地球不寫depth以保留發射場地形，透明星點因此穿過球面；星點shader以同一球面做遮蔽，保留原漸現、地形depth及draw call數，補GPU pixel比較及shader runnable測試。R3用離發射點600km的保守margin（詳細地形半徑1280km）恢復全球底圖，留住近發射區效能；代理已驗五組視角無遠地形穿透。

- P19完成證據：兩代理覆核均關閉原finding及追加R5，共1項P1／4項P2已修，詳見審核報告。六個Node全綠；逆向短燃燒及P18 active burn續做新增測試先在修前失敗。最終registered owner source／ZIP共94 flows、20 layouts，completed=true、errors=[]；原互動／自然分級／向量／SCORM／故障回歸全部通過。新增GPU星點球面內像素一致、合法遠距低空地球、DPR3→1→2.5與手機切換、長等待第二次燃燒preview、舊active burn codec及reload等皆有實際執行證據。獨立代理驗DPR變更下paused不動／playing續飛，及context restore shader正常。
- P19檢查：npm run check、check:tests（278 entries）、文件及diff檢查通過；runtime SHA-256 b4fa613a935560a1e3840f4ff74eddb62505b7764caece30dc4b76274700732a，ZIP SHA-256 ab621f5cb5d857116837ab0251c0943b9e47811e0454dd8113d4fc2533678e76，大小680689 bytes。正式report與*-audit-*截圖在output/playwright/rocket-space-mission-lab/，獨立audit-scene-*證據在output/。無新schema／rubric／runtime依賴，已提交records不重算。真手機／真Moodle／獨立T1–T3矩陣未在本輪驗證。
- P19已commit／push：7a5ce1b90654ea8edaf85b9108f7eca84de2f187；committed selection-preview為output/rocket/selection-p19.log，mode=full，原因是既有test-support.js測試fixture helper未宣告為runtime asset consumer，選擇器保守全選。未更改共享選擇器／registry或把測試fixture加入runtime；本輪實際只執行活動六Node與完整活動source／ZIP，未執行全庫或等待CI。Sites來源a021704661dfcb71e3f5ca367b4bde341848496d、deployment appgdep_6adcfe8625c08191acad291bff4f2b4b，native succeeded；原網址與owner-private維持。


### P20：統一卡通地球，消除高空近景地形接縫

- 使用者真手機截圖在940.4km看見大片簡化青綠近景海洋蓋住寫實衛星地球，兩種海色／造型混雜；要求恢復一致卡通美術。P18仍保留發射場有限地形於所有高度、同時啟用全球底圖／雲殼，形成可見地形patch邊界；P19只補遠距底圖，未解決這個重疊及風格問題。
- 修正只涉及scene／scene-art、學習說明署名、舊影像manifest依賴及既有browser owner。重用P17原創大陸輪廓，生成一次性本地Canvas插畫地表／葉狀雲：海洋／陸地／海岸採同一組配色，加簡單海岸線及區域色塊，移除NASA照片與照片雲runtime依賴。保留精細火箭／發射台、河岸／樹木／建築與地球依t自轉。地圖是航天示意插畫，非地理／即時氣象資料。
- 近景環境按20–60km高度及距發射點300–600km平滑淡出；全程使用同一地球球面，20km以下發射區採近景海岸配色，60km以上及遠距採全球插畫；有限近景地面mesh已刪除，只有道路／河流／樹／建築／底座等細節隨高度淡出。雲／大氣同一透明度漸入；多角度、縮放及下降亦使用同一規則，避免切換高度硬跳。fade只改renderer材質／可見性，不改physics／rubric／schema／已儲存答案。
- before/after重現原940.4km／3300m/s、20／40／60km邊界、100／300／940.4／1200km、近／遠發射地心角、follow／orbit／plane、桌面／手機尺寸，驗證高空local opacity=0且studio／landscape均隱藏、地球仍可見、Canvas插畫資產及shader正常、draw calls／triangles上限、暫停／續做／DPR與星點遮蔽不回歸。以現有registered owner新增案例並更新舊「地形始終顯示／照片載入」測試為新契約，執行source／ZIP完整owner、六Node、check／check:tests、文件／diff及committed selection-preview。物理、snapshot及SCORM外層不變；真手機／真Moodle另驗，T1–T3手勢未改不重跑。

- P20出圖補正：單純淡出兩個重疊球面仍會在40km看見雙地平線。刪除發射場大型地面mesh，改為全程同一地球球面，以北極密集環支援發射點米級近景；同一fragment shader從近景海岸配色平滑轉為全球插畫，近景只留道路／河流／森林／建築／底座並淡出。球面隨跟隨地心角轉換，雲／大氣沿同一球面漸入，沒有第二個地面或有限patch邊界。相對原128×64球面僅小量增加全景面數，省去近景地面萬個三角形，仍守100k預算。

- P20完成證據：六個活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。最終registered owner source／extracted ZIP共98 flows、20 layouts，completed=true、errors=[]；manifest所有runtime bytes與ZIP一致。真實單級火箭積分至942.3km重現升空，再覆核原截圖940.4km／3.30km/s、0／20／40／60／100／300／940.4／1200km及各邊界、四個地心角、follow／orbit／plane與縮放；高空無近景patch、同一球面保留、Canvas插畫無舊照片請求。新矩陣最高43 calls／43192 triangles，40km local opacity=.5、60km以上=0；原星點遮蔽／DPR／互動／SCORM／故障回歸通過。桌面／手機發射台、過渡、高空與地球全景截圖已檢視，沒有雙地平線／貼片邊界。
- P20 runtime SHA-256 338408133718ad44cf7a3bda1000e4a5a39c87a2e115bf9d22ca980fe621aeac；ZIP SHA-256 e0b988a93d66129335087f11574f46edb4c83118fdc47c88803fecc72661faa4，大小255995 bytes（移除439294 bytes照片，無新套件或外部runtime請求）。報告／截圖在output/playwright/rocket-space-mission-lab/。P18照片及有限地面mesh決策由本節取代；物理／schema／rubric／提交記錄不變。未重跑全庫或獨立T1–T3矩陣；真手機fps／真Moodle未驗證。
- P20已commit／push：33cfc4c8da4313b6b48e000e3547e240b279743e；committed selection-preview在output/rocket/selection-p20.log，mode=full，原因為已移除NOTICE.txt不再有manifest consumer，選擇器保守全選。未改共享選擇器或把舊照片／NOTICE重新加入runtime；實際只執行活動六Node、完整活動source／ZIP與既述靜態檢查，未執行全庫或等待CI。Sites來源4341518e47b67bf7f4b87974d3b91bc5b34cde35、deployment appgdep_6add538b8d848191a6264012087388be，native succeeded；精確使用驗過ZIP並清除Site舊照片，原網址與owner-private維持。

### P21：固定地理連續性、可辨地標及緊湊讀數

- 使用者指出P20隨高度改變地表配色使陸地消失、全球輪廓粗糙、近景缺地標及HUD遮箭。本輪移除高度驅動的地理混色：同一球面的固定沿海區與全球圖按空間座標銜接，近景海岸／河道／林地／田地／山脈／城鎮印在同一地表，遠景仍留住；只有米級3D道具按投影大小淡出。全球補可辨大陸海岸、山系、河湖及島鏈，維持原創卡通插畫，不加照片或依賴。
- 沿海發射區以加州海岸方向為示意基準，非測繪或真實發射基地。局部與全球共用定位，山脈3D輪廓與地圖陰影同位；發射台附近保持清空。HUD改三行小型讀數：高度／總速率、垂直／水平、兩級推進劑及向量圖例；保留所有讀數及無障礙名稱，不新增操作說明。鏡頭留足整箭空間。
- 範圍scene／scene-art／HTML／CSS與既有registered browser owner／本計劃；manifest及所有runtime依賴不變。沿用低風險rubric、phase／variant、權威snapshot／SCORM契約，無物理或答案遷移。補固定時間多高度／多鏡頭同地表採樣、海岸河山地標及GPU／布局斷言，執行完整source／ZIP owner、六Node、check／check:tests、文件／diff與committed selection-preview；真手機效能／Moodle另驗，未改T1–T3手勢。

- P21完成證據：六活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。最終registered owner source／extracted ZIP共102 flows、20 layouts，completed=true、errors=[]，宣告runtime bytes與ZIP一致。GPU以固定鏡頭與同一球面材質讀回64×64地表，0／20／40／60／940.4km所有RGBA逐byte一致（近景747種像素色），確認不是以高度更換陸海圖；桌面／手機及兩份交付均通過。0／1／5／20／60／940.4km截圖、全球大陸／河湖／山系／生物群落、固定河道及36座山脈已檢視；近景海岸方向亦校正為同一全球沿岸方向，P20高度混色決策由本節取代。
- P21布局：1280×800／390×844／320×568／844×390／390×460皆驗整箭投影位於HUD及鏡頭列之間，讀數與圖例互不遮住，總／垂直／水平讀數、兩級燃料及review皆保留。桌面HUD 73.1px、手機70.1px，向量圖例移入同條末行；預設follow望向陸地地標。新美術矩陣最高47 calls／45424 triangles，無照片、新套件、共享runtime或schema改動；原組裝、分級、控制／鏡頭不中斷、星點／DPR、評分／恢復／pending重試及故障回歸皆過。未執行全庫或獨立T1–T3矩陣；本機SwiftShader與模擬觸控不建立真手機fps／Moodle驗收。
- 地圖由快取Canvas生成：全球4096×2048、區域2048×2048，兩者未含mipmap約48MiB RGBA紋理，比P20增加約40MiB；沒有額外下載，重建後geometry／texture／program／buffer固定，DPR與繪圖預算仍受測試約束。真手機GPU記憶體與長時間流暢度仍須實機確認。
- P21 runtime SHA-256 d6278264a53d6b4a44c53fc81f3d650c96cd539e2e24af3d918de987ad55ea42；ZIP SHA-256 b7c76c5fdbd315323078383fc5cb202295ba5781767a979267519230ca7c5c1a，257627 bytes。正式報告與geography／full-telemetry截圖在output/playwright/rocket-space-mission-lab/。

- P21同機對照：Chrome SwiftShader、DPR1、paused各28 RAF捨首4；保留P20驗證報告為p20-before-geography.json。下列為source中位／P95幀間隔（ms），並非真手機持續fps。手機orbit中位由16.8升至33.3ms，其他場景中位大致相同，不能聲稱新增細節完全零成本；維持draw-call／triangle／DPR上限與穩定重建，實機記憶體／長時間流暢度另驗。

| 尺寸／場景 | P20 | P21 |
| --- | --- | --- |
| 1280／workshop | 33.3／33.4 | 33.3／33.4 |
| 1280／pad | 66.7／66.8 | 66.7／66.8 |
| 1280／ascent | 66.8／83.5 | 66.7／66.8 |
| 1280／orbit | 50.1／66.8 | 50.0／50.1 |
| 390／workshop | 16.7／16.8 | 16.7／16.7 |
| 390／pad | 33.4／33.4 | 33.4／33.4 |
| 390／ascent | 16.8／66.7 | 16.8／33.4 |
| 390／orbit | 16.8／33.5 | 33.3／33.4 |

- 最終owner先因已移除的「箭長隨大小變化」舊文字斷言中止；只更新測試為速度／推力圖例存在，未更動runtime。保留前27個已過source flows，核對runtime SHA完全相同後，先由flightVectors續跑；cameraDrag的負角度字串插值亦只改測試加括號，未改runtime，再由launchAndCamera完成其餘source及完整package。兩份中止報告均保留，最終report以resumedSourceAt記錄，102 flows沒有跳過。
- P21已commit／push：83d02a942d46b180a36e73d2ce59840ba21a1f0c；committed selection-preview在output/rocket/selection-p21.log，mode=affected。實際執行活動六Node、完整source／ZIP owner與既述靜態檢查，未執行全庫或等待CI。沿用持續發布授權，Sites來源fdb78876ccf6cb11dbd16fadf9774a0c0cc633aa、deployment appgdep_6add5dddd2188191b7cd9409f91b894e，native succeeded；精確使用驗過ZIP，原網址及owner-private維持。

### P22：手機操作艙與獨立畫面／讀數分區

- 使用者要求先處理操作：HUD及三鏡頭掣遮畫面、手機控制區太高、捲動誤改油門／轉向、分離後上級點火不方便。新增simulation-pane內的讀數列／純3D舞台／鏡頭工具列，讀數與鏡頭按鈕不覆蓋Canvas；控制區用controls-pane固定飛行操作列加獨立捲動內容。手機直向控制區約26dvh（180–236px；短窗口166px），餘位給模擬區，維持header／stage／controls三區、全屏及32px側捲頁條。桌面仍並排。
- 飛行操作列固定顯示時間／狀態、暫停／繼續、當前級點火／關機及分離；分離仍僅切換上級並滑行，不自動點火。耗盡下級時分離按鈕與其後「上級點火」在同一操作位置，無須捲動找掣。保留paused／running、關機與分離不中斷、明示點火繼續等既有模型規則。
- 油門／俯仰角重排為並列設定組。手機／coarse pointer隱藏會搶垂直手勢的range，改用數值輸入、加減及直上／45°／水平預設；桌面range保留。B變速量同樣有手機數字輸入，保留原±5。數字僅合法change才寫入、編輯中不被RAF覆寫；滑過按鈕／數字欄只捲面板，不變答案。T1–T3頁面／iframe捲動拓樸不改，控制面板T0及所有新目標用trusted native touch驗。
- 範圍HTML／CSS／main、既有registered browser owner與本計劃；無scene／美術、physics、rubric、snapshot schema、共享SCORM或manifest依賴變更。沿用既有低風險assessment、phase／variant與保存／重試契約。先驗source及ZIP的桌面／手機／橫向／短窗口布局、非遮蔽讀數、純Canvas增高、原生面板滾動跨數字／按鈕不改值、數字／鍵盤合法／無效輸入、分離後無捲動點火及running／paused，並回歸裝配／鏡頭／向量／任務／提交恢復；六Node、check／check:tests、文件／diff及committed selection-preview。真手機與Moodle另驗。

- P22完成證據：六活動Node、npm run check、check:tests（278 entries）、文件／diff檢查通過。既有registered owner以output/rocket-p22-regression.cjs選取本輪相關案例，source／extracted ZIP共88 flows、20 layouts，completed=true、errors=[]、selection=mobile-cockpit；逐byte核對manifest runtime。保留auditFixes／sceneArt／原生裝配／分級／全部telemetry／flightControls／288組向量transform／20布局／直接轉鏡／任務／SCORM保存恢復／pending及WebGL故障等，省略未改美術的geographyAndHud／earthStyle／artBenchmark；未聲稱完整全活動或全庫測試。
- source／ZIP各390×844、320×568、844×390、390×460 native touch及1280×800 mouse操作艙通過：HUD完全位於Canvas上方、鏡頭／向量圖例完全位於Canvas下方、44px觸控按鈕、頁面與visualViewport不漂移、固定操作列不隨內容捲動。390×844純Canvas 459.1px，P21讀數至鏡頭列之間有效空間259.9px，增加約77%；新讀數43.4px、鏡頭列46.0px、固定操作列72.3px。五種尺寸與上下級截圖已檢視。
- 共32次trusted native touch從油門數字、角度數字、油門／轉向按鈕開始垂直掃動：只面板scrollTop增加，完整state／window／visualViewport一致。手機range隱藏、桌面range保留，35%／42°／非法999°／B變速250m/s數字與鍵盤change驗證通過；RAF不覆寫正在編輯的欄位。每份五尺寸各running／paused分離後保留滑行、不自動點火，無面板跳位、焦點不捲動，原分離按鈕同一觸點可直接點燃上級並明示續飛，合共20次分離接點火流程通過。移除分離toast以避免面板底部錨定突然跳位。
- runtime SHA-256 efc73fd33e3b2abe99930b976c79cd2918f51c820cf48bcc2b60ef043640bcba；ZIP SHA-256 a1edfce6a5cc64474cc3a47d9ad5cc3bee8390d9800b2a7110f1901f869aaa22，258631 bytes。報告／cockpit／full-telemetry等截圖在output/playwright/rocket-space-mission-lab/。無scene／物理／rubric／schema／共享runtime改動；真手機鍵盤與長時間操作、真Moodle及獨立T1–T3宿主矩陣本輪未驗，不能以模擬觸控取代實機驗收。
- P22已commit／push：dad6bf4e2376e44034936d8b7642bce86b297f62；committed selection-preview在output/rocket/selection-p22.log，mode=affected。實際執行活動六Node、相關source／ZIP owner（selection=mobile-cockpit）與既述靜態檢查，未執行全庫或等待CI。沿用持續發布授權，Sites來源86d440dc49dc009512535fcc72e381c9a9b19fec、deployment appgdep_6add6dc6a5a08191a7078805d88d0c34，native succeeded；精確使用驗過ZIP，原網址及owner-private維持。


### P23：角落儀表與可見燃料條

- 依使用者否決P22外置讀數／鏡頭列，取消兩列佔用Canvas高度。讀數改為左上窄儀表、右上兩級燃料橫條；鏡頭以44px按鈕置左下角，中央保留火箭視線。主要數字22px，分量與燃料至少13px，保留全部速率與單位。
- 沿用既定assessment risk、rubric、dependencies、phase/variant matrix及snapshot schema；不變更物理、美術、評分、持久化或共享runtime。僅調整活動CSS與既有registered browser owner幾何／可讀性斷言。
- 驗證決策：source與extracted ZIP的手機／桌面、短屏／橫屏，實際字體與橫條比例、Canvas填滿simulation pane、原生鏡頭與捲頁把手、控制區掃動不誤改、分離後原位點火、飛行／記錄／fullscreen／SCORM生命週期；截圖目視。未改的地球美術與基準不重跑，真手機及真Moodle仍為獨立驗收。

- P23完成證據：六活動Node、npm run check、check:tests（278 entries）、文件與diff檢查通過。既有registered owner以output/rocket-p23-check.cjs選取完整telemetry／mobileCockpit／20 layouts／directCamera／launchAndCamera／flightVectors／lifecycle，source及extracted ZIP共40 flows，completed=true、errors=[]、selection=compact-instruments；另以output/rocket-p23-geography.cjs重跑受影響geographyAndHud幾何及既有地理延續檢查（4 flows、五尺寸各兩份），completed=true、errors=[]。其餘未改美術、GPU基準及裝配評分矩陣本輪未重跑。
- 各五尺寸390×844／320×568／844×390／390×460／1280×800，主讀數至少22px、分量及燃料至少13px；兩級86×6px燃料條分別50%／25%比例通過，單級隱藏、分離標籤、複核結果皆保留。儀表卡避開畫面中線，Canvas與simulation pane同高，不再有外置讀數／鏡頭列；390×844 Canvas為549.5625px。手機直／橫／短屏及桌面截圖已目視檢查，主要數字、單位、橫條可見。
- 保留44px鏡頭按鈕及32px手機側邊捲頁把手；共32次trusted原生觸控掃動控制欄，不改state／window／visualViewport。source及ZIP共20次running／paused分離後同位置點燃上級，面板不跳動。轉鏡、飛行暫停／續飛、向量位置／長度、SCORM生命週期與fullscreen皆在既有owner選取案例通過。
- runtime SHA-256 84769e90c94fb75040848a7bb94bc138be3b4a491cc5c8869afbd57cf53955a2；ZIP SHA-256 81aeee99c3ebab6674f19fef07a9c48d5c34f041ae5ed7df478617b301d7e33b，258803 bytes。報告及截圖在output/playwright/rocket-space-mission-lab/。此輪沒有物理、scene、美術、rubric、snapshot schema或共享runtime修改；真手機與真Moodle未驗證，模擬觸控證據不代表實機驗收。
- P23已commit／push：045eea1ff057e54aa20423bbef345125b67cbbc6；committed selection-preview在output/rocket/selection-p23.log，mode=affected。實際執行上述活動六Node、source／ZIP選取owner與geographyAndHud，未聲稱完整全庫或等待CI。沿用持續發布授權，Sites來源645ce400fa4359c29505d2649781e11c0a644cde、deployment appgdep_6add72ead7e481918b06e805c0ac3550，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P24：移除組裝接點提示字

- 按使用者要求移除火箭上「拖入零件」、拖放接點名稱及「插入」提示，接點保留44px透明圓框與可存取名稱，保留拖放吸附及不相容警告。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema，無物理、scene、評分、持久化或共享核心修改。此為局部文字及外觀修正，不新增測試；選取既有registered owner的onboarding／workshop，驗證source與ZIP的桌面／手機裝配、接點點按、原生拖放、分級與點火，並檢視組裝截圖。

- P24完成證據：main.js語法、既有interaction／lifecycle兩Node、check:tests（278 entries）、文件及diff檢查通過。既有registered browser owner以output/rocket-p24-check.cjs選取onboarding／workshop，source與extracted ZIP共8 flows，completed=true、errors=[]、selection=assembly-labels。各1280×800桌面、390×844與320×568原生觸控：空接點點按、鍵盤選取／移除、元件點按、拖放／取消、分離器裝配、點火及分級通過。未新增持久測試或改動registered owner。
- 接點沒有可見文字，保留aria-label；手機與桌面組裝截圖已目視。runtime SHA-256 62fed76245bf37198deefcd3d27a916ac4ee060f3c50994cc08e779e7fbb91b4；ZIP SHA-256 45701418974d6bc7b38efc5a474678f639035bb946d206fd83a4da56cebe60f4，258635 bytes。證據位於output/playwright/rocket-space-mission-lab/p24-assembly-check.json及*-assembly-no-labels-*.png／*-empty-socket-*.png。未重跑無關地球美術、全活動矩陣或全庫；真手機及真Moodle未驗證。
- P24已commit／push：be93722c9a0f054c54fd82616ec43d16d6baddc1；committed selection-preview在output/rocket/selection-p24.log，mode=affected。實際驗證範圍如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源f7a25612a1f2ec264a6b4985c56379f014b4c77f、deployment appgdep_6add74bbb670819190b215848e2da9c8，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P25：可見分離與姿態噴氣

- 歷史實作（分離與RCS規則已於P29修正）：分離時保留下級與分離器幾何，沿用分離前位置／速度，加1.5 m/s微小分離速度；下級以既有模型的無推力、真空重力滑行作視覺軌跡，上級沿權威飛行狀態運動。模型尺寸本來已誇張，兩級相對位移亦按火箭顯示比例呈現。鏡頭四秒內平滑由完整火箭轉為跟隨上級，保留上下級點火流程。下級離鏡後或60模擬秒清理資源；不加入下級氣動、回收／碰撞評分。
- 轉向採一對相反方向的短促藍白RCS氣流，僅由實際姿態變化觸發，鏡頭旋轉不觸發。動畫由模擬時間驅動，暫停凍結、還原或複核不重播；減少動態設定保留穩定氣流、不閃動。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema；效果僅位於scene與scene-art，main傳入可播放效果的edit標記，不改物理、燃料／評分、SCORM或持久化欄位。兩個既有runtime已在manifest，無新增依賴。
- 驗證決策：擴充既有registered browser owner的effects案例，source與ZIP、桌面／手機／窄屏／橫屏，驗證向上慣性、逐漸分開、上級點火加大間距、轉向氣流力矩方向、無轉鏡誤噴、暫停／還原／複核、資源清理及100 draw calls／100k triangles預算。沿用sceneArt、flightVectors、launchAndCamera與lifecycle相關檢查，目視分離及噴氣截圖。真手機與真Moodle為獨立驗收。

- P25完成證據：六活動Node、npm run check、check:tests（278 entries）、語法／文件／diff檢查通過。既有registered owner新增flightEffects，無新增runtime依賴。output/rocket-p25-check.cjs先跑source／ZIP的effects、sceneArt、flightVectors、launchAndCamera、lifecycle，共20 flows（p25-effects-check.json）。其後放大藍白氣流及改成整個下級完全離鏡才清理，source／ZIP四尺寸1280×800、390×844、320×568、844×390重跑effects／vectors，共12 flows（p25-final-effects-check.json）。最後修正噴氣以透明度脈動保持噴嘴位置，以及唯讀紀錄返回edit不可誤播，source／ZIP桌面1280×800與手機390×844重跑effects／vectors，共8 flows（p25-anchor-effects-check.json、selection=flight-effects-anchors）；三份報告completed=true、errors=[]，最後報告runtime與當前manifest逐byte一致。早期廣泛檢查與最後兩輪屬不同runtime雜湊，沒有聲稱最後再次執行全部活動／全庫或真Moodle。
- 分離前後上級投影位置誤差小於1px；下級繼承正向速度、關機滑行，兩級都上升，上級點火增加相對間距。下級頭部仍可見時不會清理；模擬時間暫停時位置／軌跡不變，轉鏡不觸發噴氣，reload／review／紀錄返回不重播。RCS順逆向成對氣流力矩、到位停止、快進完成後停止、噴嘴固定及減少動態穩定透明度通過；不改權威state。八次反覆重建／分離／清理，warm-up後geometry／texture／program／實際GL buffer數量一致：{"geometries":21,"textures":8,"programs":12,"buffers":63}。下級與上級同時顯示的測量上限45 draw calls／40462 triangles；RCS及向量各案例亦符合100／100k預算。手機／桌面分離及噴氣截圖已目視。
- 最終runtime SHA-256 4ae23e12f72ce08a50753fb316119e193f62ab7fe3e711093f79e7b4b906a9e4；ZIP SHA-256 755296c9fad7d4ab6523bf7d980421e09b4debfc06d1c75190a4a1dc1d283e7f，260007 bytes。效果按模擬時間運行、快進會加速；RCS僅作視覺呈現，不另扣燃料。真手機及真Moodle未驗證。
- P25已commit／push：e39bb3e605256055bfa2efe83468a881fa74f686；committed selection-preview在output/rocket/selection-p25.log，mode=affected。實際驗證選取與各輪runtime界線如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源3ea0de13e97eae3bfff694152157e28a69cce1e6、deployment appgdep_6add7ab0c1408191b705fc6262e69d82，native succeeded；使用最終驗過ZIP，原網址及owner-private維持。


### P26：安裝接點改為小圓點

- 使用者指出大圓形遮擋火箭；改為10px可見圓點，吸附時12px並以小光環標示。保留44px透明按鈕及既有30px拖放吸附範圍，移除正常／選取／不相容／hover／snap各狀態的大底色與外框，不改安裝判定或接點位置。
- 沿用既定assessment risk／rubric／dependencies／phase matrix／snapshot schema；本輪僅活動CSS，無runtime依賴或物理／評分／保存修改，不新增持久測試。選取既有registered browser owner的onboarding／workshop，驗證source與ZIP桌面／手機點按、拖放、分級及點火，拖動期間核對小標記、透明44px命中區及截圖。

- P26完成證據：check:tests（278 entries）、文件及diff檢查通過。output/rocket-p26-check.cjs選取既有registered owner的onboarding／workshop，source／extracted ZIP共8 flows，completed=true、errors=[]、selection=small-sockets；1280×800桌面及390×844／320×568手機，原生點按、拖放／取消、裝配與分級／點火通過。拖動期間實測可見圓點10–12px、透明按鈕至少44×44px、無大底色／border／box-shadow，small-sockets-*.png已檢視。
- runtime SHA-256 3972fae562f47cafc771141198cca422f2d1892fd2f5bc317f4f3891a084c6b1；ZIP SHA-256 6a3a27ee01195727ac32991bac4e8fcbfecd3d30ccab800fa6da79ed5118e64d，260082 bytes。僅活動CSS，沒有JS／模型／評分／保存修改；未重跑無關美術、特效或全庫，真手機及真Moodle未驗證。
- P26已commit／push：3ad39f089516716c03e3f234e35e8bd08a60084b；committed selection-preview在output/rocket/selection-p26.log，mode=affected。實際驗證選取如上，未執行全庫或等待CI。沿用持續發布授權，Sites來源0dadc5104c0b32bea77d65f4036d855ff1588dc7、deployment appgdep_6add7cc7788c8191b92332649b0e186c，native succeeded；使用驗過ZIP，原網址及owner-private維持。


### P27：非全螢幕手機面板與美術優化規劃

- 使用者指出普通手機瀏覽器的控制區太窄，並要求保留卡通風格、提升地球／太空細節且兼顧性能的詳細方案。先修改自適應面板；美術只制定[實作方案](../docs/rocket-art-direction-and-performance-plan.md)，尚未更換場景資產。
- 影響範圍：活動styles.css、既有registered browser owner、此計劃及美術方案。沿用assessment risk、rubric、phase/variant、snapshot schema和依賴；CSS不寫入學習狀態，無model／SCORM／manifest新增依賴。
- 版面決定：取消26dvh／236px上限及短屏166px限制，直向改為clamp(240px,42dvh,360px)，短屏以clamp(172px,calc(100dvh - 275px),220px)分配，390×460保留200px舞台，避免角落儀表與鏡頭重疊。固定飛行操作列保留，內容獨立捲動，44px觸控及數字16px保留，底部兼容safe-area。全螢幕沿用同一套自適應規則。
- 驗證決定：延伸已登記mobileCockpit案例，加入375×600、390×664普通瀏覽器可視區；往返844／664／568／460px高度，檢查非全螢幕、可見內容高度、底部控制可達及state不變。source和extracted ZIP沿用layouts、telemetry、trusted touch、鏡頭／裝配及lifecycle相關案例；靜態check、check:tests、活動Node與文件檢查。真Safari工具列／鍵盤、實機熱負荷、真Moodle另驗。
- 目前未commit；committed selection-preview待有實際commit後記錄，不以工作目錄預覽冒充。

- P27完成證據：六活動Node測試、npm run check、check:tests（278 entries）、JS語法、文件及diff檢查通過。沿用既有registered owner，ignored wrapper選取mobileCockpit／toolbarResize／layouts／completeTelemetry／geographyAndHud／onboarding／paletteScrolling／directCamera／launchAndCamera／workshop／lifecycle，source與extracted ZIP共60 flows、20 layouts，completed=true、errors=[]。報告：[p27-panel-check.json](../output/playwright/rocket-space-mission-lab/p27-panel-check.json)。引擎Chrome 155.0.8059.86，軟體GPU；沒有以此宣稱真手機性能。
- 七種操作艙尺寸中，390×664舞台310.1px、控制區278.9px、可捲內容205.6px；375×600可捲內容178.7px；320×568為166.7px；390×844為281.2px。390×460短視窗保留200px舞台、可捲內容111.7px，儀表、鏡頭及向量圖例無重疊；第一輪短屏重疊的中止報告保留為p26-panel-first-run.json，最終版已重新完整執行本輪選取。
- source／ZIP共48次trusted touch從數字／加減掣起始掃動，只移動panel而不改state／window／visualViewport；28次running／paused分離後原位點燃上級流程通過。844→664→568→460→844高度往返保持暫停飛行state、最後控制可達，無根頁面溢出。窄／短手機、工廠、桌面與封裝手機截圖已目視。
- runtime SHA-256：75cb354c040e1776166fa962f77903acc1ce0323311f91852e9e2049712d81fd；ZIP SHA-256：60127d66a8e5b076ba16816ed82b3b17f20ebe719713f7256f34124b1eefeb03，260140 bytes。manifest所列runtime與解包內容逐byte一致。
- 測試歸屬工作目錄預覽在output/rocket/selection-p27-worktree.json，mode=affected、唯一browser owner為rocket-space-mission-lab；選取器列出240個Node及該browser owner，但本輪實際只執行上述六活動Node和指定browser案例。未提交，故無本輪committed selection-preview；未部署。無新增runtime依賴或美術資產，未重跑無關全庫／美術benchmark；真Safari工具列／鍵盤、真機長時間性能、獨立T1–T3宿主矩陣及真Moodle仍待驗。


### P28：卡通美術完整實作與原站部署

- 使用者已確認P27美術方案並明確要求完整實作及更新原有網站。沿用P27手機面板；美術按地理色圖、局部地貌、雲層／星野、火箭／發射場材質及性能收尾實作。Sites project appgprj_6adc62579ab88191aba299bcb282ce95，保留owner-private及原網址。
- 沿用既定低風險assessment、rubric、phase/variant、snapshot schema；美術與性能層不改物理、評分、快照、SCORM報告或提交規則。地理位置沿用原發射點轉換，自轉仍僅視覺。新增runtime貼圖／地理資料要列入manifest；offline資料與產生工具獨立保存來源及重建方法。
- 影響範圍：scene-art.js、scene.js、main.js必要渲染更新；新assets及離線製圖工具；manifest、既有browser owner及必要Node資產檢查／registry；活動計劃及美術方案證據。先保存未改美術的runtime供同環境比較。
- 測試決定：實際查看2K／4K地球、低空／中空／軌道、三鏡頭、極區／經線接縫；來源／ZIP全部火箭browser owner與六Node，地標跨高度一致、素材故障保持提交、暫停無閒置GPU繪製、像素比例及降級、重建資源穩定、100 calls／100k triangles、手機紋理預算與ZIP≤5MB。增加可重建素材自檢及測試歸屬；保存持續採樣及前後比較，軟體GPU證據不得稱真iPhone性能。
- 完成檢查後commit／push本活動變更、產生committed selection-preview，以測過SCORM內容更新Sites source checkout、保存版本及部署，核對native部署結果與build標識。真機／Moodle環境若無法取得，清楚保留驗收限制而不虛構結果。

- P28完整本地回歸完成：七活動Node、registry自測、npm run check、check:tests（279 entries）、修改文件鏈結、語法及diff檢查通過。既有registered browser owner全跑source／extracted ZIP，合共130 flows、20 layouts，completed=true、errors=[]；Chrome 155.0.8059.86／SwiftShader。報告[report.json](../output/playwright/rocket-space-mission-lab/report.json)，首輪樹木移位導致launch clearance失敗的報告保留為p28-first-full-run.json，修正後已重新完整執行。
- 已驗全球／局部地理跨高度一致、普通手機控制區與動態高度往返、trusted touch、裝配／分級／RCS、變軌／預覽、部分提交、Moodle模擬續做／pending／review鎖定、fullscreen、貼圖載入失敗仍可提交、context loss／restore、重建資源穩定。Node資產檢查驗來源／素材hash、海岸／地標、陸地和封裝完整；離線生成器另有接縫及shader座標roundtrip自檢。
- 完整回歸版本runtime SHA-256：7c1dc75e9f8bed400526a960094650191d8d88ec68cacf29478941d67e7f678d。全部採樣場景最多73 draw calls、48,554 triangles；貼圖估算手機45.583MiB／桌面84.583MiB（含mipmap，不含framebuffer／driver）。暫停300ms期間0 GPU draws／0操作定位更新；兩級DPR降級與冷卻不改model或新增textures，樹木維持450m clearance且避開河岸。
- P27面板與P28卡通美術在本輪一併提交及部署；P27段落的「未提交／未部署」是當時歷史狀態。真iPhone／Android工具列／鍵盤／熱負荷／冷載／輸入延遲、三輪真機基準、真Moodle及獨立T1–T3宿主矩陣未驗證；本輪本地通過不宣稱Moodle-ready或真手機30fps。

- 同機基準snapshot的runtime hash為75cb354c040e1776166fa962f77903acc1ce0323311f91852e9e2049712d81fd。原始與封裝四場景各合計60秒採樣；桌面p95約33.4／66.9／66.8／50.2ms，與舊版相同；手機軌道50.1→33.5ms。暫停300ms的舊版操作定位18次，新版0次。軟體GPU結果只作相對比較。
- 首輪手機pad source曾出現p95=50ms、package=33.5ms；對舊／新各三次重測，舊版三次33.5ms，新版50.1／33.5／33.5ms。針對這個觀察，把背景球每fragment的atan／asin轉成既有球體UV，保留世界方向固定與日夜漸變；兩行shader修改不涉及控制／物理／持久化。最終版再跑registered owner的geographyAndHud／earthStyle／sceneArt／artPerformance／layouts及三次手機pad benchmark，分別驗source／ZIP，報告p28-final-sky.json；不把此前的全流程報告冒充最後shader的runtime hash。

- 最後背景shader版本的source／ZIP專項驗證完成：20 flows、20 layouts、errors=[]，每份三次pad穩態採樣。source p95=50／33.5／33.5ms；package三次均33.5ms，與舊版三次33.5ms相同。首次source尾端慢幀仍保留為已知觀察，不能宣稱所有首次入景樣本都達到≤10%回退門檻；沒有把軟體GPU推算成真機性能。最後runtime hash c84316dcefbc2b2c53328db755eafb979e0b575110e1a6982ccc0e7251d00c9f，ZIP SHA-256 1f57b33b0bacf5dd91992d7bb48e79429075cdcb2610c4ec6d86d7080465d04b，910154 bytes。這份ZIP供Sites部署，之後不再重建。

- P28已commit／push：28cc65dc44dc99cd1f4df9cddb942b0e51c07d2e。committed selection-preview在output/rocket/selection-p28.json：mode=full，279 entries，原因包括新offline工具未映射及registry修改；這是選取預覽，不代表已跑其餘活動全庫或CI。實際執行範圍及最終shader專項如上。
- 使用已驗ZIP更新Sites checkout，helper已push來源726bcd1ac0cf62a604a0341a0a7ca6caff84b156並產生rocket-art-p28.tar.gz；保存版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_5ccb289f1b248191b048390156371781，deployment appgdep_6add9eca40d08191a320930256be19e7，native status=succeeded。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-only audience維持。
- 線上核對完成：27份檔案中，25份程式／樣式／素材／版本資料逐byte等於已推送dist；兩份HTML移除託管平台額外插入的938字元script後，原頁內容亦逐byte一致。入口index.html由平台正常canonical redirect；驗證只跟隨同站點的對應目錄，不把service token帶離該站。build-info.sourceCommit=28cc65dc44dc99cd1f4df9cddb942b0e51c07d2e，packageSha256與上述最終ZIP相符。證據output/rocket/p28-live-verification.json；原網址已交給Codex頁籤開啟（queued），本地預覽server與測試Chrome已關閉。


### P29：分離軌跡、下級存續與RCS停止修正

- 使用者回報下級分離後衝到上級前方、很快消失，以及RCS在沒有繼續調向時長噴。根因包括實際位移乘上放大的火箭比例、下級忽略阻力、離鏡／60秒即清理，以及把微小自動姿態追蹤視為持續轉向。
- 範圍：scene的分離座標／生命週期與RCS視覺判定；model既有RK4增加僅供下級殘骸使用的質量選項，使其重用重力／阻力／觸地判定；既有model.test與registered browser owner的flightEffects案例。無新增依賴。權威上級物理、燃料、評分、SCORM、phase/variant及snapshot schema沿用；下級為session內視覺軌跡，reload／review不重播。
- 實作決定：保留上級原速度，下級繼承並沿分離軸減1.5m/s；用下級乾重、餘油、分離環質量計阻力，按實際世界單位顯示相對位移；下級模型放大比例另受其離地高度限制，避免插入地球，從上級向下望可見下降。取消離鏡及定時刪除，實際觸地或離開本次flight時清理；有足夠水平速度則按物理繞行，不強迫垂直墜落。RCS有可見轉向才噴，微小方向維持不持續顯示，停止轉向／到位後熄滅；暫停沿用效果凍結。
- 測試決定：七活動Node、check／check:tests及文件檢查；source與extracted ZIP四尺寸flightEffects，擴充低空阻力、傾斜分離、世界座標比例、超過60秒／離鏡返回、快進同步、下降與實際觸地、RCS小步長長時間到位後停止；沿用vectors、camera、mobile操作艙及lifecycle，檢查資源及100 calls／100k triangles。檢查後commit／push並更新既有owner-private網站；真手機／真Moodle另驗。


- P29主要回歸完成：七活動Node、npm run check、check:tests（279 entries）、語法及diff檢查通過。既有registered owner專項選取flightEffects／flightVectors／launchAndCamera／directCamera／mobileCockpit／lifecycle，source與extracted ZIP共42 flows、errors=[]、completed=true，報告output/playwright/rocket-space-mission-lab/p29-effects-check.json；runtime hash 361697fd674edad8b2b29c88bd9f699835fb554249ea49afa99adeb01a4f48fd。包含原生觸控、暫停／續做、還原／提交、context recovery等既有案例；不是全庫或全部火箭browser owner。
- 四尺寸1280×800、390×844、320×568、844×390均驗低空45°分離、真實座標比例、初速繼承、70秒離鏡返回仍保留、200秒後仍下降且最後實際觸地。從上級向下看的桌面及手機截圖已目視；下級按離地高度限制圖示大小，避免放大模型插入地球。分離、暫停、轉鏡均不改權威上級state。
- RCS正常0.1秒步長案例：100步中有9步顯示轉向，最後30步微小自動方向追蹤持續改變姿態，但0步顯示噴氣；順逆向力矩、快進到位、無轉鏡誤噴、減少動態與review不重播通過。八次重建／分離／清理warm-up後資源一致：29 geometries、8 textures、12 programs、106 GL buffers；仍符合100 calls／100k triangles預算。
- 首輪測試曾遇浮點時間assert與130次同步GPU繪製造成SwiftShader／CDP排隊逾時；已改為時間容差、直接採樣production drawEffects的小步長，再由既有正常draw案例驗圖形，資源重建分開browser turns。完整42-flow選取已重新通過，沒有把逾時當成功。最後另補impact／escaped時立即熄滅RCS，避免最後一幀長留；該單行修改後再跑source／ZIP四尺寸flightEffects，與上述較廣回歸分開記錄。

- 最終版source／extracted ZIP四尺寸共8個effects flows通過，errors=[]；新增實際觸地最後一步仍在轉向時RCS必須為0。報告output/playwright/rocket-space-mission-lab/p29-final-effects-check.json；最終靜態／registry亦通過。runtime SHA-256 2fa69aa7b2288fac3d819334477b4f3b96c368f29af02ec8c15323f1175b38c4；ZIP SHA-256 0e0acf2c78a6edbb1b01aa321063afff2bc503b154bfc8228b2cc38b0f7a635c，910202 bytes。此ZIP供本輪部署，之後不再重建；最後專項記錄的最大46 draw calls／43328 triangles。真iPhone／Android、實機熱負荷、真Moodle及全庫未驗證；下級軌跡仍是session內視覺狀態，reload／review不重播。


- P29已commit／push：06531bf638e1cd2909cf5dacd26276e0cfd95a00。committed selection-preview在output/rocket/selection-p29.json，mode=affected，只歸屬rocket-space-mission-lab；實際執行七Node與上述42-flow／最終8-flow專項，未聲稱全庫或完整browser owner／CI。
- Sites helper已push來源9f2efad18ae2a3b53011822bd93a318fd1b9c6e8，以上述驗過ZIP產生rocket-effects-p29.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_433d0bd3670c8191be848d5cf5cba4a1；deployment appgdep_6adda6a81f80819186ddf83f21adbc1a，native status=succeeded。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site及owner-only audience維持。
- 線上27份檔案已核對：程式／樣式／素材／build-info逐byte相同，兩份HTML移除託管平台插入script後亦相同；只跟隨同origin的canonical index redirect。build-info.sourceCommit=06531bf638e1cd2909cf5dacd26276e0cfd95a00，packageSha256與最終ZIP相符，證據output/rocket/p29-live-verification.json。原網站已交給Codex頁籤開啟（queued），本地預覽及測試Chrome已關閉。


### P30：適量分布雲團、引擎辨識與簡潔SIMLAB標示

- 使用者要求改善僅集中發射場、交叉薄片狀的雲，適量分布到其他區域；大推力引擎改四噴嘴集束、高效率引擎改單個寬口真空鐘形噴嘴，選件圖亦須能辨識；移除P–1500／P–6000、條碼及序號裝飾，改為燃料箱上橫向SIMLAB。
- 範圍：scene-art.js的雲／引擎／機身貼圖與火焰、scene.js必要的噴嘴火焰縮放、index.html引擎SVG；既有離線雲圖生成器與clouds.webp／geography.json資產hash；既有art.test及registered browser owner專項。無新增依賴，manifest沿用既有資產。沿用assessment risk、rubric、phase/variant、snapshot schema、燃料／質量／推力與SCORM；兩種引擎僅更改視覺，安裝／分離器包覆／選取幾何契約維持原2m引擎高度。
- 雲決定：以單批次圓潤立體雲團取代交叉平面，少量分布近／遠處及四方，保留發射點周圍淨空；全球雲圖保留1K、適度且跨經度分布，不增加runtime紋理尺寸或逐幀雲模擬。近景雲不再當作地面微細裝飾過早隱藏，隨原有局部環境漸退。
- 驗證決定：檢查離線雲圖覆蓋／經線接縫／資產hash；七活動Node、check、check:tests；source與extracted ZIP桌面／手機的四／單噴嘴、火焰出口／油門縮放、logo貼圖、近遠雲分布與截圖、分離器包覆／安裝拖放、分離/RCS、資源重建與100 calls／100k triangles預算。維持手機紋理預算；檢查後commit／push，將測過ZIP部署原有owner-private網站並核對線上檔案。真手機／真Moodle另驗。

- 首輪美術預覽source／ZIP共4 flows通過，含實際噴嘴與火焰錨點、油門寬度、logo文字、雲團及全球雲覆蓋；桌面及手機截圖已目視。較廣回歸的naturalStaging發現加長真空噴嘴超出舊外殼0.15m，已把該外殼提高至2.32m（留2cm實際間隙）並把可點選安裝環調至引擎base+1.7m；引擎stage高度／質量／物理不變。失敗報告保留為p30-first-regression.json，修正後重跑。

- 補充幾何證據：擴殼到恰好2.3m時選取已通過，但instanced Float32噴嘴頂緣比殼的bbox高約0.000000085m；增加2cm實際間隙，沒有放寬包覆assert。既有測試現在分別記錄包覆與實際pick結果，方便診斷。

- 火焰沿用instances helper，把四個出口按三層顏色各合併一批，與單出口同為3次火焰draw；油門僅在數值改變時更新各instance的寬度，出口座標固定，逐幀只沿用既有長度動畫。bounds預先保留全寬，避免縮放後錯誤裁切。

- 58-flow source／ZIP較廣回歸通過（p30-art-regression.json），包含新版美術、sceneArt、artPerformance、naturalStaging、onboarding、assemblyDrags、launchAndCamera、flightEffects、flightVectors、lifecycle及工廠／10km低空各15秒採樣。桌面p95約33.5／50.2ms，舊版33.4／50.1ms；手機工廠16.8ms相同，低空median仍16.7ms，但p95由16.8升至33.4ms。據此只把手機地球經向網格128降至96，保留全部近地徑向細分、2K貼圖與雲／引擎形狀；桌面不變。最後另跑美術／地理一致性／scene資源與手機benchmark專項；不以較早58-flow報告冒充最後runtime。

- 手機96經向版本專項18 flows通過，但低空p95仍33.4ms（median16.7ms）。再針對近地shader：當地表完全由局部圖覆蓋時直接取局部色，省去被覆蓋的全球UV三角函數及atlas取樣；混合邊界與雲仍走原路。既有地理像素檢查加入強制原取樣路徑的GPU對照，確認快路徑與原路徑色值一致。這是性能修正，不另降雲／噴嘴細節。

- 最終近地取樣優化版：source／ZIP專項18 flows（p30-final-mobile.json）及完整局部混合邊界GPU對照4 flows（p30-shader-boundary.json）均completed=true、errors=[]。快路徑與強制原取樣路徑逐像素一致；手機工廠／10km低空各15秒採樣p95均16.8ms、median16.7ms，回復舊版基準。這是Chrome 155／SwiftShader本機相對比較，不推算為真iPhone效能。
- 最終七活動Node、靜態／registry（279 entries）、語法及diff檢查通過；雲圖生成器重建逐byte一致，覆蓋0.2538、四個經度區域0.2401–0.2676，1K與接縫契約維持。手機／桌面紋理估算45.417／84.417MiB，較舊版各少0.167MiB。重建資源穩定，最終專項最多72 draw calls／56186 triangles。桌面／手機兩引擎、噴嘴近照、近遠雲及軌道截圖已目視。
- 最終runtime SHA-256 83b50ab29527509903614aca3b3a4ebe519dc84d73f7e453268c9da59766ac75；供部署ZIP SHA-256 9a76f692478d67a8c6546f3c85f2fd27bf7ca7c891189d73b750efb27626d07b，945902 bytes。廣泛58-flow版本runtime為910687814d52b0c88867b67e8593d754c94adc3005a00cf8e2d54e903e8a83cf；先前baseline由9c1ac80 git archive建立，實際runtime hash e7fe2a61dc39a6a5653c5f0d57bcc63e2542df6c315cb47ccc2caa0785340d4b，四個15秒採樣保存在p30-first-regression.json的before flows。未重跑全庫／完整browser owner，真手機、熱負荷與真Moodle仍待驗。


- P30已commit／push：ce75a4796e2982abd14c42644de99c4806c3084d；committed selection-preview在output/rocket/selection-p30.json，mode=full、279 entries，原因是tools/rocket-art/README.md未映射。這是選取預覽，不代表已跑全庫／CI；實際執行範圍與runtime界線如上。
- Sites來源ae0e2970eeedb02c6dba4ec244d1a403d8c7fc96，archive為rocket-art-refinements-p30.tar.gz；版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_616bc6f3a3348191974fe3eeadd51c89，deployment appgdep_6addb6920658819191f301997449047a，native succeeded。沿用原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site與owner-only audience。
- 線上27份檔案核對完成：JS／CSS／素材／build-info逐byte等於驗過dist，兩份HTML移除託管平台插入script後亦一致；只跟隨同origin的canonical index redirect。build-info.sourceCommit=ce75a4796e2982abd14c42644de99c4806c3084d，packageSha256與最終ZIP相符。證據output/rocket/p30-live-verification.json；原網址已交給Codex頁籤開啟（queued）。本地預覽及所有測試Chrome已關閉，生成的Python cache已清理，既有.codex-remote-attachments未動。


### P31：連續立體區域地形與海岸／距離精度銜接

- 使用者授權實作先前分析並部署。範圍：既有離線地理生成器、區域地形資產與renderer、既有art.test及registered browser owner、manifest。保留卡通風格；assessment risk／rubric／phase與variant／權威snapshot／物理碰撞地球半徑／評分與SCORM沿用，地形僅作視覺，不改發射或軌道物理。
- 決定：以相同Natural Earth海陸輪廓離線生成約480km寬的曲面立體地形，包含連續山脊丘陵及幾何海岸；分16區，各提供三種精度、共享邊界輪廓，屏幕投影大小與品質控制精度，有緩衝防反覆切換。近場設備仍按原規則隱藏，但立體地形不在60km高度一刀切；遠景逐步融入原地球，邊緣高度歸零。預先生成幾何／法線／配色，不在飛行逐幀重建，不增加重型後製或動態陰影。樹／建築按新地面落點定位，發射點與既有近場河道保留平整淨空。
- 依賴：既有本地Three與離線Python／NumPy／SciPy／Pillow，無新套件或網絡地圖。新增runtime檔案納入manifest與資產hash。風險：海岸對齊、區域邊界裂縫、LOD跳變、手機繪圖量／記憶體及reload／context恢復；以source與extracted ZIP實際檢查。
- 驗證決定：七活動Node、靜態／registry／selection-preview；地形資產確定性與合法拓撲、海岸共享、正法線與有限數值、平整發射／河道；source及ZIP桌面與手機近地斜望／沿海／中高空／軌道／縮放／遠離／下降返回、狀態不變、LOD與draw budget（100 calls／100k triangles）、資源穩定、context recovery與提交可達。與原版同機同鏡頭比較15秒採樣；真iPhone／熱負荷與真Moodle另驗。完成後部署原owner-private網站。

- 實作補充：以SciPy Delaunay離線產生受海岸邊界約束的網格，每層核對海陸面積；棄用第一輪狹長三角面細分。分區／精度共用邊界，近場500m網格及原發射淨空保留，遠方山地依屏幕精度簡化；最多240組低面數立體林冠只在可辨識的中景出現。近地全覆蓋區域的地球shader直接畫安靜海色，避免被幾何覆蓋的地圖取樣；邊緣及軌道沿用原圖。新增terrain.bin與terrain.js已納入manifest，無增加runtime紋理。
- 首輪預覽修正：地球Float32近極點高度與地形三角面的深度太接近，出現底面穿透；另用像素對照檢查，並收緊follow相機的深度範圍。新art.test檢查所有LOD的共享邊界，揭示海岸／分區交點的0m與高度場判定差異；以同一分段高度統一處理，不放寬裂縫斷言。這些預覽不作最終驗證或部署證據。

- 性能補充：中央四區使用不透明地形先寫入depth，地球略過被覆蓋的像素，外環保留邊緣混合；手機近地海面另用48經向網格，地理海岸由獨立精細地形負責，120km以上／軌道恢復原96、桌面維持128。沒有降低海岸、山地、林地精度或貼圖解像度。河流原有水面／河岸共面，新增水面depth offset避免露出條紋。淡出的外環先恢復底圖，再淡出立體地形，避免海色清除已淡去的陸地。

- 回歸證據：p31-check.json共54 flows（含舊版4個benchmark及source／ZIP各25個流程），completed=true、errors=[]，runtime a4b7534087fe0470ad0a7bf37d1af12c54922397fc797f0bcf9682638dd7db14；涵蓋分離、RCS、向量、相機、自然上升、地球分層、context recovery與提交生命週期。後續36-flow p31-final.json（runtime f9f7195d7c808cb8a6acb58cc16221d50b7cab7b29a0c2d897bff8f9afe0fa46）通過地面像素對照、LOD資源重用與上述主流程；手機近海精度調整後20-flow p31-mobile-final.json（runtime 9068f5c7567419f7f1d4da9fbcffbc6fb468e89745595a1581ecc9eb21c3de14）亦通過。這些是不同runtime的階段證據，沒有冒充最終全套回歸。
- 最後將地形光照離線烘焙，使用vertex color基本材質，保留真實網格起伏；最終source／extracted ZIP共20 flows，p31-release.json completed=true、errors=[]。包含桌面／手機各高度與zoom、48／96／128海面精度、海岸、4次LOD循環穩定、品質降級、暫停不繪圖、地理GPU對照，以及地球加入前後不透明地形像素差異=0。最後runtime SHA-256 e01fc38ed32d787114c8ef11dc060c1ec5422824e00e3bf4c9bf1bd2b53bcd65；ZIP SHA-256 4d896ce9a0b7ed8d6b0ee1ca7da78855efc6ead0c1ebe6d29f739cdad40ab5a0，1929748 bytes，供部署並不再重建。
- 資源：最後視角取樣最多85 draw calls／73456 triangles，低於100／100k預算；terrain.bin 1877428 bytes、三層合計43250 triangles，離線重建逐byte相同（SHA-256 a226b8d3b517f96b094f4b2ec120f738446662f663a34ae0e715180e7a1f44ba）。所有共享邊界高度一致；手機／桌面紋理估算仍45.417／84.417MiB。七活動Node、靜態／registry（279 entries）、最後目標語法、docs與diff檢查通過。桌面／手機各高度、海岸、發射場與地平線截圖已目視。
- 性能限度：同機Chrome155／SwiftShader，每個場景暖機2.5秒、採樣15秒。02e8a9c git archive基準runtime 38eae13fff2232e62927a580e78b6dce0ae8d6e42de80ea020216651e825b417；工廠桌面／手機p95=33.5／16.8ms，10km上升桌面／手機p95=50.2／16.8ms。最後上升桌面median約50.1ms、p95=50.2ms，手機median約16.7ms（與原版相同）、p95=33.4ms，CPU p95約1.9–2.4ms。平均顯示節奏保留，但手機尾端慢幀未完全回到基準；不聲稱所有性能指標均無回退或推算為真iPhone表現。新場景沒有新增紋理或後製，仍按像素大小、分區、品質降級控制繪圖量。
- 真iPhone／Android、熱負荷與真Moodle未驗；未跑全庫或完整browser owner。山地高度是視覺示意，物理碰撞仍沿用原地球半徑，沒有新增地形碰撞或改評分／snapshot。

- 已commit／push實作3f0341b3e7f2fa17b5f1e47f3da3803d54e4bdc0。committed selection-preview位於output/rocket/selection-p31.json，base02e8a9c→3f0341b，mode=full、279 entries，原因是tools/rocket-art/README.md未映射；這是選取預覽，實際執行範圍及各runtime界線如上，不代表全庫／CI。
- Sites helper已push來源0da7b4d0c8e5df60d299b0ded9fe19c4ed551c40，archive為rocket-terrain-p31.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_b43555f7d46c8191857d1fe2555a4a37；deployment appgdep_6addccaa50348191b2c49a8b76afe176，native status=succeeded，2026-10-25 09:32:34 UTC。沿用原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site與owner-only audience。
- 線上29份檔案已核對：程式、樣式、地形binary及其他素材、build-info逐byte等於驗過dist；兩份HTML移除託管平台插入script後亦相同，僅跟隨同origin的canonical index redirect。build-info.sourceCommit=3f0341b3e7f2fa17b5f1e47f3da3803d54e4bdc0，packageSha256與最終ZIP一致；證據output/rocket/p31-live-verification.json。原網址已交給Codex頁籤開啟（queued），本地preview及全部測試Chrome已關閉；既有.codex-remote-attachments未動。


## P32 — 全球立體地形（2026-10-25）

- 範圍：完成 480 km 地方地形以外的全球卡通陸地；使用同一釘選 Natural Earth 海岸資料，離線生成低模曲面、山脈及頂點色。海洋保持球面，雲及星空沿用現有資源。
- 決策：全球合併粗網格以單一 draw call 顯示可見區塊；10° 細節格按畫面大小載入，最多 4 個顯示、6 個快取及 2 個並行請求。細節載入失敗保留粗網格。離線共享邊界頂點，局部核心保留現有精細地形，外圍重疊過渡。
- 不改物理、碰撞、任務、評分及 authoritative snapshot；屬非評核視覺層，現有階段／變體／Moodle 持續狀態契約不變。
- 先驗證全球粗網格與一個外圍細節格，再生成其餘細節；鎖定後只跑必要的來源／解壓 SCORM 回歸和一次最終完整性檢查。註冊擁有者沿用 tools/rocket-space-mission-browser-regression.js 及 art.test.js。
- 驗收：跨洲／日期變更線／極區／局部接縫、頂點有限及朝外、資源清單與 ZIP 一致、快取有界、停止時不持續重畫、品質降級及 context recovery；保持每幀 ≤100 calls /100,000 triangles。實機 iPhone 和真實 Moodle 不以桌面模擬代替。
- 部署：通過後更新原有 owner-private Sites 網址；記錄來源 commit、封包 hash 和實際檢查證據。


- 實作完成：全球440個非空陸地格與合併粗網格，海岸由實體三角面邊界構成；沿用釘選50m Natural Earth與共用山脈資料。細網格0.2°、海岸簡化0.015°、共享邊界0.3°；極區／凹灣在離線polygonization及constraint recovery處理，所有coarse/fine邊界逐點相同。山坡採卡通強化明暗與頂點色，仍有實際徑向高度，無新增runtime紋理或後製。
- 全球素材共26,752,004 bytes；粗網格2,229,200 bytes／75,138 triangles，最大細格106,332 bytes／5,191 triangles。原24MB離線規劃上限改為28MB以保留0.2°精度，運行快取另行限制；全套已通過的bake在寫metadata前遇到舊總量斷言，metadata由全部已驗binary重建，seconds=null／recoveredAfterBudgetAdjustment=true，沒有虛構一次額外重建或時間。原local binary與WebP未更動。
- 運行：可見粗格動態index buffer合併為一個mesh；球面前半球解析裁切避免海面穿透，區域核心裁切與原外圈淡出接駁。細格最多4個顯示、6個快取、2個請求，超出即dispose，品質2保留粗幾何；細格失敗留粗網格，重新載入才重試。低於20km且在原區域內不用全球細格。飛行、物理碰撞、評分及snapshot不變。
- Prototype先驗source／解壓ZIP、桌面／手機共4 flows，最大57,651tri／3calls。全素材首輪24-flow p32-release.json通過，包括全球各洲、日期線、兩極、220/240/480/800km過渡、快取／失敗fallback、區域depth像素比對、context recovery、向量、SCORM生命週期；這是低空載入優化前的階段證據。
- 最後runtime 9c7d251a1e05382f7905c68d50983a3b87d8964e10066e43e9e3cb06830160a1：p32-final.json source／解壓ZIP共18 flows completed=true／errors=[]，通過上述全球／區域視覺與資源、sceneArt及artPerformance檢查；低空四種高度的fine active均0。最大86calls／93,240tri；跨洲cache最多6、實測全球raw buffers最多2,805,736bytes（另有重用index GPU buffer），品質降級、細格失敗、暫停、資源回收及不改答案均通過。4個15秒p32-benchmark.json使用同一runtime；包裝前後manifest全部檔案逐byte相同。
- 效能：Chrome155／SwiftShader同機量度，暖機2.5秒後每場景15秒；桌面10km／800km外圍median皆50.1ms，p95為66.7／66.8ms；手機尺寸median皆16.7ms、p95皆33.4ms，CPU p95桌面2.6／2.1ms、手機皆2.0ms。手機節奏與P31相同；桌面median相同但p95由50.2變66.7ms，低空停用fine仍有此軟體渲染尾端差異，不聲稱零回退或當成真實GPU結果。
- 七個活動Node、JS/Python語法、npm check、check:tests（279 entries）及diff通過；沿用既有註冊擁有者擴展檢查。最後gate只改低空LOD啟用條件，已另驗JS語法及受影響18-flow；前24-flow生命週期／向量仍按其runtime列出，沒有冒充最後全套。沒有跑全庫或完整browser owner。桌面／手機截圖已目視；真iPhone／Android、熱負荷、真Moodle未驗。地形高度屬示意，無地形碰撞。
- 最後供部署ZIP 4a98c411fbd0e6bcf4b781b168865445c55240ae31d57784f18383b64d6d8b48，16313897bytes；使用這份封包準備Sites dist，不再重建。

- 已commit／push實作1120c690ec3ca235901b1bcd74e176d2cdd0dfd2；committed selection-preview output/rocket/selection-p32.json，base1444cca→1120c69，mode=full、279 entries（README未映射），只代表選取預覽，實際執行範圍依上列證據。
- Sites helper已push來源8f26611d089307abe437a8f6fb02894cdad7ae20及封裝rocket-global-p32.tar.gz（16,257,588bytes）。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_969f950f91a08191a7ab5dcef9e39664；deployment appgdep_6adde3e1884881919a5b9883fb45cc3c，native status=succeeded，2026-10-25 11:11:41 UTC。沿用原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site與owner-only audience（發布前get_site已再確認1owner／0groups／0external）。
- 線上471份檔案已核對：全部程式、樣式、441份全球地形binary及其他素材、build-info逐byte等於驗過的dist；兩份HTML只移除平台插入script後亦相同。只跟隨同origin canonical index redirect，bypass credential僅經隱藏stdin／同origin header使用。build-info.sourceCommit=1120c690ec3ca235901b1bcd74e176d2cdd0dfd2、packageSha256=4a98c411fbd0e6bcf4b781b168865445c55240ae31d57784f18383b64d6d8b48；證據output/rocket/p32-live-verification.json。原網址已交給Codex頁籤開啟（queued），所有本次測試Chrome／HTTP server／helper均已結束；既有.codex-remote-attachments未動。


## P33 — 地形接縫與分離顯示（2026-10-25）

- 用戶637.6km截圖揭示區域色盤／烘焙明暗與全球色盤、日夜光照不同。範圍：區域頂點色改為全球粗幾何的同一色場取樣，加同一日夜光照；區域遠景按畫面大小淡出，淡出時全球在後方完整接替，不能淡到海色或硬切core。
- 不重建全球441份素材；保留區域海岸／高度／碰撞／細節，離線重烘焙區域顏色，無新增runtime紋理、幾何或依賴。擴展既有art.test及browser owner；驗637.6km截圖同角度、不同光照、區域depth、各高度接駁與資源預算，source及解壓ZIP一致。
- 分離診斷：下級已有獨立RK4狀態；真空未點火同速符合重力模型，點火60秒會拉開約23km。大比例火箭圖示掩蓋真實距離。保留物理及snapshot；加入上下級實際速率／距離／下級升降比較，延長真空滑行和點火60秒測試，避免靠虛構減速製造畫面。等待用戶補充點火狀態，繼續獨立地形工作。
- 評核／rubric／phase-variant／持續狀態契約不變；本輪均為顯示層修正。沿用原owner-private Sites更新，發布前完成封包驗證並記錄實際限制。


- 已完成：區域baker以全球粗網格的同一linear頂點色場插值，近場保留坡面明暗、接縫前漸減額外明暗；terrain.js匯出共同terrainLighting，區域與全球共用planet.sun。區域90–180 projected pixels漸變，僅完全不透明時裁切全球core；半透明時完整全球陸地在後方接替。
- 區域binary大小仍1,877,428bytes，與上一commit逐byte對照確認header、heightfield、全部LOD位置／normal／fade／indices不變，只有RGB改變。全球441份binary與紋理未改，無新runtime依賴、幾何或紋理。新的區域SHA-256 bb0d9d5dcef807131ea0becf49d267f152086dce95ed7bced31ccb44592a585c.
- 分離物理無共用速度或強制跟隨；原獨立重力／阻力軌跡保留。控制面板新增上下級速率、實際距離、下級升降及點火狀態，明示火箭圖示放大。真空約637.6km／5,030m/sfixture：未點火60秒後相距90.118m、速率差1.506m/s；上級點火約60秒後相距23.37–23.42km、速率差809.8–810.8m/s。下級當時仍上升符合物理，沒有虛構減速或立刻墜落。用戶未補充點火狀態，兩種情況皆驗。
- 最後runtime eaa5156229d73b63ad291d8ceb9411bd834230956977751942be5575f7465327：source／extracted ZIP共26-flow p33-release.json completed=true／errors=[]，包括637.6km及其他高度預覽、近場LOD／depth像素遮擋、長時間分離／下降／impact／RCS／資源清理與SCORM生命週期。另4-flow p33-colors.json在300km保留區域細節時，以日照／背光、每frame866–872個區域內陸pixel對照global替代，平均RGB差0.51–1.29／255，p95≤2.34／255；初版helper曾拿getState複本而未改實際高度，色差定量驗收以修正後這份4-flow為準。637.6km桌面／手機預覽目視已無異色補丁。
- 兩個15秒source benchmark同一runtime，Chrome155／SwiftShader暖機2.5秒：桌面10km median50.1ms／p9550.2ms、CPU p952.7ms、70calls／71,053tri；手機尺寸median16.7ms／p9533.4ms、CPU p952.3ms、65calls／43,853tri。沒有新增記憶體資產或後製；僅就本機模擬報告，不推算實機。
- 七個活動Node、npm check、check:tests（279 entries）、最後JS syntax及diff通過。沿用既有registry owner擴展驗證，無評分／snapshot／physics schema變更；沒有跑全庫或完整browser owner。真iPhone／Android／Moodle及熱負荷未驗。
- 最後供部署ZIP SHA-256 f80bb88471b39c03faa64e2616fee7f944cafbf321a18bcb816f82906acf770c，16294350bytes，後續從此ZIP準備dist，不再重建。

- 已commit／push實作66a20b402eac8fbe2bf5225875dd1b7bfe3e9d07。committed selection-preview output/rocket/selection-p33.json，base0921abb→66a20b4、mode=full、279 entries（README未映射）；僅為選取預覽，非全庫執行證據。
- Sites helper已push來源b87f0aec39db3bb7cd067ff9447981011b466f9d及封裝rocket-seam-separation-p33.tar.gz（16,244,683bytes）。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_4bade88a9b448191a29cc457db105e58，deployment appgdep_6addf280d48081919580bc4f4c777dc0，native status=succeeded，2026-10-25 12:14:02 UTC。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site，owner-only audience保留；發布後get_site確認1owner／0external。
- 線上471份檔案已核對：程式、樣式、地形binary及其他素材、build-info逐byte等於驗過dist；兩份HTML僅移除平台插入script後相同，僅跟隨同origin canonical index redirect。build-info.sourceCommit=66a20b402eac8fbe2bf5225875dd1b7bfe3e9d07、packageSha256=f80bb88471b39c03faa64e2616fee7f944cafbf321a18bcb816f82906acf770c，證據output/rocket/p33-live-verification.json。原網址已交給Codex頁籤開啟（queued）；本次測試Chrome／HTTP server／helper已結束，既有.codex-remote-attachments未動。


## P34 — 當地地表碰撞與撞擊效果（2026-10-25）

- 範圍：固定半徑碰撞改為共享地面高度，HUD離地改AGL且近地用m顯示，軌道／評分仍用參考球面海拔。共用同步surface資料含全球0.5°與原地區域heightfield；近飛行點使用與碰撞相同高度的稠密接觸地面，避免全球粗球面弦高造成視覺懸空。高空保留既有LOD／快取。
- 物理modelVersion2；v1 draft先嚴格驗舊契約再遷移，impact點移到新地面；歷史review／pending v1保持原資料，舊評分與凍結重試不重寫。v2 impact必須符合共享surface高度，不能放寬成任意impact。rubric／orbit高度定義及獲得分數規則不變。
- 撞擊一次性火光／碎片／煙（海面用水花），僅新即時impact播放；暫停與低動態效果、切記錄、重新載入／Moodle resume不重播，不改答案或快照；明確時長與有限物件／回收。下級同用碰撞，但不能令其他仍在飛的上級停下。
- 驗證：異地高地／海面／區域坡地、橫跨山脊、不同方向最底點接地、近地AGL單位、主級及下級impact、效果單次與暫停／resume／review／context、全部合法snapshot及舊版本兼容；來源與解壓ZIP核對、資源預算及必要benchmark。沿用既有registry owner擴展，完成後部署原owner-private Sites。


- 已實現共享surface.js／surface-data.js：全球721×361、區域257×257，870,589bytes（gzip約191KB）；海面精確0、海拔≤3500m，與原區域heightfield同源。物理只在近表面查詢，按250m掃描／二分找首次接觸；碰撞與分離下級共用根因，保留撞擊前速度供紀錄／效果。
- 近地接觸mesh共1664tri，10m至160km同心稠密rings，僅AGL<5km啟用、地表移動100m才更新；遮掉所覆蓋舊粗地面並沿外圈淡出，使用全球粗色場及共同日照，不新增紋理。近地鏡頭按火箭方向對準；AGL<10m以可見船體實際頂點計地表間隙並校準最低點，避免倒轉／橫向圖形懸空或穿地。
- HUD「離地」用AGL，1km內用m，另顯示參考球面海拔；orbital elements、rubric及分數定義不變。modelVersion2新impact嚴格驗共享地表；v1 draft先舊契約驗證再遷移，歷史review／pending保持v1。Node lifecycle補驗v1 finished信任、pending凍結／重試原文不變、editable draft遷移及合法續飛。
- 撞擊pool固定2組，火光／6組煙／12碎片或水花，3.2s內回收顯示、不持續重畫；main impact之後隱藏已毀圖示，分離下級落地只處理其事件。效果不寫snapshot，pause／hidden／context lost不走時，reload／review不重播；低動態抑制飛散碎片。
- 透明接觸地面版本runtime 147d4c2595a73ac9b88a730a47a083c9e31f7e59703f8b75987d4ee6e3103b29：source／extracted ZIP共10-flow p34-final.json completed=true、errors=[]，含桌面／手機各3地點、實際船體接觸、AGL單位、火光／水花、一次觸發及完結idle、reload不重播、低動態、contact ground的depth像素比對、SCORM及context recovery。12次主級contact的clearance約0（|error|<1e-8m）、graphic vertex gap=0；山地海拔2435.1035m而AGL=0，海面=0。取樣主級爆炸最高75calls／73,709tri。
- 較早p34-release.json另跑分離下級的完整下降／impact／RCS及回收流程，但其source測試期間仍有表面及鏡頭修正，不冒充最後固定runtime全套；最終固定runtime驗收以上述10-flow為準。模型及persistence的真實異地丘陵、signed AGL、山脊sweep、落地停止、±10m偽impact拒絕、draft/review roundtrip、舊版遷移都已執行。
- 同runtime近地100m source benchmark各暖機2.5s、採樣15s：1280px median 66.8ms /p95 83.4ms /CPU p95 2.8ms; 390px median 33.4ms /p95 33.5ms /CPU p95 2.7ms。為Chrome155／SwiftShader桌面模擬，非真手機／GPU熱負荷證據；沒有廣泛重跑高空benchmark。
- 七活動Node、npm check、check:tests（279 entries）、JS/Python syntax及diff通過；新增Surface資源／海水0／clearance自檢已併入既有art.test。沿用browser registry owner擴展。未跑全庫或完整browser owner；真iPhone／Android／Moodle未驗。地面高度仍卡通示意，非測繪DEM。
- 上述透明版本ZIP SHA-256 1755f33ee5cb3fe436986d132c928e049123f675f05d7198154216c55956ed0c，16490088bytes；未部署，改以下列優化後封包為準。

- 最終接觸地面將120km內不透明部分先寫depth，僅外圈透明過渡；仍1664tri、增加1call，避免全片透明重複繪畫。補上globalTerrain.colorAt有界8格快取，共用原粗網格色場。最後runtime 8f0ab5d9a06f76c95d317697b6293d0a6aef05e55917c5e99e2d6d093e0afe26：p34-opaque.json source／extracted ZIP共8-flow completed=true、errors=[]；桌面／手機各3地點的AGL、船體接地、火光／水花、單次／回收／reload／低動態與depth像素檢查通過。模型、codec及生命週期未再改，上述10-flow的生命週期證據保留其runtime界線。
- 同最後runtime的p34-benchmark.json，近地100m、同Chrome155／SwiftShader、暖機2.5s及採樣15s：桌面median66.7ms／p9566.8ms／CPU p952.9ms；手機尺寸median33.4ms／p9533.5ms／CPU p952.5ms。桌面尾端改善，手機未量到改善；不能與P33的10km場景直接比較，亦不聲稱無性能回退或真機流暢。
- 最後供部署ZIP SHA-256 3a0465e05007eade6247360f69c28f5cd6ed9e42c26a078e0e43a29a5e2d094a，16490260bytes；後續直接從這份已驗ZIP準備Sites dist，不再重建。

- 初版實作35387713381739ad1d5c090724c7b61a23c5dda4及最後繪圖優化872449b63523f7d689f7b5ee96d99c6fafb8a9c7已commit／push。committed selection-preview output/rocket/selection-p34.json，base0fe1407→872449b，mode=full、279 entries，原因為既有test-support.js未有asset consumer映射；這是選取預覽，實際執行範圍與runtime界線如上，不代表全庫執行。

- Sites helper已push來源101c3ed4a36641e8d535ed327bc8eea8c1a018e6及rocket-terrain-impact-p34.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_f27ad65a88588191b6f468fb0b6f031b，deployment appgdep_6ade05f195c08191b82b9f2e06e47570，native status=succeeded，2026-10-25 13:37:00 UTC。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site；owner-only audience保留，get_site確認owner／0external。
- 線上475份檔案已核對：全部程式、樣式、地形binary及其他素材、build-info逐byte等於驗過dist；兩份HTML僅移除平台插入script後相同，僅跟隨同origin canonical index redirect。build-info.sourceCommit=872449b63523f7d689f7b5ee96d99c6fafb8a9c7、packageSha256=3a0465e05007eade6247360f69c28f5cd6ed9e42c26a078e0e43a29a5e2d094a，證據output/rocket/p34-live-verification.json。原網址已交給Codex頁籤開啟（queued）；本次測試Chrome／HTTP server／helper及線上驗證程序已結束，既有.codex-remote-attachments未動。

## P35 — 已點火分離畫面（2026-10-25）

- 用戶補充上級已點火。最新版本source重現：60s實際相距約23.4km、速度差約810m/s，但高空跟隨鏡頭按海拔拉遠，放大圖示掩蓋間距，目視仍似完整火箭。
- 範圍：跟隨鏡頭在分離後4s平順轉到以真實兩級間距決定的近景；距離增加後仍受原跟隨距離上限約束。先同步下級狀態再計鏡頭，避免讀上一幀的下級位置。物理、推力、snapshot、rubric和歷史結果不變；不用虛構減速。
- 沿用既有browser owner加已點火／滑行、桌面／手機的畫面間距斷言及首4s採樣；保留原分離位置、暫停、視角、下降／落地、RCS檢查。來源／解壓ZIP驗後更新原owner-private Sites；不新增依賴或素材。

- 已實現：分離跟隨距離在4s內以對數平順轉到間距近景，鏡頭中心偏移≤相機距離10%，上級近地／下級遠離也保留上級；下級RK4同步提前至鏡頭計算前，未更改動力學。只有scene.js少量修改，無新增素材／依賴／draw calls。
- 最後runtime 66a819fc827ade48e5bcaf966edee11a142ec6085f2f2f4723d6225f2867c29c：p35-release.json completed=true、errors=[]、10 flows。source／extracted ZIP各桌面1280×800與手機390×664驗滑行／已點火首1／4／10／60s畫面，後三點已點火均>30px且兩級接點可見；60s相距23.37–23.42km、速度差809.8–810.8m/s，屏幕間距桌面194.6px／手機80.8px。上級近地而下級遠處fixture亦保留上級可見。
- 同最後runtime的ZIP另驗四種尺寸flightEffects（1280×800、390×844、320×568、844×390），包括原分離接點不跳、暫停不動、reload不重播、不同視角實際米制位置、下級長時間下降與真正地面impact、RCS及資源回收；取樣boost最高54calls／63,205tri。ZIP桌面／手機另驗三地terrainImpacts，船體接地、AGL、單次效果及回收／resume不重播通過。
- 前一runtime f74a7fe0b906feeaa7f94001af9ad36fcb8cee12511247eafa4369cec7fdf2aa的p35-final.json跑完8個source flows後，HTTP server teardown超時；沒有冒充completed。測試owner新增離頁後關服，最後10-flow成功退出；只重驗最後受影響範圍，沒有全庫重跑。npm check、check:tests（279 entries）、JS syntax及diff通過；真手機／Moodle及額外效能benchmark未驗。
- 最後供部署ZIP SHA-256 cf6312bd120b0de24e3b441b349ab33415903227f1bcb2e8ee70903a41e36793，16490388bytes；直接用這份已驗ZIP準備Sites dist，不再重建。

- 已commit／push實作52ea4007a76c45b3c4bdddd3d3e40a7ed3368b5b；committed selection-preview output/rocket/selection-p35.json，baseb81f259→52ea400、mode=affected、242 entries，映射rocket活動及owning browser scope。這是選取預覽，實際執行範圍如上，非242項全部執行。

- Sites helper已push來源95d2914f6bd2bbb30d2040ac1c546c011e7ba7b6及rocket-separation-camera-p35.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_1fa016a59bd88191963093b6454eb902，deployment appgdep_6ade0f1b2e4c819185cbd5ea3329f89f，native status=succeeded，2026-10-25 14:16:05 UTC；原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site，保留owner-only audience。
- 線上475份檔案已核對：程式／樣式／素材／build-info逐byte等於已驗dist，兩份HTML僅移除平台插入script後相同，僅跟隨同origin canonical index redirect。build-info.sourceCommit=52ea4007a76c45b3c4bdddd3d3e40a7ed3368b5b、packageSha256=cf6312bd120b0de24e3b441b349ab33415903227f1bcb2e8ee70903a41e36793；證據output/rocket/p35-live-verification.json。原網址已交給Codex頁籤開啟（queued）；本次Chrome／HTTP server／helper／驗證程序已結束，既有.codex-remote-attachments未動。

## P36 — 近地精度、坡面光照與地表參照（2026-10-25）

- 用戶截圖：發射台被近地面切成放射碎片，山坡和平地同色，異地下降缺乏相對移動參照。檢查發現contact ground仍把近地頂點存成地球半徑尺度Float32，厘米級發射台與地面深度失準；共用terrainLighting只用radial日夜光照。
- 範圍：接觸地面頂點改為中心相對座標，由子mesh雙精度平移定位；所有地形共用坡面明暗及固定世界座標地表色斑，接觸區增加有限批次低模植被／石塊作近地移動參照。沿用同一surface碰撞資料、光源、現有品質與距離降級；不改模型、schema、rubric或記錄。
- 沿用art.test及browser owner，驗發射台俯視／低角度／近地升降、異地丘陵／海面、坡面受光差、細節世界固定及回收有界、先前地形接觸／分離、來源與SCORM閉包、必要近地benchmark。通過後更新原owner-private Sites；真機／Moodle仍須另驗。

- 完成近地中心相對頂點：子mesh以中心平移定位，頂點只存小差值；碰撞高度與球面資料不改。內外圈共用法線，以完整1664tri計算，不因分成opaque／fade網格而出錯。發射台幾何未重建，消除地面精度造成的切片。
- 所有地形共用坡面受光：全球coarse／fine從原幾何計法線，區域用現有法線，contact從相對座標幾何計法線；卡通強化坡面明暗在vertex計一次，保留共同日夜光源。共用128×128 RGBA程序細節紋理，含mip約87,381bytes、1份cache資源，固定世界座標32m色斑；低成本mip／線性取樣，不用後製或動態陰影。原441份全球binary／區域binary及WebP不變。
- 異地近地面新增最多81個低模樹石、兩個InstancedMesh draw calls；經緯格固定、同surface定高，地面移動100m才重建。低於1200m完整顯示、到2000m淡出，品質2隱藏；無每幀增加物件。這是卡通參照物，未新增真實地貌／建物／生態資料。
- 最後runtime fef034c7291d58fe24550469de5cd26bbf690de2563fc67cc065f1a63c2bc36f：p36-final-optimized.json source／extracted ZIP共8-flow completed=true、errors=[]。兩尺寸俯視／低角度發射台白色遮擋mask各1098／355 pixels，新增地面遮掉0 pixels；移動200m仍有72個重疊樹石位置相同（誤差<2cm），總量≤81、往返6次geometry／texture／program不增，品質降級隱藏通過。山地受光係數範圍.745–1.273、shader runnable；區域／全球300km接替日照／背光平均RGB差1.82–4.59／255，p95≤13.34／255，無舊三角補丁回歸。最後桌面／手機截圖已目視。
- 前一runtime253c315ac199c7101aa04221c96823ce2a08a92bff2d0946ee520db71c521412的p36-release.json另完成14 flows：source／ZIP地面可讀性與接縫、ZIP三地terrainImpacts／terrainDepth／vacuumSeparation。之後只改材質取樣與頂點光照，幾何、props、模型與codec未改；保留各runtime界線，不把前14-flow當最後全套。調優中一次benchmark缺少vertex光源uniform，該p36-invalid-benchmark.json作廢，已補宣告且benchmark owner新增shader編譯失敗斷言。
- 最後p36-benchmark.json與最後runtime相同，Chrome155／SwiftShader近地100m，各暖機2.5s／採樣15s：1280px median66.8ms／p9583.5ms／CPU p954.7ms；390px median33.4ms／p9533.5ms／CPU p952.9ms。取樣89calls／76,229tri（手機63,429tri），紋理約88.60MB／47.71MB，均在現有預算內。相對P34同場景，median及手機p95保持，桌面p95由66.8增至83.5ms，CPU增加；不聲稱零回退或推算真機。
- art.test、npm check、check:tests（279 entries）通過；最後vertex shader調優後另驗相關JS syntax、diff、上述8-flow及帶shader斷言的benchmark。沿用既有browser owner；未跑全庫／完整owner或真iPhone／Android／Moodle、熱負荷。
- 最後供部署ZIP SHA-256 9754e89b00378986c0e582c090d26d15c4fd37b2360af1c8530462d7c50390fb，16491899bytes；直接從此已驗ZIP準備Sites dist，不再重建。

- 已commit／push實作299c08ef227f17bcff4b9b12e8203750154d555b；committed selection-preview output/rocket/selection-p36.json，baseb75e0a4→299c08e、mode=affected、242 entries，全部修改映射rocket活動／owning browser scope。只代表選取預覽，實際執行範圍如上，非242項全跑。

- Sites helper已push來源ed6fd12b5547c61db961ca2371c31b17da0d11c7及rocket-ground-readability-p36.tar.gz。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_08b08f5158548191ad02651eb1b49435，deployment appgdep_6ade1e3629ac8191a8b01472f80b2194，native status=succeeded，2026-10-25 15:20:31 UTC。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site，保留owner-only audience，發布前get_site確認owner／0external。
- 線上475份檔案核對完成：程式、樣式、素材及build-info逐byte等於已驗dist；兩份HTML僅移除平台插入script後相同，只跟隨同origin canonical index redirect。build-info.sourceCommit=299c08ef227f17bcff4b9b12e8203750154d555b、packageSha256=9754e89b00378986c0e582c090d26d15c4fd37b2360af1c8530462d7c50390fb；證據output/rocket/p36-live-verification.json。原網址已交給Codex頁籤開啟（queued）；本次Chrome／HTTP server／helper／驗證程序均結束，既有.codex-remote-attachments未動。

## P37 — 地形光照修復（計劃 2026-10-25／實作 2026-10-26）

### 2026-10-25 計劃階段（歷史）

- 使用者回報 1,182.5 km 高空的大陸格紋、地貌不自然，明確要求先分析與詳細計劃，暫停程式修改及部署。
- 詳細診斷、視覺方向、分期、檔案範圍、性能預算與驗收見[地形光照修復計劃](../docs/rocket-terrain-lighting-repair-plan.md)。此計劃修訂 P36 光照／細節方向，保留近地精度修正；尚未實作。
- 只讀資產診斷：全球以 10° 分塊並保留重複邊界頂點；各自 computeVertexNormals 配合八倍坡度公式，會放大粗球面及單側邊界誤差。北美 1,395 對共點的法線角差 p95 約 2.96°；在記憶體把高度設零後仍約 2.60°，固定測試光源的倍率差 p95 仍約 0.290。這是係數診斷，不冒充截圖像素比較。
- 已核對場景有 HemisphereLight／DirectionalLight，但地形 BasicMaterial 使用獨立 shader；全球及區域色彩另含舊定向烘焙明暗。後續優先連續法線、純本色、統一漫反射與補光，再評估必要地標。P36 的近地及區域接替驗收未覆蓋全球分塊法線連續性，不能視作此問題已通過。
- 本輪只有文件變更；runtime、資產、碰撞、rubric、phase/variant、snapshot、SCORM 與網站未更動。未執行新候選畫面或效能驗收，真手機／Moodle仍未驗。

### 2026-10-26 實作與驗收

- 2026-10-26 使用者已授權依計劃實作。範圍：terrain／global-terrain／contact-ground 共用高度場法線與單一 diffuse＋local skylight、scene／scene-art 光源一致、移除噪點與收斂地標；生成器／全部全球和區域本色／hash invariant／art.test；既有 browser owner 的連續法線、零高度球面及真正坡面轉光 GPU 驗收。物理、碰撞高度、rubric、phase/variant、snapshot schema及 SCORM 語義不變。
- 生成器只重算本色、不重新三角化；normal 在載入或既有近地重建時計算，沒有新增 runtime 檔案或 manifest 依賴。沿用原有 4 active／6 cache／2 request 限制。最終驗收採 source／extracted ZIP 的桌面與手機、發射台／丘陵／接地／全球 LOD／故障回退／分離，並與從 HEAD archive 保存的 P36 近地 100 m 及高空 1,182.5 km 三輪同機基準比較。

- 最終視覺收斂：以投影尺寸淡出細坡面法線，高空只保留自然球體／大尺度明暗；移除暖溫帶由單一高頂點造成的巨大白色雪斑，極區色帶仍保留。沿用原雲／大氣及台座柔和接觸陰影，未新增遠山霧或即時全球投影。
- 新增 globalTerrainArt 診斷修正：手動跨洲鏡頭須隱藏 contactGround 並清空其裁切半徑，否則舊近地面可遮住真正全球地形。最後全球／日期變更線／極區／粗細回退案例使用修正後 helper；早期 48-flow 的全球截圖不作此輪全球視覺驗收依據。

- 最後 runtime SHA-256 9d3cc726b16288e26b057a7ec209b8a682ce0febaedde5e826db49724a1fac64：p37-final.json source／extracted ZIP 共 20 flows completed=true、errors=[]，包含桌面 1280×800／手機非全屏 390×664 的新光照、發射台、接縫及跨洲／日期變更線／極區／粗細 cache／失敗回退與性能資源檢查。全部 15,060 對 coarse 共點及 155 對 coarse/fine 共點角差 0°；零高度法線誤差約 0.000003°；GPU 接縫曲率殘差 p95 1/255。單色丘陵在兩側測試太陽下平均像素差約 38/255；實際物件主光方向 dot=1。發射台兩角度遮掉 0 pixels；移動／品質／資源回收通過。300 km 區域／全球接替日照／背光 mean 約 0.031–0.776／255，p95≤1.334／255。
- 前一 runtime a6a1a9b33449c7bb0a73a16df8661a817d03014d848c1878b87a210f0706ecbf 的 p37-first-final.json 另完成 source／ZIP 共 48 flows：包含 terrainArt／terrainDepth、三地接地／爆炸、真空分離／上級點火、flightEffects／RCS／下級下降、sceneArt、生命周期／快照恢復／pending／renderer故障等。之後只加入遠景坡度淡出、收斂本色及修正診斷 helper；位置／高度、模型、控制與 codec 未改。這 48-flow 的舊全球 helper 截圖有近地遮擋盲點，不冒充最後固定版的完整全球視覺證據。
- 最終同 runtime 的 p37-candidate-benchmark.json 共 12 samples，兩尺寸 × 近地 100 m／高空 1,182.5 km × 三輪，各暖機 2.5 s／採樣 15 s；Chrome155／SwiftShader。桌面 median 近地 66.8／高空33.4ms，p95分別83.4–83.5／50.1ms；手機 median33.4／16.7ms，p95分別33.5／33.4ms，三輪與舊基準相同節奏，最差p95比≤1.0。CPU p95桌面近地2.5–4.8、高空2.1–2.3ms，手機近地2.8–3.2、高空2.2–2.4ms；不宣稱CPU完全無回退。最大84calls／74,797tri，紋理預算內。比較見p37-performance-comparison.json。
- 舊基準由5b35204的git archive提供，實際servedRuntimeHash=86a73e26a1917979fdda9c7830f10aa32b0e13ca53267e28e13a3de31f338ac0（Git輸出換行與當時工作副本不同）；原baseline報告的runtimeHash是runner另外建立的當時包，已加servedRuntimeHash及provenanceNote，效能比較只用實際服務的archive hash。兩版輸入／視窗／DPR／品質與取樣一致；不拿軟體GPU結果推算真iPhone。
- 全球441份binary及區域27,279頂點只改本色：25,421,720非顏色bytes對5b35204完全不變，64,786次共點RGBA對照一致；surface-data未改。p37-albedo-preservation.json、p37-generator-fixture.json、p37-regional-generator-fixture.json記錄正常生成／recolor一致、metadata保留與非顏色invariant。最終art.test、npm check、check:tests（279entries）、JS語法及diff通過。未跑全庫、完整最後runtime browser owner、真手機／Moodle或熱負荷；未重新三角化全世界。

- 最後供部署 ZIP：16,003,213 bytes，SHA-256 94c630f07ba52d25d7aef92af7f231c9de25cb7f86f1ba0f7a8a73cfd69a3929。最後一次 source／ZIP 驗收後凍結，不再重建；Sites dist 將直接從此包抽取。

- 已 commit／push d82272095cde36e998cf9f33ad0faeb95c250047。committed selection-preview：output/rocket/selection-p37.json，5b352048bb1892817d9a156eed5e5e142aa7562a→d82272095cde36e998cf9f33ad0faeb95c250047。preview mode=full／279 entries，原因為選取器不識別 tools/rocket-art/README.md 的 dependency；這是選取預覽，不代表279項全跑，實際執行範圍如上。
- Sites helper 已推送來源 edc2e0c3a6c6b70c8b72367e6da5ec3a7b6dd33e，archive=output/rocket/rocket-terrain-lighting-p37.tar.gz。版本 appgprj_6adc62579ab88191aba299bcb282ce95~appgver_035500cedcb88191af7698490d973189，deployment appgdep_6ade4104a2908191b643f3b74e2e6677，native status=succeeded，2026-10-26 01:49:08（UTC+08）。原網址 https://simlab-rocket-space-missions.ieyp.chatgpt.site，保留owner-only audience；get_site確認owner、1 allowed user、0 groups／external visitors。
- 線上475份檔案核對完成，p37-live-verification.json completed=true：非HTML逐byte一致；兩份HTML僅扣除平台插入script後相同，只跟隨同origin canonical index redirect。build-info.sourceCommit=d82272095cde36e998cf9f33ad0faeb95c250047、packageSha256=94c630f07ba52d25d7aef92af7f231c9de25cb7f86f1ba0f7a8a73cfd69a3929。網址已交給Codex頁籤開啟（queued）。本輪Chrome／HTTP server／來源helper及驗證程序皆已結束，只清理本輪Python cache，既有.codex-remote-attachments未動。

## P38 — 緊湊飛行控制與時間倍率（2026-10-26）

- 使用者授權實作：讀數框依內容收窄；倍率放入點火／暫停／分離操作列；油門和轉向用預設及微調按鈕，移除直接輸入及發射姿態選單。保留已確認的美術效果。
- 風險／邊界：只改 HTML、CSS、main、現有 ui-runtime 及 owning tests；不改評分、snapshot、phase/variant、物理步長、SCORM 或 runtime dependencies。舊草稿姿態保留，按轉向時明確切回角度穩定；軌道任務的順／逆向推進保留。所有合法空白／部分提交流程沿用。
- 倍率：燃燒／低於120km上限5×，選單停用不適用倍率並顯示原因；再點火時同步降至5×。真空滑行允許20/100/1000×。每幀以真實前景時間推進，維持800步工作上限，實際倍率以已推進時間除真實時間，背景仍暫停並清掉時鐘。
- 測試決策：沿用 lifecycle unit test、rocket browser owner，新增慢幀與倍率政策斷言；source／extracted ZIP 驗320/390手機、橫屏、Safari式短視窗、按鈕捲動、連續飛行控制、分離後原位點火、HUD、任務與生命週期。check／check:tests及committed selection-preview。無真手機／Moodle證據不宣稱通過。

- 實作：HUD以內容寬度排版，保留22px主讀數及13px分量；固定操作列中的倍率使用原生select，按鈕保留44px觸控高度及實際內容寬度。油門5個預設＋±5%，轉向6個預設＋±2°，選中值標示aria-pressed，當前值為唯讀output；分離詳情移至主要控制之下，禁止自動捲動錨定令面板跳位。
- 計時：以performance.now的獨立物理時鐘從play開始，pause清零；消除50ms截斷及首幀計入暫停前時間。每幀仍最多800步，工作量受限時以完整經過時間回報實際倍率。原生選單只在限制／標籤確實改變時更新，避免每100ms重建選項。

- 最後 runtime c57941c211edf43207cda84a30bd762b064f4bbe832c1417851efce871420585：p38-release.json source／extracted ZIP 共20 flows completed=true、errors=[]。包含20／100／1000×各180ms前景阻塞、暫停選倍率不自動播放、再點火同步5×、低空限制、運行時選單零child／disabled DOM變動、五尺寸讀數／燃料／唯讀成果、桌面／觸控／鍵盤連續控制、舊姿態轉角度、任務執行／保留及review／pending／finish retry、standalone refresh／storage denied、fullscreen／renderer recovery。末幀GPU可能尚未繪製，倍率驗收比較已推進時間不超過真實時間、覆蓋完整阻塞時段及實際積分倍率，沒有用繪圖延遲假裝積分丟時間。
- 先前同版面的p38-final.json source已完成7尺寸mobileCockpit及toolbarResize（320×568、375×600、390×664／844／460、844×390、1280×800）：44px觸控、按鈕滑動不改飛行、無root溢出、分離後同位置點火與捲動不跳位、縮視窗後末項可達，截圖已目視。該report後在package的1000×量測捉到首幀多計暫停前時間，整份completed=false，非完整通過；最後修正物理時鐘及選單DOM更新後另驗上述20 flows，未重跑全部7尺寸手勢矩陣。
- lifecycle／model／persistence／interaction node tests、npm check、check:tests（279 entries）及diff通過。最後ZIP 16,003,693 bytes，SHA-256 90099daa1dc39731ad241bb3d3accc18a93155760afe6c42f673d61f5935422c，凍結後不再重建。沒有改地形／素材／評分／codec，未跑全庫或完整browser owner、真iPhone Safari／Android／Moodle或熱負荷。

- 已commit／push實作f2e528c5d0cbb09950fef2cd42725f387226f91a。committed selection-preview：output/rocket/selection-p38.json，base51181c1fdf6f1b52f6bfad5bccae8e9f1245da14→f2e528c、mode=affected、242 entries，修改均映射rocket活動／owning browser scope；這是選取預覽，不代表242項全跑。
- Sites helper來源ec65272a2df6d689513a1ec0880b6a85088a83d5及output/rocket/rocket-flight-controls-p38.tar.gz已推送／打包。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_dc2d633dcc908191825faea07b3d54a0，deployment appgdep_6ade97cef9148191bbb836c3fe8890a0，native status=succeeded，2026-10-26 07:59:19 UTC+08；原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site。保留owner-only audience，get_site確認owner、1 allowed user、0 groups／external；原網址已交給Codex頁籤開啟（queued）。

- p38-live-verification.json completed=true：線上475份檔案與已驗dist一致；非HTML逐byte核對，兩份HTML僅移除平台注入script後相同，只跟隨同origin canonical index redirect。build-info.sourceCommit=f2e528c5d0cbb09950fef2cd42725f387226f91a、packageSha256=90099daa1dc39731ad241bb3d3accc18a93155760afe6c42f673d61f5935422c。本輪Chrome／HTTP server／Sites helper及核對程序皆已結束，既有.codex-remote-attachments未動。

## P39 — 分離追蹤、鏡頭避地與倍率閃爍（2026-10-26）

- 使用者確認第二項是倍率按鈕／數字閃；已授權修正並沿用原網站交付。診斷：分離後按兩級距離拉鏡、取中點，造成下級畫面位置鎖定；582.5m／pitch=-1.15鏡頭實際穿地約859m；1.3s內倍率title／相同文字重寫8次。
- 範圍：scene跟上級，取消按兩級距離縮放／中點追蹤，短過渡用前景畫面時間；共用鏡頭以實際terrain高度限制向下旋轉，涵蓋工廠、發射台、異地及跟隨；main倍率顯示只改確實變更的屬性／字串，實際倍率降頻並保留有效量度。物理、碰撞、rubric、phase/variant、snapshot及SCORM／依賴不變。
- 風險／驗收：沿用rocket browser owner新增連續分離位移／相機距離與上級目標、暫停及高倍率的視覺過渡、近地俯仰／縮放／異地山坡鏡頭clearance與near plane、原生select全部屬性及status文字的MutationObserver檢查，桌面／手機source及extracted ZIP；跑相關既有分離／RCS／接地／控制回歸及check／check:tests，記錄committed selection-preview。真iPhone Safari／Moodle未實測不得宣稱通過。

- 最終實作：移除兩級中點／按gap縮放，鏡頭只依上級與高度定位；600ms前景畫面時間過渡，暫停凍結，保留至少高度0.2倍的距離避免地球深度破面。旋轉可近垂直查看下級；共用相機以地形取樣及最多16次二分調整俯仰，保持距離／畫面比例，工廠離地≥0.2m、跟隨離地≥2m；近裁切不越過地表，遠裁切保留原範圍。沒有新增shader／貼圖／後製／動態陰影。
- 倍率：title／顯示文字同值不重寫，原生input即時記錄選擇、change去重；有效量度每0.5s按真實時間加權，切換不先寫0，tabular數字固定最小寬度。補齊play時物理時鐘起點；上一版該插入受CRLF匹配影響未進入render，最後版用帶斷言的換行匹配確認已插入。
- 最終runtime ea6aa34ef00c8a63922b61521d8b4154d7c2565a30a8c10003032b04c3600c0e：p39-release.json source／extracted ZIP 10 flows completed=true、errors=[]，桌面1280×800及手機390×664。涵蓋432個跟隨鏡頭組合（發射台／582.5m／80km／異地丘陵×yaw／pitch／zoom）、12個工廠組合、near plane／火箭仍可見；只改下級位置不改上級鏡頭、連續相對位移、暫停視覺過渡凍結、600ms畫面過渡、向下找仍在飛的下級；RCS轉向後熄、20／100／1000×慢幀及真空點火／未點火分離。原生select監察全部屬性／child／text均0變更，1400ms status只兩次不同有效文字，input後選擇保留、change不重設量度；無假0。最後桌面／手機截圖已目視。
- 前一runtime0a0cebe6288d8ee013f059755f3a083d7e0696492d331ed16aaadbe817482a73另有p39-candidate.json 4 flows及p39-final.json 14 flows皆completed=true、errors=[]：相同鏡頭安全／倍率、連續控制、三地接地／爆炸及真空分離。最後只恢復原far範圍及補原生input／change去重，並用上述10-flow重驗相關範圍；前14-flow不冒充最後完整重跑。舊測試要求下級永遠留在畫面，已改成上級保留、下級相對位置增加及物理時間同步。
- art.test、lifecycle.test、npm check、check:tests（279 entries）、最後相關JS syntax及diff通過；沿用現有browser owner／manifest，未改物理／碰撞高度／評分／codec。最後ZIP 16004104 bytes，SHA-256 efeee652c61816b82bf750d58f04f62aa45de56662f76da9afe4a0f186e0029c；凍結後不再重建。未跑全庫／完整owner、真iPhone Safari／Android／Moodle或熱負荷；原生Safari是否尚有平台重繪須真機核對。

- 已commit／push實作a8fc86c4864d1a043d855de9795b3caf66cd331d。committed selection-preview output/rocket/selection-p39.json：9c8a7a15ba7dffe8f087bd9b304d851e5e8fe7f8→a8fc86c，affected／242 entries，全部修改映射rocket活動或owning browser；僅選取預覽，不代表242項全跑。
- Sites helper來源e1c934da3ce9046f6f4c214c2c7cf7f534f21603及output/rocket/rocket-camera-warp-p39.tar.gz已推送／打包。publish-on-push未接受，已用明確private save/deploy；版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_d8c83b4eb99081919ce7c53eb785a1b9，deployment appgdep_6adeb103cc18819199173108578655b1，native status=succeeded，2026-10-26 09:46:53 UTC+08。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site，保留owner-only audience。
- p39-live-verification.json completed=true：本次修改的main.js／scene.js／styles.css、兩份HTML入口及build-info共6份線上核對一致；非HTML逐byte相同，HTML只扣除平台注入script，僅跟隨同origin canonical index redirect。build-info.sourceCommit=a8fc86c4864d1a043d855de9795b3caf66cd331d、packageSha256=efeee652c61816b82bf750d58f04f62aa45de56662f76da9afe4a0f186e0029c。未變素材沿用P38逐檔證據，未重驗全部475檔；本輪包仍做完整manifest來源／抽取byte閉包。網址已交Codex頁籤（queued），本輪Chrome／server／helper／核對程序已結束，既有附件未動。

## P40 — 分離近景統一尺度（2026-10-26）

- 使用者授權立即修正：P39仍將上級尺寸隨高度放大，而相對位移用真實米數；637.6km、100%油門的1大箱上級，10s實際gap619m但圖像長22km，分離器外殼高出接點約3.5km，畫面仍重疊。4大箱30s仍重疊395m。上次只驗位置增長，沒有以外殼邊界與畫面尺度驗收，此次補齊。
- 最小方案：跟隨分離近景完成600ms視覺過渡後，兩級幾何及位移同用1m=.001場景單位、鏡頭按火箭大小而非高度；原有分離器1.67m遮蓋量按真實比例保留，不刪幾何或加大推力／分離踢速。使用已固定Three.js的logarithmicDepthBuffer解決近火箭／遠地球深度尺度，自訂地球／雲／halo shader加入對應chunks，維持單次渲染、不新增套件或貼圖。全景／軌道保留原示意圖尺度。
- 風險／資料邊界：深度編碼必須涵蓋所有參與深度的自訂shader，驗地球遮擋、雲／halo、接地及shader編譯；log depth可能影響Early Fragment Test，須同機比較近地及高空、桌面／手機軟體GPU，保持現有LOD／品質／資源預算。物理、碰撞資料、rubric、phase/variant、snapshot、SCORM及manifest依賴不變。
- 驗收：沿用art.test與rocket browser owner，新增80／637.6km、1／4上級大箱、100%及低油門的幾何長度／接點外殼真實間隔、時間同步、向下望與地球背景穩定；source／extracted ZIP、既有接地／RCS／鏡頭安全及控制、check／check:tests及committed selection-preview。真手機／Moodle未驗不宣稱通過。

- 實作只移除分離跟隨近景的高度距離下限，讓600ms過渡完成後鏡頭按模型大小取距離；兩級幾何與位移同為1m=.001場景單位。模式依f.separated保留，所以下級落地／效果回收或Moodle草稿恢復不會回到巨大模型。分離器幾何／1.67m伸出量保留，未修改任何推力／質量／速度／分離踢速。近景文案已同步，地球全景仍明示非同比例。
- renderer啟用固定Three.js現成log depth，地球／雲／halo各補vertex與fragment chunks，sky本身不參與深度測試；仍一個renderer.render，不新增render target或pass。官方說明及Early Fragment Test限制：https://threejs.org/docs/pages/WebGLRenderer.html#Options。資產及vendor未更動。
- 最終runtime c782a1ecf761321f88fe77f6bda36260c034691209485cfe0f16030281f1c8bc：p40-release.json source／extracted ZIP 4 flows completed=true、errors=[]，1280×800／390×664，共32組（80／637.6km×1／4大箱×100／25%油門×尺寸×source／ZIP）、128次1／5／10／30s外殼量度；upper／lower scale均.001，長10.5／22.8m且不隨高度／時間放大，外殼高出接點1.67m，實際可見邊緣間隔=物理gap−1.67m（誤差<1cm），1s後全部組合已分開，兩級時間同步；不以只看座標增加代替驗收。32×32 GPU探針在80／637.6／1182.5km，後繪的標準材質被前方5m的自訂地球材質正確遮住，共12次，並驗地球／雲／halo chunks及無shader錯誤；4次context恢復、下級回收不縮放及合法分離草稿恢復均通過，最後側視1s／5s及向下望截圖已目視。
- 前一runtime 7e47dc5ce11ffb711ee6b55d62ea79d0ae5ffaf34cf085f7399789e81f4a2d7a 的p40-final.json另完成source／ZIP 20 flows：相同尺度矩陣、鏡頭地形安全、RCS、三地接地／爆炸、idle／品質／資源上限及真空分離；最後只令f.separated在效果回收／resume後仍用同尺度並同步隱藏caption，以上4-flow另驗最後包，不把前20-flow冒充完整最後重跑。更早7b75bf6ef946979bff2bc71a14b1f970e4dd2c3ab923712b2dcc35b09117222a的候選4-flow只有文字較舊。
- 同機比較p40-benchmark.json／p40-performance-comparison.json：基準6408c4a實際served hash ea6aa34ef00c8a63922b61521d8b4154d7c2565a30a8c10003032b04c3600c0e；候選7e47dc5ce11ffb711ee6b55d62ea79d0ae5ffaf34cf085f7399789e81f4a2d7a，最後只改分離resume條件，benchmark的未分離pad／ascent場景未改。Chrome155／SwiftShader、兩尺寸×兩場景×兩版，各暖機2s／採樣5s、1輪；沿用console舊標籤15s，實際duration約5.1–5.36s，已另記note。median桌面約83.4–83.5ms、手機33.4ms，兩版相近；p95桌面pad83.5→100.2ms、ascent83.5→83.5；手機pad50.1→50.1、ascent33.5→50.1。CPU p95候選2.4–5.6ms；calls／tri與基準相同，最大82／77,438。短測部分尾延遲較高，不能聲稱零性能回退／推算真機或熱負荷；沒有為追平FPS再放大模型。
- art.test、lifecycle.test、npm check、check:tests（279 entries）、相關JS syntax及diff通過；沿用現有browser owner，不改manifest依賴／評分／codec／SCORM。最後ZIP 16004232 bytes，SHA-256 c5b3e0a739233a370c2499e97bb40bde3b2c94ea8faeae8b49692212c91be2ed，凍結後不再重建。未跑全庫或完整最後owner、真iPhone Safari／Android／Moodle及長時間熱負荷。

- 已commit／push實作9ec138c4bab88a08d39b7ce3c533ede2b6b9860d。committed selection-preview output/rocket/selection-p40.json：6408c4a900f0bdb86bf06720cb6ef25fe118e63e→9ec138c、affected／242 entries，全部修改映射rocket活動／owning browser，僅選取預覽，非242項全跑。
- Sites helper來源dab0af6a583bd170cd16b7cd497bd5cf200ab2c0及output/rocket/rocket-true-scale-p40.tar.gz已推送／打包。版本appgprj_6adc62579ab88191aba299bcb282ce95~appgver_2de7baa901348191bdd592554f1d0272，deployment appgdep_6adecf2c65808191bef301109632319a，native status=succeeded，2026-10-26 11:55:33 UTC+08。原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site，保留owner-only audience。
- p40-live-verification.json completed=true：修改的main.js／scene.js／scene-art.js、兩份HTML及build-info共6份線上核對一致；非HTML逐byte，HTML僅扣除平台注入script，僅跟隨同origin canonical index redirect。build-info.sourceCommit=9ec138c4bab88a08d39b7ce3c533ede2b6b9860d、packageSha256=c5b3e0a739233a370c2499e97bb40bde3b2c94ea8faeae8b49692212c91be2ed。未變素材沿用既有逐檔證據，未重驗全部475檔；本輪來源／ZIP仍驗完整manifest閉包。網址已交Codex頁籤（queued），本輪Chrome／server／helper／核對程序均結束，既有附件未動。


## 2026-10-30 CI camera fixture correction

The camera pad fixture now starts with zero flight-height history instead of inheriting an 80 km maximum. Production validation remains strict; scoring, schema 4, phase matrix, dependencies and SCORM behavior are unchanged. The existing registered browser owner adds `--camera-warp-repairs-only`; full default coverage is retained.

Actual failing runs, test decisions, executed source/package evidence and verification limits are recorded in the [CI review](../docs/reviews/2026-10-30-ci-browser-failures.md).


## 2026-10-31 CI renderer-event and ground-color verification

Synchronize pinch checks with delivered native input. Exclude clouds only from the controlled ground-albedo comparison while retaining production altitude screenshots, original color tolerances and geometry budgets. Rubric, dependencies, saveable phases, authoritative snapshots and SCORM contracts remain unchanged.

Failure evidence, test decisions and actual verification are recorded in the [CI follow-up](../docs/reviews/2026-10-31-ci-browser-followup.md).


## 2026-10-31 完整 browser owner 分組

既有 49 個案例按原順序保留；正式 CI 改為 `--group=interaction`（18）、`--group=terrain`（17）、`--group=flight`（14），每組均執行來源與解壓 SCORM。無參數直接執行仍跑全部 49 個案例。新增 `tools/rocket-space-mission-browser-regression.test.js` 核對原有清單、互斥分組、完整聯集及非法選擇；所有分組和 Node 審計均在 `tools/test-registry.js` 正式登記，沒有移至手動閘門。

249 Node／42 browser 共 291 entries 的 registry、分組審計、immutable plan 與有限預估時間檢查通過；三個 rocket 分組在預設計劃分到不同 browser worker。每組 1200 秒為保守排程預估，非虛構實測耗時。評分風險、rubric、依賴、phase／variant、權威 snapshot 與 SCORM 契約不變；fixture 補返回艙、重設極端相機、按寬高隔離測試存檔，以及 P54 已批准設施數的核對均只改測試。

實際 committed selection 的 base/head、完整分組與套件選擇保存在 `output/reports/ci-followup-selection.json`；[CI follow-up](../docs/reviews/2026-10-31-ci-browser-followup.md)及 PR #16 記錄實測與未通過的本機限制。最終 GitHub 完整驗證仍是必要閘門。
