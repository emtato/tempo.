/**
 * Calendar use cases (the central backend logic).
 *
 *  Put workflows here, such as:
 * 1. validate/normalize an incoming event;
 * 2. ask Gemini to extract missing fields;
 * 3. combine user-provided and extracted values;
 * 4. save the final event through the repository;
 * 5. return the saved event.
 *
 * Keep HTTP objects (`request`, `response`) out of this file. Also avoid raw
 * MongoDB calls and Gemini SDK calls; those belong behind their own adapters.
 */
import {CalendarEvent, SaveCalendarEventInput,} from "../domain/calendar-event.js";
import {recurrence} from "../domain/recurrence.js";
import {eventStorage} from "../repositories/event.storage.js";
import {randomUUID} from "node:crypto";
import {Temporal} from 'temporal-polyfill'

async function saveEvent(input: SaveCalendarEventInput, userId: any): Promise<CalendarEvent> {
    //TODO: gemini first pass layer to extract advanced location/time data first
    if (input.allDay) {
        input.endDate = addOneDay(input.endDate)
    }
    if (input.id == "") { //new event
        input.id = randomUUID();
        const event = ConvertToCalendarEvent(input, userId);
        await eventStorage.createEvent(event)
        return event;
    } //preixisting event being saved
    const event = ConvertToCalendarEvent(input, userId);
    await eventStorage.saveEvent(event)
    return event
}

async function restoreEvent(input: SaveCalendarEventInput, userId: any): Promise<CalendarEvent> {
    if (input.allDay) {
        input.endDate = addOneDay(input.endDate)
    }
    const event = ConvertToCalendarEvent(input, userId);
    await eventStorage.createEvent(event)
    return event;
}

async function getEvents(start: string, end: string, userId: any): Promise<CalendarEvent[]> {
    const eventLists = await eventStorage.getEvents(start, end, userId)
    const allEvents = eventLists.normalEvents
    const repetitionEventList = eventLists.repetitionEvents
    for (let i = 0; i < repetitionEventList.length; i++) {
        const event = repetitionEventList[i]
        if (event.id.search("recurr") != -1) continue; //dont create an evil cycle of mitosing events
        const eventDuration = Temporal.PlainDate.from(event.start).until(Temporal.PlainDate.from(event.end))

        const datesToPlaceEvents = expandRecurrence(event.extendedProps.recurrence, Temporal.PlainDate.from(start), Temporal.PlainDate.from(end), Temporal.PlainDate.from(event.start))
        if (datesToPlaceEvents.length != 0) {
            const rangeContainsOriginalOccurence = Temporal.PlainDate.compare(datesToPlaceEvents[0], Temporal.PlainDate.from(event.start)) == 0
            for (let j = 0; j < datesToPlaceEvents.length; j++) {
                let id = "recurr" + event.id + "_" + j;

                if (rangeContainsOriginalOccurence && j == 0) {
                    id = event.id
                }
                const newEvent: CalendarEvent = {
                    id: id,
                    start: datesToPlaceEvents[j].toString() + "T" + event.start.slice(11),
                    end: datesToPlaceEvents[j].add(eventDuration).toString() + "T" + event.end.slice(11),
                    userId: userId,
                    title: event.title,
                    allDay: event.allDay,
                    extendedProps: {
                        location: event.extendedProps.location,
                        description: event.extendedProps.description,
                        guests: event.extendedProps.guests,
                        recurrence: event.extendedProps.recurrence,
                    }
                }
                allEvents.push(newEvent)
            }
        }
    }
    return allEvents

}

async function deleteEvent(id: string, userId: any): Promise<void> {
    //TODO: if deleting fake event (check if event starts with 'recurr' (recurring ghost):
    //find master event by stripping recurrence id signals
    //modify master event's recurrence rule:
    //skip this occurence or end recurrence on this instance (since exlclusive, will end before this instance)
    await eventStorage.deleteEvent(id, userId)
}

//                          helper functions
// ————————————————————————————————————————————————————————————————————

function ConvertToCalendarEvent(input: SaveCalendarEventInput, userId: string): CalendarEvent {
    const combinedStart = convertTime(input.startDate, input.startTime);
    const combinedEnd = convertTime(input.endDate, input.endTime);

    const event: CalendarEvent = {
        userId: userId,
        id: input.id,
        title: input.title,
        start: combinedStart,
        end: combinedEnd,
        allDay: input.allDay,
        extendedProps: {
            location: input.extendedProps.location,
            description: input.extendedProps.description,
            guests: input.extendedProps.guests,
            recurrence: input.extendedProps.recurrence,
        },
    };
    return event;

}

function convertTime(Date: string, Time: number): string {
    const H = Math.floor(Time / 60);
    const M = Time % 60;
    const S = "00"
    const HFormatted = H.toString().padStart(2, "0");
    const MFormatted = M.toString().padStart(2, "0");

    const TimeFormatted = HFormatted + ":" + MFormatted + ":" + S;
    return Date + "T" + TimeFormatted;
}

//add one day to an all day event. Fullcalendar interprets exclusive end dates, while we display inclusive. re add 1 day to db so reinterpretation of the range is correct
function addOneDay(date: string): string {
    const value = new Date(`${date}T00:00:00Z`);
    value.setUTCDate(value.getUTCDate() + 1);
    return value.toISOString().slice(0, 10);
}

export const calendarService = {
    saveEvent, getEvents, deleteEvent, restoreEvent
};

// RECURRENCE sorry for yelling functions

//the same while loop in every section to add the dates recur on to list
function collectOccurrences(dates: Temporal.PlainDate[], firstDate: Temporal.PlainDate, endDate: Temporal.PlainDate, nextDate: (date: Temporal.PlainDate) => Temporal.PlainDate): void {
    let currentDate = firstDate
    while (Temporal.PlainDate.compare(currentDate, endDate) < 0) {
        dates.push(currentDate)
        currentDate = nextDate(currentDate)
    }
}

// Which calendar dates inside this requested range satisfy this rule?
function expandRecurrence(rule: recurrence, requestedStart: Temporal.PlainDate, requestedEnd: Temporal.PlainDate, originalEventDate: Temporal.PlainDate): Temporal.PlainDate[] {
    //separate by big branches: frequency
    const possibleDates = []
    let stepSize = 1

    let recurrenceEndDate: Temporal.PlainDate;
    const recurrenceRuleEnd = rule.endDate ? Temporal.PlainDate.from(rule.endDate) : undefined
    //recurrence rule has end date, and recurrence rule's end date before requested end
    if (rule.endDate && Temporal.PlainDate.compare(recurrenceRuleEnd, requestedEnd) < 0) recurrenceEndDate = recurrenceRuleEnd
    else recurrenceEndDate = requestedEnd

    if (rule.frequency == "daily") {
        //daily rule only has to deal with skipinterval
        if (rule.skipInterval) stepSize += rule.skipInterval
        const daysFromRangeStart = originalEventDate.until(requestedStart).days //number of days to REACH start (so inclusive)
        const jumpsNeeded = Math.max(0, Math.ceil(daysFromRangeStart / stepSize))//reach first occurence wihin range
        const currentDate = originalEventDate.add({days: jumpsNeeded * stepSize}) //first occurence
        collectOccurrences(possibleDates, currentDate, recurrenceEndDate, date => date.add({days: stepSize}))

    } else if (rule.frequency == "weekly") {
        if (rule.skipInterval) stepSize = rule.skipInterval * 7 + 7 // skip 7d * skipInterval if skipinterval, and add default stepsize, 7 for a week
        else stepSize = 7

        if (rule.dayOfWeek.length > 0) { // array isnt empty
            let smallestDaysUntil = 8; //find the smallest amount of days until the first occurence of any day in dayOfWeek
            let smallestDaysUntilIndex = 0; //record which dayOfWeek is first
            let cycleDayGaps = []; // get the amount of days jump per gap in the dayOfWeek array

            for (let i = 0; i < rule.dayOfWeek.length; i++) {
                const targetWeekday = rule.dayOfWeek[i]
                if ((targetWeekday - originalEventDate.dayOfWeek + 7) % 7 < smallestDaysUntil) { // get dist between originalEventDate and first later occurence of targetWeekday
                    smallestDaysUntil = (targetWeekday - originalEventDate.dayOfWeek + 7) % 7 // first occurence of any day in dayOfWeek after startDate
                    smallestDaysUntilIndex = i; //update the index of the smallest days until
                }
                if (i != 0) {
                    cycleDayGaps.push(rule.dayOfWeek[i] - rule.dayOfWeek[i - 1])
                }
            }
            cycleDayGaps.push(7 + (rule.skipInterval ?? 0) * 7 - cycleDayGaps.reduce((accumulator, currentValue) => accumulator + currentValue, 0)) //add the gap between last dayOfWeek vs first (loop wrap)

            //in case requestedStart is after originalEventDate, we need to do jumpies
            const firstOccurrence = originalEventDate.add({days: smallestDaysUntil}) //first occurence before factoring requestedStart
            const daysFromRangeStart = firstOccurrence.until(requestedStart).days
            const completeCycles = Math.max(0, Math.floor(daysFromRangeStart / stepSize))

            let currentDate = firstOccurrence.add({days: completeCycles * stepSize}) // add complete cycles (that include skipinterval logic) until we are right before requestedStart
            let cycleDayGapIndex = smallestDaysUntilIndex;

            while (Temporal.PlainDate.compare(currentDate, requestedStart) < 0) { // cycle thruthe rest of cycledaygaps manually until we get to the first one after requestedstart
                currentDate = currentDate.add({days: cycleDayGaps[cycleDayGapIndex]})
                cycleDayGapIndex = (cycleDayGapIndex + 1) % cycleDayGaps.length
            }
            collectOccurrences(possibleDates, currentDate, recurrenceEndDate, date => {
                const next = date.add({days: cycleDayGaps[cycleDayGapIndex]}) //increment current date to next date in dayofweek list by adding the gap between this dayofweek to next
                cycleDayGapIndex = (cycleDayGapIndex + 1) % cycleDayGaps.length
                return next
            })
        }

    } else if (rule.frequency == "monthly") {

    } else if (rule.frequency == "yearly") {

    }
    return possibleDates
}
