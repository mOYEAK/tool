const { segmentPortrait } = require('../../services/portrait.js')
const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    imagePath: '',
    resultPath: '',
    bgColor: 'white',
    isGenerating: false,
    isSaving: false,

    currentSize: { label: '一寸', value: '1inch', ratio: '3/4', desc: '25×35mm' },

    bgColors: [
      { value: 'white', color: '#FFFFFF', label: '白' },
      { value: 'blue', color: '#438EDB', label: '蓝' },
      { value: 'red', color: '#D9001B', label: '红' }
    ],

    photoSizes: [
      { label: '一寸', value: '1inch', ratio: '3/4', desc: '25×35mm' },
      { label: '二寸', value: '2inch', ratio: '3/4', desc: '35×53mm' },
      { label: '小二寸', value: 'small2inch', ratio: '3/4', desc: '33×48mm' }
    ]
  },

  /* ---------- 选择图片 ---------- */
  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      })

      this.setData({
        imagePath: res.tempFiles[0].tempFilePath,
        resultPath: ''
      })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '选择照片失败', icon: 'none' })
      }
    }
  },

  /* ---------- 选择底色 ---------- */
  selectBgColor(e) {
    this.setData({ bgColor: e.currentTarget.dataset.color })
  },

  /* ---------- 选择尺寸 ---------- */
  selectSize(e) {
    this.setData({ currentSize: e.detail.value })
  },

  /* ---------- 压缩图片 ---------- */
  compressImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (info) => {
          const maxSide = 1200
          const scale = Math.min(1, maxSide / Math.max(info.width, info.height))
          const width = Math.round(info.width * scale)
          const height = Math.round(info.height * scale)

          wx.createSelectorQuery()
            .in(this)
            .select('#photoCanvas')
            .fields({ node: true, size: true })
            .exec((res) => {
              const canvas = res && res[0] && res[0].node

              if (!canvas) {
                resolve(info.path)
                return
              }

              const ctx = canvas.getContext('2d')
              canvas.width = width
              canvas.height = height
              ctx.clearRect(0, 0, width, height)
              ctx.fillStyle = '#FFFFFF'
              ctx.fillRect(0, 0, width, height)

              const img = canvas.createImage()
              img.onload = () => {
                ctx.drawImage(img, 0, 0, width, height)

                wx.canvasToTempFilePath({
                  canvas,
                  x: 0, y: 0,
                  width, height,
                  destWidth: width, destHeight: height,
                  fileType: 'jpg',
                  quality: 0.8,
                  success: (r) => resolve(r.tempFilePath),
                  fail: () => resolve(info.path)
                })
              }
              img.onerror = () => resolve(info.path)
              img.src = info.path
            })
        },
        fail: () => resolve(imagePath)
      })
    })
  },

  /* ---------- 生成证件照 ---------- */
  async startGenerate() {
    if (this.data.isGenerating) return

    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择照片', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '压缩图片...', mask: true })
      this.setData({ isGenerating: true })

      // 1. 压缩
      const compressedPath = await this.compressImage(this.data.imagePath)

      // 2. 人像分割
      wx.showLoading({ title: '抠图中...', mask: true })
      const { foregroundPath } = await segmentPortrait(compressedPath)

      // 3. Canvas 合成
      wx.showLoading({ title: '合成中...', mask: true })
      const resultPath = await this.compositePhoto(foregroundPath)

      this.setData({ resultPath })
      recordToolUse('idPhoto', 'generate')
    } catch (err) {
      const message = this.mapError(err)
      wx.showToast({ title: message, icon: 'none', duration: 2500 })
    } finally {
      this.setData({ isGenerating: false })
      wx.hideLoading()
    }
  },

  /* ---------- Canvas 合成证件照 ---------- */
  compositePhoto(foregroundPath) {
    return new Promise((resolve, reject) => {
      // 同时获取前景图和背景色信息
      const bgColorMap = {
        white: '#FFFFFF',
        blue: '#438EDB',
        red: '#D9001B'
      }
      const bgHex = bgColorMap[this.data.bgColor] || '#FFFFFF'
      const outputWidth = 600
      const outputHeight = 800

      wx.createSelectorQuery()
        .in(this)
        .select('#photoCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          const canvas = res && res[0] && res[0].node

          if (!canvas) {
            reject(new Error('Canvas 初始化失败'))
            return
          }

          const ctx = canvas.getContext('2d')
          canvas.width = outputWidth
          canvas.height = outputHeight
          ctx.clearRect(0, 0, outputWidth, outputHeight)

          // 绘制背景色
          ctx.fillStyle = bgHex
          ctx.fillRect(0, 0, outputWidth, outputHeight)

          // 加载前景图
          const fgImg = canvas.createImage()
          fgImg.onload = () => {
            // 计算居中缩放
            const fgRatio = fgImg.width / fgImg.height
            const canvasRatio = outputWidth / outputHeight
            let drawWidth, drawHeight

            if (fgRatio > canvasRatio) {
              drawWidth = outputWidth
              drawHeight = outputWidth / fgRatio
            } else {
              drawHeight = outputHeight
              drawWidth = outputHeight * fgRatio
            }

            const x = (outputWidth - drawWidth) / 2
            const y = (outputHeight - drawHeight) / 2

            ctx.drawImage(fgImg, x, y, drawWidth, drawHeight)

            wx.canvasToTempFilePath({
              canvas,
              x: 0, y: 0,
              width: outputWidth, height: outputHeight,
              destWidth: outputWidth, destHeight: outputHeight,
              fileType: 'png',
              quality: 1,
              success: (r) => resolve(r.tempFilePath),
              fail: reject
            })
          }
          fgImg.onerror = () => reject(new Error('前景图加载失败'))
          fgImg.src = foregroundPath
        })
    })
  },

  /* ---------- 保存到相册 ---------- */
  async saveResult() {
    if (this.data.isSaving || !this.data.resultPath) return

    try {
      wx.showLoading({ title: '保存中...', mask: true })
      this.setData({ isSaving: true })

      await ensureAlbumPermission()
      await saveImageToAlbum(this.data.resultPath)
      recordToolUse('idPhoto', 'save')

      wx.showToast({ title: '保存成功', icon: 'success' })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '保存失败', icon: 'none' })
      }
    } finally {
      this.setData({ isSaving: false })
      wx.hideLoading()
    }
  },

  /* ---------- 重置 ---------- */
  resetPage() {
    this.setData({
      imagePath: '',
      resultPath: ''
    })
  },

  /* ---------- 错误映射 ---------- */
  mapError(err) {
    const message = String(err.message || err.errMsg || '')

    if (message.includes('请先配置百度 AI')) {
      return '请先配置百度 AI API Key'
    }
    if (message.includes('request:fail')) {
      return '请在后台配置合法域名 aip.baidubce.com'
    }
    if (message.includes('网络')) {
      return '网络错误，请检查连接'
    }
    if (message.includes('人像分割')) {
      return '未检测到人像，请上传正面照片'
    }
    return '生成失败，请重试'
  },

  /* ---------- 工具方法 ---------- */
  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')
    return message.includes('cancel')
  }
})