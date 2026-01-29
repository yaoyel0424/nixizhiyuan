import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, MoreThanOrEqual } from 'typeorm';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { Scale } from '@/entities/scale.entity';
import { User } from '@/entities/user.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { PopularMajor } from '@/entities/popular-major.entity';
import { PopularMajorAnswer } from '@/entities/popular-major-answer.entity';
import { CreateScaleAnswerDto } from './dto/create-scale-answer.dto';
import { ErrorCode } from '../common/constants/error-code.constant';

/**
 * 量表服务
 * 处理量表答案相关的业务逻辑
 */
@Injectable()
export class ScalesService {
  constructor(
    @InjectRepository(ScaleAnswer)
    private readonly scaleAnswerRepository: Repository<ScaleAnswer>,
    @InjectRepository(Scale)
    private readonly scaleRepository: Repository<Scale>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(MajorElementAnalysis)
    private readonly majorElementAnalysisRepository: Repository<MajorElementAnalysis>,
    @InjectRepository(PopularMajor)
    private readonly popularMajorRepository: Repository<PopularMajor>,
    @InjectRepository(PopularMajorAnswer)
    private readonly popularMajorAnswerRepository: Repository<PopularMajorAnswer>,
  ) {}

  /**
   * 创建或更新量表答案
   * @param createDto 创建量表答案 DTO
   * @returns 创建或更新的量表答案
   */
  async create(createDto: CreateScaleAnswerDto): Promise<ScaleAnswer> {
    // 验证用户是否存在
    const user = await this.userRepository.findOne({
      where: { id: createDto.userId },
    });

    if (!user) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '用户不存在',
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

    // 检查是否已存在相同的答案（同一用户同一量表）
    const existingAnswer = await this.scaleAnswerRepository.findOne({
      where: {
        userId: createDto.userId,
        scaleId: createDto.scaleId,
      },
    });

    if (existingAnswer) {
      // 如果答案已存在，更新它
      existingAnswer.score = createDto.score;
      existingAnswer.submittedAt = new Date();
      const updatedAnswer = await this.scaleAnswerRepository.save(existingAnswer);
      return updatedAnswer;
    }

    // 如果答案不存在，创建新的
    const scaleAnswer = this.scaleAnswerRepository.create({
      scaleId: createDto.scaleId,
      userId: createDto.userId,
      score: createDto.score,
    });

    const savedAnswer = await this.scaleAnswerRepository.save(scaleAnswer);

    return savedAnswer;
  }

  /**
   * 删除当前用户在 scale_answers 表中的所有记录
   * @param userId 用户ID
   * @returns 删除的记录数
   */
  async deleteAnswersByUserId(userId: number): Promise<{ deleted: number }> {
    const result = await this.scaleAnswerRepository.delete({ userId });
    return { deleted: result.affected ?? 0 };
  }

  /**
   * 获取所有量表列表及用户答案
   * @param userId 用户ID
   * @returns 包含量表列表和答案列表的对象
   */
  async findAllWithAnswers(userId: number): Promise<{
    scales: Scale[];
    answers: ScaleAnswer[];
  }> {
    // 查询所有量表，包含 options 关系
    const scales = await this.scaleRepository.find({
      relations: ['options'],
      where:{
        direction: '168',
      }
    });

    // 按照指定顺序排序 dimension：'看' | '听' | '说' | '记' | '想' | '做' | '运动'
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const sortedScales = scales.sort((a, b) => {
      const indexA = dimensionOrder.indexOf(a.dimension);
      const indexB = dimensionOrder.indexOf(b.dimension);
      // 如果 dimension 不在预定义列表中，排在最后
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      return finalIndexA - finalIndexB;
    });

    // 对每个 scale 的 options 按照 id 排序
    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });
 

    // 根据用户ID和量表ID列表查询答案
    const answers = await this.scaleAnswerRepository.find({
      where: {
        userId,
        scaleId: MoreThanOrEqual(113)
      },
    });

    return {
      scales: sortedScales,
      answers,
    };
  }

  /**
   * 根据专业详情ID获取对应的量表列表及用户答案
   * @param majorDetailId 专业详情ID
   * @param userId 用户ID
   * @returns 包含量表列表和答案列表的对象
   */
  async findScalesByMajorDetailId(
    majorDetailId: number,
    userId: number,
  ): Promise<{
    scales: Scale[];
    answers: ScaleAnswer[];
  }> {
    // 1. 通过 majorDetailId 查询 MajorElementAnalysis，获取 elementId 列表
    const analyses = await this.majorElementAnalysisRepository.find({
      where: { majorDetailId },
      select: ['elementId'],
    });

    if (!analyses || analyses.length === 0) {
      return {
        scales: [],
        answers: [],
      };
    }

    // 提取 elementId 列表
    const elementIds = analyses.map((analysis) => analysis.elementId);

    // 2. 通过 elementId 列表查询 Scale，条件：direction = '168'
    const scales = await this.scaleRepository.find({
      where: {
        elementId: In(elementIds),
        direction: '168',
      },
      relations: ['options'],
      order: {
        dimension: 'ASC', // 先按 dimension 排序
      },
    });

    // 3. 按照指定顺序排序：先按 dimensionOrder 排序，相同 dimension 的再按 id 排序
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const sortedScales = scales.sort((a, b) => {
      const indexA = dimensionOrder.indexOf(a.dimension);
      const indexB = dimensionOrder.indexOf(b.dimension);
      // 如果 dimension 不在预定义列表中，排在最后
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      
      // 先按 dimension 排序
      if (finalIndexA !== finalIndexB) {
        return finalIndexA - finalIndexB;
      }
      
      // 如果 dimension 相同，再按 id 排序
      return a.id - b.id;
    });

    // 4. 对每个 scale 的 options 按照 id 排序
    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });

    // 5. 提取所有量表的 ID
    const scaleIds = sortedScales.map((scale) => scale.id);

    // 6. 根据用户ID和量表ID列表查询答案（scaleId >= 113）
    const answers = await this.scaleAnswerRepository.find({
      where: {
        userId,
        scaleId: MoreThanOrEqual(113),
      },
    });

    // 7. 过滤答案，只返回与查询到的量表相关的答案
    const filteredAnswers = answers.filter((answer) =>
      scaleIds.includes(answer.scaleId),
    );

    return {
      scales: sortedScales,
      answers: filteredAnswers,
    };
  }

  /**
   * 根据元素ID获取对应的量表列表及用户答案
   * @param elementId 元素ID
   * @param userId 用户ID（从 currentUser 中获取）
   * @returns 包含量表列表和答案列表的对象
   */
  async findScalesByElementId(
    elementId: number,
    userId: number,
  ): Promise<{
    scales: Scale[];
    answers: ScaleAnswer[];
  }> {
    // 1. 通过 elementId 查询 Scale，条件：direction = '168'
    const scales = await this.scaleRepository.find({
      where: {
        elementId,
        direction: '168',
      },
      relations: ['options'],
      order: {
        dimension: 'ASC', // 先按 dimension 排序
      },
    });

    // 2. 按照指定顺序排序：'看' | '听' | '说' | '记' | '想' | '做' | '运动'
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const sortedScales = scales.sort((a, b) => {
      const indexA = dimensionOrder.indexOf(a.dimension);
      const indexB = dimensionOrder.indexOf(b.dimension);
      // 如果 dimension 不在预定义列表中，排在最后
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      return finalIndexA - finalIndexB;
    });

    // 3. 对每个 scale 的 options 按照 id 排序
    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });

    // 4. 提取所有量表的 ID
    const scaleIds = sortedScales.map((scale) => scale.id);

    // 5. 根据用户ID和量表ID列表查询答案
    const answers = scaleIds.length > 0
      ? await this.scaleAnswerRepository.find({
          where: {
            userId,
            scaleId: In(scaleIds),
          },
        })
      : [];

    return {
      scales: sortedScales,
      answers,
    };
  }

  /**
   * 根据元素ID和热门专业ID获取对应的量表列表及用户答案（从 popular_major_answers 表查询）
   * @param elementId 元素ID
   * @param popularMajorId 热门专业ID
   * @param userId 用户ID
   * @returns 包含量表列表和答案列表的对象
   */
  async findScalesByElementIdForPopularMajor(
    elementId: number,
    popularMajorId: number,
    userId: number,
  ): Promise<{
    scales: Scale[];
    answers: PopularMajorAnswer[];
  }> {
    // 1. 通过 elementId 查询 Scale，条件：direction = '168'
    const scales = await this.scaleRepository.find({
      where: {
        elementId,
        direction: '168',
      },
      relations: ['options'],
      order: {
        dimension: 'ASC', // 先按 dimension 排序
      },
    });

    // 2. 按照指定顺序排序：'看' | '听' | '说' | '记' | '想' | '做' | '运动'
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const sortedScales = scales.sort((a, b) => {
      const indexA = dimensionOrder.indexOf(a.dimension);
      const indexB = dimensionOrder.indexOf(b.dimension);
      // 如果 dimension 不在预定义列表中，排在最后
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      return finalIndexA - finalIndexB;
    });

    // 3. 对每个 scale 的 options 按照 id 排序
    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });

    // 4. 提取所有量表的 ID
    const scaleIds = sortedScales.map((scale) => scale.id);

    // 5. 从 popular_major_answers 表查询答案（需要指定 popularMajorId）
    const answers = scaleIds.length > 0
      ? await this.popularMajorAnswerRepository.find({
          where: {
            userId,
            popularMajorId,
            scaleId: In(scaleIds),
          },
        })
      : [];

    return {
      scales: sortedScales,
      answers,
    };
  }

  /**
   * 根据热门专业ID获取对应的量表列表及用户答案
   * @param popularMajorId 热门专业ID
   * @param userId 用户ID
   * @returns 包含量表列表和答案列表的对象
   */
  async findScalesByPopularMajorId(
    popularMajorId: number,
    userId: number,
  ): Promise<{
    scales: Scale[];
    answers: PopularMajorAnswer[];
  }> {
    // 1. 通过热门专业ID查询 PopularMajor，获取关联的 majorDetail
    const popularMajor = await this.popularMajorRepository.findOne({
      where: { id: popularMajorId },
      relations: ['majorDetail'],
    });

    if (!popularMajor) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '热门专业不存在',
      });
    }

    if (!popularMajor.majorDetail) {
      return {
        scales: [],
        answers: [],
      };
    }

    // 2. 通过 majorDetailId 查询 MajorElementAnalysis，获取 elementId 列表
    const majorDetailId = popularMajor.majorDetail.id;
    const analyses = await this.majorElementAnalysisRepository.find({
      where: { majorDetailId },
      select: ['elementId'],
    });

    if (!analyses || analyses.length === 0) {
      return {
        scales: [],
        answers: [],
      };
    }

    // 提取 elementId 列表
    const elementIds = analyses.map((analysis) => analysis.elementId);

    // 3. 通过 elementId 列表查询 Scale，条件：direction = '168'
    const scales = await this.scaleRepository.find({
      where: {
        elementId: In(elementIds),
        direction: '168',
      },
      relations: ['options'],
      order: {
        dimension: 'ASC', // 先按 dimension 排序
      },
    });

    // 4. 按照指定顺序排序：先按 dimensionOrder 排序，相同 dimension 的再按 id 排序
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const sortedScales = scales.sort((a, b) => {
      const indexA = dimensionOrder.indexOf(a.dimension);
      const indexB = dimensionOrder.indexOf(b.dimension);
      // 如果 dimension 不在预定义列表中，排在最后
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      
      // 先按 dimension 排序
      if (finalIndexA !== finalIndexB) {
        return finalIndexA - finalIndexB;
      }
      
      // 如果 dimension 相同，再按 id 排序
      return a.id - b.id;
    });

    // 5. 对每个 scale 的 options 按照 id 排序
    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });

    // 6. 提取所有量表的 ID
    const scaleIds = sortedScales.map((scale) => scale.id);

    // 7. 从 popular_major_answers 表查询答案
    const answers = scaleIds.length > 0
      ? await this.popularMajorAnswerRepository.find({
          where: {
            userId,
            popularMajorId,
            scaleId: In(scaleIds),
          },
        })
      : [];

    return {
      scales: sortedScales,
      answers,
    };
  }
}

