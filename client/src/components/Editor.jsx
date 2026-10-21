import React, { useRef, useState } from 'react';

// Supported programming languages
const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript' },
  { id: 'python', label: 'Python' },
  { id: 'java', label: 'Java' },
  { id: 'c', label: 'C' },
  { id: 'html', label: 'HTML' }
];

export default function Editor({
  code,
  language,
  roomId,
  participantCount,
  isConnected,
  syncStatus,
  onCodeChange,
  onLanguageChange,
  onClearCode,
  onResetCode
}) {
  const textareaRef = useRef(null);
  const [output, setOutput] = useState('');
  const [showOutput, setShowOutput] = useState(false);

  // Insert indentation when Tab is pressed
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();

      const textarea = e.target;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const updatedCode =
        code.substring(0, start) + '  ' + code.substring(end);

      onCodeChange(updatedCode);

      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart =
            textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleClearClick = () => {
    if (window.confirm('Clear code for everyone in this room?')) {
      onClearCode();
      setOutput('');
    }
  };

  const handleResetClick = () => {
    if (window.confirm('Reset code to the starter template for everyone?')) {
      onResetCode();
      setOutput('');
    }
  };

  // Run JavaScript code and show its output
  const handleRunCode = () => {
    setShowOutput(true);
    setOutput('');

    if (language !== 'javascript') {
      setOutput(
        `Running ${language} is not supported yet. Select JavaScript to run code.`
      );
      return;
    }

    try {
      const capturedLogs = [];

      // Capture console.log output for this simple demonstration
      const fakeConsole = {
        log: (...values) =>
          capturedLogs.push(
            values.map(value =>
              typeof value === 'string'
                ? value
                : JSON.stringify(value)
            ).join(' ')
          ),
        error: (...values) =>
          capturedLogs.push(
            'Error: ' + values.map(String).join(' ')
          ),
        warn: (...values) =>
          capturedLogs.push(
            values.map(String).join(' ')
          )
      };

      const execute = new Function(
        'console',
        '"use strict";\n' + code
      );

      const result = execute(fakeConsole);

      if (result !== undefined) {
        capturedLogs.push(String(result));
      }

      setOutput(
        capturedLogs.length
          ? capturedLogs.join('\n')
          : 'Code executed successfully. No output.'
      );
    } catch (error) {
      setOutput(`Error: ${error.message}`);
    }
  };

  const currentLangObj =
    LANGUAGES.find((item) => item.id === language) || LANGUAGES[0];

  return (
    <div className="editor-workspace">

      {/* Editor toolbar */}
      <div className="editor-toolbar">
        <div className="toolbar-left">
          <label htmlFor="language-select" className="toolbar-label">
            Language:
          </label>

          <select
            id="language-select"
            value={language}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="language-dropdown"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.label}
              </option>
            ))}
          </select>

          <span className="current-lang-pill">
            Mode: <strong>{currentLangObj.label}</strong>
          </span>
        </div>

        <div className="toolbar-right">

          {/* NEW: Run Code button */}
          <button
            type="button"
            onClick={handleRunCode}
            className="btn btn-sm btn-outline"
            title="Run JavaScript code"
          >
            ▶ Run Code
          </button>

          <button
            type="button"
            onClick={handleResetClick}
            className="btn btn-sm btn-outline"
          >
            ↺ Reset Code
          </button>

          <button
            type="button"
            onClick={handleClearClick}
            className="btn btn-sm btn-outline btn-outline-danger"
          >
            🗑 Clear Code
          </button>
        </div>
      </div>

      {/* Code editor */}
      <div className="textarea-container">
        <textarea
          ref={textareaRef}
          value={code}
          onChange={(e) => onCodeChange(e.target.value)}
          onKeyDown={handleKeyDown}
          className="code-textarea"
          placeholder="Write your JavaScript code here..."
          spellCheck="false"
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
        />
      </div>

      {/* NEW: Output panel */}
      {showOutput && (
        <section
          style={{
            background: '#0b1020',
            color: '#e2e8f0',
            borderTop: '1px solid #34405e',
            padding: '14px 18px'
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '10px'
            }}
          >
            <strong>Output</strong>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowOutput(false)}
            >
              Close
            </button>
          </div>

          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              overflowWrap: 'anywhere',
              fontFamily: 'Consolas, monospace',
              fontSize: '13px'
            }}
          >
            {output}
          </pre>
        </section>
      )}

      {/* Status bar */}
      <footer className="editor-statusbar">
        <div className="statusbar-left">
          <span className="status-item">
            <strong>Room:</strong> {roomId}
          </span>

          <span className="status-separator">•</span>

          <span className="status-item">
            <strong>Active Users:</strong> {participantCount}
          </span>

          <span className="status-separator">•</span>

          <span className="status-item">
            <strong>Server:</strong>{' '}
            <span className={isConnected ? 'text-success' : 'text-danger'}>
              {isConnected ? 'Connected' : 'Offline'}
            </span>
          </span>
        </div>

        <div className="statusbar-right">
          <span className="sync-indicator">
            <span className="sync-pulse"></span>
            {syncStatus || 'Code synchronized with room'}
          </span>
        </div>
      </footer>
    </div>
  );
}