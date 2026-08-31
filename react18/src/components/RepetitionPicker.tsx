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

function formatOptionsToText(option: recurrence): string {
    if (option.frequency == "daily" && Object.keys(option).length === 1) { //only frequency field exists
        return "Daily"
    }
    if (option.frequency == 'weekly' && option.dayOfWeek != undefined && Object.keys(option).length == 2) { //must be repeat wekly
        if(option.dayOfWeek.length > 1){
            if(option.dayOfWeek.includes(1) && option.dayOfWeek.includes(2) && option.dayOfWeek.includes(3) && option.dayOfWeek.includes(4) && option.dayOfWeek.includes(5)){
                return 'Every weekday'
            }
            else if(option.dayOfWeek.includes(6) && option.dayOfWeek.includes(7)){
                return 'Every weekend'
            }
            else{
                return 'Every ' + option.dayOfWeek.map(day => dayToWeekDayMap[day]).join(', ')
            }
        }
        return 'Every ' + dayToWeekDayMap[(option.dayOfWeek)[0]] + ''
    }
    if (option.frequency == "monthly" && option.days != undefined && Object.keys(option).length == 2) {
        const stringpart = "Every month on the "
        //assuming simple rules only for repetition picker, thus days list will only have 1 element.
        //unlike complex rules from ai parsed repetitions, which might have "every 2nd, 5th and 20th of the month"
        if (option.days[0] == 0) return stringpart + "1st"
        if (option.days[0] == 1) return stringpart + "2nd"
        if (option.days[0] == 2) return stringpart + "3rd"
        else return stringpart + (option.days[0] + 1) + "th"
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
