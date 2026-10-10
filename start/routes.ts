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
    router.on('/dashboard').render('pages/dashboard').as('dashboard')
    router.post('logout', [controllers.Session, 'destroy'])
  })
  .use(middleware.auth())
