const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    imageLoaded: false,
    canvasWidth: 0,
    canvasHeight: 0,
    watermarkText: '自定义水印',
    watermarkOpacity: 0.5,
    watermarkRotate: 0,
    watermarkColor: '#FFFFFF',
    isSaving: false,
    isLoading: false
  },

  canvas: null,
  ctx: null,
  dpr: 1,
  imageObj: null,
  watermark: {
    text: '自定义水印',
    x: 100,
    y: 100,
    rotate: 0,
    opacity: 0.5,
    color: '#FFFFFF',
    fontSize: 32
  },
  rafId: null,

  async chooseImage() {
    try {
      this.setData({ isLoading: true })

      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original']
      })

      const tempFilePath = res.tempFiles[0].tempFilePath

      // 先渲染 Canvas 节点到 DOM（wx:if 控制），等 setData 完成后再查询节点
      await new Promise((resolve) => {
        this.setData({ imageLoaded: true }, resolve)
      })
      await this.initCanvas(tempFilePath)
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    } finally {
      this.setData({ isLoading: false })
    }
  },

  initCanvas(imagePath) {
    return new Promise((resolve, reject) => {
      wx.showLoading({ title: '加载中...', mask: true })

      wx.createSelectorQuery()
        .in(this)
        .select('#watermarkCanvas')
        .fields({ node: true, size: true })
        .exec(async (res) => {
          try {
            const canvasNode = res && res[0] && res[0].node
            if (!canvasNode) {
              throw new Error('Canvas 节点不存在')
            }

            const systemInfo = wx.getSystemInfoSync()
            const dpr = systemInfo.pixelRatio || 1
            const screenWidth = systemInfo.windowWidth

            // 获取底图原始尺寸
            const imgInfo = await wx.getImageInfo({ src: imagePath })
            const ratio = imgInfo.height / imgInfo.width
            const canvasLogicalW = screenWidth
            const canvasLogicalH = Math.round(screenWidth * ratio)

            // 设置 Canvas 物理像素尺寸
            canvasNode.width = canvasLogicalW * dpr
            canvasNode.height = canvasLogicalH * dpr

            const ctx = canvasNode.getContext('2d')
            ctx.scale(dpr, dpr)

            // 创建 Image 对象并加载底图
            const img = canvasNode.createImage()
            await new Promise((resolveLoad, rejectLoad) => {
              img.onload = resolveLoad
              img.onerror = () => rejectLoad(new Error('图片加载失败'))
              img.src = imagePath
            })

            // 保存实例引用
            this.canvas = canvasNode
            this.ctx = ctx
            this.dpr = dpr
            this.imageObj = img

            // 重置水印状态（居中放置）
            this.watermark = {
              text: this.data.watermarkText,
              x: Math.round(canvasLogicalW / 2),
              y: Math.round(canvasLogicalH / 2),
              rotate: Number(this.data.watermarkRotate),
              opacity: Number(this.data.watermarkOpacity),
              color: this.data.watermarkColor,
              fontSize: 32
            }

            this.setData({
              canvasWidth: canvasLogicalW,
              canvasHeight: canvasLogicalH
            })

            this.draw()
            recordToolUse('watermark', 'generate')
            resolve()
          } catch (err) {
            wx.showToast({ title: '图片加载失败', icon: 'none' })
            reject(err)
          } finally {
            wx.hideLoading()
          }
        })
    })
  },

  /* -------- 核心绘制逻辑 -------- */
  draw() {
    const { ctx, imageObj, watermark: wm } = this
    if (!ctx || !imageObj) return

    const canvasLogicalW = this.data.canvasWidth
    const canvasLogicalH = this.data.canvasHeight

    // 1. 清除画布
    ctx.clearRect(0, 0, canvasLogicalW, canvasLogicalH)

    // 2. 绘制底图
    ctx.drawImage(imageObj, 0, 0, canvasLogicalW, canvasLogicalH)

    // 3. 绘制水印文字
    ctx.save()
    ctx.translate(wm.x, wm.y)
    ctx.rotate((wm.rotate * Math.PI) / 180)
    ctx.globalAlpha = wm.opacity
    ctx.fillStyle = wm.color
    ctx.font = wm.fontSize + 'px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(wm.text, 0, 0)
    ctx.restore()
  },

  /* -------- 拖拽交互 -------- */
  onTouchStart() {
    // 仅用于启用 touch 事件流
  },

  onTouchMove(e) {
    if (!this.imageObj || !this.ctx) return

    const touch = e.touches && e.touches[0]
    if (!touch) return

    const canvasLogicalW = this.data.canvasWidth
    const canvasLogicalH = this.data.canvasHeight

    // 边界限制，防止拖出画布
    const margin = 20
    this.watermark.x = Math.min(Math.max(touch.x, margin), canvasLogicalW - margin)
    this.watermark.y = Math.min(Math.max(touch.y, margin), canvasLogicalH - margin)

    // requestAnimationFrame 节流
    if (this.rafId) return
    this.rafId = this.canvas.requestAnimationFrame(() => {
      this.rafId = null
      this.draw()
    })
  },

  /* -------- 控制面板交互 -------- */
  onTextChange(e) {
    const text = e.detail.value || ''
    this.watermark.text = text
    this.setData({ watermarkText: text })
    this.draw()
  },

  onOpacityChange(e) {
    const opacity = Number(e.detail.value)
    this.watermark.opacity = opacity
    this.setData({ watermarkOpacity: opacity })
    this.draw()
  },

  onRotateChange(e) {
    const rotate = Number(e.detail.value)
    this.watermark.rotate = rotate
    this.setData({ watermarkRotate: rotate })
    this.draw()
  },

  onColorChange(e) {
    const color = e.currentTarget.dataset.color
    this.watermark.color = color
    this.setData({ watermarkColor: color })
    this.draw()
  },

  /* -------- 导出保存 -------- */
  canvasToTempFilePath() {
    return new Promise((resolve, reject) => {
      const canvasLogicalW = this.data.canvasWidth
      const canvasLogicalH = this.data.canvasHeight

      wx.canvasToTempFilePath({
        canvas: this.canvas,
        x: 0,
        y: 0,
        width: canvasLogicalW,
        height: canvasLogicalH,
        destWidth: canvasLogicalW * this.dpr,
        destHeight: canvasLogicalH * this.dpr,
        fileType: 'png',
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  async saveToAlbum() {
    if (this.data.isSaving) return

    if (!this.imageObj || !this.canvas) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '保存中...', mask: true })
      this.setData({ isSaving: true })

      await ensureAlbumPermission()
      const tempFilePath = await this.canvasToTempFilePath()
      await saveImageToAlbum(tempFilePath)
      recordToolUse('watermark', 'save')

      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      }
    } finally {
      this.setData({ isSaving: false })
      wx.hideLoading()
    }
  },

  /* -------- 工具方法 -------- */
  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')
    return message.includes('cancel')
  }
})
