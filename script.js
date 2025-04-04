// --- Elements & Constants ---
const canvas = document.getElementById("tetris-board");
const context = canvas.getContext("2d");
const scoreElement = document.getElementById("score");
const levelElement = document.getElementById("level");
const startButton = document.getElementById("start-button");
const pauseButton = document.getElementById("pause-button");
const endButton = document.getElementById("end-button");
// Removed muteButton
const audioElement = document.getElementById("bg-music"); // Background Music
const sfxLineClear = document.getElementById("sfx-line-clear"); // SFX
const pauseOverlay = document.getElementById("pause-overlay");
const volumeSlider = document.getElementById("volume-slider"); // <<< NEW Volume Slider

const COLS = 10,
  ROWS = 20;
const BLOCK_SIZE = canvas.width / COLS;
canvas.height = BLOCK_SIZE * ROWS;

// --- Difficulty Settings ---
const LINES_PER_LEVEL = 3;
const INITIAL_GAME_SPEED = 850;
const MIN_GAME_SPEED = 120;
const SPEED_DECREMENT = 90;

// --- Visuals ---
const COLORS = [
  null,
  "#E6194B",
  "#3CB44B",
  "#FFE119",
  "#4363D8",
  "#F58231",
  "#911EB4",
  "#46F0F0",
  "#fabed4",
  "#f032e6",
  "#a9a9a9",
  "#008080",
];
const SHAPES = [
  [],
  [[1, 1, 1, 1]],
  [
    [1, 0, 0],
    [1, 1, 1],
  ],
  [
    [0, 0, 1],
    [1, 1, 1],
  ],
  [
    [0, 1, 0],
    [1, 1, 1],
  ],
  [
    [0, 1, 1],
    [1, 1, 0],
  ],
  [
    [1, 1, 0],
    [0, 1, 1],
  ],
  [
    [1, 1],
    [1, 1],
  ],
  [[1]],
  [[1, 1]],
  [
    [1, 1],
    [1, 0],
  ],
  [[1, 1, 1]],
];
const EMPTY_COLOR = "#282828";
const GRID_COLOR = "#333";
const GHOST_ALPHA = 0.35;
const GHOST_DARKEN_FACTOR = 0.6;
const LINE_CLEAR_EFFECT_DURATION = 180;
const FRAGMENT_COLOR = "#DDDDDD";
const FRAGMENT_SIZE_DIVISOR = 3;
const FRAGMENTS_PER_BLOCK = 3;
const FRAGMENT_SPREAD = BLOCK_SIZE * 0.6;

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

// --- UPDATED Play Sound Function (No mute check needed) ---
function playSound(audioElement) {
  if (audioElement) {
    // Just check if element exists
    audioElement.currentTime = 0; // Rewind to start
    // Set SFX volume to max (optional, good practice)
    audioElement.volume = 1.0;
    let playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => console.warn("SFX play failed:", error));
    }
  }
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
// Removed isMuted
let currentLevel;
let totalLinesCleared;
let isClearingLines = false;

// --- Core Game Logic Functions (Unchanged) ---
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
  if (currentPiece.colorIndex === 8 || currentPiece.colorIndex === 7) return;
  const oS = currentPiece.shape,
    r = oS.length,
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
  // (Keep fragment effect logic as before)
  if (isClearingLines) return;
  const clearedLineIndices = [];
  for (let y = ROWS - 1; y >= 0; y--) {
    if (board[y].every((cell) => cell !== 0)) clearedLineIndices.push(y);
  }
  if (clearedLineIndices.length > 0) {
    isClearingLines = true;
    playSound(sfxLineClear); // << Play SFX
    if (gameLoopInterval) {
      clearInterval(gameLoopInterval);
      gameLoopInterval = null;
    }
    context.fillStyle = FRAGMENT_COLOR;
    const fragmentSize = BLOCK_SIZE / FRAGMENT_SIZE_DIVISOR;
    clearedLineIndices.forEach((y) => {
      for (let x = 0; x < COLS; x++) {
        const cX = (x + 0.5) * BLOCK_SIZE,
          cY = (y + 0.5) * BLOCK_SIZE;
        for (let i = 0; i < FRAGMENTS_PER_BLOCK; i++) {
          const fX =
              cX + (Math.random() - 0.5) * FRAGMENT_SPREAD - fragmentSize / 2,
            fY =
              cY + (Math.random() - 0.5) * FRAGMENT_SPREAD - fragmentSize / 2;
          context.fillRect(fX, fY, fragmentSize, fragmentSize);
        }
      }
    });
    setTimeout(() => {
      clearedLineIndices.sort((a, b) => b - a);
      clearedLineIndices.forEach((index) => {
        board.splice(index, 1);
      });
      for (let i = 0; i < clearedLineIndices.length; i++)
        board.unshift(Array(COLS).fill(0));
      const linesClearedThisTurn = clearedLineIndices.length;
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
      }
      isClearingLines = false;
      if (gameRunning && !isPaused && !gameOver) {
        if (gameLoopInterval) clearInterval(gameLoopInterval);
        gameLoopInterval = setInterval(gameLoop, gameSpeed);
      }
    }, LINE_CLEAR_EFFECT_DURATION);
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

// --- Game State Management Functions ---
// Removed Mute Button logic from updateButtonStates
function updateButtonStates() {
  startButton.disabled = gameRunning || isPaused || isClearingLines;
  pauseButton.disabled = (!gameRunning && !isPaused) || isClearingLines;
  endButton.disabled = (!gameRunning && !isPaused) || isClearingLines;
  pauseButton.textContent = isPaused
    ? "Resume"
    : "Pause"; /* Mute button lines removed */
}

// --- UPDATED Music Control Functions (No mute check) ---
function playMusic() {
  if (audioElement && audioElement.paused) {
    // Just check if paused
    // Ensure volume is set before playing (in case it wasn't set initially)
    audioElement.volume = parseFloat(volumeSlider.value);
    let playPromise = audioElement.play();
    if (playPromise !== undefined) {
      playPromise.catch((error) => console.warn("Music play failed: ", error));
    }
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

// Removed toggleMute function

function pauseGame() {
  if (!gameRunning || isPaused || isClearingLines) return;
  isPaused = true;
  gameRunning = false;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  gameLoopInterval = null;
  pauseMusic();
  pauseOverlay.style.display = "flex";
  updateButtonStates();
}
function resumeGame() {
  if (!isPaused || gameOver || isClearingLines) return;
  isPaused = false;
  gameRunning = true;
  if (gameLoopInterval) clearInterval(gameLoopInterval);
  gameLoopInterval = setInterval(gameLoop, gameSpeed);
  playMusic();
  pauseOverlay.style.display = "none";
  updateButtonStates();
}
function endGame(showMsg = true) {
  if (gameOver || (!gameRunning && !isPaused && !isClearingLines)) return;
  gameOver = true;
  isPaused = false;
  gameRunning = false;
  isClearingLines = false;
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

// --- Main Game Loop (Unchanged from previous fragment version) ---
function gameLoop() {
  if (isPaused || gameOver || isClearingLines) {
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
    if (!isClearingLines) {
      if (gameOver) return;
      currentPiece = getRandomPiece();
      if (!isValidMove(currentPiece.x, currentPiece.y, currentPiece.shape)) {
        endGame();
        return;
      }
    } else {
      currentPiece = null;
      return;
    }
  }
  if (!gameOver && !isPaused && !isClearingLines) {
    context.clearRect(0, 0, canvas.width, canvas.height);
    drawBoard();
    if (currentPiece) {
      const ghostY = calculateGhostY();
      drawGhostPiece(ghostY);
      drawPiece();
    }
  }
}

// --- Start Game Function (Unchanged) ---
function startGame() {
  if (gameRunning || isPaused || isClearingLines) return;
  board = createBoard();
  score = 0;
  totalLinesCleared = 0;
  currentLevel = 1;
  gameSpeed = INITIAL_GAME_SPEED;
  scoreElement.textContent = score;
  levelElement.textContent = currentLevel;
  gameOver = false;
  isPaused = false;
  isClearingLines = false;
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

// --- Event Listeners ---
document.addEventListener("keydown", (event) => {
  // Keyboard Controls
  if (isClearingLines) return;
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
      if (currentPiece.colorIndex !== 8 && currentPiece.colorIndex !== 7) {
        const oldX = currentPiece.x;
        const oldShape = JSON.stringify(currentPiece.shape);
        rotatePiece();
        if (
          currentPiece.x !== oldX ||
          JSON.stringify(currentPiece.shape) !== oldShape
        )
          movedOrRotated = true;
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
// Removed MuteButton listener

// --- NEW Volume Slider Listener ---
volumeSlider.addEventListener("input", (event) => {
  const newVolume = parseFloat(event.target.value);
  if (audioElement) {
    audioElement.volume = newVolume;
  }
  // Optional: If music is currently playing, ensure it continues if volume > 0
  // if (newVolume > 0 && audioElement && audioElement.paused && gameRunning && !isPaused) {
  //     playMusic();
  // }
});

window.addEventListener("blur", () => {
  if (gameRunning && !isPaused && !gameOver && !isClearingLines) pauseGame();
}); // Window Focus

// --- Initial Setup ---
board = createBoard();
drawBoard();
updateButtonStates();
levelElement.textContent = "1";
// --- Set Initial Music Volume ---
if (audioElement) {
  audioElement.volume = parseFloat(volumeSlider.value);
}
