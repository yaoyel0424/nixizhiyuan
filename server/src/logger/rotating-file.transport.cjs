'use strict';

/**
 * Pino 按大小轮转的日志 transport
 * 单文件超过 size 后自动新建文件，并保留最近 maxFiles 个轮转文件
 * 供 nestjs-pino 在 worker 中加载，options 由主线程传入（需可序列化）
 */
const rfs = require('rotating-file-stream');
const path = require('path');

module.exports = function (opts) {
  const logsDir = opts.logsDir || path.join(process.cwd(), 'logs');
  const size = opts.size || '20M';
  const maxFiles = opts.maxFiles != null ? opts.maxFiles : 5;
  const baseName = opts.baseName || 'app';

  const stream = rfs.createStream(`${baseName}.log`, {
    path: logsDir,
    size,
    maxFiles,
  });

  return stream;
};
