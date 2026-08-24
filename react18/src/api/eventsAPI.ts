import type {
    CalendarEvent,
    SaveCalendarEventInput,
} from "../../../backend/src/CalendarEvent";
import {simpleTimeLocationExtractor} from "../utils/simple_time_location_extractor";
import type {DeletedEvent} from "../Calendarapp";
import importedDefaultEvents from "../data/defaultEvents.json";
import {Temporal} from "temporal-polyfill";

const SERVER_URL = import.meta.env.VITE_SERVER_URL;
export const DEMO_USER_ID = "DemoUserId";
const LOCAL_EVENTS_STORAGE_KEY = "calendar-demo-events-v1";

/**
 * Retrieve every calendar event the current user is alloed to see
 *
 * Intended request: GET /api/events
 * Returns: the events received from the backend
 * endStr is exclusive (Fullcalendar)
 */
export async function getCalendarEvents(startDate: string, endDate: string, userId: string): Promise<CalendarEvent[]> {

    if (userId === DEMO_USER_ID) { //not logged in, no db contact
        return readLocalEvents();
    }

    const response = await fetch(`${SERVER_URL}/api/events?start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`, {
        credentials: "include"
    })
    const events = await response.json();
    console.log("received events", events)
    return events
}

/*
 * Retrieve one calendar event using its unique ID
 *
 * Intended request: GET /api/events/:eventId
 * `eventId`: identifies the event to retrieve
 * Returns: the matching event received from the backen
 */
export async function getCalendarEventById(eventId: string): Promise<CalendarEvent> {
    throw new Error("not implemented yet");
}

/**
 * Save a newly created calendar event
 *
 * Intended request: POST /api/events
 * `event`: the user-entered information for the new event
 * Returns: the saved event, including the ID assigned by the backend
 */
export async function saveCalendarEvent(event: SaveCalendarEventInput, userId: string): Promise<CalendarEvent> {
    //run time/location extractor again in case the user saved it before timer ran out
    const [returnTime, returnEndTime, returnlocation, returnTitle, rangeInProgress] = simpleTimeLocationExtractor(event.title, false, false)
    event.title = returnTitle
    if (returnTime != "") {
        const [hours, minutes] = returnTime.split(":").map(Number);
        event.startTime = hours * 60 + minutes;
    }
    if (returnEndTime != "") {
        const [hours, minutes] = returnEndTime.split(":").map(Number);
        event.endTime = hours * 60 + minutes;
    }
    if (returnlocation != "") {
        event.extendedProps.location = returnlocation
    }
    if (userId === DEMO_USER_ID) {
        const localEvent = convertToCalendarEvent(event)
        const localEvents = readLocalEvents()
        const existingIndex = localEvents.findIndex((savedEvent) => savedEvent.id === localEvent.id)

        if (existingIndex === -1) {
            localEvents.push(localEvent)
        } else {
            localEvents[existingIndex] = localEvent
        }

        writeLocalEvents(localEvents)
        return localEvent;
    }

    const response = await fetch(`${SERVER_URL}/api/events/`, {
        method: 'POST',
        credentials: "include",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(event)
    })
    return response.json() //return id inside the returned full calendarEvent object
}


/**
 * Permanently remove an existing calendar event
 *
 * Intended request: DELETE /api/events/:eventId
 * `eventId`: identifies the event to remove
 * Returns: nothing after the backend confirms the deletion
 */
export async function deleteCalendarEvent(eventId: string, userId: string): Promise<void> {
    if (userId === DEMO_USER_ID) {
        const localEvents = readLocalEvents()
        const existingIndex = localEvents.findIndex((event) => event.id === eventId)

        if (existingIndex === -1) return

        localEvents.splice(existingIndex, 1)
        writeLocalEvents(localEvents)
        return;
    }

    const response = await fetch(`${SERVER_URL}/api/events/${eventId}`, {
        method: 'DELETE',
        credentials: "include"
    })
    if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`);
    }
    return;
}

export async function restoreEvent(input: DeletedEvent, userId: string): Promise<CalendarEvent> {
    if (userId === DEMO_USER_ID) {
        const localEvent = convertToCalendarEvent(input)
        const localEvents = readLocalEvents()
        const existingIndex = localEvents.findIndex((event) => event.id === localEvent.id)

        if (existingIndex === -1) {
            localEvents.push(localEvent)
        } else {
            localEvents[existingIndex] = localEvent
        }

        writeLocalEvents(localEvents)
        return localEvent;
    }
    const response = await fetch(`${SERVER_URL}/api/events/restore`, {
        method: 'POST',
        credentials: "include",
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(input)
    })
    return response.json()
}

function convertToCalendarEvent(event: SaveCalendarEventInput) {// function to convert savecalendarevent to calendar event ONLY for local non logged in persistence
    const endDate = event.allDay ? addOneDay(event.endDate) : event.endDate
    const localEvent: CalendarEvent = {
        userId: DEMO_USER_ID,
        id: event.id || crypto.randomUUID(),
        title: event.title,
        start: event.allDay ? event.startDate : combineDateAndTime(event.startDate, event.startTime),
        end: event.allDay ? endDate : combineDateAndTime(endDate, event.endTime),
        allDay: event.allDay,
        extendedProps: {
            location: event.extendedProps.location ? event.extendedProps.location : "",
            description: event.extendedProps.description ? event.extendedProps.description : "",
            guests: event.extendedProps.guests ? event.extendedProps.guests : "",
        },
    }
    return localEvent;
}

function combineDateAndTime(date: string, minutesAfterMidnight: number) {
    const hours = Math.floor(minutesAfterMidnight / 60)
        .toString()
        .padStart(2, "0");

    const minutes = (minutesAfterMidnight % 60)
        .toString()
        .padStart(2, "0");

    return `${date}T${hours}:${minutes}:00`;
}

function addOneDay(date: string) {
    return Temporal.PlainDate.from(date).add({days: 1}).toString()
}

function cloneDefaultEvents(): CalendarEvent[] {
    return importedDefaultEvents.map((event) => ({
        ...event,
        extendedProps: {...event.extendedProps},
    }))
}

function readLocalEvents(): CalendarEvent[] {
    const cachedEvents = localStorage.getItem(LOCAL_EVENTS_STORAGE_KEY)

    if (cachedEvents === null) {
        return cloneDefaultEvents()
    }

    try {
        const parsedEvents: unknown = JSON.parse(cachedEvents)
        if (!Array.isArray(parsedEvents) || !parsedEvents.every(isCalendarEvent)) {
            throw new Error("Invalid local calendar events")
        }
        return parsedEvents
    } catch {
        localStorage.removeItem(LOCAL_EVENTS_STORAGE_KEY)
        return cloneDefaultEvents()
    }
}

function writeLocalEvents(events: CalendarEvent[]) {
    localStorage.setItem(LOCAL_EVENTS_STORAGE_KEY, JSON.stringify(events))
}

function isCalendarEvent(value: unknown): value is CalendarEvent {
    if (typeof value !== "object" || value === null) return false

    const event = value as Partial<CalendarEvent>
    return typeof event.userId === "string" &&
        typeof event.id === "string" &&
        typeof event.title === "string" &&
        typeof event.start === "string" &&
        typeof event.end === "string" &&
        typeof event.allDay === "boolean" &&
        typeof event.extendedProps === "object" &&
        event.extendedProps !== null
}
