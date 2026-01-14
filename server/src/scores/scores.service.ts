import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PopularMajor } from '@/entities/popular-major.entity';

/**
 * 专业分数服务
 * 处理专业匹配分数计算相关的业务逻辑
 */
@Injectable()
export class ScoresService {
  constructor(
    @InjectRepository(PopularMajor)
    private readonly popularMajorRepository: Repository<PopularMajor>,
  ) {}

  /**
   * 查询原始数据（不进行计算）
   * @param userId 用户ID
   * @param options 查询选项
   * @returns 原始数据列表
   */
  private async queryRawData(
    userId: number,
    options: {
      usePopularMajorAnswers: boolean;
      eduLevel?: string;
      majorCodes?: string[];
      popularMajorIds?: number[];
    },
  ): Promise<any[]> {
    const {
      usePopularMajorAnswers,
      eduLevel,
      majorCodes,
      popularMajorIds,
    } = options;

    // 构建 WHERE 条件
    let whereCondition = '';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    if (usePopularMajorAnswers) {
      // 热门专业查询：添加 popular_major_id 过滤条件
      if (popularMajorIds && popularMajorIds.length > 0) {
        const placeholders = popularMajorIds
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereCondition = `AND m.edu_level IS NOT NULL AND pm.id IN (${placeholders})`;
        queryParams.push(...popularMajorIds);
      } else {
        whereCondition = `AND m.edu_level IS NOT NULL`;
      }
    } else {
      // 普通专业查询：添加 edu_level 和 major_code 过滤条件
      if (eduLevel) {
        whereCondition = `AND m.edu_level = $${paramIndex} AND m.edu_level IS NOT NULL`;
        queryParams.push(eduLevel);
        paramIndex++;
      } else {
        whereCondition = `AND m.edu_level IS NOT NULL`;
      }

      if (majorCodes && majorCodes.length > 0) {
        const placeholders = majorCodes
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereCondition += ` AND m.code IN (${placeholders})`;
        queryParams.push(...majorCodes);
      }
    }

    // 构建 user_answers CTE
    const userAnswersCte = usePopularMajorAnswers
      ? `WITH user_answers AS (
        SELECT 
          s.id as scale_id,
          pma.score as score,
          s.action,
          pma.popular_major_id
        FROM scales s
        INNER JOIN popular_major_answers pma ON pma.scale_id = s.id
        WHERE pma.user_id = $1 AND s.id > 112
      )`
      : `WITH user_answers AS (
        SELECT 
          s.id as scale_id,
          sa.score as score,
          s.action
        FROM scales s
        INNER JOIN scale_answers sa ON sa.scale_id = s.id
        WHERE sa.user_id = $1 AND sa.scale_id > 112
      )`;

    // 构建 major_base_data CTE
    const majorBaseDataCte = usePopularMajorAnswers
      ? `major_base_data AS (
        SELECT 
          pm.id as popular_major_id,
          pm.code as major_code, 
          pm.name as major_name,
          m.edu_level as edu_level,
          md.major_brief, 
          md.academic_development_score,
          md.career_development_score,
          md.growth_potential_score,
          md.industry_prospects_score,
          mea.type,
          mea.potential_conversion_value,
          mea.weight,
          ua.score,
          ua.action,
          CASE WHEN ua.score IS NULL THEN 0 ELSE ua.score * mea.weight END as weighted_score,
          mea.weight * 2 as total_possible_score
        FROM popular_majors pm
        INNER JOIN major_details md ON md.code = pm.code
        INNER JOIN majors m ON m.code = md.code
        INNER JOIN major_element_analysis mea ON mea.major_id = md.id
        INNER JOIN elements e ON e.id = mea.element_id
        INNER JOIN scales s ON s.element_id = e.id
        LEFT JOIN user_answers ua ON ua.scale_id = s.id AND ua.popular_major_id = pm.id
        WHERE s.id > 112 ${whereCondition}
      )`
      : `major_base_data AS (
        SELECT 
          md.code as major_code, 
          m.name as major_name,
          m.edu_level as edu_level,
          md.major_brief, 
          md.academic_development_score,
          md.career_development_score,
          md.growth_potential_score,
          md.industry_prospects_score,
          mea.type,
          mea.potential_conversion_value,
          mea.weight,
          ua.score,
          ua.action,
          CASE WHEN ua.score IS NULL THEN 0 ELSE ua.score * mea.weight END as weighted_score,
          mea.weight * 2 as total_possible_score
        FROM major_details md
        INNER JOIN majors m ON m.code = md.code
        INNER JOIN major_element_analysis mea ON mea.major_id = md.id
        INNER JOIN elements e ON e.id = mea.element_id
        INNER JOIN scales s ON s.element_id = e.id
        LEFT JOIN user_answers ua ON ua.scale_id = s.id
        WHERE s.id > 112 ${whereCondition}
      )`;

    // 构建 type_scores CTE（根据是否有 popular_major_id 调整）
    const typeScoresGroupBy = usePopularMajorAnswers
      ? 'popular_major_id, major_code, major_name, edu_level, major_brief, academic_development_score, career_development_score, growth_potential_score, industry_prospects_score, type, potential_conversion_value'
      : 'major_code, major_name, edu_level, major_brief, academic_development_score, career_development_score, growth_potential_score, industry_prospects_score, type, potential_conversion_value';

    const typeScoresSelect = usePopularMajorAnswers
      ? 'popular_major_id,'
      : '';

    // 构建 study_scores CTE（根据是否有 popular_major_id 调整）
    const studyScoresGroupBy = usePopularMajorAnswers
      ? 'popular_major_id, major_code, major_name, edu_level, major_brief, academic_development_score, career_development_score, growth_potential_score, industry_prospects_score'
      : 'major_code, major_name, edu_level, major_brief, academic_development_score, career_development_score, growth_potential_score, industry_prospects_score';

    const studyScoresSelect = usePopularMajorAnswers
      ? 'popular_major_id,'
      : '';

    // 构建 deduction_scores CTE（根据是否有 popular_major_id 调整）
    const deductionScoresGroupBy = usePopularMajorAnswers
      ? 'ts.popular_major_id, ts.major_code'
      : 'ts.major_code';

    const deductionScoresSelect = usePopularMajorAnswers
      ? 'ts.popular_major_id,'
      : '';

    // 构建 final_scores CTE（根据是否有 popular_major_id 调整）
    const finalScoresJoin = usePopularMajorAnswers
      ? 'JOIN deduction_scores ds ON ds.popular_major_id = ss.popular_major_id AND ds.major_code = ss.major_code'
      : 'JOIN deduction_scores ds ON ds.major_code = ss.major_code';

    const finalScoresSelect = usePopularMajorAnswers
      ? 'ss.popular_major_id,'
      : '';

    // 构建最终 SELECT（根据是否有 popular_major_id 调整）
    const finalSelectPopularMajorId = usePopularMajorAnswers
      ? 'fs.popular_major_id as "popularMajorId",'
      : '';

    // SQL 只查询原始数据，不进行计算
    const sql = `
      ${userAnswersCte},
      ${majorBaseDataCte}
      SELECT 
        ${usePopularMajorAnswers ? 'popular_major_id as "popularMajorId",' : ''}
        major_code as "majorCode",
        major_name as "majorName",
        edu_level as "eduLevel",
        major_brief as "majorBrief",
        academic_development_score as "academicDevelopmentScore",
        career_development_score as "careerDevelopmentScore",
        growth_potential_score as "growthPotentialScore",
        industry_prospects_score as "industryProspectsScore",
        type,
        potential_conversion_value as "potentialConversionValue",
        score,
        weight,
        weighted_score as "weightedScore",
        total_possible_score as "totalPossibleScore"
      FROM major_base_data
    `;

    const rawData = await this.popularMajorRepository.manager.query(
      sql,
      queryParams,
    );

    return rawData;
  }

  /**
   * 计算专业匹配分数
   * @param rawData 原始数据
   * @param usePopularMajorAnswers 是否使用热门专业答案
   * @returns 计算后的专业分数列表
   */
  private calculateScoresFromRawData(
    rawData: any[],
    usePopularMajorAnswers: boolean,
  ): any[] {
    // 按专业分组数据
    const majorGroups = new Map<string, any[]>();
    for (const row of rawData) {
      const key = usePopularMajorAnswers
        ? `${row.popularMajorId}_${row.majorCode}`
        : row.majorCode;
      if (!majorGroups.has(key)) {
        majorGroups.set(key, []);
      }
      majorGroups.get(key)!.push(row);
    }

    const results: any[] = [];

    for (const [key, rows] of majorGroups.entries()) {
      if (rows.length === 0) continue;

      const firstRow = rows[0];
      const majorCode = firstRow.majorCode;
      const majorName = firstRow.majorName;
      const eduLevel = firstRow.eduLevel;
      const majorBrief = firstRow.majorBrief;
      const academicDevelopmentScore = firstRow.academicDevelopmentScore || 0;
      const careerDevelopmentScore = firstRow.careerDevelopmentScore || 0;
      const growthPotentialScore = firstRow.growthPotentialScore || 0;
      const industryProspectsScore = firstRow.industryProspectsScore || 0;
      const popularMajorId = usePopularMajorAnswers
        ? firstRow.popularMajorId
        : undefined;

      // 按类型分组计算
      const typeGroups = new Map<string, any[]>();
      for (const row of rows) {
        const typeKey = `${row.type}_${row.potentialConversionValue || 'null'}`;
        if (!typeGroups.has(typeKey)) {
          typeGroups.set(typeKey, []);
        }
        typeGroups.get(typeKey)!.push(row);
      }

      // 计算类型得分和比例
      const typeScores = new Map<
        string,
        { typeScore: number; totalScore: number; ratio: number }
      >();
      for (const [typeKey, typeRows] of typeGroups.entries()) {
        const typeScore = typeRows.reduce(
          (sum, r) => sum + (r.weightedScore || 0),
          0,
        );
        const totalScore = typeRows.reduce(
          (sum, r) => sum + (r.totalPossibleScore || 0),
          0,
        );
        const ratio = totalScore > 0 ? typeScore / totalScore : 0;
        typeScores.set(typeKey, {
          typeScore,
          totalScore,
          ratio: Math.round(ratio * 100) / 100,
        });
      }

      // 计算学习分数
      const lexueData = typeScores.get('lexue_null') || {
        typeScore: 0,
        totalScore: 0,
        ratio: 0,
      };
      const shanxueData = typeScores.get('shanxue_null') || {
        typeScore: 0,
        totalScore: 0,
        ratio: 0,
      };
      const lexueScore =
        lexueData.totalScore > 0
          ? Math.round((lexueData.ratio * 0.5) * 100) / 100
          : 0;
      const shanxueScore =
        shanxueData.totalScore > 0
          ? Math.round((shanxueData.ratio * 0.5) * 100) / 100
          : 0;

      // 计算扣分
      let tiaozhanDeduction = 0;
      let yanxueDeduction = 0;

      for (const [typeKey, data] of typeScores.entries()) {
        if (data.typeScore <= 0) continue;

        const [type, conversionValue] = typeKey.split('_');
        let deduction = 0;

        if (type === 'tiaozhan') {
          if (conversionValue === 'medium') {
            deduction = data.ratio * 0.5 * 0.25;
          } else if (conversionValue === 'low') {
            deduction = data.ratio * 0.25;
          }
          tiaozhanDeduction = Math.max(
            tiaozhanDeduction,
            Math.round(deduction * 100) / 100,
          );
        } else if (type === 'yanxue') {
          if (conversionValue === 'medium') {
            deduction = data.ratio * 0.5 * 0.25;
          } else if (conversionValue === 'low') {
            deduction = data.ratio * 0.25;
          }
          yanxueDeduction = Math.max(
            yanxueDeduction,
            Math.round(deduction * 100) / 100,
          );
        }
      }

      // 计算基础得分
      const baseScore =
        lexueScore + shanxueScore - (tiaozhanDeduction + yanxueDeduction);

      // 计算各项原始得分
      const academicDevelopmentRaw = Math.round(
        (lexueScore + shanxueScore) * 25 * 0.5 +
          (academicDevelopmentScore / 100) * 25 * 0.5,
      );
      const careerDevelopmentRaw = Math.round(
        baseScore * 25 * 0.5 + (careerDevelopmentScore / 100) * 25 * 0.5,
      );
      const growthPotentialRaw = Math.round(
        baseScore * 25 * 0.5 + (growthPotentialScore / 100) * 25 * 0.5,
      );

      // 计算行业前景得分
      const industryProspectsScoreValue = Math.round(
        ((careerDevelopmentRaw + growthPotentialRaw) / 50) * 25 * 0.5 +
          (industryProspectsScore / 100) * 25 * 0.5,
      );

      // 计算机会得分
      const opportunityScore = Math.round(
        academicDevelopmentRaw +
          careerDevelopmentRaw +
          industryProspectsScoreValue +
          growthPotentialRaw,
      );

      // 计算发展潜力得分
      const developmentPotential = Math.round(
        (academicDevelopmentRaw +
          careerDevelopmentRaw +
          industryProspectsScoreValue +
          growthPotentialRaw) /
          2 +
          baseScore * 100 / 2,
      );

      const result: any = {
        majorCode,
        majorName,
        majorBrief,
        eduLevel,
        yanxueDeduction: Math.round(yanxueDeduction * 100) / 100,
        tiaozhanDeduction: Math.round(tiaozhanDeduction * 100) / 100,
        score: Math.round(baseScore * 100) / 100,
        lexueScore: Math.round(lexueScore * 100) / 100,
        shanxueScore: Math.round(shanxueScore * 100) / 100,
        industryProspectsScore: industryProspectsScoreValue,
        opportunityScore,
        developmentPotential,
        academicDevelopmentScore: academicDevelopmentRaw,
        careerDevelopmentScore: careerDevelopmentRaw,
        growthPotentialScore: growthPotentialRaw,
      };

      if (usePopularMajorAnswers && popularMajorId) {
        result.popularMajorId = popularMajorId;
      }

      results.push(result);
    }

    // 按得分排序
    results.sort((a, b) => b.score - a.score);

    return results;
  }

  /**
   * 计算专业匹配分数的公共方法
   * @param userId 用户ID
   * @param options 查询选项
   * @returns 专业分数列表
   */
  private async calculateScoresInternal(
    userId: number,
    options: {
      usePopularMajorAnswers: boolean;
      eduLevel?: string;
      majorCodes?: string[];
      popularMajorIds?: number[];
    },
  ): Promise<any[]> {
    // 先查询原始数据
    const rawData = await this.queryRawData(userId, options);

    // 然后进行计算
    return this.calculateScoresFromRawData(
      rawData,
      options.usePopularMajorAnswers,
    );
  }

  /**
   * 计算用户对专业的匹配分数
   * @param userId 用户ID
   * @param edu_level 教育层次（可选），如果不传则查询所有教育层次
   * @param majorCodes 专业代码（可选，可以是字符串或字符串数组），如果不传则查询对应edu_level下所有专业
   * @returns 专业分数列表
   */
  async calculateScores(
    userId: number,
    edu_level?: string,
    majorCodes?: string | string[],
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
      industryProspectsScore: number;
      opportunityScore: number;
      developmentPotential: number;
      academicDevelopmentScore: number;
      careerDevelopmentScore: number;
      growthPotentialScore: number;
    }>
  > {
    // 处理 majorCodes 参数：统一转换为数组
    const codesArray: string[] | undefined = majorCodes
      ? Array.isArray(majorCodes)
        ? majorCodes
        : [majorCodes]
      : undefined;

    return this.calculateScoresInternal(userId, {
      usePopularMajorAnswers: false,
      eduLevel: edu_level,
      majorCodes: codesArray,
    });
  }

  /**
   * 计算用户对热门专业的匹配分数
   * @param userId 用户ID
   * @param popularMajorIds 热门专业ID列表（可选，可以是数字或数字数组），如果不传则查询所有热门专业
   * @returns 热门专业分数列表
   */
  async calculatePopularMajorScores(
    userId: number,
    popularMajorIds?: number | number[],
  ): Promise<
    Array<{
      popularMajorId: number;
      majorCode: string;
      majorName: string;
      majorBrief: string | null;
      eduLevel: string;
      yanxueDeduction: number;
      tiaozhanDeduction: number;
      score: number;
      lexueScore: number;
      shanxueScore: number;
      industryProspectsScore: number;
      opportunityScore: number;
      developmentPotential: number;
      academicDevelopmentScore: number;
      careerDevelopmentScore: number;
      growthPotentialScore: number;
    }>
  > {
    // 处理 popularMajorIds 参数：统一转换为数组
    const idsArray: number[] | undefined = popularMajorIds
      ? Array.isArray(popularMajorIds)
        ? popularMajorIds
        : [popularMajorIds]
      : undefined;

    return this.calculateScoresInternal(userId, {
      usePopularMajorAnswers: true,
      popularMajorIds: idsArray,
    });
  }
}

