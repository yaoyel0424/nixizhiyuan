import { SetMetadata } from '@nestjs/common';

/**
 * 角色权限装饰器
 * 用于标记路由所需的角色权限
 * @param roles 角色数组
 * @example @Roles('admin', 'user')
 */
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

