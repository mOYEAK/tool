const qrcode = require('../../utils/qrcode-generator.js')
const jsQR = require('../../utils/jsqr.js')

Page({
  data: {
    qrText: '',
    qrImagePath: '',
    scanResult: ''
  },

  onQrTextInput(e) {
    this.setData({
      qrText: e.detail.value
    })
  },

  async generateQrCode() {
    const text = this.data.qrText.trim()

    if (!text) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({
        title: '生成中...',
        mask: true
      })

      const qrImagePath = await this.createQrImage(text)

      this.setData({ qrImagePath })
    } catch (err) {
      wx.showToast({
        title: '生成失败',
        icon: 'none'
      })
    } finally {
      wx.hideLoading()
    }
  },

  async createQrImage(text) {
    const size = 400
    const padding = 24
    const canvas = await this.getCanvas('#qrCanvas')
    const ctx = canvas.getContext('2d')
    const qr = qrcode(0, 'M')

    qr.addData(text)
    qr.make()

    const moduleCount = qr.getModuleCount()
    const moduleSize = (size - padding * 2) / moduleCount

    canvas.width = size
    canvas.height = size

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, size, size)
    ctx.fillStyle = '#000000'

    for (let row = 0; row < moduleCount; row += 1) {
      for (let col = 0; col < moduleCount; col += 1) {
        if (qr.isDark(row, col)) {
          ctx.fillRect(
            Math.round(padding + col * moduleSize),
            Math.round(padding + row * moduleSize),
            Math.ceil(moduleSize),
            Math.ceil(moduleSize)
          )
        }
      }
    }

    return this.canvasToTempFilePath(canvas, size, size)
  },

  async saveQrCode() {
    if (!this.data.qrImagePath) {
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      await this.ensureAlbumPermission()
      await this.saveImage(this.data.qrImagePath)

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

  async chooseQrImage() {
    try {
      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['original', 'compressed']
      })
      const filePath = res.tempFiles[0].tempFilePath

      wx.showLoading({
        title: '识别中...',
        mask: true
      })

      const result = await this.decodeQrImage(filePath)

      this.setData({
        scanResult: result
      })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({
          title: '识别失败',
          icon: 'none'
        })
      }
    } finally {
      wx.hideLoading()
    }
  },

  async decodeQrImage(filePath) {
    const info = await this.getImageInfo(filePath)
    const canvas = await this.getCanvas('#decodeCanvas')
    const ctx = canvas.getContext('2d')
    const image = await this.loadCanvasImage(canvas, info.path)
    const maxSize = 1200
    const scale = Math.min(1, maxSize / Math.max(info.width, info.height))
    const width = Math.max(1, Math.round(info.width * scale))
    const height = Math.max(1, Math.round(info.height * scale))

    canvas.width = width
    canvas.height = height
    ctx.clearRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)

    const imageData = ctx.getImageData(0, 0, width, height)
    const code = jsQR(imageData.data, width, height)

    if (!code || !code.data) {
      throw new Error('未识别到二维码')
    }

    return code.data
  },

  copyScanResult() {
    if (!this.data.scanResult) {
      return
    }

    wx.setClipboardData({
      data: this.data.scanResult,
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      },
      fail: () => {
        wx.showToast({
          title: '复制失败',
          icon: 'none'
        })
      }
    })
  },

  getCanvas(selector) {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select(selector)
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
