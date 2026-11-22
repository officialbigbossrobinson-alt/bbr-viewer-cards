// Move plugin (by Exeldro) for OBS: the app finds your Move filters and switches them on when things happen.
// In OBS set the Move filter's start trigger to "Enable"; switching the filter on plays the move.
const EVENTS = {
  goal: 'Goal (Sports News, Goal cam, or a WIN result)', battleStart: 'Battle starts', battleEnd: 'Battle ends', giftbomb: 'Gift bomb (5+ subs)',
  raid: 'Someone raids you', tierup: 'A card tiers up', briefing: 'Raid Night briefing', raidWin: 'Raid Night won', raidLoss: 'Raid Night lost',
  challengeDone: 'Challenge complete', win: 'Result logged: win', loss: 'Result logged: loss', checkins: 'Check-in wave', hype: 'Hype meter full', panic: 'Panic button'
};
class Move {
  constructor(o) { Object.assign(this, o); this.last = {}; }   // obs, cfg, saveCfg, log
  binds() { const c = this.cfg(); if (!c.moveBinds) c.moveBinds = {}; return c.moveBinds; }
  replacesCorner() { return !!(this.cfg().moveCorner && this.binds().battleStart); }
  // every filter on the scene on air, its scenes and sources, that looks like a Move filter
  async list() {
    if (!this.obs.ready) return { error: 'OBS is not connected', filters: [] };
    const { scenes } = await this.obs.req('GetSceneList');
    const names = new Set((scenes || []).map((s) => s.sceneName));
    for (const s of scenes || []) { try { const { sceneItems } = await this.obs.req('GetSceneItemList', { sceneName: s.sceneName }); for (const it of sceneItems || []) names.add(it.sourceName); } catch (e) { /* skip */ } }
    const out = [];
    for (const n of names) {
      try {
        const { filters } = await this.obs.req('GetSourceFilterList', { sourceName: n });
        for (const f of filters || []) if (/move/i.test(f.filterKind || '') || /^move/i.test(f.filterName)) out.push({ source: n, filter: f.filterName, kind: f.filterKind, enabled: f.filterEnabled });
      } catch (e) { /* not a source with filters */ }
    }
    return { filters: out };
  }
  async play(source, filter) {
    await this.obs.req('SetSourceFilterEnabled', { sourceName: source, filterName: filter, filterEnabled: false }).catch(() => {});
    await new Promise((r) => setTimeout(r, 60));
    await this.obs.req('SetSourceFilterEnabled', { sourceName: source, filterName: filter, filterEnabled: true });
  }
  // something happened on stream
  fire(ev) {
    const b = this.binds()[ev]; if (!b || !this.obs.ready) return;
    if (Date.now() - (this.last[ev] || 0) < 1500) return;   // don't double-fire
    this.last[ev] = Date.now();
    this.play(b.source, b.filter).catch((e) => this.log('[move] ' + e.message));
  }
  set(ev, bind) {
    if (!EVENTS[ev]) return;
    const B = this.binds();
    if (!bind || !bind.filter) delete B[ev]; else B[ev] = { source: String(bind.source).slice(0, 120), filter: String(bind.filter).slice(0, 120) };
    this.saveCfg();
  }
}
module.exports = { Move, EVENTS };
