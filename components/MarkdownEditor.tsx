'use client';

import { useState, useRef, useCallback, type ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';

interface MarkdownEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  id?: string;
}

type FormatAction = 'bold' | 'italic' | 'heading' | 'link' | 'list' | 'numbered-list' | 'quote';

interface ToolbarButtonProps {
  onClick: () => void;
  title: string;
  children: ReactNode;
}

function ToolbarButton({ onClick, title, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className="p-1.5 text-muted hover:text-foreground hover:bg-surface-elevated rounded transition-colors"
    >
      {children}
    </button>
  );
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder,
  rows = 4,
  id,
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const insertFormat = useCallback((action: FormatAction) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = value.substring(start, end);
    let newText = value;
    let cursorOffset = 0;

    switch (action) {
      case 'bold':
        if (selectedText) {
          newText = value.substring(0, start) + `**${selectedText}**` + value.substring(end);
          cursorOffset = end + 4;
        } else {
          newText = value.substring(0, start) + '**bold**' + value.substring(end);
          cursorOffset = start + 2;
        }
        break;
      case 'italic':
        if (selectedText) {
          newText = value.substring(0, start) + `*${selectedText}*` + value.substring(end);
          cursorOffset = end + 2;
        } else {
          newText = value.substring(0, start) + '*italic*' + value.substring(end);
          cursorOffset = start + 1;
        }
        break;
      case 'heading':
        if (selectedText) {
          newText = value.substring(0, start) + `### ${selectedText}` + value.substring(end);
          cursorOffset = end + 4;
        } else {
          newText = value.substring(0, start) + '### Heading' + value.substring(end);
          cursorOffset = start + 4;
        }
        break;
      case 'link':
        if (selectedText) {
          newText = value.substring(0, start) + `[${selectedText}](url)` + value.substring(end);
          cursorOffset = end + 3;
        } else {
          newText = value.substring(0, start) + '[link text](url)' + value.substring(end);
          cursorOffset = start + 1;
        }
        break;
      case 'list':
        if (selectedText) {
          const lines = selectedText.split('\n').map(line => `- ${line}`).join('\n');
          newText = value.substring(0, start) + lines + value.substring(end);
          cursorOffset = start + lines.length;
        } else {
          newText = value.substring(0, start) + '- ' + value.substring(end);
          cursorOffset = start + 2;
        }
        break;
      case 'numbered-list':
        if (selectedText) {
          const lines = selectedText.split('\n').map((line, i) => `${i + 1}. ${line}`).join('\n');
          newText = value.substring(0, start) + lines + value.substring(end);
          cursorOffset = start + lines.length;
        } else {
          newText = value.substring(0, start) + '1. ' + value.substring(end);
          cursorOffset = start + 3;
        }
        break;
      case 'quote':
        if (selectedText) {
          const lines = selectedText.split('\n').map(line => `> ${line}`).join('\n');
          newText = value.substring(0, start) + lines + value.substring(end);
          cursorOffset = start + lines.length;
        } else {
          newText = value.substring(0, start) + '> ' + value.substring(end);
          cursorOffset = start + 2;
        }
        break;
    }

    onChange(newText);

    // Restore focus and set cursor position
    setTimeout(() => {
      textarea.focus();
      if (action === 'bold' && !selectedText) {
        textarea.setSelectionRange(start + 2, start + 6);
      } else if (action === 'italic' && !selectedText) {
        textarea.setSelectionRange(start + 1, start + 7);
      } else if (action === 'heading' && !selectedText) {
        textarea.setSelectionRange(start + 4, start + 11);
      } else if (action === 'link' && !selectedText) {
        textarea.setSelectionRange(start + 1, start + 10);
      } else {
        textarea.setSelectionRange(cursorOffset, cursorOffset);
      }
    }, 0);
  }, [value, onChange]);

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-surface">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-border bg-background px-2 py-1">
        <div className="flex items-center gap-0.5">
          <ToolbarButton onClick={() => insertFormat('bold')} title="Bold (Ctrl+B)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 4h8a4 4 0 014 4 4 4 0 01-4 4H6z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 12h9a4 4 0 014 4 4 4 0 01-4 4H6z" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('italic')} title="Italic (Ctrl+I)">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 4h4m-2 0l-4 16m0 0h4" />
            </svg>
          </ToolbarButton>
          <div className="w-px h-4 bg-surface-elevated mx-1" />
          <ToolbarButton onClick={() => insertFormat('heading')} title="Heading">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h10" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('quote')} title="Quote">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
              <path d="M6 17h3l2-4V7H5v6h3l-2 4zm8 0h3l2-4V7h-6v6h3l-2 4z" />
            </svg>
          </ToolbarButton>
          <div className="w-px h-4 bg-surface-elevated mx-1" />
          <ToolbarButton onClick={() => insertFormat('list')} title="Bullet List">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M8 6h12M4 12h.01M8 12h12M4 18h.01M8 18h12" />
            </svg>
          </ToolbarButton>
          <ToolbarButton onClick={() => insertFormat('numbered-list')} title="Numbered List">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h.01M4 6v.01M8 6h12M4 12h.01M4 12v.01M8 12h12M4 18h.01M4 18v.01M8 18h12" />
              <text x="2" y="7" fontSize="5" fill="currentColor" stroke="none">1</text>
              <text x="2" y="13" fontSize="5" fill="currentColor" stroke="none">2</text>
              <text x="2" y="19" fontSize="5" fill="currentColor" stroke="none">3</text>
            </svg>
          </ToolbarButton>
          <div className="w-px h-4 bg-surface-elevated mx-1" />
          <ToolbarButton onClick={() => insertFormat('link')} title="Link">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
            </svg>
          </ToolbarButton>
        </div>
        <div className="flex items-center">
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className={`text-xs px-2 py-1 rounded transition-colors ${
              showPreview
                ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                : 'text-muted hover:bg-surface-elevated'
            }`}
          >
            {showPreview ? 'Edit' : 'Preview'}
          </button>
        </div>
      </div>

      {/* Editor / Preview */}
      {showPreview ? (
        <div className="p-3 min-h-[100px] prose prose-sm dark:prose-invert max-w-none">
          {value ? (
            <ReactMarkdown>{value}</ReactMarkdown>
          ) : (
            <p className="text-muted italic">Nothing to preview</p>
          )}
        </div>
      ) : (
        <textarea
          ref={textareaRef}
          id={id}
          rows={rows}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 bg-surface text-foreground focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-inset resize-y"
          onKeyDown={(e) => {
            // Handle keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
              if (e.key === 'b') {
                e.preventDefault();
                insertFormat('bold');
              } else if (e.key === 'i') {
                e.preventDefault();
                insertFormat('italic');
              }
            }
          }}
        />
      )}
    </div>
  );
}
