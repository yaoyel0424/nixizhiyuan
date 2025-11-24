/**
 * 日期工具函数
 */
export class DateUtil {
  /**
   * 获取当前时间戳（ISO 格式）
   * @returns ISO 格式的时间戳字符串
   */
  static getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * 格式化日期
   * @param date 日期对象或时间戳
   * @param format 格式化字符串，默认 'YYYY-MM-DD HH:mm:ss'
   * @returns 格式化后的日期字符串
   */
  static formatDate(
    date: Date | number,
    format: string = 'YYYY-MM-DD HH:mm:ss',
  ): string {
    const d = typeof date === 'number' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');

    return format
      .replace('YYYY', String(year))
      .replace('MM', month)
      .replace('DD', day)
      .replace('HH', hours)
      .replace('mm', minutes)
      .replace('ss', seconds);
  }

  /**
   * 计算两个日期之间的差值（毫秒）
   * @param startDate 开始日期
   * @param endDate 结束日期
   * @returns 差值（毫秒）
   */
  static getTimeDifference(startDate: Date, endDate: Date): number {
    return endDate.getTime() - startDate.getTime();
  }
}

