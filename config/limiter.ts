import env from '#start/env'
import { defineConfig, stores } from '@adonisjs/limiter'

const limiterConfig = defineConfig({
  default: env.get('LIMITER_STORE'),
  stores: {
    /**
     * Magasin en base de données : les compteurs survivent aux redémarrages
     * de l'application.
     */
    database: stores.database({
      tableName: 'rate_limits',
    }),

    /**
     * Magasin en mémoire : utilisé pendant les tests automatiques.
     */
    memory: stores.memory({}),
  },
})

export default limiterConfig

declare module '@adonisjs/limiter/types' {
  export interface LimitersList extends InferLimiters<typeof limiterConfig> {}
}
