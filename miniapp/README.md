# Rbridge 微信小程序前端框架

基于 Taro + React + TypeScript 的微信小程序前端框架，支持多端开发，便于维护和扩展。

## 🚀 技术栈

- **框架**: Taro 3.6.20
- **前端**: React 18 + TypeScript
- **状态管理**: Redux Toolkit + Redux Persist
- **样式**: Less + CSS Modules
- **构建工具**: Webpack 5
- **代码规范**: ESLint + Prettier

## 📁 项目结构

```
src/
├── app.tsx                 # 应用入口
├── app.config.ts          # 应用配置
├── app.scss               # 全局样式
├── components/            # 通用组件
│   ├── Button/            # 按钮组件
│   ├── Input/             # 输入框组件
│   ├── Loading/            # 加载组件
│   ├── Modal/              # 弹窗组件
│   ├── Toast/              # 提示组件
│   ├── NavBar/             # 导航栏组件
│   ├── TabBar/             # 标签栏组件
│   ├── Card/               # 卡片组件
│   ├── List/               # 列表组件
│   ├── Empty/              # 空状态组件
│   └── Image/              # 图片组件
├── pages/                  # 页面
│   ├── index/              # 首页
│   ├── user/               # 用户页面
│   └── login/              # 登录页面
├── store/                  # 状态管理
│   ├── index.ts            # Store配置
│   ├── hooks.ts            # 类型化hooks
│   └── slices/             # Redux切片
│       ├── userSlice.ts    # 用户状态
│       ├── appSlice.ts     # 应用状态
│       └── loadingSlice.ts # 加载状态
├── services/               # API服务
│   ├── api.ts              # 通用API
│   ├── auth.ts             # 认证服务
│   ├── user.ts             # 用户服务
│   └── upload.ts           # 上传服务
├── utils/                  # 工具函数
│   ├── format.ts           # 格式化工具
│   ├── validate.ts         # 验证工具
│   ├── storage.ts          # 存储工具
│   ├── device.ts           # 设备工具
│   ├── date.ts             # 日期工具
│   └── string.ts            # 字符串工具
├── types/                  # 类型定义
│   ├── index.ts            # 通用类型
│   └── api.ts              # API类型
├── styles/                 # 样式文件
│   ├── variables.less      # 样式变量
│   └── mixins.less         # 样式混入
└── router/                 # 路由配置
    └── index.ts            # 路由工具
```

## 🛠️ 使用说明

### 📋 环境要求

- **Node.js**: >= 16.0.0
- **npm**: >= 8.0.0
- **微信开发者工具**: 最新版本（开发微信小程序时）
- **浏览器**: Chrome/Safari/Firefox（开发H5时）

### 🚀 快速开始

#### 1. 克隆项目
```bash
git clone <repository-url>
cd rbridgeapp/client
```

#### 2. 安装依赖
```bash
# 方法一：使用安装脚本（推荐）
chmod +x install.sh
./install.sh

# 方法二：手动安装
npm install

# 方法三：使用 yarn
yarn install
```

#### 3. 启动开发服务器
```bash
# 微信小程序开发（推荐）
npm run dev:weapp

# H5开发
npm run dev:h5
```

#### 4. 如果遇到依赖问题
```bash
# 快速修复依赖问题
chmod +x fix-dependencies.sh
./fix-dependencies.sh
```

#### 5. 如果遇到图标文件问题
```bash
# 转换图标文件（需要ImageMagick）
chmod +x convert-icons.sh
./convert-icons.sh

# 或者手动创建图标文件到 src/assets/images/ 目录
```

#### 6. 如果遇到WXSS编译错误
```bash
# 检查CSS语法，避免使用通配符选择器 *
# 使用微信小程序支持的标签选择器
```

#### 7. 如果遇到JavaScript运行时错误
```bash
# 清理缓存并重新构建
rm -rf dist
npm run build:weapp
```

#### 8. 如果遇到sitemap索引问题
```bash
# 确保存在 sitemap.json 文件
# 文件内容应该允许所有页面被索引
```

### 🔧 开发命令详解

#### 微信小程序开发
```bash
# 启动微信小程序开发模式
npm run dev:weapp

# 启动后会自动打开微信开发者工具
# 在微信开发者工具中导入 dist 目录
```

#### H5开发
```bash
# 启动H5开发模式
npm run dev:h5

# 访问 http://localhost:10086 查看效果
```

#### 其他平台开发
```bash
# 支付宝小程序
npm run dev:alipay

# 字节跳动小程序
npm run dev:tt

# 百度小程序
npm run dev:swan

# QQ小程序
npm run dev:qq

# 京东小程序
npm run dev:jd

# 快应用
npm run dev:quickapp

# React Native
npm run dev:rn
```

### 🏗️ 构建和发布

#### 构建生产版本
```bash
# 构建微信小程序
npm run build:weapp

# 构建H5
npm run build:h5

# 构建支付宝小程序
npm run build:alipay

# 构建其他平台...
```

#### 发布流程

**微信小程序发布**：
1. 执行 `npm run build:weapp`
2. 在微信开发者工具中打开 `dist` 目录
3. 点击"上传"按钮上传代码
4. 在微信公众平台提交审核

**H5发布**：
1. 执行 `npm run build:h5`
2. 将 `dist` 目录部署到服务器
3. 配置Nginx或其他Web服务器

**其他小程序平台**：
1. 执行对应的构建命令
2. 在对应平台的开发者工具中上传代码
3. 提交审核

### 🐛 调试指南

#### 微信小程序调试
```bash
# 启动开发模式
npm run dev:weapp

# 在微信开发者工具中：
# 1. 导入 dist 目录
# 2. 开启调试模式
# 3. 使用真机调试功能
```

#### H5调试
```bash
# 启动开发模式
npm run dev:h5

# 在浏览器中：
# 1. 打开开发者工具 (F12)
# 2. 使用Console查看日志
# 3. 使用Network查看请求
# 4. 使用Sources调试代码
```

#### 代码调试技巧
```bash
# 开启详细日志
DEBUG=true npm run dev:weapp

# 开启热重载
npm run dev:weapp -- --watch

# 清理缓存
npm run dev:weapp -- --clean
```

### 📱 多端调试

#### 真机调试
1. **微信小程序**：使用微信开发者工具的真机调试功能
2. **H5**：使用手机浏览器访问开发服务器IP
3. **其他小程序**：使用对应平台的开发者工具

#### 模拟器调试
- 使用各平台的模拟器进行测试
- 测试不同屏幕尺寸和分辨率
- 测试不同操作系统版本

### 🔍 代码检查和质量控制

#### 代码规范检查
```bash
# 检查代码规范
npm run lint

# 自动修复代码规范问题
npm run lint:fix

# 检查特定文件
npm run lint src/components/Button
```

#### 测试
```bash
# 运行测试
npm test

# 运行测试并生成覆盖率报告
npm run test:coverage

# 监听模式运行测试
npm test -- --watch
```

### 📦 依赖管理

#### 添加新依赖
```bash
# 添加生产依赖
npm install package-name

# 添加开发依赖
npm install --save-dev package-name

# 使用yarn
yarn add package-name
yarn add -D package-name
```

#### 更新依赖
```bash
# 检查过时的依赖
npm outdated

# 更新所有依赖
npm update

# 更新特定依赖
npm install package-name@latest
```

### 🚨 常见问题解决

#### 构建失败
```bash
# 清理缓存
npm run dev:weapp -- --clean

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install
```

#### 样式问题
```bash
# 检查Less编译
npm run dev:weapp -- --verbose

# 检查样式变量
# 查看 src/styles/variables.less
```

#### 路由问题
```bash
# 检查路由配置
# 查看 src/app.config.ts
# 查看 src/router/index.ts
```

### 📊 性能优化

#### 构建优化
```bash
# 分析构建包大小
npm run build:weapp -- --analyze

# 开启压缩
npm run build:weapp -- --minify
```

#### 开发优化
```bash
# 开启热重载
npm run dev:weapp -- --watch

# 开启快速构建
npm run dev:weapp -- --fast
```

### 🔧 开发工具配置

#### VS Code推荐插件
- Taro Snippets
- Less
- ESLint
- Prettier
- GitLens

#### 微信开发者工具设置
1. 开启"不校验合法域名"
2. 开启"不校验TLS版本"
3. 开启"开启调试模式"

### 📝 开发规范

#### 代码提交规范
```bash
# 功能开发
git commit -m "feat: 添加用户登录功能"

# 修复bug
git commit -m "fix: 修复按钮点击事件"

# 文档更新
git commit -m "docs: 更新README文档"
```

#### 分支管理
```bash
# 创建功能分支
git checkout -b feature/user-login

# 创建修复分支
git checkout -b fix/button-click

# 合并到主分支
git checkout main
git merge feature/user-login
```

## 📱 支持平台

- ✅ 微信小程序
- ✅ 支付宝小程序
- ✅ 字节跳动小程序
- ✅ 百度小程序
- ✅ QQ小程序
- ✅ 京东小程序
- ✅ H5
- ✅ React Native
- ✅ 快应用

## 🎯 快速上手示例

### 创建新页面
```bash
# 1. 在 src/pages 目录下创建新页面文件夹
mkdir src/pages/demo

# 2. 创建页面文件
touch src/pages/demo/index.tsx
touch src/pages/demo/index.less

# 3. 在 src/app.config.ts 中注册页面
# 添加 'pages/demo/index' 到 pages 数组
```

### 创建新组件
```bash
# 1. 在 src/components 目录下创建组件文件夹
mkdir src/components/Demo

# 2. 创建组件文件
touch src/components/Demo/index.tsx
touch src/components/Demo/index.less

# 3. 在 src/components/index.ts 中导出组件
```

### 添加新API
```bash
# 1. 在 src/services 目录下创建服务文件
touch src/services/demo.ts

# 2. 在 src/types/api.ts 中定义类型
# 3. 在 src/services/index.ts 中导出服务
```

## 🔧 高级配置

### 环境变量配置
```bash
# 创建环境配置文件
touch .env.development
touch .env.production

# 在 .env.development 中配置开发环境变量
API_BASE_URL=http://localhost:3000
DEBUG=true

# 在 .env.production 中配置生产环境变量
API_BASE_URL=https://api.rbridge.com
DEBUG=false
```

### 自定义主题
```less
// 修改 src/styles/variables.less
@primary-color: #your-color;
@font-size-base: 30px;
@spacing-md: 30px;
```

### 路由配置
```typescript
// 修改 src/app.config.ts
export default defineAppConfig({
  pages: [
    'pages/index/index',
    'pages/user/index',
    'pages/demo/index' // 添加新页面
  ],
  // 其他配置...
})
```

## 📊 项目监控和分析

### 性能分析
```bash
# 分析构建包大小
npm run build:weapp -- --analyze

# 查看依赖关系
npm ls --depth=0

# 检查安全漏洞
npm audit
```

### 代码质量分析
```bash
# 生成代码覆盖率报告
npm run test:coverage

# 检查代码复杂度
npm run lint -- --max-warnings=0

# 格式化代码
npm run lint:fix
```

## 🚀 部署指南

### 微信小程序部署
1. **开发环境测试**
   ```bash
   npm run dev:weapp
   # 在微信开发者工具中测试
   ```

2. **生产环境构建**
   ```bash
   npm run build:weapp
   # 生成 dist 目录
   ```

3. **上传代码**
   - 在微信开发者工具中导入 `dist` 目录
   - 点击"上传"按钮
   - 填写版本号和项目备注

4. **提交审核**
   - 在微信公众平台提交审核
   - 等待审核通过后发布

### H5部署
1. **构建生产版本**
   ```bash
   npm run build:h5
   ```

2. **部署到服务器**
   ```bash
   # 使用rsync同步文件
   rsync -av dist/ user@server:/var/www/html/
   
   # 或使用scp上传
   scp -r dist/* user@server:/var/www/html/
   ```

3. **配置Nginx**
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;
       root /var/www/html;
       index index.html;
       
       location / {
           try_files $uri $uri/ /index.html;
       }
   }
   ```

### 其他平台部署
- **支付宝小程序**: 使用支付宝开发者工具上传
- **字节跳动小程序**: 使用字节跳动开发者工具上传
- **百度小程序**: 使用百度开发者工具上传
- **QQ小程序**: 使用QQ开发者工具上传
- **京东小程序**: 使用京东开发者工具上传

## 🛠️ 故障排除

### 常见错误及解决方案

#### 1. 依赖安装失败
```bash
# 方法一：使用安装脚本（推荐）
chmod +x install.sh
./install.sh

# 方法二：手动安装
# 清理缓存
npm cache clean --force

# 删除node_modules重新安装
rm -rf node_modules package-lock.json
npm install

# 方法三：使用国内镜像
npm install --registry=https://registry.npmmirror.com

# 方法四：使用yarn
yarn install
```

#### 1.1 缺少 tsconfig-paths-webpack-plugin
```bash
# 安装缺失的依赖
npm install tsconfig-paths-webpack-plugin --save-dev
```

#### 1.2 缺少 @tarojs/plugin-framework-react
```bash
# 安装React框架插件
npm install @tarojs/plugin-framework-react --save-dev
```

#### 2. 构建失败
```bash
# 检查Node.js版本
node --version

# 检查npm版本
npm --version

# 更新依赖
npm update
```

#### 3. 样式不生效
```bash
# 检查Less编译
npm run dev:weapp -- --verbose

# 检查样式文件路径
# 确保导入路径正确
```

#### 4. 路由跳转失败
```bash
# 检查页面是否在app.config.ts中注册
# 检查路由路径是否正确
# 检查页面文件是否存在
```

#### 5. API请求失败
```bash
# 检查网络连接
# 检查API地址是否正确
# 检查请求参数格式
```

### 调试技巧

#### 1. 开启详细日志
```bash
# 设置环境变量
export DEBUG=true
npm run dev:weapp
```

#### 2. 使用断点调试
```typescript
// 在代码中添加断点
debugger;
console.log('调试信息:', data);
```

#### 3. 网络请求调试
```typescript
// 在API请求中添加日志
console.log('请求URL:', url);
console.log('请求参数:', params);
console.log('响应数据:', response);
```

## 📚 学习资源

### 官方文档
- [Taro官方文档](https://taro-docs.jd.com/)
- [React官方文档](https://reactjs.org/)
- [TypeScript官方文档](https://www.typescriptlang.org/)
- [Less官方文档](http://lesscss.org/)

### 推荐教程
- [Taro开发指南](https://taro-docs.jd.com/docs/GETTING-STARTED)
- [微信小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [React Hooks教程](https://reactjs.org/docs/hooks-intro.html)

### 社区资源
- [Taro GitHub](https://github.com/NervJS/taro)
- [Taro社区](https://taro-club.jd.com/)
- [微信小程序社区](https://developers.weixin.qq.com/community/minihome)

## 🎨 设计系统

### 颜色规范

- **主色**: #1890ff
- **成功色**: #52c41a
- **警告色**: #faad14
- **错误色**: #f5222d
- **信息色**: #1890ff

### 字体规范

- **字体族**: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC'
- **基础字号**: 28px
- **行高**: 1.5

### 间距规范

- **xs**: 8px
- **sm**: 16px
- **md**: 24px
- **lg**: 32px
- **xl**: 48px
- **xxl**: 64px

## 🔧 核心功能

### 状态管理

使用 Redux Toolkit 进行状态管理，支持持久化存储：

```typescript
// 使用类型化hooks
const dispatch = useAppDispatch()
const userInfo = useAppSelector(state => state.user.userInfo)

// 更新用户信息
dispatch(setUserInfo(userInfo))
```

### 路由管理

内置路由守卫和导航工具：

```typescript
import { navigateTo, switchTab, routeGuard } from '@/router'

// 页面跳转
navigateTo('/pages/detail/index', { id: 123 })

// 标签页切换
switchTab('/pages/index/index')

// 路由守卫
if (routeGuard.intercept(url)) {
  // 允许访问
}
```

### API服务

统一的API请求封装：

```typescript
import { get, post } from '@/services/api'

// GET请求
const data = await get('/api/users')

// POST请求
const result = await post('/api/login', { username, password })
```

### 工具函数

丰富的工具函数库：

```typescript
import { formatMoney, validatePhone, formatDate } from '@/utils'

// 格式化金额
const money = formatMoney(1234.56) // "1,234.56"

// 验证手机号
const isValid = validatePhone('13800138000') // true

// 格式化日期
const date = formatDate(new Date(), 'YYYY-MM-DD') // "2024-01-01"
```

## 📦 组件库

### 基础组件

- **Button**: 按钮组件，支持多种类型和尺寸
- **Input**: 输入框组件，支持验证和格式化
- **Loading**: 加载组件，支持全屏和局部加载
- **Modal**: 弹窗组件，支持自定义内容
- **Toast**: 提示组件，支持多种提示类型

### 布局组件

- **NavBar**: 导航栏组件
- **TabBar**: 标签栏组件
- **Card**: 卡片组件
- **List**: 列表组件
- **Empty**: 空状态组件

## 🚀 扩展指南

### 添加新页面

1. 在 `src/pages` 目录下创建页面文件夹
2. 在 `src/app.config.ts` 中注册页面路由
3. 在 `src/router/index.ts` 中添加路由配置

### 添加新组件

1. 在 `src/components` 目录下创建组件文件夹
2. 创建组件的 TypeScript 文件和样式文件
3. 在 `src/components/index.ts` 中导出组件

### 添加新API

1. 在 `src/services` 目录下创建服务文件
2. 在 `src/types/api.ts` 中定义相关类型
3. 在 `src/services/index.ts` 中导出服务

## 📝 开发规范

### 代码规范

- 使用 TypeScript 进行类型检查
- 遵循 ESLint 代码规范
- 使用 Prettier 格式化代码
- 组件和函数使用 PascalCase 命名
- 变量和属性使用 camelCase 命名

### 提交规范

- feat: 新功能
- fix: 修复bug
- docs: 文档更新
- style: 代码格式调整
- refactor: 代码重构
- test: 测试相关
- chore: 构建过程或辅助工具的变动

## 🤝 贡献指南

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情

## 📞 联系我们

如有问题或建议，请通过以下方式联系：

- 邮箱: support@rbridge.com
- 微信: rbridge_support
- QQ群: 123456789
