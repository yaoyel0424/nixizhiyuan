import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { AnonymousUser } from '@/entities/anonymous-user.entity';
import { IdTransformUtil } from '@/common/utils/id-transform.util';
import { ErrorCode } from '@/common/constants/error-code.constant';

/**
 * 自助终端：基于 anonymous_scale_answers 计算专业匹配分
 * 逻辑与 ScoresService 中 queryRawDataForMajors + calculateScoresFromRawData 一致，数据源换为匿名答案表
 */
@Injectable()
export class KioskAnonymousMajorScoreService {
  constructor(
    @InjectDataSource()
    private readonly dataSource: DataSource,
    @InjectRepository(AnonymousUser)
    private readonly anonymousUserRepository: Repository<AnonymousUser>,
  ) {}

  /**
   * 校验匿名用户存在
   */
  private async assertAnonymousUserExists(anonymousUserId: number): Promise<void> {
    const row = await this.anonymousUserRepository.findOne({
      where: { id: anonymousUserId },
    });
    if (!row) {
      throw new NotFoundException({
        code: ErrorCode.RESOURCE_NOT_FOUND,
        message: '匿名用户不存在',
      });
    }
  }

  /**
   * 查询普通专业原始数据（答案来自 anonymous_scale_answers）
   */
  private async queryRawDataForMajorsByAnonymous(
    anonymousUserId: number,
    eduLevel?: string,
    majorCodes?: string[],
  ): Promise<any[]> {
    let whereCondition = '';
    const queryParams: any[] = [anonymousUserId];
    let paramIndex = 2;

    if (eduLevel) {
      const eduLevels = eduLevel
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      if (eduLevels.length > 0) {
        const placeholders = eduLevels
          .map(() => `$${paramIndex++}`)
          .join(', ');
        whereCondition = `AND m.edu_level IN (${placeholders}) AND m.edu_level IS NOT NULL`;
        queryParams.push(...eduLevels);
      } else {
        whereCondition = `AND m.edu_level IS NOT NULL`;
      }
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

    const userAnswersCte = `WITH user_answers AS (
      SELECT 
        s.id as scale_id,
        anon_sa.score as score,
        s.action
      FROM scales s
      INNER JOIN anonymous_scale_answers anon_sa ON anon_sa.scale_id = s.id
      WHERE anon_sa.anonymous_user_id = $1 AND anon_sa.scale_id > 112
    )`;

    const majorBaseDataCte = `major_base_data AS (
      SELECT 
        m.id as major_id,
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

    const sql = `
      ${userAnswersCte},
      ${majorBaseDataCte}
      SELECT 
        major_id as "majorId",
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

    return this.dataSource.query(sql, queryParams);
  }

  /**
   * 由原始行聚合为专业分数（与 ScoresService.calculateScoresFromRawData 一致，非热门专业路径）
   */
  private calculateScoresFromRawData(rawData: any[]): any[] {
    const majorGroups = new Map<string, any[]>();
    for (const row of rawData) {
      const key = row.majorCode;
      if (!majorGroups.has(key)) {
        majorGroups.set(key, []);
      }
      majorGroups.get(key)!.push(row);
    }

    const results: any[] = [];

    for (const [, rows] of majorGroups.entries()) {
      if (rows.length === 0) continue;

      const firstRow = rows[0];
      const majorId = firstRow.majorId;
      const majorCode = firstRow.majorCode;
      const majorName = firstRow.majorName;
      const eduLevel = firstRow.eduLevel;
      const majorBrief = firstRow.majorBrief;
      const academicDevelopmentScore = firstRow.academicDevelopmentScore || 0;
      const careerDevelopmentScore = firstRow.careerDevelopmentScore || 0;
      const growthPotentialScore = firstRow.growthPotentialScore || 0;
      const industryProspectsScore = firstRow.industryProspectsScore || 0;

      const typeGroups = new Map<string, any[]>();
      for (const row of rows) {
        const typeKey = `${row.type}_${row.potentialConversionValue || 'null'}`;
        if (!typeGroups.has(typeKey)) {
          typeGroups.set(typeKey, []);
        }
        typeGroups.get(typeKey)!.push(row);
      }

      const typeScores = new Map<
        string,
        { typeScore: number; totalScore: number; ratio: number }
      >();
      for (const [typeKey, typeRows] of typeGroups.entries()) {
        const typeScore = typeRows.reduce((sum, r) => {
          const ws = Number(r.weightedScore) || 0;
          if (isNaN(ws)) {
            return sum;
          }
          return sum + ws;
        }, 0);
        const totalScore = typeRows.reduce((sum, r) => {
          const tps = Number(r.totalPossibleScore) || 0;
          if (isNaN(tps)) {
            return sum;
          }
          return sum + tps;
        }, 0);

        const ratio = totalScore > 0 ? typeScore / totalScore : 0;

        typeScores.set(typeKey, {
          typeScore,
          totalScore,
          ratio: Math.round(ratio * 100) / 100,
        });
      }

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
          ? Math.round(lexueData.ratio * 0.5 * 100) / 100
          : 0;
      const shanxueScore =
        shanxueData.totalScore > 0
          ? Math.round(shanxueData.ratio * 0.5 * 100) / 100
          : 0;

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

      const baseScore =
        lexueScore + shanxueScore - (tiaozhanDeduction + yanxueDeduction);

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

      const industryProspectsScoreValue = Math.round(
        ((careerDevelopmentRaw + growthPotentialRaw) / 50) * 25 * 0.5 +
          (industryProspectsScore / 100) * 25 * 0.5,
      );

      const opportunityScore = Math.round(
        academicDevelopmentRaw +
          careerDevelopmentRaw +
          industryProspectsScoreValue +
          growthPotentialRaw,
      );

      const developmentPotential = Math.round(
        (academicDevelopmentRaw +
          careerDevelopmentRaw +
          industryProspectsScoreValue +
          growthPotentialRaw) /
          2 +
          (baseScore * 100) / 2,
      );

      const result: any = {
        majorId,
        majorCode,
        majorName,
        majorBrief,
        eduLevel,
        yanxueDeduction: Math.round(yanxueDeduction * 100),
        tiaozhanDeduction: Math.round(tiaozhanDeduction * 100),
        score: Math.round(baseScore * 100),
        lexueScore: Math.round(lexueScore * 100),
        shanxueScore: Math.round(shanxueScore * 100),
        industryProspectsScore: industryProspectsScoreValue,
        opportunityScore,
        developmentPotential,
        academicDevelopmentScore: academicDevelopmentRaw,
        careerDevelopmentScore: careerDevelopmentRaw,
        growthPotentialScore: growthPotentialRaw,
      };

      results.push(result);
    }

    results.sort((a, b) => b.score - a.score);

    const addSign = (index: number) => {
      const idForSign = results[index].majorCode;
      const sign = IdTransformUtil.encodeTo32Hex(
        idForSign != null ? String(idForSign) : undefined,
      );
      if (sign) results[index].sign = sign;
    };
    const top5Count = Math.min(5, results.length);
    for (let i = 0; i < top5Count; i++) addSign(i);
    const startLast5 = Math.max(0, results.length - 5);
    for (let i = startLast5; i < results.length; i++) addSign(i);

    return results;
  }

  /**
   * 计算匿名用户对专业的匹配分数列表（与 ScoresService.calculateScores 参数语义一致）
   */
  async calculateScoresForAnonymous(
    anonymousUserId: number,
    eduLevel?: string,
    majorCodes?: string | string[],
  ): Promise<any[]> {
    const codesArray: string[] | undefined = majorCodes
      ? Array.isArray(majorCodes)
        ? majorCodes
        : [majorCodes]
      : undefined;

    const rawData = await this.queryRawDataForMajorsByAnonymous(
      anonymousUserId,
      eduLevel,
      codesArray,
    );
    return this.calculateScoresFromRawData(rawData);
  }

  /**
   * 按专业代码取该专业在所有教育层次下分数最高的一条（对齐 ScoresController.getMajorScore）
   */
  async getMajorMatchScoreByAnonymousUser(
    anonymousUserId: number,
    majorCode: string,
  ): Promise<any[] | null> {
    await this.assertAnonymousUserExists(anonymousUserId);
    const trimmed = majorCode?.trim();
    if (!trimmed) {
      return null;
    }
    const scores = await this.calculateScoresForAnonymous(
      anonymousUserId,
      undefined,
      trimmed,
    );
    if (!scores || scores.length === 0) {
      return null;
    }
    return scores;
  }
}
