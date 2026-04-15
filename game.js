(function () {
  const canvas = document.getElementById("gameCanvas");
  const ctx = canvas.getContext("2d");
  const scoreValue = document.getElementById("scoreValue");
  const bestValue = document.getElementById("bestValue");
  const statusBanner = document.getElementById("statusBanner");
  const gamePanel = document.querySelector(".game-panel");

  const BASE_WIDTH = 420;
  const BASE_HEIGHT = 760;
  const WIDTH = canvas.width;
  const HEIGHT = canvas.height;
  const FIELD_SCALE_X = WIDTH / BASE_WIDTH;
  const VERTICAL_SCALE = HEIGHT / BASE_HEIGHT;
  const ENTITY_SCALE = VERTICAL_SCALE;
  const START_Y = 590 * VERTICAL_SCALE;
  const CAMERA_TRACK_Y = HEIGHT * 0.34;
  const GRAVITY = 0.42 * VERTICAL_SCALE;
  const MOVE_ACCELERATION = 0.52 * FIELD_SCALE_X;
  const MAX_HORIZONTAL_SPEED = 6.4 * FIELD_SCALE_X;
  const FRICTION = 0.88;
  const PLATFORM_MARGIN_X = 56 * FIELD_SCALE_X;

  const keys = { left: false, right: false };

  const state = {
    started: false,
    gameOver: false,
    score: 0,
    best: loadBest(),
    cameraY: 0,
    highestTrampolineY: 0,
    lastTrampolineX: WIDTH / 2,
    time: 0,
    player: null,
    trampolines: [],
    particles: [],
    clouds: buildClouds(),
  };

  function buildClouds() {
    return [
      { x: WIDTH * 0.16, y: 112, scale: 0.9, drift: 0.18 },
      { x: WIDTH * 0.36, y: 160, scale: 1.1, drift: 0.11 },
      { x: WIDTH * 0.68, y: 88, scale: 0.7, drift: 0.24 },
      { x: WIDTH * 0.8, y: 246, scale: 0.85, drift: 0.14 },
      { x: WIDTH * 0.28, y: 284, scale: 0.62, drift: 0.21 },
    ];
  }

  function createPlayer() {
    return {
      x: WIDTH / 2,
      y: START_Y,
      previousY: START_Y,
      vx: 0,
      vy: 0,
      width: 92 * ENTITY_SCALE,
      height: 104 * ENTITY_SCALE,
      facing: 1,
      tilt: 0,
      bounceStretch: 0,
      bestY: START_Y,
      idleTime: 0,
    };
  }

  function createTrampoline(x, y, type) {
    const isBoost = type === "boost";

    return {
      x,
      y,
      width: (isBoost ? 96 : 82) * ENTITY_SCALE,
      height: 18 * ENTITY_SCALE,
      type,
      bounce: (isBoost ? 14.8 : 12.6) * ENTITY_SCALE,
      impact: 0,
      pulse: Math.random() * Math.PI * 2,
    };
  }

  function seedTrampolines() {
    state.trampolines = [];

    const base = createTrampoline(WIDTH / 2, 670 * VERTICAL_SCALE, "standard");
    state.trampolines.push(base);

    let previousX = base.x;
    let previousY = base.y;

    while (previousY > -1000 * VERTICAL_SCALE) {
      const next = buildNextTrampoline(previousX, previousY);
      state.trampolines.push(next);
      previousX = next.x;
      previousY = next.y;
    }

    state.lastTrampolineX = previousX;
    state.highestTrampolineY = previousY;
  }

  function buildNextTrampoline(previousX, previousY) {
    const gap = random(78, 110) * VERTICAL_SCALE;
    const swing = random(-132, 132) * FIELD_SCALE_X;
    const x = clamp(previousX + swing, PLATFORM_MARGIN_X, WIDTH - PLATFORM_MARGIN_X);
    const type = Math.random() < 0.16 ? "boost" : "standard";

    return createTrampoline(x, previousY - gap, type);
  }

  function resetGame() {
    state.started = false;
    state.gameOver = false;
    state.score = 0;
    state.cameraY = 0;
    state.time = 0;
    state.player = createPlayer();
    state.particles = [];
    state.clouds = buildClouds();
    seedTrampolines();
    updateHud();
    requestAnimationFrame(() => syncGameViewport(0));
  }

  function startRun(direction) {
    if (!state.started) {
      state.started = true;
      state.player.vx += direction * 1.4 * FIELD_SCALE_X;
      state.player.facing = direction;
    }
  }

  function restartRun(direction) {
    resetGame();
    state.started = true;
    state.player.vx = direction * 2.2 * FIELD_SCALE_X;
    state.player.facing = direction;
  }

  function loadBest() {
    try {
      return Number(window.localStorage.getItem("noa-jump-best")) || 0;
    } catch (error) {
      return 0;
    }
  }

  function persistBest(value) {
    try {
      window.localStorage.setItem("noa-jump-best", String(value));
    } catch (error) {
      return;
    }
  }

  function updateHud() {
    scoreValue.textContent = `${state.score} m`;
    bestValue.textContent = `${state.best} m`;

    if (state.gameOver) {
      statusBanner.textContent = "Press left or right to jump back in";
    } else if (!state.started) {
      statusBanner.textContent = "Press left or right to start";
    } else {
      statusBanner.textContent = "Only left and right arrows control the run";
    }
  }

  function syncGameViewport(progressOverride = null, smooth = false) {
    if (!gamePanel) {
      return;
    }

    const rect = gamePanel.getBoundingClientRect();
    const panelTop = window.scrollY + rect.top;
    const panelBottom = panelTop + rect.height;
    const topScroll = Math.max(0, panelTop - 12);
    const bottomScroll = Math.max(topScroll, panelBottom - window.innerHeight - 12);
    const progress =
      progressOverride === null
        ? clamp(-state.cameraY / (HEIGHT * 0.9), 0, 1)
        : clamp(progressOverride, 0, 1);
    const targetY = lerp(bottomScroll, topScroll, progress);

    if (Math.abs(window.scrollY - targetY) < 2) {
      return;
    }

    window.scrollTo({
      top: targetY,
      behavior: smooth ? "smooth" : "auto",
    });
  }

  function spawnBounceBurst(x, y, tint) {
    for (let index = 0; index < 12; index += 1) {
      const angle = (Math.PI / 12) * index + random(-0.15, 0.15);
      const speed = random(1.2, 3.6);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 1.2,
        life: random(18, 30),
        maxLife: 30,
        radius: random(2, 4.4),
        color: tint,
      });
    }
  }

  function updateParticles(dt) {
    const survivors = [];

    for (const particle of state.particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 0.09 * dt;

      if (particle.life > 0) {
        survivors.push(particle);
      }
    }

    state.particles = survivors;
  }

  function maybeBounceOnTrampoline(player) {
    if (player.vy <= 0) {
      return;
    }

    const feetY = player.y + player.height * 0.38;
    const previousFeetY = player.previousY + player.height * 0.38;
    const collisionRadius = 30 * ENTITY_SCALE;

    for (const trampoline of state.trampolines) {
      const topY = trampoline.y - trampoline.height * 0.5;
      const horizontalReach = trampoline.width * 0.5 + collisionRadius;

      if (
        previousFeetY <= topY &&
        feetY >= topY &&
        Math.abs(player.x - trampoline.x) <= horizontalReach
      ) {
        player.y = topY - player.height * 0.38;
        player.vy = -trampoline.bounce;
        player.bounceStretch = 1;
        trampoline.impact = 1;

        const tint =
          trampoline.type === "boost"
            ? "255, 140, 104"
            : "255, 187, 91";
        spawnBounceBurst(trampoline.x, topY, tint);
        return;
      }
    }
  }

  function ensureTrampolines() {
    while (state.highestTrampolineY > state.cameraY - HEIGHT * 1.4) {
      const next = buildNextTrampoline(state.lastTrampolineX, state.highestTrampolineY);
      state.trampolines.push(next);
      state.highestTrampolineY = next.y;
      state.lastTrampolineX = next.x;
    }

    state.trampolines = state.trampolines.filter(
      (trampoline) => trampoline.y < state.cameraY + HEIGHT + 220 * VERTICAL_SCALE
    );
  }

  function update(dt) {
    const player = state.player;
    state.time += dt;

    for (const trampoline of state.trampolines) {
      trampoline.impact = Math.max(0, trampoline.impact - 0.09 * dt);
    }

    updateParticles(dt);

    if (!state.started) {
      player.idleTime += dt;
      player.previousY = player.y;
      player.vy = Math.sin(player.idleTime * 0.06) * 0.2 * ENTITY_SCALE;
      player.bounceStretch = Math.max(0, player.bounceStretch - 0.06 * dt);
      updateHud();
      return;
    }

    if (state.gameOver) {
      player.bounceStretch = Math.max(0, player.bounceStretch - 0.06 * dt);
      updateHud();
      return;
    }

    if (keys.left && !keys.right) {
      player.vx -= MOVE_ACCELERATION * dt;
      player.facing = -1;
    } else if (keys.right && !keys.left) {
      player.vx += MOVE_ACCELERATION * dt;
      player.facing = 1;
    } else {
      player.vx *= Math.pow(FRICTION, dt);
    }

    player.vx = clamp(player.vx, -MAX_HORIZONTAL_SPEED, MAX_HORIZONTAL_SPEED);
    player.previousY = player.y;
    player.vy += GRAVITY * dt;
    player.x += player.vx * dt;
    player.y += player.vy * dt;
    player.tilt = lerp(player.tilt, player.vx / MAX_HORIZONTAL_SPEED, 0.18 * dt);
    player.bounceStretch = Math.max(0, player.bounceStretch - 0.08 * dt);

    if (player.x < -player.width * 0.5) {
      player.x = WIDTH + player.width * 0.5;
    } else if (player.x > WIDTH + player.width * 0.5) {
      player.x = -player.width * 0.5;
    }

    maybeBounceOnTrampoline(player);

    if (player.y < player.bestY) {
      player.bestY = player.y;
    }

    const targetCameraY = Math.min(state.cameraY, player.y - CAMERA_TRACK_Y);
    state.cameraY = targetCameraY;
    ensureTrampolines();
    syncGameViewport();

    state.score = Math.max(0, Math.round((START_Y - player.bestY) * 0.86));

    if (state.score > state.best) {
      state.best = state.score;
      persistBest(state.best);
    }

    const playerFeetY = player.y - state.cameraY + player.height * 0.38;

    if (playerFeetY > HEIGHT) {
      state.gameOver = true;
      player.vx = 0;
      player.vy = 0;
    }

    updateHud();
  }

  function drawCloud(x, y, scale) {
    const puffAlpha = 0.7;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);

    ctx.fillStyle = `rgba(255, 255, 255, ${puffAlpha})`;
    ctx.beginPath();
    ctx.ellipse(-18, 8, 28, 18, 0, 0, Math.PI * 2);
    ctx.ellipse(10, 0, 32, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(42, 8, 24, 16, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawBackdrop() {
    const skyGradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
    skyGradient.addColorStop(0, "#8fd8ff");
    skyGradient.addColorStop(0.58, "#d7f5ff");
    skyGradient.addColorStop(1, "#fff0cb");
    ctx.fillStyle = skyGradient;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    const sunGlow = ctx.createRadialGradient(60, 46, 0, 60, 46, 180);
    sunGlow.addColorStop(0, "rgba(255, 239, 173, 0.82)");
    sunGlow.addColorStop(1, "rgba(255, 239, 173, 0)");
    ctx.fillStyle = sunGlow;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);

    for (const cloud of state.clouds) {
      const driftX = Math.sin(state.time * 0.01 * cloud.drift + cloud.x) * 8;
      const driftY = Math.cos(state.time * 0.007 * cloud.drift + cloud.y) * 4;
      drawCloud(cloud.x + driftX, cloud.y + driftY, cloud.scale);
    }

    ctx.save();
    ctx.translate(0, HEIGHT);

    const duneShift = Math.sin(state.time * 0.012) * 8;

    ctx.fillStyle = "#f6c76d";
    ctx.beginPath();
    ctx.moveTo(-40, 40);
    ctx.bezierCurveTo(70, -24 + duneShift, 122, -14, 220, 32);
    ctx.bezierCurveTo(306, 72, 372, 18, 460, 40);
    ctx.lineTo(460, 120);
    ctx.lineTo(-40, 120);
    ctx.closePath();
    ctx.fill();

    ctx.fillStyle = "rgba(230, 158, 70, 0.38)";
    ctx.beginPath();
    ctx.moveTo(-40, 54);
    ctx.bezierCurveTo(92, 6, 168, 34, 232, 58);
    ctx.bezierCurveTo(310, 88, 360, 68, 460, 52);
    ctx.lineTo(460, 120);
    ctx.lineTo(-40, 120);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }

  function drawTrampoline(trampoline) {
    const screenY = trampoline.y - state.cameraY;
    const rebound = trampoline.impact;
    const width = trampoline.width;
    const matHeight = trampoline.height - rebound * 4;
    const legOffset = 10 + rebound * 4;

    ctx.save();
    ctx.translate(trampoline.x, screenY);

    ctx.fillStyle = "rgba(52, 93, 126, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 18, width * 0.48, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = trampoline.type === "boost" ? "#f36e4e" : "#e4934f";
    ctx.lineWidth = 4 * ENTITY_SCALE;
    ctx.lineCap = "round";

    ctx.beginPath();
    ctx.moveTo(-width * 0.28, 7);
    ctx.lineTo(-width * 0.38, legOffset + 15);
    ctx.moveTo(width * 0.28, 7);
    ctx.lineTo(width * 0.38, legOffset + 15);
    ctx.stroke();

    ctx.strokeStyle = "rgba(236, 151, 79, 0.65)";
    ctx.lineWidth = 2 * ENTITY_SCALE;

    for (let index = -2; index <= 2; index += 1) {
      const springX = index * (width * 0.12);
      ctx.beginPath();
      ctx.moveTo(springX, 4);
      ctx.lineTo(springX, 12 + rebound * 5);
      ctx.stroke();
    }

    const matGradient = ctx.createLinearGradient(0, -10, 0, 18);
    if (trampoline.type === "boost") {
      matGradient.addColorStop(0, "#ffb27d");
      matGradient.addColorStop(1, "#ff765f");
    } else {
      matGradient.addColorStop(0, "#ffd679");
      matGradient.addColorStop(1, "#f39a4d");
    }

    ctx.fillStyle = matGradient;
    ctx.beginPath();
    ctx.roundRect(-width * 0.5, -matHeight * 0.5, width, matHeight, 12);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.6)";
    ctx.lineWidth = 2 * ENTITY_SCALE;
    ctx.stroke();

    ctx.restore();
  }

  function drawBounceParticles() {
    for (const particle of state.particles) {
      const alpha = particle.life / particle.maxLife;
      ctx.fillStyle = `rgba(${particle.color}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(particle.x, particle.y - state.cameraY, particle.radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawStickFigure(config) {
    const {
      x,
      y,
      scale,
      bodyTilt,
      stride,
      cap,
      hair,
      smileOffset,
      armLift,
    } = config;

    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.rotate(bodyTilt);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    ctx.fillStyle = "#ffddb9";
    ctx.beginPath();
    ctx.arc(0, -20, 13, 0, Math.PI * 2);
    ctx.fill();

    if (cap) {
      ctx.fillStyle = "#2d63d1";
      ctx.beginPath();
      ctx.ellipse(-1, -26, 13, 8, -0.18, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(8, -27, 10, 4.5, 0.2, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.strokeStyle = "#f0c425";
      ctx.lineWidth = 4 * ENTITY_SCALE;
      ctx.beginPath();
      ctx.moveTo(-8, -27);
      ctx.lineTo(-2, -31);
      ctx.lineTo(4, -29);
      ctx.lineTo(10, -32);
      ctx.stroke();
    }

    ctx.fillStyle = "#1f1f1f";
    ctx.beginPath();
    ctx.arc(-4, -21, 1.6, 0, Math.PI * 2);
    ctx.arc(5, -21, 1.6, 0, Math.PI * 2);
    ctx.fill();

    ctx.strokeStyle = "#1f1f1f";
    ctx.lineWidth = 2 * ENTITY_SCALE;
    ctx.beginPath();
    ctx.arc(0, -18 + smileOffset, 5, 0.2, Math.PI - 0.2);
    ctx.stroke();

    ctx.strokeStyle = "#1d1d1d";
    ctx.lineWidth = 5 * ENTITY_SCALE;
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(0, 24);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 3);
    ctx.quadraticCurveTo(-12, 2 - armLift, -18, -12);
    ctx.moveTo(0, 7);
    ctx.quadraticCurveTo(12, 3 + armLift, 18, 10);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, 24);
    ctx.quadraticCurveTo(-10, 36, -22, 50 - stride);
    ctx.moveTo(0, 24);
    ctx.quadraticCurveTo(12, 36, 20, 46 + stride);
    ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(-23, 50 - stride, 8, 4, -0.2, 0, Math.PI * 2);
    ctx.ellipse(21, 46 + stride, 8, 4, 0.2, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
  }

  function drawPlayer() {
    const player = state.player;
    const idleBob = !state.started && !state.gameOver
      ? Math.sin(player.idleTime * 0.08) * 6 * ENTITY_SCALE
      : 0;
    const screenY = player.y - state.cameraY + idleBob;
    const ascent = clamp(-player.vy / 12, -1, 1);
    const descent = clamp(player.vy / 12, 0, 1);
    const stretchY = 1 + player.bounceStretch * 0.12 - descent * 0.04;
    const stretchX = 1 - player.bounceStretch * 0.1 + descent * 0.06;
    const bodyTilt = player.tilt * 0.22;
    const stride = 4 + Math.sin(state.time * 0.16) * 5 + player.vx * 0.2;
    const armLift = 7 + ascent * 5;

    ctx.save();
    ctx.translate(player.x, screenY - 20 * ENTITY_SCALE);
    ctx.scale(player.facing * stretchX * ENTITY_SCALE, stretchY * ENTITY_SCALE);
    ctx.rotate(bodyTilt);

    ctx.fillStyle = "rgba(61, 87, 125, 0.16)";
    ctx.beginPath();
    ctx.ellipse(0, 76, 32, 10, 0, 0, Math.PI * 2);
    ctx.fill();

    drawStickFigure({
      x: -18,
      y: -8,
      scale: 1.05,
      bodyTilt: -0.18,
      stride,
      cap: true,
      hair: false,
      smileOffset: -1,
      armLift,
    });

    drawStickFigure({
      x: 20,
      y: 18,
      scale: 0.82,
      bodyTilt: -0.12,
      stride: -stride * 0.5,
      cap: false,
      hair: true,
      smileOffset: 0,
      armLift: armLift * 0.65,
    });

    ctx.restore();
  }

  function drawGameOverRibbon() {
    if (!state.gameOver) {
      return;
    }

    ctx.save();
    ctx.translate(WIDTH / 2, HEIGHT * 0.48);

    ctx.fillStyle = "rgba(255, 251, 243, 0.9)";
    ctx.beginPath();
    ctx.roundRect(-136, -56, 272, 112, 24);
    ctx.fill();

    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = "#173753";
    ctx.textAlign = "center";
    ctx.font = '700 28px "Marker Felt", "Trebuchet MS", sans-serif';
    ctx.fillText("Nice bounce.", 0, -10);

    ctx.font = '500 16px "Avenir Next", "Trebuchet MS", sans-serif';
    ctx.fillStyle = "rgba(23, 55, 83, 0.72)";
    ctx.fillText("Press left or right to try again", 0, 24);
    ctx.restore();
  }

  function draw() {
    drawBackdrop();

    const visibleTrampolines = state.trampolines
      .filter((trampoline) => {
        const screenY = trampoline.y - state.cameraY;
        return screenY > -80 && screenY < HEIGHT + 80;
      })
      .sort((left, right) => left.y - right.y);

    for (const trampoline of visibleTrampolines) {
      drawTrampoline(trampoline);
    }

    drawBounceParticles();
    drawPlayer();
    drawGameOverRibbon();
  }

  function frame(time) {
    if (!frame.lastTime) {
      frame.lastTime = time;
    }

    const delta = Math.min(2, (time - frame.lastTime) / 16.6667);
    frame.lastTime = time;

    update(delta);
    draw();
    requestAnimationFrame(frame);
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function random(min, max) {
    return Math.random() * (max - min) + min;
  }

  function lerp(start, end, factor) {
    return start + (end - start) * factor;
  }

  window.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
      return;
    }

    event.preventDefault();
    const direction = event.key === "ArrowLeft" ? -1 : 1;
    const shouldResetViewport = !state.started || state.gameOver;

    if (event.key === "ArrowLeft") {
      keys.left = true;
    } else {
      keys.right = true;
    }

    if (state.gameOver) {
      restartRun(direction);
    } else {
      startRun(direction);
    }

    if (shouldResetViewport) {
      syncGameViewport(0, true);
    }

    updateHud();
  });

  window.addEventListener("keyup", (event) => {
    if (event.key === "ArrowLeft") {
      keys.left = false;
    } else if (event.key === "ArrowRight") {
      keys.right = false;
    }
  });

  window.addEventListener("blur", () => {
    keys.left = false;
    keys.right = false;
  });

  window.addEventListener("resize", () => {
    syncGameViewport(state.started && !state.gameOver ? null : 0);
  });

  resetGame();
  requestAnimationFrame(frame);
})();
