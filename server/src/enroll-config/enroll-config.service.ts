import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ScoreRange } from '@/entities/score-range.entity';
import { ConfigService } from '@nestjs/config';

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
    private readonly configService: ConfigService,
  ) {}

  /**
   * 根据省份名称、科目类型和分数键值获取分数范围信息
   * @param provinceName 省份名称
   * @param subjectType 科目类型
   * @param scoreKey 分数键值
   * @param year 年份
   * @returns 分数范围信息
   */
  async getScoreRange(
    provinceName: string,
    subjectType: string,
    scoreKey: string,
    year: string,
  ): Promise<ScoreRange | null> {
    try {
      this.logger.log(
        `尝试获取分数范围信息，provinceName: ${provinceName}, subjectType: ${subjectType}, scoreKey: ${scoreKey}, year: ${year}`,
        'EnrollConfigService',
      );

      const scoreRange = await this.scoreRangeRepository.findOne({
        where: {
          provinceName,
          subjectType,
          scoreKey,
          year: parseInt(year),
        },
      });

      if (!scoreRange) {
        this.logger.warn(
          `未找到分数范围信息，provinceName: ${provinceName}, subjectType: ${subjectType}, scoreKey: ${scoreKey}, year: ${year}`,
          'EnrollConfigService',
        );
        return null;
      }

      this.logger.log(
        `成功找到分数范围信息: ${JSON.stringify(scoreRange)}`,
        'EnrollConfigService',
      );
      return scoreRange;
    } catch (error) {
      this.logger.error(
        `获取分数范围信息失败，provinceName: ${provinceName}, subjectType: ${subjectType}, scoreKey: ${scoreKey}, year: ${year}`,
        error instanceof Error ? error.stack : String(error),
        'EnrollConfigService',
      );
      throw error;
    }
  }
}

