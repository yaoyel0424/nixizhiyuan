/**
 * 高考模式类型定义
 */
export enum GaoKaoMode {
  MODE_3_3 = '3+3',       // 3+3模式
  MODE_3_1_2 = '3+1+2',   // 3+1+2模式
  MODE_3_4 = '3+4',       // 3+4模式（浙江7选4）
  MODE_TRADITIONAL = '文理科' // 传统文理科模式
}

/**
 * 科目类型定义
 */
export enum SubjectType {
  REQUIRED = 'required',   // 必考科目
  PRIMARY = 'primary',     // 首选科目
  SECONDARY = 'secondary'  // 次选科目
}

/**
 * 科目选择配置接口
 */
export interface SubjectConfig {
  province: string;          // 省份名称
  mode: GaoKaoMode;         // 高考模式
  primarySubjects?: {       // 首选科目
    count: number;          // 需要选择的数量
    subjects: string[];     // 可选的科目列表
  };
  secondarySubjects?: {     // 次选科目
    count: number;          // 需要选择的数量
    subjects: string[];     // 可选的科目列表
  };
  traditionalSubjects?: string[]; // 传统文理科选择
}

/**
 * 各省份高考模式和科目选择配置
 */
export const GAOKAO_SUBJECT_CONFIG: SubjectConfig[] = [
  // 3+3模式省份
  {
    province: '北京',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理']
    }
  },
  {
    province: '上海',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理']
    }
  },
  {
    province: '浙江',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理', '技术']
    }
  },
  {
    province: '山东',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理']
    }
  },
  {
    province: '天津',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理']
    }
  },
  {
    province: '海南',
    mode: GaoKaoMode.MODE_3_3,
    primarySubjects: {
      count: 0,
      subjects: ['综合']
    },
    secondarySubjects: {
      count: 3,
      subjects: ['物理', '化学', '生物', '历史', '政治', '地理']
    }
  },

  // 3+1+2模式省份
  {
    province: '河北',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '辽宁',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '江苏',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '福建',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '湖北',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '湖南',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '广东',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '重庆',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '甘肃',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '黑龙江',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '吉林',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '安徽',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '江西',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '贵州',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '广西',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '山西',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '内蒙古',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '河南',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '四川',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '云南',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '陕西',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '青海',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },
  {
    province: '宁夏',
    mode: GaoKaoMode.MODE_3_1_2,
    primarySubjects: {
      count: 1,
      subjects: ['物理', '历史']
    },
    secondarySubjects: {
      count: 2,
      subjects: ['化学', '生物', '政治', '地理']
    }
  },

  // 传统文理科模式省份
  {
    province: '西藏',
    mode: GaoKaoMode.MODE_TRADITIONAL,
    primarySubjects: {
      count: 0,
      subjects: ['文理']
    },
    secondarySubjects: {
      count: 1,
      subjects: ['文科', '理科']
    }
  },
  {
    province: '新疆',
    mode: GaoKaoMode.MODE_TRADITIONAL,
    primarySubjects: {
      count: 0,
      subjects: ['文理']
    },
    secondarySubjects: {
      count: 1,
      subjects: ['文科', '理科']
    }
  }
];

/**
 * 获取指定省份的高考模式配置
 * @param province 省份名称
 * @returns 该省份的高考模式配置
 */
export function getProvinceSubjectConfig(province: string): SubjectConfig | undefined {
  return GAOKAO_SUBJECT_CONFIG.find(config => config.province === province);
}

/**
 * 获取所有采用指定高考模式的省份列表
 * @param mode 高考模式
 * @returns 采用该模式的省份列表
 */
export function getProvincesByMode(mode: GaoKaoMode): string[] {
  return GAOKAO_SUBJECT_CONFIG
    .filter(config => config.mode === mode)
    .map(config => config.province);
}

/**
 * 验证省份的科目选择是否有效
 * @param province 省份名称
 * @param subjects 选择的科目列表
 * @returns 是否为有效的科目选择
 */
export function validateSubjectSelection(
  province: string,
  subjects: string[]
): boolean {
  const config = GAOKAO_SUBJECT_CONFIG.find(config => config.province === province);
  if (!config) return false;

  switch (config.mode) {
    case GaoKaoMode.MODE_3_3:
    case GaoKaoMode.MODE_3_1_2:
    case GaoKaoMode.MODE_TRADITIONAL:
      // 检查首选科目
      const primarySelected = subjects.filter(
        subject => config.primarySubjects?.subjects.includes(subject)
      );
      if (primarySelected.length !== config.primarySubjects?.count) {
        return false;
      }

      // 检查次选科目
      const secondarySelected = subjects.filter(
        subject => config.secondarySubjects?.subjects.includes(subject)
      );
      if (secondarySelected.length !== config.secondarySubjects?.count) {
        return false;
      }
      break;

    case GaoKaoMode.MODE_3_4:
      // 检查选考科目（7选4）
      const selectedSubjects = subjects.filter(
        subject => config.secondarySubjects?.subjects.includes(subject)
      );
      if (selectedSubjects.length !== config.secondarySubjects?.count) {
        return false;
      }
      break;
  }

  return true;
} 