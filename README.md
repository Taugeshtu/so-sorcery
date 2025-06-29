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

---

## Known Issues / TODO

Functional:
- [ ] A way to define what inputs go into a psyche. And built-ins for that - "parent_output", "knowledge_blob", "available_files", maybe something else... like tools, agents?? Call that field `awareness`
- [ ] Images handling
- [ ] Extractor misses code blocks, no bueno
- [ ] PA hallucinates a bit about files; may need prompt massaging
- [~] Improve the system: agent is low on self-reflection, doesn't recognize refactoring, doesn't recognize the files are actual files it seems...
    this needs re-testing on larger contexts and deeper convos. Maybe two-stage format helps with that?
    did catch a hallucination once about file contents which wasn't present in context... Time to bring back "list the unknowns"!
- [ ] System: PA really loves repeating what's already in the knowledge...

Visual & polish:
- [ ] the way "run" button blocks between "run" and "+ & run" is somehow different
- [ ] when we add an item, we lose focus from the input field. Not nice!
- [ ] Accumulate costs also over all workspaces
- [ ] Feels like cost calc is somewhat buggy... Needs a second pass
- [ ] Add a list of agents to system environment for PA
- [ ] Starting a new session from a file should maybe pull that file into context from the get-go?..
- [ ] Starting a new session from a file WITH SELECTION pulls a file AND generates that selection as a knowledge item?
- [ ] Searched, added item - search didn't clear, BUT filter did drop. Hmmm... Dunno which should happen, but not that
- [ ] Auto-focusing the input field whenever Sorcery editor is activated
- [ ] Undo/Redo (VS Code's built-in document undo should work?)
- [ ] Settings: custom additional ignore
- [ ] Somehow pipe psyches' display names into the frontend... wait, can we use display names to store? Probably not a good idea, BUT we do need them unique, maybe?..
- [ ] Add a button somewhere in the UI to fork a session?
- [ ] Make completed work auto-disappears? (at least for Tool ops?) (I do like being able to see what's going on... provide an event log?) Maybe it becomes omitted?
- [ ] A way to navigate focus from files search to results
- [ ] Folders on top in files tree
- [ ] ?? Remove collapse button if item is short enough to fit
- [ ] Parsing "thinking" stages of PA response and displaying them somewhere (couple that with streaming support?)

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
- [ ] user-informed extra context, on the level of working dir/user themselves (like preferences, maybe info that's general about project, etc... altho project stuff coooould be a file; and maybe the way to do that would be to "pin" it in the tree, so it auto-adds to every new session, but can be picked out? and maybe we also have a way to "memorize" a particular bit of knowledge...)
- [ ] When files are added/removed, we need to be aware of this...

---

## Release Notes

### 0.x.x
- [x] Move available files tracking out of ContextHolder

### 0.7.0

- [x] Forking context
- [x] What if you already have a file "Session_{X}.sorcery"?

### 0.6.7

- [x] Hotkey settings for "add" and "send it"; also maybe for creating new context??..
- [x] button to re-scan the files, as an alternative to live wire monitor
- [x] "No knowledge yet" also reacts to file knowledge. Shouldn't
- [x] Add ID in the header of knowledge items?
- [x] remove available files list from the json?..
- [x] Try to split the gargantuan `script.js` into several files?

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