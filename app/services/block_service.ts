import db from '@adonisjs/lucid/services/db'
import type Conversation from '#models/conversation'
import User from '#models/user'
import UserBlock from '#models/user_block'

export type BlockState = {
  /**
   * L'utilisateur a bloqué l'autre.
   */
  byMe: boolean
  /**
   * L'autre utilisateur a bloqué l'utilisateur.
   */
  byThem: boolean
}

/**
 * Règles métier du blocage : bloquer, débloquer, et savoir si deux
 * utilisateurs peuvent encore s'écrire.
 */
export default class BlockService {
  /**
   * Bloque un utilisateur. Sans effet si c'est déjà fait. Répond « introuvable »
   * si l'utilisateur n'existe pas.
   */
  async block(blocker: User, blockedId: number) {
    const blocked = await User.findOrFail(blockedId)

    await UserBlock.firstOrCreate({ blockerId: blocker.id, blockedId: blocked.id })

    return blocked
  }

  /**
   * Débloque un utilisateur. Sans effet s'il n'était pas bloqué.
   */
  async unblock(blocker: User, blockedId: number) {
    const blocked = await User.findOrFail(blockedId)

    await UserBlock.query().where('blocker_id', blocker.id).where('blocked_id', blocked.id).delete()

    return blocked
  }

  /**
   * Qui a bloqué qui entre deux utilisateurs.
   */
  async stateBetween(userId: number, otherUserId: number): Promise<BlockState> {
    const blocks = await UserBlock.query()
      .where((pair) => {
        pair.where('blocker_id', userId).where('blocked_id', otherUserId)
      })
      .orWhere((pair) => {
        pair.where('blocker_id', otherUserId).where('blocked_id', userId)
      })

    return {
      byMe: blocks.some((block) => block.blockerId === userId),
      byThem: blocks.some((block) => block.blockerId === otherUserId),
    }
  }

  /**
   * Utilisateurs bloqués par cet utilisateur, par ordre alphabétique
   * (page de profil).
   */
  async blockedUsersOf(user: User) {
    const blockedIds = db.from('user_blocks').select('blocked_id').where('blocker_id', user.id)

    return User.query().whereIn('id', blockedIds).orderBy('full_name')
  }

  /**
   * Message d'erreur à afficher si l'utilisateur ne peut plus écrire dans
   * cette conversation à cause d'un blocage, ou null s'il le peut. Seules les
   * conversations privées sont concernées (les membres doivent être chargés).
   */
  async restrictionFor(user: User, conversation: Conversation) {
    if (conversation.type !== 'private') {
      return null
    }

    const other = conversation.members.find((member) => member.userId !== user.id)
    if (!other) {
      return null
    }

    const state = await this.stateBetween(user.id, other.userId)
    if (state.byMe) {
      return 'Vous avez bloqué cet utilisateur. Débloquez-le pour lui écrire.'
    }
    if (state.byThem) {
      return 'Vous ne pouvez pas envoyer de message à cet utilisateur.'
    }

    return null
  }
}
