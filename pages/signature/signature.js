const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')

Page({
  data: {
    lineWidth: 6,
    strokeStyle: '#000000',
    backgroundColor: '#FFFFFF',
    brushColors: ['#000000', '#E53935', '#1677FF', '#07C160', '#FF8A00', '#8E44AD'],
    backgroundColors: ['#FFFFFF', '#F7F8FA', '#FFF7E6', '#EAF4FF', '#EFFFF5', '#111111']
  },

  canvas: null,
  ctx: null,
  canvasWidth: 0,
  canvasHeight: 0,
  dpr: 1,
  isDrawing: false,
  currentStroke: null,
  strokes: [],

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
          this.redrawCanvas()
        } catch (err) {
          wx.showToast({
            title: '画板初始化失败',
            icon: 'none'
          })
        }
      })
  },

  changeStrokeColor(e) {
    this.setData({
      strokeStyle: e.currentTarget.dataset.color
    })
  },

  changeBackgroundColor(e) {
    this.setData({
      backgroundColor: e.currentTarget.dataset.color
    }, () => {
      this.redrawCanvas()
    })
  },

  changeLineWidth(e) {
    this.setData({
      lineWidth: e.detail.value
    })
  },

  onTouchStart(e) {
    if (!this.ctx) {
      return
    }

    const point = this.getTouchPoint(e)

    this.isDrawing = true
    this.currentStroke = {
      color: this.data.strokeStyle,
      width: this.data.lineWidth,
      points: [point]
    }

    this.ctx.beginPath()
    this.applyStrokeStyle(this.currentStroke)
    this.ctx.moveTo(point.x, point.y)
  },

  onTouchMove(e) {
    if (!this.ctx || !this.isDrawing || !this.currentStroke) {
      return
    }

    const point = this.getTouchPoint(e)

    this.currentStroke.points.push(point)
    this.ctx.lineTo(point.x, point.y)
    this.ctx.stroke()
    this.ctx.moveTo(point.x, point.y)
  },

  onTouchEnd() {
    if (this.currentStroke && this.currentStroke.points.length) {
      this.strokes.push(this.currentStroke)
    }

    this.isDrawing = false
    this.currentStroke = null
  },

  getTouchPoint(e) {
    const touch = e.touches && e.touches[0]

    return {
      x: touch ? touch.x : 0,
      y: touch ? touch.y : 0
    }
  },

  applyStrokeStyle(stroke) {
    this.ctx.strokeStyle = stroke.color
    this.ctx.lineWidth = stroke.width
    this.ctx.lineCap = 'round'
    this.ctx.lineJoin = 'round'
  },

  redrawCanvas() {
    if (!this.ctx) {
      return
    }

    this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)
    this.ctx.fillStyle = this.data.backgroundColor
    this.ctx.fillRect(0, 0, this.canvasWidth, this.canvasHeight)

    for (const stroke of this.strokes) {
      this.drawStroke(stroke)
    }
  },

  drawStroke(stroke) {
    const points = stroke.points

    if (!points.length) {
      return
    }

    this.ctx.beginPath()
    this.applyStrokeStyle(stroke)
    this.ctx.moveTo(points[0].x, points[0].y)

    if (points.length === 1) {
      this.ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1)
    } else {
      for (let i = 1; i < points.length; i += 1) {
        this.ctx.lineTo(points[i].x, points[i].y)
      }
    }

    this.ctx.stroke()
  },

  clearCanvas() {
    this.strokes = []
    this.currentStroke = null
    this.isDrawing = false
    this.redrawCanvas()
  },

  async saveSignature() {
    if (!this.canvas || !this.ctx) {
      wx.showToast({
        title: '画板未初始化',
        icon: 'none'
      })
      return
    }

    if (!this.strokes.length) {
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

      this.redrawCanvas()
      await ensureAlbumPermission()
      const tempFilePath = await this.canvasToTempFilePath()

      await saveImageToAlbum(tempFilePath)

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

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  }
})
