import { Injectable } from '@nestjs/common';
import { ScalesService } from '@/scales/scales.service';
import { Scale } from '@/entities/scale.entity';

/**
 * 转义 HTML 防止 XSS
 */
function escapeHtml(s: string | null | undefined): string {
  if (s == null) return '';
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(s).replace(/[&<>"']/g, (ch) => map[ch] ?? ch);
}

/**
 * HTML 页面生成服务
 * 用于后台展示 scale 与 option 并提供登录与修改
 */
@Injectable()
export class HtmlService {
  constructor(private readonly scalesService: ScalesService) {}

  /**
   * 获取量表列表（含 options），用于后台 HTML
   */
  async getScalesWithOptions(): Promise<Scale[]> {
    return this.scalesService.getScalesWithOptions('168');
  }

  /**
   * 生成登录页 HTML
   */
  buildLoginPage(apiPrefix: string, errorMessage?: string): string {
    const err = errorMessage ? `<p class="error">${escapeHtml(errorMessage)}</p>` : '';
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>量表管理 - 登录</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; max-width: 400px; margin: 2rem auto; padding: 0 1rem; }
    h1 { font-size: 1.25rem; }
    input { width: 100%; padding: 0.5rem; margin: 0.5rem 0; }
    button { padding: 0.5rem 1rem; background: #333; color: #fff; border: none; cursor: pointer; margin-top: 0.5rem; }
    .error { color: #c00; font-size: 0.9rem; }
  </style>
</head>
<body>
  <h1>量表管理</h1>
  ${err}
  <form method="post" action="/${escapeHtml(apiPrefix)}/html/login">
    <label>密钥</label>
    <input type="password" name="secret" required placeholder="请输入管理密钥">
    <button type="submit">登录</button>
  </form>
</body>
</html>`;
  }

  /**
   * 生成量表管理页 HTML（已登录，含 scale 列表与编辑表单）
   */
  buildScalesPage(scales: Scale[], apiPrefix: string): string {
    const list = scales
      .map(
        (scale) => {
          const contentEscaped = escapeHtml(scale.content);
          const optionsHtml = (scale.options || [])
            .map(
              (opt) => `
        <tr>
          <td><textarea data-option-id="${opt.id}" data-field="optionName" rows="2" style="width:100%">${escapeHtml(opt.optionName)}</textarea></td>
          <td><textarea data-option-id="${opt.id}" data-field="additionalInfo" rows="2" style="width:100%">${escapeHtml(opt.additionalInfo ?? '')}</textarea></td>
          <td class="col-action"><button type="button" class="btn-save-option" data-option-id="${opt.id}">保存选项</button></td>
        </tr>`,
            )
            .join('');
          return `
    <div class="scale-block" data-scale-id="${scale.id}">
      <h2>#${scale.id} ${escapeHtml(scale.element?.name ?? scale.dimension + ' - ' + scale.type)}</h2>
      <div class="scale-content">
        <label>题干</label>
        <textarea data-scale-id="${scale.id}" data-field="content" rows="2" style="width:100%">${contentEscaped}</textarea>
        <button type="button" class="btn-save-content" data-scale-id="${scale.id}">保存题干</button>
      </div>
      <table class="options-table">
        <thead><tr><th>optionName</th><th>additionalInfo</th><th>操作</th></tr></thead>
        <tbody>${optionsHtml}</tbody>
      </table>
    </div>`;
        },
      )
      .join('');

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>量表管理</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; max-width: 900px; margin: 0 auto; padding: 1rem; }
    h1 { font-size: 1.25rem; }
    .scale-block { border: 1px solid #ccc; margin: 1rem 0; padding: 1rem; }
    .scale-block h2 { font-size: 1rem; margin-top: 0; }
    .options-table { width: 100%; border-collapse: collapse; margin-top: 0.5rem; table-layout: fixed; }
    .options-table th, .options-table td { border: 1px solid #ddd; padding: 0.25rem 0.5rem; text-align: left; vertical-align: top; }
    .options-table th:nth-child(1), .options-table td:nth-child(1) { width: 27%; }
    .options-table th:nth-child(2), .options-table td:nth-child(2) { width: calc(73% - 4.5em); }
    .options-table th:nth-child(3), .options-table td.col-action { width: 4.5em; white-space: nowrap; padding: 0; margin: 0; text-align: center; vertical-align: middle; }
    textarea { font-family: inherit; resize: none; min-height: 2.5em; overflow-y: hidden; }
    button { padding: 0.25rem 0.5rem; background: #333; color: #fff; border: none; cursor: pointer; font-size: 0.85rem; }
    button:hover { background: #555; }
    .msg { margin: 0.25rem 0; font-size: 0.85rem; }
    .msg.ok { color: #080; }
    .msg.err { color: #c00; }
    .logout { margin-bottom: 1rem; }
  </style>
</head>
<body>
  <h1>量表管理</h1>
  <p class="logout"><a href="/${escapeHtml(apiPrefix)}/html/logout">退出登录</a></p>
  <div id="msg"></div>
  <div id="list">${list}</div>
  <script src="/${escapeHtml(apiPrefix)}/html/scales.js"></script>
</body>
</html>`;
  }

  /**
   * 返回量表管理页用的外部脚本（避免内联脚本被 CSP 等拦截）
   * 脚本从自身 src 解析出 API_BASE，再绑定保存按钮事件
   */
  getScalesScript(): string {
    return `
(function() {
  var scriptEl = document.currentScript;
  var src = (scriptEl && (scriptEl.getAttribute('src') || scriptEl.src)) || '';
  var match = src.match(/(.*)\\/html\\/scales\\.js/);
  var API_BASE = match ? match[1] : '';

  function showMsg(text, isErr) {
    var el = document.getElementById('msg');
    if (el) { el.className = 'msg ' + (isErr ? 'err' : 'ok'); el.textContent = text; }
  }

  function fitTextareaHeight(ta) {
    ta.style.height = 'auto';
    ta.style.height = ta.scrollHeight + 'px';
  }

  function initTextareaAutoHeight() {
    var list = document.getElementById('list');
    if (!list) return;
    var areas = list.querySelectorAll('textarea');
    areas.forEach(function(ta) {
      fitTextareaHeight(ta);
      ta.addEventListener('input', function() { fitTextareaHeight(ta); });
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTextareaAutoHeight);
  } else {
    initTextareaAutoHeight();
  }

  function onListClick(e) {
    var btn = e.target && e.target.closest ? e.target.closest('.btn-save-content') : null;
    if (btn) {
      e.preventDefault();
      var scaleId = btn.getAttribute('data-scale-id');
      var block = btn.closest('.scale-block');
      var textarea = block ? block.querySelector('textarea[data-field="content"]') : null;
      if (!textarea) return;
      var content = textarea.value;
      fetch(API_BASE + '/scales/' + scaleId + '/content', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content })
      }).then(function(r) {
        if (r.ok) { showMsg('题干已保存'); return; }
        return r.json().then(function(d) { throw new Error(d.message || d.error || '保存失败'); });
      }).catch(function(err) { showMsg(err && err.message ? err.message : '保存失败', true); });
      return;
    }
    btn = e.target && e.target.closest ? e.target.closest('.btn-save-option') : null;
    if (btn) {
      e.preventDefault();
      var optionId = btn.getAttribute('data-option-id');
      var row = btn.closest('tr');
      if (!row) return;
      var optionNameInp = row.querySelector('textarea[data-field="optionName"]');
      var additionalInp = row.querySelector('textarea[data-field="additionalInfo"]');
      var optionName = optionNameInp ? optionNameInp.value : '';
      var additionalInfo = additionalInp ? additionalInp.value : '';
      fetch(API_BASE + '/scales/options/' + optionId, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionName: optionName,
          additionalInfo: additionalInfo || null
        })
      }).then(function(r) {
        if (r.ok) { showMsg('选项已保存'); return; }
        return r.json().then(function(d) { throw new Error(d.message || d.error || '保存失败'); });
      }).catch(function(err) { showMsg(err && err.message ? err.message : '保存失败', true); });
    }
  }

  var listEl = document.getElementById('list');
  if (listEl) listEl.addEventListener('click', onListClick);
})();
`.trim();
  }
}
