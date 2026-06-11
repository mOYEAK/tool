const appConfig = require('../modules/app-config.js')

const BAIDU_TOKEN_URL = 'https://aip.baidubce.com/oauth/2.0/token'
const BAIDU_SEG_URL = 'https://aip.baidubce.com/rest/2.0/image-classify/v1/body_seg'

// 缓存 token，避免每次都请求
let cachedToken = null
let tokenExpireTime = 0

/**
 * 图片转 base64
 */
function imageToBase64(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

/**
 * base64 转临时文件路径
 */
function base64ToTempFile(base64Data) {
  return new Promise((resolve, reject) => {
    const filePath = `${wx.env.USER_DATA_PATH}/portrait_fg_${Date.now()}.png`

    wx.getFileSystemManager().writeFile({
      filePath,
      data: base64Data,
      encoding: 'base64',
      success: () => resolve(filePath),
      fail: reject
    })
  })
}

/**
 * 获取百度 access_token
 */
function getAccessToken() {
  return new Promise((resolve, reject) => {
    // 检查缓存
    if (cachedToken && Date.now() < tokenExpireTime) {
      resolve(cachedToken)
      return
    }

    const apiKey = appConfig.baiduApiKey
    const secretKey = appConfig.baiduSecretKey

    if (!apiKey || !secretKey) {
      reject(new Error('请先配置百度 AI API Key 和 Secret Key'))
      return
    }

    wx.request({
      url: `${BAIDU_TOKEN_URL}?grant_type=client_credentials&client_id=${apiKey}&client_secret=${secretKey}`,
      method: 'POST',
      header: { 'Content-Type': 'application/json' },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.access_token) {
          cachedToken = res.data.access_token
          // 提前 10 分钟过期
          tokenExpireTime = Date.now() + (res.data.expires_in - 600) * 1000
          resolve(cachedToken)
        } else {
          reject(new Error(res.data.error_description || '获取 access_token 失败'))
        }
      },
      fail: (err) => {
        reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`))
      }
    })
  })
}

/**
 * 调用百度人像分割 API
 * @returns {Promise<{ foreground: string, labelmap: string }>}
 */
function callBodySeg(base64Image) {
  return new Promise((resolve, reject) => {
    getAccessToken().then((token) => {
      wx.request({
        url: `${BAIDU_SEG_URL}?access_token=${token}`,
        method: 'POST',
        header: { 'Content-Type': 'application/x-www-form-urlencoded' },
        data: {
          image: base64Image
        },
        success: (res) => {
          if (res.statusCode === 200 && res.data) {
            if (res.data.error_code) {
              reject(new Error(res.data.error_msg || `人像分割失败 (code: ${res.data.error_code})`))
            } else {
              resolve(res.data)
            }
          } else {
            reject(new Error(`API 返回状态码 ${res.statusCode}`))
          }
        },
        fail: (err) => {
          reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`))
        }
      })
    }).catch(reject)
  })
}

/**
 * 主入口：人像分割，返回前景图临时路径
 * @param {string} imagePath - 已压缩的图片路径
 * @returns {Promise<{ foregroundPath: string, personNum: number }>}
 */
async function segmentPortrait(imagePath) {
  // 1. 转 base64
  const base64 = await imageToBase64(imagePath)

  // 2. 调用人像分割
  const result = await callBodySeg(base64)

  if (!result.foreground) {
    throw new Error('人像分割结果为空')
  }

  // 3. 前景图 base64 → 临时文件
  const foregroundPath = await base64ToTempFile(result.foreground)

  return {
    foregroundPath,
    personNum: result.person_num || 0
  }
}

module.exports = {
  segmentPortrait
}