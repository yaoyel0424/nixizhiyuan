import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, In } from 'typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';
import { QueryPopularMajorDto } from './dto/query-popular-major.dto';
import { ErrorCode } from '../common/constants/error-code.constant';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { ScoresService } from '../scores/scores.service';

/**
 * 热门专业服务
 * 处理热门专业相关的业务逻辑
 */
@Injectable()
export class PopularMajorsService {
  constructor(
    @InjectRepository(PopularMajor)
    private readonly popularMajorRepository: Repository<PopularMajor>,
    @InjectRepository(MajorElementAnalysis)
    private readonly majorElementAnalysisRepository: Repository<MajorElementAnalysis>,
    @InjectRepository(Scale)
    private readonly scaleRepository: Repository<Scale>,
    @InjectRepository(ScaleAnswer)
    private readonly scaleAnswerRepository: Repository<ScaleAnswer>,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * 分页查询热门专业列表，包含填写进度和分数
   * @param queryDto 查询条件
   * @param userId 用户ID（可选，用于计算进度和分数）
   * @returns 分页结果，包含进度和分数信息
   */
  async findAll(queryDto: QueryPopularMajorDto, userId?: number) {
    const {
      page = 1,
      limit = 10,
      sortBy = 'id',
      sortOrder = 'ASC',
      level1,
      name,
      code,
    } = queryDto;

    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    if (level1) {
      where.level1 = level1;
    }

    if (name) {
      where.name = Like(`%${name}%`);
    }

    if (code) {
      where.code = code;
    }

    // 执行查询
    const [items, total] = await this.popularMajorRepository.findAndCount({
      where,
      relations: ['majorDetail', 'majorDetail.major'],
      order: {
        [sortBy]: sortOrder,
      },
      skip,
      take: limit,
    });

    // 如果有 userId，计算每个专业的进度和分数
    if (userId && items.length > 0) {
      // 获取所有专业详情ID
      const majorDetailIds = items
        .map((item) => item.majorDetail?.id)
        .filter((id) => id !== undefined);

      if (majorDetailIds.length > 0) {
        // 查询每个专业关联的元素分析
        const analyses = await this.majorElementAnalysisRepository.find({
          where: { majorDetailId: In(majorDetailIds) },
          select: ['majorDetailId', 'elementId'],
        });

        // 获取所有元素ID
        const elementIds = [...new Set(analyses.map((a) => a.elementId))];

        if (elementIds.length > 0) {
          // 查询这些元素关联的所有量表（direction = '168'）
          const scales = await this.scaleRepository.find({
            where: {
              elementId: In(elementIds),
              direction: '168',
            },
            select: ['id', 'elementId'],
          });

          // 按专业分组，统计每个专业的问卷总数
          const majorScaleCountMap = new Map<number, number>();
          analyses.forEach((analysis) => {
            const scaleCount = scales.filter(
              (s) => s.elementId === analysis.elementId,
            ).length;
            const current = majorScaleCountMap.get(analysis.majorDetailId) || 0;
            majorScaleCountMap.set(
              analysis.majorDetailId,
              current + scaleCount,
            );
          });

          // 获取用户已填写的答案（scaleId > 112）
          const userAnswers = await this.scaleAnswerRepository.find({
            where: {
              userId,
              scaleId: In(scales.map((s) => s.id)),
            },
            select: ['scaleId'],
          });

          const answeredScaleIds = new Set(userAnswers.map((a) => a.scaleId));

          // 按专业分组，统计每个专业已填写的问卷数
          const majorAnsweredCountMap = new Map<number, number>();
          analyses.forEach((analysis) => {
            const relatedScales = scales.filter(
              (s) => s.elementId === analysis.elementId,
            );
            const answeredCount = relatedScales.filter((s) =>
              answeredScaleIds.has(s.id),
            ).length;
            const current =
              majorAnsweredCountMap.get(analysis.majorDetailId) || 0;
            majorAnsweredCountMap.set(
              analysis.majorDetailId,
              current + answeredCount,
            );
          });

          // 获取每个专业的分数（需要 edu_level）
          const majorCodes = items
            .map((item) => item.code)
            .filter((code) => code !== undefined);
          const eduLevels = [
            ...new Set(
              items
                .map((item) => item.majorDetail?.major?.eduLevel)
                .filter((level) => level !== undefined),
            ),
          ];

          // 为每个专业计算分数
          const scoreMap = new Map<string, any>();
          for (const eduLevel of eduLevels) {
            if (eduLevel) {
              const scores = await this.scoresService.calculateScores(
                userId,
                eduLevel,
                majorCodes,
              );
              scores.forEach((score) => {
                scoreMap.set(score.majorCode, score);
              });
            }
          }

          // 将进度和分数信息添加到每个专业
          items.forEach((item) => {
            const majorDetailId = item.majorDetail?.id;
            if (majorDetailId) {
              const totalCount =
                majorScaleCountMap.get(majorDetailId) || 0;
              const completedCount =
                majorAnsweredCountMap.get(majorDetailId) || 0;
              const scoreInfo = scoreMap.get(item.code);

              (item as any).progress = {
                completedCount,
                totalCount,
                isCompleted: completedCount === totalCount && totalCount > 0,
              };

              if (scoreInfo) {
                (item as any).score = {
                  score: scoreInfo.score,
                  lexueScore: scoreInfo.lexueScore,
                  shanxueScore: scoreInfo.shanxueScore,
                  yanxueDeduction: scoreInfo.yanxueDeduction,
                  tiaozhanDeduction: scoreInfo.tiaozhanDeduction,
                };
              } else {
                (item as any).score = null;
              }
            }
          });
        }
      }
    }

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * 根据 ID 获取热门专业详情
   * @param id 热门专业 ID
   * @returns 热门专业详情
   */
  async findOne(id: number): Promise<PopularMajor> {
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { id },
      relations: ['majorDetail', 'majorDetail.major'],
    });

    if (!popularMajor) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '热门专业不存在',
      });
    }

    return popularMajor;
  }

  /**
   * 根据专业代码获取热门专业详情
   * @param code 专业代码
   * @returns 热门专业详情
   */
  async findByCode(code: string): Promise<PopularMajor | null> {
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { code },
      relations: ['majorDetail'],
    });

    if (!popularMajor) {
      return null;
    }

    return popularMajor;
  }

  /**
   * 根据教育层次获取热门专业列表
   * @param level1 教育层次
   * @returns 热门专业列表
   */
  async findByLevel1(level1: string): Promise<PopularMajor[]> {
    const popularMajors = await this.popularMajorRepository.find({
      where: { level1 },
      relations: ['majorDetail'],
      order: {
        id: 'ASC',
      },
    });

    return popularMajors;
  }

}

