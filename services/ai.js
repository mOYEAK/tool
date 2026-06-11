const appConfig = require('../modules/app-config.js')

const DEFAULT_BASE_URL = 'https://api.openai.com/v1'
const DEFAULT_VISION_MODEL = 'gpt-4o'
const DEFAULT_TEXT_MODEL = 'gpt-3.5-turbo'

/**
 * 图片转 base64 data URL
 */
function imageToBase64Url(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      encoding: 'base64',
      success: (res) => {
        const ext = filePath.endsWith('.png') ? 'png' : 'jpeg'
        resolve(`data:image/${ext};base64,${res.data}`)
      },
      fail: reject
    })
  })
}

/**
 * 调用 OpenAI 兼容 API
 */
function callChatApi(messages, model, maxTokens) {
  return new Promise((resolve, reject) => {
    const apiKey = appConfig.aiApiKey
    const baseUrl = appConfig.aiBaseUrl || DEFAULT_BASE_URL

    if (!apiKey) {
      reject(new Error('请先配置 AI API Key'))
      return
    }

    wx.request({
      url: `${baseUrl}/chat/completions`,
      method: 'POST',
      header: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      data: {
        model,
        messages,
        max_tokens: maxTokens || 1000,
        temperature: 0.7
      },
      success: (res) => {
        if (res.statusCode === 200 && res.data && res.data.choices) {
          const content = res.data.choices[0].message.content
          resolve(content.trim())
        } else {
          const errMsg = (res.data && res.data.error && res.data.error.message) || `状态码 ${res.statusCode}`
          reject(new Error(errMsg))
        }
      },
      fail: (err) => {
        reject(new Error(`网络请求失败: ${err.errMsg || '未知错误'}`))
      }
    })
  })
}

/**
 * 图片分析：上传图片，AI 分析风格并生成提示词
 */
async function analyzeImage(imagePath) {
  const base64Url = await imageToBase64Url(imagePath)
  const model = appConfig.aiVisionModel || DEFAULT_VISION_MODEL

  return callChatApi([
    {
      role: 'system',
      content: '你是一个专业的 AI 绘画提示词分析师。分析用户上传的图片，描述其视觉风格、构图、色彩、光影、主体元素等特征，并生成一段可用于 Midjourney / Stable Diffusion 的英文提示词。用中文回复，格式：先简要分析风格，再给出提示词。'
    },
    {
      role: 'user',
      content: [
        { type: 'text', text: '请分析这张图片的风格并生成提示词。' },
        { type: 'image_url', image_url: { url: base64Url } }
      ]
    }
  ], model, 800)
}

/**
 * 文本生成：通用 AI 对话
 */
async function generateText(systemPrompt, userPrompt, maxTokens) {
  const model = appConfig.aiTextModel || DEFAULT_TEXT_MODEL

  return callChatApi([
    { role: 'system', content: systemPrompt },
    { role: 'user', content: userPrompt }
  ], model, maxTokens || 1000)
}

module.exports = {
  analyzeImage,
  generateText,
  DEFAULT_BASE_URL,
  DEFAULT_VISION_MODEL,
  DEFAULT_TEXT_MODEL
}