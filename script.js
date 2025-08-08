// Final integrated script — OOP models + UI glue + extras (CSV/PNG/localStorage)

class Spring {
  constructor(k = 25000, preload = 80, stroke_m = 0.002) {
    this.k = +k; this.preload = +preload; this.stroke = +stroke_m;
  }
  force(x) { return this.preload + this.k * x; }
  maxForce() { return this.force(this.stroke); }
}

class Electromagnet {
  constructor({ turns = 1, area_mm2 = 120, gap_mm = 0.5, coreLength_mm = 50, material = 'steel' } = {}) {
    this.N = +turns;
    this.area = +area_mm2; // mm^2
    this.gap = +gap_mm; // mm
    this.coreLen = +coreLength_mm; // mm
    this.material = material;
  }
  _mu_r() {
    if (this.material === 'steel') return 4000;
    if (this.material === 'iron') return 1000;
    if (this.material === 'ferrite') return 200;
    return 1;
  }
  magneticReluctance() {
    const mu0 = 4 * Math.PI * 1e-7;
    const A = this.area * 1e-6; // m^2
    const gap_m = Math.max(this.gap * 1e-3, 1e-6);
    const mu_r = this._mu_r();
    const Rgap = gap_m / (mu0 * A);
    const coreLen_m = Math.max(this.coreLen * 1e-3, 1e-3);
    const Rcore = coreLen_m / (mu0 * mu_r * A);
    const Rtotal = Rgap + Rcore;
    return { mu0, mu_r, A, gap_m, Rgap, Rcore, Rtotal, coreLen_m };
  }
  force_simple(I) {
    const mu0 = 4 * Math.PI * 1e-7;
    const A = this.area * 1e-6; // m^2
    const g = Math.max(this.gap * 1e-3, 1e-6);
    const raw = (mu0 * A * I * I) / (2 * g * g);
    const scale = 1e-3;
    return raw * scale;
  }
  force_energy(I) {
    const { Rgap, Rcore, Rtotal, A, gap_m } = this.magneticReluctance();
    const N = this.N;
    const mmf = N * I;
    const phi = mmf / Rtotal;
    const Wgap = 0.5 * phi * phi * Rgap;
    const F = Wgap / gap_m;
    return { F, phi, mmf, Rgap, Rcore, Rtotal, A, gap_m };
  }
  force_empirical(I) {
    const g = Math.max(this.gap * 1e-3, 1e-6);
    const A = this.area * 1e-6;
    const a = A * 2e-6;
    const b = 1e-2 * A;
    return a * I * I / g + b * I;
  }
}

class TripCalculator {
  constructor(em, spring) { this.em = em; this.spring = spring; }
  forceCurve(Imax = 2000, step = 10) {
    const arr = [];
    for (let I = 0; I <= Imax; I += step) {
      const f1 = this.em.force_simple(I);
      const f2 = this.em.force_energy(I).F;
      const f3 = this.em.force_empirical(I);
      arr.push({ I, F1: f1, F2: f2, F3: f3 });
    }
    return arr;
  }
  findTripCurrent(method = 'simple', Imin = 0, Imax = 5000, tol = 0.5) {
    const Fs = this.spring.maxForce();
    let lo = Imin, hi = Imax;
    const testF = (I) => (method === 'energy' ? this.em.force_energy(I).F : (method === 'empirical' ? this.em.force_empirical(I) : this.em.force_simple(I)));
    if (testF(hi) < Fs) return null;
    for (let iter = 0; iter < 40; iter++) {
      const mid = (lo + hi) / 2;
      const fm = testF(mid);
      if (Math.abs(fm - Fs) <= tol) return Math.round(mid);
      if (fm < Fs) lo = mid; else hi = mid;
    }
    return Math.round((lo + hi) / 2);
  }
}

// UI glue
document.addEventListener('DOMContentLoaded', () => {
  // elements
  const els = {
    iRange: document.getElementById('iRange'), iNumber: document.getElementById('iNumber'),
    area: document.getElementById('area'), gap: document.getElementById('gap'), turns: document.getElementById('turns'),
    stroke: document.getElementById('stroke'), coreLen: document.getElementById('coreLen'), material: document.getElementById('material'),
    k: document.getElementById('k'), preload: document.getElementById('preload'),
    calcBtn: document.getElementById('calcBtn'), exportCsv: document.getElementById('exportCsv'), exportPng: document.getElementById('exportPng'),
    presetSelect: document.getElementById('presetSelect'), iCur: document.getElementById('iCur'), tripValues: document.getElementById('tripValues'),
    magOut: document.getElementById('magOut'), valOut: document.getElementById('valOut'), vis: document.getElementById('vis'),
    savePreset: document.getElementById('savePreset'), presetName: document.getElementById('presetName'), loadPresets: document.getElementById('loadPresets')
  };

  // chart
  const ctx = document.getElementById('forceChart').getContext('2d');
  const chart = new Chart(ctx, {
    type: 'line',
    data: { labels: [], datasets: [
      { label: 'Метод 1 (упр.)', data: [], borderWidth: 2, tension: 0.25, borderColor: '#7dd3fc', fill: false },
      { label: 'Метод 2 (энергия)', data: [], borderWidth: 2, tension: 0.25, borderColor: '#06b6d4', fill: false },
      { label: 'Метод 3 (эмпир.)', data: [], borderWidth: 2, tension: 0.25, borderColor: '#34d399', fill: false },
      { label: 'Сила пружины (макс)', data: [], borderWidth: 1, borderDash: [6,4], pointRadius: 0, borderColor: '#f97316', fill: false }
    ]},
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { labels: { color: '#cbd5e1' } } },
      scales: {
        x: { title: { display: true, text: 'Ток, A', color:'#cbd5e1' }, ticks:{color:'#cbd5e1'} },
        y: { title: { display: true, text: 'Сила, Н', color:'#cbd5e1' }, ticks:{color:'#cbd5e1'}, beginAtZero:true }
      }
    }
  });

  // tooltip simple
  const tooltipEl = document.getElementById('tooltip');
  document.querySelectorAll('[data-tip]').forEach(el => {
    el.addEventListener('mouseenter', (e) => { tooltipEl.style.display = 'block'; tooltipEl.textContent = el.getAttribute('data-tip'); });
    el.addEventListener('mousemove', (e) => { tooltipEl.style.left = (e.pageX) + 'px'; tooltipEl.style.top = (e.pageY - 24) + 'px'; });
    el.addEventListener('mouseleave', () => { tooltipEl.style.display = 'none'; });
  });

  // modal
  const modal = document.getElementById('modal');
  const modalContent = document.getElementById('modalContent');
  document.getElementById('helpBtn').addEventListener('click', () => {
    modal.classList.add('open');
    modalContent.innerHTML = getHelpHtml();
  });
  document.getElementById('modalClose').addEventListener('click', () => modal.classList.remove('open'));

  // sync range/number
  els.iRange.addEventListener('input', ()=> { els.iNumber.value = els.iRange.value; if (auto) run(); });
  els.iNumber.addEventListener('change', ()=> { els.iRange.value = els.iNumber.value; if (auto) run(); });

  // auto toggle
  let auto = false;
  document.getElementById('autoBtn').addEventListener('click', (e) => { auto = !auto; e.target.textContent = auto ? 'Авто ✔' : 'Авто'; if (auto) run(); });

  // helpers
  function readInputs() {
    const N = +document.getElementById('turns').value;
    const area = +document.getElementById('area').value;
    const gap = +document.getElementById('gap').value;
    const coreLen = +document.getElementById('coreLen').value;
    const stroke = +document.getElementById('stroke').value;
    const k = +document.getElementById('k').value;
    const preload = +document.getElementById('preload').value;
    const material = document.getElementById('material').value;
    const I = +document.getElementById('iNumber').value;
    return { N, area, gap, coreLen, stroke, k, preload, material, I };
  }

  // presets
  function applyPreset(name) {
    if (name === 'soviet') {
      document.getElementById('turns').value = 1;
      document.getElementById('area').value = 300;
      document.getElementById('gap').value = 0.5;
      document.getElementById('coreLen').value = 60;
      document.getElementById('k').value = 20000;
      document.getElementById('preload').value = 100;
      document.getElementById('material').value = 'steel';
    } else if (name === 'modern') {
      document.getElementById('turns').value = 20;
      document.getElementById('area').value = 80;
      document.getElementById('gap').value = 0.3;
      document.getElementById('coreLen').value = 40;
      document.getElementById('k').value = 30000;
      document.getElementById('preload').value = 50;
      document.getElementById('material').value = 'iron';
    } else if (name === 'high_gap') {
      document.getElementById('turns').value = 5;
      document.getElementById('area').value = 100;
      document.getElementById('gap').value = 2;
      document.getElementById('coreLen').value = 80;
      document.getElementById('k').value = 20000;
      document.getElementById('preload').value = 150;
      document.getElementById('material').value = 'steel';
    }
  }

  document.getElementById('presetSelect').addEventListener('change', (e)=> {
    if (e.target.value !== 'custom') { applyPreset(e.target.value); run(); }
  });

  // run calculation and update UI
  function run() {
    const { N, area, gap, coreLen, stroke, k, preload, material, I } = readInputs();
    document.getElementById('iCur').textContent = `${I} A`;

    const em = new Electromagnet({ turns: N, area_mm2: area, gap_mm: gap, coreLength_mm: coreLen, material });
    const spring = new Spring(k, preload, stroke / 1000);
    const calc = new TripCalculator(em, spring);

    // point values
    const f1 = em.force_simple(I);
    const e2 = em.force_energy(I);
    const f2 = e2.F;
    const f3 = em.force_empirical(I);

    document.getElementById('valOut').textContent = `F1 (упр.) = ${f1.toFixed(4)} N
F2 (энергия) = ${f2.toFixed(4)} N
F3 (эмпир.) = ${f3.toFixed(4)} N
Сила пружины (макс) = ${spring.maxForce().toFixed(4)} N`;

    // magnetic chain
    const mr = em.magneticReluctance();
    document.getElementById('magOut').textContent = `mu_r=${mr.mu_r}
A=${(mr.A).toExponential(3)} m^2
Rgap=${mr.Rgap.toExponential(3)}
Rcore=${mr.Rcore.toExponential(3)}
Rtotal=${mr.Rtotal.toExponential(3)}
mmf (N*I)=${(em.N * I).toFixed(1)} A-turns
phi=${(e2.phi).toExponential(3)}`;

    // curves
    const Imax = Math.max(1000, I * 2);
    const step = Math.max(5, Math.round(Imax / 200));
    const curves = calc.forceCurve(Imax, step);
    const labels = curves.map(p => p.I);
    chart.data.labels = labels;
    chart.data.datasets[0].data = curves.map(p => p.F1);
    chart.data.datasets[1].data = curves.map(p => p.F2);
    chart.data.datasets[2].data = curves.map(p => p.F3);
    chart.data.datasets[3].data = labels.map(() => spring.maxForce());
    chart.update();

    // trip currents
    const t1 = calc.findTripCurrent('simple', 0, 10000, 0.5);
    const t2 = calc.findTripCurrent('energy', 0, 10000, 0.5);
    const t3 = calc.findTripCurrent('empirical', 0, 10000, 0.5);
    document.getElementById('tripValues').textContent = `${t1 ?? '-'} / ${t2 ?? '-'} / ${t3 ?? '-'} A`;

    // update diagram gap
    updateVis(gap);
  }

  function updateVis(gap_mm) {
    const gEl = document.getElementById('gapRect');
    const w = Math.max(4, Math.min(80, (gap_mm / 5) * 60 + 4));
    gEl.setAttribute('width', w);
  }

  // CSV export
  function exportCSV() {
    const { N, area, gap, coreLen, stroke, k, preload, material, I } = readInputs();
    const em = new Electromagnet({ turns: N, area_mm2: area, gap_mm: gap, coreLength_mm: coreLen, material });
    const spring = new Spring(k, preload, stroke / 1000);
    const Imax = Math.max(1000, I * 2);
    const step = Math.max(1, Math.round(Imax / 200));
    const rows = ['I;F1;F2;F3;SpringMax'];
    for (let cur = 0; cur <= Imax; cur += step) {
      const f1 = em.force_simple(cur);
      const f2 = em.force_energy(cur).F;
      const f3 = em.force_empirical(cur);
      rows.push([cur, f1.toFixed(6), f2.toFixed(6), f3.toFixed(6), spring.maxForce().toFixed(6)].join(';'));
    }
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'em_trip_export.csv'; a.click(); URL.revokeObjectURL(url);
  }

  // PNG export
  function exportPNG() {
    const canvas = document.getElementById('forceChart');
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    const a = document.createElement('a'); a.href = dataUrl; a.download = 'em_trip_chart.png'; a.click();
  }

  // localStorage presets
  function savePreset() {
    const name = (document.getElementById('presetName').value || '').trim();
    if (!name) { alert('Введите имя пресета.'); return; }
    const p = readInputs();
    localStorage.setItem('em_preset_' + name, JSON.stringify(p));
    alert('Пресет сохранён: ' + name);
  }
  function managePresets() {
    // show simple list in modal
    const keys = Object.keys(localStorage).filter(k => k.startsWith('em_preset_'));
    let html = '<h2>Управление пресетами</h2>';
    if (keys.length === 0) html += '<p class="muted">Нет сохранённых пресетов.</p>';
    else {
      html += '<ul>';
      keys.forEach(k => {
        const name = k.replace('em_preset_', '');
        html += `<li><b>${name}</b> — <button data-load="${name}">Загрузить</button> <button data-del="${name}">Удалить</button></li>`;
      });
      html += '</ul>';
    }
    html += '<div style="margin-top:12px"><button id="modalCloseBtn">Закрыть</button></div>';
    modal.classList.add('open'); modalContent.innerHTML = html;

    modalContent.querySelectorAll('[data-load]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-load');
        const raw = localStorage.getItem('em_preset_' + name);
        if (raw) {
          const p = JSON.parse(raw);
          Object.keys(p).forEach(k => { const el = document.getElementById(k); if (el) el.value = p[k]; });
          modal.classList.remove('open');
          run();
        }
      });
    });
    modalContent.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const name = e.target.getAttribute('data-del');
        if (confirm('Удалить пресет ' + name + '?')) {
          localStorage.removeItem('em_preset_' + name);
          managePresets();
        }
      });
    });
    document.getElementById('modalCloseBtn').addEventListener('click', () => modal.classList.remove('open'));
  }

  // bind events
  document.getElementById('calcBtn').addEventListener('click', run);
  document.getElementById('exportCsv').addEventListener('click', exportCSV);
  document.getElementById('exportPng').addEventListener('click', exportPNG);
  document.getElementById('savePreset').addEventListener('click', savePreset);
  document.getElementById('loadPresets').addEventListener('click', managePresets);

  // theme button (simple toggle)
  document.getElementById('themeBtn').addEventListener('click', () => {
    const root = document.documentElement;
    const cur = getComputedStyle(root).getPropertyValue('--panel').trim();
    if (cur === '#0b1220' || cur === '') {
      // light-ish
      root.style.setProperty('--panel', '#f6fafc');
      root.style.setProperty('--card', '#ffffff');
      root.style.setProperty('--text', '#0b1220');
      root.style.setProperty('--muted', '#4b5563');
      root.style.setProperty('--accent', '#0ea5a4');
      document.body.style.color = '#0b1220';
    } else {
      // dark
      root.style.setProperty('--panel', '#0b1220');
      root.style.setProperty('--card', '#0f2030');
      root.style.setProperty('--text', '#e6eef6');
      root.style.setProperty('--muted', '#9aaec0');
      root.style.setProperty('--accent', '#06b6d4');
      document.body.style.color = '';
    }
  });

  // small helpers
  function getHelpHtml() {
    return `
      <h2>Как пользоваться</h2>
      <ol>
        <li>Выбери пресет или введи свои параметры (N, зазор, сечение, пружина).</li>
        <li>Нажми «Рассчитать» или включи «Авто» — график нарисуется автоматически.</li>
        <li>Смотри три кривые: если сила > сила пружины — якорь сработает.</li>
        <li>Сохрани пресет, если хочешь быстро вернуть набор параметров.</li>
        <li>Экспортируй кривые в CSV или картинку графика для отчёта.</li>
      </ol>
      <p class="muted">Подсказка: начинай с пресета Soviet-style и постепенно меняй только одно значение — наблюдай, как меняется ток срабатывания.</p>
    `;
  }

  // init default
  applyPreset('soviet'); run();

  // close modal by background click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.classList.remove('open');
  });

  // expose run for console if needed
  window.emTripRun = run;
});
