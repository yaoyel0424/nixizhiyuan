import Taro from '@tarojs/taro'

// tabBar 页面列表（使用 reLaunch 跳转）
const TABBAR_PAGES = [
  '/pages/index/index',
  '/pages/assessment/all-majors/index',
  '/pages/majors/index',
  '/pages/profile/index',
]

// 路由配置（小程序采用静默登录，无登录页）
export const routes = {
  // 主要页面
  INDEX: '/pages/index/index',
  USER: '/pages/user/index',
  
  // 用户相关
  REGISTER: '/pages/register/index',
  FORGOT_PASSWORD: '/pages/forgot-password/index',
  PROFILE: '/pages/profile/index',
  
  // 其他页面
  SETTINGS: '/pages/settings/index',
  ABOUT: '/pages/about/index'
} as const

// 智能路由跳转函数（自动判断是 tabBar 页面还是普通页面）
export const navigateTo = (url: string, params?: Record<string, any>) => {
  const [path] = url.split('?')
  const query = params ? '?' + Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&') : ''
  
  // 如果是 tabBar 页面，使用 reLaunch 替换整个页面栈
  if (TABBAR_PAGES.includes(path)) {
    return Taro.reLaunch({
      url: path + query
    })
  }
  
  // 普通页面使用 navigateTo
  return Taro.navigateTo({
    url: url + query
  })
}

export const redirectTo = (url: string, params?: Record<string, any>) => {
  const query = params ? '?' + Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&') : ''
  
  return Taro.redirectTo({
    url: url + query
  })
}

export const switchTab = (url: string) => {
  return Taro.switchTab({
    url
  })
}

export const reLaunch = (url: string, params?: Record<string, any>) => {
  const query = params ? '?' + Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&') : ''
  
  return Taro.reLaunch({
    url: url + query
  })
}

export const navigateBack = (delta: number = 1) => {
  return Taro.navigateBack({ delta })
}

// 路由守卫
export const routeGuard = {
  // 需要登录的页面
  requireAuth: [
    routes.USER,
    routes.PROFILE,
    routes.SETTINGS
  ],
  
  // 检查是否需要登录
  checkAuth: (url: string) => {
    return routeGuard.requireAuth.includes(url)
  },
  
  // 路由拦截（静默登录：不跳转登录页，未登录时仍允许进入，由页面展示未登录状态）
  intercept: (url: string) => {
    if (routeGuard.checkAuth(url)) {
      const token = Taro.getStorageSync('token')
      if (!token) {
        Taro.showToast({
          title: '请重新打开小程序完成登录',
          icon: 'none'
        })
        // 允许进入页面，由页面自身展示未登录状态
      }
    }
    return true
  }
}

// 页面标题配置
export const pageTitles = {
  [routes.INDEX]: '首页',
  [routes.USER]: '我的',
  [routes.REGISTER]: '注册',
  [routes.FORGOT_PASSWORD]: '忘记密码',
  [routes.PROFILE]: '个人资料',
  [routes.SETTINGS]: '设置',
  [routes.ABOUT]: '关于我们'
} as const

// 设置页面标题
export const setPageTitle = (url: string) => {
  const title = pageTitles[url as keyof typeof pageTitles]
  if (title) {
    Taro.setNavigationBarTitle({ title })
  }
}
