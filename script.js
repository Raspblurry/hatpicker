(() => {
  const board = document.getElementById("board");
  const cardsRow = document.getElementById("cardsRow");
  const cards = Array.from(cardsRow.querySelectorAll(".card"));
  const hat = document.getElementById("hat");
  const throwBtn = document.getElementById("throwBtn");
  const resultSign = document.getElementById("resultSign");
  const resultName = document.getElementById("resultName");

  const NAMES = ["ISMS Officer 1", "ISMS Officer 2", "ISMS Officer 3"];

  // ---------- face expressions ----------
  const FACE_VARIANTS = ["happy", "scared", "sad"];
  const headImgs = cards.map((c) => c.querySelector(".head"));

  // Preload all variants so swaps are instant
  cards.forEach((card) => {
    const n = card.dataset.officer;
    FACE_VARIANTS.forEach((v) => {
      const img = new Image();
      img.src = `assets/officer${n}_${v}.png`;
    });
  });

  function setFace(idx, variant) {
    const card = cards[idx];
    const n = card.dataset.officer;
    headImgs[idx].src = `assets/officer${n}_${variant}.png`;
  }
  function setAllFaces(variant) {
    cards.forEach((_, i) => setFace(i, variant));
  }
  function setResultFaces(winner) {
    cards.forEach((_, i) => setFace(i, i === winner ? "sad" : "happy"));
  }

  // ---------- layout ----------
  function getCardCenters() {
    const boardRect = board.getBoundingClientRect();
    const hatWidth = hat.getBoundingClientRect().width;
    return cards.map((card) => {
      const r = card.getBoundingClientRect();
      const centerInBoard = r.left - boardRect.left + r.width / 2;
      return centerInBoard - hatWidth / 2; // hat's left needed for centered placement
    });
  }
  function getHoverY() {
    return 0; // hat sits at top of board
  }
  function getLandingY(idx) {
    // y offset to drop the hat onto the head's top
    const boardRect = board.getBoundingClientRect();
    const headRect = cards[idx].querySelector(".head").getBoundingClientRect();
    const hatRect = hat.getBoundingClientRect();
    // Want hat's bottom (brim) to sit ~12% of head height into the head
    const headTopInBoard = headRect.top - boardRect.top;
    return headTopInBoard - hatRect.height + hatRect.height * 0.30;
  }

  let centers = getCardCenters();
  let posX = centers[1]; // start over middle
  let posY = getHoverY();
  let landedOn = null; // winner index when hat is resting on a head

  function setHat(x, y, rot = 0) {
    hat.style.transform = `translate3d(${x}px, ${y}px, 0) rotate(${rot}deg)`;
  }
  setHat(posX, posY);

  function relayout() {
    centers = getCardCenters();
    if (spinning) return;
    if (landedOn !== null) {
      posX = centers[landedOn];
      setHat(posX, getLandingY(landedOn));
    } else {
      setHat(centers[currentIdle()], getHoverY());
    }
  }
  window.addEventListener("resize", relayout);
  window.addEventListener("orientationchange", () => {
    // Safari fires this slightly before the new layout is applied
    setTimeout(relayout, 50);
    setTimeout(relayout, 250);
  });

  // Recompute once each head image has finished loading (initial dimensions
  // can be 0 on iOS Safari before the image decoded).
  headImgs.forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", relayout, { once: true });
  });
  // Also after the hat image itself has loaded
  const hatImg = hat.querySelector("img");
  if (hatImg && !hatImg.complete) {
    hatImg.addEventListener("load", relayout, { once: true });
  }

  // ---------- audio ----------
  let audioCtx = null;
  function ensureAudio() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function playTick(velocityFactor = 1) {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    const dur = 0.025;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * dur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    const src = ctx.createBufferSource();
    src.buffer = buf;
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass";
    bp.frequency.value = 1800 + 600 * velocityFactor;
    bp.Q.value = 6;
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 800;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.14, now + 0.002);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.03);
    src.connect(bp).connect(hp).connect(gain).connect(ctx.destination);
    src.start(now);
    src.stop(now + dur);
  }

  function playPlop() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;

    // low thud (sine that drops in pitch)
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + 0.18);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.32, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.3);

    // soft noise puff for the felt of the hat
    const nDur = 0.08;
    const buf = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * nDur), ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 600;
    const ng = ctx.createGain();
    ng.gain.value = 0.18;
    src.connect(lp).connect(ng).connect(ctx.destination);
    src.start(now);
  }

  function playWinChime() {
    const ctx = ensureAudio();
    if (!ctx) return;
    const now = ctx.currentTime;
    [0, 0.12, 0.24].forEach((delay, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime([660, 880, 1175][i], now + delay);
      gain.gain.setValueAtTime(0.0001, now + delay);
      gain.gain.exponentialRampToValueAtTime(0.03, now + delay + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + delay + 0.35);
      osc.connect(gain).connect(ctx.destination);
      osc.start(now + delay);
      osc.stop(now + delay + 0.4);
    });
  }

  // ---------- idle wander ----------
  let idleRAF = null;
  let idleStart = performance.now();
  let spinning = false;

  function currentIdle() {
    // returns the card index nearest to current hat position
    let best = 0, dBest = Infinity;
    for (let i = 0; i < centers.length; i++) {
      const d = Math.abs(centers[i] - posX);
      if (d < dBest) { dBest = d; best = i; }
    }
    return best;
  }

  function idleLoop(now) {
    if (spinning) return;
    const t = (now - idleStart) / 1000;
    // oscillate between centers[0] and centers[2] using a sine wave (period 4s)
    const min = centers[0];
    const max = centers[2];
    const mid = (min + max) / 2;
    const amp = (max - min) / 2;
    posX = mid + Math.sin(t * Math.PI / 2) * amp;
    setHat(posX, getHoverY());
    idleRAF = requestAnimationFrame(idleLoop);
  }
  idleRAF = requestAnimationFrame(idleLoop);

  // ---------- spin & drop ----------
  const easeOutQuart = (t) => 1 - Math.pow(1 - t, 4);
  const easeInQuad = (t) => t * t;

  function spin() {
    if (spinning) return;
    spinning = true;
    ensureAudio();
    cancelAnimationFrame(idleRAF);

    throwBtn.disabled = true;
    cards.forEach((c) => c.classList.remove("winner"));
    resultSign.classList.remove("celebrate");
    resultName.textContent = "…";
    setAllFaces("scared");

    const winner = Math.floor(Math.random() * NAMES.length);

    centers = getCardCenters();
    const hoverY = getHoverY();

    // Phase A setup (declared up-front so startPhaseA can reach them).
    const phaseADuration = 3500;
    const min = centers[0];
    const max = centers[2];
    const mid = (min + max) / 2;
    const amp = (max - min) / 2;
    let lastBucket = currentIdle();
    let phaseAStart = 0;

    function startPhaseA() {
      phaseAStart = performance.now();
      lastBucket = currentIdle();
      requestAnimationFrame(phaseA);
    }

    function phaseA(now) {
      const elapsed = now - phaseAStart;
      const t = Math.min(1, elapsed / phaseADuration);
      const freq = 6 - 4.5 * t;
      const phase = (elapsed / 1000) * freq * Math.PI * 2;
      posX = mid + Math.sin(phase) * amp;
      setHat(posX, hoverY);

      const b = currentIdle();
      if (b !== lastBucket) {
        playTick(1 - t);
        lastBucket = b;
      }

      if (t < 1) {
        requestAnimationFrame(phaseA);
      } else {
        phaseB();
      }
    }

    // If the hat is resting on a head, lift it up first.
    if (landedOn !== null) {
      const fromY = getLandingY(landedOn);
      const liftDur = 400;
      const liftStart = performance.now();
      const liftX = centers[landedOn];
      landedOn = null;

      function liftStep(now) {
        const t = Math.min(1, (now - liftStart) / liftDur);
        const e = 1 - Math.pow(1 - t, 3);
        const y = fromY + (hoverY - fromY) * e;
        setHat(liftX, y);
        if (t < 1) requestAnimationFrame(liftStep);
        else {
          posX = liftX;
          startPhaseA();
        }
      }
      requestAnimationFrame(liftStep);
    } else {
      startPhaseA();
    }

    // Phase B — easeOut from current position to winner center
    function phaseB() {
      const fromX = posX;
      const toX = centers[winner];
      const startB = performance.now();
      const dur = 1100;
      let lastB = currentIdle();

      function step(now) {
        const t = Math.min(1, (now - startB) / dur);
        const e = easeOutQuart(t);
        posX = fromX + (toX - fromX) * e;
        setHat(posX, hoverY);

        const b = currentIdle();
        if (b !== lastB) {
          playTick(0.15);
          lastB = b;
        }

        if (t < 1) requestAnimationFrame(step);
        else phaseC();
      }
      requestAnimationFrame(step);
    }

    // Phase C — drop animation (hat falls onto head)
    function phaseC() {
      const startC = performance.now();
      const dur = 380;
      const dropTo = getLandingY(winner);
      const fromY = hoverY;

      function step(now) {
        const t = Math.min(1, (now - startC) / dur);
        const e = easeInQuad(t);
        const y = fromY + (dropTo - fromY) * e;
        // slight wobble rotation while dropping
        const rot = (1 - t) * 0;
        setHat(centers[winner], y, rot);

        if (t < 1) requestAnimationFrame(step);
        else finalize();
      }
      requestAnimationFrame(step);
    }

    function finalize() {
      playPlop();
      setResultFaces(winner);
      cards[winner].classList.add("winner");
      resultName.textContent = NAMES[winner];
      resultSign.classList.remove("celebrate");
      void resultSign.offsetWidth;
      resultSign.classList.add("celebrate");
      setTimeout(playWinChime, 220);

      landedOn = winner;
      spinning = false;
      throwBtn.disabled = false;
    }
  }

  throwBtn.addEventListener("click", spin);
})();
