const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');
const statusEl = document.getElementById('status');
const W = 500,
    H = 500;

// ----- Box boundaries -----
const WALL = 25;

// ----- Clock properties -----
const clockX = 250,
    clockY = 120,
    clockRadius = 80;

// =============================================
// 🎯 BALL PHYSICS (Full Physics)
// =============================================
const ball = {
    x: 250,
    y: 100,
    vx: 0,
    vy: 0,
    r: 13,
    mass: 1.0,

    // Physics properties
    gravity: 0.3,
    friction: 0.998,
    bounce: 0.85,
    tiltStrength: 0.15,

    // Limits
    maxSpeed: 28,
    minSpeed: 0.05,

    // Stats
    bounceCount: 0,
    energy: 0,

    // Trail
    trail: [],
    maxTrail: 40,

    // Resting state
    isResting: false,
    restFrames: 0,
    onGround: false, // Track if ball is on ground
};

// =============================================
// 🖱️ MOUSE / TOUCH STATE (GRABBING)
// =============================================
const mouse = {
    x: 0,
    y: 0,
    isDown: false,
    isGrabbing: false,
    grabOffsetX: 0,
    grabOffsetY: 0,
    prevX: 0,
    prevY: 0,
};

// ----- Keyboard state -----
const keys = {
    ArrowUp: false,
    ArrowDown: false,
    ArrowLeft: false,
    ArrowRight: false,
    w: false,
    a: false,
    s: false,
    d: false,
    g: false,
    r: false,
    space: false,
};

// ----- Clock time -----
let seconds = 0,
    minutes = 0,
    hours = 0;

// =============================================
// 🔊 SOUND SYSTEM
// =============================================
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new(window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playBounceSound(speed, wallType = 'wall') {
    try {
        initAudio();
        const oscillator = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        oscillator.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        let baseFreq = 200 + speed * 15;
        if (wallType === 'clock') baseFreq = 300 + speed * 12;
        else if (wallType === 'bottom') baseFreq = 150 + speed * 10;
        baseFreq = Math.min(Math.max(baseFreq, 100), 800);

        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, audioCtx.currentTime + 0.1);

        const volume = Math.min(0.3 + speed / 60, 0.6);
        gainNode.gain.setValueAtTime(volume, audioCtx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);

        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.12);

        if (speed > 5) {
            const osc2 = audioCtx.createOscillator();
            const gain2 = audioCtx.createGain();
            osc2.connect(gain2);
            gain2.connect(audioCtx.destination);
            osc2.type = 'triangle';
            osc2.frequency.setValueAtTime(baseFreq * 1.5, audioCtx.currentTime);
            osc2.frequency.exponentialRampToValueAtTime(baseFreq * 0.7, audioCtx.currentTime + 0.08);
            gain2.gain.setValueAtTime(volume * 0.3, audioCtx.currentTime);
            gain2.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            osc2.start(audioCtx.currentTime);
            osc2.stop(audioCtx.currentTime + 0.08);
        }

        if (wallType === 'bottom') {
            const osc3 = audioCtx.createOscillator();
            const gain3 = audioCtx.createGain();
            osc3.connect(gain3);
            gain3.connect(audioCtx.destination);
            osc3.type = 'sine';
            osc3.frequency.setValueAtTime(80, audioCtx.currentTime);
            osc3.frequency.exponentialRampToValueAtTime(40, audioCtx.currentTime + 0.08);
            gain3.gain.setValueAtTime(volume * 0.4, audioCtx.currentTime);
            gain3.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.08);
            osc3.start(audioCtx.currentTime);
            osc3.stop(audioCtx.currentTime + 0.08);
        }
    } catch (e) {}
}

// ----------------------------------------------
// 1. DEVICE ORIENTATION
// ----------------------------------------------
const tilt = {
    x: 0,
    y: 0,
    strength: 0.15,
};

function handleOrientation(event) {
    const beta = event.beta || 0;
    const gamma = event.gamma || 0;
    tilt.x = Math.max(-1, Math.min(1, gamma / 90));
    const betaNormalized = Math.max(-90, Math.min(90, beta));
    tilt.y = -betaNormalized / 90;
}

if (window.DeviceOrientationEvent) {
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                    statusEl.textContent = '📱 Tilt mode active!';
                } else {
                    statusEl.textContent = '⌨️ Using keyboard (WASD/Arrows)';
                }
            })
            .catch(() => {
                statusEl.textContent = '⌨️ Using keyboard (WASD/Arrows)';
            });
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
        statusEl.textContent = '📱 Tilt mode active!';
    }
} else {
    statusEl.textContent = '⌨️ Using keyboard (WASD/Arrows)';
}

// ----------------------------------------------
// ⌨️ KEYBOARD CONTROLS
// ----------------------------------------------
document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key in keys) {
        keys[key] = true;
        e.preventDefault();
    }

    if (key === 'r' || key === 'R') resetBall();
    if (key === 'g' || key === 'G') toggleGravity();
    if (key === ' ') {
        e.preventDefault();
        randomThrow();
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key;
    if (key in keys) {
        keys[key] = false;
        e.preventDefault();
    }
});

// ----------------------------------------------
// 🖱️ MOUSE / TOUCH EVENTS (GRABBING)
// ----------------------------------------------
function getCanvasCoords(e) {
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    let clientX, clientY;
    if (e.touches) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
        e.preventDefault();
    } else {
        clientX = e.clientX;
        clientY = e.clientY;
    }

    return {
        x: (clientX - rect.left) * scaleX,
        y: (clientY - rect.top) * scaleY
    };
}

function isOverBall(mx, my) {
    const dx = mx - ball.x;
    const dy = my - ball.y;
    return Math.hypot(dx, dy) < ball.r + 12;
}

function grabBall(mx, my) {
    if (isOverBall(mx, my)) {
        mouse.isGrabbing = true;
        mouse.grabOffsetX = ball.x - mx;
        mouse.grabOffsetY = ball.y - my;
        mouse.prevX = mx;
        mouse.prevY = my;
        canvas.style.cursor = 'grabbing';
        ball.trail = [];
        ball.isResting = false;
        ball.onGround = false;
        return true;
    }
    return false;
}

function releaseBall(mx, my) {
    if (mouse.isGrabbing) {
        const dx = mx - mouse.prevX;
        const dy = my - mouse.prevY;

        const throwPower = 1.2;
        const vx = dx * throwPower * 0.7;
        const vy = dy * throwPower * 0.7;

        const throwSpeed = Math.hypot(vx, vy);

        if (throwSpeed > 0.5) {
            ball.vx = vx;
            ball.vy = vy;
        } else {
            const angle = Math.random() * Math.PI * 2;
            ball.vx = Math.cos(angle) * 2;
            ball.vy = Math.sin(angle) * 2 - 1;
        }

        const speed = Math.hypot(ball.vx, ball.vy);
        if (speed > ball.maxSpeed) {
            ball.vx = (ball.vx / speed) * ball.maxSpeed;
            ball.vy = (ball.vy / speed) * ball.maxSpeed;
        }

        ball.isResting = false;
        ball.onGround = false;
        mouse.isGrabbing = false;
        canvas.style.cursor = 'default';
    }
}

// Mouse events
canvas.addEventListener('mousedown', (e) => {
    const coords = getCanvasCoords(e);
    mouse.isDown = true;
    mouse.x = coords.x;
    mouse.y = coords.y;
    mouse.prevX = coords.x;
    mouse.prevY = coords.y;
    grabBall(coords.x, coords.y);
});

canvas.addEventListener('mousemove', (e) => {
    const coords = getCanvasCoords(e);
    mouse.x = coords.x;
    mouse.y = coords.y;

    if (mouse.isGrabbing) {
        ball.x = coords.x + mouse.grabOffsetX;
        ball.y = coords.y + mouse.grabOffsetY;
        ball.vx = 0;
        ball.vy = 0;
    } else if (isOverBall(coords.x, coords.y)) {
        canvas.style.cursor = 'grab';
    } else {
        canvas.style.cursor = 'default';
    }
});

canvas.addEventListener('mouseup', (e) => {
    const coords = getCanvasCoords(e);
    mouse.isDown = false;
    if (mouse.isGrabbing) {
        releaseBall(coords.x, coords.y);
    }
});

canvas.addEventListener('mouseleave', () => {
    if (mouse.isGrabbing) {
        const coords = { x: mouse.x, y: mouse.y };
        releaseBall(coords.x, coords.y);
    }
});

// Touch events
canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    mouse.x = coords.x;
    mouse.y = coords.y;
    mouse.prevX = coords.x;
    mouse.prevY = coords.y;
    grabBall(coords.x, coords.y);
}, { passive: false });

canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    const coords = getCanvasCoords(e);
    mouse.x = coords.x;
    mouse.y = coords.y;

    if (mouse.isGrabbing) {
        ball.x = coords.x + mouse.grabOffsetX;
        ball.y = coords.y + mouse.grabOffsetY;
        ball.vx = 0;
        ball.vy = 0;
    }
}, { passive: false });

canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (mouse.isGrabbing) {
        const coords = { x: mouse.x, y: mouse.y };
        releaseBall(coords.x, coords.y);
    }
}, { passive: false });

canvas.addEventListener('click', () => {
    initAudio();
});

// ----------------------------------------------
// 🎯 RESET & UTILITY FUNCTIONS
// ----------------------------------------------
function resetBall() {
    ball.x = 250;
    ball.y = 100;
    ball.vx = 0;
    ball.vy = 0;
    ball.bounceCount = 0;
    ball.trail = [];
    ball.isResting = false;
    ball.onGround = false;
    ball.restFrames = 0;
}

function toggleGravity() {
    if (ball.gravity > 0) {
        ball.gravity = 0;
    } else {
        ball.gravity = 0.3;
    }
    ball.isResting = false;
    ball.onGround = false;
}

function randomThrow() {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 12;
    ball.vx = Math.cos(angle) * speed;
    ball.vy = Math.sin(angle) * speed - 3;
    ball.trail = [];
    ball.isResting = false;
    ball.onGround = false;
}

// ----------------------------------------------
// 2. CLOCK DRAWING
// ----------------------------------------------
function updateClock() {
    const now = new Date();
    seconds = now.getSeconds() + now.getMilliseconds() / 1000;
    minutes = now.getMinutes() + seconds / 60;
    hours = now.getHours() % 12 + minutes / 60;
}

function drawClockFace() {
    ctx.beginPath();
    ctx.arc(clockX, clockY, clockRadius + 7, 0, Math.PI * 2);
    const ringGrad = ctx.createRadialGradient(clockX - 8, clockY - 8, 4, clockX, clockY, clockRadius + 7);
    ringGrad.addColorStop(0, '#5a7fa5');
    ringGrad.addColorStop(1, '#1a2a4a');
    ctx.fillStyle = ringGrad;
    ctx.shadowColor = 'rgba(0,0,0,0.7)';
    ctx.shadowBlur = 18;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(clockX, clockY, clockRadius, 0, Math.PI * 2);
    const faceGrad = ctx.createRadialGradient(clockX - 15, clockY - 15, 8, clockX, clockY, clockRadius);
    faceGrad.addColorStop(0, '#fdfaf5');
    faceGrad.addColorStop(0.9, '#e8e0d5');
    faceGrad.addColorStop(1, '#c8c0b0');
    ctx.fillStyle = faceGrad;
    ctx.fill();
    ctx.strokeStyle = '#7a6e5e';
    ctx.lineWidth = 1.3;
    ctx.stroke();

    for (let i = 0; i < 12; i++) {
        const angle = (i / 12) * Math.PI * 2 - Math.PI / 2;
        const outerR = clockRadius - 9;
        const innerR = clockRadius - 24;
        const x1 = clockX + Math.cos(angle) * innerR;
        const y1 = clockY + Math.sin(angle) * innerR;
        const x2 = clockX + Math.cos(angle) * outerR;
        const y2 = clockY + Math.sin(angle) * outerR;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#1a1a2e';
        ctx.lineWidth = i % 3 === 0 ? 3.5 : 2.5;
        ctx.stroke();
    }

    for (let i = 0; i < 60; i++) {
        if (i % 5 === 0) continue;
        const angle = (i / 60) * Math.PI * 2 - Math.PI / 2;
        const outerR = clockRadius - 9;
        const innerR = clockRadius - 18;
        const x1 = clockX + Math.cos(angle) * innerR;
        const y1 = clockY + Math.sin(angle) * innerR;
        const x2 = clockX + Math.cos(angle) * outerR;
        const y2 = clockY + Math.sin(angle) * outerR;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = '#5a5040';
        ctx.lineWidth = 1;
        ctx.stroke();
    }

    const numAngles = [
        -Math.PI / 2, -Math.PI / 3, -Math.PI / 6, 0,
        Math.PI / 6, Math.PI / 3, Math.PI / 2,
        2 * Math.PI / 3, 5 * Math.PI / 6, Math.PI,
        -5 * Math.PI / 6, -2 * Math.PI / 3
    ];
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#1a1a2e';
    for (let i = 0; i < 12; i++) {
        const angle = numAngles[i];
        const dist = clockRadius - 34;
        const x = clockX + Math.cos(angle) * dist;
        const y = clockY + Math.sin(angle) * dist;
        ctx.fillText(i === 0 ? 12 : i, x, y);
    }

    ctx.beginPath();
    ctx.arc(clockX, clockY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(clockX, clockY, 3.5, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a373';
    ctx.fill();
}

function drawHands() {
    const secAngle = (seconds / 60) * Math.PI * 2 - Math.PI / 2;
    const minAngle = (minutes / 60) * Math.PI * 2 - Math.PI / 2;
    const hrAngle = (hours / 12) * Math.PI * 2 - Math.PI / 2;

    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
        clockX + Math.cos(secAngle) * (clockRadius - 25),
        clockY + Math.sin(secAngle) * (clockRadius - 25)
    );
    ctx.strokeStyle = '#d62828';
    ctx.lineWidth = 1.8;
    ctx.shadowColor = 'rgba(214,40,40,0.3)';
    ctx.shadowBlur = 5;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
        clockX + Math.cos(minAngle) * (clockRadius - 35),
        clockY + Math.sin(minAngle) * (clockRadius - 35)
    );
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.moveTo(clockX, clockY);
    ctx.lineTo(
        clockX + Math.cos(hrAngle) * (clockRadius - 48),
        clockY + Math.sin(hrAngle) * (clockRadius - 48)
    );
    ctx.strokeStyle = '#1a1a2e';
    ctx.lineWidth = 5;
    ctx.shadowColor = 'rgba(0,0,0,0.15)';
    ctx.shadowBlur = 4;
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(clockX, clockY, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#d4a373';
    ctx.shadowBlur = 8;
    ctx.shadowColor = 'rgba(0,0,0,0.2)';
    ctx.fill();
    ctx.shadowBlur = 0;
}

// ----------------------------------------------
// 3. BALL PHYSICS (FIXED - NO JITTER)
// ----------------------------------------------
function updateBall() {
    // === IF BALL IS BEING GRABBED ===
    if (mouse.isGrabbing) {
        return;
    }

    // === IF BALL IS RESTING, SKIP ALL PHYSICS ===
    if (ball.isResting) {
        // Ball stays perfectly still
        return;
    }

    // === LAW 1: GRAVITY ===
    ball.vy += ball.gravity;

    // === LAW 2: TILT / ACCELERATION ===
    let tiltX = tilt.x;
    let tiltY = tilt.y;

    if (keys.ArrowLeft || keys.a) tiltX = -1;
    else if (keys.ArrowRight || keys.d) tiltX = 1;

    if (keys.ArrowUp || keys.w) tiltY = -1;
    else if (keys.ArrowDown || keys.s) tiltY = 1;

    ball.vx += tiltX * ball.tiltStrength;
    ball.vy += tiltY * ball.tiltStrength;

    // === LAW 3: FRICTION ===
    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    // === LAW 4: MOMENTUM ===
    ball.x += ball.vx;
    ball.y += ball.vy;

    // === LAW 5: ENERGY ===
    const speed = Math.hypot(ball.vx, ball.vy);
    ball.energy = 0.5 * ball.mass * speed * speed;

    // === LAW 6: SPEED LIMITS ===
    if (speed > ball.maxSpeed) {
        ball.vx = (ball.vx / speed) * ball.maxSpeed;
        ball.vy = (ball.vy / speed) * ball.maxSpeed;
    }

    // === LAW 7: COLLISIONS ===
    handleCollisions();

    // === CHECK IF BALL SHOULD COME TO REST ===
    checkResting();

    // === UPDATE TRAIL ===
    if (!mouse.isGrabbing && speed > 0.5 && !ball.isResting) {
        ball.trail.push({ x: ball.x, y: ball.y, life: 1.0 });
        if (ball.trail.length > ball.maxTrail) {
            ball.trail.shift();
        }
    }

    // Fade trail
    ball.trail.forEach(t => t.life -= 0.025);
    ball.trail = ball.trail.filter(t => t.life > 0);
}

function handleCollisions() {
    const left = WALL + ball.r;
    const right = W - WALL - ball.r;
    const top = WALL + ball.r;
    const bottom = H - WALL - ball.r;

    const speed = Math.hypot(ball.vx, ball.vy);

    // Right wall
    if (ball.x > right) {
        ball.x = right;
        ball.vx = -Math.abs(ball.vx) * ball.bounce;
        ball.vy += (Math.random() - 0.5) * 0.3;
        ball.bounceCount++;
        if (speed > 0.5) playBounceSound(speed, 'wall');
    }

    // Left wall
    if (ball.x < left) {
        ball.x = left;
        ball.vx = Math.abs(ball.vx) * ball.bounce;
        ball.vy += (Math.random() - 0.5) * 0.3;
        ball.bounceCount++;
        if (speed > 0.5) playBounceSound(speed, 'wall');
    }

    // Top wall
    if (ball.y < top) {
        ball.y = top;
        ball.vy = Math.abs(ball.vy) * ball.bounce;
        ball.vx += (Math.random() - 0.5) * 0.3;
        ball.bounceCount++;
        if (speed > 0.5) playBounceSound(speed, 'wall');
    }

    // Bottom wall (floor) - CRITICAL: Handle ground collision
    if (ball.y > bottom) {
        ball.y = bottom;
        
        // If ball is moving very slowly on ground, stop it completely
        if (Math.abs(ball.vy) < 0.3 && Math.abs(ball.vx) < 0.3) {
            ball.vy = 0;
            ball.vx = 0;
            ball.onGround = true;
        } else {
            // Normal bounce
            ball.vy = -Math.abs(ball.vy) * ball.bounce;
            ball.vx *= 0.98; // Extra friction on ground
            ball.bounceCount++;
            if (speed > 0.5) playBounceSound(speed, 'bottom');
            ball.onGround = true;
        }
    } else {
        ball.onGround = false;
    }

    // === CLOCK COLLISION ===
    const dx = ball.x - clockX;
    const dy = ball.y - clockY;
    const dist = Math.hypot(dx, dy);
    const minDist = ball.r + clockRadius;

    if (dist < minDist && dist > 0.001) {
        const nx = dx / dist;
        const ny = dy / dist;
        const overlap = minDist - dist;
        ball.x += nx * overlap;
        ball.y += ny * overlap;

        const dot = ball.vx * nx + ball.vy * ny;
        if (dot < 0) {
            ball.vx -= (1 + ball.bounce) * dot * nx;
            ball.vy -= (1 + ball.bounce) * dot * ny;
            ball.vx += (Math.random() - 0.5) * 0.3;
            ball.vy += (Math.random() - 0.5) * 0.3;
            ball.bounceCount++;
            if (speed > 0.5) playBounceSound(speed, 'clock');
        }
    } else if (dist === 0) {
        ball.x = clockX + ball.r + clockRadius + 8;
        ball.y = clockY;
    }
}

function checkResting() {
    const speed = Math.hypot(ball.vx, ball.vy);
    
    // If ball is on ground and barely moving
    if (ball.onGround && speed < 0.3) {
        ball.restFrames++;
        if (ball.restFrames > 20) {
            // Completely stop the ball
            ball.isResting = true;
            ball.vx = 0;
            ball.vy = 0;
            ball.x = Math.round(ball.x); // Snap to pixel for stability
            ball.y = Math.round(ball.y);
            ball.restFrames = 0;
        }
    } else if (speed > 0.5) {
        // Reset rest counter if moving
        ball.restFrames = 0;
        ball.isResting = false;
    }
}

// ----------------------------------------------
// 4. RENDERING
// ----------------------------------------------
function drawBall() {
    const speed = Math.hypot(ball.vx, ball.vy);

    // === DRAW TRAIL ===
    if (ball.trail.length > 1 && !ball.isResting) {
        for (let i = 0; i < ball.trail.length - 1; i++) {
            const t = ball.trail[i];
            const alpha = t.life * 0.25;
            const size = ball.r * t.life * 0.5;
            ctx.beginPath();
            ctx.arc(t.x, t.y, size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(255, 120, 50, ${alpha})`;
            ctx.fill();
        }
    }

    // === BALL BODY ===
    const grad = ctx.createRadialGradient(
        ball.x - 3, ball.y - 4, 2,
        ball.x, ball.y, ball.r + 7
    );

    const intensity = Math.min(speed / 20, 1);
    const r = Math.round(238 + intensity * 20);
    const g = Math.round(90 - intensity * 40);
    const b = Math.round(36 - intensity * 20);

    grad.addColorStop(0, `rgb(${r + 30}, ${g + 30}, ${b + 30})`);
    grad.addColorStop(0.5, `rgb(${r}, ${g}, ${b})`);
    grad.addColorStop(1, `rgb(${r - 50}, ${g - 30}, ${b - 20})`);

    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);

    const glowIntensity = 0.3 + (speed / 30) * 0.5;
    ctx.shadowColor = `rgba(238, 90, 36, ${Math.min(glowIntensity, 0.8)})`;
    ctx.shadowBlur = 20 + speed * 2;
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.shadowBlur = 0;

    // === GRAB INDICATOR ===
    if (mouse.isGrabbing) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r + 8, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);

        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r + 4, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(88, 166, 255, 0.3)';
        ctx.lineWidth = 3;
        ctx.stroke();
    }

    // === RESTING INDICATOR ===
    if (ball.isResting) {
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, ball.r + 12, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(63, 185, 80, 0.4)';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
    }

    // === HIGHLIGHT ===
    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 4, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(255,255,255,${0.3 + intensity * 0.3})`;
    ctx.fill();

    // === SPEED LINES ===
    if (speed > 2 && !mouse.isGrabbing && !ball.isResting) {
        const angle = Math.atan2(ball.vy, ball.vx);
        const len = 13 + speed * 1.1;

        ctx.beginPath();
        ctx.moveTo(ball.x + Math.cos(angle) * ball.r * 0.8,
            ball.y + Math.sin(angle) * ball.r * 0.8);
        ctx.lineTo(ball.x + Math.cos(angle) * (ball.r * 0.8 + len),
            ball.y + Math.sin(angle) * (ball.r * 0.8 + len));
        ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + speed / 40})`;
        ctx.lineWidth = 2;
        ctx.shadowColor = 'rgba(255, 200, 100, 0.3)';
        ctx.shadowBlur = 8;
        ctx.stroke();
        ctx.shadowBlur = 0;

        const headLen = 7;
        const headAngle = 0.5;
        const tipX = ball.x + Math.cos(angle) * (ball.r * 0.8 + len);
        const tipY = ball.y + Math.sin(angle) * (ball.r * 0.8 + len);

        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - headLen * Math.cos(angle - headAngle),
            tipY - headLen * Math.sin(angle - headAngle));
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(tipX - headLen * Math.cos(angle + headAngle),
            tipY - headLen * Math.sin(angle + headAngle));
        ctx.strokeStyle = `rgba(255, 200, 100, ${0.3 + speed / 40})`;
        ctx.lineWidth = 1.8;
        ctx.stroke();
    }
}

// ----------------------------------------------
// 5. MAIN LOOP
// ----------------------------------------------
function gameLoop() {
    updateClock();
    updateBall();

    ctx.clearRect(0, 0, W, H);

    // Draw walls
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8a88a';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
    ctx.shadowBlur = 0;

    // Draw clock
    drawClockFace();
    drawHands();

    // Draw ball
    drawBall();

    // --- Draw tilt indicator ---
    if (Math.abs(tilt.x) > 0.05 || Math.abs(tilt.y) > 0.05) {
        const arrowLen = 25;
        const arrowX = 40;
        const arrowY = 40;
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(Math.atan2(tilt.y, tilt.x));
        ctx.beginPath();
        ctx.moveTo(arrowLen, 0);
        ctx.lineTo(-arrowLen * 0.5, -arrowLen * 0.4);
        ctx.lineTo(-arrowLen * 0.5, arrowLen * 0.4);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 217, 61, 0.7)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 217, 61, 0.9)';
        ctx.lineWidth = 2;
        ctx.stroke();
        ctx.restore();
    }

    // --- Draw info on canvas ---
    const speed = Math.hypot(ball.vx, ball.vy);
    ctx.fillStyle = 'rgba(255,255,255,0.3)';
    ctx.font = '10px Arial';
    ctx.textAlign = 'left';
    ctx.fillText(`Speed: ${speed.toFixed(1)}`, 20, H - 15);
    ctx.fillText(`Bounces: ${ball.bounceCount}`, 140, H - 15);
    ctx.fillText(`Gravity: ${ball.gravity.toFixed(2)}`, 250, H - 15);

    // Status messages on canvas
    if (ball.isResting) {
        ctx.fillStyle = 'rgba(63, 185, 80, 0.8)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🟢 BALL AT REST - Click and drag to apply force!', W / 2, 30);
    }

    if (mouse.isGrabbing) {
        ctx.fillStyle = 'rgba(88, 166, 255, 0.8)';
        ctx.font = 'bold 14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🖱️ Drag to throw!', W / 2, 30);
    }

    requestAnimationFrame(gameLoop);
}

// ----------------------------------------------
// 6. START
// ----------------------------------------------
statusEl.textContent = '🖱️ Click & drag ball to grab/throw | G=Gravity | R=Reset';

console.log('✅ Running: FULL PHYSICS Pinball + Clock!');
console.log('📐 Physics Laws: Gravity, Friction, Bounce, Momentum, Energy');
console.log('🖱️ Grab & throw the ball to experiment with Newton\'s First Law!');
console.log('⌨️ Controls: WASD/Arrows=Tilt, G=Gravity, R=Reset, Space=Random Throw');

resetBall();
gameLoop();