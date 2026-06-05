function asciiBytes(text) {
  const bytes = new Uint8Array(text.length)

  for (let i = 0; i < text.length; i += 1) {
    bytes[i] = text.charCodeAt(i) & 0xff
  }

  return bytes
}

function concatBytes(parts) {
  const normalizedParts = parts.map((part) => (
    part instanceof Uint8Array ? part : new Uint8Array(part)
  ))
  const totalLength = normalizedParts.reduce((sum, part) => sum + part.length, 0)
  const result = new Uint8Array(totalLength)
  let offset = 0

  normalizedParts.forEach((part) => {
    result.set(part, offset)
    offset += part.length
  })

  return result
}

function readFileArrayBuffer(filePath) {
  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().readFile({
      filePath,
      success: (res) => resolve(res.data),
      fail: reject
    })
  })
}

function writePdfFile(buffer) {
  const filePath = `${wx.env.USER_DATA_PATH}/toolbox-images-${Date.now()}.pdf`

  return new Promise((resolve, reject) => {
    wx.getFileSystemManager().writeFile({
      filePath,
      data: buffer,
      success: () => resolve(filePath),
      fail: reject
    })
  })
}

function buildPdf(imageItems) {
  const pageWidth = 595.28
  const pageHeight = 841.89
  const margin = 36
  const objects = []
  const pageObjectIds = []

  objects.push({
    id: 1,
    body: asciiBytes('<< /Type /Catalog /Pages 2 0 R >>')
  })

  imageItems.forEach((item, index) => {
    const pageId = 3 + index * 3
    const imageId = pageId + 1
    const contentId = pageId + 2
    const boxWidth = pageWidth - margin * 2
    const boxHeight = pageHeight - margin * 2
    const scale = Math.min(boxWidth / item.width, boxHeight / item.height)
    const drawWidth = item.width * scale
    const drawHeight = item.height * scale
    const drawX = (pageWidth - drawWidth) / 2
    const drawY = (pageHeight - drawHeight) / 2
    const content = [
      'q',
      `${drawWidth.toFixed(2)} 0 0 ${drawHeight.toFixed(2)} ${drawX.toFixed(2)} ${drawY.toFixed(2)} cm`,
      `/Im${index + 1} Do`,
      'Q'
    ].join('\n')

    pageObjectIds.push(pageId)
    objects.push({
      id: pageId,
      body: asciiBytes(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im${index + 1} ${imageId} 0 R >> >> /Contents ${contentId} 0 R >>`)
    })
    objects.push({
      id: imageId,
      body: concatBytes([
        asciiBytes(`<< /Type /XObject /Subtype /Image /Width ${item.width} /Height ${item.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${item.bytes.length} >>\nstream\n`),
        item.bytes,
        asciiBytes('\nendstream')
      ])
    })
    objects.push({
      id: contentId,
      body: asciiBytes(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`)
    })
  })

  objects.splice(1, 0, {
    id: 2,
    body: asciiBytes(`<< /Type /Pages /Kids [${pageObjectIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageObjectIds.length} >>`)
  })

  objects.sort((a, b) => a.id - b.id)

  const parts = [asciiBytes('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')]
  const offsets = [0]
  let offset = parts[0].length

  objects.forEach((object) => {
    const objectBytes = concatBytes([
      asciiBytes(`${object.id} 0 obj\n`),
      object.body,
      asciiBytes('\nendobj\n')
    ])

    offsets[object.id] = offset
    parts.push(new Uint8Array(objectBytes))
    offset += objectBytes.byteLength
  })

  const xrefOffset = offset
  const xrefLines = ['xref', `0 ${objects.length + 1}`, '0000000000 65535 f ']

  for (let id = 1; id <= objects.length; id += 1) {
    xrefLines.push(`${String(offsets[id]).padStart(10, '0')} 00000 n `)
  }

  const trailer = [
    xrefLines.join('\n'),
    `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>`,
    'startxref',
    String(xrefOffset),
    '%%EOF'
  ].join('\n')

  parts.push(asciiBytes(trailer))

  return concatBytes(parts)
}

async function createPdfFromJpegs(jpegItems) {
  const imageItems = []

  for (const item of jpegItems) {
    const buffer = await readFileArrayBuffer(item.path)

    imageItems.push({
      width: item.width,
      height: item.height,
      bytes: new Uint8Array(buffer)
    })
  }

  const pdfBuffer = buildPdf(imageItems).buffer

  return writePdfFile(pdfBuffer)
}

module.exports = {
  createPdfFromJpegs
}
