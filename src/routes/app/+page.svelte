<script lang="ts">
    import { Plus, Mic, ArrowUp, BotMessageSquare, NotebookTabs, Workflow, Waypoints, Bolt } from "@lucide/svelte";

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

<div class="flex justify-center items-center h-full w-full pb-16 bg-gray-100">
    <div class="h-full max-h-[90vh] w-full max-w-3xl p-4">
        <div class="flex flex-col h-full">
            <div class="flex flex-col gap-2 flex-1 overflow-y-auto pb-4">
                {#each messages as msg}
                <div class="{msg.role === 'user' ? 'justify-end' : 'justify-start'} flex w-full">
                    <span class="border border-gray-200 shadow-xs px-4 py-2 rounded-t-2xl {msg.role === 'user' ? 'bg-white rounded-bl-2xl rounded-br-sm' : 'font-agent bg-gray-500 text-white rounded-br-2xl rounded-bl-sm'}">{msg.text}</span>
                </div>
                {/each}
            </div>
            <div class="flex flex-col w-full border border-gray-200 bg-white shadow-sm rounded-2xl overflow-hidden">
                <textarea
                    bind:value={input}
                    onkeydown={onKeyDown}
                    placeholder="Type a message..."
                    rows="2"
                    class=" p-2 rounded-xl resize-none focus:outline-none "
                ></textarea>
                <div class="flex justify-between p-2">
                    <button class="flex justify-center items-center aspect-square ring-1 ring-gray-200 shadow-sm rounded-full">
                        <Plus size={16} />
                    </button>
                    <div class="flex gap-2">
                        <button class=" text-gray-400 rounded-full p-2" onclick={sendMessage}>
                            <Mic size={16} />
                        </button>
                        <button class="bg-gray-500 text-white rounded-full p-2" onclick={sendMessage}>
                            <ArrowUp size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="fixed bottom-4 left-[50%] -translate-x-1/2 flex gap-1 w-fit p-1 bg-gray-100 rounded-lg shadow-sm inset-shadow-2xs">
    <button class="flex p-2 gap-2 items-center justify-center rounded-lg bg-white text-gray-800 inset-shadow-md">
        <BotMessageSquare size={20} />
        <span class="font-semibold">Agent</span>
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-lg text-gray-800">
        <NotebookTabs size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-lg text-gray-800">
        <Workflow size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-lg text-gray-800">
        <Waypoints size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-lg text-gray-800">
        <Bolt size={20} />
    </button>
</div>

<style>
  
</style>
