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

import { assert } from "chai";
import { mount, ReactWrapper } from "enzyme";
import * as React from "react";
import * as sinon from "sinon";

import { Classes as CoreClasses, InputGroup } from "@blueprintjs/core";
import { DatePicker, Classes as DatetimeClasses, Months, TimePrecision, TimeUnit } from "@blueprintjs/datetime";
import { Popover2, Classes as Popover2Classes } from "@blueprintjs/popover2";

import { Classes, DateInput2, DateInput2Props, TimezoneSelect } from "../../src";

const VALUE = "2021-11-29T10:30:00.000z";

const formatDate = (date: Date | null | undefined) =>
    date == null ? "" : [date.getMonth() + 1, date.getDate(), date.getFullYear()].join("/");
const parseDate = (str: string) => new Date(str);
const DEFAULT_PROPS = {
    defaultTimezone: "Etc/UTC",
    formatDate,
    parseDate,
    popoverProps: {
        usePortal: false,
    },
    timePickerProps: { showArrowButtons: true },
    timePrecision: TimePrecision.MILLISECOND,
};

describe("<DateInput2>", () => {
    const onChange = sinon.spy();
    let containerElement: HTMLElement | undefined;

    beforeEach(() => {
        containerElement = document.createElement("div");
        document.body.appendChild(containerElement);
    });
    afterEach(() => {
        containerElement?.remove();
        onChange.resetHistory();
    });

    describe("basic rendering", () => {
        it("passes custom classNames to popover target", () => {
            const CLASS_1 = "foo";
            const CLASS_2 = "bar";

            const wrapper = mount(
                <DateInput2
                    {...DEFAULT_PROPS}
                    className={CLASS_1}
                    popoverProps={{ ...DEFAULT_PROPS.popoverProps, className: CLASS_2 }}
                />,
            );

            const popoverTarget = wrapper.find(`.${Classes.DATE_INPUT}.${Popover2Classes.POPOVER2_TARGET}`).hostNodes();
            assert.isTrue(popoverTarget.hasClass(CLASS_1));
            assert.isTrue(popoverTarget.hasClass(CLASS_2));
        });

        it("supports custom input props", () => {
            const wrapper = mount(
                <DateInput2 {...DEFAULT_PROPS} inputProps={{ style: { background: "yellow" }, tabIndex: 4 }} />,
            );
            const inputElement = wrapper.find("input").getDOMNode() as HTMLInputElement;
            assert.equal(inputElement.style.background, "yellow");
            assert.equal(inputElement.tabIndex, 4);
        });

        it("supports inputProps.inputRef", () => {
            let input: HTMLInputElement | null = null;
            mount(<DateInput2 {...DEFAULT_PROPS} inputProps={{ inputRef: ref => (input = ref) }} />);
            assert.instanceOf(input, HTMLInputElement);
        });

        it("does not render a TimezoneSelect if timePrecision is undefined", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} timePrecision={undefined} />);
            assert.isFalse(wrapper.find(TimezoneSelect).exists());
        });

        it("correctly passes on defaultTimezone to TimezoneSelect", () => {
            const defaultTimezone = "Europe/Paris";
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} defaultTimezone={defaultTimezone} />);
            const timezoneSelect = wrapper.find(TimezoneSelect);
            assert.strictEqual(timezoneSelect.prop("value"), defaultTimezone);
        });

        it("passes datePickerProps to DatePicker correctly", () => {
            const datePickerProps = {
                clearButtonText: "clear",
                todayButtonText: "today",
            };
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} {...datePickerProps} />);
            focusInput(wrapper);
            const datePicker = wrapper.find(DatePicker);
            assert.equal(datePicker.prop("clearButtonText"), "clear");
            assert.equal(datePicker.prop("todayButtonText"), "today");
        });

        it("passes inputProps to InputGroup", () => {
            const inputRef = sinon.spy();
            const onFocus = sinon.spy();
            const wrapper = mount(
                <DateInput2
                    {...DEFAULT_PROPS}
                    inputProps={{
                        inputRef,
                        leftIcon: "star",
                        onFocus,
                        required: true,
                    }}
                />,
            );
            focusInput(wrapper);

            const input = wrapper.find(InputGroup);
            assert.strictEqual(input.prop("leftIcon"), "star");
            assert.isTrue(input.prop("required"));
            assert.isTrue(inputRef.called, "inputRef not invoked");
            assert.isTrue(onFocus.called, "onFocus not invoked");
        });

        it("passes fill and popoverProps to Popover2", () => {
            const onOpening = sinon.spy();
            const wrapper = mount(
                <DateInput2
                    {...DEFAULT_PROPS}
                    fill={true}
                    popoverProps={{
                        onOpening,
                        placement: "top",
                        usePortal: false,
                    }}
                />,
            );
            focusInput(wrapper);

            const popover = wrapper.find(Popover2).first();
            assert.strictEqual(popover.prop("fill"), true);
            assert.strictEqual(popover.prop("placement"), "top");
            assert.strictEqual(popover.prop("usePortal"), false);
            assert.isTrue(onOpening.calledOnce);
        });
    });

    describe("popover interaction", () => {
        it("opens the popover when focusing input", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} />, { attachTo: containerElement });
            focusInput(wrapper);
            assertPopoverIsOpen(wrapper);
        });

        it("doesn't open the popover when disabled", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} disabled={true} />, { attachTo: containerElement });
            focusInput(wrapper);
            assertPopoverIsOpen(wrapper, false);
        });

        it("popover closes when ESC key pressed", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS} />, { attachTo: containerElement });
            focusInput(wrapper);
            wrapper.find(InputGroup).find("input").simulate("keydown", { key: "Escape" });
            assertPopoverIsOpen(wrapper, false);
        });
    });

    describe("controlled usage", () => {
        const DEFAULT_PROPS_CONTROLLED = {
            ...DEFAULT_PROPS,
            onChange,
            value: VALUE,
        };

        it("handles null inputs without crashing", () => {
            assert.doesNotThrow(() => mount(<DateInput2 {...DEFAULT_PROPS_CONTROLLED} value={null} />));
        });

        describe("when changing timezone", () => {
            it("calls onChange with the updated ISO string", () => {
                const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_CONTROLLED} />);
                clickTimezoneItem(wrapper, "Paris");
                assert.isTrue(onChange.calledOnce);
                assert.deepEqual(onChange.firstCall.args, ["2021-11-29T10:30:00.000+01:00"]);
            });

            it("formats the returned ISO string according to timePrecision", () => {
                const wrapper = mount(
                    <DateInput2 {...DEFAULT_PROPS_CONTROLLED} timePrecision={TimePrecision.MINUTE} />,
                );
                clickTimezoneItem(wrapper, "Paris");
                assert.isTrue(onChange.calledOnce);
                assert.deepEqual(onChange.firstCall.args, ["2021-11-29T10:30+01:00"]);
            });
        });

        it("changing the time calls onChange with the updated ISO string", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_CONTROLLED} />, { attachTo: containerElement });
            setTimeUnit(wrapper, TimeUnit.HOUR_24, 11);
            assert.isTrue(onChange.calledOnce);
            assert.deepEqual(onChange.firstCall.args, ["2021-11-29T11:30:00.000+00:00", true]);
        });

        it("clearing the input invokes onChange with null", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_CONTROLLED} />);
            wrapper
                .find(InputGroup)
                .find("input")
                .simulate("change", { target: { value: "" } });
            assert.isTrue(onChange.calledOnceWithExactly(null, true));
        });
    });

    describe("uncontrolled usage", () => {
        const DEFAULT_PROPS_UNCONTROLLED = {
            ...DEFAULT_PROPS,
            defaultValue: VALUE,
            onChange,
        };

        it("calls onChange on date changes", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            wrapper
                .find(`.${DatetimeClasses.DATEPICKER_DAY}:not(.${DatetimeClasses.DATEPICKER_DAY_OUTSIDE})`)
                .first()
                .simulate("click")
                .update();
            assert.isTrue(onChange.calledOnce);
            // first non-outside day should be the November 1st
            assert.strictEqual(onChange.firstCall.args[0], "2021-11-01T10:30:00.000+00:00");
        });

        it("calls onChange on timezone changes", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            clickTimezoneItem(wrapper, "New York");
            assert.isTrue(onChange.calledOnce);
            console.info(onChange.firstCall.args);
            // New York is UTC-5
            assert.strictEqual(onChange.firstCall.args[0], "2021-11-29T10:30:00.000-05:00");
        });

        // HACKHACK: this test ported from DateInput doesn't seem to match any real UX, since pressing Shift+Tab
        // on the first focussable day in a calendar month doesn't move you to the previous month; instead it moves focus
        // to the year dropdown. It might be worth testing behavior when pressing the left arrow key, since that _does_
        // move focus to the last day of the previous month.
        it.skip("popover should not close if focus moves to previous day (last day of prev month)", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            blurInput(wrapper);
            const firstTabbable = wrapper.find(Popover2).find(".DayPicker-Day").filter({ tabIndex: 0 }).first();
            const lastDayOfPrevMonth = wrapper
                .find(Popover2)
                .find(".DayPicker-Body > .DayPicker-Week .DayPicker-Day--outside")
                .last();

            firstTabbable.simulate("focus");
            firstTabbable.simulate("blur", {
                relatedTarget: lastDayOfPrevMonth.getDOMNode(),
                target: firstTabbable.getDOMNode(),
            });
            wrapper.update();
            assertPopoverIsOpen(wrapper);
        });

        it("popover should not close if focus moves to month select", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            blurInput(wrapper);
            changeSelectDropdown(wrapper, DatetimeClasses.DATEPICKER_MONTH_SELECT, Months.NOVEMBER);
            assertPopoverIsOpen(wrapper);
        });

        it("popover should not close if focus moves to year select", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            blurInput(wrapper);
            changeSelectDropdown(wrapper, DatetimeClasses.DATEPICKER_YEAR_SELECT, 2020);
            assertPopoverIsOpen(wrapper);
        });

        it("popover should not close when time picker arrows are clicked after selecting a month", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            changeSelectDropdown(wrapper, DatetimeClasses.DATEPICKER_MONTH_SELECT, Months.OCTOBER);
            wrapper
                .find(`.${DatetimeClasses.TIMEPICKER_ARROW_BUTTON}.${DatetimeClasses.TIMEPICKER_HOUR}`)
                .first()
                .simulate("click");
            assertPopoverIsOpen(wrapper);
        });

        it("pressing Enter saves the inputted date and closes the popover", () => {
            const IMPROPERLY_FORMATTED_DATE_STRING = "002/0015/2015";
            const PROPERLY_FORMATTED_DATE_STRING = "2/15/2015";
            const onKeyDown = sinon.spy();
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} inputProps={{ onKeyDown }} />, {
                attachTo: containerElement,
            });
            focusInput(wrapper);
            const input = wrapper.find(InputGroup).find("input");
            input.simulate("change", { target: { value: IMPROPERLY_FORMATTED_DATE_STRING } });
            input.simulate("keydown", { key: "Enter" });
            assertPopoverIsOpen(wrapper, false);
            assert.notStrictEqual(document.activeElement, input.getDOMNode(), "input should not be focused");
            assert.strictEqual(wrapper.find(InputGroup).prop("value"), PROPERLY_FORMATTED_DATE_STRING);
            assert.isTrue(onKeyDown.calledOnce, "onKeyDown called once");
        });

        it("clicking a date puts it in the input box and closes the popover", () => {
            const wrapper = mount(<DateInput2 {...DEFAULT_PROPS_UNCONTROLLED} />, { attachTo: containerElement });
            focusInput(wrapper);
            assert.equal(wrapper.find(InputGroup).prop("value"), "11/29/2021");
            clickCalendarDay(wrapper, 12);
            assert.equal(wrapper.find(InputGroup).prop("value"), "11/12/2021");
            assertPopoverIsOpen(wrapper, false);
        });
    });

    function focusInput(wrapper: ReactWrapper<DateInput2Props>) {
        wrapper.find(InputGroup).find("input").simulate("focus");
    }

    function blurInput(wrapper: ReactWrapper<DateInput2Props>) {
        wrapper.find(InputGroup).find("input").simulate("blur");
    }

    function clickTimezoneItem(wrapper: ReactWrapper<DateInput2Props>, searchQuery: string) {
        wrapper.find(`.${Classes.TIMEZONE_SELECT}`).hostNodes().simulate("click");
        wrapper
            .find(`.${Classes.TIMEZONE_SELECT_POPOVER}`)
            .find(`.${CoreClasses.MENU_ITEM}`)
            .hostNodes()
            .findWhere(item => item.text().includes(searchQuery))
            .first()
            .simulate("click");
    }

    function clickCalendarDay(wrapper: ReactWrapper<DateInput2Props>, dayNumber: number) {
        wrapper
            .find(`.${DatetimeClasses.DATEPICKER_DAY}`)
            .filterWhere(day => day.text() === `${dayNumber}` && !day.hasClass(DatetimeClasses.DATEPICKER_DAY_OUTSIDE))
            .simulate("click");
    }

    function setTimeUnit(wrapper: ReactWrapper<DateInput2Props>, unit: TimeUnit, value: number) {
        focusInput(wrapper);
        let inputClass: string;
        switch (unit) {
            case TimeUnit.HOUR_12:
            case TimeUnit.HOUR_24:
                inputClass = DatetimeClasses.TIMEPICKER_HOUR;
                break;
            case TimeUnit.MINUTE:
                inputClass = DatetimeClasses.TIMEPICKER_MINUTE;
                break;
            case TimeUnit.SECOND:
                inputClass = DatetimeClasses.TIMEPICKER_SECOND;
                break;
            case TimeUnit.MS:
                inputClass = DatetimeClasses.TIMEPICKER_MILLISECOND;
                break;
        }
        const input = wrapper.find(`.${inputClass}`).first();
        input.simulate("change", { target: { value } });
        input.simulate("blur");
    }

    function changeSelectDropdown(wrapper: ReactWrapper<DateInput2Props>, className: string, value: React.ReactText) {
        wrapper
            .find(`.${className}`)
            .find("select")
            .simulate("change", { target: { value: value.toString() } });
    }

    function assertPopoverIsOpen(wrapper: ReactWrapper<DateInput2Props>, expectedIsOpen: boolean = true) {
        const openPopoverTarget = wrapper.find(`.${Popover2Classes.POPOVER2_OPEN}`);
        if (expectedIsOpen) {
            assert.isTrue(
                openPopoverTarget.exists(),
                `Expected .${Popover2Classes.POPOVER2_OPEN} to exist, indicating the popover is open`,
            );
        } else {
            assert.isFalse(
                openPopoverTarget.exists(),
                `Expected .${Popover2Classes.POPOVER2_OPEN} NOT to exist, indicating the popover is closed`,
            );
        }
    }
});
