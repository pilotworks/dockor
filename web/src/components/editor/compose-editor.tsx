import Editor, { OnMount } from '@monaco-editor/react';
import { useAppStore } from '../../stores/use-app-store';

interface ComposeEditorProps {
  value: string;
  onChange?: (value: string | undefined) => void;
  readOnly?: boolean;
  height?: string;
  className?: string;
}

export function ComposeEditor({
  value,
  onChange,
  readOnly = false,
  height = '100%',
  className = '',
}: ComposeEditorProps) {
  const { theme } = useAppStore();

  const handleEditorDidMount: OnMount = (editor, monaco) => {
    // Configure Monaco YAML defaults
    monaco.languages.setLanguageConfiguration('yaml', {
      comments: {
        lineComment: '#',
      },
      brackets: [
        ['{', '}'],
        ['[', ']'],
      ],
      autoClosingPairs: [
        { open: '{', close: '}' },
        { open: '[', close: ']' },
        { open: '"', close: '"' },
        { open: "'", close: "'" },
      ],
    });

    // Optional initial format/layout
    setTimeout(() => {
      editor.layout();
    }, 100);
  };

  const isDark = theme === 'dark';

  return (
    <div className={`w-full h-full min-h-[250px] overflow-hidden ${className}`}>
      <Editor
        height={height}
        language="yaml"
        theme={isDark ? 'vs-dark' : 'light'}
        value={value}
        onChange={onChange}
        onMount={handleEditorDidMount}
        loading={
          <div className="flex items-center justify-center h-full text-xs text-zinc-500 font-mono">
            Loading Monaco Editor...
          </div>
        }
        options={{
          readOnly,
          minimap: { enabled: false },
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          automaticLayout: true,
          tabSize: 2,
          insertSpaces: true,
          fontSize: 12,
          fontFamily:
            'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
          fontLigatures: true,
          lineNumbers: 'on',
          renderLineHighlight: 'all',
          renderWhitespace: 'selection',
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
      />
    </div>
  );
}
