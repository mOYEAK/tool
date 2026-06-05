Page({
  copyEmail() {
    wx.setClipboardData({
      data: 'support@example.com',
      success: () => {
        wx.showToast({
          title: '已复制',
          icon: 'success'
        })
      }
    })
  },

  showComingSoon() {
    wx.showToast({
      title: '暂未开放',
      icon: 'none'
    })
  }
})
