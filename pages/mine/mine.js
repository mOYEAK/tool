const {
  getRecentUsage,
  getExportRecords,
  clearUsageRecords
} = require('../../services/usage.js')
const appConfig = require('../../modules/app-config.js')

Page({
  data: {
    recentUsage: [],
    exportRecords: [],
    appName: appConfig.appName,
    version: appConfig.version,
    supportEmail: appConfig.supportEmail,
    adsEnabled: appConfig.capabilities.adsEnabled
  },

  onShow() {
    this.refreshRecords()
  },

  refreshRecords() {
    this.setData({
      recentUsage: getRecentUsage().slice(0, 8),
      exportRecords: getExportRecords().slice(0, 8)
    })
  },

  clearRecords() {
    wx.showModal({
      title: '清空记录',
      content: '确定清空本机使用记录和导出记录吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        clearUsageRecords()
        this.refreshRecords()
        wx.showToast({
          title: '已清空',
          icon: 'success'
        })
      }
    })
  },

  copyEmail() {
    if (!this.data.supportEmail) {
      return
    }

    wx.setClipboardData({
      data: this.data.supportEmail,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      }
    })
  },

  openPrivacy() {
    wx.navigateTo({
      url: '/pages/privacy/privacy'
    })
  },

  openAbout() {
    wx.navigateTo({
      url: '/pages/about/about'
    })
  },

  showComingSoon() {
    wx.showToast({
      title: '暂未开放',
      icon: 'none'
    })
  }
})
