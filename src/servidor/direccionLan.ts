// Descubrimiento de la dirección de acceso en la red local (LAN).
//
// El Anfitrión necesita conocer una IP accesible desde otros equipos de la
// misma red para compartirla con sus compañeros (criterio 1.2). Aquí se
// inspeccionan las interfaces de red del sistema para elegir una IPv4 no
// interna (no de loopback).

import { networkInterfaces } from 'node:os';
import type { DireccionAcceso } from './tipos';

/**
 * Detecta una dirección IPv4 de la red local (no interna / no loopback).
 *
 * Recorre las interfaces de red del sistema y devuelve la primera IPv4 que no
 * sea interna. Si no encuentra ninguna (por ejemplo, en un equipo sin red),
 * recae en `127.0.0.1`, de modo que el servidor siga siendo accesible al menos
 * desde el propio equipo del Anfitrión.
 */
export function detectarIpLan(): string {
  const interfaces = networkInterfaces();

  for (const lista of Object.values(interfaces)) {
    if (!lista) continue;
    for (const info of lista) {
      // `family` puede ser la cadena 'IPv4' (Node >= 18) o el número 4.
      const esIpv4 = info.family === 'IPv4' || (info.family as unknown) === 4;
      if (esIpv4 && !info.internal) {
        return info.address;
      }
    }
  }

  // Sin interfaz LAN disponible: al menos accesible localmente.
  return '127.0.0.1';
}

/**
 * Construye la `DireccionAcceso` publicada al Anfitrión a partir del puerto en
 * el que el servidor quedó escuchando y la IP LAN detectada.
 */
export function construirDireccionAcceso(puerto: number, ipLan = detectarIpLan()): DireccionAcceso {
  return {
    url: `http://${ipLan}:${puerto}`,
    ipLan,
    puerto,
  };
}
