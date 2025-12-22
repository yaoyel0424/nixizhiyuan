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
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { CreatePopularMajorAnswerDto } from './dto/create-popular-major-answer.dto';
import { QueryPopularMajorAnswerDto } from './dto/query-popular-major-answer.dto';
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
    @InjectRepository(PopularMajorAnswer)
    private readonly popularMajorAnswerRepository: Repository<PopularMajorAnswer>,
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
    await this.addProgressAndScore(items, userId);

    // 将 majorDetail.major.name 映射到 majorDetail.name，以便 DTO 正确序列化
    items.forEach((item) => {
      if (item.majorDetail?.major?.name) {
        (item.majorDetail as any).name = item.majorDetail.major.name;
      }
    });

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
   * @param userId 用户ID（可选，用于计算进度和分数）
   * @returns 热门专业详情
   */
  async findOne(id: number, userId?: number): Promise<PopularMajor> {
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

    // 将 majorDetail.major.name 映射到 majorDetail.name，以便 DTO 正确序列化
    if (popularMajor.majorDetail?.major?.name) {
      (popularMajor.majorDetail as any).name = popularMajor.majorDetail.major.name;
    }

    // 如果有 userId，计算进度和分数
    await this.addProgressAndScore([popularMajor], userId);

    return popularMajor;
  }

  /**
   * 根据专业代码获取热门专业详情
   * @param code 专业代码
   * @param userId 用户ID（可选，用于计算进度和分数）
   * @returns 热门专业详情
   */
  async findByCode(code: string, userId?: number): Promise<PopularMajor | null> {
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { code },
      relations: ['majorDetail', 'majorDetail.major'],
    });

    if (!popularMajor) {
      return null;
    }

    // 将 majorDetail.major.name 映射到 majorDetail.name，以便 DTO 正确序列化
    if (popularMajor.majorDetail?.major?.name) {
      (popularMajor.majorDetail as any).name = popularMajor.majorDetail.major.name;
    }

    // 如果有 userId，计算进度和分数
    await this.addProgressAndScore([popularMajor], userId);

    return popularMajor;
  }

  /**
   * 根据教育层次获取热门专业列表
   * @param level1 教育层次
   * @param userId 用户ID（可选，用于计算进度和分数）
   * @returns 热门专业列表
   */
  async findByLevel1(level1: string, userId?: number): Promise<PopularMajor[]> {
    const popularMajors = await this.popularMajorRepository.find({
      where: { level1 },
      relations: ['majorDetail', 'majorDetail.major'],
      order: {
        id: 'ASC',
      },
    });

    // 将 majorDetail.major.name 映射到 majorDetail.name，以便 DTO 正确序列化
    popularMajors.forEach((item) => {
      if (item.majorDetail?.major?.name) {
        (item.majorDetail as any).name = item.majorDetail.major.name;
      }
    });

    // 如果有 userId，计算进度和分数
    await this.addProgressAndScore(popularMajors, userId);

    return popularMajors;
  }

  /**
   * 为热门专业列表添加进度和分数信息（辅助方法）
   * @param items 热门专业列表
   * @param userId 用户ID（可选）
   */
  private async addProgressAndScore(
    items: PopularMajor[],
    userId?: number,
  ): Promise<void> {
    if (!userId || items.length === 0) {
      return;
    }

    // 获取所有专业详情ID
    const majorDetailIds = items
      .map((item) => item.majorDetail?.id)
      .filter((id) => id !== undefined);

    if (majorDetailIds.length === 0) {
      return;
    }

    // 查询每个专业关联的元素分析
    const analyses = await this.majorElementAnalysisRepository.find({
      where: { majorDetailId: In(majorDetailIds) },
      select: ['majorDetailId', 'elementId'],
    });

    // 获取所有元素ID
    const elementIds = [...new Set(analyses.map((a) => a.elementId))];

    if (elementIds.length === 0) {
      return;
    }

    // 获取热门专业ID列表和 majorDetailId 到 popularMajorId 的映射
    const popularMajorIds = items.map((item) => item.id);
    const majorDetailToPopularMajorMap = new Map<number, number>();
    items.forEach((item) => {
      if (item.majorDetail?.id) {
        majorDetailToPopularMajorMap.set(item.majorDetail.id, item.id);
      }
    });

    // 查询这些元素关联的所有量表（direction = '168'）
    const scales = await this.scaleRepository.find({
      where: {
        elementId: In(elementIds),
        direction: '168',
      },
      select: ['id', 'elementId'],
    });

    const scaleIds = scales.map((s) => s.id);

    // 使用一个 SQL 查询同时获取：每个专业的问卷总数和用户已填写的答案
    const majorDetailPlaceholders = majorDetailIds
      .map((_, index) => `$${index + 1}`)
      .join(', ');
    const popularMajorPlaceholders = popularMajorIds
      .map((_, index) => `$${majorDetailIds.length + 2 + index}`)
      .join(', ');
    const scalePlaceholders = scaleIds.length > 0
      ? scaleIds.map((_, index) => `$${majorDetailIds.length + 2 + popularMajorIds.length + index}`).join(', ')
      : 'NULL';

    const sql = `
      WITH major_scales AS (
        SELECT 
          mea.major_id as major_detail_id,
          s.id as scale_id,
          s.element_id
        FROM major_element_analysis mea
        INNER JOIN elements e ON e.id = mea.element_id
        INNER JOIN scales s ON s.element_id = e.id
        WHERE mea.major_id IN (${majorDetailPlaceholders})
          AND s.direction = '168'
          AND s.id > 112
      ),
      scale_counts AS (
        SELECT 
          major_detail_id,
          COUNT(DISTINCT scale_id) as total_count
        FROM major_scales
        GROUP BY major_detail_id
      ),
      user_answers AS (
        SELECT 
          pma.popular_major_id,
          pma.scale_id
        FROM popular_major_answers pma
        WHERE pma.user_id = $${majorDetailIds.length + 1}
          AND pma.popular_major_id IN (${popularMajorPlaceholders})
          ${scaleIds.length > 0 ? `AND pma.scale_id IN (${scalePlaceholders})` : ''}
      ),
      answered_counts AS (
        SELECT 
          md.id as major_detail_id,
          pm.id as popular_major_id,
          COUNT(DISTINCT ua.scale_id) as completed_count
        FROM major_details md
        INNER JOIN popular_majors pm ON pm.code = md.code
        INNER JOIN major_scales ms ON ms.major_detail_id = md.id
        LEFT JOIN user_answers ua ON ua.scale_id = ms.scale_id 
          AND ua.popular_major_id = pm.id
        WHERE md.id IN (${majorDetailPlaceholders})
          AND pm.id IN (${popularMajorPlaceholders})
        GROUP BY md.id, pm.id
      )
      SELECT 
        sc.major_detail_id,
        COALESCE(sc.total_count, 0) as total_count,
        COALESCE(ac.completed_count, 0) as completed_count,
        ac.popular_major_id
      FROM scale_counts sc
      LEFT JOIN answered_counts ac ON ac.major_detail_id = sc.major_detail_id
    `;

    const queryParams = [
      ...majorDetailIds,
      userId,
      ...popularMajorIds,
      ...(scaleIds.length > 0 ? scaleIds : []),
    ];

    const progressResults = await this.popularMajorRepository.manager.query(
      sql,
      queryParams,
    );

    // 构建映射
    const majorScaleCountMap = new Map<number, number>();
    const majorAnsweredCountMap = new Map<number, number>();
    const answeredScaleIdsByMajor = new Map<number, Set<number>>();

    // 获取用户答案用于构建 answeredScaleIdsByMajor（只需要一次查询）
    const userAnswers = await this.popularMajorAnswerRepository.find({
      where: {
        userId,
        popularMajorId: In(popularMajorIds),
        ...(scaleIds.length > 0 ? { scaleId: In(scaleIds) } : {}),
      },
      select: ['scaleId', 'popularMajorId'],
    });

    userAnswers.forEach((answer) => {
      if (!answeredScaleIdsByMajor.has(answer.popularMajorId)) {
        answeredScaleIdsByMajor.set(
          answer.popularMajorId,
          new Set<number>(),
        );
      }
      answeredScaleIdsByMajor.get(answer.popularMajorId)!.add(answer.scaleId);
    });

    // 处理查询结果
    progressResults.forEach((row: any) => {
      if (row.major_detail_id) {
        majorScaleCountMap.set(row.major_detail_id, row.total_count || 0);
        if (row.popular_major_id) {
          majorAnsweredCountMap.set(
            row.major_detail_id,
            row.completed_count || 0,
          );
        }
      }
    });

    // 获取每个热门专业的分数
    const scores = await this.scoresService.calculatePopularMajorScores(
      userId,
      popularMajorIds,
    );

    // 使用 popularMajorId 作为 key 创建分数映射
    const scoreMap = new Map<number, any>();
    scores.forEach((score) => {
      scoreMap.set(score.popularMajorId, score);
    });

    // 将进度和分数信息添加到每个专业
    items.forEach((item) => {
      const majorDetailId = item.majorDetail?.id;
      if (majorDetailId) {
        const totalCount = majorScaleCountMap.get(majorDetailId) || 0;
        const completedCount = majorAnsweredCountMap.get(majorDetailId) || 0;
        const scoreInfo = scoreMap.get(item.id);

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

  /**
   * 创建或更新热门专业问卷答案
   * @param createDto 创建答案 DTO
   * @param userId 用户ID（从当前登录用户获取）
   * @returns 创建或更新的答案
   */
  async createAnswer(
    createDto: CreatePopularMajorAnswerDto,
    userId: number,
  ): Promise<PopularMajorAnswer> {
    // 验证热门专业是否存在
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { id: createDto.popularMajorId },
    });

    if (!popularMajor) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '热门专业不存在',
      });
    }

    // 验证量表是否存在
    const scale = await this.scaleRepository.findOne({
      where: { id: createDto.scaleId },
    });

    if (!scale) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '量表不存在',
      });
    }

    // 检查是否已存在相同的答案（同一用户、同一专业、同一题目）
    const existingAnswer = await this.popularMajorAnswerRepository.findOne({
      where: {
        userId,
        popularMajorId: createDto.popularMajorId,
        scaleId: createDto.scaleId,
      },
    });

    if (existingAnswer) {
      // 如果答案已存在，更新它
      existingAnswer.score = createDto.score;
      existingAnswer.submittedAt = new Date();
      const updatedAnswer = await this.popularMajorAnswerRepository.save(
        existingAnswer,
      );
      return updatedAnswer;
    }

    // 如果答案不存在，创建新的
    const answer = this.popularMajorAnswerRepository.create({
      userId,
      popularMajorId: createDto.popularMajorId,
      scaleId: createDto.scaleId,
      score: createDto.score,
    });

    const savedAnswer = await this.popularMajorAnswerRepository.save(answer);
    return savedAnswer;
  }

  /**
   * 查询热门专业问卷答案
   * @param queryDto 查询条件
   * @param userId 当前登录用户ID（如果查询条件中没有指定userId，则使用当前用户）
   * @returns 分页结果
   */
  async findAnswers(
    queryDto: QueryPopularMajorAnswerDto,
    userId?: number,
  ) {
    const { page = 1, limit = 10, userId: queryUserId, popularMajorId, scaleId } = queryDto;
    const skip = (page - 1) * limit;

    // 构建查询条件
    const where: any = {};

    // 如果查询条件中指定了 userId，使用查询条件中的；否则使用当前登录用户的
    const targetUserId = queryUserId || userId;
    if (targetUserId) {
      where.userId = targetUserId;
    }

    if (popularMajorId) {
      where.popularMajorId = popularMajorId;
    }

    if (scaleId) {
      where.scaleId = scaleId;
    }

    // 执行查询
    const [items, total] = await this.popularMajorAnswerRepository.findAndCount({
      where,
      relations: ['popularMajor', 'scale'],
      order: {
        submittedAt: 'DESC',
      },
      skip,
      take: limit,
    });

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
}

