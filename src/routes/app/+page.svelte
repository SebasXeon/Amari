<script lang="ts">
  let messages = $state<{ role: 'user' | 'agent'; text: string }[]>([
    { role: 'agent', text: 'Hello! I am Amari. How can I help you today?' }
  ]);
  let input = $state('');

  function sendMessage() {
    const text = input.trim();
    if (!text) return;
    messages = [...messages, { role: 'user', text }];
    input = '';
    // Placeholder: echo back after a short delay
    setTimeout(() => {
      messages = [...messages, { role: 'agent', text: 'Thinking...' }];
    }, 500);
  }

  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }
</script>

<div class="chat-container">
  <header class="chat-header">
    <h1>Amari Chat</h1>
  </header>

  <div class="messages">
    {#each messages as msg}
      <div class="message {msg.role}">
        <span class="bubble">{msg.text}</span>
      </div>
    {/each}
  </div>

  <div class="input-area">
    <textarea
      bind:value={input}
      onkeydown={onKeyDown}
      placeholder="Type a message..."
      rows="2"
    ></textarea>
    <button onclick={sendMessage}>Send</button>
  </div>
</div>

<style>
  :global(html), :global(body) {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background: #1a1a2e;
    color: #e0e0e0;
    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  }

  .chat-container {
    display: flex;
    flex-direction: column;
    width: 100vw;
    height: 100vh;
  }

  .chat-header {
    padding: 16px 20px;
    background: #16213e;
    border-bottom: 1px solid #0f3460;
    flex-shrink: 0;
  }

  .chat-header h1 {
    margin: 0;
    font-size: 1.1rem;
    font-weight: 600;
    color: #e94560;
  }

  .messages {
    flex: 1;
    overflow-y: auto;
    padding: 16px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .message {
    display: flex;
  }

  .message.user {
    justify-content: flex-end;
  }

  .message.agent {
    justify-content: flex-start;
  }

  .bubble {
    max-width: 70%;
    padding: 10px 14px;
    border-radius: 12px;
    font-size: 0.95rem;
    line-height: 1.4;
    word-break: break-word;
  }

  .message.user .bubble {
    background: #e94560;
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .message.agent .bubble {
    background: #16213e;
    color: #e0e0e0;
    border-bottom-left-radius: 4px;
    border: 1px solid #0f3460;
  }

  .input-area {
    display: flex;
    gap: 10px;
    padding: 12px 20px;
    background: #16213e;
    border-top: 1px solid #0f3460;
    flex-shrink: 0;
  }

  textarea {
    flex: 1;
    resize: none;
    background: #0f3460;
    color: #e0e0e0;
    border: 1px solid #0f3460;
    border-radius: 8px;
    padding: 10px 12px;
    font-family: inherit;
    font-size: 0.95rem;
    outline: none;
  }

  textarea:focus {
    border-color: #e94560;
  }

  button {
    background: #e94560;
    color: #fff;
    border: none;
    border-radius: 8px;
    padding: 0 18px;
    font-size: 0.95rem;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s ease;
  }

  button:hover {
    background: #d13650;
  }
</style>
