'use strict';
/* Aventura de almas — modo sin conexión (v1.56).
   Carga el motor del juego (engine.js) dentro del propio celular y responde igual que el servidor,
   así el cliente no se entera de la diferencia. Las partidas se guardan en IndexedDB. */
(function () {
  const LS = window.LS = { loaded: null, E: null, games: new Map(), err: null };
  let bound = null, saveT = {}, db = null;

  // Buffer mínimo para serializar/deserializar los mapas de niebla (Uint8Array ↔ base64)
  const Buf = {
    from(v, enc) {
      if (enc === 'base64') { const s = atob(v), a = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) a[i] = s.charCodeAt(i); return a; }
      return { toString() { let s = ''; for (let i = 0; i < v.length; i += 8192) s += String.fromCharCode.apply(null, v.subarray(i, i + 8192)); return btoa(s); } };
    },
  };
  async function fetchText(url) { const r = await fetch(url, { cache: 'no-cache' }).catch(() => fetch(url)); if (!r.ok) throw new Error('No se pudo cargar ' + url); return r.text(); }
  async function loadEngine() {
    const mods = { './shared.js': window.SH };
    const req = n => { if (!mods[n]) throw new Error('módulo desconocido ' + n); return mods[n]; };
    for (const [name, url] of [['./botchat.js', '/botchat.js'], ['./engine.js', '/engine.js']]) {
      const src = await fetchText(url), m = { exports: {} };
      new Function('require', 'module', 'exports', 'Buffer', src)(req, m, m.exports, Buf);
      mods[name] = m.exports;
    }
    return mods['./engine.js'];
  }

  /* ---------- guardado en IndexedDB ---------- */
  const idb = () => new Promise((res, rej) => {
    const r = indexedDB.open('ada-local', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('games', { keyPath: 'code' });
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
  const tx = (mode, fn) => new Promise((res, rej) => { const t = db.transaction('games', mode), out = fn(t.objectStore('games')); t.oncomplete = () => res(out && out.result); t.onerror = () => rej(t.error); });
  async function loadAll() {
    try { db = await idb(); } catch (e) { db = null; LS.err = 'Sin almacenamiento local'; return; }
    const rows = await new Promise(res => { const r = db.transaction('games').objectStore('games').getAll(); r.onsuccess = () => res(r.result || []); r.onerror = () => res([]); });
    for (const row of rows) { try { const g = LS.E.deserialize(row.data); if (g && g.code) LS.games.set(g.code, g); } catch (e) { console.error('Partida local ilegible', row.code); } }
    try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) { /* nada */ }
  }
  function save(g, now) {
    if (!db || !g) return;
    clearTimeout(saveT[g.code]);
    const go = () => { try { tx('readwrite', s => s.put({ code: g.code, data: LS.E.serialize(g) })); } catch (e) { console.error('No se pudo guardar', e); } };
    if (now) go(); else saveT[g.code] = setTimeout(go, 500);
  }
  LS.flush = () => { for (const g of LS.games.values()) if (saveT[g.code]) save(g, true); };
  LS.remove = code => { LS.games.delete(code); clearTimeout(saveT[code]); if (db) try { tx('readwrite', s => s.delete(code)); } catch (e) { /* nada */ } };
  LS.ensure = () => LS.loaded || (LS.loaded = (async () => { LS.E = await loadEngine(); await loadAll(); })().catch(e => { LS.err = e.message || String(e); LS.loaded = null; throw e; }));

  /* ---------- servidor de bolsillo ---------- */
  const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  const rnd = n => { let s = ''; for (let i = 0; i < n; i++) s += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]; return s; };
  const token = () => Array.from(crypto.getRandomValues(new Uint8Array(18)), b => b.toString(16).padStart(2, '0')).join('');
  const setLocal = g => { g.cfg.local = true; g.cfg.turnHours = 168; g.cfg.idleTurns = 0; if (g.cfg.mode === 'mundo') g.cfg.mode = 'normal'; };

  LS.handle = function (m) {
    const E = LS.E, out = [], reply = o => out.push(o);
    const g = bound && LS.games.get(bound.code), me = g && g.players[bound.pid];
    const state = () => { if (g) reply({ t: 's', s: E.snapshot(g, bound.pid) }); };
    try {
      if (m.t === 'create') {
        const name = String(m.name || '').trim().slice(0, 14);
        if (!name) return [{ t: 'err', m: 'Escribe tu nombre' }];
        if (LS.games.size >= 30) return [{ t: 'err', m: 'Tienes demasiadas partidas sin conexión; borra alguna' }];
        let code; do code = 'L' + rnd(4); while (LS.games.has(code));
        const tok = token(), ng = E.createGame(code, name, tok);
        setLocal(ng); LS.games.set(code, ng); bound = { code, pid: 0, tok }; save(ng, true);
        return [{ t: 'joined', code, token: tok, pid: 0, name: ng.players[0].name, vapid: null, local: true }, { t: 's', s: E.snapshot(ng, 0) }];
      }
      if (m.t === 'auth') {
        const ag = LS.games.get(String(m.code || '').toUpperCase().trim()), p = ag && ag.players.find(x => x.token && x.token === m.token);
        if (!p) return [{ t: 'authfail' }];
        bound = { code: ag.code, pid: p.id, tok: p.token };
        return [{ t: 'joined', code: ag.code, token: p.token, pid: p.id, name: p.name, vapid: null, local: true }, { t: 's', s: E.snapshot(ag, p.id) }];
      }
      if (m.t === 'leave') { LS.flush(); bound = null; return [{ t: 'left' }]; }
      if (m.t === 'mygames') {
        const list = [];
        for (const q of (Array.isArray(m.games) ? m.games : [])) {
          const lg = LS.games.get(String(q.code || '').toUpperCase().trim()), p = lg && lg.players.find(x => x.token && x.token === q.token);
          if (!p) { list.push({ code: q.code, ok: false }); continue; }
          list.push({ code: lg.code, ok: true, local: true, status: lg.status, turn: lg.turn, n: lg.players.length, name: p.name, host: lg.players[0] === p, ready: !!p.ready, auto: false, alive: p.alive !== false, endsAt: 0, winner: lg.winner === undefined ? null : lg.winner, you: p.id });
        }
        return [{ t: 'mygames', local: true, now: Date.now(), games: list }];
      }
      if (m.t === 'ping') return [{ t: 'pong' }];
      if (!g || !me) return [];
      if (m.t === 'seen') { if (g.status === 'playing') E.markSeen(g, bound.pid); return []; }
      if (m.t === 'push' || m.t === 'acc') return m.t === 'acc' ? [{ t: 'acc', a: m.a, err: 'Las cuentas necesitan conexión' }] : [];
      if (m.t === 'lobby') {
        if (g.status !== 'lobby') return [];
        if (m.a === 'addbot') { if (!E.addBot(g, String(m.pers || ''))) return [{ t: 'err', m: 'No caben más jugadores' }]; }
        else if (m.a === 'remove') { const target = g.players.find(p => p.id === (m.id | 0)); if (!target || target.id === g.hostId) return []; E.removePlayer(g, target.id); }
        else if (m.a === 'cfg') {
          const S = window.SH;
          if (m.mode === 'mundo') reply({ t: 'err', m: 'El mundo abierto necesita conexión: es un reloj compartido' });
          const mt = m.maxTurns | 0; if (mt >= 0 && mt <= 1000) g.cfg.maxTurns = mt;
          if (['facil', 'normal', 'dificil'].includes(m.botLevel)) g.cfg.botLevel = m.botLevel;
          for (const k of Object.keys(S.WORLD_OPTS)) {
            const o = S.WORLD_OPTS[k];
            if (m[k] !== undefined && Object.prototype.hasOwnProperty.call(o.o, String(m[k])) && !(k === 'mode' && String(m[k]) === 'mundo')) g.cfg[k] = typeof o.def === 'number' ? Number(m[k]) : String(m[k]);
          }
        }
        else if (m.a === 'start') { setLocal(g); const err = E.startGame(g); if (err) return [{ t: 'err', m: err }]; }
        setLocal(g); save(g); state(); return out;
      }
      if (m.t === 'chat') { const err = E.chat(g, bound.pid, m.text, !!m.al); if (err) return [{ t: 'err', m: err }]; save(g); state(); return out; }
      if (m.t === 'cmd') {
        if (m.a === 'release') return [{ t: 'err', m: 'No hay jugadores que liberar en una partida sin conexión' }];
        if (m.a === 'force') { if (g.status !== 'playing') return []; E.advanceTurn(g); setLocal(g); save(g); state(); return out; }
        const r = E.cmd(g, bound.pid, m);
        if (r.err) return [{ t: 'err', m: r.err }];
        if (r.msg) reply({ t: 'msg', m: r.msg });
        if (m.a === 'ready' && g.status === 'playing') {
          const humans = g.players.filter(p => p.alive && !p.bot && !p.auto);
          if (humans.length && humans.every(p => p.ready)) { E.advanceTurn(g); setLocal(g); }
        }
        save(g); state(); return out;
      }
    } catch (e) { console.error('Modo sin conexión', e); return [{ t: 'err', m: 'Error interno del modo sin conexión' }]; }
    return out;
  };
  window.addEventListener('pagehide', () => { try { LS.flush(); } catch (e) { /* nada */ } });
  document.addEventListener('visibilitychange', () => { if (document.hidden) try { LS.flush(); } catch (e) { /* nada */ } });
})();
