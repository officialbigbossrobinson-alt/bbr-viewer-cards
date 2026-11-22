// High-resolution textures painted at load time (no downloads needed).
// Drop your own images into the "textures" folder to replace them:
//   grass.jpg  crowd.jpg  crowd2.jpg (second crowd frame, optional)  sky.jpg   (.png / .webp also work)
window.TEX = (function () {
  const cache = {};
  let custom = {};
  const ready = fetch('/api/textures').then((r) => r.json()).then((list) => {
    for (const f of list || []) { const n = f.replace(/\.[^.]+$/, '').toLowerCase(); custom[n] = '/textures/' + encodeURIComponent(f); }
  }).catch(() => {});

  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return [c, c.getContext('2d')]; }
  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

  // seamless grass detail tile: noise, blades, clumps
  function grass() {
    if (cache.grass) return cache.grass;
    if (custom.grass) return (cache.grass = 'url(' + custom.grass + ')');
    const N = 1024, [c, g] = canvas(N, N), r = rng(7);
    g.fillStyle = '#2f7d3b'; g.fillRect(0, 0, N, N);
    const img = g.getImageData(0, 0, N, N), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const n = (r() - 0.5) * 34;
      d[i] = Math.max(0, d[i] + n * 0.5); d[i + 1] = Math.max(0, d[i + 1] + n); d[i + 2] = Math.max(0, d[i + 2] + n * 0.4);
    }
    g.putImageData(img, 0, 0);
    // soft clumps
    for (let i = 0; i < 260; i++) {
      const x = r() * N, y = r() * N, rad = 20 + r() * 70, lt = r() < 0.5;
      for (const ox of [-N, 0, N]) for (const oy of [-N, 0, N]) {
        const gr = g.createRadialGradient(x + ox, y + oy, 0, x + ox, y + oy, rad);
        gr.addColorStop(0, lt ? 'rgba(120,190,90,.10)' : 'rgba(10,40,15,.12)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = gr; g.fillRect(x + ox - rad, y + oy - rad, rad * 2, rad * 2);
      }
    }
    // blades
    for (let i = 0; i < 26000; i++) {
      const x = r() * N, y = r() * N, len = 3 + r() * 7, a = -Math.PI / 2 + (r() - 0.5) * 0.9;
      const k = 70 + r() * 90 | 0;
      g.strokeStyle = 'rgba(' + (k * 0.45 | 0) + ',' + (k + 40) + ',' + (k * 0.35 | 0) + ',' + (0.25 + r() * 0.35) + ')';
      g.lineWidth = 0.6 + r() * 0.8;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len); g.stroke();
    }
    return (cache.grass = 'url(' + c.toDataURL('image/jpeg', 0.9) + ')');
  }

  // a stand full of fans. frame 1 = some jump / raise scarves
  function crowd(frame, accent) {
    const key = 'crowd' + frame;
    if (cache[key]) return cache[key];
    const cu = frame ? (custom.crowd2 || custom.crowd) : custom.crowd;
    if (cu) return (cache[key] = 'url(' + cu + ')');
    const [c, g] = canvas(2048, 1024), W = 1024, H = 512, r = rng(11);
    g.scale(2, 2);
    const shirts = ['#9a1b26', '#a8202b', '#1a1c20', '#202328', '#17191d', '#cfd0cc', '#2b4572', '#b8973a', '#383b42', '#5c2430', '#4a4e56', '#8f3e1f', '#2c5442', '#6e7279', accent || '#3dff9a'];
    const skins = ['#f1c7a5', '#e0ac85', '#c68863', '#8d5a3b', '#5e3a24', '#f6d3b8'];
    const hairs = ['#16110d', '#2d1d12', '#5a3a1f', '#a77b45', '#d8c08a', '#3a3a3a', '#111'];
    // seat rows
    const rowH = 31;
    for (let y = 0; y < H; y += rowH) {
      g.fillStyle = '#151a22'; g.fillRect(0, y, W, rowH);
      g.fillStyle = '#0c0f14'; g.fillRect(0, y + rowH - 6, W, 6);
      g.fillStyle = '#2a3140'; g.fillRect(0, y + rowH - 7, W, 1);
    }
    const r2 = rng(99); // same fans in both frames
    for (let y = 8; y < H + 20; y += rowH) {
      let x = -10 + r2() * 10;
      while (x < W + 10) {
        const empty = r2() < 0.04;
        const shirt = shirts[(r2() * shirts.length) | 0], skin = skins[(r2() * skins.length) | 0], hair = hairs[(r2() * hairs.length) | 0];
        const jumper = r2() < 0.45, scarf = r2() < 0.18, phone = r2() < 0.03, cap = r2() < 0.12;
        const w = 15 + r2() * 5, bob = frame && jumper ? -5 - r2() * 3 : 0;
        const arms = scarf || (frame && jumper && r2() < 0.6);
        const sc1 = shirts[(r2() * 4) | 0], sc2 = r2() < 0.5 ? '#f1f1f1' : '#111316';
        if (!empty) {
          const by = y + bob;
          // body (each fan lit a little differently)
          g.fillStyle = shirt; roundRect(g, x, by + 10, w, 24, 5); g.fill();
          g.fillStyle = 'rgba(0,0,0,' + (r2() * 0.35).toFixed(2) + ')'; roundRect(g, x, by + 10, w, 24, 5); g.fill();
          g.fillStyle = 'rgba(255,255,255,.07)'; g.fillRect(x + 2, by + 11, w * 0.3, 20);
          g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(x + w * 0.62, by + 12, w * 0.38, 22);
          // arms up with scarf
          if (arms) {
            g.strokeStyle = shirt; g.lineWidth = 4; g.lineCap = 'round';
            const up = frame ? 14 : 9;
            g.beginPath(); g.moveTo(x + 2, by + 14); g.lineTo(x - 2, by - up); g.moveTo(x + w - 2, by + 14); g.lineTo(x + w + 2, by - up); g.stroke();
            if (scarf) {
              for (let k = 0; k < 6; k++) { g.fillStyle = k % 2 ? sc1 : sc2; g.fillRect(x - 3 + k * ((w + 6) / 6), by - up - 6, (w + 6) / 6 + 0.5, 6); }
            }
          }
          // head
          g.fillStyle = skin; g.beginPath(); g.arc(x + w / 2, by + 5, 6.2, 0, Math.PI * 2); g.fill();
          g.fillStyle = hair; g.beginPath(); g.arc(x + w / 2, by + 3.5, 6.3, Math.PI, Math.PI * 2); g.fill();
          if (cap) { g.fillStyle = shirts[(r2() * shirts.length) | 0]; g.fillRect(x + w / 2 - 7, by - 2, 14, 4); }
          if (phone) { g.fillStyle = '#fff'; g.shadowColor = '#fff'; g.shadowBlur = 8; g.fillRect(x + w - 2, by - 4, 4, 6); g.shadowBlur = 0; }
        }
        x += w + 3 + r2() * 4;
      }
    }
    // light falloff: brighter at the front rows, slight haze
    const fall = g.createLinearGradient(0, 0, 0, H);
    fall.addColorStop(0, 'rgba(4,6,10,.55)'); fall.addColorStop(0.6, 'rgba(4,6,10,.25)'); fall.addColorStop(1, 'rgba(4,6,10,.12)');
    g.fillStyle = fall; g.fillRect(0, 0, W, H);
    return (cache[key] = 'url(' + c.toDataURL('image/jpeg', 0.88) + ')');
  }
  function roundRect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }

  // night sky with stadium glow
  function sky() {
    if (cache.sky) return cache.sky;
    if (custom.sky) return (cache.sky = 'url(' + custom.sky + ') center/cover');
    return (cache.sky = 'radial-gradient(ellipse at 50% 100%,#3a4f72 0%,#1a2742 35%,#0a1020 70%,#05070d 100%)');
  }

  // film grain tile
  function grain() {
    if (cache.grain) return cache.grain;
    const N = 256, [c, g] = canvas(N, N), img = g.createImageData(N, N), d = img.data, r = rng(3);
    for (let i = 0; i < d.length; i += 4) { const v = r() * 255 | 0; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
    g.putImageData(img, 0, 0);
    return (cache.grain = 'url(' + c.toDataURL('image/png') + ')');
  }

  return { ready, grass, crowd, sky, grain };
})();
