/**
 * 纯 Canvas 静态词云：无动画、无 setInterval，一次绘制完成。
 * 自由布局、无重叠，柔和配色（蓝绿/珊瑚粉），字号层次。
 */
import React, { useEffect, useRef, useState } from 'react'
import { View, Text, Canvas, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { Portrait } from '@/services/portraits'

const CANVAS_ID = 'personalProfileWordCloudCanvas'
const CANVAS_HIT_BOX_ID = 'personalProfileWordCloudHitBox'

// 醒目配色：饱和度高、白底上清晰可读
const COLORS = [
  '#1A56DB', '#0D9488', '#7C3AED', '#DC2626', '#DB2777', '#0369A1',
  '#059669', '#9333EA', '#EA580C', '#4F46E5', '#BE185D', '#0F766E',
]

function getDisplayName (p: Portrait): string {
  if (p == null) return ''
  const name = p.name ?? (p as any).status ?? (p as any).partOneMainTitle
  const s = name != null && typeof name === 'string' ? String(name).trim() : ''
  return s || (p.id != null ? `画像-${p.id}` : '')
}

const MAX_ROTATION_RAD = (10 * Math.PI) / 180

/** 随机倾斜，所有画像斜度不超过 10 度（显式钳制） */
function getRandomRotation (_cy: number, _ch: number): number {
  const r = (Math.random() - 0.5) * 2 * MAX_ROTATION_RAD
  return Math.max(-MAX_ROTATION_RAD, Math.min(MAX_ROTATION_RAD, r))
}

/** 旋转后的矩形 AABB */
function getAABB (cx: number, cy: number, w: number, h: number, angle: number) {
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  const hw = w / 2
  const hh = h / 2
  const corners = [
    [hw * cos - hh * sin, hw * sin + hh * cos],
    [-hw * cos - hh * sin, -hw * sin + hh * cos],
    [-hw * cos + hh * sin, -hw * sin - hh * cos],
    [hw * cos + hh * sin, hw * sin - hh * cos],
  ]
  let minX = cx + corners[0][0]
  let maxX = minX
  let minY = cy + corners[0][1]
  let maxY = minY
  for (let i = 1; i < 4; i++) {
    const x = cx + corners[i][0]
    const y = cy + corners[i][1]
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function aabbOverlap (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }): boolean {
  const pad = 4
  return a.x < b.x + b.w + pad && a.x + a.w + pad > b.x && a.y < b.y + b.h + pad && a.y + a.h + pad > b.y
}

interface WordInput {
  text: string
  size: number
  colorIndex: number
  portraitIndex: number
}

interface PlacedWord {
  x: number
  y: number
  angle: number
  text: string
  size: number
  colorIndex: number
  portraitIndex: number
  w: number
  h: number
}

/** 用于点击检测：canvas 坐标系下的 AABB */
export interface PlacedWordHit {
  portraitIndex: number
  aabb: { x: number; y: number; w: number; h: number }
}

const MIN_FONT_SIZE = 12
const MAX_FONT_Q1 = 42
const MIN_FONT_Q1 = 22
const MAX_FONT_OTHER = 24
const MIN_FONT_OTHER = 12

/** 根据画布大小和画像数量计算字号与是否紧凑 */
function getFontSizes (cw: number, ch: number, count: number) {
  const area = cw * ch
  const areaPerWord = count > 0 ? area / count : area
  const base = Math.sqrt(areaPerWord) * 0.45
  const isCompact = count > 10
  const sizeQ1 = Math.round(Math.min(MAX_FONT_Q1, Math.max(MIN_FONT_Q1, base * 1.6)))
  const sizeOther = Math.round(Math.min(MAX_FONT_OTHER, Math.max(MIN_FONT_OTHER, base * 0.75)))
  return {
    sizeQ1: isCompact ? Math.max(MIN_FONT_Q1, Math.round(sizeQ1 * 0.85)) : sizeQ1,
    sizeOther: isCompact ? Math.max(MIN_FONT_OTHER, Math.round(sizeOther * 0.85)) : sizeOther,
    compact: isCompact,
  }
}

function placeWords (
  ctx: CanvasRenderingContext2D,
  words: WordInput[],
  cw: number,
  ch: number,
  compact = false
): PlacedWord[] {
  const padding = compact ? 8 : 12
  const gap = compact ? 4 : 6
  const centerX = cw / 2
  const centerY = ch * 0.38
  const placed: PlacedWord[] = []
  const maxW = cw - 2 * padding
  const maxH = ch - 2 * padding
  // 保底放置的共享游标：从底部从左往右、换行往上（螺旋/随机可占满画布，保底只填空隙）
  let fallbackX = padding
  let fallbackY = ch - padding
  let fallbackRowMaxH = 0

  const fontFamily = 'KaiTi, "楷体", "STKaiti", "华文楷体", serif'
  for (const word of words) {
    let fontSize = word.size
    ctx.font = `bold ${fontSize}px ${fontFamily}`
    let m = ctx.measureText(word.text)
    let w = m.width + 1
    let h = fontSize * 1.08
    // 若单字过宽，缩小字号直至能放进画布
    while (w > maxW && fontSize > MIN_FONT_SIZE) {
      fontSize = Math.max(MIN_FONT_SIZE, Math.floor(fontSize * 0.85))
      ctx.font = `bold ${fontSize}px ${fontFamily}`
      m = ctx.measureText(word.text)
      w = m.width + 1
      h = fontSize * 1.08
    }
    const effectiveSize = fontSize

    let placedThis = false
    const maxAngle = 32 * Math.PI
    const angleStep = compact ? 0.03 : 0.04
    const rStep = compact ? 1.0 : 1.2

    for (let angle = 0; angle < maxAngle && !placedThis; angle += angleStep) {
      const r = rStep * Math.sqrt(angle)
      const cx = centerX + r * Math.cos(angle)
      const cy = centerY + r * Math.sin(angle)

      const rot = getRandomRotation(cy, ch)
      const aabb = getAABB(cx, cy, w, h, rot)
      if (aabb.x < padding || aabb.y < padding || aabb.x + aabb.w > cw - padding || aabb.y + aabb.h > ch - padding) continue

      let overlap = false
      for (const p of placed) {
        const paabb = getAABB(p.x, p.y, p.w, p.h, p.angle)
        if (aabbOverlap(aabb, paabb)) {
          overlap = true
          break
        }
      }
      if (overlap) continue

      placed.push({
        x: cx,
        y: cy,
        angle: rot,
        text: word.text,
        size: effectiveSize,
        colorIndex: word.colorIndex,
        portraitIndex: word.portraitIndex,
        w,
        h,
      })
      placedThis = true
    }

    if (!placedThis) {
      for (let attempt = 0; attempt < 1200 && !placedThis; attempt++) {
        const cx = padding + Math.random() * (cw - 2 * padding)
        const cy = padding + Math.random() * (ch - 2 * padding)
        const rot = getRandomRotation(cy, ch)
        const aabb = getAABB(cx, cy, w, h, rot)
        if (aabb.x < padding || aabb.y < padding || aabb.x + aabb.w > cw - padding || aabb.y + aabb.h > ch - padding) continue
        let overlap = false
        for (const p of placed) {
          const paabb = getAABB(p.x, p.y, p.w, p.h, p.angle)
          if (aabbOverlap(aabb, paabb)) {
            overlap = true
            break
          }
        }
        if (!overlap) {
          placed.push({ x: cx, y: cy, angle: rot, text: word.text, size: effectiveSize, colorIndex: word.colorIndex, portraitIndex: word.portraitIndex, w, h })
          placedThis = true
        }
      }
    }

    // 保底：底部区域按行从下往上、从左到右放置，与已放置词不重叠
    if (!placedThis) {
      const fallbackGap = compact ? 6 : 10
      const maxFallbackAttempts = 500
      let attempts = 0
      while (!placedThis && attempts < maxFallbackAttempts) {
        attempts++
        if (fallbackX + w > cw - padding) {
          fallbackX = padding
          fallbackY -= (fallbackRowMaxH + fallbackGap)
          fallbackRowMaxH = 0
        }
        if (fallbackY - h < padding) break
        const finalCx = fallbackX + w / 2
        const finalCy = fallbackY - h / 2
        const fallbackRot = getRandomRotation(finalCy, ch)
        const aabb = getAABB(finalCx, finalCy, w, h, fallbackRot)
        let overlap = false
        for (const p of placed) {
          const paabb = getAABB(p.x, p.y, p.w, p.h, p.angle)
          if (aabbOverlap(aabb, paabb)) {
            overlap = true
            break
          }
        }
        if (!overlap && aabb.y >= padding && aabb.y + aabb.h <= ch - padding) {
          placed.push({
            x: finalCx,
            y: finalCy,
            angle: fallbackRot,
            text: word.text,
            size: effectiveSize,
            colorIndex: word.colorIndex,
            portraitIndex: word.portraitIndex,
            w,
            h,
          })
          placedThis = true
          fallbackRowMaxH = Math.max(fallbackRowMaxH, aabb.h)
          fallbackX += w + fallbackGap
          if (fallbackX >= cw - padding) {
            fallbackX = padding
            fallbackY -= (fallbackRowMaxH + fallbackGap)
            fallbackRowMaxH = 0
          }
        } else {
          fallbackX += w + fallbackGap
          if (fallbackX >= cw - padding) {
            fallbackX = padding
            fallbackY -= (fallbackRowMaxH + fallbackGap)
            fallbackRowMaxH = 0
          }
        }
      }
      if (!placedThis) {
        const finalCx = fallbackX + w / 2
        const finalCy = fallbackY - h / 2
        const fallbackRot = getRandomRotation(finalCy, ch)
        placed.push({
          x: finalCx,
          y: finalCy,
          angle: fallbackRot,
          text: word.text,
          size: effectiveSize,
          colorIndex: word.colorIndex,
          portraitIndex: word.portraitIndex,
          w,
          h,
        })
        placedThis = true
        fallbackRowMaxH = Math.max(fallbackRowMaxH, h)
        fallbackX += w + fallbackGap
        if (fallbackX >= cw - padding) {
          fallbackX = padding
          fallbackY -= (fallbackRowMaxH + fallbackGap)
          fallbackRowMaxH = 0
        }
      }
    }
  }

  return placed
}

function drawWordCloud (
  canvas: any,
  words: WordInput[],
  dpr: number,
  cw: number,
  ch: number,
  compact = false
): PlacedWord[] {
  const ctx = canvas.getContext('2d')
  if (!ctx) return []

  ctx.scale(dpr, dpr)

  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, cw, ch)

  const placed = placeWords(ctx, words, cw, ch, compact)

  for (const p of placed) {
    ctx.save()
    ctx.translate(p.x, p.y)
    ctx.rotate(p.angle)
    ctx.font = `bold ${p.size}px KaiTi, "楷体", "STKaiti", "华文楷体", serif`
    ctx.fillStyle = COLORS[p.colorIndex % COLORS.length]
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(p.text, 0, 0)
    ctx.restore()
  }

  return placed
}

function hitTest (placed: PlacedWord[], canvasX: number, canvasY: number): number | null {
  for (let i = placed.length - 1; i >= 0; i--) {
    const p = placed[i]
    const aabb = getAABB(p.x, p.y, p.w, p.h, p.angle)
    if (canvasX >= aabb.x && canvasX <= aabb.x + aabb.w && canvasY >= aabb.y && canvasY <= aabb.y + aabb.h) {
      return p.portraitIndex
    }
  }
  return null
}

export interface PortraitWordCloudCanvasProps {
  portraits: Portrait[]
  onPortraitClick?: (portrait: Portrait) => void
  /** 由父级测量得到的视口高度(px)，传入后画布不超出容器，内滚才能生效 */
  viewportHeight?: number
}

export default function PortraitWordCloudCanvas ({ portraits, onPortraitClick, viewportHeight: propViewportHeight }: PortraitWordCloudCanvasProps) {
  const mountedRef = useRef(true)
  const [canvasHeight, setCanvasHeight] = useState(0)
  const hitRef = useRef<{ placed: PlacedWord[]; width: number; height: number } | null>(null)
  const scrollTopRef = useRef(0)

  useEffect(() => {
    if (propViewportHeight != null && propViewportHeight > 0) return
    let cancelled = false
    const win = Taro.getWindowInfo?.() as any
    const windowHeight = win?.windowHeight ?? 600
    const windowWidth = win?.windowWidth ?? 375
    const safeBottom = (win?.safeAreaInsets as any)?.bottom ?? 0
    const navRpx = 220
    const navHeightPx = (navRpx * windowWidth) / 750 + safeBottom + 20
    const headerAndPadding = 120
    const h = Math.max(280, windowHeight - navHeightPx - headerAndPadding)
    const timer = setTimeout(() => {
      if (!cancelled) setCanvasHeight(h)
    }, 0)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [propViewportHeight])

  const viewportHeight = (propViewportHeight != null && propViewportHeight > 0)
    ? propViewportHeight
    : (canvasHeight > 0 ? canvasHeight : 400)
  const extraHeight = portraits.length > 12 ? Math.min((portraits.length - 12) * 22, 350) : 0
  const contentHeight = viewportHeight + extraHeight
  const needsInnerScroll = contentHeight > viewportHeight

  useEffect(() => {
    if (portraits.length === 0 || viewportHeight <= 0) return

    mountedRef.current = true
    let cancelled = false
    const query = Taro.createSelectorQuery()
    query
      .select(`#${CANVAS_ID}`)
      .fields({ node: true, size: true })
      .exec((res: any) => {
        if (cancelled || !mountedRef.current || !res?.[0]?.node) return
        try {
          const canvas = res[0].node
          const width = res[0].width || 320
          const height = res[0].height || contentHeight
          const { sizeQ1, sizeOther, compact: isCompact } = getFontSizes(width, height, portraits.length)
          const words: WordInput[] = portraits
            .map((p, i) => ({
              text: getDisplayName(p),
              size: p.quadrant?.quadrants === 1 ? sizeQ1 : sizeOther,
              colorIndex: i,
              portraitIndex: i,
            }))
            .filter(d => d.text.length > 0)
            .sort((a, b) => b.size - a.size)
          if (words.length === 0) return
          const dpr = Taro.getWindowInfo?.()?.pixelRatio ?? 2
          canvas.width = width * dpr
          canvas.height = height * dpr
          const placed = drawWordCloud(canvas, words, dpr, width, height, isCompact)
          hitRef.current = { placed, width, height }
        } catch (e) {
          console.warn('wordcloud draw:', e)
          hitRef.current = null
        }
      })

    return () => {
      cancelled = true
      mountedRef.current = false
      hitRef.current = null
    }
  }, [portraits, canvasHeight, viewportHeight])

  const runHitTest = (canvasX: number, canvasY: number) => {
    if (!onPortraitClick || portraits.length === 0 || !hitRef.current) return
    const { placed, width, height } = hitRef.current
    const x = Math.max(0, Math.min(width, canvasX))
    const y = Math.max(0, Math.min(height, canvasY))
    const index = hitTest(placed, x, y)
    if (index != null && index >= 0 && index < portraits.length) {
      onPortraitClick(portraits[index])
    }
  }

  const handleTap = (e: any) => {
    if (!hitRef.current) return
    const detail = e.detail || e
    const touch = detail?.changedTouches?.[0] || detail?.touches?.[0] || detail
    const clientX = touch?.clientX ?? detail?.clientX ?? touch?.x
    const clientY = touch?.clientY ?? detail?.clientY ?? touch?.y
    if (clientX == null || clientY == null) return
    // 统一用视口坐标 + 点击层 rect 换算到画布坐标，避免 touch.x/y 单位或原点不一致导致错位
    Taro.createSelectorQuery()
      .select(`#${CANVAS_HIT_BOX_ID}`)
      .boundingClientRect()
      .exec((res: any) => {
        const rect = res?.[0]
        if (!rect || !hitRef.current) return
        const { width: w, height: h } = hitRef.current
        const rectW = rect.width || w
        const rectH = rect.height || h
        const scaleX = w / rectW
        const scaleY = h / rectH
        const canvasX = (clientX - rect.left) * scaleX
        const canvasY = (clientY - rect.top) * scaleY + scrollTopRef.current
        runHitTest(canvasX, canvasY)
      })
  }

  if (portraits.length === 0) return null

  const viewportHeightPx = `${viewportHeight}px`
  const contentHeightPx = `${contentHeight}px`

  const inner = (
    <View
      className="personal-profile-page__wordcloud-canvas-box"
      style={{ height: contentHeightPx, position: 'relative', minHeight: contentHeightPx }}
    >
      <Canvas
        type="2d"
        id={CANVAS_ID}
        className="personal-profile-page__wordcloud-canvas"
        style={{
          width: '100%',
          height: contentHeightPx,
        }}
      />
      <View
        id={CANVAS_HIT_BOX_ID}
        className="personal-profile-wordcloud-hit-box"
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          right: 0,
          bottom: 0,
          width: '100%',
          height: contentHeightPx,
        }}
        onTouchEnd={handleTap}
        onClick={handleTap}
      />
    </View>
  )

  return (
    <View
      className="personal-profile-page__wordcloud-canvas-wrap"
      style={{ height: viewportHeightPx, minHeight: viewportHeightPx, maxHeight: viewportHeightPx }}
    >
      {needsInnerScroll ? (
        <ScrollView
          className="personal-profile-page__wordcloud-scroll"
          scrollY
          style={{ height: viewportHeightPx }}
          onScroll={(e) => { scrollTopRef.current = e.detail?.scrollTop ?? 0 }}
        >
          {inner}
        </ScrollView>
      ) : (
        inner
      )}
    </View>
  )
}
