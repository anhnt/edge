'use strict'

/*
 * edge
 *
 * (c) Harminder Virk <virk@adonisjs.com>
 *
 * For the full copyright and license information, please view the LICENSE
 * file that was distributed with this source code.
*/

const test = require('japa')
const cheerio = require('cheerio')
const Template = require('../../../src/Template')
const Loader = require('../../../src/Loader')
const dedent = require('dedent-js')
const loader = new Loader(require('path').join(__dirname, '../../../test-helpers/views'))

test.group('Tags | Component ', (group) => {
  group.beforeEach(() => {
    require('../../../test-helpers/transform-tags')(this, require('../../../src/Tags'))
  })

  test('parse a simple component without any slots', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert')
      <h2> Hello dude </h2>
    @endcomponent
    `
    const output = template.compileString(statement)

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({$slot: { yield: \`  <h2> Hello dude </h2>\` } })))
      return out
    }).bind(this)()
    `)
  })

  test('parse a simple component with props', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert', username = 'virk')
      <h2> Hello dude </h2>
    @endcomponent
    `
    const output = template.compileString(statement)

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({username: 'virk'},{$slot: { yield: \`  <h2> Hello dude </h2>\` } })))
      return out
    }).bind(this)()
    `)
  })

  test('parse a simple component with dynamic props', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert', username = username)
      <h2> Hello dude </h2>
    @endcomponent
    `
    const output = template.compileString(statement)

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({username: this.context.resolve('username')},{$slot: { yield: \`  <h2> Hello dude </h2>\` } })))
      return out
    }).bind(this)()
    `)
  })

  test('parse a simple component with object as props', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert', { username })
      <h2> Hello dude </h2>
    @endcomponent
    `
    const output = template.compileString(statement)

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({username: this.context.resolve('username')},{$slot: { yield: \`  <h2> Hello dude </h2>\` } })))
      return out
    }).bind(this)()
    `)
  })

  test('parse a simple component with dynamic slots', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert', { username })
      @slot('header')
        <h2> This is the header </h2>
      @endslot

      This is the body
    @endcomponent
    `
    const output = template.compileString(statement)
    const slot = `{$slot: { yield: \`
    This is the body\`, header: \`    <h2> This is the header </h2>\` } }`

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({username: this.context.resolve('username')},${slot})))
      return out
    }).bind(this)()
    `)
  })

  test('parse a simple component with one or more dynamic slots', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert', { username })
      @slot('header')
        <h2> This is the header </h2>
      @endslot

      @slot('body')
        This is the body
      @endslot
    @endcomponent
    `
    const output = template.compileString(statement)
    const slot = `{$slot: { yield: \`\`, header: \`    <h2> This is the header </h2>\`, body: \`    This is the body\` } }`

    assert.equal(output, dedent`
    return (function templateFn () {
      let out = new String()
      this.isolate(function () {
        out += \`\${this.runTimeRender('components.alert')}\\n\`
      }.bind(this.newContext({username: this.context.resolve('username')},${slot})))
      return out
    }).bind(this)()
    `)
  })

  test('render template with component', (assert) => {
    const statement = dedent`
    @component('components.alert')
      @slot('header')
        <h2> This is the header </h2>
      @endslot

      @slot('body')
        <p> This is the body <p>
      @endslot
    @endcomponent
    `
    const output = new Template(this.tags, {}, loader).renderString(statement)

    assert.equal(output.trim(), dedent`
      <div class="header">
              <h2> This is the header </h2>
        </div>

        <div class="body">
              <p> This is the body <p>
        </div>`)
  })

  test('component scope must be isolated', (assert) => {
    const statement = dedent`
    @component('components.user', username = 'virk')
    @endcomponent
    `
    const output = new Template(this.tags, {}, loader).renderString(statement, {
      username: 'nikk'
    })
    assert.equal(output.trim(), '<h2> Hello virk </h2>')
  })

  test('scope current scope values with component', (assert) => {
    const statement = dedent`
    @component('components.user', username = username)
    @endcomponent
    `
    const output = new Template(this.tags, {}, loader).renderString(statement, {
      username: 'nikk'
    })
    assert.equal(output.trim(), '<h2> Hello nikk </h2>')
  })

  test('throw exception when slot name is not a string literal', (assert) => {
    const statement = dedent`
    @component('components.alert')
      @slot('header')
        <h2> This is the header </h2>
      @endslot

      @slot(body)
        <p> This is the body <p>
      @endslot
    @endcomponent
    `
    const output = () => new Template(this.tags, {}, loader).compileString(statement)
    assert.throw(output, 'lineno:6 charno:0 E_INVALID_EXPRESSION: Invalid name <body> passed to slot. Only strings are allowed')
  })

  test('should work fine with nested components', (assert) => {
    const statement = dedent`
    @component('components.alert')
      @slot('body')
        @component('components.user', username = 'joe')
        @endcomponent
      @endslot
    @endcomponent
    `
    const output = new Template(this.tags, {}, loader).renderString(statement)
    const $ = cheerio.load(output)
    assert.equal($('.body').html().trim(), '<h2> Hello joe </h2>')
  })

  test('pass multiple props to a component', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.user', username = 'virk', age = 22)
    @endcomponent
    `
    const output = template.renderString(statement)
    const $ = cheerio.load(output)
    assert.equal($('h2').text().trim(), 'Hello virk')
    assert.equal($('p').text().trim(), '22')
  })

  test('component slots should have access to parent template scope', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert')
      <h2>{{ username }}</h2>
    @endcomponent
    `
    const output = template.renderString(statement, {
      username: 'virk'
    })
    const $ = cheerio.load(output)
    assert.equal($('h2').text(), 'virk')
  })

  test('include inside the components', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.alert')
      @slot('body')
        @include('includes.user-name')
      @endslot
    @endcomponent
    `
    const output = template.renderString(statement, {
      username: 'virk'
    })
    const $ = cheerio.load(output)
    assert.equal($('h2').text().trim(), 'virk')
  })

  test('include component inside component', (assert) => {
    const template = new Template(this.tags, {}, loader)
    const statement = dedent`
    @component('components.modal')
      @slot('header')
        Header
      @endslot

      @slot('body')
        Body
      @endslot
    @endcomponent
    `
    const output = template.renderString(statement)
    const $ = cheerio.load(output)
    assert.equal($('.header').text().trim(), 'Header')
    assert.equal($('.body').text().trim(), 'Body')
  })
})
