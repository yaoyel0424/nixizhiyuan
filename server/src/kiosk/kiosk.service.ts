import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import { Major } from '@/entities/major.entity';
import { MajorDetail } from '@/entities/major-detail.entity';
import { AnonymousUser } from '@/entities/anonymous-user.entity';
import { AnonymousScaleAnswer } from '@/entities/anonymous-scale-answer.entity';
import { MajorElementAnalysis } from '@/entities/major-analysis.entity';
import { Scale } from '@/entities/scale.entity';
import { ScaleOption } from '@/entities/scale-option.entity';
import { CreateAnonymousScaleAnswerDto } from './dto/create-anonymous-scale-answer.dto';
import { ErrorCode } from '@/common/constants/error-code.constant';

/**
 * 量表选项（自助终端展示）
 */
export interface KioskScaleOptionPayload {
  id: number;
  scaleId: number;
  optionName: string;
  optionValue: number;
  displayOrder: number | null;
  additionalInfo: string | null;
}

/**
 * 量表及选项（不含答题等敏感关联）
 */
export interface KioskScalePayload {
  id: number;
  content: string;
  elementId: number;
  type: 'like' | 'talent';
  direction: string;
  dimension: string;
  action: string;
  options: KioskScaleOptionPayload[];
}

/**
 * 单条专业元素分析及其对应元素下的全部量表
 */
export interface KioskMajorAnalysisScaleItem {
  analysisId: number;
  majorDetailId: number;
  type: 'lexue' | 'shanxue';
  elementId: number;
  weight: number;
  summary: string | null;
  scales: KioskScalePayload[];
}

/**
 * 按专业代码查询：专业详情 → 元素分析 → 元素 → 量表与选项
 */
export interface KioskMajorAnalysisScalesResponse {
  majorCode: string;
  majorDetailId: number;
  analyses: KioskMajorAnalysisScaleItem[];
}

/**
 * 自助终端返回的专业树节点（对外 id 为 major_details.id，非 majors.id）
 */
export interface KioskMajorTreeNode {
  /** 专业详情 ID（与 major.majorDetail.id / major_details.id 一致）；无关联详情时为 null */
  id: number | null;
  /** 专业名称 */
  name: string;
  /** 专业代码 */
  code: string;
  /** 教育层次（如 ben、zhuan） */
  eduLevel: string;
  /** 站点分配代码 */
  siteAllocationCode: string | null;
  /** 层级：1 学科门类，2 专业类，3 具体专业 */
  level: 1 | 2 | 3;
  /** 子节点：level1 的子为 level2，level2 的子为 level3 */
  children: KioskMajorTreeNode[];
}

/**
 * 单个教育层次下的专业三级树
 */
export interface KioskMajorTreeByEduLevelGroup {
  /** 教育层次，与 majors.edu_level 一致 */
  eduLevel: string;
  /** 该层次下的三级分类树根列表 */
  tree: KioskMajorTreeNode[];
}

/**
 * 按教育层次分组的专业分类树（无需请求参数 edu_level）
 */
export interface KioskMajorTreeGroupedResponse {
  /** 按 edu_level 分组，组内结构与原先单层次接口一致 */
  groups: KioskMajorTreeByEduLevelGroup[];
}

/**
 * 创建匿名用户后的响应（客户端保存 id 用于后续匿名答题等）
 */
export interface KioskAnonymousUserCreatedResponse {
  /** anonymous_users.id */
  id: number;
}

/**
 * 自助终端业务：专业分类树
 */
@Injectable()
export class KioskService {
  constructor(
    @InjectRepository(Major)
    private readonly majorRepository: Repository<Major>,
    @InjectRepository(MajorDetail)
    private readonly majorDetailRepository: Repository<MajorDetail>,
    @InjectRepository(AnonymousUser)
    private readonly anonymousUserRepository: Repository<AnonymousUser>,
    @InjectRepository(AnonymousScaleAnswer)
    private readonly anonymousScaleAnswerRepository: Repository<AnonymousScaleAnswer>,
    @InjectRepository(Scale)
    private readonly scaleRepository: Repository<Scale>,
    @InjectDataSource()
    private readonly dataSource: DataSource,
  ) {}

  /**
   * 创建一条匿名用户记录（无登录态），供自助终端量表等场景关联 anonymous_user_id
   */
  async createAnonymousUser(): Promise<KioskAnonymousUserCreatedResponse> {
    const row = this.anonymousUserRepository.create({});
    const saved = await this.anonymousUserRepository.save(row);
    return { id: saved.id };
  }

  /**
   * 创建或更新匿名量表答案（同一匿名用户同一量表仅一条；事务内悲观锁，与 ScalesService.create 一致）
   *
   * @param createDto 匿名用户 id、量表 id、得分
   */
  async createAnonymousScaleAnswer(
    createDto: CreateAnonymousScaleAnswerDto,
  ): Promise<AnonymousScaleAnswer> {
    const anonymousUser = await this.anonymousUserRepository.findOne({
      where: { id: createDto.anonymousUserId },
    });
    if (!anonymousUser) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '匿名用户不存在',
      });
    }

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
      const answerRepo = manager.getRepository(AnonymousScaleAnswer);
      const existing = await answerRepo.findOne({
        where: {
          anonymousUserId: createDto.anonymousUserId,
          scaleId: createDto.scaleId,
        },
        lock: { mode: 'pessimistic_write' },
      });

      if (existing) {
        existing.score = createDto.score;
        existing.submittedAt = new Date();
        return answerRepo.save(existing);
      }

      const row = answerRepo.create({
        scaleId: createDto.scaleId,
        anonymousUserId: createDto.anonymousUserId,
        score: createDto.score,
      });
      return answerRepo.save(row);
    });
  }

  /**
   * 查询 majors（排除 edu_level 为「0」的记录），按 edu_level 分组后分别构建三级树
   */
  async getMajorTreeGroupedByEduLevel(): Promise<KioskMajorTreeGroupedResponse> {
    const all = await this.majorRepository.find({
      where: { eduLevel: Not('0') },
      relations: ['majorDetail'],
      order: { eduLevel: 'ASC', code: 'ASC' },
    });
    const byEdu = new Map<string, Major[]>();
    for (const m of all) {
      const key = m.eduLevel ?? '';
      const list = byEdu.get(key) ?? [];
      list.push(m);
      byEdu.set(key, list);
    }
    const groups: KioskMajorTreeByEduLevelGroup[] = [...byEdu.entries()]
      .sort((a, b) =>
        a[0].localeCompare(b[0], 'zh-Hans-CN', { numeric: true }),
      )
      .map(([eduLevel, majors]) => ({
        eduLevel,
        tree: this.buildMajorTreeFromMajors(majors),
      }));
    return { groups };
  }

  /**
   * 将同一 edu_level 下的 majors 记录组装为三级树（level1→2→3）
   * 父子关系仍按 majors.id / parent_id 解析；节点对外 id 使用 major_details.id
   */
  private buildMajorTreeFromMajors(majors: Major[]): KioskMajorTreeNode[] {
    const idToNode = new Map<number, KioskMajorTreeNode>();
    for (const m of majors) {
      idToNode.set(m.id, {
        id: m.id ?? null,
        name: m.name,
        code: m.code,
        eduLevel: m.eduLevel,
        siteAllocationCode: m.siteAllocationCode,
        level: m.level,
        children: [],
      });
    }

    const roots: KioskMajorTreeNode[] = [];
    for (const m of majors) {
      const node = idToNode.get(m.id)!;
      if (m.parentId != null && idToNode.has(m.parentId)) {
        idToNode.get(m.parentId)!.children.push(node);
      } else if (m.level === 1) {
        roots.push(node);
      }
    }

    this.sortTreeByCode(roots);
    return roots;
  }

  /**
   * 递归按 code 排序各层节点
   */
  private sortTreeByCode(nodes: KioskMajorTreeNode[]): void {
    nodes.sort((a, b) => a.code.localeCompare(b.code, 'zh-Hans-CN'));
    for (const n of nodes) {
      this.sortTreeByCode(n.children);
    }
  }

  /**
   * 根据专业代码查询：major_details.code → major_element_analysis（major_id）
   * → element_id → scales（同元素下 direction 为「168」的量表）及 scale_options。
   *
   * @param majorCode 专业代码（与 major_details.code 一致）
   */
  async getAnalysisScalesByMajorCode(
    majorCode: string,
  ): Promise<KioskMajorAnalysisScalesResponse> {
    /** 单次 JOIN 查询结果行（列别名见 QueryBuilder） */
    interface KioskAnalysisScaleRawRow {
      majorDetailId: string | number;
      majorCode: string;
      analysisId: string | number | null;
      meaMajorDetailId: string | number | null;
      meaType: 'lexue' | 'shanxue' | null;
      meaElementId: string | number | null;
      meaWeight: string | number | null;
      meaSummary: string | null;
      scaleId: string | number | null;
      scaleContent: string | null;
      scaleElementId: string | number | null;
      scaleType: string | null;
      scaleDirection: string | null;
      scaleDimension: string | null;
      scaleAction: string | null;
      optId: string | number | null;
      optScaleId: string | number | null;
      optName: string | null;
      optValue: string | number | null;
      optDisplayOrder: string | number | null;
      optAdditionalInfo: string | null;
    }

    const rows = (await this.majorDetailRepository
      .createQueryBuilder('md')
      .where('md.code = :code', { code: majorCode })
      .leftJoin(
        MajorElementAnalysis,
        'mea',
        'mea.majorDetailId = md.id',
      )
      .leftJoin(
        Scale,
        'scale',
        'scale.elementId = mea.elementId AND scale.direction = :kioskScaleDirection',
        { kioskScaleDirection: '168' },
      )
      .leftJoin(
        ScaleOption,
        'opt',
        'opt.scaleId = scale.id',
      )
      .select('md.id', 'majorDetailId')
      .addSelect('md.code', 'majorCode')
      .addSelect('mea.id', 'analysisId')
      .addSelect('mea.majorDetailId', 'meaMajorDetailId')
      .addSelect('mea.type', 'meaType')
      .addSelect('mea.elementId', 'meaElementId')
      .addSelect('mea.weight', 'meaWeight')
      .addSelect('mea.summary', 'meaSummary')
      .addSelect('scale.id', 'scaleId')
      .addSelect('scale.content', 'scaleContent')
      .addSelect('scale.elementId', 'scaleElementId')
      .addSelect('scale.type', 'scaleType')
      .addSelect('scale.direction', 'scaleDirection')
      .addSelect('scale.dimension', 'scaleDimension')
      .addSelect('scale.action', 'scaleAction')
      .addSelect('opt.id', 'optId')
      .addSelect('opt.scaleId', 'optScaleId')
      .addSelect('opt.optionName', 'optName')
      .addSelect('opt.optionValue', 'optValue')
      .addSelect('opt.displayOrder', 'optDisplayOrder')
      .addSelect('opt.additionalInfo', 'optAdditionalInfo')
      .orderBy('mea.id', 'ASC')
      .addOrderBy('scale.id', 'ASC')
      .addOrderBy('opt.displayOrder', 'ASC')
      .getRawMany()) as KioskAnalysisScaleRawRow[];

    if (rows.length === 0) {
      throw new NotFoundException('未找到该专业代码对应的专业详情');
    }

    const majorDetailId = Number(rows[0].majorDetailId);
    const resolvedMajorCode = rows[0].majorCode;

    /** analysisId → 分析基础字段 + 量表 Map(scaleId → 量表及选项) */
    const acc = new Map<
      number,
      {
        analysisId: number;
        majorDetailId: number;
        type: 'lexue' | 'shanxue';
        elementId: number;
        weight: number;
        summary: string | null;
        scalesById: Map<number, KioskScalePayload & { seenOptIds: Set<number> }>;
      }
    >();

    for (const r of rows) {
      if (r.analysisId == null || r.meaType == null) {
        continue;
      }
      const aid = Number(r.analysisId);
      let entry = acc.get(aid);
      if (!entry) {
        entry = {
          analysisId: aid,
          majorDetailId: Number(r.meaMajorDetailId ?? majorDetailId),
          type: r.meaType,
          elementId: Number(r.meaElementId),
          weight: Number(r.meaWeight ?? 0),
          summary: r.meaSummary,
          scalesById: new Map(),
        };
        acc.set(aid, entry);
      }

      if (r.scaleId == null) {
        continue;
      }
      const sid = Number(r.scaleId);
      let sp = entry.scalesById.get(sid);
      if (!sp) {
        sp = {
          id: sid,
          content: r.scaleContent ?? '',
          elementId: Number(r.scaleElementId),
          type: (r.scaleType as KioskScalePayload['type']) ?? 'like',
          direction: String(r.scaleDirection ?? ''),
          dimension: String(r.scaleDimension ?? ''),
          action: r.scaleAction ?? '',
          options: [],
          seenOptIds: new Set<number>(),
        };
        entry.scalesById.set(sid, sp);
      }

      if (r.optId != null) {
        const oid = Number(r.optId);
        if (!sp.seenOptIds.has(oid)) {
          sp.seenOptIds.add(oid);
          sp.options.push({
            id: oid,
            scaleId: Number(r.optScaleId ?? sid),
            optionName: r.optName ?? '',
            optionValue: Number(r.optValue),
            displayOrder:
              r.optDisplayOrder != null ? Number(r.optDisplayOrder) : null,
            additionalInfo: r.optAdditionalInfo ?? null,
          });
        }
      }
    }

    const analyses: KioskMajorAnalysisScaleItem[] = [...acc.values()]
      .sort((a, b) => a.analysisId - b.analysisId)
      .map((e) => ({
        analysisId: e.analysisId,
        majorDetailId: e.majorDetailId,
        type: e.type,
        elementId: e.elementId,
        weight: e.weight,
        summary: e.summary,
        scales: [...e.scalesById.values()]
          .sort((x, y) => x.id - y.id)
          .map(({ seenOptIds: _s, ...rest }) => ({
            ...rest,
            options: [...rest.options].sort(
              (x: KioskScaleOptionPayload, y: KioskScaleOptionPayload) =>
                (x.displayOrder ?? 0) - (y.displayOrder ?? 0),
            ),
          })),
      }));

    return {
      majorCode: resolvedMajorCode,
      majorDetailId,
      analyses,
    };
  }
}
