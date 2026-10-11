import AvatarService from '#services/avatar_service'
import UserSearchService from '#services/user_search_service'
import { searchUsersValidator } from '#validators/conversation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * UsersController gère la recherche d'autres utilisateurs, pour démarrer
 * une conversation.
 */
export default class UsersController {
  private search = new UserSearchService()
  private avatars = new AvatarService()

  /**
   * Page « Nouvelle discussion » avec le résultat de la recherche
   */
  async index({ auth, request, view }: HttpContext) {
    const viewer = auth.getUserOrFail()
    const { q } = await request.validateUsing(searchUsersValidator)

    const users = await this.search.search(viewer, q)

    const results = await Promise.all(
      users.map(async (user) => ({
        id: user.id,
        name: user.fullName ?? user.email,
        email: user.email,
        initials: user.initials,
        avatarUrl: await this.avatars.urlFor(user),
      }))
    )

    return view.render('pages/users/index', {
      term: q ?? '',
      searched: (q ?? '').length > 0,
      results,
    })
  }
}
