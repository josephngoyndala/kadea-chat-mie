import { AuthTokenSchema } from '#database/schema'
import { belongsTo } from '@adonisjs/lucid/orm'
import type { BelongsTo } from '@adonisjs/lucid/types/relations'
import { DateTime } from 'luxon'
import User from '#models/user'

export default class AuthToken extends AuthTokenSchema {
  @belongsTo(() => User)
  declare user: BelongsTo<typeof User>

  get isExpired() {
    return this.expiresAt < DateTime.now()
  }

  get isUsed() {
    return this.usedAt !== null
  }
}
