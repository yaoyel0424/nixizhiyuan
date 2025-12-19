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
  category: ElementScoreCategory;
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
  ) {}

  /**
   * 根据得分判断分类
   * @param score 得分
   * @returns 分类
   */
  private getScoreCategory(score: number): ElementScoreCategory {
    if (score >= 4 && score <= 6) {
      return ElementScoreCategory.OBVIOUS; // A: 明显
    } else if (score >= -3 && score <= 3) {
      return ElementScoreCategory.DEVELOPING; // B: 待发现/发展
    } else if (score >= -6 && score <= -4) {
      return ElementScoreCategory.NOT_OBVIOUS; // C: 不明显
    }
    // 如果不在任何范围内，根据分数大小判断
    if (score > 3) {
      return ElementScoreCategory.OBVIOUS;
    } else if (score < -3) {
      return ElementScoreCategory.NOT_OBVIOUS;
    }
    return ElementScoreCategory.DEVELOPING;
  }

  /**
   * 计算用户所有元素的得分
   * @param userId 用户ID
   * @returns 元素得分信息列表（按 correspondingElementId 分组，按 dimension 排序）
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
      const category = this.getScoreCategory(score);

      return {
        elementId: result.elementId,
        elementName: result.elementName,
        elementType: result.elementType,
        score,
        category,
        dimension: result.dimension,
        correspondingElementId: result.correspondingElementId || null,
      };
    });

    // 按照 correspondingElementId 分组，然后按照 dimension 顺序排序
    // dimension 顺序：'看' | '听' | '说' | '记' | '想' | '做' | '运动'
    const dimensionOrder = ['看', '听', '说', '记', '想', '做', '运动'];
    const dimensionOrderMap = new Map(
      dimensionOrder.map((dim, index) => [dim, index]),
    );

    // 创建一个分组键函数：将对应的元素放在一组
    // 规则：如果 elementA.correspondingElementId = elementB.id 或 elementA.id = elementB.correspondingElementId
    // 那么 elementA 和 elementB 应该在一组，使用较小的 id 作为分组键
    const getGroupKey = (item: ElementScoreInfo): number => {
      if (item.correspondingElementId) {
        // 如果当前元素有对应的元素，使用较小的 id 作为分组键
        return Math.min(item.elementId, item.correspondingElementId);
      }
      // 检查是否有其他元素的 correspondingElementId 指向当前元素
      const relatedItem = elementScores.find(
        (e) => e.correspondingElementId === item.elementId,
      );
      if (relatedItem) {
        return Math.min(item.elementId, relatedItem.elementId);
      }
      // 没有对应关系的元素，使用自己的 id 作为分组键
      return item.elementId;
    };

    // 按分组键分组
    const grouped = new Map<number, ElementScoreInfo[]>();
    for (const item of elementScores) {
      const groupKey = getGroupKey(item);
      if (!grouped.has(groupKey)) {
        grouped.set(groupKey, []);
      }
      grouped.get(groupKey)!.push(item);
    }

    // 将分组转换为数组，每个分组包含该组的所有元素
    const groupArray = Array.from(grouped.entries()).map(([groupKey, items]) => ({
      groupKey,
      items,
      // 获取该组第一个元素的 dimension（用于排序）
      firstDimension: items[0]?.dimension || '看',
    }));

    // 按照组的第一个元素的 dimension 顺序排序
    groupArray.sort((a, b) => {
      const indexA = dimensionOrderMap.get(a.firstDimension) ?? 999;
      const indexB = dimensionOrderMap.get(b.firstDimension) ?? 999;
      if (indexA !== indexB) {
        return indexA - indexB;
      }
      // 如果 dimension 相同，按照 groupKey 排序
      return a.groupKey - b.groupKey;
    });

    // 展平结果：每个组内的元素也按照 dimension 顺序排序
    const sortedResults: ElementScoreInfo[] = [];
    for (const group of groupArray) {
      // 组内按照 dimension 顺序排序
      group.items.sort((a, b) => {
        const indexA = dimensionOrderMap.get(a.dimension) ?? 999;
        const indexB = dimensionOrderMap.get(b.dimension) ?? 999;
        if (indexA !== indexB) {
          return indexA - indexB;
        }
        // 如果 dimension 相同，按照 elementId 排序
        return a.elementId - b.elementId;
      });
      sortedResults.push(...group.items);
    }

    return sortedResults;
  }

  /**
   * 根据元素得分分类计算对应的象限条件（不查询数据库）
   * @param likeCategory 喜欢元素的分类
   * @param talentCategory 天赋元素的分类
   * @returns 象限条件 { likeObvious, talentObvious } 或 null
   */
  private getQuadrantConditionByCategories(
    likeCategory: ElementScoreCategory,
    talentCategory: ElementScoreCategory,
  ): { likeObvious: boolean; talentObvious: boolean } | null {
    // 前20% 后20%
    // 根据分类判断是否明显
    // A (OBVIOUS): 明显（4-6分）
    // C (NOT_OBVIOUS): 不明显（-4到-6分）
    // B (DEVELOPING): 待发现/发展（-3-3分）

    // 象限匹配规则：
    // 第一象限：喜欢明显（A）且天赋明显（A）
    // 第二象限：喜欢不明显（C）且天赋明显（A）
    // 第三象限：喜欢不明显（C）且天赋不明显（C）
    // 第四象限：喜欢明显（A）且天赋不明显（C）
    // 特殊情况：如果都是B，不匹配任何象限

    // 如果两个都是B，不匹配任何象限
    if (
      likeCategory === ElementScoreCategory.DEVELOPING &&
      talentCategory === ElementScoreCategory.DEVELOPING
    ) {
      return null;
    }

    let likeObvious: boolean | null = null;
    let talentObvious: boolean | null = null;

    // 处理喜欢元素的分类
    if (likeCategory === ElementScoreCategory.OBVIOUS) {
      likeObvious = true;
    } else if (likeCategory === ElementScoreCategory.NOT_OBVIOUS) {
      likeObvious = false;
    } else if (likeCategory === ElementScoreCategory.DEVELOPING) {
      // B 分类：如果天赋是A，视为不明显（匹配第二象限）
      // 如果天赋是C，视为不明显（匹配第三象限）
      // 如果天赋是B，已经在上面的判断中返回null了
      likeObvious = false;
    }

    // 处理天赋元素的分类
    if (talentCategory === ElementScoreCategory.OBVIOUS) {
      talentObvious = true;
    } else if (talentCategory === ElementScoreCategory.NOT_OBVIOUS) {
      talentObvious = false;
    } else if (talentCategory === ElementScoreCategory.DEVELOPING) {
      // B 分类：如果喜欢是A，视为不明显（匹配第四象限）
      // 如果喜欢是C，视为不明显（匹配第三象限）
      // 如果喜欢是B，已经在上面的判断中返回null了
      talentObvious = false;
    }

    // 如果无法确定，返回 null
    if (likeObvious === null || talentObvious === null) {
      return null;
    }

    return { likeObvious, talentObvious };
  }

  /**
   * 查询用户的画像
   * @param userId 用户ID
   * @returns 用户画像信息
   */
  async getUserPortrait(userId: number) {
    // 1. 计算用户所有元素的得分
    const elementScores = await this.calculateUserElementScores(userId);

    // 2. 找出得分最高的喜欢元素和天赋元素（A 或 C 分类）
    const likeElements = elementScores.filter(
      (item) => item.elementType === 'like',
    );
    const talentElements = elementScores.filter(
      (item) => item.elementType === 'talent',
    );

    // 找出所有符合条件的元素（包括 A、B、C 分类）
    // 因为 B 分类也可以匹配象限（B 视为不明显）
    const allLikeElements = likeElements.filter(
      (item) =>
        item.category === ElementScoreCategory.OBVIOUS ||
        item.category === ElementScoreCategory.NOT_OBVIOUS ||
        item.category === ElementScoreCategory.DEVELOPING,
    );
    const allTalentElements = talentElements.filter(
      (item) =>
        item.category === ElementScoreCategory.OBVIOUS ||
        item.category === ElementScoreCategory.NOT_OBVIOUS ||
        item.category === ElementScoreCategory.DEVELOPING,
    );

    // 如果没有找到符合条件的元素，返回空结果
    if (allLikeElements.length === 0 || allTalentElements.length === 0) {
      this.logger.warn(
        `用户 ${userId} 没有找到符合条件的喜欢或天赋元素`,
      );
      return {
        elementScores,
        portraits: [],
        message: '未找到符合条件的画像，请完成更多测评',
      };
    }

    // 1. 预先批量查询所有象限信息（只有 4 个象限，一次性查询）
    const allQuadrants = await this.fourQuadrantRepository.find();
    const quadrantMap = new Map<number, typeof allQuadrants[0]>();
    const quadrantConditionMap = new Map<
      string,
      typeof allQuadrants[0]
    >();
    for (const quadrant of allQuadrants) {
      quadrantMap.set(quadrant.id, quadrant);
      const key = `${quadrant.likeObvious}-${quadrant.talentObvious}`;
      quadrantConditionMap.set(key, quadrant);
    }

    // 2. 收集所有需要查询的组合条件
    interface PortraitQueryCondition {
      likeId: number;
      talentId: number;
      quadrantId: number;
      quadrant: typeof allQuadrants[0];
    }
    const queryConditions: PortraitQueryCondition[] = [];
    const processedCombinations = new Set<string>();

    // 遍历所有符合条件的喜欢元素和天赋元素的组合
    for (const likeElement of allLikeElements) {
      for (const talentElement of allTalentElements) {
        // 根据分类计算对应的象限条件（不查询数据库）
        const condition = this.getQuadrantConditionByCategories(
          likeElement.category,
          talentElement.category,
        );

        if (!condition) {
          continue;
        }

        // 从缓存中获取象限信息
        const key = `${condition.likeObvious}-${condition.talentObvious}`;
        const quadrant = quadrantConditionMap.get(key);

        if (!quadrant) {
          continue;
        }

        // 创建组合的唯一标识，避免重复
        const combinationKey = `${likeElement.elementId}-${talentElement.elementId}-${quadrant.id}`;
        if (processedCombinations.has(combinationKey)) {
          continue;
        }
        processedCombinations.add(combinationKey);

        queryConditions.push({
          likeId: likeElement.elementId,
          talentId: talentElement.elementId,
          quadrantId: quadrant.id,
          quadrant,
        });
      }
    }

    // 3. 如果没有需要查询的组合，直接返回
    if (queryConditions.length === 0) {
      return {
        elementScores: elementScores.map((item) => ({
          elementId: item.elementId,
          elementName: item.elementName,
          elementType: item.elementType,
          score: item.score,
          category: item.category,
          dimension: item.dimension,
          correspondingElementId: item.correspondingElementId,
        })),
        selectedLikeElements: allLikeElements.map((item) => ({
          elementId: item.elementId,
          elementName: item.elementName,
          elementType: item.elementType,
          score: item.score,
          category: item.category,
          dimension: item.dimension,
          correspondingElementId: item.correspondingElementId,
        })),
        selectedTalentElements: allTalentElements.map((item) => ({
          elementId: item.elementId,
          elementName: item.elementName,
          elementType: item.elementType,
          score: item.score,
          category: item.category,
          dimension: item.dimension,
          correspondingElementId: item.correspondingElementId,
        })),
        portraits: [],
      };
    }

    // 4. 构建所有需要的关联关系
    // 为了确保所有象限的数据都能正确加载，我们加载所有象限的关联关系
    // 收集查询条件中涉及的所有象限编号
    const involvedQuadrants = new Set<number>();
    for (const condition of queryConditions) {
      involvedQuadrants.add(condition.quadrant.quadrants);
    }

    // 记录涉及的象限，用于调试
    this.logger.log(
      `查询条件涉及的象限: ${Array.from(involvedQuadrants).sort().join(', ')}`,
    );
    this.logger.log(
      `查询条件总数: ${queryConditions.length}, 涉及象限数: ${involvedQuadrants.size}`,
    );
    
    // 记录查询条件的详细信息（按象限分组）
    const conditionsByQuadrant = new Map<number, any[]>();
    for (const condition of queryConditions) {
      const quadrantNum = condition.quadrant.quadrants;
      if (!conditionsByQuadrant.has(quadrantNum)) {
        conditionsByQuadrant.set(quadrantNum, []);
      }
      conditionsByQuadrant.get(quadrantNum)!.push({
        likeId: condition.likeId,
        talentId: condition.talentId,
        quadrantId: condition.quadrantId,
      });
    }
    for (const [quadrantNum, conditions] of conditionsByQuadrant.entries()) {
      this.logger.log(
        `象限 ${quadrantNum} 的查询条件数量: ${conditions.length}, 示例: ${JSON.stringify(conditions.slice(0, 3))}`,
      );
    }

    // 5. 使用 QueryBuilder 构建 OR 条件一次性查询所有需要的画像
    const queryBuilder = this.portraitRepository
      .createQueryBuilder('portrait')
      .leftJoinAndSelect('portrait.likeElement', 'likeElement')
      .leftJoinAndSelect('portrait.talentElement', 'talentElement')
      .leftJoinAndSelect('portrait.quadrant', 'quadrant');

    // 根据涉及的象限动态加载对应的关联关系
    if (involvedQuadrants.has(1)) {
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant1Challenges',
        'quadrant1Challenges',
      );
      queryBuilder.leftJoinAndSelect('portrait.quadrant1Niches', 'quadrant1Niches');
    }
    if (involvedQuadrants.has(2)) {
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant2LifeChallenges',
        'quadrant2LifeChallenges',
      );
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant2FeasibilityStudies',
        'quadrant2FeasibilityStudies',
      );
    }
    if (involvedQuadrants.has(3)) {
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant3Weaknesses',
        'quadrant3Weaknesses',
      );
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant3Compensations',
        'quadrant3Compensations',
      );
    }
    if (involvedQuadrants.has(4)) {
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant4Dilemmas',
        'quadrant4Dilemmas',
      );
      queryBuilder.leftJoinAndSelect(
        'portrait.quadrant4GrowthPaths',
        'quadrant4GrowthPaths',
      );
    }

    // 构建查询条件：使用 IN 查询和内存过滤，避免生成大量 OR 条件
    if (queryConditions.length > 0) {
      // 收集所有唯一的 likeId、talentId、quadrantId
      const likeIds = new Set<number>();
      const talentIds = new Set<number>();
      const quadrantIds = new Set<number>();
      const conditionSet = new Set<string>();

      for (const condition of queryConditions) {
        likeIds.add(condition.likeId);
        talentIds.add(condition.talentId);
        quadrantIds.add(condition.quadrantId);
        conditionSet.add(
          `${condition.likeId}-${condition.talentId}-${condition.quadrantId}`,
        );
      }

      // 使用 IN 查询获取所有可能的 portrait（范围稍大，但查询简单）
      queryBuilder.where('portrait.likeId IN (:...likeIds)', {
        likeIds: Array.from(likeIds),
      });
      queryBuilder.andWhere('portrait.talentId IN (:...talentIds)', {
        talentIds: Array.from(talentIds),
      });
      queryBuilder.andWhere('portrait.quadrantId IN (:...quadrantIds)', {
        quadrantIds: Array.from(quadrantIds),
      });
    }

    // 6. 一次性查询所有可能的画像（使用 IN 查询，查询简单高效）
    const allPortraitsData = await queryBuilder.getMany();
    
    // 记录查询到的所有画像（过滤前）
    const allPortraitsByQuadrant = new Map<number, any[]>();
    for (const portrait of allPortraitsData) {
      const quadrantNum = portrait.quadrant?.quadrants || 0;
      if (!allPortraitsByQuadrant.has(quadrantNum)) {
        allPortraitsByQuadrant.set(quadrantNum, []);
      }
      allPortraitsByQuadrant.get(quadrantNum)!.push({
        id: portrait.id,
        name: portrait.name,
        likeId: portrait.likeId,
        talentId: portrait.talentId,
        quadrantId: portrait.quadrantId,
      });
    }
    for (const [quadrantNum, portraits] of allPortraitsByQuadrant.entries()) {
      this.logger.log(
        `查询到的象限 ${quadrantNum} 的画像数量（过滤前）: ${portraits.length}, 示例: ${JSON.stringify(portraits.slice(0, 3))}`,
      );
    }

    // 7. 在内存中过滤出真正匹配的组合（避免大量 OR 条件）
    const conditionSet = new Set<string>();
    const conditionMap = new Map<string, PortraitQueryCondition>();
    for (const condition of queryConditions) {
      const key = `${condition.likeId}-${condition.talentId}-${condition.quadrantId}`;
      conditionSet.add(key);
      conditionMap.set(key, condition);
    }

    // 过滤出匹配的 portrait
    const matchedPortraits = allPortraitsData.filter((portrait) => {
      const key = `${portrait.likeId}-${portrait.talentId}-${portrait.quadrantId}`;
      return conditionSet.has(key);
    });

    // 记录查询结果，用于调试
    const quadrantCounts = new Map<number, number>();
    for (const portrait of matchedPortraits) {
      const quadrantNum = portrait.quadrant?.quadrants || 0;
      quadrantCounts.set(
        quadrantNum,
        (quadrantCounts.get(quadrantNum) || 0) + 1,
      );
    }
    this.logger.log(
      `查询到的画像数量: ${matchedPortraits.length}, 各象限数量: ${JSON.stringify(Object.fromEntries(quadrantCounts))}`,
    );

    // 确保所有关联属性都被初始化（即使为空数组）
    for (const portrait of matchedPortraits) {
      if (!portrait.quadrant1Challenges) {
        portrait.quadrant1Challenges = [];
      }
      if (!portrait.quadrant1Niches) {
        portrait.quadrant1Niches = [];
      }
      if (!portrait.quadrant2LifeChallenges) {
        portrait.quadrant2LifeChallenges = [];
      }
      if (!portrait.quadrant2FeasibilityStudies) {
        portrait.quadrant2FeasibilityStudies = [];
      }
      if (!portrait.quadrant3Weaknesses) {
        portrait.quadrant3Weaknesses = [];
      }
      if (!portrait.quadrant3Compensations) {
        portrait.quadrant3Compensations = [];
      }
      if (!portrait.quadrant4Dilemmas) {
        portrait.quadrant4Dilemmas = [];
      }
      if (!portrait.quadrant4GrowthPaths) {
        portrait.quadrant4GrowthPaths = [];
      }
    }

    // 8. 格式化画像数据
    const allPortraits: any[] = [];
    for (const portrait of matchedPortraits) {
      const key = `${portrait.likeId}-${portrait.talentId}-${portrait.quadrantId}`;
      const condition = conditionMap.get(key);
      if (!condition) {
        continue;
      }

      const quadrant = condition.quadrant;
      allPortraits.push({
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
            }
          : null,
        talentElement: portrait.talentElement
          ? {
              id: portrait.talentElement.id,
              name: portrait.talentElement.name,
              type: portrait.talentElement.type,
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
        // 根据象限编号只返回对应的数据
        quadrant1Challenges:
          quadrant.quadrants === 1
            ? (Array.isArray(portrait.quadrant1Challenges)
                ? portrait.quadrant1Challenges
                : [])
            : undefined,
        quadrant1Niches:
          quadrant.quadrants === 1
            ? (Array.isArray(portrait.quadrant1Niches)
                ? portrait.quadrant1Niches
                : [])
            : undefined,
        quadrant2LifeChallenges:
          quadrant.quadrants === 2
            ? (Array.isArray(portrait.quadrant2LifeChallenges)
                ? portrait.quadrant2LifeChallenges
                : [])
            : undefined,
        quadrant2FeasibilityStudies:
          quadrant.quadrants === 2
            ? (Array.isArray(portrait.quadrant2FeasibilityStudies)
                ? portrait.quadrant2FeasibilityStudies
                : [])
            : undefined,
        quadrant3Weaknesses:
          quadrant.quadrants === 3
            ? (Array.isArray(portrait.quadrant3Weaknesses)
                ? portrait.quadrant3Weaknesses
                : [])
            : undefined,
        quadrant3Compensations:
          quadrant.quadrants === 3
            ? (Array.isArray(portrait.quadrant3Compensations)
                ? portrait.quadrant3Compensations
                : [])
            : undefined,
        quadrant4Dilemmas:
          quadrant.quadrants === 4
            ? (Array.isArray(portrait.quadrant4Dilemmas)
                ? portrait.quadrant4Dilemmas
                : [])
            : undefined,
        quadrant4GrowthPaths:
          quadrant.quadrants === 4
            ? (Array.isArray(portrait.quadrant4GrowthPaths)
                ? portrait.quadrant4GrowthPaths
                : [])
            : undefined,
      });
    }

    // 记录画像详情
    const portraitDetails = allPortraits.map((p) => ({
      id: p.id,
      name: p.name,
      quadrant: p.quadrant?.quadrants || 0,
    }));
    this.logger.log(
      `用户 ${userId} 查询画像成功，找到 ${allPortraits.length} 个匹配的画像`,
    );
    this.logger.log(
      `画像详情: ${JSON.stringify(portraitDetails, null, 2)}`,
    );

    // 格式化返回数据
    return {
      elementScores: elementScores.map((item) => ({
        elementId: item.elementId,
        elementName: item.elementName,
        elementType: item.elementType,
        score: item.score,
        category: item.category,
        dimension: item.dimension,
        correspondingElementId: item.correspondingElementId,
      })),
      selectedLikeElements: allLikeElements.map((item) => ({
        elementId: item.elementId,
        elementName: item.elementName,
        elementType: item.elementType,
        score: item.score,
        category: item.category,
        dimension: item.dimension,
        correspondingElementId: item.correspondingElementId,
      })),
      selectedTalentElements: allTalentElements.map((item) => ({
        elementId: item.elementId,
        elementName: item.elementName,
        elementType: item.elementType,
        score: item.score,
        category: item.category,
        dimension: item.dimension,
        correspondingElementId: item.correspondingElementId,
      })),
      portraits: allPortraits.sort((a, b) => a.id - b.id),
    };
  }
}

