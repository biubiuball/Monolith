/**
 * Ghost 博客数据导入转换器
 * 支持 Ghost 1.x – 5.x 导出的 JSON 格式。
 *
 * Ghost 导出格式：
 * {
 *   "db": [{
 *     "data": {
 *       "posts": [{ title, slug, html/markdown/mobiledoc, status, ... }],
 *       "tags": [{ id, name, slug, ... }],
 *       "posts_tags": [{ post_id, tag_id, sort_order }]
 *     }
 *   }]
 * }
 */
import type { ImportResult, PlatformInfo } from "./types";
import { htmlToMarkdown } from "./html-to-markdown";

function convertGhostData(raw: any): ImportResult {
  // Ghost 数据可能嵌套在 db[0].data 中，也可能直接是根对象
  const data = raw.db?.[0]?.data || raw.data || raw;

  // 构建 tag 映射
  const tagMap = new Map<string | number, string>();
  const tags: { name: string }[] = [];
  if (Array.isArray(data.tags)) {
    for (const t of data.tags) {
      tagMap.set(t.id, t.name);
      // Ghost 内建标签以 # 开头，跳过
      if (!t.name.startsWith("#")) {
        tags.push({ name: t.name });
      }
    }
  }

  // 构建 post → tags 映射
  const postTagMap = new Map<string | number, string[]>();
  if (Array.isArray(data.posts_tags)) {
    for (const pt of data.posts_tags) {
      const name = tagMap.get(pt.tag_id);
      if (name && !name.startsWith("#")) {
        if (!postTagMap.has(pt.post_id)) postTagMap.set(pt.post_id, []);
        postTagMap.get(pt.post_id)!.push(name);
      }
    }
  }

  // 转换文章
  const posts = (Array.isArray(data.posts) ? data.posts : [])
    .filter((p: any) => p.type === "post" || !p.type) // 排除 page 类型
    .map((p: any) => {
      // Ghost 内容优先级：markdown > plaintext > html
      let content = "";
      if (p.markdown) {
        content = p.markdown;
      } else if (p.html) {
        content = htmlToMarkdown(p.html);
      } else if (p.mobiledoc) {
        // mobiledoc 是 JSON 格式，尝试提取 markdown card
        try {
          const doc =
            typeof p.mobiledoc === "string"
              ? JSON.parse(p.mobiledoc)
              : p.mobiledoc;
          if (doc.cards && doc.cards.length > 0) {
            content = doc.cards
              .map((card: any[]) => {
                if (card[0] === "markdown" && card[1]?.markdown) {
                  return card[1].markdown;
                }
                if (card[0] === "html" && card[1]?.html) {
                  return htmlToMarkdown(card[1].html);
                }
                if (card[0] === "code" && card[1]?.code) {
                  return `\n\`\`\`${card[1].language || ""}\n${card[1].code}\n\`\`\`\n`;
                }
                if (card[0] === "image" && card[1]?.src) {
                  return `\n![${card[1].alt || ""}](${card[1].src})\n`;
                }
                return "";
              })
              .join("\n");
          }
          // 同时处理 sections 中的文本
          if (doc.sections) {
            const textParts = doc.sections
              .filter((s: any[]) => s[0] === 1) // type 1 = markup section
              .map((s: any[]) => {
                // s = [1, tagName, markers]
                const markers = s[2] || [];
                return markers
                  .map((m: any[]) => {
                    // m = [type, openTypes, closeTypes, text]
                    return m[3] || "";
                  })
                  .join("");
              })
              .filter(Boolean);
            if (textParts.length > 0 && !content) {
              content = textParts.join("\n\n");
            }
          }
        } catch {
          // mobiledoc 解析失败，跳过
        }
      }

      // 最终兜底
      if (!content && p.plaintext) {
        content = p.plaintext;
      }

      const slug = p.slug || `ghost-${p.id}`;
      const published = p.status === "published";

      return {
        slug,
        title: p.title || "无标题",
        content,
        excerpt:
          p.custom_excerpt || p.meta_description || p.excerpt || "",
        published,
        pinned: !!p.featured,
        listed: true,
        tags: postTagMap.get(p.id) || [],
      };
    });

  const warnings: string[] = [];
  // 检查 pages
  const pageCount = (data.posts || []).filter(
    (p: any) => p.type === "page"
  ).length;
  if (pageCount > 0) {
    warnings.push(
      `发现 ${pageCount} 个独立页面（Page），仅导入 Post 类型文章`
    );
  }

  return {
    posts,
    tags,
    preview: {
      platform: "Ghost",
      postCount: posts.length,
      tagCount: tags.length,
      categoryCount: 0,
      commentCount: 0,
      postTitles: posts.slice(0, 20).map((p) => ({
        title: p.title,
        slug: p.slug,
      })),
      tagNames: tags.map((t) => t.name),
      warnings,
    },
  };
}

export const ghostPlatform: PlatformInfo = {
  id: "ghost",
  name: "Ghost",
  description: "Ghost 1.x – 5.x 导出的 JSON 备份文件",
  accept: ".json",
  multiple: false,
  color: "purple",
  parse: async (files: File[]) => {
    const text = await files[0].text();
    const data = JSON.parse(text);
    return convertGhostData(data);
  },
};
