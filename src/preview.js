import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import url from "node:url";

// In-memory mood entries: { mood: 'happy'|'sad', ts: number ms }
const moodEntries = [];
const WINDOW_MS = 20 * 60 * 1000; // last 20 minutes
// Active scene state (UI-selectable). Default from env or 'mood'
const DEFAULT_SCENE = (process.env.SCENE ? String(process.env.SCENE) : 'mood').toLowerCase();
let activeScene = DEFAULT_SCENE;

function addMoodLabel(label) {
	if (label !== "happy" && label !== "sad") return false;
	moodEntries.push({ mood: label, ts: Date.now() });
	return true;
}

function getMajorityMood(windowMs = WINDOW_MS) {
	const cutoff = Date.now() - windowMs;
	// prune old
	for (let i = 0; i < moodEntries.length; i++) {
		if (moodEntries[i].ts < cutoff) {
			moodEntries.splice(i, 1);
			i--;
		}
	}
	let happy = 0;
	let sad = 0;
	for (const e of moodEntries) {
		if (e.ts >= cutoff) {
			if (e.mood === "happy") happy++;
			else if (e.mood === "sad") sad++;
		}
	}
	if (happy === 0 && sad === 0) return { majority: "neutral", happy, sad };
	if (happy === sad) return { majority: "neutral", happy, sad };
	return { majority: happy > sad ? "happy" : "sad", happy, sad };
}

export { getMajorityMood };

function createHandler() {
	return (req, res) => {
        // Basic CORS for cross-origin control page on :4000
        try{
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
        }catch{}
		const parsed = url.parse(req.url, true);
		if (parsed.pathname === "/view") {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(`
      <html>
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Flipdots Preview</title>
        <style>
          /* Flipboard demo styles (scoped by #flipboard) */
          #flipboard{ --amount-of-columns:0; display:grid; grid-template-columns:repeat(var(--amount-of-columns),1fr); border:1px solid rgba(255,255,255,0.2); background:#000; padding:6px; }
          #flipboard>div{ width:10px; background-color:#000; border-radius:50%; aspect-ratio:1; transform:rotate(45deg) rotateY(180deg); backface-visibility:hidden; transition:transform 40ms ease-out, background-color 40ms ease-out; }
          #flipboard>div.on{ transform:rotate(45deg) rotateY(0deg); background-color:#fff; }
        </style>
      </head>
      <body style="margin:0;background:#fff;display:flex;flex-direction:column;gap:12px;align-items:center;justify-content:center;min-height:100vh;padding:12px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">
        <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;justify-content:center;width:100%;max-width:980px">
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <img id="frame" src="/frame.png" style="image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #ddd">
            <div style="font-size:12px;color:#666">Live flipdot frame</div>
          </div>
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <section id="flipboard"></section>
            <div style="font-size:12px;color:#666">Flipboard-style demo</div>
          </div>
        </div>
        <div id="qrWrap" style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center">
          <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
            <img id="qrImg" alt="QR to this page" style="width:180px;height:180px;border:1px solid #ddd;background:#fff" />
            <div id="qrUrl" style="font-size:12px;color:#555;max-width:360px;text-align:center;word-break:break-all"></div>
          </div>
          <div style="font-size:13px;color:#666;max-width:320px">
            Scan this QR with your phone to open this control page. Optionally, append <code>?scene=next</code> to open the "Who is next" scene automatically.
          </div>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <a href="http://localhost:4000" target="_blank" rel="noopener noreferrer" style="background:#111;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;border:1px solid #222">Open Frontend</a>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <label for="sceneSel">Scene:</label>
			<select id="sceneSel">
            <option value="mood">mood</option>
            <option value="clock">clock</option>
            <option value="demo2">demo2</option>
            <option value="tally">tally</option>
            <option value="fact">fact</option>
            <option value="next">next</option>
            <option value="anim">anim</option>
          </select>
          <span id="sceneStatus" style="color:#333;display:inline-block;min-width:120px;height:20px;line-height:20px"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <a href="/anim" target="_blank" rel="noopener noreferrer" style="background:#0b5;color:#fff;padding:6px 10px;border-radius:6px;text-decoration:none;border:1px solid #0a4">Open Animation Maker</a>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <button id="voteHappy">Happy :-)</button>
          <button id="voteSad">Sad :-(</button>
          <button id="reset">Reset</button>
          <span id="status" style="color:#333;display:inline-block;min-width:140px;height:20px;line-height:20px"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <strong>Tally Game:</strong>
          <button id="tgA">+1 Team A</button>
          <button id="tgB">+1 Team B</button>
          <button id="tgReset">Reset</button>
          <span id="tgStatus" style="color:#333;display:inline-block;min-width:160px;height:20px;line-height:20px"></span>
        </div>
			<div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <strong>Ski:</strong>
          <button id="skiJump">Jump</button>
          <button id="skiStart">Start Game</button>
          <span id="skiStatus" style="color:#333;display:inline-block;min-width:120px;height:20px;line-height:20px"></span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center">
          <strong>Who is next:</strong>
          <input id="nextInput" placeholder="Name" style="padding:4px 6px" />
          <button id="nextSet">Set</button>
          <button id="nextClear">Clear</button>
          <span id="nextStatus" style="color:#333;display:inline-block;min-width:140px;height:20px;line-height:20px"></span>
        </div>
        <div style="max-width:720px;text-align:center;color:#666;font-size:14px;line-height:1.35">
          Votes are counted over the last 20 minutes. If happy and sad are equal (or there are no votes), a neutral face is shown.
        </div>
        <div id="majority" style="color:#555;text-align:center;margin-top:4px">Current office mood (last 20 min): n/a</div>
        <script>
          function updateFrame(time) {
            document.getElementById('frame').src = '/frame.png?t=' + time;
            requestAnimationFrame(updateFrame);
          }
          requestAnimationFrame(updateFrame);
        // Flipboard demo (independent from real display)
        (function(){
          try{
            const flipboard_display_size = [84, 28]; // columns, rows
            const flipboard_dots_array = [];
            const flipboard_element = document.querySelector('#flipboard');
            if (!flipboard_element) return;
            flipboard_element.style.setProperty('--amount-of-columns', String(flipboard_display_size[0]));
            for (let c = 1; c <= flipboard_display_size[0]; c++) {
              for (let r = 1; r <= flipboard_display_size[1]; r++) {
                const dot = document.createElement('div');
                flipboard_element.appendChild(dot);
                flipboard_dots_array.push(false);
              }
            }
            const update_flipboard = () => {
              flipboard_dots_array.forEach((dot, idx) => {
                const el = flipboard_element.querySelector('div:nth-child(' + (idx + 1) + ')');
                if (!el) return;
                if (dot) el.classList.add('on'); else el.classList.remove('on');
              });
            };
            // Live mapping from backend frame bits → front flipboard
            let __prevBits = '';
            async function poll(){
              try{
                const r = await fetch('/frame.bits');
                const j = await r.json();
                if (j && j.bits && j.w && j.h){
                  if (j.bits === __prevBits) { setTimeout(poll, 120); return; }
                  // map center-cropped or scaled to 84x28; simple nearest sample
                  const W = 84, H = 28;
                  for (let y = 0; y < H; y++){
                    for (let x = 0; x < W; x++){
                      const sx = Math.floor(x * j.w / W);
                      const sy = Math.floor(y * j.h / H);
                      const sidx = sy * j.w + sx;
                      const bit = j.bits.charAt(sidx) === '1';
                      flipboard_dots_array[y * W + x] = bit;
                    }
                  }
                  __prevBits = j.bits;
                  update_flipboard();
                }
              }catch{}
              setTimeout(poll, 120);
            }
            poll();
          }catch{}
        })();
          // QR for fixed link
          (function(){
            try{
              const url = 'http://145.93.160.143:3000/view';
              const img = document.getElementById('qrImg');
              const txt = document.getElementById('qrUrl');
              if (img) img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=' + encodeURIComponent(url);
              if (txt) txt.textContent = url;
            }catch{}
          })();
			async function refreshScene(){
            try{
              const r = await fetch('/scene');
              const j = await r.json();
              const sel = document.getElementById('sceneSel');
              if (j && j.scene && sel) sel.value = j.scene;
            }catch{}
          }
          async function setScene(scene){
            try{
              const r = await fetch('/scene', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ scene }) });
              document.getElementById('sceneStatus').textContent = r.ok ? ('Scene: ' + scene) : 'Failed';
              if (r.ok) setTimeout(()=>{ const el = document.getElementById('sceneStatus'); if (el.textContent.startsWith('Scene:')) el.textContent=''; }, 1200);
            }catch{
              document.getElementById('sceneStatus').textContent = 'Failed';
            }
          }
          document.getElementById('sceneSel').addEventListener('change', (e)=> setScene(e.target.value));
          refreshScene();
          // Allow linking with ?scene=next etc.
          (function(){
            try{
              const params = new URLSearchParams(location.search);
              const sc = params.get('scene');
              if (sc) setScene(String(sc).toLowerCase());
            }catch{}
          })();

          async function refreshMajority(){
            try{
              const r = await fetch('/mood/majority');
              const j = await r.json();
              document.getElementById('majority').textContent = 'Current office mood (last 20 min): ' + (j.majority ?? 'n/a') + '  —  counts: happy ' + j.happy + ' · sad ' + j.sad;
            }catch(e){
              document.getElementById('majority').textContent = 'Current office mood (last 20 min): n/a';
            }
          }
          setInterval(refreshMajority, 1500);
          refreshMajority();

          async function vote(label){
            const res = await fetch('/mood', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({mood: label})});
            const ok = res.ok;
            document.getElementById('status').textContent = ok ? 'Vote recorded' : 'Vote failed';
            if (ok) setTimeout(()=>{ const el = document.getElementById('status'); if (el.textContent === 'Vote recorded') el.textContent = ''; }, 1500);
            refreshMajority();
          }

          async function resetVotes(){
            const res = await fetch('/mood/reset', {method:'POST'});
            const ok = res.ok;
            document.getElementById('status').textContent = ok ? 'Votes reset' : 'Reset failed';
            if (ok) setTimeout(()=>{ const el = document.getElementById('status'); if (el.textContent === 'Votes reset') el.textContent = ''; }, 1500);
            refreshMajority();
          }

          document.getElementById('voteHappy').addEventListener('click', ()=>vote('happy'));
          document.getElementById('voteSad').addEventListener('click', ()=>vote('sad'));
          document.getElementById('reset').addEventListener('click', resetVotes);

          async function tgAdd(team){
            const res = await fetch('/tallygame/add', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ team })});
            document.getElementById('tgStatus').textContent = res.ok ? ('Added to Team ' + team) : 'Failed';
            if (res.ok) setTimeout(()=>{ const el = document.getElementById('tgStatus'); if (el.textContent.startsWith('Added')) el.textContent=''; }, 1200);
          }
          async function tgReset(){
            const res = await fetch('/tallygame/reset', {method:'POST'});
            document.getElementById('tgStatus').textContent = res.ok ? 'Game reset' : 'Failed';
            if (res.ok) setTimeout(()=>{ const el = document.getElementById('tgStatus'); if (el.textContent==='Game reset') el.textContent=''; }, 1200);
          }
          document.getElementById('tgA').addEventListener('click', ()=>tgAdd('A'));
          document.getElementById('tgB').addEventListener('click', ()=>tgAdd('B'));
          document.getElementById('tgReset').addEventListener('click', tgReset);

          async function skiJump(){
            try{
              const r = await fetch('/ski/jump', {method:'POST'});
              document.getElementById('skiStatus').textContent = r.ok ? 'Jump!' : 'Failed';
              if (r.ok) setTimeout(()=>{ const el = document.getElementById('skiStatus'); if (el.textContent==='Jump!') el.textContent=''; }, 600);
            }catch{ document.getElementById('skiStatus').textContent = 'Failed'; }
          }
          async function skiStart(){
            try{
              await fetch('/ski/start', {method:'POST'});
              document.getElementById('skiStatus').textContent = 'Game started';
              setTimeout(()=>{ const el = document.getElementById('skiStatus'); if (el.textContent==='Game started') el.textContent=''; }, 800);
            }catch{}
          }
          document.getElementById('skiJump').addEventListener('click', skiJump);
          document.getElementById('skiStart').addEventListener('click', skiStart);
          // Spacebar triggers jump
          window.addEventListener('keydown', (e)=>{
            if (e.code === 'Space' || e.key === ' ') { e.preventDefault(); skiJump(); }
          });
          // Keep Start button enabled/disabled based on started flag
          async function syncSkiUI(){
            try{
              const r = await fetch('/ski');
              const j = await r.json();
              const btn = document.getElementById('skiStart');
              if (btn) btn.disabled = !!j.started;
            }catch{}
          }
          setInterval(syncSkiUI, 600);
          syncSkiUI();

          // Who is next UI
          async function nextGet(){
            try{ const r = await fetch('/next'); const j = await r.json(); return j && j.name ? String(j.name) : ''; }catch{ return ''; }
          }
          async function nextSet(name){
            try{
              const r = await fetch('/next', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) });
              const ok = r.ok; document.getElementById('nextStatus').textContent = ok ? ('Next: ' + name) : 'Failed';
              if (ok) setTimeout(()=>{ const el = document.getElementById('nextStatus'); if (el.textContent.startsWith('Next:')) el.textContent=''; }, 1200);
            }catch{ document.getElementById('nextStatus').textContent = 'Failed'; }
          }
          async function nextClear(){
            try{
              const r = await fetch('/next/clear', { method:'POST' });
              document.getElementById('nextStatus').textContent = r.ok ? 'Cleared' : 'Failed';
              if (r.ok) setTimeout(()=>{ const el = document.getElementById('nextStatus'); if (el.textContent==='Cleared') el.textContent=''; }, 1000);
            }catch{ document.getElementById('nextStatus').textContent = 'Failed'; }
          }
          document.getElementById('nextSet').addEventListener('click', async ()=>{
            const v = String(document.getElementById('nextInput').value || '').trim();
            if (v) nextSet(v);
          });
          document.getElementById('nextClear').addEventListener('click', nextClear);
          // Prefill current name
          nextGet().then(n=>{ const el = document.getElementById('nextInput'); if (el && n) el.value = n; });
        </script>
      </body></html>
    `);
		} else if (parsed.pathname === "/frame.png") {
            const buf = globalThis.__framePNG;
            if (buf && buf.length) {
                res.writeHead(200, { "Content-Type": "image/png", "Cache-Control": "no-store" });
                res.end(buf);
            } else {
                res.writeHead(200, { "Content-Type": "image/png" });
                res.end(fs.readFileSync("./output/frame.png"));
            }
        } else if (parsed.pathname === "/frame.bits") {
            const bm = globalThis.__frameBitmap;
            if (!bm || !bm.bits) { res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ w:0, h:0, bits:'' })); return; }
            res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
            res.end(JSON.stringify({ w: Number(bm.w)||0, h: Number(bm.h)||0, bits: String(bm.bits||'') }));
		} else if (parsed.pathname === "/scene" && req.method === "GET") {
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ scene: activeScene }));
		} else if (parsed.pathname === "/scene" && req.method === "POST") {
			let body = "";
			req.on("data", chunk => body += chunk);
			req.on("end", () => {
				try {
					const data = JSON.parse(body || "{}");
					const scene = String((data.scene || '')).toLowerCase();
                    if (scene === 'mood' || scene === 'clock' || scene === 'demo2' || scene === 'tally' || scene === 'fact' || scene === 'next' || scene === 'anim') {
						activeScene = scene;
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: true, scene: activeScene }));
					} else {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok: false }));
					}
				} catch {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false }));
				}
			});
        } else if (parsed.pathname === "/anim" && req.method === "GET") {
			res.writeHead(200, { "Content-Type": "text/html" });
			res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Animation Maker</title>
    <style>
      body{ font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f7f7f7; margin:0; padding:16px; }
      .wrap{ display:flex; gap:16px; align-items:flex-start; flex-wrap:wrap; }
      .tools{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; }
      .grid{ display:grid; grid-auto-rows:12px; gap:2px; background:#111; padding:6px; }
      .cell{ width:12px; height:12px; background:#000; border-radius:2px; cursor:pointer; }
      .cell.on{ background:#fff; }
      /* Preview for line/shape tools */
      .cell.preview{ outline:2px dotted #0af; outline-offset:-2px; z-index:10; }
      /* Onion skin ghosting */
      .cell.prev:not(.on){ background:#333; }
      .cell.next:not(.on){ background:#666; }
      .timeline{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin-top:8px; }
      .frameThumb{ display:grid; grid-template-columns: repeat(var(--w), 2px); grid-auto-rows:2px; gap:1px; padding:3px; background:#111; border:1px solid #333; cursor:pointer; }
      .frameThumb .p{ width:2px; height:2px; background:#000; }
      .frameThumb .p.on{ background:#fff; }
      .badge{ font-size:11px; color:#555; }
      input[type=number]{ width:90px; }
      button{ padding:6px 10px; }
      .seg{ display:inline-flex; background:#e8e8e8; border-radius:6px; overflow:hidden; }
      .seg>button{ padding:6px 10px; border:0; background:transparent; }
      .seg>button.active{ background:#0b5; color:#fff; }
      .range{ display:inline-flex; align-items:center; gap:6px; }
      input[type=range]{ width:120px; }
      .cell.selecting{ outline:2px dashed #0af; outline-offset:-1px; }
      .selection-box{ position:absolute; border:2px dashed #0af; background:rgba(0,170,255,0.1); pointer-events:none; z-index:100; }
      .toolbar-section{ display:flex; gap:8px; align-items:center; flex-wrap:wrap; padding:8px 12px; background:#fff; border-radius:8px; border:1px solid #ddd; }
      .toolbar-section h3{ margin:0; font-size:13px; font-weight:600; color:#333; min-width:100%; }
      .main-layout{ display:grid; grid-template-columns: 1fr auto; gap:20px; margin-top:16px; }
      .canvas-area{ display:flex; flex-direction:column; gap:12px; }
      .sidebar{ min-width:280px; max-width:280px; display:flex; flex-direction:column; gap:12px; }
    </style>
  </head>
  <body>
    <h2 style="margin:0 0 16px">Animation Maker</h2>
    
    <!-- Top Controls -->
    <div style="display:flex; gap:12px; flex-wrap:wrap; margin-bottom:12px">
      <!-- Animation Management -->
      <div class="toolbar-section" style="flex:1; min-width:400px">
        <h3>Animation</h3>
        <select id="animSel" style="flex:1; min-width:140px"></select>
        <input id="animName" placeholder="Animation name" style="padding:6px 8px; flex:1; min-width:140px" />
        <button id="animNew">+ New</button>
        <button id="animSaveAs">Save As</button>
        <button id="save">💾 Save</button>
        <button id="export" style="background:#0b5;color:white;border:1px solid #0a4">� Export</button>
        <button id="animSetActive" style="background:#0af;color:white;border:1px solid #09e">✓ Set Active</button>
        <button id="animDelete" style="background:#c92a2a;color:white;border:1px solid #a61e1e">🗑️ Delete</button>
      </div>
      
      <!-- Playback Controls -->
      <div class="toolbar-section">
        <h3>Playback</h3>
        <button id="play">▶ Play</button>
        <button id="stop">■ Stop</button>
        <span class="range">
          <label for="playSpeed">Speed</label>
          <input id="playSpeed" type="range" min="10" max="200" value="100" />
          <span id="speedLabel" style="min-width:45px">100%</span>
        </span>
        <a href="/view?scene=anim" target="_blank" style="padding:6px 10px; background:#333; color:#fff; text-decoration:none; border-radius:4px">👁 Preview</a>
      </div>
    </div>

    <!-- Main Layout -->
    <div class="main-layout">
      <!-- Left: Canvas and Timeline -->
      <div class="canvas-area">
        <!-- Drawing Tools -->
        <div class="toolbar-section">
          <h3>Drawing Tools</h3>
          <span class="seg">
            <button id="modePaint" class="active" type="button">✏️ Paint</button>
            <button id="modeErase" type="button">🧹 Erase</button>
            <button id="modeSpray" type="button">💨 Spray</button>
            <button id="modeFill" type="button">🪣 Fill</button>
            <button id="modeLine" type="button">📏 Line</button>
            <button id="modeRect" type="button">▭ Rectangle</button>
            <button id="modeCircle" type="button">⭕ Circle</button>
            <button id="modeSelect" type="button">⬚ Select</button>
          </span>
          <button id="undo" title="Undo (Ctrl+Z)">↶ Undo</button>
          <button id="redo" title="Redo (Ctrl+Y)">↷ Redo</button>
          <span class="range" id="brushSizeControl">
            <label for="brushSize">Size</label>
            <input id="brushSize" type="range" min="1" max="8" value="1" />
          </span>
          <span class="seg" id="brushShapeControl">
            <button id="brushCircle" class="active" type="button">⬤ Circle</button>
            <button id="brushSquare" type="button">⬛ Square</button>
            <button id="brushTriangle" type="button">▲ Triangle</button>
            <button id="brushCustom" type="button">✨ Custom</button>
          </span>
          <label id="fillToggle" style="display:none">
            <input id="fillShapes" type="checkbox" />
            Fill shapes
          </label>
          <label>
            <input id="pixelPerfect" type="checkbox" />
            Pixel Perfect
          </label>
          <select id="customBrushSel" style="min-width:140px;display:none">
            <option value="">Select custom brush...</option>
          </select>
          <button id="saveSelection" style="display:none;background:#f90;color:white;border:1px solid #e80">💾 Save as Brush</button>
          <button id="moveSelection" style="display:none;background:#09e;color:white;border:1px solid #07c">🔄 Move</button>
          <button id="copySelection" style="display:none;background:#0b5;color:white;border:1px solid #0a4">📋 Copy</button>
          <button id="flipHSelection" style="display:none;background:#6c5ce7;color:white;border:1px solid #5b4dd6">↔️ Flip H</button>
          <button id="flipVSelection" style="display:none;background:#6c5ce7;color:white;border:1px solid #5b4dd6">↕️ Flip V</button>
          <button id="rotate90Selection" style="display:none;background:#a29bfe;color:white;border:1px solid #8b84eb">↻ Rotate 90°</button>
          <button id="clearSelectionBtn" style="display:none;background:#888;color:white;border:1px solid #666">✕ Clear</button>
        </div>

        <!-- Canvas -->
        <div style="display:flex; gap:12px; align-items:flex-start">
          <div id="grid" class="grid"></div>
          <span class="badge" id="sizeBadge" style="color:#666"></span>
        </div>

        <!-- Frame Controls -->
        <div class="toolbar-section">
          <h3>Frame Controls</h3>
          <button id="addFrame">+ Add Frame</button>
          <button id="dupFrame">📋 Duplicate</button>
          <button id="delFrame" style="background:#ff6b6b;color:white;border:1px solid #e63946">🗑️ Delete</button>
          <label style="display:inline-flex; gap:6px; align-items:center">
            Duration (ms)
            <input id="dur" type="number" min="10" step="10" value="300" style="width:80px; padding:4px 6px" />
          </label>
        </div>

        <!-- Timeline -->
        <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd">
          <h3 style="margin:0 0 8px; font-size:13px; font-weight:600; color:#333">Timeline</h3>
          <div class="timeline" id="timeline"></div>
        </div>

        <!-- Advanced Options -->
        <details style="background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd">
          <summary style="cursor:pointer; font-weight:600; color:#333; margin-bottom:8px">Advanced Options</summary>
          <div style="display:flex; flex-direction:column; gap:12px; margin-top:12px">
            <!-- Onion Skin -->
            <div style="padding:8px; background:#efe; border-radius:6px; border:1px solid #cfc">
              <strong style="font-size:12px; display:block; margin-bottom:6px">🧅 Onion Skinning</strong>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
                <label style="display:inline-flex; gap:4px; align-items:center">
                  <input id="onionEnable" type="checkbox" />
                  Enable
                </label>
                <label style="display:inline-flex; gap:4px; align-items:center">
                  Prev frames
                  <input id="onionPrev" type="number" min="0" max="2" value="1" style="width:50px; padding:4px" />
                </label>
                <label style="display:inline-flex; gap:4px; align-items:center">
                  Next frames
                  <input id="onionNext" type="number" min="0" max="2" value="0" style="width:50px; padding:4px" />
                </label>
              </div>
            </div>

            <!-- Text Overlay -->
            <div style="padding:8px; background:#eef; border-radius:6px; border:1px solid #cde">
              <strong style="font-size:12px; display:block; margin-bottom:6px">📝 Text Overlay Feed</strong>
              <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap">
                <input id="textUrl" placeholder="https://... (text or JSON)" style="padding:4px 6px; flex:1; min-width:200px" />
                <label style="display:inline-flex; gap:4px; align-items:center">
                  Field
                  <input id="textField" placeholder="message" style="padding:4px 6px; width:100px" />
                </label>
                <label style="display:inline-flex; gap:4px; align-items:center">
                  Interval (ms)
                  <input id="textInt" type="number" min="1000" step="500" value="30000" style="width:90px; padding:4px" />
                </label>
                <label style="display:inline-flex; gap:4px; align-items:center">
                  <input id="textEnable" type="checkbox" />
                  Enable
                </label>
                <button id="textSave">Save</button>
              </div>
            </div>
          </div>
        </details>
      </div>

      <!-- Right Sidebar: Animation List -->
      <div class="sidebar">
        <div style="background:#fff; padding:12px; border-radius:8px; border:1px solid #ddd; height:100%">
          <h3 style="margin:0 0 12px; font-size:14px; font-weight:600; color:#333">📁 Your Animations</h3>
          <div id="animList" style="display:flex; flex-direction:column; gap:6px; max-height:calc(100vh - 200px); overflow:auto"></div>
        </div>
      </div>
    </div>
    
    <script>
      let W = 84, H = 28;
      async function getLiveSize(){ try{ const r = await fetch('/frame.bits'); const j = await r.json(); if (j && j.w && j.h){ W=j.w; H=j.h; } }catch{} }
      const grid = document.getElementById('grid');
      const tl = document.getElementById('timeline');
      const durEl = document.getElementById('dur');
      const sizeBadge = document.getElementById('sizeBadge');
      const brushSizeEl = document.getElementById('brushSize');
      const modePaintBtn = document.getElementById('modePaint');
      const modeEraseBtn = document.getElementById('modeErase');
      const modeSprayBtn = document.getElementById('modeSpray');
      const modeFillBtn = document.getElementById('modeFill');
      const modeLineBtn = document.getElementById('modeLine');
      const modeRectBtn = document.getElementById('modeRect');
      const modeCircleBtn = document.getElementById('modeCircle');
      const brushCircleBtn = document.getElementById('brushCircle');
      const brushSquareBtn = document.getElementById('brushSquare');
      const brushTriangleBtn = document.getElementById('brushTriangle');
      const brushCustomBtn = document.getElementById('brushCustom');
      const customBrushSel = document.getElementById('customBrushSel');
      const saveSelectionBtn = document.getElementById('saveSelection');
      const moveSelectionBtn = document.getElementById('moveSelection');
      const copySelectionBtn = document.getElementById('copySelection');
      const flipHSelectionBtn = document.getElementById('flipHSelection');
      const flipVSelectionBtn = document.getElementById('flipVSelection');
      const rotate90SelectionBtn = document.getElementById('rotate90Selection');
      const clearSelectionBtn = document.getElementById('clearSelectionBtn');
      const modeSelectBtn = document.getElementById('modeSelect');
      const fillToggle = document.getElementById('fillToggle');
      const fillShapesEl = document.getElementById('fillShapes');
      const brushSizeControl = document.getElementById('brushSizeControl');
      const brushShapeControl = document.getElementById('brushShapeControl');
      const playSpeedEl = document.getElementById('playSpeed');
      const speedLabelEl = document.getElementById('speedLabel');
      const animListEl = document.getElementById('animList');
      const onionEnableEl = document.getElementById('onionEnable');
      const onionPrevEl = document.getElementById('onionPrev');
      const onionNextEl = document.getElementById('onionNext');
      const textUrlEl = document.getElementById('textUrl');
      const textFieldEl = document.getElementById('textField');
      const textIntEl = document.getElementById('textInt');
      const textEnableEl = document.getElementById('textEnable');
      const textSaveBtn = document.getElementById('textSave');
      const animSel = document.getElementById('animSel');
      const animNameInput = document.getElementById('animName');
      const pixelPerfectEl = document.getElementById('pixelPerfect');
      const undoBtn = document.getElementById('undo');
      const redoBtn = document.getElementById('redo');
      let frames = [];
      let idx = 0;
      let playing = false;
      let playSpeed = 100; // percentage
      let isMouseDown = false;
      let brushSize = 1; // radius in pixels
      let brushMode = 'paint'; // 'paint' | 'erase' | 'spray' | 'select' | 'fill' | 'line' | 'rect' | 'circle'
      let brushShape = 'circle'; // 'circle' | 'square' | 'triangle' | 'custom'
      let currentName = '';
      let textMeta = { enable:false, url:'', field:'', intervalMs:30000 };
      let onionEnabled = false;
      let onionPrev = 1;
      let onionNext = 0;
      let customBrushes = {}; // { name: { w, h, pattern: [] } }
      let currentCustomBrush = null;
      let selection = { active: false, startX: 0, startY: 0, endX: 0, endY: 0, copied: null, moving: false };
      let selectionBox = null;
      let lineStart = null;
      let shapeStart = null;
      let tempOverlay = null;
      let fillShapes = false;
      let pixelPerfect = false;
      let lastDrawnPixel = null; // For pixel perfect mode
      let drawnPixelsThisStroke = new Set(); // Track pixels drawn in current stroke
      let sprayTimer = null; // For spray tool continuous painting
      let sprayDensity = 0.3; // Probability of painting each pixel in spray radius (0-1)
      
      // Undo/Redo system
      let undoStack = [];
      let redoStack = [];
      const MAX_UNDO_STATES = 50;
      
      function saveUndoState() {
        // Save current frame state to undo stack
        const currentFrame = frames[idx];
        if (!currentFrame) return;
        
        undoStack.push({
          frameIdx: idx,
          arr: currentFrame.arr.slice() // Copy array
        });
        
        // Limit stack size
        if (undoStack.length > MAX_UNDO_STATES) {
          undoStack.shift();
        }
        
        // Clear redo stack when new action is performed
        redoStack = [];
        updateUndoRedoButtons();
      }
      
      function undo() {
        if (undoStack.length === 0) return;
        
        // Save current state to redo stack before undoing
        const currentFrame = frames[idx];
        if (currentFrame) {
          redoStack.push({
            frameIdx: idx,
            arr: currentFrame.arr.slice()
          });
        }
        
        // Pop from undo stack and restore
        const state = undoStack.pop();
        idx = state.frameIdx;
        frames[idx].arr = state.arr.slice();
        
        renderGrid();
        renderTimeline();
        updateUndoRedoButtons();
      }
      
      function redo() {
        if (redoStack.length === 0) return;
        
        // Save current state to undo stack before redoing
        const currentFrame = frames[idx];
        if (currentFrame) {
          undoStack.push({
            frameIdx: idx,
            arr: currentFrame.arr.slice()
          });
        }
        
        // Pop from redo stack and restore
        const state = redoStack.pop();
        idx = state.frameIdx;
        frames[idx].arr = state.arr.slice();
        
        renderGrid();
        renderTimeline();
        updateUndoRedoButtons();
      }
      
      function updateUndoRedoButtons() {
        if (undoBtn) undoBtn.disabled = undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
      }
      
      function bitsOf(arr){ return arr.map(v=>v?'1':'0').join(''); }
      function arrOf(bits){ const arr = new Array(W*H).fill(false); for(let i=0;i<arr.length && i<bits.length;i++){ arr[i] = bits.charAt(i)==='1'; } return arr; }
      
      // Apply brush with pixel perfect algorithm (like Aseprite)
      function applyBrushAt(index, forceApply = false){
        if (brushMode === 'select') return; // Don't paint in select mode
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const cx = index % W;
        const cy = Math.floor(index / W);
        
        // Pixel perfect mode: skip if we've already drawn at this position in this stroke
        if (pixelPerfect && !forceApply) {
          const key = cx + ',' + cy;
          if (drawnPixelsThisStroke.has(key)) {
            return;
          }
          
          // If we have a last pixel, draw a line between them to avoid gaps
          if (lastDrawnPixel !== null) {
            const dx = Math.abs(cx - lastDrawnPixel.x);
            const dy = Math.abs(cy - lastDrawnPixel.y);
            
            // Only connect if the distance is more than 1 pixel (to fill gaps)
            if (dx > 1 || dy > 1) {
              // Draw line between last and current pixel
              const steps = Math.max(dx, dy);
              for (let i = 1; i < steps; i++) {
                const t = i / steps;
                const ix = Math.round(lastDrawnPixel.x + (cx - lastDrawnPixel.x) * t);
                const iy = Math.round(lastDrawnPixel.y + (cy - lastDrawnPixel.y) * t);
                const ikey = ix + ',' + iy;
                if (!drawnPixelsThisStroke.has(ikey)) {
                  applyBrushAtPosition(ix, iy, arr);
                  drawnPixelsThisStroke.add(ikey);
                }
              }
            }
          }
          
          drawnPixelsThisStroke.add(key);
          lastDrawnPixel = { x: cx, y: cy };
        }
        
        applyBrushAtPosition(cx, cy, arr);
      }
      
      // Helper function to actually apply the brush at a position
      function applyBrushAtPosition(cx, cy, arr) {
        if (brushShape === 'custom' && currentCustomBrush) {
          const b = customBrushes[currentCustomBrush];
          if (!b) return;
          const offsetX = Math.floor(b.w / 2);
          const offsetY = Math.floor(b.h / 2);
          for (let by = 0; by < b.h; by++) {
            for (let bx = 0; bx < b.w; bx++) {
              const nx = cx - offsetX + bx;
              const ny = cy - offsetY + by;
              if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
              const pi = ny * W + nx;
              const brushPixel = b.pattern[by * b.w + bx];
              if (brushPixel) {
                arr[pi] = (brushMode === 'paint');
                const el = grid.children[pi];
                if (el) el.classList.toggle('on', arr[pi]);
              }
            }
          }
          return;
        }
        
        const r = Math.max(0, brushSize - 1);
        for (let dy = -r; dy <= r; dy++){
          for (let dx = -r; dx <= r; dx++){
            const nx = cx + dx; const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            let inside = false;
            if (brushShape === 'circle') {
              inside = (dx*dx + dy*dy) <= r*r;
            } else if (brushShape === 'square') {
              inside = Math.abs(dx) <= r && Math.abs(dy) <= r;
            } else if (brushShape === 'triangle') {
              // Isosceles triangle pointing up, apex at cy - r, base at cy + r
              const yPrime = dy + r; // 0..2r inside vertical span
              if (yPrime >= 0 && yPrime <= 2*r) {
                const halfWidth = Math.floor((yPrime / Math.max(1, 2*r)) * r);
                inside = Math.abs(dx) <= halfWidth;
              }
            }
            if (!inside) continue;
            const pi = ny * W + nx;
            arr[pi] = (brushMode === 'paint');
            const el = grid.children[pi];
            if (el) el.classList.toggle('on', arr[pi]);
          }
        }
      }
      
      // Apply spray at position (random scattered pixels)
      function applySprayAt(index) {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const cx = index % W;
        const cy = Math.floor(index / W);
        
        const r = Math.max(1, brushSize);
        const sprayRadius = r * 2; // Spray has wider radius
        
        // Spray random pixels within radius
        for (let dy = -sprayRadius; dy <= sprayRadius; dy++) {
          for (let dx = -sprayRadius; dx <= sprayRadius; dx++) {
            const nx = cx + dx;
            const ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            
            // Check if within circular spray area
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > sprayRadius) continue;
            
            // Random chance to paint this pixel (higher chance near center)
            const centerFactor = 1 - (dist / sprayRadius);
            const probability = sprayDensity * centerFactor;
            
            if (Math.random() < probability) {
              const pi = ny * W + nx;
              arr[pi] = true; // Spray always paints (doesn't erase)
              const el = grid.children[pi];
              if (el) el.classList.toggle('on', true);
            }
          }
        }
      }
      
      // Flood fill algorithm
      function floodFill(startX, startY) {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const startIdx = startY * W + startX;
        const targetColor = arr[startIdx];
        const fillColor = !targetColor; // Fill with opposite color (toggle)
        
        const stack = [[startX, startY]];
        const visited = new Set();
        
        while (stack.length > 0) {
          const [x, y] = stack.pop();
          const key = y * W + x;
          
          if (x < 0 || y < 0 || x >= W || y >= H) continue;
          if (visited.has(key)) continue;
          if (arr[key] !== targetColor) continue;
          
          visited.add(key);
          arr[key] = fillColor;
          const el = grid.children[key];
          if (el) el.classList.toggle('on', fillColor);
          
          stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }
      }
      
      // Draw line using Bresenham's algorithm
      function drawLine(x0, y0, x1, y1, commit = true) {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const points = [];
        const dx = Math.abs(x1 - x0);
        const dy = Math.abs(y1 - y0);
        const sx = x0 < x1 ? 1 : -1;
        const sy = y0 < y1 ? 1 : -1;
        let err = dx - dy;
        
        let x = x0, y = y0;
        while (true) {
          if (x >= 0 && y >= 0 && x < W && y < H) {
            points.push([x, y]);
            if (commit) {
              const idx = y * W + x;
              arr[idx] = brushMode !== 'erase';
              const el = grid.children[idx];
              if (el) el.classList.toggle('on', arr[idx]);
            } else {
              // Preview mode - add dotted class
              const idx = y * W + x;
              const el = grid.children[idx];
              if (el) el.classList.add('preview');
            }
          }
          
          if (x === x1 && y === y1) break;
          const e2 = 2 * err;
          if (e2 > -dy) { err -= dy; x += sx; }
          if (e2 < dx) { err += dx; y += sy; }
        }
        return points;
      }
      
      // Draw rectangle
      function drawRect(x0, y0, x1, y1, filled, commit = true) {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const minX = Math.max(0, Math.min(x0, x1));
        const maxX = Math.min(W - 1, Math.max(x0, x1));
        const minY = Math.max(0, Math.min(y0, y1));
        const maxY = Math.min(H - 1, Math.max(y0, y1));
        const points = [];
        
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const isEdge = x === minX || x === maxX || y === minY || y === maxY;
            if (filled || isEdge) {
              points.push([x, y]);
              if (commit) {
                const idx = y * W + x;
                arr[idx] = brushMode !== 'erase';
                const el = grid.children[idx];
                if (el) el.classList.toggle('on', arr[idx]);
              } else {
                // Preview mode - add dotted class
                const idx = y * W + x;
                const el = grid.children[idx];
                if (el) el.classList.add('preview');
              }
            }
          }
        }
        return points;
      }
      
      // Draw circle using midpoint circle algorithm
      function drawCircle(cx, cy, radius, filled, commit = true) {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const points = [];
        
        function plotPoint(x, y) {
          if (x >= 0 && y >= 0 && x < W && y < H) {
            points.push([x, y]);
            if (commit) {
              const idx = y * W + x;
              arr[idx] = brushMode !== 'erase';
              const el = grid.children[idx];
              if (el) el.classList.toggle('on', arr[idx]);
            } else {
              // Preview mode - add dotted class
              const idx = y * W + x;
              const el = grid.children[idx];
              if (el) el.classList.add('preview');
            }
          }
        }
        
        if (filled) {
          for (let y = -radius; y <= radius; y++) {
            for (let x = -radius; x <= radius; x++) {
              if (x * x + y * y <= radius * radius) {
                plotPoint(cx + x, cy + y);
              }
            }
          }
        } else {
          let x = 0, y = radius;
          let d = 1 - radius;
          
          const drawOctants = (px, py) => {
            plotPoint(cx + px, cy + py);
            plotPoint(cx - px, cy + py);
            plotPoint(cx + px, cy - py);
            plotPoint(cx - px, cy - py);
            plotPoint(cx + py, cy + px);
            plotPoint(cx - py, cy + px);
            plotPoint(cx + py, cy - px);
            plotPoint(cx - py, cy - px);
          };
          
          drawOctants(x, y);
          while (x < y) {
            x++;
            if (d < 0) {
              d += 2 * x + 1;
            } else {
              y--;
              d += 2 * (x - y) + 1;
            }
            drawOctants(x, y);
          }
        }
        return points;
      }
      
      function renderGrid(){
        grid.style.gridTemplateColumns = 'repeat(' + W + ',12px)';
        grid.style.position = 'relative';
        grid.innerHTML = '';
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        for(let i=0;i<W*H;i++){
          const d = document.createElement('div'); d.className = 'cell' + (arr[i]?' on':''); d.dataset.idx = String(i);
          grid.appendChild(d);
        }
        
        // Add transparent overlay to handle mouse events over gaps
        const overlay = document.createElement('div');
        overlay.style.position = 'absolute';
        overlay.style.top = '0';
        overlay.style.left = '0';
        overlay.style.width = '100%';
        overlay.style.height = '100%';
        overlay.style.pointerEvents = 'all';
        overlay.style.background = 'transparent';
        overlay.style.cursor = brushMode === 'select' ? 'crosshair' : 'default';
        
        const cellSize = 12;
        const gap = 2;
        
        function getCellFromPosition(clientX, clientY) {
          const rect = grid.getBoundingClientRect();
          const x = clientX - rect.left - 6; // 6px padding
          const y = clientY - rect.top - 6;
          const cellX = Math.floor(x / (cellSize + gap));
          const cellY = Math.floor(y / (cellSize + gap));
          if (cellX < 0 || cellY < 0 || cellX >= W || cellY >= H) return -1;
          return cellY * W + cellX;
        }
        
        overlay.onmousedown = (e) => {
          e.preventDefault();
          isMouseDown = true;
          
          // Reset pixel perfect tracking for new stroke
          drawnPixelsThisStroke.clear();
          lastDrawnPixel = null;
          
          const i = getCellFromPosition(e.clientX, e.clientY);
          if (i < 0) return;
          const x = i % W;
          const y = Math.floor(i / W);
          
          if (brushMode === 'select') {
            if (selection.moving && selection.copied) {
              // Check if clicking inside selection to start drag
              const minX = Math.min(selection.startX, selection.endX);
              const maxX = Math.max(selection.startX, selection.endX);
              const minY = Math.min(selection.startY, selection.endY);
              const maxY = Math.max(selection.startY, selection.endY);
              if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
                selection.dragOffsetX = x - minX;
                selection.dragOffsetY = y - minY;
                selection.dragging = true;
                saveUndoState(); // Save before starting to drag/move
                return;
              }
            }
            selection.active = true;
            selection.startX = x;
            selection.startY = y;
            selection.endX = x;
            selection.endY = y;
            selection.moving = false;
            selection.dragging = false;
            createSelectionBox();
          } else if (brushMode === 'fill') {
            saveUndoState(); // Save before fill
            floodFill(x, y);
          } else if (brushMode === 'spray') {
            saveUndoState(); // Save before spray stroke
            applySprayAt(i);
            // Start continuous spray timer
            sprayTimer = setInterval(() => {
              const i = getCellFromPosition(e.clientX, e.clientY);
              if (i >= 0) applySprayAt(i);
            }, 50); // Spray every 50ms while held down
          } else if (brushMode === 'line') {
            saveUndoState(); // Save before starting line
            lineStart = { x, y };
          } else if (brushMode === 'rect' || brushMode === 'circle') {
            saveUndoState(); // Save before starting shape
            shapeStart = { x, y };
          } else {
            saveUndoState(); // Save before paint/erase stroke
            applyBrushAt(i);
          }
        };
        
        overlay.onmousemove = (e) => {
          if (!isMouseDown) return;
          const i = getCellFromPosition(e.clientX, e.clientY);
          if (i < 0) return;
          const x = i % W;
          const y = Math.floor(i / W);
          
          if (brushMode === 'select') {
            if (selection.dragging && selection.copied) {
              // Calculate new position
              const newMinX = x - selection.dragOffsetX;
              const newMinY = y - selection.dragOffsetY;
              const w = selection.copied.w;
              const h = selection.copied.h;
              
              // Clear entire canvas to blank
              const arr = frames[idx]?.arr || new Array(W*H).fill(false);
              for (let i = 0; i < arr.length; i++) {
                arr[i] = false;
                const el = grid.children[i];
                if (el) el.classList.toggle('on', false);
              }
              
              // Draw selection at new position
              for (let py = 0; py < h; py++) {
                for (let px = 0; px < w; px++) {
                  const destX = newMinX + px;
                  const destY = newMinY + py;
                  if (destX >= 0 && destY >= 0 && destX < W && destY < H) {
                    const srcIdx = py * w + px;
                    const destIdx = destY * W + destX;
                    arr[destIdx] = selection.copied.pattern[srcIdx];
                    const el = grid.children[destIdx];
                    if (el) el.classList.toggle('on', arr[destIdx]);
                  }
                }
              }
              
              selection.startX = newMinX;
              selection.startY = newMinY;
              selection.endX = newMinX + w - 1;
              selection.endY = newMinY + h - 1;
              updateSelectionBox();
            } else {
              selection.endX = x;
              selection.endY = y;
              updateSelectionBox();
            }
          } else if (brushMode === 'line' && lineStart) {
            if (!tempOverlay) storeTempOverlay(); // Store once at start
            clearTempOverlay(); // Clear previous preview
            drawLine(lineStart.x, lineStart.y, x, y, false); // Draw new preview
          } else if (brushMode === 'rect' && shapeStart) {
            if (!tempOverlay) storeTempOverlay(); // Store once at start
            clearTempOverlay(); // Clear previous preview
            drawRect(shapeStart.x, shapeStart.y, x, y, fillShapes, false); // Draw new preview
          } else if (brushMode === 'circle' && shapeStart) {
            if (!tempOverlay) storeTempOverlay(); // Store once at start
            clearTempOverlay(); // Clear previous preview
            const radius = Math.round(Math.sqrt(Math.pow(x - shapeStart.x, 2) + Math.pow(y - shapeStart.y, 2)));
            drawCircle(shapeStart.x, shapeStart.y, radius, fillShapes, false); // Draw new preview
          } else if (brushMode === 'spray') {
            applySprayAt(i); // Apply spray on mouse move
          } else if (brushMode === 'paint' || brushMode === 'erase') {
            applyBrushAt(i);
          }
        };
        
        grid.appendChild(overlay);
        sizeBadge.textContent = W + '×' + H;
        updateOnionSkins();
      }
      function createSelectionBox(){
        if (!selectionBox) {
          selectionBox = document.createElement('div');
          selectionBox.className = 'selection-box';
          grid.appendChild(selectionBox);
        }
        updateSelectionBox();
      }
      function updateSelectionBox(){
        if (!selectionBox || !selection.active) return;
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const cellSize = 12; // cell width/height
        const gap = 2; // gap between cells
        const left = minX * (cellSize + gap);
        const top = minY * (cellSize + gap);
        const width = (maxX - minX + 1) * (cellSize + gap) - gap;
        const height = (maxY - minY + 1) * (cellSize + gap) - gap;
        selectionBox.style.left = left + 'px';
        selectionBox.style.top = top + 'px';
        selectionBox.style.width = width + 'px';
        selectionBox.style.height = height + 'px';
        // Highlight selected cells
        for (let i=0;i<grid.children.length;i++){
          const el = grid.children[i];
          if (el === selectionBox) continue;
          const x = i % W;
          const y = Math.floor(i / W);
          if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
            el.classList.add('selecting');
          } else {
            el.classList.remove('selecting');
          }
        }
      }
      function clearSelection(){
        selection.active = false;
        selection.moving = false;
        selection.dragging = false;
        selection.copied = null;
        if (selectionBox && selectionBox.parentNode) {
          selectionBox.parentNode.removeChild(selectionBox);
          selectionBox = null;
        }
        for (let i=0;i<grid.children.length;i++){
          grid.children[i].classList.remove('selecting');
        }
        saveSelectionBtn.style.display = 'none';
        moveSelectionBtn.style.display = 'none';
        copySelectionBtn.style.display = 'none';
        flipHSelectionBtn.style.display = 'none';
        flipVSelectionBtn.style.display = 'none';
        rotate90SelectionBtn.style.display = 'none';
        clearSelectionBtn.style.display = 'none';
      }
      
      function copySelection() {
        if (!selection.active) return;
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const pattern = [];
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            pattern.push(arr[y * W + x]);
          }
        }
        selection.copied = { w, h, pattern };
      }
      
      function pasteSelection() {
        if (!selection.copied || !selection.active) return;
        const minX = Math.min(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const { w, h, pattern } = selection.copied;
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const destX = minX + x;
            const destY = minY + y;
            if (destX >= 0 && destY >= 0 && destX < W && destY < H) {
              const srcIdx = y * w + x;
              const destIdx = destY * W + destX;
              arr[destIdx] = pattern[srcIdx];
              const el = grid.children[destIdx];
              if (el) el.classList.toggle('on', arr[destIdx]);
            }
          }
        }
      }
      
      function flipSelectionHorizontal() {
        if (!selection.active) return;
        saveUndoState();
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        
        // Copy and flip the selection horizontally
        const temp = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcX = minX + x;
            const srcY = minY + y;
            temp[y * w + x] = arr[srcY * W + srcX];
          }
        }
        
        // Paste back flipped
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const destX = minX + (w - 1 - x); // Reverse x
            const destY = minY + y;
            const srcIdx = y * w + x;
            const destIdx = destY * W + destX;
            arr[destIdx] = temp[srcIdx];
            const el = grid.children[destIdx];
            if (el) el.classList.toggle('on', arr[destIdx]);
          }
        }
      }
      
      function flipSelectionVertical() {
        if (!selection.active) return;
        saveUndoState();
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        
        // Copy and flip the selection vertically
        const temp = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcX = minX + x;
            const srcY = minY + y;
            temp[y * w + x] = arr[srcY * W + srcX];
          }
        }
        
        // Paste back flipped
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const destX = minX + x;
            const destY = minY + (h - 1 - y); // Reverse y
            const srcIdx = y * w + x;
            const destIdx = destY * W + destX;
            arr[destIdx] = temp[srcIdx];
            const el = grid.children[destIdx];
            if (el) el.classList.toggle('on', arr[destIdx]);
          }
        }
      }
      
      function rotateSelection90() {
        if (!selection.active) return;
        saveUndoState();
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        
        // Copy the selection
        const temp = [];
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const srcX = minX + x;
            const srcY = minY + y;
            temp[y * w + x] = arr[srcY * W + srcX];
          }
        }
        
        // Clear original area
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            const idx = y * W + x;
            arr[idx] = false;
            const el = grid.children[idx];
            if (el) el.classList.toggle('on', false);
          }
        }
        
        // Rotate 90 degrees clockwise: new[x][y] = old[h-1-y][x]
        // The rotated dimensions are swapped
        const newW = h;
        const newH = w;
        
        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const newX = minX + (h - 1 - y);
            const newY = minY + x;
            if (newX >= 0 && newY >= 0 && newX < W && newY < H) {
              const srcIdx = y * w + x;
              const destIdx = newY * W + newX;
              arr[destIdx] = temp[srcIdx];
              const el = grid.children[destIdx];
              if (el) el.classList.toggle('on', arr[destIdx]);
            }
          }
        }
        
        // Update selection bounds to new rotated size
        selection.startX = minX;
        selection.startY = minY;
        selection.endX = minX + newW - 1;
        selection.endY = minY + newH - 1;
        updateSelectionBox();
      }
      
      function duplicateSelection() {
        if (!selection.active) return;
        // Copy the selection and enter move mode
        copySelection();
        selection.moving = true;
        moveSelectionBtn.textContent = selection.moving ? '✓ Moving' : '🔄 Move';
      }
      
      function clearTempOverlay() {
        if (!tempOverlay) return;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        // Remove preview class from all cells
        for (let i = 0; i < grid.children.length; i++) {
          const el = grid.children[i];
          if (el) el.classList.remove('preview');
        }
        // Restore original values
        tempOverlay.forEach(([x, y, oldVal]) => {
          const idx = y * W + x;
          arr[idx] = oldVal;
          const el = grid.children[idx];
          if (el) el.classList.toggle('on', oldVal);
        });
        tempOverlay = null;
      }
      
      function storeTempOverlay() {
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        tempOverlay = [];
        for (let i = 0; i < arr.length; i++) {
          const x = i % W;
          const y = Math.floor(i / W);
          tempOverlay.push([x, y, arr[i]]);
        }
      }
      
      function saveSelectionAsBrush(){
        if (!selection.active) return;
        const minX = Math.min(selection.startX, selection.endX);
        const maxX = Math.max(selection.startX, selection.endX);
        const minY = Math.min(selection.startY, selection.endY);
        const maxY = Math.max(selection.startY, selection.endY);
        const w = maxX - minX + 1;
        const h = maxY - minY + 1;
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        const pattern = [];
        for (let y = minY; y <= maxY; y++) {
          for (let x = minX; x <= maxX; x++) {
            pattern.push(arr[y * W + x]);
          }
        }
        const name = prompt('Enter brush name:', 'Custom ' + (Object.keys(customBrushes).length + 1));
        if (!name) return;
        customBrushes[name] = { w, h, pattern };
        updateCustomBrushDropdown();
        clearSelection();
        alert('Brush "' + name + '" saved! (' + w + 'x' + h + ')');
      }
      function updateCustomBrushDropdown(){
        customBrushSel.innerHTML = '<option value="">Select brush...</option>';
        Object.keys(customBrushes).forEach(name => {
          const opt = document.createElement('option');
          opt.value = name;
          const b = customBrushes[name];
          opt.textContent = name + ' (' + b.w + 'x' + b.h + ')';
          customBrushSel.appendChild(opt);
        });
      }
      function updateOnionSkins(){
        if (!grid) return;
        if (!onionEnabled){
          for (let i=0;i<grid.children.length;i++){ const el = grid.children[i]; el.classList.remove('prev'); el.classList.remove('next'); }
          return;
        }
        const cur = frames[idx]?.arr || new Array(W*H).fill(false);
        // compute aggregated prev/next ghost masks
        const prevMask = new Array(W*H).fill(false);
        const nextMask = new Array(W*H).fill(false);
        for (let k=1;k<=onionPrev;k++){
          const f = frames[idx - k]; if (!f) break; const a = f.arr;
          for (let i=0;i<a.length;i++){ if (a[i]) prevMask[i] = true; }
        }
        for (let k=1;k<=onionNext;k++){
          const f = frames[idx + k]; if (!f) break; const a = f.arr;
          for (let i=0;i<a.length;i++){ if (a[i]) nextMask[i] = true; }
        }
        for (let i=0;i<grid.children.length;i++){
          const el = grid.children[i];
          if (!el) continue;
          el.classList.remove('prev'); el.classList.remove('next');
          if (!cur[i]){
            if (prevMask[i]) el.classList.add('prev');
            if (nextMask[i]) el.classList.add('next');
          }
        }
      }
      function renderTimeline(){
        tl.innerHTML='';
        frames.forEach((f, i)=>{
          const t = document.createElement('div'); t.className='frameThumb'; t.style.setProperty('--w', String(W)); t.title = f.dur + 'ms';
          for(let y=0;y<H;y++){
            for(let x=0;x<W;x++){
              const p = document.createElement('div'); p.className='p' + (f.arr[y*W+x]?' on':''); t.appendChild(p);
            }
          }
          t.style.outline = i===idx ? '2px solid #0af' : '2px solid transparent';
          t.onclick = ()=>{ 
            idx=i; 
            durEl.value = String(frames[idx].dur); 
            // Clear undo/redo stacks when switching frames
            undoStack = [];
            redoStack = [];
            updateUndoRedoButtons();
            renderTimeline(); 
            renderGrid(); 
          };
          tl.appendChild(t);
        });
      }
      async function loadState(name){ try{ const r = await fetch('/anim/state' + (name?('?name='+encodeURIComponent(name)):'') ); const j = await r.json(); if (j && Array.isArray(j.frames)) { if (j.w && j.h){ W=j.w; H=j.h; } frames = j.frames.map(fr=>({ dur: Number(fr.durationMs)||300, arr: arrOf(String(fr.bits||'')) })); if (!frames.length) frames=[{ dur:300, arr:new Array(W*H).fill(false) }]; idx = Math.min(idx, frames.length-1); durEl.value=String(frames[idx].dur); currentName = String(j.name||'') || currentName; textMeta = { enable: !!(j.text && j.text.enable), url: String((j.text && j.text.url) || ''), field: String((j.text && j.text.field) || ''), intervalMs: Math.max(1000, Number(j.text && j.text.intervalMs) || 30000) }; textUrlEl.value = textMeta.url; textFieldEl.value = textMeta.field; textIntEl.value = String(textMeta.intervalMs); textEnableEl.checked = !!textMeta.enable; } }catch{ frames=[{ dur:300, arr:new Array(W*H).fill(false) }]; idx=0; }
        undoStack = []; redoStack = []; updateUndoRedoButtons();
        renderGrid(); renderTimeline(); }
      async function saveState(name){ const payload = { w: W, h: H, frames: frames.map(f=>({ bits: bitsOf(f.arr), durationMs: f.dur })), text: { enable: !!textEnableEl.checked, url: String(textUrlEl.value||'').trim(), field: String(textFieldEl.value||'').trim(), intervalMs: Math.max(1000, Number(textIntEl.value)||30000) } }; const q = name?('?name='+encodeURIComponent(name)) : ''; try{ await fetch('/anim/state'+q, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload) }); }catch{} }
      document.getElementById('addFrame').onclick = ()=>{ frames.splice(idx+1, 0, { dur: Number(durEl.value)||300, arr: new Array(W*H).fill(false) }); idx++; renderTimeline(); renderGrid(); };
      document.getElementById('dupFrame').onclick = ()=>{ const cur = frames[idx]; frames.splice(idx+1, 0, { dur: cur.dur, arr: cur.arr.slice() }); idx++; renderTimeline(); renderGrid(); };
      document.getElementById('delFrame').onclick = ()=>{ if (!frames.length) return; frames.splice(idx,1); if (!frames.length) frames.push({ dur:300, arr:new Array(W*H).fill(false) }); idx = Math.min(idx, frames.length-1); renderTimeline(); renderGrid(); };
      durEl.onchange = ()=>{ const v = Math.max(10, Number(durEl.value)||300); frames[idx].dur = v; renderTimeline(); };
      document.getElementById('save').onclick = ()=>{ const n = String(animSel.value||'').trim(); saveState(n||currentName); };
      document.getElementById('export').onclick = ()=>{ 
        const n = String(animSel.value||'').trim() || currentName || 'animation';
        const url = '/anim/export?name=' + encodeURIComponent(n);
        const a = document.createElement('a');
        a.href = url;
        a.download = n + '.js';
        a.click();
      };
      textSaveBtn.onclick = ()=>{ const n = String(animSel.value||'').trim(); saveState(n||currentName); };
      let playTimer = 0;
      document.getElementById('play').onclick = ()=>{ 
        if (playing) return; 
        playing = true; 
        function step(){ 
          if (!playing) return; 
          idx = (idx + 1) % frames.length; 
          durEl.value = String(frames[idx].dur); 
          renderTimeline(); 
          renderGrid(); 
          const adjustedDuration = Math.max(10, Math.floor(frames[idx].dur * (100 / playSpeed)));
          playTimer = setTimeout(step, adjustedDuration); 
        } 
        const adjustedDuration = Math.max(10, Math.floor(frames[idx].dur * (100 / playSpeed)));
        playTimer = setTimeout(step, adjustedDuration); 
      };
      document.getElementById('stop').onclick = ()=>{ playing=false; try{ clearTimeout(playTimer); }catch{} };
      
      // Speed control
      playSpeedEl.oninput = ()=>{ 
        playSpeed = Number(playSpeedEl.value) || 100; 
        speedLabelEl.textContent = playSpeed + '%';
      };
      
      // Fill shapes toggle
      fillShapesEl.onchange = ()=>{ fillShapes = fillShapesEl.checked; };
      pixelPerfectEl.onchange = ()=>{ pixelPerfect = pixelPerfectEl.checked; };
      
      // Undo/Redo buttons
      undoBtn.onclick = ()=>{ undo(); };
      redoBtn.onclick = ()=>{ redo(); };
      
      // Keyboard shortcuts for undo/redo
      document.addEventListener('keydown', (e) => {
        // Ctrl+Z or Cmd+Z for undo
        if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
          e.preventDefault();
          undo();
        }
        // Ctrl+Y or Cmd+Y or Ctrl+Shift+Z for redo
        if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
          e.preventDefault();
          redo();
        }
      });
      
      // Helper to update UI based on mode
      function updateModeUI() {
        // Hide/show controls based on mode
        const showBrushSize = ['paint', 'erase', 'spray'].includes(brushMode);
        const showBrushShape = ['paint', 'erase'].includes(brushMode);
        const showFillToggle = ['rect', 'circle'].includes(brushMode);
        
        brushSizeControl.style.display = showBrushSize ? 'inline-flex' : 'none';
        brushShapeControl.style.display = showBrushShape ? 'inline-flex' : 'none';
        fillToggle.style.display = showFillToggle ? 'inline-flex' : 'none';
        customBrushSel.style.display = (brushShape === 'custom' && showBrushShape) ? 'inline-block' : 'none';
        updateGridCursor();
      }
      
      // Mode buttons
      modePaintBtn.onclick = ()=>{ 
        brushMode = 'paint'; 
        modePaintBtn.classList.add('active'); 
        [modeEraseBtn, modeSprayBtn, modeFillBtn, modeLineBtn, modeRectBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeEraseBtn.onclick = ()=>{ 
        brushMode = 'erase'; 
        modeEraseBtn.classList.add('active'); 
        [modePaintBtn, modeSprayBtn, modeFillBtn, modeLineBtn, modeRectBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeSprayBtn.onclick = ()=>{ 
        brushMode = 'spray'; 
        modeSprayBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeFillBtn, modeLineBtn, modeRectBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeFillBtn.onclick = ()=>{ 
        brushMode = 'fill'; 
        modeFillBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeSprayBtn, modeLineBtn, modeRectBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeLineBtn.onclick = ()=>{ 
        brushMode = 'line'; 
        modeLineBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeSprayBtn, modeFillBtn, modeRectBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeRectBtn.onclick = ()=>{ 
        brushMode = 'rect'; 
        modeRectBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeSprayBtn, modeFillBtn, modeLineBtn, modeCircleBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeCircleBtn.onclick = ()=>{ 
        brushMode = 'circle'; 
        modeCircleBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeSprayBtn, modeFillBtn, modeLineBtn, modeRectBtn, modeSelectBtn].forEach(b => b.classList.remove('active'));
        clearSelection();
        updateModeUI();
      };
      modeSelectBtn.onclick = ()=>{ 
        brushMode = 'select'; 
        modeSelectBtn.classList.add('active'); 
        [modePaintBtn, modeEraseBtn, modeSprayBtn, modeFillBtn, modeLineBtn, modeRectBtn, modeCircleBtn].forEach(b => b.classList.remove('active'));
        updateModeUI();
      };
      
      function updateGridCursor() {
        const overlay = grid.querySelector('div[style*="position: absolute"]');
        if (overlay) {
          overlay.style.cursor = brushMode === 'select' ? 'crosshair' : 'default';
        }
      }
      
      // Brush shape buttons
      brushCircleBtn.onclick = ()=>{ 
        brushShape = 'circle'; 
        brushCircleBtn.classList.add('active'); 
        brushSquareBtn.classList.remove('active'); 
        brushTriangleBtn.classList.remove('active');
        brushCustomBtn.classList.remove('active');
        customBrushSel.style.display = 'none';
      };
      brushSquareBtn.onclick = ()=>{ 
        brushShape = 'square'; 
        brushSquareBtn.classList.add('active'); 
        brushCircleBtn.classList.remove('active'); 
        brushTriangleBtn.classList.remove('active');
        brushCustomBtn.classList.remove('active');
        customBrushSel.style.display = 'none';
      };
      brushTriangleBtn.onclick = ()=>{ 
        brushShape = 'triangle'; 
        brushTriangleBtn.classList.add('active'); 
        brushCircleBtn.classList.remove('active'); 
        brushSquareBtn.classList.remove('active');
        brushCustomBtn.classList.remove('active');
        customBrushSel.style.display = 'none';
      };
      brushCustomBtn.onclick = ()=>{ 
        brushShape = 'custom'; 
        brushCustomBtn.classList.add('active'); 
        brushCircleBtn.classList.remove('active'); 
        brushSquareBtn.classList.remove('active');
        brushTriangleBtn.classList.remove('active');
        customBrushSel.style.display = 'inline-block';
        if (!currentCustomBrush && Object.keys(customBrushes).length > 0) {
          currentCustomBrush = Object.keys(customBrushes)[0];
          customBrushSel.value = currentCustomBrush;
        }
      };
      
      // Brush size
      brushSizeEl.oninput = ()=>{ brushSize = Number(brushSizeEl.value) || 1; };
      
      // Custom brush selection
      customBrushSel.onchange = ()=>{ 
        currentCustomBrush = customBrushSel.value || null; 
      };
      
      // Save selection as brush
      saveSelectionBtn.onclick = ()=>{ saveSelectionAsBrush(); };
      
      // Copy selection (duplicate and enter move mode)
      copySelectionBtn.onclick = ()=>{ duplicateSelection(); };
      
      // Flip selection horizontally
      flipHSelectionBtn.onclick = ()=>{ flipSelectionHorizontal(); };
      
      // Flip selection vertically
      flipVSelectionBtn.onclick = ()=>{ flipSelectionVertical(); };
      
      // Rotate selection 90 degrees
      rotate90SelectionBtn.onclick = ()=>{ rotateSelection90(); };
      
      // Move selection
      moveSelectionBtn.onclick = ()=>{ 
        if (!selection.active) return;
        
        // First, copy the selection pattern
        copySelection();
        
        // Store the current frame state before clearing (for undo if needed)
        storeTempOverlay();
        
        // Clear the ENTIRE frame to blank
        const arr = frames[idx]?.arr || new Array(W*H).fill(false);
        for (let i = 0; i < arr.length; i++) {
          arr[i] = false;
          const el = grid.children[i];
          if (el) el.classList.toggle('on', false);
        }
        
        selection.moving = true;
        moveSelectionBtn.textContent = selection.moving ? '✓ Moving' : '🔄 Move Mode';
      };
      
      // Clear selection
      clearSelectionBtn.onclick = ()=>{ clearSelection(); };
      
      // Mouse up handler
      document.addEventListener('mouseup', (e)=>{ 
        if (!isMouseDown) return;
        isMouseDown = false; 
        
        // Stop spray timer if active
        if (sprayTimer) {
          clearInterval(sprayTimer);
          sprayTimer = null;
        }
        
        // Finalize line drawing
        if (brushMode === 'line' && lineStart) {
          clearTempOverlay();
          tempOverlay = null; // Reset
          const i = getCellFromMouseEvent(e);
          if (i >= 0) {
            const x = i % W;
            const y = Math.floor(i / W);
            drawLine(lineStart.x, lineStart.y, x, y, true); // Commit the line
          }
          lineStart = null;
        }
        
        // Finalize shape drawing
        if (brushMode === 'rect' && shapeStart) {
          clearTempOverlay();
          tempOverlay = null; // Reset
          const i = getCellFromMouseEvent(e);
          if (i >= 0) {
            const x = i % W;
            const y = Math.floor(i / W);
            drawRect(shapeStart.x, shapeStart.y, x, y, fillShapes, true); // Commit the rect
          }
          shapeStart = null;
        }
        
        if (brushMode === 'circle' && shapeStart) {
          clearTempOverlay();
          tempOverlay = null; // Reset
          const i = getCellFromMouseEvent(e);
          if (i >= 0) {
            const x = i % W;
            const y = Math.floor(i / W);
            const radius = Math.round(Math.sqrt(Math.pow(x - shapeStart.x, 2) + Math.pow(y - shapeStart.y, 2)));
            drawCircle(shapeStart.x, shapeStart.y, radius, fillShapes, true); // Commit the circle
          }
          shapeStart = null;
        }
        
        if (brushMode === 'select' && selection.active) {
          if (selection.dragging) {
            // The selection is already at the new position from mousemove
            // Just commit it by clearing temp overlay
            tempOverlay = null; // Finalize the move
            selection.dragging = false;
          }
          // Selection complete - show buttons
          saveSelectionBtn.style.display = 'inline-block';
          moveSelectionBtn.style.display = 'inline-block';
          copySelectionBtn.style.display = 'inline-block';
          flipHSelectionBtn.style.display = 'inline-block';
          flipVSelectionBtn.style.display = 'inline-block';
          rotate90SelectionBtn.style.display = 'inline-block';
          clearSelectionBtn.style.display = 'inline-block';
        }
      });
      
      // Helper to get cell from mouse event
      function getCellFromMouseEvent(e) {
        const gridRect = grid.getBoundingClientRect();
        const cellSize = 12;
        const gap = 2;
        const x = e.clientX - gridRect.left - 6;
        const y = e.clientY - gridRect.top - 6;
        const cellX = Math.floor(x / (cellSize + gap));
        const cellY = Math.floor(y / (cellSize + gap));
        if (cellX < 0 || cellY < 0 || cellX >= W || cellY >= H) return -1;
        return cellY * W + cellX;
      }
      
      // Animation management
      function createPreviewGrid(container, Wsrc, Hsrc){
        const scale = 2; // 2px cells
        const Wt = Math.min(84, Wsrc);
        const Ht = Math.min(28, Hsrc);
        const root = document.createElement('div');
        root.style.display = 'grid';
        root.style.gridTemplateColumns = 'repeat(' + Wt + ', ' + scale + 'px)';
        root.style.gridAutoRows = scale + 'px';
        root.style.gap = '1px';
        root.style.background = '#111';
        root.style.padding = '4px';
        root.style.border = '1px solid #333';
        root.style.borderRadius = '4px';
        const pixels = [];
        for (let i=0;i<Wt*Ht;i++){ const d = document.createElement('div'); d.style.width = scale+'px'; d.style.height = scale+'px'; d.style.background = '#000'; pixels.push(d); root.appendChild(d); }
        container.appendChild(root);
        return { root, pixels, Wt, Ht };
      }
      function renderPreviewBits(preview, bits, Wsrc, Hsrc){
        const { pixels, Wt, Ht } = preview;
        for (let y=0;y<Ht;y++){
          for (let x=0;x<Wt;x++){
            const sx = Math.floor(x * Wsrc / Wt);
            const sy = Math.floor(y * Hsrc / Ht);
            const on = bits.charAt(sy * Wsrc + sx) === '1';
            const el = pixels[y*Wt + x];
            if (el) el.style.background = on ? '#fff' : '#000';
          }
        }
      }
      async function refreshAnimList(){
        try{
          const r = await fetch('/anim/list');
          const j = await r.json();
          if (!(j && Array.isArray(j.items))) return;
          // dropdown
          animSel.innerHTML='';
          j.items.forEach(n=>{ const o=document.createElement('option'); o.value=n; o.textContent=n; if (n===j.active) o.selected=true; animSel.appendChild(o); });
          currentName = j.active||currentName||''; animNameInput.value = currentName;
          // sidebar list with hover preview
          animListEl.innerHTML = '';
          j.items.forEach(name => {
            const item = document.createElement('div');
            item.style.display = 'flex';
            item.style.alignItems = 'center';
            item.style.justifyContent = 'space-between';
            item.style.gap = '8px';
            item.style.padding = '6px 8px';
            item.style.border = '1px solid ' + (name===j.active ? '#0a4' : '#ddd');
            item.style.borderRadius = '6px';
            item.style.background = name===j.active ? '#eaffea' : '#fff';
            item.style.cursor = 'pointer';
            const label = document.createElement('div');
            label.textContent = name;
            label.style.flex = '1';
            label.style.fontSize = '13px';
            const previewWrap = document.createElement('div');
            previewWrap.style.marginLeft = '6px';
            const meta = { playing: false, timer: 0, frames: [], w: 0, h: 0, preview: null };
            item.addEventListener('mouseenter', async ()=>{
              if (meta.preview) return; // already built
              try{
                const rr = await fetch('/anim/state?name=' + encodeURIComponent(name));
                const sj = await rr.json();
                const frames = Array.isArray(sj.frames) ? sj.frames.slice(0, 30) : [];
                meta.frames = frames.map(f=>({ bits: String(f.bits||''), dur: Math.max(10, Number(f.durationMs)||300) }));
                meta.w = Number(sj.w)||84; meta.h = Number(sj.h)||28;
                meta.preview = createPreviewGrid(previewWrap, meta.w, meta.h);
                if (meta.frames.length){
                  meta.playing = true;
                  let i = 0;
                  function step(){ if (!meta.playing) return; const fr = meta.frames[i]; renderPreviewBits(meta.preview, fr.bits, meta.w, meta.h); i = (i+1) % meta.frames.length; meta.timer = setTimeout(step, fr.dur); }
                  step();
                } else {
                  meta.preview = meta.preview || createPreviewGrid(previewWrap, 84, 28);
                }
              }catch{}
            });
            item.addEventListener('mouseleave', ()=>{
              meta.playing = false; try{ clearTimeout(meta.timer); }catch{}
              previewWrap.innerHTML = '';
              meta.preview = null;
            });
            item.addEventListener('click', async ()=>{ animSel.value = name; animNameInput.value = name; await loadState(name); });
            item.appendChild(label);
            item.appendChild(previewWrap);
            animListEl.appendChild(item);
          });
        }catch{}
      }
      animSel.addEventListener('change', async ()=>{ const n = String(animSel.value||''); await loadState(n); animNameInput.value = n; });
      document.getElementById('animNew').onclick = async ()=>{ const name = String(animNameInput.value||'').trim() || ('anim-'+Date.now()); frames=[{ dur:300, arr:new Array(W*H).fill(false) }]; idx=0; await saveState(name); await fetch('/anim/select', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); await refreshAnimList(); await loadState(name); };
      document.getElementById('animSaveAs').onclick = async ()=>{ const name = String(animNameInput.value||'').trim(); if (!name) return; await saveState(name); await refreshAnimList(); animSel.value = name; };
      document.getElementById('animDelete').onclick = async ()=>{ const name = String(animSel.value||''); if (!name) return; try{ await fetch('/anim/delete', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); }catch{} await refreshAnimList(); const next = String(animSel.value||''); await loadState(next); };
      document.getElementById('animSetActive').onclick = async ()=>{ const name = String(animSel.value||''); if (!name) return; try{ await fetch('/anim/select', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); }catch{} await refreshAnimList(); };
      (async function init(){ 
        await getLiveSize(); 
        await refreshAnimList(); 
        await loadState(); 
        updateUndoRedoButtons(); // Initialize button states
      })();
      // Save on unload to persist quick edits
      window.addEventListener('beforeunload', ()=>{ try{ const n = String(animSel && animSel.value || ''); navigator.sendBeacon('/anim/state' + (n?('?name='+encodeURIComponent(n)):'') , new Blob([JSON.stringify({ w:W, h:H, frames: frames.map(f=>({ bits: bitsOf(f.arr), durationMs: f.dur })), text: { enable: !!textEnableEl.checked, url: String(textUrlEl.value||'').trim(), field: String(textFieldEl.value||'').trim(), intervalMs: Math.max(1000, Number(textIntEl.value)||30000) } })], { type:'application/json' })); }catch{} });
      // Onion skin UI
      onionEnableEl.addEventListener('change', ()=>{ onionEnabled = !!onionEnableEl.checked; updateOnionSkins(); });
      onionPrevEl.addEventListener('change', ()=>{ onionPrev = Math.max(0, Math.min(2, Number(onionPrevEl.value)||0)); updateOnionSkins(); });
      onionNextEl.addEventListener('change', ()=>{ onionNext = Math.max(0, Math.min(2, Number(onionNextEl.value)||0)); updateOnionSkins(); });
    </script>
  </body>
</html>`);
		} else if (parsed.pathname === "/anim/state") {
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			const q = parsed.query || {};
			const name = String(q.name || '').trim() || store.active || 'default';
			if (req.method === 'GET') {
				const bm = globalThis.__frameBitmap;
				const cur = store.items[name] || store.items[store.active] || { w: (bm && bm.w) || 84, h: (bm && bm.h) || 28, frames: [], text: { enable:false, url:'', field:'', intervalMs:30000 } };
				res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
				res.end(JSON.stringify({ name, w: Number(cur.w)||0, h: Number(cur.h)||0, frames: Array.isArray(cur.frames)?cur.frames:[], text: cur.text || { enable:false, url:'', field:'', intervalMs:30000 } }));
			} else if (req.method === 'POST') {
				let body = '';
				req.on('data', c => body += c);
				req.on('end', () => {
					try{
						const data = JSON.parse(body||'{}');
						const w = Math.max(1, Number(data.w)||0);
						const h = Math.max(1, Number(data.h)||0);
						const frames = Array.isArray(data.frames) ? data.frames.map(f=>({ bits: String(f.bits||''), durationMs: Math.max(10, Number(f.durationMs)||300) })) : [];
						const text = data && data.text ? { enable: !!data.text.enable, url: String(data.text.url||'').trim(), field: String(data.text.field||'').trim(), intervalMs: Math.max(1000, Number(data.text.intervalMs)||30000) } : { enable:false, url:'', field:'', intervalMs:30000 };
						store.items[name] = { w, h, frames, text };
						res.writeHead(200, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok:true, name }));
					} catch {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok:false }));
					}
				});
			} else {
				res.writeHead(405); res.end('Method Not Allowed');
			}
		} else if (parsed.pathname === "/anim/list") {
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			if (!Object.keys(store.items).length) store.items['default'] = { w: 84, h: 28, frames: [] };
			res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
			res.end(JSON.stringify({ items: Object.keys(store.items), active: store.active }));
		} else if (parsed.pathname === "/anim/text" && req.method === 'GET') {
			// Per-animation text fetch (cache per name)
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			const q = parsed.query || {};
			const name = String(q.name||'').trim() || store.active || 'default';
			const item = store.items[name];
			if (!item || !item.text || !item.text.enable || !item.text.url) {
				res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" });
				res.end(JSON.stringify({ text: '' }));
				return;
			}
			if (!item.textCache) item.textCache = { lastText:'', nextAt:0, loading:false };
			const cache = item.textCache;
			function send(){ res.writeHead(200, { "Content-Type": "application/json", "Cache-Control": "no-store" }); res.end(JSON.stringify({ text: String(cache.lastText||'') })); }
			const now = Date.now();
			if (now < (cache.nextAt||0) || cache.loading) { send(); return; }
			cache.loading = true; cache.nextAt = now + (Number(item.text.intervalMs)||30000);
			try{
				const h = item.text.url.startsWith('https:') ? https : http;
				new Promise(resolve => {
					const controller = new AbortController();
					const t = setTimeout(()=>{ try{ controller.abort(); }catch{} resolve(); }, 4000);
					const req2 = h.request(item.text.url, { method:'GET', signal: controller.signal }, res2 => {
						let data = '';
						res2.setEncoding('utf8');
						res2.on('data', c => { data += c; if (data.length > 8000) { try{ req2.destroy(); }catch{} } });
						res2.on('end', () => {
							clearTimeout(t);
							let text = '';
							try{
								const ct = String(res2.headers['content-type']||'').toLowerCase();
								if (ct.includes('application/json') || data.trim().startsWith('{') || data.trim().startsWith('[')){
									const j = JSON.parse(data);
									if (item.text.field){
										const parts = String(item.text.field).split('.');
										let v = j; for (const p of parts){ if (v && typeof v==='object') v = v[p]; else { v=''; break; } }
										text = String(v ?? '');
									} else {
										text = String(j && (j.text || j.message || j.title || ''));
									}
								} else {
									text = String(data||'');
								}
							}catch{ text = String(data||''); }
							cache.lastText = text.replace(/[\r\n\t]+/g, ' ').slice(0, 500);
							resolve();
						});
					});
					req2.on('error', () => resolve());
					req2.end();
				});
			}catch{}
			finally{ cache.loading = false; }
			send();
		} else if (parsed.pathname === "/anim/select" && req.method === 'POST') {
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			let body = '';
			req.on('data', c => body += c);
			req.on('end', () => {
				try{ const { name } = JSON.parse(body||'{}'); const n = String(name||'').trim(); if (!n) throw new Error('bad'); if (!store.items[n]) store.items[n] = { w:84, h:28, frames: [] }; store.active = n; res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok:true, active: n })); }
				catch { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok:false })); }
			});
		} else if (parsed.pathname === "/anim/delete" && req.method === 'POST') {
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			let body = '';
			req.on('data', c => body += c);
			req.on('end', () => {
				try{ const { name } = JSON.parse(body||'{}'); const n = String(name||'').trim(); if (!n || !store.items[n]) throw new Error('bad'); delete store.items[n]; const keys = Object.keys(store.items); if (!keys.length) store.items['default'] = { w:84, h:28, frames: [] }; if (store.active === n) store.active = keys[0] || 'default'; res.writeHead(200, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok:true, active: store.active })); }
				catch { res.writeHead(400, { "Content-Type": "application/json" }); res.end(JSON.stringify({ ok:false })); }
			});
		} else if (parsed.pathname === "/anim/export" && req.method === 'GET') {
			// Export animation in JavaScript object format
			if (!globalThis.__anim_store) globalThis.__anim_store = { active: 'default', items: {} };
			const store = globalThis.__anim_store;
			const q = parsed.query || {};
			const name = String(q.name || '').trim() || store.active || 'default';
			const item = store.items[name];
			if (!item || !Array.isArray(item.frames)) {
				res.writeHead(404, { "Content-Type": "text/plain" });
				res.end('Animation not found');
				return;
			}
			
			// Convert bits string to 2D array format
			function bitsToArray(bits, width, height) {
				const result = [];
				for (let y = 0; y < height; y++) {
					const row = [];
					for (let x = 0; x < width; x++) {
						const index = y * width + x;
						row.push(bits.charAt(index) === '1' ? 1 : 0);
					}
					result.push(row);
				}
				return result;
			}
			
			// Build the JavaScript object
			let output = `const animation = {\n`;
			item.frames.forEach((frame, index) => {
				const frameNum = index + 1;
				const array2D = bitsToArray(frame.bits, item.w, item.h);
				output += `  "frame_${frameNum}": [\n`;
				array2D.forEach((row, rowIdx) => {
					output += `    [${row.join(',')}]`;
					if (rowIdx < array2D.length - 1) output += ',';
					output += '\n';
				});
				output += `  ]`;
				if (index < item.frames.length - 1) output += ',';
				output += '\n';
			});
			output += `};\n`;
			
			res.writeHead(200, { 
				"Content-Type": "text/javascript",
				"Content-Disposition": `attachment; filename="${name || 'animation'}.js"`
			});
			res.end(output);
		} else if (parsed.pathname === "/ski") {
			// return simple input state for runner
			if (!globalThis.__ski_state) {
				globalThis.__ski_state = { lastJumpTs: 0, jumpWindowMs: 700, resetAt: 0, started: false };
			}
			const { lastJumpTs, jumpWindowMs, resetAt, started } = globalThis.__ski_state;
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ lastJumpTs, jumpWindowMs, resetAt, started }));
		} else if (parsed.pathname === "/ski/jump" && req.method === "POST") {
			if (!globalThis.__ski_state) {
				globalThis.__ski_state = { lastJumpTs: 0, jumpWindowMs: 700, resetAt: 0, started: false };
			}
			globalThis.__ski_state.lastJumpTs = Date.now();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok:true }));
		} else if (parsed.pathname === "/ski/start" && req.method === "POST") {
			if (!globalThis.__ski_state) {
				globalThis.__ski_state = { lastJumpTs: 0, jumpWindowMs: 700, resetAt: 0, started: false };
			}
			globalThis.__ski_state.started = true;
			globalThis.__ski_state.resetAt = Date.now();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok:true }));
		} else if (parsed.pathname === "/ski/stop" && req.method === "POST") {
			if (!globalThis.__ski_state) {
				globalThis.__ski_state = { lastJumpTs: 0, jumpWindowMs: 700, resetAt: 0, started: false };
			}
			globalThis.__ski_state.started = false;
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok:true }));
		} else if (parsed.pathname === "/mood" && req.method === "POST") {
			let body = "";
			req.on("data", chunk => body += chunk);
			req.on("end", () => {
				try {
					const data = JSON.parse(body || "{}");
					const ok = addMoodLabel(data.mood);
					res.writeHead(ok ? 200 : 400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok }));
				} catch {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok: false }));
				}
			});
		} else if (parsed.pathname === "/mood/majority") {
			const { majority, happy, sad } = getMajorityMood();
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ majority, happy, sad }));
		} else if (parsed.pathname === "/mood/reset" && req.method === "POST") {
			moodEntries.splice(0, moodEntries.length);
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok: true }));
		} else if (parsed.pathname === "/tallygame") {
			// in-memory two-team tally game state
			if (!globalThis.__tg_state) {
				globalThis.__tg_state = { a: 0, b: 0, lastTs: 0 };
			}
			if (req.method === 'GET') {
				const { a, b, lastTs } = globalThis.__tg_state;
				res.writeHead(200, { "Content-Type": "application/json" });
				res.end(JSON.stringify({ a, b, lastTs }));
			} else {
				res.writeHead(405);
				res.end("Method Not Allowed");
			}
        } else if (parsed.pathname === "/tallygame/add" && req.method === "POST") {
			if (!globalThis.__tg_state) {
				globalThis.__tg_state = { a: 0, b: 0, lastTs: 0 };
			}
			let body = "";
			req.on("data", chunk => body += chunk);
			req.on("end", () => {
				try {
					const data = JSON.parse(body || "{}");
					const team = String(data.team || '').toUpperCase();
					if (team !== 'A' && team !== 'B') {
						res.writeHead(400, { "Content-Type": "application/json" });
						res.end(JSON.stringify({ ok:false }));
						return;
					}
					if (team === 'A') globalThis.__tg_state.a += 1; else globalThis.__tg_state.b += 1;
					globalThis.__tg_state.lastTs = Date.now();
					res.writeHead(200, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok:true, a: globalThis.__tg_state.a, b: globalThis.__tg_state.b }));
				} catch {
					res.writeHead(400, { "Content-Type": "application/json" });
					res.end(JSON.stringify({ ok:false }));
				}
			});
        } else if (parsed.pathname === "/tallygame/reset" && req.method === "POST") {
			globalThis.__tg_state = { a: 0, b: 0, lastTs: Date.now() };
			res.writeHead(200, { "Content-Type": "application/json" });
			res.end(JSON.stringify({ ok:true }));
        } else if (parsed.pathname === "/next" && req.method === "GET") {
            if (!globalThis.__next_state) globalThis.__next_state = { name: '' };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ name: String(globalThis.__next_state.name || '') }));
        } else if (parsed.pathname === "/next" && req.method === "POST") {
            let body = "";
            req.on("data", chunk => body += chunk);
            req.on("end", () => {
                try {
                    const data = JSON.parse(body || "{}");
                    const nameRaw = (data && data.name) || '';
                    const name = String(nameRaw).slice(0, 64).trim();
                    if (!globalThis.__next_state) globalThis.__next_state = { name: '' };
                    globalThis.__next_state.name = name;
                    res.writeHead(200, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok:true, name }));
                } catch {
                    res.writeHead(400, { "Content-Type": "application/json" });
                    res.end(JSON.stringify({ ok:false }));
                }
            });
        } else if (parsed.pathname === "/next/clear" && req.method === "POST") {
            globalThis.__next_state = { name: '' };
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify({ ok:true }));
		} else {
			res.writeHead(404);
			res.end("Not found");
		}
	};
}

function startPreviewServer(startPort = Number(process.env.PORT || 3000)) {
	function bind(port) {
		const server = http.createServer(createHandler());
		server.on('error', (err) => {
			if (err && err.code === 'EADDRINUSE') {
				console.error(`[preview] Port ${port} in use, trying ${port + 1}...`);
				setTimeout(() => bind(port + 1), 300);
			} else {
				console.error('[preview] Server error:', err);
			}
		});
		server.listen(port, () => {
			console.log(`[preview] Listening on http://localhost:${port}`);
		});
		globalThis.__previewServer = server;
	}
	bind(startPort);

	function shutdown() {
		try { globalThis.__previewServer && globalThis.__previewServer.close(); } catch {}
		process.exit(0);
	}
	process.on('SIGINT', shutdown);
	process.on('SIGTERM', shutdown);
}

startPreviewServer();

// Separate lightweight frontend site (public): shows QR and live animation only
function createFrontendHandler() {
    return (req, res) => {
        const parsed = url.parse(req.url, true);
        if (parsed.pathname === '/live.png') {
            // proxy backend frame to avoid cross-origin issues for clients
            try{
                http.get({ hostname: '127.0.0.1', port: 3000, path: '/frame.png' }, (r) => {
                    res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'no-store' });
                    r.pipe(res);
                }).on('error', () => { res.writeHead(502); res.end(); });
            }catch{ res.writeHead(502); res.end(); }
            return;
        }
        if (parsed.pathname === '/live.bits') {
            // proxy backend frame bits to avoid cross-origin issues for clients
            try{
                http.get({ hostname: '127.0.0.1', port: 3000, path: '/frame.bits' }, (r) => {
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
                    r.pipe(res);
                }).on('error', () => { res.writeHead(502); res.end(); });
            }catch{ res.writeHead(502); res.end(); }
            return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Flipdots Front</title>
    <style>
      #flipboard{ --amount-of-columns:0; display:grid; grid-template-columns:repeat(var(--amount-of-columns),1fr); border:1px solid rgba(255,255,255,0.2); background:#000; padding:6px; }
      #flipboard>div{ width:10px; background-color:#000; border-radius:50%; aspect-ratio:1; transform:rotate(45deg) rotateY(180deg); backface-visibility:hidden; transition:transform 40ms ease-out, background-color 40ms ease-out; }
      #flipboard>div.on{ transform:rotate(45deg) rotateY(0deg); background-color:#fff; }
    </style>
  </head>
  <body style="margin:0;background:#fff;display:flex;flex-direction:column;gap:16px;align-items:center;justify-content:center;min-height:100vh;padding:16px;font-family:system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif">
    <div style="display:flex;gap:16px;align-items:flex-start;flex-wrap:wrap;justify-content:center;width:100%;max-width:980px">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <img id="frame" alt="live" src="/live.png" style="image-rendering:pixelated;max-width:100%;height:auto;border:1px solid #ddd" />
        <div style="font-size:12px;color:#666">Live flipdot frame</div>
      </div>
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <section id="flipboard"></section>
        <div style="font-size:12px;color:#666">Flipboard-style demo</div>
      </div>
    </div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;justify-content:center">
      <div style="display:flex;flex-direction:column;align-items:center;gap:6px">
        <img id="qrImg" alt="QR to controls" style="width:200px;height:200px;border:1px solid #ddd;background:#fff" />
        <div id="qrUrl" style="font-size:12px;color:#555;max-width:360px;text-align:center;word-break:break-all"></div>
      </div>
      <div style="font-size:13px;color:#666;max-width:340px">
        Scan the QR to open the control page on your phone.
      </div>
    </div>
    <div id="controls" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;justify-content:center"></div>
    <script>
      // auto-refresh frame (animation preview) - optimized
      let lastFrameTime = 0;
      (function updateFrame(time){
        if (time - lastFrameTime > 100) { // ~10fps instead of 60fps
          try{
            const img = document.getElementById('frame');
            const base = '/live.png';
            img.src = base + '?t=' + time;
            lastFrameTime = time;
          }catch{}
        }
        requestAnimationFrame(updateFrame);
      })();
      // Big Flipboard mapped from live bits
      (function(){
        try{
          const W = 84, H = 28;
          const dots = [];
          const root = document.getElementById('flipboard');
          if (!root) return;
          root.style.setProperty('--amount-of-columns', String(W));
          for (let c=0;c<W;c++) for (let r=0;r<H;r++){ const d=document.createElement('div'); root.appendChild(d); dots.push(d); }
          let prevBits = '';
          async function poll(){
            try{
              const r = await fetch('/live.bits');
              const j = await r.json();
              if (j && j.bits && j.w && j.h){
                if (j.bits !== prevBits){
                  for (let y=0;y<H;y++){
                    for (let x=0;x<W;x++){
                      const sx = Math.floor(x * j.w / W);
                      const sy = Math.floor(y * j.h / H);
                      const bit = j.bits.charAt(sy * j.w + sx) === '1';
                      const el = dots[y*W + x];
                      if (el){ if (bit) el.classList.add('on'); else el.classList.remove('on'); }
                    }
                  }
                  prevBits = j.bits;
                }
              }
            }catch{}
            setTimeout(poll, 200);
          }
          poll();
        }catch{}
      })();
      // static QR to backend control page
      (function(){
        try{
          const url = 'http://145.93.160.143:3000/view';
          const img = document.getElementById('qrImg');
          const txt = document.getElementById('qrUrl');
          if (img) img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(url);
          if (txt) txt.textContent = url;
        }catch{}
      })();

      // Dynamic controls based on active scene
      async function getScene(){ try{ const r = await fetch('http://145.93.160.143:3000/scene'); const j = await r.json(); return (j && j.scene) || 'mood'; }catch{ return 'mood'; } }
      async function setScene(scene){ try{ await fetch('http://145.93.160.143:3000/scene', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ scene }) }); }catch{} }
      async function getNext(){ try{ const r = await fetch('http://145.93.160.143:3000/next'); const j = await r.json(); return (j && j.name) || ''; }catch{ return ''; } }
      async function setNext(name){ try{ await fetch('http://145.93.160.143:3000/next', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ name }) }); }catch{} }
      async function clearNext(){ try{ await fetch('http://145.93.160.143:3000/next/clear', { method:'POST' }); }catch{} }
      async function tgAdd(team){ try{ await fetch('http://145.93.160.143:3000/tallygame/add', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ team }) }); }catch{} }
      async function tgReset(){ try{ await fetch('http://145.93.160.143:3000/tallygame/reset', { method:'POST' }); }catch{} }
      async function skiJump(){ try{ await fetch('http://145.93.160.143:3000/ski/jump', { method:'POST' }); }catch{} }
      async function skiStart(){ try{ await fetch('http://145.93.160.143:3000/ski/start', { method:'POST' }); }catch{} }

      function el(tag, attrs, ...children){ const e = document.createElement(tag); if (attrs) Object.assign(e, attrs); for (const c of children) e.append(c); return e; }
      async function renderControls(){
        const scene = await getScene();
        const root = document.getElementById('controls');
        root.innerHTML = '';
        // Scene switcher
        root.append(el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center' },
          el('span', { textContent: 'Scene:' }),
          (()=>{ const s = el('select'); ['mood','clock','demo2','tally','fact','next'].forEach(v=>{ const o = el('option', { value: v, textContent: v }); if (v===scene) o.selected=true; s.append(o); }); s.onchange = ()=> setScene(s.value).then(renderControls); return s; })()
        ));
        // Controls per scene
        if (scene === 'next'){
          const inp = el('input', { placeholder: 'Name', style: 'padding:4px 6px' });
          const cur = await getNext(); if (cur) inp.value = cur;
          root.append(el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center' },
            el('strong', { textContent: 'Who is next:' }), inp,
            (()=>{ const b = el('button', { textContent: 'Set' }); b.onclick = ()=> setNext(String(inp.value||'').trim()); return b; })(),
            (()=>{ const b = el('button', { textContent: 'Clear' }); b.onclick = ()=> clearNext(); return b; })()
          ));
        } else if (scene === 'tally'){
          root.append(el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center' },
            el('strong', { textContent: 'Tally:' }),
            (()=>{ const b = el('button', { textContent: '+1 Team A' }); b.onclick = ()=> tgAdd('A'); return b; })(),
            (()=>{ const b = el('button', { textContent: '+1 Team B' }); b.onclick = ()=> tgAdd('B'); return b; })(),
            (()=>{ const b = el('button', { textContent: 'Reset' }); b.onclick = ()=> tgReset(); return b; })()
          ));
        } else if (scene === 'demo2'){
          root.append(el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center' },
            el('strong', { textContent: 'Ski:' }),
            (()=>{ const b = el('button', { textContent: 'Jump' }); b.onclick = ()=> skiJump(); return b; })(),
            (()=>{ const b = el('button', { textContent: 'Start' }); b.onclick = ()=> skiStart(); return b; })()
          ));
        } else if (scene === 'mood'){
          root.append(el('div', { style: 'display:flex;gap:6px;align-items:center;flex-wrap:wrap;justify-content:center' },
            el('strong', { textContent: 'Mood:' }),
            (()=>{ const b = el('button', { textContent: 'Happy' }); b.onclick = ()=> fetch('http://145.93.160.143:3000/mood', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mood:'happy' }) }); return b; })(),
            (()=>{ const b = el('button', { textContent: 'Sad' }); b.onclick = ()=> fetch('http://145.93.160.143:3000/mood', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ mood:'sad' }) }); return b; })(),
            (()=>{ const b = el('button', { textContent: 'Reset votes' }); b.onclick = ()=> fetch('http://145.93.160.143:3000/mood/reset', { method:'POST' }); return b; })()
          ));
        }
      }
      setInterval(renderControls, 2000);
      renderControls();
    </script>
  </body>
 </html>`);
    };
}

function startFrontendServer(port = 4000) {
    try{
        const server = http.createServer(createFrontendHandler());
        server.listen(port, () => {
            console.log(`[frontend] Listening on http://localhost:${port}`);
        });
    }catch(e){
        console.error('[frontend] Server error:', e);
    }
}

startFrontendServer();
