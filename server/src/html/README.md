# 后台 HTML 模块

在浏览器中直接打开量表管理页：展示 scale 与 option，支持登录后修改题干与选项。

## 环境变量

- **ADMIN_HTML_SECRET**（必填）：管理密钥，登录时输入此密钥方可进入管理页。
- **ADMIN_HTML_USER_ID**（可选）：登录后 JWT 的 `sub`，默认 `1`，仅用于鉴权通过，可不对应真实用户。

## 访问方式

- 管理页（未登录会显示登录表单）：`GET /api/v1/html/scales`
- 登录：在页面提交密钥，或 `POST /api/v1/html/login`，Body `secret=xxx`
- 退出：`GET /api/v1/html/logout` 或页内「退出登录」链接

修改题干、选项名、附加信息后点击对应「保存」按钮，会调用现有 PATCH 接口（依赖 cookie 中的 JWT）。
