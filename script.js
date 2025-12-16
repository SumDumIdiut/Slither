const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
const usernameInput = document.getElementById('username-input');
const startBtn = document.getElementById('start-btn');
const leaderboardList = document.getElementById('leaderboard-list');

let gameRunning = false;
let player;
let foods = [];
let bots = [];
let camera = { x: 0, y: 0 };
let mouse = { x: 0, y: 0 };

class Snake {
    constructor(x, y, color, name) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.segments = [{ x: x, y: y }];
        this.length = 10;
        this.color = color;
        this.name = name;
        this.score = 0;
    }

    update() {
        // Move head
        this.x += this.vx;
        this.y += this.vy;

        // Add new segment
        this.segments.unshift({ x: this.x, y: this.y });

        // Remove old segments
        while (this.segments.length > this.length) {
            this.segments.pop();
        }

        // Update score
        this.score = this.length - 10;
    }

    draw() {
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        for (let i = 0; i < this.segments.length; i++) {
            const seg = this.segments[i];
            if (i === 0) {
                ctx.moveTo(seg.x - camera.x, seg.y - camera.y);
            } else {
                ctx.lineTo(seg.x - camera.x, seg.y - camera.y);
            }
        }
        ctx.stroke();

        // Draw name
        ctx.fillStyle = this.color;
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(this.name, this.x - camera.x, this.y - camera.y - 20);
    }

    setDirection(angle) {
        const speed = 3;
        this.vx = Math.cos(angle) * speed;
        this.vy = Math.sin(angle) * speed;
        this.angle = angle;
    }
}

class Food {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.size = 3;
        this.color = `hsl(${Math.random() * 360}, 100%, 50%)`;
    }

    draw() {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x - camera.x, this.y - camera.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

class Bot extends Snake {
    constructor(x, y, color, name) {
        super(x, y, color, name);
        this.target = null;
    }

    update() {
        // Find nearest food
        let nearestFood = null;
        let minDist = Infinity;
        for (let food of foods) {
            const dist = Math.sqrt((food.x - this.x) ** 2 + (food.y - this.y) ** 2);
            if (dist < minDist) {
                minDist = dist;
                nearestFood = food;
            }
        }

        if (nearestFood) {
            const angle = Math.atan2(nearestFood.y - this.y, nearestFood.x - this.x);
            this.setDirection(angle);
        }

        super.update();
    }
}

function initGame() {
    player = new Snake(canvas.width / 2, canvas.height / 2, '#00ff00', usernameInput.value || 'Player');
    foods = [];
    bots = [];

    // Create foods
    for (let i = 0; i < 100; i++) {
        foods.push(new Food(Math.random() * 2000, Math.random() * 2000));
    }

    // Create bots
    for (let i = 0; i < 10; i++) {
        const x = Math.random() * 2000;
        const y = Math.random() * 2000;
        const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
        const name = `Bot${i + 1}`;
        bots.push(new Bot(x, y, color, name));
    }

    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;
}

function update() {
    if (!gameRunning) return;

    player.update();
    for (let bot of bots) {
        bot.update();
    }

    // Check collisions with food
    for (let i = foods.length - 1; i >= 0; i--) {
        const food = foods[i];
        if (Math.sqrt((food.x - player.x) ** 2 + (food.y - player.y) ** 2) < 10) {
            player.length += 1;
            foods.splice(i, 1);
            foods.push(new Food(Math.random() * 2000, Math.random() * 2000));
        }
        for (let bot of bots) {
            if (Math.sqrt((food.x - bot.x) ** 2 + (food.y - bot.y) ** 2) < 10) {
                bot.length += 1;
                foods.splice(i, 1);
                foods.push(new Food(Math.random() * 2000, Math.random() * 2000));
                break;
            }
        }
    }

    // Check collisions with other snakes
    for (let bot of bots) {
        if (Math.sqrt((bot.x - player.x) ** 2 + (bot.y - player.y) ** 2) < 10 && bot.length > player.length) {
            // Player dies
            gameRunning = false;
            alert('Game Over!');
            return;
        }
        for (let otherBot of bots) {
            if (bot !== otherBot && Math.sqrt((bot.x - otherBot.x) ** 2 + (otherBot.y - otherBot.y) ** 2) < 10 && bot.length > otherBot.length) {
                otherBot.length = 10; // Reset
            }
        }
    }

    // Update camera
    camera.x = player.x - canvas.width / 2;
    camera.y = player.y - canvas.height / 2;

    updateLeaderboard();
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 1;
    for (let x = -camera.x % 50; x < canvas.width; x += 50) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = -camera.y % 50; y < canvas.height; y += 50) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw foods
    for (let food of foods) {
        food.draw();
    }

    // Draw bots
    for (let bot of bots) {
        bot.draw();
    }

    // Draw player
    player.draw();
}

function updateLeaderboard() {
    const allSnakes = [player, ...bots].sort((a, b) => b.score - a.score);
    leaderboardList.innerHTML = '';
    for (let i = 0; i < Math.min(10, allSnakes.length); i++) {
        const li = document.createElement('li');
        li.textContent = `${allSnakes[i].name}: ${allSnakes[i].score}`;
        leaderboardList.appendChild(li);
    }
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left + camera.x;
    mouse.y = e.clientY - rect.top + camera.y;
    const angle = Math.atan2(mouse.y - player.y, mouse.x - player.x);
    player.setDirection(angle);
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