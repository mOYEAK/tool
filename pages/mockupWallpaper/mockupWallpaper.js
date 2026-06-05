const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')

Page({
  data: {
    mode: 'mockup',
    screenshotPath: '',
    resultPath: '',
    shellTemplate: 'ios',
    mockupBackground: 'softBlue',
    wallpaperPreset: 'pureLight',
    wallpaperText: '',
    isGenerating: false,
    isSaving: false,
    shellTemplates: [
      { id: 'ios', name: 'iOS 扁平风' },
      { id: 'fullscreen', name: '经典全面屏' }
    ],
    backgroundPresets: [
      { id: 'softBlue', name: '清爽蓝' },
      { id: 'warmPink', name: '暖粉橙' },
      { id: 'darkTech', name: '深色科技' }
    ],
    wallpaperPresets: [
      { id: 'pureLight', name: '纯色浅灰' },
      { id: 'sunset', name: '日落渐变' },
      { id: 'ocean', name: '海洋渐变' },
      { id: 'night', name: '夜幕渐变' }
    ]
  },

  switchMode(e) {
    this.setData({
      mode: e.currentTarget.dataset.mode,
      resultPath: ''
    })
  },

  async chooseScreenshot() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })

      this.setData({
        screenshotPath: res.tempFiles[0].tempFilePath,
        resultPath: ''
      })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({
          title: '选择失败',
          icon: 'none'
        })
      }
    }
  },

  selectShellTemplate(e) {
    this.setData({
      shellTemplate: e.currentTarget.dataset.id,
      resultPath: ''
    })
  },

  selectMockupBackground(e) {
    this.setData({
      mockupBackground: e.currentTarget.dataset.id,
      resultPath: ''
    })
  },

  selectWallpaperPreset(e) {
    this.setData({
      wallpaperPreset: e.currentTarget.dataset.id,
      resultPath: ''
    })
  },

  onWallpaperTextInput(e) {
    this.setData({
      wallpaperText: e.detail.value,
      resultPath: ''
    })
  },

  async generateMockup() {
    if (this.data.isGenerating) {
      return
    }

    if (!this.data.screenshotPath) {
      wx.showToast({
        title: '请先选择截图',
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

      const resultPath = await this.drawMockupPoster()

      this.setData({ resultPath })
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

  async generateWallpaper() {
    if (this.data.isGenerating) {
      return
    }

    try {
      wx.showLoading({
        title: '生成中...',
        mask: true
      })
      this.setData({ isGenerating: true })

      const resultPath = await this.drawWallpaper()

      this.setData({ resultPath })
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

  async drawMockupPoster() {
    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')
    const width = 1080
    const height = 1600
    const phoneWidth = 620
    const phoneHeight = 1320
    const phoneX = (width - phoneWidth) / 2
    const phoneY = 140
    const screenInset = this.data.shellTemplate === 'ios' ? 38 : 30
    const screenTopInset = this.data.shellTemplate === 'ios' ? 56 : 42
    const screenBottomInset = this.data.shellTemplate === 'ios' ? 54 : 42
    const screenRect = {
      x: phoneX + screenInset,
      y: phoneY + screenTopInset,
      width: phoneWidth - screenInset * 2,
      height: phoneHeight - screenTopInset - screenBottomInset,
      radius: this.data.shellTemplate === 'ios' ? 46 : 36
    }
    const imageInfo = await this.getImageInfo(this.data.screenshotPath)
    const image = await this.loadCanvasImage(canvas, imageInfo.path)

    canvas.width = width
    canvas.height = height
    this.drawBackground(ctx, width, height, this.data.mockupBackground)
    this.drawDecorations(ctx, width, height)
    this.drawPhoneBase(ctx, phoneX, phoneY, phoneWidth, phoneHeight, this.data.shellTemplate)

    ctx.save()
    this.roundRect(ctx, screenRect.x, screenRect.y, screenRect.width, screenRect.height, screenRect.radius)
    ctx.clip()
    this.drawImageCover(ctx, image, imageInfo.width, imageInfo.height, screenRect)
    ctx.restore()

    this.drawPhoneOverlay(ctx, phoneX, phoneY, phoneWidth, phoneHeight, screenRect, this.data.shellTemplate)

    return this.canvasToTempFilePath(canvas, width, height, 'png', 1)
  },

  async drawWallpaper() {
    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')
    const width = 1080
    const height = 1920
    const text = this.data.wallpaperText.trim()

    canvas.width = width
    canvas.height = height
    this.drawBackground(ctx, width, height, this.data.wallpaperPreset)

    if (text) {
      ctx.fillStyle = this.data.wallpaperPreset === 'pureLight' ? '#111111' : '#FFFFFF'
      ctx.font = '56px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      this.drawWrappedText(ctx, text, width / 2, height / 2, 760, 84)
    }

    return this.canvasToTempFilePath(canvas, width, height, 'png', 1)
  },

  drawBackground(ctx, width, height, preset) {
    if (preset === 'pureLight') {
      ctx.fillStyle = '#F7F8FA'
      ctx.fillRect(0, 0, width, height)
      return
    }

    const gradient = ctx.createLinearGradient(0, 0, width, height)

    if (preset === 'warmPink') {
      gradient.addColorStop(0, '#FFE4E6')
      gradient.addColorStop(1, '#FFF7E6')
    } else if (preset === 'darkTech') {
      gradient.addColorStop(0, '#111827')
      gradient.addColorStop(1, '#334155')
    } else if (preset === 'sunset') {
      gradient.addColorStop(0, '#FF8A00')
      gradient.addColorStop(1, '#FF5E7E')
    } else if (preset === 'ocean') {
      gradient.addColorStop(0, '#1677FF')
      gradient.addColorStop(1, '#00C2A8')
    } else if (preset === 'night') {
      gradient.addColorStop(0, '#111827')
      gradient.addColorStop(1, '#4C1D95')
    } else {
      gradient.addColorStop(0, '#DCEBFF')
      gradient.addColorStop(1, '#F7F8FA')
    }

    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, width, height)
  },

  drawDecorations(ctx, width, height) {
    ctx.save()
    ctx.globalAlpha = 0.18
    ctx.fillStyle = '#FFFFFF'
    ctx.beginPath()
    ctx.arc(170, 220, 120, 0, Math.PI * 2)
    ctx.fill()
    ctx.beginPath()
    ctx.arc(width - 130, height - 260, 180, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  },

  drawPhoneBase(ctx, x, y, width, height, template) {
    ctx.save()
    ctx.shadowColor = 'rgba(0, 0, 0, 0.28)'
    ctx.shadowBlur = 44
    ctx.shadowOffsetY = 28
    ctx.fillStyle = template === 'ios' ? '#111111' : '#222222'
    this.fillRoundRect(ctx, x, y, width, height, 78)
    ctx.shadowColor = 'transparent'

    ctx.fillStyle = template === 'ios' ? '#F8FAFC' : '#111827'
    this.fillRoundRect(ctx, x + 18, y + 18, width - 36, height - 36, 62)
    ctx.restore()
  },

  drawPhoneOverlay(ctx, x, y, width, height, screenRect, template) {
    ctx.save()
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.strokeStyle = template === 'ios' ? '#111111' : '#222222'
    ctx.lineWidth = 30
    this.roundRect(ctx, x + 15, y + 15, width - 30, height - 30, 64)
    ctx.stroke()

    ctx.strokeStyle = template === 'ios' ? '#E5E7EB' : '#111827'
    ctx.lineWidth = 8
    this.roundRect(ctx, screenRect.x, screenRect.y, screenRect.width, screenRect.height, screenRect.radius)
    ctx.stroke()

    if (template === 'ios') {
      ctx.fillStyle = '#111111'
      this.fillRoundRect(ctx, x + width / 2 - 74, y + 34, 148, 34, 17)
    } else {
      ctx.fillStyle = '#111111'
      ctx.beginPath()
      ctx.arc(x + width / 2, y + 42, 13, 0, Math.PI * 2)
      ctx.fill()
    }

    ctx.restore()
  },

  drawImageCover(ctx, image, imageWidth, imageHeight, rect) {
    const scale = Math.max(rect.width / imageWidth, rect.height / imageHeight)
    const drawWidth = imageWidth * scale
    const drawHeight = imageHeight * scale
    const drawX = rect.x + (rect.width - drawWidth) / 2
    const drawY = rect.y + (rect.height - drawHeight) / 2

    ctx.drawImage(image, drawX, drawY, drawWidth, drawHeight)
  },

  drawWrappedText(ctx, text, x, centerY, maxWidth, lineHeight) {
    const chars = text.split('')
    const lines = []
    let line = ''

    for (const char of chars) {
      const testLine = line + char

      if (ctx.measureText(testLine).width > maxWidth && line) {
        lines.push(line)
        line = char
      } else {
        line = testLine
      }
    }

    if (line) {
      lines.push(line)
    }

    const startY = centerY - ((lines.length - 1) * lineHeight) / 2

    lines.forEach((item, index) => {
      ctx.fillText(item, x, startY + index * lineHeight)
    })
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
  },

  async saveResult() {
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

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ isSaving: false })
      wx.hideLoading()
    }
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

  getImageInfo(filePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: filePath,
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

  canvasToTempFilePath(canvas, width, height, fileType, quality) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType,
        quality,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  }
})
