const { generateText } = require('../../services/ai.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    inputText: '',
    result: '',
    isOptimizing: false,
    isCopied: false
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value, result: '', isCopied: false })
  },

  async startOptimize() {
    if (this.data.isOptimizing || !this.data.inputText.trim()) return
    try {
      wx.showLoading({ title: 'AI 优化中...', mask: true })
      this.setData({ isOptimizing: true, isCopied: false })

      const result = await generateText(
        '你是一位资深 HR 和简历优化专家。请优化以下简历内容：修正语法错误，优化措辞使其更专业，突出关键成就和数据，但保持事实不变。只输出优化后的完整简历，不要多余解释。',
        this.data.inputText.trim(),
        2000
      )
      this.setData({ result })
      recordToolUse('resumeOptimizer', 'optimize')
    } catch (err) {
      wx.showToast({ title: this.mapError(err), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ isOptimizing: false })
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
        recordToolUse('resumeOptimizer', 'copy')
      }
    })
  },

  resetPage() {
    this.setData({ inputText: '', result: '', isCopied: false })
  },

  mapError(err) {
    const m = String(err.message || '')
    if (m.includes('请先配置')) return m
    if (m.includes('request:fail')) return '请在后台配置 AI API 合法域名'
    if (m.includes('网络')) return '网络错误，请检查连接'
    return '优化失败，请重试'
  }
})