// --- Elements & Constants ---
const canvas = document.getElementById("tetris-board");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const endButton = document.getElementById("end-button");
const muteButton = document.getElementById("mute-button");
const audioElement = document.getElementById("bg-music");
const pauseOverlay = document.getElementById("pause-overlay");

const COLS = 10,
  ROWS = 20;
const BLOCK_SIZE = canvas.width / COLS;
canvas.height = BLOCK_SIZE * ROWS;

// --- Difficulty Settings ---
const LINES_PER_LEVEL = 3;
const INITIAL_GAME_SPEED = 1000;
const MIN_GAME_SPEED = 150;
const SPEED_DECREMENT = 75;

// --- Visuals ---
// --- ADDED new colors for new shapes ---
const COLORS = [
  null, // 0: Empty
  "#E6194B", // 1: I - Red
  "#3CB44B", // 2: J - Green
  "#FFE119", // 3: L - Yellow
  "#4363D8", // 4: T - Blue
  "#F58231", // 5: S - Orange
  "#911EB4", // 6: Z - Purple
  "#46F0F0", // 7: O - Cyan
  "#fabed4", // 8: Dot - Pink
  "#f032e6", // 9: Domino - Magenta
  "#a9a9a9", // 10: Short L - Dark Gray
  "#008080", // 11: Short Line - Teal
];

// --- ADDED new shape definitions ---
const SHAPES = [
  [], // 0: Empty
  [[1, 1, 1, 1]], // 1: I
  [
    [1, 0, 0],
    [1, 1, 1],
  ], // 2: J
  [
    [0, 0, 1],
    [1, 1, 1],
  ], // 3: L
  [
    [0, 1, 0],
    [1, 1, 1],
  ], // 4: T
  [
    [0, 1, 1],
    [1, 1, 0],
  ], // 5: S
  [
    [1, 1, 0],
    [0, 1, 1],
  ], // 6: Z
  [
    [1, 1],
    [1, 1],
  ], // 7: O
  [[1]], // 8: Dot
  [[1, 1]], // 9: Domino
  [
    [1, 1],
    [1, 0],
  ], // 10: Short L
  [[1, 1, 1]], // 11: Short Line
];

const EMPTY_COLOR = "#282828";
const GRID_COLOR = "#333";
const GHOST_ALPHA = 0.35;
const GHOST_DARKEN_FACTOR = 0.6;

// --- Input Handling ---
let isProcessingInput = false;
const INPUT_COOLDOWN = 50;

// --- Helper Functions ---
function shadeColor(color, percent) {
  let R = parseInt(color.substring(1, 3), 16),
    G = parseInt(color.substring(3, 5), 16),
    B = parseInt(color.substring(5, 7), 16);
  R = parseInt((R * (100 + percent)) / 100);
  G = parseInt((G * (100 + percent)) / 100);
  B = parseInt((B * (100 + percent)) / 100);
  R = R < 255 ? R : 255;
  G = G < 255 ? G : 255;
  B = B < 255 ? B : 255;
  R = Math.max(0, R);
  G = Math.max(0, G);
  B = Math.max(0, B);
  const RR = R.toString(16).length == 1 ? "0" + R.toString(16) : R.toString(16),
    GG = G.toString(16).length == 1 ? "0" + G.toString(16) : G.toString(16),
    BB = B.toString(16).length == 1 ? "0" + B.toString(16) : B.toString(16);
  return "#" + RR + GG + BB;
}
function getGhostColor(hexColor) {
  hexColor = hexColor.startsWith("#") ? hexColor.slice(1) : hexColor;
  let r = parseInt(hexColor.substring(0, 2), 16);
  let g = parseInt(hexColor.substring(2, 4), 16);
  let b = parseInt(hexColor.substring(4, 6), 16);
  r = Math.floor(r * GHOST_DARKEN_FACTOR);
  g = Math.floor(g * GHOST_DARKEN_FACTOR);
  b = Math.floor(b * GHOST_DARKEN_FACTOR);
  r = Math.max(0, Math.min(255, r));
  g = Math.max(0, Math.min(255, g));
  b = Math.max(0, Math.min(255, b));
  return `rgba(${r}, ${g}, ${b}, ${GHOST_ALPHA})`;
}

// --- Game State Variables ---
let board;
let currentPiece;
let score;
let gameOver;
let isPaused;
let gameLoopInterval;
let gameSpeed;
let gameRunning = false;
let isMuted = false;
let currentLevel;
let totalLinesCleared;

// --- Core Game Logic Functions (Unchanged, they adapt automatically) ---
function createBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}
function getRandomPiece() {
  const i = Math.floor(Math.random() * (SHAPES.length - 1)) + 1;
  const s = SHAPES[i];
  return {
    shape: s,
    color: COLORS[i],
    colorIndex: i,
    x: Math.floor(COLS / 2) - Math.floor(s[0].length / 2),
    y: 0,
  };
}
function isValidMove(nX, nY, shape) {
  for (let y = 0; y < shape.length; y++) {
    for (let x = 0; x < shape[y].length; x++) {
      if (shape[y][x]) {
        const bX = nX + x,
          bY = nY + y;
        if (bX < 0 || bX >= COLS || bY >= ROWS || (bY >= 0 && board[bY][bX]))
          return false;
      }
    }
  }
  return true;
}
function rotatePiece() {
  if (!currentPiece) return;
  const oS = currentPiece.shape; // Prevent rotation of O-block and Dot-block
  if (
    oS.length === oS[0].length &&
    oS.every((row, i) => row.every((val, j) => val === oS[0][0]))
  ) {
    if (oS.length <= 2) return; // Don't rotate O (2x2) or Dot (1x1)
  }
  const r = oS.length,
    c = oS[0].length;
  const nS = Array.from({ length: c }, () => Array(r).fill(0));
  for (let y = 0; y < r; y++) {
    for (let x = 0; x < c; x++) {
      nS[x][r - 1 - y] = oS[y][x];
    }
  }
  let kX = 0;
  if (!isValidMove(currentPiece.x, currentPiece.y, nS)) {
    kX = currentPiece.x + c / 2 < COLS / 2 ? 1 : -1;
    if (!isValidMove(currentPiece.x + kX, currentPiece.y, nS)) {
      if (!isValidMove(currentPiece.x + kX * 2, currentPiece.y, nS)) {
        return;
      } else {
        kX *= 2;
      }
    }
  }
  currentPiece.x += kX;
  currentPiece.shape = nS;
}
function lockPiece() {
  if (!currentPiece) return;
  currentPiece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val) {
        const bX = currentPiece.x + x,
          bY = currentPiece.y + y;
        if (bY >= 0 && bY < ROWS && bX >= 0 && bX < COLS)
          board[bY][bX] = currentPiece.colorIndex;
      }
    });
  });
}
function clearLines() {
  let linesClearedThisTurn = 0;
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell)) {
      linesClearedThisTurn++;
      board.splice(y, 1);
      board.unshift(Array(COLS).fill(0));
      y++;
    }
  }
  if (linesClearedThisTurn > 0) {
    let points = [0, 40, 100, 300, 1200][linesClearedThisTurn] || 0;
    score += points * currentLevel;
    scoreElement.textContent = score;
    totalLinesCleared += linesClearedThisTurn;
    const newLevel = Math.floor(totalLinesCleared / LINES_PER_LEVEL) + 1;
    if (newLevel > currentLevel) {
      currentLevel = newLevel;
      levelElement.textContent = currentLevel;
      gameSpeed = Math.max(
        MIN_GAME_SPEED,
        INITIAL_GAME_SPEED - (currentLevel - 1) * SPEED_DECREMENT
      );
      if (gameRunning && !isPaused && !gameOver) {
        clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, gameSpeed);
      }
    }
  }
}

// --- Drawing Functions (Unchanged) ---
function drawBlock(x, y, color) {
  const bX = x * BLOCK_SIZE,
    bY = y * BLOCK_SIZE,
    i = BLOCK_SIZE * 0.1;
  context.fillStyle = color;
  context.fillRect(bX, bY, BLOCK_SIZE, BLOCK_SIZE);
  context.fillStyle = shadeColor(color, 25);
  context.fillRect(bX, bY, BLOCK_SIZE, i);
  context.fillRect(bX, bY + i, i, BLOCK_SIZE - i);
  context.fillStyle = shadeColor(color, -25);
  context.fillRect(bX, bY + BLOCK_SIZE - i, BLOCK_SIZE, i);
  context.fillRect(bX + BLOCK_SIZE - i, bY, i, BLOCK_SIZE - i);
}
function drawBoard() {
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      context.fillStyle = EMPTY_COLOR;
      context.fillRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      context.strokeStyle = GRID_COLOR;
      context.lineWidth = 0.5;
      context.strokeRect(
        x * BLOCK_SIZE,
        y * BLOCK_SIZE,
        BLOCK_SIZE,
        BLOCK_SIZE
      );
    }
  }
  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if (board[y][x]) drawBlock(x, y, COLORS[board[y][x]]);
    }
  }
}
function drawPiece() {
  if (!currentPiece) return;
  currentPiece.shape.forEach((row, y) => {
    row.forEach((val, x) => {
      if (val)
        drawBlock(currentPiece.x + x, currentPiece.y + y, currentPiece.color);
    });
  });
}
function calculateGhostY() {
  if (!currentPiece) return 0;
  let ghostY = currentPiece.y;
  while (isValidMove(currentPiece.x, ghostY + 1, currentPiece.shape)) ghostY++;
  return ghostY;
}
function drawGhostPiece(ghostY) {
  if (!currentPiece || isPaused || gameOver) return;
  context.fillStyle = getGhostColor(currentPiece.color);
  currentPiece.shape.forEach((row, y) => {
    row.forEach((value, x) => {
      if (value) {
        const drawX = (currentPiece.x + x) * BLOCK_SIZE;
        const drawY = (ghostY + y) * BLOCK_SIZE;
        context.fillRect(drawX, drawY, BLOCK_SIZE, BLOCK_SIZE);
      }
    });
  });
}

// --- Game State Management Functions (Unchanged) ---
function updateButtonStates() {
  startButton.disabled = gameRunning || isPaused;
  pauseButton.disabled = !gameRunning && !isPaused;
  endButton.disabled = !gameRunning && !isPaused;
  pauseButton.textContent = isPaused ? "Resume" : "Pause";
  muteButton.textContent = isMuted ? "Unmute" : "Mute";
  isMuted
    ? muteButton.classList.add("muted")
    : muteButton.classList.remove("muted");
}
function playMusic() {
  if (audioElement && !isMuted && audioElement.paused) {
    let p = audioElement.play();
    if (p !== undefined) p.catch((e) => console.warn("Audio play failed: ", e));
  }
}
function pauseMusic() {
  if (audioElement) audioElement.pause();
}
function stopMusic() {
  if (audioElement) {
    audioElement.pause();
    audioElement.currentTime = 0;
  }
}
function toggleMute() {
  isMuted = !isMuted;
  if (isMuted) pauseMusic();
  else if (gameRunning && !isPaused) playMusic();
  updateButtonStates();
}
function pauseGame() {
  if (!gameRunning || isPaused) return;
  isPaused = true;
  gameRunning = false;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  gameLoopInterval = null;
  pauseMusic();
  pauseOverlay.style.display = "flex";
  updateButtonStates();
}
function resumeGame() {
  if (!isPaused || gameOver) return;
  isPaused = false;
  gameRunning = true;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  gameLoopInterval = setInterval(gameLoop, gameSpeed);
  playMusic();
  pauseOverlay.style.display = "none";
  updateButtonStates();
}
function endGame(showMsg = true) {
  if (gameOver || (!gameRunning && !isPaused)) return;
  gameOver = true;
  isPaused = false;
  gameRunning = false;
  if (gameLoopInterval) {
    clearInterval(gameLoopInterval);
    gameLoopInterval = null;
  }
  stopMusic();
  context.clearRect(0, 0, canvas.width, canvas.height);
  drawBoard();
  if (showMsg)
    alert(`Game Over! Final Score: ${score} | Level: ${currentLevel}`);
  pauseOverlay.style.display = "none";
  updateButtonStates();
}

// --- Main Game Loop (Unchanged) ---
function gameLoop() {
  if (isPaused || gameOver) {
    if (gameLoopInterval) clearInterval(gameLoopInterval);
    gameLoopInterval = null;
    return;
  }
  if (!currentPiece) {
    currentPiece = getRandomPiece();
    if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
      endGame();
      return;
    }
  }
  if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
    currentPiece.y++;
  } else {
    lockPiece();
    clearLines();
    if (gameOver) return;
    currentPiece = getRandomPiece();
    if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
      endGame();
      return;
    }
  }
  if (!gameOver && !isPaused) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    const ghostY = calculateGhostY();
    drawGhostPiece(ghostY);
    drawPiece();
  }
}

// --- Start Game Function (Unchanged) ---
function startGame() {
  if (gameRunning || isPaused) return;
  board = createBoard();
  score = 0;
  totalLinesCleared = 0;
  currentLevel = 1;
  gameSpeed = INITIAL_GAME_SPEED;
  scoreElement.textContent = score;
  levelElement.textContent = currentLevel;
  gameOver = false;
  isPaused = false;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  gameLoopInterval = null;
  currentPiece = getRandomPiece();
  if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
    endGame();
    return;
  }
  gameRunning = true;
  playMusic();
  pauseOverlay.style.display = "none";
  gameLoopInterval = setInterval(gameLoop, gameSpeed);
  updateButtonStates();
}

// --- Event Listeners (Added rotation check for Dot) ---
document.addEventListener("keydown", (event) => {
  // Keyboard Controls
  if (event.key.startsWith("Arrow")) {
    if (isProcessingInput) return;
    isProcessingInput = true;
    setTimeout(() => {
      isProcessingInput = false;
    }, INPUT_COOLDOWN);
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!gameRunning && !isPaused && !gameOver) startGame();
    else if (gameRunning || isPaused) isPaused ? resumeGame() : pauseGame();
    isProcessingInput = false;
    return;
  }
  if (!gameRunning || isPaused || gameOver || !currentPiece) {
    isProcessingInput = false;
    return;
  }
  let movedOrRotated = false;
  switch (event.key) {
    case "ArrowLeft":
      if (isValidMove(currentPiece.x - 1, currentPiece.y, currentPiece.shape)) {
        currentPiece.x--;
        movedOrRotated = true;
      }
      break;
    case "ArrowRight":
      if (isValidMove(currentPiece.x + 1, currentPiece.y, currentPiece.shape)) {
        currentPiece.x++;
        movedOrRotated = true;
      }
      break;
    case "ArrowDown":
      if (isValidMove(currentPiece.x, currentPiece.y + 1, currentPiece.shape)) {
        currentPiece.y++;
        movedOrRotated = true;
        score += 1;
        scoreElement.textContent = score;
      } else {
        gameLoop();
        movedOrRotated = false;
      }
      break;
    case "ArrowUp":
      // Prevent rotation attempt if it's the Dot piece (index 8) or O-piece (index 7)
      if (currentPiece.colorIndex !== 8 && currentPiece.colorIndex !== 7) {
        const oldX = currentPiece.x;
        const oldShape = JSON.stringify(currentPiece.shape); // Need deep comparison
        rotatePiece();
        // Check if position or shape actually changed
        if (
          currentPiece.x !== oldX ||
          JSON.stringify(currentPiece.shape) !== oldShape
        ) {
          movedOrRotated = true;
        }
      }
      break;
  }
  if (movedOrRotated && !gameOver && !isPaused) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    const ghostY = calculateGhostY();
    drawGhostPiece(ghostY);
    drawPiece();
  }
});
startButton.addEventListener("click", startGame); // Button Listeners
pauseButton.addEventListener("click", () => {
  isPaused ? resumeGame() : pauseGame();
});
endButton.addEventListener("click", () => endGame(true));
muteButton.addEventListener("click", toggleMute);
window.addEventListener("blur", () => {
  if (gameRunning && !isPaused && !gameOver) pauseGame();
}); // Window Focus

// --- Initial Setup (Unchanged) ---
board = createBoard();
drawBoard();
updateButtonStates();
levelElement.textContent = "1";
