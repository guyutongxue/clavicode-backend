import { FileModel } from './utils';
import { unlinkSync } from 'fs';
import { v4 as uuid } from 'uuid';

function removeFile(path: string) {
  return () => {
    unlinkSync(path);
  };
}

const REMOVE_TIMEOUT = 2 * 60 * 1000;

/**
 * 
 * @brief 保存文件路径到数据库
 * @param path 路径名称
 * @returns 路径的唯一 id，如果出错返回 `null`
 */
export async function save(path: string): Promise<string | null> {
  const id = uuid();
  const timeoutId = setTimeout(removeFile(path), REMOVE_TIMEOUT);
  const file = new FileModel({
    id, 
    path, 
    timeoutId,
    createdAt: Date.now()
  });
  try {
    await file.save();
    return id;
  } catch (e) {
    console.log("save file: ", e);
    return null;
  }
}

/**
 * 
 * @brief 用唯一 id 索引文件路径
 * @param id 
 * @returns 对应路径，如果文件不存在返回 `null`
 */
export async function query(id: string): Promise<string | null> {
  const file = await FileModel.findOne({ id });
  if (!file) {
    return null;
  }
  clearTimeout(file.timeoutId);
  const path = file.path;
  await file.remove();
  return path;
}
