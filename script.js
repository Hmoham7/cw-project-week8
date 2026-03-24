// ----------------------------
// 1) Game settings
// ----------------------------
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

const WIN_MESSAGES = [
  'Great job! You kept the village hydrated!',
  'Victory! You crushed the water quest!',
  'Awesome work! Mission complete!'
];

const LOSE_MESSAGES = [
  'Nice try! Play again and collect a few more cans!',
  'So close. Try again and beat your score!',
  'Keep going! You can reach 20 next round!'
];

// ----------------------------
// 2) DOM references
// ----------------------------
const ui = {
  grid: document.querySelector('.game-grid'),
  score: document.getElementById('current-cans'),
  timer: document.getElementById('timer'),
  achievements: document.getElementById('achievements'),
  instructions: document.getElementById('game-instructions'),
  difficulty: document.getElementById('difficulty-mode'),
  startButton: document.getElementById('start-game'),
  resetButton: document.getElementById('reset-game')
};

// ----------------------------
// 3) Mutable game state
// ----------------------------
const state = {
  score: 0,
  timeLeft: DIFFICULTY_SETTINGS.normal.duration,
  difficulty: 'normal',
  gameActive: false,
  missedLastCan: false,
  announcedMilestones: new Set(),
  spawnIntervalId: null,
  timerIntervalId: null,
  audioContext: null
};

const audioEffects = {
  gameStart: new Audio(SOUND_FILES.gameStart),
  gameWin: new Audio(SOUND_FILES.gameWin),
  gameEnd: new Audio(SOUND_FILES.gameEnd)
};

audioEffects.gameStart.volume = 0.35;
audioEffects.gameWin.volume = 0.45;
audioEffects.gameEnd.volume = 0.35;

// ----------------------------
// 4) Small helpers
// ----------------------------
function getConfig() {
  return DIFFICULTY_SETTINGS[state.difficulty];
}

function randomItem(list) {
  return list[Math.floor(Math.random() * list.length)];
}

function clearIntervals() {
  clearInterval(state.spawnIntervalId);
  clearInterval(state.timerIntervalId);
}

function lockDifficulty(isLocked) {
  if (ui.difficulty) ui.difficulty.disabled = isLocked;
}

function updateScoreDisplay() {
  if (ui.score) ui.score.textContent = state.score;
}

function updateTimerDisplay() {
  if (ui.timer) ui.timer.textContent = state.timeLeft;
}

function updateInstructionText() {
  const config = getConfig();
  if (!ui.instructions || !config) return;
  ui.instructions.textContent =
    `Difficulty: ${config.label} - Collect ${config.winThreshold} cans in ${config.duration} seconds to win!`;
}

function createGrid() {
  if (!ui.grid) return;
  ui.grid.innerHTML = '';
  for (let i = 0; i < 9; i += 1) {
    const cell = document.createElement('div');
    cell.className = 'grid-cell';
    ui.grid.appendChild(cell);
  }
}

function clearCansFromGrid() {
  if (!ui.grid) return;
  ui.grid.querySelectorAll('.grid-cell').forEach(cell => {
    cell.innerHTML = '';
  });
}

// ----------------------------
// 5) Audio
// ----------------------------
function getAudioContext() {
  if (!state.audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    state.audioContext = new AudioContextClass();
  }
  return state.audioContext;
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
      // Ignore resume errors to keep the game running.
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

// ----------------------------
// 6) Game flow
// ----------------------------
function showMilestoneMessageIfNeeded() {
  const config = getConfig();
  if (!state.gameActive || !ui.achievements || !Array.isArray(config.milestones)) return;

  for (const milestone of config.milestones) {
    if (state.score >= milestone.score && !state.announcedMilestones.has(milestone.score)) {
      ui.achievements.textContent = `${milestone.message} (${state.score}/${config.winThreshold})`;
      state.announcedMilestones.add(milestone.score);
    }
  }
}

function applyMissPenaltyIfNeeded() {
  const config = getConfig();
  if (!state.missedLastCan || config.missPenalty <= 0) return;

  state.score = Math.max(0, state.score - config.missPenalty);
  updateScoreDisplay();
  playMissSound();
}

function spawnWaterCan() {
  if (!state.gameActive || !ui.grid) return;

  applyMissPenaltyIfNeeded();
  clearCansFromGrid();

  const cells = ui.grid.querySelectorAll('.grid-cell');
  const randomCell = randomItem(Array.from(cells));
  if (!randomCell) return;

  const wrapper = document.createElement('div');
  wrapper.className = 'water-can-wrapper';

  const waterCan = document.createElement('div');
  waterCan.className = 'water-can';

  wrapper.appendChild(waterCan);
  randomCell.appendChild(wrapper);
  state.missedLastCan = true;

  waterCan.addEventListener('click', () => {
    if (!state.gameActive || waterCan.classList.contains('collected')) return;

    state.missedLastCan = false;
    state.score += 1;
    updateScoreDisplay();
    showMilestoneMessageIfNeeded();
    playSparkleSound();

    waterCan.classList.add('collected');
    wrapper.classList.add('collected-wrapper');

    window.setTimeout(() => {
      if (wrapper.isConnected) wrapper.remove();
    }, 250);
  });
}

function setDifficulty(mode) {
  if (!DIFFICULTY_SETTINGS[mode]) return;

  state.difficulty = mode;
  updateInstructionText();

  if (!state.gameActive) {
    state.timeLeft = getConfig().duration;
    updateTimerDisplay();
  }
}

function startGame() {
  if (state.gameActive) return;

  if (ui.difficulty) {
    setDifficulty(ui.difficulty.value);
  }

  const config = getConfig();
  state.gameActive = true;
  state.score = 0;
  state.timeLeft = config.duration;
  state.missedLastCan = false;
  state.announcedMilestones = new Set();

  lockDifficulty(true);
  clearIntervals();
  createGrid();
  updateScoreDisplay();
  updateTimerDisplay();
  if (ui.achievements) ui.achievements.textContent = '';

  playSoundEffect('gameStart');

  state.spawnIntervalId = setInterval(spawnWaterCan, config.spawnRate);
  state.timerIntervalId = setInterval(() => {
    state.timeLeft -= 1;
    updateTimerDisplay();
    if (state.timeLeft <= 0) endGame();
  }, 1000);
}

function endGame() {
  if (!state.gameActive) return;

  state.gameActive = false;
  clearIntervals();
  lockDifficulty(false);

  const config = getConfig();
  const hasWon = state.score >= config.winThreshold;
  const pool = hasWon ? WIN_MESSAGES : LOSE_MESSAGES;
  const resultPrefix = `(${config.label} mode) Score: ${state.score}/${config.winThreshold}. `;
  const resultText = resultPrefix + randomItem(pool);

  playSoundEffect(hasWon ? 'gameWin' : 'gameEnd');

  if (ui.achievements) {
    ui.achievements.textContent = resultText;
  } else {
    alert(resultText);
  }
}

function resetGame() {
  state.gameActive = false;
  state.score = 0;
  state.missedLastCan = false;
  state.announcedMilestones = new Set();
  state.timeLeft = getConfig().duration;

  clearIntervals();
  lockDifficulty(false);
  createGrid();
  updateScoreDisplay();
  updateTimerDisplay();
  updateInstructionText();

  if (ui.achievements) ui.achievements.textContent = '';
}

// ----------------------------
// 7) Event listeners + startup
// ----------------------------
if (ui.startButton) {
  ui.startButton.addEventListener('click', () => {
    playButtonClickSound();
    startGame();
  });
}

if (ui.resetButton) {
  ui.resetButton.addEventListener('click', () => {
    playButtonClickSound();
    resetGame();
  });
}

if (ui.difficulty) {
  ui.difficulty.addEventListener('change', event => {
    setDifficulty(event.target.value);
  });
}

createGrid();
setDifficulty(state.difficulty);
