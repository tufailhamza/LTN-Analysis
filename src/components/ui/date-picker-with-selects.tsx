import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";
import { format, setMonth as setMonthDate, setYear, startOfMonth } from "date-fns";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type DatePickerWithSelectsProps = React.ComponentProps<typeof DayPicker>;

const months = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// Generate years from 2010 to current year + 1
const getYears = () => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = 2010; year <= currentYear + 1; year++) {
    years.push(year);
  }
  return years.reverse(); // Most recent first
};

function DatePickerWithSelects({
  className,
  classNames,
  showOutsideDays = true,
  selected,
  onSelect,
  ...props
}: DatePickerWithSelectsProps) {
  const [month, setMonth] = React.useState<Date>(
    selected ? startOfMonth(selected) : startOfMonth(new Date())
  );

  // Sync month state when selected date changes externally
  React.useEffect(() => {
    if (selected) {
      setMonth(startOfMonth(selected));
    }
  }, [selected]);

  const handleMonthChange = (monthIndex: string) => {
    const newMonth = setMonthDate(month, parseInt(monthIndex));
    setMonth(newMonth);
  };

  const handleYearChange = (year: string) => {
    const newMonth = setYear(month, parseInt(year));
    setMonth(newMonth);
  };

  const handleDaySelect = (date: Date | undefined) => {
    if (date) {
      setMonth(startOfMonth(date));
    }
    if (onSelect) {
      onSelect(date);
    }
  };

  return (
    <div className={cn("p-3", className)}>
      {/* Month and Year Selectors */}
      <div className="flex gap-2 mb-4">
        <Select
          value={month.getMonth().toString()}
          onValueChange={handleMonthChange}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue>{format(month, "MMMM")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {months.map((monthName, index) => (
              <SelectItem key={index} value={index.toString()}>
                {monthName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={month.getFullYear().toString()}
          onValueChange={handleYearChange}
        >
          <SelectTrigger className="w-[100px]">
            <SelectValue>{format(month, "yyyy")}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {getYears().map((year) => (
              <SelectItem key={year} value={year.toString()}>
                {year}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Calendar */}
      <DayPicker
        month={month}
        onMonthChange={setMonth}
        selected={selected}
        onSelect={handleDaySelect}
        showOutsideDays={showOutsideDays}
        className="p-0"
        classNames={{
          months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
          month: "space-y-4",
          caption: "flex justify-center pt-1 relative items-center",
          caption_label: "text-sm font-medium",
          nav: "space-x-1 flex items-center",
          nav_button: cn(
            buttonVariants({ variant: "outline" }),
            "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          ),
          nav_button_previous: "absolute left-1",
          nav_button_next: "absolute right-1",
          table: "w-full border-collapse space-y-1",
          head_row: "flex",
          head_cell:
            "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem]",
          row: "flex w-full mt-2",
          cell: "h-9 w-9 text-center text-sm p-0 relative [&:has([aria-selected].day-range-end)]:rounded-r-md [&:has([aria-selected].day-outside)]:bg-accent/50 [&:has([aria-selected])]:bg-accent first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md focus-within:relative focus-within:z-20",
          day: cn(
            buttonVariants({ variant: "ghost" }),
            "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
          ),
          day_range_end: "day-range-end",
          day_selected:
            "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground",
          day_today: "bg-accent text-accent-foreground",
          day_outside:
            "day-outside text-muted-foreground opacity-50 aria-selected:bg-accent/50 aria-selected:text-muted-foreground aria-selected:opacity-30",
          day_disabled: "text-muted-foreground opacity-50",
          day_range_middle:
            "aria-selected:bg-accent aria-selected:text-accent-foreground",
          day_hidden: "invisible",
          ...classNames,
        }}
        components={{
          IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
          IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
        }}
        {...props}
      />
    </div>
  );
}

DatePickerWithSelects.displayName = "DatePickerWithSelects";

export { DatePickerWithSelects };

