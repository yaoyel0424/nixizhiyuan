import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { Order } from '@/entities/order.entity';
import { User } from '@/entities/user.entity';
import { UserEntitlement } from '@/entities/user-entitlement.entity';
import { UserFreePopularMajorRecord } from '@/entities/user-free-popular-major-record.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PayLoggerService } from './pay-logger.service';
import { PayService } from './pay.service';
import { EntitlementService } from './entitlement.service';
import { PayController } from './pay.controller';
import { PaymentProcessor } from './payment.processor';
import { SplitProcessor } from './split.processor';
import { UsersModule } from '@/users/users.module';

const PAYMENT_QUEUE = 'payment';
const SPLIT_QUEUE = 'split';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([
      Order,
      User,
      UserEntitlement,
      UserFreePopularMajorRecord,
      PopularMajor,
    ]),
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host') || 'localhost',
          port: config.get<number>('redis.port') || 6379,
          password: config.get<string>('redis.password') || undefined,
          db: config.get<number>('redis.db') ?? 0,
        },
      }),
    }),
    BullModule.registerQueue(
      { name: PAYMENT_QUEUE },
      { name: SPLIT_QUEUE },
    ),
    forwardRef(() => UsersModule),
  ],
  controllers: [PayController],
  providers: [PayLoggerService, PayService, EntitlementService, PaymentProcessor, SplitProcessor],
  exports: [PayService, EntitlementService],
})
export class PayModule {}
