// 个人特质报告页面
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { View, Text, Canvas } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { BottomNav } from '@/components/BottomNav';
import { getUserPortrait, Portrait } from '@/services/portraits';
import './index.less';

// 七维度配置（对应7种颜色）
const DIMENSIONS = ['看', '听', '说', '记', '想', '做', '运动'] as const;

// 维度颜色映射
const DIMENSION_COLORS: Record<string, string> = {
  看: '#3B82F6', // 蓝色
  听: '#8B5CF6', // 紫色
  说: '#10B981', // 绿色
  记: '#F59E0B', // 橙色
  想: '#EF4444', // 红色
  做: '#EC4899', // 粉色
  运动: '#06B6D4', // 青色
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

// 节点尺寸常量（统一管理，确保绘制和点击检测一致）
const DEFAULT_NODE_RADIUS = 38; // 节点半径（选中和未选中都使用相同大小）
const SELECTED_NODE_RADIUS = 38; // 与默认相同，保持大小一致
const CLICK_TOLERANCE = 10; // 点击容差

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
 * 解析适配角色文本为列表
 */
function parseRoles(rolesText: string): string[] {
  if (!rolesText) return [];
  // 按逗号、分号或换行符分割
  const roles = rolesText
    .split(/[，,；;\n]/)
    .map(r => r.trim())
    .filter(r => r.length > 0);
  return roles;
}


/**
 * 七维度可视化图表组件（使用Canvas实现）
 */
function DimensionsChart({
  dimensions,
  portraitsMap,
  selectedDimension,
  onSelectDimension,
}: {
  dimensions: typeof DIMENSIONS;
  portraitsMap: Map<string, Portrait>;
  selectedDimension: string | null;
  onSelectDimension: (dim: string) => void;
}) {
  const [canvasSize, setCanvasSize] = useState({ width: 600, height: 600 });
  const [dpr, setDpr] = useState(1);
  const canvasRef = useRef<any>(null);

  // 根据设备动态调整大小
  const getChartConfig = useCallback((deviceWidth: number) => {
    // 基础配置（以750设计稿为基准）
    const baseConfig = {
      nodeRadius: 32,
      centerRadius: 36,
      fontSize: 24,
      centerFontSize: 22,
      lineWidth: 1.5,
      margin: 15,
      canvasBaseSize: 600,
    };

    // 根据屏幕宽度缩放
    const scale = deviceWidth / 750;
    return {
      nodeRadius: Math.round(baseConfig.nodeRadius * scale),
      centerRadius: Math.round(baseConfig.centerRadius * scale),
      fontSize: Math.round(baseConfig.fontSize * scale),
      centerFontSize: Math.round(baseConfig.centerFontSize * scale),
      lineWidth: baseConfig.lineWidth * scale,
      margin: Math.round(baseConfig.margin * scale),
      canvasSize: Math.round(baseConfig.canvasBaseSize * scale),
    };
  }, []);

  // 初始化设备信息
  useEffect(() => {
    const windowInfo = Taro.getWindowInfo();
    const windowWidth = windowInfo.windowWidth;

    // 获取设备像素比
    let deviceDpr = 2; // 默认值
    try {
      deviceDpr = windowInfo.pixelRatio || 2;
    } catch (e) {
      console.log('获取DPI失败:', e);
    }

    setDpr(deviceDpr);

    // 根据设备宽度计算Canvas尺寸
    const config = getChartConfig(windowWidth);
    const canvasWidth = config.canvasSize;

    console.log('设备信息:', {
      windowWidth,
      dpr: deviceDpr,
      canvasWidth,
      config,
    });

    setCanvasSize({
      width: canvasWidth,
      height: canvasWidth,
    });
  }, [getChartConfig]);

  // 计算维度位置
  const dimensionPositions = useMemo(() => {
    if (canvasSize.width === 0) return [];

    const config = getChartConfig(750 * (canvasSize.width / 600));
    const centerX = canvasSize.width / 2;
    const centerY = canvasSize.height / 2;
    const radius =
      Math.min(canvasSize.width, canvasSize.height) / 2 - config.nodeRadius - config.margin;

    return dimensions.map((dim, index) => {
      const angle = (index * 2 * Math.PI) / dimensions.length - Math.PI / 2;
      const x = centerX + radius * Math.cos(angle);
      const y = centerY + radius * Math.sin(angle);
      return {
        dim,
        x,
        y,
        hasPortrait: portraitsMap.has(dim),
      };
    });
  }, [dimensions, portraitsMap, canvasSize, getChartConfig]);

  // 获取Canvas节点
  const getCanvasNode = useCallback(() => {
    return new Promise<any>(resolve => {
      const query = Taro.createSelectorQuery();
      query
        .select('#dimensions-canvas')
        .fields({ node: true, size: true })
        .exec(res => {
          if (res && res[0]) {
            // 小程序中返回的结构是 { node: Canvas, ... }
            const canvas = res[0].node;
            if (canvas) {
              canvasRef.current = canvas;
              resolve(canvas);
            } else {
              console.warn('未获取到Canvas节点');
              resolve(null);
            }
          } else {
            console.warn('查询Canvas失败');
            resolve(null);
          }
        });
    });
  }, []);

  // 高清绘制Canvas
  useEffect(() => {
    if (canvasSize.width === 0 || dpr === 0) return;

    getCanvasNode()
      .then(canvas => {
        if (!canvas) {
          console.warn('Canvas节点不存在，跳过绘制');
          return;
        }

        // 小程序中可以直接使用canvas.getContext
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          console.warn('获取Canvas上下文失败');
          return;
        }

        // 获取当前配置
        const config = getChartConfig(750 * (canvasSize.width / 600));

        // 高清处理：设置Canvas物理尺寸为逻辑尺寸的dpr倍
        const physicalWidth = canvasSize.width * dpr;
        const physicalHeight = canvasSize.height * dpr;

        // 先设置物理尺寸
        canvas.width = physicalWidth;
        canvas.height = physicalHeight;

        // 重置变换并应用DPI缩放
        ctx.scale(dpr, dpr);

        // 清空画布（使用逻辑尺寸）
        ctx.clearRect(0, 0, canvasSize.width, canvasSize.height);

        const centerX = canvasSize.width / 2;
        const centerY = canvasSize.height / 2;

        // 绘制连接线
        dimensionPositions.forEach(pos => {
          ctx.beginPath();
          ctx.moveTo(centerX, centerY);
          ctx.lineTo(pos.x, pos.y);
          ctx.strokeStyle = '#e5e7eb';
          ctx.lineWidth = config.lineWidth;
          ctx.setLineDash([3 * (canvasSize.width / 600), 3 * (canvasSize.width / 600)]);
          ctx.stroke();
          ctx.setLineDash([]);
        });

        // 绘制维度按钮
        dimensionPositions.forEach(pos => {
          const color = DIMENSION_COLORS[pos.dim];
          const isSelected = selectedDimension === pos.dim;
          const hasPortrait = pos.hasPortrait;

          // 选中状态的外圈
          if (isSelected) {
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, config.nodeRadius + 6 * (canvasSize.width / 600), 0, 2 * Math.PI);
            ctx.fillStyle = color;
            ctx.globalAlpha = 0.15;
            ctx.fill();
            ctx.globalAlpha = 1;
          }

          // 主圆
          ctx.beginPath();
          ctx.arc(pos.x, pos.y, config.nodeRadius, 0, 2 * Math.PI);
          ctx.fillStyle = isSelected ? color : '#fff';
          ctx.fill();
          ctx.strokeStyle = color;
          ctx.lineWidth = isSelected
            ? config.lineWidth * 1.5 // 选中时稍粗
            : config.lineWidth;
          ctx.globalAlpha = hasPortrait ? 1 : 0.5;
          ctx.stroke();
          ctx.globalAlpha = 1;

          // 维度文字
          ctx.fillStyle = isSelected ? '#fff' : color;
          ctx.font = `bold ${config.fontSize}px "PingFang SC", "Microsoft YaHei", "Helvetica Neue", sans-serif`;
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(pos.dim, pos.x, pos.y - config.fontSize * 0.04);
        });

        // 绘制中心圆
        ctx.beginPath();
        ctx.arc(centerX, centerY, config.centerRadius, 0, 2 * Math.PI);
        ctx.fillStyle = '#f5f5f5';
        ctx.fill();
        ctx.strokeStyle = '#e5e7eb';
        ctx.lineWidth = config.lineWidth;
        ctx.stroke();

        // 中心文字
        ctx.fillStyle = '#666';
        ctx.font = `bold ${config.centerFontSize}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('总览', centerX, centerY - config.centerFontSize * 0.04);
      })
      .catch(error => {
        console.error('绘制Canvas失败:', error);
      });
  }, [canvasSize, dimensionPositions, selectedDimension, dpr, getChartConfig, getCanvasNode]);

  // 处理Canvas点击事件
  const handleCanvasClick = (e: any) => {
    const query = Taro.createSelectorQuery();
    query
      .select('#dimensions-canvas')
      .boundingClientRect((rect: any) => {
        if (!rect) return;

        let clickX = 0;
        let clickY = 0;

        // 获取点击位置
        if (e.detail && typeof e.detail.x === 'number') {
          clickX = e.detail.x - rect.left;
          clickY = e.detail.y - rect.top;
        } else if (e.touches && e.touches.length > 0) {
          clickX = e.touches[0].clientX - rect.left;
          clickY = e.touches[0].clientY - rect.top;
        } else {
          return;
        }

        // 获取当前配置
        const config = getChartConfig(750 * (canvasSize.width / 600));

        // 转换为Canvas逻辑坐标（考虑CSS缩放）
        const scaleX = canvasSize.width / rect.width;
        const scaleY = canvasSize.height / rect.height;
        clickX = clickX * scaleX;
        clickY = clickY * scaleY;

        // 查找点击的节点
        let clickedDim = null;

        for (const pos of dimensionPositions) {
          if (!pos.hasPortrait) continue;

          const dist = Math.sqrt(Math.pow(clickX - pos.x, 2) + Math.pow(clickY - pos.y, 2));

          // 点击容差：节点半径 + 5px
          if (dist < config.nodeRadius + 5) {
            clickedDim = pos.dim;
            break;
          }
        }

        if (clickedDim && clickedDim !== selectedDimension) {
          onSelectDimension(clickedDim);
        }
      })
      .exec();
  };

  return (
    <View className="personal-profile-page__chart-container">
      <View className="personal-profile-page__chart-wrapper">
        <Canvas
          id="dimensions-canvas"
          type="2d"
          canvasId="dimensions-canvas" // 添加canvasId，小程序可能需要
          className="personal-profile-page__chart-canvas"
          style={{
            width: `${canvasSize.width}px`,
            height: `${canvasSize.height}px`,
          }}
          onTap={handleCanvasClick}
          onTouchEnd={handleCanvasClick}
        />
      </View>
      <View className="personal-profile-page__chart-tip">
        <Text className="personal-profile-page__chart-tip-text">👆 点击维度圆圈查看详情</Text>
      </View>
    </View>
  );
}

/**
 * Portrait 详情卡片组件
 */
function PortraitDetailCard({
  portrait,
  dimension,
  color,
  lightColor,
}: {
  portrait: Portrait;
  dimension: string;
  color: string;
  lightColor: string;
}) {
  const [expanded, setExpanded] = useState(false);

  // 解析核心特质
  const traits = useMemo(() => {
    return parseTraits(portrait.partOneDescription || portrait.status || '');
  }, [portrait.partOneDescription, portrait.status]);

  // 解析适配角色
  const roles = useMemo(() => {
    if (portrait.quadrant1Niches && portrait.quadrant1Niches.length > 0) {
      // 合并所有生态位的possibleRoles
      const allRoles = portrait.quadrant1Niches.map(niche => niche.possibleRoles).join('，');
      return parseRoles(allRoles);
    }
    return [];
  }, [portrait.quadrant1Niches]);

  // 获取核心维度显示文本
  const getDimensionText = () => {
    // 如果有partOneSubTitle，使用"维度-子类型"格式
    if (portrait.partOneSubTitle) {
      return `${dimension}-${portrait.partOneSubTitle}`;
    }
    // 否则只显示维度
    return dimension;
  };

  // 处理查看完整分析
  const handleViewDetail = () => {
    setExpanded(!expanded);
  };

  return (
    <View className="personal-profile-page__detail-card">
      {/* 彩色头部 */}
      <View className="personal-profile-page__detail-header" style={{ backgroundColor: color }}>
        <Text className="personal-profile-page__detail-title">{portrait.name}</Text>
        <Text className="personal-profile-page__detail-id">
          ID: {portrait.id} | {getDimensionText()}
        </Text>
      </View>

      {/* 卡片内容 */}
      <View className="personal-profile-page__detail-body">
        {/* 核心特质 */}
        {traits.length > 0 && (
          <View className="personal-profile-page__detail-section">
            <Text className="personal-profile-page__detail-section-title">核心特质</Text>
            <View className="personal-profile-page__detail-traits">
              {traits.map((trait, index) => (
                <View key={index} className="personal-profile-page__detail-trait-item">
                  <View className="personal-profile-page__detail-trait-dot" />
                  <Text className="personal-profile-page__detail-trait-text">{trait}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 展开的详细内容 */}
        {expanded && (
          <View className="personal-profile-page__detail-expanded">
            {/* 核心双刃剑 */}
            {portrait.partTwoDescription && (
              <View className="personal-profile-page__detail-section">
                <Text className="personal-profile-page__detail-section-title">核心双刃剑</Text>
                <Text className="personal-profile-page__detail-double-edged">
                  {portrait.partTwoDescription}
                </Text>
              </View>
            )}

            {/* 适配角色 */}
            {roles.length > 0 && (
              <View className="personal-profile-page__detail-section">
                <Text className="personal-profile-page__detail-section-title">适配角色</Text>
                <View className="personal-profile-page__detail-roles">
                  {roles.map((role, index) => (
                    <View
                      key={index}
                      className="personal-profile-page__detail-role-pill"
                      style={{ backgroundColor: lightColor, color: color }}
                    >
                      <Text className="personal-profile-page__detail-role-text">{role}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}
          </View>
        )}

        {/* 查看完整分析链接 */}
        <View className="personal-profile-page__detail-link" onClick={handleViewDetail}>
          <Text className="personal-profile-page__detail-link-text" style={{ color: color }}>
            {expanded ? '收起' : '查看完整分析'} &gt;
          </Text>
        </View>
      </View>
    </View>
  );
}

export default function PersonalProfilePage() {
  const [portraits, setPortraits] = useState<Portrait[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDimension, setSelectedDimension] = useState<string | null>(null);

  useEffect(() => {
    // 加载用户画像数据
    const loadPortraitData = async () => {
      try {
        setLoading(true);
        const data = await getUserPortrait();
        const portraitsList = data.portrait || [];
        setPortraits(portraitsList);

        // 自动选择第一个有数据的维度
        if (portraitsList.length > 0) {
          const firstPortrait = portraitsList[0];
          const firstDimension =
            firstPortrait.likeElement?.dimension ||
            firstPortrait.talentElement?.dimension ||
            DIMENSIONS[0];
          setSelectedDimension(firstDimension);
        }
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

  // 将portraits按维度分组
  const portraitsByDimension = useMemo(() => {
    const map = new Map<string, Portrait>();

    portraits.forEach(portrait => {
      // 优先使用likeElement的维度，如果没有则使用talentElement的维度
      let dimension = portrait.likeElement?.dimension || portrait.talentElement?.dimension || '';

      // 如果仍然没有维度，尝试从name或status中提取维度信息
      if (!dimension) {
        for (const dim of DIMENSIONS) {
          if (portrait.name?.includes(dim) || portrait.status?.includes(dim)) {
            dimension = dim;
            break;
          }
        }
      }

      // 如果还是没有找到维度，按索引分配维度
      if (!dimension || !DIMENSIONS.includes(dimension as any)) {
        const index = portraits.indexOf(portrait);
        dimension = DIMENSIONS[index % DIMENSIONS.length];
      }

      // 如果该维度还没有portrait，或者当前portrait的ID更小，则使用当前portrait
      if (!map.has(dimension) || portrait.id < (map.get(dimension)?.id || 0)) {
        map.set(dimension, portrait);
      }
    });

    return map;
  }, [portraits]);

  // 获取当前选中的portrait
  const selectedPortrait = useMemo(() => {
    if (!selectedDimension) return null;
    return portraitsByDimension.get(selectedDimension) || null;
  }, [selectedDimension, portraitsByDimension]);

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
      <View className="personal-profile-page">
        <View className="personal-profile-page__empty">
          <Text>暂无画像数据</Text>
        </View>
        <BottomNav />
      </View>
    );
  }

  return (
    <View
      className="personal-profile-page"
      onTouchStart={e => {
        // 只在图表区域外的触摸才阻止，避免影响图表交互
        const target = e.target as any;
        if (target && !target.closest?.('.personal-profile-page__chart-wrapper')) {
          // 图表外的触摸可以正常处理
        }
      }}
    >
      {/* 头部区域 */}
      <View className="personal-profile-page__header">
        <View className="personal-profile-page__header-content">
          <Text className="personal-profile-page__header-title">个人特质分析</Text>
        </View>
        <View className="personal-profile-page__header-wave" />
      </View>

      {/* 内容区域 */}
      <View className="personal-profile-page__content">
        {/* 七维度可视化图表 */}
        <DimensionsChart
          dimensions={DIMENSIONS}
          portraitsMap={portraitsByDimension}
          selectedDimension={selectedDimension}
          onSelectDimension={setSelectedDimension}
        />

        {/* 详情卡片 */}
        {selectedPortrait && selectedDimension && (
          <View className="personal-profile-page__detail-container">
            <PortraitDetailCard
              portrait={selectedPortrait}
              dimension={selectedDimension}
              color={DIMENSION_COLORS[selectedDimension]}
              lightColor={DIMENSION_LIGHT_COLORS[selectedDimension]}
            />
          </View>
        )}
      </View>

      <BottomNav />
    </View>
  );
}
