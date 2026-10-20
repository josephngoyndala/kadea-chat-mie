import { urlFor } from '@adonisjs/core/services/url_builder'
import ConversationPresenter from '#services/conversation_presenter'
import MessageSearchService from '#services/message_search_service'
import { searchMessagesValidator } from '#validators/message_search'
import type { HttpContext } from '@adonisjs/core/http'

/**
 * MessageSearchController recherche un mot dans les messages de toutes les
 * conversations de l'utilisateur connecté (barre de recherche de la liste).
 */
export default class MessageSearchController {
  private search = new MessageSearchService()
  private presenter = new ConversationPresenter()

  /**
   * Résultats en JSON : chaque résultat porte l'adresse de la conversation,
   * qui s'ouvre directement sur le message trouvé.
   */
  async index({ auth, request, response }: HttpContext) {
    const user = auth.getUserOrFail()
    const { q } = await request.validateUsing(searchMessagesValidator)
    const term = q ?? ''

    const hits = await this.search.search(user, term)
    const results = await this.presenter.searchResults(hits, user, term)

    return response.json(
      results.map((result) => ({
        ...result,
        url: urlFor(
          'conversations.show',
          { id: result.conversationId },
          { qs: { message: result.messageId } }
        ),
      }))
    )
  }
}
