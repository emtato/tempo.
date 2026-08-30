import React, {useState} from "react";
import {recurrence} from "../../../backend/src/domain/recurrence";

interface RepetitionPickerProps {
    onChange: (date: Date, startOrEnd: "start" | "end") => void; //callback send recurrence info back
    recurrenceSelection?: recurrence //will be modified by the popup and sent back when done to onchange
    options: string[]; //options for simple repetition (based on date clicked, intelligently offer suggestions)
}

function optionSelected(option: string) {

}

function formatOptionsToText(option: string): string {


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
                        {props.options.map((option) => (
                            <button
                                type="button"
                                //key={date.getTime()}
                                className="date-option-button"
                                onClick={() => optionSelected(option)}>
                                {formatOptionsToText(option)}</button>
                        ))}
            </span>)}
                </span>
    );
}
