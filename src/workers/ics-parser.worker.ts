import moment from "moment";
import { CalendarEvent, WorkerRequest, WorkerResponse } from "../types";

class ICSParser {
  private icalComponent: unknown;

  constructor(private icsData: string) {
    this.parse();
  }

  private parse(): void {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Worker environment requires dynamic import of ical.js
      const ICAL = require("ical.js");
      const jcalData = ICAL.parse(this.icsData);
      this.icalComponent = new ICAL.Component(jcalData);
    } catch (error) {
      console.error("[Worker] Failed to parse ICS:", error);
    }
  }

  private isExcluded(summary: string | undefined, patterns: string[]): boolean {
    if (!summary || patterns.length === 0) return false;
    
    return patterns.some(pattern => {
      try {
        const regex = new RegExp(pattern.trim());
        return regex.test(summary);
      } catch (_e) {
        console.warn(`[Worker] Invalid regex pattern: ${pattern}`, _e);
        return summary.includes(pattern.trim());
      }
    });
  }

  getEventsForDateRange(startDate: moment.Moment, endDate: moment.Moment, excludePatterns: string[] = []): Map<string, CalendarEvent[]> {
    const result = new Map<string, CalendarEvent[]>();
    
    const current = startDate.clone();
    while (current.isSameOrBefore(endDate, "day")) {
      result.set(current.format("YYYY-MM-DD"), []);
      current.add(1, "day");
    }

    if (!this.icalComponent) {
      return result;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports -- Worker environment requires dynamic import of ical.js
      const ICAL = require("ical.js");
      const component = this.icalComponent as { getAllSubcomponents: (type: string) => unknown[] };
      const vevents = component.getAllSubcomponents("vevent");
      
      const rangeStart = ICAL.Time.fromJSDate(startDate.toDate(), false);
      const rangeEnd = ICAL.Time.fromJSDate(endDate.clone().add(1, "day").toDate(), false);

      const exceptionDatesByUid = new Map<string, Set<string>>();
      const declinedDatesByUid = new Map<string, Set<string>>();
      
      for (const vevent of vevents) {
        const vcomp = vevent as { 
          getFirstPropertyValue: (name: string) => unknown;
          getAllProperties: (name: string) => unknown[];
        };
        const recurrenceId = vcomp.getFirstPropertyValue("recurrence-id");
        const uid = vcomp.getFirstPropertyValue("uid") as string;
        
        if (recurrenceId && uid) {
          const recIdTime = recurrenceId as { toJSDate: () => Date };
          const exceptionDateStr = moment(recIdTime.toJSDate()).format("YYYY-MM-DD");
          
          if (!exceptionDatesByUid.has(uid)) {
            exceptionDatesByUid.set(uid, new Set<string>());
          }
          exceptionDatesByUid.get(uid)!.add(exceptionDateStr);
          
          const attendees = vcomp.getAllProperties("attendee");
          for (const attendee of attendees) {
            const att = attendee as { 
              getFirstValue: () => string;
              getParameter: (name: string) => string | null;
            };
            const _partstat = att.getParameter("partstat");
            // Note: Declined status check could be personalized here
            // For now, we don't filter based on user's own declined status
          }
        }
      }

      for (const vevent of vevents) {
        const event = new ICAL.Event(vevent);
        const vcomp = vevent as { 
          getFirstPropertyValue: (name: string) => unknown;
          getAllProperties: (name: string) => unknown[];
        };
        const uid = vcomp.getFirstPropertyValue("uid") as string;
        
        if (vcomp.getFirstPropertyValue("recurrence-id")) {
          const attendees = vcomp.getAllProperties("attendee");
          const declined = false;
          for (const attendee of attendees) {
            const att = attendee as { 
              getFirstValue: () => string;
              getParameter: (name: string) => string | null;
            };
            const _partstat = att.getParameter("partstat");
            // Note: Could add personalized declined check here
          }
          if (declined) continue;

          if (declined) continue;
          
          const dtstart = event.startDate;
          const dtend = event.endDate;
          
          if (dtstart.compare(rangeEnd) >= 0 || dtend.compare(rangeStart) <= 0) {
            continue;
          }
          
          const calEvent = this.convertToCalendarEvent(dtstart, dtend, event);
          
          if (this.isExcluded(calEvent.eventName, excludePatterns)) {
            continue;
          }
          
          if (calEvent.date && result.has(calEvent.date)) {
            result.get(calEvent.date)!.push(calEvent);
          }
          continue;
        }
        
        const status = vcomp.getFirstPropertyValue("status") as string | null;
        if (status && status.toUpperCase() === "CANCELLED") {
          continue;
        }
        
        const attendees = vcomp.getAllProperties("attendee");
        const userDeclined = false;
        for (const attendee of attendees) {
          const att = attendee as { 
            getFirstValue: () => string;
            getParameter: (name: string) => string | null;
          };
          const _partstat = att.getParameter("partstat");
          // Note: Could add personalized declined check here
        }
        if (userDeclined) continue;

        
        if (event.isRecurring()) {
          const exceptionDates = new Set<string>(exceptionDatesByUid.get(uid) || []);
          const declinedDates = declinedDatesByUid.get(uid) || new Set<string>();
          
          const exdates = (vevent as { getAllProperties: (name: string) => unknown[] }).getAllProperties("exdate");
          for (const exdateProp of exdates) {
            const exdateValues = (exdateProp as { getValues: () => unknown[] }).getValues();
            for (const exdateValue of exdateValues) {
              const exdateTime = exdateValue as { toJSDate: () => Date };
              const exdateDateStr = moment(exdateTime.toJSDate()).format("YYYY-MM-DD");
              exceptionDates.add(exdateDateStr);
            }
          }
          
          const iterator = event.iterator();
          let next;
          let foundCount = 0;
          const maxOccurrences = 50;
          
          while ((next = iterator.next())) {
            if (next.compare(rangeEnd) > 0) break;
            if (foundCount >= maxOccurrences) break;
            if (next.compare(rangeStart) < 0) continue;
            
            const occurrenceDateStr = moment(next.toJSDate()).format("YYYY-MM-DD");
            if (exceptionDates.has(occurrenceDateStr)) {
              if (declinedDates.has(occurrenceDateStr)) {
                continue;
              }
              continue;
            }
            
            const occurrence = event.getOccurrenceDetails(next);
            const calEvent = this.convertToCalendarEvent(occurrence.startDate, occurrence.endDate, event);
            
            if (this.isExcluded(calEvent.eventName, excludePatterns)) {
              continue;
            }
            
            if (calEvent.date && result.has(calEvent.date)) {
              result.get(calEvent.date)!.push(calEvent);
              foundCount++;
            }
          }
        } else {
          const dtstart = event.startDate;
          const dtend = event.endDate;
          
          if (dtstart.compare(rangeEnd) >= 0 || dtend.compare(rangeStart) <= 0) {
            continue;
          }
          
          const calEvent = this.convertToCalendarEvent(dtstart, dtend, event);
          
          if (this.isExcluded(calEvent.eventName, excludePatterns)) {
            continue;
          }
          
          if (calEvent.date && result.has(calEvent.date)) {
            result.get(calEvent.date)!.push(calEvent);
          }
        }
      }
    } catch (error) {
      console.error("[Worker] Error processing events:", error);
    }

    for (const [, events] of result) {
      events.sort((a, b) => {
        if (a.isAllDay && !b.isAllDay) return -1;
        if (!a.isAllDay && b.isAllDay) return 1;
        if (a.startTime && b.startTime) {
          return a.startTime.localeCompare(b.startTime);
        }
        return 0;
      });
    }

    return result;
  }

  private convertToCalendarEvent(dtstart: unknown, dtend: unknown, event: { summary?: string; location?: string; description?: string; component?: unknown }): CalendarEvent {
    const dtstartTyped = dtstart as { isDate: boolean; toJSDate: () => Date };
    const dtendTyped = dtend as { toJSDate: () => Date } | null;
    
    const isAllDay = dtstartTyped.isDate;
    const startMoment = moment(dtstartTyped.toJSDate());
    const endMoment = dtendTyped ? moment(dtendTyped.toJSDate()) : null;
    
    let meetUrl: string | null = null;
    const location = event.location || null;
    const description = event.description || "";
    
    if (location) {
      meetUrl = this.extractMeetUrl(location);
    }
    if (!meetUrl && description) {
      meetUrl = this.extractMeetUrl(description);
    }

    // Try to find the user's participation status
    let status: "accepted" | "tentative" | "declined" | undefined = undefined;
    try {
      const component = event.component as { getAllProperties: (name: string) => Array<{ getParameter: (name: string) => string | null }> } | undefined;
      if (component) {
        const attendees = component.getAllProperties("attendee");
        for (const attendee of attendees) {
          const partstat = attendee.getParameter("partstat");
          if (partstat === "DECLINED") {
            status = "declined";
            break; 
          } else if (partstat === "TENTATIVE") {
            status = "tentative";
          } else if (partstat === "ACCEPTED") {
            status = "accepted";
          }
        }
      }
    } catch (_e) {
      // Ignore errors in status extraction
    }

    return {
      eventName: event.summary || "",
      isAllDay,
      startTime: isAllDay ? null : startMoment.format("HH:mm"),
      endTime: isAllDay || !endMoment ? null : endMoment.format("HH:mm"),
      location,
      meetUrl,
      date: startMoment.format("YYYY-MM-DD"),
      status
    };
  }

  private extractMeetUrl(text: string): string | null {
    const match = text.match(/https:\/\/meet\.google\.com\/[a-z-]+/);
    return match ? match[0] : null;
  }
}

self.addEventListener("message", async (_e: MessageEvent<WorkerRequest>) => {
  const { icsData, icsBuffer, startDate, endDate, excludePatterns } = _e.data;
  
  try {
    let dataToProcess: string;
    
    // Priority: icsBuffer > icsData > icsUrl
    if (icsBuffer) {
      const decoder = new TextDecoder("utf-8");
      dataToProcess = decoder.decode(icsBuffer);
    } else if (icsData) {
      dataToProcess = icsData;
      throw new Error("icsUrl fetch is not supported in Worker (as per Obsidian guidelines). Please provide icsData or icsBuffer.");
    } else {
      throw new Error("No ICS data source provided");
    }
    
    const parser = new ICSParser(dataToProcess);
    const result = parser.getEventsForDateRange(moment(startDate), moment(endDate), excludePatterns);
    
    const eventsRecord: Record<string, CalendarEvent[]> = {};
    result.forEach((events, date) => {
      eventsRecord[date] = events;
    });

    const response: WorkerResponse = { events: eventsRecord };
    self.postMessage(response);
  } catch (error) {
    self.postMessage({ error: String(error), events: {} });
  }
});
