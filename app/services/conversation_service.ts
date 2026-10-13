import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'

export type ConversationWithLastMessage = {
  conversation: Conversation
  lastMessage: Message | null
}

/**
 * Nombre de messages chargés à l'ouverture d'une conversation.
 */
const HISTORY_LIMIT = 100

/**
 * Condition SQL qui écarte les messages que l'utilisateur a masqués
 * (« supprimer pour moi »). Le paramètre est l'identifiant de l'utilisateur.
 */
const NOT_HIDDEN_FOR_USER =
  'NOT EXISTS (SELECT 1 FROM message_deletions WHERE message_deletions.message_id = messages.id AND message_deletions.user_id = ?)'

/**
 * Règles métier des conversations : liste, accès, historique, création.
 */
export default class ConversationService {
  /**
   * Conversations de l'utilisateur, la plus récente en premier. Une
   * conversation encore vide n'apparaît que chez celui qui l'a créée.
   */
  async listFor(user: User): Promise<ConversationWithLastMessage[]> {
    const conversations = await Conversation.query()
      .whereHas('members', (members) => {
        members.where('user_id', user.id)
      })
      .where((visible) => {
        visible.whereNotNull('last_message_at').orWhere('created_by', user.id)
      })
      .preload('members', (members) => {
        members.preload('user')
      })
      .orderByRaw('last_message_at DESC NULLS LAST, created_at DESC')

    const lastMessages = await this.lastMessagesOf(
      conversations.map((item) => item.id),
      user
    )

    return conversations.map((conversation) => ({
      conversation,
      lastMessage: lastMessages.get(conversation.id) ?? null,
    }))
  }

  /**
   * Renvoie la conversation uniquement si l'utilisateur en est membre.
   * Sinon la recherche échoue et l'application répond « page introuvable »,
   * comme si la conversation n'existait pas.
   */
  async findForMember(user: User, conversationId: number) {
    return Conversation.query()
      .where('id', conversationId)
      .whereHas('members', (members) => {
        members.where('user_id', user.id)
      })
      .preload('members', (members) => {
        members.preload('user')
      })
      .firstOrFail()
  }

  /**
   * Derniers messages d'une conversation vus par l'utilisateur (sans ceux
   * qu'il a masqués), dans l'ordre chronologique.
   */
  async history(conversation: Conversation, viewer: User) {
    const messages = await Message.query()
      .where('conversation_id', conversation.id)
      .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
      .orderBy('id', 'desc')
      .limit(HISTORY_LIMIT)

    return messages.reverse()
  }

  /**
   * Démarre une conversation privée avec un autre utilisateur, ou renvoie
   * celle qui existe déjà entre eux.
   */
  async startPrivate(user: User, otherUserId: number) {
    const other = await User.query()
      .where('id', otherUserId)
      .whereNotNull('email_verified_at')
      .firstOrFail()

    /**
     * Clé identique quel que soit celui qui démarre : « 3-7 » pour les
     * utilisateurs 3 et 7. La base interdit deux conversations avec la
     * même clé.
     */
    const privateKey = [user.id, other.id].sort((a, b) => a - b).join('-')

    const existing = await Conversation.findBy('private_key', privateKey)
    if (existing) {
      return existing
    }

    try {
      return await db.transaction(async (trx) => {
        const conversation = await Conversation.create(
          { type: 'private', privateKey, createdBy: user.id },
          { client: trx }
        )

        await ConversationMember.createMany(
          [
            { conversationId: conversation.id, userId: user.id, role: 'member' },
            { conversationId: conversation.id, userId: other.id, role: 'member' },
          ],
          { client: trx }
        )

        return conversation
      })
    } catch (error) {
      /**
       * Les deux utilisateurs ont démarré la conversation en même temps :
       * la contrainte d'unicité a refusé la seconde, on relit la première.
       */
      const concurrent = await Conversation.findBy('private_key', privateKey)
      if (concurrent) {
        return concurrent
      }
      throw error
    }
  }

  /**
   * Dernier message visible de chacune des conversations, en une seule
   * requête.
   */
  private async lastMessagesOf(conversationIds: number[], viewer: User) {
    const lastMessages = new Map<number, Message>()
    if (conversationIds.length === 0) {
      return lastMessages
    }

    const latestIds = db
      .from('messages')
      .whereIn('conversation_id', conversationIds)
      .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
      .groupBy('conversation_id')
      .max('id')

    const messages = await Message.query().whereIn('id', latestIds)
    for (const message of messages) {
      lastMessages.set(message.conversationId, message)
    }

    return lastMessages
  }
}
