import FullCalendar from '@fullcalendar/react'
import type {
    CalendarApi,
    CalendarOptions,
    CalendarRef,
    DateClickInfo,
    DateSelectInfo,
    EventClickInfo,
    EventDisplayInfo,
    EventSourceFuncInfo,
    SingleMonthInfo,
} from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/react/daygrid'
import themePlugin from '@fullcalendar/react/themes/monarch'
import '@fullcalendar/react/themes/monarch/theme.css'
import '@fullcalendar/react/themes/monarch/palettes/purple.css'
import '@fullcalendar/react/skeleton.css'
import interactionPlugin from '@fullcalendar/react/interaction'
import timeGridPlugin from '@fullcalendar/react/timegrid'
import multiMonthPlugin from '@fullcalendar/react/multimonth'
import {Temporal} from 'temporal-polyfill'
import {useCallback, useEffect, useMemo, useRef, useState} from 'react'
import Popup, {MinimizedBar, Sidebar} from './EventDetails'
import {DEMO_USER_ID, deleteCalendarEvent, getCalendarEvents, restoreEvent} from './api/eventsAPI'
import type {TransitionEvent} from 'react'
import AuthOverlay from "./components/AuthOverlay";
import {authClient} from "./api/auth-client";
import {UserMenu} from "./components/user/UserMenu";

// ----------------------------------------------------
// Types
// ----------------------------------------------------

interface HighlightedRange {
    start: string
    end: string
}

export interface DeletedEvent {
    id: string
    title: string
    startTime: number
    endTime: number
    startDate: string
    endDate: string
    allDay: boolean
    extendedProps: {
        location: string
        description: string
        guests: string
    }
}

// ----------------------------------------------------
// Calendar data and date utils
// ----------------------------------------------------

function toLocalDateString(date: Date) {
    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')

    return `${year}-${month}-${day}`
}

const monthTitleFormatter = new Intl.DateTimeFormat(undefined, {month: 'long', year: 'numeric'})
const DEFAULT_START_TIME = 9 * 60
const DEFAULT_END_TIME = 10 * 60
const DRAFT_EVENT_ID = 'draft-event'
const SCROLLING_MONTH_VIEW = 'scrollingMonth'

const CALENDAR_PLUGINS = [themePlugin, dayGridPlugin, timeGridPlugin, multiMonthPlugin, interactionPlugin]

const CALENDAR_HEADER_TOOLBAR = {
    left: 'prev,next scrollToday',
    center: 'title',
    right: 'timeGridDay,timeGridWeek,scrollingMonth,multiMonthYear compactViewSelector',
} satisfies CalendarOptions['headerToolbar']

const CALENDAR_VIEWS = {
    scrollingMonth: {
        type: 'dayGrid',
        visibleRange: (currentDate: Date) => {
            const start = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() - 6, 1)

            const end = new Date(
                currentDate.getFullYear(),
                currentDate.getMonth() + 7, 1)
            return {
                start: toLocalDateString(start),
                end: toLocalDateString(end)
            }
        },
        dateIncrement: {months: 1},
        aspectRatio: 1.4,
        dayNarrowWidth: 0,
        className: 'scrolling-month-measuring',
        tableBodyClass: 'calendar-month-weeks',
        monthStartFormat: {
            day: 'numeric',
        },
        dayCellClass: (info) => info.date.getDate() === 1 ? 'month-boundary-cell' : '', //turn every 1st into a css month boundary cell to target
        dayCellTopContent: (info) => (
            <>
                {info.date.getDate() === 1 && (
                    <span className="month-boundary-label">
                        {info.date.toLocaleString(undefined, {month: 'long'})}
                    </span>
                )}
                {info.text}
            </>
        ),
    },
    multiMonthYear: {
        className: 'calendar-year-view',
        dayNarrowWidth: 0,
        multiMonthMaxColumns: 2,
    },

} satisfies NonNullable<CalendarOptions['views']>

function formatMonthTitle(date: Date) {
    return monthTitleFormatter.format(date)
}

function formatEventTime(date: Date) {
    const hour = date.getHours()
    const minute = date.getMinutes()
    const minuteText = minute ? `:${String(minute).padStart(2, '0')}` : ''

    return `${hour % 12 || 12}${minuteText}${hour < 12 ? 'a' : 'p'}`
}

function isMonthGridView(viewType: string) {
    return viewType === 'dayGridMonth' ||
        viewType === 'multiMonthYear' ||
        viewType === SCROLLING_MONTH_VIEW
}

function displayNewEventPlaceholder(
    calendar: CalendarApi,
    startDate: string,
    endDate: string,
    startTime?: string,
    endTime?: string,
) {
    calendar.getEventById(DRAFT_EVENT_ID)?.remove()

    if (isMonthGridView(calendar.view.type)) {
        calendar.addEvent({
            id: DRAFT_EVENT_ID,
            title: 'New Event',
            start: startDate,
            end: endDate,
            allDay: true,
            editable: false,
        })
        return
    }

    calendar.addEvent({
        id: DRAFT_EVENT_ID,
        title: 'New Event',
        start: `${startDate}T${startTime}`,
        end: `${endDate}T${endTime}`,
        startEditable: true,
        endEditable: true,
        editable: true,
    })
}

function renderCalendarEventContent(eventInfo: EventDisplayInfo) {
    if (!isMonthGridView(eventInfo.view.type)) return true

    const fallbackTime = !eventInfo.event.allDay && eventInfo.isStart && eventInfo.event.start
        ? formatEventTime(eventInfo.event.start)
        : ''
    const timeText = eventInfo.timeText || fallbackTime

    return <>
        {timeText && <div className='calendar-event-time'>{timeText}</div>}
        <div className={`calendar-event-title ${eventInfo.event.allDay ? '' : 'calendar-event-title-timed'}`}>
            {eventInfo.event.title || '\u00a0'}
        </div>
    </>
}

function hideUnmeasuredMonth(monthInfo: SingleMonthInfo) {
    return monthInfo.multiMonthColumns === 0
        ? 'year-month-measuring'
        : ''
}

function getMinutesAfterMidnight(dateTime: string) {
    const time = Temporal.PlainTime.from(dateTime)
    return time.hour * 60 + time.minute
}

function createDateList(startDate: string, daysBetween?: number) {
    const selected = Temporal.PlainDate.from(startDate)
    const dates: string[] = []

    for (let i = -7; i < 8; i++) {
        dates.push(selected.add({days: i}).toString())
        if (daysBetween && i === 7) {
            for (let j = 1; j < daysBetween; j++) {
                dates.push(selected.add({days: i + j}).toString())
            }
        }
    }
    return dates
}

// ====================================================
// calendar app
// ====================================================

export default function CalendarApp() {
    // ------------------------------------------------
    // state
    // ------------------------------------------------

    const [isPopOpen, setIsPopOpen] = useState(false)
    const [popupPos, setPopupPos] = useState({x: 0, y: 0})
    const [highlightedRange, setHighlightedRange] = useState<HighlightedRange | null>(null)
    const calendarComponentRef = useRef<CalendarRef | null>(null)
    const deleteTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

    const [isSidebar, setSidebar] = useState(true)

    const [selectedDate, setSelectedDate] = useState('')
    const [selectedEndDate, setSelectedEndDate] = useState('')
    const [startTime, setStartTime] = useState(DEFAULT_START_TIME)
    const [endTime, setEndTime] = useState(DEFAULT_END_TIME)
    const [deletePopupUndo, setDeletePopup] = useState(false)
    const [location, setLocation] = useState('')
    const [guests, setGuests] = useState("")
    const [dateList, setDateList] = useState<string[]>([])

    const [title, setTitle] = useState('')
    const [description, setDescription] = useState('')
    const [id, setId] = useState('')

    const justDragged = useRef(false)
    const [allDay, setAllDay] = useState(false)
    const [justDeletedEvent, setJustDeletedEvent] = useState<DeletedEvent | null>(null)
    const calendarMainRef = useRef<HTMLDivElement | null>(null)
    const monthScrollCleanupRef = useRef<() => void>(() => undefined)
    const scrollToMonthRef = useRef<(date: Date, behavior?: ScrollBehavior) => void>(() => undefined)
    const alignMonthViewRef = useRef<() => void>(() => undefined)
    const visibleMonthRef = useRef(new Date())
    const lastCalendarViewRef = useRef('')
    const arrowTargetMonthRef = useRef<Date | null>(null)
    const arrowTargetTimerRef = useRef(0)
    const initialSidebarResizeHandledRef = useRef(0)
    const initialSidebarScrollRatioRef = useRef(0)
    const [isAuthOpen, setisAuthOpen] = useState(false)
    const [isIntroOpen, setisIntroOpen] = useState(() => localStorage.getItem("intro-seen") !== "true") //cache for intro
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false)
    const [authOrigin, setAuthOrigin] = useState({x: 0, y: 0})
    const [calendarView, setCalendarView] = useState(SCROLLING_MONTH_VIEW)
    const [loginChosen, setLoginChosen] = useState(() => localStorage.getItem("intro-seen") === "true") //state to track which login button was chosen: from intro's signup or login
    //logic: if intro page will not be shown (page viewed before), ONLY login button is clickable. so if seen, state should be true
    const prevMonthCentreRef = useRef(new Date())
    const rangeRecenterInProgressRef = useRef(false)

    const scrollVisibleMonth = useCallback((offset: number) => {
        const targetMonth = new Date(arrowTargetMonthRef.current ?? visibleMonthRef.current)
        targetMonth.setDate(1)
        targetMonth.setMonth(targetMonth.getMonth() + offset)
        arrowTargetMonthRef.current = targetMonth
        window.clearTimeout(arrowTargetTimerRef.current)
        arrowTargetTimerRef.current = window.setTimeout(() => {
            arrowTargetMonthRef.current = null
        }, 400)
        scrollToMonthRef.current(targetMonth, 'smooth')
    }, [])

    const calendarButtons = useMemo<NonNullable<CalendarOptions['buttons']>>(() => ({
        timeGridDay: {
            className: 'calendar-wide-view-button',
        },
        timeGridWeek: {
            className: 'calendar-wide-view-button',
        },
        scrollingMonth: {
            text: 'Month',
            className: 'calendar-wide-view-button',
        },
        multiMonthYear: {
            className: 'calendar-wide-view-button',
        },
        prev: {
            className: 'calendar-nav-arrow',
            click: (event) => {
                if (calendarComponentRef.current?.getApi().view.type === SCROLLING_MONTH_VIEW) {
                    event.preventDefault()
                    scrollVisibleMonth(-1)
                }
            },
        },
        next: {
            className: 'calendar-nav-arrow',
            click: (event) => {
                if (calendarComponentRef.current?.getApi().view.type === SCROLLING_MONTH_VIEW) {
                    event.preventDefault()
                    scrollVisibleMonth(1)
                }
            },
        },
        scrollToday: {
            text: 'Today',
            hint: 'Today',
            className: 'calendar-today-button',
            click: (event) => {
                event.preventDefault()

                const calendar = calendarComponentRef.current?.getApi()

                if (calendar?.view.type === SCROLLING_MONTH_VIEW) {
                    arrowTargetMonthRef.current = null
                    window.clearTimeout(arrowTargetTimerRef.current)
                    scrollToMonthRef.current(new Date(), 'smooth')
                } else {
                    calendar?.today()
                }
            },
        },
    }), [scrollVisibleMonth])

    const calendarToolbarElements = useMemo<NonNullable<CalendarOptions['toolbarElements']>>(() => ({
        compactViewSelector: () => (
            <label className="calendar-view-select-wrapper">
                <span className="visually-hidden">Calendar view</span>
                <select
                    className="calendar-view-select"
                    value={calendarView}
                    onChange={(event) => {
                        calendarComponentRef.current?.getApi().changeView(event.currentTarget.value)
                    }}
                >
                    <option value="timeGridDay">Day</option>
                    <option value="timeGridWeek">Week</option>
                    <option value={SCROLLING_MONTH_VIEW}>Month</option>
                    <option value="multiMonthYear">Year</option>
                </select>
            </label>
        ),
    }), [calendarView])

    // ------------------------------------------------
    // Sidebar functions
    // ------------------------------------------------

    function closeSidebar() {
        if (initialSidebarResizeHandledRef.current == 0) { //not resized yet (this is to fix an initial resize bug)
            const scroller = calendarMainRef.current?.querySelector<HTMLElement>('.calendar-month-weeks')
            if (scroller) {
                initialSidebarScrollRatioRef.current = scroller.scrollTop / scroller.scrollHeight
            }
        }
        setSidebar(false)
    }

    function openSidebar() {
        setSidebar(true)
    }

    function openUserMenu() {
        setIsUserMenuOpen(true)
    }

    function closeUserMenu() {
        setIsUserMenuOpen(false)
    }

    function handleSidebarTransitionEnd(event: TransitionEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) return
        if (event.propertyName !== 'grid-template-columns') return
        //  handler continues only when .app element itself finished transitioning (sdebar)
        if (initialSidebarResizeHandledRef.current > 1) return

        const scroller = calendarMainRef.current?.querySelector<HTMLElement>('.calendar-month-weeks')
        if (!scroller) return

        const targetTop = initialSidebarScrollRatioRef.current * scroller.scrollHeight //restore scroll position
        let framesRemaining = 12
        const align = () => { //continuously adjusts position to restore initial scorlled month bug
            if (Math.abs(scroller.scrollTop - targetTop) > 1) {
                scroller.scrollTo({
                    top: targetTop,
                    behavior: 'auto',
                })
            }
            if (framesRemaining-- > 0) {
                window.requestAnimationFrame(align)
            } else {
                initialSidebarResizeHandledRef.current += 1
            }
        }
        align()
    }

// ------------------------------------------------
// login/intro
// ------------------------------------------------
    function openLogin(event: React.MouseEvent<HTMLButtonElement>) {
        const button = event.currentTarget.getBoundingClientRect();

        setAuthOrigin({
            x: button.left + button.width / 2,
            y: button.top + button.height / 2,
        });
        closePopup()
        setisAuthOpen(true)
    }

    function closeLogin() {
        setisAuthOpen(false)
        closeIntro()
        setLoginChosen(true)
    }

    function closeIntro() {
        setisIntroOpen(false)
        setLoginChosen(true)
        localStorage.setItem("intro-seen", "true")
    }

    const {data: session, isPending, error} = authClient.useSession();
    let user = session?.user;
    const userId = session?.user.id ?? DEMO_USER_ID

    const fetchCalendarEvents = useCallback((fetchInfo: EventSourceFuncInfo) => {
            return getCalendarEvents(fetchInfo.startStr, fetchInfo.endStr, userId)
        }, [userId]
    )
// ------------------------------------------------
// Calendar refresh and temp events
// ------------------------------------------------

    function refreshCalendar() {
        calendarComponentRef.current?.getApi().refetchEvents()
    }

    useEffect(() => {
        if (!isPending) {
            refreshCalendar()
        }
    }, [userId, isPending])

    function scrollCalendar(activeMonth: Date) { //logic for scrolling month: updates range of months (if applicable) and sets title
        //generate new list of months when we reach 1-2 months of the original scrollingmonth end range
        if (rangeRecenterInProgressRef.current) return

        const monthDifference =
            (activeMonth.getFullYear() - prevMonthCentreRef.current.getFullYear()) * 12
            + activeMonth.getMonth() - prevMonthCentreRef.current.getMonth() //using month difference to calculate when to rerender

        if (Math.abs(monthDifference) >= 5) {//roughly 5 months, generate new centre + months
            const calendarApi = calendarComponentRef.current?.getApi()
            if (!calendarApi) return

            rangeRecenterInProgressRef.current = true
            prevMonthCentreRef.current = activeMonth
            calendarApi.gotoDate(activeMonth) //sets new month to generate visibleRange around
        }
    }

// ------------------------------------------------
// popup
// ------------------------------------------------

    function closePopup() {
        const calendar = calendarComponentRef.current?.getApi()

        setIsPopOpen(false)
        setHighlightedRange(null)
        calendar?.unselect()
        calendar?.getEventById(DRAFT_EVENT_ID)?.remove()
        setStartTime(DEFAULT_START_TIME)
        setEndTime(DEFAULT_END_TIME)
        setSelectedDate('')
        setSelectedEndDate('')
        resetStates()
    }

    function resetStates() {
        setTitle('')
        setDescription('')
        setId('')
        setAllDay(false)
        setGuests("")
        setLocation("")
    }

    async function startDeleteTimer(event: DeletedEvent) {
        closePopup()
        if (!event.id) return

        if (deleteTimer.current !== null) {
            clearTimeout(deleteTimer.current)
        }

        setJustDeletedEvent(event)
        await deleteCalendarEvent(event.id, userId)
        setDeletePopup(true)
        refreshCalendar()

        deleteTimer.current = setTimeout(() => {
            setJustDeletedEvent(null)
            deleteTimer.current = null
            setDeletePopup(false)
        }, 5000)
    }

    async function undoDelete() {
        if (deleteTimer.current !== null && justDeletedEvent !== null) {
            clearTimeout(deleteTimer.current)
            await restoreEvent(justDeletedEvent, userId)
            refreshCalendar()
            deleteTimer.current = null
            setJustDeletedEvent(null)
        }
        setDeletePopup(false)
    }

    useEffect(() => {
        function handleKeyDown(event: KeyboardEvent) {
            if (event.key !== 'Escape' && event.key !== 'n') return

            if (event.key === 'n') {
                if (!isPopOpen) {
                    resetStates()
                    setIsPopOpen(true)
                    setPopupPos({x: 1000, y: 300})
                    const todayString = toLocalDateString(new Date())
                    setSelectedDate(todayString)
                    setDateList(createDateList(todayString))
                    setSelectedEndDate(todayString)
                }
                return
            }
            if (isIntroOpen || isAuthOpen) {
                if (isIntroOpen) {
                    closeIntro()
                }
                if (isAuthOpen) {
                    closeLogin()
                }
                return
            }
            if (isPopOpen) {
                closePopup()
                return
            }
            if (isSidebar) closeSidebar()
        }

        window.addEventListener('keydown', handleKeyDown)

        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isPopOpen, isSidebar, isAuthOpen, isIntroOpen])

    useEffect(() => { //close popup on click outside
        if (!isPopOpen) return;

        function handleClickOutside(event: MouseEvent) {
            const target = event.target as HTMLElement | null;
            if (target && !target.closest('.event-popup')) {
                closePopup();
            }
        }

        window.addEventListener('mousedown', handleClickOutside);
        return () => window.removeEventListener('mousedown', handleClickOutside);
    }, [isPopOpen]);

    useEffect(() => {
        return () => {
            if (deleteTimer.current !== null) clearTimeout(deleteTimer.current)
        }
    }, [])

// ------------------------------------------------
// user fullcalendar interactions
// ------------------------------------------------

    function handleDateClick(clickInfo: DateClickInfo) {
        if (justDragged.current) {
            return
        }
        resetStates()

        setStartTime(DEFAULT_START_TIME)
        setEndTime(DEFAULT_END_TIME)

        setIsPopOpen(true)
        setPopupPos({x: clickInfo.jsEvent.clientX, y: clickInfo.jsEvent.clientY})

        const dateOnly = Temporal.PlainDate.from(clickInfo.dateStr).toString()
        const nextDate = Temporal.PlainDate.from(dateOnly).add({days: 1}).toString()

        clickInfo.view.calendar.unselect()
        setHighlightedRange({
            start: dateOnly,
            end: nextDate,
        })

        setSelectedDate(dateOnly)
        setSelectedEndDate(dateOnly)
        setDateList(createDateList(dateOnly))

        if (!isMonthGridView(clickInfo.view.type)) {
            const timeOnly = Temporal.PlainTime.from(clickInfo.dateStr).toString()
            const startTimeMinutes = getMinutesAfterMidnight(timeOnly)
            setStartTime(startTimeMinutes)
            setEndTime(startTimeMinutes + 60)
            displayNewEventPlaceholder(
                clickInfo.view.calendar,
                dateOnly,
                dateOnly,
                timeOnly,
                Temporal.PlainTime.from(clickInfo.dateStr).add({minutes: 60}).toString(),
            )
        } else {
            displayNewEventPlaceholder(clickInfo.view.calendar, dateOnly, dateOnly)
        }
    }

    function handleDateDrag(selectInfo: DateSelectInfo) {
        resetStates()

        // Prevent dragging from triggering a second date click.
        justDragged.current = true
        setTimeout(() => {
            justDragged.current = false
        }, 0)

        setStartTime(DEFAULT_START_TIME)

        const startDateOnly = Temporal.PlainDate.from(selectInfo.startStr).toString()
        const endDateOnly = Temporal.PlainDate.from(selectInfo.endStr).toString()

        setHighlightedRange({
            start: selectInfo.startStr,
            end: selectInfo.endStr,
        })

        setIsPopOpen(true)
        if (selectInfo.jsEvent) {
            setPopupPos({x: selectInfo.jsEvent.clientX, y: selectInfo.jsEvent.clientY,})
        }
        const currentView = selectInfo.view.type
        let selectedEndDate = endDateOnly

        if (isMonthGridView(currentView)) {
            if (startDateOnly === endDateOnly) {
                setEndTime(DEFAULT_END_TIME)
            } else {
                setEndTime(DEFAULT_START_TIME)
            }
            selectedEndDate = Temporal.PlainDate.from(endDateOnly).subtract({days: 1}).toString()
            displayNewEventPlaceholder(selectInfo.view.calendar, startDateOnly, endDateOnly)
        } else {
            const startTimeOnly = Temporal.PlainTime.from(selectInfo.startStr).toString()
            const endTimeOnly = Temporal.PlainTime.from(selectInfo.endStr).toString()

            setStartTime(getMinutesAfterMidnight(startTimeOnly))
            setEndTime(getMinutesAfterMidnight(endTimeOnly))
            displayNewEventPlaceholder(selectInfo.view.calendar, startDateOnly, endDateOnly, startTimeOnly, endTimeOnly)
        }

        setSelectedDate(startDateOnly)
        setSelectedEndDate(selectedEndDate)

        const start = Temporal.PlainDate.from(selectInfo.startStr)
        const end = Temporal.PlainDate.from(selectInfo.endStr)
        const daysBetween = start.until(end).days

        setDateList(createDateList(selectInfo.startStr, daysBetween))

        // The custom range remains visible while FullCalendar's internal
        // selection is cleared so another drag can begin normally.
        if (isMonthGridView(currentView)) {
            selectInfo.view.calendar.unselect()
        }
    }

    function handleEventClick(selectInfo: EventClickInfo) {
        setIsPopOpen(true)
        setPopupPos({x: selectInfo.jsEvent.clientX, y: selectInfo.jsEvent.clientY})

        setTitle(selectInfo.event.title)
        setId(selectInfo.event.id)
        setAllDay(selectInfo.event.allDay)

        const startDate = Temporal.PlainDate.from(selectInfo.event.startStr).toString()
        let endDate = selectInfo.event.endStr ? Temporal.PlainDate.from(selectInfo.event.endStr).toString() : startDate

        let startTimeMinutes = 0
        let endTimeMinutes = 0

        if (!selectInfo.event.allDay) {
            const startTime = Temporal.PlainTime.from(selectInfo.event.startStr).toString()
            const endTime = Temporal.PlainTime.from(selectInfo.event.endStr).toString()
            startTimeMinutes = getMinutesAfterMidnight(startTime)
            endTimeMinutes = getMinutesAfterMidnight(endTime)
        } else {
            endDate = Temporal.PlainDate.from(selectInfo.event.endStr).subtract({days: 1}).toString()
            endTimeMinutes = 24 * 60 - 1
        }
        setSelectedDate(startDate)
        setSelectedEndDate(endDate)
        setEndTime(endTimeMinutes)
        setStartTime(startTimeMinutes)

        const daysBetween = Temporal.PlainDate.from(startDate).until(endDate).days
        setDateList(createDateList(startDate, daysBetween))
        if (isMonthGridView(selectInfo.view.type)) {
            selectInfo.view.calendar.unselect()
        }
        setDescription(selectInfo.event.extendedProps.description)
        setGuests(selectInfo.event.extendedProps.guests)
        setLocation(selectInfo.event.extendedProps.location)
    }

// ------------------------------------------------
// render
// ------------------------------------------------

    return (
        <div className={isSidebar ? 'app' : 'app app-sidebar-collapsed'}
             onTransitionEnd={handleSidebarTransitionEnd}>
            <div ref={calendarMainRef} className='calendar-main'>
                <FullCalendar
                    ref={calendarComponentRef}
                    plugins={CALENDAR_PLUGINS}
                    initialView={SCROLLING_MONTH_VIEW}
                    height="100%"
                    headerToolbar={CALENDAR_HEADER_TOOLBAR}
                    views={CALENDAR_VIEWS}
                    buttons={calendarButtons}
                    toolbarElements={calendarToolbarElements}
                    viewDidMount={(viewInfo) => {
                        const findToolbarTitle = () => {
                            const toolbarTitle = calendarMainRef.current?.querySelector<HTMLElement>('[role="heading"]')

                            toolbarTitle?.classList.add('calendar-toolbar-title')
                            const toolbar = toolbarTitle?.parentElement?.parentElement
                            toolbar?.classList.add('calendar-toolbar') //find and modify css of toolbartitle
                            return toolbarTitle
                        }

                        const setToolbarTitle = (text: string) => {
                            const toolbarTitle = findToolbarTitle()
                            if (!toolbarTitle) return

                            toolbarTitle.textContent = text
                        }
                        findToolbarTitle()
                        if (viewInfo.view.type !== SCROLLING_MONTH_VIEW) return
                        const scroller = viewInfo.el.querySelector<HTMLElement>('.calendar-month-weeks')
                        if (!scroller) return
                        const today = new Date()
                        setToolbarTitle(formatMonthTitle(today))
                        scrollCalendar(today)

                        const updateTitle = () => {
                            const scrollerTop = scroller.getBoundingClientRect().top //screen position at top of calendar edge

                            const firstRow = scroller.querySelector<HTMLElement>('[role="row"]') //first visible row
                            const rowHeight = firstRow?.getBoundingClientRect().height ?? 0
                            const switchingLine = scrollerTop + rowHeight
                            //cells that head a month
                            const monthStartCells = scroller.querySelectorAll<HTMLElement>('[role="gridcell"][data-date$="-01"]')
                            let activeMonthCell: HTMLElement | null = null

                            const scrollerBounds = scroller.getBoundingClientRect()
                            for (const cell of monthStartCells) {
                                const monthStartRow = cell.closest<HTMLElement>('[role="row"]')//check every cell
                                if (monthStartRow === null) return
                                const rowBounds = monthStartRow.getBoundingClientRect()

                                const distanceFromTop = rowBounds.top - scrollerBounds.top
                                if (distanceFromTop > 1.9 && rowBounds.bottom + rowHeight * 0.9 < scrollerBounds.bottom) {
                                    cell.dataset.monthLabelVisible = 'true'//if cell is visible, add class to show month label
                                } else {
                                    cell.dataset.monthLabelVisible = 'false'
                                }
                                if (monthStartRow && monthStartRow.getBoundingClientRect().top < switchingLine) {
                                    activeMonthCell = cell //determine title month display
                                }
                            }
                            const month = activeMonthCell?.dataset.date

                            if (month) {
                                const [year, monthIndex] = month.split('-').map(Number)
                                const activeMonth = new Date(year, monthIndex - 1, 1)
                                visibleMonthRef.current = activeMonth
                                setToolbarTitle(formatMonthTitle(activeMonth))
                                scrollCalendar(activeMonth)
                            }
                        }

                        const scrollToMonth = (date: Date, behavior: ScrollBehavior = 'auto') => {
                            const month = toLocalDateString(date).slice(0, 7)

                            const firstDayCell = scroller.querySelector<HTMLElement>(`[role="gridcell"][data-date="${month}-01"]`)
                            const monthStartRow = firstDayCell?.closest<HTMLElement>('[role="row"]')

                            if (!firstDayCell || !monthStartRow) return
                            const activeMonth = new Date(date.getFullYear(), date.getMonth(), 1)
                            const top = monthStartRow.offsetTop
                            visibleMonthRef.current = activeMonth
                            setToolbarTitle(formatMonthTitle(activeMonth))
                            scrollCalendar(activeMonth)

                            if (behavior === 'smooth') {
                                scroller.scrollTo({top, behavior})
                            } else {
                                scroller.scrollTop = top
                            }
                            return monthStartRow.getBoundingClientRect().height >= firstDayCell.getBoundingClientRect().width * 0.75
                        }

                        let scrollEndTimer = 0
                        const handleScroll = () => {
                            updateTitle()
                            window.clearTimeout(scrollEndTimer)
                            scrollEndTimer = window.setTimeout(() => { //scroll snap to start of months
                                const scrollerTop = scroller.getBoundingClientRect().top

                                const monthStartCells = scroller.querySelectorAll<HTMLElement>(
                                    '[role="gridcell"][data-date$="-01"]')

                                const nearbyMonthCell = [...monthStartCells].find((cell) => { //search month start cells andfind one whose below return statement is true
                                    const monthStartRow = cell.closest<HTMLElement>('[role="row"]')
                                    if (!monthStartRow) return false
                                    const rowBounds = monthStartRow.getBoundingClientRect()
                                    const distanceFromTop = rowBounds.top - scrollerTop
                                    return Math.abs(distanceFromTop) <= rowBounds.height / 1.3 //return true if within 1 row height of top of scroller
                                })

                                const nearbyDate = nearbyMonthCell?.dataset.date
                                if (!nearbyDate) return

                                const [year, monthIndex] = nearbyDate.split('-').map(Number)
                                scrollToMonth(new Date(year, monthIndex - 1, 1), 'smooth')
                            }, 100)
                        }

                        let alignmentFrame = 0
                        const alignCurrentMonth = () => {
                            window.cancelAnimationFrame(alignmentFrame)
                            let framesRemaining = 12

                            const align = () => {
                                if (lastCalendarViewRef.current &&
                                    lastCalendarViewRef.current !== SCROLLING_MONTH_VIEW) return
                                const rowsAreSized = scrollToMonth(today)

                                if (rowsAreSized) {
                                    viewInfo.el.classList.remove('scrolling-month-measuring')
                                }
                                if (framesRemaining-- > 0) {
                                    alignmentFrame = window.requestAnimationFrame(align)
                                } else {
                                    viewInfo.el.classList.remove('scrolling-month-measuring')
                                }
                            }
                            align()
                        }
                        scroller.addEventListener('scroll', handleScroll, {passive: true})
                        alignMonthViewRef.current = alignCurrentMonth
                        scrollToMonthRef.current = (date, behavior) => {
                            window.cancelAnimationFrame(alignmentFrame)
                            scrollToMonth(date, behavior)
                        }
                        alignCurrentMonth()

                        monthScrollCleanupRef.current = () => {
                            window.cancelAnimationFrame(alignmentFrame)
                            window.clearTimeout(arrowTargetTimerRef.current)
                            arrowTargetMonthRef.current = null
                            viewInfo.el.classList.add('scrolling-month-measuring')
                            scroller.removeEventListener('scroll', handleScroll)
                            window.clearTimeout(scrollEndTimer)
                        }
                    }}
                    viewWillUnmount={(viewInfo) => {
                        if (viewInfo.view.type === SCROLLING_MONTH_VIEW) {
                            monthScrollCleanupRef.current()
                        }
                    }}
                    datesSet={(dateInfo) => {
                        setCalendarView(dateInfo.view.type)
                        const enteredScrollingMonth = dateInfo.view.type === SCROLLING_MONTH_VIEW &&
                            lastCalendarViewRef.current !== SCROLLING_MONTH_VIEW
                        lastCalendarViewRef.current = dateInfo.view.type

                        if (rangeRecenterInProgressRef.current) {
                            // FullCalendar can emit scroll events while applying the new range.
                            // Keep those events from starting a second gotoDate feedback loop.
                            window.requestAnimationFrame(() => {
                                window.requestAnimationFrame(() => {
                                    rangeRecenterInProgressRef.current = false
                                })
                            })
                        }

                        if (dateInfo.view.type !== SCROLLING_MONTH_VIEW) {
                            window.requestAnimationFrame(() => {
                                if (lastCalendarViewRef.current !== dateInfo.view.type) return

                                const toolbarTitle = calendarMainRef.current?.querySelector<HTMLElement>('[role="heading"]')
                                if (!toolbarTitle) return

                                toolbarTitle.classList.add('calendar-toolbar-title')
                                toolbarTitle.textContent = dateInfo.view.type === 'multiMonthYear'
                                    ? String(dateInfo.view.currentStart.getFullYear())
                                    : dateInfo.view.title
                            })
                            return
                        }

                        if (enteredScrollingMonth) {
                            window.requestAnimationFrame(() => {
                                if (lastCalendarViewRef.current === SCROLLING_MONTH_VIEW) {
                                    alignMonthViewRef.current()
                                }
                            })
                        }
                    }}
                    editable
                    selectMinDistance={10}
                    selectable
                    selectMirror
                    dayMaxEvents
                    singleMonthClass={hideUnmeasuredMonth}
                    dayCellClass={(dayInfo) => {
                        const cellDate = toLocalDateString(dayInfo.date)

                        return highlightedRange &&
                        cellDate >= highlightedRange.start &&
                        cellDate < highlightedRange.end
                            ? 'calendar-selection-highlight'
                            : ''
                    }}
                    dateClick={handleDateClick}
                    select={handleDateDrag}
                    eventContent={renderCalendarEventContent}
                    eventClick={handleEventClick}
                    events={fetchCalendarEvents}
                />
            </div>
            {deletePopupUndo && (
                <div className="delete-undo" role="status" aria-live="polite">
                    <span className="delete-undo__message">Event deleted</span>
                    <button className="delete-undo__button" type="button" onClick={undoDelete}>
                        Undo
                    </button>
                </div>
            )}
            {isPopOpen && (
                <Popup
                    isOpen={isPopOpen}
                    onClose={closePopup}
                    position={popupPos}
                    startDate={selectedDate}
                    endDate={selectedEndDate}
                    dateList={dateList}
                    initialStartTime={startTime}
                    initialEndTime={endTime}
                    titleText={title}
                    descriptionText={description}
                    id={id}
                    allDay={allDay}
                    endTimeMod={false}
                    onEventsChanged={refreshCalendar}
                    deleteEvent={startDeleteTimer}
                    loc={location}
                    gsts={guests}
                    onPositionChange={setPopupPos}
                    user={session?.user}
                />
            )}
            <Sidebar isOpen={isSidebar} onClose={closeSidebar} setAuthOpen={openLogin}
                     onUserMenuOpen={openUserMenu} user={session?.user}/>
            <MinimizedBar isOpen={!isSidebar} onClose={openSidebar} setAuthOpen={openLogin}
                          onUserMenuOpen={openUserMenu} user={session?.user}/>
            {isUserMenuOpen && <UserMenu onClose={closeUserMenu} user={session?.user}/>}

            {(isIntroOpen || isAuthOpen) && <div className="auth-overlay">
                {isIntroOpen && <div className="intro-panel">
                    <button
                        className="auth-close-button"
                        type="button"
                        aria-label="Close login"
                        onClick={closeIntro}
                        style={{fontSize: "1.5rem", lineHeight: 1}}>
                        ×
                    </button>
                    <div className="auth-content">
                        <p className="auth-eyebrow">Keep pace with your day.</p>
                        <h2 className="auth-title">Welcome to Tempo:</h2>
                        <p className="auth-subtitle">A smarter calendar, simplifying scheduling to keep your day in
                            rhythm. </p>
                        <span className="auth-text">Please </span>
                        <button
                            onClick={openLogin}
                            className="auth-text-button"
                            type="button">
                            sign in
                        </button>
                        <span className="auth-text"> or continue trying the demo.</span>
                        <br/> <span className="auth-muted-text">(Events are stored locally while logged out)</span>
                    </div>
                </div>}
                {isAuthOpen && <AuthOverlay
                    onClose={closeLogin}
                    onRevealComplete={closeIntro}
                    origin={authOrigin}
                    onAuthSuccess={closeLogin}
                    loginChosen={loginChosen}
                />}
            </div>}
        </div>
    )

}
