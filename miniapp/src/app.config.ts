export default {
  pages: [
    'pages/login/index',
    'pages/index/index',
    'pages/assessment/index',
    'pages/assessment/all-majors/index',
    'pages/assessment/personal-profile/index',
    'pages/assessment/favorite-majors/index',
    'pages/majors/index',
    'pages/majors/intended/index',
    'pages/majors/intended/schools/index',
    'pages/profile/index',
    'pages/user/index',
    'pages/assessment/questionnaire/index',
    'pages/assessment/popular-majors/index',
    'pages/assessment/report/index',
    'pages/assessment/provinces/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#f0f7ff',
    navigationBarTitleText: '逆袭智愿',
    navigationBarTextStyle: 'black'
  },
  // 使用自定义底部导航栏，不再使用原生 tabBar
  // tabBar: {
  //   color: '#666',
  //   selectedColor: '#1890ff',
  //   backgroundColor: '#fafafa',
  //   borderStyle: 'black',
  //   list: [
  //     {
  //       pagePath: 'pages/index/index',
  //       iconPath: 'assets/images/home.png',
  //       selectedIconPath: 'assets/images/home-active.png',
  //       text: '主页'
  //     },
  //     {
  //       pagePath: 'pages/assessment/all-majors/index',
  //       iconPath: 'assets/images/clipboard.png',
  //       selectedIconPath: 'assets/images/clipboard-active.png',
  //       text: '探索成果'
  //     },
  //     {
  //       pagePath: 'pages/majors/index',
  //       iconPath: 'assets/images/target.png',
  //       selectedIconPath: 'assets/images/target-active.png',
  //       text: '志愿方案'
  //     },
  //     {
  //       pagePath: 'pages/profile/index',
  //       iconPath: 'assets/images/user.png',
  //       selectedIconPath: 'assets/images/user-active.png',
  //       text: '个人中心'
  //     }
  //   ]
  // },
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示'
    },
    'scope.userInfo': {
      desc: '用于完善会员资料'
    }
  },
  plugins: {
    loginplugin: {
      version: 'latest',
      provider: 'wx12251485dfaf24d3'
    }
  }
}
