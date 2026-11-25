# Pozo de amigos (versión cerrada)

Web para un grupo pequeño y cerrado: cada día se venden números, la mitad del pozo es el premio de un sorteo verificable y la otra mitad va a un banco grupal con libro de movimientos visible para todos.

## Antes de empezar: tres cosas importantes

1. **En el plan gratis de Render los datos se borran.** Un servicio gratuito no admite disco persistente y pierde sus archivos en cada reinicio, en cada redeploy y cada vez que se "duerme" (15 minutos sin visitas). Aquí los datos viven en un archivo SQLite, así que se pierden los miembros y sus códigos, las reservas y el libro del banco. El plan gratis sirve para probar, no para llevar el registro real: mientras lo usen así, anoten el saldo del banco y los premios en una hoja propia y descarguen el respaldo después de cada sorteo. Para que los datos se guarden de verdad hace falta un plan de pago con disco (ver "Pasar al plan de pago").
2. **La web no cobra.** Reservas en la web, pagas al administrador por fuera (efectivo o transferencia) y él marca el número como pagado. Así no se manejan tarjetas ni datos de pago.
3. **Qué no resuelve el sorteo verificable.** Impide cambiar el resultado después de ver los números. No impide que el administrador marque mal un pago o no sortee: eso se controla entre todos con la lista de números y el historial. Y esto no es asesoría legal: es un juego entre conocidos, con montos pequeños; si crece o se abre al público, consulta a un abogado.

## Probarla en tu computadora

```bash
cd pozo
python -m venv .venv
source .venv/bin/activate        # en Windows: .venv\Scripts\activate
pip install -r requirements.txt
ADMIN_CODE=un-codigo-largo-123 python app.py
```

En Windows (PowerShell): `$env:ADMIN_CODE="un-codigo-largo-123"; python app.py`

Abre http://127.0.0.1:5000 y entra con ese código. Para correr las pruebas: `python -m unittest -v test_app`.

## Subirla a Render, paso a paso

1. **GitHub:** crea un repositorio **privado** y sube esta carpeta.
   ```bash
   git init
   git add .
   git commit -m "Pozo de amigos"
   git branch -M main
   git remote add origin https://github.com/TU-USUARIO/pozo.git
   git push -u origin main
   ```
   El `.gitignore` ya evita subir la base de datos.
2. **Render:** *New → Blueprint*, conecta el repositorio y Render leerá `render.yaml`. Te pedirá `ADMIN_CODE`: escribe un código largo (16 caracteres o más) que no uses en ningún otro sitio. El plan ya viene en gratis, así que no tiene costo.
   - Si prefieres hacerlo a mano (*New → Web Service*): runtime Python, build `pip install -r requirements.txt`, start `gunicorn app:app --workers 1 --threads 4 --bind 0.0.0.0:$PORT`, plan Free y las variables de la tabla de abajo.
3. Cuando diga **Live**, abre la URL `.onrender.com` y entra con tu `ADMIN_CODE`.
4. **Apaga la web vieja:** en Render, abre el servicio anterior → *Settings* → *Suspend* (o *Delete*). Era pública y no debe seguir vendiendo números.

## Pasar al plan de pago (cuando entren los 8)

1. Descarga el respaldo desde el panel de admin y guárdalo. No hay función de restaurar: los miembros y el saldo se vuelven a cargar a mano.
2. En el servicio de Render cambia el tipo de instancia a uno de pago (revisa el costo que te muestre), agrega un disco (*Disks → Add Disk*) montado en `/var/data` de 1 GB y define la variable `DB_PATH` con el valor `/var/data/pozo.db`. En `render.yaml` hay un bloque comentado con esos mismos datos.
3. Cuando termine el redeploy, crea de nuevo a los miembros (códigos nuevos) y registra el saldo actual del banco con un movimiento de tipo "Ajuste". Desde ese momento los datos ya no se borran.

## Mantenerla despierta con un vigía (solución temporal)

El plan gratis duerme el servicio tras 15 minutos sin visitas (y tarda cerca de un minuto en despertar). Un vigía externo gratuito puede visitar la web cada 5 minutos para que no se duerma. La web ya tiene una dirección ligera para eso: `https://TU-SERVICIO.onrender.com/salud` (responde "ok", no pide login y no toca la base de datos).

1. Crea una cuenta gratuita en UptimeRobot o en cron-job.org (revisa sus condiciones actuales).
2. Crea un monitor de tipo HTTP(s) con esa dirección y un intervalo de 5 minutos.
3. Listo. El vigía no puede vivir en Render (se dormiría igual y gastaría horas): tiene que ser un servicio externo.

Límites que debes conocer:

- **No evita que se borren los datos.** Render puede reiniciar un servicio gratuito en cualquier momento, y cada reinicio y cada redeploy borran la base de datos. El vigía solo evita los borrados por inactividad. Descarga el respaldo desde Admin después de cada sorteo.
- **Gasta las horas gratis.** Render da 750 horas gratis al mes por espacio de trabajo, compartidas entre todos tus servicios gratuitos. Un servicio encendido todo el mes consume casi todas (un mes de 31 días tiene 744). Si dejas otro servicio gratuito encendido, se acaban las horas y Render suspende todos hasta el mes siguiente. Suspende o borra la web vieja.
- Render no menciona estos vigías en su documentación, así que no hay garantía de que funcione siempre.

## Ajedrez (para pasar el rato)

En el menú, **Ajedrez**: juegas contra la computadora (fácil, medio o difícil) o dos personas en el mismo dispositivo. Tiene todas las reglas (enroque, al paso, coronación, jaque mate, tablas), deshacer, girar el tablero y la lista de jugadas en español. Esa parte funciona en tu navegador y no guarda nada en el servidor.

**En línea (otro dispositivo):** en Ajedrez → *Jugar en línea*, un miembro crea una partida (blancas, negras o al azar) y otro se une desde su cuenta. Cada navegador consulta la partida cada 2,5 segundos. Hasta 5 partidas activas por persona; las partidas de más de 14 días se borran. El servidor controla de quién es el turno, pero las reglas de ajedrez las verifica cada navegador. Sirve entre amigos; alguien que manipule su navegador podría forzar una jugada ilegal. Con el plan gratis, las partidas se pierden si Render reinicia el servicio. Nada de esto toca el dinero. Para verificar el motor: `node tools/test_chess.js`. Las piezas las dibuja `tools/chess_sprites.py` (requiere Pillow, solo en tu PC).

## Dominó (para pasar el rato)

En el menú, **Dominó**: doble seis, 4 jugadores en parejas (tú y tu compañero contra dos rivales), 7 fichas para cada uno, sin pozo, a 100 puntos. Tu compañero y los rivales los juega la computadora. Abre quien tiene el doble seis y después quien ganó la mano; si no tienes ficha, pasas solo. Quien se queda sin fichas se lleva los puntos de todas las que quedan; si se tranca, gana la pareja con la mano más baja (si empatan parejas, nadie suma). Funciona en el navegador, no guarda nada y no toca el dinero. Pruebas del motor: `node tools/test_domino.js`.

**Dominó en línea:** en Dominó → *Jugar en línea con otros miembros*, alguien crea una mesa y los demás se sientan (compañero o rival). Cuando el anfitrión toca *Empezar*, la computadora ocupa los lugares vacíos, así que se puede jugar con 2 o 3 personas. El servidor reparte y valida cada jugada, y cada persona solo recibe sus propias fichas. Si alguien sale de la mesa, la computadora juega por él. El tablero se actualiza cada 1,5 segundos; las jugadas de la computadora avanzan mientras alguien tenga la mesa abierta. Máximo 3 mesas activas por persona; las mesas de más de 14 días se borran. Con el plan gratis, las mesas se pierden si Render reinicia el servicio.

## Primer uso

1. En **Admin → Miembros** crea a cada persona. La web muestra su código **una sola vez**: pásalo por privado.
2. Abre `rules.txt`, completa la sección "Decisiones del grupo" (quién guarda el dinero, quién decide inversiones, cómo se reparten ganancias, qué pasa si alguien se sale) y súbelo de nuevo (`git push`). Cada miembro debe aceptar las reglas en su primer ingreso.
3. Ajusta el precio por número en el panel de admin.

## Sorteo automático a las 19:00

Todos los días a las 19:00 (hora de Ecuador) la web cierra las ventas y sortea sola la ronda de hoy, con la misma fórmula verificable. Cambias la hora o lo apagas en **Admin → Sorteo automático**; el valor inicial sale de `AUTO_DRAW_TIME` y `AUTO_DRAW_ENABLED`. Lo que tienes que saber:

- **Solo entran los números pagados antes de la hora.** Marca los pagos a tiempo en Admin. Las reservas sin pagar se anulan, igual que en el sorteo manual.
- **Si a la hora no hay ningún número pagado, ese día no se sortea solo.** Queda abierto para el sorteo manual (así no se sortea con un solo número en cuanto alguien paga a las 19:05).
- **Una ronda de un día anterior que quedó abierta con números pagados se sortea sola** apenas la web vuelva a estar despierta.
- **En el plan gratis hace falta el vigía.** Si Render duerme el servicio a las 19:00, el sorteo ocurre cuando alguien lo despierte. Con el vigía de `/salud` cada 5 minutos, ocurre como mucho 5 minutos tarde. El sorteo manual sigue funcionando.
- Después del sorteo ya no se puede reservar hasta mañana, como siempre.

## Día a día

1. Cada miembro reserva sus números (hasta 10 por ronda).
2. Pagan al administrador, que los marca como pagados en **Admin → Rondas abiertas**.
3. **Cerrar ventas y sortear** (o dejar que lo haga solo a las 19:00). Las reservas sin pagar se anulan. Todos ven el resultado con la animación y pueden verificarlo con un botón.
4. Entrega el premio y márcalo como entregado.
5. Cuando el grupo invierta, cobre un retorno o reparta ganancias, regístralo en **Admin → Registrar movimiento del banco**. Nada se edita ni se borra: los errores se corrigen con un ajuste.
6. Cada semana, descarga el respaldo (`Admin → Descargar respaldo`) y guárdalo fuera de la web.

## Variables de entorno

| Variable | Para qué | Valor por defecto |
|---|---|---|
| `ADMIN_CODE` | Código del administrador (obligatorio, mínimo 10 caracteres) | — |
| `SECRET_KEY` | Firma de las sesiones (Render la genera sola) | aleatoria en cada arranque |
| `DB_PATH` | Ruta del archivo de base de datos | `pozo.db` junto a `app.py` |
| `AUTO_DRAW_TIME` | Hora inicial del sorteo automático (se cambia en Admin) | `19:00` |
| `AUTO_DRAW_ENABLED` | `0` para empezar con el sorteo automático apagado | `1` |
| `PRICE_CENTS` | Precio inicial por número, en centavos | `100` |
| `NUMBER_RANGE` | Los números van de 1 a este valor | `100` |
| `MAX_TICKETS_PER_MEMBER` | Máximo de números por persona y ronda | `10` |

## Cómo se decide el ganador

- Al abrir la ronda, el servidor crea un secreto y publica su huella SHA-256 (antes de que exista cualquier reserva).
- Al sortear, se ordenan los números **pagados** y se calcula `SHA-256("secreto|día|n1,n2,...")`. Ese resultado, como número entero, módulo la cantidad de números pagados, da la posición del ganador.
- Se revela el secreto. En la página de la ronda, el botón "Verificar en mi navegador" recalcula todo sin pedirle nada al servidor.

## Límites conocidos

- Hay un solo administrador. Quien tenga `ADMIN_CODE` puede marcar pagos y sortear; cuídalo.
- No hay recuperación de códigos: si alguien pierde el suyo, se genera uno nuevo.
- Con disco, Render detiene el servicio unos segundos en cada deploy y no se puede escalar a varias instancias. Para 8 personas no importa.
- El respaldo es un registro en JSON; no hay función de restaurarlo desde la web.

## Archivos

- `app.py`: toda la lógica.
- `templates/`, `static/`: páginas, estilos y el JavaScript de la ruleta y la verificación.
- `animals.py`: el nombre del animal de cada número (1 a 100). Lo genera `tools/make_sprites.py`.
- `static/bg.jpg`: la imagen del bosque que se ve de fondo. Para cambiarla, reemplaza ese archivo por otra imagen con el mismo nombre.
- `static/sprites.png` y `static/sprites.css`: los 100 animales reales en pixel art (32×32 píxeles cada uno).
- `tools/`: el código que dibuja los animales. Solo hace falta si quieres cambiar o agregar uno: `cd tools && python make_sprites.py` (requiere `pip install pillow`, solo en tu computadora; Render no lo necesita).
- `static/chess.js`, `static/chess-ui.js`, `static/chess-online.js`, `static/chess.png`: el ajedrez (motor, tablero y piezas en pixel art).
- `static/domino.js`, `static/domino-ui.js`, `static/domino-view.js`, `static/domino-online.js`, `domino_engine.py`: el dominó (motor del navegador, mesa, dibujo de fichas, cliente en línea y motor del servidor).
- `rules.txt`: las reglas que ve el grupo (edítalo).
- `render.yaml`, `requirements.txt`: despliegue.
- `test_app.py`: pruebas del flujo completo.
