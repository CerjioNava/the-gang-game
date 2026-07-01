import { describe, expect, it } from 'vitest';

import { normalizarDescripcion, registrarJugador, validarDescripcion } from '../src/dominio/lobby';
import { nombreConTooltipHtml } from '../src/cliente/vistas/tooltipNombre';

describe('descripción de alias', () => {
  it('normaliza descripciones vacías a undefined', () => {
    expect(normalizarDescripcion('   ')).toBeUndefined();
    expect(normalizarDescripcion(' Leyenda ')).toBe('Leyenda');
  });

  it('rechaza descripciones demasiado largas', () => {
    const larga = 'x'.repeat(121);
    expect(validarDescripcion(larga)?.codigo).toBe('NOMBRE_INVALIDO');
  });

  it('registra jugador con descripción opcional', () => {
    const resultado = registrarJugador([], 'El Cerebro', 'j1', [], 'Mente maestra del golpe.');
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.jugadores[0]?.descripcion).toBe('Mente maestra del golpe.');
    }
  });
});

describe('tooltip de nombre', () => {
  it('incluye burbuja solo cuando hay descripción', () => {
    expect(nombreConTooltipHtml('El Cerebro', null)).toBe('El Cerebro');
    expect(nombreConTooltipHtml('El Cerebro', '  ')).toBe('El Cerebro');
    expect(nombreConTooltipHtml('El Cerebro', 'Frío y calculador.')).toContain('alias-tooltip__burbuja');
    expect(nombreConTooltipHtml('El Cerebro', 'Frío y calculador.')).toContain('Frío y calculador.');
  });
});
