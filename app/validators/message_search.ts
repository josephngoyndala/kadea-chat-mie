import vine from '@vinejs/vine'

/**
 * Recherche d'un mot dans les messages de toutes les conversations de
 * l'utilisateur. Le mot est facultatif : sans lui, la recherche ne renvoie rien.
 */
export const searchMessagesValidator = vine.create({
  q: vine.string().trim().maxLength(100).optional(),
})
