/**
 * MongoDB persistence adapter for calendar events.
 *
 * Repository functions should describe data operations in application terms:
 * `findAll`, `findById`, `insert`, `update`, and `remove`.
 * Raw collection names, filters, ObjectIds, and MongoDB driver calls belong
 * here—not in routes, controllers, or calendar.service.ts.
 *
 * Import `getDatabase()` from config/mongodb.ts when implementing these
 * operations. Convert database documents to domain types before returning.
 */
import type {CalendarEvent} from "../domain/calendar-event.js";
import {getDatabase} from "../config/mongodb.js";

export const eventStorage = {
    saveEvent,
    createEvent,
    deleteEvent,
    getEvents,
};

const storageCollection = "events3";

async function getEvents(startDate: string, endDate: string, userId: any): Promise<{
    normalEvents: CalendarEvent[]; repetitionEvents: CalendarEvent[];
}> {
    const db = await getDatabase();
    const eventsCollection = db.collection<CalendarEvent>(storageCollection);

    const normalEventsPromise = eventsCollection.find({
        start: {$lt: endDate},
        end: {$gt: startDate},
        userId: userId,
        "extendedProps.recurrence": {$exists: false}
    }).toArray();
    // any event end date that extends into the startDate range and any event start date that happens before endDate

    const repetitionEventsPromise = eventsCollection.find({
        userId,
        "extendedProps.recurrence.startDate": {$lt: endDate},
        $or: [{"extendedProps.recurrence.endDate": {$exists: false}},
            {"extendedProps.recurrence.endDate": {$gte: startDate}}]
    }).toArray()
    //if end field exists, recurrence end should end after start date

    const [normalEvents, repetitionEvents] = await Promise.all([
        normalEventsPromise,
        repetitionEventsPromise,
    ]) //wait until fetch done onboth

    return {normalEvents, repetitionEvents}
}

async function saveEvent(event: CalendarEvent) {
    const db = await getDatabase()
    const eventsCollection = db.collection<CalendarEvent>(storageCollection);

    const result = await eventsCollection.updateOne(
        {id: event.id, userId: event.userId},
        { //whcih fields to update
            $set: {
                title: event.title,
                start: event.start,
                end: event.end,
                allDay: event.allDay,
                extendedProps: event.extendedProps,
            },
        },
    );
    return result;
}

async function createEvent(event: CalendarEvent) {
    const db = await getDatabase()
    const eventsCollection = db.collection<CalendarEvent>(storageCollection);

    const result = await eventsCollection.insertOne(event);
    return result;
}

async function deleteEvent(id: string, userId: any) {
    const db = await getDatabase()
    const eventsCollection = db.collection<CalendarEvent>(storageCollection);
    const result = await eventsCollection.deleteOne({id: id, userId: userId});
    return result;
}
