import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Validateur de la création d'un groupe : un nom, et entre 1 et 49 autres
 * membres (le créateur est le 50e au maximum).
 */
export const createGroupValidator = vine.create({
  name: vine.string().trim().minLength(2).maxLength(60),
  memberIds: vine.array(vine.number().positive()).minLength(1).maxLength(49),
})

/**
 * Validateur de l'ajout d'un membre à un groupe.
 */
export const addMemberValidator = vine.create({
  userId: vine.number().positive(),
})

createGroupValidator.messagesProvider = frenchMessages()
addMemberValidator.messagesProvider = frenchMessages()
