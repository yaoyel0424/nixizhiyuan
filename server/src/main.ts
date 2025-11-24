import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { Logger } from '@nestjs/common';

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

  // 全局验证管道
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger API 文档配置
  const config = new DocumentBuilder()
    .setTitle('NestJS 后台框架 API')
    .setDescription('NestJS 11 后台框架 API 文档')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

    await app.listen(port);

    const logger = new Logger('Bootstrap');
    logger.log(`应用启动成功: http://localhost:${port}`);
    logger.log(`API 文档: http://localhost:${port}/api/docs`);
  } catch (error) {
    const logger = new Logger('Bootstrap');
    logger.error('应用启动失败:', error);
    process.exit(1);
  }
}

bootstrap();

