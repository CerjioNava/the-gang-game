# Requirements Document

## Introduction

The Gang es un juego de mesa cooperativo basado en el póker para 3 a 6 jugadores que asumen el rol de un grupo de ladrones profesionales. El objetivo de esta funcionalidad es construir una aplicación web que permita jugar The Gang de forma local en una oficina: un usuario levanta un servidor local en su PC y sus compañeros se conectan desde la misma red local (LAN) para participar todos en una misma partida.

El equipo coopera para abrir tres bóvedas antes de activar tres alarmas. Toda la interfaz y los textos están en español y mantienen la temática de un grupo de ladrones profesionales planificando golpes.

El alcance de esta versión inicial se centra en el **Modo Básico** jugable en LAN mediante un servidor local. Los modos Avanzado, Profesional y Ladrón Maestro se documentan como funcionalidad opcional/futura.

## Glossary

- **Servidor_Local**: Proceso de la aplicación que un usuario ejecuta en su PC y que aloja una única partida, gestiona el estado del juego y acepta conexiones de clientes en la red local (LAN).
- **Cliente_Jugador**: Interfaz web (navegador) mediante la cual un jugador se conecta al Servidor_Local y participa en la partida.
- **Motor_Juego**: Componente del Servidor_Local que controla el flujo de la partida, los golpes y las rondas, y aplica las reglas.
- **Evaluador_Manos**: Componente que determina la categoría y la fuerza de una mano de póker a partir de las mejores 5 cartas entre las 2 cartas de bolsillo y las 5 cartas comunitarias.
- **Gestor_Fichas**: Componente que administra las fichas disponibles, su asignación a jugadores y las restricciones de toma e intercambio.
- **Jugador**: Persona conectada a la partida mediante un Cliente_Jugador.
- **Anfitrión**: Jugador que ejecuta el Servidor_Local e inicia la partida.
- **Partida**: Sesión completa de juego compuesta por entre tres y cinco Golpes.
- **Golpe (Heist)**: Unidad de juego compuesta por cuatro Rondas secuenciales (Pre-Flop, Flop, Turn, River) que finaliza con un Showdown.
- **Ronda**: Fase dentro de un Golpe en la que se revelan cartas y los jugadores toman una ficha de un color determinado. Las Rondas son Pre-Flop (fichas blancas), Flop (fichas amarillas), Turn (fichas naranjas) y River (fichas rojas).
- **Cartas de Bolsillo**: Las dos cartas privadas repartidas boca abajo a cada Jugador.
- **Cartas Comunitarias**: Las hasta cinco cartas reveladas boca arriba en el centro, compartidas por todos los Jugadores.
- **Ficha**: Objeto con un color (correspondiente a una Ronda) y un valor en estrellas que un Jugador toma para indicar la fuerza estimada de su mano respecto a los demás.
- **Showdown**: Fase de resolución de un Golpe en la que se comparan las manos según el orden de las fichas rojas.
- **Bóveda**: Carta de objetivo que se voltea a su lado dorado cuando un Golpe es exitoso.
- **Alarma**: Carta de penalización que se voltea a su lado rojo cuando un Golpe fracasa.
- **Empate_Verdadero**: Situación en la que las mejores manos de cinco cartas de varios Jugadores son exactamente iguales, de modo que el orden relativo de sus fichas entre ellos es irrelevante.
- **Ranking_de_Manos**: Orden de categorías de póker, de menor a mayor: Carta Alta, Par, Dos Pares, Trío, Escalera, Full House, Póker, Color, Escalera de Color y Escalera Real.

## Requirements

### Requirement 1: Ejecución del servidor local y conexión LAN

**User Story:** Como Anfitrión, quiero levantar un servidor local en mi PC y que mis compañeros se conecten desde la misma red, para que todos podamos jugar juntos en una misma partida sin servicios externos.

#### Acceptance Criteria

1. WHEN el Anfitrión inicia la aplicación, THE Servidor_Local SHALL comenzar a escuchar conexiones en una dirección accesible desde la red local en un plazo no mayor de 10 segundos.
2. WHEN el Servidor_Local comienza a escuchar conexiones, THE Servidor_Local SHALL mostrar al Anfitrión la dirección de acceso a la que pueden conectarse los Clientes_Jugador.
3. WHEN un Cliente_Jugador en la misma red local accede a la dirección publicada, THE Servidor_Local SHALL entregar la interfaz web del juego en español.
4. THE Servidor_Local SHALL alojar como máximo una Partida activa a la vez.
5. IF se intenta crear una segunda Partida mientras ya existe una Partida activa, THEN THE Servidor_Local SHALL conservar la Partida activa existente e informar que ya hay una Partida en curso.
6. WHEN un Cliente_Jugador pierde la conexión con el Servidor_Local, THE Servidor_Local SHALL conservar el estado del Jugador desconectado (sus Cartas de Bolsillo, las Fichas que ha tomado y su posición en la Partida) mientras la Partida siga activa.
7. WHEN un Jugador previamente desconectado vuelve a conectarse a la misma Partida usando su nombre registrado, THE Servidor_Local SHALL restaurar para ese Jugador sus Cartas de Bolsillo, sus Fichas, y la Ronda y el Golpe en curso.
8. IF un Jugador intenta reincorporarse a una Partida que ya ha finalizado, THEN THE Servidor_Local SHALL rechazar la reincorporación e informar que la Partida ha finalizado.

### Requirement 2: Incorporación de jugadores a la partida

**User Story:** Como Jugador, quiero unirme a la partida con un nombre identificable, para que el equipo sepa quién participa y respetar el límite de jugadores.

#### Acceptance Criteria

1. WHEN un Jugador se une a la Partida antes del inicio con un nombre de entre 1 y 20 caracteres, no vacío y único dentro de la Partida, THE Servidor_Local SHALL registrar al Jugador con ese nombre visible para el resto de los Jugadores.
2. IF un Jugador intenta unirse con un nombre vacío, de más de 20 caracteres o ya utilizado por otro Jugador en la Partida, THEN THE Servidor_Local SHALL rechazar la incorporación, conservar la lista de Jugadores sin cambios e informar el motivo del rechazo.
3. IF un Jugador intenta unirse cuando ya hay 6 Jugadores registrados, THEN THE Servidor_Local SHALL rechazar la incorporación, conservar la lista de Jugadores sin cambios e informar que la Partida está completa.
4. IF el Anfitrión intenta iniciar la Partida con menos de 3 Jugadores registrados, THEN THE Servidor_Local SHALL impedir el inicio, conservar la Partida sin comenzar e informar que se requieren al menos 3 Jugadores.
5. WHILE la Partida no ha comenzado, THE Servidor_Local SHALL mostrar a todos los Clientes_Jugador la lista de Jugadores registrados.
6. WHEN un Jugador se registra o abandona la Partida antes del inicio, THE Servidor_Local SHALL actualizar la lista de Jugadores mostrada a todos los Clientes_Jugador en un plazo no mayor de 2 segundos.

### Requirement 3: Estructura de la partida en golpes y rondas

**User Story:** Como Jugador, quiero que la partida avance por golpes y rondas con la temática de ladrones, para que la experiencia siga las reglas de The Gang.

#### Acceptance Criteria

1. WHEN el Anfitrión inicia la Partida con entre 3 y 6 Jugadores, THE Motor_Juego SHALL comenzar el primer Golpe en la Ronda Pre-Flop.
2. THE Motor_Juego SHALL estructurar cada Golpe en cuatro Rondas en el orden Pre-Flop, Flop, Turn y River.
3. WHEN todos los Jugadores poseen una Ficha del color de la Ronda activa y la Ronda activa no es River, THE Motor_Juego SHALL pasar a la siguiente Ronda del Golpe.
4. WHEN todos los Jugadores poseen una Ficha roja durante la Ronda River, THE Motor_Juego SHALL iniciar el Showdown de ese Golpe.
5. IF un Golpe finaliza sin que se hayan volteado tres Bóvedas ni tres Alarmas y se han jugado menos de cinco Golpes, THEN THE Motor_Juego SHALL iniciar el siguiente Golpe en la Ronda Pre-Flop.
6. THE Motor_Juego SHALL permitir un máximo de cinco Golpes por Partida.
7. WHEN finaliza el quinto Golpe sin que se haya cumplido una condición de fin de Partida, THE Motor_Juego SHALL finalizar la Partida sin iniciar Golpes adicionales.

### Requirement 4: Reparto de cartas y privacidad

**User Story:** Como Jugador, quiero recibir mis cartas de bolsillo de forma privada y ver las cartas comunitarias, para evaluar mi mano sin exponer información prohibida.

#### Acceptance Criteria

1. WHEN comienza la Ronda Pre-Flop de un Golpe, THE Motor_Juego SHALL repartir exactamente dos Cartas de Bolsillo boca abajo a cada Jugador, extraídas sin repetición de una baraja de 52 cartas previamente barajada de forma aleatoria.
2. WHILE un Golpe no ha llegado a su Showdown, THE Servidor_Local SHALL mostrar las Cartas de Bolsillo de un Jugador únicamente al Cliente_Jugador de ese Jugador.
3. WHEN comienza la Ronda Flop, THE Motor_Juego SHALL revelar tres Cartas Comunitarias boca arriba, extraídas de la misma baraja sin repetir cartas ya repartidas o reveladas, visibles para todos los Jugadores.
4. WHEN comienza la Ronda Turn, THE Motor_Juego SHALL revelar la cuarta Carta Comunitaria boca arriba, extraída de la misma baraja sin repetir cartas ya repartidas o reveladas, visible para todos los Jugadores.
5. WHEN comienza la Ronda River, THE Motor_Juego SHALL revelar la quinta Carta Comunitaria boca arriba, extraída de la misma baraja sin repetir cartas ya repartidas o reveladas, visible para todos los Jugadores.
6. WHILE un Golpe no ha llegado a su Showdown, THE Servidor_Local SHALL impedir que un Cliente_Jugador acceda a las Cartas de Bolsillo de otro Jugador.
7. IF un Cliente_Jugador solicita las Cartas de Bolsillo de otro Jugador antes del Showdown, THEN THE Servidor_Local SHALL rechazar la solicitud sin revelar su valor e informar al solicitante que la acción no está permitida.

### Requirement 5: Disponibilidad de fichas según el número de jugadores

**User Story:** Como Jugador, quiero que solo estén disponibles las fichas válidas para el número de jugadores, para que el rango de valores coincida con las reglas del juego.

#### Acceptance Criteria

1. WHEN comienza la Partida con N Jugadores registrados, donde N es un entero entre 3 y 6, THE Gestor_Fichas SHALL retirar de la Partida todas las Fichas de los cuatro colores (blanco, amarillo, naranja y rojo) cuyo valor en estrellas sea superior a N.
2. WHEN comienza una Ronda, THE Gestor_Fichas SHALL poner a disposición en el centro las Fichas del color correspondiente a esa Ronda con valores en estrellas desde 1 hasta N.
3. THE Gestor_Fichas SHALL considerar disponible una Ficha que se encuentra en el centro y no disponible una Ficha que ha sido tomada por un Jugador, proporcionando exactamente una Ficha por cada valor de estrella entre 1 y N para el color de la Ronda activa.
4. WHILE una Ronda no es la Ronda activa, THE Gestor_Fichas SHALL mantener no disponibles las Fichas del color correspondiente a esa Ronda.
5. IF un Jugador intenta tomar una Ficha con valor en estrellas superior a N o de un color que no corresponde a la Ronda activa, THEN THE Gestor_Fichas SHALL rechazar la acción, conservar el estado de las Fichas e informar al Cliente_Jugador.

### Requirement 6: Toma e intercambio de fichas

**User Story:** Como Jugador, quiero tomar e intercambiar fichas que reflejen la fuerza estimada de mi mano, para coordinar el orden con el equipo sin revelar mis cartas.

#### Acceptance Criteria

1. WHEN un Jugador toma una Ficha del color de la Ronda activa que está disponible en el centro y el Jugador no posee ya una Ficha de ese color, THE Gestor_Fichas SHALL retirar esa Ficha del centro y asignarla al Jugador.
2. IF un Jugador intenta tomar una Ficha de un color del que ya posee una Ficha, THEN THE Gestor_Fichas SHALL rechazar la acción, conservar el estado previo de las Fichas e informar al Cliente_Jugador.
3. WHEN un Jugador intercambia su Ficha del color de la Ronda activa por una Ficha disponible del mismo color en el centro, THE Gestor_Fichas SHALL asignar la Ficha del centro al Jugador y dejar la Ficha previa del Jugador disponible en el centro.
4. WHEN un Jugador intercambia su Ficha del color de la Ronda activa con una Ficha del mismo color asignada a otro Jugador, THE Gestor_Fichas SHALL hacer que cada uno de los dos Jugadores quede en posesión de la Ficha que antes tenía el otro.
5. IF un Jugador intenta un intercambio con una Ficha que ya no está disponible o que el otro Jugador ya no posee, THEN THE Gestor_Fichas SHALL rechazar el intercambio, conservar el estado previo de las Fichas e informar al Cliente_Jugador.
6. WHEN una Ficha cambia de poseedor o de ubicación, THE Servidor_Local SHALL actualizar la asignación de Fichas visible para todos los Clientes_Jugador en un plazo no mayor de 2 segundos.
7. THE Gestor_Fichas SHALL impedir que un Jugador coloque una Ficha directamente en posesión de otro Jugador salvo mediante un intercambio conforme a los criterios 3 y 4.
8. WHEN todos los Jugadores poseen exactamente una Ficha del color de la Ronda activa, THE Motor_Juego SHALL habilitar el avance a la siguiente Ronda o al Showdown.

### Requirement 7: Evaluación de manos de póker

**User Story:** Como Jugador, quiero que el sistema evalúe automáticamente la mejor mano de póker, para que la resolución sea objetiva y precisa.

#### Acceptance Criteria

1. WHEN se requiere evaluar la mano de un Jugador y están disponibles sus dos Cartas de Bolsillo y las cinco Cartas Comunitarias, THE Evaluador_Manos SHALL determinar una única mejor combinación de cinco cartas evaluando todas las combinaciones posibles de cinco cartas entre las siete cartas disponibles.
2. THE Evaluador_Manos SHALL clasificar cada mano en exactamente una categoría del Ranking_de_Manos, de menor a mayor: Carta Alta, Par, Dos Pares, Trío, Escalera, Full House, Póker, Color, Escalera de Color y Escalera Real.
3. WHEN dos manos pertenecen a la misma categoría del Ranking_de_Manos, THE Evaluador_Manos SHALL desempatar comparando primero los valores de las cartas que forman la categoría y, a continuación, las cartas kicker restantes en orden descendente, tratando el As como la carta de mayor valor salvo en la escalera A-2-3-4-5, donde cuenta como el valor más bajo.
4. WHEN, tras aplicar el desempate del criterio 3, las mejores combinaciones de cinco cartas de dos o más Jugadores resultan exactamente iguales en categoría y en valores de cartas, THE Evaluador_Manos SHALL clasificarlas como un Empate_Verdadero entre esos Jugadores.
5. IF se solicita evaluar la mano de un Jugador cuando no están disponibles sus dos Cartas de Bolsillo o las cinco Cartas Comunitarias, THEN THE Evaluador_Manos SHALL no producir una clasificación, conservar el estado e indicar que faltan cartas para la evaluación.

### Requirement 8: Resolución del showdown

**User Story:** Como Jugador, quiero que el showdown compare el orden de las fichas rojas con la fuerza real de las manos, para saber si el golpe fue exitoso o falló.

#### Acceptance Criteria

1. WHEN comienza el Showdown, THE Motor_Juego SHALL ordenar a los Jugadores de forma ascendente según el valor en estrellas de su Ficha roja, comenzando por la Ficha roja de 1 estrella y terminando por la Ficha roja cuyo valor sea igual al número de Jugadores, de modo que cada Jugador ocupe exactamente una posición en el orden.
2. WHEN el Motor_Juego completa el orden ascendente de las Fichas rojas, THE Motor_Juego SHALL revelar las manos de los Jugadores siguiendo ese orden ascendente, desde la Ficha roja de 1 estrella hasta la de mayor valor.
3. WHEN, recorridos los Jugadores en orden ascendente de Ficha roja, cada par de Jugadores consecutivos cumple que la mano del Jugador posterior tiene una fuerza igual o mayor que la del Jugador anterior según el Evaluador_Manos para todos los pares consecutivos del orden, THE Motor_Juego SHALL declarar el Golpe como exitoso.
4. IF al menos un Jugador presenta una mano de fuerza menor que la de un Jugador situado antes que él en el orden de Fichas rojas, THEN THE Motor_Juego SHALL declarar el Golpe como fracasado.
5. WHERE existe un Empate_Verdadero entre dos o más Jugadores consecutivos en el orden, THE Motor_Juego SHALL tratar la comparación de fuerza entre esos Jugadores como satisfecha, independientemente del valor de sus Fichas rojas, y evaluar la condición de éxito o fracaso únicamente respecto a los Jugadores no empatados que los preceden y los siguen en el orden.
6. WHEN se declara un Golpe exitoso, THE Motor_Juego SHALL voltear a su lado dorado exactamente una Bóveda que aún no se encuentre en su lado dorado.
7. WHEN se declara un Golpe fracasado, THE Motor_Juego SHALL voltear a su lado rojo exactamente una Alarma que aún no se encuentre en su lado rojo.

### Requirement 9: Condiciones de fin de partida

**User Story:** Como Jugador, quiero saber cuándo el equipo gana o pierde, para conocer el resultado de la cooperación.

#### Acceptance Criteria

1. WHEN una Bóveda se voltea a su lado dorado y el número total de Bóvedas en su lado dorado alcanza exactamente tres, THE Motor_Juego SHALL finalizar la Partida con resultado de victoria del equipo.
2. WHEN una Alarma se voltea a su lado rojo y el número total de Alarmas en su lado rojo alcanza exactamente tres, THE Motor_Juego SHALL finalizar la Partida con resultado de derrota del equipo.
3. WHEN la Partida finaliza, THE Servidor_Local SHALL mostrar a todos los Clientes_Jugador, en un plazo no mayor de 3 segundos, el resultado indicando explícitamente la victoria o la derrota del equipo con la temática de un grupo de ladrones profesionales.
4. WHEN la Partida ha finalizado, THE Motor_Juego SHALL no iniciar nuevos Golpes y conservar el resultado final sin modificarlo.

### Requirement 10: Restricciones de comunicación

**User Story:** Como Jugador, quiero que la aplicación impida revelar cartas e impida el bluff, para respetar la regla central de The Gang.

#### Acceptance Criteria

1. WHILE no se ha iniciado el Showdown del Golpe en curso, THE Servidor_Local SHALL impedir que la interfaz ofrezca a un Jugador acciones para mostrar, comunicar o insinuar sus Cartas de Bolsillo al resto de los Jugadores.
2. WHILE una Partida está activa, THE Interfaz SHALL mostrar de forma visible y permanente en la pantalla de juego de cada Cliente_Jugador el recordatorio de que está prohibido revelar, insinuar o discutir las Cartas de Bolsillo y de que no se permite el bluff.
3. WHEN comienza el Showdown de un Golpe, THE Servidor_Local SHALL revelar las Cartas de Bolsillo de cada Jugador a todos los Clientes_Jugador de la Partida.
4. IF un Cliente_Jugador solicita las Cartas de Bolsillo de otro Jugador antes del inicio del Showdown del Golpe en curso, THEN THE Servidor_Local SHALL rechazar la solicitud sin entregar dichas Cartas de Bolsillo e informar que la acción está prohibida.
5. WHILE una Partida está activa, THE Servidor_Local SHALL no proporcionar ningún canal de mensajería de texto libre entre Jugadores que permita transmitir información sobre las Cartas de Bolsillo.

### Requirement 11: Idioma y temática

**User Story:** Como Jugador hispanohablante, quiero que toda la interfaz esté en español y mantenga la temática de ladrones, para disfrutar de una experiencia coherente.

#### Acceptance Criteria

1. THE Interfaz SHALL presentar en español todos los textos visibles para los Jugadores, incluyendo etiquetas, botones, instrucciones, mensajes de error y mensajes de confirmación, sin mostrar textos en otro idioma.
2. THE Interfaz SHALL emplear los términos temáticos definidos en el Glosario (Golpe, Bóveda, Alarma, Ficha, Showdown) para referirse a los elementos de juego correspondientes en todos los textos mostrados a los Jugadores.
3. WHEN un Jugador solicita consultar el Ranking_de_Manos durante la Partida, THE Interfaz SHALL mostrar las diez categorías de póker ordenadas de menor a mayor: Carta Alta, Par, Dos Pares, Trío, Escalera, Full House, Póker, Color, Escalera de Color y Escalera Real.

### Requirement 12: Modos de juego adicionales (opcional/futuro)

**User Story:** Como Jugador experimentado, quiero que existan modos de mayor dificultad, para aumentar el reto en partidas futuras.

#### Acceptance Criteria

1. WHERE el Modo Avanzado está habilitado, WHEN comienza el segundo Golpe de la Partida, THE Motor_Juego SHALL incorporar las cartas de desafío y las cartas de especialista a la Partida.
2. WHERE el Modo Avanzado está habilitado, WHEN un Golpe es exitoso y existe un Golpe siguiente en la Partida, THE Motor_Juego SHALL activar exactamente una carta de desafío para el siguiente Golpe.
3. WHERE el Modo Avanzado está habilitado, WHEN un Golpe fracasa y existe un Golpe siguiente en la Partida, THE Motor_Juego SHALL activar exactamente una carta de especialista para el siguiente Golpe.
4. WHERE el Modo Ladrón Maestro está habilitado, WHEN comienza la Partida, THE Motor_Juego SHALL retirar una Alarma de modo que queden exactamente dos Alarmas y la derrota ocurra al voltear esas dos Alarmas a su lado rojo.
5. THE Motor_Juego SHALL mantener deshabilitados los modos adicionales y aplicar el Modo Básico de forma predeterminada salvo que un modo se habilite explícitamente.
