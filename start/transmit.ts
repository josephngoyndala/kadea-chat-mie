import transmit from '@adonisjs/transmit/services/main'
import ConversationService from '#services/conversation_service'

const conversations = new ConversationService()

/**
 * Canal d'une conversation : seuls ses membres peuvent s'y abonner.
 */
transmit.authorize<{ conversationId: string }>(
  'conversations/:conversationId',
  async (ctx, { conversationId }) => {
    const user = ctx.auth.user
    if (!user) {
      return false
    }

    return conversations.isMember(user.id, Number(conversationId))
  }
)

/**
 * Canal personnel : chacun ne peut s'abonner qu'au sien.
 */
transmit.authorize<{ id: string }>('users/:id', (ctx, { id }) => {
  return ctx.auth.user?.id === Number(id)
})
