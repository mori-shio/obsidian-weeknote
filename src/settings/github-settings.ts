import { Setting, Notice, App } from "obsidian";
import { PluginSettings, PluginData, getCache } from "../globals";
import { AccountSettings } from "./account";
import { GithubAccount } from "./types";
import { t } from "../i18n";

export class GithubSettingsUI {
    private accountSettings: AccountSettings;

    constructor(private app: App, private saveCallback: () => Promise<void>, private displayCallback: () => void) {
        this.accountSettings = new AccountSettings(
            app,
            document.body, // Temporary
            saveCallback,
            displayCallback,
            this.removeAccount.bind(this)
        );
    }

    private async removeAccount(account: GithubAccount) {
        PluginSettings.accounts.remove(account);
        await this.saveCallback();
    }
    
    private async saveNewAccount(account: GithubAccount) {
        PluginSettings.accounts.unshift(account);
        await this.saveCallback();
    }

    public display(containerEl: HTMLElement) {
        this.accountSettings.container = containerEl;
        
        containerEl.createEl("h4", { text: t("githubLinkSettings"), cls: "setting-subheading" });
        
        
        // Combined Account Setting
        const accountSetting = new Setting(containerEl)
            .setName(t("githubAccounts"))
            .setDesc(t("defaultAccountDesc"));

        // Default Account Dropdown
        accountSetting.addDropdown((dropdown) => {
            const options = PluginSettings.accounts.reduce<Record<string, string>>((acc: Record<string, string>, account: GithubAccount) => {
                acc[account.id] = account.name;
                return acc;
            }, {});
            dropdown.addOptions(options);
            dropdown.setValue(PluginSettings.defaultAccount ?? "");
            dropdown.onChange(async (value) => {
                const selectedAccount = PluginSettings.accounts.find((acc: GithubAccount) => acc.id === value);
                if (selectedAccount) {
                    PluginSettings.defaultAccount = selectedAccount.id;
                    await this.saveCallback();
                }
            });
        });

        // Add Account Button
        accountSetting.addButton((button) => {
            button.setIcon("plus");
            button.setTooltip(t("addGithubAccount"));
            button.onClick(() => {
                this.accountSettings.renderNewAccount(newAccountSection, this.saveNewAccount.bind(this));
            });
        });
        
        const newAccountSection = containerEl.createDiv();
		if (this.accountSettings.newAccount) {
			this.accountSettings.renderNewAccount(newAccountSection, this.saveNewAccount.bind(this));
		}
            
        this.accountSettings.render(PluginSettings.accounts);
        
        // --- Maintenance ---
        new Setting(containerEl)
			.setName(t("clearCache"))
			.addButton((button) => {
				button.setButtonText(t("clearCache"));
				button.onClick(async () => {
                    if (getCache()) {
					    const itemsDeleted = getCache().clean(new Date());
					    PluginData.cache = null;
					    await this.saveCallback();
					    new Notice(t("cacheCleared").replace("{count}", String(itemsDeleted)), 3000);
                    }
				});
			});
    }
}
