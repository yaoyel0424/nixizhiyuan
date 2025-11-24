import { defineConfig } from '@tarojs/cli'
import TsconfigPathsPlugin from 'tsconfig-paths-webpack-plugin'

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
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
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
      webpackChain(chain) {
        chain.resolve.plugin('tsconfig-paths').use(TsconfigPathsPlugin)
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