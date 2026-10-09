import { UserSchema } from '#database/schema'
import hash from '@adonisjs/core/services/hash'
import { compose } from '@adonisjs/core/helpers'
import { withAuthFinder } from '@adonisjs/auth/mixins/lucid'
import { DbRememberMeTokensProvider } from '@adonisjs/auth/session'
import { hasMany } from '@adonisjs/lucid/orm'
import type { HasMany } from '@adonisjs/lucid/types/relations'
import AuthToken from '#models/auth_token'
import ConversationMember from '#models/conversation_member'
import Message from '#models/message'
import UserBlock from '#models/user_block'

/**
 * User model represents a user in the application.
 * It extends UserSchema and includes authentication capabilities
 * through the withAuthFinder mixin.
 */
export default class User extends compose(UserSchema, withAuthFinder(hash)) {
  /**
   * Fournisseur des jetons « se souvenir de moi » (table remember_me_tokens).
   */
  static rememberMeTokens = DbRememberMeTokensProvider.forModel(User)

  @hasMany(() => ConversationMember)
  declare memberships: HasMany<typeof ConversationMember>

  @hasMany(() => Message, { foreignKey: 'senderId' })
  declare messages: HasMany<typeof Message>

  @hasMany(() => UserBlock, { foreignKey: 'blockerId' })
  declare blocks: HasMany<typeof UserBlock>

  @hasMany(() => AuthToken)
  declare authTokens: HasMany<typeof AuthToken>

  /**
   * Indique si l'utilisateur a confirmé son adresse e-mail.
   */
  get isEmailVerified() {
    return this.emailVerifiedAt !== null
  }

  /**
   * Get the user's initials from their full name or email.
   * Returns the first letter of first and last name if available,
   * otherwise returns the first two characters of the email username.
   */
  get initials() {
    const [first, last] = this.fullName ? this.fullName.split(' ') : this.email.split('@')
    if (first && last) {
      return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase()
    }
    return `${first.slice(0, 2)}`.toUpperCase()
  }
}
