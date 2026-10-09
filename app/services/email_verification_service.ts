import { DateTime } from 'luxon'
import mail from '@adonisjs/mail/services/main'
import { urlFor } from '@adonisjs/core/services/url_builder'
import env from '#start/env'
import User from '#models/user'
import AuthTokenService from '#services/auth_token_service'

/**
 * Délai minimum entre deux envois de l'e-mail de confirmation.
 */
const RESEND_COOLDOWN_IN_SECONDS = 60

/**
 * Orchestre la confirmation de l'adresse e-mail : création du jeton,
 * envoi du message et validation du lien reçu.
 */
export default class EmailVerificationService {
  private tokens = new AuthTokenService()

  /**
   * Crée un jeton et envoie l'e-mail de confirmation à l'utilisateur.
   */
  async send(user: User) {
    const token = await this.tokens.issue(user, 'email_verification')

    /**
     * L'adresse du site vient de la configuration (APP_URL) et non de la
     * requête, pour qu'un en-tête falsifié ne puisse pas détourner le lien.
     */
    const verifyUrl = urlFor(
      'email_verification.verify',
      { token },
      { prefixUrl: env.get('APP_URL') }
    )

    await mail.send((message) => {
      message
        .to(user.email)
        .subject('Confirmez votre adresse e-mail · Kadea Chat')
        .htmlView('emails/verify_email', {
          userName: user.fullName ?? user.email,
          verifyUrl,
          expiresInHours: this.tokens.lifetimeInHours('email_verification'),
        })
    })
  }

  /**
   * Renvoie l'e-mail seulement si l'adresse n'est pas encore confirmée et
   * qu'aucun envoi n'a eu lieu pendant la dernière minute.
   */
  async resend(user: User) {
    if (user.emailVerifiedAt) {
      return false
    }

    const tooSoon = await this.tokens.wasIssuedRecently(
      user,
      'email_verification',
      RESEND_COOLDOWN_IN_SECONDS
    )
    if (tooSoon) {
      return false
    }

    await this.send(user)
    return true
  }

  /**
   * Valide le jeton d'un lien et marque l'adresse comme confirmée.
   * Renvoie l'utilisateur, ou null si le lien est invalide ou expiré.
   */
  async verify(plainToken: string) {
    const token = await this.tokens.consume(plainToken, 'email_verification')
    if (!token) {
      return null
    }

    const user = await User.findOrFail(token.userId)
    if (!user.emailVerifiedAt) {
      user.emailVerifiedAt = DateTime.now()
      await user.save()
    }

    return user
  }
}
