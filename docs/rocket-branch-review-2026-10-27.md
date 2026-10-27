# 火箭分支獨立審核與跟進（2026-10-27）

審核分支 `codex/rocket-space-mission-lab`，Round1目標 `79976bf967fcae241495129411833ae170b3bed7`，對照主線基準 `1ef4bdf4fd696b4a12c37f7c1bedfe6d6f96849d`。
兩位獨立subagents `rocket_review_a` / `rocket_review_b` 平行審閱完整branch與相關呼叫/測試；各自只讀，初次結論互不交換。預期負載為每個瀏覽器一位學生，SCORM為低風險形成性評估。

| 項目 | 優先度 | 重現與影響 | 跟進 |
| --- | --- | --- | --- |
| R1 高倍速跨低空門檻 | P2 | 由production垂直發射/關機/滑行取得120398.080m、垂直−2549.354m/s合法草稿；0.2s幀選1000倍，原程式前進45.803711s直接impact，學生失去低空5倍控制窗口。ui-runtime advanceFrame只在幀開始查一次限制。 | 已修正（cad160a）：逐積分步重查限制，下降接近門檻先界定步長，餘下前景時間用較低倍率，總800步不變。 |
| R2 過時手機捲動fixture | P2 | profiles('rocket-space-mission-lab')即拋T.raised is not a function；另有T.escaped、M.clone、mission/node/第二record、舊activity ID及不存在的B/practice按鈕，令phases=all測試無法啟動。 | 已修正（cad160a）：使用現行單任務合法狀態與P.ACTIVITY，更新standalone按鈕路徑並移除node拖拉分支。 |

基準七組rocket Node及279-entry registry通過。兩位沒有另行確認可重現的runtime/SCORM/資產閉包缺陷；其中A核對473份manifest檔案與本地依賴/Three.js來源一致。此結論不是無其他bug的保證。

安全著陸/傾倒、視覺槽不改碰撞、未驗真手機/Moodle屬已說明且本次接受的邊界，不作新功能要求。

## 輪次紀錄

1. Round1：兩位完整獨立審核，均提出R1/R2。
2. Round2：兩位獨立覆核cad160a及相連範圍，均確認R1/R2關閉。A沒有新發現；B提出P3：pad fixture雖然status=pad，phase仍ascent，跳過真正未點火介面。36a1e8d明確還原pad phase，並在既有profile測試加入phase/status/未點火斷言。
3. Round3：兩位各自只覆核上述兩行delta及直接影響，均確認P3關閉；codec還原、check/return、點火及合法升空續做通過。兩位均建議發布，沒有未處理已確認事項。

超過三輪後，第四輪起只審上輪後修改及直接相連範圍；保留同一輪次計數。


## 必要驗證

- 原基準七組rocket Node（orbit/model/scoring/persistence/interaction/lifecycle/art）通過。修正後再跑lifecycle、mobile-scroll-browser-regression Node及279-entry registry，全部通過；最後pad小修再跑profile Node。沒有重跑無關大型全browser matrix。
- R1原合法下落個案由120398.080m開始，0.2s前景幀現在只推進1.155369s，仍在117446.321m飛行；實際倍率包含短暫高空段，再切低空5倍。另驗證高空長幀總800積分步上限。
- R2全部13份source/package profile均能構建，保存/還原使用production codec及當前activity ID，並可合法check/return。standalone profile指向實際存在的當前元件/發射/提交按鈕。
- 手機390×844的6個browser案例全部通過，0 JS errors：source與實際SCORM各camera-surface（包含trusted touch的complete/cancel/secondary/blur/lostcapture），實際SCORM pad，以及standalone pad/ascent/submitted。瀏覽器均由runner清理關閉。
- 本地證據：output/playwright/mobile-scroll-acceptance-T1-phases-source.json、output/rocket/p57-package-scroll.json、output/rocket/p57-package-pad.json、output/rocket/p57-standalone-scroll.json。四份completed=true/status=passed。
- 修正commit cad160a8d6329524219ec8ecfc39151891f19d70、36a1e8df9c8744bf50b8b4b1d3c48aee374479d6已推送原branch。針對已提交版本的selection-preview為output/rocket/selection-p57.json（79976bf→36a1e8d），只作選擇預覽，沒有宣稱全部選出owner均重跑。
- 實測runtimeHash=7765f8fce670ab66f96c657ad148a1127a3f2a188c7ef9d9eb76bf1ddb5b0c25；473份manifest依賴與ZIP的474 entries逐一核對dist。SCORM packageSha256=dec9720ab0196889475809257e73a5f24b894d55346dc280afba2c0f0470655e，保留schema4/150kg及原評分。

真Samsung/iPhone GPU、實體touchpad與實際Moodle未驗；本次review不提供正式Moodle-ready或零缺陷保證。安全著陸/傾倒沒有加入。


## 發布證據

- 原Site來源helper產生並推送92d243612defa344642e8d0902fed47c963f73ea，archive為output/rocket/rocket-review-fixes-p57.tar.gz。root實作來源保持36a1e8d；兩個repository的SHA沒有混用。
- 原網站版本55，version_id=appgprj_6adc62579ab88191aba299bcb282ce95~appgver_0eea58010a748191b042c8dcf94eaf5a；deployment=appgdep_6ae0802d6c8c8191a1d4176065c09ba6，native succeeded於2026-10-27 18:43:00 UTC+08。
- 原網址https://simlab-rocket-space-missions.ieyp.chatgpt.site/rocket-space-mission-lab/，原owner-private受眾保持1 user/0 groups/0 external。
- output/rocket/p57-live-verification.json completed=true，核對入口、build-info、main、ui-runtime、scene、scene-art、contact-ground共8份線上檔案與實測dist一致。open_in_codex已接受原網址交接，回傳queued，沒有把queued宣稱為已顯示。
