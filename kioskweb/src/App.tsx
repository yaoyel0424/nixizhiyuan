// 代码已包含 CSS：Tailwind + `styles/kiosk-app.css`（由 MasterGo / App copy 工具类等价抽出）

import React, { useEffect, useMemo, useState } from 'react';

import imgDecorCloud from './assets/1776429819509a3K9mP2xQ7vN4rT8wY.jpg';
import imgDecorLeaf from './assets/1776429819509b4L8nQ3yR6sU9vW1xZ.jpg';
import imgEmptyHint from './assets/empty-state-hint.jpg';
import { CHINA_PROVINCES, DEFAULT_PROVINCE } from './data/china-provinces';

/** 与本地 mock 一致的专业大类结构（筛选函数入参） */
type MajorCategoryBlock = {
  name: string;
  count: number;
  subCategories: Array<{
    name: string;
    count: number;
    majors: string[];
  }>;
};

/**
 * 按关键词过滤专业树：大类名、小类名或具体专业名命中（子串）即保留。
 * @param blocks 当前 Tab 下的专业大类列表
 * @param query 用户输入，首尾空白不参与匹配
 */
function filterMajorCategories(blocks: MajorCategoryBlock[], query: string): MajorCategoryBlock[] {
  const q = query.trim();
  if (!q) {
    return blocks;
  }

  const next: MajorCategoryBlock[] = [];

  for (const major of blocks) {
    if (major.name.includes(q)) {
      next.push(major);
      continue;
    }

    const subs: MajorCategoryBlock['subCategories'] = [];

    for (const sub of major.subCategories) {
      if (sub.name.includes(q)) {
        subs.push(sub);
        continue;
      }

      const majorsHit = sub.majors.filter((name) => name.includes(q));
      if (majorsHit.length > 0) {
        subs.push({
          ...sub,
          majors: majorsHit,
          count: majorsHit.length
        });
      }
    }

    if (subs.length > 0) {
      next.push({
        ...major,
        subCategories: subs,
        count: subs.reduce((acc, sub) => acc + sub.majors.length, 0)
      });
    }
  }

  return next;
}

/** 本地演示用专业列表（含本科 / 职业本科 / 专科） */
const mockResults = {
    本科: [
      {
        name: '工学类',
        count: 12,
        subCategories: [
          {
            name: '计算机类',
            count: 3,
            majors: ['计算机科学与技术', '软件工程', '网络工程']
          },
          {
            name: '机械类',
            count: 2,
            majors: ['机械工程', '工业设计']
          }
        ]
      },
      {
        name: '理学类',
        count: 8,
        subCategories: [
          {
            name: '数学类',
            count: 2,
            majors: ['数学与应用数学', '信息与计算科学']
          },
          {
            name: '物理学类',
            count: 1,
            majors: ['物理学']
          }
        ]
      },
      {
        name: '文学类',
        count: 5,
        subCategories: [
          {
            name: '外国语言文学类',
            count: 3,
            majors: ['英语', '日语', '法语']
          }
        ]
      }
    ],
    职业本科: [
      {
        name: '工程技术类',
        count: 6,
        subCategories: [
          {
            name: '智能制造类',
            count: 2,
            majors: ['智能制造工程技术', '自动化技术与应用']
          }
        ]
      }
    ],
    专科: [
      {
        name: '电子信息类',
        count: 4,
        subCategories: [
          {
            name: '计算机类',
            count: 2,
            majors: ['计算机应用技术', '软件技术']
          }
        ]
      },
      {
        name: '财经商贸类',
        count: 7,
        subCategories: [
          {
            name: '财务会计类',
            count: 3,
            majors: ['大数据与会计', '财务管理', '会计信息管理']
          }
        ]
      }
    ]
};

/**
 * 新高考选科助手主界面：左侧筛选项、右侧专业结果与专业搜索（当前为本地 mock 数据演示）。
 */
const App: React.FC = () => {
  const [selectedProvince, setSelectedProvince] = useState<string>(DEFAULT_PROVINCE);
  const [provinceModalOpen, setProvinceModalOpen] = useState(false);
  /** 首选：物理 / 历史 二选一（互斥），再点同一项可取消 */
  const [firstSubject, setFirstSubject] = useState<'物理' | '历史' | null>(null);
  /** 次选：化学 / 生物 / 政治 / 地理 四选二（至多 2 项） */
  const [secondSubjects, setSecondSubjects] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'本科' | '职业本科' | '专科'>('本科');
  const [expandedMajor, setExpandedMajor] = useState<string | null>(null);
  const [isSearching, setIsSearching] = useState<boolean>(false);
  /** 用户完成至少一次「开始匹配查询」后才展示右侧统计、Tab 与专业列表 */
  const [resultsUnlocked, setResultsUnlocked] = useState(false);
  /** 专业列表关键词（右侧顶部搜索，适配大屏触控） */
  const [majorQuery, setMajorQuery] = useState('');
  /**
   * 有关键词时：每个大类独立可展开/收起（与无搜索时的手风琴 `expandedMajor` 分离）。
   * 关键词或筛选结果变化时由 effect 同步为「当前列表项默认全部展开」。
   */
  const [searchExpandedNames, setSearchExpandedNames] = useState<string[]>([]);

  /** 按 Escape 关闭省份弹窗 */
  useEffect(() => {
    if (!provinceModalOpen) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setProvinceModalOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [provinceModalOpen]);

  const firstSubjectsOptions = ['物理', '历史'] as const;
  const secondSubjectsOptions = ['化学', '生物', '政治', '地理'];

  /** 首选二选一：点另一项会切换选中；再点当前选中项则清空 */
  const handleFirstSubjectClick = (subject: '物理' | '历史') => {
    setFirstSubject((prev) => (prev === subject ? null : subject));
  };

  /** 次选四选二：未选中且已满 2 个时不增加；再点已选项可取消 */
  const MAX_SECOND_SUBJECTS = 2;

  const handleSecondSubjectToggle = (subject: string) => {
    setSecondSubjects((prev) => {
      if (prev.includes(subject)) {
        return prev.filter((s) => s !== subject);
      }
      if (prev.length >= MAX_SECOND_SUBJECTS) {
        return prev;
      }
      return [...prev, subject];
    });
  };

  /**
   * 开始匹配：加载结束后解锁结果区；默认展开第一项由 `resultsUnlocked` 的 effect 统一处理。
   */
  const handleSearch = () => {
    setIsSearching(true);
    setTimeout(() => {
      setIsSearching(false);
      setResultsUnlocked(true);
    }, 2000);
  };

  /** 按搜索框关键词过滤后的列表（含大类 / 小类 / 专业名匹配） */
  const filteredResults = useMemo(() => {
    return filterMajorCategories(mockResults[activeTab] as MajorCategoryBlock[], majorQuery);
  }, [activeTab, majorQuery]);

  /** 与下方统计卡片一致的汇总数字（随筛选变化） */
  const { totalMajors, totalSubCategories, totalSpecialties } = useMemo(() => {
    let majors = 0;
    let subCategories = 0;
    let specialties = 0;
    filteredResults.forEach((major) => {
      majors++;
      subCategories += major.subCategories.length;
      major.subCategories.forEach((sub) => {
        specialties += sub.majors.length;
      });
    });
    return {
      totalMajors: majors,
      totalSubCategories: subCategories,
      totalSpecialties: specialties
    };
  }, [filteredResults]);

  /** 切换学历 Tab 后，若已解锁则重新默认展开该 Tab 第一个大类 */
  useEffect(() => {
    if (!resultsUnlocked) {
      return;
    }
    const list = mockResults[activeTab];
    setExpandedMajor(list[0]?.name ?? null);
  }, [activeTab, resultsUnlocked]);

  const searchTrimmed = majorQuery.trim();

  /**
   * 关键词或筛选结果变化时：当前列表中的大类默认全部展开。
   * 同一关键词下用户可单独收起某行；仅当词/结果集变化时重置展开集。
   */
  useEffect(() => {
    const q = majorQuery.trim();
    if (!q) {
      setSearchExpandedNames([]);
      return;
    }
    setSearchExpandedNames(filteredResults.map((m) => m.name));
  }, [majorQuery, filteredResults]);

  /**
   * 某个大类下的专业树是否展开。
   * @param majorName 大类名称
   */
  const isMajorRowExpanded = (majorName: string) => {
    if (searchTrimmed.length > 0) {
      return searchExpandedNames.includes(majorName);
    }
    return expandedMajor === majorName;
  };

  return (
    <div className="kiosk-app-root" data-province-options={CHINA_PROVINCES.length}>
      {/* Background decorative elements */}
      <div className="kiosk-app-decor-cloud">
        <img src={imgDecorCloud} alt="cloud" className="kiosk-app-decor-img" />
      </div>

      <div className="kiosk-app-decor-leaf">
        <img src={imgDecorLeaf} alt="leaf" className="kiosk-app-decor-img" />
      </div>

      <div className="kiosk-app-decor-glow"></div>

      <div className="kiosk-app-main-row">
        {/* 左侧第 1 行：标题（右侧对应格留空，便于与下方卡片区对齐） */}
        <div className="kiosk-app-grid-intro">
          <div className="kiosk-app-intro">
            <h1 className="kiosk-app-title">新高考选科助手</h1>
            <p className="kiosk-app-subtitle">探索你的未来专业，从这里开始</p>
          </div>
        </div>

        {/* 左侧第 2 行：三张筛选卡片（高度即用户期望的「右侧空白区」参照） */}
        <div className="kiosk-app-grid-cards-column">
          {/* Province Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label">选择省份</label>
            <div
              className="kiosk-app-province-row"
              role="button"
              tabIndex={0}
              onClick={() => setProvinceModalOpen(true)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  setProvinceModalOpen(true);
                }
              }}
            >
              <span className="kiosk-app-province-text">{selectedProvince}</span>
              <i className="fas fa-map-marker-alt kiosk-app-icon-marker"></i>
            </div>
          </div>

          {/* First Subject Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label-spaced">首选科目（二选一）</label>
            <div className="kiosk-app-grid-2">
              {firstSubjectsOptions.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  className={`kiosk-app-btn-first-subject ${
                    subject === '物理'
                      ? firstSubject === subject
                        ? 'kiosk-app-btn-first-subject--physics-on'
                        : 'kiosk-app-btn-first-subject--physics-off'
                      : firstSubject === subject
                        ? 'kiosk-app-btn-first-subject--history-on'
                        : 'kiosk-app-btn-first-subject--history-off'
                  }`}
                  onClick={() => handleFirstSubjectClick(subject)}
                >
                  {subject}
                  {firstSubject === subject && (
                    <i className="fas fa-check ml-2 opacity-90"></i>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Second Subject Selection */}
          <div className="kiosk-app-card">
            <label className="kiosk-app-label-spaced">次选科目（四选二）</label>
            <div className="kiosk-app-grid-2">
              {secondSubjectsOptions.map((subject) => (
                <button
                  key={subject}
                  type="button"
                  className={`kiosk-app-btn-second-subject ${
                    secondSubjects.includes(subject)
                      ? 'kiosk-app-btn-second-subject--on'
                      : 'kiosk-app-btn-second-subject--off'
                  }`}
                  onClick={() => handleSecondSubjectToggle(subject)}
                >
                  {subject}
                  {secondSubjects.includes(subject) && (
                    <i className="fas fa-check ml-2 text-green-600"></i>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 左侧第 3 行：占位，把查询按钮顶到底部 */}
        <div className="kiosk-app-grid-spacer-left" aria-hidden />

        {/* 左侧第 4 行：查询按钮 */}
        <div className="kiosk-app-grid-search-wrap">
          <button type="button" className="kiosk-app-btn-search" onClick={handleSearch}>
            开始匹配查询
          </button>
        </div>

        {/* 右侧：未解锁时仅占用与「三张卡片」同行的网格行等高；解锁后向下延伸占满剩余主区域 */}
        <div
          className={`kiosk-app-right ${
            resultsUnlocked && !isSearching ? 'kiosk-app-right--expanded' : 'kiosk-app-right--compact'
          }`}
        >
          {/* 首次查询完成前不显示统计与 Tab；匹配中同样隐藏 */}
          {resultsUnlocked && !isSearching && (
            <>
              {/* 专业搜索：大屏触控、与统计卡同宽，基准 1920×1080 横向 16:9 */}
              <div className="kiosk-app-major-search">
                <div className="kiosk-app-major-search__inner">
                  <i className="fas fa-search kiosk-app-major-search__icon" aria-hidden />
                  <input
                    type="search"
                    value={majorQuery}
                    onChange={(event) => setMajorQuery(event.target.value)}
                    placeholder="搜索专业名称..."
                    className="kiosk-app-major-search__input"
                    aria-label="搜索专业名称"
                    autoComplete="off"
                    enterKeyHint="search"
                  />
                </div>
              </div>

              {/* Stats Overview */}
              <div className="kiosk-app-stats-row">
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-cyan">{totalMajors}</div>
                  <div className="kiosk-app-stat-caption">个大类</div>
                </div>
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-green">{totalSubCategories}</div>
                  <div className="kiosk-app-stat-caption">个小类</div>
                </div>
                <div className="kiosk-app-stat-card">
                  <div className="kiosk-app-stat-value-purple">{totalSpecialties}</div>
                  <div className="kiosk-app-stat-caption">个专业</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="kiosk-app-tabs-bar">
                {(['本科', '职业本科', '专科'] as const).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    className={`kiosk-app-tab-btn ${activeTab === tab ? 'kiosk-app-tab-btn--active' : ''}`}
                    onClick={() => setActiveTab(tab)}
                  >
                    {tab}
                    {activeTab === tab && <div className="kiosk-app-tab-underline"></div>}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 默认空状态；查询中加载；解锁后展示列表 */}
          <div className="kiosk-app-results-scroll">
            {isSearching ? (
              <div className="kiosk-app-loading-wrap">
                <div className="kiosk-app-loading-emoji">☁️</div>
                <p className="kiosk-app-loading-text">正在为您匹配专业...</p>
              </div>
            ) : !resultsUnlocked ? (
              <div className="kiosk-app-empty-state">
                <div className="kiosk-app-empty-state__card">
                  <img
                    src={imgEmptyHint}
                    alt=""
                    className="kiosk-app-empty-state__pic"
                  />
                  <p className="kiosk-app-empty-state__title">请在左侧选择科目</p>
                  <p className="kiosk-app-empty-state__subtitle">
                    开启您的专业探索之旅
                  </p>
                </div>
              </div>
            ) : (
              <div className="kiosk-app-results-list">
                {filteredResults.length === 0 ? (
                  <div className="kiosk-app-results-filter-empty">
                    <p className="kiosk-app-results-filter-empty__text">
                      未找到匹配的专业，请尝试其他关键词
                    </p>
                  </div>
                ) : (
                  filteredResults.map((major) => (
                  <div key={major.name} className="kiosk-app-major-card">
                    <div
                      className="kiosk-app-major-header"
                      onClick={() => {
                        if (searchTrimmed.length > 0) {
                          setSearchExpandedNames((prev) =>
                            prev.includes(major.name)
                              ? prev.filter((n) => n !== major.name)
                              : [...prev, major.name]
                          );
                          return;
                        }
                        setExpandedMajor((prev) =>
                          prev === major.name ? null : major.name
                        );
                      }}
                    >
                      <h3 className="kiosk-app-major-title">{major.name}</h3>
                      <div className="kiosk-app-major-header-aside">
                        <span className="kiosk-app-major-meta">
                          {major.subCategories.length} 个小类
                        </span>
                        <i
                          className={`fas fa-chevron-down kiosk-app-chevron ${
                            isMajorRowExpanded(major.name) ? 'rotate-180' : ''
                          }`}
                        ></i>
                      </div>
                    </div>

                    {isMajorRowExpanded(major.name) && (
                      <div className="kiosk-app-major-divider">
                        {major.subCategories.map((subCategory) => (
                          <div key={subCategory.name} className="kiosk-app-subcategory-block">
                            <h4 className="kiosk-app-subcategory-title">{subCategory.name}</h4>
                            <div className="kiosk-app-major-rows">
                              {subCategory.majors.map((majorName) => (
                                <div key={majorName} className="kiosk-app-major-row">
                                  <div className="kiosk-app-major-name">{majorName}</div>
                                  <div className="kiosk-app-major-actions">
                                    <button className="kiosk-app-action-view">
                                      <i className="fas fa-eye mr-1"></i> 查看
                                    </button>
                                    <button className="kiosk-app-action-self">
                                      <i className="fas fa-file-alt mr-1"></i> 自测
                                    </button>
                                    <button className="kiosk-app-action-school">
                                      <i className="fas fa-university mr-1"></i> 院校
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 选择省份对话框 */}
      {provinceModalOpen && (
        <div
          className="kiosk-province-overlay"
          role="presentation"
          onClick={() => setProvinceModalOpen(false)}
        >
          <div
            className="kiosk-province-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="kiosk-province-dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="kiosk-province-dialog__head">
              <h2 id="kiosk-province-dialog-title" className="kiosk-province-dialog__title">
                选择省份
              </h2>
            </div>
            <div className="kiosk-province-dialog__body">
              <div className="kiosk-province-dialog__grid">
                {CHINA_PROVINCES.map((name) => (
                  <button
                    key={name}
                    type="button"
                    className={`kiosk-province-dialog__item ${
                      selectedProvince === name ? 'kiosk-province-dialog__item--active' : ''
                    }`}
                    onClick={() => {
                      setSelectedProvince(name);
                      setProvinceModalOpen(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
            <div className="kiosk-province-dialog__foot">
              <button
                type="button"
                className="kiosk-province-dialog__cancel"
                onClick={() => setProvinceModalOpen(false)}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
