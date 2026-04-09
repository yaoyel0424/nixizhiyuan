/**
 * 新用户启动页：用于首次进入时展示产品价值与行动入口
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Swiper, SwiperItem, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/Button';
import { withErrorHandler } from '@/utils/errorHandler';
import kaiping1 from '@/assets/images/kaiping1.png';
import kaiping2 from '@/assets/images/kaiping2.png';
import kaiping3 from '@/assets/images/kaiping3.png';
import kaiping4 from '@/assets/images/kaiping4.png';
import './index.less';

const STORAGE_KEY_NEW_USER_ONBOARDING_SEEN = 'new_user_onboarding_seen_v1';
const MP_ROUTE_STABLE_DELAY_MS = 56;
/** 启动页自动翻页间隔（略长于阅读一屏主文案所需时间） */
const ONBOARDING_AUTO_ADVANCE_MS = 4500;
const ONBOARDING_SLIDE_COUNT = 4;

export default function OnboardingPage() {
  const [current, setCurrent] = useState(0);
  const isNavigatingRef = useRef(false);
  const { statusBarHeight, topBarHeight } = useMemo(() => {
    try {
      const status = Taro.getWindowInfo().statusBarHeight || 20;
      const menuButton = Taro.getMenuButtonBoundingClientRect?.();
      if (menuButton && menuButton.top && menuButton.bottom) {
        return {
          statusBarHeight: status,
          // 与微信原生导航高度计算保持一致，避免被刘海/状态栏遮挡
          topBarHeight: menuButton.top + menuButton.bottom - status,
        };
      }
      return {
        statusBarHeight: status,
        topBarHeight: status + 44,
      };
    } catch (_) {
      return {
        statusBarHeight: 20,
        topBarHeight: 64,
      };
    }
  }, []);

  /**
   * 标记启动页已读
   */
  const markOnboardingAsSeen = () => {
    Taro.setStorageSync(STORAGE_KEY_NEW_USER_ONBOARDING_SEEN, '1');
  };

  /**
   * 统一路由跳转：防抖 + 延迟，避免开发者工具首帧 timeout
   */
  const safeReLaunch = (url: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      Taro.reLaunch({ url }).catch(() => {
        isNavigatingRef.current = false;
      });
    }, MP_ROUTE_STABLE_DELAY_MS);
  };

  /**
   * 跳过启动页并进入首页
   */
  const handleSkip = withErrorHandler(() => {
    markOnboardingAsSeen();
    safeReLaunch('/pages/index/index');
  }, '跳过启动页失败，请稍后重试');

  /**
   * 从启动页进入 168 题引导页
   */
  const handleStartAssessment = withErrorHandler(() => {
    markOnboardingAsSeen();
    safeReLaunch('/pages/assessment/insight-intro/index');
  }, '打开评估引导失败，请稍后重试');

  /**
   * 进入小程序主页（与「跳过」一致：标记已读并回到首页）
   */
  const handleEnterMiniProgram = withErrorHandler(() => {
    markOnboardingAsSeen();
    safeReLaunch('/pages/index/index');
  }, '进入小程序失败，请稍后重试');

  /**
   * 自动翻页：前 3 屏到时切下一屏；第 4 屏到时若用户未点按钮，则直接进入小程序首页。
   * 手动滑动会更新 current，定时器会重置。
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (current === ONBOARDING_SLIDE_COUNT - 1) {
        markOnboardingAsSeen();
        safeReLaunch('/pages/index/index');
      } else {
        setCurrent(c => c + 1);
      }
    }, ONBOARDING_AUTO_ADVANCE_MS);
    return () => clearTimeout(timer);
  }, [current]);

  /** 四屏底部统一双按钮区 */
  const renderDualFooter = () => (
    <View className="onboarding-page__footer onboarding-page__footer--dual">
      <Button
        className="onboarding-page__button onboarding-page__button--breathe"
        size="lg"
        onClick={handleStartAssessment}
      >
        立即测评
      </Button>
      <Button
        className="onboarding-page__button onboarding-page__button--secondary"
        size="lg"
        onClick={handleEnterMiniProgram}
      >
        进入小程序
      </Button>
    </View>
  );

  return (
    <View className="onboarding-page">
      <View
        className="onboarding-page__top"
        style={{ paddingTop: `${statusBarHeight}px`, height: `${topBarHeight}px` }}
      >
        <Text className="onboarding-page__skip onboarding-page__skip--left" onClick={handleSkip}>
          跳过
        </Text>
        <View className="onboarding-page__top-placeholder" />
      </View>

      <Swiper
        className="onboarding-page__swiper"
        circular={false}
        current={current}
        onChange={e => setCurrent(e.detail.current)}
      >
        <SwiperItem>
          <View className="onboarding-page__slide">
            <Image className="onboarding-page__banner-image" src={kaiping4} mode="widthFix" />
            <View className="onboarding-page__content">
              <Text className="onboarding-page__title">你的私人高潜赛道导航仪</Text>
              <Text className="onboarding-page__subtitle onboarding-page__subtitle--center">
                不看分数看潜能，为你找出“学得快、干得爽”的黄金专业
              </Text>
              <View className="onboarding-page__metrics">
                <View className="onboarding-page__metric">
                  <View className="onboarding-page__metric-inner onboarding-page__metric-inner--breathe">
                    <Text className="onboarding-page__metric-icon">📝</Text>
                    <Text className="onboarding-page__metric-text">168 题</Text>
                  </View>
                </View>
                <View className="onboarding-page__metric">
                  <View className="onboarding-page__metric-inner onboarding-page__metric-inner--breathe">
                    <Text className="onboarding-page__metric-icon">🧠</Text>
                    <Text className="onboarding-page__metric-text">7 大底层能力</Text>
                  </View>
                </View>
                <View className="onboarding-page__metric">
                  <View className="onboarding-page__metric-inner onboarding-page__metric-inner--breathe">
                    <Text className="onboarding-page__metric-icon">🎓</Text>
                    <Text className="onboarding-page__metric-text">1914 全量专业</Text>
                  </View>
                </View>
                <View className="onboarding-page__metric">
                  <View className="onboarding-page__metric-inner onboarding-page__metric-inner--breathe">
                    <Text className="onboarding-page__metric-icon">⭐</Text>
                    <Text className="onboarding-page__metric-text">98% 用户满意度</Text>
                  </View>
                </View>
              </View>
            </View>
            {renderDualFooter()}
          </View>
        </SwiperItem>

        <SwiperItem>
          <View className="onboarding-page__slide">
            <Image className="onboarding-page__banner-image" src={kaiping2} mode="widthFix" />
            <View className="onboarding-page__content onboarding-page__content--screen2">
              <Text className="onboarding-page__title onboarding-page__title--screen2">
                你的热爱与天赋，都有生物学根源
              </Text>
              <View className="onboarding-page__point">
                <Text className="onboarding-page__point-title">喜欢</Text>
                <Text className="onboarding-page__point-desc">
                  为什么有的事你能废寝忘食？——这是你的能量燃料
                </Text>
              </View>
              <View className="onboarding-page__point">
                <Text className="onboarding-page__point-title">天赋</Text>
                <Text className="onboarding-page__point-desc">
                  为什么有的课你一听就懂？——这是你的底层算法
                </Text>
              </View>
              <Text className="onboarding-page__subtitle onboarding-page__subtitle--screen-bottom">
                找到它，大学四年才会有源源不断的热爱
              </Text>
            </View>
            {renderDualFooter()}
          </View>
        </SwiperItem>

        <SwiperItem>
          <View className="onboarding-page__slide">
            <Image className="onboarding-page__banner-image" src={kaiping3} mode="widthFix" />
            <View className="onboarding-page__content">
              <Text className="onboarding-page__title">三步，找到你的专属赛道</Text>
              <View className="onboarding-page__step-line">
                <Text className="onboarding-page__step-no">1</Text>
                <Text className="onboarding-page__step-text">
                  168 题深度评估（30 分钟，无需背景知识）
                </Text>
              </View>
              <View className="onboarding-page__step-line">
                <Text className="onboarding-page__step-no">2</Text>
                <Text className="onboarding-page__step-text">
                  看见真实的你（生成精准的个人特质报告）
                </Text>
              </View>
              <View className="onboarding-page__step-line">
                <Text className="onboarding-page__step-no">3</Text>
                <Text className="onboarding-page__step-text">
                  精准匹配本命专业（1914 全量专业库交叉比对）
                </Text>
              </View>
              <View className="onboarding-page__tags">
                <Text className="onboarding-page__tag">科学</Text>
                <Text className="onboarding-page__tag">简单</Text>
                <Text className="onboarding-page__tag">精准</Text>
              </View>
            </View>
            {renderDualFooter()}
          </View>
        </SwiperItem>

        <SwiperItem>
          <View className="onboarding-page__slide">
            <Image className="onboarding-page__banner-image" src={kaiping1} mode="widthFix" />
            <View className="onboarding-page__content">
              <Text className="onboarding-page__title">选专业，不是选“哪个热门”</Text>
              <Text className="onboarding-page__title">而是选“哪个让你干得开心、活得精彩”</Text>
              <Text className="onboarding-page__subtitle onboarding-page__subtitle--center">
                别用战术上的勤奋，掩盖战略上的“基因错配”
              </Text>
            </View>
            {renderDualFooter()}
          </View>
        </SwiperItem>
      </Swiper>

      <View className="onboarding-page__dots-bottom">
        {[0, 1, 2, 3].map(dot => (
          <View
            key={dot}
            className={`onboarding-page__dot-bottom ${
              current === dot ? 'onboarding-page__dot-bottom--active' : ''
            }`}
          />
        ))}
      </View>
    </View>
  );
}
