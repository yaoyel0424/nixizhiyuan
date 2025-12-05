-- 创建省份表
-- 表名: provinces
-- 说明: 存储全国各省、自治区、直辖市的基本信息和特色描述

CREATE TABLE IF NOT EXISTS provinces (
  -- 省份代码（主键，使用国家标准的省份代码）
  id INTEGER PRIMARY KEY,
  
  -- 省份名称
  name VARCHAR(50) NOT NULL,
  
  -- 省份类型（如：直辖市、华北地区、华东地区等）
  type VARCHAR(50) NOT NULL,
  
  -- 总体印象
  overall_impression TEXT NULL,
  
  -- 生活成本
  living_cost TEXT NULL,
  
  -- 适合人群
  suitable_person TEXT NULL,
  
  -- 不适合人群
  unsuitable_person TEXT NULL,
  
  -- 重点产业
  key_industries TEXT NULL,
  
  -- 典型雇主
  typical_employers TEXT NULL,
  
  -- 记录创建时间
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 记录最后更新时间
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_provinces_name ON provinces(name);
CREATE INDEX IF NOT EXISTS idx_provinces_type ON provinces(type);

-- 添加表和字段注释
COMMENT ON TABLE provinces IS '省份表 - 存储全国各省、自治区、直辖市的基本信息和特色描述';
COMMENT ON COLUMN provinces.id IS '省份代码（主键，使用国家标准的省份代码）';
COMMENT ON COLUMN provinces.name IS '省份名称';
COMMENT ON COLUMN provinces.type IS '省份类型（如：直辖市、华北地区、华东地区等）';
COMMENT ON COLUMN provinces.overall_impression IS '总体印象描述';
COMMENT ON COLUMN provinces.living_cost IS '生活成本描述';
COMMENT ON COLUMN provinces.suitable_person IS '适合人群描述';
COMMENT ON COLUMN provinces.unsuitable_person IS '不适合人群描述';
COMMENT ON COLUMN provinces.key_industries IS '重点产业描述';
COMMENT ON COLUMN provinces.typical_employers IS '典型雇主描述';
COMMENT ON COLUMN provinces.created_at IS '记录创建时间';
COMMENT ON COLUMN provinces.updated_at IS '记录最后更新时间';

-- 创建触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_provinces_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在更新记录时自动更新 updated_at 字段
CREATE TRIGGER trigger_update_provinces_updated_at
  BEFORE UPDATE ON provinces
  FOR EACH ROW
  EXECUTE FUNCTION update_provinces_updated_at();

