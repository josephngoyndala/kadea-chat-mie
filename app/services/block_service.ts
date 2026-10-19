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
 *
 * Comme sur WhatsApp, le blocage est silencieux pour l'utilisateur bloqué :
 * il peut toujours écrire, mais ses messages ne sont jamais remis (un seul
 * trait), il ne voit plus la photo ni la présence de celui qui l'a bloqué, et
 * celui-ci ne voit pas qu'il est en train d'écrire.
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
   * Identifiants des utilisateurs qui ont bloqué cet utilisateur : il ne voit
   * plus leur photo ni leur présence.
   */
  async blockerIdsOf(user: User) {
    const blocks = await UserBlock.query().where('blocked_id', user.id)

    return new Set(blocks.map((block) => block.blockerId))
  }

  /**
   * Message d'erreur à afficher si l'utilisateur a lui-même bloqué l'autre
   * participant de la conversation (il doit d'abord le débloquer pour lui
   * écrire), ou null s'il peut écrire. Seules les conversations privées sont
   * concernées (les membres doivent être chargés).
   *
   * L'utilisateur bloqué, lui, ne reçoit jamais d'erreur : voir
   * silentRecipientFor.
   */
  async restrictionFor(user: User, conversation: Conversation) {
    const other = this.otherMemberOf(user, conversation)
    if (!other) {
      return null
    }

    const state = await this.stateBetween(user.id, other)
    if (state.byMe) {
      return 'Vous avez bloqué cet utilisateur. Débloquez-le pour lui écrire.'
    }

    return null
  }

  /**
   * Si l'autre participant d'une conversation privée a bloqué l'utilisateur,
   * renvoie son identifiant : le message de l'utilisateur sera enregistré
   * mais jamais remis à ce destinataire. Sinon null.
   */
  async silentRecipientFor(user: User, conversation: Conversation) {
    const other = this.otherMemberOf(user, conversation)
    if (!other) {
      return null
    }

    const state = await this.stateBetween(user.id, other)

    return state.byThem && !state.byMe ? other : null
  }

  /**
   * Indique si un blocage existe, dans un sens ou dans l'autre, entre
   * l'utilisateur et l'autre participant d'une conversation privée. Sert à ne
   * pas diffuser le signal « en train d'écrire ».
   */
  async isBlockedInConversation(user: User, conversation: Conversation) {
    const other = this.otherMemberOf(user, conversation)
    if (!other) {
      return false
    }

    const state = await this.stateBetween(user.id, other)

    return state.byMe || state.byThem
  }

  /**
   * L'autre participant d'une conversation privée (les membres doivent être
   * chargés), ou null pour un groupe.
   */
  private otherMemberOf(user: User, conversation: Conversation) {
    if (conversation.type !== 'private') {
      return null
    }

    return conversation.members.find((member) => member.userId !== user.id)?.userId ?? null
  }
}
