import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageDeletion from '#models/message_deletion'
import type User from '#models/user'
import { dayKey } from '#services/date_formatter'
import { EDIT_WINDOW_MINUTES, isWithinEditWindow } from '#services/message_rules'

/**
 * Levée quand un message ne peut pas (ou plus) être modifié.
 */
export class MessageNotEditableError extends Error {}

/**
 * Règles métier des messages : envoi, modification et suppression.
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
   * Modifie le texte d'un message de l'utilisateur, pendant le délai autorisé
   * et tant qu'il n'a pas été supprimé pour tous.
   */
  async edit(user: User, conversationId: number, messageId: number, body: string) {
    const message = await this.findOwn(user, conversationId, messageId)

    if (message.deletedAt) {
      throw new MessageNotEditableError('Ce message a été supprimé et ne peut plus être modifié.')
    }
    if (!isWithinEditWindow(message.createdAt)) {
      throw new MessageNotEditableError(
        `Un message ne peut être modifié que pendant ${EDIT_WINDOW_MINUTES} minutes.`
      )
    }

    if (message.body !== body) {
      message.body = body
      message.editedAt = DateTime.now()
      await message.save()
    }

    return message
  }

  /**
   * Supprime un message pour tous les participants. Réservé à son auteur.
   * La suppression est logique : on renseigne la date et on vide le texte.
   */
  async deleteForEveryone(user: User, conversationId: number, messageId: number) {
    const message = await this.findOwn(user, conversationId, messageId)

    if (!message.deletedAt) {
      message.deletedAt = DateTime.now()
      message.body = null
      await message.save()
    }

    return message
  }

  /**
   * Masque un message pour l'utilisateur seulement. Les autres participants
   * le voient toujours. N'importe quel message de la conversation peut être
   * masqué, y compris un message déjà supprimé pour tous.
   */
  async hideForUser(user: User, conversationId: number, messageId: number) {
    const message = await Message.query()
      .where('id', messageId)
      .where('conversation_id', conversationId)
      .firstOrFail()

    await MessageDeletion.firstOrCreate({ messageId: message.id, userId: user.id })

    return message
  }

  /**
   * Message de l'utilisateur dans cette conversation. Dans tout autre cas
   * (autre auteur, autre conversation), la recherche échoue et l'application
   * répond « introuvable ».
   */
  private async findOwn(user: User, conversationId: number, messageId: number) {
    return Message.query()
      .where('id', messageId)
      .where('conversation_id', conversationId)
      .where('sender_id', user.id)
      .firstOrFail()
  }
}
