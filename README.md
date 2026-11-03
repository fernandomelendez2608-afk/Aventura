# Aventura de almas

Juego de estrategia por turnos tipo Civ, pensado para **celular** y para jugar con amigos durante días (hasta 10 jugadores, con bots para completar la sala).

Sin dependencias: solo Node.js 18+ (`npm start`). El cliente es una página web, se abre desde el navegador del celular.

## Cómo se juega

- Cada jugador empieza con **una capital y 4 unidades idénticas** (sin armas ni armadura, 1 punto de habilidad).
- Los turnos son **simultáneos**: todos mueven a la vez. El turno termina cuando todos los humanos pulsan **Fin de turno** o cuando se acaba el tiempo (configurable de 3 min a 24 h).
- **Mundo vivo**: aparecen criaturas con el tiempo (ciervos, jabalíes, lobos, osos, goblins, esqueletos, orcos, trolls) que **suben de nivel** cada 10 turnos, y **jefes** (Rey Lobo, Liche, Dragón de Ceniza) que dan almas y acero. Cuanto más lejos de tu capital, más peligro.
- **Botín**: cada criatura suelta cuero, hueso, hierro, acero y (las fuertes) **almas**. El botín va a la **mochila de la unidad** que la derrota (30 de peso).
- **Ciudades**: junto a una ciudad tuya (casilla adyacente) la unidad deposita el botín, toma materiales, se equipa y se cura. En la ciudad se **forja** el equipo (hasta 4 objetos por turno) y se **reclutan** más unidades (hasta 14). Las aldeas sin dueño se conquistan entrando en ellas.
- **Subir de nivel** (+1 punto por nivel, hasta nivel 20), cada punto a elegir:
  | Habilidad | Efecto |
  |---|---|
  | Daño | +2 de daño |
  | Salud | +6 de salud máxima |
  | Movilidad | +1 casilla (máx. 2 puntos) |
  | Médico | cura a aliados adyacentes 4% de su salud por punto, al inicio del turno |
  | Doble ataque | 2 ataques por turno (el 2.º al 60%). Solo 1 punto |
  | Defensa | +2 de defensa |
  | General | aliados adyacentes ganan +2% de salud y defensa por punto |
- **Armas**: daga (ignora 25% defensa, +1 mov.), espada, arco (alcance 3), arco largo (alcance 5, no dispara a adyacentes), ballesta (alcance 4, ignora 40% defensa, un disparo por turno), escudo (solo con armas de una mano).
- **Armaduras**: casco, guantes, hombreras, pechera, pantalones, botas. 
- **Materiales → calidad**: Hueso/Cuero → Hierro → Acero → **Alma** (cada escalón multiplica el daño/defensa).
- Niebla de guerra: solo ves lo que tus unidades y ciudades alcanzan a ver.
- Ganas siendo el último en pie, o por puntos si pusiste límite de turnos.

## Probarlo en tu computador

```bash
npm start
# abre http://localhost:3000 en el navegador (o en el celular, con la IP de tu PC)
```

Pruebas incluidas: `npm run sim` (10 bots jugando 150 turnos) y `node test/e2e.js` (servidor + clientes WebSocket).

## Desplegar en Render (gratis)

1. Sube esta carpeta a un repositorio de GitHub.
2. En Render: **New → Web Service**, elige el repositorio.
   - Runtime: **Node**
   - Build command: *(vacío o `npm install`)*
   - Start command: `npm start`
   - Plan: Free
3. (Opcional) En *Environment* agrega `ADMIN_KEY` con una clave tuya para poder descargar/restaurar copias de seguridad.
4. Abre la URL que te da Render en el celular de cada amigo. Uno crea la partida y comparte el **código de 5 letras**.

> Los amigos pueden «instalar» la página en la pantalla de inicio desde el menú del navegador.

## Mantener el servidor despierto (el celular vigía)

El plan gratis de Render **duerme el servicio tras ~15 min sin visitas** y, al dormirse, **borra los archivos locales** (por eso se pierde el guardado). Para partidas de días:

1. En un celular que quede enchufado abre `https://TU-APP.onrender.com/vigia` y pulsa *Mantener pantalla encendida*. Esa página avisa al servidor cada minuto. (El servidor también se auto-avisa cada 9 minutos usando `RENDER_EXTERNAL_URL`.)
2. Alternativa sin celular: un monitor gratuito (p. ej. UptimeRobot) que visite `/health` cada 5 minutos.

### Importante sobre el guardado

- El estado se guarda en `data/games.json` cada ~10 s y al cerrar. Mientras el servicio **no se reinicie ni se vuelva a desplegar**, la partida sigue.
- En el plan gratis ese archivo **no sobrevive a un reinicio/despliegue**. Para protegerte:
  - Descarga una copia de vez en cuando: `https://TU-APP.onrender.com/api/backup?key=TU_ADMIN_KEY`
  - Para restaurar: `curl -X POST --data-binary @aventura-de-almas-backup.json "https://TU-APP.onrender.com/api/restore?key=TU_ADMIN_KEY"` (los jugadores entran solos de nuevo: su sesión queda guardada en el celular).
  - Para guardado permanente real usa un *Disk* de Render (plan de pago) y la variable `DATA_DIR=/ruta/del/disk`.
- Si el servidor se reinicia, el turno en curso recibe unos minutos extra en lugar de avanzar de golpe.

## Estructura

```
server.js        HTTP + WebSocket, salas, reloj de turnos, guardado
engine.js        reglas del juego, mapa, combate, criaturas, bots
ws-lite.js       WebSocket mínimo (sin dependencias)
public/index.html  cliente móvil (mapa táctil: arrastrar, pellizcar para zoom, tocar)
public/shared.js   datos compartidos (armas, recetas, criaturas, pathfinding)
public/vigia.html  página para el celular que mantiene despierto el servidor
```

## Controles en el celular

- **Tocar una unidad**: la selecciona (casillas azules = a dónde puede moverse, borde rojo = enemigos que puede atacar).
- **Tocar una casilla azul**: mover. **Tocar un enemigo marcado**: atacar (si está lejos, la unidad se acerca sola).
- **Tocar una de tus ciudades**: almacén, forja y reclutamiento.
- Arrastrar para desplazar el mapa; pellizcar para acercar/alejar.
- Barra inferior: unidades (el número rojo = unidades con puntos por gastar), ciudades, registro, jugadores y **Fin de turno**.

## Ajustar el equilibrio

Casi todo está en `public/shared.js` (armas, criaturas, recetas) y al inicio de `engine.js` (límites, pesos de habilidades de los bots, fórmulas de daño en `calcDamage`).
