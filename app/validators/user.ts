import vine from '@vinejs/vine'
import { frenchMessages } from '#validators/shared/french_messages'

/**
 * Règles partagées pour l'e-mail et le mot de passe.
 */
const email = () => vine.string().trim().toLowerCase().email().maxLength(254)
const password = () => vine.string().minLength(8).maxLength(64)

/**
 * Validateur de l'inscription.
 */
export const signupValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(100),
  email: email().unique({ table: 'users', column: 'email' }),
  password: password(),
  passwordConfirmation: vine.string().sameAs('password'),
  acceptTerms: vine.accepted(),
})

/**
 * Validateur de la connexion (avant la vérification des identifiants).
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
})

/**
 * Validateur de la demande de renvoi de l'e-mail de confirmation.
 */
export const resendVerificationValidator = vine.create({
  email: email(),
})

signupValidator.messagesProvider = frenchMessages()
loginValidator.messagesProvider = frenchMessages()
resendVerificationValidator.messagesProvider = frenchMessages()
