import type User from '#models/user'
import AvatarService from '#services/avatar_service'
import { formatShortDate } from '#services/date_formatter'

export type DirectoryEntry = {
  id: number
  name: string
  maskedEmail: string
  initials: string
  avatarUrl: string | null
  joinedOn: string
}

/**
 * Prépare l'affichage des utilisateurs dans l'annuaire.
 */
export default class UserPresenter {
  private avatars = new AvatarService()

  async directory(users: User[]): Promise<DirectoryEntry[]> {
    return Promise.all(
      users.map(async (user) => ({
        id: user.id,
        name: user.fullName ?? this.maskEmail(user.email),
        maskedEmail: this.maskEmail(user.email),
        initials: user.initials,
        avatarUrl: await this.avatars.urlFor(user),
        joinedOn: formatShortDate(user.createdAt),
      }))
    )
  }

  /**
   * « joel.mukendi@exemple.com » devient « jo***@exemple.com » : assez pour
   * distinguer deux homonymes, sans exposer l'adresse complète.
   */
  maskEmail(email: string) {
    const [localPart, domain] = email.split('@')
    if (!domain) {
      return '***'
    }

    const visible = localPart.length > 2 ? localPart.slice(0, 2) : localPart.slice(0, 1)
    return `${visible}***@${domain}`
  }
}
