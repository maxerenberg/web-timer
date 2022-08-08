"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
////////////////////////////////////////////////////////////////////////////////
// INPUT HANDLING
////////////////////////////////////////////////////////////////////////////////
const secondsInput = document.getElementById('input-seconds');
const minutesInput = document.getElementById('input-minutes');
const hoursInput = document.getElementById('input-hours');
const inputElems = [secondsInput, minutesInput, hoursInput];
for (const elem of inputElems) {
    elem.addEventListener('focus', inputOnFocus);
    elem.addEventListener('blur', inputOnBlur);
    elem.addEventListener('beforeinput', inputOnBeforeInput);
    elem.addEventListener('input', inputOnInput);
}
function inputOnFocus() {
    document.getElementById('timer-inputs').classList.add('timer-inputs-focus');
}
function inputOnBlur() {
    document.getElementById('timer-inputs').classList.remove('timer-inputs-focus');
}
function hasOnlyDigits(value) {
    for (const ch of value) {
        if (ch < '0' || ch > '9') {
            return false;
        }
    }
    return true;
}
function getNextInput(input) {
    const id = input.getAttribute('id');
    if (id === 'input-seconds') {
        return document.getElementById('input-minutes');
    }
    else if (id === 'input-minutes') {
        return document.getElementById('input-hours');
    }
    return null;
}
function getTimeUnitSpan(input) {
    const id = input.getAttribute('id');
    if (id === 'input-seconds') {
        return document.getElementById('time-unit-seconds');
    }
    else if (id === 'input-minutes') {
        return document.getElementById('time-unit-minutes');
    }
    else if (id === 'input-hours') {
        return document.getElementById('time-unit-hours');
    }
    return null;
}
function updateTimeUnitColor(input) {
    const span = getTimeUnitSpan(input);
    if (input.value.length === 0) {
        span.style.color = 'var(--placeholder-color)';
    }
    else {
        span.style.color = 'unset';
    }
}
function updateTimeUnitColors() {
    for (const elem of inputElems) {
        updateTimeUnitColor(elem);
    }
}
function setInputValue(input, value) {
    input.value = String(value);
    updateTimeUnitColor(input);
}
function overflowToNextInput(input, nextValue) {
    setInputValue(input, nextValue.slice(-2)); // only the last 2 chars
    const overflow = nextValue.slice(0, -2); // all but the last 2 chars
    if (overflow.length === 0) {
        return;
    }
    const nextInput = getNextInput(input);
    if (nextInput !== null) {
        overflowToNextInput(nextInput, nextInput.value + overflow);
    }
}
function setCursorPosition(input, pos) {
    input.selectionStart = pos;
    input.selectionEnd = pos;
}
function inputOnBeforeInput(ev) {
    const input = ev.target;
    if (!ev.data) {
        // content was deleted
        if (ev.inputType === 'deleteContentBackward') {
            // backspace
            if (input.selectionStart === 0 && input.selectionEnd === 0) {
                const nextInput = getNextInput(input);
                if (nextInput !== null) {
                    nextInput.focus();
                    // move cursor position to end
                    setCursorPosition(nextInput, nextInput.value.length);
                }
            }
        }
        return;
    }
    const cursorPosition = input.selectionStart;
    const nextValue = input.value.slice(0, cursorPosition) + ev.data + input.value.slice(cursorPosition);
    if (!hasOnlyDigits(nextValue)) {
        // invalid input
        ev.preventDefault();
        return;
    }
    if (nextValue.length > 2) {
        ev.preventDefault();
        overflowToNextInput(input, nextValue);
        // restore the original cursor position
        setCursorPosition(input, cursorPosition);
    }
}
function updateMinutesPlaceholder() {
    for (const elem of inputElems) {
        if (elem.value.length > 0) {
            minutesInput.placeholder = '00';
            return;
        }
    }
    minutesInput.placeholder = '05';
}
function inputOnInput(ev) {
    const input = ev.target;
    updateTimeUnitColor(input);
    updateMinutesPlaceholder();
}
// Make sure that the visual effects start off in a consistent state -
// the inputs might start off with some input in them if the page
// was refreshed
window.addEventListener('load', function () {
    updateTimeUnitColors();
    updateMinutesPlaceholder();
    setCursorPosition(secondsInput, secondsInput.value.length);
});
////////////////////////////////////////////////////////////////////////////////
// TIMER HANDLING
////////////////////////////////////////////////////////////////////////////////
const audioElement = document.querySelector('audio');
const volumeButton = document.getElementById('volume-button');
const volumeButtonImg = document.querySelector('#volume-button img');
const notificationButton = document.getElementById('notification-button');
const notificationButtonImg = document.querySelector('#notification-button img');
let origSecondsValue = '';
let origMinutesValue = '';
let origHoursValue = '';
let notification = null;
let intervalID = null;
let timerIsRunning = false;
let soundEnabled = true;
if (localStorage.getItem('soundEnabled') === 'false') {
    onVolumeButtonClick();
}
let notificationsEnabled = false;
if (localStorage.getItem('notificationsEnabled') === 'true') {
    onNotificationButtonClick();
}
document.getElementById('start-stop-button').addEventListener('click', function () {
    if (timerIsRunning) {
        stopTimer();
    }
    else {
        startTimer();
    }
    timerIsRunning = !timerIsRunning;
});
document.getElementById('reset-button').addEventListener('click', function () {
    if (timerIsRunning) {
        stopTimer();
        timerIsRunning = false;
    }
    setInputValue(secondsInput, '');
    setInputValue(minutesInput, '');
    setInputValue(hoursInput, '');
    updateMinutesPlaceholder();
    secondsInput.focus();
});
volumeButton.addEventListener('click', onVolumeButtonClick);
function onVolumeButtonClick() {
    let src = '';
    let title = '';
    if (soundEnabled) {
        src = 'assets/volume-mute-fill.svg';
        title = 'Enable the alarm sound';
    }
    else {
        src = 'assets/volume-up-fill.svg';
        title = 'Disable the alarm sound';
    }
    volumeButtonImg.src = src;
    volumeButton.title = title;
    soundEnabled = !soundEnabled;
    localStorage.setItem('soundEnabled', String(soundEnabled));
    if (timerIsRunning && intervalID === null) {
        // timer expired and user hasn't cleared it yet
        if (soundEnabled) {
            startSound();
        }
        else {
            stopSound();
        }
    }
}
notificationButton.addEventListener('click', onNotificationButtonClick);
function onNotificationButtonClick() {
    return __awaiter(this, void 0, void 0, function* () {
        let src = '';
        let title = '';
        if (!notificationsEnabled) {
            if (Notification.permission !== 'granted') {
                const result = yield Notification.requestPermission();
                if (result !== 'granted') {
                    return;
                }
            }
            src = 'assets/bell-fill.svg';
            title = 'Disable notifications';
        }
        else {
            src = 'assets/bell-slash-fill.svg';
            title = 'Enable notifications';
        }
        notificationButtonImg.src = src;
        notificationButton.title = title;
        notificationsEnabled = !notificationsEnabled;
        localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
    });
}
function getInputTimeValue(input) {
    return parseInt(input.value || input.placeholder);
}
function getTimerValueSeconds() {
    let seconds = 0;
    for (const [elem, multiplier] of [
        [secondsInput, 1],
        [minutesInput, 60],
        [hoursInput, 3600],
    ]) {
        seconds += getInputTimeValue(elem) * multiplier;
    }
    return seconds;
}
function decrementInputs() {
    const secondsValue = getInputTimeValue(secondsInput);
    const minutesValue = getInputTimeValue(minutesInput);
    const hoursValue = getInputTimeValue(hoursInput);
    if (secondsValue > 0) {
        if (secondsValue === 1 && minutesValue === 0 && hoursValue === 0) {
            setInputValue(secondsInput, '');
        }
        else {
            setInputValue(secondsInput, secondsValue - 1);
        }
        return;
    }
    if (minutesValue > 0) {
        if (minutesValue === 1 && hoursValue === 0) {
            setInputValue(minutesInput, '');
            minutesInput.placeholder = '00';
        }
        else {
            setInputValue(minutesInput, minutesValue - 1);
        }
        setInputValue(secondsInput, '59');
        return;
    }
    if (hoursValue > 0) {
        if (hoursValue === 1) {
            setInputValue(hoursInput, '');
        }
        else {
            setInputValue(hoursInput, hoursValue - 1);
        }
        setInputValue(minutesInput, '59');
        setInputValue(secondsInput, '59');
    }
}
function startSound() {
    if (soundEnabled && audioElement.paused) {
        audioElement.play();
    }
}
function stopSound() {
    if (!audioElement.paused) {
        audioElement.pause();
    }
    audioElement.currentTime = 0;
}
function showNotification() {
    if (notificationsEnabled && notification === null) {
        notification = new Notification('Timer', { body: "Time's up!" });
        notification.addEventListener('close', function () { notification = null; });
        notification.addEventListener('error', function () { notification = null; });
    }
}
function closeNotification() {
    if (notification !== null) {
        notification.close();
    }
}
function startTimerExpirationEffects() {
    startSound();
    showNotification();
}
function stopTimerExpirationEffects() {
    stopSound();
    closeNotification();
}
function startTimer() {
    document.getElementById('start-stop-button').textContent = 'STOP';
    origSecondsValue = secondsInput.value;
    origMinutesValue = minutesInput.value;
    origHoursValue = hoursInput.value;
    let seconds = getTimerValueSeconds();
    if (seconds <= 0) {
        for (const elem of inputElems) {
            setInputValue(elem, '');
        }
        startTimerExpirationEffects();
        return;
    }
    intervalID = setInterval(() => {
        seconds--;
        decrementInputs();
        if (seconds <= 0) {
            if (intervalID !== null) {
                clearInterval(intervalID);
                intervalID = null;
            }
            startTimerExpirationEffects();
        }
    }, 1000);
}
function stopTimer() {
    let timerExpired = intervalID === null;
    if (!timerExpired) {
        clearInterval(intervalID);
        intervalID = null;
    }
    stopTimerExpirationEffects();
    if (timerExpired) {
        // restore original values which user specified, if any
        setInputValue(secondsInput, origSecondsValue);
        setInputValue(minutesInput, origMinutesValue);
        setInputValue(hoursInput, origHoursValue);
        updateMinutesPlaceholder();
    }
    document.getElementById('start-stop-button').textContent = 'START';
}
