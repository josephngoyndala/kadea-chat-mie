import string from '@adonisjs/core/helpers/string'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import MessageAttachment from '#models/message_attachment'
import type Message from '#models/message'

const ALLOWED_EXTNAMES = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf', 'txt', 'zip'] as const

/**
 * Enregistre les fichiers joints à un message sur le disque et en base.
 */
export default class MessageAttachmentService {
  /**
   * Fichiers acceptés dans la messagerie (images, PDF, texte, archive ZIP).
   */
  static allowedExtnames() {
    return [...ALLOWED_EXTNAMES]
  }

  /**
   * Crée une ligne par fichier et déplace le fichier vers le stockage.
   */
  async attachToMessage(message: Message, files: MultipartFile[], trx?: TransactionClientContract) {
    if (files.length === 0) {
      return []
    }

    const records: MessageAttachment[] = []

    for (const file of files) {
      const ext = file.extname ?? 'bin'
      const key = `message-attachments/${message.conversationId}/${message.id}-${string.uuid()}.${ext}`
      await file.moveToDisk(key)

      const attachment = await MessageAttachment.create(
        {
          messageId: message.id,
          originalName: file.clientName,
          storagePath: key,
          mimeType: file.type ?? 'application/octet-stream',
          sizeBytes: file.size,
        },
        trx ? { client: trx } : undefined
      )

      records.push(attachment)
    }

    return records
  }
}
