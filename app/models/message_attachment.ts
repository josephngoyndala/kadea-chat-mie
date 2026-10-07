import { MessageAttachmentSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'

export default class MessageAttachment extends MessageAttachmentSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>
}
