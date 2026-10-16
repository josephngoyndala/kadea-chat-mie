import env from '#start/env'
import { defineConfig, transports } from '@adonisjs/mail'

const mailConfig = defineConfig({
  default: env.get('MAIL_MAILER'),

  /**
   * Expéditeur par défaut de tous les e-mails.
   */
  from: {
    address: env.get('MAIL_FROM_ADDRESS'),
    name: env.get('MAIL_FROM_NAME'),
  },

  /**
   * Variables partagées avec tous les modèles d'e-mails.
   */
  globals: {
    brandName: 'Kadea Chat',
  },

  /**
   * Les "mailers" décrivent les moyens d'envoi. Un seul pour l'instant :
   * SMTP (Mailpit en local, le vrai service sur le site hébergé).
   */
  mailers: {
    smtp: transports.smtp({
      host: env.get('SMTP_HOST'),
      port: env.get('SMTP_PORT'),
      /**
       * Auth SMTP activée pour Brevo (et tout service d'envoi en production).
       * En local, SMTP_USERNAME et SMTP_PASSWORD peuvent être omis :
       * Mailpit n'en a pas besoin.
       */
      ...(env.get('SMTP_USERNAME')
        ? {
            auth: {
              type: 'login' as const,
              user: env.get('SMTP_USERNAME')!,
              pass: env.get('SMTP_PASSWORD')!,
            },
          }
        : {}),
    }),
  },
})

export default mailConfig

declare module '@adonisjs/mail/types' {
  export interface MailersList extends InferMailers<typeof mailConfig> {}
}
