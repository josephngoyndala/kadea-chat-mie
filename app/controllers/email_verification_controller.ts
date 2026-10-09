import User from '#models/user'
import EmailVerificationService from '#services/email_verification_service'
import { resendVerificationValidator } from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * EmailVerificationController gère la confirmation de l'adresse e-mail :
 * page d'attente, validation du lien reçu et renvoi du message.
 */
export default class EmailVerificationController {
  private verification = new EmailVerificationService()

  /**
   * Page « Vérifiez votre boîte mail »
   */
  async notice({ session, view }: HttpContext) {
    const email = session.get('pending_verification_email')
    return view.render('pages/auth/verify_email', { email })
  }

  /**
   * Valide le lien reçu par e-mail
   */
  async verify({ params, session, response }: HttpContext) {
    const user = await this.verification.verify(params.token)

    if (!user) {
      session.flash(
        'error',
        'Ce lien de confirmation est invalide ou a expiré. Demandez-en un nouveau.'
      )
      return response.redirect().toRoute('email_verification.notice')
    }

    session.forget('pending_verification_email')
    session.flash('success', 'Votre adresse est confirmée. Vous pouvez maintenant vous connecter.')
    return response.redirect().toRoute('session.create')
  }

  /**
   * Renvoie l'e-mail de confirmation. La réponse est toujours la même, que
   * l'adresse existe ou non, pour ne pas révéler quels comptes existent.
   */
  async resend({ request, session, response, logger }: HttpContext) {
    const { email } = await request.validateUsing(resendVerificationValidator)
    const user = await User.findBy('email', email)

    if (user) {
      try {
        await this.verification.resend(user)
      } catch (error) {
        logger.error({ err: error }, "Échec du renvoi de l'e-mail de confirmation")
      }
    }

    session.put('pending_verification_email', email)
    session.flash(
      'success',
      "Si un compte non confirmé existe pour cette adresse, un e-mail vient d'être envoyé. Pensez à vérifier vos courriers indésirables."
    )
    return response.redirect().toRoute('email_verification.notice')
  }
}
