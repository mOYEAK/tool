const STORAGE_KEY = 'toolbox_name_picker_state'

Page({
  data: {
    nameText: '',
    nameList: [],
    pickCount: 1,
    resultList: []
  },

  onLoad() {
    const savedState = wx.getStorageSync(STORAGE_KEY)

    if (savedState) {
      const nameText = savedState.nameText || ''
      const nameList = this.parseNames(nameText)

      this.setData({
        nameText,
        nameList,
        pickCount: this.normalizeCount(savedState.pickCount || 1, nameList.length)
      })
    }
  },

  onNameInput(e) {
    const nameText = e.detail.value
    const nameList = this.parseNames(nameText)
    const pickCount = this.normalizeCount(this.data.pickCount, nameList.length)

    this.setData({
      nameText,
      nameList,
      pickCount,
      resultList: []
    }, () => {
      this.saveState()
    })
  },

  onPickCountInput(e) {
    this.setData({
      pickCount: e.detail.value,
      resultList: []
    })
  },

  normalizePickCount() {
    this.setData({
      pickCount: this.normalizeCount(this.data.pickCount, this.data.nameList.length)
    }, () => {
      this.saveState()
    })
  },

  decreasePickCount() {
    const pickCount = this.normalizeCount(Number(this.data.pickCount) - 1, this.data.nameList.length)

    this.setData({
      pickCount,
      resultList: []
    }, () => {
      this.saveState()
    })
  },

  increasePickCount() {
    const pickCount = this.normalizeCount(Number(this.data.pickCount) + 1, this.data.nameList.length)

    this.setData({
      pickCount,
      resultList: []
    }, () => {
      this.saveState()
    })
  },

  pickNames() {
    const nameList = this.data.nameList
    const pickCount = this.normalizeCount(this.data.pickCount, nameList.length)

    if (!nameList.length) {
      wx.showToast({
        title: '请先输入名单',
        icon: 'none'
      })
      return
    }

    const shuffled = nameList.slice()

    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1))
      const temp = shuffled[i]

      shuffled[i] = shuffled[j]
      shuffled[j] = temp
    }

    this.setData({
      pickCount,
      resultList: shuffled.slice(0, pickCount)
    }, () => {
      this.saveState()
    })
  },

  copyResult() {
    if (!this.data.resultList.length) {
      return
    }

    wx.setClipboardData({
      data: this.data.resultList.join('\n'),
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

  clearNames() {
    wx.showModal({
      title: '清空名单',
      content: '确定清空当前名单和抽取结果吗？',
      success: (res) => {
        if (!res.confirm) {
          return
        }

        this.setData({
          nameText: '',
          nameList: [],
          pickCount: 1,
          resultList: []
        }, () => {
          wx.removeStorageSync(STORAGE_KEY)
        })
      }
    })
  },

  parseNames(text) {
    const seen = {}

    return text
      .split(/\r?\n/)
      .map((item) => item.trim())
      .filter((item) => item)
      .filter((item) => {
        if (seen[item]) {
          return false
        }

        seen[item] = true
        return true
      })
  },

  normalizeCount(value, maxCount) {
    const numberValue = parseInt(value, 10) || 1
    const upperLimit = Math.max(1, maxCount || 1)

    return Math.min(Math.max(1, numberValue), upperLimit)
  },

  saveState() {
    wx.setStorageSync(STORAGE_KEY, {
      nameText: this.data.nameText,
      pickCount: this.normalizeCount(this.data.pickCount, this.data.nameList.length)
    })
  }
})
