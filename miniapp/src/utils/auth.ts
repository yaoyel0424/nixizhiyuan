/**
 * 认证相关工具函数
 */
import Taro from '@tarojs/taro';
import { store } from '@/store';
import { setUserInfo, setLoginLoading } from '@/store/slices/userSlice';
import { wechatLogin } from '@/services';

/** 从本地 storage 解析出的 userInfo 格式（用于 setUserInfo） */
interface FormattedUserInfo {
  id: string;
  username: string;
  nickname: string;
  avatar: string;
  phone: string;
  email: string;
  token: string;
}

/**
 * 从 Taro storage 恢复 userInfo：先读 key「userInfo」，没有再从「persist:root」里取 user 切片（兼容 iOS 仅 persist 有数据）
 * 供静默登录与个人中心等页面恢复展示用
 */
const DEBUG_AUTH = false; // 真机调试登录态时可改为 true

export function getUserInfoFromStorage(token: string): FormattedUserInfo | null {
  try {
    let parsed: any = null;
    let source = '';
    const rawUserInfo = Taro.getStorageSync('userInfo');
    if (rawUserInfo !== null && rawUserInfo !== undefined && rawUserInfo !== '') {
      parsed = typeof rawUserInfo === 'string' ? JSON.parse(rawUserInfo) : rawUserInfo;
      source = 'userInfo';
    }
    if (!parsed && token) {
      const persistRoot = Taro.getStorageSync('persist:root');
      if (DEBUG_AUTH) {
        console.log('[auth] getUserInfoFromStorage: userInfo 为空，persist:root 存在?', !!persistRoot, '长度', persistRoot ? String(persistRoot).length : 0);
      }
      if (persistRoot) {
        const root = typeof persistRoot === 'string' ? JSON.parse(persistRoot) : persistRoot;
        const userStr = root?.user;
        if (userStr) {
          const userSlice = typeof userStr === 'string' ? JSON.parse(userStr) : userStr;
          parsed = userSlice?.userInfo;
          source = 'persist:root';
        }
      }
    }
    if (DEBUG_AUTH) {
      console.log('[auth] getUserInfoFromStorage: source=', source || '无', 'parsed有id?', !!parsed?.id, 'nickname?', !!parsed?.nickname);
    }
    if (!parsed || (!parsed.nickname && !parsed.username && !parsed.id)) {
      if (DEBUG_AUTH) console.log('[auth] getUserInfoFromStorage: 返回 null，未从 storage 拿到有效 userInfo');
      return null;
    }
    return {
      id: String(parsed.id || ''),
      username: parsed.username || parsed.nickname || parsed.nickName || '微信用户',
      nickname: parsed.nickname || parsed.nickName || parsed.username || '微信用户',
      avatar: parsed.avatar || parsed.avatarUrl || '',
      phone: parsed.phone || '',
      email: parsed.email || '',
      token: parsed.token || token || '',
    };
  } catch (e) {
    return null;
  }
}

/**
 * 静默登录（不显示提示，不跳转页面）
 * 在应用启动时自动执行，获取 token
 */
export const silentLogin = async (): Promise<boolean> => {
  try {
    // 检查是否已有 token，如果有则不需要发登录请求，但需保证 Redux 有 userInfo（iOS 上 persist 可能未同步）
    const existingToken = Taro.getStorageSync('token');
    if (existingToken) {
      const state = store.getState() as { user?: { userInfo?: any } };
      const hasUserInStore = !!state?.user?.userInfo;
      if (DEBUG_AUTH) {
        console.log('[auth] silentLogin: 已有 token，hasUserInStore=', hasUserInStore);
      }
      if (!hasUserInStore) {
        const formatted = getUserInfoFromStorage(existingToken);
        if (DEBUG_AUTH) {
          console.log('[auth] silentLogin: 从 storage 恢复 formatted?', !!formatted, 'nickname=', formatted?.nickname);
        }
        if (formatted) {
          store.dispatch(setUserInfo(formatted));
        }
        // 若 storage 无有效 userInfo（如 iOS 上 persist:root 长度仅 15），由个人中心页 tryRestore 调 check-token 拉取并写入，避免此处循环依赖
      } else {
        // 确保 userInfo 也在存储中（兼容仅 token 存在但 userInfo 被清理的情况）
        const storedUserInfo = Taro.getStorageSync('userInfo');
        if (!storedUserInfo && state?.user?.userInfo) {
          Taro.setStorageSync('userInfo', state.user.userInfo);
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
