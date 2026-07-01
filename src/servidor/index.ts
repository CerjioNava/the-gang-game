// Punto de entrada del Servidor_Local (transporte HTTP + WebSocket + coordinador).
//
// Arranca la capa de transporte (tarea 13.1): sirve la SPA, expone el endpoint
// de salud, publica la dirección de acceso LAN y acepta conexiones WebSocket.
// El gestor de sesiones (tarea 13.2) y el coordinador de partida (tarea 14) se
// conectarán aquí mediante los manejadores de `crearServidorLocal`.
//
// NOTA DE SEGURIDAD: el Servidor_Local está pensado para una LAN de confianza.
// No incluye autenticación fuerte; cualquier equipo en la misma red puede
// conectarse. Limitación aceptada del alcance LAN inicial.

import { argv } from 'node:process';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { crearServidorLocal } from './servidorLocal';
import { crearAplicacion } from './aplicacion';
import { PuertoOcupadoError } from './tipos';

const PUERTO_POR_DEFECTO = 3000;
/** Cuántos puertos consecutivos probar si el inicial está ocupado. */
const MAX_REINTENTOS_PUERTO = 10;

function obtenerPuerto(): number {
  const desdeEntorno = process.env['PUERTO'] ?? process.env['PORT'];
  const parseado = desdeEntorno ? Number.parseInt(desdeEntorno, 10) : NaN;
  return Number.isInteger(parseado) && parseado > 0 ? parseado : PUERTO_POR_DEFECTO;
}

async function main(): Promise<void> {
  const puertoInicial = obtenerPuerto();

  // Cableamos coordinador + gestor + difusor y obtenemos los manejadores del
  // canal WebSocket (tarea 17.1). El estado autoritativo vive en el coordinador
  // que construye la aplicación.
  const aplicacion = crearAplicacion();

  const servidor = crearServidorLocal({
    // La SPA del Cliente_Jugador se sirve desde la salida del build de Vite.
    directorioEstaticos: resolve(process.cwd(), 'dist', 'cliente'),
    manejadores: aplicacion.manejadores,
  });

  // Si el puerto está ocupado, reintentamos con el siguiente en lugar de caer
  // silenciosamente (criterio 1.1).
  for (let intento = 0; intento <= MAX_REINTENTOS_PUERTO; intento += 1) {
    const puerto = puertoInicial + intento;
    try {
      const direccion = await servidor.iniciar(puerto);
      console.log('[The Gang] Servidor_Local en marcha.');
      console.log('');
      console.log('[The Gang] Comparte esta URL con tu equipo (IPv4 + puerto):');
      console.log(`       ${direccion.url}`);
      console.log('');
      console.log(
        `[The Gang] IPv4 detectada: ${direccion.ipLan}  ·  puerto: ${direccion.puerto}`,
      );
      console.log(
        `[The Gang] En este equipo también puedes abrir: http://localhost:${direccion.puerto}`,
      );

      const cerrar = (): void => {
        void servidor.detener().finally(() => process.exit(0));
      };
      process.on('SIGINT', cerrar);
      process.on('SIGTERM', cerrar);
      return;
    } catch (error) {
      if (error instanceof PuertoOcupadoError) {
        console.warn(
          `[The Gang] El puerto ${puerto} está ocupado. Probando ${puerto + 1}…`,
        );
        continue;
      }
      throw error;
    }
  }

  throw new Error(
    `No se pudo iniciar el Servidor_Local: los puertos ${puertoInicial}..` +
      `${puertoInicial + MAX_REINTENTOS_PUERTO} están ocupados.`,
  );
}

// Solo arrancamos el servidor cuando este módulo es el punto de entrada
// (p. ej. `npm start`). Así, importar las reexportaciones desde pruebas o desde
// la integración (tareas 13.2, 14, 17) no levanta el servidor de forma implícita.
const esEntrada = argv[1] ? import.meta.url === pathToFileURL(argv[1]).href : false;
if (esEntrada) {
  main().catch((error: unknown) => {
    console.error('[The Gang] Error al iniciar el Servidor_Local:', error);
    process.exitCode = 1;
  });
}

// Reexportaciones públicas de la capa de servidor (para pruebas y la
// integración de las tareas 13.2, 14 y 17).
export { crearServidorLocal, crearAppExpress, analizarMensaje } from './servidorLocal';
export { detectarIpLan, construirDireccionAcceso } from './direccionLan';
export { crearGestorSesiones } from './sesiones';
export type {
  GestorSesiones,
  SesionJugador,
  ResultadoConexion,
  ResultadoCrearPartida,
} from './sesiones';
export * from './tipos';
export * from './coordinador';
export * from './difusor';
export { crearAplicacion } from './aplicacion';
export type { Aplicacion, OpcionesAplicacion } from './aplicacion';
