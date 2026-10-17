import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import RealtimeService from '#services/realtime_service'
import { startConversationValidator } from '#validators/conversation'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * ConversationsController gère les conversations de l'utilisateur connecté :
 * liste, ouverture d'une conversation et démarrage d'une conversation privée.
 */
export default class ConversationsController {
  private conversations = new ConversationService()
  private presenter = new ConversationPresenter()
  private realtime = new RealtimeService()

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
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    await this.conversations.markAsRead(conversation.id, user.id)

    const [items, messages] = await Promise.all([
      this.conversations.listFor(user),
      this.conversations.history(conversation, user),
    ])

    return view.render('pages/conversations/show', {
      activeId: conversation.id,
      conversations: await this.presenter.cards(items, user),
      header: await this.presenter.header(conversation, user),
      groups: this.presenter.groupMessages(
        messages,
        user,
        this.presenter.showsAuthors(conversation)
      ),
    })
  }

  /**
   * Renvoie la carte d'une conversation (morceau de HTML) pour rafraîchir la
   * liste en temps réel. Si l'utilisateur n'est plus membre, la réponse est
   * « introuvable » et sa liste retire la carte.
   */
  async card({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    const isActive = conversation.id === Number(request.input('active'))

    if (isActive) {
      await this.conversations.markAsRead(conversation.id, user.id)
    }

    const lastMessage = await this.conversations.lastMessageOf(conversation, user)
    const unreadMap = await this.conversations.unreadCountsFor([conversation.id], user)
    const unreadCount = isActive ? 0 : (unreadMap.get(conversation.id) ?? 0)

    const [item] = await this.presenter.cards(
      [{ conversation, lastMessage, unreadCount }],
      user
    )

    return view.render('fragments/conversation_card', {
      item,
      active: isActive,
    })
  }

  /**
   * Marque la conversation comme lue par l'utilisateur connecté
   */
  async read({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    await this.conversations.markAsRead(conversation.id, user.id)

    return response.noContent()
  }

  /**
   * Diffuse le signal « en train d'écrire » aux autres membres de la conversation
   */
  async typing({ auth, params, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const isMember = await this.conversations.isMember(user.id, conversationId)
    if (!isMember) {
      return response.forbidden()
    }

    this.realtime.userTyping(conversationId, user)

    return response.noContent()
  }

  /**
   * Recherche des messages dans une conversation
   */
  async search({ auth, params, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    const term = String(request.input('q', '')).trim()

    const results = await this.conversations.search(conversation, user, term)

    return response.json(
      results.map((msg) => ({
        id: msg.id,
        body: msg.body,
        time: msg.createdAt.toFormat('HH:mm'),
        senderName: msg.sender?.fullName ?? msg.sender?.email,
      }))
    )
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

  /**
   * Quitte une conversation : elle disparaît de la liste de l'utilisateur.
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.leave(user, conversationId)
    this.realtime.membersChanged(
      conversation,
      conversation.members.map((member) => member.userId)
    )

    session.flash('success', 'La discussion a été supprimée de votre liste.')
    return response.redirect().toRoute('dashboard')
  }
}
