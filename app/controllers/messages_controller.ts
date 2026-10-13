import type Message from '#models/message'
import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import MessageService, { MessageNotEditableError } from '#services/message_service'
import { deleteMessageValidator, sendMessageValidator } from '#validators/message'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * MessagesController gère l'envoi, la modification et la suppression des
 * messages d'une conversation. Ces actions répondent par un morceau de HTML
 * (la bulle) quand elles sont appelées par le JavaScript de la page, et par
 * une redirection quand le formulaire est envoyé sans JavaScript.
 */
export default class MessagesController {
  private conversations = new ConversationService()
  private messages = new MessageService()
  private presenter = new ConversationPresenter()

  /**
   * Envoie un message dans une conversation dont l'utilisateur est membre
   */
  async store({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))
    const { body } = await request.validateUsing(sendMessageValidator)

    const { message, startsNewDay } = await this.messages.send(user, conversation, body)

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(message, user, startsNewDay),
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

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(message, user, false),
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

    if (!this.wantsFragment(request)) {
      return response.redirect().toRoute('conversations.show', { id: conversation.id })
    }

    const html = await view.render('fragments/message', {
      conversationId: conversation.id,
      ...this.presenter.fragment(message, user, false),
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
