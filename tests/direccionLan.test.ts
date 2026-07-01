import { describe, expect, it } from 'vitest';

import {
  elegirMejorIpv4Lan,
  esIpPrivadaLan,
  parsearIpv4DesdeIpconfig,
} from '../src/servidor/direccionLan';

describe('direccionLan', () => {
  it('reconoce IPv4 privadas útiles para LAN', () => {
    expect(esIpPrivadaLan('192.168.1.42')).toBe(true);
    expect(esIpPrivadaLan('10.0.0.5')).toBe(true);
    expect(esIpPrivadaLan('172.16.0.1')).toBe(true);
    expect(esIpPrivadaLan('127.0.0.1')).toBe(false);
    expect(esIpPrivadaLan('169.254.12.3')).toBe(false);
  });

  it('parsea la salida de ipconfig en español e inglés', () => {
    const salidaEs = `
Adaptador de LAN inalámbrica Wi-Fi:
   Dirección IPv4. . . . . . . . . . . . . . : 192.168.1.42(Preferido)
Adaptador de Ethernet vEthernet (WSL):
   Dirección IPv4. . . . . . . . . . . . . . : 172.28.64.1(Preferido)
`;
    expect(parsearIpv4DesdeIpconfig(salidaEs)).toEqual(['192.168.1.42', '172.28.64.1']);

    const salidaEn = `
Wireless LAN adapter Wi-Fi:
   IPv4 Address. . . . . . . . . . . : 10.0.0.8(Preferred)
`;
    expect(parsearIpv4DesdeIpconfig(salidaEn)).toEqual(['10.0.0.8']);
  });

  it('prioriza 192.168.x.x frente a otras redes privadas', () => {
    expect(elegirMejorIpv4Lan(['172.28.64.1', '192.168.1.42'])).toBe('192.168.1.42');
    expect(elegirMejorIpv4Lan(['10.0.0.8', '172.16.0.1'])).toBe('10.0.0.8');
  });
});
