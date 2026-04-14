/**
 * WordPress 博客数据导入转换器
 * 支持 WordPress 导出的 WXR (WordPress eXtended RSS) XML 格式。
 * 利用浏览器原生 DOMParser 解析 XML，零依赖。
 */
import type { ImportResult, PlatformInfo } from "./types";
import { htmlToMarkdown } from "./html-to-markdown";

function convertWordPressData(xmlText: string): ImportResult {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // 检查解析错误
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("XML 解析失败，请确认文件是有效的 WordPress WXR 导出文件");
  }

  const items = doc.querySelectorAll("item");
  const allTags = new Set<string>();
  const allCategories = new Set<string>();

  const posts: ImportResult["posts"] = [];
  let pageCount = 0;

  items.forEach((item) => {
    // WordPress 的命名空间字段需要用 getElementsByTagName 获取
    const postType = getWpField(item, "post_type") || "post";

    // 只导入 post 类型，跳过 page / attachment / nav_menu_item 等
    if (postType !== "post") {
      if (postType === "page") pageCount++;
      return;
    }

    const title =
      item.querySelector("title")?.textContent?.trim() || "无标题";

    // slug 优先用 wp:post_name，后备用 link 推导
    let slug = getWpField(item, "post_name") || "";
    if (!slug) {
      const link = item.querySelector("link")?.textContent || "";
      slug = link.replace(/\/$/, "").split("/").pop() || `wp-${Date.now()}`;
    }
    slug = decodeURIComponent(slug);

    // 内容：优先 content:encoded，后备 excerpt:encoded
    const contentEncoded = getContentEncoded(item);
    const content = contentEncoded
      ? htmlToMarkdown(contentEncoded)
      : "";

    const excerptEncoded = getExcerptEncoded(item);
    const excerpt = excerptEncoded
      ? htmlToMarkdown(excerptEncoded).slice(0, 300)
      : "";

    // 状态
    const status = getWpField(item, "status") || "draft";
    const published = status === "publish";

    // 是否置顶
    const isSticky = getWpField(item, "is_sticky") === "1";

    // 提取标签和分类
    const itemTags: string[] = [];
    item.querySelectorAll("category").forEach((cat) => {
      const domain = cat.getAttribute("domain");
      const name = cat.textContent?.trim();
      if (!name) return;

      if (domain === "post_tag") {
        itemTags.push(name);
        allTags.add(name);
      } else if (domain === "category" && name !== "Uncategorized") {
        // WordPress 分类也作为标签导入
        itemTags.push(name);
        allCategories.add(name);
      }
    });

    posts.push({
      slug,
      title,
      content,
      excerpt,
      published,
      pinned: isSticky,
      listed: true,
      tags: itemTags,
    });
  });

  // 合并所有标签（tag + category 去重）
  const tagNames = [...new Set([...allTags, ...allCategories])];
  const tags = tagNames.map((name) => ({ name }));

  const warnings: string[] = [];
  if (pageCount > 0) {
    warnings.push(
      `发现 ${pageCount} 个独立页面（Page），仅导入 Post 类型文章`
    );
  }
  const attachmentCount = Array.from(items).filter(
    (item) => getWpField(item, "post_type") === "attachment"
  ).length;
  if (attachmentCount > 0) {
    warnings.push(
      `发现 ${attachmentCount} 个媒体附件，图片 URL 保持原始外链`
    );
  }

  return {
    posts,
    tags,
    preview: {
      platform: "WordPress",
      postCount: posts.length,
      tagCount: tags.length,
      categoryCount: allCategories.size,
      commentCount: 0,
      postTitles: posts
        .slice(0, 20)
        .map((p) => ({ title: p.title, slug: p.slug })),
      tagNames,
      warnings,
    },
  };
}

// ─── WXR XML 辅助函数 ─────────────────────

/** 获取 wp:xxx 命名空间字段的文本内容 */
function getWpField(item: Element, field: string): string {
  // 先尝试带命名空间
  const el =
    item.getElementsByTagNameNS(
      "http://wordpress.org/export/1.2/",
      field
    )[0] ||
    item.getElementsByTagNameNS(
      "http://wordpress.org/export/1.1/",
      field
    )[0] ||
    item.getElementsByTagNameNS(
      "http://wordpress.org/export/1.0/",
      field
    )[0];
  if (el) return el.textContent?.trim() || "";

  // 后备：直接匹配标签名（某些导出文件没有正确声明命名空间）
  const fallback = item.querySelector(field);
  return fallback?.textContent?.trim() || "";
}

/** 获取 content:encoded CDATA 内容 */
function getContentEncoded(item: Element): string {
  const el = item.getElementsByTagNameNS(
    "http://purl.org/rss/1.0/modules/content/",
    "encoded"
  )[0];
  return el?.textContent?.trim() || "";
}

/** 获取 excerpt:encoded CDATA 内容 */
function getExcerptEncoded(item: Element): string {
  const el = item.getElementsByTagNameNS(
    "http://wordpress.org/export/1.2/excerpt/",
    "encoded"
  )[0] ||
    item.getElementsByTagNameNS(
      "http://wordpress.org/export/1.1/excerpt/",
      "encoded"
    )[0];
  return el?.textContent?.trim() || "";
}

export const wordpressPlatform: PlatformInfo = {
  id: "wordpress",
  name: "WordPress",
  description: "WordPress 导出的 WXR (XML) 备份文件",
  accept: ".xml,.wxr",
  multiple: false,
  color: "blue",
  parse: async (files: File[]) => {
    const text = await files[0].text();
    return convertWordPressData(text);
  },
};
