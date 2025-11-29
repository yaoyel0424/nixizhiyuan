// 类名合并工具函数
// 注意：Taro 小程序环境可能不支持 clsx 和 tailwind-merge
// 这里提供一个简化版本
export function cn(...inputs: (string | undefined | null | boolean)[]): string {
  return inputs.filter(Boolean).join(' ')
}

