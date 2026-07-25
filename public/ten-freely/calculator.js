import { inspectExpression } from "./expression-engine.js";

const ADVANCED_KEYS = [
  { label: "(", value: "(" },
  { label: ")", value: ")" },
  { label: "√", value: "√" },
  { label: "!", value: "!" },
  { label: "xʸ", value: "^", aria: "累乗" },
  { label: "P", value: "P", aria: "順列" },
  { label: "C", value: "C", aria: "組合せ" },
  { label: "|x|", value: "|", aria: "絶対値" },
  { label: "−x", value: "-", aria: "単項マイナスまたは引き算" },
  { label: "+x", value: "+", aria: "単項プラスまたは足し算" },
];

const MAIN_KEYS = [
  { label: "AC", action: "clear", kind: "utility" },
  { label: "⌫", action: "delete", kind: "utility", aria: "1文字削除" },
  { label: "←", action: "left", kind: "utility", aria: "カーソルを左へ" },
  { label: "→", action: "right", kind: "utility", aria: "カーソルを右へ" },
  { label: "7", value: "7", digit: 7 },
  { label: "8", value: "8", digit: 8 },
  { label: "9", value: "9", digit: 9 },
  { label: "÷", value: "/", kind: "operator" },
  { label: "4", value: "4", digit: 4 },
  { label: "5", value: "5", digit: 5 },
  { label: "6", value: "6", digit: 6 },
  { label: "×", value: "*", kind: "operator" },
  { label: "1", value: "1", digit: 1 },
  { label: "2", value: "2", digit: 2 },
  { label: "3", value: "3", digit: 3 },
  { label: "−", value: "-", kind: "operator" },
  { label: "🏳️", action: "retire", kind: "danger", aria: "リタイア" },
  { label: "0", value: "0", digit: 0 },
  { label: "+", value: "+", kind: "operator" },
  { label: "=", action: "submit", kind: "operator", aria: "式を判定" },
];

function countDigits(problem) {
  const counts = Array(10).fill(0);
  for (const char of String(problem || "")) counts[Number(char)] += 1;
  return counts;
}

function isDigitToken(token) {
  return /^[0-9]$/u.test(token || "");
}

function displayToken(token) {
  if (token === "*") return "×";
  if (token === "/") return "÷";
  if (token === "-") return "−";
  return token;
}

export class TenCalculator {
  constructor(mount, options = {}) {
    if (!mount) throw new TypeError("calculator mount is required");
    this.mount = mount;
    this.problem = String(options.problem || "0067");
    this.tokens = [];
    this.cursor = 0;
    this.enabled = options.enabled !== false;
    this.locked = false;
    this.onSubmit = options.onSubmit || (() => {});
    this.onRetire = options.onRetire || (() => {});
    this.onActivity = options.onActivity || (() => {});
    this.onChange = options.onChange || (() => {});
    this.result = null;
    this.resultKind = "";
    this.problemCounts = countDigits(this.problem);
    this.boundKeydown = (event) => this.handleKeyboard(event);
    this.renderShell();
    this.attachEvents();
    this.render();
    document.addEventListener("keydown", this.boundKeydown);
  }

  destroy() {
    document.removeEventListener("keydown", this.boundKeydown);
    this.mount.replaceChildren();
  }

  renderShell() {
    this.mount.innerHTML = `
      <section class="calculator" aria-label="10を作る電卓">
        <div class="calculator-display" aria-live="polite">
          <div class="problem-mini">今回の数字 <strong data-problem-mini></strong></div>
          <div class="display-prompt" data-prompt>今回の数字は…<strong></strong></div>
          <div class="expression-viewport" data-expression-viewport hidden>
            <div class="expression-line" data-expression></div>
          </div>
          <div class="display-result" data-result></div>
        </div>
        <div class="calculator-status" data-status></div>
        <div class="advanced-pad" data-advanced-pad></div>
        <div class="main-pad" data-main-pad></div>
      </section>`;

    this.refs = {
      calculator: this.mount.querySelector(".calculator"),
      problemMini: this.mount.querySelector("[data-problem-mini]"),
      prompt: this.mount.querySelector("[data-prompt]"),
      promptProblem: this.mount.querySelector("[data-prompt] strong"),
      expressionViewport: this.mount.querySelector("[data-expression-viewport]"),
      expression: this.mount.querySelector("[data-expression]"),
      result: this.mount.querySelector("[data-result]"),
      status: this.mount.querySelector("[data-status]"),
      advancedPad: this.mount.querySelector("[data-advanced-pad]"),
      mainPad: this.mount.querySelector("[data-main-pad]"),
    };

    for (const key of ADVANCED_KEYS) this.refs.advancedPad.append(this.createKey(key));
    for (const key of MAIN_KEYS) this.refs.mainPad.append(this.createKey(key));
  }

  createKey(key) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `calc-key${key.kind ? ` key-${key.kind}` : ""}`;
    button.dataset.value = key.value ?? "";
    button.dataset.action = key.action ?? "insert";
    if (key.digit !== undefined) button.dataset.digit = String(key.digit);
    button.setAttribute("aria-label", key.aria || key.label);
    const label = document.createElement("span");
    label.textContent = key.label;
    button.append(label);
    if (key.digit !== undefined) {
      const badge = document.createElement("span");
      badge.className = "remaining-badge";
      badge.dataset.remaining = String(key.digit);
      badge.hidden = true;
      button.append(badge);
    }
    return button;
  }

  attachEvents() {
    this.refs.calculator.addEventListener("click", (event) => {
      const button = event.target.closest(".calc-key");
      if (!button || button.disabled || !this.enabled || this.locked) return;
      this.pulse(button);
      this.onActivity();
      const action = button.dataset.action;
      if (action === "insert") this.insert(button.dataset.value);
      else if (action === "clear") this.clear();
      else if (action === "delete") this.deleteBeforeCursor();
      else if (action === "left") this.moveCursor(-1);
      else if (action === "right") this.moveCursor(1);
      else if (action === "submit") this.submit();
      else if (action === "retire") this.onRetire(this);
    });
  }

  pulse(button) {
    button.classList.add("is-pressed");
    window.setTimeout(() => button.classList.remove("is-pressed"), 90);
    if (navigator.vibrate) navigator.vibrate(8);
  }

  setProblem(problem, { preserveExpression = false } = {}) {
    this.problem = String(problem);
    this.problemCounts = countDigits(this.problem);
    this.locked = false;
    if (!preserveExpression) {
      this.tokens = [];
      this.cursor = 0;
      this.result = null;
      this.resultKind = "";
    }
    this.render();
  }

  setEnabled(enabled) {
    this.enabled = Boolean(enabled);
    this.renderKeys();
  }

  setLocked(locked) {
    this.locked = Boolean(locked);
    this.renderKeys();
  }

  getExpression() {
    return this.tokens.join("");
  }

  getUsedCounts() {
    const counts = Array(10).fill(0);
    for (const token of this.tokens) if (isDigitToken(token)) counts[Number(token)] += 1;
    return counts;
  }

  insert(token) {
    if (isDigitToken(token)) {
      const digit = Number(token);
      const used = this.getUsedCounts()[digit];
      if (used >= this.problemCounts[digit]) {
        this.setStatus(`数字の「${digit}」は、もうすべて使っています。`, "warning");
        return;
      }
      const left = this.tokens[this.cursor - 1];
      const right = this.tokens[this.cursor];
      if (isDigitToken(left) || isDigitToken(right)) {
        this.setStatus("数字は連結できません。間に演算子を入れてください。", "warning");
        return;
      }
    }

    if (token === "!") {
      let count = 0;
      for (let index = this.cursor - 1; index >= 0 && this.tokens[index] === "!"; index -= 1) count += 1;
      if (count >= 9) {
        this.setStatus("階乗記号は連続9個までです。", "warning");
        return;
      }
    }

    this.tokens.splice(this.cursor, 0, token);
    this.cursor += 1;
    this.result = null;
    this.resultKind = "";
    this.render();
  }

  clear() {
    this.tokens = [];
    this.cursor = 0;
    this.result = null;
    this.resultKind = "";
    this.render();
  }

  deleteBeforeCursor() {
    if (this.cursor <= 0) return;
    this.tokens.splice(this.cursor - 1, 1);
    this.cursor -= 1;
    this.result = null;
    this.resultKind = "";
    this.render();
  }

  moveCursor(direction) {
    this.cursor = Math.max(0, Math.min(this.tokens.length, this.cursor + direction));
    this.renderExpression();
  }

  submit() {
    const inspection = inspectExpression(this.getExpression(), this.problem);
    if (!inspection.canSubmit) return;
    this.onSubmit(this.getExpression(), this, inspection);
  }

  setResult(value, kind = "") {
    this.result = value;
    this.resultKind = kind;
    this.renderResult();
  }

  setStatus(message, kind = "") {
    this.refs.status.textContent = message;
    this.refs.status.classList.toggle("is-warning", kind === "warning");
  }

  render() {
    this.refs.problemMini.textContent = this.problem;
    this.refs.promptProblem.textContent = `${this.problem}‼︎`;
    this.refs.prompt.hidden = this.tokens.length > 0;
    this.refs.expressionViewport.hidden = this.tokens.length === 0;
    this.renderExpression();
    this.renderResult();
    this.renderKeys();
    this.renderStatus();
    this.onChange(this.getExpression(), this);
  }

  renderExpression() {
    this.refs.expression.replaceChildren();
    for (let index = 0; index <= this.tokens.length; index += 1) {
      if (index === this.cursor) {
        const cursor = document.createElement("span");
        cursor.className = "expression-cursor";
        cursor.setAttribute("aria-hidden", "true");
        this.refs.expression.append(cursor);
      }
      if (index < this.tokens.length) {
        const span = document.createElement("span");
        span.className = "expression-token";
        span.textContent = displayToken(this.tokens[index]);
        this.refs.expression.append(span);
      }
    }
    requestAnimationFrame(() => {
      this.refs.expressionViewport.scrollLeft = this.refs.expressionViewport.scrollWidth;
    });
  }

  renderResult() {
    this.refs.result.className = "display-result";
    if (this.result === null || this.result === undefined || this.result === "") {
      this.refs.result.textContent = "";
      return;
    }
    this.refs.result.textContent = String(this.result);
    if (this.resultKind === "error") this.refs.result.classList.add("is-error");
    if (this.resultKind === "ten") this.refs.result.classList.add("is-ten");
  }

  renderStatus() {
    const expression = this.getExpression();
    if (!expression) {
      this.setStatus("表示された数字を、すべて一度ずつ使ってください。");
      return;
    }

    const inspection = inspectExpression(expression, this.problem);
    if (inspection.canSubmit) {
      this.setStatus("式が完成しました。= を押して判定できます。");
      return;
    }

    const used = this.getUsedCounts();
    const digitsRemain = this.problemCounts.some((count, digit) => used[digit] < count);
    if (digitsRemain) {
      this.setStatus("残りの数字をすべて使うと、= が押せます。");
      return;
    }

    this.setStatus(inspection.error?.message || "式を完成させてください。", "warning");
  }

  renderKeys() {
    const used = this.getUsedCounts();
    const inspection = inspectExpression(this.getExpression(), this.problem);
    for (const button of this.refs.calculator.querySelectorAll(".calc-key")) {
      const digitRaw = button.dataset.digit;
      let disabled = !this.enabled || this.locked;
      if (digitRaw !== undefined) {
        const digit = Number(digitRaw);
        const remaining = Math.max(0, this.problemCounts[digit] - used[digit]);
        disabled ||= remaining <= 0;
        const badge = button.querySelector(".remaining-badge");
        if (badge) {
          badge.textContent = String(remaining);
          badge.hidden = this.problemCounts[digit] <= 1 || remaining <= 0;
        }
        button.setAttribute("aria-label", `${digit}、残り${remaining}回`);
      }
      if (button.dataset.action === "submit") disabled ||= !inspection.canSubmit;
      if (button.dataset.action === "delete") disabled ||= this.cursor <= 0;
      if (button.dataset.action === "left") disabled ||= this.cursor <= 0;
      if (button.dataset.action === "right") disabled ||= this.cursor >= this.tokens.length;
      if (button.dataset.action === "clear") disabled ||= this.tokens.length === 0;
      button.disabled = disabled;
    }
  }

  handleKeyboard(event) {
    if (!this.enabled || this.locked || !this.mount.closest(".screen.is-active")) return;
    const key = event.key;
    const direct = /^[0-9()+\-*/^!|]$/u.test(key) ? key : null;
    if (direct) {
      event.preventDefault();
      this.onActivity();
      this.insert(direct);
      return;
    }
    if (key === "Enter" || key === "=") {
      event.preventDefault(); this.submit();
    } else if (key === "Backspace") {
      event.preventDefault(); this.deleteBeforeCursor();
    } else if (key === "ArrowLeft") {
      event.preventDefault(); this.moveCursor(-1);
    } else if (key === "ArrowRight") {
      event.preventDefault(); this.moveCursor(1);
    } else if (key === "Escape") {
      event.preventDefault(); this.clear();
    }
  }
}
