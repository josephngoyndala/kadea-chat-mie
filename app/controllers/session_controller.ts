import { errors } from '@adonisjs/auth'
import User from '#models/user'
import { loginValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * SessionController gère la connexion et la déconnexion : affichage du
 * formulaire, vérification des identifiants et fin de session.
 */
export default class SessionController {
  /**
   * Affiche la page de connexion
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/login')
  }

  /**
   * Vérifie les identifiants, refuse les comptes dont l'adresse n'est pas
   * confirmée, puis crée la session (avec un jeton « se souvenir de moi »
   * si la case est cochée)
   */
  async store({ request, auth, response, session }: HttpContext) {
    const { email, password, remember } = await request.validateUsing(loginValidator)

    let user: User
    try {
      user = await User.verifyCredentials(email, password)
    } catch (error) {
      if (error instanceof errors.E_INVALID_CREDENTIALS) {
        session.flashOnly(['email'])
        session.flash('error', 'Adresse e-mail ou mot de passe incorrect.')
        return response.redirect().back()
      }
      throw error
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
    await auth.use('web').logout()
    session.flash('success', 'Vous avez été déconnecté.')
    return response.redirect().toRoute('session.create')
  }
}
