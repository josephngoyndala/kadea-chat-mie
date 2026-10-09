import { defineConfig } from '@adonisjs/auth'
import { sessionGuard, sessionUserProvider } from '@adonisjs/auth/session'
import type { InferAuthenticators, InferAuthEvents, Authenticators } from '@adonisjs/auth/types'

/**
 * Authentication configuration.
 * Defines guards and user providers for session-based authentication.
 */
const authConfig = defineConfig({
  /**
   * The default guard to use for authentication.
   * This guard will be used when no specific guard is mentioned.
   */
  default: 'web',

  guards: {
    /**
     * Web guard uses session-based authentication for web requests.
     */
    web: sessionGuard({
      /**
       * "Se souvenir de moi" : l'utilisateur reste connecté même après
       * la fin de sa session, pendant 30 jours.
       */
      useRememberMeTokens: true,
      rememberMeTokensAge: '30 days',

      /**
       * User provider configuration.
       * Defines how to fetch and verify user credentials.
       */
      provider: sessionUserProvider({
        model: () => import('#models/user'),
      }),
    }),
  },
})

export default authConfig

/**
 * Inferring types from the configured auth
 * guards.
 */
declare module '@adonisjs/auth/types' {
  export interface Authenticators extends InferAuthenticators<typeof authConfig> {}
}
declare module '@adonisjs/core/types' {
  interface EventsList extends InferAuthEvents<Authenticators> {}
}
