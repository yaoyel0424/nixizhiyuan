import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository, In, MoreThan, MoreThanOrEqual } from 'typeorm';
import { ScaleAnswer } from '@/entities/scale-answer.entity';
import { Scale } from '@/entities/scale.entity';
import { User } from '@/entities/user.entity';
import { Snapshot } from '@/entities/snapshot.entity';
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
    @InjectRepository(Snapshot)
    private readonly snapshotRepository: Repository<Snapshot>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建或更新量表答案（同一用户同一量表仅一条，在事务内加锁保证并发安全）
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

    return this.dataSource.transaction(async (manager) => {
      const answerRepo = manager.getRepository(ScaleAnswer);
      // 加行锁，避免同一 (userId, scaleId) 并发创建重复记录
      const existingAnswer = await answerRepo.findOne({
        where: {
          userId: createDto.userId,
          scaleId: createDto.scaleId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existingAnswer) {
        existingAnswer.score = createDto.score;
        existingAnswer.submittedAt = new Date();
        return answerRepo.save(existingAnswer);
      }

      const scaleAnswer = answerRepo.create({
        scaleId: createDto.scaleId,
        userId: createDto.userId,
        score: createDto.score,
      });
      return answerRepo.save(scaleAnswer);
    });
  }

  /**
   * 删除当前用户在 scale_answers 表中的所有记录。
   * 删除前若用户已完成全部 168 量表，则先将旧答案写入快照再删除。
   * @param userId 用户ID
   * @returns 删除的记录数、是否已做快照，以及快照信息（当已做快照时）
   */
  async deleteAnswersByUserId(userId: number): Promise<{
    deleted: number;
    snapshotted: boolean;
    snapshot?: { version: string; createdAt: Date; payload: { answers: Array<{ scaleId: number; score: number; submittedAt: string | null }>; savedAt: string } };
  }> {
    // 快照（若需要）与删除在同一事务中完成，保证要么都成功要么都回滚
    return this.dataSource.transaction(async (manager) => {
      const answerRepo = manager.getRepository(ScaleAnswer);
      const snapshotRepo = manager.getRepository(Snapshot);
      // 直接查询当前用户 scaleId > 112 的答案（168 问卷）；若数量为 168 则视为已做完，删除前做快照
      const answers168 = await answerRepo.find({
        where: { userId, scaleId: MoreThan(112) },
        select: ['id', 'scaleId', 'userId', 'score', 'submittedAt'],
        order: { scaleId: 'ASC' },
      });
      if (answers168.length < 168) {
        throw new BadRequestException('请完成问卷后再重新作答');
      }
      const needSnapshot = answers168.length >= 168;
      let snapshotReturn: { version: string; createdAt: Date; payload: { answers: Array<{ scaleId: number; score: number; submittedAt: string | null }>; savedAt: string } } | undefined;

      if (needSnapshot) {
        const payload = {
          answers: answers168.map((a) => ({
            scaleId: a.scaleId,
            score: a.score,
            submittedAt: a.submittedAt?.toISOString?.() ?? null,
          })),
          savedAt: new Date().toISOString(),
        };
        const existing = await snapshotRepo.find({
          where: { userId, type: 'scale_answers' },
          select: ['version'],
        });
        const maxVer = existing.reduce((max, row) => {
          const n = parseInt(row.version, 10);
          return Number.isNaN(n) ? max : Math.max(max, n);
        }, 0);
        const nextVersion = String(maxVer + 1);
        const saved = await snapshotRepo.save(
          snapshotRepo.create({
            userId,
            type: 'scale_answers',
            version: nextVersion,
            payload: JSON.stringify(payload),
          }),
        );
        snapshotReturn = {
          version: saved.version,
          createdAt: saved.createdAt,
          payload,
        };
      }

      const result = await answerRepo.delete({ userId, scaleId: MoreThan(112) });
      return {
        deleted: result.affected ?? 0,
        snapshotted: needSnapshot,
        ...(snapshotReturn && { snapshot: snapshotReturn }),
      };
    });
  }

  /**
   * 获取所有量表列表及用户答案
   * @param userId 用户ID
   * @param repeat 是否重新作答场景；为 true 时取快照中 version 最大的版本与现有答案合并，并返回该快照信息
   * @returns 包含量表列表、答案列表，以及 repeat 时的快照（可选）
   */
  async findAllWithAnswers(userId: number, repeat = false): Promise<{
    scales: Scale[];
    answers: ScaleAnswer[];
    snapshot?: { version: string; createdAt: Date; payload: { answers: Array<{ scaleId: number; score: number; }>; savedAt: string } };
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
      const finalIndexA = indexA === -1 ? dimensionOrder.length : indexA;
      const finalIndexB = indexB === -1 ? dimensionOrder.length : indexB;
      return finalIndexA - finalIndexB;
    });

    sortedScales.forEach((scale) => {
      if (scale.options && scale.options.length > 0) {
        scale.options.sort((a, b) => a.id - b.id);
      }
    });

    // 当前用户 scaleId >= 113 的答案
    const currentAnswers = await this.scaleAnswerRepository.find({
      where: {
        userId,
        scaleId: MoreThanOrEqual(113),
      },
    });

    if (!repeat) {
      return { scales: sortedScales, answers: currentAnswers };
    }

    // repeat 为 true：取 version 最大的快照，与现有答案合并，并返回快照
    const snapshots = await this.snapshotRepository.find({
      where: { userId, type: 'scale_answers' },
      select: ['id', 'version', 'payload', 'createdAt'],
      order: { createdAt: 'DESC' },
    });
    const latest = snapshots.length === 0
      ? null
      : snapshots.reduce((a, b) => (parseInt(a.version, 10) > parseInt(b.version, 10) ? a : b));

    if (!latest) {
      return { scales: sortedScales, answers: currentAnswers };
    }

    let payload: { answers: Array<{ scaleId: number; score: number; submittedAt: string | null }>; savedAt: string };
    try {
      payload = JSON.parse(latest.payload) as typeof payload;
    } catch {
      return { scales: sortedScales, answers: currentAnswers };
    }

    // snapshot.payload.answers 约定为第一次作答快照，供前端标注「第一次」选项；顶层 answers 为当前库中答案
    const snapshotAnswers = payload.answers ?? [];

    return {
      scales: sortedScales,
      answers: currentAnswers,
      snapshot: {
        version: latest.version,
        createdAt: latest.createdAt,
        payload: {
          answers: snapshotAnswers,
          savedAt: payload.savedAt,
        },
      },
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
   * 根据元素ID和热门专业ID获取对应的量表列表及用户答案（从 scale_answers 表查询）
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

    // 5. 从 scale_answers 表查询答案（按 userId、scaleId 查询）
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
    answers: ScaleAnswer[];
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

    // 7. 从 scale_answers 表查询答案（按 userId、scaleId 查询）
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
}

