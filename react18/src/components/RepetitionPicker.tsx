import React, {useState} from "react";
import {recurrence} from "../../../backend/src/domain/recurrence";

interface RepetitionPickerProps {
    onChange: (date: Date, startOrEnd: "start" | "end") => void; //callback send recurrence info back
    recurrenceSelection?: recurrence //will be modified by the popup and sent back when done to onchange
}


export default function RepetitionPicker() {
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

            {isOpen && (<span> opened</span>)}
                </span>
    );
}
