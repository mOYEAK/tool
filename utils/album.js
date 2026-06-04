function getSetting() {
  return new Promise((resolve, reject) => {
    wx.getSetting({
      success: resolve,
      fail: reject
    })
  })
}

function authorize(scope) {
  return new Promise((resolve, reject) => {
    wx.authorize({
      scope,
      success: resolve,
      fail: reject
    })
  })
}

function showOpenSettingModal() {
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
}

function openSetting() {
  return new Promise((resolve, reject) => {
    wx.openSetting({
      success: resolve,
      fail: reject
    })
  })
}

async function ensureAlbumPermission() {
  const setting = await getSetting()
  const authSetting = setting.authSetting || {}
  const scope = 'scope.writePhotosAlbum'

  if (authSetting[scope]) {
    return
  }

  if (authSetting[scope] === false) {
    await showOpenSettingModal()
    const nextSetting = await openSetting()

    if (!nextSetting.authSetting || !nextSetting.authSetting[scope]) {
      throw new Error('未授权保存相册')
    }

    return
  }

  await authorize(scope)
}

function saveImageToAlbum(filePath) {
  return new Promise((resolve, reject) => {
    wx.saveImageToPhotosAlbum({
      filePath,
      success: resolve,
      fail: reject
    })
  })
}

module.exports = {
  ensureAlbumPermission,
  saveImageToAlbum
}
