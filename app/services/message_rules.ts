import { DateTime } from 'luxon'

/**
 * Durée pendant laquelle l'auteur peut modifier son message, en minutes.
 */
export const EDIT_WINDOW_MINUTES = 15

/**
 * Indique si un message envoyé à cette date peut encore être modifié.
 */
export function isWithinEditWindow(createdAt: DateTime) {
  return DateTime.now().diff(createdAt, 'minutes').minutes <= EDIT_WINDOW_MINUTES
}
