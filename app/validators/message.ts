import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Validateur de l'envoi et de la modification d'un message : un texte non
 * vide, 2000 caractères au maximum.
 */
export const sendMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(2000),
})

/**
 * Validateur de la suppression d'un message : « me » le masque pour
 * l'utilisateur seul, « everyone » le supprime pour tous.
 */
export const deleteMessageValidator = vine.create({
  scope: vine.enum(['me', 'everyone']),
})

sendMessageValidator.messagesProvider = frenchMessages()
deleteMessageValidator.messagesProvider = frenchMessages()
