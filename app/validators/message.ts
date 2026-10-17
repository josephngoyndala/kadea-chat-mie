import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Validateur du texte d'un message. Les pièces jointes sont validées à part
 * pour éviter qu'un champ fichier vide du formulaire ne bloque l'envoi.
 */
export const sendMessageValidator = vine.create({
  body: vine.string().trim().maxLength(2000).optional(),
})

/**
 * Validateur de la modification d'un message : texte non vide uniquement.
 */
export const editMessageValidator = vine.create({
  body: vine.string().trim().minLength(1).maxLength(2000),
})

/**
 * Validateur de la suppression d'un message : « me » le masque pour
 * l'utilisateur seul, « everyone » le supprime pour tous.
 */
export const deleteMessageValidator = vine.create({
  scope: vine.enum(['me', 'everyone']),
})

/**
 * Validateur du rattrapage des messages manqués : identifiant du dernier
 * message déjà affiché.
 */
export const catchUpValidator = vine.create({
  after: vine.number().min(0).optional(),
})

sendMessageValidator.messagesProvider = frenchMessages()
editMessageValidator.messagesProvider = frenchMessages()
deleteMessageValidator.messagesProvider = frenchMessages()
catchUpValidator.messagesProvider = frenchMessages()
