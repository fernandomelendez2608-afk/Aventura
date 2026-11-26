// Banco de pruebas de bots: 3 partidas de 4 bots (150 turnos) y estadísticas de muertes. Uso: node tools/botbench.js
require('../test/seed.js');
const E=require('../engine.js');
const S=require('../shared.js');
const D=[];global.__bd=(g,u,by)=>{if(u.sm||u.cart)return;const al=g.units.filter(v=>v.o===u.o&&v!==u&&Math.max(Math.abs(v.x-u.x),Math.abs(v.y-u.y))<=3).length;
 const near=g.cities.some(c=>c.owner===u.o&&Math.max(Math.abs(c.x-u.x),Math.abs(c.y-u.y))<=4);
 D.push({t:g.turn,lv:u.lv,by:by&&by.creature?'cre:'+(by.creature.t||''):by&&by.unit?'pvp':'otro',al,near,role:u.role,hpmax:1})};
const res=[];
for(const seed of ['D1','D2','D3']){const g=E.createGame(seed,'H','t');g.cfg.mode='normal';g.cfg.sim=true;for(let i=0;i<4;i++)E.addBot(g,'azar');E.startGame(g);
 for(let t=0;t<150;t++)E.advanceTurn(g);}
const by={};for(const d of D){const k=d.by.startsWith('cre')?'criatura':d.by;by[k]=(by[k]||0)+1}
console.log('muertes',D.length,JSON.stringify(by));
const solo=D.filter(d=>d.al===0).length;console.log('sin aliados a 3 casillas:',solo,'/',D.length,' cerca de ciudad:',D.filter(d=>d.near).length);
const lvl={};D.forEach(d=>{lvl[d.lv]=(lvl[d.lv]||0)+1});console.log('por nivel',JSON.stringify(lvl));
const roles={};D.forEach(d=>{roles[d.role]=(roles[d.role]||0)+1});console.log('por rol',JSON.stringify(roles));
const cres={};D.filter(d=>d.by.startsWith('cre')).forEach(d=>{cres[d.by]=(cres[d.by]||0)+1});console.log(JSON.stringify(cres));
const early=D.filter(d=>d.t<=40).length;console.log('muertes en los primeros 40 turnos:',early);
