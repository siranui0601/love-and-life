const MAX_MULTIFACTORIAL_STEP = 9;
const MAX_ABS_VALUE = 1e100;
const INTEGER_EPSILON = 1e-10;

export class ExpressionError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "ExpressionError";
    this.code = code;
    this.details = details;
  }
}

const TOKEN_MAP = new Map([
  ["×", "mul"], ["*", "mul"],
  ["÷", "div"], ["/", "div"],
  ["−", "minus"], ["-", "minus"],
  ["+", "plus"], ["^", "power"],
  ["P", "perm"], ["p", "perm"],
  ["C", "comb"], ["c", "comb"],
  ["√", "sqrt"], ["R", "sqrt"], ["r", "sqrt"],
  ["!", "bang"], ["！", "bang"],
  ["(", "lparen"], [")", "rparen"], ["|", "abs"],
]);

export function tokenizeExpression(source) {
  const input = String(source ?? "");
  const tokens = [];

  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (/\s/u.test(char)) continue;

    if (/^[0-9]$/u.test(char)) {
      tokens.push({ type: "number", value: Number(char), raw: char, index });
      continue;
    }

    const type = TOKEN_MAP.get(char);
    if (!type) {
      throw new ExpressionError("invalid_character", `使用できない文字「${char}」があります。`, { index, char });
    }
    tokens.push({ type, raw: char, index });
  }

  return tokens;
}

function startsOperand(token) {
  return Boolean(token && ["number", "lparen", "sqrt", "abs"].includes(token.type));
}

class Parser {
  constructor(tokens) {
    this.tokens = tokens;
    this.position = 0;
  }

  peek(offset = 0) {
    return this.tokens[this.position + offset] ?? null;
  }

  consume(expectedType = null) {
    const token = this.peek();
    if (!token) {
      throw new ExpressionError("unexpected_end", "式が途中で終わっています。");
    }
    if (expectedType && token.type !== expectedType) {
      throw new ExpressionError("unexpected_token", `「${token.raw}」の位置が正しくありません。`, {
        index: token.index,
        expectedType,
        actualType: token.type,
      });
    }
    this.position += 1;
    return token;
  }

  atStop(stopTypes) {
    const token = this.peek();
    return Boolean(token && stopTypes.has(token.type));
  }

  parse(stopTypes = new Set()) {
    if (!this.peek() || this.atStop(stopTypes)) {
      throw new ExpressionError("missing_operand", "数字または式を入力してください。");
    }
    return this.parseAdditive(stopTypes);
  }

  parseAdditive(stopTypes) {
    let node = this.parseMultiplicative(stopTypes);

    while (!this.atStop(stopTypes)) {
      const token = this.peek();
      if (!token || (token.type !== "plus" && token.type !== "minus")) break;
      this.consume();
      const right = this.parseMultiplicative(stopTypes);
      node = { type: "binary", operator: token.type === "plus" ? "+" : "-", left: node, right };
    }

    return node;
  }

  parseMultiplicative(stopTypes) {
    let node = this.parseUnary(stopTypes);

    while (!this.atStop(stopTypes)) {
      const token = this.peek();
      if (!token) break;

      let operator = null;
      let implicit = false;
      if (token.type === "mul") operator = "*";
      else if (token.type === "div") operator = "/";
      else if (token.type === "perm") operator = "P";
      else if (token.type === "comb") operator = "C";
      else if (startsOperand(token)) {
        operator = "*";
        implicit = true;
      }

      if (!operator) break;
      if (!implicit) this.consume();
      const right = this.parseUnary(stopTypes);
      node = { type: "binary", operator, left: node, right, implicit };
    }

    return node;
  }

  parseUnary(stopTypes) {
    const token = this.peek();
    if (!token || this.atStop(stopTypes)) {
      throw new ExpressionError("missing_operand", "演算子の後に数字または式が必要です。");
    }

    if (["plus", "minus", "sqrt"].includes(token.type)) {
      this.consume();
      const operator = token.type === "plus" ? "+" : token.type === "minus" ? "-" : "sqrt";
      return { type: "unary", operator, argument: this.parseUnary(stopTypes) };
    }

    return this.parsePower(stopTypes);
  }

  parsePower(stopTypes) {
    let node = this.parsePostfix(stopTypes);
    if (!this.atStop(stopTypes) && this.peek()?.type === "power") {
      this.consume("power");
      const right = this.parseUnary(stopTypes);
      node = { type: "binary", operator: "^", left: node, right };
    }
    return node;
  }

  parsePostfix(stopTypes) {
    let node = this.parsePrimary(stopTypes);
    let bangCount = 0;

    while (!this.atStop(stopTypes) && this.peek()?.type === "bang") {
      this.consume("bang");
      bangCount += 1;
      if (bangCount > MAX_MULTIFACTORIAL_STEP) {
        throw new ExpressionError(
          "too_many_bangs",
          `階乗記号は連続${MAX_MULTIFACTORIAL_STEP}個までです。`,
        );
      }
    }

    if (bangCount > 0) {
      node = { type: "multifactorial", step: bangCount, argument: node };
    }
    return node;
  }

  parsePrimary(stopTypes) {
    const token = this.peek();
    if (!token || this.atStop(stopTypes)) {
      throw new ExpressionError("missing_operand", "数字または式が必要です。");
    }

    if (token.type === "number") {
      this.consume("number");
      return { type: "number", value: token.value, raw: token.raw };
    }

    if (token.type === "lparen") {
      this.consume("lparen");
      const inner = this.parse(new Set(["rparen"]));
      if (this.peek()?.type !== "rparen") {
        throw new ExpressionError("unclosed_parenthesis", "閉じ括弧が足りません。");
      }
      this.consume("rparen");
      return { type: "group", argument: inner };
    }

    if (token.type === "abs") {
      this.consume("abs");
      const inner = this.parse(new Set(["abs"]));
      if (this.peek()?.type !== "abs") {
        throw new ExpressionError("unclosed_absolute", "絶対値の閉じる「|」が足りません。");
      }
      this.consume("abs");
      return { type: "unary", operator: "abs", argument: inner };
    }

    throw new ExpressionError("unexpected_token", `「${token.raw}」の前後を確認してください。`, {
      index: token.index,
      tokenType: token.type,
    });
  }
}

export function parseExpression(source) {
  const tokens = tokenizeExpression(source);
  if (tokens.length === 0) {
    throw new ExpressionError("empty_expression", "式を入力してください。");
  }

  const parser = new Parser(tokens);
  const ast = parser.parse();
  const trailing = parser.peek();
  if (trailing) {
    const message = trailing.type === "rparen"
      ? "閉じ括弧が多すぎます。"
      : trailing.type === "abs"
        ? "絶対値の「|」の対応を確認してください。"
        : `「${trailing.raw}」の位置を確認してください。`;
    throw new ExpressionError("trailing_token", message, { index: trailing.index });
  }

  return ast;
}

function nearlyInteger(value) {
  if (!Number.isFinite(value)) return null;
  const rounded = Math.round(value);
  return Math.abs(value - rounded) <= INTEGER_EPSILON ? rounded : null;
}

function guardValue(value) {
  if (!Number.isFinite(value) || Number.isNaN(value)) {
    throw new ExpressionError("not_finite", "計算結果が実数として扱えません。");
  }
  if (Math.abs(value) > MAX_ABS_VALUE) {
    throw new ExpressionError("too_large", "計算途中の数が大きくなりすぎました。");
  }
  return Math.abs(value) <= INTEGER_EPSILON ? 0 : value;
}

export function multifactorial(value, step = 1) {
  const integer = nearlyInteger(value);
  if (integer === null || integer < 0) {
    throw new ExpressionError("invalid_factorial", "階乗は0以上の整数にだけ使えます。");
  }
  if (!Number.isInteger(step) || step < 1 || step > MAX_MULTIFACTORIAL_STEP) {
    throw new ExpressionError("invalid_factorial_step", "階乗記号の数が正しくありません。");
  }
  if (integer === 0) return 1;

  let result = 1;
  for (let current = integer; current > 0; current -= step) {
    result = guardValue(result * current);
  }
  return result;
}

function permutation(nValue, rValue) {
  const n = nearlyInteger(nValue);
  const r = nearlyInteger(rValue);
  if (n === null || r === null || n < 0 || r < 0 || r > n) {
    throw new ExpressionError("invalid_permutation", "Pは、0以上の整数で 0≦r≦n のときに使えます。");
  }

  let result = 1;
  for (let current = 0; current < r; current += 1) {
    result = guardValue(result * (n - current));
  }
  return result;
}

function combination(nValue, rValue) {
  const n = nearlyInteger(nValue);
  const rInput = nearlyInteger(rValue);
  if (n === null || rInput === null || n < 0 || rInput < 0 || rInput > n) {
    throw new ExpressionError("invalid_combination", "Cは、0以上の整数で 0≦r≦n のときに使えます。");
  }

  const r = Math.min(rInput, n - rInput);
  let result = 1;
  for (let current = 1; current <= r; current += 1) {
    result = guardValue((result * (n - r + current)) / current);
  }
  return result;
}

export function evaluateAst(ast, options = {}) {
  const trace = options.trace ?? [];

  function visit(node) {
    let value;

    switch (node.type) {
      case "number":
        value = node.value;
        break;
      case "group":
        value = visit(node.argument);
        break;
      case "unary": {
        const argument = visit(node.argument);
        if (node.operator === "+") value = argument;
        else if (node.operator === "-") value = -argument;
        else if (node.operator === "abs") value = Math.abs(argument);
        else if (node.operator === "sqrt") {
          if (argument < -INTEGER_EPSILON) {
            throw new ExpressionError("negative_sqrt", "負の数の平方根は実数として計算できません。");
          }
          value = Math.sqrt(Math.max(0, argument));
        } else {
          throw new ExpressionError("unknown_operator", "未対応の単項演算です。");
        }
        break;
      }
      case "multifactorial":
        value = multifactorial(visit(node.argument), node.step);
        break;
      case "binary": {
        const left = visit(node.left);
        const right = visit(node.right);
        switch (node.operator) {
          case "+": value = left + right; break;
          case "-": value = left - right; break;
          case "*": value = left * right; break;
          case "/":
            if (Math.abs(right) <= INTEGER_EPSILON) {
              throw new ExpressionError("division_by_zero", "0では割れません。");
            }
            value = left / right;
            break;
          case "^":
            if (Math.abs(left) <= INTEGER_EPSILON && right < 0) {
              throw new ExpressionError("division_by_zero", "0の負の累乗は計算できません。");
            }
            value = Math.pow(left, right);
            break;
          case "P": value = permutation(left, right); break;
          case "C": value = combination(left, right); break;
          default: throw new ExpressionError("unknown_operator", "未対応の演算です。");
        }
        break;
      }
      default:
        throw new ExpressionError("invalid_ast", "数式の構造を読み取れませんでした。");
    }

    value = guardValue(value);
    trace.push({ node, value });
    return value;
  }

  const value = visit(ast);
  return { value, trace };
}

export function evaluateExpression(source, options = {}) {
  const ast = parseExpression(source);
  const evaluation = evaluateAst(ast, options);
  return { ast, ...evaluation };
}

export function collectDigits(ast) {
  const digits = [];
  const visit = (node) => {
    if (!node) return;
    if (node.type === "number") digits.push(node.value);
    else if (node.type === "binary") {
      visit(node.left);
      visit(node.right);
    } else if (["unary", "group", "multifactorial"].includes(node.type)) {
      visit(node.argument);
    }
  };
  visit(ast);
  return digits;
}

export function validateDigitUsage(ast, problem) {
  const expected = [...String(problem)].map(Number).sort((a, b) => a - b);
  const actual = collectDigits(ast).sort((a, b) => a - b);
  const valid = expected.length === actual.length && expected.every((digit, index) => digit === actual[index]);
  return { valid, expected, actual };
}

export function isTen(value) {
  return Number.isFinite(value) && Math.abs(value - 10) <= INTEGER_EPSILON;
}

const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2, "P": 2, "C": 2, "^": 3 };

export function formatAst(ast) {
  function render(node, parentPrecedence = 0, side = "") {
    if (node.type === "number") return String(node.value);
    if (node.type === "group") return `(${render(node.argument)})`;
    if (node.type === "multifactorial") {
      const inner = ["number", "group", "multifactorial"].includes(node.argument.type)
        ? render(node.argument, 4)
        : `(${render(node.argument)})`;
      return `${inner}${"!".repeat(node.step)}`;
    }
    if (node.type === "unary") {
      if (node.operator === "abs") return `|${render(node.argument)}|`;
      if (node.operator === "sqrt") {
        const inner = ["number", "group", "multifactorial", "unary"].includes(node.argument.type)
          ? render(node.argument, 4)
          : `(${render(node.argument)})`;
        return `√${inner}`;
      }
      const inner = render(node.argument, 3);
      return `${node.operator}${inner}`;
    }
    if (node.type === "binary") {
      const precedence = PRECEDENCE[node.operator];
      const left = render(node.left, precedence, "left");
      const right = render(node.right, precedence, "right");
      const symbol = node.operator === "*" ? "×" : node.operator === "/" ? "÷" : node.operator;
      let text = `${left} ${symbol} ${right}`;
      const needsParentheses = precedence < parentPrecedence
        || (side === "right" && ["-", "/", "^"].includes(node.operator) && precedence === parentPrecedence)
        || (side === "left" && node.operator === "^" && precedence === parentPrecedence);
      if (needsParentheses) text = `(${text})`;
      return text;
    }
    return "?";
  }
  return render(ast);
}

export function inspectExpression(source, problem = null) {
  try {
    const ast = parseExpression(source);
    const digitUsage = problem === null ? null : validateDigitUsage(ast, problem);
    return {
      syntacticallyValid: true,
      ast,
      digitUsage,
      canSubmit: digitUsage ? digitUsage.valid : true,
      error: null,
    };
  } catch (error) {
    return {
      syntacticallyValid: false,
      ast: null,
      digitUsage: null,
      canSubmit: false,
      error: error instanceof ExpressionError ? error : new ExpressionError("parse_error", "式を確認してください。"),
    };
  }
}

export const EXPRESSION_LIMITS = Object.freeze({
  maxMultifactorialStep: MAX_MULTIFACTORIAL_STEP,
  maxAbsValue: MAX_ABS_VALUE,
  integerEpsilon: INTEGER_EPSILON,
});
