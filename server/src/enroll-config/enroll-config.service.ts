import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoreRange } from '@/entities/score-range.entity';
import { ProvincialControlLine } from '@/entities/provincial-control-line.entity';
import { User } from '@/entities/user.entity';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { UsersService } from '@/users/users.service';
import { ProvinceBatchItemDto } from '@/users/dto/province-batches-response.dto';
import { ProvincialControlLineResponseDto } from './dto/provincial-control-line-response.dto';

/** getScoreRange 返回类型：分数范围 + 省份批次列表及最符合批次 */
export type GetScoreRangeResult = {
  scoreRange: ScoreRange;
  batches: ProvinceBatchItemDto[];
  matchedBatch: string | null;
};

/**
 * 招生配置服务
 * 处理高考科目配置相关的业务逻辑
 */
@Injectable()
export class EnrollConfigService {
  private readonly logger = new Logger(EnrollConfigService.name);

  constructor(
    @InjectRepository(ScoreRange)
    private readonly scoreRangeRepository: Repository<ScoreRange>,
    @InjectRepository(ProvincialControlLine)
    private readonly provincialControlLineRepository: Repository<ProvincialControlLine>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * 根据省份名称、科目类型和分数键值获取分数范围信息，并调用用户服务获取该省份该年下所有批次及最符合分数的批次
   * @param provinceName 省份名称
   * @param subjectType 科目类型
   * @param scoreKey 分数键值
   * @param year 年份
   * @returns 分数范围信息 + batches、matchedBatch，未找到分数范围时返回 null
   */
  async getScoreRange(
    provinceName: string,
    subjectType: string,
    scoreKey: string,
    year: string,
  ): Promise<GetScoreRangeResult | null> {
    try {
      const scoreRange = await this.scoreRangeRepository.findOne({
        where: {
          provinceName,
          subjectType,
          scoreKey,
          year: parseInt(year),
        },
      });

      if (!scoreRange) {
        return null;
      }

      const scoreNum =
        scoreKey !== undefined && scoreKey !== '' && !Number.isNaN(Number(scoreKey))
          ? Number(scoreKey)
          : undefined;
      const provinceBatches = await this.usersService.getProvinceBatchesWithMatch(
        provinceName,
        year,
        scoreNum ?? null,
      );

      return {
        scoreRange,
        batches: provinceBatches.batches,
        matchedBatch: provinceBatches.matchedBatch ?? null,
      };
    } catch (error) {
      throw error;
    }
  }

  /**
   * 根据用户信息查询省控线
   * @param user 用户对象（包含 id）
   * @param year 年份，默认为2025
   * @returns 省控线列表
   */
  async findProvincialControlLinesByUser(
    user: any,
    year: string = '2025',
  ): Promise<ProvincialControlLineResponseDto[]> {
    // 根据用户ID从数据库查询完整的用户信息
    const userInfo = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!userInfo) {
      throw new NotFoundException('用户不存在');
    }

    // 验证用户信息
    if (!userInfo.province) {
      throw new BadRequestException('用户信息不完整：缺少省份信息，请完善您的高考信息');
    }

    if (!userInfo.preferredSubjects) {
      throw new BadRequestException('用户信息不完整：缺少首选科目信息，请完善您的高考信息');
    }

    if (!userInfo.enrollType) {
      throw new BadRequestException('用户信息不完整：缺少批次信息，请完善您的高考信息');
    }

    const province = userInfo.province;
    // 将首选科目转换为类型名称（如：物理 -> 物理类）
    const typeName = userInfo.preferredSubjects ;
    // 使用用户的录取类型作为批次名称
    const batchName = userInfo.enrollType;

    const queryBuilder = this.provincialControlLineRepository
      .createQueryBuilder('pcl')
      .where('pcl.province = :province', { province })
      .andWhere('pcl.year = :year', { year })
      .andWhere('pcl.typeName = :typeName', { typeName })
      .andWhere('pcl.batchName = :batchName', { batchName });

    // 按批次名称和类型名称排序
    queryBuilder
      .orderBy('pcl.batchName', 'ASC')
      .addOrderBy('pcl.typeName', 'ASC')
      .addOrderBy('pcl.score', 'DESC');

    const results = await queryBuilder.getMany();

    this.logger.log(
      `查询省控线：省份=${province}, 年份=${year}, 类型=${typeName}, 批次=${batchName}, 找到 ${results.length} 条记录`,
    );

    return plainToInstance(ProvincialControlLineResponseDto, results, {
      excludeExtraneousValues: true,
    });
  }


}

