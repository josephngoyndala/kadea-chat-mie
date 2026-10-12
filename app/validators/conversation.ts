import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Validateur de la recherche d'utilisateurs. Le terme est facultatif : sans
 * lui, la page affiche l'annuaire des membres.
 */
export const searchUsersValidator = vine.create({
  q: vine.string().trim().maxLength(100).optional(),
  page: vine.number().positive().optional(),
})

/**
 * Validateur du démarrage d'une conversation privée.
 */
export const startConversationValidator = vine.create({
  userId: vine.number().positive(),
})

searchUsersValidator.messagesProvider = frenchMessages()
startConversationValidator.messagesProvider = frenchMessages()
