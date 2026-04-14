/**
 * 多平台博客导入系统 — 中央注册表
 * 汇总所有平台转换器，供 UI 层统一消费。
 */
export type { ImportResult, ImportPreview, PlatformInfo } from "./types";

import { haloPlatform } from "./halo";
import { ghostPlatform } from "./ghost";
import { wordpressPlatform } from "./wordpress";
import { hexoPlatform } from "./hexo";
import { hugoPlatform } from "./hugo";
import { jekyllPlatform } from "./jekyll";
import type { PlatformInfo } from "./types";

/** 按推荐顺序排列的所有可用平台列表 */
export const platforms: PlatformInfo[] = [
  wordpressPlatform,
  ghostPlatform,
  hexoPlatform,
  hugoPlatform,
  jekyllPlatform,
  haloPlatform,
];

/** 根据 id 获取平台信息 */
export function getPlatformById(id: string): PlatformInfo | undefined {
  return platforms.find((p) => p.id === id);
}
