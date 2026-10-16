import env from '#start/env'
import { defineConfig } from '@adonisjs/lucid'

/**
 * Render fournit une DATABASE_URL complète avec SSL activé.
 * En développement local, on utilise les variables DB_* séparées.
 */
const connectionConfig = env.get('DATABASE_URL')
  ? {
      connectionString: env.get('DATABASE_URL'),
      ssl: { rejectUnauthorized: false },
    }
  : {
      host: env.get('DB_HOST'),
      port: env.get('DB_PORT'),
      user: env.get('DB_USER'),
      password: env.get('DB_PASSWORD'),
      database: env.get('DB_DATABASE'),
    }

const dbConfig = defineConfig({
  connection: 'postgres',
  connections: {
    postgres: {
      client: 'pg',
      connection: connectionConfig,
      migrations: {
        naturalSort: true,
        paths: ['database/migrations'],
      },
    },
  },
})

export default dbConfig
