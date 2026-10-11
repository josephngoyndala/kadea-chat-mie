import User from '#models/user'

/**
 * Nombre minimal de caractères avant de lancer une recherche.
 */
const MIN_TERM_LENGTH = 2
const MAX_RESULTS = 20

/**
 * Recherche d'utilisateurs avec qui démarrer une conversation.
 */
export default class UserSearchService {
  /**
   * Cherche par nom ou par adresse e-mail. Seuls les comptes dont l'adresse
   * est confirmée sont proposés, et jamais l'utilisateur lui-même.
   */
  async search(viewer: User, rawTerm: string | undefined) {
    const term = (rawTerm ?? '').trim()
    if (term.length < MIN_TERM_LENGTH) {
      return []
    }

    /**
     * Les caractères % et _ ont un sens particulier dans une recherche
     * LIKE : on les neutralise pour qu'ils soient cherchés tels quels.
     */
    const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`

    return User.query()
      .whereNot('id', viewer.id)
      .whereNotNull('email_verified_at')
      .where((group) => {
        group.whereILike('full_name', pattern).orWhereILike('email', pattern)
      })
      .orderBy('full_name')
      .limit(MAX_RESULTS)
  }
}
