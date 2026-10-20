import env from '#start/env'
import app from '@adonisjs/core/services/app'
import { defineConfig, services } from '@adonisjs/drive'

const driveConfig = defineConfig({
  default: env.get('DRIVE_DISK'),

  /**
   * The services object can be used to configure multiple file system
   * services each using the same or a different driver.
   */
  services: {
    /**
     * Disque local : utilisé en développement uniquement.
     * Sur Render, ce disque est effacé à chaque redémarrage.
     */
    fs: services.fs({
      location: app.makePath('storage'),
      serveFiles: true,
      routeBasePath: '/uploads',
      visibility: 'public',
    }),

    /**
     * Supabase Storage (compatible S3) : utilisé en production.
     * Les fichiers survivent aux redémarrages et aux redéploiements.
     */
    s3: services.s3({
      credentials: {
        accessKeyId: env.get('S3_ACCESS_KEY_ID', ''),
        secretAccessKey: env.get('S3_SECRET_ACCESS_KEY', ''),
      },
      region: env.get('S3_REGION', 'eu-west-1'),
      bucket: env.get('S3_BUCKET', 'avatars'),
      endpoint: env.get('S3_ENDPOINT'),
      forcePathStyle: true,
      /**
       * Supabase ne gère pas les ACL S3 : la visibilité publique
       * vient du bucket public, pas de l'objet.
       */
      supportsACL: false,
      visibility: 'public',
      /**
       * URL publique des fichiers du bucket.
       */
      cdnUrl: env.get('S3_PUBLIC_URL'),
    }),
  },
})

export default driveConfig

declare module '@adonisjs/drive/types' {
  export interface DriveDisks extends InferDriveDisks<typeof driveConfig> {}
}
