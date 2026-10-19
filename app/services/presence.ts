import { DateTime } from 'luxon'

/**
 * Un utilisateur est « en ligne » s'il a donné signe de vie (ping de
 * présence) depuis moins de ce nombre de minutes.
 */
export const ONLINE_WINDOW_MINUTES = 2

/**
 * Indique si un utilisateur est actuellement en ligne.
 */
export function isUserOnline(user: { lastSeenAt: DateTime | null }) {
  return Boolean(
    user.lastSeenAt &&
    DateTime.now().diff(user.lastSeenAt, 'minutes').minutes < ONLINE_WINDOW_MINUTES
  )
}
