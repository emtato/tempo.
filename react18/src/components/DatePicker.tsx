import {useEffect, useState} from "react";
import {useRef} from "react";

interface DatePickerProps {
    date: Date; //selected Date
    onChange: (date: Date, startOrEnd: "start" | "end") => void; //callback send info back to eventdetails.tsx
    ariaLabel: "start" | "end"; //start date picker or end date picker
}

function format(date: Date, setting: "title" | "day") {
    if (setting === "title") return date.toLocaleDateString(undefined, {month: "long", year: "numeric"})
    return date.toLocaleDateString(undefined, {day: "numeric"})
}

export default function DatePicker(props: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const options = generateDateOptions(props.date)

    function generateDateOptions(dateOfMonth: Date) {
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
        return dateOptions;
    }

    function openDropdown() {
        setIsOpen(true)
    }

    function dateSelected(date: Date) {
        setIsOpen(false);
        props.onChange(date, props.ariaLabel);
    }

    //TODO: if arrow clicked, date prop should change to reflect the new month's first date
    return (<span className="DatePicker"
                  onBlur={(event) => { //lose focus
                      if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                          setIsOpen(false);
                      }
                  }}>
            <button type="button" className="date-picker-trigger-button"
                    onClick={openDropdown}>{props.date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "long",
                day: "numeric",
            })}</button>
            {isOpen && (
                <span className="datepicker-dropdown">
                    <span className="date-picker-month-title">{format(props.date, "title")}</span>
                    {options.map((date) => (
                        <button
                            type="button"
                            className="date-option-button"
                            onClick={() => dateSelected(date)}>
                            {format(date, "day")}</button>
                    ))}
            </span>)}
        </span>
    );
}
