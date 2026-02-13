import { Injectable, Logger } from '@nestjs/common';
import * as XLSX from 'xlsx';
import type { GroupedChoiceResponseDto } from './dto/grouped-choice-response.dto';

/** 扁平化后的志愿行（用于 Excel 一行） */
interface ExcelRow {
  志愿序号: number;
  学校名称: string;
  专业组名称: string;
  专业名称: string;
  热爱能量: string;
  位次: string;
  批次: string;
  年份: string;
  选科: string;
  备注: string;
  招生人数: string;
  学制: string;
  学费: string;
  招生类型: string;
}

/**
 * Excel 导出服务（使用 xlsx/SheetJS）
 */
@Injectable()
export class ExcelExportService {
  private readonly logger = new Logger(ExcelExportService.name);

  /**
   * 将 findAll 接口的同构数据导出为 .xlsx Buffer
   * @param grouped 分组后的志愿数据（与 GroupedChoiceResponseDto 结构一致）
   * @returns xlsx 文件 Buffer
   */
  async generateChoiceExcel(grouped: GroupedChoiceResponseDto): Promise<Buffer> {
    const rows = this.flattenToRows(grouped);
    // 无数据时也保留表头：补一行空数据，使 json_to_sheet 能生成表头
    if (rows.length === 0) {
      rows.push({
        志愿序号: 0,
        学校名称: '',
        专业组名称: '',
        专业名称: '',
        热爱能量: '',
        位次: '',
        批次: '',
        年份: '',
        选科: '',
        备注: '',
        招生人数: '',
        学制: '',
        学费: '',
        招生类型: '',
      });
    }
    const ws = XLSX.utils.json_to_sheet(rows);
    // 列宽（热爱能量、位次为多行内容，设宽一些便于查看）
    ws['!cols'] = [
      { wch: 8 },
      { wch: 20 },
      { wch: 12 },
      { wch: 18 },
      { wch: 28 },
      { wch: 36 },
      { wch: 10 },
      { wch: 8 },
      { wch: 10 },
      { wch: 50 },
      { wch: 8 },
      { wch: 6 },
      { wch: 8 },
      { wch: 10 },
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '志愿列表');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    this.logger.log('Excel 生成成功，行数:', rows.length);
    return Buffer.from(buf);
  }

  /**
   * 将 volunteers 扁平化为「一行一个志愿」的数组
   */
  private flattenToRows(grouped: GroupedChoiceResponseDto): ExcelRow[] {
    const out: ExcelRow[] = [];
    const volunteers = (grouped.volunteers || []).sort(
      (a: any, b: any) => (a.mgIndex ?? 999999) - (b.mgIndex ?? 999999),
    );
    let volunteerIndex = 0;
    for (const v of volunteers) {
      volunteerIndex += 1;
      const school: { name?: string } = v.school || {};
      const schoolName = school.name ?? '';
      const majorGroups = v.majorGroups || [];
      for (const mg of majorGroups) {
        const mgName = mg.majorGroup?.mgName ?? '';
        const choices = (mg.choices || []).sort(
          (a: any, b: any) => (a.majorIndex ?? 999999) - (b.majorIndex ?? 999999),
        );
        for (const c of choices) {
          const scoreStr = this.formatScores(c.scores);
          const rankStr = this.formatMajorScores(c.majorScores);
          out.push({
            志愿序号: volunteerIndex,
            学校名称: schoolName,
            专业组名称: mgName,
            专业名称: c.enrollmentMajor ?? '',
            热爱能量: scoreStr,
            位次: rankStr,
            批次: c.batch ?? '',
            年份: c.year ?? '',
            选科: c.majorGroupInfo ?? '',
            备注: c.remark ?? '',
            招生人数: c.enrollmentQuota ?? '',
            学制: c.studyPeriod ?? '',
            学费: c.tuitionFee ?? '',
            招生类型: c.enrollmentType ?? '',
          });
        }
      }
    }
    return out;
  }

  /** scores 数组：一个单元格内多行显示，每行「专业名: 分数」 */
  private formatScores(
    scores: Array<{ majorName?: string; score?: number | null }> | undefined,
  ): string {
    if (!scores || !scores.length) return '';
    return scores
      .map((s) => (s.majorName ? `${s.majorName}: ${s.score ?? '-'}` : String(s.score ?? '-')))
      .join('\n');
  }

  /** majorScores 数组：一个单元格内多行显示，每行「年份: 分数, 位次, 位次描述」（不包含批次） */
  private formatMajorScores(
    majorScores: Array<{
      year?: string | null;
      minScore?: number | null;
      minRank?: number | null;
      rankDiff?: string;
    }> | undefined,
  ): string {
    if (!majorScores || !majorScores.length) return '';
    return majorScores
      .map(
        (m) =>
          `${m.year ?? ''}: 分数${m.minScore ?? '-'}, 位次${m.minRank ?? '-'}, ${m.rankDiff ?? '-'}`.trim(),
      )
      .join('\n');
  }
}
