Page({
  data: {
    images: []
  },

  async chooseImages() {
    try {
      const res = await wx.chooseMedia({
        count: 9,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })

      const images = res.tempFiles.map((file) => ({
        path: file.tempFilePath
      }))

      this.setData({ images })
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
    this.setData({ images })
  },

  async createAndSaveLongImage() {
    if (this.data.images.length < 2) {
      return
    }

    try {
      wx.showLoading({
        title: '努力拼接中...',
        mask: true
      })

      const tempFilePath = await this.createLongImage()

      await this.ensureAlbumPermission()
      await this.saveImage(tempFilePath)

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (err) {
      wx.showToast({
        title: '生成失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async createLongImage() {
    const targetWidth = 750
    const maxCanvasHeight = 16000
    const imageInfos = []

    for (const item of this.data.images) {
      const info = await this.getImageInfo(item.path)
      const scaledHeight = Math.round((info.height / info.width) * targetWidth)

      imageInfos.push({
        path: info.path,
        width: info.width,
        height: info.height,
        scaledHeight
      })
    }

    const totalHeight = imageInfos.reduce((sum, item) => sum + item.scaledHeight, 0)

    if (totalHeight > maxCanvasHeight) {
      throw new Error('图片过长，请减少图片数量')
    }

    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')

    canvas.width = targetWidth
    canvas.height = totalHeight

    ctx.clearRect(0, 0, targetWidth, totalHeight)

    let offsetY = 0

    for (const info of imageInfos) {
      const image = await this.loadCanvasImage(canvas, info.path)

      ctx.drawImage(
        image,
        0,
        0,
        info.width,
        info.height,
        0,
        offsetY,
        targetWidth,
        info.scaledHeight
      )

      offsetY += info.scaledHeight
    }

    return this.canvasToTempFilePath(canvas, targetWidth, totalHeight)
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#spliceCanvas')
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
        quality: 1,
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
