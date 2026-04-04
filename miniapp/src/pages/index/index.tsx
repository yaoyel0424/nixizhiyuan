// 首页
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useShareAppMessage, useShareTimeline, useDidShow, useReady } from '@tarojs/taro';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BottomNav } from '@/components/BottomNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { getStorage } from '@/utils/storage';
import { getUserRelatedDataCount } from '@/services/user';
import {
  sceneToAgentUuid,
  STORAGE_KEY_LAUNCH_AGENT_UUID,
  STORAGE_KEY_LAUNCH_AGENT_FROM,
  bindAgentByUuid,
} from '@/services/agent';
import { withErrorHandler, withAsyncErrorHandler } from '@/utils/errorHandler';
import './index.less';

// 步骤完成状态类型
type StepStatus = 'completed' | 'current' | 'locked';

// 自定义系统导航栏组件（用于首页）
function SystemNavBar() {
  const [systemInfo, setSystemInfo] = useState<any>(null);

  useEffect(() => {
    Promise.resolve(Taro.getWindowInfo()).then(setSystemInfo);
  }, []);

  if (!systemInfo) return null;

  const statusBarHeight = systemInfo.statusBarHeight || 0;
  const navigationBarHeight = 44; // 微信导航栏标准高度（px）

  return (
    <View
      className="system-nav-bar"
      style={{
        height: `${statusBarHeight + navigationBarHeight}px`,
        paddingTop: `${statusBarHeight}px`,
        backgroundColor: '#f0f7ff',
      }}
    >
      <View className="system-nav-bar__content">
        <View className="system-nav-bar__title">首页</View>
      </View>
    </View>
  );
}

const STORAGE_KEY = 'questionnaire_answers';

/**
 * 微信 Windows 开发者工具在首帧立即 wx.request 时易出现
 * routeDone / webviewId not found 与 timeout，略推迟再拉接口
 */
const MP_ROUTE_STABLE_DELAY_MS = 56;

function loadAnswersFromStorage(): Record<number, number> {
  // Taro 小程序环境，使用同步方式
  try {
    const stored = Taro.getStorageSync(STORAGE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch (error) {
    return {};
  }
}

export default function IndexPage() {
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isClient, setIsClient] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  // API 返回的数据统计
  const [scaleAnswersCount, setScaleAnswersCount] = useState(0);
  const [majorFavoritesCount, setMajorFavoritesCount] = useState(0);
  const [choicesCount, setChoicesCount] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0); // 大于 0 表示二次答题，与个人中心一致
  // 标记是否成功获取了 API 数据
  const [apiDataLoaded, setApiDataLoaded] = useState(false);
  // 降级使用的本地数据（API 失败时使用）
  const [intendedMajorsCount, setIntendedMajorsCount] = useState(0);
  const [hasVisitedMajors, setHasVisitedMajors] = useState(false);
  // 是否已首次展示过（用于 useDidShow 中避免与首次加载重复请求）
  const isFirstShow = useRef(true);

  /**
   * 小程序分享给朋友
   */
  useShareAppMessage(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: '/pages/index/index',
      imageUrl: '', // 可选：分享图片 URL
    }
  })

  /**
   * 小程序分享到朋友圈（需与 useShareAppMessage 同时存在才会显示入口）
   */
  useShareTimeline(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      query: '',
      imageUrl: '', // 空则使用小程序默认图
    }
  })

  useEffect(() => {
    setIsClient(true);
    const storedAnswers = loadAnswersFromStorage();
    setAnswers(storedAnswers);

    // 使用推荐 API 获取窗口信息（含 statusBarHeight），兼容同步/异步返回值
    Promise.resolve(Taro.getWindowInfo()).then(setSystemInfo);

    // 若通过推广链接或小程序码进入：query.uuid 或 scene 还原为 agentUuid，存储并调用 /api/v1/users/agent 绑定
    try {
      const options = Taro.getLaunchOptionsSync?.() || (Taro as any).getEnterOptionsSync?.() || {};
      const query = options.query || {};
      let uuid: string | null = null;
      let from: 'scan' | 'share_link' | undefined;
      if (query.uuid && typeof query.uuid === 'string') {
        uuid = query.uuid.trim() || null;
        from = 'share_link';
      } else {
        const scene = query.scene;
        if (scene && typeof scene === 'string') {
          uuid = sceneToAgentUuid(scene);
          from = 'scan';
        }
      }
      if (uuid) {
        Taro.setStorageSync(STORAGE_KEY_LAUNCH_AGENT_UUID, uuid);
        if (from) Taro.setStorageSync(STORAGE_KEY_LAUNCH_AGENT_FROM, from);
        const token = Taro.getStorageSync('token');
        if (token) {
          setTimeout(() => bindAgentByUuid(uuid, from).catch(() => {}), MP_ROUTE_STABLE_DELAY_MS);
        }
      }
    } catch (_) {}
  }, []);

  // 页面加载时拉取用户进度数据，用于卡片步骤展示
  const fetchUserProgress = () => {
    const storedAnswers = loadAnswersFromStorage();
    setAnswers(storedAnswers);
    getUserRelatedDataCount()
      .then(data => {
        setScaleAnswersCount(data.scaleAnswersCount || 0);
        setMajorFavoritesCount(data.majorFavoritesCount || 0);
        setChoicesCount(data.choicesCount || 0);
        setRepeatCount(data.repeatCount ?? 0);
        setApiDataLoaded(true);
      })
      .catch(() => {
        setApiDataLoaded(false);
        setScaleAnswersCount(Object.keys(storedAnswers).length);
        getStorage<string[]>('intendedMajors').then(v => setIntendedMajorsCount(Array.isArray(v) ? v.length : 0)).catch(() => {});
        getStorage<any[]>('wishlist-items').then(v => setHasVisitedMajors(Array.isArray(v) && v.length > 0)).catch(() => getStorage<string[]>('intendedMajors').then(m => setHasVisitedMajors(Array.isArray(m) && m.length > 0)).catch(() => {}));
      });
  };

  /** 首次数据请求放到页面 onReady 之后，避免与路由完成时序冲突（尤其 Windows 模拟器） */
  useReady(() => {
    setTimeout(() => fetchUserProgress(), MP_ROUTE_STABLE_DELAY_MS);
  });

  // 从其它页面返回时重新拉取进度，使步骤状态及时刷新
  useDidShow(() => {
    if (!isClient) return;
    if (isFirstShow.current) {
      isFirstShow.current = false;
      return; // 首次由 useReady 已调度拉取
    }
    setTimeout(() => fetchUserProgress(), MP_ROUTE_STABLE_DELAY_MS);
  });

  const answeredCount = Object.keys(answers).length;

  // 完成168个题目后解锁三个功能
  const UNLOCK_THRESHOLD = 168;

  // 使用 API 数据判断步骤完成状态（如果 API 数据已加载）
  // 如果 API 调用失败，降级使用本地数据
  const useApiData = apiDataLoaded;

  // 步骤1：深度自我洞察 - 完成168题
  // 使用 API 的 scaleAnswersCount 或本地 answeredCount
  const step1AnswerCount = useApiData ? scaleAnswersCount : answeredCount;
  const step1Completed = step1AnswerCount >= UNLOCK_THRESHOLD;
  const isUnlocked = isClient && step1AnswerCount >= UNLOCK_THRESHOLD;

  // 步骤2：发现契合专业 - 已解锁且访问过专业页面
  // 使用 API 的 majorFavoritesCount 或 choicesCount 判断是否访问过专业页面
  // 如果降级，使用 hasVisitedMajors
  const step2Completed =
    isUnlocked && (useApiData ? majorFavoritesCount > 0 || choicesCount > 0 : hasVisitedMajors);

  // 步骤3：锁定目标院校 - 有选择的专业
  // 使用 API 的 majorFavoritesCount 或本地 intendedMajorsCount
  const step3Completed = useApiData ? majorFavoritesCount > 0 : intendedMajorsCount > 0;

  // 确定当前步骤（显示"您探索到此处"的步骤）
  const getCurrentStep = (): number => {
    if (!step1Completed) return 1;
    if (!step2Completed) return 2;
    if (!step3Completed) return 3;
    return 3; // 所有步骤都完成时，显示在最后一步
  };

  const currentStep = getCurrentStep();

  // 获取步骤状态
  const getStepStatus = (stepNumber: number): StepStatus => {
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'locked';
  };

  /**
   * 进入 168 题启动页（insight-intro），再由此页进入答题
   */
  const goTo168InsightIntro = withErrorHandler(() => {
    const introUrl =
      repeatCount > 0
        ? '/pages/assessment/insight-intro/index?continue=1'
        : '/pages/assessment/insight-intro/index';
    Taro.navigateTo({ url: introUrl });
  }, '打开评估引导失败，请稍后重试');

  // 处理三个功能的点击事件
  const handleMajorExploration = withErrorHandler(() => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none',
      });
      return;
    }

    // 使用 reLaunch 跳转到志愿方案页面
    Taro.navigateTo({
      url: '/pages/majors/index',
    });
  }, '专业探索功能暂时不可用，请稍后重试');

  const handleSchoolExploration = withErrorHandler(() => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none',
      });
      return;
    }
    Taro.navigateTo({
      url: '/pages/majors/intended/index?tab=专业赛道',
    });
  }, '院校探索功能暂时不可用，请稍后重试');

  // 处理深度自我洞察点击事件（repeatCount > 0 时带 continue=1，all-majors 会请求 repeat=true 并标记上次答题）
  const handleSelfInsight = withErrorHandler(() => {
    goTo168InsightIntro();
  }, '深度自我洞察功能暂时不可用，请稍后重试');

  /**
   * 已完成 168 题后：进入答题页查看/继续问卷（与 all-majors 的 continue 逻辑一致）
   */
  const handleViewQuestionnaire = withErrorHandler(() => {
    const url =
      repeatCount > 0
        ? '/pages/assessment/all-majors/index?continue=1'
        : '/pages/assessment/all-majors/index';
    Taro.navigateTo({ url });
  }, '打开问卷失败，请稍后重试');

  // 处理步骤点击（带锁定检查）
  const handleStepClick = withErrorHandler((stepNumber: number, handler: () => void) => {
    const status = getStepStatus(stepNumber);
    if (status === 'locked') {
      Taro.showToast({
        title: '请先完成上面的操作解锁',
        icon: 'none',
        duration: 2000,
      });
      return;
    }
    handler();
  }, '操作失败，请稍后重试');

  const handleQuickAssessment = withErrorHandler(() => {
    // @ts-ignore - 测试错误处理：故意调用未定义的函数
    // assaas();
    Taro.navigateTo({
      url: '/pages/assessment/popular-majors/index',
    });
  }, '快速评估功能暂时不可用，请稍后重试');

  // 计算顶部间距（系统导航栏高度）
  const statusBarHeight = systemInfo?.statusBarHeight || 0;
  const navigationBarHeight = 44;
  const topPadding = statusBarHeight + navigationBarHeight;

  return (
    <ErrorBoundary
      fallbackTitle="首页加载出错"
      fallbackMessage="首页出现异常，请返回或重试。"
    >
      <View className="index-page" style={{ paddingTop: `${topPadding}px` }}>
        <ErrorBoundary
          fallbackTitle="导航栏出错"
          fallbackMessage="导航栏出现异常，但不影响页面其他功能。"
        >
          <SystemNavBar />
        </ErrorBoundary>

      {/* 头部横幅 */}
      <View className="index-page__banner">
        <View className="index-page__banner-content">
          <Text className="index-page__banner-title">找到你的喜欢与天赋</Text>
          <Text className="index-page__banner-subtitle">不被分数定义，用选择创造未来！</Text>
        </View>
      </View>

      {/* 主要内容 */}
      <View className="index-page__content">
        {/* 快速评估卡片 */}
        <View className="index-page__card" onClick={handleQuickAssessment}>
          <Card className="index-page__card-inner">
            <View className="index-page__card-header">
              <View className="index-page__card-icon index-page__card-icon--quick">
                <Text className="index-page__card-icon-text">⚡</Text>
              </View>
              <View className="index-page__card-title-section">
                <Text className="index-page__card-title">热门专业评估</Text>
                <Text className="index-page__card-time">约3分钟</Text>
              </View>
            </View>
            <Text className="index-page__card-desc">
              发现与你特质契合的<Text className="index-page__card-desc-highlight">热门专业</Text>
              方向
            </Text>
            <Button className="index-page__card-button" size="lg">
              ⚡ 立即开始
            </Button>
          </Card>
        </View>

        {/* 全面评估卡片 */}
        <View className="index-page__card" onClick={goTo168InsightIntro}>
          <Card className="index-page__card-inner index-page__card-inner--full">
            <View className="index-page__card-header">
              <View className="index-page__card-icon index-page__card-icon--full">
                <Text className="index-page__card-icon-text">📊</Text>
              </View>
              <View className="index-page__card-title-section">
                <Text className="index-page__card-title">全面评估</Text>
                <View className="index-page__card-tags">
                  <Text className="index-page__card-tag">📊 168题</Text>
                  <Text className="index-page__card-tag">📈 全面数据</Text>
                </View>
               
              </View>
            </View>
            <Text className="index-page__card-desc">
              解锁全部专业，定制
              <Text className="index-page__card-desc-highlight">专属志愿规划</Text>
            </Text>
            {!step1Completed ? (
              <>
                <View className="index-page__card-steps index-page__card-steps--large" onClick={(e) => e.stopPropagation()}>
                  <View
                    className={`index-page__card-step ${getStepStatus(1) === 'completed' ? 'index-page__card-step--completed' : ''} ${getStepStatus(1) === 'current' ? 'index-page__card-step--current' : ''}`}
                    onClick={() => handleStepClick(1, handleSelfInsight)}
                  >
                    <View className={`index-page__card-step-num ${getStepStatus(1) === 'completed' ? 'index-page__card-step-num--completed' : ''} ${getStepStatus(1) === 'current' ? 'index-page__card-step-num--current' : ''}`}><Text>1</Text></View>
                    <Text>填问卷</Text>
                  </View>
                  <Text className="index-page__card-step-sep">—</Text>
                  <View
                    className={`index-page__card-step ${getStepStatus(2) === 'completed' ? 'index-page__card-step--completed' : ''} ${getStepStatus(2) === 'current' ? 'index-page__card-step--current' : ''}`}
                    onClick={() => handleStepClick(2, handleMajorExploration)}
                  >
                    <View className={`index-page__card-step-num ${getStepStatus(2) === 'completed' ? 'index-page__card-step-num--completed' : ''} ${getStepStatus(2) === 'current' ? 'index-page__card-step-num--current' : ''}`}><Text>2</Text></View>
                    <Text>选专业</Text>
                  </View>
                  <Text className="index-page__card-step-sep">—</Text>
                  <View
                    className={`index-page__card-step ${getStepStatus(3) === 'completed' ? 'index-page__card-step--completed' : ''} ${getStepStatus(3) === 'current' ? 'index-page__card-step--current' : ''}`}
                    onClick={() => handleStepClick(3, handleSchoolExploration)}
                  >
                    <View className={`index-page__card-step-num ${getStepStatus(3) === 'completed' ? 'index-page__card-step-num--completed' : ''} ${getStepStatus(3) === 'current' ? 'index-page__card-step-num--current' : ''}`}><Text>3</Text></View>
                    <Text>定志愿</Text>
                  </View>
                </View>
                <View
                  className="index-page__card-step-action-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    className="index-page__card-button index-page__card-button--orange"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSelfInsight();
                    }}
                  >
                    填写问卷
                  </Button>
                </View>
              </>
            ) : (
              <>
                <View
                  className="index-page__card-quick-labels"
                  onClick={(e) => e.stopPropagation()}
                >
                  <View
                    className="index-page__card-quick-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleViewQuestionnaire();
                    }}
                  >
                    <Text className="index-page__card-quick-label-text">查看问卷</Text>
                  </View>
                  <View
                    className="index-page__card-quick-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleSchoolExploration();
                    }}
                  >
                    <Text className="index-page__card-quick-label-text">探索志愿</Text>
                  </View>
                </View>
                {/* 保留原主按钮：查看专业 */}
                <View
                  className="index-page__card-step-action-wrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Button
                    className="index-page__card-button index-page__card-button--orange"
                    size="lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleMajorExploration();
                    }}
                  >
                    查看专业
                  </Button>
                </View>
              </>
            )}
          </Card>
        </View>

        {/* 信任背书 */}
        <View className="index-page__trust-badge">
          <Text className="index-page__trust-text">本系统的信息仅供参考，数据请以学校官网或考试院公布为准。</Text>
        </View>
      </View>

        <ErrorBoundary
          fallbackTitle="底部导航出错"
          fallbackMessage="底部导航出现异常，但不影响页面其他功能。"
        >
          <BottomNav />
        </ErrorBoundary>
      </View>
    </ErrorBoundary>
  );
}
