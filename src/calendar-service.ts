import { requestUrl, moment } from "obsidian";
import {
  CalendarEvent,
  WeeklySchedule,
  WeeknoteSettings,
  WorkerRequest,
  WorkerResponse
} from "./types";

// @ts-ignore
import icsParserWorkerCode from "./workers/ics-parser.worker.ts";

export class CalendarService {
  constructor(private settings: WeeknoteSettings) {}

  async fetchWeeklySchedule(weekStartDate: moment.Moment): Promise<WeeklySchedule | null> {
    if (!this.settings.googleCalendarIcsUrl) {
      return null;
    }

    try {
      const response = await requestUrl({
        url: this.settings.googleCalendarIcsUrl,
        method: "GET",
      });
      const icsText = response.text;

      const endDate = weekStartDate.clone().add(7 - 1, "days");
      const excludePatterns = this.settings.excludeEventPatterns
        ? this.settings.excludeEventPatterns.split("\n").filter(p => p.trim().length > 0)
        : [];
      
      // Convert string to ArrayBuffer for zero-copy transfer
      const encoder = new TextEncoder();
      const icsBuffer = encoder.encode(icsText).buffer;
      
      const eventsByDate = await this.parseIcsInWorker(
          icsBuffer,
          weekStartDate.format("YYYY-MM-DD"), 
          endDate.format("YYYY-MM-DD"), 
          excludePatterns
      );

      const result: WeeklySchedule = {};
      const dayNames = ["SU", "MO", "TU", "WE", "TH", "FR", "SA"];

      for (let i = 0; i < 7; i++) {
        const date = weekStartDate.clone().add(i, "days");
        const dayKey = dayNames[date.day()];
        const dateStr = date.format("YYYY-MM-DD");
        
        result[dayKey + "_" + i] = {
          dateLabel: date.format("MM-DD"),
          schedule: eventsByDate.get(dateStr) || [],
        };
      }

      return result;
    } catch (error) {
      // Calendar fetch failed
      return null;
    }
  }

  private parseIcsInWorker(icsBuffer: ArrayBuffer, startDate: string, endDate: string, excludePatterns: string[]): Promise<Map<string, CalendarEvent[]>> {
      return new Promise((resolve, reject) => {
          try {
              const blob = new Blob([icsParserWorkerCode], { type: "application/javascript" });
              const blobUrl = URL.createObjectURL(blob);
              const worker = new Worker(blobUrl);
              
              worker.onmessage = (e: MessageEvent<WorkerResponse>) => {
                  const { events, error } = e.data;
                  if (error) {
                      reject(new Error(error));
                  } else {
                      const map = new Map<string, CalendarEvent[]>();
                      if (events) {
                        Object.entries(events).forEach(([date, evts]) => {
                            map.set(date, evts);
                        });
                      }
                      resolve(map);
                  }
                  worker.terminate();
                  URL.revokeObjectURL(blobUrl);
              };
              
              worker.onerror = (e) => {
                  reject(new Error("Worker error: " + e.message));
                  worker.terminate();
                  URL.revokeObjectURL(blobUrl);
              };
              
              // Use transferable to avoid copying the ArrayBuffer
              const request: WorkerRequest = { icsBuffer, startDate, endDate, excludePatterns };
              worker.postMessage(request, [icsBuffer]);
              
          } catch (e) {
              reject(e);
          }
      });
  }
}
