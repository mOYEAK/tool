function isPaymentAvailable() {
  return false
}

function requestPayment() {
  return Promise.reject(new Error('支付功能暂未开放'))
}

function showUnavailableToast() {
  wx.showToast({
    title: '支付功能暂未开放',
    icon: 'none'
  })
}

module.exports = {
  isPaymentAvailable,
  requestPayment,
  showUnavailableToast
}
