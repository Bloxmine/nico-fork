module.exports = [
"[project]/src/lib/display/ticker.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/**
 * Ticker - A requestAnimationFrame-like solution for Node.js
 * with controllable framerate
 */ __turbopack_context__.s([
    "Ticker",
    ()=>Ticker
]);
class Ticker {
    fps;
    callback;
    isRunning;
    lastFrameTime;
    frameInterval;
    timeoutId = null;
    constructor(options = {}){
        this.fps = options.fps || 60;
        this.callback = null;
        this.isRunning = false;
        this.lastFrameTime = 0;
        this.frameInterval = 1000 / this.fps;
    }
    start(callback) {
        if (this.isRunning) return this;
        this.callback = callback;
        this.isRunning = true;
        this.lastFrameTime = Date.now();
        this._tick();
        return this;
    }
    stop() {
        this.isRunning = false;
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
            this.timeoutId = null;
        }
        return this;
    }
    _tick() {
        if (!this.isRunning) return;
        const now = Date.now();
        const timeDelta = now - this.lastFrameTime;
        if (timeDelta >= this.frameInterval) {
            // Adjust for drifting
            this.lastFrameTime = now - timeDelta % this.frameInterval;
            // Calculate normalized delta (1.0 = exact frame rate)
            const normalizedDelta = timeDelta / this.frameInterval;
            if (this.callback) {
                this.callback({
                    deltaTime: normalizedDelta,
                    elapsedTime: now
                });
            }
        }
        // Use setTimeout for Node.js compatibility
        this.timeoutId = setTimeout(()=>this._tick(), 0);
    }
}
}),
"[externals]/canvas [external] (canvas, cjs)", ((__turbopack_context__, module, exports) => {

const mod = __turbopack_context__.x("canvas", () => require("canvas"));

module.exports = mod;
}),
"[project]/src/lib/display/display-manager.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

/* eslint-disable @typescript-eslint/no-explicit-any */ __turbopack_context__.s([
    "DisplayManager",
    ()=>DisplayManager
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$externals$5d2f$canvas__$5b$external$5d$__$28$canvas$2c$__cjs$29$__ = __turbopack_context__.i("[externals]/canvas [external] (canvas, cjs)");
;
;
class DisplayManager {
    canvas;
    ctx;
    config;
    currentRenderer = null;
    constructor(config){
        this.config = config;
        // Use server-side canvas from 'canvas' package
        this.canvas = (0, __TURBOPACK__imported__module__$5b$externals$5d2f$canvas__$5b$external$5d$__$28$canvas$2c$__cjs$29$__["createCanvas"])(config.width, config.height);
        this.ctx = this.canvas.getContext("2d");
        // Disable anti-aliasing for pixel-perfect rendering
        this.ctx.imageSmoothingEnabled = false;
        this.ctx.textBaseline = "top";
    }
    setRenderer(renderer) {
        this.currentRenderer = renderer;
    }
    async render(frame) {
        const { ctx, config } = this;
        // Clear canvas
        ctx.clearRect(0, 0, config.width, config.height);
        // Fill with black background
        ctx.fillStyle = "#000";
        ctx.fillRect(0, 0, config.width, config.height);
        // Render current animation
        if (this.currentRenderer) {
            this.currentRenderer(ctx, frame, config);
        }
        // Convert to binary (black and white only)
        const imageData = ctx.getImageData(0, 0, config.width, config.height);
        const data = imageData.data;
        for(let i = 0; i < data.length; i += 4){
            const brightness = (data[i] + data[i + 1] + data[i + 2]) / 3;
            const binary = brightness > 127 ? 255 : 0;
            data[i] = binary;
            data[i + 1] = binary;
            data[i + 2] = binary;
            data[i + 3] = 255;
        }
        ctx.putImageData(imageData, 0, 0);
        // Convert canvas to buffer using server-side canvas
        return this.canvas.toBuffer("image/png");
    }
    getConfig() {
        return this.config;
    }
}
}),
"[project]/src/lib/display/settings.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "FPS",
    ()=>FPS,
    "LAYOUT",
    ()=>LAYOUT
]);
const FPS = 15;
const LAYOUT = [
    [
        3,
        2,
        1
    ],
    [
        4,
        5,
        6
    ],
    [
        9,
        8,
        7
    ],
    [
        10,
        11,
        12
    ]
];
}),
"[project]/src/lib/animations/star-bounce.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "starBounceAnimation",
    ()=>starBounceAnimation,
    "starBounceMetadata",
    ()=>starBounceMetadata
]);
const starBounceMetadata = {
    id: "1",
    name: "Star animation",
    description: "Displays a star that moves in different directions",
    status: "Equiped"
};
const starBounceAnimation = (ctx, frame, config)=>{
    const { width, height } = config;
    const { elapsedTime } = frame;
    // Draw a bouncing star
    const size = 8;
    const w = width - size;
    const sine = Math.sin(elapsedTime / 1000);
    const x = Math.floor((sine + 1) / 2 * w);
    const y = height / 2 - size / 2;
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.fill();
};
}),
"[project]/src/lib/animations/timer.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "timerAnimation",
    ()=>timerAnimation,
    "timerMetadata",
    ()=>timerMetadata
]);
const timerMetadata = {
    id: "timer",
    name: "Timer animation",
    description: "Displays elapsed time in seconds",
    status: "Available"
};
const timerAnimation = (ctx, frame, config)=>{
    const { elapsedTime } = frame;
    const text = (elapsedTime / 1000).toFixed(2);
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.font = "14px monospace";
    const metrics = ctx.measureText(text);
    ctx.fillText(text, 2, 2);
};
}),
"[project]/src/lib/animations/logo.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "logoAnimation",
    ()=>logoAnimation,
    "logoMetadata",
    ()=>logoMetadata
]);
const logoMetadata = {
    id: "logo",
    name: "Logo animation",
    description: "Displays the OWOW logo",
    status: "Available"
};
const logoAnimation = (ctx, frame, config)=>{
    const { width } = config;
    const text = "OWOW";
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.font = "bold 12px sans-serif";
    const metrics = ctx.measureText(text);
    ctx.fillText(text, width - metrics.width - 2, 2);
};
}),
"[project]/src/lib/animations/wave.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "waveAnimation",
    ()=>waveAnimation,
    "waveMetadata",
    ()=>waveMetadata
]);
const waveMetadata = {
    id: "wave",
    name: "Wave animation",
    description: "A sine wave that moves across the screen",
    thumbnail: "/api/thumbnail/wave",
    status: "Available"
};
const waveAnimation = (ctx, frame, config)=>{
    if (!ctx) return;
    const { width, height } = config;
    const { elapsedTime } = frame;
    ctx.fillStyle = "#fff";
    // Draw a sine wave
    const amplitude = height / 3;
    const frequency = 0.05;
    const speed = 0.002;
    for(let x = 0; x < width; x++){
        const y = height / 2 + Math.sin(x * frequency + elapsedTime * speed) * amplitude;
        // Draw a small circle at each point
        ctx.beginPath();
        ctx.arc(x, Math.floor(y), 1, 0, Math.PI * 2);
        ctx.fill();
    }
};
}),
"[project]/src/lib/animations/text-scroll.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "textScrollAnimation",
    ()=>textScrollAnimation,
    "textScrollMetadata",
    ()=>textScrollMetadata
]);
const textScrollMetadata = {
    id: "text-scroll",
    name: "Text scroll",
    description: "Scrolling text message across the display",
    thumbnail: "/api/thumbnail/text-scroll",
    status: "Available"
};
const textScrollAnimation = (ctx, frame, config)=>{
    if (!ctx) return;
    const { width, height } = config;
    const { elapsedTime } = frame;
    const text = "HELLO WORLD! ";
    ctx.fillStyle = "#fff";
    ctx.font = "12px monospace";
    // Calculate scroll position
    const scrollSpeed = 0.05;
    const textWidth = ctx.measureText(text).width;
    const offset = elapsedTime * scrollSpeed % (textWidth + width);
    // Draw text scrolling from right to left
    const x = width - offset;
    const y = height / 2 - 6;
    ctx.fillText(text, Math.floor(x), Math.floor(y));
    // Draw second copy for seamless loop
    if (x < 0) {
        ctx.fillText(text, Math.floor(x + textWidth), Math.floor(y));
    }
};
}),
"[project]/src/lib/animations/index.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "animations",
    ()=>animations,
    "getAllAnimations",
    ()=>getAllAnimations,
    "getAnimation",
    ()=>getAnimation
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$star$2d$bounce$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/star-bounce.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$timer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/timer.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$logo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/logo.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$wave$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/wave.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$text$2d$scroll$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/text-scroll.ts [app-route] (ecmascript)");
;
;
;
;
;
const animations = {
    "star-bounce": {
        renderer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$star$2d$bounce$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["starBounceAnimation"],
        metadata: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$star$2d$bounce$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["starBounceMetadata"]
    },
    timer: {
        renderer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$timer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["timerAnimation"],
        metadata: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$timer$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["timerMetadata"]
    },
    logo: {
        renderer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$logo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logoAnimation"],
        metadata: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$logo$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["logoMetadata"]
    },
    wave: {
        renderer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$wave$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["waveAnimation"],
        metadata: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$wave$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["waveMetadata"]
    },
    "text-scroll": {
        renderer: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$text$2d$scroll$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["textScrollAnimation"],
        metadata: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$text$2d$scroll$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["textScrollMetadata"]
    }
};
function getAnimation(id) {
    return animations[id];
}
function getAllAnimations() {
    return Object.values(animations).map((anim)=>anim.metadata);
}
}),
"[project]/src/lib/animation-engine.ts [app-route] (ecmascript)", ((__turbopack_context__) => {
"use strict";

__turbopack_context__.s([
    "animationEngine",
    ()=>animationEngine
]);
var __TURBOPACK__imported__module__$5b$project$5d2f$node_modules$2f$next$2f$dist$2f$compiled$2f$server$2d$only$2f$empty$2e$js__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$ticker$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/display/ticker.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$display$2d$manager$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/display/display-manager.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$settings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/display/settings.ts [app-route] (ecmascript)");
var __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__ = __turbopack_context__.i("[project]/src/lib/animations/index.ts [app-route] (ecmascript)");
;
;
;
;
;
class AnimationEngine {
    displayManager;
    ticker;
    currentAnimationId = null;
    latestFrame = null;
    isRunning = false;
    constructor(){
        // 80x20 pixel display
        this.displayManager = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$display$2d$manager$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["DisplayManager"]({
            width: 80,
            height: 20,
            fps: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$settings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FPS"]
        });
        this.ticker = new __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$ticker$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["Ticker"]({
            fps: __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$display$2f$settings$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["FPS"]
        });
    }
    start(animationId) {
        const animation = (0, __TURBOPACK__imported__module__$5b$project$5d2f$src$2f$lib$2f$animations$2f$index$2e$ts__$5b$app$2d$route$5d$__$28$ecmascript$29$__["getAnimation"])(animationId);
        if (!animation) {
            throw new Error(`Animation ${animationId} not found`);
        }
        this.currentAnimationId = animationId;
        this.displayManager.setRenderer(animation.renderer);
        if (!this.isRunning) {
            this.isRunning = true;
            this.ticker.start(async (frame)=>{
                this.latestFrame = await this.displayManager.render(frame);
            });
        }
    }
    stop() {
        this.ticker.stop();
        this.isRunning = false;
        this.latestFrame = null;
    }
    getLatestFrame() {
        return this.latestFrame;
    }
    getCurrentAnimationId() {
        return this.currentAnimationId;
    }
}
const animationEngine = new AnimationEngine();
}),
"[project]/node_modules/next/dist/compiled/server-only/empty.js [app-route] (ecmascript)", ((__turbopack_context__, module, exports) => {

}),
];

//# sourceMappingURL=%5Broot-of-the-server%5D__9d37ffb1._.js.map