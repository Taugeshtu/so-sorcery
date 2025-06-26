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

## Known Issues / TODO

EVERYTHING. This is early days

Functional:
- [ ] Forking context
- [ ] Images handling
- [ ] Extractor misses code blocks, no bueno
- [~] Improve the system: agent is low on self-reflection, doesn't recognize refactoring, doesn't recognize the files are actual files it seems...
    this needs re-testing on larger contexts and deeper convos. Maybe two-stage format helps with that?
    did catch a hallucination once about file contents which wasn't present in context... Time to bring back "list the unknowns"!
- [ ] System: PA really loves repeating what's already in the knowledge...

Visual & polish:
- [ ] ?? Remove collapse button if item is short enough to fit
- [ ] Parsing "thinking" stages of PA response and displaying them somewhere (couple that with streaming support?)
- [ ] Add a list of agents to system environment for PA
- [ ] Make completed work auto-disappears? (at least for Tool ops?) (I do like being able to see what's going on... provide an event log?) Maybe it becomes omitted?
- [ ] Settings: custom additional ignore
- [ ] Auto-focusing the input field whenever Sorcery editor is activated
- [ ] A way to navigate focus from files search to results
- [ ] Folders on top in files tree
- [ ] When files are added/removed, we need to be aware of this... Also maybe pull the list of availabe files up a level, it's more workspace-global than per-context anyway
- [ ] Searched, added item - search didn't clear, BUT filter did drop. Hmmm... Dunno which should happen, but not that
- [ ] What if you already have a file "Session_{X}.sorcery"?
        - I think we can half-solve it by auto-renaming our sorceries. First after two items in the workspace, just take items, send them over to small model; then do that again 5-7 items in?..
        - but that doesn't _solve_ the problem, only makes it much less likely
- [ ] Accumulate costs also over all workspaces

Big & faraway items:
- [~] File read tool (done, but untested)
- [ ] File write tool
- [ ] !! consider more detailed format for submitting knowledge, allowing UPDATING as well (is a scratchpad, you see?)
- [ ] Parsing & making jumpable `[[wikilinks]]`, obsidian-style, for IDs and files
- [ ] Multiple agent types ("psyches": autopath, patcher...)
- [ ] Knowledge auto-naming & summary (Haiku to the rescue?)
- [ ] Reference arrows (this is the big visual feature!)
- [ ] building PA input with graph pull
- [ ] psyche editor (ideally storing them into user-global storage but not settings)
- [ ] maybe streaming support?
- [ ] Better tool ecosystem (interpreter, tree, maybe bash/cmd?)
- [ ] Docs/readme of some kind, or a tutorial

---

## Release Notes

### 0.6.x

- [x] Try to split the gargantuan `script.js` into several files?
- [ ] Hotkey settings for "add" and "send it"
- [ ] Add ID in the header of knowledge items?
- [ ] Undo/Redo (VS Code's built-in document undo should work?)
- [ ] "No knowledge yet" also reacts to file knowledge. Shouldn't
- [ ] button to re-scan the files, as an alternative to live wire monitor
- [ ] remove available files list from the json?..

### 0.6.1

- [x] After reloading window, most recent full response got nuked :/ no bueno!

### 0.6.0

- [x] Cost counting and displaying

### 0.5.0

- [x] Daisy-chained psyches
    - [x] extractor seems to work... but lost traceability.
    - [x] post-extractor parsing didn't pick up work, whyyy?.. no newlines?.. Yep.
- [x] Second case for "parsing failed, therefore full response": not just missing terminator, but also no knowledge nor work items
- [x] Move PA response parsing out of "Worker" (since worker can be NOT PA)

### 0.4.0

Better input blob generation:

- [x] Add work items to the knowledge blob
- [x] Try different formatting when congealing knowledge blob for file knowledge? So the agent is maybe less confused?

### 0.3.1

Debuggability:

- [x] A way to view the full response of PA somewhere
- [x] "Run" seems to be leading to a stuck state

### 0.2.0

Initial:

- [x] Copy buttons
- [x] remove storing the whole-ass file content inside file knowledge
- [x] Fix context builder
- [x] better project assistant prompt
- [x] !!Handling work items!!
- [x] Work items are not being saved to json lol
- [x] more robust error handling on the backend pls?
- [x] Add a list of tools to system environment for PA
- [x] Bring in block parser because xml extraction fails miserably lol
- [x] Button to just run?.. Maybe it changes text depending on whether our user input is empty or not
- [x] when add & run-ing, refresh the screen
- [x] Some kind of indicator (gradient into gray, transparent on top?) that the item is collapsed
- [x] user knowledge adds in pre-collapsed
- [x] Make multi-read actually work:
    - [x] improve system prompt to enable it better? or tool description?
    - [x] automatically added to context things do not force view update??..
            - not just view update; despite in-memory items being present, they don't get into json either. I think there's something fucky with the file-editor-memory thing going on