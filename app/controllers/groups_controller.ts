import GroupService, { GroupRuleError } from '#services/group_service'
import RealtimeService from '#services/realtime_service'
import UserPresenter from '#services/user_presenter'
import UserSearchService from '#services/user_search_service'
import { createGroupValidator } from '#validators/group'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * GroupsController gère la création d'un groupe de discussion.
 */
export default class GroupsController {
  private groups = new GroupService()
  private search = new UserSearchService()
  private users = new UserPresenter()
  private realtime = new RealtimeService()

  /**
   * Page « Nouveau groupe » : nom et sélection des membres
   */
  async create({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const people = await this.search.listForPicker(user)

    return view.render('pages/groups/create', {
      members: await this.users.directory(people),
    })
  }

  /**
   * Crée le groupe, dont l'utilisateur devient l'administrateur
   */
  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { name, memberIds } = await request.validateUsing(createGroupValidator)

    try {
      const conversation = await this.groups.create(user, name, memberIds)

      await conversation.load('members')
      this.realtime.conversationUpdated(conversation)

      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    } catch (error) {
      if (error instanceof GroupRuleError) {
        session.flashOnly(['name'])
        session.flash('error', error.message)
        return response.redirect().back()
      }
      throw error
    }
  }
}
