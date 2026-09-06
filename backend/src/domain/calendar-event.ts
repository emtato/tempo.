import {recurrence} from "./recurrence.js";

/**
 * Core calendar-event types.
 *
 * These interfaces describe your application's data, independent of Express,
 * MongoDB, FullCalendar, or Gemini. Shared business types belong in `domain`.
 *
 * Keep API/database quirks out of these types when possible. Translate at the
 * controller or repository boundary instead.
 */
export interface CalendarEvent {
    userId: string;
    id: string;
    title: string;
    start: string; // ISO 8601 date or date-time
    end: string;   // ISO 8601 date or date-time
    allDay: boolean;
    extendedProps: {
        location?: string;
        description?: string;
        guests?: string;
        recurrence?: recurrence;
    };
}

export interface SaveCalendarEventInput {
    id: string;
    title: string;
    startTime: number;
    endTime: number;
    startDate: string;
    endDate: string;
    allDay: boolean;
    extendedProps: {
        location: string;
        description: string;
        guests: string;
        recurrence?: recurrence;
    };
}
