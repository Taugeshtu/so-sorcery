# So-Sorcery
LLMs in your workspace, BUT **you control the context**.

So-Sorcery: a VS Code extension that lets you create & manage persistent "contexts" for AI work, stored in `.sorcery` files and edited via a custom visual interface. Each context acts like a scratchpad of knowledge, workspace awareness, and chat history — designed to work with multiple agents, forkable state, and user-controlled tool use.
_(trivia: majority of So-Sorcery was written using So-Sorcery)_

---

## Usage

- Run the command: `Sorcery: New Session File` _(keybinding: `sorcery.newSession`, `alt+S`)_
- This creates a `.sorcery` file and opens the **custom context editor**
- Use the editor to write & manage knowledge cards, add/remove workspace files to context, and invoke agents
- `+` button _(keybinding: `sorcery.addKnowledge`, `alt+enter`)_ adds your input to context
- `Run`/`+ & Run` button _(keybinding: `sorcery.addAndRun`, `alt+S` when in `.sorcery` file)_ runs Project Assistant on the context
- Fork your current session whenever _(keybinding: `sorcery.forkSession`, `shift+alt+F`)_
- Move your `.sorcery` files wherever - they are just files. Check them into your repo if you want to

---

## Features

- [x] **Custom editor for `.sorcery` files**
- [x] **Forkable context sessions** with knowledge cards, chat, and workspace metadata
- [x] **Agent interaction driven by few-shot prompting + progressive prompt refinement**, not chat history
- [x] **Explicit tool invocation model** — the agent stops when it's done, user decides what happens next
- [x] **Context-aware file access**, filtered by workspace file extensions & `.gitignore`
- [~] **Supports OpenAI & Anthropic backends**

---

## Philosophy

Sorcery assumes that:
- Typical document-based work is highly non-linear
- AI agents are powerful but fallible
- User context control is more important than log-style chat memory
- Good prompting beats long conversations

Therefore, Sorcery is:
- a sea of knowledge
- a sea of work
- a collection of agents and tools to tackle both, and
- user-informed orchestration of the process

---

## Requirements

- An OpenAI or Claude API key (set these via extension settings; right now only Claude is required, OpenAI option to come with psyches editor)

#### Building from source
- Have **Node.js v18+** installed (check with `node -v`)
- Have **VSCode v1.100+**; have it in `PATH` system variable

- clone the repo
- `npm install`
- `npm run compile` - builds the extension, find it in `OUTPUT_PATH_GOES_HERE`
- `npm run install` - builds & installs the extension into system-known VSCode (the one in the `PATH`)

---

## Extension Settings

- `sorcery.openAIApiKey`: OpenAI API key
- `sorcery.claudeApiKey`: Claude API key
- `sorcery.includeFileExtensions`: Whitelist of file extensions to consider in workspace file context
