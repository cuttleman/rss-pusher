import { PathLike } from "fs";
import { access, mkdir, readdir, readFile, rm, writeFile } from "fs/promises";

export const makeDir = async (dirPath: PathLike) => {
  try {
    await access(dirPath);
  } catch (error) {
    await mkdir(dirPath);
  }
};

export const makeFile = async (
  dirPath: PathLike,
  filename: string,
  data: string
) => {
  await writeFile(`${dirPath}/${filename}`, data);
};

export const deleteFile = async (dirPath: PathLike, filename: string) => {
  await rm(`${dirPath}/${filename}`, { recursive: true });
};

export const getFile = async (dirPath: PathLike, filename: string) => {
  return readFile(`${dirPath}/${filename}`);
};

export const getDir = async (dirPath: PathLike) => {
  return readdir(dirPath, { encoding: "utf-8" });
};
