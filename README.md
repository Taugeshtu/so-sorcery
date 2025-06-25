# So-Sorcery
LLMs in your workspace, BUT **you control the context**.

So-Sorcery: a VS Code extension that lets you create & manage persistent "contexts" for AI work, stored in `.sorcery` files and edited via a custom visual interface. Each context acts like a scratchpad of knowledge, workspace awareness, and chat history — designed to work with multiple agents, forkable state, and user-controlled tool use.
_(trivia: majority of So-Sorcery was written using So-Sorcery)_

---

## Features

- [~] **Custom editor for `.sorcery` files**
- [ ] **Forkable context sessions** with knowledge cards, chat, and workspace metadata
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
- Tools are constraints, not capabilities
- Good prompting beats long conversations

---

## Usage

- Run the command: `Sorcery: New Context File`
- This creates a `.sorcery` file and opens the **custom context editor**
- Use the editor to write & manage knowledge cards, add/remove workspace files to context, and invoke agents

---

## Requirements

- An OpenAI or Claude API key (set these via extension settings; right now only Claude is required, OpenAI option to come with psyches editor)

#### Building from source
- Have **Node.js v18+** installed (check with `node -v`)
- Have **VSCode v1.100+**; have it in `PATH` system variable

- clone the repo
- `npm run compile` - builds the extension, find it in `OUTPUT_PATH_GOES_HERE`
- `npm install` - builds & installs the extension into system-known VSCode (the one in the `PATH`)

---

## Extension Settings

- `sorcery.openAIApiKey`: OpenAI API key
- `sorcery.claudeApiKey`: Claude API key
- `sorcery.includeFileExtensions`: Whitelist of file extensions to consider in workspace file context

---

## Known Issues

EVERYTHING. This is early days, see TODO for more info

---

## TODO

Functional:
- [x] Copy buttons
- [x] remove storing the whole-ass file content inside file knowledge
- [x] Fix context builder
- [x] better project assistant prompt
- [x] !!Handling work items!!
- [x] maybe better parsing?
- [x] Work items are not being saved to json lol
- [ ] A way to view the full response of PA somewhere
- [x] Make multi-read actually work:
    - [x] improve system prompt to enable it better? or tool description?
    - [x] automatically added to context things do not force view update??..
            - not just view update; despite in-memory items being present, they don't get into json either. I think there's something fucky with the file-editor-memory thing going on
- [ ] Test that the most up-to-date content of the file is being sent! Agent reactions look sus
- [ ] Undo/Redo (VS Code's built-in document undo should work?)

- [~] Improve the system: agent is low on self-reflection, doesn't recognize refactoring, doesn't recognize the files are actual files it seems...

Visual & polish:
- [ ] "No knowledge yet" also reacts to file knowledge. Shouldn't
- [ ] "Run" seems to be leading to a stuck state
- [x] user knowledge adds in pre-collapsed
- [x] Some kind of indicator (gradient into gray, transparent on top?) that the item is collapsed
- [ ] ?? Remove collapse button if item is short enough to fit
- [ ] when add & run-ing, refresh the screen
- [ ] Cost counting and displaying
- [ ] Add ID in the header of knowledge items?
- [ ] remove available files list from the json?..
- [ ] Parsing "thinking" stages of PA response and displaying them somewhere (couple that with streaming support?)
- [ ] Hotkey settings for "add" and "send it"
- [x] Add a list of tools to system environment for PA
- [ ] Add a list of agents to system environment for PA
- [ ] Move PA response parsing out of "Worker" (since worker can be NOT PA)
- [x] Button to just run?.. Maybe it changes text depending on whether our user input is empty or not
- [x] Bring in block parser because xml extraction fails miserably lol
- [ ] Move parsing from "worker" into "contextHolder" because that's PA-specific

Big & faraway items:
- [x] more robust error handling on the backend pls?
- [~] File read tool (done, but untested)
- [ ] File write tool
- [ ] !! consider more detailed format for submitting knowledge, allowing UPDATING as well (is a scratchpad, you see?)
- [ ] Parsing & making jumpable wikilinks, obsidian-style, for IDs and files
- [ ] Forking context
- [ ] Multiple agent types ("psyches": autopath, patcher...)
- [ ] Knowledge auto-naming & summary (Haiku to the rescue?)
- [ ] Reference arrows (this is the big visual feature!)
- [ ] chuck the whole file list (respecting gitignore) into context; but UI is filtered by extension?.. So that the agent knows what's up? OR give the agent "tree" command... yeah, that might be better. On-demand stuff...
- [ ] building PA input with graph pull
- [ ] psyche editor (ideally storing them into user-global storage but not settings)
- [ ] maybe streaming support?
- [ ] Images handling
- [ ] Better tool ecosystem (interpreter, tree, maybe bash/cmd?)

---

## Release Notes

### 0.2.0

- Initial alpha release with custom context editor, knowledge & work cards, and file context. Has a working `multiread` tool for the agent to pull up files into context by themselves
