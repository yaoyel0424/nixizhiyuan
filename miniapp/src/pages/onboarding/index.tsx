/**
 * 单页启动页：设计稿还原（全屏背景图 + 顶栏品牌 Logo + 主标题条 + 数据区 + 双按钮）
 * 资源路径：@/assets/images/logo.png、@/assets/images/qidongbg.jpg（与 miniapp/src/assets/images 一致）
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, Image } from '@tarojs/components';
import Taro from '@tarojs/taro';
import { Button } from '@/components/ui/Button';
import { withErrorHandler } from '@/utils/errorHandler';
import launchBg from '@/assets/images/qidongbg.jpg';
import launchLogo from '@/assets/images/logo.png';
import './index.less';

const STORAGE_KEY_NEW_USER_ONBOARDING_SEEN = 'new_user_onboarding_seen_v1';
const MP_ROUTE_STABLE_DELAY_MS = 56;
/** 顶栏「跳过」旁倒计时秒数，结束后自动进入首页 */
const AUTO_ENTER_HOME_SECONDS = 10;
/** 向上滑动超过该距离（px）视为进入首页手势 */
const SWIPE_UP_ENTER_THRESHOLD_PX = 56;

/**
 * 从 Taro/小程序触摸事件中解析触点坐标（兼容 touches / changedTouches / detail）
 */
function getTouchClientPoint(
  e: unknown,
  phase: 'start' | 'end'
): { x: number; y: number } | null {
  const raw = e as {
    touches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number }>;
    changedTouches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number }>;
    detail?: {
      touches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number }>;
      changedTouches?: Array<{ clientX?: number; clientY?: number; x?: number; y?: number }>;
    };
  };
  const t =
    phase === 'start'
      ? raw.touches?.[0] || raw.detail?.touches?.[0]
      : raw.changedTouches?.[0] || raw.detail?.changedTouches?.[0];
  if (t == null) return null;
  const x = t.clientX ?? t.x;
  const y = t.clientY ?? t.y;
  if (x == null || y == null) return null;
  return { x, y };
}

export default function OnboardingPage() {
  const isNavigatingRef = useRef(false);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  /** 记录向上滑动手势起点（用于进入首页） */
  const swipeEnterStartRef = useRef<{ x: number; y: number } | null>(null);
  const [skipCountdownSec, setSkipCountdownSec] = useState(AUTO_ENTER_HOME_SECONDS);
  const { statusBarHeight, topBarHeight, topRightPadPx } = useMemo(() => {
    try {
      const win = Taro.getWindowInfo();
      const status = win.statusBarHeight || 20;
      const menuButton = Taro.getMenuButtonBoundingClientRect?.();
      const ww = typeof win.windowWidth === 'number' ? win.windowWidth : 375;
      let capsulePad = 12;
      if (menuButton && typeof menuButton.left === 'number') {
        capsulePad = Math.max(12, ww - menuButton.left + 10);
      }
      if (menuButton && menuButton.top && menuButton.bottom) {
        return {
          statusBarHeight: status,
          topBarHeight: menuButton.top + menuButton.bottom - status,
          topRightPadPx: capsulePad,
        };
      }
      return {
        statusBarHeight: status,
        topBarHeight: status + 44,
        topRightPadPx: capsulePad,
      };
    } catch (_) {
      return {
        statusBarHeight: 20,
        topBarHeight: 64,
        topRightPadPx: 96,
      };
    }
  }, []);

  const markOnboardingAsSeen = () => {
    Taro.setStorageSync(STORAGE_KEY_NEW_USER_ONBOARDING_SEEN, '1');
  };

  const safeReLaunch = (url: string) => {
    if (isNavigatingRef.current) return;
    isNavigatingRef.current = true;
    setTimeout(() => {
      Taro.reLaunch({ url }).catch(() => {
        isNavigatingRef.current = false;
      });
    }, MP_ROUTE_STABLE_DELAY_MS);
  };

  /** 清除自动进入首页的倒计时，避免与手动跳转重复触发 */
  const clearAutoEnterTimer = useCallback(() => {
    if (countdownIntervalRef.current !== null) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    countdownIntervalRef.current = setInterval(() => {
      setSkipCountdownSec((prev) => {
        if (prev <= 1) {
          if (countdownIntervalRef.current !== null) {
            clearInterval(countdownIntervalRef.current);
            countdownIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => {
      if (countdownIntervalRef.current !== null) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    };
  }, []);

  /** 倒计时归零后自动进首页（与点击「跳过」一致） */
  useEffect(() => {
    if (skipCountdownSec !== 0) return;
    markOnboardingAsSeen();
    safeReLaunch('/pages/index/index');
  }, [skipCountdownSec]);

  const handleSkip = withErrorHandler(() => {
    clearAutoEnterTimer();
    markOnboardingAsSeen();
    safeReLaunch('/pages/index/index');
  }, '跳过启动页失败，请稍后重试');

  const handleStartAssessment = withErrorHandler(() => {
    clearAutoEnterTimer();
    markOnboardingAsSeen();
    safeReLaunch('/pages/assessment/insight-intro/index');
  }, '打开评估引导失败，请稍后重试');

  const handleEnterMiniProgram = withErrorHandler(() => {
    clearAutoEnterTimer();
    markOnboardingAsSeen();
    safeReLaunch('/pages/index/index');
  }, '进入小程序失败，请稍后重试');

  return (
    <View
      className="launch-hero"
      onTouchStart={(e) => {
        const p = getTouchClientPoint(e, 'start');
        if (p == null) return;
        swipeEnterStartRef.current = p;
      }}
      onTouchEnd={(e) => {
        const start = swipeEnterStartRef.current;
        swipeEnterStartRef.current = null;
        if (start == null) return;
        const end = getTouchClientPoint(e, 'end');
        if (end == null) return;
        const dy = start.y - end.y;
        const dx = Math.abs(end.x - start.x);
        if (dy < SWIPE_UP_ENTER_THRESHOLD_PX) return;
        if (dx > dy * 0.65) return;
        handleEnterMiniProgram();
      }}
      onTouchCancel={() => {
        swipeEnterStartRef.current = null;
      }}
    >
      <Image className="launch-hero__bg-img" src={launchBg} mode="aspectFill" />
      <View className="launch-hero__shade" />

      <View
        className="launch-hero__top"
        style={{ paddingTop: `${statusBarHeight}px`, height: `${topBarHeight}px` }}
      >
        <View className="launch-hero__brand-row">
          <Image
            className="launch-hero__brand-logo"
            src={launchLogo}
            mode="aspectFit"
          />
          <View className="launch-hero__brand-divider" />
          <Text className="launch-hero__brand">逆袭智愿</Text>
        </View>
        <View
          className="launch-hero__top-right"
          style={{ paddingRight: `${topRightPadPx}px` }}
        >
          <View className="launch-hero__skip-wrap">
            <Text className="launch-hero__skip" onClick={handleSkip}>
              跳过
            </Text>
            {skipCountdownSec > 0 ? (
              <Text className="launch-hero__skip-count">{skipCountdownSec}s</Text>
            ) : null}
          </View>
        </View>
      </View>

      <View className="launch-hero__body">
        <View className="launch-hero__intro">
          <View className="launch-hero__ribbon">
            <Text className="launch-hero__ribbon-text">你本来就该闪闪发光！</Text>
          </View>
          <Text className="launch-hero__subline">
            选专业，不是选「哪个热门」
          </Text>
          <Text className="launch-hero__subline launch-hero__subline--second">
            而是选「哪个让你干得开心、活得精彩」
          </Text>
        </View>

        {/* 中部 HUD 文案：与背景星系叠放，呼应设计稿「喜欢 / 天赋 / 双螺旋引擎」 */}
        <View className="launch-hero__mid">
          <View className="launch-hero__hud">
            <View className="launch-hero__hud-triangle launch-hero__hud-triangle--tr" />
            <View className="launch-hero__hud-triangle launch-hero__hud-triangle--bl" />

            <View className="launch-hero__hud-label launch-hero__hud-label--tl">
              <View className="launch-hero__hud-line launch-hero__hud-line--left launch-hero__hud-line--gold" />
              <View className="launch-hero__hud-chip launch-hero__hud-chip--engine">
                <Text className="launch-hero__hud-chip-text launch-hero__hud-chip-text--engine">
                  双螺旋引擎
                </Text>
              </View>
            </View>

            <View className="launch-hero__hud-core">
              <Text className="launch-hero__hud-core-text">喜欢</Text>
            </View>

            <View className="launch-hero__hud-label launch-hero__hud-label--br">
              <View className="launch-hero__hud-chip">
                <Text className="launch-hero__hud-chip-text">天赋</Text>
              </View>
              <View className="launch-hero__hud-line launch-hero__hud-line--right" />
            </View>
          </View>
        </View>

        <View className="launch-hero__lower">
          <View className="launch-hero__stats">
            <View className="launch-hero__stats-row">
              <Text className="launch-hero__stats-diamond">◆</Text>
              <Text className="launch-hero__stats-text">168题 · 7大能力</Text>
              <Text className="launch-hero__stats-diamond">◆</Text>
            </View>
            <Text className="launch-hero__stats-sub">
              1914专业 · 98%用户满意度
            </Text>
          </View>

          <View className="launch-hero__swipe">
            <View className="launch-hero__swipe-line" />
            <Text className="launch-hero__swipe-text">
              —— 向上滑动 进入小程序 ——
            </Text>
            <View className="launch-hero__swipe-line" />
          </View>
        </View>
      </View>

      <View className="launch-hero__footer">
        <Button
          variant="default"
          className="launch-hero__btn launch-hero__btn--primary launch-hero__btn--breathe"
          size="lg"
          onClick={handleStartAssessment}
        >
          开启自评
        </Button>
        <Button
          variant="secondary"
          className="launch-hero__btn launch-hero__btn--secondary"
          size="lg"
          onClick={handleEnterMiniProgram}
        >
          进入小程序
        </Button>
      </View>
    </View>
  );
}
