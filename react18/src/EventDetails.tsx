import React, {useState, type CSSProperties, useRef} from 'react'
import {useEffect} from "react";
import {Temporal} from 'temporal-polyfill'
import {simpleTimeLocationExtractor, TitleExtractionResult} from "./utils/simple_time_location_extractor";
import {DEMO_USER_ID, saveCalendarEvent} from "./api/eventsAPI";
import TimeComboBox from "./components/TimeComboBox";
import type {DeletedEvent} from "./Calendarapp";
import type {authClient} from "./api/auth-client";
import icons from "./resources/icons/";
import DatePicker from "./components/DatePicker";
import toLocalDateString from "./Calendarapp"
import RepetitionPicker from "./components/RepetitionPicker";
import {recurrence} from "../../backend/src/domain/recurrence";
import {formatOptionsToText} from "./components/RepetitionPicker"
// ----------------------------------------------------
// Configuration
// ----------------------------------------------------

const CALENDAR_OPTIONS = [
    {value: 'default', label: 'Default', color: '#6F5FA7'},
    {value: 'work', label: 'Work', color: '#4285f4'},
    {value: 'personal', label: 'Personal', color: '#34a853'},
]

const MINUTES_PER_DAY = 24 * 60
const DEFAULT_START_TIME = 9 * 60
const DEFAULT_END_TIME = 10 * 60

// ----------------------------------------------------
// Time utils
// ----------------------------------------------------

function generateTimeOptions(startMinutes: number, endMinutes: number, interval: number) {
    const times: number[] = []
    for (let minutes = startMinutes; minutes <= endMinutes; minutes += interval) {
        times.push(minutes)
    }
    return times
}

function getNextFullHour(minutesAfterMidnight: number) {
    const nextFullHour = (Math.floor(minutesAfterMidnight / 60) + 1) * 60
    return Math.min(nextFullHour, MINUTES_PER_DAY)
}

function getAmPm(minutesAfterMidnight: number): 'AM' | 'PM' {
    const normalizedMinutes = minutesAfterMidnight % MINUTES_PER_DAY
    return normalizedMinutes < 12 * 60 ? 'AM' : 'PM'
}

function toggleAmPm(minutesAfterMidnight: number) {

    const normalizedMinutes = minutesAfterMidnight % MINUTES_PER_DAY
    if (normalizedMinutes < 12 * 60) {
        return normalizedMinutes + 12 * 60
    }
    return normalizedMinutes - 12 * 60
}

// ----------------------------------------------------
// Component prop types
// ----------------------------------------------------

interface PopupInfo { // describes the information the component expects
    /*
    isOpen: whether it should appear.
    onClose: a function it can call when the user presses Cancel.
     */
    isOpen: boolean
    onClose: () => void
    position: {
        x: number; y: number
    }
    startDate: string;
    endDate: string;
    dateList: string[];
    initialStartTime: number;
    initialEndTime: number;
    titleText: string;
    descriptionText: string;
    id: string;
    allDay: boolean;
    endTimeMod: boolean
    onEventsChanged: () => void
    deleteEvent: (event: DeletedEvent) => void;
    gsts: string;
    loc: string;
    onPositionChange: (nextPosition: { x: number; y: number }) => void
    user?: (typeof authClient.$Infer.Session)["user"];

}

interface SidebarInfo {
    /*
    isOpen: whether it should appear.
    onClose: a function it can call when the user presses Cancel.
     */
    isOpen: boolean;
    onClose: () => void;
    setAuthOpen: (event: React.MouseEvent<HTMLButtonElement>) => void;
    onUserMenuOpen: () => void;
    user?: (typeof authClient.$Infer.Session)["user"];
}

// ====================================================
// Event popup
// ====================================================

export default function Popup({
                                  isOpen, onClose, position, startDate, endDate, dateList, initialStartTime,
                                  initialEndTime, titleText, descriptionText, id, allDay, endTimeMod, onEventsChanged,
                                  deleteEvent, gsts, loc, onPositionChange, user
                              }: PopupInfo) {
    // ------------------------------------------------
    // State and refs
    // ------------------------------------------------

    const [calendarType, setCalendarType] = useState('default')
    const [startTime, setStartTime] = useState(initialStartTime)
    const [endTime, setEndTime] = useState(initialEndTime)
    const [selectedStartDate, setSelectedStartDate] = useState(startDate)
    const [selectedEndDate, setSelectedEndDate] = useState(endDate)
    const [location, setLocation] = useState(loc)
    const [title, setTitle] = useState(titleText)
    const [allday, setAllday] = useState(allDay)
    const [eventID, setEventID] = useState(id)
    const [description, setDescription] = useState(descriptionText)
    const [endTimeModified, setEndTimeModified] = useState(endTimeMod)
    const [locationModified, setLocationModified] = useState(false)
    const [guests, setGuests] = useState(gsts)
    const [repetitionString, setRepetitionString] = useState("Does not repeat")
    const dragStart = useRef<{
        pointerX: number
        pointerY: number
        popupX: number
        popupY: number
    } | null>(null)

    const titleCleanupTimer = useRef<ReturnType<typeof setTimeout> | null>(null); //timer to remove detected time from title
    const formRef = useRef<HTMLFormElement | null>(null); //for enter function

    // ------------------------------------------------
    // Derived values
    // ------------------------------------------------

    const selectedCalendar = CALENDAR_OPTIONS.find(
        (calendar) => calendar.value === calendarType
    ) ?? CALENDAR_OPTIONS[0]

    calcPopPosition()
    const startTimeOptions = generateTimeOptions(0, MINUTES_PER_DAY - 30, 30)

    let endTimeOptions = []
    if (selectedStartDate < selectedEndDate) {
        endTimeOptions = generateTimeOptions(0, MINUTES_PER_DAY, 15)
    } else {
        const firstEndTime = Math.ceil(startTime / 15) * 15
        endTimeOptions = generateTimeOptions(firstEndTime, MINUTES_PER_DAY, 15)
    }
    if (endTimeOptions[endTimeOptions.length - 1] !== MINUTES_PER_DAY) {
        endTimeOptions.push(MINUTES_PER_DAY)
    }
    //convert selected start/end dates to Date format for date picker combobox
    const plainDate = Temporal.PlainDate.from(selectedStartDate)
    const plainEndDate = Temporal.PlainDate.from(selectedEndDate)
    const pickerStartDate = new Date(plainDate.year, plainDate.month - 1, plainDate.day)
    const pickerEndDate = new Date(plainEndDate.year, plainEndDate.month - 1, plainEndDate.day)

    // ------------------------------------------------
    // Popup positioning
    // ------------------------------------------------

    //calculate popup position
    function calcPopPosition() {
        const windowX = window.innerWidth
        const windowY = window.innerHeight
        let desiredX = position.x + 40
        let desiredY = position.y - 120

        const popupwdith = 0.30 * windowX
        const popupHeight = 0.55 * windowY

        const XrightEdge = desiredX + popupwdith
        const YBottomEdge = desiredY + popupHeight


        if (XrightEdge > windowX) {
            //work backwards to calculate actual starting point
            //desiredX = windowX-windowX*0.28 - 40
            desiredX = windowX * 0.70 - 45
            position.x = desiredX
        }
        if (YBottomEdge > windowY) {
            desiredY = windowY * 0.45 + 115
            position.y = desiredY
        }
    }

    function nearPopupBoundary(event: React.PointerEvent<HTMLDivElement>) {
        const popup = event.currentTarget
        const rect = event.currentTarget.getBoundingClientRect()
        const localX = event.clientX - rect.left
        const localY = event.clientY - rect.top

        const fontSize = parseFloat(getComputedStyle(popup).fontSize)
        const boundary = 2 * fontSize
        if (localX <= boundary || localX >= rect.width - boundary || localY <= boundary * 2 || localY >= rect.height - boundary) {
            return true
        } else {
            return false  //false if we arent near the popup boundaries. no dragging for you
        }
    }

    function handlePointerDown(event: React.PointerEvent<HTMLDivElement>) { //start drag popup
        const target = event.target as HTMLElement

        if (target.closest('input, textarea, select, button')) { //enable drag only on white space of popup
            return
        }
        if (!nearPopupBoundary(event)) {
            return // no drag
        }

        // Capture all subsequent pointer events even if mouse leaves popup bounds
        event.currentTarget.setPointerCapture(event.pointerId);
        event.preventDefault();

        dragStart.current = {
            pointerX: event.clientX,
            pointerY: event.clientY,
            popupX: position.x,
            popupY: position.y,
        }

        const start = dragStart.current
        if (!start) return

        const offsetX = event.clientX - start.pointerX
        const offsetY = event.clientY - start.pointerY
        onPositionChange({
            x: start.popupX + offsetX,
            y: start.popupY + offsetY,
        })
    }

    function handlePointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const start = dragStart.current
        if (!start) {
            event.currentTarget.style.cursor = nearPopupBoundary(event) ? 'move' : 'default'
            return
        }
        const offsetX = event.clientX - start.pointerX
        const offsetY = event.clientY - start.pointerY
        onPositionChange({
            x: start.popupX + offsetX,
            y: start.popupY + offsetY,
        })
    }

    function handlePointerUp(event: React.PointerEvent<HTMLDivElement>) {
        if (dragStart.current) {
            if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                event.currentTarget.releasePointerCapture(event.pointerId);
            }
            dragStart.current = null;
        }
    }

    // ------------------------------------------------
    // Input and title handlers
    // ------------------------------------------------

    function handleTitleInputChange(extractionResult: TitleExtractionResult) {
        const returnTitle = extractionResult.returnTitle;
        const startTime = extractionResult.startTime;
        const endTime = extractionResult.endTime;
        const startDate = extractionResult.startDate;
        const endDate = extractionResult.endDate;
        const location = extractionResult.location;
        const requiresConfirmation = extractionResult.requiresConfirmation;
        const rangeInProgress = extractionResult.rangeInProgress;
        //title
        if (titleCleanupTimer.current !== null) {
            clearTimeout(titleCleanupTimer.current);
            titleCleanupTimer.current = null;
        }
        if (rangeInProgress) {
            titleCleanupTimer.current = setTimeout(() => {
                setTitle(returnTitle);
                titleCleanupTimer.current = null;
            }, 1567);
        } else {
            titleCleanupTimer.current = setTimeout(() => {
                setTitle(returnTitle);
                titleCleanupTimer.current = null;
            }, 967);
        }
        //time
        if (startTime !== "") {
            const [hours, minutes] = startTime.split(":").map(Number);
            const nextStartTime = hours * 60 + minutes;
            handleStartTimeChange(nextStartTime);
        }
        if (endTime !== "") {
            const [hours, minutes] = endTime.split(":").map(Number);
            const nextEndTime = hours * 60 + minutes;
            handleEndTimeChange(nextEndTime);
        }
        //date
        if (startDate.split(":")[0] == "00") {

        }
        if (startDate !== "") {
            setSelectedStartDate(startDate);
        }
        if (endDate !== "") {
            setSelectedEndDate(endDate);
        }

        if (location != "") {
            //TODO
        }

    }

    function datePicked(date: Date, startOrEnd: "start" | "end") {
//Sat Aug 01 2026 00:00:00 GMT-0400 (Eastern Daylight Time)
        const year = date.getFullYear()
        const month = String(date.getMonth() + 1).padStart(2, '0')
        const day = String(date.getDate()).padStart(2, '0')

        const dateString = `${year}-${month}-${day}`
        if (startOrEnd == "start") {
            setSelectedStartDate(dateString)
            const nextEndDate = dateString >= selectedEndDate
                //only update end date if start date is after end date
                ? dateString
                : selectedEndDate

            setSelectedEndDate(nextEndDate)
            if (dateString == nextEndDate && endTime < startTime) {
                setEndTime(startTime)
            }
        } else {
            setSelectedEndDate(dateString)
            if (selectedStartDate == dateString && endTime < startTime) {
                setEndTime(startTime)
            }
        }
    }

    function repetitionPicked(option: recurrence) {
        console.log("repetitionPicked", option)
        setRepetitionString("Repeats " + formatOptionsToText(option))
    }

    function generateRepetitionOptions(): recurrence[] {
        let options: recurrence[] = []
        const everyDayRecurrence: recurrence = {frequency: "daily", startDate: selectedStartDate}
        options.push(everyDayRecurrence)
        const everyOtherDay: recurrence = {frequency: "daily", skipInterval: 1, startDate: selectedStartDate}
        options.push(everyOtherDay)

        const dateObj = Temporal.PlainDate.from(selectedStartDate)
        const weekday = dateObj.dayOfWeek //1-7
        let repeatEveryWeek: recurrence = {frequency: "weekly", dayOfWeek: [weekday], startDate: selectedStartDate} //ex: every monday
        let everyOtherWeek: recurrence = {
            frequency: "weekly", dayOfWeek: [weekday], skipInterval: 1, startDate: selectedStartDate
        }
        options.push(repeatEveryWeek)
        options.push(everyOtherWeek)

        let weekRules: recurrence //every weekday/weekend (depending on its week day / weekend status)
        if (weekday < 6) { //weekday
            weekRules = {startDate: "", frequency: "weekly", dayOfWeek: [1, 2, 3, 4, 5]}
        } else {
            weekRules = {frequency: "weekly", dayOfWeek: [6, 7], startDate: selectedStartDate}
        }
        options.push(weekRules)

        const date = parseInt(selectedStartDate.split("-")[2]) - 1
        let repeatEveryMonth: recurrence = {frequency: "monthly", days: [date], startDate: selectedStartDate} //every xth of the month
        options.push(repeatEveryMonth)

        const repeatEveryYear: recurrence = {frequency: "yearly", days: [date], startDate: selectedStartDate}
        options.push(repeatEveryYear)

        // if (selectedStartDate != selectedEndDate) {
        //     // multiple day event, repetition option should include both days
        //     //"every monday to wednesday"/ "every 3rd-7th of the month"
        // } else {
        //
        // }
        return options
    }

// ------------------------------------------------
// Time handlers
// ------------------------------------------------

    function handleStartTimeChange(nextStartTime: number) {
        let defaultEndTime = 0
        if (nextStartTime % 15 != 0) {
            defaultEndTime = getNextFullHour(nextStartTime);
        } else {
            defaultEndTime = Math.min(nextStartTime + 60, MINUTES_PER_DAY)
        }
        setStartTime(nextStartTime)
        //conditions for modifying end time:
        /*
        1. if end time was never modified AND its same day
        2. if end time is earlier than start time AND its same day
         */
        if ((selectedStartDate == selectedEndDate && !endTimeModified) || (endTime < nextStartTime && selectedStartDate == selectedEndDate)) {
            setEndTime(defaultEndTime)
        }

        if (defaultEndTime % MINUTES_PER_DAY === 0 && selectedEndDate && selectedStartDate === selectedEndDate && (!endTimeModified || endTime < nextStartTime)) {
            const nextEndDate = Temporal.PlainDate.from(selectedEndDate).add({days: 1}).toString()
            setSelectedEndDate(nextEndDate)
            setEndTime(0)
        }
    }

    function handleEndTimeChange(nextEndTime: number) {
        setEndTimeModified(true)
        let nextEndDate = selectedEndDate
        if (nextEndTime == 24 * 60) {
            nextEndTime = 0
            nextEndDate = Temporal.PlainDate.from(selectedEndDate).add({days: 1}).toString()
            setSelectedEndDate(nextEndDate)
        }
        if (nextEndTime < startTime && selectedStartDate == nextEndDate) {
            nextEndTime = toggleAmPm(nextEndTime)

        }
        setEndTime(nextEndTime);
    }

// ------------------------------------------------
// Popup lifecycle and persistence
// ------------------------------------------------

    function closePopup() {
        setStartTime(DEFAULT_START_TIME)
        setEndTime(DEFAULT_END_TIME)
        setTitle("")
        setDescription("")
        setEventID("")
        setAllday(false)
        setEndTimeModified(false);

        onClose();
    }

    async function saveEvent() {
        //already given variables:
        //title is title
        //startTime is event starting time, in minutes since midnight
        //endTime is  event ending time, in minutes since midnight
        //selectedStartDate is event start date, in ISO format ("2023-01-01")
        //selectedEndDate is event end date
        //allDay is event alldayness :3
        //description is description
        const event = {
            id: eventID, //id is "" by default, and passed in by calendarApp if clicking on a prexisting event
            title: title,
            startTime: startTime,
            endTime: endTime,
            startDate: selectedStartDate,
            endDate: selectedEndDate,
            allDay: allday,
            extendedProps: {
                location: location,
                description: description,
                guests: guests,
            }
        }
        const userID = user ? user.id : DEMO_USER_ID
        await saveCalendarEvent(event, userID)
        onEventsChanged(); //refresh calendar events
        closePopup()
    }

    function createDeleteEventPackage() {
        const event: DeletedEvent = {
            id: eventID, //id is "" by default, and passed in by calendarApp if clicking on a prexisting event
            title: title,
            startTime: startTime,
            endTime: endTime,
            startDate: selectedStartDate,
            endDate: selectedEndDate,
            allDay: allday,
            extendedProps: {
                location: location,
                description: description,
                guests: guests,
            }
        }
        deleteEvent(event)
    }

// ------------------------------------------------
// Effects
// ------------------------------------------------

    useEffect(() => { // sync the popup dates when CalendarApp opens it with a new date
        if (isOpen) {
            setSelectedStartDate(startDate)
            setSelectedEndDate(endDate)
        }
    }, [isOpen, startDate, endDate])

    useEffect(() => {
        if (isOpen) {
            setSelectedStartDate(startDate);
            setSelectedEndDate(endDate);
            setStartTime(initialStartTime);
            setEndTime(initialEndTime);
            setTitle(titleText);
            setDescription(descriptionText);
            setAllday(allDay);
            setEventID(id);
        }
    }, [
        isOpen, startDate, endDate, initialStartTime, initialEndTime, titleText, descriptionText, allDay, id,
    ]);
    useEffect(() => { //detect delete press
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Backspace" && isOpen && eventID !== "") {
                const target = event.target;
                const isEditing = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
                    target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);

                if (isEditing) {//make sure backspace isnt pressed during input of a typing area
                    return;
                }
                createDeleteEventPackage()
            }
            if (event.key === "Enter" && !event.defaultPrevented) {
                const target = event.target;

                const controlHasFocus = target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement ||
                    target instanceof HTMLSelectElement || target instanceof HTMLButtonElement;

                if (!controlHasFocus) {
                    formRef.current?.requestSubmit();
                }
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen]);

// ------------------------------------------------
// Render
// ------------------------------------------------

    if (!isOpen) {
        return null
    }

    return (

        <div className="popup-overlay">
            <div
                className="popup-positioner"
                style={{
                    position: "fixed",
                    left: position.x + 40,
                    top: position.y - 120,
                }}
            >

                <div
                    className="event-popup"
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    style={{'--event-color': selectedCalendar.color} as CSSProperties}
                >
                    <button
                        className="icon-button close-button"
                        type="button"
                        aria-label="Close popup"
                        onClick={closePopup}
                    >
                        ×
                    </button>
                    <form
                        ref={formRef}
                        className="event-content"
                        id="event-form"
                        onSubmit={(event) => {
                            event.preventDefault() //prevent reload
                            void saveEvent()
                        }}
                    >
                        <input
                            value={title}
                            className="title-input"
                            placeholder="Add title, time/location"
                            onInput={(event) => {
                                const input = event.currentTarget.value
                                setTitle(input);
                                //temporarily disable time modification detection
                                const startTimeModified = false
                                handleTitleInputChange(simpleTimeLocationExtractor(input, startTimeModified, locationModified))
                            }}
                        />
                        <div className="form-row">
                            <img
                                className="popup-field-icon"
                                src={icons["./popup-date-time.png"]}
                                alt=""
                                aria-hidden="true"
                            />
                            <div className="row-content">
                                <div className="date-range">
                                    <DatePicker date={pickerStartDate} onChange={datePicked}
                                                ariaLabel={"start"}></DatePicker>
                                    <span className="range-separator">-</span>
                                    <DatePicker date={pickerEndDate} onChange={datePicked}
                                                ariaLabel={"end"} disableDatesBefore={pickerStartDate}></DatePicker>
                                </div>
                                <div className="time-range">
                                    <span className="time-select-with-edit">
                                        <TimeComboBox
                                            value={startTime}
                                            options={startTimeOptions}
                                            onChange={handleStartTimeChange}
                                            ariaLabel="Start time"
                                            ampm={getAmPm(startTime)}
                                        />
                                        <button
                                            className="time-period-toggle"
                                            type="button"
                                            aria-label="Toggle start time AM or PM"
                                            onClick={() => {
                                                handleStartTimeChange(toggleAmPm(startTime));
                                            }}
                                        >
                                            {getAmPm(startTime)} {/*display AM/PM*/}
                                        </button>
                                    </span>
                                    <span className="range-separator">-</span>
                                    <span className="time-select-with-edit">
                                        <TimeComboBox
                                            value={endTime}
                                            options={endTimeOptions}
                                            onChange={handleEndTimeChange}
                                            ariaLabel="End time"
                                            ampm={getAmPm(endTime)}
                                        />
                                        <button
                                            className="time-period-toggle"
                                            type="button"
                                            disabled={selectedStartDate === selectedEndDate && toggleAmPm(endTime) < startTime}
                                            aria-label="Toggle end time AM or PM"
                                            onClick={() => {
                                                setEndTimeModified(true)
                                                setEndTime((currentTime) => toggleAmPm(currentTime))
                                            }}>
                                            {getAmPm(endTime)}
                                        </button><label className="all-day-option">
                                        <input
                                            type="checkbox"
                                            checked={allday}
                                            onChange={(event) => {
                                                setAllday(event.target.checked);
                                            }}
                                        />
                                        <span>All day</span>
                                    </label>
                                    </span>
                                </div>
                                <RepetitionPicker onChange={repetitionPicked}
                                                  options={generateRepetitionOptions()}
                                                  repetitionString={repetitionString}></RepetitionPicker>
                            </div>
                        </div>
                        <div className="form-row">

                            <img
                                className="popup-field-icon"
                                src={icons["./popup-guests.png"]}
                                alt=""
                                aria-hidden="true"
                            />

                            <input
                                className="guests_location-input"
                                value={guests}
                                onChange={(event) => setGuests(event.target.value)}
                                placeholder="Add guests"></input>
                        </div>
                        <div className="form-row">
                            <img
                                className="popup-field-icon"
                                src={icons["./popup-location.png"]}
                                alt=""
                                aria-hidden="true"
                            /> <input
                            className="guests_location-input"
                            value={location}
                            onChange={(event) => setLocation(event.target.value)}
                            placeholder="Add location"></input>
                        </div>
                        <div className="form-row">
                            <img
                                className="popup-field-icon"
                                src={icons["./popup-calendar.png"]}
                                alt=""
                                aria-hidden="true"
                            /> <label className="calendar-select">
                            <select
                                aria-label="Calendar type"
                                value={calendarType}
                                onChange={(event) => setCalendarType(event.target.value)}
                            >
                                {CALENDAR_OPTIONS.map((calendar) => (
                                    <option key={calendar.value} value={calendar.value}>
                                        {calendar.label}
                                    </option>
                                ))}
                            </select>
                            <span
                                className="calendar-color"
                                style={{backgroundColor: selectedCalendar.color}}
                            />
                            <span className="calendar-arrow" aria-hidden="true">▾</span>
                        </label>
                        </div>
                        <div className="form-row description-row">
                            <img
                                className="popup-field-icon"
                                src={icons["./popup-description.png"]}
                                alt=""
                                aria-hidden="true"
                            /> <textarea
                            value={description}
                            className="description-input"
                            placeholder="Add description"
                            onChange={(event) => setDescription(event.target.value)}
                            rows={2}
                        />
                        </div>
                    </form>
                    <div className="popup-actions">
                        <button className="delete-button"
                                onClick={createDeleteEventPackage} type="button" aria-label="Delete event">
                            <img
                                className="popup-delete-button-icon"
                                src={icons["./popup-delete.png"]}
                                alt=""
                                aria-hidden="true"
                            />
                            <img
                                className="popup-delete-button-icon popup-delete-button-icon--hover"
                                src={icons["./popup-delete-red.png"]}
                                alt=""
                                aria-hidden="true"
                            />
                        </button>
                        <button className="text-button" type="button">More options</button>
                        <button className="save-button" type="submit" form="event-form">Save</button>
                    </div>
                </div>
            </div>
        </div>
    )
}


// ====================================================
// Expanded sidebar
// ====================================================

interface UserAccountControlProps {
    setAuthOpen: SidebarInfo["setAuthOpen"];
    onUserMenuOpen: SidebarInfo["onUserMenuOpen"];
    user: SidebarInfo["user"];
    minimized: boolean;
}

function UserAccountControl({setAuthOpen, onUserMenuOpen, user, minimized}: UserAccountControlProps) {
    if (!minimized) {
        if (!user) {
            return <button className='sidebar-login-button' type='button' onClick={setAuthOpen}>Log in</button>
        }
    } else {
        if (!user) {
            return <button className="sidebar-icon-button       " type='button' onClick={setAuthOpen}><img
                className="sidebar-icon"
                src={icons["./sidebar-guest.png"]}
                alt=""
                aria-hidden="true"
            /></button>
        }
    }

    return (
        <button className="user-profile-icon user-profile-icon-trigger" type='button'
                onClick={onUserMenuOpen} aria-label='User profile'>
            {user.image ? <img src={user.image} alt=""/> : (
                <span className="user-profile-initial">
                    {user.name.trim().charAt(0).toUpperCase() || "?"}
                </span>
            )}
        </button>
    )

}

export function Sidebar({isOpen, onClose, setAuthOpen, onUserMenuOpen, user}: SidebarInfo) {
    // ------------------------------------------------
    // Render
    // ------------------------------------------------

    if (!isOpen) {
        return null
    }
    return (
        <div className='app-sidebar'>
            <div className='sidebar-toolbar'>
                <div className='sidebar-toolbar-left'>
                    <button className='sidebar-icon-button' type='button' aria-label='Close sidebar'
                            onClick={onClose}>
                        <img
                            className="sidebar-arrow"
                            src={icons["./sidebar-arrow-right.png"]}
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                </div>
                <div className='sidebar-toolbar-right'>
                    <button className='sidebar-icon-button' type='button' aria-label='Search'>
                        <img
                            className="sidebar-icon"
                            src={icons["./sidebar-search.png"]}
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button className='sidebar-icon-button' type='button' aria-label='Notifications'>
                        <img
                            className="sidebar-icon"
                            src={icons["./sidebar-notifications.png"]}
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button className='sidebar-icon-button' type='button' aria-label='Add'>
                        <img
                            className="sidebar-icon"
                            src={icons["./sidebar-add.png"]}
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <button className='sidebar-icon-button' type='button' aria-label='Settings'>
                        <img
                            className="sidebar-icon"
                            src={icons["./sidebar-settings.png"]}
                            alt=""
                            aria-hidden="true"
                        />
                    </button>
                    <UserAccountControl setAuthOpen={setAuthOpen} onUserMenuOpen={onUserMenuOpen} user={user}
                                        minimized={false}/>
                </div>
            </div>
            <div className='app-sidebar-section'>
                {/* Temporary demo guidance while the scheduling assistant is being built. */}
                <div className='sidebar-instructions'>
                    <h2>Quick tips</h2>
                    <ul>
                        <li>Click a date or time slot to create an event.</li>
                        <li>Drag across dates or times to create a longer event.</li>
                        <li>
                            Add a time/time range to the title, such as <q>Lunch from 1-2:15pm</q> to set it
                            automatically.
                        </li>
                        <li>
                            Date ranges, such as <q>now - sept 3</q> also work.
                        </li>
                        <li>
                            Shortcuts: <kbd>N</kbd> creates a new event, <kbd>Enter</kbd> saves,
                            <kbd>Backspace</kbd> deletes when no field is active, and <kbd>Escape</kbd> closes.
                        </li>
                    </ul>
                </div>
                <div className='sidebar-assistant-preview'>
                    <h2>Scheduling assistant</h2>
                    <div className='sidebar-chat'>
                        <strong>Planning preview</strong>
                        <span>
                            Future versions will turn requests like <q>Plan two hours of study before dinner</q>
                            into editable calendar suggestions.
                        </span>
                    </div>
                </div>
            </div>
        </div>
    )
}

// ====================================================
// Minimized sidebar
// ====================================================

//onclose will js be closing this small bar -> opening big bar
export function MinimizedBar({isOpen, onClose, setAuthOpen, onUserMenuOpen, user}: SidebarInfo) {
    // ------------------------------------------------
    // Render
    // ------------------------------------------------

    if (!isOpen) {
        return null
    }

    return (
        <aside className="sidebar sidebar--minimized" aria-label="Calendar sidebar">
            <button className="sidebar-icon-button sidebar-expand-button"
                    type="button"
                    aria-label="Expand sidebar"
                    onClick={onClose}>
                <img
                    className="sidebar-arrow"
                    src={icons["./sidebar-arrow-left.png"]}
                    alt=""
                    aria-hidden="true"
                />
            </button>

            <nav className="sidebar-icon-list" aria-label="Sidebar tools">
                <UserAccountControl setAuthOpen={setAuthOpen} onUserMenuOpen={onUserMenuOpen} user={user}
                                    minimized={true}/>

                <button className="sidebar-icon-button" type="button" aria-label="Settings">
                    <img
                        className="sidebar-icon"
                        src={icons["./sidebar-settings.png"]}
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button className="sidebar-icon-button" type="button" aria-label="Add">
                    <img
                        className="sidebar-icon"
                        src={icons["./sidebar-add.png"]}
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button className="sidebar-icon-button" type="button" aria-label="Notifications">
                    <img
                        className="sidebar-icon"
                        src={icons["./sidebar-notifications.png"]}
                        alt=""
                        aria-hidden="true"
                    />
                </button>
                <button className="sidebar-icon-button" type="button" aria-label="Search">
                    <img
                        className="sidebar-icon"
                        src={icons["./sidebar-search.png"]}
                        alt=""
                        aria-hidden="true"
                    />
                </button>
            </nav>
        </aside>
    )
}
