/**
 * Hugo 博客数据导入转换器
 * 支持 Hugo 的 Markdown 文件（content/posts/ 目录下的 .md 文件）。
 * Hugo 同时支持 YAML (---) 和 TOML (+++) 两种 frontmatter 格式。
 *
 * YAML 格式示例：
 * ---
 * title: "Post Title"
 * date: 2023-01-01T12:00:00+08:00
 * tags: ["tag1", "tag2"]
 * draft: false
 * ---
 *
 * TOML 格式示例：
 * +++
 * title = "Post Title"
 * date = 2023-01-01T12:00:00+08:00
 * tags = ["tag1", "tag2"]
 * draft = false
 * +++
 */
import type { ImportResult, PlatformInfo } from "./types";
import { parseMarkdownFile } from "./frontmatter";

async function convertHugoFiles(files: File[]): Promise<ImportResult> {
  const allTags = new Set<string>();
  const posts: ImportResult["posts"] = [];

  for (const file of files) {
    if (!file.name.match(/\.(md|markdown)$/i)) continue;

    const text = await file.text();

    // 跳过 Hugo 的 _index.md（列表页模板）
    if (file.name === "_index.md" || file.name.endsWith("/_index.md")) continue;

    const { frontmatter, content } = parseMarkdownFile(text, file.name);
    if (!content.trim() && !frontmatter.title) continue;

    const tags = [
      ...new Set([...frontmatter.tags, ...frontmatter.categories]),
    ];
    tags.forEach((t) => allTags.add(t));

    // Hugo 的 slug 推导逻辑：frontmatter.slug > 文件名 > 目录名（page bundle）
    let slug = frontmatter.slug;
    if (!slug) {
      if (file.name === "index.md") {
        // Hugo Page Bundle：slug 来自父目录
        const parts = (file.webkitRelativePath || file.name).split("/");
        slug = parts.length >= 2 ? parts[parts.length - 2] : "untitled";
      } else {
        slug = file.name.replace(/\.(md|markdown)$/i, "");
      }
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
      platform: "Hugo",
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

export const hugoPlatform: PlatformInfo = {
  id: "hugo",
  name: "Hugo",
  description: "选择 content/posts/ 目录下的 .md 文件（支持多选）",
  accept: ".md,.markdown",
  multiple: true,
  color: "pink",
  parse: convertHugoFiles,
};
