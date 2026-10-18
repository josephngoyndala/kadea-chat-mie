import transmit from '@adonisjs/transmit/services/main'
import type Conversation from '#models/conversation'
import type Message from '#models/message'
import type User from '#models/user'

/**
 * Nombre maximum de messages rafraîchis d'un coup quand un statut change
 * (reçu / lu). Les plus anciens sont ignorés : ils ne sont plus à l'écran.
 */
const STATUS_REFRESH_LIMIT = 30

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
   * Le statut de messages a changé (reçu ou lu par un destinataire). On
   * réutilise l'événement « message.updated » : le navigateur recharge alors
   * la bulle, qui affiche les nouveaux traits. La liste des conversations
   * n'a pas besoin d'être rafraîchie.
   */
  statusChanged(conversationId: number, messageIds: number[]) {
    for (const messageId of messageIds.slice(-STATUS_REFRESH_LIMIT)) {
      transmit.broadcast(`conversations/${conversationId}`, {
        type: 'message.updated',
        messageId,
      })
    }
  }

  /**
   * Prévient chaque membre que la carte de cette conversation, dans sa liste,
   * doit être rafraîchie (aperçu, heure, position).
   */
  conversationUpdated(conversation: Conversation) {
    this.membersChanged(conversation)
  }

  /**
   * Rafraîchit la carte de la conversation chez un seul utilisateur : sert
   * pour un message envoyé à quelqu'un qui a bloqué l'auteur. Le destinataire
   * n'est pas prévenu.
   */
  conversationUpdatedForUser(conversationId: number, userId: number) {
    transmit.broadcast(`users/${userId}`, {
      type: 'conversation.updated',
      conversationId,
    })
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
