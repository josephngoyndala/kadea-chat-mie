import { UserBlockSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import User from '#models/user'

export default class UserBlock extends UserBlockSchema {
  @belongsTo(() => User, { foreignKey: 'blockerId' })
  declare blocker: BelongsTo<typeof User>

  @belongsTo(() => User, { foreignKey: 'blockedId' })
  declare blocked: BelongsTo<typeof User>
}
