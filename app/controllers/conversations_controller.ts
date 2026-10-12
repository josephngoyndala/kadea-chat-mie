import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import { startConversationValidator } from '#validators/conversation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * ConversationsController gère les conversations de l'utilisateur connecté :
 * liste, ouverture d'une conversation et démarrage d'une conversation privée.
 */
export default class ConversationsController {
  private conversations = new ConversationService()
  private presenter = new ConversationPresenter()

  /**
   * Liste des conversations (page d'accueil de l'utilisateur connecté)
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    const items = await this.conversations.listFor(user)

    return view.render('pages/conversations/index', {
      conversations: await this.presenter.cards(items, user),
    })
  }

  /**
   * Ouvre une conversation et affiche son historique. Répond « introuvable »
   * si l'utilisateur n'en est pas membre.
   */
  async show({ auth, params, view }: HttpContext) {
    const user = auth.getUserOrFail()

    const conversation = await this.conversations.findForMember(user, Number(params.id))
    const [items, messages] = await Promise.all([
      this.conversations.listFor(user),
      this.conversations.history(conversation),
    ])

    return view.render('pages/conversations/show', {
      activeId: conversation.id,
      conversations: await this.presenter.cards(items, user),
      header: await this.presenter.header(conversation, user),
      groups: this.presenter.groupMessages(messages, user),
    })
  }

  /**
   * Démarre une conversation privée (ou ouvre celle qui existe déjà)
   */
  async store({ auth, request, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const { userId } = await request.validateUsing(startConversationValidator)

    if (userId === user.id) {
      session.flash('error', 'Vous ne pouvez pas démarrer une discussion avec vous-même.')
      return response.redirect().toRoute('users.index')
    }

    const conversation = await this.conversations.startPrivate(user, userId)

    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }
}
