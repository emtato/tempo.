import React, {useState} from "react";
import {recurrence} from "../../../backend/src/domain/recurrence";

interface RepetitionPickerProps {
    onChange: (repetition: recurrence) => void; //callback send recurrence info back
    recurrenceSelection?: recurrence //will be modified by the popup and sent back when done to onchange
    options: recurrence[]; //options for simple repetition (based on date clicked, intelligently offer suggestions)
}

function optionSelected(option: string) {

}

const dayToWeekDayMap: Record<number, string> = {
    1: "Monday",
    2: "Tuesday",
    3: "Wednesday",
    4: "Thursday",
    5: "Friday",
    6: "Saturday",
    7: "Sunday",
}

function treatWeekRep(dayOfWeek: number[], other: boolean) {
    if (dayOfWeek.length > 1) {
        if (dayOfWeek.includes(1) && dayOfWeek.includes(2) && dayOfWeek.includes(3) && dayOfWeek.includes(4) && dayOfWeek.includes(5)) {
            return other ? 'Every other week\'s weekdays' : 'Every weekday'
        } else if (dayOfWeek.includes(6) && dayOfWeek.includes(7)) {
            return other ? 'Every other week\'s weekends' : 'Every weekend'
        } else {
            return other ? 'Every other ' + dayOfWeek.map(day => dayToWeekDayMap[day]).join(', ') : 'Every ' + dayOfWeek.map(day => dayToWeekDayMap[day]).join(', ')
        }
    }
    return other ? 'Every other ' + dayToWeekDayMap[(dayOfWeek)[0]] : 'Every ' + dayToWeekDayMap[(dayOfWeek)[0]]

}

function formatOptionsToText(option: recurrence): string {
    if (option.frequency == "daily" && Object.keys(option).length === 1) { //only frequency field exists: every day
        return "Daily"
    }
    if (option.frequency == 'daily' && option.skipInterval != undefined && Object.keys(option).length == 2) { //every x days
        if (option.skipInterval == 1) return "Every other day"
        return "Every " + option.skipInterval + " days"
    }
    if (option.frequency == 'weekly' && option.dayOfWeek != undefined && Object.keys(option).length == 2) { //every week, weekend, weekday
        return treatWeekRep(option.dayOfWeek, false)
    }
    if (option.frequency == 'weekly' && option.dayOfWeek != undefined && option.skipInterval != undefined && Object.keys(option).length == 3) { //every other week
        if (option.skipInterval == 1) return treatWeekRep(option.dayOfWeek, true)
        //TODO? (maybe)
    }
    if (option.frequency == "monthly" && option.days != undefined && Object.keys(option).length == 2) { //every month on the xth day
        const stringpart = "Every month on the "
        //assuming simple rules only for repetition picker, thus days list will only have 1 element.
        //unlike complex rules from ai parsed repetitions, which might have "every 2nd, 5th and 20th of the month"
        if (option.days[0] == 0) return stringpart + "1st"
        if (option.days[0] == 1) return stringpart + "2nd"
        if (option.days[0] == 2) return stringpart + "3rd"
        else return stringpart + (option.days[0] + 1) + "th"
    }
    if (option.frequency == "yearly" && option.days != undefined && Object.keys(option).length == 2) {
        return "Every Year"
    }
    return ""
}

export default function RepetitionPicker(props: RepetitionPickerProps) {
    const [isOpen, setIsOpen] = useState(false)


    return (<span className="DatePicker"
                  onBlur={(event) => { //lose focus
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                          setIsOpen(false);
                      }
                  }}>
            <button className="repeat-button" type="button" onClick={() => {
                setIsOpen(true)
            }}>Does not repeat</button>
            {/* TODO: connect repetition status of the event to what displas on the button*/}

            {isOpen && (<span className="repetition-menu">
                <span> IN CONSTRUCTION: not done implementation</span>
                {props.options.map((option) => (
                    <button
                        type="button"
                        //key={date.getTime()}
                        className="recurrence-option-button"
                        onClick={() => props.onChange(option)}>
                        {formatOptionsToText(option)}</button>
                ))}
            </span>)}
                </span>
    );
}
