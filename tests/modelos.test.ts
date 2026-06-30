import { describe, it, expect } from 'vitest';
import { construirBaraja, TOTAL_CARTAS_BARAJA } from '../src/dominio/baraja';
import { CategoriaMano, PALOS, VALOR_MINIMO, VALOR_MAXIMO } from '../src/dominio/modelos';

// Pruebas unitarias por ejemplo de los modelos de datos del dominio.
// _Requirements: 7.2_

describe('construirBaraja', () => {
  it('devuelve exactamente 52 cartas', () => {
    const baraja = construirBaraja();
    expect(baraja).toHaveLength(52);
    expect(baraja).toHaveLength(TOTAL_CARTAS_BARAJA);
  });

  it('todas las cartas son distintas (sin repeticiones)', () => {
    const baraja = construirBaraja();
    const clavesUnicas = new Set(baraja.map((c) => `${c.palo}-${c.valor}`));
    expect(clavesUnicas.size).toBe(52);
  });

  it('contiene exactamente una carta por cada combinación (palo, valor) de 2..14', () => {
    const baraja = construirBaraja();
    for (const palo of PALOS) {
      for (let valor = VALOR_MINIMO; valor <= VALOR_MAXIMO; valor++) {
        const coincidencias = baraja.filter(
          (c) => c.palo === palo && c.valor === valor,
        );
        expect(coincidencias).toHaveLength(1);
      }
    }
  });

  it('solo usa valores válidos en el rango 2..14 y los cuatro palos', () => {
    const baraja = construirBaraja();
    for (const carta of baraja) {
      expect(carta.valor).toBeGreaterThanOrEqual(VALOR_MINIMO);
      expect(carta.valor).toBeLessThanOrEqual(VALOR_MAXIMO);
      expect(PALOS).toContain(carta.palo);
    }
  });
});

describe('CategoriaMano (Ranking_de_Manos de The Gang)', () => {
  it('ordena Full House < Póker < Color (orden propio de The Gang)', () => {
    expect(CategoriaMano.FULL_HOUSE).toBeLessThan(CategoriaMano.POKER);
    expect(CategoriaMano.POKER).toBeLessThan(CategoriaMano.COLOR);
  });

  it('respeta el orden completo de menor a mayor del Ranking_de_Manos', () => {
    const ordenEsperado = [
      CategoriaMano.CARTA_ALTA,
      CategoriaMano.PAR,
      CategoriaMano.DOS_PARES,
      CategoriaMano.TRIO,
      CategoriaMano.ESCALERA,
      CategoriaMano.FULL_HOUSE,
      CategoriaMano.POKER,
      CategoriaMano.COLOR,
      CategoriaMano.ESCALERA_COLOR,
      CategoriaMano.ESCALERA_REAL,
    ];
    // Cada categoría es estrictamente mayor que la anterior.
    for (let i = 1; i < ordenEsperado.length; i++) {
      const actual = ordenEsperado[i]!;
      const anterior = ordenEsperado[i - 1]!;
      expect(actual).toBeGreaterThan(anterior);
    }
  });

  it('CARTA_ALTA es el valor mínimo y ESCALERA_REAL el máximo', () => {
    const valores = [
      CategoriaMano.CARTA_ALTA,
      CategoriaMano.PAR,
      CategoriaMano.DOS_PARES,
      CategoriaMano.TRIO,
      CategoriaMano.ESCALERA,
      CategoriaMano.FULL_HOUSE,
      CategoriaMano.POKER,
      CategoriaMano.COLOR,
      CategoriaMano.ESCALERA_COLOR,
      CategoriaMano.ESCALERA_REAL,
    ];
    expect(Math.min(...valores)).toBe(CategoriaMano.CARTA_ALTA);
    expect(Math.max(...valores)).toBe(CategoriaMano.ESCALERA_REAL);
  });
});
