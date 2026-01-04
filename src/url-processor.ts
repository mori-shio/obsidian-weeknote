import { requestUrl } from "obsidian";
import { parseUrl } from "./github/url-parse";
import { getIssue, getPullRequest } from "./github/github";

export class UrlProcessor {
  /**
   * Process content to convert URLs to markdown links [Title](URL)
   */
  static async process(content: string, enabled: boolean): Promise<string> {
    if (!enabled) return content;
    
    let newContent = content;
    // Regex to find http/https URLs not already part of a markdown link
    // Negative lookbehind (?<!]\() checks it's not preceded by ](
    const urlRegex = /(?<!\]\()https?:\/\/[^\s\)]+/g;
    const matches = Array.from(newContent.matchAll(urlRegex));
    
    for (let i = matches.length - 1; i >= 0; i--) {
        const match = matches[i];
        const url = match[0];
        const index = match.index!;
        
        // Double check preceding characters to avoid replacing inside existing links
        const preceding = content.substring(0, index);
        if (preceding.trim().endsWith("](")) continue;
        if (preceding.trim().endsWith("] (")) continue; // Avoid edge case

        try {
           let title = "";
           let finalUrl = url;
           
           // GitHub specific handling
           if (url.includes("github.com")) {
               const parsed = parseUrl(url);
               if (parsed) {
                   try {
                       if (parsed.issue) {
                           const issue = await getIssue(parsed.org!, parsed.repo!, parsed.issue);
                           title = `${issue.title} #${parsed.issue}`;
                           finalUrl = issue.html_url; 
                       } else if (parsed.pr) {
                           const pr = await getPullRequest(parsed.org!, parsed.repo!, parsed.pr);
                           title = `${pr.title} #${parsed.pr}`;
                           finalUrl = pr.html_url;
                       }
                   } catch (gitErr) {
                       // GitHub API failed, will fallback to HTML fetch
                   }
               }
           }
           
           // Generic handling if title not found yet (also serves as fallback for GitHub failures)
           if (!title) {
               try {
                   const html = await requestUrl({ url }).text;
                   const doc = new DOMParser().parseFromString(html, "text/html");
                   title = doc.title || "Link";
               } catch (e) {
                   // Fallback - use URL as is
               }
           }
           
           if (title) {
               // Sanitize title to avoid breaking markdown link syntax
               // Replace [ and ] with full-width alternatives to be regex-safe
               title = title.replace(/\[/g, "［").replace(/\]/g, "］");
               
               const replacement = `[${title}](${finalUrl})`;
               newContent = newContent.substring(0, index) + replacement + newContent.substring(index + url.length);
           }
        } catch(e) {
           // Title fetch failed, URL will remain as-is
        }
    }
    return newContent;
  }
}
