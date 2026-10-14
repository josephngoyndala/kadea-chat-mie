import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import User from '#models/user'

/**
 * Nombre maximal de membres d'un groupe, créateur compris.
 */
export const MAX_GROUP_MEMBERS = 50

/**
 * Levée quand une règle des groupes n'est pas respectée. Son message est
 * affiché tel quel à l'utilisateur.
 */
export class GroupRuleError extends Error {}

/**
 * Règles métier des groupes : création, ajout et retrait de membres.
 * Les conversations passées à ces méthodes doivent avoir leurs membres
 * chargés.
 */
export default class GroupService {
  /**
   * Crée un groupe. Le créateur en est l'administrateur.
   */
  async create(creator: User, name: string, memberIds: number[]) {
    const ids = [...new Set(memberIds)].filter((id) => id !== creator.id)

    if (ids.length === 0) {
      throw new GroupRuleError('Choisissez au moins un autre membre.')
    }
    if (ids.length + 1 > MAX_GROUP_MEMBERS) {
      throw new GroupRuleError(`Un groupe ne peut pas dépasser ${MAX_GROUP_MEMBERS} membres.`)
    }

    const users = await User.query().whereIn('id', ids).whereNotNull('email_verified_at')
    if (users.length !== ids.length) {
      throw new GroupRuleError('Certains membres sélectionnés sont introuvables.')
    }

    return db.transaction(async (trx) => {
      const conversation = await Conversation.create(
        { type: 'group', name, createdBy: creator.id },
        { client: trx }
      )

      await ConversationMember.createMany(
        [
          { conversationId: conversation.id, userId: creator.id, role: 'admin' },
          ...users.map((user) => ({
            conversationId: conversation.id,
            userId: user.id,
            role: 'member',
          })),
        ],
        { client: trx }
      )

      return conversation
    })
  }

  /**
   * Indique si l'utilisateur est administrateur de ce groupe.
   */
  isAdmin(user: User, conversation: Conversation) {
    return conversation.members.some(
      (member) => member.userId === user.id && member.role === 'admin'
    )
  }

  /**
   * Ajoute un membre au groupe. Réservé aux administrateurs.
   */
  async addMember(admin: User, conversation: Conversation, userId: number) {
    this.assertAdmin(admin, conversation)

    if (conversation.members.length >= MAX_GROUP_MEMBERS) {
      throw new GroupRuleError(`Un groupe ne peut pas dépasser ${MAX_GROUP_MEMBERS} membres.`)
    }

    const user = await User.query()
      .where('id', userId)
      .whereNotNull('email_verified_at')
      .firstOrFail()

    await ConversationMember.firstOrCreate(
      { conversationId: conversation.id, userId: user.id },
      { role: 'member' }
    )

    return user
  }

  /**
   * Retire un membre du groupe. Réservé aux administrateurs, qui ne peuvent
   * pas se retirer eux-mêmes.
   */
  async removeMember(admin: User, conversation: Conversation, userId: number) {
    this.assertAdmin(admin, conversation)

    if (userId === admin.id) {
      throw new GroupRuleError('Vous ne pouvez pas vous retirer vous-même du groupe.')
    }

    const membership = await ConversationMember.query()
      .where('conversation_id', conversation.id)
      .where('user_id', userId)
      .firstOrFail()

    await membership.delete()
  }

  private assertAdmin(user: User, conversation: Conversation) {
    if (conversation.type !== 'group') {
      throw new GroupRuleError("Cette conversation n'est pas un groupe.")
    }
    if (!this.isAdmin(user, conversation)) {
      throw new GroupRuleError('Seuls les administrateurs du groupe peuvent gérer ses membres.')
    }
  }
}
