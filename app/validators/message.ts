import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Validateur de l'envoi d'un message : un texte non vide, 2000 caractères
 * au maximum.
 */
export const sendMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(2000),
})

sendMessageValidator.messagesProvider = frenchMessages()
