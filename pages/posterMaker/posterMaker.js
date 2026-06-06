const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')
const { recordToolUse } = require('../../services/usage.js')

const STORAGE_KEY = 'toolbox_poster_maker_draft'
const POSTER_WIDTH = 1080
const POSTER_HEIGHT = 1440

const TEMPLATES = [
  {
    value: 'event',
    label: '活动报名',
    icon: '📣',
    preview: 'linear-gradient(135deg, #1677FF, #4ECDC4)',
    bg: ['#EAF3FF', '#F7FBFF'],
    primary: '#1677FF',
    secondary: '#4ECDC4',
    ink: '#101828'
  },
  {
    value: 'course',
    label: '课程讲座',
    icon: '🎓',
    preview: 'linear-gradient(135deg, #6C63FF, #FFB020)',
    bg: ['#F2F0FF', '#FFF8E8'],
    primary: '#6C63FF',
    secondary: '#FFB020',
    ink: '#18152E'
  },
  {
    value: 'store',
    label: '门店促销',
    icon: '🛍️',
    preview: 'linear-gradient(135deg, #F04438, #FFB020)',
    bg: ['#FFF1EF', '#FFF9E8'],
    primary: '#F04438',
    secondary: '#FFB020',
    ink: '#24120F'
  }
]

Page({
  data: {
    templates: TEMPLATES,
    selectedTemplate: 'event',
    title: '',
    subtitle: '',
    time: '',
    location: '',
    organizer: '',
    remark: '',
    visualPath: '',
    resultPath: '',
    isGenerating: false,
    isSaving: false
  },

  onLoad() {
    const draft = wx.getStorageSync(STORAGE_KEY)

    if (draft) {
      this.setData({
        selectedTemplate: draft.selectedTemplate || 'event',
        title: draft.title || '',
        subtitle: draft.subtitle || '',
        time: draft.time || '',
        location: draft.location || '',
        organizer: draft.organizer || '',
        remark: draft.remark || '',
        visualPath: draft.visualPath || ''
      })
    }
  },

  selectTemplate(e) {
    this.setData({
      selectedTemplate: e.currentTarget.dataset.value,
      resultPath: ''
    }, () => this.saveDraft())
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field

    this.setData({
      [field]: e.detail.value,
      resultPath: ''
    }, () => this.saveDraft())
  },

  chooseVisual() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        const file = res.tempFiles && res.tempFiles[0]

        if (!file || !file.tempFilePath) {
          return
        }

        this.setData({
          visualPath: file.tempFilePath,
          resultPath: ''
        }, () => this.saveDraft())
      },
      fail: (err) => {
        if (!this.isCancelError(err)) {
          wx.showToast({
            title: '选择失败',
            icon: 'none'
          })
        }
      }
    })
  },

  removeVisual() {
    this.setData({
      visualPath: '',
      resultPath: ''
    }, () => this.saveDraft())
  },

  async generatePoster() {
    if (this.data.isGenerating) {
      return
    }

    if (!this.data.title.trim()) {
      wx.showToast({
        title: '请填写活动标题',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({
        title: '生成中...',
        mask: true
      })
      this.setData({ isGenerating: true })

      const resultPath = await this.drawPoster()

      this.setData({ resultPath })
      recordToolUse('posterMaker', 'generate')
    } catch (err) {
      wx.showToast({
        title: '生成失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isGenerating: false })
      wx.hideLoading()
    }
  },

  async drawPoster() {
    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')
    const template = this.getCurrentTemplate()

    canvas.width = POSTER_WIDTH
    canvas.height = POSTER_HEIGHT

    this.drawBackground(ctx, template)
    this.drawDecorations(ctx, template)

    if (this.data.visualPath) {
      await this.drawVisualImage(canvas, ctx, template)
    } else {
      this.drawDefaultVisual(ctx, template)
    }

    this.drawPosterContent(ctx, template)

    return this.canvasToTempFilePath(canvas)
  },

  drawBackground(ctx, template) {
    const gradient = ctx.createLinearGradient(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
    gradient.addColorStop(0, template.bg[0])
    gradient.addColorStop(1, template.bg[1])

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, POSTER_WIDTH, POSTER_HEIGHT)
  },

  drawDecorations(ctx, template) {
    ctx.globalAlpha = 0.14
    ctx.fillStyle = template.primary
    ctx.beginPath()
    ctx.arc(930, 110, 190, 0, Math.PI * 2)
    ctx.fill()

    ctx.fillStyle = template.secondary
    ctx.beginPath()
    ctx.arc(120, 1280, 260, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = '#FFFFFF'
    this.fillRoundRect(ctx, 56, 56, POSTER_WIDTH - 112, POSTER_HEIGHT - 112, 42)
  },

  async drawVisualImage(canvas, ctx, template) {
    const imageInfo = await this.getImageInfo(this.data.visualPath)
    const image = await this.loadCanvasImage(canvas, this.data.visualPath)

    ctx.save()
    this.roundRect(ctx, 106, 106, 868, 430, 32)
    ctx.clip()
    this.drawCoverImage(ctx, image, imageInfo.width, imageInfo.height, 106, 106, 868, 430)
    ctx.restore()

    ctx.strokeStyle = template.primary
    ctx.lineWidth = 8
    this.roundRect(ctx, 106, 106, 868, 430, 32)
    ctx.stroke()
  },

  drawDefaultVisual(ctx, template) {
    const gradient = ctx.createLinearGradient(106, 106, 974, 536)
    gradient.addColorStop(0, template.primary)
    gradient.addColorStop(1, template.secondary)

    ctx.fillStyle = gradient
    this.fillRoundRect(ctx, 106, 106, 868, 430, 32)

    ctx.fillStyle = '#FFFFFF'
    ctx.globalAlpha = 0.22
    ctx.beginPath()
    ctx.arc(820, 166, 150, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(220, 480, 180, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 92px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(this.getCurrentTemplate().icon, POSTER_WIDTH / 2, 304)
  },

  drawPosterContent(ctx, template) {
    let y = 612

    ctx.textAlign = 'left'
    ctx.textBaseline = 'alphabetic'
    ctx.fillStyle = template.primary
    this.fillRoundRect(ctx, 106, y - 44, 210, 62, 31)

    ctx.fillStyle = '#FFFFFF'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText(this.getCurrentTemplate().label, 142, y - 4)

    y += 96
    ctx.fillStyle = template.ink
    ctx.font = 'bold 66px sans-serif'
    y = this.drawWrappedText(ctx, this.data.title.trim(), 106, y, 868, 78, 2)

    if (this.data.subtitle.trim()) {
      y += 22
      ctx.fillStyle = '#667085'
      ctx.font = '34px sans-serif'
      y = this.drawWrappedText(ctx, this.data.subtitle.trim(), 106, y, 868, 46, 1)
    }

    y += 44
    this.drawInfoCard(ctx, template, '时间', this.data.time || '待定', 106, y)
    y += 108
    this.drawInfoCard(ctx, template, '地点', this.data.location || '待定', 106, y)
    y += 108
    this.drawInfoCard(ctx, template, '联系', this.data.organizer || '现场咨询', 106, y)

    if (this.data.remark.trim()) {
      y += 104
      ctx.fillStyle = '#F7F8FA'
      this.fillRoundRect(ctx, 106, y - 54, 868, 132, 24)
      ctx.fillStyle = '#667085'
      ctx.font = '28px sans-serif'
      this.drawWrappedText(ctx, this.data.remark.trim(), 146, y, 788, 42, 2)
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#98A2B3'
    ctx.font = '24px sans-serif'
    ctx.fillText('由万能工具箱生成', POSTER_WIDTH / 2, POSTER_HEIGHT - 72)
  },

  drawInfoCard(ctx, template, label, value, x, y) {
    ctx.fillStyle = '#F7F8FA'
    this.fillRoundRect(ctx, x, y - 62, 868, 84, 22)

    ctx.fillStyle = template.primary
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 34, y - 8)

    ctx.fillStyle = '#1D2939'
    ctx.font = '32px sans-serif'
    this.drawEllipsisText(ctx, value, x + 152, y - 8, 660)
  },

  drawCoverImage(ctx, image, sourceWidth, sourceHeight, x, y, width, height) {
    const sourceRatio = sourceWidth / sourceHeight
    const targetRatio = width / height
    let sx = 0
    let sy = 0
    let sw = sourceWidth
    let sh = sourceHeight

    if (sourceRatio > targetRatio) {
      sw = sourceHeight * targetRatio
      sx = (sourceWidth - sw) / 2
    } else {
      sh = sourceWidth / targetRatio
      sy = (sourceHeight - sh) / 2
    }

    ctx.drawImage(image, sx, sy, sw, sh, x, y, width, height)
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, maxLines) {
    const lines = []
    let line = ''

    text.split('').forEach((char) => {
      const testLine = line + char

      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = testLine
      }
    })

    if (line) {
      lines.push(line)
    }

    const output = lines.slice(0, maxLines)
    if (lines.length > maxLines) {
      let last = output[output.length - 1]

      while (ctx.measureText(`${last}...`).width > maxWidth && last.length > 1) {
        last = last.slice(0, -1)
      }

      output[output.length - 1] = `${last}...`
    }

    output.forEach((item, index) => {
      ctx.fillText(item, x, y + index * lineHeight)
    })

    return y + output.length * lineHeight
  },

  drawEllipsisText(ctx, text, x, y, maxWidth) {
    let output = text

    while (ctx.measureText(output).width > maxWidth && output.length > 1) {
      output = `${output.slice(0, -2)}...`
    }

    ctx.fillText(output, x, y)
  },

  async savePoster() {
    if (this.data.isSaving || !this.data.resultPath) {
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })
      this.setData({ isSaving: true })

      await ensureAlbumPermission()
      await saveImageToAlbum(this.data.resultPath)
      recordToolUse('posterMaker', 'save')

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (err) {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isSaving: false })
      wx.hideLoading()
    }
  },

  previewPoster() {
    if (!this.data.resultPath) {
      return
    }

    wx.previewImage({
      urls: [this.data.resultPath],
      current: this.data.resultPath
    })
  },

  clearDraft() {
    wx.showModal({
      title: '清空草稿',
      content: '确定清空当前海报内容吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        wx.removeStorageSync(STORAGE_KEY)
        this.setData({
          selectedTemplate: 'event',
          title: '',
          subtitle: '',
          time: '',
          location: '',
          organizer: '',
          remark: '',
          visualPath: '',
          resultPath: ''
        })
      }
    })
  },

  saveDraft() {
    wx.setStorageSync(STORAGE_KEY, {
      selectedTemplate: this.data.selectedTemplate,
      title: this.data.title,
      subtitle: this.data.subtitle,
      time: this.data.time,
      location: this.data.location,
      organizer: this.data.organizer,
      remark: this.data.remark,
      visualPath: this.data.visualPath
    })
  },

  getCurrentTemplate() {
    return TEMPLATES.find((item) => item.value === this.data.selectedTemplate) || TEMPLATES[0]
  },

  getImageInfo(src) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src,
        success: resolve,
        fail: reject
      })
    })
  },

  loadCanvasImage(canvas, src) {
    return new Promise((resolve, reject) => {
      const image = canvas.createImage()

      image.onload = () => resolve(image)
      image.onerror = reject
      image.src = src
    })
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#posterCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node

          if (canvas) {
            resolve(canvas)
          } else {
            reject(new Error('Canvas 节点不存在'))
          }
        })
    })
  },

  canvasToTempFilePath(canvas) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: POSTER_WIDTH,
        height: POSTER_HEIGHT,
        destWidth: POSTER_WIDTH,
        destHeight: POSTER_HEIGHT,
        fileType: 'jpg',
        quality: 0.95,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  },

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2)

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  fillRoundRect(ctx, x, y, width, height, radius) {
    this.roundRect(ctx, x, y, width, height, radius)
    ctx.fill()
  }
})
