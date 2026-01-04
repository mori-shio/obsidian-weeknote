import { RequestError } from "../util";
import { PluginSettings } from "../globals";
import { GithubAccount } from "../settings/types";
import { GitHubApi } from "./api";
import type {
	IssueResponse,
	IssueTimelineResponse,
	PullResponse,
	TimelineCrossReferencedEvent,
    CodeResponse
} from "./response";

const tokenMatchRegex = /repo:(.+)\//;
const api = new GitHubApi();

function getAccount(org?: string): GithubAccount | undefined {
	const account =
		PluginSettings.accounts.find((acc: GithubAccount) => acc.orgs.some((savedOrg: string) => savedOrg === org)) ??
		PluginSettings.accounts.find((acc: GithubAccount) => acc.id === PluginSettings.defaultAccount);
	return account;
}

function getToken(org?: string, query?: string): string | undefined {
	let _org = org;

	// Try and parse org from the query
	if (!org && query) {
		const match = tokenMatchRegex.exec(query);
		if (match?.[0] !== null) {
			_org = match?.[1];
		}
	}

	const account = getAccount(_org);
	return account?.token;
}

export function getIssue(org: string, repo: string, issue: number, skipCache = false): Promise<IssueResponse> {
	return api.getIssue(org, repo, issue, getToken(org), skipCache);
}

export function getPullRequest(
	org: string,
	repo: string,
	pullRequest: number,
	skipCache = false,
): Promise<PullResponse> {
	return api.getPullRequest(org, repo, pullRequest, getToken(org), skipCache);
}

export function getCode(
    org: string,
    repo: string,
    path: string,
    branch: string,
    skipCache = false
): Promise<CodeResponse> {
    return api.getCode(org, repo, path, branch, getToken(org), skipCache);
}

// TODO: This is in the wrong place and should be at the API level to be properly cached
export async function getPRForIssue(timelineUrl: string, org?: string): Promise<string | null> {
	let result: IssueTimelineResponse | null = null;
	try {
		const { response } = await api.queueRequest({ url: timelineUrl }, getToken(org));
		result = response.json as IssueTimelineResponse;
	} catch (err) {
		// 404 means there's no timeline for this, we can ignore the error
		if (err instanceof RequestError && err.status === 404) {
			return null;
		} else {
			throw err;
		}
	}
	if (!result) {
		return null;
	}

	// TODO: Figure out a better/more reliable way to do this.
	const crossRefEvent = result.find((_evt: unknown) => {
		const evt = _evt as Partial<TimelineCrossReferencedEvent>;
		return evt.event === "cross-referenced" && evt.source?.issue?.pull_request?.html_url;
	}) as TimelineCrossReferencedEvent | undefined;
	return crossRefEvent?.source.issue?.pull_request?.html_url ?? null;
}
