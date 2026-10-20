import { urlFor } from '@adonisjs/core/services/url_builder'
import UserPresenter from '#services/user_presenter'
import UserSearchService from '#services/user_search_service'
import { searchUsersValidator } from '#validators/conversation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * UsersController gère l'annuaire des membres et la recherche, pour
 * démarrer une conversation.
 */
export default class UsersController {
  private search = new UserSearchService()
  private presenter = new UserPresenter()

  /**
   * Page « Nouvelle discussion » : annuaire des membres, filtré par la
   * recherche
   */
  async index({ auth, request, view }: HttpContext) {
    const viewer = auth.getUserOrFail()
    const { q, page } = await request.validateUsing(searchUsersValidator)
    const term = q ?? ''

    const paginator = await this.search.find(viewer, term, page ?? 1)

    return view.render('pages/users/index', {
      term,
      searched: term.length > 0,
      members: await this.presenter.directory(paginator.all(), viewer),
      total: paginator.total,
      previousUrl: paginator.currentPage > 1 ? this.pageUrl(term, paginator.currentPage - 1) : null,
      nextUrl: paginator.hasMorePages ? this.pageUrl(term, paginator.currentPage + 1) : null,
    })
  }

  /**
   * Adresse d'une page de l'annuaire, en conservant la recherche en cours.
   */
  private pageUrl(term: string, page: number) {
    const qs: Record<string, string | number> = { page }
    if (term) {
      qs.q = term
    }

    return urlFor('users.index', {}, { qs })
  }
}
