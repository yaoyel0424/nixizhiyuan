// 个人特质报告页面
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { View, Text, Canvas, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { BottomNav } from '@/components/BottomNav'
import { QuestionnaireRequiredModal } from '@/components/QuestionnaireRequiredModal'
import { Dialog, DialogContent } from '@/components/ui/Dialog'
import { useQuestionnaireCheck } from '@/hooks/useQuestionnaireCheck'
import { getUserPortrait, getPortraitFeedback, createPortraitFeedback, Portrait } from '@/services/portraits'
import './index.less'

// ==================== 色彩系统 ====================
// 主色系统（Primary Colors）
const PRIMARY_COLORS = {
  main: '#1a56db',      // 主色：品牌蓝
  mainLight: '#3b82f6', // 主色浅色
  mainDark: '#1e40af',  // 主色深色
};

// 辅助色系统（Secondary Colors）
const SECONDARY_COLORS = {
  success: '#10b981',   // 成功/绿色
  warning: '#f59e0b',   // 警告/橙色
  error: '#ef4444',     // 错误/红色
  info: '#06b6d4',      // 信息/青色
};

// 强调色系统（Accent Colors）
const ACCENT_COLORS = {
  highlight: '#fbbf24',  // 强调色：金色
  highlightLight: '#fde68a', // 强调色浅色
  accent: '#8b5cf6',     // 强调色：紫色
  accentLight: '#c4b5fd', // 强调色浅色
};

// 中性色系统（Neutral Colors）
const NEUTRAL_COLORS = {
  text: '#1f2937',       // 主文本
  textSecondary: '#6b7280', // 次要文本
  textTertiary: '#9ca3af', // 三级文本
  border: '#e5e7eb',     // 边框
  background: '#ffffff', // 背景
  backgroundSecondary: '#f9fafb', // 次要背景
};

// 维度颜色映射（用于详情卡片）
const DIMENSION_COLORS: Record<string, string> = {
  看: PRIMARY_COLORS.main,    // 主色
  听: ACCENT_COLORS.accent,   // 强调色
  说: SECONDARY_COLORS.success, // 辅助色
  记: SECONDARY_COLORS.warning, // 辅助色
  想: SECONDARY_COLORS.error,   // 辅助色
  做: '#EC4899',              // 粉色
  运动: SECONDARY_COLORS.info,  // 辅助色
};

// 维度颜色映射（浅色版本，用于背景）
const DIMENSION_LIGHT_COLORS: Record<string, string> = {
  看: '#DBEAFE', // 浅蓝色
  听: '#EDE9FE', // 浅紫色
  说: '#D1FAE5', // 浅绿色
  记: '#FEF3C7', // 浅橙色
  想: '#FEE2E2', // 浅红色
  做: '#FCE7F3', // 浅粉色
  运动: '#CFFAFE', // 浅青色
};

// 默认颜色（当维度未知时使用）
const DEFAULT_COLOR = PRIMARY_COLORS.main;
const DEFAULT_LIGHT_COLOR = '#DBEAFE';

// 象限颜色：与 app 一致，仅使用蓝色与橘红色
const QUADRANT_COLORS: Record<number, string> = {
  1: '#1a56db', // 第一象限：蓝
  2: '#FF7F50', // 第二象限：橘红
  3: '#1a56db', // 第三象限：蓝
  4: '#FF7F50', // 第四象限：橘红
};
// 展示顺序：1 -> 4 -> 2 -> 3
const QUADRANT_ORDER = [1, 4, 2, 3];

/**
 * 解析核心特质文本为列表
 */
function parseTraits(description: string): string[] {
  if (!description) return [];
  // 按句号、分号或换行符分割
  const traits = description
    .split(/[。；\n]/)
    .map(t => t.trim())
    .filter(t => t.length > 0);
  return traits;
}

/**
 * 解析特质名称，分离前缀和核心词
 * 例如："充满热情的'自然爱好者'" -> { prefix: "充满热情的", core: "自然爱好者" }
 */
function parseTraitName(name: string): { prefix: string; core: string } {
  if (!name) return { prefix: '', core: '' };
  
  // 匹配模式：前缀 + 引号内的核心词
  // 支持单引号、双引号、中文引号
  const patterns = [
    /^(.+?)['"'"'"](.+?)['"'"'"]$/,  // 单引号或双引号
    /^(.+?)[""](.+?)[""]$/,  // 中文引号
    /^(.+?)[''](.+?)['']$/,  // 中文单引号
  ];
  
  for (const pattern of patterns) {
    const match = name.match(pattern);
    if (match) {
      return {
        prefix: match[1].trim(),
        core: match[2].trim(),
      };
    }
  }
  
  // 如果没有匹配到，尝试按常见分隔符分割
  const separators = ['的', '地', '得'];
  for (const sep of separators) {
    const index = name.lastIndexOf(sep);
    if (index > 0 && index < name.length - 1) {
    return {
        prefix: name.substring(0, index + 1).trim(),
        core: name.substring(index + 1).trim(),
      };
    }
  }
  
  // 如果都没有匹配到，整个作为核心词
  return { prefix: '', core: name.trim() };
}

/**
 * 词云项接口
 */
interface WordCloudItem {
  id: number;
  prefix: string;
  core: string;
  icon: string; // 图标
  fontSize: number;
  color: string;
  x: number;
  y: number;
  rotation: number;
  width: number;
  height: number;
  prefixWidth: number;
  prefixHeight: number;
  coreWidth: number;
  coreHeight: number;
  portrait: Portrait;
}

/**
 * 卡片项接口
 */
interface CardItem {
  id: number;
  prefix: string;
  core: string;
  color: string;
  portrait: Portrait;
  isQuadrant1: boolean;
  quadrant: number; // 象限 1/2/3/4，用于排序与颜色
  status: string;
  likeElement?: { name: string; dimension?: string };
  talentElement?: { name: string; dimension?: string };
  maxStatusLines: number;
}

/** 左右滑动切换的阈值（px） */
const SWIPE_THRESHOLD = 50;

/**
 * 层叠卡片组件：特质以层叠 + 左右滑动展示，当前卡片全显，前后各露边
 */
function WordCloudCSS({
  portraits,
  onItemClick,
  showOverviewModal,
  setShowOverviewModal,
  onFeedbackClick,
}: {
  portraits: Portrait[];
  onItemClick?: (portrait: Portrait) => void;
  showOverviewModal: boolean;
  setShowOverviewModal: (show: boolean) => void;
  /** 点击「我要反馈」时调用，传入当前展示的画像 id */
  onFeedbackClick?: (portraitId?: number) => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number>(0);
  const touchStartY = useRef<number>(0);
  // 翻书动画：是否正在翻转、目标索引、当前翻转角度
  const [flipState, setFlipState] = useState<{ isFlipping: boolean; toIndex: number; angle: number }>({
    isFlipping: false,
    toIndex: 0,
    angle: 0,
  });
  const flipDuration = 400;
  const flipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 准备卡片数据：按 quadrant 区分颜色（柔和色），按 1、4、2、3 顺序展示
  const cardItems = useMemo(() => {
    if (portraits.length === 0) {
      return [];
    }

    const items: CardItem[] = portraits.map((portrait) => {
      const { prefix, core } = parseTraitName(portrait.name);
      const quadrant = portrait.quadrant?.quadrants ?? 1;
      const isQuadrant1 = quadrant === 1;
      const color = QUADRANT_COLORS[quadrant] ?? QUADRANT_COLORS[1];
      const maxStatusLines = (portrait.id % 3) + 2;

      return {
        id: portrait.id,
        prefix,
        core,
        color,
        portrait,
        isQuadrant1,
        status: portrait.status || '',
        likeElement: portrait.likeElement ? {
          name: portrait.likeElement.name,
          dimension: portrait.likeElement.dimension,
        } : undefined,
        talentElement: portrait.talentElement ? {
          name: portrait.talentElement.name,
          dimension: portrait.talentElement.dimension,
        } : undefined,
        maxStatusLines,
        quadrant,
      };
    });

    // 按象限顺序 1 -> 4 -> 2 -> 3 排序，同象限内按 id 排序
    const orderIndex = (q: number) => {
      const i = QUADRANT_ORDER.indexOf(q);
      return i === -1 ? QUADRANT_ORDER.length : i;
    };
    items.sort((a, b) => {
      const orderA = orderIndex(a.quadrant);
      const orderB = orderIndex(b.quadrant);
      if (orderA !== orderB) return orderA - orderB;
      return a.id - b.id;
    });

    return items;
  }, [portraits]);

  // 当前索引不超过列表长度（数据变化时修正）
  const safeIndex = Math.min(currentIndex, Math.max(0, cardItems.length - 1));

  useEffect(() => {
    if (cardItems.length > 0 && currentIndex >= cardItems.length) {
      setCurrentIndex(cardItems.length - 1);
    }
  }, [cardItems.length, currentIndex]);

  const setSafeIndex = useCallback((next: number) => {
    setCurrentIndex((prev) => {
      const max = Math.max(0, cardItems.length - 1);
      return Math.max(0, Math.min(max, next));
    });
  }, [cardItems.length]);

  // 处理点击：仅当前卡片可点击进入详情
  const handleItemClick = useCallback((portrait: Portrait) => {
    if (onItemClick) {
      onItemClick(portrait);
    }
  }, [onItemClick]);

  // 滑动手势：左滑下一张，右滑上一张；仅当水平位移占优时才切换，避免垂直滚动误触
  const onTouchStart = useCallback((e: any) => {
    const t = e.touches?.[0];
    if (t) {
      touchStartX.current = t.clientX;
      touchStartY.current = t.clientY;
    }
  }, []);
  const onTouchEnd = useCallback((e: any) => {
    const t = e.changedTouches?.[0];
    if (!t) return;
    const deltaX = t.clientX - touchStartX.current;
    const deltaY = t.clientY - touchStartY.current;
    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);
    // 仅当水平滑动占优且超过阈值时才切换画像，垂直滚动不触发
    if (absX > SWIPE_THRESHOLD && absX > absY) {
      if (deltaX < 0) {
        setSafeIndex(safeIndex + 1);
      } else {
        setSafeIndex(safeIndex - 1);
      }
    }
  }, [safeIndex, setSafeIndex]);

  // 只渲染当前及前后各两张，减少节点
  const visibleRange = {
    from: Math.max(0, safeIndex - 2),
    to: Math.min(cardItems.length - 1, safeIndex + 2),
  };

  if (cardItems.length === 0) {
    return <View className="word-cloud-css word-cloud-css--stack" />;
  }

  return (
    <View className="word-cloud-css word-cloud-css--stack">
      {/* 仅保留上一个 / 当前 x/x / 下一个，画像名称在卡片内完整显示 */}
      <View className="word-cloud-css__stack-footer">
        <View className="word-cloud-css__stack-nav-row">
          {/* 第一个页面隐藏"上一个"按钮，其他页面显示 */}
          {safeIndex > 0 ? (
            <View
              className="word-cloud-css__stack-nav-item word-cloud-css__stack-nav-item--clickable"
              onClick={() => setSafeIndex(safeIndex - 1)}
            >
              <Text className="word-cloud-css__stack-nav-label">上一个</Text>
            </View>
          ) : (
            <View className="word-cloud-css__stack-nav-item" />
          )}
          <View className="word-cloud-css__stack-nav-item word-cloud-css__stack-nav-item--current">
            <Text className="word-cloud-css__stack-nav-label">当前 {safeIndex + 1} / {cardItems.length}</Text>
          </View>
          {onFeedbackClick && (
            <View
              className="word-cloud-css__feedback-btn"
              onClick={() => onFeedbackClick(cardItems[safeIndex]?.id)}
            >
              <Text className="word-cloud-css__feedback-btn-text">我要反馈</Text>
            </View>
          )}
          {/* 最后一个页面隐藏"下一个"按钮文字，但保留占位符 */}
          <View
            className={`word-cloud-css__stack-nav-item ${safeIndex < cardItems.length - 1 ? 'word-cloud-css__stack-nav-item--clickable' : ''}`}
            onClick={safeIndex < cardItems.length - 1 ? () => setSafeIndex(safeIndex + 1) : undefined}
          >
            {safeIndex < cardItems.length - 1 && (
              <Text className="word-cloud-css__stack-nav-label">下一个</Text>
            )}
          </View>
        </View>
      </View>
      <View
        className="word-cloud-css__stack-container"
        onTouchStart={onTouchStart}
        onTouchEnd={onTouchEnd}
      >
        {cardItems.map((item, i) => {
          const offset = i - safeIndex;
          const isCurrent = i === safeIndex;
          const scale = isCurrent ? 1 : Math.max(0.82, 1 - 0.1 * Math.abs(offset));
          const zIndex = 100 + 10 - Math.abs(offset);
          const opacity = isCurrent ? 1 : Math.max(0.88, 1 - 0.08 * Math.abs(offset));
          const inRange = i >= visibleRange.from && i <= visibleRange.to;
          if (!inRange) return null;
          // 当前卡约 82% 宽，下一张/上一张各露出约 18%，提示用户可左右滑动
          const translateXPercent = offset * 99;

          return (
            <View
              key={item.id}
              className={`word-cloud-css__stack-card ${isCurrent ? 'word-cloud-css__stack-card--current' : ''} ${item.isQuadrant1 ? 'word-cloud-css__stack-card--quadrant1' : ''}`}
              style={{
                borderLeftColor: item.color,
                borderLeftWidth: 4,
                borderRightColor: item.color,
                borderRightWidth: 4,
                zIndex,
                opacity,
                transform: isCurrent ? undefined : `translateX(-50%) translateX(${translateXPercent}%) scale(${scale})`,
              }}
              onClick={() => {
                if (isCurrent) {
                  handleItemClick(item.portrait);
                } else {
                  setSafeIndex(i);
                }
              }}
            >
              <View className="word-cloud-css__stack-card-body">
                {/* 当前画像名称，在卡片内完整显示（可换行不截断） */}
                <Text className="word-cloud-css__card-portrait-name" style={{ color: item.color }}>
                  {item.portrait.name?.trim() || `${(item.prefix || '')}${item.core}`.trim() || '—'}
                </Text>
                {/* 一句话状态（可选，小字），与下方内容一起滚动 */}
                {item.portrait.status && (
                  <Text className="word-cloud-css__card-status" numberOfLines={2}>
                    {item.portrait.status}
                  </Text>
                )}
                {/* 重点二：元素名称 — 喜欢元素、天赋元素，标签+名称突出 */}
                <View className="word-cloud-css__card-elements">
                  {item.portrait.likeElement && (
                    <View className="word-cloud-css__card-element-group">
                      <Text className="word-cloud-css__card-element-label">喜欢元素</Text>
                      <Text className="word-cloud-css__card-tag word-cloud-css__card-tag--green">
                        {item.portrait.likeElement.name}
                      </Text>
                      {(item.portrait.likeElement as { ownedNaturalState?: string })?.ownedNaturalState && (
                        <View className="word-cloud-css__card-element-state-wrap">
                          {String((item.portrait.likeElement as { ownedNaturalState?: string }).ownedNaturalState)
                            .replace(/\n{2,}/g, '\n')
                            .split('\n')
                            .filter(p => p.trim())
                            .map((para, i) => (
                              <Text key={i} className="word-cloud-css__card-element-state">
                                {para.trim()}
                              </Text>
                            ))}
                        </View>
                      )}
                    </View>
                  )}
                  {item.portrait.talentElement && (
                    <View className="word-cloud-css__card-element-group">
                      <Text className="word-cloud-css__card-element-label">天赋元素</Text>
                      <Text className="word-cloud-css__card-tag word-cloud-css__card-tag--green">
                        {item.portrait.talentElement.name}
                      </Text>
                      {(item.portrait.talentElement as { ownedNaturalState?: string })?.ownedNaturalState && (
                        <View className="word-cloud-css__card-element-state-wrap">
                          {String((item.portrait.talentElement as { ownedNaturalState?: string }).ownedNaturalState)
                            .replace(/\n{2,}/g, '\n')
                            .split('\n')
                            .filter(p => p.trim())
                            .map((para, i) => (
                              <Text key={i} className="word-cloud-css__card-element-state">
                                {para.trim()}
                              </Text>
                            ))}
                        </View>
                      )}
                    </View>
                  )}
                </View>
                {/* 次要：核心矛盾 — 标题 + 矛盾内容（与三大挑战同款绿色边框标签） */}
                {(item.portrait.partOneMainTitle || item.portrait.partOneSubTitle || item.portrait.partOneDescription || item.portrait.status) && (() => {
                  const conflictTraits = parseTraits(item.portrait.partOneDescription || item.portrait.status || '');
                  const hasConflictContent = !!item.portrait.partOneSubTitle || conflictTraits.length > 0;
                  return (
                    <View className="word-cloud-css__card-section word-cloud-css__card-section--secondary">
                      {item.portrait.partOneMainTitle && (
                        <Text className="word-cloud-css__card-subtitle">{item.portrait.partOneMainTitle}</Text>
                      )}
                      {hasConflictContent && (
                        <>
                          {item.portrait.partOneSubTitle && (
                            <View className="word-cloud-css__card-tags">
                              <Text className="word-cloud-css__card-tag word-cloud-css__card-tag--green">
                                {item.portrait.partOneSubTitle}
                              </Text>
                            </View>
                          )}
                          {conflictTraits.length > 0 && (
                            <View className="word-cloud-css__card-traits">
                              {conflictTraits.map((trait, index) => (
                                <View key={index} className="word-cloud-css__card-trait-row">
                                   <Text className="word-cloud-css__card-trait-text">{trait}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </>
                      )}
                    </View>
                  );
                })()}
                {/* 三大挑战 — 放在核心矛盾（主副标题+特质）下面，标题后跟查看详情链接 */}
                {item.portrait.quadrant1Challenges && item.portrait.quadrant1Challenges.length > 0 && (
                  <View className="word-cloud-css__card-section">
                    <View className="word-cloud-css__card-section-title-row">
                      <Text className="word-cloud-css__card-section-title">三大挑战</Text>
                      <Text
                        className="word-cloud-css__card-detail-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleItemClick(item.portrait);
                        }}
                      >
                        查看详情
                      </Text>
                    </View>
                    <View className="word-cloud-css__card-tags">
                      {item.portrait.quadrant1Challenges.map((c) => (
                        <Text key={c.id} className="word-cloud-css__card-tag" style={{ borderColor: item.color }}>
                          {c.name}
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        })}
      </View>

      {/* 总览报告弹出框 */}
      <Dialog open={showOverviewModal} onOpenChange={setShowOverviewModal}>
        <DialogContent className="personal-profile-overview-dialog overview-dialog" showCloseButton={true}>
          <View className="word-cloud-css__overview-header">
            <Text className="word-cloud-css__overview-title">总览报告</Text>
          </View>
          <View className="word-cloud-css__overview-container">
            {cardItems.map((item, index) => (
              <View
                key={item.id}
                className={`word-cloud-css__overview-card ${item.isQuadrant1 ? 'word-cloud-css__overview-card--quadrant1' : ''}`}
                style={{
                  borderLeftColor: item.color,
                  borderLeftWidth: 4,
                }}
                onClick={() => {
                  setShowOverviewModal(false);
                  setSafeIndex(index);
                }}
              >
                <Text className="word-cloud-css__overview-card-name" style={{ color: item.color }}>
                  {item.portrait.name?.trim() || `${(item.prefix || '')}${item.core}`.trim() || '—'}
                </Text>
                {item.portrait.status && (
                  <Text className="word-cloud-css__overview-card-status" numberOfLines={2}>
                    {item.portrait.status}
                  </Text>
                )}
                {(item.portrait.likeElement || item.portrait.talentElement) && (
                  <View className="word-cloud-css__overview-card-elements">
                    {item.portrait.likeElement && (
                      <View className="word-cloud-css__overview-card-element">
                        <Text className="word-cloud-css__overview-card-element-label">喜欢</Text>
                        <Text className="word-cloud-css__overview-card-element-name">
                          {item.portrait.likeElement.name}
                        </Text>
                      </View>
                    )}
                    {item.portrait.talentElement && (
                      <View className="word-cloud-css__overview-card-element">
                        <Text className="word-cloud-css__overview-card-element-label">天赋</Text>
                        <Text className="word-cloud-css__overview-card-element-name">
                          {item.portrait.talentElement.name}
                        </Text>
                      </View>
                    )}
                  </View>
                )}
              </View>
            ))}
          </View>
        </DialogContent>
      </Dialog>
    </View>
  );
}

/**
 * 语义分层词云组件（Canvas 版本，已废弃）
 */
function WordCloudCanvas({
  portraits,
  onItemClick,
}: {
  portraits: Portrait[];
  onItemClick?: (portrait: Portrait) => void;
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 0, height: 0 });
  const [dpr, setDpr] = useState(2);
  const [hoveredId, setHoveredId] = useState<number | null>(null);
  const canvasRef = useRef<any>(null);
  const measureCanvasRef = useRef<any>(null);
  const wordCloudItemsRef = useRef<WordCloudItem[]>([]);

  // 初始化画布尺寸
  useEffect(() => {
    const initCanvasSize = () => {
    Promise.resolve(Taro.getWindowInfo()).then((windowInfo) => {
      const windowWidth = windowInfo.windowWidth;
        const deviceDpr = windowInfo.pixelRatio || 2;
        const statusBarHeight = windowInfo.statusBarHeight || 0;

      setDpr(deviceDpr);

        // 使用 Taro.createSelectorQuery 查询词云区域的实际高度（词云根节点 .word-cloud-css）
        const query = Taro.createSelectorQuery();
        query.select('.word-cloud-css').boundingClientRect();
        
        query.exec((res) => {
          if (res && res[0] && res[0].height > 0) {
            const containerHeight = res[0].height;
            setCanvasSize({
              width: windowWidth,
              height: containerHeight,
            });
          } else {
            // 如果查询失败，使用保守计算
            const windowHeight = windowInfo.windowHeight;
            const navigationBarHeight = 44;
            const bottomNavHeight = 100; // 更保守的估计，包含 safe-area
            const availableHeight = windowHeight - statusBarHeight - navigationBarHeight - bottomNavHeight;

      setCanvasSize({
              width: windowWidth,
              height: Math.max(availableHeight, 400),
      });
          }
        });
      });
    };

    // 延迟执行，确保 DOM 已渲染
    const timer = setTimeout(() => {
      initCanvasSize();
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  // 简化的距离检测：使用简单的圆形距离检测，更宽松但更可靠
  const hasAnyOverlap = (
    x: number, y: number, w: number, h: number,
    placedItems: WordCloudItem[]
  ): boolean => {
    // 使用对角线长度作为半径，确保有足够的安全距离
    const radius1 = Math.sqrt(w * w + h * h) / 2;
    const minDistance = 65; // 减小最小间距，让词语之间更紧凑
    
    for (const placed of placedItems) {
      const radius2 = Math.sqrt(placed.width * placed.width + placed.height * placed.height) / 2;
      const dx = x - placed.x;
      const dy = y - placed.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      // 如果两个圆心的距离小于两个半径之和加上最小间距，则认为重叠
      // 对于象限1的项，使用更大的间距
      const isPlacedQuadrant1 = placed.portrait.quadrant?.quadrants === 1;
      const extraSpacing = isPlacedQuadrant1 ? 40 : 0; // 象限1额外增加40px间距
      
      if (distance < radius1 + radius2 + minDistance + extraSpacing) {
        return true;
      }
    }
    return false;
  };

  // 简化的螺旋搜索算法：使用更大的步长和更宽松的检测
  const findSpiralPosition = (
    item: WordCloudItem,
    placedItems: WordCloudItem[],
    centerX: number,
    centerY: number,
    canvasWidth: number,
    canvasHeight: number
  ): { x: number; y: number } | null => {
    const maxRadiusX = canvasWidth * 0.45;
    const maxRadiusY = (canvasHeight - 80) * 0.4; // 减去顶部边距，为提示文字留出空间
    const maxRadius = Math.max(maxRadiusX, maxRadiusY);
    const stepSize = 8; // 增大步长，减少计算量
    const itemRadius = Math.sqrt(item.width * item.width + item.height * item.height) / 2;
    const isQuadrant1 = item.portrait.quadrant?.quadrants === 1;
    const minSpacing = itemRadius * 2 + (isQuadrant1 ? 100 : 80); // 象限1使用更大的间距
    
    // 从中心开始，螺旋向外搜索
    for (let radius = 0; radius <= maxRadius; radius += stepSize) {
      const circumference = 2 * Math.PI * radius;
      const pointsOnCircle = Math.max(12, Math.floor(circumference / minSpacing));
      
      for (let i = 0; i < pointsOnCircle; i++) {
        const angle = (i / pointsOnCircle) * Math.PI * 2;
        const x = centerX + radius * Math.cos(angle) * 1.4;
        const y = centerY + radius * Math.sin(angle) * 0.85;
        
        // 检查是否在画布范围内
        const margin = 20;
        if (x - item.width / 2 < margin || x + item.width / 2 > canvasWidth - margin ||
            y - item.height / 2 < margin || y + item.height / 2 > canvasHeight - margin) {
          continue;
        }
        
        // 使用简化的距离检测
        if (!hasAnyOverlap(x, y, item.width, item.height, placedItems)) {
          return { x, y };
        }
      }
    }
    
    return null;
  };

  // 计算词云布局
  const calculateWordCloudLayout = useCallback(
    (items: WordCloudItem[], canvasWidth: number, canvasHeight: number) => {
      const centerX = canvasWidth / 2;
      const centerY = canvasHeight / 2;

      // 按权重排序（id 越小，权重越高，放在中心）
      const sortedItems = [...items].sort((a, b) => a.id - b.id);

      // 椭圆布局算法
      const placedItems: WordCloudItem[] = [];

      sortedItems.forEach((item, index) => {
        // 固定旋转角度（-15° 到 +15°），基于索引确保一致性
        const rotationSeed = item.id * 0.1;
        const rotation = (Math.sin(rotationSeed) * 15) * (Math.PI / 180);

        // 首先尝试使用黄金角度分布的理想位置
        const goldenAngle = Math.PI * (3 - Math.sqrt(5));
        const angle = index * goldenAngle;
        // 大幅增加最大半径，充分利用画布空间
        // 顶部留出更多空间给提示文字
        const topMargin = 80; // 顶部边距，为提示文字留出空间
        const maxRadiusX = canvasWidth * 0.48; // 接近边缘
        const maxRadiusY = (canvasHeight - topMargin) * 0.42; // 减去顶部边距
        const maxRadius = Math.max(maxRadiusX, maxRadiusY);
        const radius = maxRadius * Math.sqrt(index / Math.max(sortedItems.length - 1, 1));
        
        // 椭圆拉伸：水平方向更宽，充分利用左右空间
        // 垂直方向向下偏移，避开顶部提示文字区域
        const idealX = centerX + radius * Math.cos(angle) * 1.6; // 进一步增加水平拉伸
        const idealY = centerY + topMargin / 2 + radius * Math.sin(angle) * 0.9; // 向下偏移

        // 检查理想位置是否可用
        let finalX = idealX;
        let finalY = idealY;
        let positionFound = false;

        // 使用简化的距离检测检查理想位置
        if (!hasAnyOverlap(idealX, idealY, item.width, item.height, placedItems)) {
          // 理想位置可用
          positionFound = true;
        } else {
          // 理想位置不可用，使用螺旋搜索
          const spiralPos = findSpiralPosition(item, placedItems, centerX, centerY, canvasWidth, canvasHeight);
          if (spiralPos) {
            finalX = spiralPos.x;
            finalY = spiralPos.y;
            positionFound = true;
          }
        }

        // 如果还是找不到位置，使用简化的强制放置
        if (!positionFound) {
          // 尝试多个方向，使用更大的间距
          let bestPosition: { x: number; y: number } | null = null;
          const maxAttempts = 24; // 减少尝试次数，每15度一个方向
          const itemRadius = Math.sqrt(item.width * item.width + item.height * item.height) / 2;
          const isQuadrant1 = item.portrait.quadrant?.quadrants === 1;
          const baseRadius = itemRadius * 2 + (isQuadrant1 ? 120 : 100); // 象限1使用更大的基础半径
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const angle = (attempt / maxAttempts) * Math.PI * 2;
            
            // 尝试不同的距离
            for (let radiusMultiplier = 1; radiusMultiplier <= 4; radiusMultiplier++) {
              const testX = idealX + Math.cos(angle) * baseRadius * radiusMultiplier;
              const testY = idealY + Math.sin(angle) * baseRadius * radiusMultiplier;
              
              // 检查是否在画布范围内
              const margin = 20;
              if (testX - item.width / 2 < margin || testX + item.width / 2 > canvasWidth - margin ||
                  testY - item.height / 2 < margin || testY + item.height / 2 > canvasHeight - margin) {
                continue;
              }
              
              // 使用简化的距离检测
              if (!hasAnyOverlap(testX, testY, item.width, item.height, placedItems)) {
                bestPosition = { x: testX, y: testY };
                break;
              }
            }
            
            if (bestPosition) {
              break;
            }
          }
          
          if (bestPosition) {
            finalX = bestPosition.x;
            finalY = bestPosition.y;
          } else {
            // 如果所有方向都失败，使用最远的位置
            let maxDistance = 0;
            let farthestX = idealX;
            let farthestY = idealY;
            
            for (const placed of placedItems) {
              const dx = idealX - placed.x;
              const dy = idealY - placed.y;
              const distance = Math.sqrt(dx * dx + dy * dy);
              
              if (distance > maxDistance) {
                maxDistance = distance;
                const itemRadius = Math.sqrt(item.width * item.width + item.height * item.height) / 2;
                const placedRadius = Math.sqrt(placed.width * placed.width + placed.height * placed.height) / 2;
                const moveDistance = itemRadius + placedRadius + 80; // 使用更大的间距
                if (distance > 0.1) {
                  farthestX = placed.x + (dx / distance) * moveDistance;
                  farthestY = placed.y + (dy / distance) * moveDistance;
                }
              }
            }
            
            finalX = farthestX;
            finalY = farthestY;
          }
        }
        
        // 最终检查：如果还有重叠，继续调整
        let finalAttempts = 0;
        while (hasAnyOverlap(finalX, finalY, item.width, item.height, placedItems) && finalAttempts < 20) {
          // 向远离所有已放置词语的平均方向移动
          let avgDx = 0;
          let avgDy = 0;
          let count = 0;
          
          for (const placed of placedItems) {
            const dx = finalX - placed.x;
            const dy = finalY - placed.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            if (distance > 0.1) {
              avgDx += dx / distance;
              avgDy += dy / distance;
              count++;
            }
          }
          
          if (count > 0) {
            avgDx /= count;
            avgDy /= count;
            const moveDistance = 100;
            finalX += avgDx * moveDistance;
            finalY += avgDy * moveDistance;
          } else {
            // 如果无法计算方向，随机移动
            const randomAngle = Math.random() * Math.PI * 2;
            finalX += Math.cos(randomAngle) * 100;
            finalY += Math.sin(randomAngle) * 100;
          }
          
          finalAttempts++;
        }

        // 确保在画布范围内
        const margin = 20;
        finalX = Math.max(item.width / 2 + margin, Math.min(canvasWidth - item.width / 2 - margin, finalX));
        finalY = Math.max(item.height / 2 + margin, Math.min(canvasHeight - item.height / 2 - margin, finalY));
        
        // 最终检查：确保没有重叠（使用简化的距离检测）
        if (hasAnyOverlap(finalX, finalY, item.width, item.height, placedItems)) {
          // 如果还有重叠，尝试微调位置
          let adjusted = false;
          for (let offset = 20; offset <= 100 && !adjusted; offset += 10) {
            for (let dir = 0; dir < 8 && !adjusted; dir++) {
              const testAngle = (dir / 8) * Math.PI * 2;
              const testX = finalX + Math.cos(testAngle) * offset;
              const testY = finalY + Math.sin(testAngle) * offset;
              
              if (testX - item.width / 2 >= margin && testX + item.width / 2 <= canvasWidth - margin &&
                  testY - item.height / 2 >= margin && testY + item.height / 2 <= canvasHeight - margin &&
                  !hasAnyOverlap(testX, testY, item.width, item.height, placedItems)) {
                finalX = testX;
                finalY = testY;
                adjusted = true;
              }
            }
          }
        }

        item.x = finalX;
        item.y = finalY;
        item.rotation = rotation;

        placedItems.push(item);
      });

      return placedItems;
    },
    []
  );

  // 获取测量 Canvas 节点
  const getMeasureCanvasNode = useCallback(() => {
    return new Promise<any>(resolve => {
      const query = Taro.createSelectorQuery();
      query
        .select('#measure-canvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (res && res[0] && res[0].node) {
            measureCanvasRef.current = res[0].node;
            resolve(res[0].node);
          } else {
            resolve(null);
          }
        });
    });
  }, []);

  // 初始化测量 Canvas
  useEffect(() => {
    getMeasureCanvasNode().then((canvas) => {
      if (canvas) {
        // 设置 Canvas 尺寸（不需要太大，只用于测量）
        canvas.width = 2000;
        canvas.height = 200;
      }
    });
  }, [getMeasureCanvasNode]);

  // 使用 Canvas 精确测量文本宽度
  const measureTextWithContext = useCallback(
    async (
      text: string,
      fontSize: number,
      fontWeight: string = '500'
    ): Promise<{ width: number; actualBoundingBoxAscent: number; actualBoundingBoxDescent: number }> => {
      // 如果 Canvas 还没准备好，先尝试获取
      let canvas = measureCanvasRef.current;
      if (!canvas) {
        canvas = await getMeasureCanvasNode();
      }

      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // 设置测量用的字体（与绘制时保持一致）
          ctx.font = `${fontWeight} ${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
          const metrics = ctx.measureText(text);

          return {
            width: metrics.width,
            actualBoundingBoxAscent: metrics.actualBoundingBoxAscent || fontSize * 0.8,
            actualBoundingBoxDescent: metrics.actualBoundingBoxDescent || fontSize * 0.2,
          };
        }
      }

      // 备用：使用估算
      let width = 0;
      for (const char of text) {
        if (/[\u4e00-\u9fa5]/.test(char)) {
          width += fontSize * 0.7; // 增加估算系数
        } else {
          width += fontSize * 0.6; // 增加估算系数
        }
      }
      if (fontWeight === '700' || fontWeight === 'bold') {
        width *= 1.2;
      }
      return {
        width,
        actualBoundingBoxAscent: fontSize * 0.8,
        actualBoundingBoxDescent: fontSize * 0.2,
      };
    },
    [getMeasureCanvasNode]
  );

  // 测量文本宽度的辅助函数（使用估算值，作为备用）
  const measureText = useCallback((text: string, fontSize: number, fontWeight: string = '500'): number => {
    // 中文字符宽度约为字号的 0.65 倍（考虑字重）
    // 英文字符宽度约为字号的 0.5 倍
    let width = 0;
    for (const char of text) {
      if (/[\u4e00-\u9fa5]/.test(char)) {
        // 中文字符
        width += fontSize * 0.65;
      } else {
        // 英文字符和数字
        width += fontSize * 0.5;
      }
    }
    // 根据字重微调
    if (fontWeight === '700' || fontWeight === 'bold') {
      width *= 1.1;
    }
    return width;
  }, []);

  // 准备词云数据（使用精确测量）
  const [wordCloudItems, setWordCloudItems] = useState<WordCloudItem[]>([]);

  useEffect(() => {
    if (portraits.length === 0 || canvasSize.width === 0) {
      setWordCloudItems([]);
      return;
    }

    const prepareWordCloudItems = async () => {
      // 解析所有特质名称并按 id 排序（id 越小可能越重要）
      const sortedPortraits = [...portraits].sort((a, b) => a.id - b.id);
      
      // 使用精确测量准备所有项目
      const itemsPromises = sortedPortraits.map(async (portrait, index) => {
        const { prefix, core } = parseTraitName(portrait.name);
        const icon = '●';
        
        // 计算权重：前几个特质权重更高
        // 使用指数衰减，让前几个更突出
        const total = sortedPortraits.length;
        const weight = Math.pow(1 - index / total, 0.7); // 0.7 的指数让权重分布更平滑
        
        // 检查象限是否为1，如果是则增大字体并突出显示
        const isQuadrant1 = portrait.quadrant?.quadrants === 1;
        const quadrantMultiplier = isQuadrant1 ? 1.6 : 1.0; // 象限1放大1.6倍，更突出
        
        // 字号：18px - 32px，根据权重，象限1额外放大
        const baseFontSize = 18 + weight * 14;
        const fontSize = Math.min(baseFontSize * quadrantMultiplier, 50); // 最大50px，避免过大
        
        // 根据权重和特质类型选择颜色
        // 使用色彩系统：主色、辅助色、强调色
        let color: string;
        const colorRatio = weight;
        
        // 根据特质类型选择颜色方案
        const coreLower = core.toLowerCase();
        if (coreLower.includes('逻辑') || coreLower.includes('结构') || coreLower.includes('解码')) {
          // 逻辑类：使用主色系（蓝色）
          const r1 = 0x3b, g1 = 0x82, b1 = 0xf6; // 主色浅色
          const r2 = 0x1e, g2 = 0x40, b2 = 0xaf; // 主色深色
          const r = Math.round(r1 + (r2 - r1) * colorRatio);
          const g = Math.round(g1 + (g2 - g1) * colorRatio);
          const b = Math.round(b1 + (b2 - b1) * colorRatio);
          color = `rgb(${r}, ${g}, ${b})`;
        } else if (coreLower.includes('自然') || coreLower.includes('美学') || coreLower.includes('爱好者')) {
          // 自然类：使用辅助色系（绿色）
          const r1 = 0x6e, g1 = 0xd4, b1 = 0x8f; // 浅绿
          const r2 = 0x10, g2 = 0xb9, b2 = 0x81; // 深绿
          const r = Math.round(r1 + (r2 - r1) * colorRatio);
          const g = Math.round(g1 + (g2 - g1) * colorRatio);
          const b = Math.round(b1 + (b2 - b1) * colorRatio);
          color = `rgb(${r}, ${g}, ${b})`;
        } else if (coreLower.includes('苦行') || coreLower.includes('极简')) {
          // 极简类：使用强调色系（橙色/金色）
          const r1 = 0xfb, g1 = 0xbf, b1 = 0x24; // 强调色
          const r2 = 0xf5, g2 = 0x9e, b2 = 0x0b; // 警告色
          const r = Math.round(r1 + (r2 - r1) * colorRatio);
          const g = Math.round(g1 + (g2 - g1) * colorRatio);
          const b = Math.round(b1 + (b2 - b1) * colorRatio);
          color = `rgb(${r}, ${g}, ${b})`;
        } else {
          // 默认：使用主色系（蓝色）
          const r1 = 0x60, g1 = 0xa5, b1 = 0xfa; // 浅蓝
          const r2 = 0x1a, g2 = 0x56, b2 = 0xdb; // 主色
          const r = Math.round(r1 + (r2 - r1) * colorRatio);
          const g = Math.round(g1 + (g2 - g1) * colorRatio);
          const b = Math.round(b1 + (b2 - b1) * colorRatio);
          color = `rgb(${r}, ${g}, ${b})`;
        }

        // 使用精确测量获取文本尺寸
        let prefixMetrics = { width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };
        let coreMetrics = { width: 0, actualBoundingBoxAscent: 0, actualBoundingBoxDescent: 0 };

        if (prefix) {
          prefixMetrics = await measureTextWithContext(prefix, 12, '400');
        }

        coreMetrics = await measureTextWithContext(core, fontSize, '500');

        // 使用精确测量的宽度和高度
        const prefixWidth = prefixMetrics.width;
        const prefixHeight = prefixMetrics.actualBoundingBoxAscent + prefixMetrics.actualBoundingBoxDescent || 14;
        const coreWidth = coreMetrics.width;
        const coreHeight = coreMetrics.actualBoundingBoxAscent + coreMetrics.actualBoundingBoxDescent || fontSize;

        // 计算实际占用空间（考虑旋转后的外接矩形）
        // 旋转后的外接矩形尺寸（使用最大旋转角度）
        const rotationMax = 15 * (Math.PI / 180); // 最大旋转角度
        // 计算旋转后的外接矩形（使用精确测量的尺寸）
        const cosRot = Math.abs(Math.cos(rotationMax));
        const sinRot = Math.abs(Math.sin(rotationMax));
        const rotatedWidth = coreWidth * cosRot + coreHeight * sinRot;
        const rotatedHeight = coreWidth * sinRot + coreHeight * cosRot;
        
        // 使用较大的值作为实际占用空间，并加上前缀的高度和额外边距
        // 前缀可能比核心词宽，所以需要考虑
        // 象限1需要更大的边距，避免重叠（重用上面已声明的isQuadrant1）
        const widthMargin = isQuadrant1 ? 90 : 70; // 象限1使用更大的宽度边距
        const heightMargin = isQuadrant1 ? 80 : 60; // 象限1使用更大的高度边距
        
        const totalWidth = Math.max(prefixWidth, rotatedWidth);
        const actualWidth = totalWidth + widthMargin;
        const actualHeight = prefixHeight + rotatedHeight + heightMargin;

        return {
          id: portrait.id,
          prefix,
          core,
          icon,
          fontSize,
          color,
          x: 0,
          y: 0,
          rotation: 0,
          width: actualWidth,
          height: actualHeight,
          prefixWidth,
          prefixHeight,
          coreWidth,
          coreHeight,
          portrait,
        };
      });

      const items = await Promise.all(itemsPromises);

      // 计算布局
      const laidOutItems = calculateWordCloudLayout(items, canvasSize.width, canvasSize.height);
      setWordCloudItems(laidOutItems);
    };

    prepareWordCloudItems();
  }, [portraits, canvasSize, calculateWordCloudLayout, measureTextWithContext]);

  // 保存词云项到 ref
  useEffect(() => {
    wordCloudItemsRef.current = wordCloudItems;
  }, [wordCloudItems]);

  // 获取 Canvas 节点
  const getCanvasNode = useCallback(() => {
    return new Promise<any>(resolve => {
      const query = Taro.createSelectorQuery();
      query
        .select('#word-cloud-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          if (res && res[0] && res[0].node) {
            canvasRef.current = res[0].node;
            resolve(res[0].node);
            } else {
            resolve(null);
          }
        });
    });
  }, []);

  // 绘制词云
  useEffect(() => {
    if (canvasSize.width === 0 || dpr === 0 || wordCloudItems.length === 0) return;

    getCanvasNode()
      .then(canvas => {
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // 设置高清画布
        const physicalWidth = canvasSize.width * dpr;
        const physicalHeight = canvasSize.height * dpr;

        canvas.width = physicalWidth;
        canvas.height = physicalHeight;

        ctx.scale(dpr, dpr);
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

        // 绘制渐变背景（从浅蓝到白色）
        const gradient = ctx.createLinearGradient(0, 0, 0, canvasSize.height);
        gradient.addColorStop(0, '#f0f7ff'); // 顶部：浅蓝色
        gradient.addColorStop(0.5, '#ffffff'); // 中间：白色
        gradient.addColorStop(1, '#f9fafb');   // 底部：浅灰色
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, canvasSize.width, canvasSize.height);

        // 绘制装饰性元素：微妙的点状背景
        ctx.save();
        ctx.fillStyle = 'rgba(26, 86, 219, 0.03)'; // 非常淡的蓝色点
        const dotSize = 2;
        const dotSpacing = 40;
        for (let x = 0; x < canvasSize.width; x += dotSpacing) {
          for (let y = 0; y < canvasSize.height; y += dotSpacing) {
            ctx.beginPath();
            ctx.arc(x, y, dotSize, 0, Math.PI * 2);
            ctx.fill();
          }
        }
        ctx.restore();

        // 绘制装饰性圆形（左上角和右下角）
        ctx.save();
        // 左上角大圆
        const topLeftGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, 200);
        topLeftGradient.addColorStop(0, 'rgba(26, 86, 219, 0.08)');
        topLeftGradient.addColorStop(1, 'rgba(26, 86, 219, 0)');
        ctx.fillStyle = topLeftGradient;
        ctx.beginPath();
        ctx.arc(0, 0, 200, 0, Math.PI * 2);
        ctx.fill();

        // 右下角大圆
        const bottomRightGradient = ctx.createRadialGradient(
          canvasSize.width,
          canvasSize.height,
          0,
          canvasSize.width,
          canvasSize.height,
          250
        );
        bottomRightGradient.addColorStop(0, 'rgba(139, 92, 246, 0.06)'); // 紫色
        bottomRightGradient.addColorStop(1, 'rgba(139, 92, 246, 0)');
        ctx.fillStyle = bottomRightGradient;
        ctx.beginPath();
        ctx.arc(canvasSize.width, canvasSize.height, 250, 0, Math.PI * 2);
        ctx.fill();

        // 右上角小圆
        const topRightGradient = ctx.createRadialGradient(
          canvasSize.width,
          0,
          0,
          canvasSize.width,
          0,
          150
        );
        topRightGradient.addColorStop(0, 'rgba(16, 185, 129, 0.05)'); // 绿色
        topRightGradient.addColorStop(1, 'rgba(16, 185, 129, 0)');
        ctx.fillStyle = topRightGradient;
        ctx.beginPath();
        ctx.arc(canvasSize.width, 0, 150, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // 绘制每个词云项
        wordCloudItems.forEach((item) => {
          const isHovered = hoveredId === item.id;
          const isActive = isHovered;

          // 保存上下文
          ctx.save();
          
          // 移动到词语中心
          ctx.translate(item.x, item.y);
          ctx.rotate(item.rotation);

          // 激活状态仅改变颜色，不添加动画效果

          // 绘制前缀（如果有）
          if (item.prefix) {
            ctx.fillStyle = isActive ? NEUTRAL_COLORS.textSecondary : NEUTRAL_COLORS.textTertiary;
            ctx.font = `400 12px "PingFang SC", "Microsoft YaHei", sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(item.prefix, 0, -item.coreHeight / 2 - 5);
          }

          // 绘制核心词
          // 象限1使用更粗的字重和更深的颜色来突出显示
          const isQuadrant1 = item.portrait.quadrant?.quadrants === 1;
          const fontWeight = isActive ? '700' : (isQuadrant1 ? '600' : '500');
          const textColor = isActive ? PRIMARY_COLORS.main : (isQuadrant1 ? PRIMARY_COLORS.mainDark : item.color);
          
          ctx.fillStyle = textColor;
          ctx.font = `${fontWeight} ${item.fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(item.core, 0, 0);

          // 恢复上下文
          ctx.restore();
        });

        // 如果有点击项，淡化其他项
        if (hoveredId !== null) {
          wordCloudItems.forEach(item => {
            if (item.id !== hoveredId) {
              ctx.save();
              ctx.globalAlpha = 0.2;
              
              ctx.translate(item.x, item.y);
              ctx.rotate(item.rotation);

              if (item.prefix) {
                ctx.fillStyle = '#999999';
                ctx.font = `400 12px "PingFang SC", "Microsoft YaHei", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.fillText(item.prefix, 0, -item.coreHeight / 2 - 5);
              }

              ctx.fillStyle = item.color;
              ctx.font = `500 ${item.fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              ctx.fillText(item.core, 0, 0);

              ctx.restore();
            }
          });
        }

        // 绘制顶部提示文字（带背景）
        const tipText = '👇 点击任意词语查看详细报告';
        const tipFontSize = 14;
        const tipPadding = 12;
        const tipMargin = 8; // 增大顶部间距
        
        // 测量提示文字宽度
        ctx.font = `${tipFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        const tipTextMetrics = ctx.measureText(tipText);
        const tipTextWidth = tipTextMetrics.width;
        const tipBoxWidth = tipTextWidth + tipPadding * 2;
        const tipBoxHeight = tipFontSize + tipPadding * 2;
        const tipX = (canvasSize.width - tipBoxWidth) / 2;
        const tipY = tipMargin; // 顶部位置

        // 绘制提示框背景（带渐变和阴影效果）
        ctx.save();
        const cornerRadius = 18;
        const x = tipX;
        const y = tipY;
        const w = tipBoxWidth;
        const h = tipBoxHeight;
        
        // 绘制阴影
        ctx.shadowColor = 'rgba(26, 86, 219, 0.2)';
        ctx.shadowBlur = 12;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 4;
        
        // 绘制渐变背景
        const tipGradient = ctx.createLinearGradient(x, y, x, y + h);
        tipGradient.addColorStop(0, 'rgba(26, 86, 219, 0.12)');
        tipGradient.addColorStop(1, 'rgba(26, 86, 219, 0.08)');
        ctx.fillStyle = tipGradient;
        
        // 绘制圆角矩形路径
        ctx.beginPath();
        ctx.moveTo(x + cornerRadius, y);
        ctx.lineTo(x + w - cornerRadius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + cornerRadius);
        ctx.lineTo(x + w, y + h - cornerRadius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - cornerRadius, y + h);
        ctx.lineTo(x + cornerRadius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - cornerRadius);
        ctx.lineTo(x, y + cornerRadius);
        ctx.quadraticCurveTo(x, y, x + cornerRadius, y);
        ctx.closePath();
        ctx.fill();
        
        // 绘制提示文字（使用品牌色，更醒目）
        ctx.fillStyle = PRIMARY_COLORS.main; // 品牌蓝色，更醒目
        ctx.font = `500 ${tipFontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(tipText, canvasSize.width / 2, tipY + tipBoxHeight / 2);
        
        ctx.restore();
      })
      .catch(error => {
        console.error('绘制词云失败:', error);
      });
  }, [canvasSize, dpr, wordCloudItems, hoveredId, getCanvasNode]);

  // 处理触摸移动（用于悬停效果）
  const handleTouchMove = useCallback(
    (e: any) => {
    const query = Taro.createSelectorQuery();
    query
        .select('#word-cloud-canvas')
      .boundingClientRect((rect: any) => {
        if (!rect) return;

          let touchX = 0;
          let touchY = 0;

          if (e.touches && e.touches.length > 0) {
            touchX = e.touches[0].clientX - rect.left;
            touchY = e.touches[0].clientY - rect.top;
        } else {
          return;
        }

          // 转换为 Canvas 逻辑坐标
        const scaleX = canvasSize.width / rect.width;
        const scaleY = canvasSize.height / rect.height;
          touchX = touchX * scaleX;
          touchY = touchY * scaleY;

          // 查找触摸的词云项
          let hoveredItem: WordCloudItem | null = null;
          let minDistance = Infinity;

          const items = wordCloudItemsRef.current;
          for (const item of items) {
            const dx = touchX - item.x;
            const dy = touchY - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const hoverRadius = Math.max(item.width, item.height) / 2 + 20;

            if (distance < hoverRadius && distance < minDistance) {
              minDistance = distance;
              hoveredItem = item;
            }
          }

          setHoveredId(hoveredItem?.id || null);
        })
        .exec();
    },
    [canvasSize]
  );

  // 处理触摸结束（用于点击）
  const handleTouchEnd = useCallback(
    (e: any) => {
      const query = Taro.createSelectorQuery();
      query
        .select('#word-cloud-canvas')
        .boundingClientRect((rect: any) => {
          if (!rect) return;

          let touchX = 0;
          let touchY = 0;

          if (e.changedTouches && e.changedTouches.length > 0) {
            touchX = e.changedTouches[0].clientX - rect.left;
            touchY = e.changedTouches[0].clientY - rect.top;
          } else if (e.detail && typeof e.detail.x === 'number') {
            touchX = e.detail.x - rect.left;
            touchY = e.detail.y - rect.top;
          } else {
            setHoveredId(null);
            return;
          }

          // 转换为 Canvas 逻辑坐标
          const scaleX = canvasSize.width / rect.width;
          const scaleY = canvasSize.height / rect.height;
          touchX = touchX * scaleX;
          touchY = touchY * scaleY;

          // 查找点击的词云项
          let clickedItem: WordCloudItem | null = null;
          let minDistance = Infinity;

          const items = wordCloudItemsRef.current;
          for (const item of items) {
            const dx = touchX - item.x;
            const dy = touchY - item.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const clickRadius = Math.max(item.width, item.height) / 2 + 20;

            if (distance < clickRadius && distance < minDistance) {
              minDistance = distance;
              clickedItem = item;
            }
          }

          if (clickedItem && onItemClick) {
            // 立即执行点击回调，无延迟无动画
            onItemClick(clickedItem.portrait);
          } else {
            setHoveredId(null);
        }
      })
      .exec();
    },
    [canvasSize, onItemClick]
  );

  if (canvasSize.width === 0) {
    return null;
  }

  return (
    <>
      {/* 隐藏的测量 Canvas，用于精确测量文本宽度 */}
      <Canvas
        id="measure-canvas"
        type="2d"
        canvasId="measure-canvas"
        style={{
          position: 'absolute',
          top: '-9999px',
          left: '-9999px',
          width: '2000px',
          height: '200px',
          visibility: 'hidden',
        }}
      />
      {/* 主词云 Canvas */}
      <Canvas
        id="word-cloud-canvas"
        type="2d"
        canvasId="word-cloud-canvas"
        className="personal-profile-page__word-cloud-canvas"
        style={{
          width: `${canvasSize.width}px`,
          height: `${canvasSize.height}px`,
        }}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={() => setHoveredId(null)}
      />
    </>
  );
}

export default function PersonalProfilePage() {
  // 检查问卷完成状态
  const { isCompleted: isQuestionnaireCompleted, isLoading: isCheckingQuestionnaire, answerCount } = useQuestionnaireCheck();
  const [showQuestionnaireModal, setShowQuestionnaireModal] = useState(false);
  const [showOverviewModal, setShowOverviewModal] = useState(false);
  
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [loading, setLoading] = useState(true);
  
  // 浮动按钮位置和拖动状态
  const [floatButtonTop, setFloatButtonTop] = useState<number>(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartY, setDragStartY] = useState(0);
  const [dragStartTop, setDragStartTop] = useState(0);
  const windowInfoRef = useRef<{ windowWidth: number; windowHeight: number } | null>(null);

  // 我要反馈：下拉展示与选项，当前已选反馈（由接口返回值赋值），当前反馈对应的画像 id
  const [showFeedbackDropdown, setShowFeedbackDropdown] = useState(false);
  const [feedbackPortraitId, setFeedbackPortraitId] = useState<number | undefined>(undefined);
  const [currentFeedbackOption, setCurrentFeedbackOption] = useState<string | null>(null);
  const [showFeedbackRightArrow, setShowFeedbackRightArrow] = useState(true);
  const feedbackScrollRef = useRef<{ viewWidth: number; contentWidth: number } | null>(null);
  const FEEDBACK_OPTIONS = [
    '非常符合',
    '比较符合',
    '一般',
    '不太符合',
    '完全不符合',
    '符合我以前的状态',
  ];
  const handleFeedbackOption = useCallback(async (option: string) => {
    setShowFeedbackDropdown(false);
    try {
      Taro.showLoading({ title: '提交中...', mask: true });
      await createPortraitFeedback(option, feedbackPortraitId);
      setCurrentFeedbackOption(option);
      Taro.hideLoading();
      Taro.showToast({ title: '反馈已提交', icon: 'success', duration: 1500 });
    } catch (e) {
      Taro.hideLoading();
      Taro.showToast({
        title: (e as Error)?.message || '提交失败，请重试',
        icon: 'none',
        duration: 2000,
      });
    }
  }, [feedbackPortraitId]);

  // 打开「我要反馈」下拉时请求接口，用返回值给选项赋值（已选状态）；传入当前画像 id
  useEffect(() => {
    if (!showFeedbackDropdown) return;
    let cancelled = false;
    getPortraitFeedback(feedbackPortraitId)
      .then((res) => {
        if (cancelled) return;
        if (res == null) {
          setCurrentFeedbackOption(null);
          return;
        }
        if (Array.isArray(res)) {
          const forPortrait = feedbackPortraitId != null
            ? res.find((r) => r.portraitId === feedbackPortraitId)
            : res.find((r) => r.portraitId == null);
          const item = forPortrait ?? res[0];
          setCurrentFeedbackOption(item?.option ?? null);
        } else {
          setCurrentFeedbackOption(res.option ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) setCurrentFeedbackOption(null);
      });
    return () => {
      cancelled = true;
    };
  }, [showFeedbackDropdown, feedbackPortraitId]);

  // 下拉打开时查询滚动区域与内容宽度，判断是否显示右侧箭头
  useEffect(() => {
    if (!showFeedbackDropdown) return;
    setShowFeedbackRightArrow(true);
    const t = setTimeout(() => {
      const query = Taro.createSelectorQuery();
      query.select('.personal-profile-page__feedback-scroll').boundingClientRect();
      query.select('.personal-profile-page__feedback-row').boundingClientRect();
      query.exec((res) => {
        if (res[0] && res[1] && res[1].width > res[0].width) {
          feedbackScrollRef.current = { viewWidth: res[0].width, contentWidth: res[1].width };
          setShowFeedbackRightArrow(true);
        } else {
          feedbackScrollRef.current = null;
          setShowFeedbackRightArrow(false);
        }
      });
    }, 100);
    return () => clearTimeout(t);
  }, [showFeedbackDropdown]);

  const handleFeedbackScroll = useCallback((e: any) => {
    const { scrollLeft } = e?.detail ?? {};
    const ref = feedbackScrollRef.current;
    if (ref && typeof scrollLeft === 'number') {
      const threshold = ref.contentWidth - ref.viewWidth - 20;
      setShowFeedbackRightArrow(threshold > 0 && scrollLeft < threshold);
    }
  }, []);

  // 检查问卷完成状态
  useEffect(() => {
    if (!isCheckingQuestionnaire && !isQuestionnaireCompleted) {
      setShowQuestionnaireModal(true);
    }
  }, [isCheckingQuestionnaire, isQuestionnaireCompleted]);

  useEffect(() => {
    Promise.resolve(Taro.getWindowInfo()).then((info) => {
      windowInfoRef.current = { windowWidth: info.windowWidth, windowHeight: info.windowHeight };
    });
  }, []);

  useEffect(() => {
    // 加载用户画像数据
    const loadPortraitData = async () => {
      try {
        setLoading(true);
        const data = await getUserPortrait();
        const portraitsList = data.portrait || [];
        setPortraits(portraitsList);
      } catch (error) {
        console.error('加载用户画像数据失败:', error);
        Taro.showToast({
          title: '加载数据失败，请稍后重试',
          icon: 'none',
          duration: 2000,
        });
      } finally {
        setLoading(false);
      }
    };

    loadPortraitData();
  }, []);

  // 处理词云项点击：跳转到独立详情页（返回由导航栏处理，符合手机端习惯）
  const handleWordCloudItemClick = useCallback((portrait: Portrait) => {
    Taro.setStorageSync('portraitDetail', portrait);
    Taro.navigateTo({ url: '/pages/assessment/portrait-detail/index' });
  }, []);

  // 打开总览报告对话框
  const handleOpenOverview = useCallback(() => {
    // 如果正在拖动或刚拖动完，不触发打开
    if (isDragging) {
      return;
    }
    
    // 延迟检查，避免拖动结束后立即触发点击
    setTimeout(() => {
      if (!isDragging) {
        setShowOverviewModal(true);
      }
    }, 150);
  }, [isDragging]);

  // 处理拖动开始
  const handleTouchStart = useCallback((e: any) => {
    e.stopPropagation();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;
    setIsDragging(false); // 先设为false，等待移动距离判断
    setDragStartY(touch.clientY || touch.y || 0);
    const win = windowInfoRef.current || { windowWidth: 375, windowHeight: 667 };
    const defaultBottom = 160 * (win.windowWidth / 750); // rpx转px
    const currentTop = floatButtonTop > 0 
      ? floatButtonTop 
      : win.windowHeight - defaultBottom - 112 * (win.windowWidth / 750);
    setDragStartTop(currentTop);
  }, [floatButtonTop]);

  // 处理拖动中
  const handleTouchMove = useCallback((e: any) => {
    e.stopPropagation();
    const touch = e.touches?.[0] || e.changedTouches?.[0];
    if (!touch) return;
    const currentY = touch.clientY || touch.y || 0;
    const deltaY = Math.abs(currentY - dragStartY);
    
    // 如果移动距离超过5px，认为是拖动
    if (deltaY > 5) {
      setIsDragging(true);
    }
    
    if (deltaY > 5) {
      const newTop = dragStartTop + (currentY - dragStartY);
      const win = windowInfoRef.current || { windowWidth: 375, windowHeight: 667 };
      const rpxToPx = win.windowWidth / 750;
      const buttonHeight = 112 * rpxToPx; // 按钮高度
      const bottomNavHeight = 100 * rpxToPx; // 底部导航栏高度
      const headerHeight = 200 * rpxToPx; // 顶部区域高度
      const minTop = headerHeight;
      const maxTop = win.windowHeight - buttonHeight - bottomNavHeight;
      const clampedTop = Math.max(minTop, Math.min(maxTop, newTop));
      setFloatButtonTop(clampedTop);
    }
  }, [dragStartY, dragStartTop]);

  // 处理拖动结束
  const handleTouchEnd = useCallback((e: any) => {
    e.stopPropagation();
    // 延迟重置拖动状态，避免立即触发点击事件
    setTimeout(() => {
      setIsDragging(false);
    }, 100);
  }, []);

  if (loading) {
    return (
      <View className="personal-profile-page">
        <View className="personal-profile-page__loading">
          <Text>加载中...</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  if (portraits.length === 0) {
    return (
      <View className="personal-profile-page personal-profile-page--empty">
        <View className="personal-profile-page__empty">
          <View className="personal-profile-page__empty-card">
            <View className="personal-profile-page__empty-icon-wrap">
              <Text className="personal-profile-page__empty-icon">✦</Text>
            </View>
            <Text className="personal-profile-page__empty-title">自我发现建议</Text>
            <Text className="personal-profile-page__empty-desc">
              您的自评数据，暂时未呈现出明显的“待发展特质”，建议启动“走进内心世界，寻找最真的自己”配套服务，基于更深入细致的自我发现，“遇见”独一无二的自己！
            </Text>
          </View>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View className="personal-profile-page">
      {/* 画像内容区：「我要反馈」在导航行（当前/下一个之间），下拉浮层 */}
      <View className="personal-profile-page__main">
        {showFeedbackDropdown && (
          <>
            <View
              className="personal-profile-page__feedback-mask"
              onClick={() => setShowFeedbackDropdown(false)}
            />
            <View className="personal-profile-page__feedback-dropdown">
              <ScrollView
                scrollX
                className="personal-profile-page__feedback-scroll"
                onScroll={handleFeedbackScroll}
              >
                <View className="personal-profile-page__feedback-row">
                  {FEEDBACK_OPTIONS.map((opt) => (
                    <View
                      key={opt}
                      className={`personal-profile-page__feedback-option${currentFeedbackOption === opt ? ' personal-profile-page__feedback-option--selected' : ''}`}
                      onClick={() => handleFeedbackOption(opt)}
                    >
                      <Text className="personal-profile-page__feedback-option-text">{opt}</Text>
                    </View>
                  ))}
                </View>
              </ScrollView>
              {showFeedbackRightArrow && (
                <View className="personal-profile-page__feedback-arrow" aria-hidden>
                  <Text className="personal-profile-page__feedback-arrow-icon">›</Text>
                </View>
              )}
            </View>
          </>
        )}
        <WordCloudCSS 
          portraits={portraits} 
          onItemClick={handleWordCloudItemClick}
          showOverviewModal={showOverviewModal}
          setShowOverviewModal={setShowOverviewModal}
          onFeedbackClick={(portraitId) => {
            setFeedbackPortraitId(portraitId);
            setShowFeedbackDropdown((v) => !v);
          }}
        />
      </View>

      {/* 浮动按钮：打开总览报告 */}
      <View 
        className={`personal-profile-page__float-button ${isDragging ? 'personal-profile-page__float-button--dragging' : ''}`}
        style={{ 
          bottom: floatButtonTop > 0 ? 'auto' : '160rpx',
          top: floatButtonTop > 0 ? `${floatButtonTop}px` : 'auto',
          transform: isDragging ? 'scale(1.05)' : 'scale(1)'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={handleOpenOverview}
      >
        <View className="personal-profile-page__float-button-content">
          <Text className="personal-profile-page__float-button-text">总览报告</Text>
        </View>
      </View>
      
      <BottomNav />

      {/* 问卷完成提示弹窗 */}
      <QuestionnaireRequiredModal
        open={showQuestionnaireModal}
        onOpenChange={setShowQuestionnaireModal}
        answerCount={answerCount}
      />
    </View>
  );
}