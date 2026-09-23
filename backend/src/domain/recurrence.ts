export interface recurrence {
    frequency: string; //daily, weekly, monthly, yearly
    dayOfWeek?: number[] //if the recurrence depends on weekday instead of days, pick which weekday. 1-7 numbered (mon first)

    days?: number[] //nº of days after the beginning of the frequency unit: 0 days would be sunday for week, 1st of the month etc. from end, -1 would be last day
    skipInterval?: number; //if monthly: (monthly + skipinterval 1: every other month)  if weekly + weekday + skipint 2, every 3rd {weekday}
    yearSkipInterval?: number; //if using year rules, there would need ot be 2 skipintervals
    position?: number //if positive: selects {position}th occurence of weekday. if negative, go backwards from last and select that occurence
    multiplePositions?: number[] //selecting all positions of options. positoin only selects one.
    months?: number[] //[0-11] if yearly, might need specific months: every march and may

    startDate: string //YYYY-MM-DD
    endDate?: string; //YYYY-MM-DD. all repetitions of this event end before this date (exclusive)
}

//dayOfWeek, days, position and months are lists because of rules like "last weekday of the month" -> would need to contain all week days and determine which one is the last

/* possible shapes for each frequency (to consider and properly implement all shapes)

daily: only skipInterval matters

weekly:
dayOfWeek: list of days of the week
skipInterval:  (skip n occurences of dayOfWeek)

monthly:
case 1: "last {dayofWeek}/{weekday/weekend} of the month" (can expand to more related shapes: 1st and 2nd dayOfWeek using multiplePositions: [1,2] for example)
-> dayOfWeek: list populated with the rules
-> position: -1 (last occurence of dayOfWeek) (expand: multiplePositions: [1,2])
-> optional: skipinterval -> last dayOfWeek of every x months

case 2: "every xth day of month"
-> days: list of days of the month
-> optional: skipinterval -> every xth day of every x months

case 3: "every {dayOfWeek} AND {daOfMonth}" (friday the 13th, 1st and 15th if they happen to be mondays or thursdays)
-> dayOfWeek: list of days of the week
-> days: list of days of the month
-> optional: skipinterval -> every xth day of every x occurences

yearly:
case 1: "every xth day of the year" (not day of month, but days since dec 31)
-> days: list of days of the year (if negative, go backwards)
-> optional: skipinterval -> every xth day of every n years

case 2: (same as case 1 monthly): 1st / 2nd / 3rd... / last / before last, etc {dayofWeek} of the year
-> dayOfWeek: list populated with the rules
-> position: -1 (last occurence of dayOfWeek) (can be 1-52 or -52 to -1)
-> optional: skipinterval -> last dayOfWeek of every n years

case 3: occurences within particular months:
-> months: list of months (0-11)
-> remaining rules: one of the cases 1-3 in monthly

case 4: occurences within particular month skipIntervals:
-> yearSkipInterval: 1-11
-> remaining rules: one of the cases 1-3 in monthly
 */
//design notes: "every 31st of the month" could DNE. will keep as such and not clamp down to the last day of the month,
// since that rule already exists as day: -1

//if leap year, 100th day of year would be different than 100th day of regular year. remember to take this into account.
//we will not keep "xth day of year" as a set date in a set month, since year case 3 already does this

//note to pick multiple dayOfWeek, (last monday AND tuesday AND wednesday of month, make 3 separate recurrence rules.
// dayOfWeek + position only picks 1: the one that matches the position condition best:
// if dayOfWeek is all weekdays, position -1 will pick th very last weekday, whichever weekday it is

// for rules like "every 1st and 3rd monday and thursday", normal dayOfWeek wont work, since
// as defined above, this combination should only pick the most suitable one.
//to get around this and allow for multiple picks, use multiplePositions?: number[] //selecting all positions of options. positoin only selects one.
/*difference:
rule with position:
position: 1
dayOfWeek: all weekdays
interpretation: select the first weekday of the month

rule with multiplePositions:
multiplePositions: [1,3]
dayOfWeek: monday and thursday
interpretation: 1st monday of month, 1st thursday of month, 3rd monday of month, 3rd thursday of month
 */
