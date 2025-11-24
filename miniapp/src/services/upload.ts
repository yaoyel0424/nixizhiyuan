import Taro from '@tarojs/taro'
import { UploadFileParams, UploadFileResponse } from '@/types/api'

/**
 * 上传文件
 * @param params 上传参数
 * @returns 上传结果
 */
export const uploadFile = async (params: UploadFileParams): Promise<UploadFileResponse> => {
  const { file, type, category } = params
  
  try {
    const result = await Taro.uploadFile({
      url: '/api/upload',
      filePath: file,
      name: 'file',
      formData: {
        type,
        category: category || 'default'
      }
    })
    
    const data = JSON.parse(result.data)
    if (data.code === 0) {
      return data.data
    } else {
      throw new Error(data.message || '上传失败')
    }
  } catch (error) {
    console.error('上传文件失败:', error)
    throw error
  }
}

/**
 * 上传图片
 * @param file 图片文件
 * @param category 分类
 * @returns 上传结果
 */
export const uploadImage = (file: File, category?: string): Promise<UploadFileResponse> => {
  return uploadFile({
    file,
    type: 'image',
    category
  })
}

/**
 * 上传视频
 * @param file 视频文件
 * @param category 分类
 * @returns 上传结果
 */
export const uploadVideo = (file: File, category?: string): Promise<UploadFileResponse> => {
  return uploadFile({
    file,
    type: 'video',
    category
  })
}

/**
 * 选择并上传图片
 * @param count 数量
 * @param category 分类
 * @returns 上传结果
 */
export const chooseAndUploadImage = async (count: number = 1, category?: string): Promise<UploadFileResponse[]> => {
  try {
    const result = await Taro.chooseImage({
      count,
      sizeType: ['compressed'],
      sourceType: ['album', 'camera']
    })
    
    const uploadPromises = result.tempFilePaths.map(filePath => 
      uploadImage(filePath as any, category)
    )
    
    return Promise.all(uploadPromises)
  } catch (error) {
    console.error('选择并上传图片失败:', error)
    throw error
  }
}

/**
 * 选择并上传视频
 * @param category 分类
 * @returns 上传结果
 */
export const chooseAndUploadVideo = async (category?: string): Promise<UploadFileResponse> => {
  try {
    const result = await Taro.chooseVideo({
      sourceType: ['album', 'camera'],
      maxDuration: 60
    })
    
    return uploadVideo(result.tempFilePath as any, category)
  } catch (error) {
    console.error('选择并上传视频失败:', error)
    throw error
  }
}
