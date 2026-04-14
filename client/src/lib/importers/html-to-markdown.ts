/**
 * 轻量级 HTML → Markdown 转换器
 * 用于 WordPress（WXR HTML 内容）和 Ghost（HTML 模式）的文章正文转换。
 * 利用浏览器原生的 DOMParser 实现，零依赖。
 */

export function htmlToMarkdown(html: string): string {
  if (!html || !html.trim()) return "";

  const parser = new DOMParser();
  const doc = parser.parseFromString(
    `<div id="root">${html}</div>`,
    "text/html"
  );
  const root = doc.getElementById("root");
  if (!root) return html;

  return convertNode(root).replace(/\n{3,}/g, "\n\n").trim();
}

function convertNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) {
    return node.textContent || "";
  }

  if (node.nodeType !== Node.ELEMENT_NODE) return "";

  const el = node as HTMLElement;
  const tag = el.tagName.toLowerCase();
  const children = Array.from(el.childNodes).map(convertNode).join("");

  switch (tag) {
    // 根容器透传
    case "div":
    case "article":
    case "section":
    case "main":
    case "span":
    case "root":
      return children;

    // 段落
    case "p":
      return `\n\n${children.trim()}\n\n`;

    // 换行与水平线
    case "br":
      return "\n";
    case "hr":
      return "\n\n---\n\n";

    // 标题 h1-h6
    case "h1":
      return `\n\n# ${children.trim()}\n\n`;
    case "h2":
      return `\n\n## ${children.trim()}\n\n`;
    case "h3":
      return `\n\n### ${children.trim()}\n\n`;
    case "h4":
      return `\n\n#### ${children.trim()}\n\n`;
    case "h5":
      return `\n\n##### ${children.trim()}\n\n`;
    case "h6":
      return `\n\n###### ${children.trim()}\n\n`;

    // 行内格式
    case "strong":
    case "b":
      return `**${children}**`;
    case "em":
    case "i":
      return `*${children}*`;
    case "del":
    case "s":
    case "strike":
      return `~~${children}~~`;
    case "code":
      // 如果父元素是 pre，不加行内 backtick
      if (el.parentElement?.tagName.toLowerCase() === "pre") return children;
      return `\`${children}\``;
    case "mark":
      return `==${children}==`;

    // 链接
    case "a": {
      const href = el.getAttribute("href") || "";
      return `[${children}](${href})`;
    }

    // 图片
    case "img": {
      const src = el.getAttribute("src") || "";
      const alt = el.getAttribute("alt") || "";
      return `![${alt}](${src})`;
    }

    // 代码块
    case "pre": {
      const codeEl = el.querySelector("code");
      const lang = codeEl?.className?.match(/language-(\w+)/)?.[1] || "";
      const code = codeEl?.textContent || el.textContent || "";
      return `\n\n\`\`\`${lang}\n${code.trim()}\n\`\`\`\n\n`;
    }

    // 引用块
    case "blockquote": {
      const lines = children
        .trim()
        .split("\n")
        .map((l) => `> ${l}`);
      return `\n\n${lines.join("\n")}\n\n`;
    }

    // 列表
    case "ul":
    case "ol":
      return `\n\n${children}\n\n`;
    case "li": {
      const parent = el.parentElement?.tagName.toLowerCase();
      if (parent === "ol") {
        // 有序列表（获取序号）
        const index = Array.from(el.parentElement!.children).indexOf(el) + 1;
        return `${index}. ${children.trim()}\n`;
      }
      return `- ${children.trim()}\n`;
    }

    // 表格（简单支持）
    case "table":
      return `\n\n${children}\n\n`;
    case "thead":
    case "tbody":
    case "tfoot":
      return children;
    case "tr": {
      const cells = Array.from(el.children).map(
        (td) => convertNode(td).trim()
      );
      const row = `| ${cells.join(" | ")} |`;
      // 如果是 thead 的第一行，补上分隔行
      if (el.parentElement?.tagName.toLowerCase() === "thead") {
        const sep = `| ${cells.map(() => "---").join(" | ")} |`;
        return `${row}\n${sep}\n`;
      }
      return `${row}\n`;
    }
    case "th":
    case "td":
      return children;

    // figure / figcaption（WordPress 常用）
    case "figure":
      return `\n\n${children}\n\n`;
    case "figcaption":
      return `\n*${children.trim()}*\n`;

    // iframe（嵌入视频等，保留原始 HTML）
    case "iframe":
      return `\n\n${el.outerHTML}\n\n`;

    // 未知标签，透传子元素内容
    default:
      return children;
  }
}
