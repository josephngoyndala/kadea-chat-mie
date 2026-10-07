import { ConversationSchema } from '#database/schema'
import { belongsTo, hasMany } from '@adonisjs/lucid/orm'
import type { BelongsTo, HasMany } from '@adonisjs/lucid/types/relations'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import User from '#models/user'

export default class Conversation extends ConversationSchema {
  @hasMany(() => ConversationMember)
  declare members: HasMany<typeof ConversationMember>

  @hasMany(() => Message)
  declare messages: HasMany<typeof Message>

  @belongsTo(() => User, { foreignKey: 'createdBy' })
  declare creator: BelongsTo<typeof User>

  get isGroup() {
    return this.type === 'group'
  }
}
