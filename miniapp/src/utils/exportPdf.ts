/**
 * 导出PDF工具函数（前端实现）
 * 使用Canvas绘制内容，然后使用pdf-lib生成PDF文件
 */

import Taro from '@tarojs/taro'
import { PDFDocument } from 'pdf-lib'

/**
 * 导出状态
 */
export type ExportStatus = 'idle' | 'exporting' | 'paused' | 'completed' | 'error'

/**
 * 导出进度回调
 */
export type ExportProgressCallback = (progress: number, status: string) => void

/**
 * 导出选项
 */
export interface ExportOptions {
  /** 进度回调 */
  onProgress?: ExportProgressCallback
  /** 是否暂停（初始值） */
  paused?: boolean
  /** 暂停回调 */
  onPause?: () => void
  /** 恢复回调 */
  onResume?: () => void
  /** 暂停状态ref（用于实时获取暂停状态） */
  pausedRef?: { current: boolean }
}

/**
 * 绘制文本（自动换行）
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  fontSize: number
): number {
  const words = text.split('')
  let line = ''
  let currentY = y

  for (let i = 0; i < words.length; i++) {
    const testLine = line + words[i]
    const metrics = ctx.measureText(testLine)
    const testWidth = metrics.width

    if (testWidth > maxWidth && i > 0) {
      ctx.fillText(line, x, currentY)
      line = words[i]
      currentY += lineHeight
    } else {
      line = testLine
    }
  }
  ctx.fillText(line, x, currentY)
  return currentY + lineHeight
}

/**
 * 将图片文件转换为 Uint8Array
 */
async function imageToBytes(imagePath: string): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    const fs = Taro.getFileSystemManager()
    fs.readFile({
      filePath: imagePath,
      success: (res) => {
        // 小程序 readFile 返回的是 ArrayBuffer
        const arrayBuffer = res.data as ArrayBuffer
        resolve(new Uint8Array(arrayBuffer))
      },
      fail: reject,
    })
  })
}

/**
 * 将 Uint8Array 转换为 base64（兼容小程序环境）
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  // 在小程序环境中，可能需要使用 Taro.arrayBufferToBase64
  if (typeof Taro.arrayBufferToBase64 === 'function') {
    // 确保 buffer 是 ArrayBuffer 类型
    const buffer = bytes.buffer instanceof ArrayBuffer 
      ? bytes.buffer 
      : bytes.buffer.slice(0, bytes.buffer.byteLength)
    return Taro.arrayBufferToBase64(buffer as ArrayBuffer)
  }
  // 降级方案：手动转换
  try {
    if (typeof btoa !== 'undefined') {
      return btoa(binary)
    }
  } catch (e) {
    console.warn('btoa 不可用，使用手动转换')
  }
  // 手动 base64 编码
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
  let result = ''
  let i = 0
  while (i < binary.length) {
    const a = binary.charCodeAt(i++)
    const b = i < binary.length ? binary.charCodeAt(i++) : 0
    const c = i < binary.length ? binary.charCodeAt(i++) : 0

    const bitmap = (a << 16) | (b << 8) | c
    result += chars.charAt((bitmap >> 18) & 63)
    result += chars.charAt((bitmap >> 12) & 63)
    result += i - 2 < binary.length ? chars.charAt((bitmap >> 6) & 63) : '='
    result += i - 1 < binary.length ? chars.charAt(bitmap & 63) : '='
  }
  return result
}

/**
 * 导出志愿方案（使用Canvas绘制 + pdf-lib生成PDF）
 */
export async function exportWishlistToPdf(
  groupedChoices: any,
  examInfo: any,
  options: ExportOptions = {}
): Promise<string> {
  const { onProgress } = options
  // 使用ref来获取最新的paused状态
  const pausedRef = options.pausedRef || { current: options.paused || false }

  try {
    onProgress?.(0, '正在初始化...')

    // 获取系统信息（使用新的 API）
    const windowInfo = await Taro.getWindowInfo()
    const deviceInfo = await Taro.getDeviceInfo()
    const windowWidth = windowInfo.windowWidth || 375
    // pixelRatio 在 deviceInfo 中，如果不存在则使用默认值
    const dpr = (deviceInfo as any).pixelRatio || windowInfo.pixelRatio || 2

    // Canvas 尺寸（A4比例，单位：rpx，需要转换为 px）
    const canvasWidth = 750 // rpx
    const canvasHeight = 1334 // rpx
    const canvasWidthPx = (canvasWidth / 750) * windowWidth * dpr
    const canvasHeightPx = (canvasHeight / 750) * windowWidth * dpr

    // 创建 Canvas 上下文
    const query = Taro.createSelectorQuery()
    const canvasId = 'exportCanvas'

    return new Promise((resolve, reject) => {
      query
        .select(`#${canvasId}`)
        .fields({ node: true, size: true })
        .exec(async (res) => {
          if (!res || !res[0] || !res[0].node) {
            reject(new Error('Canvas 初始化失败，请确保页面中包含导出Canvas元素'))
            return
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置 Canvas 实际尺寸
          canvas.width = canvasWidthPx
          canvas.height = canvasHeightPx

          onProgress?.(10, '正在绘制背景...')

          // 绘制背景（渐变蓝色）
          const gradient = ctx.createLinearGradient(0, 0, 0, canvasHeightPx)
          gradient.addColorStop(0, '#1A4099')
          gradient.addColorStop(1, '#2563eb')
          ctx.fillStyle = gradient
          ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)

          // 绘制标题
          ctx.fillStyle = '#FFFFFF'
          ctx.font = `bold ${30 * dpr}px sans-serif`
          ctx.textAlign = 'center'
          ctx.textBaseline = 'middle'
          ctx.fillText('志愿方案', canvasWidthPx / 2, 50 * dpr)

          // 绘制高考信息
          let currentY = 90 * dpr
          if (examInfo) {
            // 绘制"学生基本信息"标题
            ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
            ctx.font = `bold ${18 * dpr}px sans-serif`
            ctx.textAlign = 'left'
            ctx.textBaseline = 'top'
            ctx.fillText('学生基本信息', 40 * dpr, currentY)
            currentY += 28 * dpr

            // 绘制具体信息
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)'
            ctx.font = `${16 * dpr}px sans-serif`

            const examInfoText = [
              examInfo.province ? `省份: ${examInfo.province}` : '',
              examInfo.preferredSubjects ? `首选科目: ${examInfo.preferredSubjects}` : '',
              examInfo.secondarySubjects ? `次选科目: ${examInfo.secondarySubjects}` : '',
              examInfo.score ? `分数: ${examInfo.score}` : '',
              examInfo.rank ? `位次: ${examInfo.rank}` : '',
            ]
              .filter(Boolean)
              .join(' | ')

            if (examInfoText) {
              currentY = drawText(
                ctx,
                examInfoText,
                40 * dpr,
                currentY,
                canvasWidthPx - 80 * dpr,
                22 * dpr,
                16 * dpr
              )
              currentY += 20 * dpr
            }
          }

          onProgress?.(20, '正在绘制志愿内容...')

          // 存储所有页面的图片
          const pageImages: string[] = []

          // 绘制志愿列表
          if (groupedChoices?.volunteers && groupedChoices.volunteers.length > 0) {
            const volunteers = groupedChoices.volunteers.sort(
              (a: any, b: any) => (a.mgIndex ?? 999999) - (b.mgIndex ?? 999999)
            )

            const cardPadding = 24 * dpr
            const cardSpacing = 20 * dpr
            const startX = 40 * dpr
            const maxWidth = canvasWidthPx - startX * 2
            let pageStartY = 100 * dpr

            for (let i = 0; i < volunteers.length; i++) {
              // 检查是否暂停
              while (pausedRef.current) {
                await new Promise((resolve) => setTimeout(resolve, 100))
              }

              const volunteer = volunteers[i]
              const volunteerNumber = i + 1
              const school = volunteer.school

              onProgress?.(20 + (i / volunteers.length) * 70, `正在绘制志愿 ${volunteerNumber}...`)

              // 先计算内容高度（不绘制，用于判断是否需要新页面和确定卡片高度）
              let estimatedContentY = currentY + cardPadding + 32 * dpr // 志愿编号 + 间距
              
              // 估算学校名称高度
              if (school?.name) {
                const schoolNameLines = Math.ceil(
                  (ctx.measureText(school.name).width) / (maxWidth - cardPadding * 2)
                ) || 1
                estimatedContentY += schoolNameLines * 28 * dpr
              }

              // 估算专业组和专业高度
              if (volunteer.majorGroups && volunteer.majorGroups.length > 0) {
                estimatedContentY += 18 * dpr // 专业组间距
                for (const majorGroup of volunteer.majorGroups) {
                  const majorGroupName = majorGroup.majorGroup?.mgName || ''
                  if (majorGroupName) {
                    const mgLines = Math.ceil(
                      (ctx.measureText(`专业组: ${majorGroupName}`).width) / (maxWidth - cardPadding * 2)
                    ) || 1
                    estimatedContentY += mgLines * 25 * dpr
                  }
                  
                  if (majorGroup.choices && majorGroup.choices.length > 0) {
                    estimatedContentY += majorGroup.choices.length * (5 * dpr + 23 * dpr)
                  }
                }
              }
              
              const estimatedCardHeight = estimatedContentY - currentY + cardPadding
              const minCardHeight = 120 * dpr // 最小卡片高度

              // 检查是否需要新页面
              if (currentY + Math.max(estimatedCardHeight, minCardHeight) > canvasHeightPx - 50 * dpr) {
                // 导出当前页面
                onProgress?.(20 + (i / volunteers.length) * 60, '正在生成页面...')
                const pageImage = await new Promise<string>((resolvePage, rejectPage) => {
                  setTimeout(() => {
                    Taro.canvasToTempFilePath({
                      canvas: canvas,
                      fileType: 'png',
                      quality: 1,
                      success: (res) => resolvePage(res.tempFilePath),
                      fail: rejectPage,
                    })
                  }, 200)
                })
                pageImages.push(pageImage)

                // 清空画布，开始新页面
                ctx.fillStyle = gradient
                ctx.fillRect(0, 0, canvasWidthPx, canvasHeightPx)
                currentY = 50 * dpr
                pageStartY = 50 * dpr
              }

              // 记录卡片开始位置
              const cardStartY = currentY

              // 先计算实际内容高度（通过模拟绘制）
              let tempY = cardStartY + cardPadding + 32 * dpr // 志愿编号 + 间距
              
              // 设置字体以准确测量
              ctx.font = `bold ${18 * dpr}px sans-serif`
              if (school?.name) {
                const schoolLines = Math.ceil(
                  ctx.measureText(school.name).width / (maxWidth - cardPadding * 2)
                ) || 1
                tempY += schoolLines * 24 * dpr
              }

              if (volunteer.majorGroups && volunteer.majorGroups.length > 0) {
                tempY += 18 * dpr
                ctx.font = `${18 * dpr}px sans-serif`
                for (const majorGroup of volunteer.majorGroups) {
                  const majorGroupName = majorGroup.majorGroup?.mgName || ''
                  if (majorGroupName) {
                    const mgLines = Math.ceil(
                      ctx.measureText(`专业组: ${majorGroupName}`).width / (maxWidth - cardPadding * 2)
                    ) || 1
                    tempY += mgLines * 22 * dpr
                  }
                  
                  if (majorGroup.choices && majorGroup.choices.length > 0) {
                    ctx.font = `${16 * dpr}px sans-serif`
                    for (const choice of majorGroup.choices) {
                      if (choice.enrollmentMajor) {
                        tempY += 5 * dpr
                        const choiceLines = Math.ceil(
                          ctx.measureText(`  • ${choice.enrollmentMajor}`).width / (maxWidth - cardPadding * 2)
                        ) || 1
                        tempY += choiceLines * 20 * dpr
                      }
                    }
                  }
                }
              }

              // 计算实际卡片高度
              const actualCardHeight = tempY - cardStartY + cardPadding
              const finalCardHeight = Math.max(actualCardHeight, minCardHeight)

              // 先绘制志愿卡片背景（圆角矩形）
              ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
              const radius = 16 * dpr
              ctx.beginPath()
              ctx.moveTo(startX + radius, cardStartY)
              ctx.lineTo(startX + maxWidth - radius, cardStartY)
              ctx.quadraticCurveTo(startX + maxWidth, cardStartY, startX + maxWidth, cardStartY + radius)
              ctx.lineTo(startX + maxWidth, cardStartY + finalCardHeight - radius)
              ctx.quadraticCurveTo(startX + maxWidth, cardStartY + finalCardHeight, startX + maxWidth - radius, cardStartY + finalCardHeight)
              ctx.lineTo(startX + radius, cardStartY + finalCardHeight)
              ctx.quadraticCurveTo(startX, cardStartY + finalCardHeight, startX, cardStartY + finalCardHeight - radius)
              ctx.lineTo(startX, cardStartY + radius)
              ctx.quadraticCurveTo(startX, cardStartY, startX + radius, cardStartY)
              ctx.closePath()
              ctx.fill()

              // 然后绘制内容（会覆盖背景的相应部分）
              // 绘制志愿编号
              ctx.fillStyle = '#1A4099'
              ctx.font = `bold ${22 * dpr}px sans-serif`
              ctx.textAlign = 'left'
              ctx.textBaseline = 'top'
              ctx.fillText(`志愿${volunteerNumber}`, startX + cardPadding, cardStartY + cardPadding)

              // 绘制学校名称（增加与志愿编号的间距）
              let cardContentY = cardStartY + cardPadding + 28 * dpr
              ctx.fillStyle = '#333333'
              ctx.font = `bold ${18 * dpr}px sans-serif`
              if (school?.name) {
                cardContentY = drawText(
                  ctx,
                  school.name,
                  startX + cardPadding,
                  cardContentY,
                  maxWidth - cardPadding * 2,
                  24 * dpr,
                  18 * dpr
                )
              }

              // 绘制专业组（展开所有，增加与学校名称的间距）
              if (volunteer.majorGroups && volunteer.majorGroups.length > 0) {
                cardContentY += 18 * dpr
                ctx.fillStyle = '#666666'
                ctx.font = `${18 * dpr}px sans-serif`

                for (const majorGroup of volunteer.majorGroups) {
                  const majorGroupName = majorGroup.majorGroup?.mgName || ''
                  if (majorGroupName) {
                    cardContentY = drawText(
                      ctx,
                      `专业组: ${majorGroupName}`,
                      startX + cardPadding,
                      cardContentY,
                      maxWidth - cardPadding * 2,
                      22 * dpr,
                      18 * dpr
                    )
                  }

                  // 绘制专业列表（展开所有）
                  if (majorGroup.choices && majorGroup.choices.length > 0) {
                    const sortedChoices = [...majorGroup.choices].sort(
                      (a: any, b: any) => (a.majorIndex ?? 999999) - (b.majorIndex ?? 999999)
                    )

                    ctx.font = `${16 * dpr}px sans-serif`
                    ctx.fillStyle = '#333333'
                    for (const choice of sortedChoices) {
                      if (choice.enrollmentMajor) {
                        cardContentY += 5 * dpr
                        cardContentY = drawText(
                          ctx,
                          `  • ${choice.enrollmentMajor}`,
                          startX + cardPadding,
                          cardContentY,
                          maxWidth - cardPadding * 2,
                          20 * dpr,
                          16 * dpr
                        )
                      }
                    }
                  }
                }
              }

              // 更新位置
              currentY = cardStartY + finalCardHeight + cardSpacing
            }

            // 添加最后一页
            onProgress?.(90, '正在生成最后一页...')
            const lastPageImage = await new Promise<string>((resolvePage, rejectPage) => {
              setTimeout(() => {
                Taro.canvasToTempFilePath({
                  canvas: canvas,
                  fileType: 'png',
                  quality: 1,
                  success: (res) => resolvePage(res.tempFilePath),
                  fail: rejectPage,
                })
              }, 200)
            })
            pageImages.push(lastPageImage)
          } else {
            // 没有志愿数据
            ctx.fillStyle = '#FFFFFF'
            ctx.font = `bold ${22 * dpr}px sans-serif`
            ctx.textAlign = 'center'
            ctx.textBaseline = 'middle'
            ctx.fillText('暂无志愿数据', canvasWidthPx / 2, canvasHeightPx / 2)

            const pageImage = await new Promise<string>((resolvePage, rejectPage) => {
              setTimeout(() => {
                Taro.canvasToTempFilePath({
                  canvas: canvas,
                  fileType: 'png',
                  quality: 1,
                  success: (res) => resolvePage(res.tempFilePath),
                  fail: rejectPage,
                })
              }, 200)
            })
            pageImages.push(pageImage)
          }

          onProgress?.(95, '正在生成PDF...')

          // 使用 pdf-lib 将图片转换为 PDF
          // 注意：pdf-lib 在小程序环境中可能不完全兼容，如果失败会降级为图片格式
          try {
            // 检查 pdf-lib 是否可用
            if (typeof PDFDocument === 'undefined' || !PDFDocument.create) {
              throw new Error('PDF生成库不可用')
            }

            const pdfDoc = await PDFDocument.create()

            // 将每页图片添加到 PDF
            for (let i = 0; i < pageImages.length; i++) {
              const imagePath = pageImages[i]
              onProgress?.(95 + (i / pageImages.length) * 4, `正在处理第 ${i + 1}/${pageImages.length} 页...`)

              // 读取图片文件并转换为 bytes
              const imageBytes = await imageToBytes(imagePath)

              // 将图片添加到 PDF（尝试 PNG 格式）
              let image
              try {
                image = await pdfDoc.embedPng(imageBytes)
              } catch (pngError) {
                // 如果 PNG 失败，尝试 JPEG
                try {
                  image = await pdfDoc.embedJpg(imageBytes)
                } catch (jpgError) {
                  console.error('图片格式不支持:', pngError, jpgError)
                  throw new Error('图片格式不支持，无法生成PDF')
                }
              }

              // 添加新页面（A4 尺寸：595.28 x 841.89 points）
              const page = pdfDoc.addPage([595.28, 841.89])
              const { width, height } = page.getSize()

              // 计算图片尺寸，保持宽高比
              const imageDims = image.scale(1)
              const scaleX = width / imageDims.width
              const scaleY = height / imageDims.height
              const scale = Math.min(scaleX, scaleY)

              const scaledWidth = imageDims.width * scale
              const scaledHeight = imageDims.height * scale

              // 居中绘制图片
              const x = (width - scaledWidth) / 2
              const y = (height - scaledHeight) / 2

              page.drawImage(image, {
                x,
                y,
                width: scaledWidth,
                height: scaledHeight,
              })
            }

            // 生成 PDF bytes
            const pdfBytes = await pdfDoc.save()

            onProgress?.(99, '正在保存PDF文件...')

            // 将 PDF bytes 转换为 base64（兼容小程序环境）
            const pdfBase64 = uint8ArrayToBase64(pdfBytes)

            // 保存 PDF 文件
            const fileName = `志愿方案_${new Date().getTime()}.pdf`
            let tempDir = ''
            try {
              if (typeof Taro.env !== 'undefined' && Taro.env.USER_DATA_PATH) {
                tempDir = Taro.env.USER_DATA_PATH
              } else {
                tempDir = 'export'
              }
            } catch (e) {
              tempDir = 'export'
            }

            const tempFilePath = tempDir ? `${tempDir}/${fileName}` : fileName

            // 使用 Promise 保存 PDF 文件，然后 resolve 到外层
            const savedFilePath = await new Promise<string>((resolvePdf, rejectPdf) => {
              const fs = Taro.getFileSystemManager()

              if (tempDir) {
                // 检查目录是否存在，不存在则创建
                fs.access({
                  path: tempDir,
                  success: () => {
                    // 目录已存在，直接写入文件
                    writePdfFile()
                  },
                  fail: () => {
                    // 目录不存在，先创建目录
                    try {
                      fs.mkdirSync(tempDir, true)
                      writePdfFile()
                    } catch (mkdirError: any) {
                      // 如果创建失败，可能是并发创建导致目录已存在
                      const errorMsg = mkdirError?.errMsg || mkdirError?.message || String(mkdirError)
                      if (errorMsg.includes('already exists') || errorMsg.includes('已存在') || errorMsg.includes('file already exists')) {
                        // 目录已存在（可能是并发创建），直接写入
                        writePdfFile()
                      } else {
                        // 其他错误，尝试直接写入（可能父目录已存在）
                        console.warn('创建目录失败，尝试直接写入:', mkdirError)
                        writePdfFile()
                      }
                    }
                  },
                })
              } else {
                writePdfFile()
              }

              function writePdfFile() {
                fs.writeFile({
                  filePath: tempFilePath,
                  data: pdfBase64,
                  encoding: 'base64',
                  success: () => {
                    onProgress?.(100, '导出完成')
                    fs.access({
                      path: tempFilePath,
                      success: () => {
                        resolvePdf(tempFilePath)
                      },
                      fail: (err) => {
                        rejectPdf(new Error(`PDF文件保存失败，文件不存在: ${err.errMsg}`))
                      },
                    })
                  },
                  fail: (err) => {
                    console.error('保存PDF失败:', err)
                    rejectPdf(new Error(err.errMsg || '保存PDF失败'))
                  },
                })
              }
            })

            // PDF 保存成功，resolve 到外层 Promise
            resolve(savedFilePath)
          } catch (pdfError: any) {
            console.error('PDF生成失败:', pdfError)
            
            // 检查是否是 worker 相关错误（pdf-lib 在小程序中可能不兼容）
            const errorMsg = pdfError?.message || String(pdfError) || ''
            const isWorkerError = errorMsg.includes('worker') || 
                                   errorMsg.includes('reportRealtimeAction') ||
                                   errorMsg.includes('not support')
            
            if (isWorkerError || pageImages.length === 0) {
              // pdf-lib 在小程序环境中不兼容，降级为图片格式
              onProgress?.(100, '导出完成（图片格式）')
              Taro.showToast({
                title: 'PDF生成失败，已保存为图片格式',
                icon: 'none',
                duration: 3000,
              })
              // 返回第一张图片
              if (pageImages.length > 0) {
                resolve(pageImages[0])
              } else {
                reject(new Error('导出失败：无法生成文件'))
              }
            } else {
              // 其他错误，也降级为图片
              onProgress?.(100, '导出完成（图片格式）')
              Taro.showToast({
                title: 'PDF生成失败，已保存为图片',
                icon: 'none',
                duration: 3000,
              })
              resolve(pageImages[0])
            }
          }
        })
    })
  } catch (error: any) {
    throw new Error(error?.message || '导出失败')
  }
}
