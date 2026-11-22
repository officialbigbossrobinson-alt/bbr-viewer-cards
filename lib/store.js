// Saves every viewer's raw activity to data/viewers.json.
// Linked accounts: when someone links e.g. their Kick account to their Twitch card, the Kick
// record becomes an "alias" ({ aliasOf: 'twitch:name' }) and all its activity goes to the main card.
const fs = require('fs');
const path = require('path');

class Store {
  constructor(file) {
    this.file = file;
    this.data = { viewers: {} };
    try { this.data = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { /* first run */ }
    if (!this.data.viewers) this.data.viewers = {};
    this.timer = null;
  }

  // follows aliases to the main card
  primary(v) {
    let n = 0;
    while (v && v.aliasOf && n++ < 5) v = this.data.viewers[v.aliasOf];
    return v || null;
  }

  upsert(platform, login, display) {
    const lc = String(login).toLowerCase();
    const key = platform + ':' + lc;
    // chat bots never get a card: hand back a throwaway that is never saved
    if (this.isBot && this.isBot(lc)) return { v: { key, platform, login: lc, display: display || login, bot: true, firstSeen: Date.now(), bonus: {}, xp: {}, bank: {}, manual: {} }, isNew: false, bot: true };
    let v = this.data.viewers[key];
    let isNew = false;
    if (v && v.aliasOf) {
      if (display) v.display = display;
      const p = this.primary(v);
      if (p) { this.save(); return { v: p, isNew: false, via: v }; }
      delete v.aliasOf; // broken link: treat as its own card again
    }
    if (!v) {
      v = this.data.viewers[key] = {
        key, platform, login: lc, display: display || login, firstSeen: Date.now(),
        followedAt: null, watchMinutes: 0, subMonths: 0, giftedSubs: 0, bits: 0,
        messages: 0, streams: 0, lastStream: null, raids: 0
      };
      isNew = true;
    } else if (display) {
      v.display = display;
    }
    this.save();
    return { v, isNew };
  }

  // raw record (may be an alias)
  getRaw(platform, login) { return this.data.viewers[platform + ':' + String(login).toLowerCase()]; }
  // main card for this account
  get(platform, login) { return this.primary(this.getRaw(platform, login)); }
  resolveKey(platform, login) { const v = this.get(platform, login); return v ? v.key : platform + ':' + String(login).toLowerCase(); }
  // main cards only (no aliases)
  all() { return Object.values(this.data.viewers).filter((v) => !v.aliasOf); }
  aliases() { return Object.values(this.data.viewers).filter((v) => v.aliasOf); }
  remove(key) {
    for (const a of this.aliases()) if (a.aliasOf === key) delete this.data.viewers[a.key];
    delete this.data.viewers[key];
    this.save();
  }

  save() {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.flush(), 1500);
  }

  flush() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }
}

module.exports = Store;
