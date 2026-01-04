import type { App } from "obsidian";
import { Setting, setIcon } from "obsidian";
import type { Verification } from "@octokit/auth-oauth-device/dist-types/types";
import { AuthModal } from "../auth-modal";
import { auth } from "../github/auth";
import type { GithubAccount } from "./types";
import { t } from "../i18n";

export class AccountSettings {
	authModal: AuthModal | null = null;
	newAccount: GithubAccount | null = null;

	constructor(
		private readonly app: App,
		public container: HTMLElement,
		private readonly saveCallback: () => Promise<void>,
		private readonly displayCallback: () => void,
		private readonly removeCallback: (account: GithubAccount) => Promise<void>,
	) {}

	public render(accounts: GithubAccount[]): void {
		for (const account of accounts) {
			this.renderAccountSetting(account);
		}
	}

	public renderNewAccount(
		container: HTMLElement,
		saveNewAccountCallback: (account: GithubAccount) => Promise<void>,
	): void {
		if (!this.newAccount) {
			this.newAccount = { id: crypto.randomUUID(), name: "", orgs: [], token: "", customOAuth: false };
		}
		// TODO: Combine the new account and existing account rendering to reduce duplication
		const accountContainer = container.createDiv({ cls: "account-settings-group" });

		new Setting(accountContainer)
			.setName(t("accountName"))
			.setDesc(t("required"))
			.addText((text) => {
				text.setValue(this.newAccount!.name);
				text.onChange((value) => {
					this.newAccount!.name = value;
				});
			});

		new Setting(accountContainer)
			.setName(t("orgsAndUsers"))
			.setDesc(t("orgsAndUsersDesc"))
            .setClass("vertical-resize-textarea")
			.addTextArea((text) => {
				text.setValue(this.newAccount!.orgs.join(", "));
				text.onChange((value) => {
					this.newAccount!.orgs = value.split(",").map((acc) => acc.trim());
				});
			});

		const customOAuthSetting = new Setting(accountContainer)
			.setName(t("useCustomOAuth"))
			.setDesc(t("useCustomOAuthDesc"))
			.addToggle((toggle) => {
				toggle.setValue(this.newAccount!.customOAuth ?? false);
				toggle.onChange((value) => {
					this.newAccount!.customOAuth = value;
					this.displayCallback();
				});
			});
		if (this.newAccount.customOAuth) {
			customOAuthSetting.addText((text) => {
				text.setValue(this.newAccount!.clientId ?? "");
				text.setPlaceholder(t("clientIdPlaceholder"));
				text.onChange((value) => {
					this.newAccount!.clientId = value.trim();
				});
			});
		}

		new Setting(accountContainer)
			.setName(t("token"))
			.setDesc(t("tokenDesc"))
			.addButton((button) => {
				button.setButtonText(t("generateToken"));
				button.onClick(async () => {
					const clientId = this.newAccount?.customOAuth ? this.newAccount.clientId : undefined;
					const authResult = await auth(
						this.tokenVerification.bind(this),
						clientId,
					)({
						type: "oauth",
					});
					this.authModal?.close();
					this.authModal = null;
					this.newAccount!.token = authResult.token;
					this.displayCallback();
				});
			})
			.addText((text) => {
				text.setPlaceholder(t("tokenPlaceholder"));
				text.setValue(this.newAccount!.token);
				text.onChange((value) => {
					this.newAccount!.token = value.trim();
				});
			});

		new Setting(accountContainer)
            .addButton((button) => {
                button.setButtonText(t("cancel"));
                button.onClick(() => {
                    this.newAccount = null;
                    this.displayCallback();
                });
            })
            .addButton((button) => {
                button.setButtonText(t("saveAccount"));
                button.setTooltip(t("saveAccount"));
                button.onClick(async () => {
                    if (!this.newAccount?.name) {
                        return;
                    }
                    await saveNewAccountCallback(this.newAccount);
                    this.newAccount = null;
                    this.displayCallback();
                });
            });
	}

	public renderAccountSetting(account: GithubAccount, parent: HTMLElement = this.container): void {
		const accountContainer = parent.createDiv({ cls: "account-settings-group" });
        
        const headerContainer = accountContainer.createDiv({ cls: "account-settings-header-container" });
		headerContainer.createEl("h5", { text: account.name, cls: "account-settings-header" });
        
        const deleteBtn = headerContainer.createEl("button", { cls: "clickable-icon", attr: { "aria-label": t("deleteAccount") } });
        setIcon(deleteBtn, "trash");
        deleteBtn.onclick = async () => {
            await this.removeCallback(account);
            await this.saveCallback();
            this.displayCallback();
        };

		new Setting(accountContainer)
			.setName(t("accountName"))
			.addText((text) => {
				text.setValue(account.name);
				text.onChange((value) => {
					account.name = value;
					void this.saveCallback();
				});
			});

		new Setting(accountContainer)
			.setName(t("orgsAndUsers"))
			.setDesc(t("orgsAndUsersDesc"))
            .setClass("vertical-resize-textarea")
			.addTextArea((text) => {
				text.setValue(account.orgs.join(", "));
				text.onChange((value) => {
					account.orgs = value.split(",").map((org) => org.trim());
					void this.saveCallback();
				});
			});

		const customOAuthSetting = new Setting(accountContainer)
			.setName(t("useCustomOAuth"))
			.setDesc(t("useCustomOAuthDesc"))
			.addToggle((toggle) => {
				toggle.setValue(account.customOAuth ?? false);
				toggle.onChange((value) => {
					account.customOAuth = value;
					this.displayCallback();
				});
			});
		if (account.customOAuth) {
			customOAuthSetting.addText((text) => {
				text.setValue(account.clientId ?? "");
				text.setPlaceholder(t("clientIdPlaceholder"));
				text.onChange((value) => {
					account.clientId = value.trim();
					void this.saveCallback();
				});
			});
		}

		new Setting(accountContainer)
			.setName(t("token"))
			.setDesc(t("tokenDesc"))
			.addButton((button) => {
				button.setButtonText(t("generateToken"));
				button.onClick(async () => {
					const customClientId = account.customOAuth ? account.clientId : undefined;
					const authResult = await auth(
						this.tokenVerification.bind(this),
						customClientId,
					)({
						type: "oauth",
					});
					this.authModal?.close();
					this.authModal = null;
					account.token = authResult.token;
					await this.saveCallback();
					this.displayCallback();
				});
			})
			.addText((text) => {
				text.setPlaceholder("Personal Access Token / OAuth Token");
				text.setValue(account.token);
				text.onChange((value) => {
					account.token = value.trim();
					void this.saveCallback();
				});
			});
	}

	private tokenVerification(verification: Verification) {
		this.authModal = new AuthModal(this.app, verification);
		this.authModal.open();
	}
}
