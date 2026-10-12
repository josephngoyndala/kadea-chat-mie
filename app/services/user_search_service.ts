import User from '#models/user'

const PAGE_SIZE = 20
const MAX_WORDS = 5

/**
 * Retire les accents côté base de données sans extension : la fonction
 * standard translate remplace chaque lettre accentuée par son équivalent.
 * Ces constantes sont fixes (aucune saisie d'utilisateur n'y entre).
 */
const ACCENTED = 'àâäáãåçéèêëíìîïñóòôöõúùûüýÿœæ'
const UNACCENTED = 'aaaaaaceeeeiiiinooooouuuuyyoa'
const NORMALIZED_NAME = `translate(lower(coalesce(full_name, '')), '${ACCENTED}', '${UNACCENTED}')`
const NORMALIZED_EMAIL = 'lower(email)'

/**
 * Annuaire et recherche des utilisateurs avec qui démarrer une conversation.
 */
export default class UserSearchService {
  /**
   * Sans terme : tous les membres, les plus récents d'abord. Avec un terme :
   * ceux dont le nom ou l'e-mail contient chacun des mots saisis, sans tenir
   * compte des accents ni des majuscules. Seuls les comptes dont l'adresse est
   * confirmée sont proposés, et jamais l'utilisateur lui-même.
   */
  async find(viewer: User, rawTerm: string | undefined, page: number) {
    const query = User.query().whereNot('id', viewer.id).whereNotNull('email_verified_at')

    const words = this.wordsOf(rawTerm)

    if (words.length === 0) {
      query.orderBy('created_at', 'desc').orderBy('id', 'desc')
    } else {
      query.where((allWords) => {
        for (const word of words) {
          /**
           * Les caractères % et _ ont un sens particulier dans une recherche
           * LIKE : on les neutralise pour qu'ils soient cherchés tels quels.
           */
          const pattern = `%${word.replace(/[\\%_]/g, '\\$&')}%`

          allWords.where((oneWord) => {
            oneWord
              .whereRaw(`${NORMALIZED_NAME} LIKE ?`, [pattern])
              .orWhereRaw(`${NORMALIZED_EMAIL} LIKE ?`, [pattern])
          })
        }
      })
      query.orderBy('full_name')
    }

    return query.paginate(page, PAGE_SIZE)
  }

  /**
   * Mots du terme saisi, en minuscules et sans accents.
   */
  private wordsOf(rawTerm: string | undefined) {
    return (rawTerm ?? '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, MAX_WORDS)
  }
}
