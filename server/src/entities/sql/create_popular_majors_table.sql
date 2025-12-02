-- 创建热门专业表
-- 表名: popular_majors
-- 说明: 存储热门专业的详细信息，与专业详情表(major_details)通过专业代码进行一对一关联

CREATE TABLE IF NOT EXISTS popular_majors (
  -- 热门专业唯一标识符 (自增长ID)
  id SERIAL PRIMARY KEY,
  
  -- 专业名称
  name VARCHAR(100) NOT NULL,
  
  -- 教育层次 (如：ben, zhuan, gao_ben)
  level1 VARCHAR(20) NOT NULL,
  
  -- 专业代码 (关联专业详情表major_details的code字段，外键)
  code VARCHAR(10) NOT NULL UNIQUE,
  
  -- 授予学位 (如：理学学士,工学学士)
  degree VARCHAR(100) NULL,
  
  -- 学制年限 (如：四年、三年)
  limit_year VARCHAR(20) NULL,
  
  -- 平均薪资
  average_salary VARCHAR(20) NULL,
  
  -- 五年平均薪资
  five_average_salary DECIMAL(10, 2) NOT NULL DEFAULT 0,
  
  -- 记录创建时间
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 记录最后更新时间
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束：关联到 major_details 表的 code 字段
  -- 注意：确保 major_details 表已存在且 code 字段有唯一索引
  CONSTRAINT fk_popular_majors_major_detail_code 
    FOREIGN KEY (code) 
    REFERENCES major_details(code) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_popular_majors_code ON popular_majors(code);
CREATE INDEX IF NOT EXISTS idx_popular_majors_level1 ON popular_majors(level1);

-- 添加表和字段注释
COMMENT ON TABLE popular_majors IS '热门专业表 - 存储热门专业的详细信息，与专业详情表(major_details)通过专业代码进行一对一关联';
COMMENT ON COLUMN popular_majors.id IS '热门专业唯一标识符 (自增长ID)';
COMMENT ON COLUMN popular_majors.name IS '专业名称';
COMMENT ON COLUMN popular_majors.level1 IS '教育层次（ben: 本科, zhuan: 专科, gao_ben: 高职本科）';
COMMENT ON COLUMN popular_majors.code IS '专业代码，关联专业详情表(major_details)的code字段，外键';
COMMENT ON COLUMN popular_majors.degree IS '授予学位（如：理学学士,工学学士）';
COMMENT ON COLUMN popular_majors.limit_year IS '学制年限（如：四年、三年）';
COMMENT ON COLUMN popular_majors.average_salary IS '平均薪资';
COMMENT ON COLUMN popular_majors.five_average_salary IS '五年平均薪资';
COMMENT ON COLUMN popular_majors.created_at IS '记录创建时间';
COMMENT ON COLUMN popular_majors.updated_at IS '记录最后更新时间';

-- 创建触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_popular_majors_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在更新记录时自动更新 updated_at 字段
CREATE TRIGGER trigger_update_popular_majors_updated_at
  BEFORE UPDATE ON popular_majors
  FOR EACH ROW
  EXECUTE FUNCTION update_popular_majors_updated_at();

