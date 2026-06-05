function isRewardAdAvailable() {
  return false
}

function showRewardAd() {
  return Promise.reject(new Error('广告解锁暂未开放'))
}

function showUnavailableToast() {
  wx.showToast({
    title: '广告解锁暂未开放',
    icon: 'none'
  })
}

module.exports = {
  isRewardAdAvailable,
  showRewardAd,
  showUnavailableToast
}
