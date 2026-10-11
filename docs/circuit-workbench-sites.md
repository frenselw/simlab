# DC／AC工作台的獨立Sites部署

2026-10-11兩個standalone工作台已更新至Sites version 3，兩次原生部署均回傳 `succeeded`。目前均保留擁有者私人存取，須以擁有者的ChatGPT帳戶登入；不是公開學生入口，也不是SCORM部署。

| 工作台 | 正式網址 | Site project ID | 原始入口 |
|---|---|---|---|
| DC | [直流電路工作台](https://simlab-dc-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd25ad448191b82c7bdd801e2047` | `sim/circuit-workbench/index.html` |
| AC | [交流電路工作台](https://simlab-ac-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd3a2fb4819187870a3ebf24da68` | `sim/circuit-ac-workbench/index.html` |

## 最近更新：Sites version 3／CW-03-R2及CW-06（2026-10-11）

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

每站使用 `static.directory: "dist"`。初次部署archive保存在 `output/sites/circuit-dc-workbench.tar.gz` 及 `output/sites/circuit-ac-workbench.tar.gz`；最新archive見上方version 3記錄。每次均由Sites helper按已推送source建立。repository根目錄既有的Site配置屬於另一個Site，不作這兩站的身份。

## 驗證界限

執行必要的部署檢查：各資產逐byte一致、HTML相對引用存在、根目錄HTTP200及自動跳轉、兩站實際本機browser掛載、實物／符號視圖切換及console零error。正式部署由原生Sites成功結果確認，兩個正式網址已開啟；未登入的browser顯示預期的ChatGPT登入頁。

沒有重跑先前已審核的物理／手勢全套測試。此次Sites發布不是Moodle／實機驗收，也沒有將站點改成公開存取。AC審核範圍及既有證據見[審核報告](circuit-ac-workbench-audit-2026-10-11.md)。
