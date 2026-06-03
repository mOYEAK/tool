Page({
  data: {
    lineWidth: 6,
    strokeStyle: '#000000'
  },

  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  dpr: 1,
  isDrawing: false,
  hasDrawing: false,

  onReady() {
    this.initCanvas()
  },

  initCanvas() {
    wx.createSelectorQuery()
      .in(this)
      .select('#signCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        try {
          const canvasInfo = res && res[0]
          const canvas = canvasInfo && canvasInfo.node

          if (!canvas) {
            throw new Error('Canvas 节点不存在')
          }

          const systemInfo = wx.getSystemInfoSync()
          const dpr = systemInfo.pixelRatio || 1
          const ctx = canvas.getContext('2d')

          this.canvas = canvas
          this.ctx = ctx
          this.canvasWidth = canvasInfo.width
          this.canvasHeight = canvasInfo.height
          this.dpr = dpr

          canvas.width = canvasInfo.width * dpr
          canvas.height = canvasInfo.height * dpr

          ctx.scale(dpr, dpr)
          this.setBrushStyle()
          ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
        } catch (err) {
          wx.showToast({
            title: '画板初始化失败',
            icon: 'none'
          })
        }
      })
  },

  setBrushStyle() {
    if (!this.ctx) {
      return
    }

    this.ctx.strokeStyle = this.data.strokeStyle
    this.ctx.lineWidth = this.data.lineWidth
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
  },

  onTouchStart(e) {
    if (!this.ctx) {
      return
    }

    const point = this.getTouchPoint(e)

    this.isDrawing = true
    this.hasDrawing = true
    this.setBrushStyle()
    this.ctx.beginPath()
    this.ctx.moveTo(point.x, point.y)
  },

  onTouchMove(e) {
    if (!this.ctx || !this.isDrawing) {
      return
    }

    const point = this.getTouchPoint(e)

    this.ctx.lineTo(point.x, point.y)
    this.ctx.stroke()
    this.ctx.moveTo(point.x, point.y)
  },

  onTouchEnd() {
    this.isDrawing = false
  },

  getTouchPoint(e) {
    const touch = e.touches && e.touches[0]

    return {
      x: touch ? touch.x : 0,
      y: touch ? touch.y : 0
    }
  },

  clearCanvas() {
    if (!this.ctx) {
      return
    }

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.hasDrawing = false
  },

  async saveSignature() {
    if (!this.canvas || !this.ctx) {
      wx.showToast({
        title: '画板未初始化',
        icon: 'none'
      })
      return
    }

    if (!this.hasDrawing) {
      wx.showToast({
        title: '请先书写签名',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      await this.ensureAlbumPermission()
      const tempFilePath = await this.canvasToTempFilePath()

      await this.saveImage(tempFilePath)

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
      wx.hideLoading()
    }
  },

  canvasToTempFilePath() {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas: this.canvas,
        x: 0,
        y: 0,
        width: this.canvasWidth,
        height: this.canvasHeight,
        destWidth: this.canvasWidth * this.dpr,
        destHeight: this.canvasHeight * this.dpr,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  async ensureAlbumPermission() {
    const setting = await this.getSetting()
    const authSetting = setting.authSetting || {}
    const scope = 'scope.writePhotosAlbum'

    if (authSetting[scope]) {
      return
    }

    if (authSetting[scope] === false) {
      await this.showOpenSettingModal()
      const nextSetting = await this.openSetting()

      if (!nextSetting.authSetting || !nextSetting.authSetting[scope]) {
        throw new Error('未授权保存相册')
      }

      return
    }

    await this.authorize(scope)
  },

  getSetting() {
    return new Promise((resolve, reject) => {
      wx.getSetting({
        success: resolve,
        fail: reject
      })
    })
  },

  authorize(scope) {
    return new Promise((resolve, reject) => {
      wx.authorize({
        scope,
        success: resolve,
        fail: reject
      })
    })
  },

  showOpenSettingModal() {
    return new Promise((resolve, reject) => {
      wx.showModal({
        title: '需要相册权限',
        content: '请在设置中允许保存图片到相册。',
        confirmText: '去设置',
        success: (res) => {
          if (res.confirm) {
            resolve()
          } else {
            reject(new Error('用户取消授权设置'))
          }
        },
        fail: reject
      })
    })
  },

  openSetting() {
    return new Promise((resolve, reject) => {
      wx.openSetting({
        success: resolve,
        fail: reject
      })
    })
  },

  saveImage(filePath) {
    return new Promise((resolve, reject) => {
      wx.saveImageToPhotosAlbum({
        filePath,
        success: resolve,
        fail: reject
      })
    })
  },

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  }
})
