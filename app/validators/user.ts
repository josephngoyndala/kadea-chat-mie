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
 * `remember` correspond à la case « Se souvenir de moi ».
 */
export const loginValidator = vine.create({
  email: email(),
  password: vine.string(),
  remember: vine.accepted().optional(),
})

/**
 * Validateur de la demande de renvoi de l'e-mail de confirmation.
 */
export const resendVerificationValidator = vine.create({
  email: email(),
})

/**
 * Validateur de la demande de lien « mot de passe oublié ».
 */
export const forgotPasswordValidator = vine.create({
  email: email(),
})

/**
 * Validateur du choix d'un nouveau mot de passe.
 */
export const resetPasswordValidator = vine.create({
  password: password(),
  passwordConfirmation: vine.string().sameAs('password'),
})

/**
 * Validateur de la modification du nom depuis le profil.
 */
export const updateProfileValidator = vine.create({
  fullName: vine.string().trim().minLength(2).maxLength(100),
})

/**
 * Validateur de la photo de profil : images JPG, PNG ou WEBP, 2 Mo maximum.
 */
export const updateAvatarValidator = vine.create({
  avatar: vine.file({
    size: '2mb',
    extnames: ['jpg', 'jpeg', 'png', 'webp'],
  }),
})

/**
 * Validateur du changement de mot de passe depuis le profil.
 */
export const updatePasswordValidator = vine.create({
  currentPassword: vine.string(),
  password: password(),
  passwordConfirmation: vine.string().sameAs('password'),
})

signupValidator.messagesProvider = frenchMessages()
loginValidator.messagesProvider = frenchMessages()
resendVerificationValidator.messagesProvider = frenchMessages()
forgotPasswordValidator.messagesProvider = frenchMessages()
resetPasswordValidator.messagesProvider = frenchMessages()
updateProfileValidator.messagesProvider = frenchMessages()
updateAvatarValidator.messagesProvider = frenchMessages()
updatePasswordValidator.messagesProvider = frenchMessages()
