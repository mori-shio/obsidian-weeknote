import { createTag } from "../github-renderer";

/**
 * Render markdown text decorations (bold, italic, strikethrough, code) into HTML elements.
 * Appends the rendered content to the given container.
 */
export function renderMarkdownText(container: HTMLElement, text: string): void {
  // Combined regex for markdown decorations
  // Order matters: longer patterns first (** before *, ~~ before ~)
  // Added backtick for inline code
  const mdPattern = /(`(.+?)`|\*\*(.+?)\*\*|__(.+?)__|~~(.+?)~~|~(.+?)~|\*(.+?)\*|_(.+?)_)/g;
  
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  
  while ((match = mdPattern.exec(text)) !== null) {
    // Add plain text before this match
    if (match.index > lastIndex) {
      container.appendText(text.substring(lastIndex, match.index));
    }
    
    const fullMatch = match[0];
    let content: string;
    let tag: keyof HTMLElementTagNameMap;
    
    if (match[2] !== undefined) {
      // ` = code
      content = match[2];
      tag = "code";
    } else if (match[3] !== undefined || match[4] !== undefined) {
      // ** or __ = bold
      content = match[3] || match[4];
      tag = "strong";
    } else if (match[5] !== undefined || match[6] !== undefined) {
      // ~~ or ~ = strikethrough
      content = match[5] || match[6];
      tag = "s";
    } else if (match[7] !== undefined || match[8] !== undefined) {
      // * or _ = italic
      content = match[7] || match[8];
      tag = "em";
    } else {
      // Fallback - just append the match as text
      container.appendText(fullMatch);
      lastIndex = match.index + fullMatch.length;
      continue;
    }
    
    const el = container.createEl(tag, { cls: "task-md-decoration" });
    el.setText(content);
    
    lastIndex = match.index + fullMatch.length;
  }
  
  // Add remaining text after last match
  if (lastIndex < text.length) {
    container.appendText(text.substring(lastIndex));
  }
}

/**
 * Render rich content with markdown links, GitHub rich tags, and text decorations.
 * This is used for both task titles and memo content.
 * @param disableDirectNavigation If true, links won't directly open URLs (useful for memo cards)
 */
export function renderRichContent(
  container: HTMLElement, 
  text: string, 
  disableDirectNavigation: boolean = false
): void {
  // Parse markdown links and render with hover tooltips (or rich tags for GitHub)
  const mdLinkRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let hasLinks = false;
  
  while ((match = mdLinkRegex.exec(text)) !== null) {
    hasLinks = true;
    
    // Check if there's text before/after this link
    const hasTextBefore = match.index > lastIndex;
    const hasTextAfter = (match.index + match[0].length) < text.length;
    
    // Add text before the link (with markdown decorations)
    if (hasTextBefore) {
      renderMarkdownText(container, text.substring(lastIndex, match.index));
    }
    
    const url = match[2];
    const linkText = match[1];
    
    let usedRichTag = false;
    if (url.includes("github.com")) {
      const tag = createTag(url);
      if (tag) {
        if (!disableDirectNavigation) {
          tag.addEventListener("click", (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            window.open(url, "_blank");
          }, true);
        }
        tag.setAttribute("data-link-url", url);
        tag.addClass("task-clickable-link");
        if (hasTextBefore) tag.addClass("has-text-before");
        if (hasTextAfter) tag.addClass("has-text-after");
        container.appendChild(tag);
        usedRichTag = true;
      }
    }
    
    if (!usedRichTag) {
      const linkEl = container.createEl("span", { 
        cls: "task-link task-inline-link task-clickable-link",
        text: linkText
      });
      linkEl.setAttribute("data-link-url", url);
      if (!disableDirectNavigation) {
        linkEl.addEventListener("click", (ev) => {
          ev.preventDefault();
          ev.stopPropagation();
          window.open(url, "_blank");
        });
      }
    }
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text after last link (with markdown decorations)
  if (hasLinks && lastIndex < text.length) {
    renderMarkdownText(container, text.substring(lastIndex));
  } else if (!hasLinks) {
    renderMarkdownText(container, text);
  }
}

/**
 * Parse schedule content to extract time, event name, meet URL, and location.
 */
export function parseScheduleContent(content: string): { 
  time: string | null; 
  eventName: string | null; 
  meetUrl: string | null; 
  location: string | null 
} {
  let remaining = content;
  
  // Extract time (e.g., "10:00-11:00" or "10:00")
  const timeMatch = remaining.match(/^(\d{1,2}:\d{2}(?:-\d{1,2}:\d{2})?)\s*/);
  const time = timeMatch ? timeMatch[1] : null;
  if (timeMatch) {
    remaining = remaining.slice(timeMatch[0].length);
  }
  
  // Extract meet URL (e.g., "[meet](https://...)")
  const meetMatch = remaining.match(/\[meet\]\((https?:\/\/[^\)]+)\)/);
  const meetUrl = meetMatch ? meetMatch[1] : null;
  if (meetMatch) {
    remaining = remaining.replace(meetMatch[0], "").trim();
  }
  
  // Extract location (e.g., "＠Location" or "@Location")
  const locationMatch = remaining.match(/[＠@](.+)$/);
  const location = locationMatch ? locationMatch[1].trim() : null;
  if (locationMatch) {
    remaining = remaining.replace(locationMatch[0], "").trim();
  }
  
  // Remaining is the event name
  const eventName = remaining.trim() || null;
  
  return { time, eventName, meetUrl, location };
}
