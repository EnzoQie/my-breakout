'use strict';

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const startButton = document.getElementById('startButton');
const pauseButton = document.getElementById('pauseButton');
const restartButton = document.getElementById('restartButton');

if (!ctx) {
    throw new Error('Canvas 2D context is not available.');
}

if (!startButton || !pauseButton || !restartButton) {
    throw new Error('Game controls are not available.');
}

const gameConfig = {
    startingLives: 3,
    maxLevel: 3,
    baseBallSpeed: 281.25,
    speedIncreasePerLevel: 49.21875,
    maxFrameTime: 0.05,
    highScoreKey: 'my-breakout-high-score',
};

const brickLayout = {
    columns: 5,
    rows: 3,
    width: 75,
    height: 20,
    gap: 10,
    offsetTop: 42,
    offsetLeft: 30,
};

const brickTypes = [
    { color: '#f43f5e', value: 30 },
    { color: '#f97316', value: 20 },
    { color: '#38bdf8', value: 10 },
];
const bricks = [];
const hitEffects = [];
const BrowserAudioContext = globalThis.AudioContext || globalThis.webkitAudioContext;

let score = 0;
let highScore = loadHighScore();
let lives = gameConfig.startingLives;
let level = 1;
let gameStatus = 'ready';
let animationFrameId = null;
let lastFrameTime = null;
let audioContext = null;

const ball = {
    x: canvas.width / 2,
    y: 232,
    radius: 10,
    velocityX: gameConfig.baseBallSpeed,
    velocityY: -gameConfig.baseBallSpeed,
};

const paddle = {
    width: 90,
    height: 12,
    x: (canvas.width - 90) / 2,
    y: canvas.height - 38,
    speed: 984.375,
};

const keys = {
    leftPressed: false,
    rightPressed: false,
};

function loadHighScore() {
    try {
        const storedScore = Number.parseInt(localStorage.getItem(gameConfig.highScoreKey), 10);
        return Number.isFinite(storedScore) ? storedScore : 0;
    } catch {
        return 0;
    }
}

function saveHighScore() {
    try {
        localStorage.setItem(gameConfig.highScoreKey, String(highScore));
    } catch {
        // 浏览器禁用存储时，最高分仍会保留到本次页面关闭。
    }
}

function enableAudio() {
    if (!BrowserAudioContext) {
        return;
    }

    if (!audioContext) {
        audioContext = new BrowserAudioContext();
    }

    if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {});
    }
}

function playTone(frequency, duration, waveType, volume, endFrequency = frequency) {
    if (!audioContext || audioContext.state !== 'running') {
        return;
    }

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    const startTime = audioContext.currentTime;

    oscillator.type = waveType;
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.frequency.exponentialRampToValueAtTime(
        endFrequency,
        startTime + duration,
    );
    gainNode.gain.setValueAtTime(volume, startTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, startTime + duration);

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start(startTime);
    oscillator.stop(startTime + duration);
}

function playPaddleSound() {
    // 短促的中高频下滑模拟乒乓球接触球拍时的清脆瞬态。
    playTone(1250, 0.04, 'triangle', 0.055, 650);
    playTone(2400, 0.012, 'square', 0.012, 1500);
}

function playScoreSound(points) {
    const frequencies = {
        10: 420,
        20: 520,
        30: 640,
    };

    playTone(frequencies[points], 0.09, 'triangle', 0.045);
}

function buildBricks() {
    bricks.length = 0;

    for (let row = 0; row < brickLayout.rows; row += 1) {
        const brickType = brickTypes[row];

        for (let column = 0; column < brickLayout.columns; column += 1) {
            bricks.push({
                x: brickLayout.offsetLeft + column * (brickLayout.width + brickLayout.gap),
                y: brickLayout.offsetTop + row * (brickLayout.height + brickLayout.gap),
                width: brickLayout.width,
                height: brickLayout.height,
                color: brickType.color,
                value: brickType.value,
                active: true,
            });
        }
    }
}

function setKeyState(event, isPressed) {
    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        keys.leftPressed = isPressed;
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        keys.rightPressed = isPressed;
    } else {
        return;
    }

    event.preventDefault();
}

function keyDownHandler(event) {
    setKeyState(event, true);
}

function keyUpHandler(event) {
    setKeyState(event, false);
}

document.addEventListener('keydown', keyDownHandler);
document.addEventListener('keyup', keyUpHandler);

function drawBackground() {
    ctx.fillStyle = '#08111f';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = 'rgba(125, 211, 252, 0.06)';
    ctx.lineWidth = 1;

    for (let x = 0; x <= canvas.width; x += 24) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }

    for (let y = 0; y <= canvas.height; y += 24) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    ctx.fillStyle = 'rgba(2, 6, 23, 0.78)';
    ctx.fillRect(0, 0, canvas.width, 34);
    ctx.fillRect(0, canvas.height - 24, canvas.width, 24);

    ctx.fillStyle = 'rgba(56, 189, 248, 0.2)';
    ctx.fillRect(0, 33, canvas.width, 1);
    ctx.fillRect(0, canvas.height - 25, canvas.width, 1);
}

function drawBricks() {
    for (const brick of bricks) {
        if (brick.active) {
            ctx.save();
            ctx.shadowColor = brick.color;
            ctx.shadowBlur = 8;
            ctx.fillStyle = brick.color;
            ctx.fillRect(brick.x, brick.y, brick.width, brick.height);

            ctx.shadowBlur = 0;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.28)';
            ctx.fillRect(brick.x + 2, brick.y + 2, brick.width - 4, 3);
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
            ctx.strokeRect(brick.x + 0.5, brick.y + 0.5, brick.width - 1, brick.height - 1);

            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 11px Arial, sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(String(brick.value), brick.x + brick.width / 2, brick.y + 15);
            ctx.textAlign = 'left';
            ctx.restore();
        }
    }
}

function drawBall() {
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#e0f2fe';
    ctx.fill();
    ctx.closePath();
    ctx.restore();
}

function drawPaddle() {
    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#0891b2';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#67e8f9';
    ctx.fillRect(paddle.x + 4, paddle.y + 2, paddle.width - 8, 3);
    ctx.restore();
}

function drawHitEffects() {
    ctx.save();

    for (const effect of hitEffects) {
        ctx.globalAlpha = effect.alpha;
        ctx.strokeStyle = effect.color;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(effect.x, effect.y, effect.radius, 0, Math.PI * 2);
        ctx.stroke();
    }

    ctx.restore();
}

function drawHud() {
    const hudItems = [
        { label: 'SCORE', value: score, x: 12 },
        { label: 'BEST', value: highScore, x: 122 },
        { label: 'LEVEL', value: `${level}/${gameConfig.maxLevel}`, x: 278 },
        { label: 'LIVES', value: lives, x: 414 },
    ];

    for (const item of hudItems) {
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 8px Arial, sans-serif';
        ctx.fillText(item.label, item.x, 12);
        ctx.fillStyle = '#f8fafc';
        ctx.font = 'bold 13px Arial, sans-serif';
        ctx.fillText(String(item.value), item.x, 27);
    }
}

function drawStageLabel() {
    const statusLabels = {
        ready: 'READY',
        playing: 'PLAYING',
        paused: 'PAUSED',
        won: 'CLEARED',
        lost: 'GAME OVER',
    };

    ctx.fillStyle = gameStatus === 'playing' ? '#22d3ee' : '#fbbf24';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.fillText(`● ${statusLabels[gameStatus]}`, 14, canvas.height - 8);
    ctx.fillStyle = '#64748b';
    ctx.textAlign = 'right';
    ctx.fillText('MOVE  ← →  /  A D', canvas.width - 14, canvas.height - 8);
    ctx.textAlign = 'left';
}

function drawGameMessage() {
    if (gameStatus === 'playing') {
        return;
    }

    const messages = {
        ready: ['READY', 'PRESS START'],
        paused: ['PAUSED', 'PRESS CONTINUE'],
        won: ['YOU WIN', `FINAL SCORE ${score}`],
        lost: ['GAME OVER', `FINAL SCORE ${score}`],
    };
    const [title, subtitle] = messages[gameStatus];

    ctx.save();
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 18;
    ctx.fillStyle = 'rgba(8, 17, 31, 0.94)';
    ctx.fillRect(90, 116, 300, 100);
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(34, 211, 238, 0.65)';
    ctx.lineWidth = 1;
    ctx.strokeRect(90.5, 116.5, 299, 99);
    ctx.fillStyle = '#f8fafc';
    ctx.font = 'bold 30px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(title, canvas.width / 2, 158);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '14px Arial, sans-serif';
    ctx.fillText(subtitle, canvas.width / 2, 187);
    ctx.textAlign = 'left';
    ctx.restore();
}

function updateBall(deltaTime) {
    const nextX = ball.x + ball.velocityX * deltaTime;
    const nextY = ball.y + ball.velocityY * deltaTime;

    if (nextX > canvas.width - ball.radius || nextX < ball.radius) {
        ball.velocityX = -ball.velocityX;
    }

    if (nextY < ball.radius) {
        ball.velocityY = -ball.velocityY;
    }

    ball.x += ball.velocityX * deltaTime;
    ball.y += ball.velocityY * deltaTime;

    const touchesPaddle = ball.velocityY > 0
        && ball.y + ball.radius >= paddle.y
        && ball.y - ball.radius <= paddle.y + paddle.height
        && ball.x + ball.radius >= paddle.x
        && ball.x - ball.radius <= paddle.x + paddle.width;

    if (touchesPaddle) {
        ball.y = paddle.y - ball.radius;
        ball.velocityY = -Math.abs(ball.velocityY);
        playPaddleSound();
    } else if (ball.y + ball.radius >= canvas.height) {
        loseLife();
    }
}

function ballTouchesBrick(brick) {
    const closestX = Math.max(brick.x, Math.min(ball.x, brick.x + brick.width));
    const closestY = Math.max(brick.y, Math.min(ball.y, brick.y + brick.height));
    const distanceX = ball.x - closestX;
    const distanceY = ball.y - closestY;

    return distanceX * distanceX + distanceY * distanceY <= ball.radius * ball.radius;
}

function bounceOffBrick(brick) {
    const brickCenterX = brick.x + brick.width / 2;
    const brickCenterY = brick.y + brick.height / 2;
    const overlapX = ball.radius + brick.width / 2 - Math.abs(ball.x - brickCenterX);
    const overlapY = ball.radius + brick.height / 2 - Math.abs(ball.y - brickCenterY);

    if (overlapX < overlapY) {
        ball.velocityX = -ball.velocityX;
        ball.x = ball.x < brickCenterX
            ? brick.x - ball.radius
            : brick.x + brick.width + ball.radius;
    } else {
        ball.velocityY = -ball.velocityY;
        ball.y = ball.y < brickCenterY
            ? brick.y - ball.radius
            : brick.y + brick.height + ball.radius;
    }
}

function createHitEffect(brick) {
    hitEffects.push({
        x: ball.x,
        y: ball.y,
        radius: 6,
        alpha: 1,
        color: brick.color,
    });
}

function updateHitEffects(deltaTime) {
    for (let index = hitEffects.length - 1; index >= 0; index -= 1) {
        const effect = hitEffects[index];
        effect.radius += 84 * deltaTime;
        effect.alpha -= 4.8 * deltaTime;

        if (effect.alpha <= 0) {
            hitEffects.splice(index, 1);
        }
    }
}

function detectBrickCollision() {
    for (const brick of bricks) {
        if (brick.active && ballTouchesBrick(brick)) {
            createHitEffect(brick);
            brick.active = false;
            addScore(brick.value);
            playScoreSound(brick.value);
            bounceOffBrick(brick);

            if (bricks.every((currentBrick) => !currentBrick.active)) {
                completeLevel();
            }

            break;
        }
    }
}

function addScore(points) {
    score += points;

    if (score > highScore) {
        highScore = score;
        saveHighScore();
    }
}

function completeLevel() {
    if (level === gameConfig.maxLevel) {
        endGame('won');
        return;
    }

    level += 1;
    hitEffects.length = 0;
    buildBricks();
    paddle.x = (canvas.width - paddle.width) / 2;
    resetBall();
}

function resetBall() {
    const levelSpeed = gameConfig.baseBallSpeed
        + (level - 1) * gameConfig.speedIncreasePerLevel;

    ball.x = canvas.width / 2;
    ball.y = 232;
    ball.velocityX = levelSpeed;
    ball.velocityY = -levelSpeed;
}

function loseLife() {
    lives -= 1;

    if (lives === 0) {
        endGame('lost');
    } else {
        resetBall();
    }
}

function endGame(status) {
    if (gameStatus !== 'playing') {
        return;
    }

    gameStatus = status;
    pauseButton.hidden = true;
    restartButton.hidden = false;
}

function drawScene() {
    drawBackground();
    drawBricks();
    drawHitEffects();
    drawBall();
    drawPaddle();
    drawHud();
    drawStageLabel();
    drawGameMessage();
}

function updatePaddle(deltaTime) {
    if (keys.leftPressed && !keys.rightPressed) {
        paddle.x -= paddle.speed * deltaTime;
    } else if (keys.rightPressed && !keys.leftPressed) {
        paddle.x += paddle.speed * deltaTime;
    }

    paddle.x = Math.max(0, Math.min(paddle.x, canvas.width - paddle.width));
}

function renderScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawScene();
}

function scheduleGameLoop() {
    if (animationFrameId === null) {
        animationFrameId = requestAnimationFrame(gameLoop);
    }
}

function stopGameLoop() {
    if (animationFrameId !== null) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }

    lastFrameTime = null;
}

function gameLoop(currentTime) {
    animationFrameId = null;
    const deltaTime = lastFrameTime === null
        ? 0
        : Math.min((currentTime - lastFrameTime) / 1000, gameConfig.maxFrameTime);
    lastFrameTime = currentTime;

    if (gameStatus === 'playing') {
        updatePaddle(deltaTime);
        updateBall(deltaTime);

        if (gameStatus === 'playing') {
            detectBrickCollision();
        }

        updateHitEffects(deltaTime);
    }

    renderScene();

    if (gameStatus === 'playing') {
        scheduleGameLoop();
    }
}

function resetGame() {
    score = 0;
    lives = gameConfig.startingLives;
    level = 1;
    keys.leftPressed = false;
    keys.rightPressed = false;
    hitEffects.length = 0;
    paddle.x = (canvas.width - paddle.width) / 2;
    buildBricks();
    resetBall();
}

function startGame() {
    if (gameStatus !== 'ready') {
        return;
    }

    enableAudio();
    gameStatus = 'playing';
    startButton.hidden = true;
    pauseButton.hidden = false;
    pauseButton.textContent = '暂停';
    scheduleGameLoop();
}

function togglePause() {
    if (gameStatus === 'playing') {
        gameStatus = 'paused';
        keys.leftPressed = false;
        keys.rightPressed = false;
        pauseButton.textContent = '继续';
        stopGameLoop();
        renderScene();
    } else if (gameStatus === 'paused') {
        enableAudio();
        gameStatus = 'playing';
        pauseButton.textContent = '暂停';
        scheduleGameLoop();
    }
}

function restartGame() {
    enableAudio();
    stopGameLoop();
    resetGame();
    gameStatus = 'playing';
    startButton.hidden = true;
    pauseButton.hidden = false;
    pauseButton.textContent = '暂停';
    restartButton.hidden = true;
    renderScene();
    scheduleGameLoop();
}

startButton.addEventListener('click', startGame);
pauseButton.addEventListener('click', togglePause);
restartButton.addEventListener('click', restartGame);

resetGame();
renderScene();

