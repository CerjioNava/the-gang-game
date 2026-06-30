# The Gang

Juego cooperativo de póker para jugar en la red local de la oficina. Una **banda de ladrones profesionales** coopera para abrir **tres bóvedas** antes de que salten **tres alarmas**. El Anfitrión levanta un servidor en su PC y el resto del equipo se conecta desde el navegador, en la misma red.

Toda la interfaz está en español y mantiene la temática de un golpe perfecto. Esta versión implementa el **Modo Básico** para **3 a 6 jugadores**.

> Basado en el juego de mesa *The Gang*. Este proyecto es una implementación para jugar de forma local con tu equipo.

---

## Cómo se juega

El objetivo es **abrir 3 bóvedas** (golpes exitosos) antes de **activar 3 alarmas** (golpes fallidos). Todos ganan o pierden juntos.

**Regla de oro:** está prohibido mostrar, decir o insinuar tus cartas, y no se permite el bluff. Solo os coordináis con las fichas.

Una partida se compone de varios **golpes**. Cada golpe tiene cuatro rondas:

| Ronda      | Se revela                    | Fichas    |
|------------|------------------------------|-----------|
| Pre-Flop   | 2 cartas de bolsillo privadas | Blancas  |
| Flop       | 3 cartas comunitarias         | Amarillas |
| Turn       | 1 carta comunitaria           | Naranjas  |
| River      | 1 carta comunitaria           | Rojas     |

En cada ronda, cada jugador toma o intercambia **una ficha** de ese color para estimar la fuerza de su mano respecto al resto (más estrellas = mano más fuerte). Solo se puede tener una ficha de cada color.

En el **Showdown** solo cuentan las fichas rojas: las manos se revelan en orden ascendente, empezando por la ficha roja de 1 estrella. Si la fuerza de las manos no decrece a lo largo de ese orden, el golpe es un éxito (bóveda dorada); si alguien resulta más débil que un jugador anterior, el golpe fracasa (alarma roja).

El ranking de manos sigue el orden propio de The Gang, consultable en todo momento desde el botón **"Ranking de manos"**:

> Carta Alta < Par < Dos Pares < Trío < Escalera < **Full House < Póker < Color** < Escalera de Color < Escalera Real

(Atención: a diferencia del póker tradicional, aquí el Color vence al Póker y al Full House.)

---

## Requisitos

- **Node.js 18 o superior** (recomendado 20+).
- Todos los jugadores en la **misma red local** (LAN / mismo Wi-Fi).

---

## Instalación y arranque

Desde la PC del Anfitrión, en la carpeta del proyecto:

```bash
npm install      # solo la primera vez
npm run build    # compila la interfaz del cliente
npm start        # levanta el servidor
```

Al arrancar verás algo como:

```
[The Gang] Servidor_Local en marcha.
[The Gang] Comparte esta dirección con tu equipo: http://192.168.1.42:3000
[The Gang] (IP LAN: 192.168.1.42, puerto: 3000)
```

Comparte esa URL con tus compañeros. Cada uno la abre en su navegador, se une con un nombre y, con **3 a 6 jugadores**, podéis dar el golpe.

> El Anfitrión también juega: basta con abrir la misma dirección (o `http://localhost:3000`) en su navegador.

### Cambiar el puerto

Por defecto se usa el puerto `3000`. Si está ocupado, el servidor intenta automáticamente los siguientes. También puedes fijarlo:

```bash
# Windows (cmd)
set PUERTO=4000 && npm start

# PowerShell
$env:PUERTO=4000; npm start
```

---

## Cómo jugar paso a paso

1. El Anfitrión ejecuta `npm start` y comparte la dirección.
2. Cada jugador abre la URL e introduce su **alias** (1 a 20 caracteres, único).
3. Con 3 a 6 jugadores en la sala, alguien pulsa **"Dar el golpe"** para iniciar.
4. En cada ronda, toma o intercambia tu ficha del color activo y pulsad **"Avanzar"** cuando todos tengáis la vuestra.
5. En el Showdown se revelan las manos y se resuelve el golpe.
6. Repetís hasta abrir 3 bóvedas (victoria) o activar 3 alarmas (derrota).

Si alguien pierde la conexión, puede volver a entrar con **el mismo alias** y recuperar su sitio en la partida en curso.

---

## Solución de problemas

- **Mis compañeros no pueden conectarse.** Asegúrate de que están en la misma red y de que el **firewall de Windows** permite a Node.js aceptar conexiones entrantes (suele aparecer un aviso la primera vez; acepta "Redes privadas"). Comprueba también que usan la **IP LAN** que muestra la consola, no `localhost`.
- **"Interfaz del juego no encontrada".** Ejecuta `npm run build` antes de `npm start` para generar el cliente.
- **El puerto está ocupado.** El servidor probará puertos siguientes automáticamente, o fija uno con la variable `PUERTO`.

---

## Nota de seguridad

El servidor está pensado para una **LAN de confianza** (la oficina). No incluye autenticación fuerte: cualquier equipo de la misma red puede conectarse. Es aceptable para el uso previsto, pero no lo expongas a internet.

---

## Para desarrolladores

### Estructura del proyecto

```
src/
  dominio/    Lógica de juego pura, sin I/O (motor, evaluador de manos,
              gestor de fichas, showdown, proyección de vistas).
  servidor/   Capa de transporte: HTTP + WebSocket, sesiones/reconexión,
              coordinador del estado autoritativo y difusor de vistas.
  cliente/    SPA en español (Vite): lobby, mesa de juego, showdown,
              resultado y panel de ranking de manos.
tests/        Pruebas: por propiedad (fast-check), por ejemplo, integración y
              end-to-end.
```

La lógica de juego vive en módulos **puros** (sin red ni I/O), lo que permite validarla con **pruebas basadas en propiedades**. El servidor es la única fuente de verdad del estado; los clientes solo renderizan la vista recibida y envían intenciones.

### Stack

- **Servidor:** Node.js + TypeScript + Express + `ws` (WebSocket).
- **Cliente:** SPA ligera con Vite (TypeScript, sin framework pesado).
- **Pruebas:** Vitest + fast-check (property-based testing) + jsdom (vistas del cliente).

### Scripts

| Script                 | Descripción                                              |
|------------------------|----------------------------------------------------------|
| `npm start`            | Arranca el Servidor_Local (sirve la SPA ya compilada).   |
| `npm run build`        | Compila el servidor y empaqueta el cliente (`dist/cliente`). |
| `npm test`             | Ejecuta toda la suite de pruebas una vez.                |
| `npm run test:watch`   | Pruebas en modo observación.                             |
| `npm run typecheck`    | Verificación de tipos con TypeScript.                    |
| `npm run dev:cliente`  | Servidor de desarrollo de Vite para iterar en el cliente. |

### Pruebas

```bash
npm test
```

La suite cubre el evaluador de manos, el gestor de fichas, el motor de juego y la resolución del showdown con propiedades de correctitud, además de pruebas de integración del servidor y un escenario end-to-end de un golpe completo con varios clientes WebSocket.
