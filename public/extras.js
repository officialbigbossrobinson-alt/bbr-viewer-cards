// v19 on-screen extras: team results, full-time card, live score bug + round-up, sub goal bar, hype border,
// game banner, featured chat message, BREAKING banner, the on-screen switches, the panic button and the layout editor.
(function () {
  const esc = (s) => BBR.esc(s);
  const css = `
  .xr,.xs,.xg{position:absolute;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;z-index:4;transition:opacity .5s;transform-origin:0 0}
  .xr{left:1320px;top:40px;display:flex;align-items:stretch;border-radius:14px;overflow:hidden;background:rgba(10,12,15,.92);border:2px solid var(--tc);box-shadow:0 10px 30px rgba(0,0,0,.45)}
  .xr .bd{display:flex;align-items:center;justify-content:center;min-width:64px;padding:0 10px;background:var(--tc);font-size:28px;font-weight:800;letter-spacing:1px;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.4)}
  .xr .mid{padding:6px 14px 6px 12px;display:flex;flex-direction:column;justify-content:center;gap:2px;min-width:0}
  .xr .nm{font-size:15px;font-weight:700;letter-spacing:3px;color:#c9d0d7;white-space:nowrap}
  .xr .ct{display:flex;gap:14px;align-items:baseline}
  .xr .ct span{display:flex;align-items:baseline;gap:4px}.xr .ct b{font-size:36px;font-weight:800;line-height:1}.xr .ct i{font-style:normal;font-size:15px;font-weight:700;letter-spacing:1px}
  .xr .fm{display:flex;gap:4px;align-items:center;padding:0 14px 0 0}.xr .fm i{width:20px;height:20px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-style:normal;font-size:13px;font-weight:800;color:#0b0d10}
  .xr .ub{position:absolute;right:8px;top:-1px;font-size:12px;font-weight:800;letter-spacing:2px;color:#3dff9a}
  .xs{left:1320px;top:140px;display:flex;align-items:center;gap:0;border-radius:10px;overflow:hidden;background:rgba(10,12,15,.92);border:1px solid rgba(255,255,255,.16);height:46px;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .xs .lv{align-self:stretch;display:flex;align-items:center;padding:0 10px;background:#e01e2e;font-size:16px;font-weight:800;letter-spacing:2px}
  .xs .lv:before{content:"";width:8px;height:8px;border-radius:50%;background:#fff;margin-right:6px;animation:xpulse 1.2s infinite}
  .xs .tm{padding:0 12px;font-size:23px;font-weight:800;white-space:nowrap}.xs .sc{padding:2px 10px;border-radius:6px;background:#f2f5f7;color:#0b0d10;font-size:24px;font-weight:800}
  .xs .mn{padding:0 12px;font-size:18px;font-weight:700;color:#3dff9a}.xs .cp{padding:0 10px 0 0;font-size:13px;letter-spacing:1px;color:#a7b0ba;white-space:nowrap;max-width:140px;overflow:hidden;text-overflow:ellipsis}
  .xs.mine{border-color:#f6d77a}.xs .in{display:flex;align-items:center;animation:xin .5s ease-out}
  @keyframes xin{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
  @keyframes xpulse{50%{opacity:.25}}
  .xg{left:650px;top:120px;width:620px;padding:6px 12px 8px;border-radius:12px;background:rgba(10,12,15,.9);border:2px solid #9146ff;box-sizing:border-box;box-shadow:0 8px 24px rgba(0,0,0,.4)}
  .xg .l{display:flex;justify-content:space-between;align-items:baseline;font-size:18px;font-weight:800;letter-spacing:2px}.xg .l b{color:#c58bff}.xg .l span:last-child{font-family:Inter,sans-serif;font-size:13px;font-weight:500;letter-spacing:0;color:#d9c9ff}
  .xg .tr{height:10px;border-radius:6px;background:rgba(255,255,255,.14);overflow:hidden;margin-top:4px}.xg .tr i{display:block;height:100%;background:linear-gradient(90deg,#7b3cf0,#c58bff);transition:width 1s cubic-bezier(.2,.9,.3,1)}
  .xg.hit{animation:xhit 1s ease-out}@keyframes xhit{30%{transform:scale(1.06)}}
  .xft{position:absolute;left:50%;top:300px;transform:translateX(-50%);z-index:12;font-family:'Barlow Condensed',sans-serif;color:#fff;text-align:center;pointer-events:none}
  .xft .k{font-size:22px;font-weight:800;letter-spacing:8px;color:#f6d77a}
  .xft .box{margin-top:8px;display:flex;align-items:center;border-radius:18px;overflow:hidden;background:rgba(10,12,15,.95);border:3px solid var(--rc);box-shadow:0 20px 70px rgba(0,0,0,.6)}
  .xft .t{padding:16px 26px;font-size:46px;font-weight:800;white-space:nowrap}.xft .t.us{background:var(--tc)}
  .xft .s{padding:0 26px;font-size:84px;font-weight:800;line-height:1}
  .xft .r{margin-top:12px;display:inline-block;padding:6px 30px;border-radius:999px;background:var(--rc);color:#0b0d10;font-size:40px;font-weight:800;letter-spacing:6px}
  .xft .rec{margin-top:10px;font-family:Inter,sans-serif;font-size:18px;color:#c9d0d7}
  .xsp{position:absolute;right:60px;top:150px;width:640px;z-index:7;border-radius:18px;overflow:hidden;background:rgba(10,12,15,.95);border:2px solid #e01e2e;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;box-shadow:0 20px 60px rgba(0,0,0,.6)}
  .xsp .h{display:flex;justify-content:space-between;align-items:center;padding:10px 18px;background:#e01e2e;font-size:26px;font-weight:800;letter-spacing:3px}.xsp .h span{font-size:15px;letter-spacing:2px}
  .xsp .row{display:grid;grid-template-columns:minmax(0,1fr) 74px minmax(0,1fr) 58px;gap:8px;align-items:center;padding:8px 18px;border-top:1px solid rgba(255,255,255,.08);font-size:24px;font-weight:700}
  .xsp .row .a{text-align:right;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xsp .row .b{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .xsp .row .sc{text-align:center;border-radius:6px;background:#f2f5f7;color:#0b0d10;font-weight:800}.xsp .row .m{text-align:right;font-size:17px;color:#3dff9a}
  .xsp .row.mine{background:rgba(246,215,122,.12)}.xsp .cp{padding:4px 18px 0;font-size:13px;letter-spacing:2px;color:#a7b0ba}
  .xhy{position:absolute;inset:0;z-index:2;pointer-events:none;border-radius:6px;box-shadow:inset 0 0 0 6px #ffb020,inset 0 0 60px 10px rgba(255,140,30,.55);animation:xhy 1.1s ease-in-out infinite;transition:opacity .8s}
  @keyframes xhy{50%{box-shadow:inset 0 0 0 8px #ff5aa0,inset 0 0 90px 18px rgba(255,90,160,.5)}}
  .xhyb{position:absolute;left:50%;top:190px;transform:translateX(-50%);z-index:13;padding:4px 22px;border-radius:999px;background:linear-gradient(90deg,#ffb020,#ff5aa0);color:#0b0d10;font-family:'Barlow Condensed',sans-serif;font-size:26px;font-weight:800;letter-spacing:6px;box-shadow:0 6px 20px rgba(255,90,160,.5)}
  .xgb{position:absolute;left:0;top:200px;z-index:9;display:flex;align-items:stretch;font-family:'Barlow Condensed',sans-serif;color:#fff;pointer-events:none}
  .xgb .k{display:flex;align-items:center;padding:0 18px 0 60px;background:var(--acc,#3dff9a);color:#06110b;font-size:22px;font-weight:800;letter-spacing:4px}
  .xgb .g{padding:10px 30px;background:rgba(10,12,15,.95);font-size:52px;font-weight:800;text-transform:uppercase;white-space:nowrap}
  .xfm{position:absolute;left:60px;bottom:190px;z-index:8;display:flex;align-items:flex-end;gap:16px;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;pointer-events:none}
  .xfm .cd{position:relative;width:130px;height:190px}.xfm .cd .m{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(.5);transform-origin:0 0}
  .xfm .bub{max-width:720px;padding:14px 22px;border-radius:20px 20px 20px 4px;background:rgba(10,12,15,.95);border:2px solid var(--pc);box-shadow:0 14px 40px rgba(0,0,0,.5);margin-bottom:20px}
  .xfm .who{font-size:19px;font-weight:800;letter-spacing:2px;color:var(--pc)}.xfm .tx{font-family:Inter,sans-serif;font-size:28px;font-weight:600;line-height:1.3;margin-top:2px;overflow-wrap:anywhere}
  .xbk{position:absolute;left:0;right:0;bottom:96px;z-index:11;display:flex;align-items:stretch;height:64px;font-family:'Barlow Condensed',sans-serif;color:#fff;pointer-events:none;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .xbk .k{display:flex;flex-direction:column;justify-content:center;padding:0 22px 0 40px;background:#c8102e;font-size:30px;font-weight:800;letter-spacing:4px;line-height:.95}.xbk .k small{font-size:14px;letter-spacing:3px;color:#ffd2d8}
  .xbk .t{flex-grow:1;display:flex;align-items:center;padding:0 24px;background:#f2f2f2;color:#0b0d10;font-size:34px;font-weight:800;white-space:nowrap;overflow:hidden}
  .xc{position:absolute;width:300px;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;z-index:4;border-radius:14px;overflow:hidden;background:rgba(10,12,15,.93);border:2px solid var(--cc);box-shadow:0 10px 30px rgba(0,0,0,.45);transform-origin:0 0;transition:opacity .5s}
  .xc .hd{display:flex;align-items:center;gap:8px;padding:5px 12px;background:var(--cc)}.xc .hd b{font-size:24px;font-weight:800;letter-spacing:2px;color:#fff;text-shadow:0 2px 3px rgba(0,0,0,.35)}
  .xc .hd svg{flex-shrink:0}.xc .wt{padding:4px 12px 0;font-size:13px;font-weight:700;letter-spacing:2px;color:#c9d0d7}
  .xc .nums{display:flex;align-items:flex-end;gap:14px;padding:0 12px}.xc .big{font-size:58px;font-weight:800;line-height:.95}.xc .nums small{display:block;font-size:12px;letter-spacing:2px;color:#a7b0ba;font-weight:700}
  .xc .ssn{font-size:26px;font-weight:800;line-height:1;margin-bottom:6px}
  .xc .gg{display:flex;gap:3px;padding:6px 12px 2px}.xc .gg i{flex:1;height:9px;border-radius:3px;background:rgba(255,255,255,.12)}.xc .gg i.on{background:var(--cc);box-shadow:0 0 8px var(--cc)}
  .xc .lv{padding:0 12px 8px;font-size:17px;font-weight:800;letter-spacing:2px;color:var(--cc)}
  .xc.hit{animation:xshake .6s}@keyframes xshake{10%,50%,90%{transform:translateX(-7px) rotate(-1deg)}30%,70%{transform:translateX(7px) rotate(1deg)}}
  .xch{position:absolute;left:50%;top:330px;transform:translateX(-50%);z-index:12;display:flex;align-items:center;gap:26px;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .xch .rc{width:120px;height:170px;border-radius:12px;background:linear-gradient(160deg,#ff4545,#b30000);box-shadow:0 20px 50px rgba(0,0,0,.6),inset 0 2px 0 rgba(255,255,255,.35);display:flex;align-items:center;justify-content:center;font-size:84px;font-weight:800}
  .xch .tx{padding:16px 26px;border-radius:16px;background:rgba(10,12,15,.95);border:3px solid var(--cc);box-shadow:0 20px 60px rgba(0,0,0,.6)}
  .xch .k{font-size:20px;font-weight:800;letter-spacing:6px;color:var(--cc)}.xch .l{font-size:58px;font-weight:800;line-height:1;white-space:nowrap}.xch .s{font-family:Inter,sans-serif;font-size:20px;color:#c9d0d7;margin-top:6px}
  .xch .up{display:inline-block;margin-top:8px;padding:4px 16px;border-radius:999px;background:var(--cc);font-size:24px;font-weight:800;letter-spacing:3px}
  #stage.no-counters .xc{display:none}
  .xchat{position:absolute;left:40px;top:660px;width:440px;height:330px;z-index:3;display:flex;flex-direction:column;justify-content:flex-end;gap:6px;pointer-events:none;transform-origin:0 0;transition:opacity .45s,translate .45s;font-family:Inter,sans-serif}
  .xchat.dodge{opacity:.12;translate:-30px 0}
  .xchat .m{display:flex;gap:8px;align-items:flex-start;padding:7px 11px;border-radius:12px;background:rgba(10,12,15,.82);border:1px solid rgba(255,255,255,.07);box-shadow:0 6px 18px rgba(0,0,0,.35);animation:xcIn .35s cubic-bezier(.2,.9,.3,1.1);transition:opacity .8s}
  .xchat .m.old{opacity:0}
  .xchat .m.first{border-color:#3dff9a;background:rgba(8,30,18,.88)}.xchat .m.boss{border-color:var(--acc,#3dff9a)}
  .xchat .pd{flex-shrink:0;width:9px;height:9px;border-radius:50%;margin-top:.45em}
  .xchat .tx{font-size:var(--fs,19px);line-height:1.32;color:#eef1f4;overflow-wrap:anywhere;font-weight:500;text-shadow:0 1px 2px rgba(0,0,0,.6)}
  .xchat .nm{font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:1.12em;letter-spacing:.5px;margin-right:6px}
  .xchat .ov{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:.8em;padding:0 5px;border-radius:4px;color:#0b0d10;margin-right:6px;vertical-align:1px}
  .xchat .tag{display:inline-block;font-family:'Barlow Condensed',sans-serif;font-weight:800;font-size:.72em;letter-spacing:1px;padding:0 5px;border-radius:4px;margin-right:6px;vertical-align:2px;background:#3dff9a;color:#06110b}
  @keyframes xcIn{from{opacity:0;transform:translateX(-24px)}to{opacity:1;transform:none}}
  #stage.no-chat .xchat{display:none}
  .xmvp{position:absolute;inset:0;z-index:14;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff;overflow:hidden}
  .xmvp .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 50%,rgba(74,58,12,.96),rgba(18,13,2,.97) 60%,rgba(5,4,3,.98))}
  .xmvp .rays{position:absolute;left:-200px;top:-500px;width:1500px;height:1500px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(246,215,122,.16) 0deg 6deg,transparent 6deg 20deg);animation:xmRay 30s linear infinite}
  @keyframes xmRay{to{transform:rotate(360deg)}}
  .xmvp .ru{position:absolute;left:50%;top:44%;transform:translate(-50%,-50%);text-align:center}
  .xmvp .ru small{display:block;font-size:26px;letter-spacing:8px;color:#e6dcc0}.xmvp .ru b{font-size:80px;color:#c9ced6}
  .xmvp .cd{position:absolute;left:190px;top:250px;width:390px;height:570px}.xmvp .cd .m{position:absolute;left:0;top:0;width:260px;height:380px;transform:scale(1.5);transform-origin:0 0}
  .xmvp .tt{position:absolute;left:690px;top:170px;display:flex;flex-direction:column;gap:6px}
  .xmvp .tt .k{font-size:34px;font-weight:700;letter-spacing:12px;color:#f6d77a}
  .xmvp .tt .n{font-size:170px;font-weight:800;line-height:.86;text-shadow:0 0 50px rgba(246,215,122,.55);white-space:nowrap}
  .xmvp .tt .n span{display:inline-block}
  .xmvp .tt .s{font-family:Inter,sans-serif;font-size:26px;color:#e6dcc0}
  .xmvp .bars{position:absolute;left:690px;top:520px;width:780px;display:flex;flex-direction:column;gap:14px}
  .xmvp .br{display:grid;grid-template-columns:190px minmax(0,1fr) 260px;gap:18px;align-items:center}
  .xmvp .br span{font-size:28px;font-weight:700;letter-spacing:4px;color:#e6dcc0}
  .xmvp .br i{display:block;height:18px;border-radius:9px;background:rgba(255,255,255,.12);overflow:hidden}.xmvp .br i u{display:block;height:100%;width:0;background:linear-gradient(90deg,#b8861f,#fff1b8);transition:width 1.2s cubic-bezier(.2,.9,.3,1)}
  .xmvp .br b{font-size:32px;text-align:right;white-space:nowrap}
  .xmvp .chip{position:absolute;left:690px;top:850px;padding:10px 28px;border-radius:999px;background:#f6d77a;color:#2a1c00;font-size:34px;font-weight:800;letter-spacing:4px}
  .xmvp .fl{position:absolute;inset:0;background:#fff;opacity:0}
  .xmvp .cf{position:absolute;width:14px;height:22px;top:-30px}
  .xmr{position:absolute;left:40px;top:230px;width:300px;z-index:4;border-radius:12px;overflow:hidden;background:rgba(10,12,15,.9);border:2px solid #f6d77a;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;transform-origin:0 0;transition:opacity .5s}
  .xmr .h{padding:4px 12px;background:#f6d77a;color:#2a1c00;font-size:17px;font-weight:800;letter-spacing:3px}
  .xmr .r{display:flex;justify-content:space-between;padding:3px 12px;font-size:21px;font-weight:700;border-top:1px solid rgba(255,255,255,.08)}.xmr .r b{color:#f6d77a}
  #stage.no-mvpRace .xmr{display:none}
  .xredf{position:absolute;inset:0;z-index:13;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .xredf .bg{position:absolute;inset:0;background:radial-gradient(ellipse at 50% 50%,rgba(255,0,0,.35),rgba(60,0,0,.8) 70%)}
  .xredf .edge{position:absolute;inset:0;box-shadow:inset 0 0 0 16px #ff2020,inset 0 0 160px 40px rgba(255,32,32,.6)}
  .xredf .card{position:absolute;left:330px;top:250px;width:340px;height:480px;border-radius:26px;background:linear-gradient(160deg,#ff4545,#b30000);box-shadow:0 50px 120px rgba(0,0,0,.7),inset 0 5px 0 rgba(255,255,255,.35);transform:rotate(-10deg)}
  .xredf .card:after{content:"";position:absolute;inset:36px;border-radius:14px;border:3px solid rgba(255,255,255,.22)}
  .xredf img.card{background:none;box-shadow:0 50px 120px rgba(0,0,0,.7);object-fit:contain}
  .xredf .tx{position:absolute;left:760px;top:200px;width:1060px;display:flex;flex-direction:column;gap:12px}
  .xredf .card.y{background:linear-gradient(160deg,#ffe24a,#e0a800);left:250px;top:210px;transform:rotate(-22deg)}
  .xredf .ban{display:flex;align-items:center;gap:14px;align-self:flex-start;white-space:nowrap;padding:12px 26px;border-radius:16px;font-size:58px;font-weight:800;line-height:1;background:#ff2020;color:#fff;box-shadow:0 10px 40px rgba(0,0,0,.5)}
  .xredf .ban.y{background:#ffd23f;color:#1a1400}
  .xredf .tb{display:flex;gap:14px;flex-wrap:wrap}.xredf .ban .mc{width:30px;height:44px}
  .xredf .tb>span{display:inline-flex;align-items:center;gap:10px;padding:8px 16px;border-radius:12px;background:rgba(10,0,0,.7);border:2px solid rgba(255,255,255,.18);font-size:34px;font-weight:800;opacity:.75}
  .xredf .tb>span.on{opacity:1;border-color:#fff;background:rgba(10,0,0,.9)}
  .mc{display:inline-block;flex-shrink:0;width:22px;height:32px;border-radius:4px;background:linear-gradient(160deg,#ff4545,#b30000);box-shadow:0 2px 6px rgba(0,0,0,.4)}.mc.y{background:linear-gradient(160deg,#ffe24a,#e0a800)}.mc+.mc{margin-left:-10px;transform:rotate(10deg)}
  .xredf .k{font-size:38px;font-weight:700;letter-spacing:14px;color:#ffb3b3}
  .xredf .t{font-size:150px;font-weight:800;line-height:.86;text-shadow:0 10px 50px rgba(0,0,0,.6)}
  .xredf .r{margin-top:10px;padding:14px 26px;border-radius:16px;background:rgba(10,0,0,.78);border:3px solid #ff3b3b;font-size:54px;font-weight:800;line-height:1.05}
  .xredf .p{font-family:Inter,sans-serif;font-size:30px;color:#ffd2d2}
  .xred{position:absolute;left:40px;top:380px;width:340px;box-sizing:border-box;z-index:4;display:flex;gap:12px;align-items:center;padding:10px 14px;border-radius:14px;background:rgba(20,0,0,.9);border:2px solid #ff3b3b;font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 0 30px rgba(255,40,40,.4);transform-origin:0 0;animation:xrPulse 2s ease-in-out infinite}
  @keyframes xrPulse{50%{box-shadow:0 0 50px rgba(255,40,40,.75)}}
  .xred .mini{flex-shrink:0;display:block;position:relative;inset:auto;margin:0 4px 0 0;width:38px;height:54px;border-radius:6px;background:linear-gradient(160deg,#ff4545,#b30000);transform:rotate(-8deg);object-fit:contain}
  .xred b{display:block;font-size:22px;letter-spacing:2px;line-height:1}.xred span{display:block;font-size:16px;color:#ffc9c9;line-height:1.15}
  #stage.no-redCard .xred,#stage.no-redCard .xredf,#stage.no-redCard .xsh{display:none}
  .xrp{position:absolute;inset:0;z-index:11;pointer-events:none;font-family:'Barlow Condensed',sans-serif;color:#fff}
  .xrp [hidden]{display:none!important}
  .xrp .edge{position:absolute;inset:0;box-shadow:inset 0 0 0 12px #061233,inset 0 0 0 15px #f6f7fa;border-top:6px solid #e3132c}
  .xrp .wall{position:absolute;inset:0;background:radial-gradient(ellipse at 30% 20%,#16337a,#0d2459 45%,#061233);overflow:hidden}
  .xrp .wall .sweep{position:absolute;left:-10%;top:58%;width:130%;height:230px;background:#e3132c;opacity:.85;transform:skewY(-8deg);animation:rpSweep 14s ease-in-out infinite alternate}
  .xrp .wall .sweep2{position:absolute;left:-10%;top:64%;width:130%;height:34px;background:#f5c400;transform:skewY(-8deg);animation:rpSweep 14s ease-in-out infinite alternate}
  .xrp .wall .wm{position:absolute;right:-40px;top:-90px;font-size:560px;font-weight:800;color:rgba(255,255,255,.045);letter-spacing:-10px;line-height:1}
  .gfx-light .xrp .wall .sweep,.gfx-light .xrp .wall .sweep2{animation:none}.gfx-light .xrp .sh{filter:none!important}
  @keyframes rpSweep{from{transform:skewY(-8deg) translateX(-3%)}to{transform:skewY(-8deg) translateX(3%)}}
  .xrp .fr{position:absolute;box-sizing:border-box;border:4px solid #f6f7fa;box-shadow:0 18px 50px rgba(0,0,0,.55)}
  .xrp .fr.live{border-color:#e3132c}.xrp .fr .topbar{position:absolute;left:-4px;right:-4px;top:-4px;height:8px;background:#e3132c}
  .xrp .tg{position:absolute;left:-4px;top:-4px;font-size:22px;font-weight:800;letter-spacing:3px;padding:2px 12px}.xrp .tg.red{background:#e3132c}.xrp .tg.navy{background:#0d2459}
  .xrp .dw{position:absolute;overflow:visible}
  .xrp .bug{position:absolute;display:flex;align-items:stretch;height:50px;box-shadow:0 10px 30px rgba(0,0,0,.5)}
  .xrp .bug b{background:#e3132c;font-size:36px;font-weight:800;letter-spacing:5px;padding:0 18px;display:flex;align-items:center}
  .xrp .bug s{text-decoration:none;background:#0d2459;font-size:20px;font-weight:700;letter-spacing:3px;padding:0 14px;display:flex;align-items:center}
  .xrp .bug span{background:#f5c400;color:#061233;font-size:28px;font-weight:800;padding:0 14px;display:flex;align-items:center}
  .xrp.frozen .bug b{background:#f5c400;color:#061233}
  .xrp .sub{position:absolute;font-size:20px;letter-spacing:3px;color:#fff;text-shadow:0 2px 6px rgba(0,0,0,.8)}.xrp .sub u{text-decoration:none;color:#f5c400}
  .xrp .sub .fz{display:none;color:#f5c400}.xrp.frozen .sub .fz{display:inline}.xrp.frozen .sub u{display:none}
  .xrp.frozen .pr,.xrp.frozen .cdw,.xrp.frozen .rsm{visibility:hidden}
  .xrp .rsm{position:absolute;font-size:26px;font-weight:800;letter-spacing:6px;color:#f5c400;text-shadow:0 2px 8px rgba(0,0,0,.8)}
  .xrp .lt{position:absolute;display:flex;flex-direction:column;box-shadow:0 14px 40px rgba(0,0,0,.5)}
  .xrp .lt .row{display:flex;justify-content:space-between;align-items:center;gap:20px;background:#f6f7fa;color:#061233;padding:8px 20px;border-left:12px solid #e3132c}
  .xrp .lt .row b{font-size:40px;font-weight:800;letter-spacing:1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xrp .lt .row span{font-size:26px;font-weight:700;color:#0d2459;white-space:nowrap}
  .xrp .lt .pr{height:7px;background:rgba(6,18,51,.6)}.xrp .lt .pr u{display:block;height:100%;width:0;background:#f5c400}
  .xrp .scp{position:absolute;box-sizing:border-box;background:#f6f7fa;color:#061233;padding:4px 14px;display:flex;flex-direction:column;justify-content:center}.xrp .scp small{font-size:15px;letter-spacing:4px;color:#d10a22;font-weight:700}.xrp .scp b{font-size:32px;line-height:1}
  .xrp .lk{position:absolute;display:flex;align-items:center;gap:26px;font-family:Inter,sans-serif;font-size:19px;font-weight:600;color:#fff}
  .xrp .lk span{display:flex;align-items:center;gap:8px}.xrp .lk i{font-style:normal;width:26px;height:26px;border-radius:5px;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800}
  .xrp .lk.top{left:0;right:0;top:0;height:50px;background:#061233;border-bottom:3px solid #e3132c;padding:0 30px}
  .xrp .lk.top em{margin-left:auto;font-style:normal;font-family:'Barlow Condensed',sans-serif;font-size:24px;font-weight:800;letter-spacing:3px;color:#f5c400}
  .xrp .lk.st{height:50px;background:#061233;border-top:3px solid #e3132c;padding:0 22px;box-sizing:border-box}.xrp .lk.st strong{font-family:'Barlow Condensed',sans-serif;font-size:24px;letter-spacing:3px;color:#f5c400}
  /* v32: the replay looks like the game you're playing */
  .xrp.g-ets .edge{box-shadow:inset 0 0 0 12px #0b4fa8,inset 0 0 0 15px #f4f1e8;border-top-color:#ffd400}
  .xrp.g-ets .fr.live{border-color:#ffd400}.xrp.g-ets .fr .topbar{background:#ffd400}.xrp.g-ets .tg.red{background:#ffd400;color:#111}.xrp.g-ets .tg.navy{background:#0b4fa8}
  .xrp.g-ets .bug b{background:#ffd400;color:#111}.xrp.g-ets .bug s{background:#0b4fa8}.xrp.g-ets .bug span{background:#127a3a;color:#0b4fa8}.xrp.g-ets.frozen .bug b{background:#127a3a;color:#0b4fa8}
  .xrp.g-ets .sub u,.xrp.g-ets .sub .fz,.xrp.g-ets .rsm{color:#127a3a}.xrp.g-ets .lt .row{background:#f4f1e8;color:#0b4fa8;border-left-color:#ffd400}.xrp.g-ets .lt .row span{color:#0b4fa8}.xrp.g-ets .lt .pr{background:#0b4fa8}.xrp.g-ets .lt .pr u{background:#127a3a}
  .xrp.g-ets .lk.top,.xrp.g-ets .lk.st{background:#0b4fa8;border-color:#ffd400}.xrp.g-ets .lk.top em,.xrp.g-ets .lk.st strong{color:#127a3a}.xrp.g-ets .scp{background:#f4f1e8;color:#0b4fa8}
  .xrp.g-ets .wall{background:radial-gradient(ellipse at 30% 20%,#08326b,#0b4fa8 60%)}.xrp.g-ets .wall .sweep{background:#ffd400}.xrp.g-ets .wall .sweep2{background:#127a3a}
  .xrps.g-ets .b1{background:#ffd400}.xrps.g-ets .b3{background:#127a3a}.xrps.g-ets .b2{background:linear-gradient(135deg,#08326b,#0b4fa8)}.xrps.g-ets .tx small{color:#127a3a}
  .xrp.g-ats .edge{box-shadow:inset 0 0 0 12px #1d3f8f,inset 0 0 0 15px #f2f2f2;border-top-color:#0c6b35}
  .xrp.g-ats .fr.live{border-color:#0c6b35}.xrp.g-ats .fr .topbar{background:#0c6b35}.xrp.g-ats .tg.red{background:#0c6b35;color:#fff}.xrp.g-ats .tg.navy{background:#1d3f8f}
  .xrp.g-ats .bug b{background:#0c6b35;color:#fff}.xrp.g-ats .bug s{background:#1d3f8f}.xrp.g-ats .bug span{background:#ffcc33;color:#1d3f8f}.xrp.g-ats.frozen .bug b{background:#ffcc33;color:#1d3f8f}
  .xrp.g-ats .sub u,.xrp.g-ats .sub .fz,.xrp.g-ats .rsm{color:#ffcc33}.xrp.g-ats .lt .row{background:#f2f2f2;color:#1d3f8f;border-left-color:#0c6b35}.xrp.g-ats .lt .row span{color:#1d3f8f}.xrp.g-ats .lt .pr{background:#1d3f8f}.xrp.g-ats .lt .pr u{background:#ffcc33}
  .xrp.g-ats .lk.top,.xrp.g-ats .lk.st{background:#1d3f8f;border-color:#0c6b35}.xrp.g-ats .lk.top em,.xrp.g-ats .lk.st strong{color:#ffcc33}.xrp.g-ats .scp{background:#f2f2f2;color:#1d3f8f}
  .xrp.g-ats .wall{background:radial-gradient(ellipse at 30% 20%,#12285c,#1d3f8f 60%)}.xrp.g-ats .wall .sweep{background:#0c6b35}.xrp.g-ats .wall .sweep2{background:#ffcc33}
  .xrps.g-ats .b1{background:#0c6b35}.xrps.g-ats .b3{background:#ffcc33}.xrps.g-ats .b2{background:linear-gradient(135deg,#12285c,#1d3f8f)}.xrps.g-ats .tx small{color:#ffcc33}
  .xrp.g-heist .edge{box-shadow:inset 0 0 0 12px #12061f,inset 0 0 0 15px #ffe48a;border-top-color:#ff3d8b}
  .xrp.g-heist .fr.live{border-color:#ff3d8b}.xrp.g-heist .fr .topbar{background:#ff3d8b}.xrp.g-heist .tg.red{background:#ff3d8b;color:#fff}.xrp.g-heist .tg.navy{background:#12061f}
  .xrp.g-heist .bug b{background:#ff3d8b;color:#fff}.xrp.g-heist .bug s{background:#12061f}.xrp.g-heist .bug span{background:#2ef2ff;color:#12061f}.xrp.g-heist.frozen .bug b{background:#2ef2ff;color:#12061f}
  .xrp.g-heist .sub u,.xrp.g-heist .sub .fz,.xrp.g-heist .rsm{color:#2ef2ff}.xrp.g-heist .lt .row{background:#ffe48a;color:#12061f;border-left-color:#ff3d8b}.xrp.g-heist .lt .row span{color:#12061f}.xrp.g-heist .lt .pr{background:#12061f}.xrp.g-heist .lt .pr u{background:#2ef2ff}
  .xrp.g-heist .lk.top,.xrp.g-heist .lk.st{background:#12061f;border-color:#ff3d8b}.xrp.g-heist .lk.top em,.xrp.g-heist .lk.st strong{color:#2ef2ff}.xrp.g-heist .scp{background:#ffe48a;color:#12061f}
  .xrp.g-heist .wall{background:radial-gradient(ellipse at 30% 20%,#2b0f4d,#12061f 60%)}.xrp.g-heist .wall .sweep{background:#ff3d8b}.xrp.g-heist .wall .sweep2{background:#2ef2ff}
  .xrps.g-heist .b1{background:#ff3d8b}.xrps.g-heist .b3{background:#2ef2ff}.xrps.g-heist .b2{background:linear-gradient(135deg,#2b0f4d,#12061f)}.xrps.g-heist .tx small{color:#2ef2ff}
  .xrp.g-arc .edge{box-shadow:inset 0 0 0 12px #141414,inset 0 0 0 15px #e9e4d8;border-top-color:#f2c200}
  .xrp.g-arc .fr.live{border-color:#f2c200}.xrp.g-arc .fr .topbar{background:#f2c200}.xrp.g-arc .tg.red{background:#f2c200;color:#111}.xrp.g-arc .tg.navy{background:#141414}
  .xrp.g-arc .bug b{background:#f2c200;color:#111}.xrp.g-arc .bug s{background:#141414}.xrp.g-arc .bug span{background:#e53b2c;color:#141414}.xrp.g-arc.frozen .bug b{background:#e53b2c;color:#141414}
  .xrp.g-arc .sub u,.xrp.g-arc .sub .fz,.xrp.g-arc .rsm{color:#e53b2c}.xrp.g-arc .lt .row{background:#e9e4d8;color:#141414;border-left-color:#f2c200}.xrp.g-arc .lt .row span{color:#141414}.xrp.g-arc .lt .pr{background:#141414}.xrp.g-arc .lt .pr u{background:#e53b2c}
  .xrp.g-arc .lk.top,.xrp.g-arc .lk.st{background:#141414;border-color:#f2c200}.xrp.g-arc .lk.top em,.xrp.g-arc .lk.st strong{color:#e53b2c}.xrp.g-arc .scp{background:#e9e4d8;color:#141414}
  .xrp.g-arc .wall{background:radial-gradient(ellipse at 30% 20%,#0a0a0a,#141414 60%)}.xrp.g-arc .wall .sweep{background:#f2c200}.xrp.g-arc .wall .sweep2{background:#e53b2c}
  .xrps.g-arc .b1{background:#f2c200}.xrps.g-arc .b3{background:#e53b2c}.xrps.g-arc .b2{background:linear-gradient(135deg,#0a0a0a,#141414)}.xrps.g-arc .tx small{color:#e53b2c}
  .xrp.g-mgs .edge{box-shadow:inset 0 0 0 12px #03140a,inset 0 0 0 15px #d8ffe4;border-top-color:#3dff7a}
  .xrp.g-mgs .fr.live{border-color:#3dff7a}.xrp.g-mgs .fr .topbar{background:#3dff7a}.xrp.g-mgs .tg.red{background:#3dff7a;color:#03140a}.xrp.g-mgs .tg.navy{background:#03140a}
  .xrp.g-mgs .bug b{background:#3dff7a;color:#03140a}.xrp.g-mgs .bug s{background:#03140a}.xrp.g-mgs .bug span{background:#bfffd4;color:#03140a}.xrp.g-mgs.frozen .bug b{background:#bfffd4;color:#03140a}
  .xrp.g-mgs .sub u,.xrp.g-mgs .sub .fz,.xrp.g-mgs .rsm{color:#bfffd4}.xrp.g-mgs .lt .row{background:#d8ffe4;color:#03140a;border-left-color:#3dff7a}.xrp.g-mgs .lt .row span{color:#03140a}.xrp.g-mgs .lt .pr{background:#03140a}.xrp.g-mgs .lt .pr u{background:#bfffd4}
  .xrp.g-mgs .lk.top,.xrp.g-mgs .lk.st{background:#03140a;border-color:#3dff7a}.xrp.g-mgs .lk.top em,.xrp.g-mgs .lk.st strong{color:#bfffd4}.xrp.g-mgs .scp{background:#d8ffe4;color:#03140a}
  .xrp.g-mgs .wall{background:radial-gradient(ellipse at 30% 20%,#020c06,#03140a 60%)}.xrp.g-mgs .wall .sweep{background:#3dff7a}.xrp.g-mgs .wall .sweep2{background:#bfffd4}
  .xrps.g-mgs .b1{background:#3dff7a}.xrps.g-mgs .b3{background:#bfffd4}.xrps.g-mgs .b2{background:linear-gradient(135deg,#020c06,#03140a)}.xrps.g-mgs .tx small{color:#bfffd4}
  .xrp.g-neon .edge{box-shadow:inset 0 0 0 12px #12061f,inset 0 0 0 15px #f2eaff;border-top-color:#c58bff}
  .xrp.g-neon .fr.live{border-color:#c58bff}.xrp.g-neon .fr .topbar{background:#c58bff}.xrp.g-neon .tg.red{background:#c58bff;color:#12061f}.xrp.g-neon .tg.navy{background:#12061f}
  .xrp.g-neon .bug b{background:#c58bff;color:#12061f}.xrp.g-neon .bug s{background:#12061f}.xrp.g-neon .bug span{background:#22d3ee;color:#12061f}.xrp.g-neon.frozen .bug b{background:#22d3ee;color:#12061f}
  .xrp.g-neon .sub u,.xrp.g-neon .sub .fz,.xrp.g-neon .rsm{color:#22d3ee}.xrp.g-neon .lt .row{background:#f2eaff;color:#12061f;border-left-color:#c58bff}.xrp.g-neon .lt .row span{color:#12061f}.xrp.g-neon .lt .pr{background:#12061f}.xrp.g-neon .lt .pr u{background:#22d3ee}
  .xrp.g-neon .lk.top,.xrp.g-neon .lk.st{background:#12061f;border-color:#c58bff}.xrp.g-neon .lk.top em,.xrp.g-neon .lk.st strong{color:#22d3ee}.xrp.g-neon .scp{background:#f2eaff;color:#12061f}
  .xrp.g-neon .wall{background:radial-gradient(ellipse at 30% 20%,#07030d,#12061f 60%)}.xrp.g-neon .wall .sweep{background:#c58bff}.xrp.g-neon .wall .sweep2{background:#22d3ee}
  .xrps.g-neon .b1{background:#c58bff}.xrps.g-neon .b3{background:#22d3ee}.xrps.g-neon .b2{background:linear-gradient(135deg,#07030d,#12061f)}.xrps.g-neon .tx small{color:#22d3ee}
  .xrp.g-ets .sub u,.xrp.g-ets .sub .fz,.xrp.g-ets .rsm,.xrp.g-ets .lk.top em,.xrp.g-ets .lk.st strong{color:#ffd400}
  .xrp.g-ats .sub u,.xrp.g-ats .sub .fz,.xrp.g-ats .rsm,.xrp.g-ats .lk.top em,.xrp.g-ats .lk.st strong{color:#ffcc33}
  .xrp.g-heist .sub u,.xrp.g-heist .sub .fz,.xrp.g-heist .rsm,.xrp.g-heist .lk.top em,.xrp.g-heist .lk.st strong{color:#2ef2ff}
  .xrp.g-arc .sub u,.xrp.g-arc .sub .fz,.xrp.g-arc .rsm,.xrp.g-arc .lk.top em,.xrp.g-arc .lk.st strong{color:#f2c200}
  .xrp.g-mgs .sub u,.xrp.g-mgs .sub .fz,.xrp.g-mgs .rsm,.xrp.g-mgs .lk.top em,.xrp.g-mgs .lk.st strong{color:#3dff7a}
  .xrp.g-neon .sub u,.xrp.g-neon .sub .fz,.xrp.g-neon .rsm,.xrp.g-neon .lk.top em,.xrp.g-neon .lk.st strong{color:#22d3ee}
  .xrp .gx{position:absolute;pointer-events:none}
  .xrp .gx.rec{right:46px;top:66px;display:flex;align-items:center;gap:10px;font-family:VT323,'Courier New',monospace;font-size:34px;color:#fff;text-shadow:0 0 6px rgba(0,0,0,.9)}
  .xrp .gx.rec i{width:18px;height:18px;border-radius:50%;background:#ff2a2a;box-shadow:0 0 10px #ff2a2a;animation:gxBlink 1s steps(2) infinite}
  @keyframes gxBlink{50%{opacity:0}}
  .xrp .gx.scan{inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,.16) 0 2px,transparent 2px 5px)}
  .xrp .gx.haz{left:0;right:0;height:16px;background:repeating-linear-gradient(135deg,#f2c200 0 24px,#141414 24px 48px)}
  .xrp.g-heist .bug b,.xrps.g-heist .tx b{font-style:italic}.xrp.g-heist .bug{transform:skewX(-8deg)}
  .xrps.g-heist .tx b{color:#ffe48a;text-shadow:8px 8px 0 #12061f}
  .xrp.g-mgs .bug b,.xrp.g-mgs .bug s,.xrps.g-mgs .tx b{font-family:VT323,monospace;font-weight:400}
  .xrp.g-ets .bug,.xrp.g-ats .bug{border-radius:8px;overflow:hidden;border:3px solid #fff}
  #stage.rp-on>*:not(.xrp):not(.xrps):not(iframe):not(.bcs){opacity:0!important;transition:opacity .3s}
  .xrps{position:absolute;inset:0;z-index:45;pointer-events:none;overflow:hidden;display:flex;align-items:center;justify-content:center}
  .xrps .b1{position:absolute;top:0;bottom:0;left:-14%;width:128%;background:#e3132c;transform:skewX(-14deg)}.xrps .b3{position:absolute;top:0;bottom:0;left:-11%;width:122%;background:#f5c400;transform:skewX(-14deg)}.xrps .b2{position:absolute;top:0;bottom:0;left:-9%;width:118%;background:linear-gradient(135deg,#0d2459,#061233);transform:skewX(-14deg)}
  .xrps .tx{position:relative;display:flex;flex-direction:column;align-items:center;font-family:'Barlow Condensed',sans-serif;color:#fff}.xrps .tx small{font-size:34px;font-weight:700;letter-spacing:10px;color:#f5c400}.xrps .tx b{font-size:190px;font-weight:800;line-height:.95}
  .xmm{position:absolute;left:40px;top:230px;width:380px;z-index:9;border-radius:14px;overflow:hidden;border:2px solid #f6d77a;background:rgba(14,12,6,.94);font-family:'Barlow Condensed',sans-serif;color:#fff;pointer-events:none;padding-bottom:8px}
  .xmm .h{display:flex;justify-content:space-between;align-items:center;padding:8px 14px;background:#f6d77a;color:#1a1400}.xmm .h b{font-size:28px;letter-spacing:2px}.xmm .h span{font-size:24px;font-weight:800}
  .xmm .s{font-family:Inter,sans-serif;font-size:13px;color:#e6dcc0;padding:6px 14px 2px}.xmm .s u{text-decoration:none;font-weight:700;color:#f6d77a}
  .xmm .r{display:grid;grid-template-columns:26px minmax(0,1fr) 34px;gap:2px 8px;align-items:center;padding:3px 14px}.xmm .r i{font-style:normal;color:#f6d77a;font-weight:800;font-size:20px}.xmm .r b{font-size:22px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xmm .r em{font-style:normal;text-align:right;font-weight:800;font-size:20px}
  .xmm .bar{grid-column:2/4;height:5px;border-radius:3px;background:rgba(255,255,255,.1);overflow:hidden}.xmm .bar u{display:block;height:100%;background:#f6d77a;transition:width .5s}
  .xmmw{position:absolute;left:50%;top:200px;transform:translateX(-50%);z-index:12;text-align:center;padding:18px 50px;border-radius:18px;border:4px solid #f6d77a;background:rgba(14,12,6,.95);font-family:'Barlow Condensed',sans-serif;color:#fff;pointer-events:none;box-shadow:0 30px 80px rgba(0,0,0,.6)}
  .xmmw small{display:block;font-size:26px;letter-spacing:8px;color:#f6d77a}.xmmw b{display:block;font-size:96px;line-height:1}.xmmw span{font-family:Inter,sans-serif;font-size:20px;color:#e6dcc0}
  #stage.no-squadSheet .xmm,#stage.no-squadSheet .xmmw{display:none}
  .xsh{position:absolute;left:700px;top:150px;width:520px;z-index:12;border-radius:18px;overflow:hidden;border:3px solid #ff3b3b;background:rgba(22,6,6,.96);font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.6);pointer-events:none}
  .xsh .h{padding:12px 22px;background:linear-gradient(90deg,#b30000,#ff3b3b)}.xsh .h small{display:block;font-size:18px;letter-spacing:6px;color:#ffd2d2}.xsh .h b{font-size:52px;line-height:1}
  .xsh .l{padding:8px 22px 14px}.xsh .r{display:flex;align-items:center;gap:14px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}
  .xsh .r i{font-style:normal;width:30px;font-size:30px;font-weight:800;color:#ff8080}.xsh .r b{flex:1;font-size:32px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.xsh .cs{font-size:28px;font-weight:800;display:flex;align-items:center;gap:4px}
  .xsh em{font-style:normal;font-size:16px;font-weight:800;background:#ff3b3b;padding:2px 8px;border-radius:5px}
  .xsh .mc{width:16px;height:23px;margin-right:2px;text-decoration:none}
  .xts{position:absolute;left:50%;top:130px;transform:translateX(-50%);width:820px;z-index:12;border-radius:20px;overflow:hidden;border:3px solid #c8102e;background:linear-gradient(170deg,rgba(26,13,16,.97),rgba(11,13,16,.97));font-family:'Barlow Condensed',sans-serif;color:#fff;box-shadow:0 30px 80px rgba(0,0,0,.6);pointer-events:none}
  .xts .h{display:flex;justify-content:space-between;align-items:center;padding:14px 24px;background:#c8102e}.xts .h b{font-size:40px;letter-spacing:2px;white-space:nowrap}.xts .h span{font-size:22px;letter-spacing:4px;white-space:nowrap;margin-left:16px}
  .xts .g{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 30px;padding:14px 24px}
  .xts .p{display:flex;align-items:center;gap:12px;padding:7px 0;border-bottom:1px solid rgba(255,255,255,.08)}.xts .p i{font-style:normal;width:44px;font-size:22px;color:#a7b0ba}.xts .p i.ps{color:#f6d77a;font-weight:800}.xts .p b{flex-grow:1;min-width:0;font-size:30px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .xts .t{font-size:17px;font-weight:800;padding:2px 9px;border-radius:5px;background:#9146ff;color:#fff}.xts .t.BENCHED{background:#f6d77a;color:#2a1c00}.xts .t.BOSS{background:#3dff9a;color:#06110b}.xts .t.GIFT,.xts .t.PRIME{background:#4dc3ff;color:#04121c}
  .xts .b{padding:12px 24px 18px;border-top:1px solid rgba(255,255,255,.12)}.xts .b small{display:block;font-size:20px;letter-spacing:4px;color:#f6d77a}.xts .b div{font-size:28px;color:#e6dcc0}
  .xsq{position:absolute;left:1460px;top:660px;width:420px;z-index:4;border-radius:14px;overflow:hidden;background:rgba(10,12,15,.9);border:2px solid #c8102e;font-family:'Barlow Condensed',sans-serif;color:#f2f5f7;transform-origin:0 0}
  .xsq .h{display:flex;justify-content:space-between;padding:4px 12px;background:#c8102e;font-size:19px;font-weight:800;letter-spacing:2px}
  .xsq .l{padding:6px 12px;font-size:19px;line-height:1.25}.xsq .l b{color:#f6d77a;letter-spacing:1px}
  #stage.no-squadSheet .xsq,#stage.no-squadSheet .xts{display:none}
  #stage.xpanic>*{visibility:hidden!important}
  #stage.no-rnPill .rnp,#stage.no-drones .rnd,#stage.no-raidTaunt .rnt,#stage.no-camFrames .cfx,#stage.no-giftAllTime .al-gift,#stage.no-giftAllTime .al-gm{display:none!important}
  `;
  let stage, show = {}, layout = {}, layEl, res = null, resEl = null, scores = [], scEl = null, scI = 0, scT = null, sg = null, sgEl = null, lastN = null;
  const TYPES = /^(motm|shame|replay|squad|squadsheet|redcard|bossrecord|bossturn|mvp|mvprace|chat|chatcfg|counters|counterHit|showcfg|layout|results|fulltime|scores|scoresPanel|subgoal|hype|gamebanner|featured|breaking)$/;
  const on = (k) => show[k] !== false;
  const SEL = { bp: '.xbp', squadSheet: '.xsq', redCard: '.xred', mvpRace: '.xmr', chat: '.xchat', challenges: '.chw', rnPill: '.rnp', results: '.xr', scores: '.xs', subGoal: '.xg', nextTimer: '.nbt' };
  function init(o) {
    stage = o.stage;
    const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    layEl = document.createElement('style'); document.head.appendChild(layEl);
  }
  function applyLayout() {
    let h = '';
    for (const [id, p] of Object.entries(layout || {})) {
      const sel = SEL[id] || (/^ctr-/.test(id) ? '.xc[data-id="' + id.slice(4).replace(/[^a-z0-9_-]/gi, '') + '"]' : null); if (!sel || !p) continue;
      h += '#stage ' + sel + '{left:' + p.x + 'px!important;top:' + p.y + 'px!important;right:auto!important;bottom:auto!important;transform:scale(' + (p.s || 1) + ')!important;transform-origin:0 0!important}';
    }
    layEl.textContent = h;
  }
  function onShow(a) {
    show = a.show || {};
    for (const k of Object.keys(show)) stage.classList.toggle('no-' + k, !show[k]);
    stage.classList.toggle('xpanic', !!a.panic);
    drawResults(); drawScores(); drawGoal(); drawCounters();
  }
  // ---------- team results ----------
  const RC = ['#3dff9a', '#ffd23f', '#ff5d6c'];
  function drawResults() {
    if (!res || !res.show || !on('results') || !res.team) { if (resEl) { resEl.remove(); resEl = null; } return; }
    if (!resEl) { resEl = document.createElement('div'); resEl.className = 'xr'; stage.appendChild(resEl); }
    const t = res.team, c = res.counts || [], L = res.labels || [], custom = t.type === 'custom';
    resEl.style.setProperty('--tc', t.color || '#4dc3ff');
    const cols = custom ? L.map((l, i) => [l.toUpperCase(), c[i] || 0, ['#3dff9a', '#ff5d6c', '#4dc3ff'][i]]) : (t.type === 'wl' ? [['W', c[0] || 0, RC[0]], ['L', c[2] || 0, RC[2]]] : [['W', c[0] || 0, RC[0]], ['D', c[1] || 0, RC[1]], ['L', c[2] || 0, RC[2]]]);
    const form = custom ? '' : '<div class="fm">' + (res.form || []).map((f) => '<i style="background:' + RC[f] + '">' + ['W', 'D', 'L'][f] + '</i>').join('') + '</div>';
    resEl.innerHTML = '<div class="bd">' + esc(t.short || 'BBR') + '</div><div class="mid"><div class="nm">' + esc(String(t.name).toUpperCase()) + ' · ' + (res.scope === 'season' ? 'SEASON' : 'TONIGHT') + '</div><div class="ct">' +
      cols.map((x) => '<span><b>' + x[1] + '</b><i style="color:' + x[2] + '">' + esc(x[0]) + '</i></span>').join('') + '</div></div>' + form + (res.unbeaten ? '<div class="ub">' + res.unbeaten + ' UNBEATEN</div>' : '');
  }
  function fullTime(a) {
    if (!on('resultsCard') || !on('results')) return;
    const t = a.team, l = a.last || {}, custom = t.type === 'custom', idx = a.idx;
    const rc = custom ? ['#3dff9a', '#ff5d6c', '#4dc3ff'][idx] : RC[idx];
    const el = document.createElement('div'); el.className = 'xft';
    el.style.setProperty('--rc', rc); el.style.setProperty('--tc', t.color || '#4dc3ff');
    const st = a.state || {}, c = st.counts || [];
    const rec = custom ? (st.labels || []).map((x, i) => (c[i] || 0) + ' ' + x.toLowerCase()).join(' · ') : (c[0] || 0) + ' W' + (t.type === 'wdl' ? ' · ' + (c[1] || 0) + ' D' : '') + ' · ' + (c[2] || 0) + ' L ' + (st.scope === 'season' ? 'this season' : 'tonight');
    el.innerHTML = '<div class="k">' + (custom ? esc(String(t.name).toUpperCase()) : 'FULL TIME') + '</div>' +
      (l.us != null ? '<div class="box"><div class="t us">' + esc(String(t.name).toUpperCase()) + '</div><div class="s">' + l.us + ' - ' + l.them + '</div><div class="t">' + esc(String(l.opp || 'OPPONENT').toUpperCase()) + '</div></div>' : '') +
      '<div class="r">' + esc(String(a.label).toUpperCase()) + '</div><div class="rec">' + esc(rec) + '</div>';
    stage.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.6)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.04)', offset: 0.08 }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.9 }, { opacity: 0, transform: 'translateX(-50%) translateY(-30px)' }], { duration: 6500, fill: 'forwards' });
    if (window.SFX) { SFX.play('whistle', 0, true); if (!custom && idx === 0) SFX.play('cheer', 0.4, 2.2); else SFX.play('impact', 0.3); }
    setTimeout(() => el.remove(), 6700);
  }
  // ---------- live scores ----------
  function drawScores() {
    const L = on('scores') ? scores : [];
    if (!L.length) { if (scEl) { scEl.remove(); scEl = null; } clearInterval(scT); scT = null; return; }
    if (!scEl) { scEl = document.createElement('div'); scEl.className = 'xs'; stage.appendChild(scEl); }
    const one = () => {
      const m = L[scI % L.length]; scI++;
      scEl.classList.toggle('mine', !!m.mine);
      scEl.innerHTML = '<div class="lv">LIVE</div><div class="in"><span class="tm">' + esc(m.home) + '</span><span class="sc">' + m.hs + '-' + m.as + '</span><span class="tm">' + esc(m.away) + '</span><span class="mn">' + esc(m.min || '') + '</span><span class="cp">' + esc(m.comp || '') + '</span></div>';
    };
    one(); clearInterval(scT); if (L.length > 1) scT = setInterval(one, 8000);
  }
  function scoresPanel(a) {
    const L = a.list || []; if (!L.length) return;
    const el = document.createElement('div'); el.className = 'xsp';
    let comp = null, h = '<div class="h">SCORES ROUND-UP<span>' + L.filter((m) => m.state === 'in').length + ' LIVE</span></div>';
    for (const m of L) {
      if (m.comp !== comp) { comp = m.comp; h += '<div class="cp">' + esc(String(comp || '').toUpperCase()) + '</div>'; }
      h += '<div class="row' + (m.mine ? ' mine' : '') + '"><span class="a">' + esc(m.home) + '</span><span class="sc">' + (m.state === 'pre' ? 'v' : m.hs + '-' + m.as) + '</span><span class="b">' + esc(m.away) + '</span><span class="m">' + esc(m.min || '') + '</span></div>';
    }
    el.innerHTML = h; stage.appendChild(el);
    const ms = (a.secs || 20) * 1000;
    el.animate([{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none', offset: 0.04 }, { opacity: 1, offset: 0.95 }, { opacity: 0, transform: 'translateX(60px)' }], { duration: ms, fill: 'forwards' });
    el.querySelectorAll('.row').forEach((r, i) => r.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300, delay: 300 + i * 90, fill: 'backwards' }));
    setTimeout(() => el.remove(), ms + 100);
  }
  // ---------- sub goal ----------
  function drawGoal() {
    if (!sg || !on('subGoal')) { if (sgEl) { sgEl.remove(); sgEl = null; } return; }
    if (!sgEl) { sgEl = document.createElement('div'); sgEl.className = 'xg'; stage.appendChild(sgEl); }
    const done = sg.n >= sg.target, pct = Math.min(100, Math.round(100 * sg.n / sg.target));
    sgEl.innerHTML = '<div class="l"><span>' + esc(sg.label) + ' <b>' + sg.n + ' / ' + sg.target + '</b></span><span>' + (done ? 'GOAL HIT! Thank you' : sg.next ? (sg.next.at - sg.n) + ' more: ' + esc(sg.next.text) : '') + '</span></div><div class="tr"><i style="width:' + Math.max(2, pct) + '%"></i></div>';
    if (lastN != null && sg.n > lastN) { sgEl.classList.remove('hit'); void sgEl.offsetWidth; sgEl.classList.add('hit'); if (window.SFX) SFX.play(done ? 'fanfare' : 'ding'); }
    lastN = sg.n;
  }
  // ---------- hype ----------
  function hype(a) {
    if (!on('hype')) return;
    const b = document.createElement('div'); b.className = 'xhy';
    const t = document.createElement('div'); t.className = 'xhyb'; t.textContent = 'HYPE!';
    stage.appendChild(b); stage.appendChild(t);
    t.animate([{ transform: 'translateX(-50%) scale(.3)', opacity: 0 }, { transform: 'translateX(-50%) scale(1.15)', opacity: 1, offset: 0.6 }, { transform: 'translateX(-50%) scale(1)', opacity: 1 }], { duration: 600 });
    if (window.SFX) { SFX.play('riser', 0, 1); SFX.play('cheer', 0.8, 2); }
    setTimeout(() => { b.style.opacity = 0; t.style.transition = 'opacity .8s'; t.style.opacity = 0; setTimeout(() => { b.remove(); t.remove(); }, 900); }, (a.secs || 30) * 1000);
  }
  // ---------- game banner ----------
  function banner(a) {
    if (!on('gameBanner')) return;
    const el = document.createElement('div'); el.className = 'xgb';
    el.innerHTML = '<div class="k">NOW PLAYING</div><div class="g">' + esc(a.game) + '</div>';
    stage.appendChild(el);
    el.animate([{ transform: 'translateX(-110%)' }, { transform: 'none', offset: 0.1 }, { transform: 'none', offset: 0.9 }, { transform: 'translateX(-110%)' }], { duration: 6000, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
    if (window.SFX) SFX.play('whoosh');
    setTimeout(() => el.remove(), 6100);
  }
  // ---------- featured message ----------
  const PC = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  function featured(a) {
    if (!on('featured')) return;
    document.querySelectorAll('.xfm').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'xfm';
    el.style.setProperty('--pc', PC[a.platform] || '#3dff9a');
    el.innerHTML = (a.card ? '<div class="cd"><div class="m">' + BBR.render(a.card, { edges: 6 }) + '</div></div>' : '') + '<div class="bub"><div class="who">' + esc(String(a.display || '').toUpperCase()) + ' SAYS</div><div class="tx">' + esc(a.text) + '</div></div>';
    stage.appendChild(el);
    const ms = (a.secs || 10) * 1000;
    el.animate([{ opacity: 0, transform: 'translateY(40px)' }, { opacity: 1, transform: 'none', offset: 0.05 }, { opacity: 1, offset: 0.93 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    if (window.SFX) SFX.play('pop');
    setTimeout(() => el.remove(), ms + 100);
  }
  // ---------- BREAKING ----------
  function breaking(a) {
    if (!on('breaking')) return;
    document.querySelectorAll('.xbk').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'xbk';
    el.innerHTML = '<div class="k"><small>BOSS SPORTS NEWS</small>' + esc(a.label === 'BREAKING' || !a.label ? 'BREAKING' : a.label) + '</div><div class="t"><span>' + esc(a.text) + '</span></div>';
    stage.appendChild(el);
    el.animate([{ transform: 'translateX(-100%)' }, { transform: 'none', offset: 0.05 }, { transform: 'none', offset: 0.95 }, { transform: 'translateX(100%)' }], { duration: 12000, easing: 'cubic-bezier(.6,0,.3,1)', fill: 'forwards' });
    const sp = el.querySelector('.t span'), over = sp.scrollWidth - (el.querySelector('.t').clientWidth - 48);
    if (over > 0) sp.animate([{ transform: 'none' }, { transform: 'none', offset: 0.15 }, { transform: 'translateX(-' + over + 'px)', offset: 0.85 }, { transform: 'translateX(-' + over + 'px)' }], { duration: 11000, delay: 600, fill: 'both' });
    if (window.SFX) { SFX.play('alarm', 0, 1); SFX.play('impact', 0.4); }
    setTimeout(() => el.remove(), 12100);
  }
  // ---------- fun counters (GODFATHER's penalties) ----------
  let ctrs = [];
  const WHISTLE = '<svg width="26" height="26" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="14" r="6" fill="#fff"/><rect x="11" y="6" width="11" height="5" rx="1.5" fill="#fff"/><circle cx="9" cy="14" r="2.4" fill="var(--cc)"/></svg>';
  function drawCounters() {
    const list = on('counters') ? ctrs.filter((c) => c.show) : [];
    stage.querySelectorAll('.xc').forEach((el) => { if (!list.some((c) => c.id === el.dataset.id)) el.remove(); });
    list.forEach((c, i) => {
      let el = stage.querySelector('.xc[data-id="' + c.id + '"]');
      if (!el) { el = document.createElement('div'); el.className = 'xc'; el.dataset.id = c.id; el.style.left = '1580px'; el.style.top = (300 + i * 170) + 'px'; stage.appendChild(el); }
      el.style.setProperty('--cc', c.color);
      el.innerHTML = '<div class="hd">' + WHISTLE + '<b>' + esc(c.name) + '</b></div><div class="wt">' + esc(c.what) + '</div>' +
        '<div class="nums"><div><small>TONIGHT</small><div class="big">' + c.tonight + '</div></div><div><small>SEASON</small><div class="ssn">' + c.season + '</div></div>' + (c.best ? '<div><small>WORST NIGHT</small><div class="ssn">' + c.best + '</div></div>' : '') + '</div>' +
        '<div class="gg">' + Array.from({ length: c.lof }, (_, k) => '<i' + (k <= c.li && (k > 0 || c.tonight > 0) ? ' class="on"' : '') + '></i>').join('') + '</div><div class="lv">' + esc(c.level) + '</div>';
    });
  }
  function counterHit(a) {
    const c = a.counter; if (!on('counters')) return;
    const w = stage.querySelector('.xc[data-id="' + c.id + '"]'); if (w) { w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit'); }
    const el = document.createElement('div'); el.className = 'xch'; el.style.setProperty('--cc', c.color);
    el.innerHTML = '<div class="rc">' + c.tonight + '</div><div class="tx"><div class="k">' + esc(c.what) + '</div><div class="l">' + esc(a.line) + '</div><div class="s">' + esc(c.name) + ': ' + c.tonight + ' tonight · ' + c.season + ' this season</div>' + (a.levelUp ? '<div class="up">NOW: ' + esc(a.levelUp) + '</div>' : '') + '</div>';
    stage.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translateX(-50%) scale(.5) rotate(-6deg)' }, { opacity: 1, transform: 'translateX(-50%) scale(1.06)', offset: 0.08 }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.12 }, { opacity: 1, offset: 0.9 }, { opacity: 0, transform: 'translateX(-50%) translateY(-30px)' }], { duration: 6000, fill: 'forwards' });
    el.querySelector('.rc').animate([{ transform: 'rotate(-30deg) translateY(-200px)' }, { transform: 'rotate(8deg)', offset: 0.7 }, { transform: 'rotate(0)' }], { duration: 600, easing: 'cubic-bezier(.2,.9,.3,1.2)' });
    if (window.SFX) { SFX.play('whistle', 0, true); SFX.play('ooh', 0.4); if (a.levelUp) SFX.play('impact', 0.6); }
    setTimeout(() => el.remove(), 6100);
  }
  // ---------- BBR chat ----------
  let chatEl = null, chatS = { max: 6, fadeSecs: 40, ovr: true, platforms: true, dodge: true, size: 19 };
  const CHP = { twitch: '#9146ff', kick: '#53fc18', youtube: '#ff2a3d' };
  const DODGE = '.xmm, .xmmw, .xsh, .xrp, .xts, .al, .packstage, .aarena, .rarena, .pen, .scr, .rnb, .rnt, .lbb, .lbd, .xft, .xch, .xmvp, .xred.big, .bjoin, .dreel, .xsp';
  function chatBox() { if (!chatEl) { chatEl = document.createElement('div'); chatEl.className = 'xchat'; stage.appendChild(chatEl); } chatEl.style.setProperty('--fs', chatS.size + 'px'); return chatEl; }
  function chatMsg(a) {
    if (!on('chat')) return;
    if (a.S) chatS = a.S;
    const box = chatBox(), el = document.createElement('div');
    el.className = 'm' + (a.first ? ' first' : '') + (a.boss ? ' boss' : '');
    el.innerHTML = (chatS.platforms ? '<i class="pd" style="background:' + (CHP[a.platform] || '#888') + '"></i>' : '') + '<div class="tx">' +
      (a.first ? '<span class="tag">NEW</span>' : a.mod ? '<span class="tag" style="background:#4dc3ff">MOD</span>' : a.sub ? '<span class="tag" style="background:#c58bff;color:#14051f">SUB</span>' : '') +
      '<span class="nm" style="color:' + esc(a.color || '#fff') + '">' + esc(a.display) + '</span>' + (chatS.ovr && a.ovr ? '<span class="ov" style="background:' + esc(a.color) + '">' + a.ovr + '</span>' : '') + esc(a.text) + '</div>';
    box.appendChild(el);
    while (box.children.length > chatS.max) box.firstChild.remove();
    if (chatS.fadeSecs > 0) setTimeout(() => { el.classList.add('old'); setTimeout(() => el.remove(), 900); }, chatS.fadeSecs * 1000);
  }
  // only step aside when an alert actually covers the chat box
  const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  setInterval(() => {
    if (!chatEl) return;
    let d = false;
    if (chatS.dodge !== false && chatEl.children.length) { const r = chatEl.getBoundingClientRect(); for (const x of stage.querySelectorAll(DODGE + ', .card-pop, .cpop')) { const q = x.getBoundingClientRect(); if (q.width && q.height && hits(r, q)) { d = true; break; } } }
    chatEl.classList.toggle('dodge', d);
  }, 300);
  // ---------- Viewer of the Stream ----------
  function mvp(a) {
    if (!on('mvpReveal')) return;
    document.querySelectorAll('.xmvp').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'xmvp';
    const name = String(a.name || '').toUpperCase(), fs = name.length > 12 ? Math.max(90, Math.round(170 * 12 / name.length)) : 170;
    el.innerHTML = '<div class="bg"></div><div class="rays"></div>' + (a.runnerUp ? '<div class="ru"><small>RUNNER-UP</small><b>' + esc(String(a.runnerUp.name).toUpperCase()) + '</b></div>' : '') +
      '<div class="cd"><div class="' + BBR.wrapClass(a.card.tier) + '"><div class="m">' + BBR.render(Object.assign({}, a.card, { ribbon: a.times > 1 ? 'MVP x' + a.times : 'MVP' })) + '</div></div></div>' +
      '<div class="tt"><div class="k">VIEWER OF THE STREAM</div><div class="n" style="font-size:' + fs + 'px">' + Array.from(name).map((ch) => '<span>' + esc(ch) + '</span>').join('') + '</div>' +
      '<div class="s">Stream #' + a.streamNo + (a.times > 1 ? ' · MVP for the ' + a.times + (a.times % 10 === 2 && a.times !== 12 ? 'nd' : a.times % 10 === 3 && a.times !== 13 ? 'rd' : 'th') + ' time' : ' · first time MVP') + (a.runnerUp ? ' · ahead of ' + esc(a.runnerUp.name) : '') + '</div></div>' +
      '<div class="bars">' + a.bars.map((b) => '<div class="br"><span>' + esc(b.k) + '</span><i><u data-w="' + Math.max(3, b.w) + '%"></u></i><b>' + esc(b.v) + '</b></div>').join('') + '</div>' +
      (a.points ? '<div class="chip">+' + a.points + ' CARD POINTS · MVP RIBBON</div>' : '<div class="chip">MVP RIBBON</div>') + '<div class="fl"></div>';
    stage.appendChild(el);
    const q = (s2) => el.querySelector(s2), hide = (s2) => el.querySelectorAll(s2).forEach((x) => { x.style.opacity = 0; });
    hide('.cd, .tt, .bars, .chip'); if (!a.runnerUp) hide('.ru');
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 600, fill: 'forwards' });
    if (window.SFX) { SFX.play('rumble', 0.2, 2.6); SFX.play('riser', 0.6, 2.4); }
    const ru = q('.ru'); if (ru) { ru.animate([{ opacity: 0, transform: 'translate(-50%,-40%)' }, { opacity: 1, transform: 'translate(-50%,-50%)', offset: 0.2 }, { opacity: 1, offset: 0.8 }, { opacity: 0, transform: 'translate(-50%,-60%) scale(.9)' }], { duration: 2200, delay: 700, fill: 'forwards' }); }
    setTimeout(() => {
      q('.fl').animate([{ opacity: 0.9 }, { opacity: 0 }], { duration: 700, fill: 'forwards' });
      const cd = q('.cd'); cd.style.opacity = 1; cd.animate([{ transform: 'translateY(-700px) rotate(-14deg) scale(1.3)' }, { transform: 'translateY(20px) rotate(3deg) scale(1)', offset: 0.7 }, { transform: 'none' }], { duration: 700, easing: 'cubic-bezier(.3,1.3,.5,1)' });
      const tt = q('.tt'); tt.style.opacity = 1; tt.querySelectorAll('.n span').forEach((sp, i) => sp.animate([{ opacity: 0, transform: 'translateY(60px) scale(1.6)' }, { opacity: 1, transform: 'none' }], { duration: 380, delay: 250 + i * 55, fill: 'backwards', easing: 'cubic-bezier(.2,.9,.3,1.3)' }));
      tt.querySelector('.k').animate([{ opacity: 0, letterSpacing: '30px' }, { opacity: 1, letterSpacing: '12px' }], { duration: 700 });
      if (window.SFX) { SFX.play('boom', 0); SFX.play('impact', 0.05); SFX.play('fanfare', 0.2); SFX.play('cheer', 0.3, 4); SFX.tierFx && SFX.tierFx(a.card.tier, 0.1); }
      for (let i = 0; i < 90; i++) { const f = document.createElement('i'); f.className = 'cf'; f.style.left = (Math.random() * 1920) + 'px'; f.style.background = ['#f6d77a', '#fff1b8', '#ffffff', '#b8861f', '#3dff9a'][i % 5]; el.appendChild(f); f.animate([{ transform: 'translateY(0) rotate(0)' }, { transform: 'translateY(' + (900 + Math.random() * 400) + 'px) rotate(' + (Math.random() * 900) + 'deg)', opacity: 0.2 }], { duration: 2600 + Math.random() * 2600, delay: Math.random() * 900, fill: 'forwards' }); }
    }, a.runnerUp ? 3000 : 1600);
    setTimeout(() => { const b = q('.bars'); b.style.opacity = 1; b.animate([{ opacity: 0, transform: 'translateY(30px)' }, { opacity: 1, transform: 'none' }], { duration: 500 }); b.querySelectorAll('u').forEach((u, i) => setTimeout(() => { u.style.width = u.dataset.w; if (window.SFX) SFX.play('tick'); }, 200 + i * 260)); }, a.runnerUp ? 4600 : 3200);
    setTimeout(() => { const c = q('.chip'); c.style.opacity = 1; c.animate([{ transform: 'scale(.3)', opacity: 0 }, { transform: 'scale(1.1)', opacity: 1, offset: 0.7 }, { transform: 'scale(1)' }], { duration: 500 }); if (window.SFX) SFX.play('ding'); }, a.runnerUp ? 6600 : 5200);
    const total = a.runnerUp ? 13000 : 11500;
    setTimeout(() => { el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 800, fill: 'forwards' }); setTimeout(() => el.remove(), 850); }, total);
  }
  let mrEl = null;
  function mvpRace(a) {
    const L = a.list || [];
    if (!on('mvpRace') || !L.length) { if (mrEl) { mrEl.remove(); mrEl = null; } return; }
    if (!mrEl) { mrEl = document.createElement('div'); mrEl.className = 'xmr'; stage.appendChild(mrEl); }
    mrEl.innerHTML = '<div class="h">RACE FOR MVP</div>' + L.map((r, i) => '<div class="r"><span>' + (i + 1) + '. ' + esc(r.name) + '</span><b>' + Math.round(r.score) + '</b></div>').join('');
  }
  // ---------- red card rule ----------
  let redEl = null;
  function redcard(a) {
    if (!a.on) { if (redEl) { redEl.remove(); redEl = null; } document.querySelectorAll('.xredf').forEach((x) => x.remove()); return; }
    if (!on('redCard')) return;
    const img = a.image ? esc(a.image) : null;
    if (!a.replay) {
      document.querySelectorAll('.xredf').forEach((x) => x.remove());
      const f = document.createElement('div'); f.className = 'xredf';
      const y2 = a.kind === 'yellow2', T = a.table;
      const banTx = a.kind === 'warn' ? '' : (y2 ? '<span class="mc y"></span><span class="mc y"></span> TWO YELLOWS' : '<span class="mc"></span> STRAIGHT RED') + (a.ban ? ' · ' + a.ban + ' MATCH BAN' : '');
      f.innerHTML = '<div class="bg"></div><div class="edge"></div>' + (y2 && !img ? '<div class="card y"></div>' : '') + (img ? '<img class="card" src="' + img + '" alt="">' : '<div class="card"></div>') +
        '<div class="tx"><div class="k">THE BOSS\'S</div><div class="t">' + esc(a.rule.title) + '</div>' + (a.rule.text ? '<div class="r">' + esc(a.rule.text) + '</div>' : '') +
        (banTx ? '<div class="ban' + (y2 ? ' y' : '') + '">' + banTx + '</div>' : '') +
        (T ? '<div class="tb"><span class="' + (y2 ? 'on' : '') + '"><span class="mc y"></span><span class="mc y"></span> 2 YELLOWS = ' + T.yellow + ' MATCH BAN</span><span class="' + (a.kind === 'red' ? 'on' : '') + '"><span class="mc"></span> STRAIGHT RED = ' + T.red + ' MATCH BAN</span></div>' : '') +
        (a.player ? '<div class="p">' + esc(a.player) + (a.count ? ' · cards tonight: ' + a.count.tonight : '') + '</div>' : '') + '</div>';
      stage.appendChild(f);
      const ms = (a.flashSecs || 6) * 1000;
      f.animate([{ opacity: 0 }, { opacity: 1, offset: 0.04 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
      f.querySelector('.edge').animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 500, iterations: Math.ceil(ms / 500) });
      f.querySelector('.card').animate([{ transform: 'translateY(-900px) rotate(-40deg)' }, { transform: 'translateY(30px) rotate(-6deg)', offset: 0.7 }, { transform: 'rotate(-10deg)' }], { duration: 650, easing: 'cubic-bezier(.3,1.2,.5,1)' });
      f.querySelector('.tx').animate([{ opacity: 0, transform: 'translateX(120px)' }, { opacity: 1, transform: 'none' }], { duration: 500, delay: 300, fill: 'backwards' });
      if (window.SFX) { SFX.play('whistle', 0, true); SFX.play('impact', 0.3); SFX.play('ooh', 0.5); }
      setTimeout(() => f.remove(), ms + 100);
    }
    if (a.stay !== false) {
      if (!redEl) { redEl = document.createElement('div'); redEl.className = 'xred'; stage.appendChild(redEl); }
      redEl.innerHTML = (img ? '<img class="mini" src="' + img + '" alt="">' : '<i class="mini"></i>') + '<div><b>' + esc(a.rule.title) + '</b><span>' + esc(a.rule.text || '') + '</span>' + (a.kind && a.kind !== 'warn' ? '<span style="color:' + (a.kind === 'yellow2' ? '#ffd23f' : '#ff8080') + '">' + (a.kind === 'yellow2' ? 'TWO YELLOWS' : 'STRAIGHT RED') + (a.ban ? ' · ' + a.ban + ' MATCH BAN' : '') + '</span>' : '') + (a.player ? '<span style="color:#fff">' + esc(a.player) + (a.count ? ' · ' + a.count.tonight + ' tonight' : '') + '</span>' : '') + '</div>';
      if (!a.replay) redEl.animate([{ opacity: 0 }, { opacity: 0, offset: 0.85 }, { opacity: 1 }], { duration: (a.flashSecs || 6) * 1000 });
    } else if (redEl) { redEl.remove(); redEl = null; }
  }
  // ---------- BBR Replay (v24): the clip plays in OBS under the overlay, the game + camera sit in boxes;
  // this draws the Boss Sports News graphics, the analysis drawings, and plays the intro music ----------
  let rpEl = null, rpTick = null, rpSeen = new Set(), rpB = null, rpMusic = null;
  function rpSound(m, out) {
    if (!m) return;
    try { if (rpMusic) { rpMusic.pause(); rpMusic = null; } } catch (e) { /* ignore */ }
    if (out) { if (m.outro && window.SFX) SFX.play('swoosh', 0, Math.max(0.2, m.vol || 0.7)); return; }
    if (m.src) { try { rpMusic = new Audio(m.src); rpMusic.volume = Math.max(0, Math.min(1, m.vol == null ? 0.7 : m.vol)); rpMusic.play().catch(() => {}); } catch (e) { /* ignore */ } return; }
    if (window.SFX) { SFX.play('whoosh', 0, m.vol || 0.7); SFX.play('impact', 0.32); SFX.play('fanfare', 0.42); }   // built-in BSN sting
  }
  // v32: what each game's replay says (brand on the bug, the sting's small line, the wall's big letters)
  const RPG = {
    football: { brand: 'BOSS SPORTS NEWS', wm: 'BSN', word: 'REPLAY', live: 'LIVE', gx: '' },
    ets: { brand: 'BBR HAULAGE · DASHCAM', wm: 'BBR', word: 'DASHCAM REPLAY', live: 'BACK ON THE ROAD', gx: 'rec' },
    ats: { brand: 'BBR FREIGHT LINES · DASHCAM', wm: 'BBR', word: 'DASHCAM REPLAY', live: 'BACK ON THE ROAD', gx: 'rec' },
    heist: { brand: 'COAST NEWS 24 · CAUGHT ON CAMERA', wm: 'CCTV', word: 'INSTANT REPLAY', live: 'BACK ON THE JOB', gx: 'cctv' },
    arc: { brand: 'RAIDER CAM', wm: 'ARC', word: 'RAID REPLAY', live: 'BACK TOPSIDE', gx: 'haz' },
    mgs: { brand: 'MISSION LOG', wm: 'MGS', word: 'MISSION REPLAY', live: 'MISSION RESUMED', gx: 'scan' },
    neon: { brand: 'BIGBOSSROBINSON', wm: 'BBR', word: 'REPLAY', live: 'LIVE', gx: '' },
  };
  const rpg = (g) => RPG[g] || RPG.football;
  function rpSting(out, music, style) {
    const s = document.createElement('div'); s.className = 'xrps g-' + (RPG[style] ? style : 'football'); const G = rpg(style);
    s.innerHTML = '<div class="b1"></div><div class="b3"></div><div class="b2"></div><div class="tx"><small>' + esc(G.brand) + '</small><b>' + esc(out ? G.live : G.word) + '</b></div>';
    stage.appendChild(s);
    const ms = 1100;
    s.animate([{ transform: 'translateX(-115%)' }, { transform: 'translateX(0)', offset: 0.32 }, { transform: 'translateX(0)', offset: 0.62 }, { transform: 'translateX(115%)' }], { duration: ms, easing: 'cubic-bezier(.65,0,.3,1)', fill: 'forwards' });
    s.querySelector('.tx').animate([{ opacity: 0, letterSpacing: '40px' }, { opacity: 1, letterSpacing: '18px', offset: 0.35 }, { opacity: 1, offset: 0.6 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    rpSound(music, out);
    setTimeout(() => s.remove(), ms + 50);
  }
  const box = (r, cls, inner) => '<div class="' + cls + '" style="left:' + r.x + 'px;top:' + r.y + 'px;width:' + r.w + 'px;height:' + r.h + 'px">' + (inner || '') + '</div>';
  function rpHoles(B) {   // studio: the wall with see-through holes where OBS shows the clip, the game and the camera
    const R = [B.clip, B.live, B.cam].filter(Boolean), pts = ['0 0', '1920px 0', '1920px 1080px', '0 1080px', '0 0'];
    for (const r of R) pts.push(r.x + 'px ' + r.y + 'px', (r.x + r.w) + 'px ' + r.y + 'px', (r.x + r.w) + 'px ' + (r.y + r.h) + 'px', r.x + 'px ' + (r.y + r.h) + 'px', r.x + 'px ' + r.y + 'px', '0 0');
    return 'clip-path:polygon(evenodd,' + pts.join(',') + ')';
  }
  const LINK_I = { twitch: ['T', '#9146ff', '#fff'], kick: ['K', '#53fc18', '#061233'], youtube: ['Y', '#ff2a3d', '#fff'] };
  const linksHtml = (L) => (L || []).map((l) => '<span><i style="background:' + LINK_I[l.k][1] + ';color:' + LINK_I[l.k][2] + '">' + LINK_I[l.k][0] + '</i>' + esc(l.text) + '</span>').join('');
  function rpDraw(shapes) {
    if (!rpEl || !rpB || !window.BBRDRAW) return;
    const layer = rpEl.querySelector('.dw'); if (!layer) return;
    layer.innerHTML = BBRDRAW.svg(shapes || [], rpB.clip.w, rpB.clip.h, { seen: rpSeen });
    (shapes || []).forEach((x) => rpSeen.add(x.id));
    if (!(shapes || []).length) rpSeen = new Set();
  }
  function replayEv(a) {
    if (a.action === 'sting') return rpSting(!!a.out, a.music, a.style);
    if (a.action === 'stop') { clearInterval(rpTick); if (rpEl) { rpEl.remove(); rpEl = null; } stage.classList.remove('rp-on'); rpSeen = new Set(); return; }
    if (a.action === 'draw') return rpDraw(a.shapes);
    if (a.action === 'freeze' && rpEl) {
      rpEl.classList.toggle('frozen', !!a.on);
      const bb = rpEl.querySelector('.bug b'); if (bb) bb.textContent = a.on ? 'ANALYSIS' : (rpEl.dataset.lbl || 'REPLAY');
      return;
    }
    // v32: you scrubbed / jumped: the countdown and the bar follow
    if (a.action === 'pos' && rpEl) {
      if (a.endsAt) rpEl._end = a.endsAt;
      const bar = rpEl.querySelector('.pr u'); if (bar && a.endsAt) { const w = bar.getBoundingClientRect().width / Math.max(1, bar.parentNode.getBoundingClientRect().width) * 100; bar.getAnimations().forEach((x) => x.cancel()); bar.animate([{ width: w + '%' }, { width: '100%' }], { duration: Math.max(300, a.endsAt - Date.now()), fill: 'forwards' }); }
      return;
    }
    if (a.action === 'phase' && rpEl) {
      const sp = rpEl.querySelector('.rsp'); if (sp) { sp.textContent = (a.speed || 0.5) + '×'; sp.hidden = false; }
      const sm = rpEl.querySelector('.rsm'); if (sm) { sm.hidden = false; sm.animate([{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }], { duration: 400 }); }
      return;
    }
    if (a.action !== 'play') return;
    if (!document.getElementById('bbrdrawcss') && window.BBRDRAW) { const st = document.createElement('style'); st.id = 'bbrdrawcss'; st.textContent = BBRDRAW.CSS; document.head.appendChild(st); }
    clearInterval(rpTick); if (rpEl) rpEl.remove(); rpSeen = new Set();
    const B = a.boxes, studio = a.look === 'studio', el = document.createElement('div'); rpB = B;
    const G = rpg(a.style);
    el.className = 'xrp bbrdraw ' + (studio ? 'studio' : 'quick') + ' g-' + (RPG[a.style] ? a.style : 'football');
    const lbl = a.ofNight ? 'REPLAY OF THE NIGHT' : 'REPLAY', moment = a.ofNight ? String(a.label || '').replace(/^REPLAY OF THE NIGHT ?·? ?/, '') : a.label;
    el.dataset.lbl = lbl;
    let h = '';
    if (studio) h += '<div class="wall" style="' + rpHoles(B) + (a.wall ? ';background:url(' + esc(a.wall) + ') center/cover' : '') + '">' + (a.wall ? '' : '<div class="sweep"></div><div class="sweep2"></div><div class="wm">' + esc(G.wm) + '</div>') + '</div>' + box({ x: B.clip.x - 4, y: B.clip.y - 4, w: B.clip.w + 8, h: B.clip.h + 8 }, 'fr clipfr', '<i class="topbar"></i>');
    else h += '<div class="edge"></div>';
    h += box({ x: B.live.x - 4, y: B.live.y - 4, w: B.live.w + 8, h: B.live.h + 8 }, 'fr live', '<span class="tg red">LIVE</span>');
    if (B.cam) h += box({ x: B.cam.x - 4, y: B.cam.y - 4, w: B.cam.w + 8, h: B.cam.h + 8 }, 'fr cam', '<span class="tg navy">THE BOSS</span>');
    h += '<div class="dw" style="left:' + B.clip.x + 'px;top:' + B.clip.y + 'px;width:' + B.clip.w + 'px;height:' + B.clip.h + 'px"></div>';
    const links = (a.links || []).length;
    if (!studio && links) h += '<div class="lk top">' + linksHtml(a.links) + '<em class="cdw"></em></div>';
    const bx = studio ? B.clip.x : 40, by = studio ? B.clip.y - 96 : (links ? 70 : 40);
    h += '<div class="bug" style="left:' + bx + 'px;top:' + by + 'px"><b>' + lbl + '</b><s>' + esc(G.brand) + '</s><span class="rsp"' + (a.speed < 1 ? '' : ' hidden') + '>' + a.speed + '×</span></div>';
    h += '<div class="sub" style="left:' + (bx + 2) + 'px;top:' + (by + 52) + 'px">CLIP #' + a.n + ' · <u class="cd"></u><b class="fz">FROZEN · ANALYSIS</b></div>';
    h += '<div class="rsm" hidden style="left:' + (studio ? B.clip.x + 20 : bx + 2) + 'px;top:' + (studio ? B.clip.y + 16 : by + 84) + 'px">SLOW MOTION</div>';
    const lx = studio ? B.clip.x : 40, ly = studio ? B.clip.y + B.clip.h + 16 : 1080 - 70 - 76, lw = studio ? B.clip.w : 820;
    h += '<div class="lt" style="left:' + lx + 'px;top:' + ly + 'px;width:' + lw + 'px">' + (moment || a.score ? '<div class="row"><b>' + esc(moment || 'REPLAY') + '</b>' + (a.score ? '<span>' + esc(a.score) + '</span>' : '') + '</div>' : '') + '<div class="pr"><u></u></div></div>';
    if (studio && B.score && a.score) h += box(B.score, 'scp', '<small>SCORE</small><b>' + esc(a.score) + '</b>');
    if (studio && links) h += '<div class="lk st" style="left:' + B.clip.x + 'px;top:' + (B.clip.y + B.clip.h + 96) + 'px;width:' + (B.live.x + B.live.w - B.clip.x) + 'px"><strong>WATCH LIVE</strong>' + linksHtml(a.links) + '</div>';
    // game touches: dashcam REC + clock for the trucks, CCTV for GTA, hazard stripes for Arc, scanlines for Metal Gear
    if (G.gx === 'rec' || G.gx === 'cctv') h += '<div class="gx rec"><i></i><span>' + (G.gx === 'cctv' ? 'CAM 04 · ' : 'REC · ') + '<em class="gxt"></em></span></div>';
    if (G.gx === 'cctv' || G.gx === 'scan') h += '<div class="gx scan"></div>';
    if (G.gx === 'haz') h += '<div class="gx haz" style="top:0"></div><div class="gx haz" style="bottom:0"></div>';
    el.innerHTML = h; stage.appendChild(el); rpEl = el; stage.classList.add('rp-on');
    const gxt = el.querySelector('.gxt'); if (gxt) { const tk = () => { if (!el.isConnected) return; const d = new Date(); gxt.textContent = [d.getHours(), d.getMinutes(), d.getSeconds()].map((n) => String(n).padStart(2, '0')).join(':'); setTimeout(tk, 1000); }; tk(); }
    el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 250 });
    const bar = el.querySelector('.pr u'); if (bar) bar.animate([{ width: '0%' }, { width: '100%' }], { duration: a.total * 1000, fill: 'forwards' });
    el._end = a.endsAt || (Date.now() + a.total * 1000);
    const t = () => { if (el.classList.contains('frozen')) { el._end += 500; return; } const n = Math.max(0, Math.ceil((el._end - Date.now()) / 1000)); el.querySelectorAll('.cd').forEach((x) => { x.textContent = n + 's to live'; }); const c2 = el.querySelector('.cdw'); if (c2) c2.textContent = 'BACK TO LIVE IN ' + n; };
    t(); rpTick = setInterval(t, 500);
  }
  // ---------- Man of the Match vote ----------
  let mmEl = null, mmT = null;
  function motm(a) {
    if (!on('squadSheet')) return;
    if (a.phase === 'none') { if (mmEl) { mmEl.remove(); mmEl = null; } return; }
    if (a.phase === 'open') {
      if (!mmEl) { mmEl = document.createElement('div'); mmEl.className = 'xmm'; stage.appendChild(mmEl); mmEl.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 400 }); }
      const tot = Math.max(1, a.cands.reduce((x, c) => x + c.n, 0)), endAt = a.endsAt;
      mmEl.innerHTML = '<div class="h"><b>MAN OF THE MATCH</b><span id="mmT"></span></div><div class="s">type <u>!motm</u> + name or number</div>' + a.cands.map((c, i) => '<div class="r"><i>' + (i + 1) + '</i><b>' + esc(c.name) + '</b><em>' + c.n + '</em><div class="bar"><u style="width:' + (c.n / tot * 100) + '%"></u></div></div>').join('');
      clearInterval(mmT); const t = () => { const e = document.getElementById('mmT'); if (e) e.textContent = Math.max(0, Math.round((endAt - Date.now()) / 1000)) + 's'; }; t(); mmT = setInterval(t, 1000);
      return;
    }
    if (a.phase === 'result') {
      clearInterval(mmT); if (mmEl) { mmEl.remove(); mmEl = null; }
      const el = document.createElement('div'); el.className = 'xmmw';
      el.innerHTML = '<small>MAN OF THE MATCH</small><b>' + esc(a.winner) + '</b><span>' + a.pct + '% of ' + a.total + ' votes' + (a.points ? ' · +' + a.points + ' card point' + (a.points > 1 ? 's' : '') : '') + '</span>';
      stage.appendChild(el);
      el.animate([{ opacity: 0, transform: 'translateX(-50%) scale(1.4)' }, { opacity: 1, transform: 'translateX(-50%) scale(1)', offset: 0.06 }, { opacity: 1, offset: 0.9 }, { opacity: 0 }], { duration: 7000, fill: 'forwards' });
      if (window.SFX) { SFX.play('fanfare', 0); SFX.play('cheer', 0.3, 2); }
      setTimeout(() => el.remove(), 7100);
    }
  }
  // ---------- Hall of Shame (all-time red card offenders) ----------
  function shame(a) {
    if (!on('redCard')) return;
    document.querySelectorAll('.xsh').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'xsh';
    el.innerHTML = '<div class="h"><small>' + (a.period === 'season' ? 'THIS SEASON' : a.period === 'month' ? 'THIS MONTH' : a.period === 'tonight' ? 'TONIGHT' : 'ALL TIME') + '</small><b>HALL OF SHAME</b></div><div class="l">' +
      a.rows.map((r, i) => '<div class="r"><i>' + (i + 1) + '</i><b>' + esc(r.name) + '</b><span class="cs">' + (r.red ? '<u class="mc"></u>' + r.red : '') + (r.y2 ? '<span style="margin-left:14px;display:inline-flex;align-items:center"><u class="mc y"></u><u class="mc y"></u>' + r.y2 + '</span>' : '') + '</span>' + (r.banLeft ? '<em>BANNED ' + r.banLeft + '</em>' : '') + '</div>').join('') + '</div>';
    stage.appendChild(el);
    const ms = (a.secs || 14) * 1000;
    el.animate([{ opacity: 0, transform: 'translateX(60px)' }, { opacity: 1, transform: 'none', offset: 0.05 }, { opacity: 1, offset: 0.94 }, { opacity: 0 }], { duration: ms, fill: 'forwards' });
    el.querySelectorAll('.r').forEach((r, i) => r.animate([{ opacity: 0, transform: 'translateX(40px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 500 + (a.rows.length - i) * 220, fill: 'backwards' }));
    if (window.SFX) SFX.play('whistle', 0, true);
    setTimeout(() => el.remove(), ms + 100);
  }
  // ---------- Matchday Squad ----------
  let sqEl = null;
  function squadBox(a) {
    const sh = a.sheet;
    if (!on('squadSheet') || !sh) { if (sqEl) { sqEl.remove(); sqEl = null; } return; }
    if (!sqEl) { sqEl = document.createElement('div'); sqEl.className = 'xsq'; stage.appendChild(sqEl); }
    const names = sh.players.filter((p) => p.tag !== 'BOSS').map((p) => p.name);
    sqEl.innerHTML = '<div class="h"><span>' + esc(a.clubName) + ' · MATCH ' + sh.match + '</span><span>!squad</span></div><div class="l"><b>ON:</b> ' + esc(names.join(', ')) + '</div>' + (sh.bench.length ? '<div class="l"><b>NEXT IN:</b> ' + esc(sh.bench.slice(0, 6).join(', ')) + (sh.bench.length > 6 ? ' +' + (sh.bench.length - 6) : '') + '</div>' : '');
  }
  function teamSheet(a) {
    const sh = a.sheet; if (!sh || !on('squadSheet')) return;
    document.querySelectorAll('.xts').forEach((x) => x.remove());
    const el = document.createElement('div'); el.className = 'xts';
    el.innerHTML = '<div class="h"><b>' + esc(a.clubName) + ' · MATCH ' + sh.match + '</b><span>TEAM SHEET</span></div><div class="g">' +
      sh.players.map((p, i) => '<div class="p"><i' + (p.pos ? ' class="ps"' : '') + '>' + (p.pos ? esc(p.pos) : i + 1) + '</i><b>' + esc(p.name) + '</b>' + (p.tag ? '<span class="t ' + esc(p.tag) + '">' + esc(p.tag) + '</span>' : '') + '</div>').join('') + '</div>' +
      (sh.bench.length ? '<div class="b"><small>BENCH · FIRST IN NEXT MATCH</small><div>' + esc(sh.bench.slice(0, 10).join(' · ')) + (sh.bench.length > 10 ? ' +' + (sh.bench.length - 10) + ' more' : '') + '</div></div>' : '') +
      (sh.banned && sh.banned.length ? '<div class="b" style="border-top:0;padding-top:0"><small style="color:#ff6b7d">BANNED (RED CARD RULE)</small><div>' + esc(sh.banned.join(' · ')) + '</div></div>' : '') +
      (sh.overflow && sh.overflow.length ? '<div class="b"><small>' + esc(sh.overflowName) + '</small><div>' + esc(sh.overflow.join(' · ')) + '</div></div>' : '');
    stage.appendChild(el);
    el.animate([{ opacity: 0, transform: 'translateX(-50%) translateY(-40px)' }, { opacity: 1, transform: 'translateX(-50%)', offset: 0.05 }, { opacity: 1, offset: 0.93 }, { opacity: 0 }], { duration: 15000, fill: 'forwards' });
    el.querySelectorAll('.p').forEach((p, i) => p.animate([{ opacity: 0, transform: 'translateX(-30px)' }, { opacity: 1, transform: 'none' }], { duration: 350, delay: 400 + i * 120, fill: 'backwards' }));
    if (window.SFX) { SFX.play('whistle', 0, true); SFX.play('cheer', 0.4, 2); }
    setTimeout(() => el.remove(), 15100);
  }
  function event(a) {
    switch (a.type) {
      case 'squad': return squadBox(a);
      case 'squadsheet': squadBox(a); return teamSheet(a);
      case 'redcard': return redcard(a);
      case 'shame': return shame(a);
      case 'motm': return motm(a);
      case 'replay': return replayEv(a);
      case 'bossrecord': case 'bossturn': return;
      case 'mvp': return mvp(a);
      case 'mvprace': return mvpRace(a);
      case 'chat': return chatMsg(a);
      case 'chatcfg': chatS = a.S || chatS; if (chatEl) chatEl.style.setProperty('--fs', chatS.size + 'px'); return;
      case 'counters': ctrs = a.list || []; return drawCounters();
      case 'counterHit': return counterHit(a);
      case 'showcfg': return onShow(a);
      case 'layout': layout = a.pos || {}; return applyLayout();
      case 'results': res = a; return drawResults();
      case 'fulltime': return fullTime(a);
      case 'scores': scores = a.list || []; return drawScores();
      case 'scoresPanel': return scoresPanel(a);
      case 'subgoal': sg = a; return drawGoal();
      case 'hype': return hype(a);
      case 'gamebanner': return banner(a);
      case 'featured': return featured(a);
      case 'breaking': return breaking(a);
    }
  }
  window.EXTRAS = { init, event, handles: (t) => TYPES.test(t || ''), panic: () => stage && stage.classList.contains('xpanic') };
})();
