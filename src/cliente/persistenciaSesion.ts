import type { VistaPartida } from './protocolo';
import { PERSPECTIVA_INVITADO } from '../dominio/proyeccion';
import type { MensajeCliente } from './protocolo';
import { mensajes } from './protocolo';

const CLAVE_STORAGE = 'the-gang.credencial';

export interface CredencialSesion {
  nombre: string;
  descripcion?: string;
  rol: 'JUGADOR' | 'ESPECTADOR';
}

function storageDisponible(): boolean {
  try {
    return typeof sessionStorage !== 'undefined';
  } catch {
    return false;
  }
}

/** Guarda alias y rol tras unirse correctamente a la partida. */
export function persistirDesdeVista(vista: VistaPartida): void {
  if (!storageDisponible() || vista.perspectivaJugadorId === PERSPECTIVA_INVITADO) {
    return;
  }

  if (vista.esEspectador) {
    const espectador = vista.espectadores.find((e) => e.id === vista.perspectivaJugadorId);
    if (espectador === undefined) {
      return;
    }
    const credencial: CredencialSesion = {
      nombre: espectador.nombre,
      rol: 'ESPECTADOR',
      ...(espectador.descripcion !== undefined && espectador.descripcion.length > 0
        ? { descripcion: espectador.descripcion }
        : {}),
    };
    sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify(credencial));
    return;
  }

  const jugador = vista.jugadores.find((j) => j.id === vista.perspectivaJugadorId);
  if (jugador === undefined) {
    return;
  }
  const credencial: CredencialSesion = {
    nombre: jugador.nombre,
    rol: 'JUGADOR',
    ...(jugador.descripcion !== undefined && jugador.descripcion.length > 0
      ? { descripcion: jugador.descripcion }
      : {}),
  };
  sessionStorage.setItem(CLAVE_STORAGE, JSON.stringify(credencial));
}

/** Lee la credencial guardada en esta pestaña, o null si no hay. */
export function cargarCredencial(): CredencialSesion | null {
  if (!storageDisponible()) {
    return null;
  }
  const raw = sessionStorage.getItem(CLAVE_STORAGE);
  if (raw === null) {
    return null;
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      typeof (parsed as { nombre?: unknown }).nombre === 'string' &&
      ((parsed as { rol?: unknown }).rol === 'JUGADOR' ||
        (parsed as { rol?: unknown }).rol === 'ESPECTADOR')
    ) {
      const obj = parsed as CredencialSesion;
      const nombre = obj.nombre.trim();
      if (nombre.length === 0) {
        return null;
      }
      return {
        nombre,
        rol: obj.rol,
        ...(typeof obj.descripcion === 'string' && obj.descripcion.trim().length > 0
          ? { descripcion: obj.descripcion.trim() }
          : {}),
      };
    }
  } catch {
    /* credencial corrupta */
  }
  return null;
}

/** Elimina la credencial (volver al menú, invitado, etc.). */
export function limpiarCredencial(): void {
  if (storageDisponible()) {
    sessionStorage.removeItem(CLAVE_STORAGE);
  }
}

/** Construye el mensaje UNIRSE a partir de una credencial guardada. */
export function mensajeUnirseDesdeCredencial(credencial: CredencialSesion): MensajeCliente {
  if (credencial.rol === 'ESPECTADOR') {
    return mensajes.unirseEspectador();
  }
  return mensajes.unirse(credencial.nombre, 'JUGADOR', credencial.descripcion);
}

/** Expuesto para tests. */
export function claveStorageParaPruebas(): string {
  return CLAVE_STORAGE;
}
