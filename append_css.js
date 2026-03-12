const fs = require('fs');
const css = `
/* ===== Cyberpunk Theme ===== */
[data-theme='cyberpunk'] {
  --bg-primary: #050508;
  --bg-secondary: rgba(10, 10, 15, 0.85);
  --bg-tertiary: rgba(15, 15, 20, 0.6);
  --bg-hover: rgba(0, 243, 255, 0.1);
  --bg-active: rgba(0, 243, 255, 0.15);

  --text-primary: #ffffff;
  --text-secondary: #a0a0b0;
  --text-muted: #606070;

  --accent-primary: #00f3ff;
  --accent-secondary: #ff007f;
  --accent-glow: rgba(0, 243, 255, 0.5);

  --primary: #9d00ff;
  --primary-glow: rgba(157, 0, 255, 0.6);

  --success: #00ff88;
  --warning: #ffea00;
  --danger: #ff0044;

  --border-color: rgba(0, 243, 255, 0.1);
  --glass-border: 1px solid rgba(0, 243, 255, 0.2);
  --glass-bg: rgba(5, 5, 8, 0.9);
}

[data-theme='cyberpunk'] .sidebar-header {
  background: linear-gradient(180deg, rgba(0,243,255,0.08) 0%, transparent 100%);
  border-bottom: 1px solid rgba(0,243,255,0.1);
}

[data-theme='cyberpunk'] .logo-text {
  background: linear-gradient(135deg, #00f3ff 0%, #ff007f 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

[data-theme='cyberpunk'] .new-chat-btn-top,
[data-theme='cyberpunk'] .create-chat-btn-large,
[data-theme='cyberpunk'] .avatar,
[data-theme='cyberpunk'] .unread-badge {
  background: linear-gradient(135deg, #00f3ff, #ff007f);
  color: white;
  box-shadow: 0 4px 15px rgba(0, 243, 255, 0.3);
}

[data-theme='cyberpunk'] .message.outgoing {
  background: linear-gradient(135deg, #9d00ff, #ff007f) !important;
  color: white;
  border: none !important;
  box-shadow: 0 4px 15px rgba(255, 0, 127, 0.2);
}

[data-theme='cyberpunk'] .chat-item.active {
  background: rgba(0, 243, 255, 0.1);
  box-shadow: inset 0 0 0 1px rgba(0, 243, 255, 0.3);
}

[data-theme='cyberpunk'] .chat-item.active::before {
  background: linear-gradient(180deg, #00f3ff, #ff007f);
  box-shadow: 0 0 10px rgba(0, 243, 255, 0.5);
}

[data-theme='cyberpunk'] .search-input:focus {
  border-color: var(--accent-primary);
  box-shadow: 0 0 0 3px rgba(0, 243, 255, 0.2);
}

[data-theme='cyberpunk'] .pinned-messages-bar {
  background: rgba(0, 243, 255, 0.05);
  border-bottom: 1px solid rgba(0, 243, 255, 0.2);
}

[data-theme='cyberpunk'] .pinned-msg-label,
[data-theme='cyberpunk'] .message-time {
  color: #00f3ff;
}

[data-theme='cyberpunk'] .encryption-badge {
  background: rgba(255, 0, 127, 0.1);
  border: 1px solid rgba(255, 0, 127, 0.3);
  color: #ff007f;
}

[data-theme='cyberpunk'] .message.incoming {
  background: rgba(10, 10, 15, 0.8) !important;
  border: 1px solid rgba(0, 243, 255, 0.2) !important;
}

[data-theme='cyberpunk'] .message-toolbar {
  background: rgba(0, 243, 255, 0.05) !important;
  border-top: 1px solid rgba(0, 243, 255, 0.2) !important;
}

[data-theme='cyberpunk'] .message-input {
  border: 1px solid rgba(0, 243, 255, 0.2) !important;
  background: rgba(0, 0, 0, 0.5) !important;
}

[data-theme='cyberpunk'] .message-input:focus {
  border-color: #00f3ff !important;
  box-shadow: 0 0 0 2px rgba(0, 243, 255, 0.2) !important;
}
`;
fs.appendFileSync('client/src/styles/index.css', css);
