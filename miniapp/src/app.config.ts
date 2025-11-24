export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/user/index',
    'pages/login/index'
  ],
  window: {
    backgroundTextStyle: 'light',
    navigationBarBackgroundColor: '#fff',
    navigationBarTitleText: '逆袭志愿',
    navigationBarTextStyle: 'black'
  },
  tabBar: {
    color: '#666',
    selectedColor: '#1890ff',
    backgroundColor: '#fafafa',
    borderStyle: 'black',
    list: [
      {
        pagePath: 'pages/index/index',
        iconPath: 'assets/images/home.png',
        selectedIconPath: 'assets/images/home-active.png',
        text: '首页'
      },
      {
        pagePath: 'pages/user/index',
        iconPath: 'assets/images/user.png',
        selectedIconPath: 'assets/images/user-active.png',
        text: '我的'
      }
    ]
  },
  permission: {
    'scope.userLocation': {
      desc: '你的位置信息将用于小程序位置接口的效果展示'
    }
  }
})
