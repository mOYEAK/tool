const appConfig = require('../modules/app-config.js')

const DEFAULT_API_KEY = 'helloworld'
const DEFAULT_API_URL = 'https://api.ocr.space/parse/image'

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
 * 调用 OCR.space API 识别文字
 */
function callOcrApi(base64Image, fileType) {
  return new Promise((resolve, reject) => {
    const apiKey = appConfig.ocrApiKey || DEFAULT_API_KEY
    const apiUrl = appConfig.ocrApiUrl || DEFAULT_API_URL

    wx.request({
      url: apiUrl,
      method: 'POST',
      header: {
        'apikey': apiKey,
        'Content-Type': 'application/json'
      },
      data: {
        base64Image: `data:image/${fileType};base64,${base64Image}`,
        language: 'chs',
        isOverlayRequired: false,
        OCREngine: 2
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data) {
          resolve(res.data)
        } else {
          reject(new Error(`API 返回状态码 ${res.statusCode}`))
        }
      },
      fail: (err) => {
        reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`))
      }
    })
  })
}

/**
 * 解析 OCR 响应
 */
function parseOcrResult(response) {
  if (response.IsErroredOnProcessing) {
    throw new Error(response.ErrorMessage || 'OCR 处理出错')
  }

  if (response.OCRExitCode !== 1) {
    throw new Error(response.ErrorMessage || `OCR 识别失败 (code: ${response.OCRExitCode})`)
  }

  const results = response.ParsedResults || []

  if (results.length === 0) {
    throw new Error('未识别到任何文字')
  }

  return results
    .filter((item) => item.ParsedText && item.ParsedText.trim())
    .map((item) => (item.ParsedText || '').trim())
    .join('\n---\n')
}

/**
 * 主入口：识别图片中的文字
 * @param {string} imagePath - 已压缩的图片临时路径
 * @returns {Promise<string>} 识别出的文字
 */
async function recognizeImage(imagePath) {
  const base64 = await imageToBase64(imagePath)
  const fileType = imagePath.endsWith('.png') ? 'png' : 'jpeg'
  const response = await callOcrApi(base64, fileType)
  const text = parseOcrResult(response)

  if (!text) {
    throw new Error('图片中未识别到文字')
  }

  return text
}

module.exports = {
  recognizeImage,
  DEFAULT_API_KEY,
  DEFAULT_API_URL
}