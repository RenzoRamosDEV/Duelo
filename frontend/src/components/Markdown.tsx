import type { ReactNode } from "react";
import { type Block, type Inline, parseMarkdown } from "../utils/markdown";

function renderInline(nodes: Inline[], keyPrefix: string): ReactNode[] {
  return nodes.map((node, index) => {
    const key = `${keyPrefix}.${index}`;
    switch (node.type) {
      case "text":
        return node.value;
      case "br":
        return <br key={key} />;
      case "code":
        return <code key={key}>{node.value}</code>;
      case "strong":
        return <strong key={key}>{renderInline(node.children, key)}</strong>;
      case "em":
        return <em key={key}>{renderInline(node.children, key)}</em>;
      case "link":
        // `href` ya pasó por `safeHttpUrl` en el parser: siempre es http o https.
        return (
          <a key={key} href={node.href} target="_blank" rel="noopener noreferrer nofollow">
            {renderInline(node.children, key)}
          </a>
        );
    }
  });
}

function renderBlock(block: Block, index: number): ReactNode {
  switch (block.type) {
    case "paragraph":
      return <p key={index}>{renderInline(block.children, String(index))}</p>;
    case "code":
      return (
        <pre key={index}>
          <code>{block.value}</code>
        </pre>
      );
    case "list": {
      const Tag = block.ordered ? "ol" : "ul";
      return (
        <Tag key={index}>
          {block.items.map((item, itemIndex) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: la lista se reconstruye del texto en cada render
            <li key={itemIndex}>{renderInline(item, `${index}.${itemIndex}`)}</li>
          ))}
        </Tag>
      );
    }
  }
}

/**
 * Texto de un agente con un poco de formato (ver `utils/markdown.ts`). Todo pasa por React, así
 * que nada del texto puede convertirse en HTML; los enlaces son solo http(s).
 */
export function Markdown({ text }: { text: string }) {
  const blocks = parseMarkdown(text);
  if (blocks.length === 0) return null;
  return <div className="md">{blocks.map((block, index) => renderBlock(block, index))}</div>;
}
