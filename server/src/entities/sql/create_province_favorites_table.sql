-- 创建省份收藏表
-- 表名: province_favorites
-- 说明: 存储用户收藏的省份信息

CREATE TABLE IF NOT EXISTS province_favorites (
  -- 收藏记录唯一标识符 (自增长ID)
  id SERIAL PRIMARY KEY,
  
  -- 关联用户ID
  user_id INTEGER NOT NULL,
  
  -- 关联省份ID
  province_id INTEGER NOT NULL,
  
  -- 记录创建时间
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 记录最后更新时间
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- 外键约束：关联到 users 表的 id 字段
  CONSTRAINT fk_province_favorites_user_id 
    FOREIGN KEY (user_id) 
    REFERENCES users(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  
  -- 外键约束：关联到 provinces 表的 id 字段
  CONSTRAINT fk_province_favorites_province_id 
    FOREIGN KEY (province_id) 
    REFERENCES provinces(id) 
    ON DELETE CASCADE 
    ON UPDATE CASCADE,
  
  -- 唯一约束：确保同一用户不能重复收藏同一省份
  CONSTRAINT uk_province_favorites_user_province 
    UNIQUE (user_id, province_id)
);

-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_province_favorites_user_id ON province_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_province_favorites_province_id ON province_favorites(province_id);
CREATE INDEX IF NOT EXISTS idx_province_favorites_user_province ON province_favorites(user_id, province_id);

-- 添加表和字段注释
COMMENT ON TABLE province_favorites IS '省份收藏表 - 存储用户收藏的省份信息';
COMMENT ON COLUMN province_favorites.id IS '收藏记录唯一标识符 (自增长ID)';
COMMENT ON COLUMN province_favorites.user_id IS '关联用户ID';
COMMENT ON COLUMN province_favorites.province_id IS '关联省份ID';
COMMENT ON COLUMN province_favorites.created_at IS '收藏时间';
COMMENT ON COLUMN province_favorites.updated_at IS '最后更新时间';

-- 创建触发器函数：自动更新 updated_at 字段
CREATE OR REPLACE FUNCTION update_province_favorites_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 创建触发器：在更新记录时自动更新 updated_at 字段
CREATE TRIGGER trigger_update_province_favorites_updated_at
  BEFORE UPDATE ON province_favorites
  FOR EACH ROW
  EXECUTE FUNCTION update_province_favorites_updated_at();

