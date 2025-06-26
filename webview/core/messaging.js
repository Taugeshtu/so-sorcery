export class MessageHandler {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.listeners = new Map();
        this.init();
    }

    init() {
        window.addEventListener('message', this.handleMessage.bind(this));
    }

    handleMessage(event) {
        const message = event.data;
        const listeners = this.listeners.get(message.command) || [];
        listeners.forEach(callback => callback(message));
    }

    on(command, callback) {
        if (!this.listeners.has(command)) {
            this.listeners.set(command, []);
        }
        this.listeners.get(command).push(callback);
    }

    send(command, data = {}) {
        this.vscode.postMessage({ command, ...data });
    }

    showInfo(text) {
        this.send('showInformationMessage', { text });
    }
}
