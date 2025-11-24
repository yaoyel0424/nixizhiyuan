import { Logger } from '@nestjs/common';

/**
 * 日志工具类
 * 提供统一的日志记录方法
 */
export class LoggerUtil {
  private static logger = new Logger('Application');

  /**
   * 记录错误日志
   * @param message 错误消息
   * @param trace 错误堆栈
   * @param context 上下文
   */
  static error(message: string, trace?: string, context?: string): void {
    this.logger.error(message, trace, context);
  }

  /**
   * 记录警告日志
   * @param message 警告消息
   * @param context 上下文
   */
  static warn(message: string, context?: string): void {
    this.logger.warn(message, context);
  }

  /**
   * 记录信息日志
   * @param message 信息消息
   * @param context 上下文
   */
  static log(message: string, context?: string): void {
    this.logger.log(message, context);
  }

  /**
   * 记录调试日志
   * @param message 调试消息
   * @param context 上下文
   */
  static debug(message: string, context?: string): void {
    this.logger.debug(message, context);
  }

  /**
   * 记录详细日志
   * @param message 详细消息
   * @param context 上下文
   */
  static verbose(message: string, context?: string): void {
    this.logger.verbose(message, context);
  }
}

