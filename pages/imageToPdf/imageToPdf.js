const { createPdfFromJpegs } = require('../../services/pdf.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    images: [],
    pdfPath: '',
    pdfSizeText: '',
    isGenerating: false
  },

  async chooseImages() {
    try {
      const restCount = Math.max(0, 9 - this.data.images.length)

      if (!restCount) {
        wx.showToast({
          title: '最多选择 9 张',
          icon: 'none'
        })
        return
      }

      const res = await wx.chooseMedia({
        count: restCount,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })
      const nextImages = []

      for (const file of res.tempFiles) {
        const size = await this.getFileSize(file.tempFilePath, file.size)

        nextImages.push({
          id: `${Date.now()}_${Math.random()}`,
          path: file.tempFilePath,
          sizeText: this.formatSize(size)
        })
      }

      this.setData({
        images: this.data.images.concat(nextImages),
        pdfPath: '',
        pdfSizeText: ''
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

  deleteImage(e) {
    const index = e.currentTarget.dataset.index
    const images = this.data.images.slice()

    images.splice(index, 1)
    this.setData({
      images,
      pdfPath: '',
      pdfSizeText: ''
    })
  },

  moveUp(e) {
    const index = e.currentTarget.dataset.index

    if (index <= 0) {
      return
    }

    this.swapImages(index, index - 1)
  },

  moveDown(e) {
    const index = e.currentTarget.dataset.index

    if (index >= this.data.images.length - 1) {
      return
    }

    this.swapImages(index, index + 1)
  },

  swapImages(fromIndex, toIndex) {
    const images = this.data.images.slice()
    const temp = images[fromIndex]

    images[fromIndex] = images[toIndex]
    images[toIndex] = temp

    this.setData({
      images,
      pdfPath: '',
      pdfSizeText: ''
    })
  },

  async generatePdf() {
    if (this.data.isGenerating) {
      return
    }

    if (!this.data.images.length) {
      wx.showToast({
        title: '请先选择图片',
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

      const jpegItems = []

      for (const item of this.data.images) {
        jpegItems.push(await this.convertImageToJpeg(item.path))
      }

      const pdfPath = await createPdfFromJpegs(jpegItems)
      const size = await this.getFileSize(pdfPath)

      this.setData({
        pdfPath,
        pdfSizeText: this.formatSize(size)
      })
      recordToolUse('imageToPdf', 'generate')

      wx.showToast({
        title: '生成成功',
        icon: 'success'
      })
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

  async convertImageToJpeg(filePath) {
    const [canvas, imageInfo] = await Promise.all([
      this.getCanvas(),
      this.getImageInfo(filePath)
    ])
    const ctx = canvas.getContext('2d')
    const image = await this.loadCanvasImage(canvas, imageInfo.path)
    const maxSide = 1800
    const scale = Math.min(1, maxSide / Math.max(imageInfo.width, imageInfo.height))
    const width = Math.max(1, Math.round(imageInfo.width * scale))
    const height = Math.max(1, Math.round(imageInfo.height * scale))

    canvas.width = width
    canvas.height = height
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const jpgPath = await this.canvasToTempFilePath(canvas, width, height)

    return {
      path: jpgPath,
      width,
      height
    }
  },

  previewPdf() {
    if (!this.data.pdfPath) {
      return
    }

    wx.openDocument({
      filePath: this.data.pdfPath,
      fileType: 'pdf',
      showMenu: true,
      fail: () => {
        wx.showToast({
          title: '预览失败',
          icon: 'none'
        })
      }
    })
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#pdfCanvas')
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

  canvasToTempFilePath(canvas, width, height) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width,
        height,
        destWidth: width,
        destHeight: height,
        fileType: 'jpg',
        quality: 0.92,
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
