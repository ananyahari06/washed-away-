// 🧦 Lost Sock Adventure 

// -------- Instruction Scene  ----------
class InstructionScene extends Phaser.Scene {
  constructor() {
    super("InstructionScene");
  }

  create() {
    const width = this.scale.width;
    const height = this.scale.height;

    // Background
    this.add.rectangle(width / 2, height / 2, width, height, 0x59D6FF, 0.85);


    // Title
    this.add.text(width / 2, height * 0.18, "WASHED AWAY!", {
      fontFamily: "Comic Sans MS",
      fontSize: Math.round(height * 0.11) + "px",
      color: "#FFFFFF",
      stroke: "#003366",
      fontStyle: "bold",
      strokeThickness: 7,
    shadow: {
        offsetX: 0,
        offsetY: 0,
        blur: 4,
        color: "#000000"
    }
}).setOrigin(0.5);

    // Instructions 
    const instructions =
`🧦 You are a lost sock in the washing machine!
🎯 Find your matching pair before time runs out.
💨 You can move only when the spin direction is CLOCKWISE.
💥 Avoid bubbles — each hit costs time, and the penalty grows every time.
🎮 Use arrow keys to move when allowed.
        
Press SPACE to Start`;

    this.add.text(width / 2, height * 0.46, instructions, {
      fontFamily: "Orbitron",
      fontSize: Math.round(height * 0.035) + "px",
      color: "#003049",
      highlight:"0xFFEF5A",
      align: "center",
      wordWrap: { width: width * 0.8 }
    }).setOrigin(0.5);

    

    // Input: start main scene
    this.input.keyboard.once("keydown-SPACE", () => {
      this.scene.start("MainScene");
    });
  }
}


// --- Game config  ---
const config = {
  type: Phaser.AUTO,
  backgroundColor: '#3a8fd8',
  physics: { default: 'arcade', arcade: { debug: false } },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: window.innerWidth,
    height: window.innerHeight
  },
  
  scene: [InstructionScene, { key: 'MainScene', preload, create, update }]
};

new Phaser.Game(config);


/* ----- Globals ----- */
let player, target, cursors;
let bubbles, bubbleGroup;
let directionText, timerText, timerBar, timerBarGlow;
let drumDirection, lastFlip;
let timeLeft, totalTime, penalty;
let gameEnded = false;


/* ----- Preload ----- */
function preload() {
  this.load.image("sock", "assets/sock.png");

  // --- WebFontLoader Setup ---
  this.load.script('webfont', 'https://ajax.googleapis.com/ajax/libs/webfont/1.6.26/webfont.js');
  this.load.on('complete', () => {
    if (typeof WebFont !== 'undefined') {
      WebFont.load({
        google: {
          families: ['Luckiest Guy', 'Orbitron']
        },
        active: () => {
         
        }
      });
    }
  });


  // ---  Water  ---
  const g = this.make.graphics({ x: 0, y: 0, add: false });
  // Deep-water blue base
  g.fillStyle(0x4da3e6, 1);
  g.fillRect(0, 0, 256, 256);
  // Gentle vertical waves
  for (let i = 0; i < 12; i++) {
    g.fillStyle(0x76bef2, 0.22);
    const x = Math.random() * 256;
    const width = Phaser.Math.Between(10, 28);
    g.fillRect(x, 0, width, 256);
  }
  // Soft ripples
  for (let i = 0; i < 6; i++) {
    g.fillStyle(0x5ab0ec, 0.12);
    const x = Math.random() * 256;
    const width = Phaser.Math.Between(40, 80);
    g.fillRect(x, 0, width, 256);
  }
  g.generateTexture("waterTex", 256, 256);

  // Timer bar texture (more visible)
  const t = this.make.graphics({ x: 0, y: 0, add: false });
  // Outer border (white)
  t.fillStyle(0xffffff, 1);
  t.fillRect(0, 0, 260, 40);
  // Inner blue bar background
  t.fillStyle(0x4fa0d8, 1);
  t.fillRect(4, 4, 252, 32);
  // Export
  t.generateTexture("barTex", 260, 40);
}


/* ----- Create ----- */

function create() {
  resetGame();

  const width = this.scale.width;
  const height = this.scale.height;

  const MIN_START_DISTANCE = width * 0.4; 

  /* Background */
  this.waterBG = this.add.tileSprite(
    width / 2, height / 2, width, height, "waterTex"
  ).setAlpha(0.8);

  /* UI */
  directionText = this.add.text(22, 18, "Direction: CLOCKWISE", {
    fontSize: Math.round(height * 0.038) + "px",
    color: "#f9f630ff",
    fontFamily: "Orbitron",
    fontStyle: "bold",
    stroke: "#0f035fff",
    strokeThickness: 4,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: "#0f035fff",
      blur: 4,
      stroke: true,
      fill: true
    }
  });

  timerText = this.add.text(width - 220, 20, "Time: " + Math.ceil(timeLeft), {
    fontSize: Math.round(height * 0.038) + "px",
    color: "#bff574ff",
    fontFamily: "Orbitron",
    fontStyle: "bold",
    stroke: "#000000",
    strokeThickness: 4,
    shadow: {
      offsetX: 2,
      offsetY: 2,
      color: "#000000",
      blur: 4,
      stroke: true,
      fill: true
    }
  });

  // Timer bar
  const barWidth = width * 0.5;
  const barY = 70;
  const barHeight = 18;

  timerBarGlow = this.add.image(width / 2, barY, "barTex")
    .setDisplaySize(barWidth + 40, barHeight * 4)
    .setTint(0x00fff2)      // bright aqua glow
    .setAlpha(0.18)
    .setOrigin(0.5);


  timerBar = this.add.rectangle(
    (width - barWidth) / 2, barY, barWidth, barHeight, 0x00ff99
  ).setOrigin(0, 0.5);

  /* Player */
  player = this.physics.add.sprite(width / 2, height / 2, "sock")
    .setScale(0.35)
    .setCollideWorldBounds(true);

  /* Target */
  // Ensure minimum separation from center
  let targetX, targetY, distance;
  const centerX = width / 2;
  const centerY = height / 2;

  do {
    targetX = Phaser.Math.Between(100, width - 100);
    targetY = Phaser.Math.Between(100, height - 100);
    distance = Phaser.Math.Distance.Between(centerX, centerY, targetX, targetY);
  } while (distance < MIN_START_DISTANCE);

  target = this.physics.add.sprite(
    targetX,
    targetY,
    "sock"
  )
    .setScale(0.35)
    .setFlipX(true)
    .setImmovable(true);

  // built-in overlap
  this.physics.add.overlap(player, target, () => {
    const distance = Phaser.Math.Distance.Between(player.x, player.y, target.x, target.y);
    const minDistance = (player.displayWidth + target.displayWidth) * 0.15;
    if (distance < minDistance && !gameEnded) endGame.call(this, true);
  });

  /* Bubbles */
  bubbleGroup = this.add.group();
  bubbles = this.physics.add.group();

  for (let i = 0; i < 50; i++) {
    const b = this.add.circle(
      Phaser.Math.Between(40, width - 40),
      Phaser.Math.Between(40, height - 40),
      Phaser.Math.Between(8, 16),
      0x99ddff
    ).setAlpha(0.95);

    this.physics.add.existing(b);
    b.body.setAllowGravity(false);

    b.vx = Phaser.Math.FloatBetween(-50, 50);
    b.vy = Phaser.Math.FloatBetween(-50, 50);

    bubbles.add(b);
    bubbleGroup.add(b);
  }

  this.physics.add.collider(player, bubbles, handleBubbleHit, null, this);

  cursors = this.input.keyboard.createCursorKeys();
}


/* ----- Update ----- */
function update(time, delta) {
  if (gameEnded) return;

  // Background movement
  this.waterBG.tilePositionX += 0.2;
  this.waterBG.tilePositionY += 0.15;

  /* Bubbles float */
  bubbleGroup.children.iterate(b => {
    if (!b.body) return;
    b.body.setVelocity(b.vx, b.vy);

    if (b.x < 10 || b.x > this.scale.width - 10) b.vx *= -1;
    if (b.y < 10 || b.y > this.scale.height - 10) b.vy *= -1;
  });

  /* Timer */
  timeLeft -= delta / 1000;
  timeLeft = Math.max(0, timeLeft);
  timerText.setText("Time: " + Math.ceil(timeLeft));

  const fullWidth = this.scale.width * 0.5;
  const ratio = timeLeft / totalTime;
  timerBar.width = fullWidth * ratio;
  timerBar.fillColor = ratio > 0.6 ? 0x00ffd0 : ratio > 0.3 ? 0xffd166 : 0xff6b6b;

  if (timeLeft <= 0) return endGame.call(this, false);

  /* Direction flip every 5 seconds */
  if (this.time.now - lastFlip > 5000) {
    lastFlip = this.time.now;
    drumDirection = drumDirection === "clockwise" ? "anticlockwise" : "clockwise";
    directionText.setText("Direction: " + drumDirection.toUpperCase());
    showDirectionFlash.call(this, drumDirection);
  }

  /* Player movement (only when clockwise) */
  const speed = 250;
  player.body.setVelocity(0);

  if (drumDirection === "clockwise") {
    if (cursors.left.isDown) player.body.setVelocityX(-speed);
    if (cursors.right.isDown) player.body.setVelocityX(speed);
    if (cursors.up.isDown) player.body.setVelocityY(-speed);
    if (cursors.down.isDown) player.body.setVelocityY(speed);
  }
}


/* ----- Helpers ----- */
function handleBubbleHit(playerObj, bubbleObj) {
  if (gameEnded || !bubbleObj.body) return; // 
  // Push player
  const dx = playerObj.x - bubbleObj.x;
  const dy = playerObj.y - bubbleObj.y;

  playerObj.body.velocity.x += Math.sign(dx) * 180;
  playerObj.body.velocity.y += Math.sign(dy) * 180;

  // Time penalty
  timeLeft = Math.max(0, timeLeft - penalty);
  penalty = Math.min(penalty + 0.5, 6);

  // Destroy bubble once hit
  bubbleObj.destroy();

  if (timeLeft <= 0 && !gameEnded) endGame.call(this, false);

}


function resetGame() {
  drumDirection = "clockwise";
  lastFlip = 0;
  totalTime = 30;
  timeLeft = totalTime;
  penalty = 2;
  gameEnded = false;
}


// END GAME 
function endGame(win) {
  gameEnded = true;
  if (player && player.body) player.body.enable = false;
  if (target && target.body) target.body.enable = false;

  const width = this.scale.width;
  const height = this.scale.height;

  //  Main End Message
  const mainText = win ? "YOU FOUND YOUR PAIR! 🎉" : "TIME'S UP! 😢";
  const mainColor = win ? "#7300ffff" : "#ff3333";
  const mainStroke = win ? "#d4ff00ff" : "#8c0000";


  this.add.text(width / 2, height / 2 - 40, mainText, {
    fontSize: Math.round(height * 0.12) + "px",
    fontFamily: "Luckiest Guy",
    color: mainColor,
    align: "center",
    stroke: mainStroke,
    strokeThickness: 16,
    shadow: {
      offsetX: 6,
      offsetY: 6,
      color: '#000000',
      blur: 0,
      fill: true
    }
  }).setOrigin(0.5).setDepth(10); 


  // 2. Restart Message
  this.add.text(width / 2, height / 2 + 60,
    "PRESS SPACE TO RESTART", {
      fontSize: Math.round(height * 0.05) + "px",
      color: "#ffffff",
      fontFamily: "Luckiest Guy",
      align: "center",
      stroke: "#3a8fd8",
      strokeThickness: 8,
      shadow: {
        offsetX: 4,
        offsetY: 4,
        color: '#000000',
        blur: 0,
        fill: true
      }
    }
  ).setOrigin(0.5).setDepth(10);


  this.input.keyboard.once("keydown-SPACE", () => {
    this.scene.restart();
  });
}


function showDirectionFlash(direction) {
  let text, color;
  if (direction === 'clockwise') {
    text = "▶ CLOCKWISE ▶\nLet's roll!";
    color = '#0dedb9ff';
  } else {
    text = "◀ ANTICLOCKWISE ◀\nFreeze it!";
    color = '#ffd166';
  }


  const flash = this.add.text(this.scale.width / 2, this.scale.height / 2, text, {
    fontSize: Math.round(this.scale.height * 0.075) + 'px',
    color,
    fontFamily: 'Orbitron',
    align: 'center',
    fontStyle: 'bold'
  }).setOrigin(0.5).setDepth(20);


  this.tweens.add({
    targets: flash,
    alpha: 0,
    scale: 1.06,
    duration: 3000,
    ease: 'Cubic.easeOut',
    onComplete: () => flash.destroy()
  });
}