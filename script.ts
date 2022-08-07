////////////////////////////////////////////////////////////////////////////////
// INPUT HANDLING
////////////////////////////////////////////////////////////////////////////////
const secondsInput = document.getElementById('input-seconds') as HTMLInputElement;
const minutesInput = document.getElementById('input-minutes') as HTMLInputElement;
const hoursInput = document.getElementById('input-hours') as HTMLInputElement;
const inputElems = [secondsInput, minutesInput, hoursInput];

for (const elem of inputElems) {
  elem.addEventListener('focus', inputOnFocus);
  elem.addEventListener('blur', inputOnBlur);
  elem.addEventListener('beforeinput', inputOnBeforeInput);
  elem.addEventListener('input', inputOnInput);
}

function inputOnFocus() {
  document.getElementById('timer-inputs')!.classList.add('timer-inputs-focus');
}

function inputOnBlur() {
  document.getElementById('timer-inputs')!.classList.remove('timer-inputs-focus');
}

function hasOnlyDigits(value: string): boolean {
  for (const ch of value) {
    if (ch < '0' || ch > '9') {
      return false;
    }
  }
  return true;
}

function getNextInput(input: HTMLInputElement): HTMLInputElement | null {
  const id = input.getAttribute('id');
  if (id === 'input-seconds') {
    return document.getElementById('input-minutes') as HTMLInputElement;
  } else if (id === 'input-minutes') {
    return document.getElementById('input-hours') as HTMLInputElement;
  }
  return null;
}

function getTimeUnitSpan(input: HTMLInputElement): HTMLSpanElement | null {
  const id = input.getAttribute('id');
  if (id === 'input-seconds') {
    return document.getElementById('time-unit-seconds') as HTMLSpanElement;
  } else if (id === 'input-minutes') {
    return document.getElementById('time-unit-minutes') as HTMLSpanElement;
  } else if (id === 'input-hours') {
    return document.getElementById('time-unit-hours') as HTMLSpanElement;
  }
  return null;
}

function updateTimeUnitColor(input: HTMLInputElement) {
  const span = getTimeUnitSpan(input)!;
  if (input.value.length === 0) {
    span.style.color = 'var(--placeholder-color)';
  } else {
    span.style.color = 'unset';
  }
}

function updateTimeUnitColors() {
  for (const elem of inputElems) {
    updateTimeUnitColor(elem);
  }
}

function setInputValue(input: HTMLInputElement, value: string | number) {
  input.value = String(value);
  updateTimeUnitColor(input);
}

function overflowToNextInput(input: HTMLInputElement, nextValue: string) {
  setInputValue(input, nextValue.slice(-2));  // only the last 2 chars
  const overflow = nextValue.slice(0, -2);  // all but the last 2 chars
  if (overflow.length === 0) {
    return;
  }
  const nextInput = getNextInput(input);
  if (nextInput !== null) {
    overflowToNextInput(nextInput, nextInput.value + overflow);
  }
}

function setCursorPosition(input: HTMLInputElement, pos: number) {
  input.selectionStart = pos;
  input.selectionEnd = pos;
}

function inputOnBeforeInput(ev: InputEvent) {
  const input = ev.target as HTMLInputElement;
  if (!ev.data) {
    // backspace
    if (input.selectionStart === 0 && input.selectionEnd === 0) {
      const nextInput = getNextInput(input);
      if (nextInput !== null) {
        nextInput.focus();
        // move cursor position to end
        setCursorPosition(nextInput, nextInput.value.length);
      }
    }
    return;
  }
  const cursorPosition = input.selectionStart!;
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

function inputOnInput(ev: Event) {
  const input = ev.target as HTMLInputElement;
  updateTimeUnitColor(input);
  updateMinutesPlaceholder();
}

// Make sure that the visual effects start off in a consistent state -
// the inputs might start off with some input in them if the page
// was refreshed
window.addEventListener('load', function() {
  updateTimeUnitColors();
  updateMinutesPlaceholder();
  setCursorPosition(secondsInput, secondsInput.value.length);
});

////////////////////////////////////////////////////////////////////////////////
// TIMER HANDLING
////////////////////////////////////////////////////////////////////////////////
const audioElement = document.querySelector('audio')!;
const volumeButton = document.getElementById('volume-button') as HTMLButtonElement;
const volumeButtonImg = document.querySelector('#volume-button img') as HTMLImageElement;
const notificationButton = document.getElementById('notification-button') as HTMLButtonElement;
const notificationButtonImg = document.querySelector('#notification-button img') as HTMLImageElement;
let origSecondsValue = '';
let origMinutesValue = '';
let origHoursValue = '';
let notification: Notification | null = null;
let intervalID: number | null = null;
let timerIsRunning = false;
let soundEnabled = true;
if (localStorage.getItem('soundEnabled') === 'false') {
  onVolumeButtonClick();
}
let notificationsEnabled = false;
if (localStorage.getItem('notificationsEnabled') === 'true') {
  onNotificationButtonClick();
}

document.getElementById('start-stop-button')!.addEventListener('click', function() {
  if (timerIsRunning) {
    stopTimer();
  } else {
    startTimer();
  }
  timerIsRunning = !timerIsRunning;
});

document.getElementById('reset-button')!.addEventListener('click', function() {
  if (timerIsRunning) {
    stopTimer();
    timerIsRunning = false;
  }
  setInputValue(secondsInput, '');
  setInputValue(minutesInput, '');
  setInputValue(hoursInput, '');
  updateMinutesPlaceholder();
  secondsInput.focus();
})

volumeButton.addEventListener('click', onVolumeButtonClick);
function onVolumeButtonClick() {
  let src = '';
  let title = ''
  if (soundEnabled) {
    src = 'assets/volume-mute-fill.svg';
    title = 'Enable the alarm sound';
  } else {
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
    } else {
      stopSound();
    }
  }
}

notificationButton.addEventListener('click', onNotificationButtonClick);
async function onNotificationButtonClick() {
  let src = '';
  let title = '';
  if (!notificationsEnabled) {
    if (Notification.permission !== 'granted') {
      const result = await Notification.requestPermission();
      if (result !== 'granted') {
        return;
      }
    }
    src = 'assets/bell-fill.svg';
    title = 'Disable notifications';
  } else {
    src = 'assets/bell-slash-fill.svg';
    title = 'Enable notifications';
  }
  notificationButtonImg.src = src;
  notificationButton.title = title;
  notificationsEnabled = !notificationsEnabled;
  localStorage.setItem('notificationsEnabled', String(notificationsEnabled));
}

function getInputTimeValue(input: HTMLInputElement): number {
  return parseInt(input.value || input.placeholder)!;
}

function getTimerValueSeconds(): number {
  let seconds = 0;
  for (const [elem, multiplier] of [
    [secondsInput, 1] as const,
    [minutesInput, 60] as const,
    [hoursInput, 3600] as const,
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
    } else {
      setInputValue(secondsInput, secondsValue - 1);
    }
    return;
  }
  if (minutesValue > 0) {
    if (minutesValue === 1 && hoursValue === 0) {
      setInputValue(minutesInput, '');
      minutesInput.placeholder = '00';
    } else {
      setInputValue(minutesInput, minutesValue - 1);
    }
    setInputValue(secondsInput, '59');
    return;
  }
  if (hoursValue > 0) {
    if (hoursValue === 1) {
      setInputValue(hoursInput, '');
    } else {
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
    notification.addEventListener('close', function() { notification = null; });
    notification.addEventListener('error', function() { notification = null; });
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
  document.getElementById('start-stop-button')!.textContent = 'STOP';
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
    clearInterval(intervalID!);
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
  document.getElementById('start-stop-button')!.textContent = 'START';
}
