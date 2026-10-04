(function (root) {
  'use strict';
  const template = `
  <svg class="icon-defs" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><defs><symbol id="icon-settings" viewBox="0 0 24 24"><path d="m10 3-.6 2.3-2 .9-2.1-.6-2 3.4 1.6 1.7v2.6L3.3 15l2 3.4 2.1-.6 2 .9L10 21h4l.6-2.3 2-.9 2.1.6 2-3.4-1.6-1.7v-2.6l1.6-1.7-2-3.4-2.1.6-2-.9L14 3Z"/><circle cx="12" cy="12" r="3"/></symbol><symbol id="icon-save" viewBox="0 0 24 24"><path d="M5 3h12l3 3v15H4V3ZM8 3v6h8V3M8 21v-7h8v7"/></symbol><symbol id="icon-open" viewBox="0 0 24 24"><path d="M3 20V5h7l2 3h9v4M3 20l3-8h16l-3 8Z"/></symbol><symbol id="icon-focus" viewBox="0 0 24 24"><circle cx="10" cy="10" r="6"/><path d="m15 15 6 6M7 10h6M10 7v6"/></symbol><symbol id="icon-fit" viewBox="0 0 24 24"><path d="M8 3H3v5M16 3h5v5M21 16v5h-5M8 21H3v-5M8 8h8v8H8Z"/></symbol><symbol id="icon-straight" viewBox="0 0 24 24"><path d="M5 12h14"/><circle cx="3" cy="12" r="2"/><circle cx="21" cy="12" r="2"/></symbol><symbol id="icon-detach" viewBox="0 0 24 24"><path d="M3 5v6h6M15 13h6v6M7 7l3 3M14 14l3 3M10 14l4-4"/></symbol><symbol id="icon-meter" viewBox="0 0 24 24"><path d="M3 18a9 9 0 0 1 18 0ZM12 17l4-7M6 11l1 1M12 8v2M18 11l-1 1"/></symbol><symbol id="icon-flip" viewBox="0 0 24 24"><path d="M4 8h16l-4-4M20 16H4l4 4"/></symbol><symbol id="icon-rotate-cw" viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M15 8h6V2"/></symbol><symbol id="icon-rotate-ccw" viewBox="0 0 24 24"><g transform="translate(24 0) scale(-1 1)"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8M15 8h6V2"/></g></symbol><symbol id="icon-trash" viewBox="0 0 24 24"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/></symbol><symbol id="icon-copy" viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="13" rx="2"/><path d="M16 8V3H3v13h5"/></symbol><symbol id="icon-probe" viewBox="0 0 24 24"><path d="m4 20 6-6M7 11l6 6M9 13l8-8 3 3-8 8M17 5l3-3"/></symbol><symbol id="icon-wire" viewBox="0 0 24 24"><path d="M3 5c0 12 18 2 18 14"/><circle cx="3" cy="3" r="2"/><circle cx="21" cy="21" r="2"/></symbol><symbol id="icon-panel" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M15 4v16M18 9h1M18 13h1"/></symbol><symbol id="icon-help" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 4 2c-1 .7-1.5 1-1.5 2M12 17h.01"/></symbol></defs></svg>
  <header class="sim-header" data-sim-fullscreen>
    <div class="brand"><h1>電路工作台 <span class="badge">直流</span></h1><p>搭建・量測・探索</p></div>
    <nav class="header-actions" aria-label="電路文件及操作">
      <select id="preset" aria-label="課堂範例"><option value="series">兩燈串聯</option><option value="parallel">兩燈並聯</option><option value="mixed">串並混聯</option><option value="ohm">全電路歐姆定律</option><option value="limiting">滑動變阻器 · 限流</option><option value="divider">滑動變阻器 · 分壓</option><option value="lampCurve">燈泡伏安特性</option><option value="gAmmeter">G 表 · 並聯分流</option><option value="gVoltmeter">G 表 · 串聯分壓</option><option value="meters">A／V／W 表接線</option><option value="bridge">橋式電路</option><option value="wiring">固定元件接線</option><option value="empty">空白畫布</option></select>
      <button id="undo" title="復原（Ctrl/⌘ Z）" aria-label="復原">↶</button><button id="redo" title="重做（Ctrl/⌘ Shift Z）" aria-label="重做">↷</button>
      <button id="settings" class="icon-button" title="設定" aria-label="設定" aria-controls="settingsDialog" aria-expanded="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-settings"/></svg></button><button id="save" class="icon-button" title="儲存電路檔" aria-label="儲存電路檔" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-save"/></svg></button><button id="open" class="icon-button" title="開啟電路檔" aria-label="開啟電路檔" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-open"/></svg></button><button id="help" class="icon-button" title="操作說明與模型" aria-label="操作說明與模型" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-help"/></svg></button>
    </nav>
  </header>
  <div class="workspace">
    <section id="stage" class="stage" aria-label="電路畫布">
      <div class="stage-tools"><div class="segmented"><button id="realView" aria-pressed="true">實物</button><button id="schematicView" aria-pressed="false">電路圖</button></div><span id="circuitStatus">直流穩態</span><button id="probe" class="icon-button" title="探測兩點電壓" aria-label="探測兩點電壓" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-probe"/></svg></button><button id="pickWire" class="icon-button" title="拿導線：重疊時優先拿導線" aria-label="拿導線：重疊時優先拿導線" aria-pressed="false"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-wire"/></svg></button><button id="pan" class="hand-tool" aria-pressed="false" title="拖動畫布；觸控板可雙指滑動，捏合縮放" aria-label="手掌工具：拖動整張畫布"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 12V5a1.5 1.5 0 0 1 3 0v6-8a1.5 1.5 0 0 1 3 0v8-6a1.5 1.5 0 0 1 3 0v7-4a1.5 1.5 0 0 1 3 0v7c0 4-2.5 6-6 6h-2c-2 0-3.4-1-4.6-2.6L4 14c-1-1.5 1-3 2.2-1.7L8 14Z"/></svg><span>拖畫布</span></button><button id="panelToggle" class="icon-button" title="收起操作面板" aria-label="收起操作面板" aria-controls="panel" aria-expanded="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-panel"/></svg></button></div>
      <div id="canvasArea" class="canvas-area">
        <div class="scroll-strip left" role="group" aria-label="左下角捲頁把手：上下滑動可捲動頁面" title="上下滑動可捲動頁面"><svg viewBox="0 0 16 40" aria-hidden="true"><path d="m4 9 4-4 4 4M5 18h6M5 22h6m-7 9 4 4 4-4"/></svg></div>
        <div id="surface" class="surface" role="group" aria-label="電路畫布操作區" aria-describedby="canvasInstructions">
          <span id="canvasInstructions" class="sr-only">雙指拖動畫布，捏合縮放。滑鼠滾輪縮放，中鍵拖動，或按住空白鍵再拖動。觸控板按住空白鍵再雙指滑動可平移，捏合縮放。左右底角的捲頁把手可上下滑動，捲動外層頁面。</span>
          <svg id="circuitSvg" xmlns="http://www.w3.org/2000/svg" aria-label="電路圖形"><g id="scene"></g><g id="flowLayer"></g><g id="ghostLayer"></g></svg>
          <div id="hitLayer" class="hit-layer"></div><div id="canvasNotice" class="canvas-notice" hidden aria-hidden="true"></div>
          <div id="emptyHint" class="empty-hint" hidden><strong>從一個元件開始</strong><span>從工具箱取出元件和導線，拖動導線端點接好。</span></div>
        </div>
        <div class="scroll-strip right" role="group" aria-label="右下角捲頁把手：上下滑動可捲動頁面" title="上下滑動可捲動頁面"><svg viewBox="0 0 16 40" aria-hidden="true"><path d="m4 9 4-4 4 4M5 18h6M5 22h6m-7 9 4 4 4-4"/></svg></div>
        <div id="preview" class="preview" hidden aria-hidden="true"><span>接線預覽</span><button id="closePreview" type="button" aria-label="關閉刻度預覽" hidden>×</button><svg xmlns="http://www.w3.org/2000/svg"></svg></div>
      </div>
      <div class="stage-bottom"><span id="hint" role="status" aria-live="polite">雙指拖畫布、捏合縮放；桌面按住空白鍵拖動或雙指滑動。</span><div id="selectionActions" class="context-actions" hidden><span id="selectionTip">拖線身改形狀</span><button id="focusSelected" class="icon-button" title="放大所選" aria-label="放大所選" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-focus"/></svg></button><button id="straightenSelected" class="icon-button" title="拉直導線：兩端之間的最短形狀" aria-label="拉直導線：兩端之間的最短形狀" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-straight"/></svg></button><button id="detachFrom" class="icon-button socket-action" title="拔開 A 端" aria-label="拔開 A 端"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-detach"/></svg><small>A</small></button><button id="detachTo" class="icon-button socket-action" title="拔開 B 端" aria-label="拔開 B 端"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-detach"/></svg><small>B</small></button><button id="inspectMeter" class="icon-button" title="放大錶盤刻度" aria-label="放大錶盤刻度" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-meter"/></svg></button><button id="flipMeterSelected" class="icon-button" title="左右換接孔" aria-label="左右換接孔" hidden><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-flip"/></svg></button><button id="rotateCounterSelected" class="icon-button" title="逆時針旋轉 90° 並拉直所連導線（Shift+R）" aria-label="逆時針旋轉 90° 並拉直所連導線（Shift+R）" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-rotate-ccw"/></svg></button><button id="rotateSelected" class="icon-button" title="順時針旋轉 90° 並拉直所連導線（R）" aria-label="順時針旋轉 90° 並拉直所連導線（R）" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-rotate-cw"/></svg></button><button id="deleteSelected" class="icon-button" title="刪除所選" aria-label="刪除所選" ><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-trash"/></svg></button></div><div class="camera-tools"><button id="quickWire" class="take-wire">＋導線 <span>16/20</span></button><button data-camera="left" aria-label="向左查看">←</button><button data-camera="right" aria-label="向右查看">→</button><button data-camera="up" aria-label="向上查看">↑</button><button data-camera="down" aria-label="向下查看">↓</button><button data-camera="out" title="縮小" aria-label="縮小">−</button><output id="zoomReadout">100%</output><button data-camera="in" title="放大" aria-label="放大">＋</button><button id="fitView" class="icon-button" title="顯示全圖並啟用自動適應" aria-label="顯示全圖並啟用自動適應" data-camera="fit" aria-pressed="true"><svg class="ui-icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#icon-fit"/></svg></button></div></div>
    </section>
    <aside id="panel" class="panel" aria-label="操作面板">
      <section class="panel-section"><h2>元件工具箱</h2><div id="palette" class="palette"></div></section>
      <section class="panel-section cable-toolbox"><h2>導線工具箱</h2><button id="addWire" class="take-wire"><svg viewBox="0 0 80 32" aria-hidden="true"><path d="M8 16H72"/><circle cx="8" cy="16" r="4"/><circle cx="72" cy="16" r="4"/></svg><span>取出導線 <b id="wireStock">16 / 20</b></span></button><p class="note">拿端點接線，拿線身移動或彎曲。</p></section>
      <section class="panel-section inspector"><h2 id="selectionTitle">電路概覽</h2><div id="properties"></div><div id="objectActions" class="object-actions"></div></section>
      <details class="panel-section"><summary>連線清單</summary><div id="wireList"></div></details>
      <button id="panelHelp">操作說明與模型</button><p class="footnote">理想導線 · 直流穩態<br>熱效應燈為穩態教學近似</p>
    </aside>
  </div>
  <input id="fileInput" type="file" accept=".json,application/json" hidden>
  <dialog id="helpDialog"><div class="dialog-head"><h2>開始搭建電路</h2><button id="closeHelp" aria-label="關閉說明">×</button></div><ol><li>從工具箱取元件，再按「＋導線」取出一條有限長的線；畫布下方亦可取線。</li><li>取出的導線是直線。兩端懸空時，拿一個端點只移動該端，另一端固定，線保持直線；拿線身則搬動整條。拿線身時任一端靠近元件接孔或其他線端會吸附，移開便解除，放手接好。</li><li>接好一端後，拖自由端，已接的一端會固定，線形隨原有彎曲自然變動。線拉盡時會停住；可把元件移近，或用另一條線接長。</li><li>只要接好一端，便可拿線身任何位置彎曲；兩個端點保持不動，包括未接的端點。拿已接端點拉走可拔開它，亦可按「拔開 A／B」。</li><li>導線顯示在元件上方，重疊時可直接拿線。按「拿導線／拿線」可加強線身／線端的拿取優先；元件面板也可直接選其導線。</li><li>懸空、只接一端的導線都會留在畫布。幾條線的端點可共接成分支；線身交叉不會接通。</li><li>直接用雙指拖動畫布、捏合縮放，不用切換工具。亦可選「手掌／拖畫布」後用一指拖。左右底角的捲頁把手可上下滑動，捲動外層頁面。「全圖」高亮時會在移動元件後自動調整視野，顯示全電路。手動縮放、移圖或定位後會退出此模式，再按「全圖」重新啟用。「工具」高亮表示面板已展開，再按可收起。</li></ol><p>桌面：滑鼠滾輪以游標為中心縮放；按住中鍵拖動，或按住空白鍵再左鍵拖動，快速移動畫布。觸控板可按住空白鍵再雙指滑動，或選「手掌／拖畫布」後雙指滑動；捏合仍會縮放。Mac 的三指拖動配合手掌工具或空白鍵即可移圖。放開空白鍵或中鍵便返回原工具。雙指操作放開一指後，先放開餘下的手指，再繼續接線。</p><p>鍵盤：Tab 選導線端點，方向鍵搬動；操作面板可選端點的接線對象。R 順時針／Shift+R 逆時針旋轉元件，並自動拉直所連導線，Delete 刪除，Escape 取消目前拖動，Ctrl／⌘ Z 復原。</p><p>畫布預設顯示電源電壓及滑動變阻器電阻。頂欄「設定」的「畫布標籤／進階內容」可獨立勾選用電器電阻、功率及電源內阻；關閉「顯示畫布讀值與參數」便會全部隱藏數值。元件仍可選取查看及修改。</p><p>白色圓圈是導線吸附的接線位置；極性以 +／− 標記為準。</p><h3>儀表接法</h3><p>A 表串聯，V 表並聯；均接共用 − 孔與其中一個正極孔。A 表為 0.6 A／3 A，V 表為 3 V／15 V，接孔決定量程；同一指針對應兩行刻度：正側 30 小格，零點左側另有 10 小格負刻度。反接時指針向負側偏轉，超出負刻度會提示。先接大量程，確認後換小量程。選取 A／V 表按「左右換接孔」，可把共用 − 孔換到另一側，接線會跟隨原孔。A／V 指針會以慣性回擺後停定，請待穩定後讀取刻度；數字採即時電學解。在手機點一下指針錶可持續看刻度預覽，點別處或按 × 收起；搬動元件時亦會收起。亦可按「看刻度」放大錶盤。反接或超量程會提示，指針停在行程限制；數字保留實際有號讀值。不要同時接兩個正極孔。W 表的 I+／I− 串聯，V+／V− 跨接用電器；讀值為 (V+ − V−) × 電流線圈電流。反接會顯示負值。</p><h3>燈光與發熱示意</h3><p>燈泡的明暗隨實際功率相對額定功率改變。短路時電源及短路導線會顯示發熱、火花；電源或導線電流超過 5 A、電流表讀值超過所接量程的 1.5 倍、燈泡功率超過額定的 1.5 倍時亦會提示。這些是教學用的視覺門檻，未模擬真實的燃燒時間、燒毀或保險絲；改好電路後效果便消失。理想電源短路沒有有限電流解，讀值保留「—」。</p><h3>模型與參考點</h3><p>電源預設理想內阻 0 Ω，可自行調整。理想 V 表不耗電；輸入電阻欄填 0 代表無限大。電錶可自訂大量程上限，小量程為其 1/5。所設內阻是大量程等效值；小量程 A 內阻為其 5 倍，V 輸入電阻為其 1/5，屬教學近似。小量程提高每格讀值分辨率，未模擬校準誤差或儀表損壞。熱效應燈以額定點校準的溫度／散熱模型計算，不模擬預熱或燒毀。</p><p>探測工具可量兩點電壓；按所選端子的「設為 0 V」改參考。互不相連的電路沒有確定的跨區電壓。電子與常規電流會沿導線及元件內部移動；燈泡的路徑經過燈絲，再由底部接點離開。在穩態串聯電路中，流入與流出用電器的電流大小相同。示意速度隨各支路電流大小增加，經壓縮方便觀察，並非真實電子速度。電源內部的移動表示電荷傳遞，未細分電池的電化學及離子機制。理想電壓表沒有流入電流，故不顯示流動。</p><h3>直流實驗</h3><p>滑動變阻器預設四孔：A、B 為電阻絲兩端，P₁、P₂ 同接滑片；A–P 用來限流，A–B 供電再由 P 取出分壓。接上負載會改變分壓，並非固定的輸出電壓。選取變阻器後可在面板改三孔或兩孔；消失孔的線會拔開，仍留在畫布。</p><p>G 表預設內阻 100 Ω、滿偏 50 μA，中心零刻度可顯示正反電流。外接並聯分流電阻或串聯分壓電阻，可示範改裝電流表或電壓表。</p></dialog>
<dialog id="settingsDialog" aria-labelledby="settingsTitle"><div class="dialog-head"><div><h2 id="settingsTitle">工作台設定</h2><p class="note">即時套用；電路設定可復原及隨電路檔儲存。</p><p id="settingsNotice" class="settings-notice" role="status" aria-live="polite" hidden></p></div><button id="closeSettings" aria-label="關閉設定" title="關閉設定">×</button></div><div class="settings-grid">
<section class="settings-section"><h3>顯示與教學</h3>        <label>方向示意<select id="flow"><option value="current">常規電流</option><option value="electron">導線中的電子</option><option value="off">關閉</option></select></label>
        <p class="note">電流越大，示意移動越快。速度經壓縮方便觀察，非真實電子速度。</p>
        <label>儀表外觀<select id="meters"><option value="digital">數字式</option><option value="analog">指針式</option></select></label>
        <label class="check"><input type="checkbox" id="potential">顯示電勢與升高方向</label><div id="potentialLegend" hidden class="legend"><i></i><span>低電勢 → 高電勢<br>各獨立電路分別以參考端為 0 V</span></div>
        <label class="check"><input type="checkbox" id="projection">投影字體</label><label class="check"><input type="checkbox" id="pause">暫停動畫</label>
</section>
<section class="settings-section"><h3>畫布標籤</h3>        <label class="check"><input type="checkbox" id="names" checked>顯示元件名稱</label><label class="check"><input type="checkbox" id="values" checked>顯示畫布讀值與參數</label><label class="check"><input type="checkbox" id="rheostatResistance" checked>顯示滑動變阻器電阻</label>
        <details id="advancedValues"><summary>進階內容</summary><label class="check"><input id="loadResistance" type="checkbox">顯示用電器電阻</label><label class="check"><input id="loadPower" type="checkbox">顯示用電器功率</label><label class="check"><input id="sourceResistance" type="checkbox">顯示電源內阻</label></details>
</section>
<section class="settings-section"><h3>教師設定</h3>        <label>操作模式<select id="mode"><option value="free">自由搭建</option><option value="wiring">固定元件，只接線</option></select></label>
        <fieldset id="policyOptions" hidden><legend>固定模式開放項目</legend><label class="check"><input id="allowRotate" type="checkbox">旋轉元件</label><label class="check"><input id="allowParams" type="checkbox">修改所有參數</label><label class="check"><input id="allowSwitch" type="checkbox" checked>開合開關</label></fieldset>
<label>導線總數<input id="cableCount" type="number" min="1" max="240" step="1"></label><label>新導線最大長度<select id="cableLength"><option value="240">短 · 240</option><option value="400">中 · 400</option><option value="600">標準 · 600</option><option value="900">長 · 900</option><option value="1200">特長 · 1200</option></select></label><p class="note">長度以畫布單位計；縮放不會改變。設定只影響之後取出的導線。</p></section>
<section class="settings-section"><h3>文件與整理</h3><div class="stack"><button id="saveTemplate">另存固定元件模板</button><button id="exportSvg">匯出 SVG 電路圖</button><button id="autoRoute">整理全部線形</button><button id="clearWires">只移除導線</button><button id="clearAll">清空畫布</button></div></section>
</div></dialog>
<dialog id="meterDialog"><div class="dialog-head"><h2 id="meterTitle">雙量程錶盤</h2><button id="closeMeter" aria-label="關閉錶盤">×</button></div><div id="meterDetail" class="meter-detail"></div></dialog>

`;
  function build(host, profile, prefix) {
    host.classList.add('sim-app','workbench','circuit-editor');
    host.setAttribute('data-sim-fullscreen-target','');
    host.tabIndex = -1;
    const content = document.createElement('template'); content.innerHTML = template;
    const refs = {app:host};
    for (const element of content.content.querySelectorAll('[id]')) {
      const id = element.id; refs[id] = element; element.dataset.circuitId = id; element.id = prefix + id;
    }
    for (const element of content.content.querySelectorAll('*')) {
      for (const attribute of ['href','aria-controls','aria-labelledby','aria-describedby']) {
        const value=element.getAttribute(attribute); if (!value) continue;
        if (attribute==='href' && value.startsWith('#')) element.setAttribute(attribute,'#'+prefix+value.slice(1));
        else if (attribute!=='href') element.setAttribute(attribute,value.split(/\s+/).map(id=>prefix+id).join(' '));
      }
    }
    const remove = (...ids) => ids.forEach(id=>refs[id].remove());
    const ui=profile.ui, student=profile.role==='student';
    if (!ui.presets) remove('preset');
    if (!ui.files) remove('save','open','fileInput');
    if (!ui.settings) remove('settings','settingsDialog');
    if (!ui.probe) remove('probe');
    if (!ui.viewToggle) refs.realView.parentElement.remove();
    if (!ui.status) remove('circuitStatus');
    if (!profile.undo) remove('undo','redo');
    if (!ui.help) { remove('help','panelHelp','helpDialog'); content.content.querySelector('.footnote').remove(); }
    else if (student) {
      refs.helpDialog.innerHTML='<div class="dialog-head"><h2>電路操作</h2></div><p>取出導線，拖端點到白色接孔接好。接好一端後，可拿線身彎曲。雙指拖動畫布、捏合縮放；桌面可按住空白鍵拖畫布。線身交叉不會接通。</p><button type="button">關閉</button>';
      refs.closeHelp=refs.helpDialog.querySelector('button');refs.closeHelp.id=prefix+'closeHelp';refs.closeHelp.dataset.circuitId='closeHelp';
    }
    if (!ui.palette) refs.palette.closest('.panel-section').remove();
    if (!ui.inspector) refs.properties.closest('.panel-section').remove();
    if (!ui.wireList) refs.wireList.closest('.panel-section').remove();
    if (student || !profile.wires) refs.addWire.closest('.panel-section').remove();
    if (!profile.wires) remove('quickWire','pickWire','detachFrom','detachTo','straightenSelected');
    if (!ui.palette && !ui.inspector && !ui.wireList && (!ui.help || student)) {
      remove('panel','panelToggle'); host.classList.add('no-panel','panel-hidden');
    }
    const heading=content.content.querySelector('.brand h1');
    heading.replaceChildren(document.createTextNode(profile.title+' '));
    const badge=document.createElement('span'); badge.className='badge'; badge.textContent='直流'; heading.append(badge);
    content.content.querySelector('.brand p').textContent=profile.subtitle;
    host.replaceChildren(content.content);
    return refs;
  }
  root.CircuitEditorUI=Object.freeze({build});
})(window);
