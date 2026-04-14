/**
 * Halo 博客数据导入转换器
 * 支持 Halo 1.x / 2.x 导出的 JSON 格式。
 * 客户端版本（与后端 convertHaloData 逻辑一致）。
 */
import type { ImportResult, PlatformInfo } from "./types";

function convertHaloData(data: any): ImportResult {
  // 构建 tag ID → name 映射
  const tagMap = new Map<number, string>();
  const tags: { name: string }[] = [];
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      tagMap.set(t.id, t.name);
      tags.push({ name: t.name });
    }
  }

  // 构建 category ID → name 映射（分类也作为标签导入）
  const catMap = new Map<number, string>();
  if (Array.isArray(data.categories)) {
    for (const c of data.categories) {
      catMap.set(c.id, c.name);
      if (!tags.find((t) => t.name === c.name)) {
        tags.push({ name: c.name });
      }
    }
  }

  // 构建 postId → tag names 映射
  const postTagNames = new Map<number, string[]>();
  if (Array.isArray(data.post_tags)) {
    for (const pt of data.post_tags) {
      const name = tagMap.get(pt.tagId);
      if (name) {
        if (!postTagNames.has(pt.postId)) postTagNames.set(pt.postId, []);
        postTagNames.get(pt.postId)!.push(name);
      }
    }
  }
  // 分类关联
  if (Array.isArray(data.post_categories)) {
    for (const pc of data.post_categories) {
      const name = catMap.get(pc.categoryId);
      if (name) {
        if (!postTagNames.has(pc.postId)) postTagNames.set(pc.postId, []);
        const arr = postTagNames.get(pc.postId)!;
        if (!arr.includes(name)) arr.push(name);
      }
    }
  }

  // 转换文章
  const posts = (Array.isArray(data.posts) ? data.posts : []).map((p: any) => {
    const content =
      p.originalContent || p.content?.raw || p.formatContent || "";
    const slug = p.slug || `post-${p.id}`;
    const status = p.status;
    const published =
      status === "PUBLISHED" ||
      status === "published" ||
      status === 0 ||
      status === "0";

    return {
      slug,
      title: p.title || "无标题",
      content,
      excerpt: p.summary || p.excerpt || "",
      published,
      pinned: Number(p.topPriority || p.priority || 0) > 0,
      listed: true,
      tags: postTagNames.get(p.id) || [],
    };
  });

  const warnings: string[] = [];
  const commentCount = Array.isArray(data.comments)
    ? data.comments.length
    : 0;
  if (commentCount > 0) {
    warnings.push(`发现 ${commentCount} 条评论，暂不支持迁移评论数据`);
  }

  return {
    posts,
    tags,
    preview: {
      platform: "Halo",
      postCount: posts.length,
      tagCount: tags.length,
      categoryCount: catMap.size,
      commentCount,
      postTitles: posts.slice(0, 20).map((p) => ({
        title: p.title,
        slug: p.slug,
      })),
      tagNames: tags.map((t) => t.name),
      warnings,
    },
  };
}

export const haloPlatform: PlatformInfo = {
  id: "halo",
  name: "Halo",
  description: "Halo 1.x / 2.x 博客导出的 JSON 文件",
  accept: ".json",
  multiple: false,
  color: "cyan",
  parse: async (files: File[]) => {
    const text = await files[0].text();
    const data = JSON.parse(text);
    return convertHaloData(data);
  },
};
