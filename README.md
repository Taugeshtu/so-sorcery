# So-Sorcery
LLMs in your workspace, BUT **you control the context**.

So-Sorcery: a VS Code extension that lets you create & manage persistent "contexts" for AI work, stored in `.sorcery` files and edited via a custom visual interface. Each context acts like a scratchpad of knowledge, workspace awareness, and chat history — designed to work with multiple agents, forkable state, and user-controlled tool use.

---

## Features

- **Custom editor for `.sorcery` files**
- **Forkable context sessions** with knowledge cards, chat, and workspace metadata
- **Agent interaction driven by few-shot prompting + progressive prompt refinement**, not chat history
- **Explicit tool invocation model** — the agent stops when it's done, user decides what happens next
- **Context-aware file access**, filtered by workspace file extensions & `.gitignore`
- **Supports OpenAI & Anthropic backends**

---

## Philosophy

Sorcery assumes that:
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

- An OpenAI or Claude API key (can be configured via extension settings)

---

## Extension Settings

This extension contributes the following settings:

- `sorcery.openAIApiKey`: OpenAI API key
- `sorcery.claudeApiKey`: Claude API key
- `sorcery.includeFileExtensions`: Whitelist of file extensions to consider in workspace file context

---

## Known Issues

- No built-in agent or tool UI yet — everything is backend-marshaled
- Some UI interactions are placeholder (e.g., file search, list layouts)

---

## TODO

Functional:
- [x] Copy buttons
- [x] remove storing the whole-ass file content inside file knowledge
- [x] Fix context builder
- [x] better project assistant prompt
- [x] !!Handling work items!!
- [x] maybe better parsing?
- [ ] Undo/Redo (VS Code's built-in document undo should work?)
- [ ] File read/write tools

Vusial & polish:
- [ ] "No knowledge yet" also reacts to file knowledge. Shouldn't
- [ ] user knowledge adds in pre-collapsed
- [x] Some kind of indicator (gradient into gray, transparent on top?) that the item is collapsed
- [ ] Remove collapse button if item is short enough to fit
- [ ] when add & run-ing, refresh the screen
- [ ] Cost counting and displaying
- [ ] remove available files list from the json?..
- [ ] Parsing "thinking" stages of PA response and displaying them somewhere
- [ ] Hotkey settings for "add" and "send it"
- [ ] Add a list of agents and tools to system environment for PA
- [ ] Move PA response parsing out of "Worker" (since worker can be NOT PA)

Big & faraway items:
- [ ] more robust error handling on the backend pls?
- [ ] Multiple agent types ("psyches")
- [ ] Knowledge auto-naming
- [ ] Reference arrows (this is the big visual feature!)
- [ ] chuck the whole file list (respecting gitignore) into context; but UI is filtered by extension?.. So that the agent knows what's up? OR give the agent "tree" command... yeah, that might be better. On-demand stuff...
- [ ] building PA input with graph pull
- [ ] psyche editor (ideally storing them into user-global storage but not settings)
- [ ] maybe streaming support?
- [ ] Images handling
- [ ] Better tool ecosystem (interpreter, tree, maybe bash/cmd?)

---

## Release Notes

### 0.0.1

- Initial alpha release with custom editor, knowledge cards, and file context
