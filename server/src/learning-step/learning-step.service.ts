import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { LearningStepCard } from '@/entities/learning-step-card.entity';
import { LearningStepPhaseTitle } from '@/entities/learning-step-phase-title.entity';
import { LearningPhaseRedlightItem } from '@/entities/learning-phase-redlight-item.entity';
import { LearningPhaseStartDoingItem } from '@/entities/learning-phase-start-doing-item.entity';
import { LearningStep4MethodItem } from '@/entities/learning-step4-method-item.entity';
import { Element } from '@/entities/element.entity';
import { GaokaoMathModuleStat } from '@/entities/gaokao-math-module-stat.entity';
import { PortraitsService } from '@/portraits/portraits.service';

type LearningStepItemDto =
  | {
      id: number;
      elementId: number;
      elementName?: string;
      elementDimension?: string;
      sortOrder: number;
      redlightBehavior: string;
      physiologyReason: string;
      stopLossTip: string;
    }
  | {
      id: number;
      elementId: number;
      elementName?: string;
      elementDimension?: string;
      sortOrder: number;
      startDoingMethod: string;
      physiologyMechanism: string;
      examExample: string;
      quickStartAction: string;
      bestTool: string;
    }
  | {
      id: number;
      elementId: number;
      elementName?: string;
      elementDimension?: string;
      sortOrder: number;
      methodTitle: string;
      methodContent: string;
      physiologyMechanism: string;
      examExample: string;
    };

/**
 * 学习步骤服务
 * 聚合步骤、阶段与各步骤内容明细，返回完整学习步骤信息
 */
@Injectable()
export class LearningStepService {
  constructor(
    @InjectRepository(LearningStepCard)
    private readonly stepRepository: Repository<LearningStepCard>,
    @InjectRepository(LearningStepPhaseTitle)
    private readonly phaseRepository: Repository<LearningStepPhaseTitle>,
    @InjectRepository(LearningPhaseRedlightItem)
    private readonly redlightRepository: Repository<LearningPhaseRedlightItem>,
    @InjectRepository(LearningPhaseStartDoingItem)
    private readonly startDoingRepository: Repository<LearningPhaseStartDoingItem>,
    @InjectRepository(LearningStep4MethodItem)
    private readonly step4Repository: Repository<LearningStep4MethodItem>,
    @InjectRepository(Element)
    private readonly elementRepository: Repository<Element>,
    @InjectRepository(GaokaoMathModuleStat)
    private readonly gaokaoMathModuleStatRepository: Repository<GaokaoMathModuleStat>,
    private readonly portraitsService: PortraitsService,
  ) {}

  /**
   * 获取学习步骤完整信息
   * - step 基础信息
   * - phase 阶段信息
   * - phase 下的 item 明细（按 step 选择对应表）
   */
  async getFullLearningSteps() {
    const steps = await this.stepRepository.find({
      order: { id: 'ASC' },
    });
    if (!steps.length) {
      return [];
    }

    const stepIds = steps.map((s) => s.id);
    const phases = await this.phaseRepository.find({
      where: { stepId: In(stepIds) },
      order: { stepId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
    });

    // 预加载所有 element，避免循环查询
    const elements = await this.elementRepository.find({
      select: ['id', 'name', 'dimension'],
    });
    const elementMap = new Map(
      elements.map((e) => [e.id, { name: e.name, dimension: e.dimension }]),
    );

    const phaseIds = phases.map((p) => p.id);
    const [step1Items, step2Items, step4Items] = await Promise.all([
      this.redlightRepository.find({
        where: { stepPhaseTitleId: In(phaseIds) },
        order: { stepId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
      }),
      this.startDoingRepository.find({
        where: { stepPhaseTitleId: In(phaseIds) },
        order: { stepId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
      }),
      this.step4Repository.find({
        where: { stepPhaseTitleId: In(phaseIds) },
        order: { stepId: 'ASC', sortOrder: 'ASC', id: 'ASC' },
      }),
    ]);

    // phaseId => items
    const phaseItemsMap = new Map<number, LearningStepItemDto[]>();

    step1Items.forEach((it) => {
      const ele = elementMap.get(it.elementId);
      const arr = phaseItemsMap.get(it.stepPhaseTitleId) ?? [];
      arr.push({
        id: it.id,
        elementId: it.elementId,
        elementName: ele?.name,
        elementDimension: ele?.dimension,
        sortOrder: it.sortOrder,
        redlightBehavior: it.redlightBehavior,
        physiologyReason: it.physiologyReason,
        stopLossTip: it.stopLossTip,
      });
      phaseItemsMap.set(it.stepPhaseTitleId, arr);
    });

    step2Items.forEach((it) => {
      const ele = elementMap.get(it.elementId);
      const arr = phaseItemsMap.get(it.stepPhaseTitleId) ?? [];
      arr.push({
        id: it.id,
        elementId: it.elementId,
        elementName: ele?.name,
        elementDimension: ele?.dimension,
        sortOrder: it.sortOrder,
        startDoingMethod: it.startDoingMethod,
        physiologyMechanism: it.physiologyMechanism,
        examExample: it.examExample,
        quickStartAction: it.quickStartAction,
        bestTool: it.bestTool,
      });
      phaseItemsMap.set(it.stepPhaseTitleId, arr);
    });

    step4Items.forEach((it) => {
      const ele = elementMap.get(it.elementId);
      const arr = phaseItemsMap.get(it.stepPhaseTitleId) ?? [];
      arr.push({
        id: it.id,
        elementId: it.elementId,
        elementName: ele?.name,
        elementDimension: ele?.dimension,
        sortOrder: it.sortOrder,
        methodTitle: it.methodTitle,
        methodContent: it.methodContent,
        physiologyMechanism: it.physiologyMechanism,
        examExample: it.examExample,
      });
      phaseItemsMap.set(it.stepPhaseTitleId, arr);
    });

    const phaseByStep = new Map<number, LearningStepPhaseTitle[]>();
    phases.forEach((p) => {
      const arr = phaseByStep.get(p.stepId) ?? [];
      arr.push(p);
      phaseByStep.set(p.stepId, arr);
    });

    return steps.map((step) => {
      const phaseList = phaseByStep.get(step.id) ?? [];
      return {
        id: step.id,
        type: step.type,
        step: step.step,
        subStep: step.subStep,
        title: step.title,
        content: step.content,
        bottomTitle: step.bottomTitle,
        bottom: step.bottom,
        phases: phaseList.map((phase) => ({
          id: phase.id,
          stepId: phase.stepId,
          phaseType: phase.phaseType,
          title: phase.title,
          sortOrder: phase.sortOrder,
          items: (phaseItemsMap.get(phase.id) ?? []).sort(
            (a, b) => a.sortOrder - b.sortOrder || a.id - b.id,
          ),
        })),
      };
    });
  }

  /**
   * 按用户喜欢/天赋象限筛选步骤内容
   * 规则：
   * - 第一步：使用第三象限元素
   * - 第二步：使用第一象限元素
   * - 第四步：使用第一象限元素
   */
  async getUserLearningSteps(userId: number) {
    const [fullSteps, buckets] = await Promise.all([
      this.getFullLearningSteps(),
      this.portraitsService.getUserQuadrantElementBuckets(userId),
    ]);

    console.log('buckets', buckets); 
    const q1ElementIdSet = new Set<number>([
      ...buckets.firstQuadrant.likeElements.map((i) => i.elementId),
      ...buckets.firstQuadrant.talentElements.map((i) => i.elementId),
    ]);
    const q3ElementIdSet = new Set<number>([
      ...buckets.thirdQuadrant.likeElements.map((i) => i.elementId),
      ...buckets.thirdQuadrant.talentElements.map((i) => i.elementId),
    ]);

    return fullSteps.map((step) => {
      let targetSet: Set<number> | null = null;
      if (step.id === 1) {
        targetSet = q3ElementIdSet;
      } else if (step.id === 2 || step.id === 4) {
        targetSet = q1ElementIdSet;
      }

      if (targetSet == null) {
        return step;
      }

      return {
        ...step,
        phases: step.phases.map((phase) => ({
          ...phase,
          items: phase.items.filter((item) => targetSet!.has(item.elementId)),
        })),
      };
    });
  }

  /**
   * 根据省份名称查询数学高考历年模块数据
   * @param province 省份名称（如：广东、北京市）
   */
  async getGaokaoMathStatsByProvince(province: string) {
    const provinceName = province.trim();
    return this.gaokaoMathModuleStatRepository.find({
      where: { province: provinceName },
      order: { sortOrder: 'ASC', id: 'ASC' },
    });
  }
}
