import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Image, Button } from '@tarojs/components';
import { useAppDispatch } from '@/store/hooks';
import { setUserInfo, setLoginLoading } from '@/store/slices/userSlice';
import { Loading } from '@/components';
import { wechatLogin } from '@/services';
import Taro from '@tarojs/taro';
import './index.less';

const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  // 使用 ref 来防止重复点击（同步检查）
  const isLoggingInRef = React.useRef(false);
  // 用于存储定时器 ID，以便在组件卸载时清理
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  // 用于标记组件是否已卸载
  const isMountedRef = useRef(true);

  /**
   * 处理获取手机号授权（微信一键登录使用手机号登录逻辑）
   * 使用微信官方组件获取手机号进行登录
   * @param e 事件对象，包含 encryptedData 和 iv
   */
  const handleGetPhoneNumber = async (e: any) => {
    // 防止重复点击
    if (isLoggingInRef.current || loading) {
      return;
    }

    // 用户拒绝授权
    if (e.detail.errMsg && e.detail.errMsg.includes('deny')) {
      Taro.showToast({
        title: '需要授权手机号才能登录',
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    // 获取加密数据
    const { encryptedData, iv } = e.detail;
    
    if (!encryptedData || !iv) {
      Taro.showToast({
        title: '获取手机号失败，请重试',
        icon: 'none',
        duration: 2000,
      });
      return;
    }

    // 执行手机号登录流程
    performPhoneLogin(encryptedData, iv);
  };

  // 组件卸载时清理定时器和重置状态
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      // 清理定时器
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      // 重置状态
      isLoggingInRef.current = false;
      setLoading(false);
      dispatch(setLoginLoading(false));
    };
  }, [dispatch]);


  /**
   * 执行手机号登录流程
   * @param encryptedData 加密的手机号数据
   * @param iv 初始向量
   */
  const performPhoneLogin = async (encryptedData: string, iv: string) => {
    // 立即设置防重复点击标志
    isLoggingInRef.current = true;
    setLoading(true);
    dispatch(setLoginLoading(true));

    try {
      // 1. 获取微信登录凭证
      const loginRes = await Taro.login();
      const loginCode = loginRes.code;

      if (!loginCode) {
        Taro.showToast({
          title: '获取微信登录凭证失败',
          icon: 'none',
        });
        setLoading(false);
        dispatch(setLoginLoading(false));
        isLoggingInRef.current = false;
        return;
      }

      // 2. 调用后端接口进行微信登录（带手机号）
      // 传递 usePhoneAsNickname: true，告诉后端将手机号作为昵称保存
      const response = await wechatLogin(loginCode, encryptedData, iv, true);

      // 3. 处理响应数据
      const responseUserInfo = response.user || response.userInfo || response;
      const token = response.accessToken || response.token || responseUserInfo?.accessToken;
      const refreshToken = response.refreshToken || responseUserInfo?.refreshToken;

      if (responseUserInfo) {
        // 使用后端返回的用户信息
        const formattedUserInfo = {
          id: String(responseUserInfo.id || ''),
          username:
            responseUserInfo.nickname ||
            responseUserInfo.nickName ||
            '微信用户',
          nickname:
            responseUserInfo.nickname ||
            responseUserInfo.nickName ||
            '微信用户',
          avatar:
            responseUserInfo.avatarUrl ||
            responseUserInfo.avatar ||
            '',
          phone: responseUserInfo.phone || responseUserInfo.phoneNumber || '',
          email: responseUserInfo.email || '',
          token: token || '',
        };

        dispatch(setUserInfo(formattedUserInfo));

        // 保存 token 和 refreshToken
        if (token) {
          Taro.setStorageSync('token', token);
        }
        if (refreshToken) {
          Taro.setStorageSync('refreshToken', refreshToken);
        }

        // 保存用户信息和手机号到本地，用于下次自动登录
        Taro.setStorageSync('userInfo', formattedUserInfo);
        if (formattedUserInfo.phone) {
          Taro.setStorageSync('userPhone', formattedUserInfo.phone);
        }

        Taro.showToast({
          title: '登录成功',
          icon: 'success',
        });

        // 清理之前的定时器
        if (timerRef.current) {
          clearTimeout(timerRef.current);
        }
        
        // 设置新的定时器，并在执行前检查组件是否仍然挂载
        timerRef.current = setTimeout(() => {
          if (isMountedRef.current) {
            Taro.reLaunch({
              url: '/pages/index/index',
            });
          }
        }, 1500);
      } else {
        throw new Error('登录失败：未获取到用户信息');
      }
    } catch (error: any) {
      console.error('手机号登录失败:', error);
      const errorMessage = error?.message || '登录失败，请稍后重试';
      Taro.showToast({
        title: errorMessage,
        icon: 'none',
        duration: 2000,
      });
    } finally {
      // 重置防重复点击标志
      isLoggingInRef.current = false;
      setLoading(false);
      dispatch(setLoginLoading(false));
    }
  };


  return (
    <View className="login-page">
      <View className="login-page__container">
        {/* Logo 区域 */}
        <View className="login-page__header">
          <Image className="login-page__logo" src={require('@/assets/images/logo.png')} mode="aspectFit" />
        </View>

        {/* 标题 */}
        <View className="login-page__title-section">
          <Text className="login-page__title">逆袭智愿</Text>
        </View>

        {/* 问题列表 */}
        <View className="login-page__questions">
          <Text className="login-page__questions-title">你是否在想：</Text>
          <View className="login-page__questions-list">
            <View className="login-page__question-item">
              <Text className="login-page__question-text">
                我的喜欢是什么？天赋在哪里？怎样的专业，能让我闪闪发光？如何用分数，创造出最理想的志愿？
              </Text>
            </View>
          </View>
        </View>

        {/* 总结文案 */}
        <View className="login-page__summary">
          <Text className="login-page__summary-text">让「喜欢」和「天赋」，带你找到答案</Text>
        </View>

        {/* 登录按钮区域 */}
        <View className="login-page__actions">
          {/* 微信一键登录按钮（使用手机号登录逻辑） */}
          <Button
            className="login-page__wechat-btn"
            openType="getPhoneNumber"
            onGetPhoneNumber={handleGetPhoneNumber}
            disabled={loading}
          >
            <Image
              className="login-page__wechat-icon"
              src={require('@/assets/images/wechat_logo.png')}
              mode="aspectFit"
            />
            <Text className="login-page__wechat-text">微信一键登录</Text>
          </Button>

          {/* 微信登录描述 */}
          <Text className="login-page__wechat-desc">微信一键登录,安全便捷</Text>
        </View>

        {/* 底部 Footer */}
        <View className="login-page__footer">
          <Text className="login-page__footer-text">专业院校信息全部来自官网权威可靠</Text>
          <View className="login-page__footer-agreement">
            <Text className="login-page__footer-text">登录即代表同意</Text>
            <Text
              className="login-page__footer-link"
              onClick={() => {
                Taro.showToast({
                  title: '用户协议',
                  icon: 'none',
                });
              }}
            >
              《用户协议》
            </Text>
            <Text className="login-page__footer-text">和</Text>
            <Text
              className="login-page__footer-link"
              onClick={() => {
                Taro.showToast({
                  title: '隐私政策',
                  icon: 'none',
                });
              }}
            >
              《隐私政策》
            </Text>
          </View>
        </View>
      </View>

      {loading && <Loading overlay text="登录中..." />}
    </View>
  );
};

export default Login;
