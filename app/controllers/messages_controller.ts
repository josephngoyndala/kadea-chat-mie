import type Message from '#models/message'
import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import MessageService, { MessageNotEditableError } from '#services/message_service'
import RealtimeService from '#services/realtime_service'
import { catchUpValidator, deleteMessageValidator, sendMessageValidator } from '#validators/message'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * MessagesController gère les messages d'une conversation : lecture,
 * envoi, modification et suppression. Ces actions répondent par un morceau
 * de HTML (la bulle) quand elles sont appelées par le JavaScript de la page,
 * et par une redirection quand le formulaire est envoyé sans JavaScript.
 * Chaque changement est annoncé en temps réel aux participants.
 */
export default class MessagesController {
  private conversations = new ConversationService()
  private messages = new MessageService()
  private presenter = new ConversationPresenter()
  private realtime = new RealtimeService()

  /**
   * Messages envoyés après un identifiant donné (rattrapage après une
   * coupure de connexion), sous forme de HTML
   */
  async index({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))
    const { after } = await request.validateUsing(catchUpValidator)

    const items = await this.messages.listAfter(user, conversation.id, after ?? 0)
    const showAuthor = this.presenter.showsAuthors(conversation)

    const parts = await Promise.all(
      items.map(({ message, startsNewDay }) =>
        view.render('fragments/message', {
          conversationId: conversation.id,
          ...this.presenter.fragment(message, user, startsNewDay, showAuthor),
        })
      )
    )

    return response.type('html').send(parts.join(''))
  }

  /**
   * Une bulle de message pour l'utilisateur connecté, appelée quand un
   * événement temps réel annonce un message nouveau ou modifié. Avec
   * ?bare=1, sans séparateur de jour (pour remplacer une bulle existante).
   */
  async show({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))

    const message = await this.messages.findVisible(user, conversation.id, Number(params.messageId))
    const startsNewDay =
      request.input('bare') === '1' ? false : await this.messages.startsNewDay(message)

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(
        message,
        user,
        startsNewDay,
        this.presenter.showsAuthors(conversation)
      ),
    })

    return response.type('html').send(html)
  }

  /**
   * Envoie un message dans une conversation dont l'utilisateur est membre
   */
  async store({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))
    const { body } = await request.validateUsing(sendMessageValidator)

    const { message, startsNewDay } = await this.messages.send(user, conversation, body)
    this.realtime.messageCreated(conversation, message)

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(
        message,
        user,
        startsNewDay,
        this.presenter.showsAuthors(conversation)
      ),
    })

    return response.status(201).type('html').send(html)
  }

  /**
   * Modifie un message de l'utilisateur et renvoie la bulle mise à jour
   */
  async update({ auth, params, request, response, session, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))
    const { body } = await request.validateUsing(sendMessageValidator)

    let message: Message
    try {
      message = await this.messages.edit(user, conversation.id, Number(params.messageId), body)
    } catch (error) {
      if (error instanceof MessageNotEditableError) {
        if (this.wantsFragment(request)) {
          return response.status(422).json({ errors: [{ message: error.message }] })
        }

        session.flash('error', error.message)
        return response.redirect().toRoute('conversations.show', { id: conversation.id })
      }
      throw error
    }

    this.realtime.messageUpdated(conversation, message)

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(message, user, false, this.presenter.showsAuthors(conversation)),
    })

    return response.type('html').send(html)
  }

  /**
   * Supprime un message : pour l'utilisateur seul (« me ») ou pour tous
   * (« everyone », réservé à l'auteur)
   */
  async destroy({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))
    const { scope } = await request.validateUsing(deleteMessageValidator)
    const messageId = Number(params.messageId)

    if (scope === 'me') {
      await this.messages.hideForUser(user, conversation.id, messageId)

      if (!this.wantsFragment(request)) {
        return response.redirect().toRoute('conversations.show', { id: conversation.id })
      }
      return response.noContent()
    }

    const message = await this.messages.deleteForEveryone(user, conversation.id, messageId)
    this.realtime.messageUpdated(conversation, message)

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(message, user, false, this.presenter.showsAuthors(conversation)),
    })

    return response.type('html').send(html)
  }

  /**
   * Le JavaScript de la page signale ses appels avec cet en-tête.
   */
  private wantsFragment(request: HttpContext['request']) {
    return request.header('x-chat-fetch') === '1'
  }
}
