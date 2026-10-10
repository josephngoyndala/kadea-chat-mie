import PasswordResetService from '#services/password_reset_service'
import { forgotPasswordValidator, resetPasswordValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * PasswordResetController gère le mot de passe oublié : demande du lien,
 * affichage du formulaire de réinitialisation et enregistrement du nouveau
 * mot de passe.
 */
export default class PasswordResetController {
  private passwordReset = new PasswordResetService()

  /**
   * Affiche le formulaire « mot de passe oublié »
   */
  async create({ view }: HttpContext) {
    return view.render('pages/auth/forgot_password')
  }

  /**
   * Envoie le lien de réinitialisation. La réponse est toujours la même, que
   * l'adresse existe ou non, pour ne pas révéler quels comptes existent.
   */
  async store({ request, session, response, logger }: HttpContext) {
    const { email } = await request.validateUsing(forgotPasswordValidator)

    try {
      await this.passwordReset.sendLink(email)
    } catch (error) {
      logger.error({ err: error }, "Échec de l'envoi du lien de réinitialisation")
    }

    session.flash(
      'success',
      "Si un compte existe pour cette adresse, un e-mail avec un lien de réinitialisation vient d'être envoyé."
    )
    return response.redirect().toRoute('password_reset.create')
  }

  /**
   * Affiche le formulaire de choix du nouveau mot de passe, si le lien est
   * encore valable
   */
  async edit({ params, view, session, response }: HttpContext) {
    const isValid = await this.passwordReset.isTokenValid(params.token)

    if (!isValid) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.')
      return response.redirect().toRoute('password_reset.create')
    }

    return view.render('pages/auth/reset_password', { token: params.token })
  }

  /**
   * Enregistre le nouveau mot de passe. Il est validé avant de consommer le
   * lien, pour qu'une faute de frappe ne le rende pas inutilisable.
   */
  async update({ params, request, session, response }: HttpContext) {
    const { password } = await request.validateUsing(resetPasswordValidator)
    const user = await this.passwordReset.reset(params.token, password)

    if (!user) {
      session.flash('error', 'Ce lien est invalide ou a expiré. Demandez-en un nouveau.')
      return response.redirect().toRoute('password_reset.create')
    }

    session.flash('success', 'Votre mot de passe a été modifié. Vous pouvez vous connecter.')
    return response.redirect().toRoute('session.create')
  }
}
