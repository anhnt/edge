/**
 * @module main
 */

/**
 * edge
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
 */

import { join, isAbsolute, extname } from 'path'
import { readFileSync } from 'fs'
import * as requireUncached from 'require-uncached'

import { ILoader, IPresenterConstructor, ILoaderTemplate } from '../Contracts'
import { extractDiskAndTemplateName } from '../utils'
import * as Debug from 'debug'

const debug = Debug('edge:loader')

/**
 * The job of a loader is to load the template and it's presenter for a given path.
 * The base loader (shipped with edge) looks for files on the file-system and
 * reads them synchronously.
 *
 * You are free to define your own loaders that implements the [[ILoader]] interface
 */
export class Loader implements ILoader {
  private mountedDirs: Map<string, string> = new Map()
  private preRegistered: Map<string, ILoaderTemplate> = new Map()

  /**
   * Attempts to load the presenter for a given template. If presenter doesn't exists, it
   * will swallow the error.
   *
   * Also this method will **bypass the require cache**, since in production compiled templates
   * and their presenters are cached anyways.
   */
  private _getPresenterForTemplate (templatePath: string): IPresenterConstructor | undefined {
    try {
      const presenterPath = templatePath
        .replace(/^\w/, c => c.toUpperCase())
        .replace(extname(templatePath), '.presenter.js')

      debug('loading presenter %s', presenterPath)

      return requireUncached(presenterPath)
    } catch (error) {
      if (['ENOENT', 'MODULE_NOT_FOUND'].indexOf(error.code) === -1) {
        throw error
      }
    }
  }

  /**
   * Returns an object of mounted directories with their public
   * names.
   *
   * ```js
   * loader.mounted
   * // output
   *
   * {
   *   default: '/users/virk/code/app/views',
   *   foo: '/users/virk/code/app/foo',
   * }
   * ```
   */
  public get mounted (): { [key: string]: string } {
    return Array.from(this.mountedDirs).reduce((obj, [key, value]) => {
      obj[key] = value
      return obj
    }, {})
  }

  /**
   * Mount a directory with a name for resolving views. If name is set
   * to `default`, then you can resolve views without prefixing the
   * disk name.
   *
   * ```js
   * loader.mount('default', join(__dirname, 'views'))
   *
   * // mount a named disk
   * loader.mount('admin', join(__dirname, 'admin/views'))
   * ```
   */
  public mount (diskName: string, dirPath: string): void {
    debug('mounting dir %s with name %s', dirPath, diskName)
    this.mountedDirs.set(diskName, dirPath)
  }

  /**
   * Remove the previously mounted dir.
   *
   * ```js
   * loader.unmount('default')
   * ```
   */
  public unmount (diskName: string): void {
    debug('unmount dir with name %s', diskName)
    this.mountedDirs.delete(diskName)
  }

  /**
   * Make path to a given template. The paths are resolved from the root
   * of the mounted directory.
   *
   * ```js
   * loader.makePath('welcome') // returns {diskRootPath}/welcome.edge
   * loader.makePath('admin::welcome') // returns {adminRootPath}/welcome.edge
   * loader.makePath('users.list') // returns {diskRootPath}/users/list.edge
   * ```
   *
   * @throws Error if disk is not mounted and attempting to make path for it.
   */
  public makePath (templatePath: string): string {
    if (this.preRegistered.has(templatePath)) {
      return templatePath
    }

    const [diskName, template] = extractDiskAndTemplateName(templatePath)

    const mountedDir = this.mountedDirs.get(diskName)
    if (!mountedDir) {
      throw new Error(`Attempting to resolve ${template} template for unmounted ${diskName} location`)
    }

    return join(mountedDir, template)
  }

  /**
   * Resolves the template from the disk, optionally loads the presenter too. The presenter
   * resolution is based on the convention and resolved from the same directory
   * as the template.
   *
   * ## Presenter convention
   * - View name - welcome
   * - Presenter name - Welcome.presenter.js
   *
   * ```js
   * loader.resolve('welcome', true)
   *
   * // output
   * {
   *   template: `<h1> Template content </h1>`,
   *   Presenter: class Presenter | undefined
   * }
   * ```
   */
  public resolve (templatePath: string, withPresenter: boolean): ILoaderTemplate {
    debug('attempting to resolve %s', templatePath)
    debug('with presenter %s', String(withPresenter))

    /**
     * Return from pre-registered one's if exists
     */
    if (this.preRegistered.has(templatePath)) {
      const contents = this.preRegistered.get(templatePath)
      return withPresenter ? contents! : { template: contents!.template }
    }

    try {
      templatePath = isAbsolute(templatePath) ? templatePath : this.makePath(templatePath)

      const template = readFileSync(templatePath, 'utf-8')
      const presenter = withPresenter ? this._getPresenterForTemplate(templatePath) : undefined

      debug('has presenter %s', !!presenter)
      return { template, Presenter: presenter }
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Cannot resolve ${templatePath}. Make sure file exists.`)
      } else {
        throw error
      }
    }
  }

  /**
   * Register in memory template and Presenter for a given path. This is super helpful
   * when distributing components.
   *
   * ```js
   * loader.register('welcome', {
   *   template: '<h1> Template content </h1>',
   *   Presenter: class Presenter {
   *     constructor (state) {
   *       this.state = state
   *     }
   *   }
   * })
   * ```
   *
   * @throws Error if template content is empty.
   */
  public register (templatePath: string, contents: ILoaderTemplate) {
    if (!contents.template) {
      throw new Error('Make sure to define the template content for preRegistered template')
    }

    if (this.preRegistered.has(templatePath)) {
      throw new Error(`Cannot override previously registered ${templatePath} template`)
    }

    this.preRegistered.set(templatePath, contents)
  }
}
