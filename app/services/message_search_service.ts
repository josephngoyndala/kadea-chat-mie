import Conversation from '#models/conversation'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import type User from '#models/user'
import { NOT_HIDDEN_FOR_USER } from '#services/message_rules'

/**
 * Longueur minimale du mot recherché : en dessous, trop de messages
 * correspondraient pour que la liste soit utile.
 */
export const MIN_SEARCH_LENGTH = 2

/**
 * Nombre maximum de messages renvoyés.
 */
const SEARCH_LIMIT = 30

export type MessageHit = {
  message: Message
  conversation: Conversation
}

/**
 * Recherche d'un mot dans les messages de toutes les conversations d'un
 * utilisateur.
 */
export default class MessageSearchService {
  /**
   * Messages contenant le mot, du plus récent au plus ancien. Seules les
   * conversations dont l'utilisateur est membre sont parcourues, et les
   * messages supprimés ou masqués pour lui sont ignorés.
   */
  async search(user: User, term: string): Promise<MessageHit[]> {
    const trimmed = term.trim()
    if (trimmed.length < MIN_SEARCH_LENGTH) {
      return []
    }

    const messages = await Message.query()
      .whereIn(
        'conversation_id',
        ConversationMember.query().where('user_id', user.id).select('conversation_id')
      )
      .whereNull('deleted_at')
      .whereRaw(NOT_HIDDEN_FOR_USER, [user.id])
      .whereILike('body', `%${this.escapeLike(trimmed)}%`)
      .preload('sender')
      .orderBy('id', 'desc')
      .limit(SEARCH_LIMIT)

    if (messages.length === 0) {
      return []
    }

    const conversationIds = [...new Set(messages.map((message) => message.conversationId))]
    const conversations = await Conversation.query()
      .whereIn('id', conversationIds)
      .preload('members', (members) => {
        members.preload('user')
      })
    const byId = new Map(conversations.map((conversation) => [conversation.id, conversation]))

    const hits: MessageHit[] = []
    for (const message of messages) {
      const conversation = byId.get(message.conversationId)
      if (conversation) {
        hits.push({ message, conversation })
      }
    }

    return hits
  }

  /**
   * Les caractères % et _ ont un sens spécial dans un LIKE : on les neutralise
   * pour que « 100% » cherche bien le texte « 100% ».
   */
  private escapeLike(term: string) {
    return term.replace(/[\\%_]/g, '\\$&')
  }
}
