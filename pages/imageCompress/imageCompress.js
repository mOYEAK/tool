const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')

Page({
  data: {
    imagePath: '',
    compressedPath: '',
    originalSizeText: '',
    compressedSizeText: '',
    quality: 80,
    outputFormat: 'jpg',
    imageInfo: null
  },

  async chooseImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })
      const file = res.tempFiles[0]
      const [imageInfo, fileSize] = await Promise.all([
        this.getImageInfo(file.tempFilePath),
        this.getFileSize(file.tempFilePath, file.size)
      ])

      this.setData({
        imagePath: file.tempFilePath,
        compressedPath: '',
        originalSizeText: this.formatSize(fileSize),
        compressedSizeText: '',
        imageInfo
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

  changeQuality(e) {
    this.setData({
      quality: e.detail.value,
      compressedPath: '',
      compressedSizeText: ''
    })
  },

  changeFormat(e) {
    this.setData({
      outputFormat: e.currentTarget.dataset.format,
      compressedPath: '',
      compressedSizeText: ''
    })
  },

  async compressImage() {
    if (!this.data.imagePath || !this.data.imageInfo) {
      return
    }

    try {
      wx.showLoading({
        title: '处理中...',
        mask: true
      })

      const compressedPath = await this.createCompressedImage()
      const compressedSize = await this.getFileSize(compressedPath)

      this.setData({
        compressedPath,
        compressedSizeText: this.formatSize(compressedSize)
      })
    } catch (err) {
      wx.showToast({
        title: '处理失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async createCompressedImage() {
    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')
    const imageInfo = this.data.imageInfo
    const image = await this.loadCanvasImage(canvas, imageInfo.path)
    const maxSide = 2000
    const scale = Math.min(1, maxSide / Math.max(imageInfo.width, imageInfo.height))
    const width = Math.max(1, Math.round(imageInfo.width * scale))
    const height = Math.max(1, Math.round(imageInfo.height * scale))
    const fileType = this.data.outputFormat

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)

    if (fileType === 'jpg') {
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, width, height)
    }

    ctx.drawImage(image, 0, 0, width, height)

    return this.canvasToTempFilePath(canvas, width, height, fileType, this.data.quality / 100)
  },

  async saveCompressedImage() {
    if (!this.data.compressedPath) {
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      await ensureAlbumPermission()
      await saveImageToAlbum(this.data.compressedPath)

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

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#compressCanvas')
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

  getFileSize(filePath, fallbackSize) {
    if (fallbackSize) {
      return Promise.resolve(fallbackSize)
    }

    return new Promise((resolve, reject) => {
      wx.getFileInfo({
        filePath,
        success: (res) => resolve(res.size),
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

  formatSize(size) {
    if (!size && size !== 0) {
      return '--'
    }

    if (size < 1024) {
      return `${size} B`
    }

    if (size < 1024 * 1024) {
      return `${(size / 1024).toFixed(1)} KB`
    }

    return `${(size / 1024 / 1024).toFixed(2)} MB`
  },

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  }
})
