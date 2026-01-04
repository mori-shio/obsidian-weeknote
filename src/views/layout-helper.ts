/**
 * Layout helper functions for panel resizing.
 * These are pure functions that can be used across different view layouts.
 */

/**
 * Setup a vertical resizer for side-by-side panels (horizontal drag).
 * Both panels resize inversely within a fixed total width.
 */
export function setupVerticalResizer(
  resizer: HTMLElement, 
  leftPanel: HTMLElement, 
  rightPanel: HTMLElement
): void {
  let startX = 0;
  let startLeftWidth = 0;
  let startRightWidth = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX;
    const totalWidth = startLeftWidth + startRightWidth;
    
    let newLeftWidth = startLeftWidth + delta;
    
    // Constraints (min 100px for each panel)
    if (newLeftWidth < 100) newLeftWidth = 100;
    if (newLeftWidth > totalWidth - 100) newLeftWidth = totalWidth - 100;
    
    const newRightWidth = totalWidth - newLeftWidth;
    
    leftPanel.style.width = `${newLeftWidth}px`;
    leftPanel.style.flex = `0 0 ${newLeftWidth}px`;
    rightPanel.style.width = `${newRightWidth}px`;
    rightPanel.style.flex = `0 0 ${newRightWidth}px`;
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeClass("is-dragging");
  };

  resizer.addEventListener("mousedown", (e: MouseEvent) => {
    startX = e.clientX;
    startLeftWidth = leftPanel.offsetWidth;
    startRightWidth = rightPanel.offsetWidth;
    resizer.addClass("is-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
}

/**
 * Setup a schedule resizer for vertical panel split.
 * Schedule section has height constraints (50-400px).
 */
export function setupScheduleResizer(
  resizer: HTMLElement, 
  scheduleSection: HTMLElement, 
  recentSection: HTMLElement
): void {
  let startY = 0;
  let startScheduleHeight = 0;
  let startRecentHeight = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY;
    // Drag down (positive delta) = scheduleSection expands, recentSection shrinks
    // Drag up (negative delta) = scheduleSection shrinks, recentSection expands
    const newScheduleHeight = startScheduleHeight + delta;
    const newRecentHeight = startRecentHeight - delta;
    
    // ScheduleSection min 50px, max 400px
    // RecentSection min 50px
    if (newScheduleHeight >= 50 && newScheduleHeight <= 400 && newRecentHeight >= 50) {
      scheduleSection.style.height = `${newScheduleHeight}px`;
      scheduleSection.style.flex = "0 0 auto";
      recentSection.style.flex = "1 1 auto";
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeClass("is-dragging");
  };

  resizer.addEventListener("mousedown", (e: MouseEvent) => {
    startY = e.clientY;
    startScheduleHeight = scheduleSection.offsetHeight;
    startRecentHeight = recentSection.offsetHeight;
    resizer.addClass("is-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
}

/**
 * Setup left panel resizer: Schedule expands/shrinks, Task shrinks/expands inversely, Memo stays same.
 */
export function setupLeftPanelResizer(
  resizer: HTMLElement, 
  schedulePanel: HTMLElement, 
  taskPanel: HTMLElement
): void {
  let startX = 0;
  let startScheduleWidth = 0;
  let startTaskWidth = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX;
    const newScheduleWidth = startScheduleWidth + delta;
    const newTaskWidth = startTaskWidth - delta;
    
    // Min 80px for both panels
    if (newScheduleWidth >= 80 && newTaskWidth >= 80) {
      schedulePanel.style.width = `${newScheduleWidth}px`;
      schedulePanel.style.flex = `0 0 ${newScheduleWidth}px`;
      taskPanel.style.width = `${newTaskWidth}px`;
      taskPanel.style.flex = `0 0 ${newTaskWidth}px`;
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeClass("is-dragging");
  };

  resizer.addEventListener("mousedown", (e: MouseEvent) => {
    startX = e.clientX;
    startScheduleWidth = schedulePanel.offsetWidth;
    startTaskWidth = taskPanel.offsetWidth;
    resizer.addClass("is-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
}

/**
 * Setup right panel resizer: Task expands/shrinks, Schedule stays fixed, Memo absorbs.
 */
export function setupRightPanelResizer(
  resizer: HTMLElement, 
  taskPanel: HTMLElement, 
  schedulePanel: HTMLElement
): void {
  let startX = 0;
  let startWidth = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientX - startX;
    const newWidth = startWidth + delta;
    
    // Min 80px, max 50% of container
    const containerWidth = taskPanel.parentElement?.offsetWidth || 600;
    const maxWidth = containerWidth * 0.5;
    
    if (newWidth >= 80 && newWidth <= maxWidth) {
      taskPanel.style.width = `${newWidth}px`;
      taskPanel.style.flex = `0 0 ${newWidth}px`;
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeClass("is-dragging");
  };

  resizer.addEventListener("mousedown", (e: MouseEvent) => {
    startX = e.clientX;
    startWidth = taskPanel.offsetWidth;
    // Fix schedule width
    const scheduleWidth = schedulePanel.offsetWidth;
    schedulePanel.style.width = `${scheduleWidth}px`;
    schedulePanel.style.flex = `0 0 ${scheduleWidth}px`;
    resizer.addClass("is-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
}

/**
 * Setup horizontal resizer for three-panel-horizontal layout (vertical drag).
 */
export function setupHorizontalResizer(
  resizer: HTMLElement, 
  topPanel: HTMLElement, 
  bottomPanel: HTMLElement
): void {
  let startY = 0;
  let startTopHeight = 0;
  let startBottomHeight = 0;

  const onMouseMove = (e: MouseEvent) => {
    const delta = e.clientY - startY;
    const totalHeight = startTopHeight + startBottomHeight;
    
    let newTopHeight = startTopHeight + delta;
    
    // Ensure constraints (min 60px for top, min 200px for bottom to keep input area visible)
    if (newTopHeight < 60) newTopHeight = 60;
    if (newTopHeight > totalHeight - 200) newTopHeight = totalHeight - 200;
    
    const newBottomHeight = totalHeight - newTopHeight;
  
    // 1. Try applying height to TOP panel
    topPanel.style.height = `${newTopHeight}px`;
    topPanel.style.flex = `0 0 ${newTopHeight}px`;
    
    // Check actual top height (in case of min-height constraints)
    const actualTopHeight = topPanel.offsetHeight;
    const expectedBottomHeight = totalHeight - actualTopHeight;
    
    // 2. Apply calculated remainder to BOTTOM panel
    bottomPanel.style.height = `${expectedBottomHeight}px`;
    bottomPanel.style.flex = `0 0 ${expectedBottomHeight}px`;
    
    // 3. Check actual bottom height (in case of min-height constraints)
    // If bottom panel refused to shrink, push back on top panel
    const actualBottomHeight = bottomPanel.offsetHeight;
    if (actualBottomHeight > expectedBottomHeight) {
       const adjustedTopHeight = totalHeight - actualBottomHeight;
       topPanel.style.height = `${adjustedTopHeight}px`;
       topPanel.style.flex = `0 0 ${adjustedTopHeight}px`;
    }
  };

  const onMouseUp = () => {
    document.removeEventListener("mousemove", onMouseMove);
    document.removeEventListener("mouseup", onMouseUp);
    resizer.removeClass("is-dragging");
  };

  resizer.addEventListener("mousedown", (e: MouseEvent) => {
    startY = e.clientY;
    startTopHeight = topPanel.offsetHeight;
    startBottomHeight = bottomPanel.offsetHeight;
    resizer.addClass("is-dragging");
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
    e.preventDefault();
  });
}

/**
 * Setup scroll shadows for a list wrapper element.
 * Adds/removes can-scroll-up and can-scroll-down classes based on scroll position.
 */
export function updateScrollShadows(wrapper: HTMLElement, list: HTMLElement): void {
  const isScrollable = list.scrollHeight > list.clientHeight;
  const scrollTop = list.scrollTop;
  const scrollBottom = list.scrollHeight - list.clientHeight - scrollTop;
  
  if (!isScrollable) {
    wrapper.removeClass("can-scroll-up");
    wrapper.removeClass("can-scroll-down");
    return;
  }
  
  // Show top shadow if scrolled down
  if (scrollTop > 5) {
    wrapper.addClass("can-scroll-up");
  } else {
    wrapper.removeClass("can-scroll-up");
  }
  
  // Show bottom shadow if can scroll down
  if (scrollBottom > 5) {
    wrapper.addClass("can-scroll-down");
  } else {
    wrapper.removeClass("can-scroll-down");
  }
}
