import type { MultipartFile } from '@adonisjs/core/bodyparser'
import { DateTime } from 'luxon'
import db from '@adonisjs/lucid/services/db'
import Conversation from '#models/conversation'
import Message from '#models/message'
import MessageDeletion from '#models/message_deletion'
import type User from '#models/user'
import { dayKey } from '#services/date_formatter'
import MessageAttachmentService from '#services/message_attachment_service'
import {
  EDIT_WINDOW_MINUTES,
  NOT_HIDDEN_FOR_USER,
  isWithinEditWindow,
} from '#services/message_rules'

/**
 * Levée quand un message ne peut pas (ou plus) être modifié.
 */
export class MessageNotEditableError extends Error {}

/**
 * Règles métier des messages : envoi, lecture, modification et suppression.
 */
export default class MessageService {
  private attachments = new MessageAttachmentService()

  /**
   * Enregistre un message et met à jour la date du dernier message de la
   * conversation (qui sert à trier la liste). Indique aussi si ce message
   * ouvre une nouvelle journée dans la conversation, pour afficher le
   * séparateur de jour.
   */
  async send(
    user: User,
    conversation: Conversation,
    body: string,
    files: MultipartFile[] = []
  ) {
    return db.transaction(async (trx) => {
      const previous = await Message.query({ client: trx })
        .where('conversation_id', conversation.id)
        .orderBy('id', 'desc')
        .first()

      const trimmed = body.trim()
      const message = await Message.create(
        {
          conversationId: conversation.id,
          senderId: user.id,
          body: trimmed.length > 0 ? trimmed : null,
        },
        { client: trx }
      )

      if (files.length > 0) {
        await this.attachments.attachToMessage(message, files, trx)
      }

      await Conversation.query({ client: trx })
        .where('id', conversation.id)
        .update({ last_message_at: message.createdAt.toJSDate() })

      await message.load('sender')
      await message.load('attachments')

      return {
        message,
        startsNewDay: !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt),
      }
    })
  }

  /**
   * Un message de la conversation, avec son auteur, à condition que
   * l'utilisateur ne l'ait pas masqué. Sinon la recherche échoue et
   * l'application répond « introuvable ».
   */
  async findVisible(user: User, conversationId: number, messageId: number) {
    return Message.query()
      .where('id', messageId)
      .where('conversation_id', conversationId)
      .whereRaw(NOT_HIDDEN_FOR_USER, [user.id])
      .preload('sender')
      .preload('attachments')
      .firstOrFail()
  }

  /**
   * Indique si ce message ouvre une nouvelle journée dans sa conversation.
   */
  async startsNewDay(message: Message) {
    const previous = await Message.query()
      .where('conversation_id', message.conversationId)
      .where('id', '<', message.id)
      .orderBy('id', 'desc')
      .first()

    return !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
  }

  /**
   * Messages visibles envoyés après un identifiant donné : sert à rattraper
   * les messages manqués après une coupure de connexion.
   */
  async listAfter(user: User, conversationId: number, afterId: number) {
    const messages = await Message.query()
      .where('conversation_id', conversationId)
      .where('id', '>', afterId)
      .whereRaw(NOT_HIDDEN_FOR_USER, [user.id])
      .preload('sender')
      .preload('attachments')
      .orderBy('id', 'asc')
      .limit(100)

    let previous: Message | null =
      messages.length > 0
        ? await Message.query()
            .where('conversation_id', conversationId)
            .where('id', '<', messages[0].id)
            .orderBy('id', 'desc')
            .first()
        : null

    return messages.map((message) => {
      const startsNewDay = !previous || dayKey(previous.createdAt) !== dayKey(message.createdAt)
      previous = message

      return { message, startsNewDay }
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

    await message.load('sender')
    await message.load('attachments')

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
      .preload('attachments')
      .firstOrFail()
  }
}
