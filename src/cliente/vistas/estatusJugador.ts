// Indicador visual de conexión de un Jugador (activo / desconectado).

/** Renderiza el punto de estado de conexión de un Jugador (verde / rojo). */
export function estatusJugadorHtml(conectado: boolean): string {
  const clase = conectado
    ? 'jugador-estatus jugador-estatus--activo'
    : 'jugador-estatus jugador-estatus--desconectado';
  const texto = conectado ? 'En línea' : 'Desconectado';
  return `<span class="${clase}" role="status" aria-label="${texto}" title="${texto}"></span>`;
}
