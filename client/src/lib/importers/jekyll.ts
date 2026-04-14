/**
 * Jekyll 博客数据导入转换器
 * 支持 Jekyll 的 Markdown 文件（_posts/ 目录下的 .md 文件）。
 *
 * Jekyll 文件命名约定：YYYY-MM-DD-slug.md
 * Frontmatter 格式（YAML）：
 * ---
 * layout: post
 * title: "Post Title"
 * date: 2023-01-01 12:00:00 +0800
 * tags: [tag1, tag2]
 * categories: [category1]
 * published: true
 * ---
 */
import type { ImportResult, PlatformInfo } from "./types";
import { parseMarkdownFile } from "./frontmatter";

async function convertJekyllFiles(files: File[]): Promise<ImportResult> {
  const allTags = new Set<string>();
  const posts: ImportResult["posts"] = [];

  for (const file of files) {
    if (!file.name.match(/\.(md|markdown|html)$/i)) continue;

    const text = await file.text();
    const { frontmatter, content } = parseMarkdownFile(text, file.name);

    // Jekyll 的 layout: page 标记独立页面，跳过
    if ((frontmatter as any).layout === "page") continue;

    if (!content.trim() && !frontmatter.title) continue;

    const tags = [
      ...new Set([...frontmatter.tags, ...frontmatter.categories]),
    ];
    tags.forEach((t) => allTags.add(t));

    // Jekyll slug 推导：frontmatter > 文件名（去掉日期前缀）
    let slug = frontmatter.slug;
    if (!slug) {
      const baseName = file.name.replace(/\.(md|markdown|html)$/i, "");
      // Jekyll 格式：YYYY-MM-DD-slug
      const match = baseName.match(/^\d{4}-\d{2}-\d{2}-(.+)$/);
      slug = match ? match[1] : baseName;
    }

    posts.push({
      slug,
      title: frontmatter.title || slug,
      content,
      excerpt: frontmatter.excerpt,
      published: !frontmatter.draft,
      pinned: false,
      listed: true,
      tags,
    });
  }

  const tagNames = Array.from(allTags);

  return {
    posts,
    tags: tagNames.map((name) => ({ name })),
    preview: {
      platform: "Jekyll",
      postCount: posts.length,
      tagCount: tagNames.length,
      categoryCount: 0,
      commentCount: 0,
      postTitles: posts
        .slice(0, 20)
        .map((p) => ({ title: p.title, slug: p.slug })),
      tagNames,
      warnings:
        files.length !== posts.length
          ? [
              `共上传 ${files.length} 个文件，其中 ${posts.length} 个为有效文章`,
            ]
          : [],
    },
  };
}

export const jekyllPlatform: PlatformInfo = {
  id: "jekyll",
  name: "Jekyll",
  description: "选择 _posts/ 目录下的 .md 文件（支持多选）",
  accept: ".md,.markdown,.html",
  multiple: true,
  color: "red",
  parse: convertJekyllFiles,
};
