import { useMemo } from 'react';
import Editor from '@monaco-editor/react';
import { useAppStore } from '../../stores/use-app-store';

interface JsonViewerProps {
  data: any;
  height?: string;
  className?: string;
}

// Lightweight syntax highlighter for immediate preview / offline fallback
function syntaxHighlight(json: string): string {
  const escaped = json
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  return escaped.replace(
    /("(\\u[a-zA-Z0-9]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+\-]?\d+)?)/g,
    (match) => {
      let cls = 'text-amber-600 dark:text-amber-400'; // number
      if (/^"/.test(match)) {
        if (/:$/.test(match)) {
          cls = 'text-blue-600 dark:text-blue-400 font-semibold'; // key
        } else {
          cls = 'text-emerald-600 dark:text-emerald-400'; // string
        }
      } else if (/true|false/.test(match)) {
        cls = 'text-purple-600 dark:text-purple-400 font-semibold'; // boolean
      } else if (/null/.test(match)) {
        cls = 'text-zinc-400 italic'; // null
      }
      return `<span class="${cls}">${match}</span>`;
    }
  );
}

export function JsonViewer({ data, height = '60vh', className = '' }: JsonViewerProps) {
  const { theme } = useAppStore();
  const isDark = theme === 'dark';

  const jsonString = useMemo(() => {
    return typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }, [data]);

  const highlightedHtml = useMemo(() => {
    return syntaxHighlight(jsonString);
  }, [jsonString]);

  return (
    <div className={`w-full overflow-hidden ${className}`}>
      <Editor
        height={height}
        language="json"
        theme={isDark ? 'vs-dark' : 'light'}
        value={jsonString}
        options={{
          readOnly: true,
          domReadOnly: true,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          fontSize: 12,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          glyphMargin: false,
          folding: true,
          lineDecorationsWidth: 10,
          lineNumbersMinChars: 3,
          scrollbar: {
            verticalScrollbarSize: 8,
            horizontalScrollbarSize: 8,
          },
          overviewRulerBorder: false,
        }}
        loading={
          <div className="w-full h-full p-4 overflow-auto bg-zinc-50 dark:bg-[#09090B] font-mono text-xs leading-relaxed select-text">
            <pre
              className="text-zinc-800 dark:text-zinc-200"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          </div>
        }
      />
    </div>
  );
}
