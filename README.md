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

## Bots que hablan (v1.13)

Los bots escriben en el chat con una etiqueta 🤖 y frases propias según su personalidad (granjero, equilibrado, conquistador). Es un guion, no una IA: reconocen palabras clave.

- **Hablarles:** escribe su nombre en el mensaje («Vlad, hagamos la paz») o la palabra «bots» (contesta uno al azar). Reconocen saludos, paz, alianza, amenazas, insultos, agradecimientos, peticiones de ayuda y «¿cómo vas?». Si no los nombras, no contestan.
- **Paz y alianza:** el chat no firma pactos (eso se hace en «Jugadores» 🤝), pero el bot te dice la verdad sobre su ánimo: si hubo guerra reciente se niega; si no, te invita a mandarle la propuesta. Cuando le mandas una propuesta, contesta en el chat si la acepta o la rechaza (y por qué).
- **Solos:** saludan al empezar y comentan de vez en cuando cuando matan o pierden una unidad contigo, conquistan o pierden una ciudad, aparece un jefe o una horda, los eliminan o termina la partida. Máximo 2 comentarios de bots por turno y cada bot calla al menos 3 turnos entre comentarios.
- **Canal de aliados:** solo lo leen y contestan los bots que son tus aliados.
- El anfitrión puede apagarlo en «Ajustes del mundo» (Los bots hablan en el chat: Sí/No). Las partidas empezadas antes de la v1.13 lo tienen apagado.

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

## 9 personalidades de bots (v1.14)
Ahora hay 9 personalidades, una por cada bot posible de la sala (anfitrión + 9 bots). Cada una cambia cómo construye, a quién ataca, cómo acepta pactos y qué dice en el chat:
- 🌾 Granjero · ⚔️ Conquistador · ⚖️ Equilibrado (las originales)
- 🏹 Cazador: vive de cazar criaturas, rara vez ataca a jugadores.
- 🕊️ Diplomático: acepta casi siempre paz y alianzas.
- 🛡️ Defensor: murallas primero, mucho ejército en casa.
- 🗡️ Saqueador: oportunista, desde el turno 15 ataca a los débiles y a unidades sueltas.
- 🔨 Forjador: herrería primero; ataca cuando ya está bien armado (turno 60).
- 🐉 Cazajefes: va por el Rey Lobo, el Liche y el Dragón.
Al elegir «Personalidad al azar» se reparten sin repetir mientras queden libres (9 bots = 9 personalidades distintas). Los parámetros están en `shared.js` (`PERS[...].b`) y las frases en `botchat.js`.

## Jefes que se recuperan menos (v1.14.1)
Los jefes (Rey Lobo, Liche, Dragón) ahora recuperan solo un 3% de su salud por turno cuando no los golpean (antes 10%, igual que cualquier criatura). Así, un aventurero solo que se retira a curarse ya no ve al jefe volver casi a tope, como pasaba en el reto de una unidad. Las criaturas normales no cambian.

## Jefes ajustables (v1.15)
- Nuevo ajuste del mundo «Recuperación de los jefes»: Lenta (3% por turno, por defecto), Normal (10%) o Ninguna.
- En el reto de una unidad los jefes (Rey Lobo, Liche, Dragón) tienen 60% de vida y 80% de daño.

## Más armas y armaduras (v1.16)
- **Calidad Dracónica** (5.ª): daño ×4,1 y defensa ×5,3 (el Alma era ×3,0 y ×3,8). Se forja o se mejora con 🐉 **escamas de dragón** (las suelta el Dragón de Ceniza; los demás jefes a veces sueltan 1) + almas. El Dragón también puede soltar objetos dracónicos.
- **8 efectos nuevos** (ahora hay 16): armas → 🔥 Fuego (quema 2 turnos), ❄️ Hielo (ralentiza −2 de movimiento un turno), 💥 Crítico (×1,8), 💀 Ejecutor (+daño a enemigos bajo la mitad de vida), 🐺 Cazabestias (+daño a criaturas); armaduras → 💪 Vigor (+% salud), 📚 Erudito (+% experiencia), 🛡️ Bloqueo (probabilidad de reducir a la mitad un golpe).
- **Rareza Legendaria** 🟠: tres efectos, con la potencia más alta. El tercer efecto se añade en la forja (calidad Alma o superior) por 6 almas + 2 escamas. Los jefes, y con poca probabilidad las ruinas y élites, pueden soltar equipo legendario ya hecho.
- **Reforjar** 🔄: cambia un efecto del objeto por otro al azar (2 almas).
- **Sets de armadura** 🧩: 3 piezas de la misma calidad (de las 7 ranuras de defensa, calidad hierro o mejor) dan +salud; 6 piezas dan además defensa, regeneración y (dracónico) espinas. Se ve en la hoja de la unidad.
- Lo que sigue pendiente: engarces/gemas.

## Nueva escala de rareza (v1.17)
La rareza ahora es el número de efectos del objeto (reemplaza la de la v1.16):
| Rareza | Color | Efectos | Para añadir el efecto |
|---|---|---|---|
| Común | ⚪ gris | 0 | — |
| Poco común | 🟢 verde | 1 | 3 almas |
| Raro | 🔵 azul | 2 | 3 almas |
| Épico | 🟣 morado | 3 | 4 almas · calidad Acero o superior |
| Legendario | 🟡 amarillo | 4 | 6 almas + 2 escamas · calidad Alma o superior |
| Mítico | 🔴 rojo | 5 | 9 almas + 4 escamas · calidad Dracónica |
Cada efecto gana potencia con la rareza (sus 5 valores están en `shared.js`, `AFFIX[...].v`). El botín de cofres da sobre todo Poco común/Raro; ruinas y élites un poco más; los jefes dan Épico, Legendario y, con poca probabilidad, Mítico. Los objetos guardados de versiones anteriores conservan sus efectos (la rareza se calcula por el nº de efectos).

## Reto del Rey Demonio (v1.18)
Nuevo modo de juego (se elige en «Ajustes del mundo → Modo de juego»):
- Al empezar, **un jugador al azar** (humano o bot) es el 👑 Rey Demonio. Los demás jugadores quedan **aliados entre sí automáticamente** y en guerra con el Rey; las alianzas no se pueden cambiar ni negociar en este modo.
- El Rey **solo recluta bestias** (Lobo, Oso, Goblin, Esqueleto, Orco, Troll; cada una con su coste en la ciudad) y empieza con 6 bestias de nivel 3. Las bestias no usan equipo ni clases ni protagonista, pero suben de nivel, gastan puntos de habilidad, cargan botín y se curan en ciudad como cualquier unidad.
- **Victoria**: si el Rey cae (sin unidades ni forma de reclutar), gana la alianza (victoria compartida). Si el Rey elimina a todos los demás, gana el Rey.
- Los bots lo entienden: el bot Rey recluta bestias y ataca a todos; los bots aliados siempre atacan al Rey.
- Parámetros en `shared.js` (`KING`): bestias, costes, unidades y nivel iniciales.

### Protagonista del Rey Demonio (v1.18.1)
El Rey Demonio también tiene protagonista (si «Protagonista» está en Sí): al empezar le toca **al azar uno de los tres jefes** (🐺 Rey Lobo, 🧙 Liche o 🐉 Dragón de Ceniza) como su unidad inicial. Tiene la mitad de la vida y el 60% del daño de un jefe salvaje (`KING.boss` en `shared.js`), da +10% de daño y defensa a las bestias cercanas, gana +50% de experiencia y, si cae, vuelve a su ciudad en 3 turnos con 2 niveles menos. No se puede cambiar de protagonista. Sustituye a una de las 6 bestias iniciales.

## Modo «Por equipos» (v1.19)
En «Ajustes del mundo → Modo de juego» elige **Por equipos** y, en el ajuste **Equipos**, si serán **2 equipos** o **5 equipos**.
- Al empezar, los jugadores (humanos y bots) se reparten **al azar y de forma equilibrada** (10 jugadores: 2 equipos de 5, o 5 equipos de 2; con menos jugadores los equipos quedan lo más parejos posible y nunca hay más equipos que jugadores).
- Los compañeros quedan **aliados automáticamente** y los otros equipos son enemigos; las alianzas y pactos no se pueden cambiar en este modo. En «Jugadores» cada uno muestra su equipo (🔶 🔷 🟩 🟪 🟫).
- **Gana el último equipo con jugadores vivos** (victoria compartida para todo el equipo). Los bots atacan siempre a los otros equipos, sea cual sea su personalidad.

## Modo Historia (v1.20)
Nuevo modo cooperativo: «Ajustes del mundo → Modo de juego → Historia». Es una campaña de **6 capítulos dentro de una sola partida**, «La Ceniza del Dragón». Todos los jugadores (humanos y bots) están **aliados contra el mundo** (sin PvP ni diplomacia) y los jefes aleatorios no aparecen: solo los que manda la historia.

| Capítulo | Objetivo (entre todos) |
|---|---|
| 1. El eco de la ceniza | Derrotar 12 criaturas |
| 2. Tierras propias | Que el grupo tenga (jugadores + 3) ciudades |
| 3. Acero y leyenda | Una unidad de nivel 8 y equipar algo de calidad Acero o mejor |
| 4. El rey de los lobos | Derrotar al Rey Lobo (aparece al empezar el capítulo) |
| 5. La noche del Liche | Derrotar al Liche |
| 6. El Dragón de Ceniza | Derrotar al Dragón → **victoria compartida** |

- Al completar un capítulo, **cada capital recibe materiales y un objeto de botín** (mejor cuanto más avanzado), y se cuenta el siguiente capítulo.
- Los jefes salen con un nivel parecido al de tu mejor unidad (con mínimos y máximos por capítulo); si el jefe de un capítulo desaparece, vuelve a aparecer.
- Si cae todo el grupo, la historia termina en derrota.
- Botón 📖 en el mapa: capítulo actual, objetivos con progreso, capítulos anteriores y prólogo. Se abre solo al empezar y al cambiar de capítulo.
- Todos los textos y objetivos están en `shared.js` (`STORY`): se pueden editar o añadir capítulos sin tocar el motor.

## Mundo abierto (v1.21) — fase 1
Modo para un mundo **siempre abierto entre amigos**: «Ajustes del mundo → Modo de juego → Mundo abierto». El anfitrión crea la partida, la inicia (aunque esté solo) y los demás **entran cuando quieran** con el código, incluso días después; cada uno nace en un sitio libre y lejos de los demás (con una zona sin monstruos alrededor).
- **Tamaño:** Grande 120×120, Enorme 160×160 (por defecto) o Gigante 220×220, con más de 100 ciudades neutrales y mucha fauna. Hasta **24 jugadores**, sin bots, sin fin de partida y sin eliminar a nadie.
- **Tiempo:** el mundo avanza solo con el reloj (no hay «Fin de turno»). Al elegir este modo el turno pasa a 1 hora (se puede cambiar). Los jugadores actúan cuando entran; sus unidades se recuperan en cada turno.
- **Sin reclutar:** solo hay **crías** (dos unidades juntas junto a una ciudad tuya; viene activado). Si te quedas sin unidades, unos refugiados te acompañan; si pierdes también tus ciudades, vuelves a nacer en otro lugar.
- **Ciudades:** se pueden conquistar, pero **si pasan N turnos sin unidades tuyas cerca (≤ 2 casillas) vuelven a ser neutrales** (12, 24, 48 o 96 turnos; avisa 3 turnos antes). Una capital abandonada queda como «Ruinas de …».
- **Monstruos:** salen de **cualquier nivel al azar** (más bajos que altos) y **ya no suben con el tiempo**; los jefes salen con nivel al azar entre 5 y 15.
- La diplomacia (paz y alianzas) sigue disponible. El chat funciona para todo el mundo.
- Recomendaciones: un celular o computador «vigía» conectado mantiene Render despierto, pero **si el servidor se reinicia o subes una versión nueva, el mundo se reinicia** (en Render gratis el disco es temporal). Con «Gigante» cada actualización de estado pesa ~100 KB: para muchos jugadores es mejor «Enorme».

## Tutorial, modos rápidos y resumen final (v1.22)

- **Tutorial**: la primera vez que entras a una partida aparece una guía de 7-8 pasos (mover, combatir, ciudades, crías, fin de turno, y un paso extra según el modo). Se puede saltar y se recuerda en el dispositivo. El botón ❓ la vuelve a abrir.
- **Modos rápidos** (lobby, anfitrión): Clásica, Rápida, Épica, Reto, Equipos, Rey Demonio, Historia y Mundo abierto. Un toque aplica todos los ajustes del modo; los ajustes no nombrados vuelven a su valor por defecto y se pueden afinar después. Definidos en `PRESETS` (shared.js).
- **Resumen final**: al terminar la partida aparece 📊 con clasificación (puntos, criaturas, jefes, jugadores derrotados, ciudades, mejor unidad) y premios. El servidor lo calcula en `summary(g)` (engine.js) y viaja en el estado como `sum`.

## Engarces, gemas y tipos de final (v1.23)

**Gemas y engarces**
- 6 gemas (🔴 rubí, 🔵 zafiro, 🟢 esmeralda, 🟡 topacio, 🟣 amatista, ⚪ diamante) en 3 calidades (astillada, normal, perfecta). Se guardan como materiales (`rubi1`, `rubi2`, `rubi3`…), así que se llevan en la mochila, se depositan y se retiran como el resto.
- Cada gema da un efecto distinto en armas y en armaduras (ej. rubí: +daño en arma, +salud en armadura).
- Los objetos raros salen con 0-3 engarces según su rareza; los demás se perforan en la forja (pestaña Mejorar; cuesta acero/alma y exige calidad mínima). Máximo 3.
- Se engasta una gema del almacén en un engarce libre; si no hay, se elige cuál sustituir (la vieja se pierde). 3 gemas iguales se funden en 1 de la calidad siguiente.
- Botín: jefes (casi siempre, 2), élites y criaturas normales (a veces, más con el nivel), cofres y ruinas. Las gemas se guardan antes que los materiales para que no se pierdan con la mochila llena. Los bots también las engastan.

**Tipos de final** (ajuste «Tipo de final», modos Normal y Reto de una unidad)
- Último en pie (por defecto), Por tiempo (40 turnos si no hay otro límite), Dominación (la mitad de las ciudades 4 turnos seguidos), Cazajefes (2 jefes; aparecen más a menudo), Campeón (unidad a nivel 12) y Carrera de puntos (600).
- El progreso se muestra en la hoja de Jugadores y se avisa en el registro.

## v1.23.1
- Nivel máximo de unidad: de 20 a **53**, justo lo necesario para llenar todas las habilidades (suma de topes = 53, 1 punto por nivel).

## Crías con herencia (v1.24)
- La cría hereda el mejor bonus de nacimiento de sus dos padres y le suma el bonus base (+10 salud, +2 daño): cada generación es más fuerte que la anterior (gen. 1: +10/+2, gen. 2: +20/+4, …). Se muestra la generación en la hoja de la unidad y en el aviso de nacimiento. El protagonista que reaparece conserva su generación.

## Comercio entre jugadores (v1.25)
- En la hoja de Jugadores, junto a quien tengas en paz o alianza, aparece 🛒 Comerciar: eliges tu ciudad de salida, lo que das (materiales, gemas y/o un objeto) y lo que pides (materiales y gemas).
- Lo que ofreces queda en depósito (sale de tu ciudad). El otro jugador acepta (la mercancía llega a la ciudad suya que tenga lo que pides; lo que pides llega a tu ciudad de salida), rechaza, o la oferta caduca a los 5 turnos; en los dos últimos casos se devuelve todo. Máx. 3 ofertas pendientes por jugador. No hay comercio en el Reto de una unidad.
- Los bots (y los jugadores ausentes) aceptan tratos que valgan al menos un 90% de lo que piden (valores: cuero/hueso 1, hierro 1,5, acero 3, alma 4, escama 8, gemas 5/14/40) y rechazan los abusivos. Los bots no proponen tratos.
- Código: `doTrade`, `tradeAccept`, `tradeTick` (engine.js); estado `trades` en el snapshot.

## Eventos del mundo: clima, torneos y mercaderes (v1.26)
Ajuste «Eventos del mundo»: Clima + torneos + mercaderes (por defecto) / Solo clima / Nada.
- **Clima** (☀️ despejado, 🌧️ lluvia, ⛈️ tormenta, 🌫️ niebla, 🌨️ ventisca): cambia cada 2-4 turnos según la estación y se ve junto al turno. Lluvia: armas a distancia −25% y el fuego no quema. Tormenta: −1 de movimiento, distancia −35%, magia (bastón/varita) +25%. Niebla: sin críticos y la distancia alcanza 1 casilla menos. Ventisca (solo invierno): −1 de movimiento y el hielo ralentiza siempre. Las armas cuerpo a cuerpo no se ven afectadas por la lluvia.
- **Torneos** 🏟️: desde el turno 10 y cada 18 turnos aparece una arena en el mapa (visible para todos) durante 4 turnos. Al terminar gana la mejor unidad (nivel, daño, defensa, salud) que esté en la arena o pegada a ella: 2 gemas, un objeto raro y experiencia (lo que no cabe en la mochila va a la capital). Los bots no acuden (todavía). Sin torneos en Historia.
- **Mercaderes ambulantes** 🛒: cada 8 turnos aparece uno (hasta 3; más en Mundo abierto), se queda 7 turnos y deambula. Con una unidad pegada a él, toca el mercader para ver sus ofertas: gemas, lotes de materiales, un objeto raro y un mapa del tesoro (crea un cofre cercano). Se paga con lo que lleva la unidad en la mochila; cada oferta se vende una sola vez. Los bots no compran.

## Ciudades de 3×3 con edificios visibles (v1.27)
- Cada ciudad ocupa un **solar de 3×3** (el centro sigue siendo la casilla de la ciudad; el solar nunca es agua ni montaña). En el mapa se dibuja el suelo, la torre del homenaje (crece con las mejoras) y los edificios: 🔨 herrería (oeste), 🏕️ cuartel (este), 🐴 establo (norte, cuando la ciudad tiene su carreta), 🧱 murallas de piedra alrededor con puerta al sur y 🔭 atalayas en las esquinas. Cada edificio cambia de aspecto en el nivel 2 (herrería con chimenea, cuartel con tienda de guerra, muralla más gruesa con torreones, atalaya más alta con tejado dorado y bandera).
- Las **mejoras no se pierden al conquistar** una ciudad ni cuando vuelve a quedar neutral: las conserva quien la tome.
- **Bonos al estar en la ciudad** (`CITY_GUARD` en shared.js): contra jugadores +8 de defensa en el centro y +4 en el anillo de 3×3. Contra hordas que asaltan la ciudad: +10/+6 de defensa y +30%/+20% de ataque para quien la defiende.

## Más clases y armas (v1.28)
**6 armas nuevas** (se forjan, salen de botín y las usan los bots): 🤺 Estoque (dos ataques por turno; el segundo hace 60%), 🔨 Maza (35% de aturdir: −2 de movimiento un turno), 🪃 Bumerán (alcance 3, una mano), 🪢 Látigo (alcance 2 sin penalización a quemarropa, +1 movimiento, una mano), 🌾 Guadaña (+30% de daño a enemigos por debajo de la mitad de salud, dos manos) y 🔮 Orbe (mágica: alcance 3, ignora 20% de defensa, una mano). Las armas mágicas (báculo, varita, orbe) usan ahora la marca `magic` en `KINDS`.

**6 clases nuevas** (nivel 6, 2 especializaciones cada una a nivel 12): 😡 Berserker (Frenesí, Titán), ⚜️ Paladín (Cruzado, Inquebrantable), 🥋 Monje (Puño de hierro, Maestro zen), 🎵 Bardo (Trovador, Juglar), ⚗️ Alquimista (Toxicólogo, Boticario) y 🌋 Elementalista (Piromante, Criomante; sus golpes queman o ralentizan: nuevos efectos de clase `fuego` y `hielo`). En total hay 15 clases.

## Más criaturas y jefes (v1.29)
- **Pacíficas** (no atacan; se defienden si las atacas): 🐇 conejo, 🐐 cabra montés, 🐂 toro (golpea fuerte), 🐢 tortuga gigante (mucha defensa).
- **Agresivas**: 🦇 murciélago, 🐍 serpiente, 🕷️ araña gigante, 🦂 escorpión, 🥷 bandido, 🧟 zombi, 👻 fantasma (ataca a distancia 2, deja almas) y 🗿 gólem de piedra (lento y muy duro). Salen en las zonas de las tablas de fauna (normal, pacífica y agresiva); las zonas lejanas traen las más peligrosas.
- **Jefes nuevos** (4, ahora hay 7): 🐃 Minotauro del Laberinto, 🐲 Hidra de las Ciénagas (a distancia 2), ⛰️ Coloso de Piedra (lentísimo y blindado) y 🧛 Conde Vampiro. Aparecen al azar junto a los anteriores; en el modo Historia siguen los tres de siempre.
- Reto del Rey Demonio: su protagonista puede ser cualquiera de los 7 jefes y ahora también puede reclutar 🕷️ arañas, 🧟 zombis y 🗿 gólems.

## Mazmorras (v1.30)

- Entradas 🕳️ repartidas por el mapa, de 5 niveles (Cueva → … → el más profundo). Cuanto mayor el nivel, más duras las criaturas, más trampas y más botín.
- Al entrar, la unidad pasa a otra "instancia" (una franja subterránea bajo el mapa, aislada por muros). La puerta 🚪 te devuelve al sitio por el que entraste.
- Cada mazmorra tiene 6 salas: criaturas, tesoros 💎 y trampas ⚠️ ocultas (se descubren al pisarlas).
- Al fondo hay un jefe con recompensa extra. Despejada, se reabastece a los 20 turnos.
- Los bots no entran. Las unidades dentro solo las ve su dueño.

### Fortaleza del Rey Demonio (v1.30.1)
En el modo «Reto del Rey Demonio», la ciudad del rey se dibuja como fortaleza oscura: suelo carmesí, torres de pinchos, antorchas 🔥, volcán y 😈 sobre el torreón. Los edificios (muralla, herrería, cuartel, atalayas) se siguen viendo.

## Ciudades rediseñadas (v1.31)
- Las unidades dentro de una ciudad son fichas pequeñas en la esquina de su casilla; un solo contador ⚔ n por dueño aparece en el borde del solar.
- Edificios con más detalle: herrería con chimenea humeando, cuartel con almenas y bandera, establo con valla y heno, casas con tejado.
- La ciudad crece con las mejoras: aldea (1 casa) → pueblo → ciudad (4 casas, más casitas, calles y plaza).
- Muralla con almenas, puerta con portón y torreones en el nivel 2.

## Mazmorras con otra cara (v1.32)
- Muros de ladrillo con grosor, suelo de losas con grietas, sombra bajo los muros y vacío negro fuera de las salas.
- Antorchas en las paredes con brillo cálido, y un halo de luz alrededor de tus unidades dentro de la mazmorra.
- Cinco temas por nivel: cueva, catacumba, cripta, fuego y abismo. La sala del jefe se tiñe de rojo.
- Tesoros 💎 con brillo dorado y trampas ⚠️ con aro rojo; lo no explorado queda mucho más oscuro.
