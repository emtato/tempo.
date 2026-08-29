import {useState} from "react";

interface DatePickerProps {
    date: Date; //selected Date
    onChange: (date: Date, startOrEnd: "start" | "end") => void; //callback send info back to eventdetails.tsx
    ariaLabel: "start" | "end"; //start date picker or end date picker
    disableDatesBefore?: Date; //for end date selection. dates before start date should not be selectable
}

function format(date: Date, setting: "title" | "day") {
    if (setting === "title") return date.toLocaleDateString(undefined, {month: "long", year: "numeric"})
    return date.toLocaleDateString(undefined, {day: "numeric"})
}

export default function DatePicker(props: DatePickerProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [displayedMonth, setDisplayedMonth] = useState(() => new Date(props.date.getFullYear(), props.date.getMonth(), 1))
    const options = generateDateOptions(displayedMonth)

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
        setDisplayedMonth(new Date(props.date.getFullYear(), props.date.getMonth(), 1)) //reinitialize displayed month to new prop value
        setIsOpen(true)
    }

    function dateSelected(newDate: Date) {
        setIsOpen(false);
        props.onChange(newDate, props.ariaLabel);
    }

    function nextMonth() {
        const newDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() + 1, 1);
        setDisplayedMonth(newDate);
    }

    function previousMonth() {
        const newDate = new Date(displayedMonth.getFullYear(), displayedMonth.getMonth() - 1, 1);
        setDisplayedMonth(newDate);
    }

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
                    <div className="date-picker-header">
                        <span className="date-picker-month-title">
                            {format(displayedMonth, "title")}
                        </span>

                        <div className="date-picker-navigation">
                            <button className="date-picker-navigation-button" type="button"
                                    aria-label="Previous month" onClick={previousMonth}>‹</button>
                            <button className="date-picker-navigation-button" type="button"
                                    aria-label="Next month" onClick={nextMonth}>›</button>
                        </div>
                    </div>
                    {options.map((date) => (
                        <button
                            type="button"
                            key={date.getTime()}
                            disabled={props.disableDatesBefore !== undefined && date < props.disableDatesBefore} //disable dates for end selector
                            className="date-option-button"
                            onClick={() => dateSelected(date)}>
                            {format(date, "day")}</button>
                    ))}
            </span>)}
        </span>
    );
}
