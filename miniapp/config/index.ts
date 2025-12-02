import { defineConfig } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'

// 自定义 webpack 插件：修复 CSS 顺序冲突
class FixCssOrderPlugin {
  apply(compiler: any) {
    // 在编译器初始化时修改插件配置
    compiler.hooks.initialize.tap('FixCssOrderPlugin', () => {
      if (compiler.options && compiler.options.plugins) {
        compiler.options.plugins.forEach((plugin: any) => {
          if (plugin && plugin.constructor) {
            const pluginName = plugin.constructor.name
            if (pluginName === 'MiniCssExtractPlugin' || pluginName.includes('CssExtract')) {
              plugin.options = plugin.options || {}
              plugin.options.ignoreOrder = true
            }
          }
        })
      }
    })
    
    // 也在 compilation 阶段尝试修改
    compiler.hooks.thisCompilation.tap('FixCssOrderPlugin', (compilation: any) => {
      if (compiler.options && compiler.options.plugins) {
        compiler.options.plugins.forEach((plugin: any) => {
          if (plugin && plugin.constructor) {
            const pluginName = plugin.constructor.name
            if (pluginName === 'MiniCssExtractPlugin' || pluginName.includes('CssExtract')) {
              plugin.options = plugin.options || {}
              plugin.options.ignoreOrder = true
            }
          }
        })
      }
    })
  }
}

export default defineConfig(async (merge, { command, mode }) => {
  const baseConfig = {
    projectName: 'nixi-zhiyuan-client',
    date: '2024-1-1',
    designWidth: 750,
    deviceRatio: {
      640: 2.34 / 2,
      750: 1,
      375: 2,
      828: 1.81 / 2
    },
    sourceRoot: 'src',
    outputRoot: 'dist',
    plugins: [
      '@tarojs/plugin-framework-react'
    ],
    defineConstants: {
    },
    alias: {
      '@': require('path').resolve(__dirname, '..', 'src'),
      '@/components': require('path').resolve(__dirname, '..', 'src/components'),
      '@/pages': require('path').resolve(__dirname, '..', 'src/pages'),
      '@/store': require('path').resolve(__dirname, '..', 'src/store'),
      '@/utils': require('path').resolve(__dirname, '..', 'src/utils'),
      '@/services': require('path').resolve(__dirname, '..', 'src/services'),
      '@/types': require('path').resolve(__dirname, '..', 'src/types'),
      '@/assets': require('path').resolve(__dirname, '..', 'src/assets'),
      '@/styles': require('path').resolve(__dirname, '..', 'src/styles')
    },
    copy: {
      patterns: [
      ],
      options: {
      }
    },
    framework: 'react',
    compiler: {
      type: 'webpack5',
      prebundle: { enable: false }
    },
    cache: {
      enable: false
    },
    mini: {
      postcss: {
        pxtransform: {
          enable: true,
          config: {

          }
        },
        url: {
          enable: true,
          config: {
            limit: 1024
          }
        },
        cssModules: {
          enable: false
        }
      },
      webpackChain(chain: any) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
        
        // 修复 CSS 模块顺序冲突警告
        // 使用自定义插件来修改 MiniCssExtractPlugin 配置
        chain.plugin('fix-css-order').use(FixCssOrderPlugin)
        
        // 确保输出格式适合微信小程序环境
        // 使用安全的 globalObject 配置，确保 wx 对象可用
        chain.output
          .libraryTarget('jsonp')
          .globalObject('(typeof wx !== "undefined" ? wx : globalThis)')
      }
    },
    h5: {
      publicPath: '/',
      staticDirectory: 'static',
      postcss: {
        autoprefixer: {
          enable: true,
          config: {
          }
        },
        cssModules: {
          enable: false
        }
      },
      webpackChain(chain: any) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
        
        // 修复 CSS 模块顺序冲突警告
        chain.stats({
          warningsFilter: [
            /Conflicting order between:/,
            /mini-css-extract-plugin[^]*Conflicting order/
          ]
        })
      }
    },
    rn: {
      appName: 'rbridgeClient',
      postcss: {
        cssModules: {
          enable: false
        }
      }
    }
  }

  if (process.env.NODE_ENV === 'development') {
    return merge({}, baseConfig, {
    })
  }
  return merge({}, baseConfig, {
  })
})
