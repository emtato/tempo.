//extracts location if title contains home or work
//extracts time if title contains time in the following formats
// XPM, X PM, X.XXPM, X.XX PM, X:XXPM X:XX PM, 0:XX, 13-23:XX, noon, midnight

//also extracts time and date ranges
//return time in 24h format

export interface TitleExtractionResult {
    returnTitle: string
    startDate: string
    endDate: string
    startTime: string
    endTime: string
    requiresConfirmation: boolean
    location: string
    rangeInProgress: boolean
}

const MONTH_ALIASES: Map<string, number> = new Map([
    ["ja", 1], ["jan", 1], ["january", 1],
    ["fe", 2], ["feb", 2], ["february", 2],
    ["mar", 3], ["march", 3],
    ["ap", 4], ["apr", 4], ["april", 4],
    ["may", 5],
    ["jun", 6], ["june", 6],
    ["jul", 7], ["july", 7],
    ["au", 8], ["aug", 8], ["august", 8],
    ["sep", 9], ["sept", 9], ["september", 9],
    ["oc", 10], ["oct", 10], ["october", 10],
    ["no", 11], ["nov", 11], ["november", 11],
    ["de", 12], ["dec", 12], ["december", 12],
    ["now", 0], ["today", 0]
]);
const MONTH_RULES: Map<number, number> = new Map([
    [1, 31], [2, 28], [3, 31], [4, 30], [5, 31], [6, 30], [7, 31], [8, 31], [9, 30], [10, 31], [11, 30], [12, 31]
]);

function convertTo24Hour(hour: number, period: "am" | "pm"): number {
    if (period === "pm" && hour !== 12) {
        return hour + 12
    }
    if (period === "am" && hour === 12) {
        return 0
    }
    return hour
}

interface ParsedRangeTime {
    timeInMinutes: number
    period: "am" | "pm" | undefined
}

function parseRangeTime(time: string): ParsedRangeTime {
    let timeWithoutPeriod = time.trim().toLowerCase()
    let period: "am" | "pm" | undefined

    //The range regex has already validated the time, so finding an "a" or "p" is enough to tell whether an AM/PM suffix is present.
    const amIndex = timeWithoutPeriod.indexOf("a")
    const pmIndex = timeWithoutPeriod.indexOf("p")
    if (amIndex !== -1) {
        period = "am"
        timeWithoutPeriod = timeWithoutPeriod.substring(0, amIndex).trim()
    } else if (pmIndex !== -1) {
        period = "pm"
        timeWithoutPeriod = timeWithoutPeriod.substring(0, pmIndex).trim()
    }

    //Support both 4:30pm and 4.30pm, while keeping the same split approach.
    const timeParts = timeWithoutPeriod.includes(":")
        ? timeWithoutPeriod.split(":")
        : timeWithoutPeriod.split(".")
    let hour = Number(timeParts[0])
    const minute = Number(timeParts[1] ?? "00")
    if (period) {
        hour = convertTo24Hour(hour, period)
    }

    return {
        timeInMinutes: hour * 60 + minute,
        period
    }
}

function formatMinutesAsTime(timeInMinutes: number): string {
    const hour = Math.floor(timeInMinutes / 60)
    const minute = timeInMinutes % 60

    return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`
}

interface ParsedDateEndpoint {
    month: number,
    day: number,
    isNow: boolean
}

// since sept 30 or 30 sept work, input params: sept 30: monthfirst_month = sept. monthfirst_day = 30. others are undef
function normalizeDateInput(monthFirst_Month: string | undefined,
                            monthFirst_Day: string | undefined,
                            dayFirst_Day: string | undefined,
                            dayFirst_Month: string | undefined,
                            now: string | undefined): ParsedDateEndpoint | undefined {
    if (now) {
        const currentDate = new Date()
        return {
            month: currentDate.getMonth() + 1,
            day: currentDate.getDate(),
            isNow: true
        }
    }

    //Put both "Sep 30" and "30 Sep" back into the month/day order used by the rest of the extractor.
    const monthText = (monthFirst_Month ?? dayFirst_Month)?.toLowerCase()
    const dayText = monthFirst_Day ?? dayFirst_Day
    if (!monthText || !dayText) return

    const month = MONTH_ALIASES.get(monthText)
    if (month === undefined || month === 0) return

    return {
        month,
        day: Number(dayText),
        isNow: false
    }
}

function extractDates(title: string, selectedStartDate?: string): [string, string, string, boolean] | undefined {
    //actual month strings are checked after matching, so this only scans for possible month-word lengths
    //Each endpoint has five captures: month/day, day/month, or now.
    const dateEndpointPattern = String.raw`(?:(?!now\b)(?:([a-z]{2,9})\.?(?![a-z])\s*(0?[1-9]|[12]\d|3[01])(?!\d)|(0?[1-9]|[12]\d|3[01])(?!\d)\s*([a-z]{2,9})\.?(?![a-z]))|(\bnow\b))`;
    const dateRangePattern = new RegExp(String.raw`(?:from\s+)?${dateEndpointPattern}\s*(?:-|to|until|through|till|up to)\s*${dateEndpointPattern}`, "i");
    const dateRangeMatch = title.match(dateRangePattern);
    if (dateRangeMatch) {
        const start = normalizeDateInput(dateRangeMatch[1], dateRangeMatch[2], dateRangeMatch[3], dateRangeMatch[4], dateRangeMatch[5])
        const end = normalizeDateInput(dateRangeMatch[6], dateRangeMatch[7], dateRangeMatch[8], dateRangeMatch[9], dateRangeMatch[10])
        if (!start || !end) return // no actual months found

        const startMonth = start.month
        const endMonth = end.month
        const startDay = start.day
        const endDay = end.day
        const startMonthMaxDays = MONTH_RULES.get(startMonth)
        const endMonthMaxDays = MONTH_RULES.get(endMonth)
        if (startMonthMaxDays === undefined || endMonthMaxDays === undefined) return

        if (startDay > endDay && startMonth == endMonth) return // evil user input
        if (startDay > startMonthMaxDays || endDay > endMonthMaxDays) return //more evil user input

        //assume if startMonth > EndMonth, its like end of year (dec-feb). TODO: implement better flexibility: select year possibility
        const startDate = String(startMonth).padStart(2, "0") + "-" + String(startDay).padStart(2, "0")
        const endDate = String(endMonth).padStart(2, "0") + "-" + String(endDay).padStart(2, "0")
        return [startDate, endDate, dateRangeMatch[0], start.isNow]
    }
    //no date range found. attempt "until {date}" format
    const untilDatePattern = new RegExp(String.raw`(?:until|till|up to)\s+${dateEndpointPattern}`, "i")
    const untilDateMatch = title.match(untilDatePattern)
    if (untilDateMatch) {
        const end = normalizeDateInput(untilDateMatch[1], untilDateMatch[2], untilDateMatch[3], untilDateMatch[4], untilDateMatch[5])
        if (!end || end.isNow) return
        const endMonthMaxDays = MONTH_RULES.get(end.month)
        if (endMonthMaxDays === undefined || end.day > endMonthMaxDays) return
        let date: Date;
        if (selectedStartDate === undefined) {// no event start supplied, so use the current date
            date = new Date()
        } else { //until interpreted as "this event's starting time to specified end time"
            date = new Date(selectedStartDate + "T00:00:00")
        } //TODO: fix time issue of "until" for month view: until date sets starttime to current time

        const startDate = String(date.getMonth() + 1).padStart(2, "0") + "-" + String(date.getDate()).padStart(2, "0")
        const endDate = String(end.month).padStart(2, "0") + "-" + String(end.day).padStart(2, "0")
        return [startDate, endDate, untilDateMatch[0], true]
    }

}

export const simpleTimeLocationExtractor = (title: string, timeModified: boolean,
                                            locationModified: boolean, selectedStartDate: string, startTime: number): TitleExtractionResult => {
    let rangeInProgress = false
    let returnTime = ""
    let returnEndTime = ""
    let returnDate = ""
    let returnEndDate = ""
    let returnLocation = ""
    let returnTitle = title
    let timeRangeExtracted = false
    let dateRangeExtracted = false
    let requiresConfirmation = false
    //try time range
    if (/\b(?:to|until|till|up to)\b|-/i.test(title)) rangeInProgress = true
    //TODO: assume end range: sept 3-8 (not sept 3 to sept 8) or 3-8 sept

    const timePattern = String.raw`(?:(?:0?[1-9]|1[0-2])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)|(?:[01]?\d|2[0-3])(?:[.:][0-5]\d)?)`
    const timeRangePattern = new RegExp(String.raw`(?:from\s+)?(?:at\s+)?(?<!\w)(${timePattern})\s*(?:-|to|until|till|up to)\s*(${timePattern})(?!\w)`, "i")
    const malformedTimeRangePattern = /(?:(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w)\s*(?:-|to|until|till|up to)|(?:-|to|until|till|up to)\s*(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w))/i
    const timeRangeRejected = malformedTimeRangePattern.test(title)
    const timeRangeMatch = timeRangeRejected ? null : title.match(timeRangePattern)
    const nowToTimePattern = new RegExp(String.raw`(?:\b(?:until|till)\s+|\bnow\s+to\s+)(${timePattern})(?![\w:])`, "i")
    const nowToTimeMatch = title.match(nowToTimePattern)
    if (nowToTimeMatch && !timeRangeMatch) {
        const currentDate = new Date()
        const parsedEndTime = parseRangeTime(nowToTimeMatch[1])
        const currentTimeInMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()
        const startsExplicitlyNow = /^now\b/i.test(nowToTimeMatch[0])
        timeRangeExtracted = true
        returnTime = formatMinutesAsTime(startsExplicitlyNow ? currentTimeInMinutes : (startTime ?? currentTimeInMinutes))
        returnEndTime = formatMinutesAsTime(parsedEndTime.timeInMinutes)
        returnTitle = returnTitle.replace(nowToTimeMatch[0], "").replace(/\s+/g, " ").trim()
    }

    if (timeRangeMatch && !timeRangeExtracted) {
        timeRangeExtracted = true;
        const parsedStartTime = parseRangeTime(timeRangeMatch[1])
        const parsedEndTime = parseRangeTime(timeRangeMatch[2])
        let startTimeMinutes = parsedStartTime.timeInMinutes
        let endTimeMinutes = parsedEndTime.timeInMinutes

        if (endTimeMinutes < startTimeMinutes) { //example: 6am-1 (pm assumed)
            const endHour = Math.floor(endTimeMinutes / 60)
            const endMinute = endTimeMinutes % 60
            const newEndHour = convertTo24Hour(endHour, "pm")
            endTimeMinutes = newEndHour * 60 + endMinute
        }

        if (parsedStartTime.period === undefined && parsedEndTime.period === "pm") {
            //first time's period not specified, and hour + 12 < endTime: assume they meant both pm
            const startTimeMinutesAdd12h = startTimeMinutes + 12 * 60
            if (startTimeMinutesAdd12h < endTimeMinutes) {
                startTimeMinutes = startTimeMinutesAdd12h
            }
        }

        returnTime = formatMinutesAsTime(startTimeMinutes)
        returnEndTime = formatMinutesAsTime(endTimeMinutes)
        returnTitle = returnTitle.replace(timeRangeMatch[0], "").replace(/\s+/g, " ").trim();
    }
    //try date range
    let extractedtext = "";
    let dateRangeStartsNow = false;
    const extractedDates = extractDates(title, selectedStartDate)
    if (extractedDates) {
        [returnDate, returnEndDate, extractedtext, dateRangeStartsNow] = extractedDates
    }
    const currentYear = new Date().getFullYear() //TODO: eventually depend on clicked date's year, not current year
    if (returnDate !== "" && returnEndDate !== "") {
        if (returnEndDate < returnDate) { //end before start? prob extending into next year
            returnEndDate = currentYear + 1 + '-' + returnEndDate
        } else {
            returnEndDate = currentYear + '-' + returnEndDate
        }
        returnDate = currentYear + '-' + returnDate
        if (dateRangeStartsNow && !timeRangeExtracted) {
            const currentDate = new Date()
            const currentTimeInMinutes = currentDate.getHours() * 60 + currentDate.getMinutes()
            const startsExplicitlyNow = /^now\b/i.test(extractedtext)
            returnTime = formatMinutesAsTime(startsExplicitlyNow ? currentTimeInMinutes : (startTime ?? currentTimeInMinutes))
            returnEndTime = "00:00"
            timeRangeExtracted = true
        }
    }
    returnTitle = returnTitle.replace(extractedtext, "").replace(/\s+/g, " ").trim();

    //TODO: combine an end time and date (3pm aug 30 or aug 30 3pm)
    //try 1 time only
    if (!timeModified && !timeRangeExtracted && !timeRangeRejected) {
        if ((/\bnoon\b/i).test(title) || (/\bmidnight\b/i).test(title)) {
            if ((/\bnoon\b/i).test(title) && !(/\bmidnight\b/i).test(title)) {
                returnTime = "12:00";
                returnTitle = returnTitle
                    .replace(/(?:\bat\s*|@\s*)?\bnoon\b/i, "")
                    .replace(/\s+/g, " ")
                    .trim();
            } else if (!(/\bnoon\b/i).test(title) && (/\bmidnight\b/i).test(title)) {
                returnTime = "00:00";
                returnTitle = returnTitle
                    .replace(/(?:\bat\s*|@\s*)?\bmidnight\b/i, "")
                    .replace(/\s+/g, " ")
                    .trim();
            }
        }
        //not noon or midnight
        else {
            //find 12h time format
            let foundtime = false

            const twelveHourTime = title.match(
                /(?:\bat\s*|@\s*)?\b(0?[1-9]|1[0-2])(?:[.:]([0-5][0-9]))?\s*(am|pm)\b/i
            );
            if (twelveHourTime) {
                const matchedText = twelveHourTime[0]; //remove matched text from title
                returnTitle = returnTitle
                    .replace(matchedText, "")
                    .replace(/\s+/g, " ")
                    .trim();

                foundtime = true;
                let hour = Number(twelveHourTime[1]);
                const minute = twelveHourTime[2] ?? "00";
                const period = twelveHourTime[3].toLowerCase() as "am" | "pm";

                hour = convertTo24Hour(hour, period)
                returnTime = String(hour).padStart(2, "0") + ":" + minute;
                if (hour + 1 >= 24) {
                    hour = 0;
                }

            } //try searching for 24h time format without explicit am/pm
            if (!foundtime) {
                const twentyFourHourTime = title.match(
                    /\b((1[3-9]|2[0-3]):([0-5][0-9]))\b|(?:\bat|@)\s*(1[3-9]|2[0-3])(?::([0-5][0-9]))?\b/i);
                if (twentyFourHourTime) {
                    const matchedText = twentyFourHourTime[0];//remove matched text from title
                    returnTitle = returnTitle
                        .replace(matchedText, "")
                        .replace(/\s+/g, " ")
                        .trim();

                    let hour: number;
                    let minute: string;
                    if (twentyFourHourTime[2] !== undefined) {
                        // matched HH:MM
                        hour = Number(twentyFourHourTime[2]);
                        minute = twentyFourHourTime[3];
                    } else {
                        // matched an "at"/"@" time, with optional minutes
                        hour = Number(twentyFourHourTime[4]);
                        minute = twentyFourHourTime[5] ?? "00";
                    }
                    returnTime = String(hour).padStart(2, "0") + ":" + minute;

                } else {
                    const lastTimeAttempt = title.match(
                        /\b((@?0?\d|1[0-2]):([0-5][0-9])|(at|@)\s?(0?\d|1[0-2]))\b/i);
                    //TODO: prompt user with pop up to select am/pm or cancel
                    //found time, but unsure of the time (am/pm)
                    //remeber to remove matched text from title
                }
            }

        }

    }
    if (!locationModified) {
        //TODO
    }
    return {
        returnTitle,
        startDate: returnDate,
        endDate: returnEndDate,
        startTime: returnTime,
        endTime: returnEndTime,
        requiresConfirmation: false,
        location: returnLocation,
        rangeInProgress: rangeInProgress
    }
}
