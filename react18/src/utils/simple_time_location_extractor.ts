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

function extractDates(title: string) {
    const monthFirstDatePattern = String.raw`(?:(?!now\b)([a-z]{2,9})\s*(0?[1-9]|[12]\d|3[01])(?!\d)|(\bnow\b))`;
    const dateRangePattern = new RegExp(String.raw`(?:from\s+)?${monthFirstDatePattern}\s*(?:-|to|until|through)\s*${monthFirstDatePattern}`, "i");
    const dateRangeMatch = title.match(dateRangePattern);
    if (dateRangeMatch) {
        const startMonthText = (dateRangeMatch[1] ?? dateRangeMatch[3]).toLowerCase()
        const endMonthText = (dateRangeMatch[4] ?? dateRangeMatch[6]).toLowerCase()
        let startMonth = MONTH_ALIASES.get(startMonthText)
        let endMonth = MONTH_ALIASES.get(endMonthText)
        if (startMonth == undefined || endMonth == undefined) return // no actual months found

        let startDay = Number(dateRangeMatch[2])
        let endDay = Number(dateRangeMatch[5])
        const currentDate = new Date()

        if (startMonth == 0) { //set month and date to current values if its now
            startMonth = currentDate.getMonth() + 1
            startDay = currentDate.getDate()
        }
        if (endMonth == 0) {
            endMonth = currentDate.getMonth() + 1
            endDay = currentDate.getDate()
        }
        const startMonthMaxDays = MONTH_RULES.get(startMonth)
        const endMonthMaxDays = MONTH_RULES.get(endMonth)
        if (startMonthMaxDays === undefined || endMonthMaxDays === undefined) return

        if (startDay > endDay && startMonth == endMonth) return // evil user input
        if (startDay > startMonthMaxDays || endDay > endMonthMaxDays) return //more evil user input

        //assume if startMonth > EndMonth, its like end of year (dec-feb). TODO: implement better flexibility: select year possibility
        const startDate = String(startMonth).padStart(2, "0") + "-" + String(startDay).padStart(2, "0")
        const endDate = String(endMonth).padStart(2, "0") + "-" + String(endDay).padStart(2, "0")
        return [startDate, endDate, dateRangeMatch[0]]
    }

}

export const simpleTimeLocationExtractor = (title: string, timeModified: boolean,
                                            locationModified: boolean): TitleExtractionResult => {
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
    if (title.includes("to") || title.includes("-")) rangeInProgress = true

    const timeRangePattern = /(?:from\s+)?(?:at\s+)?(?<!\w)((?:(?:0?[1-9]|1[0-2])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)|(?:[01]?\d|2[0-3])(?:[.:][0-5]\d)?))\s*(?:-|to)\s*((?:(?:0?[1-9]|1[0-2])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)|(?:[01]?\d|2[0-3])(?:[.:][0-5]\d)?))(?!\w)/i;
    const malformedTimeRangePattern = /(?:(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w)\s*(?:-|to)|(?:-|to)\s*(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w))/i
    const timeRangeRejected = malformedTimeRangePattern.test(title)
    const timeRangeMatch = timeRangeRejected ? null : title.match(timeRangePattern);
    if (timeRangeMatch) {
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
    [returnDate, returnEndDate, extractedtext] = extractDates(title) ?? ["", "", ""]
    const currentYear = new Date().getFullYear() //TODO: eventually depend on clicked date's year, not current year
    if (returnDate !== "" && returnEndDate !== "") {
        if (returnEndDate < returnDate) { //end before start? prob extending into next year
            returnEndDate = currentYear + 1 + '-' + returnEndDate
        } else {
            returnEndDate = currentYear + '-' + returnEndDate
        }
        returnDate = currentYear + '-' + returnDate
    }
    returnTitle = returnTitle.replace(extractedtext, "").replace(/\s+/g, " ").trim();

    //TODO: logic regarding month "0" (today)
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
