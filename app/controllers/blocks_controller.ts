import BlockService from '#services/block_service'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * BlocksController gère le blocage des utilisateurs : bloquer depuis une
 * conversation, débloquer depuis la conversation ou depuis le profil. Après
 * l'action, l'utilisateur revient sur la page d'où il vient.
 */
export default class BlocksController {
  private blocks = new BlockService()

  /**
   * Bloque un utilisateur
   */
  async store({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const blockedId = Number(params.userId)

    if (blockedId === user.id) {
      session.flash('error', 'Vous ne pouvez pas vous bloquer vous-même.')
      return response.redirect().back()
    }

    const blocked = await this.blocks.block(user, blockedId)

    session.flash(
      'success',
      `${blocked.fullName ?? 'Cet utilisateur'} est bloqué. Il ne peut plus vous envoyer de messages.`
    )
    return response.redirect().back()
  }

  /**
   * Débloque un utilisateur
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()

    const unblocked = await this.blocks.unblock(user, Number(params.userId))

    session.flash('success', `${unblocked.fullName ?? 'Cet utilisateur'} est débloqué.`)
    return response.redirect().back()
  }
}
