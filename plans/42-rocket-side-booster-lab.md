# 火箭工廠：側助推器實驗版

> 評核／SCORM／提交內容現為歷史紀錄。本工具已改為純探索式模擬；現行產品、狀態與交付契約見[小小航天家計劃](42-rocket-explorer-workbench.md)。本頁其餘物理與畫面設計及驗證紀錄保留供追溯。

依 [新活動模板](NEW-SIMULATION-PLAN-TEMPLATE.md) 建立，遵守[共用設計](00-shared-platform-and-style.md)及[生產契約](../docs/simulation-scorm-production-guide.md)。來源歷史證據見[原活動計劃](40-rocket-space-mission-lab.md)，不當成本副本已通過。

本頁記錄未擴充副本的歷史實作及證據；固體助推器、中燃料箱與均衡型引擎已實作，現行規格／操作／schema5／測試及最新ZIP證據以[擴充實施計劃](42-rocket-side-booster-expansion-plan.md)為準。

## Scope

| Decision | Activity specification |
|---|---|
| Slug / learning objective | `rocket-side-booster-lab`；組裝火箭、發射並建立安全近圓軌道 |
| Delivery scope / package | SCORM 1.2；`sim/manifests/rocket-side-booster-lab.xml`；`npm run package -- rocket-side-booster-lab` |
| Learner task / main interactions | 本輪完整複製現有組裝、發射、飛行控制、兩級分離、保留成果與提交 |
| Shared subject core / activity outer layer | 使用者要求獨立副本；本活動自有 model、parts、scoring、persistence、scene、素材及 vendor；平台 shared runtime 仍共用，本輪不改 |
| Runtime files / libraries | 完整本地依賴及 pinned Three.js 0.185.1，沿用原 manifest 依賴閉包，無新 library |
| Assessment risk / trusted validation | 形成性／低風險 browser grading；不供高風險可信評核 |
| Out of scope | 側助推器只分析，未實作；舊活動／舊套件不改；未發布 Sites／上載 Moodle |
| Baseline / isolation | 來源 `28e57a9`；新 activity ID `rocket-side-booster-lab-v1`；獨立 manifest／organization／item／resource ID；兩活動 snapshot 不互收，Moodle 應新增獨立 SCO |

## Catalogue metadata (`sim/config.js`)

```js
{ title: '火箭工廠：側助推器實驗版', folder: 'rocket-side-booster-lab',
  categories: ['Mechanics'],
  description: '火箭工廠的獨立實驗副本；目前玩法相同，供後續側助推器功能開發。',
  tags: ['physics','mechanics','gravity','rocket','orbital-motion','3d','scorm'], status: 'active' }
```

active 表示可啟動／打包，不代表助推器已完成或全部交付閘門通過。

## Physics or subject model

本輪原樣保留模型：150 kg 載荷、一／兩級、每級最多四箱。大推力引擎 600 kN／500 kg／300 s；高效率引擎 80 kN／150 kg／340 s；小箱燃料1500 kg／乾重100 kg，大箱6000 kg／400 kg；分離器60 kg。R=6371000 m、μ=3.986004418e14 m³/s²、g₀=9.80665 m/s²。RK4、重力／阻力／耗油／地形碰撞／軌道推算與單一 active 級保留，未加入平行發動機。

## Responsive layout contract

保留來源 header／3D stage／control panel 三區、bounded split-panel，959px 以下縱向、桌面並列，沿用全部 CSS。只改頁面／header 名稱。保留 shared fullscreen marker／script／完整 activity target。測試目標為320×500/568、390×500/600/844、短橫向、tablet／desktop、toolbar／鍵盤／200% zoom；本輪實測另列，未跑者保持待驗。

## Navigation, submission and reset

組裝→發射台→飛行有資料依賴；每個 editable phase 都可 check，包括空白／部分作答。check 可返回原 phase，明確 submit。保留工廠拆件、試飛重做與單一保留成果；不能清除 submitted／pending。review／committed／frozen 唯讀。standalone refresh 新開始，Moodle 同 attempt 續作。

## Diagrams, notation and assistance

沿用 Three.js 模型、真比例分離近景／示意軌道全景、力／速度箭頭及 SI notation。接點吸附沿用 interaction.js／scene.js 原容差，與評分容差分開。保留原位 ghost，無額外 touch preview 視窗；粗鏡頭操作不需精密放大。

## Touch gesture ownership contract

零件 handle／已裝零件／camera handle 由 simulation 擁有；元件卡其餘位置與 panel 由 panel 捲動；stage 空白及左右 scroll strips 交 enclosing host。鍵盤選件／Delete、鏡頭按鈕及 sliders 沿用。

完整 browser owner 保留工廠空白／部分／完整／拖動取消、pad／ascent／coast／ended、check return、review／pending、renderer recovery；gestureHosts／gestureZoom 等測試保留 T0 standalone、T1 direct iframe、T2 nested player、T3 element owner、native move/release 與答案不變斷言。T4 真 Moodle／真手機待驗，既有歷史證據不充當本輪通過。

## Scoring and tolerance

保留10／15／45／30，70合格：升至10 m得10、最高海拔100 km得15；關機且 flying／bound 時按近地點進度最多45，近地點≥150 km得足分，未達最多44；安全入軌後 e≤.03得30，.03–.06線性部分分，未近圓最多29。無遠地點上限；只評同一保留試飛、無紀錄0，不拼接不同試飛。數值容差及邊界以原樣複製 scoring.js／orbit.js 及測試為準。保留 schema2 legacy scorer，但不同 activity ID 拒收，不遷移舊 Moodle 成績。

## Phase/state matrix

variant固定0；records=[record|null]，未作答合法。

| Phase / variant | Required / absent data | Legal continuation / final-check route |
|---|---|---|
| workshop 空白／部分／完整 | craft 可不完整，flight=null | 組件操作；完整後 launch；check |
| pad 一／兩級、未點火／地面燃燒 | 完整 craft／flight，status=pad、maxHeight近零 | ignite／控制／check |
| ascent 一／兩級、分離前／後 | 合法 flight 非 impact/escaped，有燃料才可lit | 控制／stop／合法 separate／record／check |
| coast 一／兩級、分離前／後 | 合法 flight 及核心燃料／控制狀態 | ignite／控制／record／check |
| ended impact／escaped | 接地／高度／能量關係合法、引擎關閉 | 保留／工廠／check |
| check × 每個 backPhase | 上述各合法階段資料保留，backPhase非check | return 或明確submit |
| review／committed | review answer及重評吻合結果 | 唯讀；committed可retry finish |
| frozen pending-final | 合法 reviewJson及canonical answer | 只retry同份；非法quarantine |
| technical／mismatch | 錯誤或可信LMS摘要，不虛構答案 | 鎖定；只確認未交同ID草稿可明確復原空白 |

## Persistence contract

獨立 envelope `{version:1,activity:'rocket-side-booster-lab-v1',kind,answer}`，4000 UTF-8 bytes上限；review帶score／passed比較metadata。draft schema4／modelVersion2：`[4,2,phase,backPhase,craft,flight,record]`；review `[schema,2,record]`，原compact排列不變。

- craft：payload0、stages一／兩個`{engine:null|0|1,small:0..4,large:0..4,order?:s/l string}`、separator與級數一致、capsule?:false；每級≤4箱。
- flight：source='own'、craft、t 0..604800 s、state=[x,y,0,vx,vy,0]、fuel=[lower,upper|null]、active0/1、separated、attitude、controls(mode/angle/throttle/lit)、status(pad/flying/impact/escaped)、maxHeight。production validator驗數值、燃料／phase／地形／能量關係。
- record：craft/state/fuel/active/separated/t/status/maxHeight/engineOff；t>0且非pad，未作答=null。
- pointer／ghost／camera／animation／running／fullscreen不保存，UI／分數重建。保留同ID schema2/3 draft migration及review版本，跨ID拒收。
- invalid finished只顯可信摘要且鎖定；invalid pending quarantine；invalid draft只確認同ID且未交才允許原復原流程。standalone不跨reload保存。

## Shared SCORM lifecycle

沿用 shared scorm.js／activity-flow.js：loadAttempt/startup/setDraftProvider/submitWithCallbacks。success→review；committed→唯讀finish retry；frozen→鎖定同份重試；retryable retry→check，nonretryable→technical。review重評並比較LMS metadata；未知／不吻合不聲稱確認成績。不新增直接LMS欄位或頁面生命週期。

## Test plan

- 複製七組Node及fixtures（art的manifest路徑改指新活動）；新增原目前activity ID拒收／鎖定檢查。
- 複製完整49-case browser owner及分組審計，三組interaction／terrain／flight以新scope登記；source＋extracted SCORM保留。
- 本輪執行新副本全部Node及`--smoke`（layouts／launchOnly／lifecycle）、check／check:tests／diff；核對複製檔、runtime bytes／manifest／新ID與舊活動未改。
- 全庫、全部browser分組／完整T0–T3／viewport矩陣仍待驗，不以smoke宣稱全部通過。

### Test registration and CI selection evidence

| Item | Activity decision / executed evidence |
|---|---|
| Runtime resources | `sim/manifests/rocket-side-booster-lab.xml`；本地素材／vendor複製，shared依賴原宣告 |
| Logical tests | 新目錄art/model/orbit/scoring/persistence/interaction/lifecycle.test.js；tools/rocket-side-booster-browser-regression.test.js |
| Browser owner | tools/rocket-side-booster-browser-regression.js，`--group=interaction/terrain/flight`，scope=rocket-side-booster-lab，source/package |
| Helpers／manual gates | 無新增helper／manual gate；沿用position-time browser基礎設施 |
| Registration check | `npm run check:tests` 通過：302 entries（257 Node／45 browser），48 helpers／2 manual；原註冊保留 |
| CI preview | 本輪未commit，無committed selection；catalogue／registry變更預期full，後續提交才可記正式base/head preview |
| GitHub verification | 未提交／觸發；新活動初次仍需full verification |

## Package-ready checklist

- [x] 本輪Node／smoke／複製／manifest／隔離核對完成，見下方實測
- [ ] 全部分組、T0–T3、phase／mode／viewport／zoom矩陣
- [ ] 全庫npm test／package:all／committed selection與CI
- [ ] 以上未全部通過，本輪不標完整package-ready

## Moodle-ready checklist

- [ ] 真Moodle新增獨立SCO；學生帳號評分／resume／review／pending／新attempt
- [ ] 真iPhone／Android／iPad、Moodle current/new-window T4及fullscreen
- [ ] 本輪不標Moodle-ready，不覆蓋舊活動attempt

## 本輪實測（2026-11-05，未提交 working tree）

- 477份活動檔案完整複製；473份runtime宣告與原manifest路徑映射一致。除標題／activity ID外的runtime逐byte相同；另只調整art測試manifest路徑及兩份測試增加跨活動隔離檢查。原活動477檔、manifest、browser owner／audit及plan全部SHA-256核對未改。
- 副本七組Node及browser分組審計共8個入口通過，含每phase的production round-trip／合法續做、原手動入軌recipe、0／部分／100分、全部提交流程與兩活動互拒draft／review，以及原活動draft／review／pending不會在新活動解鎖或被清除。
- `npm run check`／`npm run check:tests`／`git diff --check`通過。working-tree選擇模型為full／packages=all／302 entries，原因sim/config.js改動；這不是committed selection或全套已執行。記錄`output/reports/rocket-side-booster-working-tree-selection.json`。
- `node tools/rocket-side-booster-browser-regression.js --smoke`在Chrome156 source＋實際extracted SCORM通過20 layouts、14 flows、errors=[]：標題／header/fullscreen排列、可達控制、固定150kg、實際入軌／部分成果／明確提交、review resume／pending retry／finish retry／standalone refresh／storage denied／fullscreen／renderer recovery。桌面1280×800及手機390×844工廠、390px飛行及320px成果截圖已目視。初次Chrome在sandbox內無法啟動，後以相同命令在批准的sandbox外完整執行成功。
- browser報告`output/playwright/rocket-side-booster-lab/report.json`；runtimeHash=`3b122ea390424898d33a9d35d01c3f61f730945c2c2410b29aee69dbce5385d9`。沒有用原活動歷史通過代替本輪證據。
- 交付`output/packages/rocket-side-booster-lab-scorm.zip`：15,971,275 bytes、474 entries含root imsmanifest.xml；全entry逐byte對來源、HTML依賴全宣告，沒有tests／test-support或舊活動runtime依賴。SHA-256=`af619e7bd2b0ae8de0d2bfcade41e06d59cdd66afcdb134393622d09e3c8bb78`。完整複製／原檔hash／package核對報告`output/reports/rocket-side-booster-clone.json`。
- 未跑全庫／完整49-case browser owner／完整T0–T3、200% zoom或真手機／iPad／Moodle；沒有commit／push／Sites／Moodle部署。新活動完整package-ready與Moodle-ready閘門仍未全部完成。保留正式ZIP及必要報告／截圖；本輪scratch腳本清除，browser／server／解壓目錄由runner finally關閉／清除。

## 後續擴充設計

使用者已選定固定推力固體助推器、手動分離及主引擎獨立油門，並要求新增一種燃料箱與一款引擎。完整設計已移至[擴充實施計劃](42-rocket-side-booster-expansion-plan.md)，取代本頁先前助推器分析；包含候選數值、操作限制、實際影響範圍、phase／schema／legacy政策及驗收。

本頁上方實測及hash仍屬未擴充副本；同名交付ZIP現已重建，請以擴充計劃及最新報告的hash核對。
