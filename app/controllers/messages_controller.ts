import ConversationPresenter from '#services/conversation_presenter'
import ConversationService from '#services/conversation_service'
import MessageService from '#services/message_service'
import { sendMessageValidator } from '#validators/message'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * MessagesController gère l'envoi et la suppression des messages d'une
 * conversation. Ces actions répondent par un morceau de HTML (la bulle) quand
 * elles sont appelées par le JavaScript de la page, et par une redirection
 * quand le formulaire est envoyé sans JavaScript.
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
   * Supprime un message de l'utilisateur et renvoie la bulle mise à jour
   */
  async destroy({ auth, params, request, response, view }: HttpContext) {
    const user = auth.getUserOrFail()
    const conversation = await this.conversations.findForMember(user, Number(params.conversationId))

    const message = await this.messages.deleteOwn(user, conversation.id, Number(params.messageId))

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
