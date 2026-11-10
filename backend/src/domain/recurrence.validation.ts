//hi
// TODO: Validate recurrence rules from the event form and Gemini before saving them.
// Use frequency to decide which fields are required and which combinations are valid.
// Weekly rules need at least one weekday in 1–7. Sort and deduplicate the list
// before expansion so each gap moves the date forward.
// Check that skip intervals are nonnegative integers and that endDate is a valid date.
// Report missing or incompatible fields so the caller can return an error or retry Gemini.
