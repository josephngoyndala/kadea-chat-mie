import { DateTime } from 'luxon'
import User from '#models/user'
import RealtimeService from '#services/realtime_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * GoogleAuthController gère la connexion avec Google : redirection vers
 * Google, puis retour sur le site avec le profil de l'utilisateur.
 */
export default class GoogleAuthController {
  private realtime = new RealtimeService()

  /**
   * Envoie l'utilisateur vers la page de connexion de Google
   */
  async redirect({ ally }: HttpContext) {
    return ally.use('google').redirect()
  }

  /**
   * Retour de Google : retrouve (ou crée) le compte, puis ouvre la session.
   * Google ayant déjà vérifié l'adresse e-mail, le compte est considéré
   * comme confirmé.
   */
  async callback({ ally, auth, response, session }: HttpContext) {
    const google = ally.use('google')

    if (google.accessDenied()) {
      return this.fail(session, response, 'Connexion avec Google annulée.')
    }
    if (google.stateMisMatch() || google.hasError()) {
      return this.fail(session, response, 'La connexion avec Google a échoué. Réessayez.')
    }

    const profile = await google.user()
    if (!profile.email || !profile.emailVerificationState) {
      return this.fail(session, response, "Google n'a pas fourni d'adresse e-mail vérifiée.")
    }
    if (profile.emailVerificationState !== 'verified') {
      return this.fail(session, response, "Votre adresse e-mail Google n'est pas vérifiée.")
    }

    const email = profile.email.toLowerCase()
    let user = await User.findBy('googleId', profile.id)

    if (!user) {
      user = await User.findBy('email', email)
    }

    if (user) {
      user.googleId = user.googleId ?? profile.id
      user.emailVerifiedAt = user.emailVerifiedAt ?? DateTime.now()
    } else {
      user = new User()
      user.fullName = profile.name || email.split('@')[0]
      user.email = email
      user.googleId = profile.id
      user.emailVerifiedAt = DateTime.now()
    }

    user.lastSeenAt = DateTime.now()
    await user.save()

    await auth.use('web').login(user, true)
    this.realtime.userPresence(user.id, true)

    return response.redirect().toIntendedRoute('dashboard')
  }

  private fail(
    session: HttpContext['session'],
    response: HttpContext['response'],
    message: string
  ) {
    session.flash('error', message)
    return response.redirect().toRoute('session.create')
  }
}
