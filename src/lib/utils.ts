// src/lib/utils.ts
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const getTodayDate = (): string => {
  const now = new Date();
  const options: Intl.DateTimeFormatOptions = {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  };
  const formatter = new Intl.DateTimeFormat("en-CA", options);
  return formatter.format(now);
};

export const getLaMidnightUtc = (laDateString: string): Date => {
  const localDateStr = `${laDateString}T00:00:00`;
  const offsetString = formatInTimeZone(new Date(localDateStr), "America/Los_Angeles", "XXX");
  const laMidnightLocalISO = `${laDateString}T00:00:00${offsetString}`;
  return new Date(laMidnightLocalISO);
};