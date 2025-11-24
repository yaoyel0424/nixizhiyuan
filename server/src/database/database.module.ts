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
        entities: [__dirname + '/../**/*.entity{.ts,.js}'],
        migrations: [__dirname + '/migrations/*{.ts,.js}'],
        synchronize: configService.get('database.synchronize') || false,
        logging: configService.get('database.logging') || false,
        autoLoadEntities: true,
        retryAttempts: 3,
        retryDelay: 3000,
      }),
    }),
  ],
})
export class DatabaseModule {}

