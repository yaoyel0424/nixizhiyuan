import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * 微信认证守卫
 * 只有当 query.code 不为空时才执行微信认证
 */
@Injectable()
export class WechatAuthGuard extends AuthGuard('wechat') {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const code = request.query?.code || request.body?.code; 
    // 只有当 code 存在时才执行认证
    if (code) {
      return super.canActivate(context);
    }
    
    // 没有 code 时跳过认证
    return true;
  }
}

