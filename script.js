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

// ----- Ball physics (ZERO GRAVITY) -----
const ball = {
    x: 250,
    y: 350,
    vx: 6.5,
    vy: -4.5,
    r: 13,
    gravity: 0,
    friction: 0.9995,
    bounce: 0.95,
    maxSpeed: 22,
    minSpeed: 3.0,
};

// ----- Tilt control -----
const tilt = {
    x: 0,
    y: 0,
    strength: 0.12,
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
};

// ----- Clock time -----
let seconds = 0,
    minutes = 0,
    hours = 0;

// =============================================
// SOUND SYSTEM
// =============================================
let audioCtx = null;

function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
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

document.addEventListener('keydown', (e) => {
    const key = e.key;
    if (key in keys) {
        keys[key] = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key;
    if (key in keys) {
        keys[key] = false;
        e.preventDefault();
    }
});

canvas.addEventListener('click', () => {
    initAudio();
});

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
// 3. BALL PHYSICS
// ----------------------------------------------
function updateBall() {
    let tiltX = tilt.x;
    let tiltY = tilt.y;

    if (keys.ArrowLeft || keys.a) tiltX = -1;
    else if (keys.ArrowRight || keys.d) tiltX = 1;

    if (keys.ArrowUp || keys.w) tiltY = -1;
    else if (keys.ArrowDown || keys.s) tiltY = 1;

    ball.vx += tiltX * tilt.strength;
    ball.vy += tiltY * tilt.strength;

    ball.x += ball.vx;
    ball.y += ball.vy;

    ball.vx *= ball.friction;
    ball.vy *= ball.friction;

    const left = WALL + ball.r;
    const right = W - WALL - ball.r;
    const top = WALL + ball.r;
    const bottom = H - WALL - ball.r;

    const speed = Math.hypot(ball.vx, ball.vy);

    if (ball.x > right) {
        ball.x = right;
        ball.vx = -Math.abs(ball.vx) * ball.bounce;
        ball.vx -= (Math.random() - 0.3) * 0.6;
        ball.vy += (Math.random() - 0.5) * 0.6;
        playBounceSound(speed, 'wall');
    }
    if (ball.x < left) {
        ball.x = left;
        ball.vx = Math.abs(ball.vx) * ball.bounce;
        ball.vx += (Math.random() - 0.7) * 0.6;
        ball.vy += (Math.random() - 0.5) * 0.6;
        playBounceSound(speed, 'wall');
    }
    if (ball.y > bottom) {
        ball.y = bottom;
        ball.vy = -Math.abs(ball.vy) * ball.bounce;
        ball.vy -= (Math.random() - 0.3) * 0.6;
        ball.vx += (Math.random() - 0.5) * 0.6;
        playBounceSound(speed, 'bottom');
    }
    if (ball.y < top) {
        ball.y = top;
        ball.vy = Math.abs(ball.vy) * ball.bounce;
        ball.vy += (Math.random() - 0.7) * 0.6;
        ball.vx += (Math.random() - 0.5) * 0.6;
        playBounceSound(speed, 'wall');
    }

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
            ball.vx += (Math.random() - 0.5) * 0.6;
            ball.vy += (Math.random() - 0.5) * 0.6;
            playBounceSound(speed, 'clock');
        }
    } else if (dist === 0) {
        ball.x = clockX + ball.r + clockRadius + 8;
        ball.y = clockY;
    }

    const newSpeed = Math.hypot(ball.vx, ball.vy);
    if (newSpeed < ball.minSpeed) {
        const angle = Math.random() * Math.PI * 2;
        ball.vx += Math.cos(angle) * 2.0;
        ball.vy += Math.sin(angle) * 2.0;
    }

    if (newSpeed > ball.maxSpeed) {
        ball.vx = (ball.vx / newSpeed) * ball.maxSpeed;
        ball.vy = (ball.vy / newSpeed) * ball.maxSpeed;
    }

    if (Math.random() < 0.01) {
        const angle = Math.random() * Math.PI * 2;
        ball.vx += Math.cos(angle) * 0.5;
        ball.vy += Math.sin(angle) * 0.5;
    }
}

function drawBall() {
    const speed = Math.hypot(ball.vx, ball.vy);
    
    if (speed > 4) {
        for (let i = 1; i <= 7; i++) {
            const alpha = (0.1 - i * 0.012) * Math.min(speed / 12, 1);
            if (alpha <= 0) break;
            ctx.beginPath();
            ctx.arc(
                ball.x - ball.vx * i * 0.18,
                ball.y - ball.vy * i * 0.18,
                ball.r * (1 - i * 0.05),
                0, Math.PI * 2
            );
            ctx.fillStyle = `rgba(255, 120, 50, ${Math.min(alpha, 0.18)})`;
            ctx.shadowBlur = 15;
            ctx.shadowColor = `rgba(255, 150, 50, ${alpha * 0.12})`;
            ctx.fill();
            ctx.shadowBlur = 0;
        }
    }

    const grad = ctx.createRadialGradient(
        ball.x - 3, ball.y - 4, 2,
        ball.x, ball.y, ball.r + 7
    );
    grad.addColorStop(0, '#ff8a7a');
    grad.addColorStop(0.5, '#ee5a24');
    grad.addColorStop(1, '#b8321a');
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.r, 0, Math.PI * 2);
    ctx.fillStyle = grad;
    ctx.shadowColor = `rgba(238,90,36,${0.3 + speed / 50})`;
    ctx.shadowBlur = 22 + speed * 1.8;
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.beginPath();
    ctx.arc(ball.x - 3, ball.y - 4, 4.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fill();

    if (speed > 2) {
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

    if (speed > 10) {
        const intensity = Math.min((speed - 10) / 10, 0.5);
        for (let i = 0; i < 6; i++) {
            const angle = Math.atan2(ball.vy, ball.vx) + (Math.random() - 0.5) * 0.6;
            const len = 6 + Math.random() * 14 * intensity;
            const offset = 3 + Math.random() * 10;
            const perpAngle = angle + Math.PI / 2;
            const side = (Math.random() > 0.5) ? 1 : -1;
            const startX = ball.x + Math.cos(perpAngle) * side * offset;
            const startY = ball.y + Math.sin(perpAngle) * side * offset;
            ctx.beginPath();
            ctx.moveTo(startX - Math.cos(angle) * 2, startY - Math.sin(angle) * 2);
            ctx.lineTo(startX - Math.cos(angle) * (2 + len), startY - Math.sin(angle) * (2 + len));
            ctx.strokeStyle = `rgba(255, 200, 100, ${intensity * 0.2})`;
            ctx.lineWidth = 1.2;
            ctx.stroke();
        }
    }
}

// ----------------------------------------------
// 4. MAIN LOOP
// ----------------------------------------------
function gameLoop() {
    updateClock();
    updateBall();

    ctx.clearRect(0, 0, W, H);

    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#b8a88a';
    ctx.lineWidth = 3.5;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 6;
    ctx.strokeRect(WALL, WALL, W - WALL * 2, H - WALL * 2);
    ctx.shadowBlur = 0;

    drawClockFace();
    drawHands();
    drawBall();

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

    requestAnimationFrame(gameLoop);
}

// ----------------------------------------------
// 5. START
// ----------------------------------------------
gameLoop();

console.log('✅ Running: Zero-G ball with sound and tilt controls!');
console.log('🔊 Click on the canvas to enable audio');