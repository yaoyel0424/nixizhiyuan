import { Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import appConfig from './app.config';
import databaseConfig from './database.config';
import redisConfig from './redis.config';
import jwtConfig from './jwt.config';

/**
 * 根据环境获取 .env 文件路径
 * 优先级：.env.{NODE_ENV}.local > .env.{NODE_ENV} > .env.local > .env
 */
function getEnvFilePath(): string[] {
  const env = process.env.NODE_ENV || 'development';
  const envFiles = [
    `.env.${env}.local`, // 环境特定的本地配置（最高优先级）
    `.env.${env}`, // 环境特定的配置
    '.env.local', // 本地配置（开发环境）
    '.env', // 默认配置
  ];
  return envFiles;
}

/**
 * 配置模块
 * 集中管理应用配置
 * 支持多环境配置：development、production、test
 */
@Module({
  imports: [
    NestConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, jwtConfig],
      envFilePath: getEnvFilePath(),
      ignoreEnvFile: false,
      // 允许使用环境变量覆盖配置文件中的值
      expandVariables: true,
    }),
  ],
  exports: [NestConfigModule],
})
export class ConfigModule {}

