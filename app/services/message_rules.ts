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

/**
 * Condition SQL qui écarte les messages que l'utilisateur a masqués
 * (« supprimer pour moi »). Le paramètre est l'identifiant de l'utilisateur.
 */
export const NOT_HIDDEN_FOR_USER =
  'NOT EXISTS (SELECT 1 FROM message_deletions WHERE message_deletions.message_id = messages.id AND message_deletions.user_id = ?)'
