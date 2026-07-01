// Indicador visual de conexión de un Jugador (activo / desconectado).

/** Renderiza la insignia de estado de conexión de un Jugador. */
export function estatusJugadorHtml(conectado: boolean): string {
  const clase = conectado
    ? 'jugador-estatus jugador-estatus--activo'
    : 'jugador-estatus jugador-estatus--desconectado';
  const texto = conectado ? 'Activo' : 'Desconectado';
  return `<span class="${clase}" title="${texto}">${texto}</span>`;
}
