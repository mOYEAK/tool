const { recognizeImage } = require('../../services/ocr.js')
const { recordToolUse } = require('../../services/usage.js')

Page({
  data: {
    imagePath: '',
    ocrResult: '',
    resultCharCount: 0,
    isRecognizing: false,
    isLoadingImage: false,
    isCopied: false
  },

  /* ---------- 选择图片 ---------- */
  async chooseImage() {
    try {
      this.setData({ isLoadingImage: true, isCopied: false })

      const res = await wx.chooseMedia({
        count: 1,
        mediaType: ['image'],
        sourceType: ['album'],
        sizeType: ['compressed']
      })

      const tempFilePath = res.tempFiles[0].tempFilePath

      this.setData({
        imagePath: tempFilePath,
        ocrResult: ''
      })
    } catch (err) {
      if (!this.isCancelError(err)) {
        wx.showToast({ title: '选择图片失败', icon: 'none' })
      }
    } finally {
      this.setData({ isLoadingImage: false })
    }
  },

  /* ---------- 压缩图片（通过 Canvas） ---------- */
  compressImage(imagePath) {
    return new Promise((resolve, reject) => {
      wx.getImageInfo({
        src: imagePath,
        success: (info) => {
          this.compressWithCanvas(info, resolve, reject)
        },
        fail: reject
      })
    })
  },

  compressWithCanvas(info, resolve, reject) {
    const MAX_SIZE = 900 * 1024 // OCR.space 免费层限制约1MB
    const maxSide = 1600
    let scale = Math.min(1, maxSide / Math.max(info.width, info.height))
    const width = Math.round(info.width * scale)
    const height = Math.round(info.height * scale)

    wx.createSelectorQuery()
      .in(this)
      .select('#compressCanvas')
      .fields({ node: true, size: true })
      .exec((res) => {
        const canvas = res && res[0] && res[0].node

        if (!canvas) {
          // Canvas 不可用时直接使用原图
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
            x: 0,
            y: 0,
            width,
            height,
            destWidth: width,
            destHeight: height,
            fileType: 'jpg',
            quality: 0.7,
            success: (tempRes) => {
              // 验证文件大小
              wx.getFileInfo({
                filePath: tempRes.tempFilePath,
                success: (fileInfo) => {
                  if (fileInfo.size > MAX_SIZE && scale > 0.2) {
                    // 还是太大，进一步缩小
                    const ratio = Math.sqrt(MAX_SIZE / fileInfo.size)
                    const nextScale = scale * ratio * 0.8
                    const w2 = Math.round(info.width * nextScale)
                    const h2 = Math.round(info.height * nextScale)

                    canvas.width = w2
                    canvas.height = h2
                    ctx.clearRect(0, 0, w2, h2)
                    ctx.fillStyle = '#FFFFFF'
                    ctx.fillRect(0, 0, w2, h2)
                    ctx.drawImage(img, 0, 0, w2, h2)

                    wx.canvasToTempFilePath({
                      canvas,
                      x: 0, y: 0,
                      width: w2, height: h2,
                      destWidth: w2, destHeight: h2,
                      fileType: 'jpg',
                      quality: 0.5,
                      success: (r) => resolve(r.tempFilePath),
                      fail: () => resolve(tempRes.tempFilePath)
                    })
                  } else {
                    resolve(tempRes.tempFilePath)
                  }
                },
                fail: () => resolve(tempRes.tempFilePath)
              })
            },
            fail: () => resolve(info.path)
          })
        }
        img.onerror = () => resolve(info.path)
        img.src = info.path
      })
  },

  /* ---------- 开始识别 ---------- */
  async startRecognize() {
    if (this.data.isRecognizing) return

    if (!this.data.imagePath) {
      wx.showToast({ title: '请先选择图片', icon: 'none' })
      return
    }

    try {
      wx.showLoading({ title: '压缩图片...', mask: true })
      this.setData({ isRecognizing: true, isCopied: false })

      // 1. 压缩图片
      const compressedPath = await this.compressImage(this.data.imagePath)

      // 2. 调用 OCR
      wx.showLoading({ title: '识别中...', mask: true })
      const text = await recognizeImage(compressedPath)

      this.setData({
        ocrResult: text,
        resultCharCount: text.length
      })
      recordToolUse('ocr', 'recognize')
    } catch (err) {
      const message = this.mapOcrError(err)
      wx.showToast({ title: message, icon: 'none', duration: 2500 })
    } finally {
      this.setData({ isRecognizing: false })
      wx.hideLoading()
    }
  },

  mapOcrError(err) {
    const message = String(err.message || err.errMsg || '')

    if (message.includes('request:fail')) {
      return '请在小程序后台配置合法域名 api.ocr.space'
    }
    if (message.includes('网络')) {
      return '网络错误，请检查连接'
    }
    if (message.includes('未识别')) {
      return '图片中未识别到文字'
    }
    return '识别失败，请重试'
  },

  /* ---------- 复制结果 ---------- */
  copyResult() {
    if (!this.data.ocrResult) {
      wx.showToast({ title: '无可复制的内容', icon: 'none' })
      return
    }

    wx.setClipboardData({
      data: this.data.ocrResult,
      success: () => {
        this.setData({ isCopied: true })
        wx.showToast({ title: '已复制到剪贴板', icon: 'success' })
        recordToolUse('ocr', 'copy')
      }
    })
  },

  /* ---------- 导出 Excel（占位） ---------- */
  showExportTip() {
    wx.showModal({
      title: '导出 Excel',
      content: 'Excel 导出功能将在后续版本中开放，敬请期待。',
      showCancel: false,
      confirmText: '知道了'
    })
  },

  /* ---------- 工具方法 ---------- */
  isCancelError(err) {
    const message = String((err && (err.errMsg || err.message)) || '')
    return message.includes('cancel')
  }
})