// Descubrimiento de la dirección de acceso en la red local (LAN).
//
// El Anfitrión necesita conocer una IP accesible desde otros equipos de la
// misma red para compartirla con sus compañeros (criterio 1.2). En Windows se
// parsea la salida de `ipconfig` (Dirección IPv4); en otros sistemas se usan
// las interfaces de red del sistema.

import { execSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import type { DireccionAcceso } from './tipos';

const PATRON_IPV4_EN_LINEA =
  /(?:IPv4|Dirección IPv4)[^:\d]*:\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/i;

/** Indica si la IPv4 es útil para compartir en LAN (privada, no loopback ni link-local). */
export function esIpPrivadaLan(ip: string): boolean {
  if (ip.startsWith('127.')) return false;
  if (ip.startsWith('169.254.')) return false;

  if (ip.startsWith('192.168.')) return true;
  if (ip.startsWith('10.')) return true;

  const segmento172 = /^172\.(\d+)\./.exec(ip);
  if (segmento172 !== null) {
    const segundo = Number(segmento172[1]);
    return segundo >= 16 && segundo <= 31;
  }

  return false;
}

/** Extrae direcciones IPv4 de LAN a partir de la salida de `ipconfig` (es/en). */
export function parsearIpv4DesdeIpconfig(salida: string): string[] {
  const encontradas: string[] = [];

  for (const linea of salida.split(/\r?\n/)) {
    const coincidencia = PATRON_IPV4_EN_LINEA.exec(linea);
    if (coincidencia === null) continue;
    const ip = coincidencia[1]!;
    if (esIpPrivadaLan(ip) && !encontradas.includes(ip)) {
      encontradas.push(ip);
    }
  }

  return encontradas;
}

/**
 * Elige la IPv4 más adecuada para compartir. Prioriza 192.168.x.x (Wi‑Fi /
 * Ethernet doméstica u oficina) frente a redes virtuales habituales.
 */
export function elegirMejorIpv4Lan(candidatas: readonly string[]): string | null {
  if (candidatas.length === 0) return null;

  const preferida192 = candidatas.find((ip) => ip.startsWith('192.168.'));
  if (preferida192 !== undefined) return preferida192;

  const preferida10 = candidatas.find((ip) => ip.startsWith('10.'));
  if (preferida10 !== undefined) return preferida10;

  return candidatas[0] ?? null;
}

function listarIpv4DesdeInterfaces(): string[] {
  const candidatas: string[] = [];

  for (const lista of Object.values(networkInterfaces())) {
    if (!lista) continue;
    for (const info of lista) {
      const esIpv4 = info.family === 'IPv4' || (info.family as unknown) === 4;
      if (esIpv4 && !info.internal && esIpPrivadaLan(info.address)) {
        if (!candidatas.includes(info.address)) {
          candidatas.push(info.address);
        }
      }
    }
  }

  return candidatas;
}

function detectarIpLanWindows(): string | null {
  try {
    const salida = execSync('ipconfig', { encoding: 'utf8', windowsHide: true });
    return elegirMejorIpv4Lan(parsearIpv4DesdeIpconfig(salida));
  } catch {
    return null;
  }
}

/**
 * Detecta una dirección IPv4 de la red local (no interna / no loopback).
 *
 * En Windows consulta `ipconfig` para obtener la misma IPv4 que verías en
 * consola. Si no hay candidata, recae en las interfaces del sistema y, en último
 * caso, en `127.0.0.1`.
 */
export function detectarIpLan(): string {
  if (process.platform === 'win32') {
    const desdeIpconfig = detectarIpLanWindows();
    if (desdeIpconfig !== null) return desdeIpconfig;
  }

  const desdeInterfaces = elegirMejorIpv4Lan(listarIpv4DesdeInterfaces());
  if (desdeInterfaces !== null) return desdeInterfaces;

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
