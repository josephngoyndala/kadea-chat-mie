import { createHash, randomBytes } from 'node:crypto'
import { DateTime } from 'luxon'
import AuthToken from '#models/auth_token'
import type User from '#models/user'

export type AuthTokenType = 'email_verification' | 'password_reset'

/**
 * Durée de vie de chaque type de jeton, en heures.
 */
const LIFETIME_IN_HOURS: Record<AuthTokenType, number> = {
  email_verification: 24,
  password_reset: 1,
}

/**
 * Gère les jetons à usage unique envoyés par e-mail (confirmation de
 * l'adresse, réinitialisation du mot de passe).
 *
 * Seule l'empreinte SHA-256 du jeton est enregistrée en base : la valeur
 * en clair n'existe que dans le lien envoyé à l'utilisateur.
 */
export default class AuthTokenService {
  /**
   * Durée de validité d'un type de jeton, pour l'afficher dans les e-mails.
   */
  lifetimeInHours(type: AuthTokenType) {
    return LIFETIME_IN_HOURS[type]
  }

  /**
   * Crée un nouveau jeton pour l'utilisateur et renvoie sa valeur en clair.
   * Les anciens jetons non utilisés du même type sont invalidés, afin qu'un
   * seul lien soit valide à la fois.
   */
  async issue(user: User, type: AuthTokenType) {
    await AuthToken.query()
      .where('user_id', user.id)
      .where('type', type)
      .whereNull('used_at')
      .update({ used_at: new Date() })

    const plainToken = randomBytes(32).toString('hex')

    await AuthToken.create({
      userId: user.id,
      type,
      tokenHash: this.hash(plainToken),
      expiresAt: DateTime.now().plus({ hours: LIFETIME_IN_HOURS[type] }),
    })

    return plainToken
  }

  /**
   * Indique si un jeton de ce type a déjà été créé pour l'utilisateur
   * pendant les dernières secondes (limite les renvois répétés).
   */
  async wasIssuedRecently(user: User, type: AuthTokenType, seconds: number) {
    const since = DateTime.now().minus({ seconds }).toJSDate()

    const recent = await AuthToken.query()
      .where('user_id', user.id)
      .where('type', type)
      .where('created_at', '>', since)
      .first()

    return recent !== null
  }

  /**
   * Vérifie un jeton reçu dans un lien et le marque comme utilisé.
   * Renvoie l'enregistrement du jeton, ou null s'il est inconnu, déjà utilisé
   * ou expiré.
   */
  async consume(plainToken: string, type: AuthTokenType) {
    const token = await AuthToken.query()
      .where('token_hash', this.hash(plainToken))
      .where('type', type)
      .first()

    if (!token || token.isUsed || token.isExpired) {
      return null
    }

    token.usedAt = DateTime.now()
    await token.save()

    return token
  }

  private hash(plainToken: string) {
    return createHash('sha256').update(plainToken).digest('hex')
  }
}
