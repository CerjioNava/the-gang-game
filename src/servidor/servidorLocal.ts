// Servidor_Local: capa de transporte HTTP + WebSocket de The Gang.
//
// Responsabilidades de esta tarea (13.1):
//   - Servir la SPA del Cliente_Jugador por HTTP y exponer un endpoint de salud.
//   - Publicar la dirección de acceso LAN al Anfitrión (criterios 1.1, 1.2, 1.3).
//   - Manejar el puerto ocupado (EADDRINUSE) sin caer silenciosamente, para que
//     el Anfitrión pueda reintentar con otro puerto.
//   - Aceptar conexiones WebSocket, parsear mensajes JSON (formato tipo+payload)
//     e ignorar los mensajes malformados respondiendo un error genérico SOLO al
//     emisor, sin afectar a otros clientes ni al estado.
//
// La gestión de sesiones/reconexión (tarea 13.2) y el coordinador de juego
// (tarea 14) NO se implementan aquí; se dejan como puntos de extensión mediante
// los manejadores de `OpcionesServidor` (alConectar / alRecibirMensaje /
// alDesconectar).
//
// NOTA DE SEGURIDAD: pensado para una LAN de confianza. No hay autenticación
// fuerte; cualquier equipo de la red puede conectarse. Limitación aceptada del
// alcance LAN inicial (ver design.md, "Nota de seguridad").

import { createServer, type Server } from 'node:http';
import { resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import express, { type Express } from 'express';
import { WebSocketServer, WebSocket } from 'ws';
import { construirDireccionAcceso } from './direccionLan';
import {
  PuertoOcupadoError,
  type ConexionCliente,
  type DireccionAcceso,
  type ManejadoresServidor,
  type MensajeEntrante,
  type MensajeSaliente,
  type OpcionesServidor,
  type ServidorLocal,
} from './tipos';

/** Tipo de mensaje genérico de error enviado ante un mensaje malformado. */
const TIPO_ERROR = 'ERROR';

/**
 * Construye la aplicación Express que sirve la SPA y el endpoint de salud.
 * Se separa de la escucha del servidor para facilitar las pruebas (smoke 17.2).
 */
export function crearAppExpress(directorioEstaticos: string): Express {
  const app = express();

  // Endpoint de salud / descubrimiento: permite a un cliente o monitor
  // comprobar que el Servidor_Local está vivo.
  app.get('/salud', (_req, res) => {
    res.json({ estado: 'ok', juego: 'the-gang' });
  });

  // Servir la SPA del Cliente_Jugador (build de Vite en dist/cliente).
  // En desarrollo debe ejecutarse `npm run build` para generar estos archivos.
  app.use(express.static(directorioEstaticos));

  // Fallback de SPA: cualquier ruta no resuelta devuelve el index.html para
  // que el enrutado del cliente funcione.
  app.get('*', (_req, res) => {
    res.sendFile(resolve(directorioEstaticos, 'index.html'), (err) => {
      if (err) {
        res
          .status(404)
          .send(
            'Interfaz del juego no encontrada. Ejecuta "npm run build" para ' +
              'generar el Cliente_Jugador.',
          );
      }
    });
  });

  return app;
}

/**
 * Implementación de la capa de transporte del Servidor_Local. Mantiene el
 * servidor HTTP, el servidor WebSocket y el registro de conexiones activas.
 */
class ServidorLocalImpl implements ServidorLocal {
  private readonly directorioEstaticos: string;
  private readonly manejadores: ManejadoresServidor;
  private servidorHttp: Server | null = null;
  private wss: WebSocketServer | null = null;
  /** Conexiones WebSocket activas, indexadas por su id opaco. */
  private readonly conexiones = new Map<string, WebSocket>();

  constructor(opciones: OpcionesServidor = {}) {
    this.directorioEstaticos =
      opciones.directorioEstaticos ?? resolve(process.cwd(), 'dist', 'cliente');
    this.manejadores = opciones.manejadores ?? {};
  }

  iniciar(puerto: number): Promise<DireccionAcceso> {
    if (this.servidorHttp) {
      return Promise.reject(
        new Error('El Servidor_Local ya está en ejecución. Llama a detener() primero.'),
      );
    }

    const app = crearAppExpress(this.directorioEstaticos);
    const servidorHttp = createServer(app);
    const wss = new WebSocketServer({ server: servidorHttp });
    this.configurarWebSocket(wss);

    return new Promise<DireccionAcceso>((resolver, rechazar) => {
      const onError = (error: NodeJS.ErrnoException): void => {
        // No dejamos sockets a medio abrir si la escucha falla.
        servidorHttp.close();
        wss.close();
        if (error.code === 'EADDRINUSE') {
          rechazar(new PuertoOcupadoError(puerto));
        } else {
          rechazar(error);
        }
      };

      servidorHttp.once('error', onError);

      servidorHttp.listen(puerto, () => {
        // A partir de aquí, los errores de escucha ya no rechazan la promesa.
        servidorHttp.removeListener('error', onError);
        this.servidorHttp = servidorHttp;
        this.wss = wss;

        const direccion = servidorHttp.address();
        const puertoReal =
          direccion && typeof direccion === 'object' ? direccion.port : puerto;
        resolver(construirDireccionAcceso(puertoReal));
      });
    });
  }

  detener(): Promise<void> {
    const servidorHttp = this.servidorHttp;
    const wss = this.wss;
    if (!servidorHttp || !wss) {
      return Promise.resolve();
    }

    // Cerrar todas las conexiones WebSocket activas antes de cerrar el servidor.
    for (const socket of this.conexiones.values()) {
      socket.terminate();
    }
    this.conexiones.clear();

    return new Promise<void>((resolver, rechazar) => {
      wss.close((errWss) => {
        servidorHttp.close((errHttp) => {
          this.servidorHttp = null;
          this.wss = null;
          const error = errWss ?? errHttp;
          if (error) {
            rechazar(error);
          } else {
            resolver();
          }
        });
      });
    });
  }

  /** Conecta los eventos del servidor WebSocket con los manejadores de extensión. */
  private configurarWebSocket(wss: WebSocketServer): void {
    wss.on('connection', (socket: WebSocket) => {
      const id = randomUUID();
      this.conexiones.set(id, socket);
      const conexion = this.crearConexionCliente(id, socket);

      this.manejadores.alConectar?.(conexion);

      socket.on('message', (datos) => {
        this.procesarMensaje(conexion, datos.toString());
      });

      const alCerrar = (): void => {
        if (this.conexiones.delete(id)) {
          this.manejadores.alDesconectar?.(conexion);
        }
      };
      socket.on('close', alCerrar);
      // Un error de socket también termina la conexión; evitamos que tumbe el proceso.
      socket.on('error', alCerrar);
    });
  }

  /** Envuelve un socket `ws` en la abstracción `ConexionCliente`. */
  private crearConexionCliente(id: string, socket: WebSocket): ConexionCliente {
    return {
      id,
      enviar: (mensaje: MensajeSaliente): void => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify(mensaje));
        }
      },
      cerrar: (): void => {
        socket.close();
      },
    };
  }

  /**
   * Parsea un mensaje entrante y lo delega al manejador. Si el mensaje es JSON
   * inválido o no respeta el formato {tipo, payload}, se ignora y se responde
   * un error genérico SOLO al emisor, sin afectar al estado ni a otros clientes.
   */
  private procesarMensaje(conexion: ConexionCliente, texto: string): void {
    const mensaje = analizarMensaje(texto);
    if (!mensaje) {
      conexion.enviar({
        tipo: TIPO_ERROR,
        payload: {
          codigo: 'MENSAJE_INVALIDO',
          mensaje: 'Mensaje no reconocido. Se ignoró por estar mal formado.',
        },
      });
      return;
    }
    this.manejadores.alRecibirMensaje?.(conexion, mensaje);
  }
}

/**
 * Valida y normaliza el texto recibido como un {@link MensajeEntrante}.
 * Devuelve `null` si el texto no es JSON o no cumple el formato {tipo, payload}.
 * Se exporta para poder probarla de forma aislada.
 */
export function analizarMensaje(texto: string): MensajeEntrante | null {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return null;
  }

  if (
    typeof datos !== 'object' ||
    datos === null ||
    Array.isArray(datos) ||
    typeof (datos as { tipo?: unknown }).tipo !== 'string' ||
    (datos as { tipo: string }).tipo.length === 0
  ) {
    return null;
  }

  const { tipo, payload } = datos as { tipo: string; payload?: unknown };
  return payload === undefined ? { tipo } : { tipo, payload };
}

/**
 * Crea una instancia del Servidor_Local. Separar la construcción de la escucha
 * (`iniciar`) facilita las pruebas y permite inyectar manejadores y el
 * directorio de estáticos.
 */
export function crearServidorLocal(opciones: OpcionesServidor = {}): ServidorLocal {
  return new ServidorLocalImpl(opciones);
}
