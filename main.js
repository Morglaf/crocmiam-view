"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const obsidian_1 = require("obsidian");
const DEFAULT_SETTINGS = {
    ingredientColor: '#00ff00',
    quantityColor: '#ffff00',
    techniqueColor: '#ffa500',
    timeColor: '#ff0000' // red
};
class CrocMiamSettingTab extends obsidian_1.PluginSettingTab {
    constructor(app, plugin) {
        super(app, plugin);
        this.plugin = plugin;
    }
    display() {
        const { containerEl } = this;
        containerEl.empty();
        containerEl.createEl('h2', { text: 'CrocMiam Plugin Settings' });
        new obsidian_1.Setting(containerEl)
            .setName('Ingredient Color')
            .setDesc('Choose the color for ingredients')
            .addText(text => text
            .setPlaceholder('')
            .setValue(this.plugin.settings.ingredientColor)
            .onChange(async (value) => {
            this.plugin.settings.ingredientColor = value;
            await this.plugin.saveSettings();
            this.plugin.addStyles();
        }).inputEl.type = 'color');
        new obsidian_1.Setting(containerEl)
            .setName('Quantity Color')
            .setDesc('Choose the color for quantities')
            .addText(text => text
            .setPlaceholder('')
            .setValue(this.plugin.settings.quantityColor)
            .onChange(async (value) => {
            this.plugin.settings.quantityColor = value;
            await this.plugin.saveSettings();
            this.plugin.addStyles();
        }).inputEl.type = 'color');
        new obsidian_1.Setting(containerEl)
            .setName('Technique Color')
            .setDesc('Choose the color for techniques')
            .addText(text => text
            .setPlaceholder('')
            .setValue(this.plugin.settings.techniqueColor)
            .onChange(async (value) => {
            this.plugin.settings.techniqueColor = value;
            await this.plugin.saveSettings();
            this.plugin.addStyles();
        }).inputEl.type = 'color');
        new obsidian_1.Setting(containerEl)
            .setName('Time Color')
            .setDesc('Choose the color for times')
            .addText(text => text
            .setPlaceholder('')
            .setValue(this.plugin.settings.timeColor)
            .onChange(async (value) => {
            this.plugin.settings.timeColor = value;
            await this.plugin.saveSettings();
            this.plugin.addStyles();
        }).inputEl.type = 'color');
    }
}
const VIEW_TYPE_CROCMIAM = "crocmiam-view";
class CrocMiamView extends obsidian_1.ItemView {
    constructor(leaf, plugin) {
        super(leaf);
        this.plugin = plugin;
    }
    getViewType() {
        return VIEW_TYPE_CROCMIAM;
    }
    getDisplayText() {
        const activeFile = this.app.workspace.getActiveFile();
        return activeFile ? activeFile.basename : "CrocMiam View";
    }
    async onOpen() {
        this.refreshView();
    }
    async refreshView() {
        const container = this.containerEl.children[1];
        container.empty();
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            const fileContent = await this.app.vault.read(activeFile);
            const processedContent = this.processRecipeContent(fileContent);
            // Create refresh button
            const refreshButton = container.createEl('button', { text: 'Refresh' });
            refreshButton.onclick = () => this.refreshView();
            container.createEl('h1', { text: activeFile.basename });
            const yamlData = this.parseYamlFrontMatter(fileContent);
            const part = parseInt(yamlData.Part) || 1;
            container.createEl('h2', { text: `pour ${part} part${part > 1 ? 's' : ''}` });
            const contentDiv = container.createEl('div');
            contentDiv.style.userSelect = 'text';
            contentDiv.innerHTML = processedContent;
        }
    }
    parseYamlFrontMatter(content) {
        const yamlMatch = content.match(/^---\n([\s\S]+?)\n---/);
        if (!yamlMatch)
            return {};
        const yamlContent = yamlMatch[1];
        const lines = yamlContent.split('\n');
        const result = {};
        lines.forEach(line => {
            const [key, ...values] = line.split(':');
            if (key && values.length > 0) {
                result[key.trim()] = values.join(':').trim();
            }
        });
        return result;
    }
    processRecipeContent(content) {
        const yamlData = this.parseYamlFrontMatter(content);
        const part = parseInt(yamlData.Part) || 1;
        const preparationIndex = content.indexOf("## Préparation");
        if (preparationIndex === -1) {
            return "Section '## Préparation' non trouvée.";
        }
        const preparationContent = content.substring(preparationIndex + "## Préparation".length).trim();
        const ingredientRegex = /\(ingd::\[\[([^\]]+)\]\] : `= this\.Part\*(\d+)` gr\)/g;
        const techniqueRegex = /\(tech::\[\[([^\]]+)\]\] :`= (\d+)\+\(this\.Part\*(\d+\.\d+)\)`:min(?::[^\)]+)?\)/g;
        let processedContent = preparationContent;
        processedContent = processedContent.replace(ingredientRegex, (_, ingredient, quantity) => {
            const calculatedQuantity = part * parseInt(quantity);
            return `<span class="ingredient">${ingredient}</span> <span class="quantity">${calculatedQuantity}gr</span>`;
        });
        processedContent = processedContent.replace(techniqueRegex, (_, technique, baseTime, multiplier) => {
            const techniqueName = technique.split('#')[0];
            const techniqueStep = technique.split('#')[1];
            const calculatedTime = parseInt(baseTime) + (part * parseFloat(multiplier));
            if (['Cuisson', 'trempage', 'Repos'].includes(techniqueName)) {
                return `<span class="technique">${techniqueStep}</span> <span class="time">${calculatedTime} min</span>`;
            }
            else {
                return `<span class="technique">${techniqueStep}</span>`;
            }
        });
        processedContent = processedContent.replace(/\(tech::\[\[([^\]]+)\]\] :`= (\d+\+\(this\.Part\*\d+\.\d+\))`:min\)/g, (_, technique, expression) => {
            const techniqueStep = technique.split('#')[1];
            const calculatedTime = eval(expression.replace('this.Part', part.toString()));
            return `<span class="technique">${techniqueStep}</span> <span class="time">${calculatedTime} min</span>`;
        });
        processedContent = processedContent.replace(/\[\[([^\]]+)\]\]/g, '$1');
        processedContent = processedContent.replace(/#/g, ' ');
        // Replace newlines with <br> for HTML rendering
        processedContent = processedContent.replace(/\n/g, '<br>');
        return processedContent;
    }
    async onClose() {
        // Nothing to clean up
    }
}
class CrocMiamPlugin extends obsidian_1.Plugin {
    constructor(app, manifest) {
        super(app, manifest);
        this.settings = DEFAULT_SETTINGS;
    }
    async onload() {
        await this.loadSettings();
        this.registerView(VIEW_TYPE_CROCMIAM, (leaf) => new CrocMiamView(leaf, this));
        this.addRibbonIcon('pencil', 'Open CrocMiam View', async () => {
            this.activateView();
        });
        this.registerEvent(this.app.workspace.on('file-open', async () => {
            const leaves = this.app.workspace.getLeavesOfType(VIEW_TYPE_CROCMIAM);
            if (leaves.length > 0) {
                leaves[0].view.refreshView();
            }
        }));
        this.addSettingTab(new CrocMiamSettingTab(this.app, this));
        this.addStyles();
        this.addStylesheet();
    }
    addStyles() {
        const style = document.createElement('style');
        style.textContent = `
      .ingredient { color: ${this.settings.ingredientColor}; }
      .quantity { color: ${this.settings.quantityColor}; }
      .technique { color: ${this.settings.techniqueColor}; }
      .time { color: ${this.settings.timeColor}; }
    `;
        document.head.appendChild(style);
    }
    addStylesheet() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'plugins/crocmiam-view/styles.css';
        document.head.appendChild(link);
    }
    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }
    async saveSettings() {
        await this.saveData(this.settings);
        this.addStyles(); // Update styles after saving settings
    }
    async onunload() {
        this.app.workspace.getLeavesOfType(VIEW_TYPE_CROCMIAM).forEach((leaf) => leaf.detach());
    }
    async activateView() {
        let leaf = this.app.workspace.getLeavesOfType(VIEW_TYPE_CROCMIAM)[0];
        if (!leaf) {
            leaf = this.app.workspace.getRightLeaf(false) || this.app.workspace.createLeafBySplit(this.app.workspace.activeLeaf, 'vertical');
            await leaf.setViewState({ type: VIEW_TYPE_CROCMIAM });
        }
        this.app.workspace.revealLeaf(leaf);
    }
}
exports.default = CrocMiamPlugin;
//# sourceMappingURL=main.js.map