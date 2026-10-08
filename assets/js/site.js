(() => {
  'use strict';

  const root = document.documentElement;
  const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
  const motionAllowed = () => !motionPreference.matches;
  if (motionAllowed()) root.classList.add('motion-ok');

  const clamp = (value, min, max) => Math.min(Math.max(value, min), max);
  const ease = (t) => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  // Azerbaijani notation: decimal comma, no grouping for measured values.
  const decimal = (number, digits = 1) => number.toFixed(digits).replace('.', ',');

  // Scroll-linked work is batched into one frame.
  const scrollJobs = [];
  let scrollPending = false;
  const runScrollJobs = () => { scrollPending = false; scrollJobs.forEach((job) => job()); };
  const onScroll = (job) => { scrollJobs.push(job); job(); };
  window.addEventListener('scroll', () => {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(runScrollJobs); }
  }, { passive: true });
  window.addEventListener('resize', () => requestAnimationFrame(runScrollJobs));

  // Header kerf: reading progress through the page.
  const header = document.querySelector('.site-header');
  if (header) {
    onScroll(() => {
      const max = document.documentElement.scrollHeight - innerHeight;
      header.style.setProperty('--read', max > 0 ? (scrollY / max).toFixed(4) : 0);
    });
  }

  // Elements that react once when they enter the viewport.
  const viewObserver = 'IntersectionObserver' in window ? new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-inview');
      entry.target.dispatchEvent(new CustomEvent('inview'));
      viewObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px' }) : null;
  document.querySelectorAll('.reveal, .process-card, .page-icon, .ledger-table tbody tr, .quality-photo').forEach((element) => {
    if (viewObserver && motionAllowed()) viewObserver.observe(element);
    else element.classList.add('is-inview');
  });

  /* ---------------------------------------------------------------------
     Hero: a fiber laser cutting eight bracket blanks from one sheet.
     The geometry and NC lines are the static SVG; this only replays them.
     --------------------------------------------------------------------- */
  const bed = document.querySelector('[data-bed]');
  if (bed && motionAllowed()) {
    const svg = bed.querySelector('.bed-svg');
    const sheet = bed.querySelector('[data-sheet]');
    const head = bed.querySelector('[data-head]');
    const canvas = bed.querySelector('[data-sparks]');
    const context = canvas.getContext('2d');
    const toggle = bed.querySelector('[data-bed-toggle]');
    const hud = {
      x: bed.querySelector('[data-hud-x]'),
      y: bed.querySelector('[data-hud-y]'),
      mode: bed.querySelector('[data-hud-mode]'),
      part: bed.querySelector('[data-hud-part]'),
      gcode: bed.querySelector('[data-gcode]')
    };
    const MM = 3000 / 580;
    const SHEET_X = 30;
    const SHEET_Y = 35;
    const CUT_SPEED = 150;
    const RAPID_SPEED = 900;

    const parts = [...bed.querySelectorAll('.nest-part')].map((group) => ({
      group,
      contours: [...group.querySelectorAll('.kerf')].map((path) => {
        const length = path.getTotalLength();
        path.style.setProperty('--len', length.toFixed(2));
        return { path, length, start: path.getPointAtLength(0), code: path.dataset.g.split('|') };
      })
    }));
    const steps = [];
    parts.forEach((part, partIndex) => part.contours.forEach((contour, contourIndex) => {
      steps.push({ partIndex, contourIndex, contour, last: contourIndex === part.contours.length - 1 });
    }));

    let lineNumber = 10;
    const emit = (text, current = true) => {
      const line = document.createElement('li');
      line.textContent = `N${String(lineNumber).padStart(4, '0')} ${text}`;
      lineNumber += 10;
      hud.gcode.querySelectorAll('.is-current').forEach((item) => item.classList.remove('is-current'));
      if (current) line.classList.add('is-current');
      hud.gcode.append(line);
      while (hud.gcode.children.length > 6) hud.gcode.firstElementChild.remove();
    };

    const resetSheet = () => {
      parts.forEach((part) => {
        part.group.classList.remove('is-done');
        part.contours.forEach(({ path, length }) => {
          path.classList.remove('is-cut', 'is-cutting');
          path.style.setProperty('--off', length.toFixed(2));
        });
      });
      hud.part.textContent = `0 / ${parts.length}`;
    };

    let headX = 600;
    let headY = 340;
    const placeHead = (x, y) => {
      headX = x; headY = y;
      head.setAttribute('transform', `translate(${x.toFixed(2)} ${y.toFixed(2)})`);
      hud.x.textContent = decimal(clamp((x - SHEET_X) * MM, 0, 3000));
      hud.y.textContent = decimal(clamp((y - SHEET_Y) * MM, 0, 1500));
    };

    // Sparks are drawn in canvas pixels over the SVG.
    const sparks = [];
    let scale = 1;
    const sizeCanvas = () => {
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(canvas.clientWidth * ratio);
      canvas.height = Math.round(canvas.clientHeight * ratio);
      scale = canvas.width / 640;
    };
    sizeCanvas();
    window.addEventListener('resize', sizeCanvas);
    const emitSparks = (x, y, count) => {
      for (let index = 0; index < count; index += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 40 + Math.random() * 160;
        sparks.push({ x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed * .7 + 30, life: 0, max: .18 + Math.random() * .35 });
      }
    };
    const drawSparks = (dt) => {
      context.clearRect(0, 0, canvas.width, canvas.height);
      context.globalCompositeOperation = 'lighter';
      context.lineCap = 'round';
      for (let index = sparks.length - 1; index >= 0; index -= 1) {
        const spark = sparks[index];
        spark.life += dt;
        if (spark.life >= spark.max) { sparks.splice(index, 1); continue; }
        spark.vy += 120 * dt;
        const px = spark.x; const py = spark.y;
        spark.x += spark.vx * dt; spark.y += spark.vy * dt;
        const fade = 1 - spark.life / spark.max;
        context.strokeStyle = `rgba(255,${Math.round(150 + fade * 90)},${Math.round(80 + fade * 120)},${fade})`;
        context.lineWidth = Math.max(1, 1.3 * scale * fade);
        context.beginPath();
        context.moveTo(px * scale, py * scale);
        context.lineTo(spark.x * scale, spark.y * scale);
        context.stroke();
      }
    };

    // State machine: rapid → cut → (next) … → sheet change.
    let stepIndex = 0;
    let phase = 'rapid';
    let travelled = 0;
    let wait = 0;
    let motionLinesShown = 0;
    let running = true;
    let visible = true;
    let last = 0;

    const beginStep = () => {
      const step = steps[stepIndex];
      phase = 'rapid';
      bed.classList.remove('is-cutting');
      hud.mode.textContent = 'Keçid';
      hud.part.textContent = `${step.partIndex + 1} / ${parts.length}`;
      emit(step.contour.code[0]);
    };

    const tick = (now) => {
      const dt = Math.min((now - last) / 1000 || 0, .05);
      last = now;
      if (!running || !visible) { if (running) requestAnimationFrame(tick); return; }

      if (phase === 'wait') {
        wait -= dt;
        if (wait <= 0) {
          if (stepIndex >= steps.length) {
            phase = 'change';
            hud.mode.textContent = 'Sac dəyişir';
            emit('M60');
            sheet.classList.add('is-leaving');
            wait = 1.2;
          } else beginStep();
        }
      } else if (phase === 'change') {
        wait -= dt;
        if (wait <= 0) {
          sheet.classList.remove('is-leaving');
          sheet.classList.add('is-entering');
          resetSheet();
          sheet.getBoundingClientRect();
          sheet.classList.remove('is-entering');
          stepIndex = 0;
          phase = 'wait';
          wait = 1.3;
          hud.mode.textContent = 'Sac hazırdır';
        }
      } else if (phase === 'rapid') {
        const { start } = steps[stepIndex].contour;
        const dx = start.x - headX; const dy = start.y - headY;
        const distance = Math.hypot(dx, dy);
        const move = RAPID_SPEED * dt;
        if (distance <= move) {
          placeHead(start.x, start.y);
          phase = 'cut';
          travelled = 0;
          motionLinesShown = 0;
          bed.classList.add('is-cutting');
          hud.mode.textContent = 'Kəsim';
          steps[stepIndex].contour.path.classList.add('is-cutting');
          emit(steps[stepIndex].contour.code[1]);
        } else {
          placeHead(headX + dx / distance * move, headY + dy / distance * move);
        }
      } else if (phase === 'cut') {
        const step = steps[stepIndex];
        const { path, length, code } = step.contour;
        travelled = Math.min(length, travelled + CUT_SPEED * dt);
        path.style.setProperty('--off', (length - travelled).toFixed(2));
        const point = path.getPointAtLength(travelled);
        placeHead(point.x, point.y);
        emitSparks(point.x, point.y, 3);
        const motion = code.slice(2, -1);
        const due = Math.ceil(travelled / length * motion.length);
        while (motionLinesShown < due) { emit(motion[motionLinesShown]); motionLinesShown += 1; }
        if (travelled >= length) {
          path.classList.remove('is-cutting');
          path.classList.add('is-cut');
          emit(code[code.length - 1]);
          if (step.last) parts[step.partIndex].group.classList.add('is-done');
          stepIndex += 1;
          phase = 'wait';
          wait = step.last ? .45 : .08;
          bed.classList.remove('is-cutting');
        }
      }
      drawSparks(dt);
      requestAnimationFrame(tick);
    };

    const start = () => { last = performance.now(); requestAnimationFrame(tick); };
    bed.classList.add('is-live');
    hud.gcode.replaceChildren();
    emit('G90 G21', false);
    emit('M60', false);
    resetSheet();
    placeHead(600, 340);
    phase = 'wait';
    wait = .6;
    toggle.hidden = false;
    toggle.addEventListener('click', () => {
      running = !running;
      toggle.setAttribute('aria-pressed', String(!running));
      toggle.textContent = running ? 'Dayandır' : 'Davam et';
      toggle.setAttribute('aria-label', running ? 'Animasiyanı dayandır' : 'Animasiyanı davam etdir');
      if (running) start();
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([entry]) => {
        const wasVisible = visible;
        visible = entry.isIntersecting;
        if (visible && !wasVisible && running) start();
      }).observe(bed);
    }
    document.addEventListener('visibilitychange', () => {
      const wasVisible = visible;
      visible = !document.hidden;
      if (visible && !wasVisible && running) start();
    });
    motionPreference.addEventListener('change', () => { if (motionPreference.matches && running) toggle.click(); });
    start();
  }

  /* ---------------------------------------------------------------------
     Journey: scroll drives one bracket through cut, bend, weld, coat, QC.
     --------------------------------------------------------------------- */
  const journey = document.querySelector('[data-journey]');
  if (journey && motionAllowed()) {
    const visual = journey.querySelector('.journey-visual');
    const steps = [...journey.querySelectorAll('.journey-step')];
    const stamps = [...journey.querySelectorAll('[data-stamp]')];
    const measures = [...journey.querySelectorAll('[data-measure]')];
    const measureCard = journey.querySelector('.measure-card');
    const kerfs = [...journey.querySelectorAll('.j-kerf')];
    const holeOrder = ['6', '7', '0', '1', '2', '3', '4'];
    const holes = holeOrder.map((id) => journey.querySelector(`[data-hole="${id}"]`));
    const lengths = kerfs.map((path) => path.getTotalLength());
    const total = lengths.reduce((sum, value) => sum + value, 0);
    kerfs.forEach((path, index) => {
      path.style.strokeDasharray = lengths[index];
      path.style.strokeDashoffset = lengths[index];
    });
    journey.classList.add('is-live');

    const STAGES = 5;
    const local = (p, stage, span = .72) => clamp((p * STAGES - stage) / span, 0, 1);
    let lastActive = -1;

    onScroll(() => {
      const bounds = journey.getBoundingClientRect();
      const travel = journey.offsetHeight - (innerHeight - (header ? header.offsetHeight : 0));
      const p = clamp(-bounds.top / Math.max(1, travel), 0, 1);
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;

      const cutStage = local(p, 0, .8);
      const cut = ease(clamp(cutStage / .8, 0, 1));
      const drop = ease(clamp((cutStage - .8) / .2, 0, 1));
      const bend = ease(local(p, 1));
      const weld = local(p, 2);
      const weldIn = ease(clamp(weld / .45, 0, 1));
      const weldHeat = weld <= .45 ? 0 : Math.sin(clamp((weld - .45) / .55, 0, 1) * Math.PI);
      const coat = ease(local(p, 3));
      const measure = local(p, 4);
      const style = visual.style;
      style.setProperty('--cut', cut.toFixed(4));
      style.setProperty('--drop', drop.toFixed(4));
      style.setProperty('--bend', bend.toFixed(4));
      style.setProperty('--weld-in', weldIn.toFixed(4));
      style.setProperty('--weld-heat', weldHeat.toFixed(4));
      style.setProperty('--coat', coat.toFixed(4));
      style.setProperty('--measure', measure.toFixed(4));
      style.setProperty('--spin', p.toFixed(4));
      style.setProperty('--heat', cut > 0 && cut < 1 ? '1' : '0');
      journey.style.setProperty('--p', p.toFixed(4));

      // Distribute the cut along the contours in order: holes, slot, outline.
      let remaining = cut * total;
      let headPoint = null;
      kerfs.forEach((path, index) => {
        const done = clamp(remaining, 0, lengths[index]);
        remaining -= lengths[index];
        path.style.strokeDashoffset = (lengths[index] - done).toFixed(2);
        if (done > 0 && done < lengths[index]) headPoint = path.getPointAtLength(done);
        if (holes[index]) holes[index].style.opacity = done >= lengths[index] ? '1' : '0';
      });
      if (headPoint) {
        style.setProperty('--hx', `${(headPoint.x / 6).toFixed(3)}%`);
        style.setProperty('--hy', `${(headPoint.y / 6).toFixed(3)}%`);
      }

      const active = clamp(Math.floor(p * STAGES), 0, STAGES - 1);
      if (active !== lastActive) {
        steps.forEach((step, index) => {
          step.classList.toggle('is-active', index === active);
          step.classList.toggle('is-past', index < active);
        });
        lastActive = active;
      }
      const stageDone = [cut >= 1, bend >= 1, weld >= 1, coat >= 1, measure >= 1];
      stamps.forEach((stamp, index) => stamp.classList.toggle('is-done', stageDone[index]));
      measures.forEach((row, index) => row.classList.toggle('is-pending', measure < (index + 1) / 5));
      measureCard.classList.toggle('is-pending-verdict', measure < .97);
    });
  }

  // Workshop photograph drifts slower than the page.
  const workshop = document.querySelector('.workshop-film');
  if (workshop) {
    onScroll(() => {
      if (!motionAllowed()) { workshop.style.removeProperty('--travel'); return; }
      const bounds = workshop.getBoundingClientRect();
      if (bounds.bottom < 0 || bounds.top > innerHeight) return;
      const progress = (innerHeight - bounds.top) / (innerHeight + bounds.height);
      workshop.style.setProperty('--travel', `${((progress - .5) * 60).toFixed(1)}px`);
    });
  }

  // The caliper display hunts, then settles on the measured value.
  const caliper = document.querySelector('[data-caliper]');
  const qualityPhoto = document.querySelector('.quality-photo');
  if (caliper && qualityPhoto && motionAllowed()) {
    const target = 320.08;
    caliper.textContent = decimal(0, 2);
    qualityPhoto.addEventListener('inview', () => {
      const started = performance.now();
      const frame = (now) => {
        const t = clamp((now - started) / 1600, 0, 1);
        const jitter = t < 1 ? (Math.random() - .5) * (1 - t) * .4 : 0;
        caliper.textContent = decimal(Math.max(0, target * ease(t) + jitter), 2);
        if (t < 1) requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    }, { once: true });
  }

  /* --------------------------------------------------------------------- */

  const menuButton = document.querySelector('.menu-toggle');
  const nav = document.querySelector('.main-nav');
  if (menuButton && nav) {
    menuButton.addEventListener('click', () => {
      const open = menuButton.getAttribute('aria-expanded') === 'true';
      menuButton.setAttribute('aria-expanded', String(!open));
      nav.classList.toggle('is-open', !open);
      menuButton.querySelector('.sr-only').textContent = open ? 'Menyunu aç' : 'Menyunu bağla';
    });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('is-open')) {
        menuButton.click();
        menuButton.focus();
      }
    });
  }

  const demoForms = document.querySelectorAll('[data-demo-form]');
  demoForms.forEach((demoForm) => {
    demoForm.querySelectorAll('fieldset, button[type="submit"]').forEach((control) => { control.disabled = false; });
    demoForm.addEventListener('submit', (event) => {
      event.preventDefault();
      if (!demoForm.reportValidity()) return;
      const status = demoForm.querySelector('[data-demo-status]');
      if (status) {
        status.classList.add('is-visible');
        status.focus();
      }
    });
  });

  // Pass only the part specification in a fragment; it is not sent to the host.
  const requestForm = document.querySelector('#rfq-material')?.form;
  if (requestForm && location.hash.startsWith('#spec=')) {
    const specification = new URLSearchParams(location.hash.slice(6));
    const materials = { steel: 'Qara polad S235', stainless: 'Paslanmaz polad AISI 304', aluminium: 'Alüminium 5754' };
    const materialName = materials[specification.get('material')];
    if (materialName) requestForm.elements.material.value = materialName;
    const thicknessValue = Number(specification.get('thickness'));
    const countValue = Number(specification.get('quantity'));
    const widthValue = Number(specification.get('width'));
    const heightValue = Number(specification.get('height'));
    if (thicknessValue >= 1 && thicknessValue <= 6) requestForm.elements.thickness.value = `${thicknessValue} mm`;
    if (Number.isInteger(countValue) && countValue >= 1 && countValue <= 500) requestForm.elements.quantity.value = countValue;
    if (widthValue >= 20 && widthValue <= 1450 && heightValue >= 20 && heightValue <= 2950) {
      requestForm.elements.notes.value = `Düzbucaqlı detal: ${widthValue} × ${heightValue} mm.`;
    }
    if (specification.has('bend')) requestForm.elements.process.value = 'Lazer + büküm';
    if (specification.has('coat')) requestForm.elements.finish.value = 'Toz boya';
    else if (specification.has('deburr')) requestForm.elements.finish.value = 'Kənar təmizləmə';
  }

  const form = document.querySelector('[data-quote-form]');
  if (!form) return;

  const material = form.querySelector('#material');
  const thickness = form.querySelector('#thickness');
  const width = form.querySelector('#width');
  const height = form.querySelector('#height');
  const quantity = form.querySelector('#quantity');
  const partsGroup = document.querySelector('[data-parts]');
  const output = {
    layout: document.querySelector('[data-layout]'),
    utilization: document.querySelector('[data-utilization]'),
    weight: document.querySelector('[data-weight]'),
    waste: document.querySelector('[data-waste]'),
    cutpath: document.querySelector('[data-cutpath]'),
    lead: document.querySelector('[data-lead]'),
    price: document.querySelector('[data-price]')
  };

  function calculate() {
    if (!form.checkValidity()) {
      Object.values(output).forEach((element) => { element.textContent = '—'; });
      partsGroup.replaceChildren();
      return;
    }
    const selected = material.options[material.selectedIndex];
    const density = Number(selected.dataset.density);
    const materialRate = Number(selected.dataset.rate);
    const t = clamp(Number(thickness.value) || 1, 0.8, 16);
    const w = clamp(Number(width.value) || 20, 20, 1450);
    const h = clamp(Number(height.value) || 20, 20, 2950);
    const count = clamp(Math.round(Number(quantity.value) || 1), 1, 500);
    const gap = 8;

    const normalCols = Math.max(1, Math.floor(3000 / (w + gap)));
    const normalRows = Math.floor(1500 / (h + gap));
    const rotatedCols = Math.max(1, Math.floor(3000 / (h + gap)));
    const rotatedRows = Math.max(1, Math.floor(1500 / (w + gap)));
    const normalCapacity = normalCols * normalRows;
    const rotatedCapacity = rotatedCols * rotatedRows;
    const rotated = rotatedCapacity > normalCapacity;
    const cols = rotated ? rotatedCols : normalCols;
    const rows = rotated ? rotatedRows : normalRows;
    const capacity = cols * rows;
    const sheets = Math.ceil(count / capacity);
    const partArea = (w * h) / 1_000_000;
    const totalArea = partArea * count;
    const sheetArea = 4.5 * sheets;
    const utilization = clamp((totalArea / sheetArea) * 100, 0, 100);
    const weight = totalArea * (t / 1000) * density * 1000;
    const perimeterM = ((w + h) * 2 / 1000) * count;
    const cutRate = 0.16 + t * 0.035;
    let estimate = weight * materialRate + perimeterM * cutRate + sheets * 7.5 + 18;
    if (form.elements.deburr.checked) estimate += count * 0.45;
    if (form.elements.bend.checked) estimate += count * 1.8;
    if (form.elements.coat.checked) estimate += totalArea * 2 * 7.5;
    const lower = Math.max(25, Math.round(estimate * .92));
    const upper = Math.round(estimate * 1.10);
    const lead = count <= 30 ? 2 : count <= 100 ? 3 : count <= 250 ? 5 : 7;

    output.layout.textContent = `${cols} × ${rows} / ${sheets} sac`;
    output.utilization.textContent = `${decimal(utilization)}%`;
    output.weight.textContent = `${decimal(weight)} kg`;
    output.waste.textContent = `${decimal(100 - utilization)}%`;
    output.cutpath.textContent = `${decimal(perimeterM)} m`;
    output.lead.textContent = `${lead} iş günü`;
    output.price.textContent = `${lower}–${upper} ₼`;

    drawParts({ w, h, count: Math.min(count, capacity), cols, rotated });
  }

  function drawParts({ w, h, count, cols, rotated }) {
    const ns = 'http://www.w3.org/2000/svg';
    const marginX = 30;
    const marginY = 22;
    const usableWidth = 548;
    const usableHeight = 304;
    const partW = (rotated ? h : w) / 3000 * usableWidth;
    const partH = (rotated ? w : h) / 1500 * usableHeight;
    const gapX = 8 / 3000 * usableWidth;
    const gapY = 8 / 1500 * usableHeight;

    partsGroup.replaceChildren();
    for (let index = 0; index < count; index += 1) {
      const col = index % cols;
      const row = Math.floor(index / cols);
      const rect = document.createElementNS(ns, 'rect');
      rect.setAttribute('class', 'part');
      rect.setAttribute('x', String(marginX + col * (partW + gapX)));
      rect.setAttribute('y', String(marginY + row * (partH + gapY)));
      rect.setAttribute('width', String(Math.max(2, partW)));
      rect.setAttribute('height', String(Math.max(2, partH)));
      rect.setAttribute('rx', '1');
      rect.style.setProperty('--part-index', String(Math.min(index, 45)));
      partsGroup.append(rect);
    }
  }

  form.addEventListener('input', calculate);
  form.addEventListener('change', calculate);
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    location.href = `teklif.html#spec=${new URLSearchParams(new FormData(form))}`;
  });
  calculate();
})();
