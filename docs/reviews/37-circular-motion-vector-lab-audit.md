# 計畫 37：圓周運動活動二全面審核報告

日期：2026-10-22。活動：`sim/circular-motion-vector-lab/`，教學主線為「位移 → 速度方向 → 速度變化 → 加速度方向」。

**審核結論：兩項 P2 已修正；兩位獨立 reviewer 在同一最終 runtime 全面複核後，均沒有提出尚未處理的新問題。** 沒有已證實的 P0／P1、物理答案或評分錯誤。這是下列本機來源、SCORM 及程式範圍的結論，不代表真 Moodle／實體手機驗收。

基線 commit：`49e2be8aab4b1076dc27e535164b7e5843818d54`。修正 commit：`ca37f82cd83cbaa4158219c325b5ac6b1f910cf0`，已push。最終審核 runtime SHA-256：`2ca19d3da787f25c1f9e86ae327022514a9e7fd8a75e1faf7484dfe2e53d55bd`。計算方式為按 manifest 次序串接 15 個 runtime 檔案的原始 bytes；兩位 reviewer、整理者均核對相同 hash。發布識別另由交付紀錄提供。

## 審核程序及判定依據

使用者指定兩位 reviewer **各自審核全部內容**，第三位負責核實、去重、整理，再由主 agent 修正，直到兩位 reviewer 都沒有新問題。

- 首輪 A、B 分別閱讀完整活動、計畫 37、共用規範，執行五個活動 Node 測試及各自的精準瀏覽器／幾何檢查。首輪完成前不交換彼此觀點。
- 第三位先建立需求判定框架，待首輪獨立完成後才閱讀兩份報告，核對程式因果、JSON 數據及實際截圖；三個原始 finding 合併為兩個可追蹤問題。
- 主 agent 作最小修正並補回歸。第二輪不只複驗舊 finding；A、B 再次獨立審查整個活動，擴大左右圖與錯答／提交狀態檢查。中途仍可重現的問題保持開放，修正後重新執行。
- 兩位最終報告均明確在上述同一 runtime hash 關閉 F37-01／F37-02，且全面複核無新 finding；整理者再核對證據，才作此結論。

使用者明確要求優先於一般樣式習慣：物理符號不加向量上標箭號、標籤透明且無指示引線、靠近對象而不重疊、桌面導覽及檢查靠右。真正表示物理方向的虛線延長線繼續保留。計畫明訂的形成性參考速度、半作圖部分分及自由切頁不誤報成缺陷。

## 問題、根因與修正

| 綜合 ID／原始 ID | 原問題及具體觸發 | 最終修正與驗收 | 狀態 |
|---|---|---|---|
| **F37-01 · P2**／A1＋B1 | 320×500、A=0°、逆時針、5°、U→V 時，Δv 與「初速度末端」真字形相交約 29.9×10.9px；480×320、A=20°、逆時針、60°、U→V 亦相撞，速度圖單位遭裁切。端點中文先固定，數學量沒有無碰撞候選時仍取最低代價；窄半圖仍顯示全名。 | 窄圖採既有短中文；較寬數學量先配置，舊候選受阻才以 6px 間距搜尋空位；標題／單位適配。短屏左右面板斷點由480px移至700px，窄橫屏保留全寬舞台；≤250px頁首仍保持44px控制。左右圖字形、O及實際讀數納入避讓，補全矮圖A/B候選。原重現與擴展矩陣在最終版本通過。 | **關閉**；A、B 同意 |
| **F37-02 · P2**／A2 | 本地數學 renderer ready Promise 拒絕時，最外層 await 無 catch；controller 尚未建立，活動停留初始空殼，notice空、舞台未隱藏、檢查看似可按卻無反應。後續 draw catch 無法保護初始化。 | 活動啟動邊界捕捉 renderer缺失／ready失敗，顯示繁體中文技術訊息、隱藏不可用舞台／作答／假檢查、停用任務導航，保留共享fullscreen。在建立controller／loadAttempt前返回，不建立新草稿、不寫成績、不新增fallback renderer。來源及套件兩種故障注入通過。 | **關閉**；A、B 同意 |

三項原始 finding 全部採納，A1／B1 依同根因去重，沒有駁回的原始 finding。幾何 sweep 的保守框相交僅作定位，不把所有候選相交都當成已確認真字形問題；上述兩個碰撞觸發已分別由真瀏覽器數據及截圖確認。

### F37-01 的修正迭代

修正沒有在右圖首次通過時提前結束。第二輪擴大檢查後，發現極矮 320×225 的合法 submitted review 曾因 A/B 無可用候選進入 technical；加密候選後，進一步發現左圖 A 與 v₂ 仍可相撞（A 的10°順時針反向作圖例，以及B的0°逆時針正向作圖例）。這些均屬同一標籤配置問題，F37-01 當時保持開放。

最終改為先更新讀數，再取得真實字形占用區，讓物理量避開 A/B、O、讀數及線段；極矮圖亦可利用讀數左右的空位。A、B 在更新後重新跑左右圖真 DOM 字形檢查，並親看最終手機／橫屏／極矮截圖。沒有用白底遮蓋碰撞、恢復引線，或把合法狀態改成故障鎖定來通過檢查。中途失敗證據保留，不作為最終結果。

## 全面覆蓋結論

| 面向 | 核對內容及結果 |
|---|---|
| 物理模型 | 弦表示位移、切向速度、Δv=v₂−v₁、正時間間隔、順逆轉向、遷移旋轉／反轉，以及有限間隔方向逐漸趨近瞬時方向均正確；沒有把有限間隔平均量當成精確瞬時量。 |
| 教學操作及回饋 | 保留位移→速度、兩點作差→加速度的簡單操作；模型參考速度不依賴前題答案，錯誤作圖不自動改正，不按拖動次數或最小角度給分，不增加操作解鎖。 |
| 作答及部分得分 | 七道單選與一條有向連線依最終狀態評分；空白0、單端U/V各5、反向兩端10、U→V20；方向與理由獨立給分，100總分、60達標，符合既定形成性rubric。 |
| 隨機性及穩定性 | 360種整數起角、方向題24種／理由題6種獨立排列可達；同attempt在拖動、導航、檢查及恢復時不重抽；舊offset／rank缺省維持原意義。 |
| 圖形／版面／可讀性 | 透明、無引線、無向量上標記法及桌面右方導覽保留。左右圖字形及標題避讓涵蓋原重現、窄橫屏、矮播放器、錯答及提交後參考。F37-01已關閉。 |
| 鍵盤與觸控 | 原生radio／整張圖卡、fieldset/legend、焦點、B方向鍵、時間／節點按鈕等效保留；44px局部handle、stable capture、取消／失焦／第二指／resize／切頁及預覽讀碼核對；正式browser與受影響斷點手勢結果另列。 |
| 保存／恢復及續作 | 權威答案、phase/task、觀察間隔與題目定義不變；合法null及錯答案保留，非法枚舉／關係拒絕；draft/review round-trip後執行合法續作；最大draft/review/pending為684／711／942 bytes。 |
| SCORM及提交信任 | startup、success／committed／frozen／retry、明確提交、唯讀review、失敗保存、記錄比對、pending深驗與quarantine均核對；不確定結果不冒稱確認成績，已記錄無重做控制。 |
| 錯誤處理 | 初始化失敗及後續SVG draw失敗分別覆蓋；F37-02故障時無活動LMS寫入，原checkpoint保持，fullscreen仍可用。 |
| 安全及信任邊界 | 固定TeX、DOM escape、枚舉／關係／容量驗證，無秘密或活動自行raw LMS lifecycle；沒有新增依賴或遠端服務。前端形成性分數可被開發者工具改動的已知限制仍在。 |
| SCORM封裝及登記 | manifest、HTML引用、MathJax bundle/license與共享runtime一致；SCORM為manifest加15個runtime、共16 entries；逐byte核對來源與真ZIP。測試增補在既有登記entry內，catalogue／registry無漏列新依賴。 |
| 效能及維護 | 顯示候選數量有界，額外掃描只在原候選受阻時執行，保留既有量度cache；無可重現的操作掛住／無界增長證據，不加入框架或無必要重構。 |

模型、評分、保存schema、SCORM權威資料及manifest依賴沒有改變；修改集中在活動顯示、初始化技術畫面及既有回歸測試。

## 實際驗證證據

以下區分執行者及測試層次，不將讀碼、候選框檢查或本機模擬冒稱實機驗收。

| 執行者／範圍 | 本輪實際證據 |
|---|---|
| A、B及主agent：五個活動Node entry | model、scoring、persistence、lifecycle、presentation均通過；包含5,376組物理、128個概念正答子集×10種作圖狀態、17,280組保存變體及合法續作，隨機排列與舊格式相容。 |
| 新增正式presentation回歸 | 14,112組右圖中文／數學／節點／線段配置，涵蓋正錯作圖及review reference；2,160組全整數起角×兩轉向×三種作圖的極矮左圖A/B、v₁/v₂、O／讀數避讓通過。原11,520組A/B、13,440組速度圖中心、47,040組中文名稱及48組圓周避讓仍通過。 |
| A：獨立擴展幾何 | 181,440組左圖A/B候選可用性、12,960組右圖正確差向量配置通過；這些是幾何檢查，不等於逐張實際字形目視。 |
| A：獨立真瀏覽器 | 左右兩個probe各6組幾何／review＋2種renderer故障，兩份報告completed=true、errors=[]；左右圖均比較實際DOM字形，故障時零LMS writes，可信fullscreen可進出。 |
| B：獨立真瀏覽器 | 7種viewport×4種起角／轉向／間隔／正錯作圖／edit-review組合，共28組左右圖DOM字形通過；另兩種renderer啟動故障通過，原checkpoint不變、零寫入。 |
| 主agent：正式來源／解壓SCORM browser | `output/playwright/circular-motion-vector-lab/report.json`：completed=true、errors=[]，runtime hash與本報告相同；60組布局、48組可信拖曳、左右圖真字形20組／資產（共40），renderer兩種故障／資產（共4）。保留空白／部分／完整評分、resume／pending／committed／readonly、fullscreen及鍵盤流程，均通過。整理者已直接核對JSON。 |
| 主agent：受影響T2／T3手勢 | `touch-T2-source.json`、`touch-T2-package.json`、`touch-T3-source.json`、`touch-T3-package.json`均completed=true、errors=[]、每份6cases且全部issues空，共24cases。涵蓋320×225及480×320，各initial／task-1-answered／submitted-1。整理者已直接核對四份JSON；這是受影響斷點專項，並非完整T0–T3重跑。 |
| 主agent：靜態／registry／文件 | 五Node、static、check:tests（252 entries）、文件及diff檢查均通過；提交後selection preview為`output/ci-tests/circular-vector-audit-selection.json`，僅是選取證據，不代表全站測試已跑。 |

原始報告及精準probe保存於`output/audit37/`：`reviewer-{a,b}-round{1,2}.md`、`synthesis-round1.md`、`a-round2-browser.json`、`a-round2-left-browser.json`、`reviewer-b-round2-probe.json`及對應截圖。該目錄為本機忽略證據；本文件承載可提交的判定、範圍及結論，不能假定另一台機器自動具有該目錄。

## 尚未驗證及交付限制

- 未執行實體iPhone／Safari、Android／Chrome、真Moodle學生帳號的current-window／new-window播放器、實際attempt policy／新attempt或學生試教。
- 未完成真正桌面瀏覽器200% zoom、軟鍵盤／真手機工具列變化及讀屏驗收；CDP viewport／觸控模擬不等同這些環境。
- 本輪未重跑全站252個entry、全站package:all或完整T0–T3所有生命週期矩陣；本輪專項、歷史證據及未驗項分開記錄。
- 兩位reviewer沒有直接重驗私人Sites所有即時遠端資產與存取政策。後續發布識別與資產核對另記，不因此宣稱真Moodle／實體手機通過。
- 本活動仍是瀏覽器前端評分的形成性活動，不能以此審核當成可信高風險考試服務的安全保證。


## 交付紀錄

- 修正 commit `ca37f82cd83cbaa4158219c325b5ac6b1f910cf0` 已 push 並核對遠端；模型、評分與保存 schema 未變。
- 2026-10-22 00:35（澳門），既有私人 Sites 發布回傳 `succeeded`。部署 `appgdep_6ad8e9d2007c819199ca4f01ba264384`；version `appgprj_6ad878e05e148191aee5ef92740b63f1~appgver_959f6a0b076c81919e053c4e7e204e70`；Site source commit `6fdb799d9fdd41ed23b8c039893862116218a3f1`。
- [更新後活動](https://circular-motion-vector-lab.ieyp.chatgpt.site/circular-motion-vector-lab/)沿用原有 owner-only 權限。官方發布成功及 archive 資產核對是部署證據，並非真 Moodle／實機驗收。
- Site archive 內15個runtime均與最終審核來源逐 byte 相同；SCORM依賴同樣完整。交付證據位於 `output/sites/circular-vector-audit-runtime-verification.json`、`circular-vector-audit-deployment.json`。
- Archive SHA-256 `4a712aeecec6eb3f6d4dbe796cd5de3c3af270e67902230910bcfbf5453a1150`；SCORM ZIP SHA-256 `08dd67a4c715cd3b7b949d1521dabfef5f99f5b3f9659b6b8c6829eb8b147668`。
