// The streamer's Pro Clubs teams and their kits. Shared by the server (team names, !join words)
// and the overlay (3D player kits). ui = the colour used for the team in 2D graphics.
(function (root) {
  const KITS = [
    { id: 'pogsinnet', name: 'Pogs in Net', words: ['net', 'pin', 'pogsinnet'], ui: '#9b4dff',
      shirt: { base: '#121016', alt: '#8b3dff', trim: '#b57bff', pattern: 'slash', text: '#ffffff' }, shorts: { base: '#141217', trim: '#8b3dff' }, socks: { base: '#141217', band: '#8b3dff' } },
    { id: 'pogsonwing', name: 'Pogs on Wing', words: ['wing', 'pow', 'pogsonwing'], ui: '#6cc4ff',
      shirt: { base: '#8fd0ff', alt: '#ffffff', trim: '#1d4fa8', pattern: 'brush', text: '#0d2a66' }, shorts: { base: '#132a5e', trim: '#8fd0ff' }, socks: { base: '#f4f7fb', band: '#132a5e' } },
    { id: 'allireland', name: 'All Ireland', words: ['ireland', 'ai', 'allireland'], ui: '#16a34a',
      shirt: { base: '#0f6b34', alt: '#13823f', trim: '#ff8a1c', pattern: 'tricolour', text: '#ffffff' }, shorts: { base: '#f4f4f2', trim: '#0f6b34' }, socks: { base: '#0f6b34', band: '#ff8a1c' } },
    { id: 'bosshausens', name: 'The Bosshausens', words: ['boss', 'bosshausens'], ui: '#d4a537',
      shirt: { base: '#0f0e0c', alt: '#c9a24a', trim: '#d9b45a', pattern: 'pinstripe', text: '#e6c46a' }, shorts: { base: '#100f0d', trim: '#c9a24a' }, socks: { base: '#100f0d', band: '#c9a24a' } },
    { id: 'danhausens', name: 'The Danhausens', words: ['dan', 'danhausens'], ui: '#e3132c',
      shirt: { base: '#151112', alt: '#d6121f', trim: '#ff2a36', pattern: 'slash', text: '#ffffff' }, shorts: { base: '#151112', trim: '#d6121f' }, socks: { base: '#151112', band: '#d6121f' } },
    { id: 'mresports', name: 'Mr Esports', words: ['esports', 'mre', 'mresports'], ui: '#22d3ee',
      shirt: { base: '#120f24', alt: '#22d3ee', trim: '#8b5cf6', pattern: 'circuit', text: '#ffffff' }, shorts: { base: '#121019', trim: '#22d3ee' }, socks: { base: '#121019', band: '#22d3ee' } },
    { id: '1916rising', name: '1916 Rising', words: ['rising', '1916'], ui: '#ff8a1c',
      shirt: { base: '#0d5a2c', alt: '#0a4623', trim: '#ff8a1c', pattern: 'gpo', text: '#ffffff' }, shorts: { base: '#f4f4f2', trim: '#ff8a1c' }, socks: { base: '#0d5a2c', band: '#ff8a1c' } },
    { id: 'elitehausens', name: 'The Elitehausens', words: ['elite', 'elitehausens'], ui: '#f3e3b0',
      shirt: { base: '#f6f4ee', alt: '#c9a24a', trim: '#c9a24a', pattern: 'chevron', text: '#1a1a1a' }, shorts: { base: '#f6f4ee', trim: '#c9a24a' }, socks: { base: '#f6f4ee', band: '#c9a24a' } },
    { id: 'diamonddogs', name: 'The Diamond Dogs', words: ['dogs', 'diamond', 'dd'], ui: '#2f7bff',
      shirt: { base: '#0f1219', alt: '#2f6fe0', trim: '#4d8dff', pattern: 'argyle', text: '#ffffff' }, shorts: { base: '#10131a', trim: '#2f6fe0' }, socks: { base: '#10131a', band: '#2f6fe0' } },
    { id: 'passtheball', name: 'PasstheBall UTD', words: ['ptb', 'passtheball', 'utd'], ui: '#ffd400',
      shirt: { base: '#ffd21a', alt: '#1f4fbf', trim: '#1f4fbf', pattern: 'stripes', text: '#ffffff' }, shorts: { base: '#1f4fbf', trim: '#ffd21a' }, socks: { base: '#1f4fbf', band: '#ffd21a' } },
    { id: 'liquidsnakers', name: 'Liquid Snakers', words: ['snakers', 'liquid', 'ls'], ui: '#14b8a6',
      shirt: { base: '#0c1513', alt: '#14b8a6', trim: '#2ee6cf', pattern: 'waves', text: '#ffffff' }, shorts: { base: '#0d1413', trim: '#14b8a6' }, socks: { base: '#0d1413', band: '#14b8a6' } },
    { id: 'belfastocelots', name: 'Belfast Ocelots', words: ['ocelots', 'belfast', 'bo'], ui: '#ff9500',
      shirt: { base: '#141210', alt: '#ff9a1a', trim: '#ffb347', pattern: 'tiger', text: '#ffa62b' }, shorts: { base: '#141210', trim: '#ff9a1a' }, socks: { base: '#141210', band: '#ff9a1a' } },
  ];
  // keepers and the platform-war sides
  const EXTRA = {
    keeper: { id: 'keeper', name: 'AI Keeper', ui: '#c6ff1a', shirt: { base: '#c6ff1a', alt: '#8fbf00', trim: '#1a1a1a', pattern: 'plain', text: '#1a1a1a' }, shorts: { base: '#1a1a1a', trim: '#c6ff1a' }, socks: { base: '#1a1a1a', band: '#c6ff1a' } },
    keeper2: { id: 'keeper2', name: 'AI Keeper', ui: '#ff5fa2', shirt: { base: '#ff5fa2', alt: '#d6337a', trim: '#1a1a1a', pattern: 'plain', text: '#1a1a1a' }, shorts: { base: '#1a1a1a', trim: '#ff5fa2' }, socks: { base: '#1a1a1a', band: '#ff5fa2' } },
    twitch: { id: 'twitch', name: 'Twitch', ui: '#9146ff', shirt: { base: '#9146ff', alt: '#772ce8', trim: '#ffffff', pattern: 'plain', text: '#ffffff' }, shorts: { base: '#1f1a2e', trim: '#9146ff' }, socks: { base: '#9146ff', band: '#ffffff' } },
    kick: { id: 'kick', name: 'Kick', ui: '#53fc18', shirt: { base: '#53fc18', alt: '#3ccf0b', trim: '#0b0e0f', pattern: 'plain', text: '#0b0e0f' }, shorts: { base: '#0b0e0f', trim: '#53fc18' }, socks: { base: '#0b0e0f', band: '#53fc18' } },
    youtube: { id: 'youtube', name: 'YouTube', ui: '#ff2d2d', shirt: { base: '#ff2d2d', alt: '#cc0000', trim: '#ffffff', pattern: 'plain', text: '#ffffff' }, shorts: { base: '#ffffff', trim: '#ff2d2d' }, socks: { base: '#ff2d2d', band: '#ffffff' } },
  };
  const all = () => KITS.concat(Object.values(EXTRA));
  const byId = (id) => all().find((k) => k.id === id) || null;
  // match a typed club name ("Bosshausens", "diamond dogs") to a kit
  const find = (txt) => {
    const t = String(txt || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    if (!t) return null;
    return KITS.find((k) => k.id === t || k.name.toLowerCase().replace(/[^a-z0-9]/g, '') === t || k.name.toLowerCase().replace(/^the\s+/, '').replace(/[^a-z0-9]/g, '') === t || k.words.includes(t)) || null;
  };
  const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const near = (a, b) => { const x = hex(a.ui), y = hex(b.ui); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 110; };
  // two different clubs whose colours are easy to tell apart
  const pair = (rnd) => {
    rnd = rnd || Math.random;
    for (let i = 0; i < 50; i++) { const a = KITS[Math.floor(rnd() * KITS.length)], b = KITS[Math.floor(rnd() * KITS.length)]; if (a !== b && !near(a, b)) return [a, b]; }
    return [KITS[3], KITS[8]];
  };
  const api = { KITS, EXTRA, all, byId, find, pair, near };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.KITS = api;
})(this);
