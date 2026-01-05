import { Logger } from "./logger";
import { GithubLinkPluginSettings, GithubLinkPluginData, DEFAULT_SETTINGS } from "./settings/types";
import { RequestCache } from "./github/cache";
import { DATA_VERSION } from "./settings/types";

export const PluginSettings: GithubLinkPluginSettings = { ...DEFAULT_SETTINGS };
export const PluginData: GithubLinkPluginData = { cache: null, settings: PluginSettings, dataVersion: DATA_VERSION };
export const logger = new Logger();
let cache: RequestCache;

export function getCache(): RequestCache {
    return cache;
}

export function setCache(newCache: RequestCache) {
    cache = newCache;
}

export function updatePluginSettings(data: Partial<GithubLinkPluginData>) {
    Object.assign(PluginSettings, data.settings);
    Object.assign(PluginData, data);
    logger.logLevel = PluginSettings.logLevel;
    
    // Initialize cache if needed
    if (!cache && PluginData.cache) {
        cache = new RequestCache(PluginData.cache);
    } else if (!cache) {
        cache = new RequestCache(null);
    }
}
