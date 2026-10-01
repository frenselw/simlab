# 運動合成：回饋與手機捲動 — 第二份獨立完整審核

日期：2026-10-01。審核者：`feedback_full_review_2`。

審核 branch：`codex/motion-composition-stroboscopic-plan`。實際基準為
`0bb873c8d7eb53ae2714fd100f453f8666ba2a94`，候選為
`4a62315946bcbaaca0f4ad327f1cdae62bc634ec`；最後另獨立核對
`cc85a611b9963538146a1b44d0c92bb953a0c706` 的 test-only 容量樣本修正。
這份審核涵蓋整條 branch，
不是只檢查最新文字／捲動差異，也沒有按領域與另一位審核者分工。
歷史審核只作背景；以下結論來自本次源碼核對及本人重新執行的驗證。

## 結論

完整 branch 的獨立程式及教學審核通過，沒有新發現或未解決的可重現問題。
七套活動 Node tests、repository syntax／manifest check、source／實際 ZIP
browser smoke、追加播放／手勢驗證及 ZIP byte parity 均通過。

本結論是本機審核結果。真實 Moodle 學生 attempt、實體手機及正式 player
拓撲尚未驗收；不將這些外部 gate 算作已通過，也不將「未驗證」當成程式錯誤。

## 完整範圍與核對結果

| 範圍 | 獨立核對及判斷 |
|---|---|
| 物理模型 | 四題都用同一個起始時間／原點，以 `x=vₓt+½aₓt²`、`y=vᵧt+½aᵧt²` 合成。A 為 `(4t,−4t)`，B 為 `(4t,−5t²)`，C 為 `(5t²,−4t)`，D 為 `(5t²,−5t²)`。A、D 的 `y=−x` 正確；B、C 的向下／向右拋物線方向正確。D 的直線軌跡不被誤稱為勻速。 |
| 等時頻閃 | 模型間隔 0.20 s，四個時刻終於 0.80 s；4 倍慢速只改播放時間。勻速相鄰距離皆 0.80 m；由靜止勻加速為 0.20／0.60／1.00／1.40 m，差值皆 0.40 m。比較工具用相同橫條比例，沒有把總位移當作相鄰間距。 |
| 有限資料的推論 | 分類問題問「哪種運動模型符合這組頻閃資料」，提示用「符合模型」。沒有把間距逐漸增加直接當成恆定瞬時加速度的證明。自由落體只用於 B，取 `g=10 m/s²` 並明示忽略空氣阻力；C 的水平加速沒有被稱作自由落體。 |
| 坐標／幾何 | 世界坐標向右為正 x、向上為正 y，向下為負值；圖域每軸 4 m，兩軸映射使用同一比例。模型／圖形／預覽／評分均用同一坐標。動態藍線沿垂直方向，橙線沿水平方向，同時刻交於合運動位置。另用 B 的方程獨立核實實際 DOM 線段端點。 |
| 播放與作答 | 分運動播放只顯示移動球，過程不留球影；停止恢復已有頻閃。頻閃由零逐次曝光且可反覆重播，不清位置／類型答案。四點非 null 後才出現核對虛線；部分位置不出現。學生球之間沒有連線，提交後參考圖的模型曲線與學生作圖分開呈現。 |
| 放球／直接修改 | 四個球架同時可操作。已放球各有固定 HTML capture target，可直接抓 t₄ 後再抓 t₃；不用先按時刻。球架入口與圖內入口均保持至少 44 px，球心位置不因外觀放大而改變。抓取偏移、公共格點吸附、放手保存及取消回復符合計劃。 |
| 部分分／空白提交 | 每時刻 x、y 各 2 分；兩種分運動各 3 分、軌跡 3 分；每題 25、全卷 100。完全空白／只看頻閃得 0，分類全對 36，位置全對 64。x／y 分開比較 ±50 mm，邊界含等號，一方向錯誤不抹去另一方向的分數。四題及各題內分類／位置沒有虛構的必答門檻。 |
| 提交流程 | 從未觀察、分類先答、部分及完整答案均可進 check，再明確提交。下一題只換題，第四題進 check，不自動提交。檢查顯示缺漏而不透露未提交的對錯。已記錄或不確定 finalization 沒有清結果／重開控制。 |
| 保存／續作 | snapshot 含權威答案、版本、phase、activeCase／activeTime、returnToCheck；指標、工作點、播放及參考 view 為暫態。嚴格驗型、拒絕非法 enum／位置／phase／依賴／版本，合法空白與部分不被拒絕。512 次 production round-trip 及合法續作通過；最終改用最長合法 enum 的容量樣本，draft／review／pending 為 807／835／1079 UTF-8 bytes，均低於 4000。原 791／818／1061 是先前較短 enum 的代表性樣本，並非最大值證據。 |
| SCORM／trust | 沿用 shared `loadAttempt`、startup、draft provider 及四種提交 outcome，沒有 activity-local raw LMS／commit／finish／pagehide 實作。review 重新驗證答案及評分，核對 saved 與 Moodle metadata；pending 固定同一權威答案，深層不合法時 quarantine。技術失敗保持鎖定，沒有冒稱已提交／通過。Standalone refresh fresh，Moodle same-attempt draft／review／pending 續作通過本機 fixture 驗證。 |
| 最新回饋 | 表頭直接寫「位置檢查」，逐方向顯示「水平／垂直：正確、需修正、未放置」。答錯類型與軌跡列學生答案及正解，未答用「未作答」，沒有用錯誤顏色混淆缺漏。坐標分行標 x／y；僅缺漏或有誤的時刻重複參考位置，正確作答不再附冗長完整答案表。獨立核對容差邊界與一方向部分分，文字與實際 scorer 一致。 |
| 文字及 UI | 繁體介面、變量 math 字體／斜體、真下標及正體數字／單位一致。標題／panel 恢復緊湊布局，桌面圖上文字及球體仍放大。手機 stage／panel 分區清楚，短畫面重排而不縮主要控制；必要圖標／球架不被遮擋，check／submit 可捲至，feedback table 無水平溢出。 |
| 鍵盤／觸控 | Tab、方向鍵／Shift 微調、Enter 保存及 Escape 取消有清楚說明，非目前時刻的球也可用鍵盤操作。手機拖球的 pointer type／trusted evidence、move／up、預覽及 release 保留正確 geometry；only selected slot 改變，其餘答案及所有非 owner scroll／viewport 固定。 |
| 手勢 ownership | 面板原生只捲自身且邊界 contain；空白 stage 與 24 px 左右條只轉交實際同源 enclosing host。ancestor 解析不掃描兄弟 panel，固定中間 iframe 不會吞掉外層 host 位移；只有實際消耗 scroll 時才 preventDefault。document、外層容器及固定巢狀 iframe 的來源／ZIP 雙向可信手勢均通過。另驗面板起手後跨到 stage 仍維持 panel owner。 |
| 包裝／登記 | catalogue slug／title／categories／description／tags／active 登記一致；manifest 為 SCORM 1.2、單 SCO，root 有 imsmanifest.xml。全部本地 HTML runtime 引用均在 manifest，15 個 ZIP entries 與 manifest 和目前 source 逐 byte 一致；沒有 CDN、秘密、tests 或臨時工具入包。新 tests 已列入 tools/run-tests.js，browser command 已登記。 |
| 計劃與契約 | 親自閱讀共享風格、production guide、活動計劃及 base..HEAD。風險／rubric／依賴／phase variants／schema／gesture table／snap／preview／test 決定具備；最新使用者要求有記錄，舊 no-subagent／套件 SHA／歷史審核沒有冒充本次結果。共享 runtime 及其他活動沒有修改。 |

## 本人實際驗證

七個命令全部退出碼 0：

```text
node sim/motion-composition-stroboscopic-lab/model.test.js
node sim/motion-composition-stroboscopic-lab/scoring.test.js
node sim/motion-composition-stroboscopic-lab/persistence.test.js
node sim/motion-composition-stroboscopic-lab/lifecycle.test.js
node sim/motion-composition-stroboscopic-lab/animation.test.js
node sim/motion-composition-stroboscopic-lab/scene.test.js
node sim/motion-composition-stroboscopic-lab/feedback.test.js
```

`node tools/check.js` 及 `git diff --check 0bb873c8..HEAD` 亦退出碼 0。
[check log](../../output/motion-composition-feedback-review-2-check.log)
記錄 JS／manifest profile 檢查通過。

本人啟動全新 Chrome profile／localhost，重新建包及解壓後執行：

```text
MOTION_ARTIFACT_SUFFIX=feedback-review-2 node tools/motion-composition-browser-regression.js --smoke
```

引擎為 Chrome **155.0.8059.27**／CDP。原始
[smoke report](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-2/smoke-report.json)
及 [log](../../output/motion-composition-feedback-review-2-smoke.log)
是本次獨立執行產物，不是主 agent／另一位審核者的結果。

- Source／ZIP 各 13 個 viewport，包含手機、桌面、橫向及短畫面；四題四時刻 edit／reference，逐字 bounding box、球架熱區、只讀及圖例核對。
- Source／ZIP 各 5 組正常／reduced 頻閃曝光、40 組播放起點／首曝光及 280 個短 reference／密集／部分／錯誤答案布局。
- 兩路均經 actual DOM 完成正常、空白及部分提交；keyboard、draft／review／pending resume、技術鎖、儲存不可讀的 standalone refresh、比較間距及 resize 停播續播通過。
- Source／ZIP 各 36 個短 trusted-touch rows，包含四題所有時刻的球架及圖內球、錯誤公開格點、preview／release 一致性及取消。每個 gesture 保留 owner／非 owner before／during／after 資料。
- Source／ZIP 各 9 個空白／部分／全對 feedback state，含 1024×768、390×600、320×225；表格／panel／document 水平 overflow 為 0。
- Source／ZIP 各 84 次可信手勢，390／320 寬 × document／container／nested host：空白／左右條雙向 pan、panel 中段／上下邊界雙向 pan、直接 t₄→t₃ 拖動。每次都斷言答案、選擇、activity document、stage、panel、各層 host／visual viewport／iframe geometry 的改變或固定。

另親自編寫及執行 output 下的
[追加腳本](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-2/extra-check.js)，
退出碼 0，見
[extra report](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-2/extra-report.json)
及 [log](../../output/motion-composition-feedback-review-2-extra.log)：

- Source／ZIP 在分運動約 0.42 s 時球影數為 0，移動球與核對虛線各 2；停止恢復 8 個既有球影。
- 每路連續兩次頻閃均觀察到 0→4→8 個球影，沒有清作答；用 B 的 `x=4t`、`y=−5t²` 另算實際虛線交點及兩線垂直方向。學生球連線數為 0。
- B→C→D 的 panel 下一題可達 check，四題答案保持，沒有自動提交。
- 390×600 的可信 touch 從 panel 起手移入 stage 後，panel 由 100→185，host／iframe／activity viewport／stage／答案／選擇全固定；panel 上邊界外拖仍為 0，沒有轉交外層。
- `errors=[]`，沒有 runtime exception。

本人目視核對本次 1280px 桌面 A–D、390px 手機、320×225 短畫面與
feedback 的實際截圖；不是只讀 CSS 或使用舊圖。

本人另讀實際 ZIP 並核每檔 bytes：**39,301 bytes、15 entries**，
[parity record](../../output/playwright/motion-composition-stroboscopic-lab/feedback-review-2/package-parity.json)
為全等。審核取樣時 archive SHA-256 為
`b97732298a822f551f57ac278e359e4d1669446b62d8d3df775b799b5d6b65a7`；
parallel builds 的 archive metadata 可變，最終交付 SHA 由主 agent 在全部建包結束後固定。

## 未驗 gate 與證據界限

- 本人執行的是完整獨立 source review、七套受影響 Node tests、browser
  **smoke** 及追加驗證；沒有聲稱本人另跑全 repo `npm test`、`package:all`
  或沒有 `--smoke` 的完整 runner。主 agent 的最終總報告應另列其實際命令。
- 手機證據是 browser-level trusted CDP touch，host 是同源 Moodle 類 fixture。
  這證明 package 本機行為，未證明實體 iOS／Android、真實瀏覽器 picker／工具列、
  native zoom、真實 Moodle current-window／new-window 或跨來源 player 行為。
- 本機 fake LMS 驗證了其提供的 same-attempt lifecycle，不代替真實 Moodle
  學生 attempt 政策、refresh／exit-re-entry 或新 attempt 驗收。

## 最後容量樣本 closure（cc85a61）

審核1指出原 `max` fixture 的 `nonuniform` 並非最長合法 motion key；
原 791／818／1061 bytes 只代表該樣本，不能作為最大樣本容量證據。
本人獨立讀取 `4a62315..cc85a61` 差異，確認修正從 model 的合法 motion／
trajectory keys 選取最長者，不修改 production 模型、評分、schema 或 runtime。
目前 keys 皆為 ASCII，按字串長度選取亦等同選取最長 UTF-8 enum；
boundary 位置 `[-400,−3600]` 及各 envelope 型別仍是 production 合法形狀。

本人重新執行 `node sim/motion-composition-stroboscopic-lab/persistence.test.js`，
退出碼 0：**512 次 production round-trips／合法續作及非法狀態驗證通過；
最終最大樣本 draft／review／pending 為 807／835／1079 bytes，全部低於 4000**。

另直接核對上述兩個 commit 間全部活動 production 檔、manifest、catalogue 與
shared 的 diff 為空。既有 source／實際 ZIP browser 證據及 ZIP entry bytes 因此仍適用；
沒有再次跑 browser 或建包。這個 P3 證據問題已關閉，本報告的容量欄同步改為最終數字。

本次無需 production 修正。沒有待主 agent 處理的 P1／P2／P3 finding。
