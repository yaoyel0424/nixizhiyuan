// 首页
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro, { useShareAppMessage, useDidShow } from '@tarojs/taro';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { BottomNav } from '@/components/BottomNav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/Dialog';
import { getStorage } from '@/utils/storage';
import { getUserRelatedDataCount } from '@/services/user';
import { deleteScaleAnswers } from '@/services/scales';
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
  const [isGuideDialogOpen, setIsGuideDialogOpen] = useState(false);
  const [answers, setAnswers] = useState<Record<number, number>>({});
  const [isClient, setIsClient] = useState(false);
  const [systemInfo, setSystemInfo] = useState<any>(null);
  // API 返回的数据统计（repeatCount > 0 表示二次答题）
  const [scaleAnswersCount, setScaleAnswersCount] = useState(0);
  const [majorFavoritesCount, setMajorFavoritesCount] = useState(0);
  const [provinceFavoritesCount, setProvinceFavoritesCount] = useState(0);
  const [choicesCount, setChoicesCount] = useState(0);
  const [repeatCount, setRepeatCount] = useState(0);
  // 标记是否成功获取了 API 数据
  const [apiDataLoaded, setApiDataLoaded] = useState(false);
  // 降级使用的本地数据（API 失败时使用）
  const [intendedMajorsCount, setIntendedMajorsCount] = useState(0);
  const [selectedProvincesCount, setSelectedProvincesCount] = useState(0);
  const [hasVisitedMajors, setHasVisitedMajors] = useState(false);
  // 是否已首次展示过（用于 useDidShow 中避免与首次加载重复请求）
  const isFirstShow = useRef(true);

  /**
   * 小程序分享配置
   * 当用户点击右上角分享或使用 Button 的 openType="share" 时会触发
   * 分享样式与个人中心的"分享给朋友"保持一致
   */
  useShareAppMessage(() => {
    return {
      title: '逆袭智愿 - 让「喜欢」和「天赋」，带你找到答案',
      path: '/pages/index/index',
      imageUrl: '', // 可选：分享图片 URL
    }
  })

  useEffect(() => {
    setIsClient(true);
    const storedAnswers = loadAnswersFromStorage();
    setAnswers(storedAnswers);

    // 使用推荐 API 获取窗口信息（含 statusBarHeight），兼容同步/异步返回值
    Promise.resolve(Taro.getWindowInfo()).then(setSystemInfo);
  }, []);

  // 当对话框打开时，仅同步本地问卷答案；进度数据使用页面已有 state（来自首次加载或 useDidShow 返回时）
  useEffect(() => {
    if (isGuideDialogOpen && isClient) {
      const storedAnswers = loadAnswersFromStorage();
      setAnswers(storedAnswers);
    }
  }, [isGuideDialogOpen, isClient]);

  // 页面加载时拉取用户进度数据，用于卡片步骤展示（与弹框逻辑一致）
  const fetchUserProgress = () => {
    const storedAnswers = loadAnswersFromStorage();
    setAnswers(storedAnswers);
    getUserRelatedDataCount()
      .then(data => {
        setScaleAnswersCount(data.scaleAnswersCount || 0);
        setMajorFavoritesCount(data.majorFavoritesCount || 0);
        setProvinceFavoritesCount(data.provinceFavoritesCount || 0);
        setChoicesCount(data.choicesCount || 0);
        setRepeatCount(data.repeatCount ?? 0);
        setApiDataLoaded(true);
      })
      .catch(() => {
        setApiDataLoaded(false);
        setScaleAnswersCount(Object.keys(storedAnswers).length);
        getStorage<string[]>('intendedMajors').then(v => setIntendedMajorsCount(Array.isArray(v) ? v.length : 0)).catch(() => {});
        getStorage<string[]>('selectedProvinces').then(v => setSelectedProvincesCount(Array.isArray(v) ? v.length : 0)).catch(() => {});
        getStorage<any[]>('wishlist-items').then(v => setHasVisitedMajors(Array.isArray(v) && v.length > 0)).catch(() => getStorage<string[]>('intendedMajors').then(m => setHasVisitedMajors(Array.isArray(m) && m.length > 0)).catch(() => {}));
      });
  };

  useEffect(() => {
    if (!isClient) return;
    fetchUserProgress();
  }, [isClient]);

  // 从选专业/选省份等页返回时重新拉取进度，使步骤状态及时刷新
  useDidShow(() => {
    if (!isClient) return;
    if (isFirstShow.current) {
      isFirstShow.current = false;
      return; // 首次展示由 useEffect 已拉取，避免重复请求
    }
    fetchUserProgress();
  });

  const totalQuestions = 168; // 总题目数固定为 168
  const answeredCount = Object.keys(answers).length;

  // 完成168个题目后解锁三个功能
  const UNLOCK_THRESHOLD = 168;

  // 使用 API 数据判断步骤完成状态（如果 API 数据已加载）
  // 如果 API 调用失败，降级使用本地数据
  const useApiData = apiDataLoaded;

  // 步骤1：深度自我洞察 - 完成168题
  // 二次答题（repeatCount > 0）时第一次已答完，答案合并，后续步骤均解锁
  const step1AnswerCount = useApiData ? scaleAnswersCount : answeredCount;
  const step1Completed = step1AnswerCount >= UNLOCK_THRESHOLD;
  const isUnlocked = isClient && (step1AnswerCount >= UNLOCK_THRESHOLD || repeatCount > 0);

  // 步骤2：发现契合专业 - 已解锁且访问过专业页面
  // 使用 API 的 majorFavoritesCount 或 choicesCount 判断是否访问过专业页面
  // 如果降级，使用 hasVisitedMajors
  const step2Completed =
    isUnlocked && (useApiData ? majorFavoritesCount > 0 || choicesCount > 0 : hasVisitedMajors);

  // 步骤3：圈定理想城市 - 有选择的省份
  // 使用 API 的 provinceFavoritesCount 或本地 selectedProvincesCount
  const step3Completed = useApiData ? provinceFavoritesCount > 0 : selectedProvincesCount > 0;

  // 步骤4：锁定目标院校 - 有选择的专业
  // 使用 API 的 majorFavoritesCount 或本地 intendedMajorsCount
  const step4Completed = useApiData ? majorFavoritesCount > 0 : intendedMajorsCount > 0;

  // 确定当前步骤（显示"您探索到此处"的步骤）
  const getCurrentStep = (): number => {
    if (!step1Completed) return 1;
    if (!step2Completed) return 2;
    if (!step3Completed) return 3;
    if (!step4Completed) return 4;
    return 4; // 所有步骤都完成时，显示在最后一步
  };

  const currentStep = getCurrentStep();

  // 获取步骤状态；二次答题时步骤 2、3、4 不锁定（第一次已答完、答案合并）
  const getStepStatus = (stepNumber: number): StepStatus => {
    if (repeatCount > 0 && stepNumber >= 2) {
      if (stepNumber === 2) return step2Completed ? 'completed' : 'current';
      if (stepNumber === 3) return step3Completed ? 'completed' : 'current';
      if (stepNumber === 4) return step4Completed ? 'completed' : 'current';
    }
    if (stepNumber < currentStep) return 'completed';
    if (stepNumber === currentStep) return 'current';
    return 'locked';
  };

  const handleConfirmStart = withErrorHandler(() => {
    setIsGuideDialogOpen(false);
    Taro.navigateTo({
      url: '/pages/assessment/all-majors/index',
    });
  }, '开始测评功能暂时不可用，请稍后重试');

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
    setIsGuideDialogOpen(false);
  }, '专业探索功能暂时不可用，请稍后重试');

  const handleCityExploration = withErrorHandler(() => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none',
      });
      return;
    }
    setIsGuideDialogOpen(false);
    Taro.navigateTo({
      url: '/pages/assessment/provinces/index',
    });
  }, '城市探索功能暂时不可用，请稍后重试');

  const handleSchoolExploration = withErrorHandler(() => {
    if (!isUnlocked) {
      Taro.showToast({
        title: `完成${UNLOCK_THRESHOLD}个题目后即可解锁此功能`,
        icon: 'none',
      });
      return;
    }
    setIsGuideDialogOpen(false);
    Taro.navigateTo({
      url: '/pages/majors/intended/index?tab=专业赛道',
    });
  }, '院校探索功能暂时不可用，请稍后重试');

  // 处理深度自我洞察点击事件
  const handleSelfInsight = withErrorHandler(() => {
    setIsGuideDialogOpen(false);
    // 使用 reLaunch 跳转到探索成果页面
    Taro.navigateTo({
      url: '/pages/assessment/all-majors/index',
    });
  }, '深度自我洞察功能暂时不可用，请稍后重试');

  // 处理重新探索点击事件：先调用删除接口，删除后返回快照，再跳转重测页（将拉取合并快照）
  const handleReExplore = withErrorHandler(async (e: any) => {
    e.stopPropagation();
    setIsGuideDialogOpen(false);
    Taro.showLoading({ title: '处理中...' });
    await deleteScaleAnswers();
    Taro.hideLoading();
    Taro.navigateTo({
      url: '/pages/assessment/all-majors/index?restart=true',
    });
  }, '重新探索功能暂时不可用，请稍后重试');

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
  }, '快速测评功能暂时不可用，请稍后重试');

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
        {/* 快速测评卡片 */}
        <View className="index-page__card" onClick={handleQuickAssessment}>
          <Card className="index-page__card-inner">
            <View className="index-page__card-header">
              <View className="index-page__card-icon index-page__card-icon--quick">
                <Text className="index-page__card-icon-text">⚡</Text>
              </View>
              <View className="index-page__card-title-section">
                <Text className="index-page__card-title">热门专业测评</Text>
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
        <View className="index-page__card" onClick={() => setIsGuideDialogOpen(true)}>
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
                <Text className="index-page__card-time">🕒 需时约40分钟</Text>
              </View>
            </View>
            <View className="index-page__card-steps" onClick={(e) => e.stopPropagation()}>
              <View
                className={`index-page__card-step ${getStepStatus(1) === 'completed' ? 'index-page__card-step--completed' : ''}`}
                onClick={() => handleStepClick(1, handleSelfInsight)}
              >
                <View className={`index-page__card-step-num ${getStepStatus(1) === 'completed' ? 'index-page__card-step-num--completed' : ''}`}><Text>1</Text></View>
                <Text>填问卷</Text>
              </View>
              <Text className="index-page__card-step-sep">—</Text>
              <View
                className={`index-page__card-step ${getStepStatus(2) === 'completed' ? 'index-page__card-step--completed' : ''}`}
                onClick={() => handleStepClick(2, handleMajorExploration)}
              >
                <View className={`index-page__card-step-num ${getStepStatus(2) === 'completed' ? 'index-page__card-step-num--completed' : ''}`}><Text>2</Text></View>
                <Text>选专业</Text>
              </View>
              <Text className="index-page__card-step-sep">—</Text>
              <View
                className={`index-page__card-step ${getStepStatus(3) === 'completed' ? 'index-page__card-step--completed' : ''}`}
                onClick={() => handleStepClick(3, handleCityExploration)}
              >
                <View className={`index-page__card-step-num ${getStepStatus(3) === 'completed' ? 'index-page__card-step-num--completed' : ''}`}><Text>3</Text></View>
                <Text>选省份</Text>
              </View>
              <Text className="index-page__card-step-sep">—</Text>
              <View
                className={`index-page__card-step ${getStepStatus(4) === 'completed' ? 'index-page__card-step--completed' : ''}`}
                onClick={() => handleStepClick(4, handleSchoolExploration)}
              >
                <View className={`index-page__card-step-num ${getStepStatus(4) === 'completed' ? 'index-page__card-step-num--completed' : ''}`}><Text>4</Text></View>
                <Text>定志愿</Text>
              </View>
            </View>
            <Text className="index-page__card-desc">
              解锁全部专业，定制
              <Text className="index-page__card-desc-highlight">专属志愿规划</Text>
            </Text>
            <Button className="index-page__card-button index-page__card-button--orange" size="lg">
              🎯 开启探索
            </Button>
          </Card>
        </View>

        {/* 信任背书 */}
        <View className="index-page__trust-badge">
          <Text className="index-page__trust-text">本系统的信息仅供参考，数据请以学校官网或考试院公布为准。</Text>
        </View>
      </View>

      {/* 探索之旅说明模态框 */}
      <Dialog open={isGuideDialogOpen} onOpenChange={setIsGuideDialogOpen}>
        <DialogContent className="index-page__dialog">
          <DialogHeader>
            <DialogTitle className="index-page__dialog-title">【探索之旅说明】</DialogTitle>
            <DialogDescription>
              <Text className="index-page__dialog-desc">
                欢迎开启你的深度探索！请按以下步骤随心而行，自在发现。
              </Text>
              {repeatCount > 0 && (
                <Text className="index-page__dialog-desc index-page__dialog-desc--optimize">
                  二次重新答题时，未答题目将使用第一次答案、与第一次合并，无需全部打完。
                </Text>
              )}
            </DialogDescription>
          </DialogHeader>

          <View className="index-page__dialog-steps">
            {/* 第一步 */}
            {(() => {
              const status = getStepStatus(1);
              const isStepCompleted = status === 'completed';
              const isStepCurrent = status === 'current';
              const isStepLocked = status === 'locked';
              return (
                <View
                  className={`index-page__dialog-step ${
                    !isStepLocked
                      ? 'index-page__dialog-step--unlocked'
                      : 'index-page__dialog-step--locked'
                  }`}
                  onClick={() => handleStepClick(1, handleSelfInsight)}
                >
                  <View
                    className={`index-page__dialog-step-icon ${
                      isStepCompleted
                        ? 'index-page__dialog-step-icon--completed'
                        : isStepCurrent
                        ? 'index-page__dialog-step-icon--current'
                        : 'index-page__dialog-step-icon--locked'
                    }`}
                  >
                    {isStepCompleted ? (
                      <View className="index-page__dialog-step-icon-checkmark" />
                    ) : isStepCurrent ? (
                      <View className="index-page__dialog-step-icon-dot" />
                    ) : (
                      <Text className="index-page__dialog-step-icon-lock">🔒</Text>
                    )}
                  </View>
                  <View className="index-page__dialog-step-right">
                    <View className="index-page__dialog-step-badge-wrapper">
                      <Text
                        className={`index-page__dialog-step-badge ${
                          isStepCompleted
                            ? 'index-page__dialog-step-badge--completed'
                            : isStepCurrent
                            ? 'index-page__dialog-step-badge--current'
                            : 'index-page__dialog-step-badge--locked'
                        }`}
                      >
                        {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                      </Text>
                      {isStepCompleted && isClient && (
                        <Text className="index-page__dialog-step-count">
                          {' '}已探索 {step1AnswerCount} 题
                        </Text>
                      )}
                    </View>
                    <View className="index-page__dialog-step-content">
                      <View className="index-page__dialog-step-header">
                        <Text
                          className={`index-page__dialog-step-title ${
                            isStepLocked ? 'index-page__dialog-step-title--locked' : ''
                          }`}
                        >
                          深度自我洞察
                        </Text>
                        {isClient && (
                          <Text className="index-page__dialog-step-progress">
                            {repeatCount > 0 && (
                              <Text className="index-page__dialog-step-progress-label">二次答题进度 </Text>
                            )}
                            ({step1AnswerCount}/{totalQuestions})
                          </Text>
                        )}
                        {isStepCompleted && (
                          <View
                            className="index-page__dialog-step-re-explore"
                            onClick={handleReExplore}
                          >
                            <Text className="index-page__dialog-step-re-explore-text">
                              重新探索
                            </Text>
                          </View>
                        )}
                      </View>
                      <Text
                        className={`index-page__dialog-step-desc ${
                          isStepLocked ? 'index-page__dialog-step-desc--locked' : ''
                        }`}
                      >
                        完成168题科学测评，解锁你的核心特质报告。
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* 第二步 */}
            {(() => {
              const status = getStepStatus(2);
              const isStepCompleted = status === 'completed';
              const isStepCurrent = status === 'current';
              const isStepLocked = status === 'locked';
              return (
                <View
                  className={`index-page__dialog-step ${
                    !isStepLocked
                      ? 'index-page__dialog-step--unlocked'
                      : 'index-page__dialog-step--locked'
                  }`}
                  onClick={() => handleStepClick(2, handleMajorExploration)}
                >
                  <View
                    className={`index-page__dialog-step-icon ${
                      isStepCompleted
                        ? 'index-page__dialog-step-icon--completed'
                        : isStepCurrent
                        ? 'index-page__dialog-step-icon--current'
                        : 'index-page__dialog-step-icon--locked'
                    }`}
                  >
                    {isStepCompleted ? (
                      <View className="index-page__dialog-step-icon-checkmark" />
                    ) : isStepCurrent ? (
                      <View className="index-page__dialog-step-icon-dot" />
                    ) : (
                      <Text className="index-page__dialog-step-icon-lock">🔒</Text>
                    )}
                  </View>
                  <View className="index-page__dialog-step-right">
                    <View className="index-page__dialog-step-badge-wrapper">
                      <Text
                        className={`index-page__dialog-step-badge ${
                          isStepCompleted
                            ? 'index-page__dialog-step-badge--completed'
                            : isStepCurrent
                            ? 'index-page__dialog-step-badge--current'
                            : 'index-page__dialog-step-badge--locked'
                        }`}
                      >
                        {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                      </Text>
                      {isStepCompleted && isClient && (
                        <Text className="index-page__dialog-step-count">
                          {' '}已标记 {useApiData ? (majorFavoritesCount || choicesCount || 0) : (hasVisitedMajors ? '多个' : 0)} 个心动专业
                        </Text>
                      )}
                    </View>
                    <View className="index-page__dialog-step-content">
                      <View className="index-page__dialog-step-header">
                        <Text
                          className={`index-page__dialog-step-title ${
                            isStepLocked ? 'index-page__dialog-step-title--locked' : ''
                          }`}
                        >
                          发现契合专业
                        </Text>
                      </View>
                      <Text
                        className={`index-page__dialog-step-desc ${
                          isStepLocked ? 'index-page__dialog-step-desc--locked' : ''
                        }`}
                      >
                        基于你的特质报告，匹配最适合的专业方向。
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* 第三步 */}
            {(() => {
              const status = getStepStatus(3);
              const isStepCompleted = status === 'completed';
              const isStepCurrent = status === 'current';
              const isStepLocked = status === 'locked';
              return (
                <View
                  className={`index-page__dialog-step ${
                    !isStepLocked
                      ? 'index-page__dialog-step--unlocked'
                      : 'index-page__dialog-step--locked'
                  }`}
                  onClick={() => handleStepClick(3, handleCityExploration)}
                >
                  <View
                    className={`index-page__dialog-step-icon ${
                      isStepCompleted
                        ? 'index-page__dialog-step-icon--completed'
                        : isStepCurrent
                        ? 'index-page__dialog-step-icon--current'
                        : 'index-page__dialog-step-icon--locked'
                    }`}
                  >
                    {isStepCompleted ? (
                      <View className="index-page__dialog-step-icon-checkmark" />
                    ) : isStepCurrent ? (
                      <View className="index-page__dialog-step-icon-dot" />
                    ) : (
                      <Text className="index-page__dialog-step-icon-lock">🔒</Text>
                    )}
                  </View>
                  <View className="index-page__dialog-step-right">
                    <View className="index-page__dialog-step-badge-wrapper">
                      <Text
                        className={`index-page__dialog-step-badge ${
                          isStepCompleted
                            ? 'index-page__dialog-step-badge--completed'
                            : isStepCurrent
                            ? 'index-page__dialog-step-badge--current'
                            : 'index-page__dialog-step-badge--locked'
                        }`}
                      >
                        {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                      </Text>
                      {isStepCompleted && isClient && (
                        <Text className="index-page__dialog-step-count">
                          {' '}已圈定 {useApiData ? provinceFavoritesCount : selectedProvincesCount} 个理想省份
                        </Text>
                      )}
                    </View>
                    <View className="index-page__dialog-step-content">
                      <View className="index-page__dialog-step-header">
                        <Text
                          className={`index-page__dialog-step-title ${
                            isStepLocked ? 'index-page__dialog-step-title--locked' : ''
                          }`}
                        >
                          圈定理想城市
                        </Text>
                      </View>
                      <Text
                        className={`index-page__dialog-step-desc ${
                          isStepLocked ? 'index-page__dialog-step-desc--locked' : ''
                        }`}
                      >
                        结合你的偏好，找到理想的城市圈。
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* 第四步 */}
            {(() => {
              const status = getStepStatus(4);
              const isStepCompleted = status === 'completed';
              const isStepCurrent = status === 'current';
              const isStepLocked = status === 'locked';
              return (
                <View
                  className={`index-page__dialog-step ${
                    !isStepLocked
                      ? 'index-page__dialog-step--unlocked'
                      : 'index-page__dialog-step--locked'
                  }`}
                  onClick={() => handleStepClick(4, handleSchoolExploration)}
                >
                  <View
                    className={`index-page__dialog-step-icon ${
                      isStepCompleted
                        ? 'index-page__dialog-step-icon--completed'
                        : isStepCurrent
                        ? 'index-page__dialog-step-icon--current'
                        : 'index-page__dialog-step-icon--locked'
                    }`}
                  >
                    {isStepCompleted ? (
                      <View className="index-page__dialog-step-icon-checkmark" />
                    ) : isStepCurrent ? (
                      <View className="index-page__dialog-step-icon-dot" />
                    ) : (
                      <Text className="index-page__dialog-step-icon-lock">🔒</Text>
                    )}
                  </View>
                  <View className="index-page__dialog-step-right">
                    <View className="index-page__dialog-step-badge-wrapper">
                      <Text
                        className={`index-page__dialog-step-badge ${
                          isStepCompleted
                            ? 'index-page__dialog-step-badge--completed'
                            : isStepCurrent
                            ? 'index-page__dialog-step-badge--current'
                            : 'index-page__dialog-step-badge--locked'
                        }`}
                      >
                        {isStepCompleted ? '已完成' : isStepCurrent ? '您探索到此处' : '完成后解锁'}
                      </Text>
                      {isStepCompleted && isClient && (
                        <Text className="index-page__dialog-step-count">
                          {' '}已选择 {useApiData ? majorFavoritesCount : intendedMajorsCount} 个专业
                        </Text>
                      )}
                    </View>
                    <View className="index-page__dialog-step-content">
                      <View className="index-page__dialog-step-header">
                        <Text
                          className={`index-page__dialog-step-title ${
                            isStepLocked ? 'index-page__dialog-step-title--locked' : ''
                          }`}
                        >
                          锁定目标院校
                        </Text>
                      </View>
                      <Text
                        className={`index-page__dialog-step-desc ${
                          isStepLocked ? 'index-page__dialog-step-desc--locked' : ''
                        }`}
                      >
                        综合所有信息，生成你的个性化院校清单。
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })()}

            {/* 行动按钮 */}
            {!isUnlocked && (
              <View className="index-page__dialog-footer">
                <Button
                  onClick={handleConfirmStart}
                  size="lg"
                  className="index-page__dialog-button"
                >
                  我明白了，立即开始答题 →
                </Button>
              </View>
            )}
          </View>
        </DialogContent>
      </Dialog>

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
