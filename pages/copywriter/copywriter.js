const { generateText } = require('../../services/ai.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    inputText: '',
    style: 'casual',
    genCount: 3,
    result: '',
    isGenerating: false,
    isCopied: false,

    styles: [
      { label: '轻松活泼', value: 'casual' },
      { label: '文艺清新', value: 'literary' },
      { label: '专业正式', value: 'professional' },
      { label: '幽默风趣', value: 'humorous' }
    ],

    counts: [1, 3, 5]
  },

  onInput(e) {
    this.setData({ inputText: e.detail.value, result: '', isCopied: false })
  },

  selectStyle(e) {
    this.setData({ style: e.currentTarget.dataset.value, result: '', isCopied: false })
  },

  selectCount(e) {
    this.setData({ genCount: e.currentTarget.dataset.count, result: '', isCopied: false })
  },

  async startGenerate() {
    if (this.data.isGenerating || !this.data.inputText.trim()) return
    try {
      wx.showLoading({ title: 'AI 生成中...', mask: true })
      this.setData({ isGenerating: true, isCopied: false })

      const styleMap = {
        casual: '轻松活泼、口语化',
        literary: '文艺清新、有格调',
        professional: '专业正式、商务风',
        humorous: '幽默风趣、有梗'
      }

      const result = await generateText(
        '你是一个资深社交媒体文案专家，擅长写朋友圈和短视频标题。要求：每条文案控制在 150 字以内，适合手机阅读，有吸引力但不浮夸。',
        `主题：${this.data.inputText.trim()}\n风格：${styleMap[this.data.style]}\n请生成 ${this.data.genCount} 条文案，每条用数字序号分隔。`,
        1200
      )
      this.setData({ result })
      recordToolUse('copywriter', 'generate')
    } catch (err) {
      wx.showToast({ title: this.mapError(err), icon: 'none', duration: 2500 })
    } finally {
      this.setData({ isGenerating: false })
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
        recordToolUse('copywriter', 'copy')
      }
    })
  },

  mapError(err) {
    const m = String(err.message || '')
    if (m.includes('请先配置')) return m
    if (m.includes('request:fail')) return '请在后台配置 AI API 合法域名'
    if (m.includes('网络')) return '网络错误，请检查连接'
    return '生成失败，请重试'
  }
})