import { errors as authErrors } from '@adonisjs/auth'
import limiter from '@adonisjs/limiter/services/main'
import { DateTime } from 'luxon'
import User from '#models/user'
import ConversationService from '#services/conversation_service'
import RealtimeService from '#services/realtime_service'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController gère la connexion et la déconnexion : affichage du
 * formulaire, vérification des identifiants et fin de session.
 */
export default class SessionController {
  private conversations = new ConversationService()
  private realtime = new RealtimeService()

  /**
   * Affiche la page de connexion
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Vérifie les identifiants (avec une limite sur les tentatives ratées),
   * refuse les comptes dont l'adresse n'est pas confirmée, puis crée la
   * session (avec un jeton « se souvenir de moi » si la case est cochée)
   */
  async store(ctx: HttpContext) {
    const { request, auth, response, session } = ctx
    const { email, password, remember } = await request.validateUsing(loginValidator)

    const user = await this.authenticate(ctx, email, password)
    if (!user) {
      return response.redirect().back()
    }

    /**
     * Les identifiants sont corrects : on peut maintenant dire à
     * l'utilisateur que son adresse doit être confirmée.
     */
    if (!user.emailVerifiedAt) {
      session.put('pending_verification_email', user.email)
      session.flash(
        'error',
        "Votre adresse e-mail n'est pas encore confirmée. Consultez votre boîte mail ou demandez un nouveau lien."
      )
      return response.redirect().toRoute('email_verification.notice')
    }

    await auth.use('web').login(user, !!remember)
    user.lastSeenAt = DateTime.now()
    await user.save()
    this.realtime.userPresence(user.id, true)

    /**
     * Renvoie l'utilisateur vers la page qu'il voulait ouvrir avant d'être
     * redirigé vers la connexion, ou vers le tableau de bord par défaut.
     */
    return response.redirect().toIntendedRoute('dashboard')
  }

  /**
   * Déconnecte l'utilisateur, détruit sa session et supprime son jeton
   * « se souvenir de moi »
   */
  async destroy({ auth, response, session }: HttpContext) {
    const user = auth.user
    if (user) {
      user.lastSeenAt = null
      await user.save()
      this.realtime.userPresence(user.id, false)
    }

    await auth.use('web').logout()
    session.flash('success', 'Vous avez été déconnecté.')
    return response.redirect().toRoute('session.create')
  }

  /**
   * Maintient le statut en ligne de l'utilisateur actif. Un utilisateur qui
   * donne signe de vie est connecté : les messages qui l'attendaient passent
   * à « reçus » (deux traits chez leurs auteurs).
   */
  async ping({ auth, response }: HttpContext) {
    const user = auth.user
    if (user) {
      user.lastSeenAt = DateTime.now()
      await user.save()
      this.realtime.userPresence(user.id, true)

      const changes = await this.conversations.markAllAsDelivered(user.id)
      for (const [conversationId, messageIds] of changes) {
        this.realtime.statusChanged(conversationId, messageIds)
      }
    }
    return response.noContent()
  }

  /**
   * Vérifie l'e-mail et le mot de passe, sous la protection de deux limites :
   * 20 échecs par minute pour une adresse IP (un robot qui essaie beaucoup
   * d'adresses) et 5 échecs par minute pour un couple IP + e-mail (un robot
   * qui s'acharne sur un compte), avec un blocage de 15 minutes. Seuls les
   * échecs consomment une tentative.
   *
   * Renvoie l'utilisateur, ou null après avoir préparé le message d'erreur à
   * afficher (identifiants incorrects, ou trop de tentatives).
   */
  private async authenticate({ request, session }: HttpContext, email: string, password: string) {
    const loginLimiter = limiter.multi([
      { key: `login_ip_${request.ip()}`, requests: 20, duration: '1 min' },
      {
        key: `login_${request.ip()}_${email}`,
        requests: 5,
        duration: '1 min',
        blockDuration: '15 mins',
      },
    ])

    try {
      /**
       * Si les identifiants sont faux, penalize consomme une tentative puis
       * relance l'erreur (attrapée plus bas). Si la limite est atteinte, il
       * renvoie l'erreur de limite sans même vérifier le mot de passe.
       */
      const [throttleError, user] = await loginLimiter.penalize(() => {
        return User.verifyCredentials(email, password)
      })

      if (throttleError) {
        const minutes = Math.max(1, Math.ceil(throttleError.response.availableIn / 60))

        session.flashOnly(['email'])
        session.flash(
          'error',
          `Trop de tentatives de connexion. Réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`
        )
        return null
      }

      return user
    } catch (error) {
      if (error instanceof authErrors.E_INVALID_CREDENTIALS) {
        session.flashOnly(['email'])
        session.flash('error', 'Adresse e-mail ou mot de passe incorrect.')
        return null
      }

      throw error
    }
  }
}
