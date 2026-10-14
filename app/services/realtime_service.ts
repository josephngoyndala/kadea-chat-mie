import transmit from '@adonisjs/transmit/services/main'
import type Conversation from '#models/conversation'
import type Message from '#models/message'

/**
 * Annonce en temps réel ce qui se passe dans les conversations. Les
 * événements ne contiennent que des identifiants : chaque navigateur
 * demande ensuite au serveur ce qu'il a le droit de voir.
 *
 * La conversation doit avoir ses membres chargés.
 */
export default class RealtimeService {
  /**
   * Un nouveau message a été envoyé.
   */
  messageCreated(conversation: Conversation, message: Message) {
    transmit.broadcast(`conversations/${conversation.id}`, {
      type: 'message.created',
      messageId: message.id,
    })

    this.conversationUpdated(conversation)
  }

  /**
   * Un message a été modifié ou supprimé pour tous.
   */
  messageUpdated(conversation: Conversation, message: Message) {
    transmit.broadcast(`conversations/${conversation.id}`, {
      type: 'message.updated',
      messageId: message.id,
    })

    this.conversationUpdated(conversation)
  }

  /**
   * Prévient chaque membre que la carte de cette conversation, dans sa liste,
   * doit être rafraîchie (aperçu, heure, position).
   */
  conversationUpdated(conversation: Conversation) {
    for (const member of conversation.members) {
      transmit.broadcast(`users/${member.userId}`, {
        type: 'conversation.updated',
        conversationId: conversation.id,
      })
    }
  }
}
