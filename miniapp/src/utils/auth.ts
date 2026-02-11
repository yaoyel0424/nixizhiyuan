/**
 * 认证相关工具函数
 */
import Taro from '@tarojs/taro';
import { store } from '@/store';
import { setUserInfo, setLoginLoading } from '@/store/slices/userSlice';
import { wechatLogin } from '@/services';

/**
 * 静默登录（不显示提示，不跳转页面）
 * 在应用启动时自动执行，获取 token
 */
export const silentLogin = async (): Promise<boolean> => {
  try {
    // 检查是否已有 token，如果有且有效，则不需要重新登录
    const existingToken = Taro.getStorageSync('token');
    if (existingToken) {
      // 确保 userInfo 也在存储中（兼容仅 token 存在但 userInfo 被清理或未写入的情况，如 iOS 真机）
      const storedUserInfo = Taro.getStorageSync('userInfo');
      if (!storedUserInfo) {
        const state = store.getState() as { user?: { userInfo?: any } };
        const userInfo = state?.user?.userInfo;
        if (userInfo) {
          Taro.setStorageSync('userInfo', userInfo);
        }
      }
      return true;
    }

    // 设置登录加载状态
    store.dispatch(setLoginLoading(true));

    // 1. 获取微信登录凭证
    const loginRes = await Taro.login();
    const loginCode = loginRes.code;

    if (!loginCode) {
      console.error('静默登录失败：获取微信登录凭证失败');
      store.dispatch(setLoginLoading(false));
      return false;
    }

    // 2. 调用后端接口进行微信登录
    const response = await wechatLogin(loginCode, undefined, undefined);

    // 3. 处理响应数据
    const responseUserInfo = response.user || response.userInfo || response;
    const token = response.accessToken || response.token || responseUserInfo?.accessToken;
    const refreshToken = response.refreshToken || responseUserInfo?.refreshToken;

    if (responseUserInfo && token) {
      // 格式化用户信息
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

      // 保存用户信息到 store
      store.dispatch(setUserInfo(formattedUserInfo));

      // 同步写入 userInfo 到本地存储，供 getCurrentUserId 等读取（不依赖 redux-persist 时机，兼容 iOS 等真机）
      Taro.setStorageSync('userInfo', formattedUserInfo);

      // 保存 token 到本地存储
      if (token) {
        Taro.setStorageSync('token', token);
      }
      if (refreshToken) {
        Taro.setStorageSync('refreshToken', refreshToken);
      }

      store.dispatch(setLoginLoading(false));
      return true;
    } else {
      console.error('静默登录失败：未获取到用户信息或 token');
      store.dispatch(setLoginLoading(false));
      return false;
    }
  } catch (error: any) {
    console.error('静默登录失败:', error);
    store.dispatch(setLoginLoading(false));
    // 静默登录失败不显示错误提示，避免影响用户体验
    return false;
  }
};
