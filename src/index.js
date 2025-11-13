import { Ticker } from "./ticker.js";
import { createCanvas, registerFont } from "canvas";
import fs from "node:fs";
import path from "node:path";
import { FPS, LAYOUT } from "./settings.js";
import { Display } from "@owowagency/flipdot-emu";
// Keep side-effect import for parity with Casper's structure
import "./preview.js";
// Also import the helper we expose for our features
import { getMajorityMood } from "./preview.js";
import http from "node:http";
import { fileURLToPath } from "node:url";

const IS_DEV = process.argv.includes("--dev");

// Create display
const display = new Display({
	layout: LAYOUT,
	panelWidth: 28,
	isMirrored: true,
	transport: !IS_DEV ? {
		type: 'serial',
		path: '/dev/ttyACM0',
		baudRate: 57600
	} : {
		type: 'ip',
		host: '127.0.0.1',
		port: 3000
	}
});

const { width, height } = display;

// 1. Create output directory if it doesn't exist
const outputDir = "./output";
if (!fs.existsSync(outputDir)) {
	fs.mkdirSync(outputDir, { recursive: true });
}

// 2. Register fonts
// Resolve current file directory in ESM
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

registerFont(
	path.resolve(__dirname, "../fonts/OpenSans-Variable.ttf"),
	{ family: "OpenSans" },
);
registerFont(
	path.resolve(__dirname, "../fonts/PPNeueMontrealMono-Regular.ttf"),
	{ family: "PPNeueMontreal" },
);
registerFont(path.resolve(__dirname, "../fonts/Px437_ACM_VGA.ttf"), {
	family: "Px437_ACM_VGA",
});

// 3. Create canvas with the specified resolution
const canvas = createCanvas(width, height);
const ctx = canvas.getContext("2d");

// Disable anti-aliasing and image smoothing
ctx.imageSmoothingEnabled = false;
// Set a pixel-perfect monospace font
ctx.font = "18px monospace";
// Align text precisely to pixel boundaries
ctx.textBaseline = "top";

// 4. Initialize the ticker at x frames per second
const ticker = new Ticker({ fps: FPS });

// Helper: Draw a big dot-matrix style smiley (😃) on the canvas
// White face, black eyes and mouth, with teeth; all monochrome, crisp for flipdots
function drawSmiley({ ctx, width, height, elapsedTime }) {
	// Animation: very subtle pulse (reduced amplitude)
	const pulse = 1 + Math.sin(elapsedTime / 900) * 0.015;

	// Compute centered square area to place the face
	const size = Math.min(width, height) * 0.9 * pulse;
	const cx = Math.floor(width / 2);
	const cy = Math.floor(height / 2);
	const r = size / 2;

	// Face (white filled circle)
	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	// Eyes (black)
	// Slight bounce on Y for a friendly vibe
	const eyeBounce = Math.sin(elapsedTime / 700) * (r * 0.02);
	const eyeOffsetX = r * 0.38;
	const eyeOffsetY = r * 0.25 + eyeBounce;
	const eyeRadius = Math.max(1, r * 0.09);
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.fill();

	// Mouth (black rounded rect-ish)
	// Animate smile curvature (bigger/smaller)
	const t = (Math.sin(elapsedTime / 1200) + 1) / 2; // 0..1
	const mouthWidth = r * 1.1;
	const mouthY = cy + r * 0.28;
	const x1 = cx - mouthWidth / 2;
	const x2 = cx + mouthWidth / 2;
	const curveDepth = r * (0.08 + t * 0.25); // how big the smile is

	ctx.strokeStyle = "#000";
	ctx.lineWidth = Math.max(1, r * 0.16);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(x1, mouthY);
	ctx.quadraticCurveTo(cx, mouthY + curveDepth, x2, mouthY);
	ctx.stroke();
}

// Helper: Draw a sad face (🙁)
function drawSad({ ctx, width, height, elapsedTime }) {
	const pulse = 1 + Math.sin(elapsedTime / 1100) * 0.012;
	const size = Math.min(width, height) * 0.9 * pulse;
	const cx = Math.floor(width / 2);
	const cy = Math.floor(height / 2);
	const r = size / 2;

	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	const eyeBounce = Math.sin(elapsedTime / 700) * (r * 0.02);
	const eyeOffsetX = r * 0.38;
	const eyeOffsetY = r * 0.25 + eyeBounce;
	const eyeRadius = Math.max(1, r * 0.09);
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.fill();

	// Inverted mouth (frown) with animated curvature
	const t = (Math.sin(elapsedTime / 1200) + 1) / 2; // 0..1
	const mouthWidth = r * 1.1;
	const mouthY = cy + r * 0.15; // slightly higher than smile
	const x1 = cx - mouthWidth / 2;
	const x2 = cx + mouthWidth / 2;
	const curveDepth = r * (0.08 + t * 0.25);

	ctx.strokeStyle = "#000";
	ctx.lineWidth = Math.max(1, r * 0.16);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(x1, mouthY);
	ctx.quadraticCurveTo(cx, mouthY - curveDepth, x2, mouthY);
	ctx.stroke();
}

// Helper: Draw a neutral face (😐)
function drawNeutral({ ctx, width, height, elapsedTime }) {
	const pulse = 1 + Math.sin(elapsedTime / 1300) * 0.006;
	const size = Math.min(width, height) * 0.9 * pulse;
	const cx = Math.floor(width / 2);
	const cy = Math.floor(height / 2);
	const r = size / 2;

	ctx.fillStyle = "#fff";
	ctx.beginPath();
	ctx.arc(cx, cy, r, 0, Math.PI * 2);
	ctx.fill();

	const eyeOffsetX = r * 0.38;
	const eyeOffsetY = r * 0.25;
	const eyeRadius = Math.max(1, r * 0.09);
	ctx.fillStyle = "#000";
	ctx.beginPath();
	ctx.arc(cx - eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.arc(cx + eyeOffsetX, cy - eyeOffsetY, eyeRadius, 0, Math.PI * 2);
	ctx.fill();

	// Flat mouth
	const mouthWidth = r * 1.1;
	const mouthY = cy + r * 0.28;
	const x1 = cx - mouthWidth / 2;
	const x2 = cx + mouthWidth / 2;
	ctx.strokeStyle = "#000";
	ctx.lineWidth = Math.max(1, r * 0.16);
	ctx.lineCap = "round";
	ctx.beginPath();
	ctx.moveTo(x1, mouthY);
	ctx.lineTo(x2, mouthY);
	ctx.stroke();
}

// Scene selection via env var; default to 'mood'. Options: 'mood' | 'clock' | 'demo2' | 'tally'
let SCENE = process.env.SCENE ? String(process.env.SCENE).toLowerCase() : 'mood';
let __lastSceneCheck = 0;
async function fetchActiveScene(){
    const now = Date.now();
    if (now - __lastSceneCheck < 400) return SCENE; // throttle ~2.5Hz
    __lastSceneCheck = now;
    try{
        const { scene } = await new Promise(resolve => {
            const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/scene', method: 'GET' }, res => {
                let data = '';
                res.on('data', c => data += c);
                res.on('end', () => {
                    try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); }
                });
            });
            req.on('error', () => resolve({}));
            req.end();
        });
        if (scene === 'mood' || scene === 'clock' || scene === 'demo2' || scene === 'tally' || scene === 'fact' || scene === 'next' || scene === 'anim') SCENE = scene;
    }catch{}
    return SCENE;
}

// Simple scenes registry
function renderScene({ scene, ctx, width, height, elapsedTime }) {
	if (scene === 'clock') {
		ctx.fillStyle = '#fff';
		const now = new Date();
		const hh = String(now.getHours()).padStart(2, '0');
		const mm = String(now.getMinutes()).padStart(2, '0');
		const ss = String(now.getSeconds()).padStart(2, '0');
		const text = `${hh}:${mm}:${ss}`;
		// Auto-scale font to fit width with small margin
		const baseSize = 24;
		ctx.font = `${baseSize}px PPNeueMontreal`;
		let metrics = ctx.measureText(text);
		const marginX = 4;
		const availableWidth = Math.max(1, width - marginX * 2);
		let scale = Math.min(1, availableWidth / Math.max(1, metrics.width));
		let fontSize = Math.max(12, Math.floor(baseSize * scale));
		ctx.font = `${fontSize}px PPNeueMontreal`;
		metrics = ctx.measureText(text);
		const x = Math.max(marginX, Math.floor((width - metrics.width) / 2));
		const y = Math.floor(height / 2 - fontSize / 2);
		ctx.fillText(text, x, y);
		return;
	}

	if (scene === 'demo2') {
		ctx.fillStyle = '#fff';
		ctx.font = '18px Px437_ACM_VGA';
		const text = 'Demo 2';
		const metrics = ctx.measureText(text);
		const x = Math.max(0, Math.floor((width - metrics.width) / 2));
		const y = Math.floor(height / 2 - 9);
		ctx.fillText(text, x, y);
		return;
	}

	if (scene === 'tally') {
		// will be handled in main loop (fetches server scores)
		return;
	}

	if (scene === 'next') {
		// handled in main loop as well (fetches /next)
		return;
	}

    // no-op for other scenes

	// default scene: mood faces
	const { majority } = getMajorityMood();
	if (majority === 'sad') {
		drawSad({ ctx, width, height, elapsedTime });
	} else if (majority === 'neutral') {
		drawNeutral({ ctx, width, height, elapsedTime });
	} else {
		drawSmiley({ ctx, width, height, elapsedTime });
	}
}

ticker.start(async ({ deltaTime, elapsedTime }) => {
	ctx.clearRect(0, 0, width, height);

	// Fill the canvas with a black background
	ctx.fillStyle = "#000";
	ctx.fillRect(0, 0, width, height);

	// Render scene based on current selection
	const currentScene = await fetchActiveScene();
	// Reset per-scene state on change to prevent stale visuals
	if (globalThis.__scenePrev !== currentScene) {
		globalThis.__scenePrev = currentScene;
		if (globalThis.__runnerFall) delete globalThis.__runnerFall;
		// reset fact loading state lightly so it can fetch soon
		if (globalThis.__factCache) { globalThis.__factCache.loading = false; globalThis.__factCache.nextAt = 0; }
	}
	if (currentScene === 'tally') {
		// fetch tally game state
		const { a, b, lastTs } = await new Promise(resolve => {
			const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/tallygame', method: 'GET' }, res => {
				let data = '';
				res.on('data', c => data += c);
				res.on('end', () => {
					try {
						const j = JSON.parse(data || '{}');
						resolve({ a: Number(j.a)||0, b: Number(j.b)||0, lastTs: Number(j.lastTs)||0 });
					} catch { resolve({ a:0, b:0, lastTs:0 }); }
				});
			});
			req.on('error', ()=>resolve({ a:0, b:0, lastTs:0 }));
			req.end();
		});

		// render big numeric scores instead of tallies
		const mid = Math.floor(width / 2);
		const padX = 6;
		const padY = 2;
		const leftText = String(a|0);
		const rightText = String(b|0);
		function drawFittedNumber(text, xStart, xEnd) {
			const availW = Math.max(1, xEnd - xStart - padX * 2);
			// binary search a font size that fits width and height
			let lo = 6, hi = Math.max(12, Math.min(width, height));
			let best = lo;
			while (lo <= hi) {
				const midSize = Math.floor((lo + hi) / 2);
				ctx.font = `${midSize}px PPNeueMontreal`;
				const m = ctx.measureText(text);
				const fitsW = m.width <= availW;
				const fitsH = midSize <= (height - padY * 2);
				if (fitsW && fitsH) { best = midSize; lo = midSize + 1; } else { hi = midSize - 1; }
			}
			ctx.font = `${best}px PPNeueMontreal`;
			ctx.fillStyle = '#fff';
			const metrics = ctx.measureText(text);
			const tx = Math.floor(xStart + (xEnd - xStart - metrics.width) / 2);
			const ty = Math.floor((height - best) / 2);
			ctx.fillText(text, tx, ty);
		}
		drawFittedNumber(leftText, 0, mid);
		drawFittedNumber(rightText, mid, width);

		// vertical divider
		ctx.fillStyle = '#fff';
		ctx.fillRect(mid - 1, 0, 2, height);

	} else if (currentScene === 'demo2') {
		// Ski slope with random holes: a dot skis along and can fall into holes if not jumping
		const state = await new Promise(resolve => {
			const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/ski', method: 'GET' }, res => {
				let data = '';
				res.on('data', c => data += c);
				res.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
			});
			req.on('error', () => resolve({}));
			req.end();
		});
		const { lastJumpTs = 0, jumpWindowMs = 600, resetAt = 0, started = false } = state;
		const tsec = elapsedTime / 1300; // slower
		const midY = Math.floor(height * 0.7);
		const amp = Math.max(3, Math.floor(height * 0.18));
		const scrollPxPerSec = Math.max(16, Math.floor(width * 0.75));
		const freq = (2 * Math.PI) / Math.max(24, Math.floor(width * 0.9));
		const phase = tsec * scrollPxPerSec; // world pixels scrolled
		// Freeze scroll while falling so hole stays aligned under the dot
		if (!globalThis.__runnerFall || resetAt !== (globalThis.__runnerFall.resetAt||0)) {
			globalThis.__runnerFall = { falling: false, y: 0, resetAt, fallPhase: undefined };
		}
		const isFalling = !!globalThis.__runnerFall.falling;
		const phaseEff = isFalling && globalThis.__runnerFall.fallPhase !== undefined ? globalThis.__runnerFall.fallPhase : phase;

		// Pseudo-random holes per segment along the ground
		const segLen = Math.max(18, Math.floor(width * 0.35));
		const holeWidth = Math.max(3, Math.floor(segLen * 0.22));
		function rand01(n){ let x = Math.imul((n ^ 0x9e3779b9) >>> 0, 0x85ebca6b); x ^= x >>> 15; x = Math.imul(x, 0xc2b2ae35); x ^= x >>> 16; return (x >>> 0) / 0xFFFFFFFF; }
		const holeChance = 0.22; // fewer holes
		const startSafeDistance = Math.floor(width * 0.15); // allow holes sooner near the player

		// Build hole mask for this frame using effective phase (frozen during fall)
		const holeMask = new Array(width);
		for (let x = 0; x < width; x++) {
			const worldX = x + phaseEff;
			const segIdx = Math.floor(worldX / segLen);
			const offset = worldX - segIdx * segLen;
			const r = rand01(segIdx);
			const hasHole = (started || isFalling) && r < holeChance && worldX > phaseEff + startSafeDistance;
			const holeStart = Math.floor(r * Math.max(1, segLen - holeWidth));
			holeMask[x] = hasHole && offset >= holeStart && offset < holeStart + holeWidth;
		}

		// Ground rendering with holes
		ctx.fillStyle = '#fff';
		for (let x = 0; x < width; x++) {
			const worldX = x + phaseEff;
			const gyBase = midY + Math.floor(amp * Math.sin(worldX * freq));
			// If falling, keep the hole screen window open so the skier can be seen falling in
			const inFrozenHole = !!globalThis.__runnerFall && globalThis.__runnerFall.falling && typeof globalThis.__runnerFall.holeX0 === 'number' && x >= globalThis.__runnerFall.holeX0 && x <= globalThis.__runnerFall.holeX1;
			if (!holeMask[x] && !inFrozenHole) {
				const gy = Math.min(height - 1, gyBase);
				ctx.fillRect(x, gy, 1, Math.max(0, height - gy));
			}
		}
		// Carve holes to black using the same mask and frozen span so ground cannot "heal" holes
		ctx.fillStyle = '#000';
		for (let x = 0; x < width; x++) {
			const worldX = x + phaseEff;
			const gy = Math.min(height - 1, midY + Math.floor(amp * Math.sin(worldX * freq)));
			const inFrozenHole = !!globalThis.__runnerFall && globalThis.__runnerFall.falling && typeof globalThis.__runnerFall.holeX0 === 'number' && x >= globalThis.__runnerFall.holeX0 && x <= globalThis.__runnerFall.holeX1;
			if (holeMask[x] || inFrozenHole) {
				ctx.fillRect(x, gy, 1, Math.max(0, height - gy));
			}
		}

		const playerX = Math.floor(width * 0.25);
		const groundYAt = (wx)=> midY + Math.floor(amp * Math.sin(wx * freq));
		const playerWorldX = playerX + phaseEff;
		// Check hole under the full player footprint (5px wide)
		let isHoleHere = false;
		for (let px = Math.max(0, playerX - 2); px <= Math.min(width - 1, playerX + 2); px++) {
			if (holeMask[px]) { isHoleHere = true; break; }
		}
		let jumpOffset = 0;
		if (lastJumpTs && jumpWindowMs) {
			const since = (Date.now() - lastJumpTs);
			if (since >= 0 && since < jumpWindowMs) {
				const u = since / jumpWindowMs;
				const arc = 4 * u * (1 - u);
				jumpOffset = -Math.floor(arc * Math.max(5, Math.floor(height * 0.22)));
			}
		}
		// local fall state across frames
		if (!globalThis.__runnerFall || resetAt !== (globalThis.__runnerFall.resetAt||0)) {
			globalThis.__runnerFall = { falling: false, y: 0, resetAt };
		}
		const groundY = groundYAt(playerWorldX);
		if (!globalThis.__runnerFall.falling) {
			if (started && isHoleHere && jumpOffset === 0) {
				globalThis.__runnerFall.falling = true;
				globalThis.__runnerFall.y = groundY - 3;
				globalThis.__runnerFall.fallPhase = phaseEff; // freeze scroll so hole stays under the dot
				// persist the on-screen hole span from the mask, expanded to the player footprint
				let x0 = Math.max(0, playerX - 2), x1 = Math.min(width - 1, playerX + 2);
                while (x0 > 0 && holeMask[x0 - 1]) x0--;
                while (x1 < width - 1 && holeMask[x1 + 1]) x1++;
                globalThis.__runnerFall.holeX0 = x0;
                globalThis.__runnerFall.holeX1 = x1;
				// notify server to stop the game (game over)
				try {
					await new Promise(resolve => {
						const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/ski/stop', method: 'POST' }, res => { res.on('data', ()=>{}); res.on('end', resolve); });
						req.on('error', resolve);
						req.end();
					});
				} catch {}
			}
		}
		let drawY;
		if (globalThis.__runnerFall.falling) {
			const step = Math.max(1, Math.floor(height * 0.03));
			globalThis.__runnerFall.y = Math.min(height - 1, globalThis.__runnerFall.y + step);
			drawY = globalThis.__runnerFall.y;
		} else {
			drawY = Math.max(0, groundY + jumpOffset - 3);
		}
		ctx.fillStyle = '#fff';
		ctx.fillRect(playerX - 2, drawY, 5, 5);
		// Not started → hint; Stopped after fall → 'Game Over'
		if (!started) {
			ctx.font = `${Math.max(8, Math.floor(height * 0.18))}px PPNeueMontreal`;
			const msg = (globalThis.__runnerFall.falling ? 'Game Over' : 'Press Start');
			const m = ctx.measureText(msg);
			ctx.fillText(msg, Math.max(1, Math.floor((width - m.width) / 2)), 1);
		}
	} else if (currentScene === 'fact') {
 		if (!globalThis.__factCache) globalThis.__factCache = { text: '', nextAt: 0, loading: false };
		if (Date.now() > globalThis.__factCache.nextAt && !globalThis.__factCache.loading) {
 			globalThis.__factCache.loading = true;
			globalThis.__factCache.nextAt = Date.now() + 30000; // give more time to read before next fetch
 			// fire-and-forget fetch to avoid blocking the frame
 			(async () => {
 				try {
 					const controller = new AbortController();
 					const t = setTimeout(() => controller.abort(), 4000);
 					const res = await fetch('https://uselessfacts.jsph.pl/random.json?language=en', {
 						headers: { 'Accept': 'application/json', 'User-Agent': 'flipdots/1.0 (+https://localhost)' },
 						signal: controller.signal,
 					});
 					clearTimeout(t);
 					if (res.ok) {
 						const j = await res.json();
 						globalThis.__factCache.text = String((j && j.text) || '').trim();
 					} else {
 						globalThis.__factCache.text = 'FACT FETCH FAILED';
 					}
 				} catch (e) {
 					if (!globalThis.__factCache.text) globalThis.__factCache.text = 'FACT FETCH FAILED';
 				} finally {
 					globalThis.__factCache.loading = false;
 				}
 			})();
 		}
 		let fact = globalThis.__factCache.text;
 		if (!fact) fact = globalThis.__factCache.loading ? 'LOADING…' : 'NO FACT';
 		// scrolling marquee right -> left
 		if (!globalThis.__factScroll) globalThis.__factScroll = { x: 0, w: 0, text: '', lastTs: 0 };
 		ctx.fillStyle = '#fff';
 		ctx.font = '10px Px437_ACM_VGA';
 		// if text changed, recompute width and reset
 		if (globalThis.__factScroll.text !== fact) {
 			globalThis.__factScroll.text = fact;
 			globalThis.__factScroll.w = Math.ceil(ctx.measureText(fact).width);
 			globalThis.__factScroll.x = width;
 			globalThis.__factScroll.lastTs = elapsedTime;
 		}
 		const speedPxPerSec = Math.max(2, Math.floor(width * 0.18)); // a bit faster
 		const dtSec = Math.max(0, (elapsedTime - (globalThis.__factScroll.lastTs || elapsedTime)) / 1000);
 		globalThis.__factScroll.lastTs = elapsedTime;
 		globalThis.__factScroll.x -= speedPxPerSec * dtSec;
 		if (globalThis.__factScroll.x < -globalThis.__factScroll.w) {
 			globalThis.__factScroll.x = width;
 		}
 		const y = Math.floor(height / 2 - 8); // iets hoger door grotere tekst
 		const x1 = Math.floor(globalThis.__factScroll.x);
 		ctx.fillText(fact, x1, y);
 		// draw second copy to avoid gap when wrapping
 		const x2 = x1 + globalThis.__factScroll.w + 8;
		if (x2 > -globalThis.__factScroll.w) ctx.fillText(fact, x2, y);
	} else if (currentScene === 'next') {
		// fetch current next name
		const { name } = await new Promise(resolve => {
			const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/next', method: 'GET' }, res => {
				let data = '';
				res.on('data', c => data += c);
				res.on('end', () => { try { const j = JSON.parse(data||'{}'); resolve({ name: String(j.name||'') }); } catch { resolve({ name: '' }); } });
			});
			req.on('error', () => resolve({ name: '' }));
			req.end();
		});
		const title = 'WHO\u00A0IS\u00A0NEXT';
		ctx.fillStyle = '#fff';
		// Title
		ctx.font = `${Math.max(8, Math.floor(height * 0.22))}px PPNeueMontreal`;
		let m = ctx.measureText(title);
		ctx.fillText(title, Math.max(1, Math.floor((width - m.width) / 2)), 1);
		// Name big
		const text = name || '—';
		let lo = 8, hi = Math.max(12, Math.min(width, Math.floor(height * 0.9)));
		let best = lo;
		const padX = 4;
		const availW = Math.max(1, width - padX * 2);
		const availH = Math.max(1, height - Math.floor(height * 0.28) - 2);
		while (lo <= hi) {
			const midSize = Math.floor((lo + hi) / 2);
			ctx.font = `${midSize}px PPNeueMontreal`;
			m = ctx.measureText(text);
			const fitsW = m.width <= availW;
			const fitsH = midSize <= availH;
			if (fitsW && fitsH) { best = midSize; lo = midSize + 1; } else { hi = midSize - 1; }
		}
		ctx.font = `${best}px PPNeueMontreal`;
		m = ctx.measureText(text);
		const tx = Math.max(1, Math.floor((width - m.width) / 2));
		const ty = Math.max(1 + Math.floor(height * 0.28), Math.floor((height - best) / 2));
		ctx.fillText(text, tx, ty);
	} else if (currentScene === 'anim') {
		// Animation scene: plays frames saved via /anim/state
		if (!globalThis.__animCache) globalThis.__animCache = { w: 0, h: 0, frames: [], lastFetch: 0, fetchMs: 1000 };
		const cache = globalThis.__animCache;
		// Periodically refresh animation state (1s)
		if ((Date.now() - cache.lastFetch) > cache.fetchMs) {
			try{
				cache.lastFetch = Date.now();
				const { w, h, frames, name } = await new Promise(resolve => {
					const req = http.request({ hostname: '127.0.0.1', port: 3000, path: '/anim/state', method: 'GET' }, res => {
						let data = '';
						res.on('data', c => data += c);
						res.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
					});
					req.on('error', () => resolve({}));
					req.end();
				});
				if (Array.isArray(frames) && frames.length) {
					cache.w = Number(w)||width; cache.h = Number(h)||height;
					cache.frames = frames.map(f => ({ bits: String(f.bits||''), durationMs: Math.max(10, Number(f.durationMs)||300) }));
					cache.name = String(name||'');
				}
			}catch{}
		}
		// Ensure at least one frame
		if (!cache.frames.length) {
			// fallback: simple blinking box
			const on = Math.floor((Date.now()/400)) % 2 === 0;
			ctx.fillStyle = on ? '#fff' : '#000';
			const s = Math.floor(Math.min(width, height) * 0.6);
			ctx.fillRect(Math.floor((width-s)/2), Math.floor((height-s)/2), s, s);
		} else {
			// Advance through frames based on per-frame durations; keep local playhead
			if (!cache.play) cache.play = { idx: 0, nextAt: 0 };
			const nowMs = Date.now();
			if (nowMs >= (cache.play.nextAt||0)) {
				cache.play.idx = (cache.play.idx + 1) % cache.frames.length;
				cache.play.nextAt = nowMs + (cache.frames[cache.play.idx].durationMs||300);
			}
			const fr = cache.frames[cache.play.idx];
			// Draw bits to canvas; if stored size differs, scale to display size (nearest)
			const fw = cache.w||width, fh = cache.h||height;
			ctx.fillStyle = '#000'; ctx.fillRect(0,0,width,height);
			ctx.fillStyle = '#fff';
			for (let y=0;y<height;y++){
				const sy = Math.floor(y * fh / height);
				for (let x=0;x<width;x++){
					const sx = Math.floor(x * fw / width);
					const idxBit = sy * fw + sx;
					if (fr.bits.charAt(idxBit) === '1') ctx.fillRect(x, y, 1, 1);
				}
			}
			// Optional text overlay tied to current animation
			if (cache.name) {
				if (!globalThis.__animText) globalThis.__animText = { x: 0, w: 0, lastTs: 0, text: '', lastPoll: 0 };
				if (Date.now() - (globalThis.__animText.lastPoll||0) > 1400) {
					globalThis.__animText.lastPoll = Date.now();
					(async () => { try{
						const pathQ = '/anim/text?name=' + encodeURIComponent(cache.name);
						const { text } = await new Promise(resolve => {
							const req = http.request({ hostname: '127.0.0.1', port: 3000, path: pathQ, method: 'GET' }, res => {
								let data = '';
								res.on('data', c => data += c);
								res.on('end', () => { try { resolve(JSON.parse(data||'{}')); } catch { resolve({}); } });
							});
							req.on('error', () => resolve({}));
							req.end();
						});
						if (typeof text === 'string') globalThis.__animText.text = text;
					}catch{} })();
				}
				const overlay = String(globalThis.__animText.text||'').trim();
				if (overlay) {
					ctx.fillStyle = '#fff';
					ctx.font = '10px Px437_ACM_VGA';
					if (globalThis.__animText.msg !== overlay) {
						globalThis.__animText.msg = overlay;
						globalThis.__animText.w = Math.ceil(ctx.measureText(overlay).width);
						globalThis.__animText.x = width;
						globalThis.__animText.lastTs = elapsedTime;
					}
					const speed = Math.max(2, Math.floor(width * 0.16));
					const dt = Math.max(0, (elapsedTime - (globalThis.__animText.lastTs||elapsedTime)) / 1000);
					globalThis.__animText.lastTs = elapsedTime;
					globalThis.__animText.x -= speed * dt;
					if (globalThis.__animText.x < -globalThis.__animText.w) globalThis.__animText.x = width;
					const y = Math.max(1, Math.floor(height - 10));
					const x1 = Math.floor(globalThis.__animText.x);
					ctx.fillText(overlay, x1, y);
					const x2 = x1 + globalThis.__animText.w + 8;
					if (x2 > -globalThis.__animText.w) ctx.fillText(overlay, x2, y);
				}
			}
		}
	} else {
		renderScene({ scene: currentScene, ctx, width, height, elapsedTime });
	}

	// Convert image to binary (purely black and white) for flipdot display
	{
		const imageData = ctx.getImageData(0, 0, width, height);
		const data = imageData.data;
		let bits = '';
		for (let i = 0; i < data.length; i += 4) {
			// Apply thresholding - any pixel above 127 brightness becomes white (255), otherwise black (0)
			const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
			const isOn = brightness > 127 ? 1 : 0;
			const binary = isOn ? 255 : 0;
			data[i] = binary; // R
			data[i + 1] = binary; // G
			data[i + 2] = binary; // B
			data[i + 3] = 255; // The board is not transparent :-)
			bits += isOn ? '1' : '0';
		}
		ctx.putImageData(imageData, 0, 0);
		// expose latest bits for preview server
		globalThis.__frameBitmap = { w: width, h: height, bits };
	}

	// Always keep an in-memory PNG for preview servers
	try { globalThis.__framePNG = canvas.toBuffer("image/png"); } catch {}

	if (IS_DEV) {
		// Dev mode - PNG is kept in memory for /frame.png endpoint
		// No file writing to avoid heavy I/O
	} else {
		const imageData = ctx.getImageData(0, 0, display.width, display.height);
		display.setImageData(imageData);
		if (display.isDirty()) {
			display.flush();
		}
	}
});

