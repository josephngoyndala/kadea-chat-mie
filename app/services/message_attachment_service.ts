import string from '@adonisjs/core/helpers/string'
import type { MultipartFile } from '@adonisjs/core/bodyparser'
import type { HttpContext } from '@adonisjs/core/http'
import type { TransactionClientContract } from '@adonisjs/lucid/types/database'
import MessageAttachment from '#models/message_attachment'
import type Message from '#models/message'

const ALLOWED_EXTNAMES = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'mp4',
  'webm',
  'mov',
  'pdf',
  'txt',
  'zip',
] as const

const MAX_FILE_BYTES = 20 * 1024 * 1024
const MAX_FILES = 5

/**
 * Levée quand une pièce jointe n'est pas acceptée.
 */
export class MessageAttachmentError extends Error {}

/**
 * Enregistre les fichiers joints à un message sur le disque et en base.
 */
export default class MessageAttachmentService {
  /**
   * Fichiers acceptés dans la messagerie (images, vidéos, PDF, etc.).
   */
  static allowedExtnames() {
    return [...ALLOWED_EXTNAMES]
  }

  /**
   * Lit les fichiers réellement envoyés (sans les entrées vides du navigateur).
   */
  static fromRequest(request: HttpContext['request']) {
    const attachments: MultipartFile[] = []
    const all = request.allFiles() as Record<string, MultipartFile | MultipartFile[]>

    for (const [key, value] of Object.entries(all)) {
      if (!key.startsWith('attachments')) {
        continue
      }

      if (Array.isArray(value)) {
        attachments.push(...value.filter((file) => file.size > 0))
      } else if (value.size > 0) {
        attachments.push(value)
      }
    }

    return this.validate(attachments)
  }

  /**
   * Vérifie taille, format et nombre de pièces jointes.
   */
  static validate(files: MultipartFile[]) {
    if (files.length > MAX_FILES) {
      throw new MessageAttachmentError('Vous ne pouvez pas envoyer plus de 5 fichiers à la fois.')
    }

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        throw new MessageAttachmentError('Un fichier dépasse la taille maximale de 20 Mo.')
      }

      const ext = file.extname?.toLowerCase()
      if (!ext || !ALLOWED_EXTNAMES.includes(ext as (typeof ALLOWED_EXTNAMES)[number])) {
        throw new MessageAttachmentError(
          'Format non accepté. Utilisez une image, une vidéo (MP4, WebM, MOV), un PDF, un TXT ou un ZIP.'
        )
      }

      if (!file.isValid) {
        throw new MessageAttachmentError(file.errors?.[0]?.message ?? 'Fichier invalide.')
      }
    }

    return files
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
