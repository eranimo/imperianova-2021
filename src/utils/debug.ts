export class DebugTimer {
  constructor(private label: string) {
    console.time(this.text);
  }

  get text() {
    return `Timer: ${this.label}`;
  }

  stopTimer() {
    console.timeEnd(this.text);
  }
}
