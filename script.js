const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const leaderboardList = document.getElementById('leaderboard-list');

let gameRunning = false;
let player;
let foods = [];
let pellets = []; // Small pellets from dead snakes
let snakes = [];
let camera = { x: 0, y: 0, zoom: 1 };
let mouse = { x: 0, y: 0 };
let boosting = false;

const WORLD_SIZE = 10000;
const FOOD_COUNT = 500;
const PELLET_COUNT = 1000;
const BOT_COUNT = 20;

class Snake {
    constructor(x, y, color, name, isPlayer = false) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.segments = [{ x: x, y: y }];
        this.mass = 10;
        this.color = color;
        this.name = name;
        this.isPlayer = isPlayer;
        this.boosting = false;
        this.boostTimer = 0;
        this.dead = false;
    }

    get length() {
        return Math.floor(this.mass / 2);
    }

    update() {
        if (this.dead) return;

        // Movement
        const baseSpeed = 2 + 0.5 * Math.log(this.mass);
        let speed = baseSpeed;
        if (this.boosting && this.mass > 10) {
            speed *= 2.5;
            this.mass -= 0.1;
            this.boostTimer++;
            if (this.boostTimer > 60) { // Limit boost duration
                this.boosting = false;
                this.boostTimer = 0;
            }
        } else {
            this.boostTimer = 0;
        }

        this.x += this.vx * speed;
        this.y += this.vy * speed;

        // Wrap around world
        this.x = ((this.x % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;
        this.y = ((this.y % WORLD_SIZE) + WORLD_SIZE) % WORLD_SIZE;

        // Add new segment
        this.segments.unshift({ x: this.x, y: this.y });

        // Maintain length
        while (this.segments.length > this.length) {
            this.segments.pop();
        }

        // Update mass decay
        if (this.mass > 10) {
            this.mass -= 0.001;
        }
    }

    draw() {
        if (this.dead) return;

        ctx.strokeStyle = this.color;
        ctx.lineWidth = Math.max(5 * camera.zoom, 2);
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();

        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            const screenX = (seg.x - camera.x) * camera.zoom + canvas.width / 2;
            const screenY = (seg.y - camera.y) * camera.zoom + canvas.height / 2;
            if (i === 0) {
                ctx.moveTo(screenX, screenY);
            } else {
                ctx.lineTo(screenX, screenY);
            }
        }
        ctx.stroke();

        // Draw head
        const head = this.segments[0];
        const headScreenX = (head.x - camera.x) * camera.zoom + canvas.width / 2;
        const headScreenY = (head.y - camera.y) * camera.zoom + canvas.height / 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(headScreenX, headScreenY, 8 * camera.zoom, 0, Math.PI * 2);
        ctx.fill();

        // Draw name
        ctx.fillStyle = '#fff';
        ctx.font = `${12 * camera.zoom}px Arial`;
        ctx.textAlign = 'center';
        ctx.fillText(this.name, headScreenX, headScreenY - 15 * camera.zoom);

        // Draw mass
        ctx.fillText(Math.floor(this.mass), headScreenX, headScreenY + 25 * camera.zoom);
    }

    setDirection(angle) {
        this.angle = angle;
        this.vx = Math.cos(angle);
        this.vy = Math.sin(angle);
    }

    die() {
        this.dead = true;
        // Create pellets
        const pelletCount = Math.floor(this.mass / 2);
        for (let i = 0; i < pelletCount; i++) {
            const angle = (Math.PI * 2 * i) / pelletCount;
            const distance = 20 + Math.random() * 50;
            const x = this.x + Math.cos(angle) * distance;
            const y = this.y + Math.sin(angle) * distance;
            pellets.push(new Pellet(x, y));
        }
    }
}

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 4;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    }

    draw() {
        const screenX = (this.x - camera.x) * camera.zoom + canvas.width / 2;
        const screenY = (this.y - camera.y) * camera.zoom + canvas.height / 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Pellet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 2;
        this.color = '#fff';
    }

    draw() {
        const screenX = (this.x - camera.x) * camera.zoom + canvas.width / 2;
        const screenY = (this.y - camera.y) * camera.zoom + canvas.height / 2;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(screenX, screenY, this.size * camera.zoom, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Bot extends Snake {
    constructor(x, y, color, name) {
        super(x, y, color, name);
        this.target = null;
        this.boostCooldown = 0;
    }

    update() {
        if (this.dead) return;

        // Find target (nearest food or pellet)
        let targets = [...foods, ...pellets];
        let nearest = null;
        let minDist = Infinity;
        for (let target of targets) {
            const dist = Math.sqrt((target.x - this.x) ** 2 + (target.y - this.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearest = target;
            }
        }

        if (nearest) {
            const angle = Math.atan2(nearest.y - this.y, nearest.x - this.x);
            this.setDirection(angle);

            // Boost occasionally
            if (this.mass > 20 && this.boostCooldown <= 0 && Math.random() < 0.01) {
                this.boosting = true;
                this.boostCooldown = 120; // 2 seconds at 60fps
            }
        }

        if (this.boostCooldown > 0) this.boostCooldown--;

        super.update();
    }
}

function initGame() {
    player = new Snake(WORLD_SIZE / 2, WORLD_SIZE / 2, '#00ff00', usernameInput.value || 'Player', true);
    foods = [];
    pellets = [];
    snakes = [player];

    // Create foods
    for (let i = 0; i < FOOD_COUNT; i++) {
        foods.push(new Food(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
    }

    // Create pellets
    for (let i = 0; i < PELLET_COUNT; i++) {
        pellets.push(new Pellet(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
    }

    // Create bots
    for (let i = 0; i < BOT_COUNT; i++) {
        const x = Math.random() * WORLD_SIZE;
        const y = Math.random() * WORLD_SIZE;
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        const name = `Bot${i + 1}`;
        snakes.push(new Bot(x, y, color, name));
    }

    camera.x = player.x;
    camera.y = player.y;
    camera.zoom = 1;
}

function update() {
    if (!gameRunning) return;

    for (let snake of snakes) {
        snake.update();
    }

    // Check collisions
    checkCollisions();

    // Update camera
    updateCamera();

    // Update leaderboard
    updateLeaderboard();
}

function checkCollisions() {
    // Food and pellet collisions
    for (let snake of snakes) {
        if (snake.dead) continue;

        // Food
        for (let i = foods.length - 1; i >= 0; i--) {
            const food = foods[i];
            if (Math.sqrt((food.x - snake.x) ** 2 + (food.y - snake.y) ** 2) < 15) {
                snake.mass += 1;
                foods.splice(i, 1);
                foods.push(new Food(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
            }
        }

        // Pellets
        for (let i = pellets.length - 1; i >= 0; i--) {
            const pellet = pellets[i];
            if (Math.sqrt((pellet.x - snake.x) ** 2 + (pellet.y - snake.y) ** 2) < 10) {
                snake.mass += 0.5;
                pellets.splice(i, 1);
                pellets.push(new Pellet(Math.random() * WORLD_SIZE, Math.random() * WORLD_SIZE));
            }
        }
    }

    // Snake collisions
    for (let snake of snakes) {
        if (snake.dead) continue;

        for (let otherSnake of snakes) {
            if (snake === otherSnake || otherSnake.dead) continue;

            // Check if head hits body
            for (let i = 1; i < otherSnake.segments.length; i++) {
                const seg = otherSnake.segments[i];
                if (Math.sqrt((seg.x - snake.x) ** 2 + (seg.y - snake.y) ** 2) < 8) {
                    snake.die();
                    break;
                }
            }

            // Check if can eat other snake (encircling)
            if (snake.mass > otherSnake.mass * 1.25) {
                // Simple check: if head is close to tail and mass is larger
                const tail = otherSnake.segments[otherSnake.segments.length - 1];
                if (Math.sqrt((tail.x - snake.x) ** 2 + (tail.y - snake.y) ** 2) < 20) {
                    snake.mass += otherSnake.mass * 0.75;
                    otherSnake.die();
                }
            }
        }
    }

    // Remove dead snakes
    snakes = snakes.filter(snake => !snake.dead);
}

function updateCamera() {
    camera.x = player.x;
    camera.y = player.y;
    camera.zoom = Math.max(0.5, 1 / Math.log(player.mass + 1));
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    const gridSize = 50 / camera.zoom;
    const startX = Math.floor((camera.x - canvas.width / 2 / camera.zoom) / gridSize) * gridSize;
    const endX = Math.ceil((camera.x + canvas.width / 2 / camera.zoom) / gridSize) * gridSize;
    const startY = Math.floor((camera.y - canvas.height / 2 / camera.zoom) / gridSize) * gridSize;
    const endY = Math.ceil((camera.y + canvas.height / 2 / camera.zoom) / gridSize) * gridSize;

    for (let x = startX; x <= endX; x += gridSize) {
        const screenX = (x - camera.x) * camera.zoom + canvas.width / 2;
        ctx.beginPath();
        ctx.moveTo(screenX, 0);
        ctx.lineTo(screenX, canvas.height);
        ctx.stroke();
    }
    for (let y = startY; y <= endY; y += gridSize) {
        const screenY = (y - camera.y) * camera.zoom + canvas.height / 2;
        ctx.beginPath();
        ctx.moveTo(0, screenY);
        ctx.lineTo(canvas.width, screenY);
        ctx.stroke();
    }

    // Draw foods
    for (let food of foods) {
        food.draw();
    }

    // Draw pellets
    for (let pellet of pellets) {
        pellet.draw();
    }

    // Draw snakes
    for (let snake of snakes) {
        snake.draw();
    }
}

function updateLeaderboard() {
    const sortedSnakes = snakes.sort((a, b) => b.mass - a.mass);
    leaderboardList.innerHTML = '';
    for (let i = 0; i < Math.min(10, sortedSnakes.length); i++) {
        const li = document.createElement('li');
        li.textContent = `${sortedSnakes[i].name}: ${Math.floor(sortedSnakes[i].mass)}`;
        leaderboardList.appendChild(li);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

// Event listeners
canvas.addEventListener('mousemove', (e) => {
    if (!gameRunning) return;
    const rect = canvas.getBoundingClientRect();
    mouse.x = (e.clientX - rect.left - canvas.width / 2) / camera.zoom + camera.x;
    mouse.y = (e.clientY - rect.top - canvas.height / 2) / camera.zoom + camera.y;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    player.setDirection(angle);
});

canvas.addEventListener('mousedown', (e) => {
    if (e.button === 2) { // Right click
        boosting = true;
        player.boosting = true;
    }
});

canvas.addEventListener('mouseup', (e) => {
    if (e.button === 2) {
        boosting = false;
        player.boosting = false;
    }
});

canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Prevent context menu
});

startBtn.addEventListener('click', () => {
    if (usernameInput.value.trim() === '') {
        alert('Please enter a username');
        return;
    }
    initGame();
    gameRunning = true;
});

gameLoop();