<script lang="ts">
    import { Plus, Mic, ArrowUp, BotMessageSquare, NotebookTabs, Workflow, Waypoints, Bolt, CircleCheck, LoaderCircle, Circle, Code, Search, Brain } from "@lucide/svelte";
    import type { ChatItem, MessageItem, ActionItem } from "$lib/types/chat";

    let items = $state<ChatItem[]>([
        {
            kind: 'action',
            type: 'think',
            title: 'THINKING',
            state: 'done',
            content: []
        },
        {
            kind: 'action',
            type: 'search',
            title: 'SEARCHING IN KNOWLEDGE BASE',
            state: 'running',
            content: []
        },
        {
            kind: 'action',
            type: 'code',
            title: 'WRITING CODE',
            state: 'running',
            content: [
                { title: 'Refactor chat module', state: 'done' },
                { title: 'Add type definitions', state: 'running' },
                { title: 'Write unit tests', state: 'pending' },
            ]
        },
        { kind: 'message', role: 'agent', text: 'Hello! I am Amari. How can I help you today?' },
    ]);
    let input = $state('');

    function isMessage(item: ChatItem): item is MessageItem {
        return item.kind === 'message';
    }

    function isAction(item: ChatItem): item is ActionItem {
        return item.kind === 'action';
    }

    function sendMessage() {
        const text = input.trim();
        if (!text) return;
        items = [...items, { kind: 'message', role: 'user', text }];
        input = '';
        setTimeout(() => {
            items = [...items, {
                kind: 'action',
                type: 'code',
                title: 'Writing code',
                state: 'running',
                content: [
                    { title: 'Refactor chat module', state: 'done' },
                    { title: 'Add type definitions', state: 'running' },
                    { title: 'Write unit tests', state: 'pending' },
                ]
            }];
        }, 500);
        setTimeout(() => {
            items = [...items, { kind: 'message', role: 'agent', text: 'Thinking...' }];
        }, 1500);
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
            <div class="flex flex-col gap-0 flex-1 pb-4 overflow-y-auto scrollbar-thin scrollbar-gutter-auto scrollbar-thumb-gray-500 scrollbar-track-gray-100">
                {#each items as item}
                    {#if isMessage(item)}
                        <div class="{item.role === 'user' ? 'justify-end' : 'justify-start'} flex w-full py-4">
                            <span class="border border-gray-200 shadow-xs px-4 py-2 rounded-t-xl {item.role === 'user' ? 'bg-white rounded-bl-xl rounded-br-sm' : 'bg-gray-500 text-white rounded-br-xl rounded-bl-sm'}">{item.text}</span>
                        </div>
                    {:else if isAction(item)}
                        <div class="justify-start flex flex-col w-full font-agent">
                            <div class="flex items-start gap-4 text-sm font-medium">
                                <div class="flex flex-col items-center gap-2 pt-1.5">
                                    <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                                    <div class="w-px flex-1 bg-gray-400 min-h-4"></div>
                                </div>
                                <div class="flex gap-2 items-center text-gray-600">
                                    {#if item.type === 'search'}
                                        <Search size={16} class="shrink-0" />
                                    {:else if item.type === 'think'}
                                        <Brain size={16} class="shrink-0" />
                                    {:else}
                                        <Code size={16} class="shrink-0" />
                                    {/if}
                                    <span >{item.title}</span>
                                </div>
                            </div>
                            {#if item.content.length > 0}
                                <div class="flex flex-col -mt-2">
                                    {#each item.content as sub}
                                        <div class="flex items-center gap-8 text-sm text-gray-600">
                                            <div class="flex flex-col items-center w-2">
                                                <div class="w-px flex-1 bg-gray-400 min-h-5"></div>
                                            </div>
                                            <div class="flex gap-4 items-center">
                                                <div class="w-2 h-2 bg-gray-400 rounded-full"></div>
                                                <span>{sub.title}</span>
                                            </div>
                                        </div>
                                    {/each}
                                </div>
                            {/if}
                        </div>
                    {/if}
                {/each}
            </div>
            <div class="flex flex-col w-full border border-gray-200 bg-gray-200 shadow-sm rounded-md overflow-hidden">
                <textarea
                    bind:value={input}
                    onkeydown={onKeyDown}
                    placeholder="Type a message..."
                    rows="2"
                    class=" p-2 resize-none bg-white focus:outline-none "
                ></textarea>
                <div class="flex justify-between p-2">
                    <button class="flex justify-center items-center aspect-square ring-1 ring-gray-300 shadow-md rounded-full">
                        <Plus size={16} />
                    </button>
                    <div class="flex gap-2">
                        <button class=" text-gray-400 rounded-full p-2" onclick={sendMessage}>
                            <Mic size={16} />
                        </button>
                        <button class="bg-gray-600 text-white rounded-full p-2 shadow-sm" onclick={sendMessage}>
                            <ArrowUp size={16} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    </div>
</div>
<div class="fixed bottom-4 left-[50%] -translate-x-1/2 flex gap-1 w-fit p-1 bg-gray-100 rounded-md shadow-sm inset-shadow-2xs">
    <button class="flex p-2 gap-2 items-center justify-center rounded-md bg-white text-gray-800 inset-shadow-md">
        <BotMessageSquare size={20} />
        <span class="font-semibold">Agent</span>
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-md text-gray-800">
        <NotebookTabs size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-md text-gray-800">
        <Workflow size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-md text-gray-800">
        <Waypoints size={20} />
    </button>
    <button class="flex p-2 gap-2 items-center justify-center rounded-md text-gray-800">
        <Bolt size={20} />
    </button>
</div>
