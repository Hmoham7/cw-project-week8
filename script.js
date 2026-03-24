// Game configuration and state variables
const DIFFICULTY_SETTINGS = {
  easy: {
    label: 'Easy',
    winThreshold: 15,
    duration: 40,
    spawnRate: 1200,
    missPenalty: 0,
    milestones: [
      { score: 5, message: 'Great start!' },
      { score: 8, message: 'Halfway there!' },
      { score: 12, message: 'Final stretch!' }
    ]
  },
  normal: {
    label: 'Normal',
    winThreshold: 20,
    duration: 30,
    spawnRate: 1000,
    missPenalty: 1,
    milestones: [
      { score: 5, message: 'Great start!' },
      { score: 10, message: 'Halfway there!' },
      { score: 15, message: 'Final stretch!' }
    ]
  },
  hard: {
    label: 'Hard',
    winThreshold: 24,
    duration: 20,
    spawnRate: 700,
    missPenalty: 2,
    milestones: [
      { score: 6, message: 'Great start!' },
      { score: 12, message: 'Halfway there!' },
      { score: 18, message: 'Final stretch!' }
    ]
  }
};

const SOUND_FILES = {
  gameStart: 'img/foxboytails-game-start-317318.mp3',
  gameWin: 'img/superpuyofans1234-winner-game-sound-404167.mp3',
  gameEnd: 'img/alphix-game-over-417465.mp3'
};

let currentCans = 0;         // Current number of items collected
let gameActive = false;      // Tracks if game is currently running
let spawnInterval;          // Holds the interval for spawning items
let timer = DIFFICULTY_SETTINGS.normal.duration; // Timer in seconds
let timerInterval;          // Holds the interval for timer countdown
let canWasMissed = false;    // Tracks whether the current can was not clicked
let currentDifficulty = 'normal';
let audioContext;
let announcedMilestones = new Set();

const audioEffects = {
  gameStart: new Audio(SOUND_FILES.gameStart),
  gameWin: new Audio(SOUND_FILES.gameWin),
  gameEnd: new Audio(SOUND_FILES.gameEnd)
};

audioEffects.gameStart.volume = 0.35;
audioEffects.gameWin.volume = 0.45;
audioEffects.gameEnd.volume = 0.35;

const winningMessages = [
  'Great job! You kept the village hydrated!',
  'Victory! You crushed the water quest!',
  'Awesome work! Mission complete!'
];

const losingMessages = [
  'Nice try! Play again and collect a few more cans!',
  'So close. Try again and beat your score!',
  'Keep going! You can reach 20 next round!'
];

function getAudioContext() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

function playSoundEffect(effectName) {
  const effect = audioEffects[effectName];
  if (!effect) return;
  const playback = effect.cloneNode();
  playback.volume = effect.volume;
  playback.play().catch(() => {
    // Ignore blocked autoplay attempts.
  });
}

function playTone({ frequency, duration, gain = 0.05, type = 'sine', rampTo = 0 }) {
  const ctx = getAudioContext();
  if (!ctx) return;

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {
      // Resume can fail when browser blocks audio; keep game playable.
    });
  }

  const now = ctx.currentTime;
  const oscillator = ctx.createOscillator();
  const gainNode = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);
  gainNode.gain.setValueAtTime(0.0001, now);
  gainNode.gain.exponentialRampToValueAtTime(gain, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + duration);

  if (rampTo > 0) {
    oscillator.frequency.exponentialRampToValueAtTime(rampTo, now + duration);
  }

  oscillator.connect(gainNode);
  gainNode.connect(ctx.destination);
  oscillator.start(now);
  oscillator.stop(now + duration + 0.02);
}

function playButtonClickSound() {
  playTone({ frequency: 420, duration: 0.08, gain: 0.04, type: 'triangle', rampTo: 520 });
}

function playMissSound() {
  playTone({ frequency: 220, duration: 0.12, gain: 0.045, type: 'sawtooth', rampTo: 170 });
}

function playSparkleSound() {
  playTone({ frequency: 1080, duration: 0.09, gain: 0.03, type: 'triangle', rampTo: 1360 });
  window.setTimeout(() => {
    playTone({ frequency: 1520, duration: 0.07, gain: 0.02, type: 'sine', rampTo: 1880 });
  }, 45);
}

function maybeShowMilestoneMessage() {
  if (!gameActive) return;
  const config = DIFFICULTY_SETTINGS[currentDifficulty];
  const achievements = document.getElementById('achievements');
  if (!config || !achievements || !Array.isArray(config.milestones)) return;

  for (const milestone of config.milestones) {
    if (currentCans >= milestone.score && !announcedMilestones.has(milestone.score)) {
      achievements.textContent = `${milestone.message} (${currentCans}/${config.winThreshold})`;
      announcedMilestones.add(milestone.score);
    }
  }
}

// Creates the 3x3 game grid where items will appear
function createGrid() {
  const grid = document.querySelector('.game-grid');
  grid.innerHTML = ''; // Clear any existing grid cells
  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell'; // Each cell represents a grid square
    grid.appendChild(cell);
  }
}

// Ensure the grid is created when the page loads
createGrid();
updateInstructionText();

// Spawns a new item in a random grid cell
function spawnWaterCan() {
  if (!gameActive) return; // Stop if the game is not active
  const cells = document.querySelectorAll('.grid-cell');
  const difficultyConfig = DIFFICULTY_SETTINGS[currentDifficulty];

  // If the previous can was not clicked before respawn, apply a miss penalty.
  if (canWasMissed && difficultyConfig.missPenalty > 0) {
    currentCans = Math.max(0, currentCans - difficultyConfig.missPenalty);
    const scoreDisplay = document.getElementById('current-cans');
    if (scoreDisplay) scoreDisplay.textContent = currentCans;
    playMissSound();
  }
  
  // Clear all cells before spawning a new water can
  cells.forEach(cell => (cell.innerHTML = ''));

  // Select a random cell from the grid to place the water can
  const randomCell = cells[Math.floor(Math.random() * cells.length)];

  // Use a template literal to create the wrapper and water-can element
  randomCell.innerHTML = `
    <div class="water-can-wrapper">
      <div class="water-can"></div>
    </div>
  `;
  canWasMissed = true;

  // Add click event to the water can for +1 point
  const waterCan = randomCell.querySelector('.water-can');
  if (waterCan) {
    waterCan.addEventListener('click', function handleCanClick() {
      // Prevent multiple clicks on the same can
      if (!gameActive || waterCan.classList.contains('collected')) return;
      canWasMissed = false;
      currentCans += 1; // Increment score
      playSparkleSound();
      // Optionally update score display if present
      const scoreDisplay = document.getElementById('current-cans');
      if (scoreDisplay) {
        scoreDisplay.textContent = currentCans;
      }
      maybeShowMilestoneMessage();

      // Make collection obvious before removing from the DOM.
      waterCan.classList.add('collected');
      const wrapper = waterCan.parentElement;
      if (wrapper) {
        wrapper.classList.add('collected-wrapper');
        window.setTimeout(() => {
          if (wrapper.isConnected) {
            wrapper.remove();
          }
        }, 250);
      }
    });
  }
}

function updateInstructionText() {
  const instruction = document.getElementById('game-instructions');
  const config = DIFFICULTY_SETTINGS[currentDifficulty];
  if (!instruction || !config) return;
  instruction.textContent = `Difficulty: ${config.label} - Collect ${config.winThreshold} cans in ${config.duration} seconds to win!`;
}

function setDifficulty(mode) {
  if (!DIFFICULTY_SETTINGS[mode]) return;
  currentDifficulty = mode;
  updateInstructionText();

  if (!gameActive) {
    timer = DIFFICULTY_SETTINGS[currentDifficulty].duration;
    const timerDisplay = document.getElementById('timer');
    if (timerDisplay) timerDisplay.textContent = timer;
  }
}

function setDifficultyLocked(locked) {
  const difficultyMode = document.getElementById('difficulty-mode');
  if (!difficultyMode) return;
  difficultyMode.disabled = locked;
}

// Initializes and starts a new game
function startGame() {
  if (gameActive) return; // Prevent starting a new game if one is already active
  const difficultyMode = document.getElementById('difficulty-mode');
  if (difficultyMode) {
    setDifficulty(difficultyMode.value);
  }

  const config = DIFFICULTY_SETTINGS[currentDifficulty];
  gameActive = true;
  setDifficultyLocked(true);
  playSoundEffect('gameStart');
  currentCans = 0;
  announcedMilestones = new Set();
  canWasMissed = false;
  timer = config.duration; // Reset timer
  createGrid(); // Set up the game grid
  const scoreDisplay = document.getElementById('current-cans');
  if (scoreDisplay) scoreDisplay.textContent = currentCans;
  const achievements = document.getElementById('achievements');
  if (achievements) achievements.textContent = '';
  spawnInterval = setInterval(spawnWaterCan, config.spawnRate); // Spawn water cans based on difficulty
  // Start timer countdown
  const timerDisplay = document.getElementById('timer');
  if (timerDisplay) timerDisplay.textContent = timer;
  timerInterval = setInterval(() => {
    timer--;
    if (timerDisplay) timerDisplay.textContent = timer;
    if (timer <= 0) {
      endGame();
    }
  }, 1000);
}

function endGame() {
  if (!gameActive) return;
  gameActive = false; // Mark the game as inactive
  setDifficultyLocked(false);
  clearInterval(spawnInterval); // Stop spawning water cans
  clearInterval(timerInterval); // Stop timer countdown

  const config = DIFFICULTY_SETTINGS[currentDifficulty];
  const hasWon = currentCans >= config.winThreshold;
  const messagePool = currentCans >= config.winThreshold ? winningMessages : losingMessages;
  const randomMessage = messagePool[Math.floor(Math.random() * messagePool.length)];
  const resultPrefix = `(${config.label} mode) Score: ${currentCans}/${config.winThreshold}. `;
  playSoundEffect(hasWon ? 'gameWin' : 'gameEnd');
  const achievements = document.getElementById('achievements');
  if (achievements) {
    achievements.textContent = resultPrefix + randomMessage;
  } else {
    alert(resultPrefix + randomMessage);
  }
}

function resetGame() {
  gameActive = false;
  setDifficultyLocked(false);
  canWasMissed = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  currentCans = 0;
  announcedMilestones = new Set();
  timer = DIFFICULTY_SETTINGS[currentDifficulty].duration;
  createGrid();

  const scoreDisplay = document.getElementById('current-cans');
  if (scoreDisplay) scoreDisplay.textContent = currentCans;

  const timerDisplay = document.getElementById('timer');
  if (timerDisplay) timerDisplay.textContent = timer;

  const achievements = document.getElementById('achievements');
  if (achievements) achievements.textContent = '';

  updateInstructionText();
}

// Set up click handler for the start button
document.getElementById('start-game').addEventListener('click', () => {
  playButtonClickSound();
  startGame();
});
document.getElementById('reset-game').addEventListener('click', () => {
  playButtonClickSound();
  resetGame();
});

const difficultyMode = document.getElementById('difficulty-mode');
if (difficultyMode) {
  difficultyMode.addEventListener('change', event => {
    setDifficulty(event.target.value);
  });
}
