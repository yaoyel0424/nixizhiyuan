import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { ScalesModule } from '@/scales/scales.module';
import { HtmlController } from './html.controller';
import { HtmlService } from './html.service';

/**
 * 后台 HTML 模块
 * 提供量表管理页（展示、登录、修改）
 */
@Module({
  imports: [
    ConfigModule,
    ScalesModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: { expiresIn: config.get<string>('jwt.expiresIn') },
      }),
    }),
  ],
  controllers: [HtmlController],
  providers: [HtmlService],
})
export class HtmlModule {}
