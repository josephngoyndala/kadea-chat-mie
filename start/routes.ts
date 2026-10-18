/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import transmit from '@adonisjs/transmit/services/main'
import { middleware } from '#start/kernel'
import { messageThrottle, sensitiveThrottle } from '#start/limiter'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

/**
 * Routes du temps réel (connexion, abonnement, désabonnement) : réservées
 * aux utilisateurs connectés.
 */
transmit.registerRoutes((route) => {
  route.middleware(middleware.auth())
})

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store']).use(sensitiveThrottle)

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store']).use(sensitiveThrottle)

    router.get('email/verification', [controllers.EmailVerification, 'notice'])
    router.get('email/verify/:token', [controllers.EmailVerification, 'verify'])
    router
      .post('email/verification/resend', [controllers.EmailVerification, 'resend'])
      .use(sensitiveThrottle)

    router.get('forgot-password', [controllers.PasswordReset, 'create'])
    router.post('forgot-password', [controllers.PasswordReset, 'store']).use(sensitiveThrottle)
    router.get('reset-password/:token', [controllers.PasswordReset, 'edit'])
    router.post('reset-password/:token', [controllers.PasswordReset, 'update'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])
    router.post('presence/ping', [controllers.Session, 'ping'])

    router.get('dashboard', [controllers.Conversations, 'index']).as('dashboard')
    router
      .get('conversations/:id', [controllers.Conversations, 'show'])
      .where('id', router.matchers.number())
    router
      .get('conversations/:id/card', [controllers.Conversations, 'card'])
      .where('id', router.matchers.number())
    router
      .post('conversations/:id/delete', [controllers.Conversations, 'destroy'])
      .where('id', router.matchers.number())
    router
      .post('conversations/:id/read', [controllers.Conversations, 'read'])
      .where('id', router.matchers.number())
    router
      .post('conversations/:id/typing', [controllers.Conversations, 'typing'])
      .where('id', router.matchers.number())
    router
      .get('conversations/:id/search', [controllers.Conversations, 'search'])
      .where('id', router.matchers.number())
    router.post('conversations', [controllers.Conversations, 'store'])

    router.get('groups/new', [controllers.Groups, 'create'])
    router.post('groups', [controllers.Groups, 'store'])

    router
      .get('conversations/:conversationId/members', [controllers.GroupMembers, 'index'])
      .where('conversationId', router.matchers.number())
    router
      .post('conversations/:conversationId/members', [controllers.GroupMembers, 'store'])
      .where('conversationId', router.matchers.number())
    router
      .post('conversations/:conversationId/members/:userId/delete', [
        controllers.GroupMembers,
        'destroy',
      ])
      .where('conversationId', router.matchers.number())
      .where('userId', router.matchers.number())
    router
      .post('conversations/:conversationId/avatar', [controllers.GroupMembers, 'updateAvatar'])
      .where('conversationId', router.matchers.number())
    router
      .post('conversations/:conversationId/avatar/delete', [
        controllers.GroupMembers,
        'destroyAvatar',
      ])
      .where('conversationId', router.matchers.number())

    router
      .get('conversations/:conversationId/messages', [controllers.Messages, 'index'])
      .where('conversationId', router.matchers.number())
    router
      .get('conversations/:conversationId/messages/:messageId', [controllers.Messages, 'show'])
      .where('conversationId', router.matchers.number())
      .where('messageId', router.matchers.number())
    router
      .post('conversations/:conversationId/messages', [controllers.Messages, 'store'])
      .where('conversationId', router.matchers.number())
      .use(messageThrottle)
    router
      .post('conversations/:conversationId/messages/:messageId/edit', [
        controllers.Messages,
        'update',
      ])
      .where('conversationId', router.matchers.number())
      .where('messageId', router.matchers.number())
    router
      .post('conversations/:conversationId/messages/:messageId/delete', [
        controllers.Messages,
        'destroy',
      ])
      .where('conversationId', router.matchers.number())
      .where('messageId', router.matchers.number())

    router.get('messages/search', [controllers.MessageSearch, 'index']).as('messages.search')

    router.get('users', [controllers.Users, 'index'])
    router
      .post('users/:userId/block', [controllers.Blocks, 'store'])
      .where('userId', router.matchers.number())
    router
      .post('users/:userId/unblock', [controllers.Blocks, 'destroy'])
      .where('userId', router.matchers.number())

    router.get('profile', [controllers.Profile, 'show'])
    router.post('profile', [controllers.Profile, 'update'])
    router.post('profile/avatar', [controllers.Profile, 'updateAvatar'])
    router.post('profile/avatar/delete', [controllers.Profile, 'destroyAvatar'])
    router.post('profile/password', [controllers.Profile, 'updatePassword'])
  })
  .use(middleware.auth())
