import app from '@adonisjs/core/services/app'
import { type HttpContext, ExceptionHandler } from '@adonisjs/core/http'
import type { StatusPageRange, StatusPageRenderer } from '@adonisjs/core/types/http'
import { errors as limiterErrors } from '@adonisjs/limiter'

export default class HttpExceptionHandler extends ExceptionHandler {
  /**
   * In debug mode, the exception handler will display verbose errors
   * with pretty printed stack traces.
   */
  protected debug = !app.inProduction

  /**
   * Status pages are used to display a custom HTML pages for certain error
   * codes. En développement, on garde la page de débogage pour les erreurs
   * serveur (500) afin de voir la pile d'appels. Passe cette valeur à `true`
   * pour prévisualiser la page 500 de Kadea Chat en local.
   */
  protected renderStatusPages = app.inProduction

  /**
   * Status pages is a collection of error code range and a callback
   * to return the HTML contents to send as a response.
   */
  protected statusPages: Record<StatusPageRange, StatusPageRenderer> = {
    '404': (error, { view }) => {
      return view.render('pages/errors/not_found', { error })
    },
    '500..599': (error, { view }) => {
      return view.render('pages/errors/server_error', { error })
    },
  }

  /**
   * The method is used for handling errors and returning
   * response to the client
   */
  async handle(error: unknown, ctx: HttpContext) {
    /**
     * Une route inconnue n'est pas un bug : on affiche toujours la page 404
     * de Kadea Chat, y compris en développement.
     */
    if (this.isRouteNotFound(error)) {
      const html = await ctx.view.render('pages/errors/not_found', { error })
      return ctx.response.status(404).send(html)
    }

    /**
     * Trop de requêtes : une page claire pour les pages, et un message JSON
     * que la messagerie affiche telle quelle (elle sait lire ce format).
     */
    if (error instanceof limiterErrors.E_TOO_MANY_REQUESTS) {
      for (const [name, value] of Object.entries(error.getDefaultHeaders())) {
        ctx.response.header(name, String(value))
      }

      if (ctx.request.header('x-chat-fetch') === '1') {
        return ctx.response.status(422).json({
          errors: [{ message: 'Trop de requêtes. Patientez un instant avant de réessayer.' }],
        })
      }

      const html = await ctx.view.render('pages/errors/too_many_requests', {
        waitMinutes: Math.max(1, Math.ceil(error.response.availableIn / 60)),
      })
      return ctx.response.status(429).send(html)
    }

    return super.handle(error, ctx)
  }

  /**
   * The method is used to report error to the logging service or
   * the a third party error monitoring service.
   *
   * @note You should not attempt to send a response from this method.
   */
  async report(error: unknown, ctx: HttpContext) {
    return super.report(error, ctx)
  }

  /**
   * Détecte l'erreur levée quand aucune route ne correspond à l'URL.
   */
  private isRouteNotFound(error: unknown) {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 'E_ROUTE_NOT_FOUND'
    )
  }
}
