import React, { useState } from 'react';
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

  /**
   * 处理微信登录按钮点击
   * 直接使用微信登录，不通过插件
   */
  const handleWechatLogin = () => {
    performLogin();
  };

  /**
   * 执行登录流程
   */
  const performLogin = async () => {
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
        return;
      }

      // 2. 调用后端接口进行微信登录
      // 不传递 encryptedData 和 iv，只使用 code 登录
      const response = await wechatLogin(loginCode, undefined, undefined);

      // 3. 处理响应数据，适配不同的响应格式
      // 后端返回格式：{ user: {...}, accessToken: "...", refreshToken: "..." }
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
          phone: responseUserInfo.phone || '',
          email: responseUserInfo.email || '',
          token: token || '',
        };

        dispatch(setUserInfo(formattedUserInfo));

        if (token) {
          Taro.setStorageSync('token', token);
        }
        if (refreshToken) {
          Taro.setStorageSync('refreshToken', refreshToken);
        }

        Taro.showToast({
          title: '登录成功',
          icon: 'success',
        });

        setTimeout(() => {
          Taro.reLaunch({
            url: '/pages/index/index',
          });
        }, 1500);
      } else {
        throw new Error('登录失败：未获取到用户信息');
      }
    } catch (error: any) {
      console.error('微信登录失败:', error);
      Taro.showToast({
        title: error?.message || '登录失败，请稍后重试',
        icon: 'none',
      });
    } finally {
      setLoading(false);
      dispatch(setLoginLoading(false));
    }
  };

  return (
    <View className="login-page">
      <View className="login-page__container">
        {/* Logo 区域 */}
        <View className="login-page__header">
          <Image className="login-page__logo" src="/assets/images/logo.png" mode="aspectFit" />
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
          {/* 微信一键登录按钮 */}
          <Button className="login-page__wechat-btn" onClick={handleWechatLogin} disabled={loading}>
            <Image
              className="login-page__wechat-icon"
              src={require('@/assets/images/wechat_logo.png')}
              mode="aspectFit"
            />
            <Text className="login-page__wechat-text">微信一键登录</Text>
          </Button>

          {/* 微信登录描述 */}
          <Text className="login-page__wechat-desc">微信一键登录,安全便捷</Text>

          {/* 本地手机号一键登录 */}
          {/* <View
            className="login-page__phone-btn"
            onClick={() => {
              Taro.showToast({
                title: '手机号登录功能开发中',
                icon: 'none',
              });
            }}
          >
            <Text className="login-page__phone-icon">📱</Text>
            <Text className="login-page__phone-text">本地手机号一键登录</Text>
          </View> */}
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
