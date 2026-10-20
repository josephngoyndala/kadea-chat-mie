import hash from '@adonisjs/core/services/hash'
import AvatarService from '#services/avatar_service'
import BlockService from '#services/block_service'
import UserPresenter from '#services/user_presenter'
import {
  updateAvatarValidator,
  updatePasswordValidator,
  updateProfileValidator,
} from '#validators/user'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * ProfileController gère la page de profil : nom, photo, mot de passe et
 * utilisateurs bloqués de l'utilisateur connecté.
 */
export default class ProfileController {
  private avatars = new AvatarService()
  private blocks = new BlockService()
  private users = new UserPresenter()

  /**
   * Affiche la page de profil
   */
  async show({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const blockedUsers = await this.users.directory(await this.blocks.blockedUsersOf(user))

    return view.render('pages/profile/show', { user, blockedUsers })
  }

  /**
   * Modifie le nom
   */
  async update({ auth, request, session, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { fullName } = await request.validateUsing(updateProfileValidator)

    user.fullName = fullName
    await user.save()

    session.flash('success', 'Votre nom a été mis à jour.')
    return response.redirect().toRoute('profile.show')
  }

  /**
   * Remplace la photo de profil
   */
  async updateAvatar({ auth, request, session, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { avatar } = await request.validateUsing(updateAvatarValidator)

    await this.avatars.replace(user, avatar)

    session.flash('success', 'Votre photo de profil a été mise à jour.')
    return response.redirect().toRoute('profile.show')
  }

  /**
   * Supprime la photo de profil
   */
  async destroyAvatar({ auth, session, response }: HttpContext) {
    const user = auth.getUserOrFail()

    await this.avatars.remove(user)

    session.flash('success', 'Votre photo de profil a été supprimée.')
    return response.redirect().toRoute('profile.show')
  }

  /**
   * Change le mot de passe, après avoir vérifié l'ancien. Un compte créé
   * avec Google n'a pas de mot de passe : il n'y a rien à modifier.
   */
  async updatePassword({ auth, request, session, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { currentPassword, password } = await request.validateUsing(updatePasswordValidator)

    if (!user.password) {
      session.flash(
        'error',
        'Votre compte utilise la connexion Google : il n’a pas de mot de passe à modifier.'
      )
      return response.redirect().back()
    }

    const isCurrentPasswordValid = await hash.verify(user.password, currentPassword)
    if (!isCurrentPasswordValid) {
      session.flash('inputErrorsBag', {
        currentPassword: ['Le mot de passe actuel est incorrect.'],
      })
      return response.redirect().back()
    }

    user.password = password
    await user.save()

    session.flash('success', 'Votre mot de passe a été modifié.')
    return response.redirect().toRoute('profile.show')
  }
}
