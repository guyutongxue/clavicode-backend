import { FileModel } from './helpers/db';
import { unlinkSync } from 'fs';
import { v4 as uuid } from 'uuid';

function removeFile(path: string) {
  return () => {
    unlinkSync(path);
  };
}

const REMOVE_TIMEOUT = 2 * 60 * 1000;

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


export async function query(id: number): Promise<string | null> {
  const file = await FileModel.findOne({ id: id });
  if (!file) {
    return null;
  }
  clearTimeout(file.timeoutId);
  const path = file.path;
  await file.remove();
  return path;
}
