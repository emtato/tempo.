import {useEffect, useState} from "react";
import {useRef} from "react";

interface TimeComboBoxProps {
    value: number; //confirmed time in minutes after midnight
    options: number[];
    onChange: (minutes: number) => void; //sends confirmed val backto eventdets. (onChange is the passed function "handleStartTimeChange")
    ariaLabel: string; //starttime or endtime field
    ampm: "AM" | "PM";
}

function formatTime(minutesAfterMidnight: number, addAMPM: boolean): string {
    const hour24 = Math.floor(minutesAfterMidnight / 60);
    const minutes = minutesAfterMidnight % 60;
    const hour12 = hour24 % 12 || 12;
    const AMPM = hour24 < 12 ? "AM" : "PM";
    if (minutesAfterMidnight === 24 * 60) return (
        addAMPM ? "12:00 AM" : "12:00"
    )
    if (!addAMPM) return `${hour12}:${String(minutes).padStart(2, "0")}`;
    return `${hour12}:${String(minutes).padStart(2, "0")} ${AMPM}`;
}

function turntoMinutes(time: string, AMPM: string) {
    const [hour, minute] = time.split(":").map(Number);
    if (AMPM === "PM" && hour !== 12) {
        return hour * 60 + minute + 12 * 60;
    } else if (AMPM === "AM" && hour === 12) {
        return minute;
    }
    return hour * 60 + minute;
}

//only allow certain inputs into the time input
function filterTimeInput(previous: string, next: string): string {
    if (next === "") return "";
    //delete hour case
    const previousColonIndex = previous.indexOf(":");
    const nextColonIndex = next.indexOf(":");

    if (previousColonIndex !== -1 && nextColonIndex !== -1) {
        const previousHour = previous.slice(0, previousColonIndex);
        const nextHour = next.slice(0, nextColonIndex);

        const hourWasShortened = nextHour.length < previousHour.length;

        if (hourWasShortened) {
            const remainingPrefixIsUnchanged = previousHour.startsWith(nextHour);

            return remainingPrefixIsUnchanged ? nextHour : "";
        }
    }

    const isDeletingColon = previous.endsWith(":") && next === previous.slice(0, -1);

    // Reject letters, spaces, and multiple colons
    if (!/^\d*:?\d*$/.test(next)) return previous;

    const [hourText, minuteText] = next.split(":");

    if (hourText.length > 2 || minuteText?.length > 2) {
        return previous;
    }

    // the hour must be complete and valid
    const hourIsComplete =
        minuteText !== undefined || // A colon exists: "1:"
        hourText.length === 2 ||    // Two-digit hour: "12"
        /^[2-9]$/.test(hourText);   // Complete one-digit hour: "4"

    if (hourIsComplete) {
        const hour = Number(hourText);

        if (hour < 1 || hour > 12) return previous;
    }
    if (minuteText !== undefined && minuteText.length >= 1 && Number(minuteText[0]) > 5) {
        return previous;
    }

    const isCompleteHour = /^[2-9]$/.test(hourText) || /^0[1-9]$/.test(hourText) || /^1[0-2]$/.test(hourText);

    if (!isDeletingColon && minuteText === undefined && isCompleteHour) {
        return `${hourText}:`; //add colon automatically
    }

    return next;
}

function periodDetectionToMinutesAfterMidnight(time: string): number | null {
    const potentialperiod = time.slice(-1).toLowerCase();

    if (potentialperiod !== "a" && potentialperiod !== "p") {
        return null;
    }

    const period = potentialperiod == "a" ? "AM" : "PM";
    const timeWithoutMarker = time.slice(0, -1);
    const validHour = "(?:[1-9]|0[1-9]|1[0-2])"; //need t ovalidate since this happens before filterinput can catch it
    const hourOnlyPattern = new RegExp(`^(${validHour}):?$`);
    const completeTimePattern = new RegExp(`^(${validHour}):([0-5]\\d)$`);

    const hourOnlyMatch = timeWithoutMarker.match(hourOnlyPattern);
    if (hourOnlyMatch) {
        return turntoMinutes(`${hourOnlyMatch[1]}:00`, period);
    }

    const completeTimeMatch = timeWithoutMarker.match(completeTimePattern);
    if (completeTimeMatch) {
        return turntoMinutes(`${completeTimeMatch[1]}:${completeTimeMatch[2]}`, period);
    }

    return null;
}

export default function TimeComboBox(props: TimeComboBoxProps) {
    const [draftText, setDraftText] = useState(formatTime(props.value, false));
    const [isOpen, setIsOpen] = useState(false);
    const targetTimeRef = useRef<HTMLButtonElement | null>(null);

    useEffect(() => { //update displayed time when parent changes time using combo box selection
        setDraftText(formatTime(props.value, false));
    }, [props.value]);

    useEffect(() => {
        if (isOpen) {
            targetTimeRef.current?.scrollIntoView({
                block: "start",
                inline: "nearest",
            });
        }

    }, [isOpen]);

    function timeSelected(time: number) {
        setIsOpen(false);
        props.onChange(time);
    }

    function submitDraftText() { //if user leaves/press enter after
        const incompleteTimeMatch = draftText.match(/^([1-9]|0[1-9]|1[0-2]):?([0-5])?$/);

        if (!incompleteTimeMatch) return;

        const hour = incompleteTimeMatch[1];
        const minuteTens = incompleteTimeMatch[2];
        const completedTime = `${hour}:${minuteTens ?? "0"}0`;

        setDraftText(completedTime);
        props.onChange(turntoMinutes(completedTime, props.ampm));
    }

    return (
        <span className="time-combobox-wrapper"
              onBlur={(event) => {
                  const nextFocusedElement = event.relatedTarget;

                  if (!event.currentTarget.contains(nextFocusedElement as Node)) {
                      submitDraftText();
                      setIsOpen(false);
                      setDraftText(formatTime(props.value, false))
                  }
              }}>
            <input className="time-combobox-input"
                   type="text"
                   aria-label={props.ariaLabel}
                   value={draftText}
                   onChange={(event) => { //update displayed time when user types time in

                       const proposedText = event.target.value; //detect a/p ending to modify AMPM toggle
                       const requestedPeriod = proposedText.slice(-1).toLowerCase();

                       if (requestedPeriod === "a" || requestedPeriod === "p") {
                           const minutesAfterMidnight = periodDetectionToMinutesAfterMidnight(proposedText);

                           if (minutesAfterMidnight === null) return;

                           setDraftText(formatTime(minutesAfterMidnight, false));
                           props.onChange(minutesAfterMidnight); //update parent on new time selectionx
                           return;//return to not put this (inclusion of a/p) in draftext
                       }

                       const nextDraft = filterTimeInput(draftText, event.target.value);
                       setDraftText(nextDraft);
                       const isCompleteTime = /^\d{1,2}:\d{2}$/.test(nextDraft);

                       if (!isCompleteTime) return;

                       props.onChange(turntoMinutes(nextDraft, props.ampm));
                   }}
                   onClick={() => {
                       setIsOpen(true)
                       setDraftText("")
                   }}

                   onKeyDown={(event) => { //confirm typed time and close dropdown when enter press
                       if (event.key === "Enter" && isOpen) {
                           event.preventDefault(); //prevent it from saving event (default action from enter)
                           event.stopPropagation();
                           setDraftText(formatTime(props.value, false))
                           submitDraftText();
                           setIsOpen(false);
                       }
                   }}


            />
            {isOpen && (
                <span className="time-combobox-dropdown">
                   {props.options.map((time) => ( //map start/endtime options into butotns
                       <button
                           type="button"
                           className="time-option-button"
                           ref={time === 9 * 60 ? targetTimeRef : undefined}
                           onClick={() => timeSelected(time)}
                           key={time}
                       >
                           {formatTime(time, true)/*displayed value on button}*/}
                       </button>
                   ))}
            </span>)
            }
</span>
    )
        ;
}
