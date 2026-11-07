# Aventura de almas

Juego de estrategia por turnos tipo Civ, pensado para **celular** y para jugar con amigos durante días (hasta 10 jugadores, con bots para completar la sala).

Sin dependencias: solo Node.js 18+ (`npm start`). El cliente es una página web que se abre desde el navegador del celular.

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

## Varias partidas y menú principal

- Puedes tener **varias partidas a la vez** (cada una con su código). En el menú, *Tus partidas* muestra el estado de cada una: en sala, turno actual, si **te toca jugar**, si ya terminaste, si un bot juega por ti, cuánto falta para que cierre el turno, o si terminó.
- Dentro de una partida, el botón **☰** (arriba a la izquierda) te lleva al menú sin salirte de ella. Desde ahí puedes crear otra, unirte a otra con código o **Entrar** de nuevo. La **✕** quita una partida de tu lista (la partida sigue en el servidor).
- Al recargar la página vuelves a la última partida abierta; si saliste al menú, te quedas en el menú.
- Mientras estás en el menú no cuentas como «presente»: si pasan los turnos que elegiste en la sala, un bot dirige tu ejército hasta que vuelvas.

## Mundo vivo: estaciones, élites, hordas y tesoros

- **Estaciones** (cada 12 turnos, el icono sale junto al turno): 🌸 *primavera* más animales · ☀️ *verano* tranquilo · 🍂 *otoño* las criaturas sueltan +25 % de botín · ❄️ *invierno* criaturas más agresivas (+15 % daño, ven más lejos) y hordas más seguidas.
- **Criaturas élite** ⭐ (aro morado, con nombre propio como «Furia Gris»): más fuertes, **botín doble** y siempre sueltan un **objeto raro**. Se anuncian en el registro con su zona del mapa.
- **Hordas** 🐺 (aro naranja): desde el turno 10, un grupo de criaturas avanza hacia una de las ciudades (se avisa al dueño, también por notificación). Defiende con tus unidades: se quedan unos 14 turnos y luego se dispersan.
- **Cofres** 🎁 y **ruinas** 🏛️: mueve una unidad encima para abrirlos (necesita espacio en la mochila). Los cofres dan materiales y a veces un objeto raro; las ruinas dan un objeto raro seguro y almas, pero tienen guardianes.

## Clases y especializaciones

A **nivel 6** cada unidad puede elegir una **clase** permanente (pestaña *Clase* de su ficha) y a **nivel 12** una **especialización**. Las unidades con ⭐ tienen una elección pendiente.

| Clase | Efecto base | Especializaciones |
|---|---|---|
| 🛡️ Guardián | +15 % salud, +4 defensa, aura +3 % | 🧱 Muralla (+6 def, espinas) · 💞 Protector (cura 10 %/turno, aura +4 %) |
| ⚔️ Duelista | +15 % daño, +20 % contra heridos | 🪓 Verdugo (+40 % contra heridos) · 🩸 Sanguinario (robo de vida) |
| 🏹 Cazador | +1 alcance a distancia, +1 mov., +30 % a criaturas | 🎯 Francotirador (+1 alcance, ignora defensa) · 🐾 Rastreador (+30 % criaturas, +1 mov.) |
| ✚ Sanador | +2 puntos de Médico, se cura 5 % | ⛑️ Médico de campaña (+3 Médico) · 💠 Custodio (def, aura, Médico) |
| 🗡️ Asesino | primer ataque +50 %, +1 mov., ignora 20 % defensa | 🌑 Sombra (más primer golpe y mov.) · ☠️ Envenenador (veneno) |

## Edificios en las ciudades

Pestaña **Construir** de cada ciudad (una construcción por ciudad y turno, nivel máximo 2, se paga con el almacén): 🔨 **Herrería** (+2 trabajos de forja/mejora por turno por nivel) · 🏕️ **Cuartel** (reclutar 20 % más barato por nivel; nivel 2: las unidades llegan a nivel 2) · 🧱 **Muralla** (+5 defensa por nivel dentro de la ciudad, +3 a las unidades pegadas) · 🔭 **Atalaya** (+2 casillas de visión por nivel). Si un enemigo conquista la ciudad, cada edificio baja un nivel. Los bots (Normal y Difícil) también construyen.

## Órdenes en cola y resumen al volver

- En la ficha de una unidad (pestaña *Estado*): **📍 Ir a…** (toca la casilla de destino; avanza sola cada turno y se detiene si queda muy herida), **🏠 Volver y depositar** (va a la ciudad más cercana y deja el botín) y **🛡️ Vigilar** (se queda quieta y ataca criaturas a su alcance al empezar cada turno). Moverla o atacar a mano cancela la orden. Las unidades con orden no cuentan en el botón 🛡️ de «siguiente unidad».
- Al abrir el juego después de varios turnos aparece **📜 Mientras no estabas**: unidades perdidas, ataques, botines, subidas de nivel, ciudades conquistadas, pactos, hordas y avisos de órdenes. Si ves el cambio de turno en vivo no se muestra.

## Equipo raro, mejorar y encantar

- Los objetos **raros** 🔷 (un efecto) y **épicos** 🟣 (dos efectos) salen de élites, jefes, cofres y ruinas. Efectos de arma: 🩸 robo de vida, ☠️ veneno (3 turnos), 🗡️ afilado, 🎯 certero. Efectos de armadura: 🌿 regeneración, 🌵 espinas, 🧱 dureza, 💨 ágil.
- En la ciudad, pestaña **Mejorar**: *⬆ calidad* sube un objeto al siguiente material por ~60 % del coste de forjarlo y **conserva sus efectos**; *✨ Encantar* añade un efecto elegido por ti (o al azar) por 3 almas, máximo 2 efectos. Cada trabajo cuenta como una forja del turno.

## Diplomacia

En *Jugadores* verás cada pacto y podrás proponer **paz** o **alianza** (la alianza exige paz antes). Con paz no pueden atacarse ni pisar sus ciudades; con alianza además comparten visión y sus unidades pueden cruzarse. **Si todos los que quedan son aliados, ganan juntos.** Romper la alianza vuelve a la paz; romper la paz avisa y la guerra empieza 2 turnos después. Las propuestas caducan a los 5 turnos y llegan por notificación. Los bots responden según su personalidad (un humano ausente solo acepta paz).

## Bots: personalidad y dificultad

Al agregar un bot eliges su **personalidad**: 🌾 *Granjero* (caza y construye; solo ataca a quien lo ataca), ⚖️ *Equilibrado* o ⚔️ *Conquistador* (agresivo desde el turno 1), o al azar. La **dificultad** de los bots se elige en los ajustes: *Fácil* (pocos soldados, equipo básico, muy cautos), *Normal* y *Difícil* (más ejército, mejor equipo y encantan objetos).

## Mapa y navegación

Arriba a la derecha hay un **minimapa** (toca o arrastra para ir a ese lugar; muestra ciudades, tus unidades, criaturas, jefes y tesoros). Debajo: 🏠 salta a tu capital (toca otra vez para pasar por tus otras ciudades) y 🛡️ va a la siguiente unidad con acciones disponibles (el número indica cuántas).

## Ajustes del mundo (v1.5)

Al crear la partida, el anfitrión puede elegir en el lobby, bajo «🌍 Ajustes del mundo»:

| Ajuste | Opciones |
|---|---|
| Tamaño del mapa | Pequeño · Normal · Grande · Enorme |
| Ciudades neutrales (aldeas) | Pocas · Normal · Muchas · Abundantes |
| Bioma | Mixto (al azar) · Solo bosque · Solo pradera · Solo desierto |
| Criaturas | Más pacíficas · Normal · Más agresivas (también cambia la frecuencia de hordas) |
| Unidades iniciales | 4 · 8 · 14 (máximo) |
| Nivel inicial | 1 · 3 · 6 · 10 |
| Armadura inicial | Ninguna · Hierro completa · Acero completa |

Notas: el desierto es un terreno nuevo (arena, se camina como la pradera). En «solo bosque» los caminos entre ciudades quedan despejados. Los sitios (cofres y ruinas) y las criaturas escalan con el tamaño del mapa. Las partidas guardadas antiguas reciben los valores normales.

## Carreta (v1.12)

Una mejora de ciudad (pestaña **Construir** de la ciudad, abajo del todo) que crea una **carreta**: un almacén móvil.

- **Coste:** 8 cuero, 8 hueso y 3 hierro del almacén de la ciudad.
- **Carga:** hasta **150** (una mochila normal lleva 30), con materiales y objetos. Cárgala o descárgala junto a una ciudad tuya desde su pestaña «Carga» (botones +1, Todo y «Depositar todo»).
- **Movilidad 6** (una unidad normal tiene 3).
- **No cuenta como unidad:** no ocupa puestos del tope de 14/20.
- **Máximo una por ciudad.** Si la destruyen, la ciudad puede construir otra. Si te la matan, el enemigo se queda con parte de la carga (lo que le quepa en la mochila).
- Frágil: 80 de salud, 2 de defensa. No ataca, no sube de nivel, no usa equipo ni habilidades. Si un bot toma el control de tu ejército por ausencia, no la mueve.
- No está disponible en el reto de una unidad.

## Reto de una unidad (v1.11)

En «Ajustes del mundo» → **Modo de juego: Reto de una unidad**:

- Cada jugador y cada bot tiene **una sola unidad** en toda la partida (ignora «unidades iniciales»).
- No se puede reclutar, invocar ni tener crías, y no hay protagonista (tu única unidad ya lo es).
- **Si tu unidad cae, quedas eliminado** y tus ciudades quedan libres, aunque tengas materiales.
- Sigue valiendo el nivel inicial y la armadura inicial, el tamaño del mapa, el bioma, las criaturas, etc. Una combinación divertida: nivel 6 + armadura de hierro. Las ciudades siguen sirviendo para forjar, mejorar y guardar equipo.
- Los bots no eligen invocador en este modo.

## Protagonista (v1.10)

Cada jugador (y cada bot) empieza con un **protagonista**: una de sus unidades, marcada con una corona 👑 (o el emblema que elijas).

- **Elegirlo:** en el turno 1, abre la ficha de cualquier unidad y toca «👑 Elegir como protagonista». Ahí mismo eliges el emblema (👑 🦅 🐉 🦁 🔥 ⚜️ 🌟 🛡️). Desde el turno 2 queda fijo. Puedes ponerle nombre con ✏️ en cualquier momento.
- **Bonos:** gana **+50% de experiencia** y da un **aura de +10% de daño y defensa** a tus demás unidades a 2 casillas o menos (se suma al aura de general/guardián).
- **Si cae:** vuelve a tu capital (o a otra ciudad tuya) **3 turnos después, con 2 niveles menos** y la salud llena. Si lo mató una criatura conserva su equipo; si lo mató otro jugador, ese jugador se queda con su botín como con cualquier unidad. Mientras tanto, la lista de jugadores muestra «☠️ vuelve en N turnos».
- Cuenta como una unidad más para el tope de unidades.
- El anfitrión puede desactivarlo en «Ajustes del mundo». Las partidas empezadas antes de la v1.10 no lo tienen.

## Chat de la partida (v1.9)

- Botón 💬 en la columna de botones junto al minimapa (🏠, 💬…). Muestra un número rojo con los mensajes sin leer y un aviso breve cuando llega uno nuevo.
- Mensajes de hasta 200 letras, para todos los jugadores o «solo para mis aliados 🤝» (los ve quien tenga alianza contigo).
- Se guardan con la partida (los últimos 80; se muestran 60) y también al reiniciar el servidor.
- Límite anti-spam: 5 mensajes cada 10 segundos. Los bots no escriben. Se abre cuando empieza la partida (no en la sala de espera).
- Si tienes los avisos activados y no estás mirando la partida, te llega un aviso al celular (máx. uno cada 3 minutos por partida).

## Ajustes de equilibrio (v1.8.1)

- Cuando las criaturas suben de nivel (cada 10 turnos) **ya no se curan por completo**: conservan su proporción de salud. Antes un jefe casi muerto se recuperaba entero al subir de nivel.
- El **Liche** es algo más débil: 230 de salud (antes 260) y 20 de daño (antes 24). Sigue disparando a distancia 4. Contra su defensa alta funcionan bien la ballesta (ignora 40%), el báculo/varita y los magos, y poner invocaciones delante.

## Mago, invocador y nigromante (v1.8)

Tres clases nuevas que se eligen a nivel 6 (con especialización a nivel 12), como las demás:

| Clase | Qué hace |
|---|---|
| 🔮 **Mago** | +30% de daño con báculo y varita y +1 alcance. Especializaciones: Hechicero, Arcano |
| 🐾 **Invocador** | +10% salud y +2 defensa. Invoca **lobos** (4 huesos) u **osos** (7 huesos). Especializaciones: Domador (+30% daño a sus invocaciones), Alfa (+35% salud) |
| 💀 **Nigromante** | +15% de daño mágico. Invoca **esqueletos** (4 huesos). Especializaciones: Señor de huesos (+35% salud), Maldito (+30% daño) |

**Armas mágicas nuevas:** 🪄 Báculo (dos manos, alcance 3, ignora 25% de defensa) y ✨ Varita (una mano, alcance 2, ignora 20% de defensa, admite escudo). Cualquiera puede usarlas, pero solo el mago y el nigromante reciben el bono mágico.

**Invocaciones**
- Solo se invoca a 2 casillas o menos de una ciudad tuya, gastando huesos de su almacén (botón «Invocar» en la ficha).
- **Máximo 2 invocaciones por jugador** en total (suma de todos sus invocadores y nigromantes).
- Son unidades que controlas como las demás, pero no cuentan para el tope de 14/20 unidades, no tienen habilidades ni equipo y no suben de nivel solas: su nivel es el de su invocador (con el tope de la criatura).
- Si el invocador cae, sus invocaciones desaparecen. Puedes despedirlas desde su ficha.
- Los bots también eligen estas clases y las usan.

## Crías (v1.7)

Si dos unidades tuyas están **una junto a la otra y a 2 casillas o menos de una ciudad tuya** durante 5 turnos seguidos (ambas con al menos 50% de salud), nace una cría:

- Nivel 1, con un bono fijo de nacimiento: **+10 salud y +2 daño**. Nace con la salud llena y descansa ese turno.
- Los dos padres (y la cría) deben esperar **15 turnos** antes de otra cría.
- Tope de **20 unidades** por jugador (el reclutamiento normal sigue limitado a 14). Si hay 20, la pareja espera a que haya sitio.
- Si se separan, se alejan de la ciudad o una queda herida, la cuenta vuelve a 0.
- El anfitrión lo ajusta en «Ajustes del mundo»: desactivadas, 5 turnos o 3 turnos. Las partidas ya empezadas antes de la v1.7 lo tienen desactivado.
- En la ficha de cada unidad se ve el progreso («💞 Junto a Nombre: 3/5 turnos»).

## Armas (v1.6)

| Arma | Daño base | Alcance | Manos | Particularidad |
|---|---|---|---|---|
| Daga | 4 | 1 | 1 | Ignora 25% de defensa, +1 movimiento |
| Espada | 7 | 1 | 1 | Equilibrada |
| **Hacha** | 8 | 1 | 1 | Más daño que la espada, admite escudo |
| **Katana** | 9 | 1 | 1 | Ignora 20% de defensa |
| **Hacha de batalla** | 13 | 1 | 2 | Ignora 15% de defensa, pesada: −1 movimiento |
| **Lanza** | 8 | 1–2 | 2 | Alcance 2 y sin penalización a quemarropa |
| Arco / Arco largo / Ballesta | 5 / 6 / 10 | 3 / 2–5 / 4 | 2 | Como antes |

Se fabrican en las ciudades (pestaña forja), caen como objetos raros con efectos, y los bots también las usan.

## Renombrar unidades

En la ficha de una unidad, el botón ✏️ (arriba a la derecha) permite cambiarle el nombre (máx. 16 letras). Solo puedes renombrar las tuyas.

## Partidas de días: ausencias, relevos y avisos

**Si alguien deja de jugar.** Si una persona pasa varios turnos sin abrir el juego (se elige en la sala: 1, 2, 3, 5 turnos o nunca), **un bot dirige su ejército** para que no se quede quieto. Ese bot es cauto: farmea criaturas, defiende, forja y recluta, pero **no ataca a otros jugadores**. En cuanto la persona vuelve a abrir el juego **recupera el mando**. Mientras está ausente ya no se espera su «Fin de turno». Ojo: el bot gasta los puntos de habilidad y equipa mejor equipo según su criterio.

**Entrar con la partida empezada.** Con el código, cualquiera puede **ocupar el lugar de un bot** (conserva su ejército, ciudades y progreso). La app muestra la lista de bots disponibles con sus unidades, ciudades y puntos. Si un amigo desapareció del todo, el anfitrión puede pulsar **Liberar plaza** en la lista de jugadores: queda como bot y otra persona puede ocuparla.

**Avisos al celular (notificaciones).** Al empezar a jugar aparece «¿Quieres que te avise…?». Con avisos activados recibes:
- ⏰ cuando empieza tu turno (con resumen de lo que pasó: unidades perdidas, ataques, puntos por gastar),
- ⚔️ cuando otro jugador te ataca (máximo uno cada 5 minutos),
- ⏳ cuando se acaba el tiempo del turno y aún no pulsaste «Fin de turno» (turnos de 2 h o más),
- 📨 cuando te proponen un pacto (y 🤝 cuando se firma o se rompe), 🐺 cuando una horda se dirige a tu ciudad,
- 🤖 cuando un bot toma tu ejército, y 🏁 al terminar la partida.

Requisitos: HTTPS (Render ya lo da). **Android/Chrome**: funciona directo. **iPhone/iPad** (iOS 16.4 o más): hay que **instalar el juego**: Compartir → *Añadir a pantalla de inicio*, y abrirlo desde ese icono; Safari normal no permite avisos. Se pueden desactivar en *Jugadores → Desactivar avisos*.

## Probarlo en tu computador

```bash
npm start
# abre http://localhost:3000 en el navegador (o en el celular, con la IP de tu PC)
```

Pruebas: `npm test` (flujo de un jugador, cifrado de avisos contra el vector oficial, guardado en la nube simulado, ausencias, relevos y avisos, y las reglas nuevas: bots, estaciones, élites, hordas, tesoros, equipo raro, diplomacia, clases, edificios, órdenes, resumen y partidas antiguas) y `npm run sim` (10 bots jugando 150 turnos). Además `node test/e2e.js`, `node test/cdp.js` y `node test/cdp2.js` y `node test/cdp3.js` (interfaz en Chrome).

## Desplegar en Render (gratis)

1. Sube **todo el contenido** de esta carpeta a un repositorio de GitHub (`shared.js`, `engine.js`, `server.js`, `store.js`, `push.js`, `ws-lite.js`, `package.json` y la carpeta `public`).
2. En Render: **New → Web Service**, elige el repositorio.
   - Runtime: **Node** · Build command: *(vacío)* · Start command: `npm start` · Plan: Free
3. Abre la URL que te da Render en el celular de cada amigo. Uno crea la partida y comparte el **código de 5 letras**.

> Variables de entorno (en Render → *Environment*): `ADMIN_KEY` (una clave tuya, para descargar/restaurar copias), `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (guardado permanente, ver abajo). Opcional: `VAPID_SUBJECT` (tu correo como `mailto:tu@correo.com`, o la URL de tu app; por defecto se usa la URL de Render).

## Guardado en la nube (para que la partida no se pierda)

El plan gratis de Render **duerme el servicio sin visitas y borra los archivos al reiniciar o desplegar**. Para que las partidas de días sobrevivan, el juego puede guardarse en **Upstash Redis** (gratis, sin tarjeta):

1. Crea una cuenta en [upstash.com](https://upstash.com) → **Create Database** (Redis), plan **Free**, región cercana a la de Render.
2. En la base de datos, pestaña **REST API**: copia `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`.
3. En Render → tu servicio → **Environment**: agrega esas dos variables y guarda (Render redespliega).
4. Abre `https://TU-APP.onrender.com/vigia`: debe decir **«☁️ Guardado en la nube: correcto»**.

Cómo funciona: cada partida se guarda comprimida (unos pocos KB) como máximo cada 30 s **y solo si cambió**, y al instante cuando cambia el turno y al cerrar el servidor. Al arrancar, el servidor la recupera y todos entran con su sesión anterior. Si Upstash no responde, el juego sigue funcionando y reintenta. También se guardan ahí las claves de los avisos (si se perdieran, los avisos dejarían de llegar hasta que cada persona vuelva a abrir el juego). Revisa en tu panel de Upstash el límite mensual de comandos: con una partida activa las 24 h y cambios constantes serían unos 86.000 comandos al mes.

Sin Upstash todo sigue funcionando como antes, pero el guardado vive en disco y **se pierde al reiniciar**. Copias manuales (opcional, con `ADMIN_KEY`): descargar `https://TU-APP.onrender.com/api/backup?key=TU_ADMIN_KEY`; restaurar con `curl -X POST --data-binary @aventura-de-almas-backup.json "https://TU-APP.onrender.com/api/restore?key=TU_ADMIN_KEY"`.

Durante un redespliegue pueden perderse los últimos segundos de acciones. Tras un reinicio, el turno en curso recibe unos minutos extra en lugar de avanzar de golpe.

## Mantener el servidor despierto (el celular vigía)

1. En un celular que quede enchufado abre `https://TU-APP.onrender.com/vigia` y pulsa *Mantener pantalla encendida*. Esa página avisa al servidor cada minuto y muestra si el guardado en la nube y los avisos están bien. (El servidor también se auto-avisa cada 9 minutos usando `RENDER_EXTERNAL_URL`.)
2. Alternativa sin celular: un monitor gratuito (p. ej. UptimeRobot) que visite `/health` cada 5 minutos.

## Estructura

```
server.js          HTTP + WebSocket, salas, reloj de turnos, relevos, avisos
engine.js          reglas del juego, mapa, combate, criaturas, bots, ausencias
store.js           guardado (disco y Upstash)
push.js            avisos push (VAPID + cifrado), sin dependencias
ws-lite.js         WebSocket mínimo (sin dependencias)
shared.js          datos compartidos (armas, recetas, criaturas, pathfinding)
public/            index.html (juego), vigia.html, sw.js, manifest, iconos
test/              pruebas
```

## Controles en el celular

- **Tocar una unidad**: la selecciona (casillas azules = a dónde puede moverse, borde rojo = enemigos que puede atacar).
- **Tocar una casilla azul**: mover. **Tocar un enemigo marcado**: atacar (si está lejos, la unidad se acerca sola).
- **Tocar una de tus ciudades**: almacén, forja y reclutamiento.
- Arrastrar para desplazar el mapa; pellizcar para acercar/alejar.
- Barra inferior: unidades (el número rojo = unidades con puntos por gastar), ciudades, registro, jugadores y **Fin de turno**.

## Ajustar el equilibrio

Casi todo está en `shared.js` (armas, criaturas, recetas) y al inicio de `engine.js` (límites, pesos de habilidades de los bots, fórmulas de daño en `calcDamage`).
