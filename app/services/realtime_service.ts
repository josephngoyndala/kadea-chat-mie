import transmit from '@adonisjs/transmit/services/main'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type User from '#models/user'

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
   * Un membre est en train d'écrire dans la conversation.
   */
  userTyping(conversationId: number, user: User) {
    const firstName = user.fullName?.split(' ')[0] ?? user.email.split('@')[0]
    transmit.broadcast(`conversations/${conversationId}`, {
      type: 'user.typing',
      userId: user.id,
      userName: firstName,
    })
  }

  /**
   * Diffuse le changement d'état de présence (en ligne / hors ligne) d'un utilisateur.
   */
  userPresence(userId: number, isOnline: boolean) {
    transmit.broadcast('presence', {
      type: 'user.presence',
      userId,
      isOnline,
    })
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
    this.membersChanged(conversation)
  }

  /**
   * Prévient les membres du groupe, ainsi que des utilisateurs en plus
   * (ajoutés ou retirés), de rafraîchir leur liste. Pour un utilisateur
   * retiré, la carte demandée est introuvable : sa liste la retire.
   */
  membersChanged(conversation: Conversation, extraUserIds: number[] = []) {
    const userIds = new Set([
      ...conversation.members.map((member) => member.userId),
      ...extraUserIds,
    ])

    for (const userId of userIds) {
      transmit.broadcast(`users/${userId}`, {
        type: 'conversation.updated',
        conversationId: conversation.id,
      })
    }
  }
}

