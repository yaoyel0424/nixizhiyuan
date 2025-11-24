/**
 * 日志接口定义
 */
export interface ILogger {
  error(message: string, trace?: string, context?: string): void;
  warn(message: string, context?: string): void;
  log(message: string, context?: string): void;
  debug(message: string, context?: string): void;
  verbose(message: string, context?: string): void;
}

