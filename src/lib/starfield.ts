// 3D starfield rendered on a single <canvas>.
//
// Two layers:
//  - "far": a celestial sphere of tiny stars around the camera that turns very
//    slowly, like the night sky rotating.
//  - "near": a thick disc of bright stars in front of the camera orbiting a
//    tilted axis. Inner stars orbit faster than outer ones (differential
//    rotation, like a galaxy), so they overtake each other and the parallax
//    reads as real depth. Closer stars are drawn bigger and brighter.
//
// The axis tilt, roll and orbit direction are randomised on every page load.
// The loop only runs while dark mode is on and the tab is visible, and it is
// capped at 30fps on phones. Drawing is one drawImage/fillRect per visible
// star, using sprites pre-rendered once, so the per-frame cost is small.

type RGB = [number, number, number];

interface NearStar {
  r: number;
  theta: number;
  y: number;
  omega: number;
  size: number;
  sprite: number;
  alpha: number;
  tw: number;
  phase: number;
}

interface FarStar {
  x: number;
  y: number;
  z: number;
  size: number;
  color: number;
  alpha: number;
  tw: number;
  phase: number;
}

// Real star colours by spectral class (O/B blue → K/M orange), weighted
// roughly by how common they look to the eye, plus a hint of the site accent.
const PALETTE: { rgb: RGB; weight: number }[] = [
  { rgb: [155, 176, 255], weight: 10 },
  { rgb: [170, 191, 255], weight: 14 },
  { rgb: [202, 215, 255], weight: 20 },
  { rgb: [248, 247, 255], weight: 24 },
  { rgb: [255, 244, 234], weight: 14 },
  { rgb: [255, 210, 161], weight: 9 },
  { rgb: [255, 190, 120], weight: 5 },
  { rgb: [196, 181, 253], weight: 4 },
];
const TOTAL_WEIGHT = PALETTE.reduce((sum, c) => sum + c.weight, 0);

function pickColor(): number {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < PALETTE.length; i++) {
    roll -= PALETTE[i].weight;
    if (roll <= 0) return i;
  }
  return 0;
}

function rgba([r, g, b]: RGB, a: number): string {
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Box–Muller, clamped so the disc keeps a soft but bounded thickness
function gaussian(): number {
  const u = 1 - Math.random();
  const v = Math.random();
  const n = Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  return Math.max(-2.5, Math.min(2.5, n));
}

const SPRITE_SIZE = 64;

function makeSprite(rgb: RGB, spikes: boolean): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SPRITE_SIZE;
  const g = canvas.getContext('2d')!;
  const h = SPRITE_SIZE / 2;

  const glow = g.createRadialGradient(h, h, 0, h, h, h);
  glow.addColorStop(0, 'rgba(255, 255, 255, 1)');
  glow.addColorStop(0.1, rgba(rgb, 0.95));
  glow.addColorStop(0.28, rgba(rgb, 0.28));
  glow.addColorStop(0.6, rgba(rgb, 0.06));
  glow.addColorStop(1, rgba(rgb, 0));
  g.fillStyle = glow;
  g.fillRect(0, 0, SPRITE_SIZE, SPRITE_SIZE);

  if (spikes) {
    // Diffraction spikes, like bright stars in telescope photos
    g.globalCompositeOperation = 'lighter';
    const horizontal = g.createLinearGradient(0, 0, SPRITE_SIZE, 0);
    horizontal.addColorStop(0, rgba(rgb, 0));
    horizontal.addColorStop(0.5, rgba(rgb, 0.9));
    horizontal.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = horizontal;
    g.fillRect(0, h - 0.75, SPRITE_SIZE, 1.5);

    const vertical = g.createLinearGradient(0, 0, 0, SPRITE_SIZE);
    vertical.addColorStop(0, rgba(rgb, 0));
    vertical.addColorStop(0.5, rgba(rgb, 0.9));
    vertical.addColorStop(1, rgba(rgb, 0));
    g.fillStyle = vertical;
    g.fillRect(h - 0.75, 0, 1.5, SPRITE_SIZE);
  }
  return canvas;
}

export function initStarfield(canvas: HTMLCanvasElement): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const isMobile = window.matchMedia('(max-width: 768px), (pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)').matches;

  const NEAR_COUNT = isMobile ? 260 : 620;
  const FAR_COUNT = isMobile ? 1800 : 3600;
  const MAX_DPR = isMobile ? 1.5 : 2;
  const MIN_FRAME_MS = isMobile ? 1000 / 30 : 0;

  // Disc centre sits in front of the camera; the camera looks down +z
  const DISC_DEPTH = 1.4;
  const DISC_RADIUS = 1.9;
  const NEAR_PLANE = 0.18;

  // Random orientation of the orbit axis: tilt around X, then roll around Z
  const tilt = (0.45 + Math.random() * 0.6) * (Math.random() < 0.5 ? -1 : 1);
  const roll = Math.random() * Math.PI * 2;
  const direction = Math.random() < 0.5 ? 1 : -1;
  const ca = Math.cos(tilt), sa = Math.sin(tilt);
  const cb = Math.cos(roll), sb = Math.sin(roll);
  // M = Rz(roll) · Rx(tilt)
  const m00 = cb, m01 = -sb * ca, m02 = sb * sa;
  const m10 = sb, m11 = cb * ca, m12 = -cb * sa;
  const m20 = 0, m21 = sa, m22 = ca;

  const sprites = PALETTE.flatMap(({ rgb }) => [makeSprite(rgb, false), makeSprite(rgb, true)]);
  const farFill = PALETTE.map(({ rgb }) => rgba(rgb, 1));

  const near: NearStar[] = [];
  for (let i = 0; i < NEAR_COUNT; i++) {
    const r = 0.12 + DISC_RADIUS * Math.sqrt(Math.random());
    const bright = Math.random() < 0.08;
    near.push({
      r,
      theta: Math.random() * Math.PI * 2,
      y: gaussian() * 0.28,
      // Differential rotation: inner orbits are faster (≈ 1 / r^1.5)
      omega: direction * 0.03 / Math.pow(0.35 + r, 1.5),
      size: bright ? 2.2 + Math.random() * 1.6 : 0.8 + Math.random() * 1.2,
      sprite: pickColor() * 2 + (bright ? 1 : 0),
      alpha: bright ? 1 : 0.7 + Math.random() * 0.3,
      tw: 0.6 + Math.random() * 2.2,
      phase: Math.random() * Math.PI * 2,
    });
  }

  const far: FarStar[] = [];
  for (let i = 0; i < FAR_COUNT; i++) {
    // Uniform direction on a unit sphere
    const u = Math.random() * 2 - 1;
    const phi = Math.random() * Math.PI * 2;
    const s = Math.sqrt(1 - u * u);
    far.push({
      x: s * Math.cos(phi),
      y: u,
      z: s * Math.sin(phi),
      size: 0.6 + Math.random() * Math.random() * 1.4,
      color: pickColor(),
      alpha: 0.4 + Math.random() * 0.6,
      tw: 0.8 + Math.random() * 3,
      phase: Math.random() * Math.PI * 2,
    });
  }
  // Group by colour so fillStyle only changes a handful of times per frame
  far.sort((a, b) => a.color - b.color);

  let width = 0, height = 0, dpr = 1, focal = 1, cx = 0, cy = 0;

  function resize() {
    dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    width = Math.round(window.innerWidth * dpr);
    height = Math.round(window.innerHeight * dpr);
    canvas.width = width;
    canvas.height = height;
    focal = 0.55 * Math.max(width, height);
    cx = width / 2;
    cy = height / 2;
  }

  let skyAngle = Math.random() * Math.PI * 2;
  let time = 0;
  // Subtle camera parallax following the mouse (desktop only)
  let camX = 0, camY = 0, targetX = 0, targetY = 0;

  function draw(dt: number) {
    time += dt;
    skyAngle += direction * 0.006 * dt;
    camX += (targetX - camX) * Math.min(1, dt * 2.5);
    camY += (targetY - camY) * Math.min(1, dt * 2.5);

    ctx!.globalCompositeOperation = 'source-over';
    ctx!.clearRect(0, 0, width, height);

    // Far layer: sky sphere rotating about the same tilted axis
    const cs = Math.cos(skyAngle), ss = Math.sin(skyAngle);
    let currentColor = -1;
    for (let i = 0; i < far.length; i++) {
      const st = far[i];
      const lx = st.x * cs + st.z * ss;
      const lz = -st.x * ss + st.z * cs;
      const wz = m20 * lx + m21 * st.y + m22 * lz;
      if (wz <= 0.05) continue;
      const wx = m00 * lx + m01 * st.y + m02 * lz - camX * 0.04;
      const wy = m10 * lx + m11 * st.y + m12 * lz - camY * 0.04;
      const sx = cx + (wx / wz) * focal;
      const sy = cy + (wy / wz) * focal;
      if (sx < 0 || sx > width || sy < 0 || sy > height) continue;

      if (st.color !== currentColor) {
        currentColor = st.color;
        ctx!.fillStyle = farFill[currentColor];
      }
      ctx!.globalAlpha = st.alpha * (0.65 + 0.35 * Math.sin(time * st.tw + st.phase));
      const px = st.size * dpr;
      ctx!.fillRect(sx - px / 2, sy - px / 2, px, px);
    }

    // Near layer: orbiting disc with perspective and additive glow
    ctx!.globalCompositeOperation = 'lighter';
    for (let i = 0; i < near.length; i++) {
      const st = near[i];
      st.theta += st.omega * dt;
      const lx = st.r * Math.cos(st.theta);
      const lz = st.r * Math.sin(st.theta);
      const wz = m20 * lx + m21 * st.y + m22 * lz + DISC_DEPTH;
      if (wz <= NEAR_PLANE) continue;
      const wx = m00 * lx + m01 * st.y + m02 * lz - camX;
      const wy = m10 * lx + m11 * st.y + m12 * lz - camY;

      const scale = focal / wz;
      const sx = cx + wx * scale;
      const sy = cy + wy * scale;
      const depth = DISC_DEPTH / wz;
      const radius = Math.min(st.size * depth * dpr, 9 * dpr);
      const glow = radius * 7;
      if (sx < -glow || sx > width + glow || sy < -glow || sy > height + glow) continue;

      // Fade in stars that come close to the camera instead of popping,
      // and dim the ones on the far side of the disc
      const nearFade = Math.min(1, (wz - NEAR_PLANE) / 0.35);
      const farFade = Math.min(1, 0.35 + depth * 0.8);
      const twinkle = 0.75 + 0.25 * Math.sin(time * st.tw + st.phase);
      ctx!.globalAlpha = st.alpha * nearFade * farFade * twinkle;
      ctx!.drawImage(sprites[st.sprite], sx - glow / 2, sy - glow / 2, glow, glow);
    }
    ctx!.globalAlpha = 1;
  }

  let rafId = 0;
  let last = 0;

  function frame(now: number) {
    rafId = requestAnimationFrame(frame);
    if (now - last < MIN_FRAME_MS - 1) return;
    const dt = Math.min((now - last) / 1000, 0.1);
    last = now;
    draw(dt);
  }

  function shouldRun() {
    return document.body.classList.contains('dark-theme') && !document.hidden;
  }

  function update() {
    if (reducedMotion.matches) {
      cancelAnimationFrame(rafId);
      rafId = 0;
      draw(0);
      return;
    }
    if (shouldRun() && !rafId) {
      last = performance.now();
      rafId = requestAnimationFrame(frame);
    } else if (!shouldRun() && rafId) {
      cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  resize();
  draw(0);
  update();

  let resizeTimer = 0;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      resize();
      draw(0);
    }, 150);
  });

  if (finePointer && !reducedMotion.matches) {
    window.addEventListener('pointermove', (e) => {
      targetX = (e.clientX / window.innerWidth - 0.5) * 0.12;
      targetY = (e.clientY / window.innerHeight - 0.5) * 0.12;
    }, { passive: true });
  }

  document.addEventListener('visibilitychange', update);
  new MutationObserver(update).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  reducedMotion.addEventListener('change', update);
}
