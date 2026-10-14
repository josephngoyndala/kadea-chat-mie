import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import GroupService, { GroupRuleError } from '#services/group_service'
import RealtimeService from '#services/realtime_service'
import UserPresenter, { type DirectoryEntry } from '#services/user_presenter'
import UserSearchService from '#services/user_search_service'
import { addMemberValidator } from '#validators/group'
import { searchUsersValidator } from '#validators/conversation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * GroupMembersController gère les membres d'un groupe : affichage de la
 * liste, ajout et retrait (réservés aux administrateurs).
 */
export default class GroupMembersController {
  private conversations = new ConversationService()
  private groups = new GroupService()
  private presenter = new ConversationPresenter()
  private search = new UserSearchService()
  private users = new UserPresenter()
  private realtime = new RealtimeService()

  /**
   * Liste des membres, et recherche de personnes à ajouter pour un
   * administrateur
   */
  async index({ auth, params, request, view }: HttpContext) {
    const viewer = auth.getUserOrFail()
    const conversation = await this.conversations.findGroupForMember(
      viewer,
      Number(params.conversationId)
    )
    const { q } = await request.validateUsing(searchUsersValidator)
    const term = q ?? ''

    const isAdmin = this.groups.isAdmin(viewer, conversation)

    let candidates: DirectoryEntry[] = []
    if (isAdmin) {
      const memberIds = conversation.members.map((member) => member.userId)
      const paginator = await this.search.find(viewer, term, 1, memberIds)
      candidates = await this.users.directory(paginator.all())
    }

    return view.render('pages/groups/members', {
      conversationId: conversation.id,
      header: await this.presenter.header(conversation, viewer),
      members: await this.presenter.members(conversation, viewer),
      isAdmin,
      candidates,
      term,
    })
  }

  /**
   * Ajoute un membre au groupe
   */
  async store({ auth, params, request, response, session }: HttpContext) {
    const admin = auth.getUserOrFail()
    const conversation = await this.conversations.findGroupForMember(
      admin,
      Number(params.conversationId)
    )
    const { userId } = await request.validateUsing(addMemberValidator)

    try {
      const added = await this.groups.addMember(admin, conversation, userId)
      this.realtime.membersChanged(conversation, [added.id])

      session.flash('success', `${added.fullName ?? added.email} a été ajouté au groupe.`)
    } catch (error) {
      if (!(error instanceof GroupRuleError)) {
        throw error
      }
      session.flash('error', error.message)
    }

    return response.redirect().toRoute('group_members.index', { conversationId: conversation.id })
  }

  /**
   * Retire un membre du groupe
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const admin = auth.getUserOrFail()
    const conversation = await this.conversations.findGroupForMember(
      admin,
      Number(params.conversationId)
    )
    const userId = Number(params.userId)

    try {
      await this.groups.removeMember(admin, conversation, userId)
      this.realtime.membersChanged(conversation, [userId])

      session.flash('success', 'Le membre a été retiré du groupe.')
    } catch (error) {
      if (!(error instanceof GroupRuleError)) {
        throw error
      }
      session.flash('error', error.message)
    }

    return response.redirect().toRoute('group_members.index', { conversationId: conversation.id })
  }
}
