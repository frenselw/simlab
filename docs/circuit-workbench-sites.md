# DC／AC工作台的獨立Sites部署

2026-10-11已分開發布兩個standalone工作台，兩次Sites原生部署均回傳 `succeeded`。目前均為預設私人存取，須以擁有者的ChatGPT帳戶登入；不是公開學生入口，也不是SCORM部署。

| 工作台 | 正式網址 | Site project ID | 原始入口 |
|---|---|---|---|
| DC | [直流電路工作台](https://simlab-dc-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd25ad448191b82c7bdd801e2047` | `sim/circuit-workbench/index.html` |
| AC | [交流電路工作台](https://simlab-ac-circuit-workbench.ieyp.chatgpt.site) | `appgprj_6acacd3a2fb4819187870a3ebf24da68` | `sim/circuit-ac-workbench/index.html` |

## 來源與部署版本

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

每站使用 `static.directory: "dist"`。部署archive保存在 `output/sites/circuit-dc-workbench.tar.gz` 及 `output/sites/circuit-ac-workbench.tar.gz`；由Sites helper按已推送source建立。本次沒有改模擬runtime；repository根目錄既有的Site配置屬於另一個Site，不作這兩站的身份。

## 驗證界限

執行必要的部署檢查：各資產逐byte一致、HTML相對引用存在、根目錄HTTP200及自動跳轉、兩站實際本機browser掛載、實物／符號視圖切換及console零error。正式部署由原生Sites成功結果確認，兩個正式網址已開啟；未登入的browser顯示預期的ChatGPT登入頁。

沒有重跑先前已審核的物理／手勢全套測試。此次Sites發布不是Moodle／實機驗收，也沒有將站點改成公開存取。AC審核範圍及既有證據見[審核報告](circuit-ac-workbench-audit-2026-10-11.md)。
