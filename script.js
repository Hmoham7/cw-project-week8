// Game configuration and state variables
const GOAL_CANS = 25;        // Total items needed to collect
const WIN_THRESHOLD = 20;    // Minimum score needed to win
let currentCans = 0;         // Current number of items collected
let gameActive = false;      // Tracks if game is currently running
let spawnInterval;          // Holds the interval for spawning items
let timer = 30;             // Timer in seconds
let timerInterval;          // Holds the interval for timer countdown
let canWasMissed = false;    // Tracks whether the current can was not clicked

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

// Spawns a new item in a random grid cell
function spawnWaterCan() {
  if (!gameActive) return; // Stop if the game is not active
  const cells = document.querySelectorAll('.grid-cell');

  // If the previous can was not clicked before respawn, apply a miss penalty.
  if (canWasMissed) {
    currentCans = Math.max(0, currentCans - 1);
    const scoreDisplay = document.getElementById('current-cans');
    if (scoreDisplay) scoreDisplay.textContent = currentCans;
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
    waterCan.addEventListener('click', function handleCanClick(e) {
      // Prevent multiple clicks on the same can
      if (!gameActive) return;
      canWasMissed = false;
      currentCans += 1; // Increment score
      // Optionally update score display if present
      const scoreDisplay = document.getElementById('current-cans');
      if (scoreDisplay) {
        scoreDisplay.textContent = currentCans;
      }
      // Remove the can after click
      waterCan.parentElement.remove();
    });
  }
}

// Initializes and starts a new game
function startGame() {
  if (gameActive) return; // Prevent starting a new game if one is already active
  gameActive = true;
  currentCans = 0;
  canWasMissed = false;
  timer = 30; // Reset timer
  createGrid(); // Set up the game grid
  const scoreDisplay = document.getElementById('current-cans');
  if (scoreDisplay) scoreDisplay.textContent = currentCans;
  const achievements = document.getElementById('achievements');
  if (achievements) achievements.textContent = '';
  spawnInterval = setInterval(spawnWaterCan, 1000); // Spawn water cans every second
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
  clearInterval(spawnInterval); // Stop spawning water cans
  clearInterval(timerInterval); // Stop timer countdown

  const messagePool = currentCans >= WIN_THRESHOLD ? winningMessages : losingMessages;
  const randomMessage = messagePool[Math.floor(Math.random() * messagePool.length)];
  const achievements = document.getElementById('achievements');
  if (achievements) {
    achievements.textContent = randomMessage;
  } else {
    alert(randomMessage);
  }
}

function resetGame() {
  gameActive = false;
  canWasMissed = false;
  clearInterval(spawnInterval);
  clearInterval(timerInterval);

  currentCans = 0;
  timer = 30;
  createGrid();

  const scoreDisplay = document.getElementById('current-cans');
  if (scoreDisplay) scoreDisplay.textContent = currentCans;

  const timerDisplay = document.getElementById('timer');
  if (timerDisplay) timerDisplay.textContent = timer;

  const achievements = document.getElementById('achievements');
  if (achievements) achievements.textContent = '';
}

// Set up click handler for the start button
document.getElementById('start-game').addEventListener('click', startGame);
document.getElementById('reset-game').addEventListener('click', resetGame);
