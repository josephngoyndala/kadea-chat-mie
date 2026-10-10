import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { urlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import User from '#models/user'
import AuthTokenService from '#services/auth_token_service'

/**
 * Délai minimum entre deux envois du lien de réinitialisation.
 */
const RESEND_COOLDOWN_IN_SECONDS = 60

/**
 * Orchestre la réinitialisation du mot de passe : envoi du lien par e-mail,
 * vérification du lien et enregistrement du nouveau mot de passe.
 */
export default class PasswordResetService {
  private tokens = new AuthTokenService()

  /**
   * Envoie le lien de réinitialisation si un compte existe pour cette
   * adresse. Ne dit jamais à l'appelant si le compte existe ou non.
   */
  async sendLink(email: string) {
    const user = await User.findBy('email', email)
    if (!user) {
      return
    }

    const tooSoon = await this.tokens.wasIssuedRecently(
      user,
      'password_reset',
      RESEND_COOLDOWN_IN_SECONDS
    )
    if (tooSoon) {
      return
    }

    const token = await this.tokens.issue(user, 'password_reset')

    /**
     * L'adresse du site vient de la configuration (APP_URL), jamais de la
     * requête, pour qu'un en-tête falsifié ne puisse pas détourner le lien.
     */
    const resetUrl = urlFor('password_reset.edit', { token }, { prefixUrl: env.get('APP_URL') })

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Réinitialisez votre mot de passe · Kadea Chat')
        .htmlView('emails/reset_password', {
          userName: user.fullName ?? user.email,
          resetUrl,
          expiresInHours: this.tokens.lifetimeInHours('password_reset'),
        })
    })
  }

  /**
   * Indique si le lien reçu est encore utilisable.
   */
  async isTokenValid(plainToken: string) {
    const token = await this.tokens.peek(plainToken, 'password_reset')
    return token !== null
  }

  /**
   * Enregistre le nouveau mot de passe si le lien est valable.
   * Renvoie l'utilisateur, ou null si le lien est invalide ou expiré.
   */
  async reset(plainToken: string, newPassword: string) {
    const token = await this.tokens.consume(plainToken, 'password_reset')
    if (!token) {
      return null
    }

    const user = await User.findOrFail(token.userId)
    user.password = newPassword

    /**
     * L'utilisateur vient de prouver qu'il contrôle cette boîte mail.
     */
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.now()
    }

    await user.save()
    return user
  }
}
