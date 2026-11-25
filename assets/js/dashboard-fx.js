/* DSS dashboard — hitung naik (count-up) untuk angka statistik dan KPI */
(() => {
  const root = document.getElementById('dashboardView');
  if (!root) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const sel = '.stats-grid .stat-card strong, .kpi-summary b';
  const parse = t => /^\d[\d.]*$/.test(String(t).trim()) ? Number(String(t).replace(/\./g, '')) : null;
  function run(el, to) {
    const from = Number(el.dataset.v || 0);
    el.dataset.v = to;
    if (reduce || from === to) return;
    el.dataset.busy = '1';
    const t0 = performance.now(), dur = 900;
    const step = t => {
      const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(from + (to - from) * e).toLocaleString('id-ID');
      if (p < 1) requestAnimationFrame(step); else delete el.dataset.busy;
    };
    requestAnimationFrame(step);
  }
  new MutationObserver(records => {
    const seen = new Set();
    records.forEach(r => {
      const el = r.target.nodeType === 3 ? r.target.parentElement : r.target;
      if (!el || !el.matches || !el.matches(sel) || el.dataset.busy || seen.has(el)) return;
      seen.add(el);
      const n = parse(el.textContent);
      if (n !== null) run(el, n);
    });
  }).observe(root, { childList: true, subtree: true, characterData: true });
})();
