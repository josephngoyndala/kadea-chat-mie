import { MessageDeletionSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import Message from '#models/message'
import User from '#models/user'

/**
 * Un message masqué par un utilisateur pour lui seul (« supprimer pour moi »).
 */
export default class MessageDeletion extends MessageDeletionSchema {
  @belongsTo(() => Message)
  declare message: BelongsTo<typeof Message>

  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>
}
