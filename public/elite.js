// v43 Elite Playoffs: the gold laurel crest (original artwork) and the playoff tracker plate, shared by the overlay,
// Starting Soon, BRB and the dock. BBR_CREST(size) → an <svg>; BBR_TRACKER(state, opts) → the plate's HTML.
(function () {
  'use strict';
  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let n = 0;
  function crest(size, label) {
    const id = 'elg' + (++n), s = size || 96;
    // a laurel branch: leaves along an arc, mirrored for the other side
    const leaves = (side) => {
      let out = '';
      for (let i = 0; i < 7; i++) {
        const a = (200 + i * 17) * Math.PI / 180, r = 38, cx = 50 + Math.cos(a) * r * side * -1, cy = 54 + Math.sin(a) * r * -1;
        const rot = (side === 1 ? -1 : 1) * (i * 17 + 20);
        out += '<ellipse cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" rx="3.6" ry="8.2" transform="rotate(' + rot + ' ' + cx.toFixed(1) + ' ' + cy.toFixed(1) + ')"/>';
      }
      return out;
    };
    return '<svg class="el-crest" width="' + s + '" height="' + s + '" viewBox="0 0 100 100" role="img" aria-label="' + esc(label || 'Elite Playoffs crest') + '">' +
      '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#8a6a24"/><stop offset=".25" stop-color="#f6e3a1"/><stop offset=".48" stop-color="#c9a24a"/><stop offset=".62" stop-color="#fff2c2"/><stop offset=".82" stop-color="#b48a33"/><stop offset="1" stop-color="#6e5219"/></linearGradient></defs>' +
      '<g fill="url(#' + id + ')">' + leaves(1) + leaves(-1) + '</g>' +
      '<path d="M50 80 C44 86 38 89 31 90 M50 80 C56 86 62 89 69 90" stroke="url(#' + id + ')" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<circle cx="50" cy="54" r="21" fill="#0b0b0c" stroke="url(#' + id + ')" stroke-width="2.6"/>' +
      '<path d="M50 39.5l3.9 8 8.8 1.2-6.4 6.1 1.6 8.7L50 59.4l-7.9 4.1 1.6-8.7-6.4-6.1 8.8-1.2z" fill="url(#' + id + ')"/>' +
      '<text x="50" y="71.5" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="7.5" letter-spacing="1.6" fill="url(#' + id + ')">ELITE</text>' +
      '<path d="M50 8l2.2 4.6 5 .7-3.6 3.5.9 5-4.5-2.4-4.5 2.4.9-5-3.6-3.5 5-.7z" fill="url(#' + id + ')"/></svg>';
  }
  // the tracker plate: crest, "ELITE PLAYOFFS · MATCH 4 OF 10", a slot per match (W / D / L / to play), what's needed
  function tracker(a, o) {
    o = o || {};
    const slots = []; for (let i = 0; i < a.matches; i++) { const e = a.list[i]; slots.push('<i class="el-s ' + (e ? 'r' + e.r : i === a.played ? 'nx' : '') + '" title="' + (e ? 'Match ' + (i + 1) + ': ' + e.r + (e.us != null ? ' ' + e.us + '-' + e.them : '') : 'Match ' + (i + 1)) + '">' + (e ? e.r : '') + '</i>'); }
    const c = a.counts;
    return '<div class="el-tr tone-' + esc(a.tone) + (o.compact ? ' compact' : '') + '">' + crest(o.compact ? 46 : 64) +
      '<div class="el-mid"><div class="el-hd"><b>' + esc(a.title) + '</b><span>' + (a.left ? 'MATCH ' + a.next + ' OF ' + a.matches : 'ALL ' + a.matches + ' PLAYED') + '</span></div>' +
      '<div class="el-slots" style="--n:' + a.matches + '">' + slots.join('') + '</div>' +
      '<div class="el-st"><span class="el-rec"><b>' + c[0] + '</b>W <b>' + c[1] + '</b>D <b>' + c[2] + '</b>L</span><em>' + esc(a.status) + '</em></div></div></div>';
  }
  const CSS = `
.el-tr{display:flex;align-items:center;gap:16px;padding:12px 20px 12px 14px;border-radius:6px;background:radial-gradient(140% 160% at 0% 0%,#1d1a14,#0b0b0c 55%,#060607);box-shadow:0 18px 40px rgba(0,0,0,.55),0 0 0 2px #050505,0 0 0 4px #D9B45A;font-family:'Barlow Condensed','Arial Narrow',sans-serif;color:#F3E7C9}
.el-tr .el-mid{display:flex;flex-direction:column;gap:7px;min-width:0}
.el-tr .el-hd{display:flex;align-items:baseline;gap:14px;white-space:nowrap}
.el-tr .el-hd b{font-size:26px;font-weight:800;letter-spacing:5px;background:linear-gradient(135deg,#8a6a24,#f6e3a1 25%,#c9a24a 48%,#fff2c2 62%,#b48a33 82%);-webkit-background-clip:text;background-clip:text;color:transparent}
.el-tr .el-hd span{font-size:20px;font-weight:700;letter-spacing:3px;color:#F3E7C9}
.el-tr .el-slots{display:grid;grid-template-columns:repeat(var(--n),26px);gap:5px}
.el-tr .el-s{height:26px;border-radius:3px;display:grid;place-items:center;font-style:normal;font-size:17px;font-weight:800;border:1px solid rgba(217,180,90,.35);color:transparent;background:rgba(255,255,255,.03)}
.el-tr .el-s.rW{background:linear-gradient(160deg,#f6e3a1,#c9a24a 55%,#8a6a24);color:#16110a;border-color:transparent}
.el-tr .el-s.rD{background:#3a3428;color:#F3E7C9;border-color:#6d6250}
.el-tr .el-s.rL{background:#1a1a1b;color:#8c8578;border-color:#3a3a3a}
.el-tr .el-s.nx{border:2px solid #D9B45A;animation:elNx 1.6s ease-in-out infinite}
@keyframes elNx{50%{box-shadow:0 0 14px rgba(217,180,90,.8)}}
.el-tr .el-st{display:flex;align-items:baseline;gap:14px;white-space:nowrap;font-size:18px;letter-spacing:2px}
.el-tr .el-rec{color:#cbbf9f}.el-tr .el-rec b{color:#F3E7C9;font-size:20px}
.el-tr .el-st em{font-style:normal;font-weight:800;color:#D9B45A}
.el-tr.tone-won .el-st em{color:#fff2c2;text-shadow:0 0 12px rgba(255,226,140,.7)}
.el-tr.tone-must .el-st em{color:#ffcf5a}
.el-tr.tone-out .el-st em{color:#9b8f78}
.el-tr.compact{gap:10px;padding:8px 12px 8px 8px}.el-tr.compact .el-hd b{font-size:19px;letter-spacing:3px}.el-tr.compact .el-hd span{font-size:15px}
.el-tr.compact .el-slots{grid-template-columns:repeat(var(--n),18px);gap:3px}.el-tr.compact .el-s{height:18px;font-size:12px}.el-tr.compact .el-st{font-size:14px}.el-tr.compact .el-rec b{font-size:15px}
`;
  function css() { if (document.getElementById('el-css')) return; const s = document.createElement('style'); s.id = 'el-css'; s.textContent = CSS; document.head.appendChild(s); }
  window.BBR_CREST = crest;
  window.BBR_TRACKER = (a, o) => { css(); return tracker(a, o); };
})();
