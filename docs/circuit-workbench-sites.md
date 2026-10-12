# DC／AC工作台的獨立Sites部署

2026-10-12兩個standalone工作台已更新至Sites version 19，兩次原生部署均回傳 `succeeded`。目前均保留擁有者私人存取，須以擁有者的ChatGPT帳戶登入；不是公開學生入口，也不是SCORM部署。

| 工作台 | 正式網址 | Site project ID | 原始入口 |
|---|---|---|---|
| DC | [直流電路工作台](https://simlab-dc-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd25ad448191b82c7bdd801e2047` | `sim/circuit-workbench/index.html` |
| AC | [交流電路工作台](https://simlab-ac-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd3a2fb4819187870a3ebf24da68` | `sim/circuit-ac-workbench/index.html` |

## 最近更新：Sites version 19／CW-12／13／14及清楚的變壓器比值（2026-10-12）

Runtime取自已推送提交 `1dbd68bde327d39ec31eb673885349f6c28adf13`：保護先驗
現行狀態，拒絕不相容候選而不清除儲能；故障／正常區塊分開初始化；依
可行區間共同限幅及逐源核證，支援反向多源。變壓器移除細小副標題，改用
共用screen-size標籤只顯示一行N₁:N₂比值並避讓。DC29個／AC38個資產與
Git提交逐byte及SHA-256一致；原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `3cca59604fc179b328cb1efe0f78410ba6106c7b` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_38077c22f6508191a32f1d6fdfba0ccf` | `appgdep_6acc8723aedc8191af9b2b321dcc46d8` |
| AC | `e9e2767877572f1d262c6dc2b63fca2069cca7cf` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_a7efa62541e48191869b88d1ac902496` | `appgdep_6acc8738eb348191b4f2875f5013302a` |

兩次原生發布succeeded，get_site確認version 19。14份相關Node suites、
保護source／ZIP browser456 checks、變壓器126 checks、check及四包重建
通過；具體範圍見[交流計劃](../plans/32-circuit-ac-workbench.md)。兩站部署
目錄1280／390px掛載、根跳轉及query／hash、可信視圖切換及無水平溢出
通過。未執行完整CI、實機手機或Moodle；非線性保護有界搜尋不能視作一般
可行性證明。最新部署核對檔在 `output/sites/runtime-verification.json`及
`output/sites/browser-verification.json`。官方helper生成的archive為
`output/sites/circuit-dc-workbench-1dbd68b-v19.tar.gz`及
`output/sites/circuit-ac-workbench-1dbd68b-v19.tar.gz`。

## 前次更新：Sites version 18／電橋電流表 0.6 A 接孔（2026-10-12；歷史記錄）

Runtime取自已推送提交 `905956354c79fe1900ce8b0cd13d4f3d25883707`；橋中電流表
改接既有0.6 A小量程正接孔，保留原有雙量程器材、電流及負接孔。DC29個／
AC38個資產均與Git提交逐byte及SHA-256一致。原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `3b522f125c0baf8300b393b8dbfe326c55b1d524` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_9f1052e150588191b87abd13d60089a3` | `appgdep_6acc6c5362ac8191a9b90bdf4bcae303` |
| AC | `d86df2e8d82406637c34504a0b3c24d32378e154` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_fa99d1d5a73881918b4ec21c91299427` | `appgdep_6acc6c6256b48191b2d29eb315e647a3` |

兩次原生部署succeeded，get_site確認version 18。layout／core／labels通過；
來源／ZIP的32項bridge-slider觀察核對0.6 A接孔、實際指針、可信滑片及恢復。
兩站部署目錄1280／390px掛載／跳轉／視圖／無溢出與DC量程檢查通過，四包
重建；未驗完整CI、實機手機或Moodle。最新同步及部署目錄證據仍在
`output/sites/runtime-verification.json`、`output/sites/browser-verification.json`。
官方helper以Git Bash及Windows tar相容設定建立
`output/sites/circuit-dc-workbench-9059563-v18.tar.gz`及
`output/sites/circuit-ac-workbench-9059563-v18.tar.gz`。

## 前次更新：Sites version 17／課堂示例、電橋變阻器與 AC 保護（2026-10-12；歷史記錄）

Runtime取自已推送提交 `1611de96b70002619064e26afa1213baa2daaf54`，包含 DC
並聯的總開關及兩個支路開關、混聯幹路燈泡、新增 A／V 接線示例、菱形電橋
及 R₄ 兩孔滑動變阻器，以及此版本以前已提交的共用與 AC 更新（含可選電源
保護）。兩站同步完整資產清單，DC29個／AC38個資產與該 Git 提交逐byte及
SHA-256一致；Windows工作區換行另核對文字等價，部署使用提交的原始位元組。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `2bd8238a625764a2fa8961056beef35a0585703c` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_a57d1d3e30f08191a40ca50be971398e` | `appgdep_6acc69b28d588191ae05ab38fd6c5205` |
| AC | `fb95d09291aaa544ed9e3fb016d8e3e9aaea4479` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_8e7a32701aa08191bd2b821f0ee024d1` | `appgdep_6acc69a3053c819186415f339572afb6` |

兩次原生發布均succeeded，get_site確認version 17及原網址／擁有者私人存取。
部署目錄1280／390px檢查HTTP200、根入口跳轉及query／hash、實際掛載、可信
滑鼠切換實物／符號、無水平溢出及電橋新變阻器起始平衡通過。物理／可信滑片
與支路開關的source／ZIP證據沿用本輪工作台計劃，沒有重跑完整CI、真手機或
Moodle。證據在 `output/sites/runtime-verification.json`、
`output/sites/browser-verification.json`；封裝先改用Git Bash，並以
`TAR_OPTIONS=--force-local`避免GNU tar把Windows磁碟代號當作遠端主機。
Archive為 `output/sites/circuit-dc-workbench-1611de9-v17.tar.gz`及
`output/sites/circuit-ac-workbench-1611de9-v17.tar.gz`，均由官方Sites helper
按已推送的各站source建立；網站身份及存取設定保持。

## 前次更新：Sites version 16／五級畫布字體大小（2026-10-11；歷史記錄）

Runtime取自已推送提交 `42e1db5dff2804c533d0af30beb658cc367a509d`。DC／AC以五級字體大小選單取代投影字體：很小／小／中／大／特大，預設名稱20px、讀值18px。標籤及概覽隨所選字級顯示，概覽按寬度換行並減少同列儀表以避免重疊。選擇可保存及復原，fontSize為可選display欄位，舊projection及固定學生文件形狀保持相容。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `b47c49ab535b4e302268648d535efe6460a00b5b` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_4ef359bd3ef0819194f990b0338b5eb4` | `appgdep_6acbad61157081919661afd369b89c14` |
| AC | `6d4a0efc6d9a410a75810585edd004b32f63dc07` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_deb43a70db3c8191842658822ea2bc9a` | `appgdep_6acbad6f9d008191b71d3049264976ac` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。source／ZIP字體專項258項通過（AC／DC ×1280／390px、五級畫面像素、保存／復原、舊檔及物理狀態不變、手機特大概覽），相關display／import／labels／wire-current-labels Node套件通過。舊72個幾何fixture明確以很小字級維持原清晰空間前提。四包重建核對來源，未驗完整CI、真手機或Moodle。證據在 `output/font-sizes/`，archive為 `output/sites/circuit-dc-workbench-font-sizes-v16.tar.gz`及`output/sites/circuit-ac-workbench-font-sizes-v16.tar.gz`。

## 前次更新：Sites version 15／互感示例清晰接線（歷史記錄）

Runtime取自已推送提交 `1dae93baae4fe1ebadcb226094c315c3cb9189e1`。互感示例重新布局：供電支路在上方，放電電阻在原側中間直支路，副側負載與電流計形成獨立矩形迴路；導線只在显式接點相會，沒有交叉／重疊或穿過元件。ID、端子拓撲、參數及通斷感應讀值保持。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `2a16a4bb1675db947e403e4306948de245da220e` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_2c792f4ac8bc81919ef2879a0b7cd2df` | `appgdep_6acba9779e1081918a5a01c0937962de` |
| AC | `bf9c8f1c0f603924f6750faba43f5c67070760aa` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_710b7b12d5d081919926007b4b490602` | `appgdep_6acba96735f08191a7c59099c12e65dd` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。source／ZIP互感專項40項通過（1280／390px、實物／符號及通斷方向），ac-platform既有接線／間距及避讓檢查通過；修改前後拓撲及通斷讀值核對一致。四包重建並核對來源，未驗完整CI、真手機或Moodle。證據在 `output/mutual-layout/`，archive為 `output/sites/circuit-dc-workbench-mutual-layout-v15.tar.gz`及`output/sites/circuit-ac-workbench-mutual-layout-v15.tar.gz`。

## 前次更新：Sites version 14／理想變壓器四電錶示例（歷史記錄）

Runtime取自已推送提交 `cb29a791efdda28de5b59a0a7f9f1126b4cabe56`。教師理想變壓器示例在原／副側各設串聯交流電流表與並聯交流電壓表，左右對齊；線路寬度維持680單位，電壓支路有明確接點，沒有重疊接線。100／200／400副側匝數對應約3／6／12V，兩側電流可同時比較。技術學生示例保留原固定模板及codec。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `a518a7f4e83c9710ee25537b8f0179c924f6e9c5` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_b1766535ff888191b488d742a65c673a` | `appgdep_6acba78b9a588191915d0a3bba681cd9` |
| AC | `bed9ed0d9214be268bd4931a401fe03a43275132` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_6a5ec2509960819180922cfccd5dc851` | `appgdep_6acba7792cb08191ac4c12892bcf0063` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。source／ZIP示例专項110項通過，包括三種匝數、24Ω負載及桌面／手機；ac-platform既有接線／間距／codec恢復及transformer-design套件通過。四包已重建及核對來源，未驗完整CI、真手機或Moodle。證據在 `output/transformer-comparison/`，archive為 `output/sites/circuit-dc-workbench-transformer-comparison-v14.tar.gz`及`output/sites/circuit-ac-workbench-transformer-comparison-v14.tar.gz`。

## 前次更新：Sites version 13／共用復原及重做圖示（歷史記錄）

Runtime取自已推送提交 `b302f84e31748985f7cce791724ce7443eaa397b`。DC／AC以置中的24×24 SVG圓弧箭頭取代字元復原／重做，互為鏡像，沿用共用線寬及44px操作目標；清除舊字元字級。原操作及快照不改。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `83549afeed560bbbbc74bdbbf2657409bf219faa` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_4b30cb1b2ec08191a5e9a19342ffbb57` | `appgdep_6acba550889081918b54dec155b86f0b` |
| AC | `e45456e141f75f78c5e396d8a4ab77496b15bef9` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_c53d26e8dc108191aec9ef09eba12879` | `appgdep_6acba55f847c8191a6c7718880ba7928` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。source／ZIP圖示專項56項通過（AC／DC ×1280／390 px），核對圖示中心、停用狀態及實際復原／重做文件一致。四包重建並核對來源，沒有重跑物理、完整CI、真手機或Moodle。證據在 `output/history-icons/`，archive為 `output/sites/circuit-dc-workbench-history-icons-v13.tar.gz`及`output/sites/circuit-ac-workbench-history-icons-v13.tar.gz`。

## 前次更新：Sites version 12／發電機磁通量及LaTeX說明（歷史記錄）

Runtime取自已推送提交 `22a816e44a4d76e6653c6d0d69129e432c900034`。發電機檢視器、場觀察及放大觀察改用單匝磁通量Φ及總磁通量NΦ；說明中的N／S磁極、磁場、法線、角度及磁通量公式使用共用LaTeX向量字形。物理數值及快照不改。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `5abfe69d210a1228c81fc89e0c2b5432440d3f8b` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_ae5b0059fd5081918f39168e51fec277` | `appgdep_6acba3db88348191abb83d41d37d1839` |
| AC | `7cf4f61f69d1cd4d6526be617a950da6df1586a3` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_94d4c165a96881918ec76f0edb89d390` | `appgdep_6acba3ee82d88191b7a62a955e7131f1` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。只執行readout-math Node套件及既有source／ZIP顯示專項134項，包括桌面面板、放大視窗、手機字形及總磁通量數值一致性。四包重建並核對來源；没有重跑物理全套、CI、真手機或Moodle。證據在 `output/generator-flux-copy/`，archive為 `output/sites/circuit-dc-workbench-generator-flux-v12.tar.gz`及`output/sites/circuit-ac-workbench-generator-flux-v12.tar.gz`。

## 前次更新：Sites version 11／徹底移除示例提示（歷史記錄）

Runtime取自已推送提交 `fd5283becc6c095ddd610aacad9b2800cc052de8`。AC／DC所有尺寸均移除示例提示、展開入口及載入示例的說明通知；移除相關DOM、事件及CSS，保留示例選單和一般操作通知。DC29個／AC38個資產逐byte及SHA-256一致。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `8f700808228349310e55d049dafc60eea292296f` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_4d5f80c757d08191b08545df2347c4c6` | `appgdep_6acba2c0ea4c819185346530e292ab32` |
| AC | `5e0a98e3257fa801b157e8dd47205b55421484d5` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_879ce517b20c8191a46535c4f72517e0` | `appgdep_6acba2d28f0c81919ccdcaf2c322cedd` |

兩次原生發布均succeeded；原網址與擁有者私人存取保持。只執行既有example-hint專項，source／ZIP共90項檢查通過，涵蓋桌面及手機直向／橫向、示例切換、提示不存在及一般通知保留。四包已重建及核對來源雜湊；沒有重跑物理、完整CI、真手機或Moodle。證據在 `output/example-hint-removal/`，archive為 `output/sites/circuit-dc-workbench-hint-removal-v11.tar.gz`及`output/sites/circuit-ac-workbench-hint-removal-v11.tar.gz`。

## 前次更新：Sites version 10／CW-07、CW-08、CW-09（歷史記錄）

Runtime取自已推送提交 `1f3ed016d7faf7344658f8ad7bca586715246fa8`。導線、端子、接點及探頭的只讀數值隨播放更新，保留輸入草稿及焦點；理想變壓器按實際繞組直流電壓診斷；量測按各信號的來源依賴選取週期，僅共用參考接點的獨立電路不再互相延長量測窗。DC29個／AC38個資產逐byte及SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `583a3dd9e6444dccbac8602d76652754434d6b92` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_4037a35377c08191a8f6acf634085266` | `appgdep_6acba1803fb48191a58b5ab4c5faabb6` |
| AC | `de37784e55f9e25384766631aef1fbb25c54c5d4` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_d3c13f0149cc81919573eb1ce5b3de47` | `appgdep_6acba18e5398819196a083383d5600e2` |

兩次原生發布均succeeded。針對性Node重現及相鄰物理／恢復套件通過；完整工作台source／ZIP的桌面、手機124項檢查通過，包括即時正負讀数、失效後未知狀態、播放保留草稿、共同參考接點及零電源案例。四包已重建及核對runtime雜湊；沒有重跑完整CI、真手機或Moodle。證據在 `output/ac-dependency-audit/`，archive為 `output/sites/circuit-dc-workbench-dependency-audit-v10.tar.gz`及`output/sites/circuit-ac-workbench-dependency-audit-v10.tar.gz`。

## 前次更新：Sites version 9／發電機引線對稱（歷史記錄）

Runtime取自已推送提交 `4bd3280ebde9da6604ff5006275fa45d3a0ecfc6`。發電機兩條外引線折返高度統一30.5，消除直立時一邊貼近外殼的外觀；接孔、碳刷接點、轉子及物理模型保持。DC29個／AC38個資產逐byte／SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `0cf3c8360fe2d0fad99f6a92f772a0191c9acc05` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_9f3defd24a0081919d5ce07b7e973e03` | `appgdep_6acb902c7f348191963422515e72fa0a` |
| AC | `e5bf51ca914cf3c26fe41aee12b0ed4aa80cd76a` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_3c47e4a03a048191b84f6d6eda277937` | `appgdep_6acb901cb6d88191be9a1f27df6b39ba` |

兩次原生發布均succeeded；只驗generator-graphics原套件361姿態及引線斷言、source／ZIP引線專項128項（四向、桌面／手機及相位前後），四包已重建且runtime雜湊一致。沒有重跑其他物理套件、CI、真手機或Moodle。證據在 `output/generator-lead-symmetry/`，archive為 `output/sites/circuit-dc-workbench-generator-leads-v9.tar.gz`及`output/sites/circuit-ac-workbench-generator-leads-v9.tar.gz`。

## 前次更新：Sites version 8／滑鼠桌面捲頁把手（歷史記錄）

Runtime取自已推送提交 `37f7b8f22be7453eedb56c04747ee8808a21674c`。hover＋fine pointer的純滑鼠環境隱藏左右把手，coarse pointer觸控能力保留32px／pan-y；隱藏把手不再佔文字避讓區。DC29個／AC38個資產逐byte／SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `007691c053a6af3e077ca844f50288ce82ba6cb3` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_d4742d2022108191b5df2c5c1a7c9bf9` | `appgdep_6acb8cd18db48191913acae980e4415c` |
| AC | `8249fa510de98c49dcdb2be88b1ae7d33af21ac4` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_fee8fb7b9af481919fbd16830d9b99b6` | `appgdep_6acb8cc2a37081918fc3e348d9becf53` |

兩次原生發布均succeeded；只執行source／ZIP把手顯示80項，AC/DC ×1280／390 px ×實際滑鼠／觸控能力，文件保持。混合裝置按CSS規則保留，未虛稱混合硬件實測。四包已重建及核對runtime雜湊，没有重跑無關物理／手勢全套、CI、真手機或Moodle。證據在 `output/scroll-grip-visibility/`，archive為 `output/sites/circuit-dc-workbench-scroll-grips-v8.tar.gz`及`output/sites/circuit-ac-workbench-scroll-grips-v8.tar.gz`。

## 前次更新：Sites version 7／電感場線相對密度（歷史記錄）

Runtime取自已推送提交 `c382be373403b8547e3cf0cbea70b6c75d0efb92`。每個線圈以初始／已觀察峰值獨立校準，場線數近似正比於電流，取消13條下限；弱場保留中央線，外部回繞亦按比例減少。放電不縮量尺，細電流新實驗可自動校準，方向／歸零抑制及物理模型保持。DC29個／AC38個資產逐byte／SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `16b1026f59fbdcac5718a796db4456431977217d` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_9ae7ca33b40c8191ace277df2672dd24` | `appgdep_6acb8a66021c8191863cf33c93e4855c` |
| AC | `41f17903d15002d8d99185092f762964076c0232` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_e441c8835bdc819197db0cc08355c0f3` | `appgdep_6acb8a7517a081918588c806cf0afc64` |

兩次原生發布均succeeded。只執行3個直接相關Node套件及source／ZIP磁場密度208項；0.5 A／1 mA起步、放電比例、三處顯示一致、preview／獨立線圈及恢復通過。四包重建並核對runtime雜湊，沒有重跑完整CI／無關物理或真手機／Moodle。證據在 `output/inductor-field-density/`，archive為 `output/sites/circuit-dc-workbench-field-density-v7.tar.gz`及`output/sites/circuit-ac-workbench-field-density-v7.tar.gz`。

## 前次更新：Sites version 6／概覽儀表名稱（歷史記錄）

Runtime取自已推送提交 `83fb5c66617f721337fa689aee8ef026f929c787`。低縮放概覽改用registry儀表icon，補齊AC A/V/W名稱，避免undefined；元件文字收起規則及讀數不改。DC29個／AC38個資產逐byte及SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `67ea35e725ff69bdb9a10b68203387a24a16db53` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_efee951da6e881919504347311f81739` | `appgdep_6acb85bad104819190555bdebf530341` |
| AC | `3fcddf566654e2e58a82d24ef07c821636e333ad` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_29ef661768088191ac6290369a9a4811` | `appgdep_6acb85ca41888191b77d832380ebc4c1` |

兩次原生發布均succeeded。只驗source／ZIP低縮放及放大還原108項、meters-and-math原96 fixtures，以及七種AC/DC儀表概覽的未知／隱藏讀数局部檢查；四包已重建及核對來源雜湊。沒有重跑完整CI／物理／手勢或真手機／Moodle。證據在 `output/overview-meter-labels/`，archive為 `output/sites/circuit-dc-workbench-overview-labels-v6.tar.gz`及`output/sites/circuit-ac-workbench-overview-labels-v6.tar.gz`。

## 前次更新：Sites version 5／手機隱藏示例說明（歷史記錄）

Runtime取自已推送提交 `caa79b77c22ebf22ac8c1ef4ebc895ccfe11ee71`。手機直向及窄橫向隱藏AC示例提示整塊及DC載入範例的說明通知，桌面保留；一般操作／錯誤及拖動提示不受隱藏標記影響。DC29個／AC38個資產逐byte／SHA-256一致，兩個原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `411eab53d69a3b09aaad291ed753924dc3f3360d` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_24db12a77bd88191bae9a344a899b46e` | `appgdep_6acb84365f2c8191aed054c39cd9748a` |
| AC | `41b1ee228ce49ff98d3cc1b4e6d3b57be786a3f4` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_3b54b61bfa808191b3c0c444917ec39f` | `appgdep_6acb8444c1c88191828a6dcc8669af9c` |

兩次原生發布均succeeded；本輪只執行source／ZIP示例提示顯示64項，四包已重建、來源雜湊核对；沒有重跑求解／繞線／CI／Moodle或真手機。證據在 `output/mobile-example-hints/`，archive為 `output/sites/circuit-dc-workbench-mobile-hints-v5.tar.gz`及`output/sites/circuit-ac-workbench-mobile-hints-v5.tar.gz`。

## 前次更新：Sites version 4／手機快捷調頻（歷史記錄）

Runtime取自已推送分支提交 `bc286eacad09a1d55b224a3abe97111f40e45305`；修正播放重畫把footer普通觸控視作畫布手勢、因而停用快捷加減按鈕的問題。DC29個／AC38個資產逐byte及SHA-256一致，原網址及擁有者私人存取保持。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `bdc42496def1cf399d27c2db401b2e5eded668d5` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_0040d802cd5881918c89baae32a8b331` | `appgdep_6acb82642a388191a960d6aa109e2eba` |
| AC | `053cfbd8f2fec184f5d8e5857e00c70bdca48871` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_c8188cbb4ee4819193168ad6f0027490` | `appgdep_6acb825761f48191abf20c691d13400c` |

兩次原生發布均succeeded。本輪AC source／ZIP快捷觸控672項、DC共用快捷控制72項及3個直接相關Node套件通過；四包來源雜湊一致。部署目錄只做入口跳轉／掛載及桌面手機基本檢查；沒有重跑物理全套、CI、真手機或Moodle。證據在 `output/circuit-quick-response/`，archive為 `output/sites/circuit-dc-workbench-bc286ea.tar.gz`及`output/sites/circuit-ac-workbench-bc286ea.tar.gz`。

## 前次更新：Sites version 3／CW-03-R2及CW-06（歷史記錄）

Runtime取自分支 `codex/optimize-dc-ac-circuit-workbenches` 已推送提交 `6526c3598fe8684ba577bd1e5a47b9d9fa660625`。AC時間後端按獨立動態區塊檢查能量、補上並聯RLC快模式，並驗證及遷移舊v1／v2能量歷史；DC同步同一分支的29個共用資產，AC38個資產逐byte／SHA-256一致。網站發布版本與Session v2／modelRevision1／codec v6是不同版本。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `edc04f4c8599a89e2ed583ca5b2c12933b070978` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_224e252657e88191b3b2b30895d9c396` | `appgdep_6acb7e127600819182f4e08076d6e71b` |
| AC | `40093daab4e1b2695f001e8c70ae3e9371757909` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_3c8bd47674f8819197dab86ced5d77ec` | `appgdep_6acb7e2918d481919e286145c2c6ebf7` |

兩次原生發布均succeeded，get_site確認version 3；原網址與擁有者存取不變。部署目錄1280／390 px的載入、根跳轉及query／hash、實物／符號切換、無水平溢出及console零error通過。Runtime已通過10個相關Node套件、716項source／ZIP audit及206項scope；不宣稱完整CI、真手機或Moodle gate。證據在 `output/ac-review-r2/`。

Archive為 `output/sites/circuit-dc-workbench-6526c35.tar.gz` 與 `output/sites/circuit-ac-workbench-6526c35.tar.gz`，由Sites helper按各站已推送source生成。

## 前次更新：Sites version 2（歷史記錄）

Runtime取自已推送分支 `codex/optimize-dc-ac-circuit-workbenches` 的提交 `8f0b371e71b280a97d91347dcf0467e4f6ea992a`，包含手機工具列、提示／繞線、分域量測與能量修正、低頻電表暫估，以及有限觀察範圍的螺線管場圖。DC29個、AC38個資產逐byte及SHA-256核對與該來源一致；GitHub分支推送與Sites發布是兩個分開操作。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `a29ee980247aa0278d89a2481323fa4d387a8657` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_705842d9b7a48191a21834d5f453c845` | `appgdep_6acb6a69e3488191ba8d7b6e53e05cac` |
| AC | `46a32c2e1579363d7710230cb04db7f8129002be` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_bebb93d4f98c8191b1cef17360389530` | `appgdep_6acb6a7d39fc819188e31f8a84571d80` |

兩個原網址及存取設定不變。部署來源目錄在1280／390 px本機browser通過根入口跳轉、query／hash保留、工作台掛載、實物／符號切換、無水平溢出及console零error；原生成功結果確認正式發布，get_site確認version 2。Runtime沿用本分支已執行的針對性回歸，不把本次發布當成完整CI／Moodle／真手機驗收。資產及browser證據在 `output/sites/circuit-deployment-update-verification.json`、`output/sites/circuit-deployment-browser-verification.json`。

Version 2 archive為 `output/sites/circuit-dc-workbench-8f0b371.tar.gz` 與 `output/sites/circuit-ac-workbench-8f0b371.tar.gz`，由Sites helper依各自已推送的source commit建立。

## 初次部署的來源與版本（歷史記錄）

兩包runtime取自已合併及推送的SimLab `main` 提交 `02b7194789fe4dad9150dcde983ad21437442204`，依各自 `assets.json` 複製；DC29個資產、AC38個資產逐檔與來源相同。Sites根目錄的 `index.html` 直接跳轉到原始相對入口，保留query／hash；原有MathJax、共用JS／CSS及示例路徑不改，不套iframe。

| 工作台 | 已推送Sites source commit | saved version | deployment |
|---|---|---|---|
| DC | `6b40b31af4bf07c2ebd6d0765d52ba618f74fa85` | `appgprj_6acacd25ad448191b82c7bdd801e2047~appgver_7fca0ab7dd2c81918674c516b98ded46` | `appgdep_6acacdfc46e08191840c1fae9db6de6b` |
| AC | `e6d06f7ac193e4447591bd88fe485700ff1391fa` | `appgprj_6acacd3a2fb4819187870a3ebf24da68~appgver_bcc4d88197a8819185b12040a09f9aec` | `appgdep_6acace0f02cc8191a4d4d3669a894c78` |

## 更新入口

本機獨立checkout及 `.openai/hosting.json` 保存在：

- `output/sites/circuit-dc-workbench/`
- `output/sites/circuit-ac-workbench/`

後續更新應重用表內project ID，透過Sites source helper打開對應來源庫、更新同一份SimLab資產，再推送、封裝、保存及部署相同來源版本；不要把兩站的identity或repository混用。checkout若遺失，從相同project ID恢復遠端source，不另建重複網站。短期repository credential只經helper stdin傳入，不保存到檔案、Git或本文件。

每站使用 `static.directory: "dist"`。初次部署archive保存在 `output/sites/circuit-dc-workbench.tar.gz` 及 `output/sites/circuit-ac-workbench.tar.gz`；最新archive見上方最近更新記錄。每次均由Sites helper按已推送source建立。repository根目錄既有的Site配置屬於另一個Site，不作這兩站的身份。

## 驗證界限

執行必要的部署檢查：各資產逐byte一致、HTML相對引用存在、根目錄HTTP200及自動跳轉、兩站實際本機browser掛載、實物／符號視圖切換及console零error。正式部署由原生Sites成功結果確認，兩個正式網址已開啟；未登入的browser顯示預期的ChatGPT登入頁。

沒有重跑先前已審核的物理／手勢全套測試。此次Sites發布不是Moodle／實機驗收，也沒有將站點改成公開存取。AC審核範圍及既有證據見[審核報告](circuit-ac-workbench-audit-2026-10-11.md)。
