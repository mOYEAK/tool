Page({
  data: {
    qrText: '',
    qrImageUrl: '',
    scanResult: ''
  },

  onQrTextInput(e) {
    this.setData({
      qrText: e.detail.value
    })
  },

  generateQrCode() {
    const text = this.data.qrText.trim()

    if (!text) {
      wx.showToast({
        title: '请输入内容',
        icon: 'none'
      })
      return
    }

    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(text)}`

    this.setData({ qrImageUrl })
  },

  async saveQrCode() {
    if (!this.data.qrImageUrl) {
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })

      await this.ensureAlbumPermission()
      const filePath = await this.downloadImage(this.data.qrImageUrl)

      await this.saveImage(filePath)

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

  scanQrCode() {
    wx.scanCode({
      onlyFromCamera: false,
      sourceType: ['album', 'camera'],
      scanType: ['qrCode'],
      success: (res) => {
        this.setData({
          scanResult: res.result || ''
        })
      },
      fail: (err) => {
        if (!this.isCancelError(err)) {
          wx.showToast({
            title: '识别失败',
            icon: 'none'
          })
        }
      }
    })
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

  downloadImage(url) {
    return new Promise((resolve, reject) => {
      wx.downloadFile({
        url,
        success: (res) => {
          if (res.statusCode >= 200 && res.statusCode < 300 && res.tempFilePath) {
            resolve(res.tempFilePath)
          } else {
            reject(new Error('二维码图片下载失败'))
          }
        },
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
