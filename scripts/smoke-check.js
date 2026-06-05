const fs = require('fs')
const path = require('path')

const root = path.resolve(__dirname, '..')
const allowedMonetization = new Set(['free', 'quota', 'rewardAd', 'pay', 'payOrAd'])
const errors = []

function readJson(relativePath) {
  const fullPath = path.join(root, relativePath)

  try {
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'))
  } catch (err) {
    errors.push(`${relativePath} is not valid JSON: ${err.message}`)
    return null
  }
}

function assertFile(relativePath) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    errors.push(`Missing file: ${relativePath}`)
  }
}

function assert(condition, message) {
  if (!condition) {
    errors.push(message)
  }
}

const appConfig = readJson('app.json')

if (appConfig) {
  assert(Array.isArray(appConfig.pages), 'app.json pages must be an array')

  for (const page of appConfig.pages || []) {
    assertFile(`${page}.js`)
    assertFile(`${page}.json`)
    assertFile(`${page}.wxml`)
    assertFile(`${page}.wxss`)
  }
}

const tools = require(path.join(root, 'modules/tools.js'))
const appPages = new Set((appConfig && appConfig.pages) || [])
const keys = new Set()

assert(Array.isArray(tools), 'modules/tools.js must export an array')

for (const tool of tools) {
  const prefix = tool && tool.key ? `Tool ${tool.key}` : 'Tool'

  assert(tool && typeof tool.key === 'string' && tool.key, `${prefix} needs key`)
  assert(tool && typeof tool.name === 'string' && tool.name, `${prefix} needs name`)
  assert(tool && typeof tool.category === 'string' && tool.category, `${prefix} needs category`)
  assert(tool && Number.isInteger(tool.phase), `${prefix} needs integer phase`)
  assert(tool && typeof tool.pagePath === 'string' && tool.pagePath.startsWith('/'), `${prefix} needs absolute pagePath`)
  assert(tool && allowedMonetization.has(tool.monetization), `${prefix} has invalid monetization`)
  assert(tool && typeof tool.requiresBackend === 'boolean', `${prefix} needs requiresBackend boolean`)
  assert(tool && typeof tool.enabled === 'boolean', `${prefix} needs enabled boolean`)

  if (tool && tool.key) {
    assert(!keys.has(tool.key), `Duplicate tool key: ${tool.key}`)
    keys.add(tool.key)
  }

  if (tool && tool.enabled) {
    const page = tool.pagePath.replace(/^\//, '')

    assert(appPages.has(page), `${prefix} pagePath is not registered in app.json: ${tool.pagePath}`)
    assert(tool.phase < 4, `${prefix} is Phase 4 and must not be enabled for MVP`)
  }
}

global.wx = new Proxy({}, {
  get() {
    return () => {}
  }
})
global.Page = (definition) => {
  assert(definition && typeof definition === 'object', 'Page definition must be an object')
}

for (const page of (appConfig && appConfig.pages) || []) {
  const pageJs = path.join(root, `${page}.js`)

  try {
    delete require.cache[require.resolve(pageJs)]
    require(pageJs)
  } catch (err) {
    errors.push(`${page}.js failed to load: ${err.message}`)
  }
}

if (errors.length) {
  console.error(errors.map((item) => `- ${item}`).join('\n'))
  process.exit(1)
}

console.log(`Smoke check passed: ${appConfig.pages.length} pages, ${tools.length} tools`)
