import React, { useState } from 'react';
import { View, Text, Image, Button as TaroButton } from '@tarojs/components';
import { useAppDispatch } from '@/store/hooks';
import { setUserInfo, setLoginLoading } from '@/store/slices/userSlice';
import { Loading } from '@/components';
import { wechatLogin } from '@/services';
import Taro from '@tarojs/taro';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import './index.less';

const Login: React.FC = () => {
  const dispatch = useAppDispatch();
  const [loading, setLoading] = useState(false);
  // 使用 ref 来防止重复点击（同步检查）
  const isLoggingInRef = React.useRef(false);
  // 用户协议和隐私政策相关状态
  const [agreedToTerms, setAgreedToTerms] = useState(false); // 不能默认勾选
  const [showUserAgreement, setShowUserAgreement] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showAgreementPrompt, setShowAgreementPrompt] = useState(false); // 提示对话框

  /**
   * 处理微信登录按钮点击
   * 直接使用微信登录，不通过插件
   */
  const handleWechatLogin = () => {
    // 防止重复点击
    if (isLoggingInRef.current || loading) {
      return;
    }
    
    // 检查是否同意用户协议和隐私政策
    if (!agreedToTerms) {
      setShowAgreementPrompt(true);
      return;
    }
    
    performLogin();
  };

  /**
   * 执行登录流程
   */
  const performLogin = async () => {
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
      const errorMessage = error?.message || '登录失败，请稍后重试';
      // 对于 404 错误，给出更明确的提示
      if (errorMessage.includes('Not Found') || errorMessage.includes('404')) {
        Taro.showToast({
          title: '登录接口不存在，请检查网络或联系客服',
          icon: 'none',
          duration: 3000,
        });
      } else {
        Taro.showToast({
          title: errorMessage,
          icon: 'none',
          duration: 2000,
        });
      }
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
          {/* 微信一键登录按钮 */}
          <TaroButton
            className="login-page__wechat-btn"
            onClick={handleWechatLogin}
            disabled={loading}
          >
            <Image
              className="login-page__wechat-icon"
              src={require('@/assets/images/wechat_logo.png')}
              mode="aspectFit"
            />
            <Text className="login-page__wechat-text">微信一键登录</Text>
          </TaroButton>

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
          <Text className="login-page__footer-text">本系统的信息仅供参考，数据请以学校官网或考试院公布为准。</Text>
          
          {/* 同意协议勾选框 */}
          <View className="login-page__agreement-checkbox">
            <View 
              className={`login-page__checkbox ${agreedToTerms ? 'login-page__checkbox--checked' : ''}`}
              onClick={() => setAgreedToTerms(!agreedToTerms)}
            >
              {agreedToTerms && <Text className="login-page__checkbox-icon">✓</Text>}
            </View>
            <View className="login-page__agreement-text-wrapper">
              <Text className="login-page__agreement-text">我已阅读并同意</Text>
              <Text
                className="login-page__agreement-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowUserAgreement(true);
                }}
              >
                《用户协议》
              </Text>
              <Text className="login-page__agreement-text">和</Text>
              <Text
                className="login-page__agreement-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowPrivacyPolicy(true);
                }}
              >
                《隐私政策》
              </Text>
            </View>
          </View>
        </View>
      </View>

      {loading && <Loading overlay text="登录中..." />}

      {/* 用户协议对话框 */}
      <Dialog open={showUserAgreement} onOpenChange={setShowUserAgreement}>
        <DialogContent className="login-page__agreement-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>用户协议</DialogTitle>
            <DialogDescription>
              <Text className="login-page__agreement-meta">
                生效日期：2026.1.20 | 更新日期：2026.1.20
              </Text>
            </DialogDescription>
          </DialogHeader>
          <View className="login-page__agreement-content">
            <Text className="login-page__agreement-intro">
              欢迎使用【逆袭智愿】（以下简称"本小程序"）。请您在使用前仔细阅读本《用户协议》（以下简称"本协议"）。一旦您开始使用本小程序，即表示您已阅读、理解并同意遵守本协议的所有内容。
            </Text>
            
            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">一、服务说明</Text>
              <Text className="login-page__agreement-section-text">
                1.1 本小程序是一款提供专业匹配度测评、生涯规划建议、志愿填报参考等功能的工具类产品。{'\n'}
                1.2 本小程序提供的测评结果仅供参考，不构成任何专业报考、职业选择的法律或事实建议，用户应结合自身情况独立判断。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">二、使用规则</Text>
              <Text className="login-page__agreement-section-text">
                2.1 您应保证注册信息的真实性、准确性，并对其承担全部责任。{'\n'}
                2.2 您不得利用本小程序从事任何违法违规行为，包括但不限于传播虚假信息、侵犯他人权益、干扰系统正常运行等。{'\n'}
                2.3 您应对使用本小程序所产生的任何结果自行承担责任。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">三、知识产权</Text>
              <Text className="login-page__agreement-section-text">
                3.1 本小程序的所有内容（包括但不限于文字、图表、算法、界面设计等）的知识产权归【逆袭智愿】所有。{'\n'}
                3.2 未经书面许可，您不得复制、转载、修改、传播或用于商业用途。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">四、免责声明</Text>
              <Text className="login-page__agreement-section-text">
                4.1 本小程序不保证服务的持续性、无错误或完全符合您的期望。{'\n'}
                4.2 因网络、系统维护、不可抗力等因素导致的服务中断或数据丢失，本小程序不承担责任。{'\n'}
                4.3 您因依赖本小程序提供的信息而做出的任何决定，本小程序不承担由此产生的责任。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">五、协议变更与终止</Text>
              <Text className="login-page__agreement-section-text">
                5.1 我们有权根据需要修改本协议，修改后的协议将在小程序内公布后生效。{'\n'}
                5.2 您有权随时停止使用本小程序。我们也有权在您违反本协议时终止向您提供服务。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">六、其他</Text>
              <Text className="login-page__agreement-section-text">
                6.1 本协议适用中华人民共和国法律。{'\n'}
                6.2 如发生争议，双方应友好协商；协商不成的，可向【公司所在地】人民法院提起诉讼。
              </Text>
            </View>
          </View>
          <DialogFooter>
            <Button
              className="login-page__agreement-btn"
              onClick={() => setShowUserAgreement(false)}
              size="lg"
            >
              我已阅读
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 协议提示对话框 */}
      <Dialog open={showAgreementPrompt} onOpenChange={setShowAgreementPrompt}>
        <DialogContent className="login-page__prompt-dialog" showCloseButton={false}>
          <DialogHeader>
            <DialogTitle>温馨提示</DialogTitle>
          </DialogHeader>
          <View className="login-page__prompt-content">
            <Text className="login-page__prompt-text">
              请您仔细阅读并充分理解相关条款,点击同意即代表您已阅读并同意
              <Text
                className="login-page__prompt-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAgreementPrompt(false);
                  setShowUserAgreement(true);
                }}
              >
                《用户服务协议》
              </Text>
              与
              <Text
                className="login-page__prompt-link"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowAgreementPrompt(false);
                  setShowPrivacyPolicy(true);
                }}
              >
                《隐私协议》
              </Text>
            </Text>
          </View>
          <DialogFooter className="login-page__prompt-footer">
            <Button
              className="login-page__prompt-btn login-page__prompt-btn--cancel"
              onClick={() => setShowAgreementPrompt(false)}
              size="lg"
            >
              不同意
            </Button>
            <Button
              className="login-page__prompt-btn login-page__prompt-btn--confirm"
              onClick={() => {
                setAgreedToTerms(true);
                setShowAgreementPrompt(false);
                performLogin();
              }}
              size="lg"
            >
              同意
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 隐私政策对话框 */}
      <Dialog open={showPrivacyPolicy} onOpenChange={setShowPrivacyPolicy}>
        <DialogContent className="login-page__agreement-dialog" showCloseButton={true}>
          <DialogHeader>
            <DialogTitle>隐私政策</DialogTitle>
            <DialogDescription>
              <Text className="login-page__agreement-meta">
                生效日期：2026.1.20 | 更新日期：2026.1.20
              </Text>
            </DialogDescription>
          </DialogHeader>
          <View className="login-page__agreement-content">
            <Text className="login-page__agreement-intro">
              我们高度重视您的隐私保护。本《隐私政策》旨在说明我们如何收集、使用、存储和保护您的个人信息，请您仔细阅读。
            </Text>
            
            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">一、我们收集的信息</Text>
              <Text className="login-page__agreement-section-text">
                1.1 您提供的信息：注册时填写的手机号/微信号、昵称、头像、测评答案、志愿倾向等。{'\n'}
                1.2 系统自动收集的信息：设备信息（如型号、操作系统）、操作日志、IP地址、访问时间等。{'\n'}
                1.3 第三方信息：如您通过微信登录，我们可能会获取您的公开微信信息（如昵称、头像）。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">二、我们如何使用信息</Text>
              <Text className="login-page__agreement-section-text">
                2.1 用于提供、维护和改进本小程序的服务。{'\n'}
                2.2 用于生成个性化测评报告和推荐内容。{'\n'}
                2.3 用于用户身份验证、安全防范和风险控制。{'\n'}
                2.4 在符合法律的情况下，我们可能对匿名化处理后的数据进行统计分析。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">三、信息的共享与披露</Text>
              <Text className="login-page__agreement-section-text">
                3.1 我们不会将您的个人信息出售给第三方。{'\n'}
                3.2 在以下情况下，我们可能会共享信息：{'\n'}
                {'  '}• 获得您的明确同意；{'\n'}
                {'  '}• 为遵守法律法规或配合司法、行政机关的要求；{'\n'}
                {'  '}• 为保护本小程序、用户或公众的合法权益；{'\n'}
                {'  '}• 与合作的第三方服务提供商（如云服务、数据分析服务商）共享必要信息，且其须遵守保密义务。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">四、信息安全</Text>
              <Text className="login-page__agreement-section-text">
                4.1 我们将采取合理的技术和管理措施保护您的个人信息安全。{'\n'}
                4.2 尽管我们尽力保护数据安全，但无法保证绝对安全，请您理解网络服务的固有风险。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">五、您的权利</Text>
              <Text className="login-page__agreement-section-text">
                5.1 您可以查看、更正、删除您的个人信息。{'\n'}
                5.2 您可以撤回已同意的授权，或注销账户。{'\n'}
                5.3 如您需要行使上述权利，可通过小程序内客服功能联系我们。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">六、未成年人保护</Text>
              <Text className="login-page__agreement-section-text">
                6.1 如您为未成年人，请在监护人指导下使用本小程序。{'\n'}
                6.2 我们不会主动收集未成年人的个人信息，如发现未经监护人同意的情况，将尽快删除相关信息。
              </Text>
            </View>

            <View className="login-page__agreement-section">
              <Text className="login-page__agreement-section-title">七、政策更新</Text>
              <Text className="login-page__agreement-section-text">
                7.1 我们可能会适时更新本政策，更新后的政策将在小程序内公布。{'\n'}
                7.2 如您继续使用本小程序，即视为接受更新后的政策。
              </Text>
            </View>
          </View>
          <DialogFooter>
            <Button
              className="login-page__agreement-btn"
              onClick={() => setShowPrivacyPolicy(false)}
              size="lg"
            >
              我已阅读
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </View>
  );
};

export default Login;
