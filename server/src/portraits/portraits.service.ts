import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Portrait } from '@/entities/portrait.entity';
import { Element } from '@/entities/element.entity';
import { FourQuadrant } from '@/entities/four-quadrant.entity';
import { QuadrantChallenge } from '@/entities/quadrant-1-challenge.entity';
import { QuadrantNiche } from '@/entities/quadrant-1-niche.entity';
import { Quadrant2LifeChallenge } from '@/entities/quadrant-2-life-challenge.entity';
import { Quadrant2FeasibilityStudy } from '@/entities/quadrant-2-feasibility-study.entity';
import { Quadrant3Weakness } from '@/entities/quadrant-3-weakness.entity';
import { Quadrant3Compensation } from '@/entities/quadrant-3-compensation.entity';
import { Quadrant4Dilemma } from '@/entities/quadrant-4-dilemma.entity';
import { Quadrant4GrowthPath } from '@/entities/quadrant-4-growth-path.entity';
import { PortraitFeedback } from '@/entities/portrait-feedback.entity';

/**
 * 元素得分分类枚举
 */
export enum ElementScoreCategory {
  /** 喜欢/天赋明显：4-6分 */
  OBVIOUS = 'A',
  /** 喜欢/天赋待发现/发展：-3-3分 */
  DEVELOPING = 'B',
  /** 喜欢/天赋不明显：-4到-6分 */
  NOT_OBVIOUS = 'C',
}

/**
 * 元素得分信息接口
 */
export interface ElementScoreInfo {
  elementId: number;
  elementName: string;
  elementType: 'like' | 'talent';
  score: number;
  category?: ElementScoreCategory;
  dimension: '看' | '听' | '说' | '记' | '想' | '做' | '运动';
  correspondingElementId: number | null;
}

/**
 * 肖像服务
 * 处理用户画像相关的业务逻辑
 */
@Injectable()
export class PortraitsService {
  private readonly logger = new Logger(PortraitsService.name);

  constructor(
    @InjectRepository(Portrait)
    private readonly portraitRepository: Repository<Portrait>,
    @InjectRepository(Element)
    private readonly elementRepository: Repository<Element>,
    @InjectRepository(FourQuadrant)
    private readonly fourQuadrantRepository: Repository<FourQuadrant>,
    @InjectRepository(QuadrantChallenge)
    private readonly quadrant1ChallengeRepository: Repository<QuadrantChallenge>,
    @InjectRepository(QuadrantNiche)
    private readonly quadrant1NicheRepository: Repository<QuadrantNiche>,
    @InjectRepository(Quadrant2LifeChallenge)
    private readonly quadrant2LifeChallengeRepository: Repository<Quadrant2LifeChallenge>,
    @InjectRepository(Quadrant2FeasibilityStudy)
    private readonly quadrant2FeasibilityStudyRepository: Repository<Quadrant2FeasibilityStudy>,
    @InjectRepository(Quadrant3Weakness)
    private readonly quadrant3WeaknessRepository: Repository<Quadrant3Weakness>,
    @InjectRepository(Quadrant3Compensation)
    private readonly quadrant3CompensationRepository: Repository<Quadrant3Compensation>,
    @InjectRepository(Quadrant4Dilemma)
    private readonly quadrant4DilemmaRepository: Repository<Quadrant4Dilemma>,
    @InjectRepository(Quadrant4GrowthPath)
    private readonly quadrant4GrowthPathRepository: Repository<Quadrant4GrowthPath>,
    @InjectRepository(PortraitFeedback)
    private readonly portraitFeedbackRepository: Repository<PortraitFeedback>,
  ) {} 

  /**
   * 计算用户所有元素的得分
   * @param userId 用户ID
   * @returns 元素得分信息列表（like/talent 对应关系见 correspondingElementId）
   */
  async calculateUserElementScores(
    userId: number,
  ): Promise<ElementScoreInfo[]> {
    // 使用一条 SQL 查询计算所有元素的总分（每个维度的总分）
    const results = await this.elementRepository
      .createQueryBuilder('element')
      .innerJoin(
        'scales',
        'scale',
        'scale.element_id = element.id AND scale.direction = :direction',
        { direction: '168' },
      )
      .innerJoin(
        'scale_answers',
        'answer',
        'answer.scale_id = scale.id AND answer.user_id = :userId',
        { userId },
      )
      .select('element.id', 'elementId')
      .addSelect('element.name', 'elementName')
      .addSelect('element.type', 'elementType')
      .addSelect('element.dimension', 'dimension')
      .addSelect('element.corresponding_element_id', 'correspondingElementId')
      .addSelect('SUM(answer.score)', 'totalScore')
      .groupBy('element.id')
      .addGroupBy('element.name')
      .addGroupBy('element.type')
      .addGroupBy('element.dimension')
      .addGroupBy('element.corresponding_element_id')
      .getRawMany();

    // 格式化结果
    const elementScores: ElementScoreInfo[] = results.map((result) => {
      const score = Number(Number(result.totalScore).toFixed(2));
      return {
        elementId: result.elementId,
        elementName: result.elementName,
        elementType: result.elementType,
        score,
        dimension: result.dimension,
        correspondingElementId: result.correspondingElementId || null,
      };
    });
    return elementScores;
  }

  /**
   * 查询用户画像。展示顺序：1.第一象限 2.第二象限（一无时）3.第四象限（一、二无时）4.第三象限（其他均无时）
   * 第一象限：like前20%+talent前20%；第二：like后20%+talent前20%；第三：like后20%+talent后20%；第四：like前20%+talent后20%
   */
  async getUserPortrait(userId: number) {
    const elementScores = await this.calculateUserElementScores(userId);

    const likeElements = elementScores.filter((item) => item.elementType === 'like');
    const talentElements = elementScores.filter((item) => item.elementType === 'talent');

    // 若 like 或 talent 维度最高分与最低分差值低于 3，不返回任何画像
    const likeScores = likeElements.map((e) => e.score);
    const talentScores = talentElements.map((e) => e.score);
    const likeRange = likeScores.length > 0 ? Math.max(...likeScores) - Math.min(...likeScores) : 0;
    const talentRange = talentScores.length > 0 ? Math.max(...talentScores) - Math.min(...talentScores) : 0;
    if (likeRange < 3 || talentRange < 3) {
      return {
        selectedLikeElements: [],
        selectedTalentElements: [],
        portraits: [],
      };
    }

    // 前 20%：分数阈值，同分全部保留
    const likeSortedDesc = [...likeElements].sort((a, b) => b.score - a.score);
    const likeTop20Count = Math.max(1, Math.ceil(likeSortedDesc.length * 0.2));
    const likeTop20Threshold = likeSortedDesc[likeTop20Count - 1]?.score ?? -Infinity;
    const likeTop20 = likeSortedDesc.filter((item) => item.score >= likeTop20Threshold);

    const talentSortedDesc = [...talentElements].sort((a, b) => b.score - a.score);
    const talentTop20Count = Math.max(1, Math.ceil(talentSortedDesc.length * 0.2));
    const talentTop20Threshold = talentSortedDesc[talentTop20Count - 1]?.score ?? -Infinity;
    const talentTop20 = talentSortedDesc.filter((item) => item.score >= talentTop20Threshold);

    // 后 20%：分数阈值，同分全部保留
    const likeSortedAsc = [...likeElements].sort((a, b) => a.score - b.score);
    const likeBottom20Count = Math.max(1, Math.ceil(likeSortedAsc.length * 0.2));
    const likeBottom20Threshold = likeSortedAsc[likeBottom20Count - 1]?.score ?? Infinity;
    const likeBottom20 = likeSortedAsc.filter((item) => item.score <= likeBottom20Threshold);

    const talentSortedAsc = [...talentElements].sort((a, b) => a.score - b.score);
    const talentBottom20Count = Math.max(1, Math.ceil(talentSortedAsc.length * 0.2));
    const talentBottom20Threshold = talentSortedAsc[talentBottom20Count - 1]?.score ?? Infinity;
    const talentBottom20 = talentSortedAsc.filter((item) => item.score <= talentBottom20Threshold);

    const talentTop20IdSet = new Set(talentTop20.map((t) => t.elementId));
    const talentBottom20IdSet = new Set(talentBottom20.map((t) => t.elementId));

    const allQuadrants = await this.fourQuadrantRepository.find();
    const firstQuadrant = allQuadrants.find((q) => q.likeObvious === true && q.talentObvious === true);
    const secondQuadrant = allQuadrants.find((q) => q.likeObvious === false && q.talentObvious === true);
    const thirdQuadrant = allQuadrants.find((q) => q.likeObvious === false && q.talentObvious === false);
    const fourthQuadrant = allQuadrants.find((q) => q.likeObvious === true && q.talentObvious === false);

    // 各象限配对（likeId, talentId, quadrantId）及对应的 like/talent 元素列表
    const q1Likes = likeTop20.filter(
      (like) =>
        like.correspondingElementId != null && talentTop20IdSet.has(like.correspondingElementId),
    );
    const q1TalentIds = new Set(q1Likes.map((l) => l.correspondingElementId!));
    const q1Talents = talentTop20.filter((t) => q1TalentIds.has(t.elementId));
    const q1Pairs =
      firstQuadrant && q1Likes.length > 0
        ? q1Likes.map((like) => ({
            likeId: like.elementId,
            talentId: like.correspondingElementId!,
            quadrantId: firstQuadrant.id,
          }))
        : [];

    const q2Likes = likeBottom20.filter(
      (like) =>
        like.correspondingElementId != null && talentTop20IdSet.has(like.correspondingElementId),
    );
    const q2Pairs =
      secondQuadrant && q2Likes.length > 0
        ? q2Likes.map((like) => ({
            likeId: like.elementId,
            talentId: like.correspondingElementId!,
            quadrantId: secondQuadrant.id,
          }))
        : [];
    const q2TalentIds = new Set(q2Pairs.map((p) => p.talentId));
    const q2Talents = talentTop20.filter((t) => q2TalentIds.has(t.elementId));

    const q3Likes = likeBottom20.filter(
      (like) =>
        like.correspondingElementId != null && talentBottom20IdSet.has(like.correspondingElementId),
    );
    const q3Pairs =
      thirdQuadrant && q3Likes.length > 0
        ? q3Likes.map((like) => ({
            likeId: like.elementId,
            talentId: like.correspondingElementId!,
            quadrantId: thirdQuadrant.id,
          }))
        : [];
    const q3TalentIds = new Set(q3Pairs.map((p) => p.talentId));
    const q3Talents = talentBottom20.filter((t) => q3TalentIds.has(t.elementId));

    const q4Likes = likeTop20.filter(
      (like) =>
        like.correspondingElementId != null && talentBottom20IdSet.has(like.correspondingElementId),
    );
    const q4Pairs =
      fourthQuadrant && q4Likes.length > 0
        ? q4Likes.map((like) => ({
            likeId: like.elementId,
            talentId: like.correspondingElementId!,
            quadrantId: fourthQuadrant.id,
          }))
        : [];
    const q4TalentIds = new Set(q4Pairs.map((p) => p.talentId));
    const q4Talents = talentBottom20.filter((t) => q4TalentIds.has(t.elementId));

    const formatItem = (item: ElementScoreInfo) => ({
          elementId: item.elementId,
          elementName: item.elementName,
          elementType: item.elementType,
          score: item.score,
          dimension: item.dimension,
          correspondingElementId: item.correspondingElementId,
    });

    /**
     * 同一象限内维度排序：1.喜欢+天赋合计分倒序 2.合计分相等则天生喜欢得分更高的先
     */
    const sortPairsByLikeAndTalentScore = (
      pairs: { likeId: number; talentId: number; quadrantId: number }[],
      likes: ElementScoreInfo[],
      talents: ElementScoreInfo[],
    ) => {
      const likeScoreMap = new Map(likes.map((l) => [l.elementId, l.score]));
      const talentScoreMap = new Map(talents.map((t) => [t.elementId, t.score]));
      const sortedPairs = [...pairs].sort((a, b) => {
        const aLike = likeScoreMap.get(a.likeId) ?? 0;
        const aTalent = talentScoreMap.get(a.talentId) ?? 0;
        const bLike = likeScoreMap.get(b.likeId) ?? 0;
        const bTalent = talentScoreMap.get(b.talentId) ?? 0;
        const aSum = aLike + aTalent;
        const bSum = bLike + bTalent;
        if (bSum !== aSum) return bSum - aSum;
        return bLike - aLike;
      });
      const sortedLikes = sortedPairs
        .map((p) => likes.find((l) => l.elementId === p.likeId))
        .filter((x): x is ElementScoreInfo => x != null);
      const sortedTalents = sortedPairs
        .map((p) => talents.find((t) => t.elementId === p.talentId))
        .filter((x): x is ElementScoreInfo => x != null);
      return { sortedPairs, sortedLikes, sortedTalents };
    };

    /** 按 sortedPairs 顺序重排 portrait 列表 */
    const orderPortraitListByPairs = <T extends { likeId: number; talentId: number }>(
      list: T[],
      pairs: { likeId: number; talentId: number }[],
    ): T[] => {
      const orderMap = new Map(pairs.map((p, i) => [`${p.likeId},${p.talentId}`, i]));
      return [...list].sort(
        (a, b) =>
          (orderMap.get(`${a.likeId},${a.talentId}`) ?? 999) -
          (orderMap.get(`${b.likeId},${b.talentId}`) ?? 999),
      );
    };

    const formatPortrait = (portrait: Portrait, extra: Record<string, any> = {}) => ({
        id: portrait.id,
        name: portrait.name,
        status: portrait.status,
        partOneMainTitle: portrait.partOneMainTitle,
        partOneSubTitle: portrait.partOneSubTitle,
        partOneDescription: portrait.partOneDescription,
        partTwoDescription: portrait.partTwoDescription,
        likeElement: portrait.likeElement
          ? {
              id: portrait.likeElement.id,
              name: portrait.likeElement.name,
              type: portrait.likeElement.type,
            ownedNaturalState: portrait.likeElement.ownedNaturalState,
            }
          : null,
        talentElement: portrait.talentElement
          ? {
              id: portrait.talentElement.id,
              name: portrait.talentElement.name,
              type: portrait.talentElement.type,
            ownedNaturalState: portrait.talentElement.ownedNaturalState,
            }
          : null,
        quadrant: portrait.quadrant
          ? {
              id: portrait.quadrant.id,
              quadrants: portrait.quadrant.quadrants,
              name: portrait.quadrant.name,
              title: portrait.quadrant.title,
            }
          : null,
      ...extra,
    });

    const queryPortraitsByPairs = async (pairs: { likeId: number; talentId: number; quadrantId: number }[]) => {
      if (pairs.length === 0) return [];
      const valuesPlaceholders = pairs
        .map((_, i) => `(:likeId${i}, :talentId${i}, :quadrantId${i})`)
        .join(', ');
      const exactParams: Record<string, number> = {};
      pairs.forEach((p, i) => {
        exactParams[`likeId${i}`] = p.likeId;
        exactParams[`talentId${i}`] = p.talentId;
        exactParams[`quadrantId${i}`] = p.quadrantId;
      });
      return this.portraitRepository
        .createQueryBuilder('portrait')
        .leftJoinAndSelect('portrait.likeElement', 'likeElement')
        .leftJoinAndSelect('portrait.talentElement', 'talentElement')
        .leftJoinAndSelect('portrait.quadrant', 'quadrant')
        .where(
          `(portrait.like_id, portrait.talent_id, portrait.quadrant_id) IN (SELECT v.a::integer, v.b::integer, v.c::integer FROM (VALUES ${valuesPlaceholders}) AS v(a, b, c))`,
          exactParams,
        )
        .getMany();
    };

    const emptyExtra = () => ({
      quadrant1Challenges: [] as any[],
      quadrant1Niches: [] as any[],
      quadrant2LifeChallenges: [] as any[],
      quadrant2FeasibilityStudies: [] as any[],
      quadrant3Weaknesses: [] as any[],
      quadrant3Compensations: [] as any[],
      quadrant4Dilemmas: [] as any[],
      quadrant4GrowthPaths: [] as any[],
    });

    // 1. 第一象限（同一象限内：喜欢+天赋合计分倒序，同分则喜欢得分高的先）
    if (q1Pairs.length > 0) {
      const { sortedPairs, sortedLikes, sortedTalents } = sortPairsByLikeAndTalentScore(
        q1Pairs,
        q1Likes,
        q1Talents,
      );
      const portraitList = orderPortraitListByPairs(
        await queryPortraitsByPairs(sortedPairs),
        sortedPairs,
      );
      if (portraitList.length > 0) {
        const portraitIds = portraitList.map((p) => p.id);
        const [challenges1, niches1] = await Promise.all([
          this.quadrant1ChallengeRepository.find({ where: { portraitId: In(portraitIds) } }),
          this.quadrant1NicheRepository.find({ where: { portraitId: In(portraitIds) } }),
        ]);
        const portraits = portraitList.map((p) =>
          formatPortrait(p, {
            ...emptyExtra(),
            quadrant1Challenges: challenges1.filter((c) => c.portraitId === p.id),
            quadrant1Niches: niches1.filter((n) => n.portraitId === p.id),
          }),
        );
        return {
          selectedLikeElements: sortedLikes.map(formatItem),
          selectedTalentElements: sortedTalents.map(formatItem),
          portraits,
        };
      }
    }

    // 2. 第二象限（第一象限无内容时；同一象限内：合计分倒序，同分则喜欢得分高的先）
    if (q2Pairs.length > 0) {
      const { sortedPairs, sortedLikes, sortedTalents } = sortPairsByLikeAndTalentScore(
        q2Pairs,
        q2Likes,
        q2Talents,
      );
      const portraitList = orderPortraitListByPairs(
        await queryPortraitsByPairs(sortedPairs),
        sortedPairs,
      );
      if (portraitList.length > 0) {
        const portraitIds = portraitList.map((p) => p.id);
        const [lifeChallenges2, feasibility2] = await Promise.all([
          this.quadrant2LifeChallengeRepository.find({ where: { portraitId: In(portraitIds) } }),
          this.quadrant2FeasibilityStudyRepository.find({ where: { portraitId: In(portraitIds) } }),
        ]);
        const portraits = portraitList.map((p) =>
          formatPortrait(p, {
            ...emptyExtra(),
            quadrant2LifeChallenges: lifeChallenges2.filter((c) => c.portraitId === p.id),
            quadrant2FeasibilityStudies: feasibility2.filter((s) => s.portraitId === p.id),
          }),
        );
        return {
          selectedLikeElements: sortedLikes.map(formatItem),
          selectedTalentElements: sortedTalents.map(formatItem),
          portraits,
        };
      }
    }

    // 3. 第四象限（第一、二象限均无内容时；同一象限内：合计分倒序，同分则喜欢得分高的先）
    if (q4Pairs.length > 0) {
      const { sortedPairs, sortedLikes, sortedTalents } = sortPairsByLikeAndTalentScore(
        q4Pairs,
        q4Likes,
        q4Talents,
      );
      const portraitList = orderPortraitListByPairs(
        await queryPortraitsByPairs(sortedPairs),
        sortedPairs,
      );
      if (portraitList.length > 0) {
        const portraitIds = portraitList.map((p) => p.id);
        const [dilemmas4, growthPaths4] = await Promise.all([
          this.quadrant4DilemmaRepository.find({ where: { portraitId: In(portraitIds) } }),
          this.quadrant4GrowthPathRepository.find({ where: { portraitId: In(portraitIds) } }),
        ]);
        const portraits = portraitList.map((p) =>
          formatPortrait(p, {
            ...emptyExtra(),
            quadrant4Dilemmas: dilemmas4.filter((d) => d.portraitId === p.id),
            quadrant4GrowthPaths: growthPaths4.filter((g) => g.portraitId === p.id),
          }),
        );
        return {
          selectedLikeElements: sortedLikes.map(formatItem),
          selectedTalentElements: sortedTalents.map(formatItem),
          portraits,
        };
      }
    }

    // 4. 第三象限（其他象限均无内容时；同一象限内：合计分倒序，同分则喜欢得分高的先）
    if (q3Pairs.length > 0) {
      const { sortedPairs, sortedLikes, sortedTalents } = sortPairsByLikeAndTalentScore(
        q3Pairs,
        q3Likes,
        q3Talents,
      );
      const portraitList = orderPortraitListByPairs(
        await queryPortraitsByPairs(sortedPairs),
        sortedPairs,
      );
      const portraitIds = portraitList.map((p) => p.id);
      const [weaknesses3, compensations3] =
        portraitIds.length > 0
          ? await Promise.all([
              this.quadrant3WeaknessRepository.find({ where: { portraitId: In(portraitIds) } }),
              this.quadrant3CompensationRepository.find({ where: { portraitId: In(portraitIds) } }),
            ])
          : [[], []];
      const portraits = portraitList.map((p) =>
        formatPortrait(p, {
          ...emptyExtra(),
          quadrant3Weaknesses: weaknesses3.filter((w) => w.portraitId === p.id),
          quadrant3Compensations: compensations3.filter((c) => c.portraitId === p.id),
        }),
      );
      return {
        selectedLikeElements: sortedLikes.map(formatItem),
        selectedTalentElements: sortedTalents.map(formatItem),
        portraits,
      };
    }

    // 任意象限都无配对时，返回第一象限的 like/talent 元素（可能为空）和空画像
    return {
      selectedLikeElements: q1Likes.map(formatItem),
      selectedTalentElements: q1Talents.map(formatItem),
      portraits: [],
    };
  }

  /**
   * 创建或更新画像反馈：同一用户对同一画像仅保留一条，存在则更新选项
   * @param userId 用户ID
   * @param option 反馈选项
   * @param portraitId 画像ID（可选）
   */
  async createFeedback(
    userId: number,
    option: string,
    portraitId?: number,
  ): Promise<PortraitFeedback> {
    const pid = portraitId ?? null;
    const optionVal = option.trim().slice(0, 64);
    const existing = await this.portraitFeedbackRepository.findOne({
      where: { userId, portraitId: pid },
    });
    if (existing) {
      existing.option = optionVal;
      return this.portraitFeedbackRepository.save(existing);
    }
    const feedback = this.portraitFeedbackRepository.create({
      userId,
      option: optionVal,
      portraitId: pid,
    });
    return this.portraitFeedbackRepository.save(feedback);
  }

  /**
   * 获取用户反馈：不传 portraitId 时返回该用户全部反馈，传时返回该画像的反馈（可能为空）
   */
  async getFeedback(
    userId: number,
    portraitId?: number,
  ): Promise<PortraitFeedback | PortraitFeedback[] | null> {
    if (portraitId != null) {
      return this.portraitFeedbackRepository.findOne({
        where: { userId, portraitId },
      });
    }
    return this.portraitFeedbackRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
  }
}

