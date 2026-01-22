import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { MajorFavorite } from '@/entities/major-favorite.entity';
import { Major } from '@/entities/major.entity';
import { MajorDetail } from '@/entities/major-detail.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Element } from '@/entities/element.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { User } from '@/entities/user.entity';
import { SchoolMajor } from '@/entities/school-major.entity';
import { ScoresService } from '@/scores/scores.service';
import { CreateMajorFavoriteDto } from './dto/create-major-favorite.dto';
import { QueryMajorFavoriteDto } from './dto/query-major-favorite.dto';
import { ErrorCode } from '../common/constants/error-code.constant';
import { IPaginationResponse } from '../common/interfaces/response.interface';

/**
 * 专业收藏服务
 * 处理专业收藏相关的业务逻辑
 */
@Injectable()
export class MajorsService {
  private readonly logger = new Logger(MajorsService.name);

  constructor(
    @InjectRepository(MajorFavorite)
    private readonly majorFavoriteRepository: Repository<MajorFavorite>,
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
    @InjectRepository(MajorDetail)
    private readonly majorDetailRepository: Repository<MajorDetail>,
    @InjectRepository(MajorElementAnalysis)
    private readonly majorElementAnalysisRepository: Repository<MajorElementAnalysis>,
    @InjectRepository(Element)
    private readonly elementRepository: Repository<Element>,
    @InjectRepository(Scale)
    private readonly scaleRepository: Repository<Scale>,
    @InjectRepository(ScaleAnswer)
    private readonly scaleAnswerRepository: Repository<ScaleAnswer>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(SchoolMajor)
    private readonly schoolMajorRepository: Repository<SchoolMajor>,
    private readonly scoresService: ScoresService,
  ) {}

  /**
   * 收藏专业
   * @param userId 用户ID
   * @param createDto 创建收藏DTO
   * @returns 收藏记录
   */
  async createFavorite(
    userId: number,
    createDto: CreateMajorFavoriteDto,
  ): Promise<MajorFavorite> {
    // 检查专业是否存在
    const major = await this.majorRepository.findOne({
      where: { code: createDto.majorCode },
    });

    if (!major) {
      this.logger.warn(
        `专业不存在: ${createDto.majorCode}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '专业不存在',
      });
    }

    // 检查是否已经收藏
    const existingFavorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode: createDto.majorCode,
      },
    });

    if (existingFavorite) {
      this.logger.warn(
        `专业已收藏: ${createDto.majorCode}, 用户ID: ${userId}`,
      );
      throw new ConflictException({
        code: ErrorCode.OPERATION_FAILED,
        message: '该专业已收藏',
      });
    }

    // 创建收藏记录
    const favorite = this.majorFavoriteRepository.create({
      userId,
      majorCode: createDto.majorCode,
    });

    const savedFavorite = await this.majorFavoriteRepository.save(favorite);
    this.logger.log(
      `用户 ${userId} 收藏专业 ${createDto.majorCode} 成功`,
    );

    return savedFavorite;
  }

  /**
   * 取消收藏专业
   * @param userId 用户ID
   * @param majorCode 专业代码
   * @returns void
   */
  async removeFavorite(userId: number, majorCode: string): Promise<void> {
    // 查找收藏记录
    const favorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode,
      },
    });

    if (!favorite) {
      this.logger.warn(
        `收藏记录不存在: ${majorCode}, 用户ID: ${userId}`,
      );
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '收藏记录不存在',
      });
    }

    // 删除收藏记录
    await this.majorFavoriteRepository.remove(favorite);
    this.logger.log(`用户 ${userId} 取消收藏专业 ${majorCode} 成功`);
  }

  /**
   * 查询用户的收藏列表（分页）
   * 包含用户信息和每个收藏专业的匹配分数
   * @param userId 用户ID
   * @param queryDto 查询条件
   * @returns 分页的收藏列表，包含用户信息和专业分数
   */
  async findFavorites(
    userId: number,
    queryDto: QueryMajorFavoriteDto,
  ): Promise<{
    user: User;
    items: Array<MajorFavorite & { major?: Major; score?: number; lexueScore?: number; shanxueScore?: number; yanxueDeduction?: number; tiaozhanDeduction?: number }>;
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const { page = 1, limit = 1000 } = queryDto;
    const skip = (page - 1) * limit;

    // 获取用户信息
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      this.logger.warn(`用户不存在: ${userId}`);
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '用户不存在',
      });
    }

    // 查询收藏列表（包含专业信息和专业详情）
    const [favorites, total] = await this.majorFavoriteRepository.findAndCount({
      where: { userId },
      relations: ['major', 'major.majorDetail'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    // 获取所有收藏专业的代码
    const majorCodes = favorites
      .map((favorite) => favorite.majorCode)
      .filter((code) => code);

    // 如果有关收藏的专业，计算每个专业的匹配分数
    let scoresMap = new Map<string, {
      score: number;
      lexueScore: number;
      shanxueScore: number;
      yanxueDeduction: number;
      tiaozhanDeduction: number;
    }>();

    if (majorCodes.length > 0) {
      try {
        // 批量计算所有收藏专业的分数
        const scores = await this.scoresService.calculateScores(
          userId,
          undefined, // 不限制教育层次
          majorCodes,
        );

        // 创建专业代码到分数的映射
        scores.forEach((scoreInfo) => {
          scoresMap.set(scoreInfo.majorCode, {
            score: scoreInfo.score,
            lexueScore: scoreInfo.lexueScore,
            shanxueScore: scoreInfo.shanxueScore,
            yanxueDeduction: scoreInfo.yanxueDeduction,
            tiaozhanDeduction: scoreInfo.tiaozhanDeduction,
          });
        });
      } catch (error) {
        this.logger.warn(
          `计算专业分数失败，用户ID: ${userId}, 错误: ${error.message}`,
        );
        // 分数计算失败不影响返回收藏列表，只是没有分数信息
      }
    }

    // 为每个收藏记录添加分数信息
    const itemsWithScores = favorites
      .map((favorite) => {
        const scoreInfo = scoresMap.get(favorite.majorCode);
        return {
          ...favorite,
          score: scoreInfo?.score,
          lexueScore: scoreInfo?.lexueScore,
          shanxueScore: scoreInfo?.shanxueScore,
          yanxueDeduction: scoreInfo?.yanxueDeduction,
          tiaozhanDeduction: scoreInfo?.tiaozhanDeduction,
        };
      })
      .sort((a, b) => {
        // 按照 score 倒序排列（score 高的在前）
        // 如果 score 为 null 或 undefined，排在后面
        const scoreA = a.score ?? -Infinity;
        const scoreB = b.score ?? -Infinity;
        return scoreB - scoreA;
      });

    // 计算总页数
    const totalPages = Math.ceil(total / limit);

    this.logger.log(
      `查询用户 ${userId} 的收藏列表，共 ${total} 条记录，当前第 ${page} 页`,
    );

    return {
      user,
      items: itemsWithScores,
      meta: {
        total,
        page,
        limit,
        totalPages,
      },
    };
  }

  /**
   * 检查用户是否已收藏某个专业
   * @param userId 用户ID
   * @param majorCode 专业代码
   * @returns 是否已收藏
   */
  async isFavorite(userId: number, majorCode: string): Promise<boolean> {
    const favorite = await this.majorFavoriteRepository.findOne({
      where: {
        userId,
        majorCode,
      },
    });

    return !!favorite;
  }

  /**
   * 获取用户的收藏数量
   * @param userId 用户ID
   * @returns 收藏数量
   */
  async getFavoriteCount(userId: number): Promise<number> {
    return await this.majorFavoriteRepository.count({
      where: { userId },
    });
  }

  /**
   * 通过专业代码获取专业详细信息
   * @param majorCode 专业代码
   * @param userId 用户ID（可选，用于计算用户分数）
   * @returns 专业详情信息，包含分析信息和用户分数
   */
  async getMajorDetailByCode(
    majorCode: string,
    userId?: number,
  ): Promise<MajorDetail & { analyses: any[]; name?: string }> {
    // 查找专业详情，同时加载关联的 major 信息
    const majorDetail = await this.majorDetailRepository.findOne({
      where: { code: majorCode },
      relations: ['major'],
    });

    if (!majorDetail) {
      this.logger.warn(`专业详情不存在: ${majorCode}`);
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '专业详情不存在',
      });
    }

    // 查找专业元素分析记录（包含元素信息）
    const analyses = await this.majorElementAnalysisRepository.find({
      where: { majorDetailId: majorDetail.id },
      relations: ['element'],
      order: { type: 'ASC', id: 'ASC' },
    });

    // 如果提供了用户ID，计算用户对每个元素的分数
    if (userId) {
      // 获取所有相关的元素ID
      const elementIds = analyses.map((analysis) => analysis.elementId);

      if (elementIds.length > 0) {
        // 使用一条 SQL 查询一次性获取所有元素的分数总和
        const elementScores = await this.elementRepository
          .createQueryBuilder('element')
          .innerJoin(
            'scales',
            'scale',
            'scale.element_id = element.id',
          )
          .innerJoin(
            'scale_answers',
            'answer',
            'answer.scale_id = scale.id AND answer.user_id = :userId',
            { userId },
          )
          .select('element.id', 'elementId')
          .addSelect('SUM(answer.score)', 'totalScore')
          .where('element.id IN (:...elementIds)', { elementIds })
          .groupBy('element.id')
          .getRawMany();

        // 创建 elementId -> totalScore 的映射
        const elementScoreMap = new Map<number, number>();
        elementScores.forEach((item) => {
          elementScoreMap.set(
            item.elementId,
            Number(Number(item.totalScore).toFixed(2)),
          );
        });

        // 为每个分析记录设置用户分数
        for (const analysis of analyses) {
          const totalScore = elementScoreMap.get(analysis.elementId);
          if (totalScore !== undefined) {
            (analysis as any).userElementScore = totalScore;
          }
        }
      }
    }

    return {
      ...majorDetail,
      // 从关联的 major 实体中获取 name
      name: majorDetail.major?.name || null,
      analyses: analyses.map((analysis) => ({
        id: analysis.id,
        type: analysis.type,
        weight: analysis.weight,
        element: analysis.element
          ? {
              id: analysis.element.id,
              name: analysis.element.name,
              type: analysis.element.type,
              dimension: analysis.element.dimension,
              ownedNaturalState: analysis.element.ownedNaturalState,
              unownedNaturalState: analysis.element.unownedNaturalState,
            }
          : null,
        summary: analysis.summary,
        matchReason: analysis.matchReason,
        theoryBasis: analysis.theoryBasis,
        potentialConversionReason: analysis.potentialConversionReason,
        potentialConversionValue: analysis.potentialConversionValue,
        userElementScore: (analysis as any).userElementScore,
      })),
    };
  }

  /**
   * 通过学校代码查询学校专业，并返回专业分数
   * @param userId 用户ID
   * @param schoolCode 学校代码
   * @returns 专业分数列表
   */
  async getSchoolMajorsWithScores(
    userId: number,
    schoolCode: string,
  ): Promise<
    Array<{
      majorCode: string;
      majorName: string;
      majorBrief: string | null;
      eduLevel: string;
      yanxueDeduction: number;
      tiaozhanDeduction: number;
      score: number;
      lexueScore: number;
      shanxueScore: number;
    }>
  > {

    // 通过学校代码查询学校专业记录
    const schoolMajors = await this.schoolMajorRepository.find({
      where: { schoolCode },
      relations: ['majorDetail', 'majorDetail.major'],
    });

    if (schoolMajors.length === 0) {
      this.logger.warn(
        `未找到学校专业记录，schoolCode: ${schoolCode}`,
      );
      return [];
    }

    // 获取所有专业代码
    const foundMajorCodes = schoolMajors.map((sm) => sm.majorCode);

    // 调用分数服务计算专业分数
    const scores = await this.scoresService.calculateScores(
      userId,
      undefined, // 不限制教育层次
      foundMajorCodes,
    );

    // 创建专业代码到专业详情的映射
    const majorDetailMap = new Map<string, { name: string; brief: string | null; eduLevel: string }>();
    schoolMajors.forEach((sm) => {
      if (sm.majorDetail) {
        majorDetailMap.set(sm.majorCode, {
          name: sm.majorName || sm.majorDetail.major?.name || '未知专业',
          brief: sm.majorDetail.majorBrief || null,
          eduLevel: sm.majorDetail.major?.eduLevel || '未知',
        });
      }
    });

    // 合并分数和专业信息
    const result = scores.map((score) => {
      const majorInfo = majorDetailMap.get(score.majorCode);
      return {
        majorCode: score.majorCode,
        majorName: majorInfo?.name || score.majorName,
        majorBrief: majorInfo?.brief || score.majorBrief,
        eduLevel: majorInfo?.eduLevel || score.eduLevel,
        yanxueDeduction: score.yanxueDeduction,
        tiaozhanDeduction: score.tiaozhanDeduction,
        score: score.score,
        lexueScore: score.lexueScore,
        shanxueScore: score.shanxueScore,
      };
    });

    this.logger.log(
      `通过学校代码 ${schoolCode} 查询专业分数，共 ${result.length} 个专业`,
    );

    return result;
  }
}

