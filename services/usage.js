const tools = require('../modules/tools.js')

const USAGE_KEY = 'toolbox_usage_records'
const EXPORT_KEY = 'toolbox_export_records'
const MAX_RECORDS = 50
const EXPORT_ACTIONS = ['generate', 'save', 'export']

function getToolMeta(toolKey) {
  const tool = tools.find((item) => item.key === toolKey)

  return {
    toolKey,
    name: tool ? tool.name : '未知工具',
    icon: tool ? tool.icon : '🧰',
    category: tool ? tool.category : '未知分类'
  }
}

function readRecords(storageKey) {
  try {
    const records = wx.getStorageSync(storageKey)

    return Array.isArray(records) ? records.filter((record) => record && typeof record === 'object') : []
  } catch (err) {
    return []
  }
}

function writeRecords(storageKey, records) {
  try {
    wx.setStorageSync(storageKey, records.slice(0, MAX_RECORDS))
  } catch (err) {
    // 记录能力不能影响核心工具使用。
  }
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now())

  if (Number.isNaN(date.getTime())) {
    return ''
  }

  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')

  return `${month}-${day} ${hour}:${minute}`
}

function enrichRecord(record) {
  const meta = getToolMeta(record.toolKey || '')

  return {
    ...record,
    ...meta,
    timeText: formatTime(record.timestamp),
    actionText: getActionText(record.action)
  }
}

function getActionText(action) {
  const actionMap = {
    open: '打开工具',
    generate: '生成结果',
    save: '保存导出',
    export: '导出文件'
  }

  return actionMap[action] || '使用工具'
}

function recordToolUse(toolKey, action, extra) {
  try {
    if (!toolKey || !action) {
      return null
    }

    const record = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      toolKey,
      action,
      timestamp: Date.now(),
      extra: extra || {}
    }

    const usageRecords = readRecords(USAGE_KEY)
    writeRecords(USAGE_KEY, [record].concat(usageRecords))

    if (EXPORT_ACTIONS.includes(action)) {
      const exportRecords = readRecords(EXPORT_KEY)
      writeRecords(EXPORT_KEY, [record].concat(exportRecords))
    }

    return record
  } catch (err) {
    return null
  }
}

function getRecentUsage() {
  return readRecords(USAGE_KEY).map(enrichRecord)
}

function getExportRecords() {
  return readRecords(EXPORT_KEY).map(enrichRecord)
}

function clearUsageRecords() {
  try {
    wx.removeStorageSync(USAGE_KEY)
    wx.removeStorageSync(EXPORT_KEY)
  } catch (err) {
    // 忽略清理失败，避免阻塞页面操作。
  }
}

module.exports = {
  recordToolUse,
  getRecentUsage,
  getExportRecords,
  clearUsageRecords
}
