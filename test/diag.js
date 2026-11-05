const E = require('../engine.js');
const g = E.createGame('TEST', 'Host', 'tok');
for (let i = 1; i < 10; i++) E.addBot(g);
E.startGame(g); g.players[0].bot = true; g.cfg.sim = true;
const causes = {};
for (let t = 0; t < 45 && g.status === 'playing'; t++) {
  E.advanceTurn(g);
}
for (const e of g.events) if (e.k === 'dead' || e.k === 'pvp') { const m = e.text.match(/ante (.+)\./) || ['', 'pvp']; causes[m[1]] = (causes[m[1]] || 0) + 1; }
console.log(causes);
const kills = g.players.map(p => p.stats.kills); console.log('kills', kills.join(','), 'pk', g.players.map(p=>p.stats.pk).join(','));
console.log(g.events.filter(e=>e.k==='loot').length, 'loot events');
console.log(g.events.slice(-25).map(e=>e.text).join('\n'));
