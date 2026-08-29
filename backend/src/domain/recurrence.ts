export interface recurrence {
    frequency: string; //daily, every week, every month, every year
    weekday?: number[] //if the recurrence depends on weekday instead of days, pick which weekday

    days?: number[] //nº of days after the beginning of the frequency unit: 0 days would be sunday for week, 1st of the month etc.
    skipInterval?: number; //if monthly: (monthly + skipinterval 1: every other month)  if weekly + weekday + skipint 2, every 3rd {weekday}
    position?: number[] //if positive: selects {position}th occurence of weekday. if negative, go backwards and select that occurence
    months?: number[] //if yearly, might need specific months: every march and may

    endDate?: string; //YYYY-MM-DD. all repetitions of this event end at or before this date
}

/*
examples:
• every other day:
    frequency: daily
    skipInterval: 1
• every other thursday:
    frequency: weekly
    weekday: thursday
    skipInterval: 1
•  the last thursday of every month
    frequency: monthly
    weekday: thursday
    position: -1
• every 3rd of the month
    frequency: monthly
    days: 2
 */
