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
   * 计算用户对热门专业的匹配分数
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
    }>
  > {
    // 处理 majorCodes 参数：统一转换为数组
    const codesArray: string[] | undefined = majorCodes
      ? Array.isArray(majorCodes)
        ? majorCodes
        : [majorCodes]
      : undefined;

    // 构建 WHERE 条件
    let eduLevelCondition = '';
    let majorCodeCondition = '';
    const queryParams: any[] = [userId];
    let paramIndex = 2;

    // 如果传入了 edu_level，添加教育层次过滤条件
    if (edu_level) {
      eduLevelCondition = `AND m.edu_level = $${paramIndex} AND m.edu_level IS NOT NULL`;
      queryParams.push(edu_level);
      paramIndex++;
    } else {
      // 如果没有传入 edu_level，只过滤掉 edu_level 为 NULL 的记录
      eduLevelCondition = `AND m.edu_level IS NOT NULL`;
    }

    // 如果传入了 majorCodes，添加专业代码过滤条件
    if (codesArray && codesArray.length > 0) {
      // 生成参数占位符：$2, $3, $4, ... 或 $3, $4, $5, ...（取决于是否有 edu_level）
      const placeholders = codesArray
        .map(() => `$${paramIndex++}`)
        .join(', ');
      majorCodeCondition = `AND m.code IN (${placeholders})`;
      queryParams.push(...codesArray);
    }

    const sql = `
      WITH user_answers AS (
        SELECT 
          s.id as scale_id,
          sa.score as score,
          s.action
        FROM scales s
        INNER JOIN scale_answers sa ON sa.scale_id = s.id
        WHERE sa.user_id = $1 AND sa.scale_id > 112
      ),
      major_base_data AS (
        SELECT 
          md.code as major_code, 
          m.name as major_name,
          m.edu_level as edu_level,
          md.major_brief, 
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
        WHERE s.id > 112 ${eduLevelCondition} ${majorCodeCondition}
      ),
      type_scores AS (
        SELECT 
          major_code,
          major_name,
          edu_level,
          major_brief,
          type,
          potential_conversion_value,
          SUM(weighted_score) as type_score,
          SUM(total_possible_score) as type_total_score,
          ROUND(
            COALESCE(
              CAST(SUM(weighted_score) AS NUMERIC) / 
              NULLIF(CAST(SUM(total_possible_score) AS NUMERIC), 0),
              0
            )::NUMERIC, 
            2
          )::NUMERIC as type_ratio
        FROM major_base_data
        GROUP BY major_code, major_name, edu_level, major_brief, type, potential_conversion_value
      ),
      study_scores AS (
        SELECT 
          major_code,
          major_name,
          edu_level,
          major_brief, 
          ROUND(
            CAST(SUM(CASE WHEN type = 'lexue' THEN weighted_score ELSE 0 END) AS NUMERIC) /
            NULLIF(CAST(SUM(CASE WHEN type = 'lexue' THEN total_possible_score ELSE 0 END) AS NUMERIC), 0) * 0.5 * 100,
            2
          )::NUMERIC as lexue_score,
          ROUND(
            CAST(SUM(CASE WHEN type = 'shanxue' THEN weighted_score ELSE 0 END) AS NUMERIC) /
            NULLIF(CAST(SUM(CASE WHEN type = 'shanxue' THEN total_possible_score ELSE 0 END) AS NUMERIC), 0) * 0.5 * 100,
            2
          )::NUMERIC as shanxue_score 
        FROM major_base_data
        GROUP BY major_code, major_name, edu_level, major_brief
      ),
      deduction_scores AS (
        SELECT 
          ts.major_code,
          ROUND(MAX(CASE WHEN ts.type = 'tiaozhan' AND ts.type_score > 0 THEN 
            CASE 
              WHEN ts.potential_conversion_value = 'medium' THEN ts.type_ratio * 0.5 * 0.25 * 100
              WHEN ts.potential_conversion_value = 'low' THEN ts.type_ratio * 0.25 * 100
              ELSE 0 
            END 
          ELSE 0 END), 2)::NUMERIC as tiaozhan_deduction,
          ROUND(MAX(CASE WHEN ts.type = 'yanxue' AND ts.type_score > 0 THEN 
            CASE 
              WHEN ts.potential_conversion_value = 'medium' THEN ts.type_ratio * 0.5 * 0.25 * 100
              WHEN ts.potential_conversion_value = 'low' THEN ts.type_ratio * 0.25 * 100
              ELSE 0 
            END 
          ELSE 0 END), 2)::NUMERIC as yanxue_deduction
        FROM type_scores ts
        GROUP BY ts.major_code
      ),
      final_scores AS (
        SELECT 
          ss.major_code,
          ss.major_name,
          ss.edu_level,  
          ss.major_brief, 
          COALESCE(ss.lexue_score, 0) as lexue_score,
          COALESCE(ss.shanxue_score, 0) as shanxue_score,
          COALESCE(ds.yanxue_deduction, 0) as yanxue_deduction,
          COALESCE(ds.tiaozhan_deduction, 0) as tiaozhan_deduction,
          COALESCE(ss.lexue_score, 0) + COALESCE(ss.shanxue_score, 0) - (COALESCE(ds.tiaozhan_deduction, 0) + COALESCE(ds.yanxue_deduction, 0)) as base_score
        FROM study_scores ss
        JOIN deduction_scores ds ON ds.major_code = ss.major_code
      )
      SELECT 
        fs.major_code as "majorCode",
        fs.major_name as "majorName",
        fs.major_brief as "majorBrief",
        fs.edu_level as "eduLevel",
        fs.yanxue_deduction as "yanxueDeduction",
        fs.tiaozhan_deduction as "tiaozhanDeduction",
        ROUND(CAST(fs.base_score AS NUMERIC), 2)::NUMERIC as score,
        ROUND(CAST(fs.lexue_score AS NUMERIC), 2)::NUMERIC as "lexueScore",
        ROUND(CAST(fs.shanxue_score AS NUMERIC), 2)::NUMERIC as "shanxueScore"
      FROM final_scores fs
      ORDER BY score DESC
    `;

    const results = await this.popularMajorRepository.manager.query(
      sql,
      queryParams,
    );

    return results;
  }
}

