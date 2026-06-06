const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    pieces: [],
    emptyCells: [0, 1, 2, 3, 4, 5, 6, 7, 8],
    isGenerating: false,
    isSaving: false
  },

  async chooseImage() {
    if (this.data.isGenerating) {
      return
    }

    try {
      const mediaRes = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })

      const filePath = mediaRes.tempFiles[0].tempFilePath

      wx.showLoading({
        title: '切图中...',
        mask: true
      })
      this.setData({ isGenerating: true })

      const pieces = await this.createNineGridImages(filePath)
      this.setData({ pieces })
      recordToolUse('gridCut', 'generate')
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({
          title: '切图失败',
          icon: 'none'
        })
      }
    } finally {
      this.setData({ isGenerating: false })
      wx.hideLoading()
    }
  },

  async createNineGridImages(filePath) {
    const [canvas, imageInfo] = await Promise.all([
      this.getCanvas(),
      this.getImageInfo(filePath)
    ])
    const ctx = canvas.getContext('2d')
    const image = await this.loadCanvasImage(canvas, imageInfo.path)

    const cropSize = Math.min(imageInfo.width, imageInfo.height)
    const sourceX = (imageInfo.width - cropSize) / 2
    const sourceY = (imageInfo.height - cropSize) / 2
    const sourcePieceSize = cropSize / 3
    const outputSize = Math.max(300, Math.min(Math.floor(sourcePieceSize), 1080))
    const pieces = []

    canvas.width = outputSize
    canvas.height = outputSize

    for (let row = 0; row < 3; row += 1) {
      for (let col = 0; col < 3; col += 1) {
        ctx.clearRect(0, 0, outputSize, outputSize)
        ctx.drawImage(
          image,
          sourceX + col * sourcePieceSize,
          sourceY + row * sourcePieceSize,
          sourcePieceSize,
          sourcePieceSize,
          0,
          0,
          outputSize,
          outputSize
        )

        const tempFilePath = await this.canvasToTempFilePath(canvas, outputSize)
        pieces.push(tempFilePath)
      }
    }

    return pieces
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#cropCanvas')
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

  canvasToTempFilePath(canvas, size) {
    return new Promise((resolve, reject) => {
      wx.canvasToTempFilePath({
        canvas,
        x: 0,
        y: 0,
        width: size,
        height: size,
        destWidth: size,
        destHeight: size,
        fileType: 'jpg',
        quality: 1,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  async saveAllImages() {
    if (this.data.isSaving || this.data.pieces.length !== 9) {
      return
    }

    try {
      await ensureAlbumPermission()

      wx.showLoading({
        title: '保存中...',
        mask: true
      })
      this.setData({ isSaving: true })

      for (const filePath of this.data.pieces) {
        await saveImageToAlbum(filePath)
      }
      recordToolUse('gridCut', 'save')

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

  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')

    return message.includes('cancel')
  }
})
