import { ApiProperty } from '@nestjs/swagger';
import { Expose, Type } from 'class-transformer';

/**
 * 元素得分信息 DTO
 */
export class ElementScoreInfoDto {
  @ApiProperty({ description: '元素ID', example: 1 })
  @Expose()
  elementId: number;

  @ApiProperty({ description: '元素名称', example: '视觉观察' })
  @Expose()
  elementName: string;

  @ApiProperty({
    description: '元素类型',
    example: 'like',
    enum: ['like', 'talent'],
  })
  @Expose()
  elementType: 'like' | 'talent';

  @ApiProperty({ description: '得分', example: 5.2 })
  @Expose()
  score: number;

  @ApiProperty({
    description: '分类',
    example: 'A',
    enum: ['A', 'B', 'C'],
  })
  @Expose()
  category: string;
}

/**
 * 象限信息 DTO
 */
export class QuadrantInfoDto {
  @ApiProperty({ description: '象限ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '象限编号', example: 1 })
  @Expose()
  quadrants: number;

  @ApiProperty({ description: '象限名称', example: '第一象限' })
  @Expose()
  name: string;

  @ApiProperty({ description: '象限标题', example: '天赋与兴趣的完美结合' })
  @Expose()
  title: string;
}

/**
 * 元素信息 DTO
 */
export class ElementInfoDto {
  @ApiProperty({ description: '元素ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '元素名称', example: '视觉观察' })
  @Expose()
  name: string;

  @ApiProperty({
    description: '元素类型',
    example: 'like',
    enum: ['like', 'talent'],
  })
  @Expose()
  type: 'like' | 'talent';
}

/**
 * 象限挑战 DTO
 */
export class QuadrantChallengeDto {
  @ApiProperty({ description: '挑战ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '挑战类型', example: '自我' })
  @Expose()
  type: string;

  @ApiProperty({ description: '挑战名称', example: '沉迷vs专注' })
  @Expose()
  name: string;

  @ApiProperty({ description: '挑战描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '培养策略' })
  @Expose()
  cultivationStrategy: string;

  @ApiProperty({ description: '即时策略' })
  @Expose()
  strategy: string;

  @ApiProperty({ description: '能力建设' })
  @Expose()
  capabilityBuilding: string;
}

/**
 * 象限生态位 DTO
 */
export class QuadrantNicheDto {
  @ApiProperty({ description: '生态位ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '生态位标题' })
  @Expose()
  title: string;

  @ApiProperty({ description: '生态位描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '可能的角色' })
  @Expose()
  possibleRoles: string;

  @ApiProperty({ description: '探索建议' })
  @Expose()
  explorationSuggestions: string;
}

/**
 * 第二象限生活挑战 DTO
 */
export class Quadrant2LifeChallengeDto {
  @ApiProperty({ description: '挑战ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '挑战类型', example: '自我' })
  @Expose()
  type: string;

  @ApiProperty({ description: '挑战名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '挑战描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '培养策略' })
  @Expose()
  cultivationStrategy: string;

  @ApiProperty({ description: '即时策略' })
  @Expose()
  strategy: string;

  @ApiProperty({ description: '能力建设' })
  @Expose()
  capabilityBuilding: string;
}

/**
 * 第二象限可行性研究 DTO
 */
export class Quadrant2FeasibilityStudyDto {
  @ApiProperty({ description: '可行性研究ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '标题' })
  @Expose()
  title: string;

  @ApiProperty({ description: '天赋价值' })
  @Expose()
  talentValue: string;

  @ApiProperty({ description: '探索参考' })
  @Expose()
  exploratoryReference: string;

  @ApiProperty({ description: '场景设置' })
  @Expose()
  sceneSetting: string;
}

/**
 * 第三象限弱点 DTO
 */
export class Quadrant3WeaknessDto {
  @ApiProperty({ description: '弱点ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '弱点类型' })
  @Expose()
  type: string;

  @ApiProperty({ description: '弱点名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '弱点描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '培养策略' })
  @Expose()
  cultivationStrategy: string;

  @ApiProperty({ description: '即时策略' })
  @Expose()
  strategy: string;

  @ApiProperty({ description: '能力建设', required: false })
  @Expose()
  capabilityBuilding?: string;
}

/**
 * 第三象限补偿 DTO
 */
export class Quadrant3CompensationDto {
  @ApiProperty({ description: '补偿ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '补偿名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '补偿描述' })
  @Expose()
  description: string;
}

/**
 * 第四象限困境 DTO
 */
export class Quadrant4DilemmaDto {
  @ApiProperty({ description: '困境ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '困境类型' })
  @Expose()
  type: string;

  @ApiProperty({ description: '困境名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '困境描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '培养策略' })
  @Expose()
  cultivationStrategy: string;

  @ApiProperty({ description: '具体策略' })
  @Expose()
  strategy: string;

  @ApiProperty({ description: '能力建设', required: false })
  @Expose()
  capabilityBuilding?: string;
}

/**
 * 第四象限成长路径 DTO
 */
export class Quadrant4GrowthPathDto {
  @ApiProperty({ description: '成长路径ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '成长路径标题' })
  @Expose()
  title: string;

  @ApiProperty({ description: '成长路径描述' })
  @Expose()
  description: string;

  @ApiProperty({ description: '可能的角色' })
  @Expose()
  possibleRoles: string;

  @ApiProperty({ description: '探索建议' })
  @Expose()
  explorationSuggestions: string;
}

/**
 * 画像详情 DTO
 */
export class PortraitDetailDto {
  @ApiProperty({ description: '画像ID', example: 1 })
  @Expose()
  id: number;

  @ApiProperty({ description: '画像名称' })
  @Expose()
  name: string;

  @ApiProperty({ description: '画像状态描述' })
  @Expose()
  status: string;

  @ApiProperty({ description: '第一部分主标题', required: false })
  @Expose()
  partOneMainTitle?: string;

  @ApiProperty({ description: '第一部分副标题', required: false })
  @Expose()
  partOneSubTitle?: string;

  @ApiProperty({ description: '第一部分描述' })
  @Expose()
  partOneDescription: string;

  @ApiProperty({ description: '第二部分描述', required: false })
  @Expose()
  partTwoDescription?: string;

  @ApiProperty({ description: '喜欢元素信息', type: ElementInfoDto })
  @Expose()
  @Type(() => ElementInfoDto)
  likeElement: ElementInfoDto;

  @ApiProperty({ description: '天赋元素信息', type: ElementInfoDto })
  @Expose()
  @Type(() => ElementInfoDto)
  talentElement: ElementInfoDto;

  @ApiProperty({ description: '象限信息', type: QuadrantInfoDto })
  @Expose()
  @Type(() => QuadrantInfoDto)
  quadrant: QuadrantInfoDto;

  @ApiProperty({
    description: '第一象限挑战列表',
    type: [QuadrantChallengeDto],
    required: false,
  })
  @Expose()
  @Type(() => QuadrantChallengeDto)
  quadrant1Challenges?: QuadrantChallengeDto[];

  @ApiProperty({
    description: '第一象限生态位列表',
    type: [QuadrantNicheDto],
    required: false,
  })
  @Expose()
  @Type(() => QuadrantNicheDto)
  quadrant1Niches?: QuadrantNicheDto[];

  @ApiProperty({
    description: '第二象限生活挑战列表',
    type: [Quadrant2LifeChallengeDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant2LifeChallengeDto)
  quadrant2LifeChallenges?: Quadrant2LifeChallengeDto[];

  @ApiProperty({
    description: '第二象限可行性研究列表',
    type: [Quadrant2FeasibilityStudyDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant2FeasibilityStudyDto)
  quadrant2FeasibilityStudies?: Quadrant2FeasibilityStudyDto[];

  @ApiProperty({
    description: '第三象限弱点列表',
    type: [Quadrant3WeaknessDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant3WeaknessDto)
  quadrant3Weaknesses?: Quadrant3WeaknessDto[];

  @ApiProperty({
    description: '第三象限补偿列表',
    type: [Quadrant3CompensationDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant3CompensationDto)
  quadrant3Compensations?: Quadrant3CompensationDto[];

  @ApiProperty({
    description: '第四象限困境列表',
    type: [Quadrant4DilemmaDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant4DilemmaDto)
  quadrant4Dilemmas?: Quadrant4DilemmaDto[];

  @ApiProperty({
    description: '第四象限成长路径列表',
    type: [Quadrant4GrowthPathDto],
    required: false,
  })
  @Expose()
  @Type(() => Quadrant4GrowthPathDto)
  quadrant4GrowthPaths?: Quadrant4GrowthPathDto[];
}

/**
 * 用户画像响应 DTO
 */
export class UserPortraitResponseDto {
  @ApiProperty({
    description: '所有元素得分信息',
    type: [ElementScoreInfoDto],
  })
  @Expose()
  @Type(() => ElementScoreInfoDto)
  elementScores: ElementScoreInfoDto[];

  @ApiProperty({
    description: '选中的喜欢元素',
    type: ElementScoreInfoDto,
    required: false,
  })
  @Expose()
  @Type(() => ElementScoreInfoDto)
  selectedLikeElement?: ElementScoreInfoDto;

  @ApiProperty({
    description: '选中的天赋元素',
    type: ElementScoreInfoDto,
    required: false,
  })
  @Expose()
  @Type(() => ElementScoreInfoDto)
  selectedTalentElement?: ElementScoreInfoDto;

  @ApiProperty({ description: '象限ID', required: false })
  @Expose()
  quadrantId?: number;

  @ApiProperty({
    description: '匹配的画像列表',
    type: [PortraitDetailDto],
  })
  @Expose()
  @Type(() => PortraitDetailDto)
  portraits: PortraitDetailDto[];

  @ApiProperty({ description: '提示信息', required: false })
  @Expose()
  message?: string;
}

