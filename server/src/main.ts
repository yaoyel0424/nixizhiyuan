import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';
import { ValidationPipe as CustomValidationPipe } from './common/pipes/validation.pipe';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const basicAuth = require('express-basic-auth');

/**
 * 应用入口文件
 */
async function bootstrap() {
  try {
    const app = await NestFactory.create(AppModule, {
      bufferLogs: true,
    });

    const configService = app.get(ConfigService);
    const port = configService.get<number>('app.port') || 3000;
    const prefix = configService.get<string>('app.prefix') || 'api/v1';
    const corsOrigin = configService.get<string[]>('app.corsOrigin') || '*';

  // 设置全局前缀
  app.setGlobalPrefix(prefix);

  // 启用 CORS
  app.enableCors({
    origin: corsOrigin,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 全局验证管道（使用自定义的 ValidationPipe，已在 app.module.ts 中注册）
  // 注意：自定义 ValidationPipe 已在 app.module.ts 中通过 APP_PIPE 注册
  // 这里不需要再次注册，避免重复

  // Swagger API 文档配置
  const config = new DocumentBuilder()
    .setTitle('NestJS 后台框架 API')
    .setDescription('NestJS 11 后台框架 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);

  // 配置 Swagger 文档的 Basic Auth 保护
  const swaggerUsername = configService.get<string>('swagger.username') || 'admin';
  const swaggerPassword = configService.get<string>('swagger.password') || 'NIXIzhiyuan123!@#';

  app.use(
    ['/api/docs', '/api/docs-json', '/api/docs-yaml'],
    basicAuth({
      challenge: true,
      users: {
        [swaggerUsername]: swaggerPassword,
      },
    }),
  );

  SwaggerModule.setup('api/docs', app, document);

    // 监听所有网络接口，允许外部访问
    await app.listen(port, '0.0.0.0');

    const logger = new Logger('Bootstrap');
    logger.log(`应用启动成功: http://localhost:${port}`);
    logger.log(`应用启动成功: http://0.0.0.0:${port}`);
    logger.log(`API 文档: http://localhost:${port}/api/docs`);
  } catch (error) {
    const logger = new Logger('Bootstrap');
    logger.error('应用启动失败:', error);
    process.exit(1);
  }
}

bootstrap();

