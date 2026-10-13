import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import Message from '#models/message'
import type User from '#models/user'
import { dayKey } from '#services/date_formatter'

/**
 * Règles métier des messages : envoi et suppression.
 */
export default class MessageService {
  /**
   * Enregistre un message et met à jour la date du dernier message de la
   * conversation (qui sert à trier la liste). Indique aussi si ce message
   * ouvre une nouvelle journée dans la conversation, pour afficher le
   * séparateur de jour.
   */
  async send(user: User, conversation: Conversation, body: string) {
    return db.transaction(async (trx) => {
      const previous = await Message.query({ client: trx })
        .where('conversation_id', conversation.id)
        .orderBy('id', 'desc')
        .first()

      const message = await Message.create(
        { conversationId: conversation.id, senderId: user.id, body },
        { client: trx }
      )

      await Conversation.query({ client: trx })
        .where('id', conversation.id)
        .update({ last_message_at: message.createdAt.toJSDate() })

      return {
        message,
        startsNewDay: !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt),
      }
    })
  }

  /**
   * Supprime un message, à condition que l'utilisateur en soit l'auteur et
   * qu'il appartienne à cette conversation. Dans tout autre cas, la
   * recherche échoue et l'application répond « introuvable ».
   *
   * La suppression est logique : on renseigne la date et on vide le texte.
   */
  async deleteOwn(user: User, conversationId: number, messageId: number) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversation_id', conversationId)
      .where('sender_id', user.id)
      .firstOrFail()

    if (!message.deletedAt) {
      message.deletedAt = DateTime.now()
      message.body = null
      await message.save()
    }

    return message
  }
}
