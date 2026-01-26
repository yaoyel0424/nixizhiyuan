import { Injectable, Logger } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';

/**
 * PDF导出服务
 */
@Injectable()
export class PdfExportService {
  private readonly logger = new Logger(PdfExportService.name);

  /**
   * 生成志愿方案PDF
   * @param groupedChoices 分组后的志愿数据
   * @param examInfo 高考信息
   * @returns PDF Buffer
   */
  async generateWishlistPdf(
    groupedChoices: any,
    examInfo: any,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({
          size: 'A4',
          margin: 40,
        });

        const chunks: Buffer[] = [];

        doc.on('data', (chunk) => {
          chunks.push(chunk);
        });

        doc.on('end', () => {
          const pdfBuffer = Buffer.concat(chunks);
          // 验证PDF Buffer
          if (!pdfBuffer || pdfBuffer.length === 0) {
            this.logger.error('PDF Buffer为空');
            reject(new Error('PDF生成失败：Buffer为空'));
            return;
          }
          // 验证PDF文件头（PDF文件应该以 %PDF 开头）
          const pdfHeader = pdfBuffer.slice(0, 4).toString();
          if (pdfHeader !== '%PDF') {
            this.logger.error('PDF格式验证失败，文件头:', pdfHeader);
            reject(new Error('PDF生成失败：格式不正确'));
            return;
          }
          this.logger.log('PDF生成成功，大小:', pdfBuffer.length, 'bytes');
          resolve(pdfBuffer);
        });

        doc.on('error', (error) => {
          this.logger.error('PDF生成错误:', error);
          reject(error);
        });

        // 绘制标题
        doc
          .fontSize(24)
          .fillColor('#1A4099')
          .text('志愿方案', { align: 'center' })
          .moveDown(1);

        // 绘制高考信息
        if (examInfo) {
          doc.fontSize(12).fillColor('#333333');
          const examInfoLines: string[] = [];
          if (examInfo.province) examInfoLines.push(`省份: ${examInfo.province}`);
          if (examInfo.preferredSubjects) examInfoLines.push(`首选科目: ${examInfo.preferredSubjects}`);
          if (examInfo.secondarySubjects) examInfoLines.push(`次选科目: ${examInfo.secondarySubjects}`);
          if (examInfo.score) examInfoLines.push(`分数: ${examInfo.score}`);
          if (examInfo.rank) examInfoLines.push(`位次: ${examInfo.rank}`);

          if (examInfoLines.length > 0) {
            doc.text(examInfoLines.join(' | ')).moveDown(1);
          }
        }

        // 绘制志愿列表
        if (groupedChoices?.volunteers && groupedChoices.volunteers.length > 0) {
          const volunteers = groupedChoices.volunteers.sort(
            (a: any, b: any) => (a.mgIndex ?? 999999) - (b.mgIndex ?? 999999),
          );

          for (let i = 0; i < volunteers.length; i++) {
            const volunteer = volunteers[i];
            const volunteerNumber = i + 1;
            const school = volunteer.school;

            // 检查是否需要新页面
            const estimatedHeight = 200;
            if (doc.y + estimatedHeight > doc.page.height - 50) {
              doc.addPage();
            }

            // 绘制志愿卡片背景（使用矩形）
            const cardY = doc.y;
            doc
              .rect(40, cardY, doc.page.width - 80, estimatedHeight)
              .fillColor('#F5F5F5')
              .fill()
              .fillColor('#333333');

            // 绘制志愿编号
            doc
              .fontSize(16)
              .fillColor('#1A4099')
              .text(`志愿${volunteerNumber}`, 50, cardY + 10)
              .fillColor('#333333');

            // 绘制学校名称
            let currentY = cardY + 35;
            if (school?.name) {
              doc
                .fontSize(14)
                .text(school.name, 50, currentY, {
                  width: doc.page.width - 100,
                });
              currentY += 25;
            }

            // 绘制专业组
            if (volunteer.majorGroups && volunteer.majorGroups.length > 0) {
              doc.fontSize(12).fillColor('#666666');
              for (const majorGroup of volunteer.majorGroups) {
                const majorGroupName = majorGroup.majorGroup?.mgName || '';
                if (majorGroupName) {
                  doc.text(`专业组: ${majorGroupName}`, 50, currentY, {
                    width: doc.page.width - 100,
                  });
                  currentY += 20;
                }

                // 绘制专业列表（展开所有）
                if (majorGroup.choices && majorGroup.choices.length > 0) {
                  const sortedChoices = [...majorGroup.choices].sort(
                    (a: any, b: any) =>
                      (a.majorIndex ?? 999999) - (b.majorIndex ?? 999999),
                  );

                  doc.fontSize(11).fillColor('#333333');
                  for (const choice of sortedChoices) {
                    if (choice.enrollmentMajor) {
                      doc.text(`  • ${choice.enrollmentMajor}`, 50, currentY, {
                        width: doc.page.width - 100,
                      });
                      currentY += 18;
                    }
                  }
                }
              }
            }

            doc.moveDown(1.5);
          }
        } else {
          // 没有志愿数据
          doc
            .fontSize(16)
            .fillColor('#666666')
            .text('暂无志愿数据', { align: 'center' });
        }

        doc.end();
      } catch (error) {
        this.logger.error('PDF生成异常:', error);
        reject(error);
      }
    });
  }
}
