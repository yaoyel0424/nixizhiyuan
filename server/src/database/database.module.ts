import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';

/**
 * 数据库模块
 * TypeORM + PostgreSQL 配置
 */
@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('database.host') || 'localhost',
        port: configService.get('database.port') || 5432,
        username: configService.get('database.username') || 'postgres',
        password: configService.get('database.password') || 'postgres',
        database: configService.get('database.database') || 'nestjs_db',
        // 实体文件路径：支持两种组织方式
        // 1. 统一文件夹：src/entities/*.entity.ts
        // 2. 按模块组织：src/**/entities/*.entity.ts (如 src/users/entities/user.entity.ts)
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: configService.get('database.synchronize') || false,
        logging: configService.get('database.logging') || false,
        autoLoadEntities: true,
        retryAttempts: 3,
        retryDelay: 3000,
        // 连接池配置
        extra: {
          // 最大连接数（默认5）
          max: configService.get('database.pool.max') || 15,
          // 最小连接数
          min: configService.get('database.pool.min') || 1,
          // 空闲连接超时时间（毫秒），默认30秒
          idleTimeoutMillis: configService.get('database.pool.idleTimeoutMillis') || 30000,
          // 连接超时时间（毫秒），默认10秒
          connectionTimeoutMillis: configService.get('database.pool.connectionTimeoutMillis') || 10000,
        },
      }),
    }),
  ],
})
export class DatabaseModule {}

