//extracts location if title contains home or work
//extracts time if title contains time in the following formats
// XPM, X PM, X.XXPM, X.XX PM, X:XXPM X:XX PM, 0:XX, 13-23:XX, noon, midnight

//also extracts time and date ranges
//return time in 24h format

const convertTo24Hour = (hour: number, period: "am" | "pm"): number => {
    if (period === "pm" && hour !== 12) {
        return hour + 12
    }
    if (period === "am" && hour === 12) {
        return 0
    }
    return hour
}

const formatRangeTime = (time: string): string => {
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
    const minute = timeParts[1] ?? "00"

    if (period) {
        hour = convertTo24Hour(hour, period)
    }

    return `${String(hour).padStart(2, "0")}:${minute}`
}

export const simpleTimeLocationExtractor = (title: string, timeModified: boolean,
                                            locationModified: boolean): [string, string, string, string] => {

    let returnTime = ""
    let returnEndTime = ""
    let returnDate = ""
    let returnEndDate = ""
    let returnLocation = ""
    let returnTitle = title
    let timeRangeExtracted = false
    let dateRangeExtracted = false
    //try time range
    const timeRangePattern = /(?<!\w)((?:(?:0?[1-9]|1[0-2])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)|(?:[01]?\d|2[0-3])(?:[.:][0-5]\d)?))\s*(?:-|to)\s*((?:(?:0?[1-9]|1[0-2])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)|(?:[01]?\d|2[0-3])(?:[.:][0-5]\d)?))(?!\w)/i;
    const malformedTimeRangePattern = /(?:(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w)\s*(?:-|to)|(?:-|to)\s*(?<!\w)(?:0|1[3-9]|2[0-3])(?:[.:][0-5]\d)?\s*[ap](?:\.?m\.?)(?!\w))/i
    const timeRangeRejected = malformedTimeRangePattern.test(title)
    const timeRangeMatch = timeRangeRejected ? null : title.match(timeRangePattern);
    if (timeRangeMatch) {
        timeRangeExtracted = true;
        returnTime = formatRangeTime(timeRangeMatch[1])
        returnEndTime = formatRangeTime(timeRangeMatch[2])
         returnTitle = returnTitle.replace(timeRangeMatch[0], "").replace(/\s+/g, " ").trim();
    }
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
    return [returnTime, returnEndTime, returnLocation, returnTitle]
}
