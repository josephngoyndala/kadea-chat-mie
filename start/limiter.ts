import limiter from '@adonisjs/limiter/services/main'

/**
 * Limite générale par adresse IP : 120 requêtes par minute.
 */
export const throttle = limiter.define('global', () => {
  return limiter.allowRequests(120).every('1 minute')
})

/**
 * Formulaires sensibles (inscription, mot de passe oublié, renvoi d'e-mail) :
 * 6 demandes par minute et par adresse IP. Au-delà, blocage de 5 minutes.
 */
export const sensitiveThrottle = limiter.define('sensitive', (ctx) => {
  return limiter
    .allowRequests(6)
    .every('1 minute')
    .blockFor('5 mins')
    .usingKey(`sensitive_${ctx.request.ip()}`)
})

/**
 * Envoi de messages : 60 par minute et par utilisateur, pour éviter qu'un
 * script ne submerge une conversation.
 */
export const messageThrottle = limiter.define('messages', (ctx) => {
  return limiter
    .allowRequests(60)
    .every('1 minute')
    .usingKey(`messages_${ctx.auth.user?.id ?? ctx.request.ip()}`)
})
