const { ensureAlbumPermission, saveImageToAlbum } = require('../../utils/album.js')

const STORAGE_KEY = 'toolbox_receipt_maker_draft'

function createDefaultItem() {
  return {
    id: `${Date.now()}_${Math.random()}`,
    name: '',
    quantity: '1',
    price: '',
    subtotal: 0,
    subtotalText: '0.00'
  }
}

Page({
  data: {
    docType: 'quote',
    shopName: '',
    clientName: '',
    date: '',
    remark: '',
    items: [createDefaultItem()],
    total: 0,
    totalText: '0.00',
    resultPath: '',
    isGenerating: false,
    isSaving: false
  },

  onLoad() {
    const draft = wx.getStorageSync(STORAGE_KEY)

    if (draft) {
      const items = this.recalculateItems(draft.items && draft.items.length ? draft.items : [createDefaultItem()])
      const total = this.calculateTotal(items)

      this.setData({
        docType: draft.docType || 'quote',
        shopName: draft.shopName || '',
        clientName: draft.clientName || '',
        date: draft.date || this.getToday(),
        remark: draft.remark || '',
        items,
        total,
        totalText: this.formatMoney(total)
      })
      return
    }

    this.setData({
      date: this.getToday()
    })
  },

  changeDocType(e) {
    this.setData({
      docType: e.currentTarget.dataset.type,
      resultPath: ''
    }, () => this.saveDraft())
  },

  onFieldInput(e) {
    const field = e.currentTarget.dataset.field

    this.setData({
      [field]: e.detail.value,
      resultPath: ''
    }, () => this.saveDraft())
  },

  onItemInput(e) {
    const index = e.currentTarget.dataset.index
    const field = e.currentTarget.dataset.field
    const items = this.data.items.slice()

    items[index][field] = e.detail.value
    this.updateItems(items)
  },

  addItem() {
    const items = this.data.items.concat(createDefaultItem())

    this.updateItems(items)
  },

  deleteItem(e) {
    const index = e.currentTarget.dataset.index
    const items = this.data.items.slice()

    items.splice(index, 1)
    this.updateItems(items.length ? items : [createDefaultItem()])
  },

  updateItems(items) {
    const nextItems = this.recalculateItems(items)
    const total = this.calculateTotal(nextItems)

    this.setData({
      items: nextItems,
      total,
      totalText: this.formatMoney(total),
      resultPath: ''
    }, () => this.saveDraft())
  },

  recalculateItems(items) {
    return items.map((item) => {
      const quantity = Number(item.quantity) || 0
      const price = Number(item.price) || 0
      const subtotal = quantity * price

      return {
        ...item,
        subtotal,
        subtotalText: this.formatMoney(subtotal)
      }
    })
  },

  calculateTotal(items) {
    return items.reduce((sum, item) => sum + item.subtotal, 0)
  },

  async generateReceiptImage() {
    if (this.data.isGenerating) {
      return
    }

    if (!this.validateForm()) {
      return
    }

    try {
      wx.showLoading({
        title: '生成中...',
        mask: true
      })
      this.setData({ isGenerating: true })

      const resultPath = await this.drawReceiptImage()

      this.setData({ resultPath })
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

  validateForm() {
    if (!this.data.shopName.trim()) {
      wx.showToast({
        title: '请填写店名',
        icon: 'none'
      })
      return false
    }

    const validItems = this.data.items.filter((item) => item.name.trim() && Number(item.quantity) > 0 && Number(item.price) >= 0)

    if (!validItems.length) {
      wx.showToast({
        title: '请填写项目明细',
        icon: 'none'
      })
      return false
    }

    return true
  },

  async drawReceiptImage() {
    const canvas = await this.getCanvas()
    const ctx = canvas.getContext('2d')
    const width = 1080
    const validItems = this.data.items.filter((item) => item.name.trim())
    const height = Math.max(1400, 820 + validItems.length * 92 + (this.data.remark ? 120 : 0))

    canvas.width = width
    canvas.height = height

    ctx.fillStyle = '#F7F8FA'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#FFFFFF'
    this.fillRoundRect(ctx, 60, 60, width - 120, height - 120, 28)

    ctx.fillStyle = '#111111'
    ctx.font = 'bold 56px sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(this.data.docType === 'quote' ? '报价单' : '收据', width / 2, 160)

    ctx.font = '30px sans-serif'
    ctx.textAlign = 'left'
    this.drawInfoLine(ctx, '开具方', this.data.shopName, 110, 250)
    this.drawInfoLine(ctx, '客户名', this.data.clientName || '-', 110, 304)
    this.drawInfoLine(ctx, '日期', this.data.date || '-', 110, 358)

    let y = 450

    ctx.fillStyle = '#EEF4FF'
    ctx.fillRect(100, y - 48, width - 200, 68)
    ctx.fillStyle = '#333333'
    ctx.font = 'bold 28px sans-serif'
    ctx.fillText('项目', 126, y - 6)
    ctx.textAlign = 'right'
    ctx.fillText('数量', 650, y - 6)
    ctx.fillText('单价', 800, y - 6)
    ctx.fillText('小计', 954, y - 6)

    y += 54
    ctx.font = '28px sans-serif'

    validItems.forEach((item) => {
      ctx.textAlign = 'left'
      ctx.fillStyle = '#111111'
      this.drawEllipsisText(ctx, item.name || '-', 126, y, 390)
      ctx.textAlign = 'right'
      ctx.fillText(String(item.quantity || 0), 650, y)
      ctx.fillText(this.formatMoney(Number(item.price) || 0), 800, y)
      ctx.fillText(this.formatMoney(item.subtotal), 954, y)
      ctx.strokeStyle = '#EEF0F3'
      ctx.beginPath()
      ctx.moveTo(100, y + 30)
      ctx.lineTo(width - 100, y + 30)
      ctx.stroke()
      y += 92
    })

    y += 28
    ctx.textAlign = 'right'
    ctx.fillStyle = '#111111'
    ctx.font = 'bold 44px sans-serif'
    ctx.fillText(`合计：￥${this.data.totalText}`, 954, y)

    if (this.data.remark.trim()) {
      y += 82
      ctx.textAlign = 'left'
      ctx.font = '28px sans-serif'
      ctx.fillStyle = '#666666'
      this.drawWrappedText(ctx, `备注：${this.data.remark.trim()}`, 110, y, width - 220, 42)
    }

    ctx.textAlign = 'center'
    ctx.fillStyle = '#B8C0CC'
    ctx.font = '24px sans-serif'
    ctx.fillText('本单据由万能工具箱生成，仅作记录与沟通参考', width / 2, height - 120)

    return this.canvasToTempFilePath(canvas, width, height)
  },

  drawInfoLine(ctx, label, value, x, y) {
    ctx.fillStyle = '#8A8F99'
    ctx.textAlign = 'left'
    ctx.fillText(`${label}：`, x, y)
    ctx.fillStyle = '#111111'
    ctx.fillText(value, x + 112, y)
  },

  drawEllipsisText(ctx, text, x, y, maxWidth) {
    let output = text

    while (ctx.measureText(output).width > maxWidth && output.length > 1) {
      output = `${output.slice(0, -2)}…`
    }

    ctx.fillText(output, x, y)
  },

  drawWrappedText(ctx, text, x, y, maxWidth, lineHeight) {
    let line = ''

    text.split('').forEach((char) => {
      const testLine = line + char

      if (ctx.measureText(testLine).width > maxWidth && line) {
        ctx.fillText(line, x, y)
        line = char
        y += lineHeight
      } else {
        line = testLine
      }
    })

    if (line) {
      ctx.fillText(line, x, y)
    }
  },

  async saveResult() {
    if (this.data.isSaving || !this.data.resultPath) {
      return
    }

    try {
      wx.showLoading({
        title: '保存中...',
        mask: true
      })
      this.setData({ isSaving: true })

      await ensureAlbumPermission()
      await saveImageToAlbum(this.data.resultPath)

      wx.showToast({
        title: '保存成功',
        icon: 'success'
      })
    } catch (err) {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    } finally {
      this.setData({ isSaving: false })
      wx.hideLoading()
    }
  },

  clearForm() {
    wx.showModal({
      title: '清空表单',
      content: '确定清空当前草稿吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        wx.removeStorageSync(STORAGE_KEY)
        this.setData({
          docType: 'quote',
          shopName: '',
          clientName: '',
          date: this.getToday(),
          remark: '',
          items: [createDefaultItem()],
          total: 0,
          totalText: '0.00',
          resultPath: ''
        })
      }
    })
  },

  saveDraft() {
    wx.setStorageSync(STORAGE_KEY, {
      docType: this.data.docType,
      shopName: this.data.shopName,
      clientName: this.data.clientName,
      date: this.data.date,
      remark: this.data.remark,
      items: this.data.items
    })
  },

  getToday() {
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
  },

  formatMoney(value) {
    return (Number(value) || 0).toFixed(2)
  },

  getCanvas() {
    return new Promise((resolve, reject) => {
      wx.createSelectorQuery()
        .in(this)
        .select('#receiptCanvas')
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
        quality: 0.95,
        success: (res) => resolve(res.tempFilePath),
        fail: reject
      })
    })
  },

  roundRect(ctx, x, y, width, height, radius) {
    const r = Math.min(radius, width / 2, height / 2)

    ctx.beginPath()
    ctx.moveTo(x + r, y)
    ctx.lineTo(x + width - r, y)
    ctx.quadraticCurveTo(x + width, y, x + width, y + r)
    ctx.lineTo(x + width, y + height - r)
    ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height)
    ctx.lineTo(x + r, y + height)
    ctx.quadraticCurveTo(x, y + height, x, y + height - r)
    ctx.lineTo(x, y + r)
    ctx.quadraticCurveTo(x, y, x + r, y)
    ctx.closePath()
  },

  fillRoundRect(ctx, x, y, width, height, radius) {
    this.roundRect(ctx, x, y, width, height, radius)
    ctx.fill()
  }
})
