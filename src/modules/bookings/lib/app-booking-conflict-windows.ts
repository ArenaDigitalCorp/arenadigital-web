export interface BookingConflictInterval {
  courtId: string
  startTime: string
  endTime: string
}

export function buildBookingConflictWindows(intervals: BookingConflictInterval[]): BookingConflictInterval[] {
  const sorted = [...intervals].sort((left, right) =>
    left.courtId.localeCompare(right.courtId)
    || Date.parse(left.startTime) - Date.parse(right.startTime)
  )
  const windows: BookingConflictInterval[] = []

  for (const interval of sorted) {
    const previous = windows.at(-1)
    if (previous?.courtId === interval.courtId && Date.parse(interval.startTime) <= Date.parse(previous.endTime)) {
      if (Date.parse(interval.endTime) > Date.parse(previous.endTime)) {
        previous.endTime = interval.endTime
      }
    } else {
      windows.push({ ...interval })
    }
  }

  return windows
}
