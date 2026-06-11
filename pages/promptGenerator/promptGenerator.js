const { analyzeImage } = require('../../services/ai.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    imagePath: '',
    result: '',
    isAnalyzing: false,
    isCopied: false
  },

  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      })
      this.setData({ imagePath: res.tempFiles[0].tempFilePath, result: '', isCopied: false })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    }
  },

  async startAnalyze() {
    if (this.data.isAnalyzing || !this.data.imagePath) return
    try {
      wx.showLoading({ title: 'AI 分析中...', mask: true })
      this.setData({ isAnalyzing: true, isCopied: false })
      const result = await analyzeImage(this.data.imagePath)
      this.setData({ result })
      recordToolUse('promptGenerator', 'generate')
    } catch (err) {
      wx.showToast({ title: this.mapError(err), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ isAnalyzing: false })
      wx.hideLoading()
    }
  },

  copyResult() {
    if (!this.data.result) return
    wx.setClipboardData({
      data: this.data.result,
      success: () => {
        this.setData({ isCopied: true })
        wx.showToast({ title: '已复制', icon: 'success' })
        recordToolUse('promptGenerator', 'copy')
      }
    })
  },

  resetPage() {
    this.setData({ imagePath: '', result: '', isCopied: false })
  },

  mapError(err) {
    const m = String(err.message || '')
    if (m.includes('请先配置')) return m
    if (m.includes('request:fail')) return '请在后台配置 AI API 合法域名'
    if (m.includes('网络')) return '网络错误，请检查连接'
    return '分析失败，请重试'
  },

  isCancelError(err) {
    return String((err && (err.errMsg || err.message)) || '').includes('cancel')
  }
})