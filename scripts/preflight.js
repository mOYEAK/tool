const fs = require('fs')
const path = require('path')
const childProcess = require('child_process')

const root = path.resolve(__dirname, '..')
const passes = []
const warnings = []
const failures = []
const sourceExtensions = new Set(['.js', '.json', '.wxml', '.wxss'])
const pageExtensions = ['.js', '.json', '.wxml', '.wxss']
const highRiskKeywords = ['removeWatermark', 'videoDownload', 'videoParse', '去水印', '视频解析']
const expectedV1ToolKeys = [
  'gridCut',
  'longPic',
  'imageCompress',
  'mockupWallpaper',
  'qrcode',
  'signature',
  'watermark',
  'imageToPdf',
  'namePicker',
  'receiptMaker',
  'posterMaker',
  'ocr',
  'idPhoto'
]

function pass(message) {
  passes.push(message)
}

function warn(message) {
  warnings.push(message)
}

function fail(message) {
  failures.push(message)
}

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8')
}

function readJson(relativePath) {
  try {
    return JSON.parse(readText(relativePath))
  } catch (err) {
    fail(`${relativePath} 无法解析：${err.message}`)
    return null
  }
}

function walk(directory, files = []) {
  const fullDirectory = path.join(root, directory)

  if (!fs.existsSync(fullDirectory)) {
    return files
  }

  for (const name of fs.readdirSync(fullDirectory)) {
    const relativePath = path.join(directory, name)
    const fullPath = path.join(root, relativePath)
    const stat = fs.statSync(fullPath)

    if (stat.isDirectory()) {
      walk(relativePath, files)
    } else {
      files.push(relativePath)
    }
  }

  return files
}

function checkPageRegistration(appConfig) {
  if (!appConfig || !Array.isArray(appConfig.pages)) {
    fail('app.json pages 必须是数组')
    return
  }

  const seen = new Set()

  for (const page of appConfig.pages) {
    if (seen.has(page)) {
      fail(`app.json 存在重复页面：${page}`)
    }
    seen.add(page)

    for (const extension of pageExtensions) {
      const relativePath = `${page}${extension}`

      if (!fs.existsSync(path.join(root, relativePath))) {
        fail(`页面文件缺失：${relativePath}`)
      }
    }
  }

  pass(`已检查 ${appConfig.pages.length} 个注册页面`)
}

function checkTools(appConfig) {
  let tools

  try {
    tools = require(path.join(root, 'modules/tools.js'))
  } catch (err) {
    fail(`modules/tools.js 加载失败：${err.message}`)
    return
  }

  if (!Array.isArray(tools)) {
    fail('modules/tools.js 必须导出数组')
    return
  }

  const pages = new Set((appConfig && appConfig.pages) || [])
  const keys = new Set()
  const enabledKeys = []

  for (const tool of tools) {
    if (!tool || !tool.key) {
      fail('工具注册表存在缺少 key 的配置')
      continue
    }

    if (keys.has(tool.key)) {
      fail(`工具 key 重复：${tool.key}`)
    }
    keys.add(tool.key)

    if (tool.enabled) {
      enabledKeys.push(tool.key)
      const pagePath = String(tool.pagePath || '').replace(/^\//, '')

      if (!pages.has(pagePath)) {
        fail(`启用工具未注册页面：${tool.key} -> ${tool.pagePath}`)
      }

      if (Number(tool.phase) >= 4 || highRiskKeywords.some((keyword) => `${tool.key} ${tool.name}`.includes(keyword))) {
        fail(`第四阶段或高风险工具不应启用：${tool.key}`)
      }
    }
  }

  const expectedKeys = expectedV1ToolKeys.slice().sort()
  const actualKeys = enabledKeys.slice().sort()

  if (JSON.stringify(actualKeys) !== JSON.stringify(expectedKeys)) {
    fail(`V1 启用工具必须固定为 ${expectedV1ToolKeys.length} 个：${expectedV1ToolKeys.join(', ')}`)
  } else {
    pass(`V1 启用工具已冻结为 ${expectedV1ToolKeys.length} 个`)
  }

  pass(`已检查 ${tools.length} 个工具注册项`)
}

function checkSyntax() {
  const files = [
    ...walk('pages'),
    ...walk('modules'),
    ...walk('services'),
    ...walk('utils'),
    ...walk('scripts')
  ]
  const jsFiles = files.filter((file) => path.extname(file) === '.js' && file !== 'scripts/preflight.js')
  const jsonFiles = files.filter((file) => path.extname(file) === '.json')

  for (const file of jsFiles) {
    try {
      childProcess.execFileSync(process.execPath, ['--check', path.join(root, file)], {
        stdio: 'pipe'
      })
    } catch (err) {
      fail(`JS 语法错误：${file}`)
    }
  }

  for (const file of jsonFiles) {
    readJson(file)
  }

  pass(`已检查 ${jsFiles.length} 个 JS 文件和 ${jsonFiles.length} 个 JSON 文件`)
}

function checkReleaseConfig(globalAppConfig) {
  const projectConfig = readJson('project.config.json')
  const sitemap = readJson('sitemap.json')

  if (projectConfig && (!projectConfig.libVersion || projectConfig.libVersion === 'trial')) {
    fail('project.config.json 必须使用固定稳定基础库版本，不能使用 trial')
  } else if (projectConfig) {
    pass(`基础库版本已固定为 ${projectConfig.libVersion}`)
  }

  if (sitemap && !Array.isArray(sitemap.rules)) {
    fail('sitemap.json rules 必须是数组')
  }

  const configPath = path.join(root, 'modules/app-config.js')

  if (fs.existsSync(configPath)) {
    try {
      const config = require(configPath)

      if (!config.appName || !config.version || !config.capabilities) {
        fail('modules/app-config.js 缺少 appName、version 或 capabilities')
      } else {
        pass('统一应用配置完整')
      }

      if (config.version !== '1.2.0') {
        fail(`提审版本号必须为 1.2.0，当前为 ${config.version}`)
      } else {
        pass('提审版本号为 1.2.0')
      }

      const disabledCapabilities = ['adsEnabled', 'paymentEnabled', 'backendEnabled', 'analyticsEnabled']
      const enabledCapabilities = disabledCapabilities.filter((key) => config.capabilities[key] !== false)

      if (enabledCapabilities.length) {
        fail(`V1 外部能力必须保持关闭：${enabledCapabilities.join(', ')}`)
      } else {
        pass('广告、支付、后端和统计能力均保持关闭')
      }

      if (globalAppConfig && globalAppConfig.window && globalAppConfig.window.navigationBarTitleText !== config.appName) {
        fail('app.json 全局导航标题与 modules/app-config.js appName 不一致')
      }
    } catch (err) {
      fail(`modules/app-config.js 加载失败：${err.message}`)
    }
  } else {
    fail('缺少 modules/app-config.js')
  }
}

function checkSourceText() {
  const files = [
    'app.json',
    'project.config.json',
    'sitemap.json',
    ...walk('pages'),
    ...walk('modules'),
    ...walk('services'),
    ...walk('utils')
  ].filter((file) => sourceExtensions.has(path.extname(file)))
  const externalUrlPattern = /https?:\/\/[^\s"'<>]+/g
  const placeholderPatterns = [
    { pattern: /support@example\.com/gi, label: '示例邮箱 support@example.com' },
    { pattern: /\bTODO\b/gi, label: 'TODO 占位' },
    { pattern: /待替换|示例邮箱/gi, label: '待替换占位文案' }
  ]
  const warningPatterns = [
    { pattern: /暂未开放/g, label: '暂未开放文案' },
    { pattern: /广告位预留/g, label: '广告位预留文案' }
  ]

  for (const file of files) {
    const text = readText(file)
    const urls = text.match(externalUrlPattern) || []

    for (const url of urls) {
      warn(`发现外部 URL：${file} -> ${url}`)
    }

    for (const item of placeholderPatterns) {
      if (item.pattern.test(text)) {
        fail(`发现${item.label}：${file}`)
      }
      item.pattern.lastIndex = 0
    }

    for (const item of warningPatterns) {
      if (item.pattern.test(text)) {
        warn(`发现${item.label}：${file}`)
      }
      item.pattern.lastIndex = 0
    }
  }

  pass(`已扫描 ${files.length} 个发布源文件`)
}

const appConfig = readJson('app.json')

checkPageRegistration(appConfig)
checkTools(appConfig)
checkSyntax()
checkReleaseConfig(appConfig)
checkSourceText()

for (const message of passes) {
  console.log(`[PASS] ${message}`)
}

for (const message of warnings) {
  console.warn(`[WARN] ${message}`)
}

for (const message of failures) {
  console.error(`[FAIL] ${message}`)
}

console.log(`\n自检完成：${passes.length} 通过，${warnings.length} 警告，${failures.length} 失败`)

if (failures.length) {
  process.exit(1)
}
