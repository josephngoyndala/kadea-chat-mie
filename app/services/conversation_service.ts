import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'
import { NOT_HIDDEN_FOR_USER } from '#services/message_rules'

export type ConversationWithLastMessage = {
  conversation: Conversation
  lastMessage: Message | null
  unreadCount?: number
}

/**
 * Nombre de messages chargés à l'ouverture d'une conversation.
 */
const HISTORY_LIMIT = 100

/**
 * Messages chargés avant et après un message retrouvé par la recherche.
 */
const CONTEXT_BEFORE = 30
const CONTEXT_AFTER = 200

/**
 * Nombre maximum de messages dont on annonce le changement de statut
 * (reçu / lu) en une seule fois.
 */
const STATUS_CHANGE_LIMIT = 30

/**
 * Règles métier des conversations : liste, accès, historique, création.
 */
export default class ConversationService {
  /**
   * Conversations de l'utilisateur, la plus récente en premier. Un groupe est
   * toujours visible de ses membres ; une conversation privée encore vide
   * n'apparaît que chez celui qui l'a créée.
   */
  async listFor(user: User): Promise<ConversationWithLastMessage[]> {
    const conversations = await Conversation.query()
      .whereHas('members', (members) => {
        members.where('user_id', user.id)
      })
      .where((visible) => {
        visible
          .where('type', 'group')
          .orWhereNotNull('last_message_at')
          .orWhere('created_by', user.id)
      })
      .preload('members', (members) => {
        members.preload('user')
      })
      .orderByRaw('last_message_at DESC NULLS LAST, created_at DESC')

    const conversationIds = conversations.map((item) => item.id)
    const [lastMessages, unreadCounts] = await Promise.all([
      this.lastMessagesOf(conversationIds, user),
      this.unreadCountsFor(conversationIds, user),
    ])

    return conversations.map((conversation) => ({
      conversation,
      lastMessage: lastMessages.get(conversation.id) ?? null,
      unreadCount: unreadCounts.get(conversation.id) ?? 0,
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
   * Comme findForMember, mais uniquement pour un groupe.
   */
  async findGroupForMember(user: User, conversationId: number) {
    return Conversation.query()
      .where('id', conversationId)
      .where('type', 'group')
      .whereHas('members', (members) => {
        members.where('user_id', user.id)
      })
      .preload('members', (members) => {
        members.preload('user')
      })
      .firstOrFail()
  }

  /**
   * Indique si l'utilisateur est membre de la conversation. Sert aussi à
   * autoriser l'abonnement au canal temps réel de la conversation.
   */
  async isMember(userId: number, conversationId: number) {
    const membership = await ConversationMember.query()
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first()

    return membership !== null
  }

  /**
   * Derniers messages d'une conversation vus par l'utilisateur (sans ceux
   * qu'il a masqués), dans l'ordre chronologique, avec leur auteur.
   */
  async history(conversation: Conversation, viewer: User) {
    const messages = await Message.query()
      .where('conversation_id', conversation.id)
      .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
      .preload('sender')
      .preload('attachments')
      .orderBy('id', 'desc')
      .limit(HISTORY_LIMIT)

    return messages.reverse()
  }

  /**
   * Historique centré sur un message précis (résultat de recherche) : quelques
   * messages avant lui, lui-même, puis ceux qui suivent. Renvoie null si le
   * message n'existe pas dans cette conversation ou est masqué pour
   * l'utilisateur : la page affiche alors l'historique habituel.
   */
  async historyAround(conversation: Conversation, viewer: User, messageId: number) {
    const target = await Message.query()
      .where('id', messageId)
      .where('conversation_id', conversation.id)
      .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
      .first()
    if (!target) {
      return null
    }

    const [before, after] = await Promise.all([
      Message.query()
        .where('conversation_id', conversation.id)
        .where('id', '<', target.id)
        .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
        .preload('sender')
        .preload('attachments')
        .orderBy('id', 'desc')
        .limit(CONTEXT_BEFORE),
      Message.query()
        .where('conversation_id', conversation.id)
        .where('id', '>=', target.id)
        .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
        .preload('sender')
        .preload('attachments')
        .orderBy('id', 'asc')
        .limit(CONTEXT_AFTER),
    ])

    return [...before.reverse(), ...after]
  }

  /**
   * Dernier message visible d'une conversation pour l'utilisateur.
   */
  async lastMessageOf(conversation: Conversation, viewer: User) {
    const lastMessages = await this.lastMessagesOf([conversation.id], viewer)

    return lastMessages.get(conversation.id) ?? null
  }

  /**
   * Recherche les messages d'une conversation contenant un terme,
   * sans ceux masqués ou supprimés.
   */
  async search(conversation: Conversation, viewer: User, term: string) {
    const trimmed = term.trim()
    if (!trimmed) {
      return []
    }

    return Message.query()
      .where('conversation_id', conversation.id)
      .whereNull('deleted_at')
      .whereRaw(NOT_HIDDEN_FOR_USER, [viewer.id])
      .whereILike('body', `%${trimmed}%`)
      .preload('sender')
      .orderBy('id', 'desc')
      .limit(50)
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
      await this.ensureMembers(existing, [user.id, other.id])
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
        await this.ensureMembers(concurrent, [user.id, other.id])
        return concurrent
      }
      throw error
    }
  }

  /**
   * Quitte une conversation : la discussion disparaît de la liste de
   * l'utilisateur. Pour un groupe, un autre administrateur est promu si besoin.
   */
  async leave(user: User, conversationId: number) {
    const conversation = await this.findForMember(user, conversationId)

    await db.transaction(async (trx) => {
      const membership = await ConversationMember.query({ client: trx })
        .where('conversation_id', conversation.id)
        .where('user_id', user.id)
        .firstOrFail()

      await membership.useTransaction(trx).delete()

      if (conversation.type === 'group') {
        const remaining = await ConversationMember.query({ client: trx })
          .where('conversation_id', conversation.id)
          .orderBy('joined_at', 'asc')

        if (remaining.length > 0 && !remaining.some((member) => member.role === 'admin')) {
          remaining[0].role = 'admin'
          await remaining[0].useTransaction(trx).save()
        }
      }
    })

    return conversation
  }

  private async ensureMembers(conversation: Conversation, userIds: number[]) {
    for (const userId of userIds) {
      await ConversationMember.firstOrCreate(
        { conversationId: conversation.id, userId },
        { role: 'member' }
      )
    }
  }

  /**
   * Dernier message visible de chacune des conversations, en une seule
   * requête, avec son auteur.
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

    const messages = await Message.query()
      .whereIn('id', latestIds)
      .preload('sender')
      .preload('attachments')
    for (const message of messages) {
      lastMessages.set(message.conversationId, message)
    }

    return lastMessages
  }

  /**
   * Nombre de messages non lus pour chacune des conversations.
   */
  async unreadCountsFor(conversationIds: number[], viewer: User): Promise<Map<number, number>> {
    const unreadMap = new Map<number, number>()
    if (conversationIds.length === 0) {
      return unreadMap
    }

    const notHiddenQuery = NOT_HIDDEN_FOR_USER.replace(/messages\./g, 'm.')

    const rows = await db
      .from('messages as m')
      .join('conversation_members as cm', 'cm.conversation_id', 'm.conversation_id')
      .where('cm.user_id', viewer.id)
      .whereIn('m.conversation_id', conversationIds)
      .where('m.sender_id', '!=', viewer.id)
      .whereNull('m.deleted_at')
      .whereRaw('m.id > COALESCE(cm.last_read_message_id, 0)')
      .whereRaw(notHiddenQuery, [viewer.id])
      .groupBy('m.conversation_id')
      .select('m.conversation_id')
      .count('* as total')

    for (const row of rows) {
      unreadMap.set(Number(row.conversation_id), Number(row.total))
    }

    return unreadMap
  }

  /**
   * Marque tous les messages actuels de la conversation comme lus par cet
   * utilisateur (et donc aussi comme reçus).
   *
   * Renvoie les identifiants des messages des autres membres dont le statut
   * vient de changer : l'appelant les annonce en temps réel pour que leurs
   * auteurs voient les traits passer au bleu.
   */
  async markAsRead(conversationId: number, userId: number): Promise<number[]> {
    const membership = await ConversationMember.query()
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first()
    if (!membership) {
      return []
    }

    const latestMessage = await Message.query()
      .where('conversation_id', conversationId)
      .orderBy('id', 'desc')
      .first()
    if (!latestMessage) {
      return []
    }

    const previousRead = membership.lastReadMessageId ?? 0
    const previousDelivered = membership.lastDeliveredMessageId ?? 0
    if (previousRead >= latestMessage.id && previousDelivered >= latestMessage.id) {
      return []
    }

    await ConversationMember.query()
      .where('id', membership.id)
      .update({
        last_read_message_id: db.raw('GREATEST(COALESCE(last_read_message_id, 0), ?)', [
          latestMessage.id,
        ]),
        last_delivered_message_id: db.raw('GREATEST(COALESCE(last_delivered_message_id, 0), ?)', [
          latestMessage.id,
        ]),
      })

    return this.changedMessageIds(
      conversationId,
      userId,
      Math.min(previousRead, previousDelivered),
      latestMessage.id
    )
  }

  /**
   * Marque tous les messages actuels de la conversation comme reçus par cet
   * utilisateur (il est connecté, mais n'a pas forcément ouvert la
   * conversation). Renvoie les identifiants des messages dont le statut change.
   */
  async markAsDelivered(conversationId: number, userId: number): Promise<number[]> {
    const membership = await ConversationMember.query()
      .where('conversation_id', conversationId)
      .where('user_id', userId)
      .first()
    if (!membership) {
      return []
    }

    const latestMessage = await Message.query()
      .where('conversation_id', conversationId)
      .orderBy('id', 'desc')
      .first()
    if (!latestMessage) {
      return []
    }

    const previousDelivered = membership.lastDeliveredMessageId ?? 0
    if (previousDelivered >= latestMessage.id) {
      return []
    }

    await ConversationMember.query()
      .where('id', membership.id)
      .update({
        last_delivered_message_id: db.raw('GREATEST(COALESCE(last_delivered_message_id, 0), ?)', [
          latestMessage.id,
        ]),
      })

    return this.changedMessageIds(conversationId, userId, previousDelivered, latestMessage.id)
  }

  /**
   * Marque comme reçus les messages en attente dans toutes les conversations
   * de l'utilisateur : il vient de se connecter ou de rouvrir l'application.
   * Renvoie, par conversation, les messages dont le statut change.
   */
  async markAllAsDelivered(userId: number): Promise<Map<number, number[]>> {
    const changes = new Map<number, number[]>()

    const pending = await ConversationMember.query()
      .where('user_id', userId)
      .whereRaw(
        `COALESCE(last_delivered_message_id, 0) < COALESCE((
          SELECT MAX(messages.id) FROM messages
          WHERE messages.conversation_id = conversation_members.conversation_id
        ), 0)`
      )

    for (const member of pending) {
      const messageIds = await this.markAsDelivered(member.conversationId, userId)
      if (messageIds.length > 0) {
        changes.set(member.conversationId, messageIds)
      }
    }

    return changes
  }

  /**
   * Marque un message comme reçu par des membres précis (ceux qui étaient en
   * ligne au moment de l'envoi).
   */
  async markDeliveredFor(conversationId: number, userIds: number[], messageId: number) {
    if (userIds.length === 0) {
      return
    }

    await ConversationMember.query()
      .where('conversation_id', conversationId)
      .whereIn('user_id', userIds)
      .where((pointer) => {
        pointer
          .whereNull('last_delivered_message_id')
          .orWhere('last_delivered_message_id', '<', messageId)
      })
      .update({ last_delivered_message_id: messageId })
  }

  /**
   * Messages d'autres membres (non supprimés) dont le statut change quand
   * `readerId` avance son pointeur de `afterId` à `upToId`. Les plus récents
   * seulement, du plus ancien au plus récent.
   */
  private async changedMessageIds(
    conversationId: number,
    readerId: number,
    afterId: number,
    upToId: number
  ) {
    const rows = await db
      .from('messages')
      .select('id')
      .where('conversation_id', conversationId)
      .where('sender_id', '!=', readerId)
      .whereNull('deleted_at')
      .whereNull('silenced_at')
      .where('id', '>', afterId)
      .where('id', '<=', upToId)
      .orderBy('id', 'desc')
      .limit(STATUS_CHANGE_LIMIT)

    return rows.map((row) => Number(row.id)).reverse()
  }
}
