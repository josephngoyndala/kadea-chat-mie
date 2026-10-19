import type User from '#models/user'
import BlockService from '#services/block_service'
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
  private blocks = new BlockService()
  private conversations = new ConversationService()
  private presenter = new ConversationPresenter()
  private realtime = new RealtimeService()

  /**
   * Liste des conversations (page d'accueil de l'utilisateur connecté)
   */
  async index({ auth, view }: HttpContext) {
    const user = auth.getUserOrFail()

    await this.deliverPending(user)

    const items = await this.conversations.listFor(user)

    return view.render('pages/conversations/index', {
      conversations: await this.presenter.cards(items, user),
    })
  }

  /**
   * Ouvre une conversation et affiche son historique. Répond « introuvable »
   * si l'utilisateur n'en est pas membre.
   */
  async show({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)

    /**
     * Ouvrir la conversation : ses messages sont lus (traits bleus chez
     * leurs auteurs). Les messages en attente dans les autres conversations
     * sont, eux, marqués comme reçus.
     */
    const readIds = await this.conversations.markAsRead(conversation.id, user.id)
    this.realtime.statusChanged(conversation.id, readIds)
    this.refreshOwnLists(conversation.id, user, readIds)
    await this.deliverPending(user)

    /**
     * Venant d'un résultat de recherche (?message=12), l'historique est centré
     * sur le message trouvé ; la page défile jusqu'à lui et le met en évidence.
     */
    const requested = Number.parseInt(String(request.qs().message ?? ''), 10)
    const around =
      Number.isInteger(requested) && requested > 0
        ? await this.conversations.historyAround(conversation, user, requested)
        : null

    const [items, messages] = await Promise.all([
      this.conversations.listFor(user),
      around ?? this.conversations.history(conversation, user),
    ])

    const header = await this.presenter.header(conversation, user)

    /**
     * Dans une conversation privée, qui a bloqué qui : la page remplace la
     * zone de saisie par une bannière et propose « Bloquer » ou « Débloquer ».
     */
    const blocks = header.otherUserId
      ? await this.blocks.stateBetween(user.id, header.otherUserId)
      : { byMe: false, byThem: false }

    return view.render('pages/conversations/show', {
      activeId: conversation.id,
      focusId: around ? requested : null,
      conversations: await this.presenter.cards(items, user),
      header,
      blocks,
      groups: this.presenter.groupMessages(
        messages,
        user,
        this.presenter.showsAuthors(conversation),
        conversation.members
      ),
    })
  }

  /**
   * Renvoie la carte d'une conversation (morceau de HTML) pour rafraîchir la
   * liste en temps réel. Si l'utilisateur n'est plus membre, la réponse est
   * « introuvable » et sa liste retire la carte.
   *
   * Si cette requête arrive, c'est que le navigateur du membre est connecté :
   * les nouveaux messages lui sont donc bien arrivés (« reçus »), et « lus »
   * s'il regarde justement cette conversation.
   */
  async card({ auth, params, request, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    const isActive = conversation.id === Number(request.input('active'))

    const changedIds = isActive
      ? await this.conversations.markAsRead(conversation.id, user.id)
      : await this.conversations.markAsDelivered(conversation.id, user.id)
    this.realtime.statusChanged(conversation.id, changedIds)

    const lastMessage = await this.conversations.lastMessageOf(conversation, user)
    const unreadMap = await this.conversations.unreadCountsFor([conversation.id], user)
    const unreadCount = isActive ? 0 : (unreadMap.get(conversation.id) ?? 0)

    const [item] = await this.presenter.cards([{ conversation, lastMessage, unreadCount }], user)

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
    const readIds = await this.conversations.markAsRead(conversation.id, user.id)
    this.realtime.statusChanged(conversation.id, readIds)
    this.refreshOwnLists(conversation.id, user, readIds)

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

    /**
     * Entre deux utilisateurs dont l'un a bloqué l'autre, le signal n'est pas
     * diffusé : celui qui a bloqué ne voit pas l'autre écrire, et rien ne
     * signale à l'autre qu'il est bloqué (la réponse reste la même).
     */
    const conversation = await this.conversations.findForMember(user, conversationId)
    const isBlocked = await this.blocks.isBlockedInConversation(user, conversation)
    if (!isBlocked) {
      this.realtime.userTyping(conversationId, user)
    }

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

    /**
     * Même bloqué, l'utilisateur peut ouvrir la discussion, sans erreur ni
     * indication : ses messages ne seront simplement jamais remis. Celui qui a
     * bloqué voit, lui, la bannière « Vous avez bloqué… » dans la discussion.
     */
    const conversation = await this.conversations.startPrivate(user, userId)

    return response.redirect().toRoute('conversations.show', { id: conversation.id })
  }

  /**
   * Quitte une conversation : elle disparaît de la liste de l'utilisateur.
   */
  async destroy({ auth, params, response, session }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversationId = Number(params.id)

    const conversation = await this.conversations.findForMember(user, conversationId)
    const notifyUserIds = conversation.members.map((member) => member.userId)

    await this.conversations.leave(user, conversationId)
    this.realtime.membersChanged(conversation, notifyUserIds)

    session.flash('success', 'La discussion a été supprimée de votre liste.')
    return response.redirect().toRoute('dashboard')
  }

  /**
   * Quand l'utilisateur lit des messages, ses autres écrans ouverts (autre
   * onglet, téléphone) rafraîchissent la carte de la conversation : le compteur
   * de messages non lus disparaît partout.
   */
  private refreshOwnLists(conversationId: number, user: User, readIds: number[]) {
    if (readIds.length > 0) {
      this.realtime.conversationUpdatedForUser(conversationId, user.id)
    }
  }

  /**
   * L'utilisateur est connecté : les messages qui l'attendaient dans toutes
   * ses conversations passent à « reçus », et leurs auteurs en sont prévenus.
   */
  private async deliverPending(user: User) {
    const changes = await this.conversations.markAllAsDelivered(user.id)

    for (const [conversationId, messageIds] of changes) {
      this.realtime.statusChanged(conversationId, messageIds)
    }
  }
}
