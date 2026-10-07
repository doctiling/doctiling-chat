import * as React from 'react';
import { parseMarkdown, type Block, type Inline } from '@/lib/markdown';

type Props = {
  markdown: string;
  /** Internal links (citations) are intercepted and routed here instead of navigating. */
  onInternalLink?: (href: string) => void;
  className?: string;
};

function renderInline(nodes: Inline[], onInternalLink?: (href: string) => void): React.ReactNode[] {
  return nodes.map((n, idx) => {
    switch (n.type) {
      case 'text':
        return <React.Fragment key={idx}>{n.value}</React.Fragment>;
      case 'strong':
        return <strong key={idx}>{renderInline(n.children, onInternalLink)}</strong>;
      case 'em':
        return <em key={idx}>{renderInline(n.children, onInternalLink)}</em>;
      case 'code':
        return <code key={idx}>{n.value}</code>;
      case 'link': {
        const internal = n.href.startsWith('/');
        if (internal && onInternalLink) {
          return (
            <a
              key={idx}
              href={n.href}
              data-citation="true"
              className="inline-flex min-h-[28px] items-center rounded px-0.5 font-medium"
              onClick={(e) => {
                e.preventDefault();
                onInternalLink(n.href);
              }}
            >
              {renderInline(n.children, onInternalLink)}
            </a>
          );
        }
        const safe = /^(https?:|mailto:|\/)/i.test(n.href);
        return (
          <a key={idx} href={safe ? n.href : '#'} target={internal ? undefined : '_blank'} rel="noreferrer noopener">
            {renderInline(n.children, onInternalLink)}
          </a>
        );
      }
    }
  });
}

function renderBlock(b: Block, key: number, onInternalLink?: (href: string) => void): React.ReactNode {
  switch (b.type) {
    case 'heading': {
      const Tag = `h${b.level}` as 'h1' | 'h2' | 'h3';
      return <Tag key={key}>{renderInline(b.children, onInternalLink)}</Tag>;
    }
    case 'paragraph':
      return <p key={key}>{renderInline(b.children, onInternalLink)}</p>;
    case 'list': {
      const Tag = b.ordered ? 'ol' : 'ul';
      return (
        <Tag key={key}>
          {b.items.map((item, i) => (
            <li key={i}>{renderInline(item, onInternalLink)}</li>
          ))}
        </Tag>
      );
    }
    case 'code':
      return (
        <pre key={key}>
          <code>{b.value}</code>
        </pre>
      );
    case 'quote':
      return <blockquote key={key}>{renderInline(b.children, onInternalLink)}</blockquote>;
    case 'table':
      return (
        <div key={key} className="overflow-x-auto">
          <table>
            <thead>
              <tr>
                {b.header.map((c, i) => (
                  <th key={i}>{renderInline(c, onInternalLink)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {b.rows.map((r, ri) => (
                <tr key={ri}>
                  {r.map((c, ci) => (
                    <td key={ci}>{renderInline(c, onInternalLink)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
  }
}

export function Markdown({ markdown, onInternalLink, className = '' }: Props) {
  const blocks = React.useMemo(() => parseMarkdown(markdown), [markdown]);
  return <div className={`prose-chat break-words text-base leading-relaxed ${className}`}>{blocks.map((b, i) => renderBlock(b, i, onInternalLink))}</div>;
}
