# Implementation Plan: The Gang

## Overview

Este plan convierte el diseño de **The Gang** en una serie de tareas de codificación incrementales. La estrategia prioriza construir primero la **lógica de juego pura y testeable** (modelos de datos, Evaluador_Manos, Gestor_Fichas, Motor_Juego, resolución del Showdown), validándola con pruebas basadas en propiedades (PBT) usando fast-check con un mínimo de 100 iteraciones. Una vez consolidada la lógica pura, se construye la capa de transporte (HTTP + WebSocket, sesiones, reconexión, difusión filtrada) y por último el Cliente_Jugador (SPA en español con temática de ladrones). El plan cierra con pruebas de integración y end-to-end.

Cada tarea construye sobre las anteriores y termina integrándose con el resto del sistema; no queda código huérfano. Las propiedades de correctitud del diseño se mapean a sub-tareas de prueba etiquetadas con el formato `Feature: the-gang-game, Property N`.

## Tasks

- [x] 1. Configurar el proyecto y la infraestructura base
  - Inicializar proyecto Node.js + TypeScript con configuración estricta (`tsconfig.json`)
  - Configurar Vite para el cliente SPA y scripts npm (`npm start`, `npm run build`, `npm test`)
  - Instalar y configurar Vitest + fast-check para pruebas (con `numRuns >= 100` por defecto en helpers de PBT)
  - Crear estructura de carpetas: `src/dominio` (lógica pura), `src/servidor` (transporte/coordinador), `src/cliente` (SPA), `tests`
  - _Requirements: 1.1_

- [x] 2. Implementar modelos de datos del dominio
  - [x] 2.1 Definir tipos y modelos base del juego
    - Implementar tipos `Carta` (valor 2..14, palo), `Palo`, `Ficha`, `ColorFicha`, enum `CategoriaMano` (respetando el orden de The Gang: Full House < Póker < Color)
    - Implementar tipos de estado: `Jugador`, `EstadoFichas`, `EstadoGolpe`, `EstadoPartida`, `FasePartida`, `Ronda`, `Semilla`
    - Implementar tipos de resultado y error: `ErrorJuego`, `CodigoError`, `ResultadoAccion`, `ResultadoFichas`, `ResultadoEvaluacion`
    - Crear función de construcción de la baraja completa de 52 cartas distintas
    - _Requirements: 4.1, 7.2_
  - [x]* 2.2 Escribir pruebas unitarias de los modelos de datos
    - Verificar que la baraja tiene 52 cartas distintas y que el enum `CategoriaMano` ordena Full House < Póker < Color
    - _Requirements: 7.2_

- [x] 3. Implementar el barajado determinista y el reparto de cartas
  - [x] 3.1 Implementar barajado determinista por semilla y funciones de reparto
    - Implementar barajado reproducible (PRNG sembrado) que produce permutaciones de la baraja a partir de una `Semilla`
    - Implementar reparto de 2 Cartas de Bolsillo por Jugador y revelado incremental de Comunitarias (3 en Flop, 4 en Turn, 5 en River) sin repetición
    - _Requirements: 4.1, 4.3, 4.4, 4.5_
  - [x]* 3.2 Escribir prueba de propiedad de no repetición y conteo de cartas
    - **Property 1: No repetición y conteo correcto de cartas**
    - **Validates: Requirements 4.1, 4.3, 4.4, 4.5**

- [x] 4. Implementar el Evaluador_Manos (lógica pura)
  - [x] 4.1 Implementar la evaluación de la mejor mano de 5 entre 7 y la clasificación de categorías
    - Generar las C(7,5)=21 combinaciones y seleccionar la de mayor fuerza
    - Clasificar en una de las diez categorías del Ranking_de_Manos según el orden de The Gang
    - Construir el vector de desempate (`ranks`) y las `cartasOrdenadas` de la `ManoEvaluada`
    - Devolver `CARTAS_INSUFICIENTES` cuando faltan cartas
    - _Requirements: 7.1, 7.2, 7.5_
  - [x] 4.2 Implementar el comparador, los kickers y la detección de Empate_Verdadero
    - Implementar `comparar` (orden por categoría, luego valores y kickers descendentes), tratando A-2-3-4-5 como la escalera más baja (As como 1 solo en ese caso)
    - Implementar `esEmpateVerdadero` consistente con la comparación de igualdad
    - _Requirements: 7.3, 7.4_
  - [x]* 4.3 Escribir prueba de propiedad: elige la mejor combinación de cinco entre siete
    - **Property 16: El Evaluador_Manos elige la mejor combinación de cinco entre siete**
    - **Validates: Requirements 7.1**
  - [x]* 4.4 Escribir prueba de propiedad model-based de clasificación de categoría
    - **Property 17: Clasificación correcta de categoría (model-based)**
    - Implementar un evaluador de referencia independiente como oráculo
    - **Validates: Requirements 7.2**
  - [x]* 4.5 Escribir prueba de propiedad: comparador total y consistente con el desempate
    - **Property 18: El comparador es total y consistente con el desempate**
    - **Validates: Requirements 7.3**
  - [x]* 4.6 Escribir prueba de propiedad: Empate Verdadero equivale a comparación nula
    - **Property 19: Empate Verdadero equivale a comparación nula**
    - **Validates: Requirements 7.4**
  - [x]* 4.7 Escribir prueba de propiedad: evaluación con cartas insuficientes produce error
    - **Property 20: Evaluación con cartas insuficientes produce error**
    - **Validates: Requirements 7.5**
  - [x]* 4.8 Escribir pruebas por ejemplo de manos canónicas
    - Casos concretos: escalera real, full house vs color según el ranking de The Gang, rueda A-2-3-4-5, empate verdadero
    - _Requirements: 7.2, 7.3, 7.4_

- [x] 5. Checkpoint - Evaluador_Manos y reparto verificados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implementar el Gestor_Fichas (lógica pura)
  - [x] 6.1 Implementar la preparación de fichas y la disponibilidad por color activo
    - Implementar `prepararFichas(numJugadores)` retirando fichas con estrellas > N y exponiendo valores 1..N por color
    - Implementar `fichasDisponibles` y la regla de que solo el color de la Ronda activa está disponible
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - [x] 6.2 Implementar toma e intercambio de fichas con validaciones
    - Implementar `tomar` (centro → jugador), `intercambiarConCentro`, `intercambiarConJugador` y `todosTienenFichaDelColor`
    - Rechazar acciones inválidas (estrellas > N, color no activo, color duplicado, ficha no disponible) conservando el estado
    - Garantizar que un jugador no posea dos fichas del mismo color y que no se transfieran fichas salvo por intercambio
    - _Requirements: 5.5, 6.1, 6.2, 6.3, 6.4, 6.5, 6.7, 6.8_
  - [x]* 6.3 Escribir prueba de propiedad: preparación de fichas según número de jugadores
    - **Property 10: Preparación de Fichas según el número de Jugadores**
    - **Validates: Requirements 5.1, 5.2**
  - [x]* 6.4 Escribir prueba de propiedad: invariante de conservación de fichas
    - **Property 11: Invariante de conservación de Fichas**
    - **Validates: Requirements 5.3, 5.4**
  - [x]* 6.5 Escribir prueba de propiedad: acciones de fichas inválidas conservan el estado
    - **Property 12: Acciones de Fichas inválidas conservan el estado**
    - **Validates: Requirements 5.5, 6.2, 6.5**
  - [x]* 6.6 Escribir prueba de propiedad: toma de ficha transfiere del centro al jugador
    - **Property 13: Toma de Ficha transfiere del centro al Jugador**
    - **Validates: Requirements 6.1**
  - [x]* 6.7 Escribir prueba de propiedad: intercambio conserva cardinalidad y permuta poseedores
    - **Property 14: Intercambio de Fichas conserva la cardinalidad y permuta poseedores**
    - **Validates: Requirements 6.3, 6.4**
  - [x]* 6.8 Escribir prueba de propiedad: las fichas no se transfieren salvo por intercambio
    - **Property 15: Las Fichas no se transfieren a otro Jugador salvo por intercambio**
    - **Validates: Requirements 6.7**

- [x] 7. Checkpoint - Gestor_Fichas verificado
  - Ensure all tests pass, ask the user if questions arise.

- [x] 8. Implementar el registro de jugadores y el lobby (lógica pura)
  - [x] 8.1 Implementar registro y validación de jugadores en LOBBY
    - Implementar registro con nombre válido (1..20 chars, no vacío, único) y rechazo de nombres inválidos o cuando ya hay 6 jugadores, conservando la lista
    - Implementar abandono antes del inicio y la condición de mínimo 3 jugadores para iniciar
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - [x]* 8.2 Escribir prueba de propiedad: registro de jugador con nombre válido
    - **Property 5: Registro de Jugador con nombre válido**
    - **Validates: Requirements 2.1**
  - [x]* 8.3 Escribir prueba de propiedad: rechazo de registro inválido conserva la lista
    - **Property 6: Rechazo de registro inválido conserva la lista**
    - **Validates: Requirements 2.2, 2.3**
  - [x]* 8.4 Escribir pruebas por ejemplo de lobby
    - Inicio impedido con 0, 1, 2 jugadores; lista visible en LOBBY
    - _Requirements: 2.4, 2.5_

- [x] 9. Implementar el Motor_Juego: flujo de partida, golpes y rondas (lógica pura)
  - [x] 9.1 Implementar inicio de partida y secuencia de rondas
    - Implementar `iniciarPartida` (Golpe 1 en Pre-Flop, integrando preparación de fichas y reparto) y `aplicarAccion` con avance de rondas en el orden Pre-Flop → Flop → Turn → River → Showdown
    - Habilitar el avance de ronda/showdown solo cuando todos los jugadores tienen ficha del color activo
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 6.8_
  - [x] 9.2 Implementar el encadenamiento de golpes acotado a cinco
    - Iniciar el siguiente Golpe en Pre-Flop con número incrementado cuando no se cumple condición de fin y se han jugado menos de cinco golpes
    - Finalizar la partida tras el quinto golpe sin golpes adicionales
    - _Requirements: 3.5, 3.6, 3.7_
  - [x]* 9.3 Escribir prueba de propiedad: inicio de partida y secuencia de rondas
    - **Property 7: Inicio de Partida y secuencia de Rondas**
    - **Validates: Requirements 3.1, 3.2**
  - [x]* 9.4 Escribir prueba de propiedad: avance de ronda condicionado a fichas completas
    - **Property 8: Avance de Ronda condicionado a Fichas completas**
    - **Validates: Requirements 3.3, 3.4, 6.8**
  - [x]* 9.5 Escribir prueba de propiedad: encadenamiento de golpes acotado a cinco
    - **Property 9: Encadenamiento de Golpes acotado a cinco**
    - **Validates: Requirements 3.5, 3.6**
  - [x]* 9.6 Escribir prueba por ejemplo: finalización exacta tras el quinto golpe
    - _Requirements: 3.7_

- [x] 10. Implementar la resolución del Showdown y las condiciones de fin de partida (lógica pura)
  - [x] 10.1 Implementar el ordenamiento del Showdown y la evaluación de éxito/fracaso
    - Construir el orden ascendente por ficha roja (biyección con valores 1..N) y evaluar fuerza no decreciente con el comparador del Evaluador_Manos
    - Tratar Empates_Verdaderos consecutivos como satisfechos, evaluando solo respecto a los no empatados que los rodean
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_
  - [x] 10.2 Implementar la actualización de bóvedas/alarmas y las condiciones de fin de partida
    - Incrementar exactamente una Bóveda (éxito) o una Alarma (fracaso); finalizar con victoria a 3 Bóvedas o derrota a 3 Alarmas
    - Garantizar la estabilidad del estado FINALIZADA ante acciones posteriores (Modo Básico por defecto: 3 Alarmas, sin cartas de desafío)
    - _Requirements: 8.6, 8.7, 9.1, 9.2, 9.4, 12.5_
  - [x]* 10.3 Escribir prueba de propiedad: orden del Showdown es una biyección ascendente
    - **Property 21: Orden del Showdown es una biyección ascendente**
    - **Validates: Requirements 8.1, 8.2**
  - [x]* 10.4 Escribir prueba de propiedad: éxito del golpe equivale a fuerza no decreciente
    - **Property 22: Éxito del Golpe equivale a fuerza no decreciente en el orden**
    - **Validates: Requirements 8.3, 8.4**
  - [x]* 10.5 Escribir prueba de propiedad: los Empates Verdaderos consecutivos no causan fracaso
    - **Property 23: Los Empates Verdaderos entre consecutivos no causan fracaso**
    - **Validates: Requirements 8.5**
  - [x]* 10.6 Escribir prueba de propiedad: el resultado actualiza bóvedas o alarmas en exactamente uno
    - **Property 24: El resultado del Golpe actualiza Bóvedas o Alarmas en exactamente uno**
    - **Validates: Requirements 8.6, 8.7**
  - [x]* 10.7 Escribir prueba de propiedad: condiciones de fin de partida
    - **Property 25: Condiciones de fin de Partida**
    - **Validates: Requirements 9.1, 9.2**
  - [x]* 10.8 Escribir prueba de propiedad: el estado finalizado es estable
    - **Property 26: El estado finalizado es estable**
    - **Validates: Requirements 9.4**

- [x] 11. Checkpoint - Lógica de juego pura completa y verificada
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implementar la proyección de vistas por jugador y la privacidad (lógica pura)
  - [x] 12.1 Implementar la función de proyección de estado por jugador
    - Proyectar el `EstadoPartida` a una vista personalizada que oculta las Cartas de Bolsillo ajenas antes del Showdown y las revela todas en el Showdown
    - Asegurar que las solicitudes de cartas ajenas antes del Showdown produzcan `ACCION_NO_PERMITIDA` sin revelar valores
    - _Requirements: 4.2, 4.6, 4.7, 10.3, 10.4_
  - [x]* 12.2 Escribir prueba de propiedad: privacidad de las Cartas de Bolsillo antes del Showdown
    - **Property 2: Privacidad de las Cartas de Bolsillo antes del Showdown**
    - **Validates: Requirements 4.2, 4.6**
  - [x]* 12.3 Escribir prueba de propiedad: revelado de bolsillos en el Showdown
    - **Property 3: Revelado de bolsillos en el Showdown**
    - **Validates: Requirements 10.3**
  - [x]* 12.4 Escribir prueba por ejemplo: rechazo de solicitud de cartas ajenas sin revelar valor
    - _Requirements: 4.7, 10.4_

- [x] 13. Implementar la capa de servidor: HTTP, WebSocket y sesiones
  - [x] 13.1 Implementar el Servidor_Local (HTTP + WebSocket) y la publicación de la dirección LAN
    - Implementar `iniciar(puerto)` con Express sirviendo la SPA y publicando la `DireccionAcceso` (URL/IP LAN), manejo de puerto ocupado
    - Aceptar conexiones WebSocket, serializar/deserializar mensajes JSON e ignorar mensajes malformados con error genérico al emisor
    - _Requirements: 1.1, 1.2, 1.3_
  - [x] 13.2 Implementar el gestor de sesiones, reconexión y partida única
    - Implementar `SesionJugador` con `sessionId`, garantizar como máximo una partida activa y rechazar segunda partida
    - Preservar el estado del jugador desconectado y restaurarlo en la reconexión por nombre; rechazar reincorporación a partida finalizada
    - _Requirements: 1.4, 1.5, 1.6, 1.7, 1.8_
  - [x]* 13.3 Escribir prueba de propiedad: reconexión preserva y restaura el estado del jugador
    - **Property 4: Reconexión preserva y restaura el estado del Jugador (round trip)**
    - **Validates: Requirements 1.6, 1.7**
  - [x]* 13.4 Escribir pruebas por ejemplo de sesiones
    - Una sola partida activa y rechazo de la segunda; rechazo de reincorporación a partida finalizada
    - _Requirements: 1.4, 1.5, 1.8_

- [x] 14. Implementar el Coordinador de Partida y el Difusor de Estado
  - [x] 14.1 Implementar el coordinador que valida acciones y aplica el Motor_Juego
    - Recibir mensajes validados con `sessionId`, aplicar acciones al estado autoritativo y devolver errores de juego solo al emisor sin mutar el estado compartido
    - _Requirements: 4.7, 10.4_
  - [x] 14.2 Implementar el difusor de estado con vistas filtradas por jugador
    - Difundir a cada cliente su vista personalizada (usando la proyección de la tarea 12) ante cambios de lista de jugadores, fichas y resultado final
    - _Requirements: 2.6, 6.6, 9.3_
  - [x]* 14.3 Escribir pruebas de integración del coordinador y la difusión
    - Verificar que un cambio en jugadores, fichas o resultado dispara un broadcast a los clientes conectados
    - _Requirements: 2.6, 6.6, 9.3_

- [x] 15. Checkpoint - Servidor y coordinación verificados
  - Ensure all tests pass, ask the user if questions arise.

- [x] 16. Implementar el Cliente_Jugador (SPA en español con temática de ladrones)
  - [x] 16.1 Implementar el armazón de la SPA, la conexión WebSocket y el lobby
    - Crear la SPA con Vite, conexión WebSocket, manejo de estado recibido y vista de lobby (unirse con nombre, lista de jugadores, iniciar partida)
    - Todos los textos en español con temática de ladrones y términos del glosario
    - _Requirements: 1.3, 2.1, 2.5, 11.1, 11.2_
  - [x] 16.2 Implementar la mesa de juego: cartas, fichas y acciones
    - Renderizar Cartas de Bolsillo propias, Cartas Comunitarias, fichas disponibles/en posesión; enviar acciones tomar/intercambiar ficha y avanzar
    - No ofrecer UI para revelar/comunicar cartas ni chat libre; mostrar recordatorio permanente de no revelar/no bluff
    - _Requirements: 6.6, 10.1, 10.2, 10.5, 11.1, 11.2_
  - [x] 16.3 Implementar la vista de Showdown, resultado final y consulta del Ranking_de_Manos
    - Mostrar el revelado de manos en el orden del Showdown, el resultado de victoria/derrota temático, y un panel consultable con las diez categorías ordenadas
    - _Requirements: 8.2, 9.3, 11.3_
  - [x]* 16.4 Escribir pruebas por ejemplo del cliente
    - Ausencia de acciones para comunicar cartas y de chat libre; recordatorio permanente visible; idioma español y términos del glosario; ranking de manos en orden
    - _Requirements: 10.1, 10.2, 10.5, 11.1, 11.2, 11.3_

- [x] 17. Integración y pruebas end-to-end
  - [x] 17.1 Cablear servidor, coordinador, difusor y cliente en el arranque de la aplicación
    - Integrar todos los módulos en el punto de entrada `npm start`, sirviendo la SPA y aceptando clientes WebSocket reales contra el estado autoritativo
    - _Requirements: 1.1, 1.2, 1.3_
  - [x]* 17.2 Escribir prueba smoke del arranque del servidor
    - El Servidor_Local arranca, escucha en una dirección LAN dentro del límite de tiempo y publica la URL
    - _Requirements: 1.1, 1.2_
  - [x]* 17.3 Escribir prueba de integración: la SPA se entrega en español por HTTP
    - _Requirements: 1.3_
  - [x]* 17.4 Escribir prueba de integración end-to-end de un golpe completo
    - Dos o tres clientes WebSocket simulan un golpe (unirse → tomar fichas por ronda → showdown) y verifican la sincronización de estado y la privacidad de cartas
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 4.2, 8.1, 8.2_

- [x] 18. Checkpoint final - Asegurar que todas las pruebas pasan
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Las tareas marcadas con `*` son opcionales (pruebas) y pueden omitirse para un MVP más rápido; las tareas de implementación central nunca son opcionales.
- Cada tarea referencia requisitos específicos para trazabilidad.
- Las pruebas basadas en propiedades usan fast-check con un mínimo de 100 iteraciones y se etiquetan con el formato `Feature: the-gang-game, Property N: {texto}`.
- Las 26 propiedades de correctitud del diseño se implementan cada una como una única prueba de propiedad, ubicada cerca de la implementación que valida.
- La Property 17 usa model-based testing con un evaluador de referencia independiente como oráculo.
- Los criterios de infraestructura/tiempo real (arranque, servir SPA, difusión) se cubren con pruebas de integración/smoke, no con PBT, conforme a la Testing Strategy del diseño.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1.1"] },
    { "id": 1, "tasks": ["2.1"] },
    { "id": 2, "tasks": ["2.2", "3.1", "4.1", "6.1", "8.1"] },
    { "id": 3, "tasks": ["3.2", "4.2", "6.2", "8.2", "8.3", "8.4"] },
    { "id": 4, "tasks": ["4.3", "4.4", "4.5", "4.6", "4.7", "4.8", "6.3", "6.4", "6.5", "6.6", "6.7", "6.8", "9.1"] },
    { "id": 5, "tasks": ["9.2", "9.3", "9.4", "10.1"] },
    { "id": 6, "tasks": ["9.5", "9.6", "10.2", "12.1"] },
    { "id": 7, "tasks": ["10.3", "10.4", "10.5", "10.6", "10.7", "10.8", "12.2", "12.3", "12.4", "13.1"] },
    { "id": 8, "tasks": ["13.2", "14.1"] },
    { "id": 9, "tasks": ["13.3", "13.4", "14.2"] },
    { "id": 10, "tasks": ["14.3", "16.1"] },
    { "id": 11, "tasks": ["16.2", "16.3"] },
    { "id": 12, "tasks": ["16.4", "17.1"] },
    { "id": 13, "tasks": ["17.2", "17.3", "17.4"] }
  ]
}
```
