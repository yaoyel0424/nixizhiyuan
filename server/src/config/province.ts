/**
 * 省份信息配置
 */

/**
 * 省份名称到代码的映射表
 */
export const PROVINCE_NAME_TO_CODE: { [key: string]: string } = {
  '北京': '11',
  '天津': '12',
  '河北': '13',
  '山西': '14',
  '内蒙古': '15',
  '辽宁': '21',
  '吉林': '22',
  '黑龙江': '23',
  '上海': '31',
  '江苏': '32',
  '浙江': '33',
  '安徽': '34',
  '福建': '35',
  '江西': '36',
  '山东': '37',
  '河南': '41',
  '湖北': '42',
  '湖南': '43',
  '广东': '44',
  '广西': '45',
  '海南': '46',
  '重庆': '50',
  '四川': '51',
  '贵州': '52',
  '云南': '53',
  '西藏': '54',
  '陕西': '61',
  '甘肃': '62',
  '青海': '63',
  '宁夏': '64',
  '新疆': '65',
};

/**
 * 省份代码到名称的映射表
 */
export const PROVINCE_CODE_TO_NAME: { [key: string]: string } = {
  '11': '北京',
  '12': '天津',
  '13': '河北',
  '14': '山西',
  '15': '内蒙古',
  '21': '辽宁',
  '22': '吉林',
  '23': '黑龙江',
  '31': '上海',
  '32': '江苏',
  '33': '浙江',
  '34': '安徽',
  '35': '福建',
  '36': '江西',
  '37': '山东',
  '41': '河南',
  '42': '湖北',
  '43': '湖南',
  '44': '广东',
  '45': '广西',
  '46': '海南',
  '50': '重庆',
  '51': '四川',
  '52': '贵州',
  '53': '云南',
  '54': '西藏',
  '61': '陕西',
  '62': '甘肃',
  '63': '青海',
  '64': '宁夏',
  '65': '新疆',
};

/**
 * 省份志愿数量对照表
 */
export const PROVINCE_VOLUNTEER_COUNT: { [key: string]: number } = {
  '北京': 20,
  '天津': 20,
  '河北': 20,
  '山西': 45,
  '内蒙古': 45,
  '辽宁': 60,
  '吉林': 40,
  '黑龙江': 40,
  '上海': 8,
  '江苏': 40,
  '浙江': 80,
  '安徽': 45,
  '福建': 40,
  '江西': 45,
  '山东': 96,
  '河南': 48,
  '湖北': 20,
  '湖南': 30,
  '广东': 45,
  '广西': 40,
  '海南': 10,
  '重庆': 96,
  '四川': 45,
  '贵州': 96,
  '云南': 20,
  '西藏': 0,
  '陕西': 45,
  '甘肃': 45,
  '青海': 96,
  '宁夏': 45,
  '新疆': 9,
};

/**
 * 省份代码到志愿数量的映射表
 */
export const PROVINCE_CODE_TO_VOLUNTEER_COUNT: { [key: string]: number } = {
  '11': 20,
  '12': 20,
  '13': 20,
  '14': 45,
  '15': 45,
  '21': 60,
  '22': 40,
  '23': 40,
  '31': 8,
  '32': 40,
  '33': 80,
  '34': 45,
  '35': 40,
  '36': 45,
  '37': 96,
  '41': 48,
  '42': 20,
  '43': 30,
  '44': 45,
  '45': 40,
  '46': 10,
  '50': 96,
  '51': 45,
  '52': 96,
  '53': 20,
  '54': 0,
  '61': 45,
  '62': 45,
  '63': 96,
  '64': 45,
  '65': 9,
};

/**
 * 省份名称列表
 */
export const PROVINCE_NAMES = Object.keys(PROVINCE_NAME_TO_CODE);

/**
 * 省份代码列表
 */
export const PROVINCE_CODES = Object.keys(PROVINCE_CODE_TO_NAME);

/**
 * 获取省份代码
 * @param provinceName 省份名称
 * @returns 省份代码，如果未找到则返回undefined
 */
export function getProvinceCode(provinceName: string): string | undefined {
  return PROVINCE_NAME_TO_CODE[provinceName];
}

/**
 * 获取省份名称
 * @param provinceCode 省份代码
 * @returns 省份名称，如果未找到则返回undefined
 */
export function getProvinceName(provinceCode: string): string | undefined {
  return PROVINCE_CODE_TO_NAME[provinceCode];
}

/**
 * 验证省份名称是否有效
 * @param provinceName 省份名称
 * @returns 是否为有效的省份名称
 */
export function isValidProvinceName(provinceName: string): boolean {
  return provinceName in PROVINCE_NAME_TO_CODE;
}

/**
 * 验证省份代码是否有效
 * @param provinceCode 省份代码
 * @returns 是否为有效的省份代码
 */
export function isValidProvinceCode(provinceCode: string): boolean {
  return provinceCode in PROVINCE_CODE_TO_NAME;
}

/**
 * 获取所有省份信息
 * @returns 包含省份名称和代码的对象数组
 */
export function getAllProvinces(): Array<{ name: string; code: string }> {
  return Object.entries(PROVINCE_NAME_TO_CODE).map(([name, code]) => ({
    name,
    code,
  }));
}

/**
 * 获取省份总数
 * @returns 省份总数
 */
export function getProvinceCount(): number {
  return PROVINCE_NAMES.length;
}

/**
 * 获取省份志愿数量
 * @param provinceName 省份名称
 * @returns 志愿数量，如果未找到则返回undefined
 */
export function getProvinceVolunteerCount(provinceName: string): number | undefined {
  return PROVINCE_VOLUNTEER_COUNT[provinceName];
}

/**
 * 根据省份代码获取志愿数量
 * @param provinceCode 省份代码
 * @returns 志愿数量，如果未找到则返回undefined
 */
export function getProvinceVolunteerCountByCode(provinceCode: string): number | undefined {
  return PROVINCE_CODE_TO_VOLUNTEER_COUNT[provinceCode];
}

/**
 * 获取所有省份的志愿数量信息
 * @returns 包含省份名称、代码和志愿数量的对象数组
 */
export function getAllProvincesWithVolunteerCount(): Array<{ name: string; code: string; volunteerCount: number }> {
  return Object.entries(PROVINCE_NAME_TO_CODE).map(([name, code]) => ({
    name,
    code,
    volunteerCount: PROVINCE_VOLUNTEER_COUNT[name] || 0,
  }));
}

/**
 * 获取志愿数量最多的省份
 * @returns 志愿数量最多的省份信息
 */
export function getProvinceWithMaxVolunteerCount(): { name: string; code: string; volunteerCount: number } | null {
  const provinces = getAllProvincesWithVolunteerCount();
  if (provinces.length === 0) return null;
  
  return provinces.reduce((max, current) => 
    current.volunteerCount > max.volunteerCount ? current : max
  );
}

/**
 * 获取志愿数量最少的省份
 * @returns 志愿数量最少的省份信息
 */
export function getProvinceWithMinVolunteerCount(): { name: string; code: string; volunteerCount: number } | null {
  const provinces = getAllProvincesWithVolunteerCount();
  if (provinces.length === 0) return null;
  
  return provinces.reduce((min, current) => 
    current.volunteerCount < min.volunteerCount ? current : min
  );
}

/**
 * 获取平均志愿数量
 * @returns 所有省份的平均志愿数量
 */
export function getAverageVolunteerCount(): number {
  const provinces = getAllProvincesWithVolunteerCount();
  if (provinces.length === 0) return 0;
  
  const total = provinces.reduce((sum, province) => sum + province.volunteerCount, 0);
  return Math.round(total / provinces.length);
}
