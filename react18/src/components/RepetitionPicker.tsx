import React, {useState} from "react";
import {recurrence} from "../../../backend/src/domain/recurrence";

interface RepetitionPickerProps {
    onChange: (repetition: recurrence) => void; //callback send recurrence info back
    recurrenceSelection?: recurrence //will be modified by the popup and sent back when done to onchange
    options: recurrence[]; //options for simple repetition (based on date clicked, intelligently offer suggestions)
}

function optionSelected(option: string) {

}

function formatOptionsToText(option: recurrence): string {
    if (option.frequency == "daily" && Object.keys(option).length === 1) { //only frequency field exists
        return "Daily"
    }
    if (option.frequency == "month" && option.days != undefined && Object.keys(option).length == 2) {
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
                <span> test</span>
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
