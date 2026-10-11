/*
|--------------------------------------------------------------------------
| Routes file
|--------------------------------------------------------------------------
|
| The routes file is used for defining the HTTP routes.
|
*/

import { middleware } from '#start/kernel'
import { controllers } from '#generated/controllers'
import router from '@adonisjs/core/services/router'

router.on('/').render('pages/home').as('home')

router
  .group(() => {
    router.get('signup', [controllers.NewAccount, 'create'])
    router.post('signup', [controllers.NewAccount, 'store'])

    router.get('login', [controllers.Session, 'create'])
    router.post('login', [controllers.Session, 'store'])

    router.get('email/verification', [controllers.EmailVerification, 'notice'])
    router.get('email/verify/:token', [controllers.EmailVerification, 'verify'])
    router.post('email/verification/resend', [controllers.EmailVerification, 'resend'])

    router.get('forgot-password', [controllers.PasswordReset, 'create'])
    router.post('forgot-password', [controllers.PasswordReset, 'store'])
    router.get('reset-password/:token', [controllers.PasswordReset, 'edit'])
    router.post('reset-password/:token', [controllers.PasswordReset, 'update'])
  })
  .use(middleware.guest())

router
  .group(() => {
    router.post('logout', [controllers.Session, 'destroy'])

    router.get('dashboard', [controllers.Conversations, 'index']).as('dashboard')
    router
      .get('conversations/:id', [controllers.Conversations, 'show'])
      .where('id', router.matchers.number())
    router.post('conversations', [controllers.Conversations, 'store'])

    router.get('users', [controllers.Users, 'index'])

    router.get('profile', [controllers.Profile, 'show'])
    router.post('profile', [controllers.Profile, 'update'])
    router.post('profile/avatar', [controllers.Profile, 'updateAvatar'])
    router.post('profile/avatar/delete', [controllers.Profile, 'destroyAvatar'])
    router.post('profile/password', [controllers.Profile, 'updatePassword'])
  })
  .use(middleware.auth())
