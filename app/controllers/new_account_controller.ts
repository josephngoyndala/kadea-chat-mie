import User from '#models/user'
import EmailVerificationService from '#services/email_verification_service'
import { signupValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * NewAccountController gère l'inscription : affichage du formulaire et
 * création du compte. L'utilisateur n'est PAS connecté à l'inscription :
 * il doit d'abord confirmer son adresse e-mail.
 */
export default class NewAccountController {
  private verification = new EmailVerificationService()

  /**
   * Affiche la page d'inscription
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/signup')
  }

  /**
   * Crée le compte, envoie l'e-mail de confirmation et affiche la page
   * « Vérifiez votre boîte mail »
   */
  async store({ request, response, session, logger }: HttpContext) {
    const { fullName, email, password } = await request.validateUsing(signupValidator)
    const user = await User.create({ fullName, email, password })

    /**
     * Si l'envoi échoue, le compte existe quand même : l'utilisateur pourra
     * redemander l'e-mail depuis la page suivante.
     */
    try {
      await this.verification.send(user)
    } catch (error) {
      logger.error({ err: error }, "Échec de l'envoi de l'e-mail de confirmation")
    }

    session.put('pending_verification_email', user.email)
    return response.redirect().toRoute('email_verification.notice')
  }
}
