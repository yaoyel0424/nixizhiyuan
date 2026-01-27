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
      // 参数保留，暂时不使用
      // page = 1,
      // limit = 10,
      // sortBy = 'id',
      // sortOrder = 'ASC',
      level1,
      // name,
      // code,
    } = queryDto;

    // 只根据 level1 进行查询，直接将 level1 传入 addProgressAndScore
    if (!level1) {
      return {
        items: [],
        meta: {
          total: 0,
          page: 1,
          limit: 0,
          totalPages: 0,
        },
      };
    }

    // 直接调用 addProgressAndScoreByLevel1，在内部一次性查询所有数据
    const result = await this.addProgressAndScoreByLevel1(level1, userId);

    return {
      items: result.items,
      meta: {
        total: result.total,
        page: 1,
        limit: result.total,
        totalPages: 1,
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
    await this.addProgressAndScoreForItems([popularMajor], userId);

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
    await this.addProgressAndScoreForItems([popularMajor], userId);

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
    await this.addProgressAndScoreForItems(popularMajors, userId);

    return popularMajors;
  }

  /**
   * 为热门专业列表添加进度和分数信息（基于传入的 items 列表）
   * @param items 热门专业列表
   * @param userId 用户ID（可选）
   */
  private async addProgressAndScoreForItems(
    items: PopularMajor[],
    userId?: number,
  ): Promise<void> {
    if (!items || items.length === 0) {
      return;
    }

    // 如果没有 userId，只需要映射 name 并返回
    if (!userId) {
      this.mapMajorDetailName(items);
      return;
    }

    // 获取所有专业详情ID和热门专业ID列表
      const majorDetailIds = items
        .map((item) => item.majorDetail?.id)
      .filter((id) => id !== undefined) as number[];

    if (majorDetailIds.length === 0) {
      return;
    }

    const popularMajorIds = items.map((item) => item.id);

    // 构建参数占位符
    const majorDetailPlaceholders = majorDetailIds
      .map((_, index) => `$${index + 1}`)
      .join(', ');
    const popularMajorPlaceholders = popularMajorIds
      .map((_, index) => `$${majorDetailIds.length + 2 + index}`)
      .join(', ');

    // 构建简化的 SQL 查询：只计算进度数据（在一个 SQL 中完成）
    const sql = `
      WITH major_scales AS (
        SELECT 
          mea.major_id as major_detail_id,
          s.id as scale_id
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
      answered_counts AS (
        SELECT 
          md.id as major_detail_id,
          pm.id as popular_major_id,
          COUNT(DISTINCT pma.scale_id) as completed_count
        FROM major_details md
        INNER JOIN popular_majors pm ON pm.code = md.code
        INNER JOIN major_scales ms ON ms.major_detail_id = md.id
        LEFT JOIN popular_major_answers pma ON pma.scale_id = ms.scale_id 
          AND pma.popular_major_id = pm.id
          AND pma.user_id = $${majorDetailIds.length + 1}
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
    ];

    const progressResults = await this.popularMajorRepository.manager.query(
      sql,
      queryParams,
    );

    // 使用公共方法处理进度和分数
    await this.enrichItemsWithProgressAndScore(
      items,
      userId,
      progressResults,
      popularMajorIds,
    );
  }

  /**
   * 为热门专业列表添加进度和分数信息（基于 level1 参数查询）
   * @param level1 教育层次
   * @param userId 用户ID（可选）
   * @returns 热门专业列表和总数
   */
  private async addProgressAndScoreByLevel1(
    level1: string,
    userId?: number,
  ): Promise<{ items: PopularMajor[]; total: number }> {
    // 如果没有 userId，只需要查询 items 并返回
    if (!userId) {
      const items = await this.popularMajorRepository.find({
        where: { level1 },
        relations: [
          'majorDetail',
          'majorDetail.major',
          'majorDetail.majorElementAnalyses',
          'majorDetail.majorElementAnalyses.element',
        ],
        order: {
          id: 'ASC',
        },
      });

      if (!items || items.length === 0) {
        return { items: [], total: 0 };
      }

      this.mapMajorDetailName(items);
      return { items, total: items.length };
    }

    // 在一个 SQL 中查询所有需要的数据：PopularMajor、MajorDetail、Major、MajorElementAnalyses、进度数据
    const sql = `
      WITH filtered_popular_majors AS (
        SELECT id, code, name, degree, limit_year, average_salary
        FROM popular_majors
        WHERE level1 = $1
      ),
      filtered_major_details AS (
        SELECT md.id, md.code, md.education_level, md.study_period, md.awarded_degree, md.major_brief
        FROM major_details md
        INNER JOIN filtered_popular_majors pm ON pm.code = md.code
      ),
      major_scales AS (
        SELECT 
          mea.major_id as major_detail_id,
          s.id as scale_id
        FROM major_element_analysis mea
        INNER JOIN elements e ON e.id = mea.element_id
        INNER JOIN scales s ON s.element_id = e.id
        INNER JOIN filtered_major_details fmd ON fmd.id = mea.major_id
        WHERE s.direction = '168'
          AND s.id > 112
      ),
      scale_counts AS (
        SELECT 
          major_detail_id,
          COUNT(DISTINCT scale_id) as total_count
        FROM major_scales
        GROUP BY major_detail_id
      ),
      answered_counts AS (
        SELECT 
          md.id as major_detail_id,
          pm.id as popular_major_id,
          COUNT(DISTINCT pma.scale_id) as completed_count
        FROM major_details md
        INNER JOIN filtered_popular_majors pm ON pm.code = md.code
        INNER JOIN major_scales ms ON ms.major_detail_id = md.id
        LEFT JOIN popular_major_answers pma ON pma.scale_id = ms.scale_id 
          AND pma.popular_major_id = pm.id
          AND pma.user_id = $2
        GROUP BY md.id, pm.id
      ),
      progress_data AS (
        SELECT 
          sc.major_detail_id,
          COALESCE(sc.total_count, 0) as total_count,
          COALESCE(ac.completed_count, 0) as completed_count,
          ac.popular_major_id
        FROM scale_counts sc
        LEFT JOIN answered_counts ac ON ac.major_detail_id = sc.major_detail_id
      ),
      element_scores AS (
        SELECT 
          pm.id as popular_major_id,
          mea.element_id,
          Sum(pma.score) as element_score
        FROM filtered_popular_majors pm
        INNER JOIN major_details md ON md.code = pm.code
        INNER JOIN major_element_analysis mea ON mea.major_id = md.id
        INNER JOIN elements e ON e.id = mea.element_id
        INNER JOIN scales s ON s.element_id = e.id
        LEFT JOIN popular_major_answers pma ON pma.scale_id = s.id 
          AND pma.popular_major_id = pm.id
          AND pma.user_id = $2
        WHERE s.direction = '168'
          AND s.id > 112
          AND pma.score IS NOT NULL
        GROUP BY pm.id, mea.element_id
      )
      SELECT 
        pm.id as popular_major_id,
        pm.name,
        pm.code, 
        md.id as major_detail_id,
        md.code as major_detail_code,
        md.education_level,
        md.study_period,
        md.awarded_degree,
        md.major_brief,
        m.id as major_id,
        m.name as major_name,
        mea.id as element_analysis_id,
        mea.type as element_analysis_type,
        mea.element_id,
        e.name as element_name,
        pd.total_count,
        pd.completed_count,
        es.element_score
      FROM filtered_popular_majors pm
      LEFT JOIN major_details md ON md.code = pm.code
      LEFT JOIN majors m ON m.code = md.code
      LEFT JOIN major_element_analysis mea ON mea.major_id = md.id
      LEFT JOIN elements e ON e.id = mea.element_id
      LEFT JOIN progress_data pd ON pd.popular_major_id = pm.id
      LEFT JOIN element_scores es ON es.popular_major_id = pm.id AND es.element_id = mea.element_id
      ORDER BY pm.id ASC, mea.id ASC
    `;

    const results = await this.popularMajorRepository.manager.query(
      sql,
      [level1, userId],
    );

    if (results.length === 0) {
      return { items: [], total: 0 };
    }

    // 按 popularMajorId 分组构建 items
    const itemsMap = new Map<number, any>();
    const popularMajorIds: number[] = [];

    results.forEach((row: any) => {
      const popularMajorId = row.popular_major_id;
      
      if (!itemsMap.has(popularMajorId)) {
        // 创建 PopularMajor 对象
        const item: any = {
          id: row.popular_major_id,
          name: row.name,
          code: row.code,
          degree: row.degree,
          limitYear: row.limit_year,
          averageSalary: row.average_salary,
          majorDetail: row.major_detail_id ? {
            id: row.major_id,
            code: row.major_detail_code,
            educationLevel: row.education_level,
            studyPeriod: row.study_period,
            awardedDegree: row.awarded_degree,
            majorBrief: row.major_brief,
            name: row.major_name, // 映射 major.name 到 majorDetail.name
            major: row.major_name ? { name: row.major_name } : null,
            majorElementAnalyses: [],
          } : null,
        };
        itemsMap.set(popularMajorId, item);
        popularMajorIds.push(popularMajorId);
      }

      // 添加 majorElementAnalyses（如果有）
      const item = itemsMap.get(popularMajorId);
      if (item.majorDetail && row.element_analysis_id) {
        const existing = item.majorDetail.majorElementAnalyses.find(
          (ea: any) => ea.id === row.element_analysis_id,
        );
        if (!existing) {
          item.majorDetail.majorElementAnalyses.push({
            id: row.element_analysis_id,
            type: row.element_analysis_type,
            elementId: row.element_id,
            element: row.element_name ? { name: row.element_name } : null,
            elementScore:
              row.element_score !== null && row.element_score !== undefined
                ? parseFloat(row.element_score)
                : null,
          });
        }
      }
    });

    const items = Array.from(itemsMap.values()) as PopularMajor[];

    // 构建进度映射
          const majorScaleCountMap = new Map<number, number>();
    const majorAnsweredCountMap = new Map<number, number>();

    results.forEach((row: any) => {
      if (row.major_detail_id) {
        majorScaleCountMap.set(row.major_detail_id, row.total_count || 0);
        if (row.popular_major_id) {
          majorAnsweredCountMap.set(row.major_detail_id, row.completed_count || 0);
        }
      }
    });

    // 获取分数
    const scores = await this.scoresService.calculatePopularMajorScores(
      userId,
      popularMajorIds,
    );

    const scoreMap = new Map<number, any>();
    scores.forEach((score) => {
      if (score.popularMajorId) {
        scoreMap.set(score.popularMajorId, score);
      }
    });

    // 添加进度、分数和 elementAnalyses 分组
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

        (item as any).score = scoreInfo ? {
          score: scoreInfo.score,
          lexueScore: scoreInfo.lexueScore,
          shanxueScore: scoreInfo.shanxueScore,
          yanxueDeduction: scoreInfo.yanxueDeduction,
          tiaozhanDeduction: scoreInfo.tiaozhanDeduction,
        } : null;
      }

      // 处理 elementAnalyses 分组（包含元素分数）
      if (item.majorDetail?.majorElementAnalyses?.length > 0) {
        const groupedByType = new Map<
          string,
          Array<{ elementName: string; score: number | null }>
        >();
        item.majorDetail.majorElementAnalyses.forEach((analysis: any) => {
          if (analysis.element?.name) {
            const type = analysis.type;
            if (!groupedByType.has(type)) {
              groupedByType.set(type, []);
            }
            groupedByType.get(type)!.push({
              elementName: analysis.element.name,
              score: analysis.elementScore ?? null,
            });
          }
        });
        (item as any).elementAnalyses = Array.from(groupedByType.entries()).map(
          ([type, elements]) => ({
            type,
            elements: elements,
          }),
        );
      }
    });

    return { items, total: items.length };
  }

  /**
   * 将进度和分数信息添加到热门专业列表（公共方法）
   * @param items 热门专业列表
   * @param userId 用户ID
   * @param progressResults SQL 查询结果
   * @param popularMajorIds 热门专业ID列表
   */
  private async enrichItemsWithProgressAndScore(
    items: PopularMajor[],
    userId: number,
    progressResults: any[],
    popularMajorIds: number[],
  ): Promise<void> {
    // 构建进度映射
    const majorScaleCountMap = new Map<number, number>();
          const majorAnsweredCountMap = new Map<number, number>();

    // 从 SQL 查询结果中提取进度数据
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

    // 查询元素分数
    const elementScoresSql = `
      SELECT 
        pm.id as popular_major_id,
        mea.element_id,
        AVG(pma.score) as element_score
      FROM popular_majors pm
      INNER JOIN major_details md ON md.code = pm.code
      INNER JOIN major_element_analysis mea ON mea.major_id = md.id
      INNER JOIN elements e ON e.id = mea.element_id
      INNER JOIN scales s ON s.element_id = e.id
      LEFT JOIN popular_major_answers pma ON pma.scale_id = s.id 
        AND pma.popular_major_id = pm.id
        AND pma.user_id = $1
      WHERE s.direction = '168'
        AND s.id > 112
        AND pma.score IS NOT NULL
        AND pm.id = ANY($2::int[])
      GROUP BY pm.id, mea.element_id
    `;
    const elementScoresResults = await this.popularMajorRepository.manager.query(
      elementScoresSql,
      [userId, popularMajorIds],
    );

    // 构建元素分数映射：popularMajorId -> elementId -> score
    const elementScoreMap = new Map<number, Map<number, number>>();
    elementScoresResults.forEach((row: any) => {
      if (!elementScoreMap.has(row.popular_major_id)) {
        elementScoreMap.set(row.popular_major_id, new Map());
      }
      elementScoreMap
        .get(row.popular_major_id)!
        .set(
          row.element_id,
          row.element_score !== null && row.element_score !== undefined
            ? parseFloat(row.element_score)
            : null,
            );
          });

    // 获取每个热门专业的分数（直接调用，内部会处理所有计算）
    const scores = await this.scoresService.calculatePopularMajorScores(
                userId,
      popularMajorIds,
              );

    // 使用 popularMajorId 作为 key 创建分数映射
    const scoreMap = new Map<number, any>();
              scores.forEach((score) => {
      if (score.popularMajorId) {
        scoreMap.set(score.popularMajorId, score);
      }
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

      // 为 majorElementAnalyses 添加元素分数
      if (item.majorDetail?.majorElementAnalyses) {
        const itemElementScoreMap = elementScoreMap.get(item.id);
        item.majorDetail.majorElementAnalyses.forEach((analysis: any) => {
          if (analysis.elementId && itemElementScoreMap) {
            (analysis as any).elementScore =
              itemElementScoreMap.get(analysis.elementId) ?? null;
          } else {
            (analysis as any).elementScore = null;
          }
        });
      }
    });

    // 将 majorDetail.major.name 映射到 majorDetail.name，以便 DTO 正确序列化
    // 同时处理元素分析信息，按 type 分组
    this.mapMajorDetailNameAndElementAnalyses(items);
  }

  /**
   * 映射 majorDetail.major.name 到 majorDetail.name，并处理元素分析信息
   * @param items 热门专业列表
   */
  private mapMajorDetailNameAndElementAnalyses(items: PopularMajor[]): void {
    items.forEach((item) => {
      if (item.majorDetail?.major?.name) {
        (item.majorDetail as any).name = item.majorDetail.major.name;
      }

      // 处理元素分析信息，按 type 分组（包含元素分数）
      if (item.majorDetail?.majorElementAnalyses) {
        const groupedByType = new Map<
          string,
          Array<{ elementName: string; score: number | null }>
        >();
        item.majorDetail.majorElementAnalyses.forEach((analysis: any) => {
          if (analysis.element?.name) {
            const type = analysis.type;
            if (!groupedByType.has(type)) {
              groupedByType.set(type, []);
            }
            groupedByType.get(type)!.push({
              elementName: analysis.element.name,
              score: analysis.elementScore ?? null,
            });
          }
        });

        // 转换为数组格式
        (item as any).elementAnalyses = Array.from(groupedByType.entries()).map(
          ([type, elements]) => ({
            type,
            elements: elements,
          }),
        );
      }
    });
  }

  /**
   * 映射 majorDetail.major.name 到 majorDetail.name（简单版本，不处理元素分析）
   * @param items 热门专业列表
   */
  private mapMajorDetailName(items: PopularMajor[]): void {
    items.forEach((item) => {
      if (item.majorDetail?.major?.name) {
        (item.majorDetail as any).name = item.majorDetail.major.name;
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

    // 如果查询条件中指定了 userId，使用查询条件中的；否则使用当前登录用户的
    const targetUserId = queryUserId || userId;

    // 构建查询条件对象（用于 count）
    const where: any = {};
    if (targetUserId) {
      where.userId = targetUserId;
    }
    if (popularMajorId) {
      where.popularMajorId = popularMajorId;
    }
    if (scaleId) {
      where.scaleId = scaleId;
    }

    // 先查询总数
    const total = await this.popularMajorAnswerRepository.count({ where });

    // 查询数据（使用 QueryBuilder 以支持排序）
    const queryBuilder = this.popularMajorAnswerRepository
      .createQueryBuilder('answer')
      .leftJoinAndSelect('answer.popularMajor', 'popularMajor')
      .leftJoinAndSelect('answer.scale', 'scale');

    if (targetUserId) {
      queryBuilder.andWhere('answer.user_id = :userId', { userId: targetUserId });
    }
    if (popularMajorId) {
      queryBuilder.andWhere('answer.popular_major_id = :popularMajorId', {
        popularMajorId,
      });
    }
    if (scaleId) {
      queryBuilder.andWhere('answer.scale_id = :scaleId', { scaleId });
    }

    // 使用实体属性名排序（TypeORM 会自动转换为数据库列名）
    const items = await queryBuilder
      .orderBy('answer.submittedAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getMany();

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

