const QUOTA_PREFIX = 'toolbox_quota_'

function getTodayKey(toolKey) {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')

  return `${QUOTA_PREFIX}${toolKey}_${year}${month}${day}`
}

function getUsage(toolKey) {
  return wx.getStorageSync(getTodayKey(toolKey)) || 0
}

function increaseUsage(toolKey) {
  const key = getTodayKey(toolKey)
  const nextUsage = (wx.getStorageSync(key) || 0) + 1

  wx.setStorageSync(key, nextUsage)

  return nextUsage
}

function canUseTool(toolKey, dailyLimit) {
  if (!dailyLimit) {
    return true
  }

  return getUsage(toolKey) < dailyLimit
}

module.exports = {
  getUsage,
  increaseUsage,
  canUseTool
}
