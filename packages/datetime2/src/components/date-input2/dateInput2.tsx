/*
 * Copyright 2022 Palantir Technologies, Inc. All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import classNames from "classnames";
import { isValid } from "date-fns";
import * as React from "react";
import type { DayPickerProps } from "react-day-picker";

import {
    ButtonProps,
    DISPLAYNAME_PREFIX,
    InputGroup,
    InputGroupProps2,
    Intent,
    mergeRefs,
    Props,
    Tag,
} from "@blueprintjs/core";
import { DateFormatProps, DatePicker, DatePickerBaseProps, DatePickerShortcut } from "@blueprintjs/datetime";
import { Popover2, Popover2Props } from "@blueprintjs/popover2";

import * as Classes from "../../common/classes";
import { isDateValid, isDayInRange } from "../../common/dateUtils";
import { getCurrentTimezone } from "../../common/getTimezone";
import { getTimezoneName } from "../../common/timezoneNameUtils";
import {
    convertLocalDateToTimezoneTime,
    getDateObjectFromIsoString,
    getIsoEquivalentWithUpdatedTimezone,
} from "../../common/timezoneUtils";
import { TimezoneSelect } from "../timezone-select/timezoneSelect";

export interface DateInput2Props extends DatePickerBaseProps, DateFormatProps, Props {
    /**
     * Allows the user to clear the selection by clicking the currently selected day.
     * Passed to `DatePicker` component.
     *
     * @default true
     */
    canClearSelection?: boolean;

    /**
     * Text for the reset button in the date picker action bar.
     * Passed to `DatePicker` component.
     *
     * @default "Clear"
     */
    clearButtonText?: string;

    /**
     * Whether the calendar popover should close when a date is selected.
     *
     * @default true
     */
    closeOnSelection?: boolean;

    /** The default timezone selected. Defaults to the user local timezone */
    defaultTimezone?: string;

    /**
     * Whether to disable the timezone select.
     *
     * @default false
     */
    disableTimezoneSelect?: boolean;

    /**
     * The default date to be used in the component when uncontrolled, represented as an ISO string.
     */
    defaultValue?: string;

    /**
     * Whether the date input is non-interactive.
     *
     * @default false
     */
    disabled?: boolean;

    /**
     * Whether the component should take up the full width of its container.
     */
    fill?: boolean;

    /**
     * Props to pass to the [input group](#core/components/text-inputs.input-group).
     * `disabled` and `value` will be ignored in favor of the top-level props on this component.
     * `type` is fixed to "text".
     */
    inputProps?: Omit<InputGroupProps2, "disabled" | "type" | "value">;

    /**
     * Callback invoked whenever the date or timezone has changed.
     *
     * @param newDate ISO string or `null` (if the date is invalid or text input has been cleared)
     * @param isUserChange `true` if the user clicked on a date in the calendar, changed the input value,
     *     or cleared the selection; `false` if the date was changed by changing the month or year.
     */
    onChange?: (newDate: string | null, isUserChange?: boolean) => void;

    /**
     * Called when the user finishes typing in a new date and the date causes an error state.
     * If the date is invalid, `new Date(undefined)` will be returned. If the date is out of range,
     * the out of range date will be returned (`onChange` is not called in this case).
     */
    onError?: (errorDate: Date) => void;

    /**
     * The props to pass to the popover.
     */
    popoverProps?: Partial<
        Omit<
            Popover2Props,
            | "autoFocus"
            | "content"
            | "defaultIsOpen"
            | "disabled"
            | "enforceFocus"
            | "fill"
            | "renderTarget"
            | "targetTagName"
        >
    >;

    /**
     * Element to render on right side of input.
     */
    rightElement?: JSX.Element;

    /**
     * Whether the bottom bar displaying "Today" and "Clear" buttons should be shown below the calendar.
     *
     * @default false
     */
    showActionsBar?: boolean;

    /**
     * Whether to show the timezone select dropdown on the right side of the input.
     * If `timePrecision` is undefined, this will always be false.
     *
     * @default false
     */
    showTimezoneSelect?: boolean;

    /**
     * Whether shortcuts to quickly select a date are displayed or not.
     * If `true`, preset shortcuts will be displayed.
     * If `false`, no shortcuts will be displayed.
     * If an array is provided, the custom shortcuts will be displayed.
     *
     * @default false
     */
    shortcuts?: boolean | DatePickerShortcut[];

    /**
     * Text for the today button in the date picker action bar.
     * Passed to `DatePicker` component.
     *
     * @default "Today"
     */
    todayButtonText?: string;

    /** An ISO string representing the selected time. */
    value?: string | null;
}

const timezoneSelectButtonProps: Partial<ButtonProps> = {
    fill: false,
    minimal: true,
    outlined: true,
};

export const DateInput2: React.FC<DateInput2Props> = React.memo(function _DateInput2(props) {
    const {
        defaultTimezone,
        defaultValue,
        disableTimezoneSelect,
        inputProps = {},
        minDate = null,
        maxDate = null,
        placeholder,
        popoverProps = {},
        showTimezoneSelect,
        timePrecision,
        value,
        ...datePickerProps
    } = props;

    const [isOpen, setIsOpen] = React.useState(false);
    const [timezoneValue, setTimezoneValue] = React.useState(defaultTimezone ?? getCurrentTimezone());
    const valueFromProps = React.useMemo(
        () => getDateObjectFromIsoString(value, timezoneValue),
        [timezoneValue, value],
    );
    const defaultValueFromProps = React.useMemo(
        () => getDateObjectFromIsoString(defaultValue, timezoneValue),
        [defaultValue, defaultTimezone],
    );
    const [valueAsDate, setValue] = React.useState<Date | null>(
        valueFromProps !== undefined ? valueFromProps : defaultValueFromProps!,
    );
    const [selectedShortcutIndex, setSelectedShortcutIndex] = React.useState<number | undefined>(undefined);
    const [isInputFocused, setIsInputFocused] = React.useState(false);
    const [inputValue, setInputValue] = React.useState(value ?? null);

    const inputRef = React.useRef<HTMLInputElement | null>(null);
    const popoverContentRef = React.useRef<HTMLDivElement | null>(null);

    const handlePopoverClose = React.useCallback((e: React.SyntheticEvent<HTMLElement>) => {
        popoverProps.onClose?.(e);
        setIsOpen(false);
    }, []);

    const handleTimezoneChange = React.useCallback(
        (newTimezone: string) => {
            if (valueAsDate !== null) {
                setTimezoneValue(newTimezone);
                const newDateString = getIsoEquivalentWithUpdatedTimezone(valueAsDate, newTimezone, timePrecision);
                props.onChange?.(newDateString);
            }
        },
        [props.onChange, valueAsDate, timePrecision],
    );

    const handleDateChange = React.useCallback(
        (newDate: Date | null, isUserChange: boolean, didSubmitWithEnter = false) => {
            if (newDate === null) {
                props.onChange?.(null, isUserChange);
                return;
            }

            const prevDate = valueAsDate;

            // this change handler was triggered by a change in month, day, or (if
            // enabled) time. for UX purposes, we want to close the popover only if
            // the user explicitly clicked a day within the current month.
            const newIsOpen =
                !isUserChange ||
                !props.closeOnSelection ||
                (prevDate != null &&
                    (hasMonthChanged(prevDate, newDate) ||
                        (props.timePrecision !== undefined && hasTimeChanged(prevDate, newDate))));
            const newDateString = getIsoEquivalentWithUpdatedTimezone(newDate, timezoneValue, timePrecision);

            // if selecting a date via click or Tab, the input will already be
            // blurred by now, so sync isInputFocused to false. if selecting via
            // Enter, setting isInputFocused to false won't do anything by itself,
            // plus we want the field to retain focus anyway.
            // (note: spelling out the ternary explicitly reads more clearly.)
            const newIsInputFocused = didSubmitWithEnter ? true : false;

            if (valueFromProps === undefined) {
                setIsInputFocused(newIsInputFocused);
                setIsOpen(newIsOpen);
                setValue(newDate);
                setInputValue(newDateString);
            } else {
                setIsInputFocused(newIsInputFocused);
                setIsOpen(newIsOpen);
            }

            props.onChange?.(newDateString, isUserChange);
        },
        [props.onChange, timezoneValue, timePrecision],
    );

    const dayPickerProps: DayPickerProps = {
        ...props.dayPickerProps,
        onDayKeyDown: (day, modifiers, e) => {
            props.dayPickerProps?.onDayKeyDown?.(day, modifiers, e);
        },
        onMonthChange: (month: Date) => {
            props.dayPickerProps?.onMonthChange?.(month);
        },
    };

    const handleShortcutChange = React.useCallback((_: DatePickerShortcut, index: number) => {
        setSelectedShortcutIndex(index);
    }, []);

    const handleStartFocusBoundaryFocusIn = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        if (popoverContentRef.current?.contains(getRelatedTargetWithFallback(e))) {
            // Not closing Popover to allow user to freely switch between manually entering a date
            // string in the input and selecting one via the Popover
            inputRef.current?.focus();
        } else {
            getKeyboardFocusableElements(popoverContentRef).shift()?.focus();
        }
    }, []);

    const handleEndFocusBoundaryFocusIn = React.useCallback((e: React.FocusEvent<HTMLDivElement>) => {
        if (popoverContentRef.current?.contains(getRelatedTargetWithFallback(e))) {
            inputRef.current?.focus();
            handlePopoverClose(e);
        } else {
            getKeyboardFocusableElements(popoverContentRef).pop()?.focus();
        }
    }, []);

    // React's onFocus prop listens to the focusin browser event under the hood, so it's safe to
    // provide it the focusIn event handlers instead of using a ref and manually adding the
    // event listeners ourselves.
    const popoverContent = (
        <div ref={popoverContentRef}>
            <div onFocus={handleStartFocusBoundaryFocusIn} tabIndex={0} />
            <DatePicker
                {...datePickerProps}
                dayPickerProps={dayPickerProps}
                onChange={handleDateChange}
                value={valueAsDate}
                onShortcutChange={handleShortcutChange}
                selectedShortcutIndex={selectedShortcutIndex}
            />
            <div onFocus={handleEndFocusBoundaryFocusIn} tabIndex={0} />
        </div>
    );

    // we need a date which is guaranteed to be non-null here; if necessary, we use today's date and shift
    // it to the desired/current timezone
    const tzSelectDate = React.useMemo(
        () =>
            valueAsDate != null && isValid(valueAsDate)
                ? valueAsDate
                : convertLocalDateToTimezoneTime(new Date(), timezoneValue),
        [timezoneValue, valueAsDate],
    );

    const isTimezoneSelectHidden = timePrecision === undefined || showTimezoneSelect === false;
    const isTimezoneSelectDisabled = props.disabled || disableTimezoneSelect;

    const maybeTimezonePicker = isTimezoneSelectHidden ? undefined : (
        <TimezoneSelect
            value={timezoneValue}
            onChange={handleTimezoneChange}
            date={tzSelectDate}
            disabled={isTimezoneSelectDisabled}
            className={Classes.DATE_INPUT_TIMEZONE_SELECT}
            buttonProps={timezoneSelectButtonProps}
        >
            <Tag
                rightIcon={isTimezoneSelectDisabled ? undefined : "caret-down"}
                interactive={!isTimezoneSelectDisabled}
                minimal={true}
            >
                {getTimezoneName(tzSelectDate, timezoneValue, false)}
            </Tag>
        </TimezoneSelect>
    );

    const formattedDateValue = React.useMemo(
        () =>
            valueAsDate === null ? "" : getIsoEquivalentWithUpdatedTimezone(valueAsDate, timezoneValue, timePrecision),
        [valueAsDate, timezoneValue, timePrecision],
    );
    const isErrorState =
        valueAsDate != null && (!isDateValid(valueAsDate) || !isDayInRange(valueAsDate, [minDate, maxDate]));

    const parseDate = React.useCallback(
        (dateString: string) => {
            if (dateString === props.outOfRangeMessage || dateString === props.invalidDateMessage) {
                return null;
            }
            const newDate = props.parseDate(dateString, props.locale);
            return newDate === false ? new Date() : newDate;
        },
        // HACKHACK: ESLint false positive
        // eslint-disable-next-line @typescript-eslint/unbound-method
        [props.outOfRangeMessage, props.invalidDateMessage, props.parseDate, props.locale],
    );

    const handleInputFocus = React.useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
            setIsInputFocused(true);
            setIsOpen(true);
            setInputValue(formattedDateValue);
            props.inputProps?.onFocus?.(e);
        },
        [formattedDateValue, props.inputProps?.onFocus],
    );

    const handleInputBlur = React.useCallback(
        (e: React.FocusEvent<HTMLInputElement>) => {
            if (inputValue == null || valueAsDate == null) {
                return;
            }

            const date = parseDate(inputValue);

            if (
                inputValue.length > 0 &&
                inputValue !== formattedDateValue &&
                (!isDateValid(date) || !isDayInRange(date, [minDate, maxDate]))
            ) {
                if (value === undefined) {
                    // uncontrolled
                    setIsInputFocused(false);
                    setValue(date);
                    setInputValue(null);
                } else {
                    setIsInputFocused(false);
                }

                if (date === null) {
                    props.onChange?.(null, true);
                } else {
                    props.onError?.(date);
                }
            } else {
                if (inputValue.length === 0) {
                    setIsInputFocused(false);
                    setValue(null);
                    setInputValue(null);
                } else {
                    setIsInputFocused(false);
                }
            }
            props.inputProps?.onBlur?.(e);
        },
        [
            inputValue,
            valueAsDate,
            formattedDateValue,
            minDate,
            maxDate,
            props.onChange,
            props.onError,
            props.inputProps?.onBlur,
        ],
    );

    const handleInputChange = React.useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const valueString = (e.target as HTMLInputElement).value;
            const inputValueAsDate = parseDate(valueString);

            if (isDateValid(inputValueAsDate) && isDayInRange(inputValueAsDate, [minDate, maxDate])) {
                if (value === undefined) {
                    // uncontrolled
                    setValue(inputValueAsDate);
                    setInputValue(valueString);
                } else {
                    setInputValue(valueString);
                }
                props.onChange?.(valueString, true);
            } else {
                if (valueString.length === 0) {
                    props.onChange?.(null, true);
                }
                setInputValue(valueString);
            }
            props.inputProps?.onChange?.(e);
        },
        [minDate, maxDate, props.onChange, props.inputProps?.onChange],
    );

    const handleInputClick = React.useCallback(
        (e: React.MouseEvent<HTMLInputElement>) => {
            // stop propagation to the Popover's internal handleTargetClick handler;
            // otherwise, the popover will flicker closed as soon as it opens.
            e.stopPropagation();
            props.inputProps?.onClick?.(e);
        },
        [props.inputProps?.onClick],
    );

    const handleInputKeyDown = React.useCallback(
        (e: React.KeyboardEvent<HTMLInputElement>) => {
            if (e.key === "Tab" && e.shiftKey) {
                // close popover on SHIFT+TAB key press
                handlePopoverClose(e);
            } else if (e.key === "Tab" && isOpen) {
                getKeyboardFocusableElements(popoverContentRef).shift()?.focus();
                // necessary to prevent focusing the second focusable element
                e.preventDefault();
            } else if (e.key === "Escape") {
                setIsOpen(false);
                inputRef.current?.blur();
            } else if (e.key === "Enter" && inputValue != null) {
                const nextDate = parseDate(inputValue);
                handleDateChange(nextDate, true, true);
            }

            props.inputProps?.onKeyDown?.(e);
        },
        [inputValue, props.inputProps?.onKeyDown],
    );

    return (
        <Popover2
            isOpen={isOpen && !props.disabled}
            fill={props.fill}
            {...popoverProps}
            autoFocus={false}
            className={classNames(popoverProps.className, props.className)}
            content={popoverContent}
            enforceFocus={false}
            onClose={handlePopoverClose}
            popoverClassName={classNames(Classes.DATE_INPUT_POPOVER, popoverProps.popoverClassName)}
        >
            <InputGroup
                autoComplete="off"
                intent={isErrorState ? Intent.DANGER : Intent.NONE}
                placeholder={placeholder}
                rightElement={
                    <>
                        {maybeTimezonePicker}
                        {props.inputProps?.rightElement}
                    </>
                }
                type="text"
                {...inputProps}
                disabled={props.disabled}
                inputRef={mergeRefs(inputRef, props.inputProps?.inputRef ?? null)}
                onBlur={handleInputBlur}
                onChange={handleInputChange}
                onClick={handleInputClick}
                onFocus={handleInputFocus}
                onKeyDown={handleInputKeyDown}
                value={isInputFocused ? inputValue ?? undefined : formattedDateValue}
            />
        </Popover2>
    );
});
DateInput2.displayName = `${DISPLAYNAME_PREFIX}.DateInput2`;

function getRelatedTargetWithFallback(e: React.FocusEvent<HTMLElement>) {
    return (e.relatedTarget ?? document.activeElement) as HTMLElement;
}

function getKeyboardFocusableElements(popoverContentRef: React.MutableRefObject<HTMLDivElement | null>) {
    if (popoverContentRef.current === null) {
        return [];
    }

    const elements: HTMLElement[] = Array.from(
        popoverContentRef.current.querySelectorAll("button:not([disabled]),input,[tabindex]:not([tabindex='-1'])"),
    );
    // Remove focus boundary div elements
    elements.pop();
    elements.shift();
    return elements;
}

function hasMonthChanged(prevDate: Date | null, nextDate: Date | null) {
    return (prevDate == null) !== (nextDate == null) || nextDate?.getMonth() !== prevDate?.getMonth();
}

function hasTimeChanged(prevDate: Date | null, nextDate: Date | null) {
    return (
        (prevDate == null) !== (nextDate == null) ||
        nextDate?.getHours() !== prevDate?.getHours() ||
        nextDate?.getMinutes() !== prevDate?.getMinutes() ||
        nextDate?.getSeconds() !== prevDate?.getSeconds() ||
        nextDate?.getMilliseconds() !== prevDate?.getMilliseconds()
    );
}
