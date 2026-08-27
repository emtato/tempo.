import {useEffect, useState} from "react";
import {useRef} from "react";

interface DatePickerProps {
    value: Date; //selected Date
    onChange: (date: Date) => void; //callback send info back to eventdetails.tsx
    ariaLabel: string; //start date picker or end date picker
    startMonth: Date //default month to display (according to which month the event popup was triggered by
}


export default function DatePicker(props: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<Date[]>([]);
    generateTimeOptions(props.startMonth);

    function generateTimeOptions(dateOfMonth: Date) {
        const firstOfMonth = new Date(dateOfMonth.getFullYear(), dateOfMonth.getMonth(), 1);
        const daysBefore = firstOfMonth.getDay(); //get day of week to start generating options from the closest sunday before first of month
        const gridStartDate = new Date(firstOfMonth.setDate(firstOfMonth.getDate() - daysBefore));

        const lastOfMonth = new Date(dateOfMonth.getFullYear(), dateOfMonth.getMonth() + 1, 0);
        const daysAfter = 6 - lastOfMonth.getDay() //get days after this date until saturday (last column)
        const gridEndDate = new Date(lastOfMonth.setDate(lastOfMonth.getDate() + daysAfter));
        const dateOptions = [];
        for (let currentDate = gridStartDate; currentDate <= gridEndDate; currentDate.setDate(currentDate.getDate() + 1)) {
            dateOptions.push(new Date(currentDate));
        }
        setOptions(dateOptions);
    }

    function dateSelected(date: Date) {
        setIsOpen(false);
        props.onChange(date);
    }

    return (<span className="DatePicker"
                  onBlur={(event) => { //lose focus
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                          setIsOpen(false);
                      }
                  }}>
            {isOpen && (
                <span className="datepicker-dropdown">
                {options.map((time) => (
                    <button
                        type="button"
                        className="time-option-button"
                        onClick={() => dateSelected(time)}
                    >
                    </button>
                ))}
            </span>)}
        </span>
    );
}
